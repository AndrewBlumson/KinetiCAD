// Phase 8 — drives the physics simulation lifecycle.
//
// Subscribes to `simulation.running` + `simulation.paused` + `mode` in
// the Zustand store. Whenever `running` flips false→true the runner:
//
// 1. Reads every visible part's mesh from the live PartMeshLayer.
// 2. Asks the CAD worker for OCCT mass properties on each part.
// 3. Forwards parts + mates to the physics worker's `buildWorld`.
// 4. Hides PartMeshLayer + BooleanResultLayer, shows SimulationLayer.
// 5. Spins a requestAnimationFrame loop that calls `step()` and
//    pushes the resulting transforms into SimulationLayer.
//
// On a true→false flip the runner stops the RAF loop, hides the
// SimulationLayer, and re-shows the modelling layers — the original
// part transforms are intact because PartMeshLayer was never mutated
// while sim was running.
//
// Pause is implemented purely in the RAF tick: the loop keeps running
// (so the canvas keeps rendering) but `step()` is skipped while
// `paused === true`.

import { getCadKernel } from "@/cad/cadClient";
import { toast } from "sonner";
import { getMaterial } from "@/cad/materials";
import type { Feature, Mate, Part, Sketch } from "@/state/schemas";
import { useKinetiCADStore } from "@/state/store";
import { computeFeatureHash } from "@/features/featureRegen";
import { getVolumeData, setVolumeData, massPropertiesForMaterial, volumeDataFromMassProperties } from "@/features/volumeCache";
import { getPartMeshLayer } from "@/three/partMeshLayerRef";
import { getSimulationLayer } from "@/three/simulationLayerRef";
import { getPhysicsKernel } from "./physicsClient";
import type { PartDescriptor, StepResult, BuildWorldResult, UpdateJointMotorResult } from "./types";
import { beginForceMeasurements, clearForceMeasurements, publishForceMeasurements } from './forceMeasurements';
import { clearPoseMeasurements, publishPoseMeasurements } from './poseMeasurements';
import { verifyBundledStewartGeometry } from './stewartFixture';
import { matchesCrankSliderConfiguration } from '../mechanisms/crankSliderWorkspace';
import { CRANK_SLIDER_SOLVER_SETTINGS } from '../mechanisms/crankSliderSolver';

/**
 * Walk a part's feature chain and return the tip hash — the same key that
 * featureCache and volumeCache use. Pure JS, no worker round-trip.
 * Returns null when the part has no features.
 */
function computeTipHash(
  features: ReadonlyArray<Feature>,
  sketches: ReadonlyArray<Sketch>,
): string | null {
  const upstreamHashes: string[] = [];
  let lastHash: string | null = null;
  for (const feature of features) {
    const h = computeFeatureHash(feature, sketches, upstreamHashes);
    upstreamHashes.push(h);
    lastHash = h;
  }
  return lastHash;
}

type RunnerHandle = {
  dispose: () => void;
};

let active: RunnerHandle | null = null;
let buildToken = 0;
// Builds, steps, motor changes and destruction share a FIFO across Scene
// instances. A late old-scene destroy can never overtake a newer build.
let physicsOperations: Promise<unknown> = Promise.resolve();
function queuePhysics<T>(operation: (physics: Awaited<ReturnType<typeof getPhysicsKernel>>) => Promise<T>): Promise<T> {
  const next = physicsOperations.then(async () => operation(await getPhysicsKernel()));
  physicsOperations = next.catch(() => {});
  return next;
}

/**
 * Bootstrap the runner once at app start. Idempotent; subsequent calls
 * are no-ops. Returns a disposer (currently only used for HMR / tests).
 */
export function startSimulationRunner(): RunnerHandle {
  if (active) return active;

  let lastRunning = false;
  let lastPaused = false;
  let lastFrameMs = 0;
  let rafId: number | null = null;
  let disposed = false;
  let stepInFlight = false;
  let worldReady = false;
  let pendingTimeMs = 0;
  let pausedResult: StepResult | null = null;
  const ownedPartLayer = getPartMeshLayer();
  const ownedSimLayer = getSimulationLayer();
  const isCurrent = (token: number) => !disposed && token === buildToken
    && getPartMeshLayer() === ownedPartLayer && getSimulationLayer() === ownedSimLayer
    && useKinetiCADStore.getState().simulation.running;

  const failRun = (error: unknown, token: number) => {
    if (!isCurrent(token)) return;
    console.error('[PHYSICS] simulation stopped:', error);
    toast.error('Simulation stopped', { description: error instanceof Error ? error.message : 'The physics calculation could not be completed.' });
    useKinetiCADStore.getState().setSimulationRunning(false);
  };

  const publishResult = (result: StepResult) => {
    if (!ownedSimLayer) return;
    for (const pose of result.transforms) ownedSimLayer.setTransform(pose.partId, pose.positionMm, pose.rotationQuat);
    if (result.dtMs > 0) useKinetiCADStore.getState().tickSimulationTime(result.dtMs);
    publishForceMeasurements(result);
    publishPoseMeasurements(result);
    // Preserve the final measured pose for comparison; Reset explicitly tears it down.
    if (result.completed) useKinetiCADStore.getState().setSimulationPaused(true);
  };

  const tearDownWorld = async () => {
    buildToken += 1;
    worldReady = false;
    pendingTimeMs = 0;
    pausedResult = null;
    clearForceMeasurements();
    clearPoseMeasurements();
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    const simLayer = getSimulationLayer() === ownedSimLayer ? ownedSimLayer : null;
    const partLayer = getPartMeshLayer() === ownedPartLayer ? ownedPartLayer : null;
    if (simLayer) {
      simLayer.setVisible(false);
      simLayer.clear();
    }
    // Restore the modelling layers. They were never modified during the
    // run so the parts snap back to their original transforms.
    if (partLayer) {
      partLayer.group.visible = true;
    }
    try {
      await queuePhysics((physics) => physics.destroy());
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[PHYSICS] destroy failed:", err);
    }
  };

  const startRunLoop = (token: number): void => {
    const tick = (timestamp: number) => {
      const state = useKinetiCADStore.getState();
      if (!isCurrent(token)) {
        rafId = null;
        return;
      }
      rafId = requestAnimationFrame(tick);
      if (state.simulation.paused) {
        lastFrameMs = timestamp;
        return;
      }
      const dtWallMs = lastFrameMs > 0 ? timestamp - lastFrameMs : 0;
      lastFrameMs = timestamp;
      pendingTimeMs += Math.max(0, dtWallMs) * state.simulation.speedMultiplier;
      if (!stepInFlight && pendingTimeMs > 0) void stepOnce(token);
    };
    lastFrameMs = 0;
    rafId = requestAnimationFrame(tick);
  };

  const stepOnce = async (token: number): Promise<void> => {
    stepInFlight = true;
    const requestedMs = pendingTimeMs;
    pendingTimeMs = 0;
    try {
      const result = await queuePhysics((physics) => {
        if (!isCurrent(token) || useKinetiCADStore.getState().simulation.paused) return Promise.resolve(null);
        return physics.step(requestedMs);
      });
      if (!isCurrent(token)) return;
      if (!result) { pendingTimeMs += requestedMs; return; }
      // An RPC already executing at Pause may finish afterward. Hold that
      // result until Resume so neither the visible pose nor its clock moves
      // while paused, and retain the actual advanced duration.
      if (useKinetiCADStore.getState().simulation.paused) pausedResult = result;
      else publishResult(result);
    } catch (err) {
      failRun(err, token);
    } finally {
      stepInFlight = false;
    }
  };

  const buildAndStart = async (myToken: number): Promise<void> => {
    const state = useKinetiCADStore.getState();
    if (state.assembly.booleanFeatures?.length) {
      throw new Error('Assembly Boolean results need their own rigid-body and joint definitions. Export the final assembly as STEP and import those solids to simulate them.');
    }
    const partLayer = getPartMeshLayer();
    const simLayer = getSimulationLayer();
    if (!partLayer || !simLayer) {
      // eslint-disable-next-line no-console
      console.warn(
        "[PHYSICS] cannot start sim — Scene layers not yet mounted",
      );
      if (isCurrent(myToken)) state.setSimulationRunning(false);
      return;
    }

    // Gather mass properties + mesh data for every part with a mesh.
    const cad = await getCadKernel();
    if (!isCurrent(myToken)) return;
    const descriptors: PartDescriptor[] = [];
    const groundId = state.assembly.groundPartId || state.assembly.parts[0]?.id;

    const partsById = new Map<string, Part>(
      state.assembly.parts.map((p) => [p.id, p]),
    );

    const meshSnapshots = new Map<
      string,
      { positions: Float32Array; indices: Uint32Array }
    >();
    partLayer.forEachVisible((partId, mesh) => {
      const geom = mesh.geometry;
      const posAttr = geom.getAttribute("position");
      const idxAttr = geom.getIndex();
      if (!posAttr || !idxAttr) return;
      meshSnapshots.set(partId, {
        positions: new Float32Array(posAttr.array as Float32Array),
        indices: new Uint32Array(idxAttr.array as Uint32Array),
      });
    });
    const missing = state.assembly.parts.filter((part) => part.visible && part.features.length > 0 && !meshSnapshots.has(part.id));
    if (missing.length) throw new Error(`Geometry is not ready for: ${missing.map((part) => part.name).join(', ')}.`);

    for (const [partId, snap] of meshSnapshots) {
      const part = partsById.get(partId);
      if (!part) continue;

      const density = getMaterial(part.materialId).densityGcm3;
      const tipHash = computeTipHash(part.features, part.sketches);
      const cachedVol = tipHash !== null ? getVolumeData(tipHash) : undefined;

      if (cachedVol) {
        // Warm volume cache — derive all physics quantities on the main
        // thread. No OCCT worker call, no await. On the 13-part orrery
        // this keeps the entire loop synchronous once the cache is warm.
        const props = massPropertiesForMaterial(cachedVol, density);
        descriptors.push({
          id: partId,
          transform: part.transform,
          meshPositions: snap.positions,
          meshIndices: snap.indices,
          massKg: props.massKg,
          comLocal: props.comLocal,
          principalInertiaKgMm2: props.principalInertiaKgMm2,
          principalInertiaLocalFrame: props.principalInertiaLocalFrame,
          isGround: partId === groundId,
        });
      } else {
        // Cold cache — Play pressed before PartMeshLayer finished its first
        // regen (e.g. cold reload), or the part is an imported-STEP body
        // whose feature chain executeUpstreamChain handles. Fall back to
        // the OCCT worker and populate the cache for next time.
        try {
          const props = await cad.getMassProperties({
            features: part.features,
            sketches: part.sketches,
            density,
          });
          if (tipHash !== null) {
            setVolumeData(tipHash, volumeDataFromMassProperties(props, density));
          }
          descriptors.push({
            id: partId,
            transform: part.transform,
            meshPositions: snap.positions,
            meshIndices: snap.indices,
            massKg: props.massKg,
            comLocal: props.comLocal,
            principalInertiaKgMm2: props.principalInertiaKgMm2,
            principalInertiaLocalFrame: props.principalInertiaLocalFrame,
            isGround: partId === groundId,
          });
        } catch (err) {
          throw new Error(`Cannot simulate ${part.name}: ${err instanceof Error ? err.message : 'Physical mass properties could not be calculated.'}`);
        }
      }
    }

    if (!isCurrent(myToken)) return;

    if (state.simulation.stewartMotion) {
      await verifyBundledStewartGeometry(state.assembly, import.meta.env?.BASE_URL ?? '/');
      if (!isCurrent(myToken)) return;
    }

    let dispatchedMates: Mate[] = [];
    let dispatchedExperiment = state.simulation.forceExperiment;
    const result = await queuePhysics<BuildWorldResult | null>((physics) => {
      if (!isCurrent(myToken)) return Promise.resolve(null);
      const latest = useKinetiCADStore.getState();
      if (latest.assembly.booleanFeatures?.length) {
        throw new Error('An assembly Boolean was added while preparing the simulation. Export its result as STEP and import the solids before simulating.');
      }
      if (latest.simulation.stewartMotion && latest.assembly !== state.assembly) {
        throw new Error('The assembly changed while the six-axis controller was preparing. Reset and run again.');
      }
      dispatchedMates = latest.assembly.mates;
      dispatchedExperiment = latest.simulation.forceExperiment;
      if (latest.simulation.stewartMotion && (dispatchedExperiment || latest.simulation.gravity.some(g => g !== 0))) {
        throw new Error('The six-axis motion comparison requires zero gravity and no external force experiment.');
      }
      if (dispatchedExperiment && latest.simulation.gravity.some((g) => g !== 0)) {
        throw new Error('The equal-force comparison requires zero gravity. Reset the demo to restore its experiment settings.');
      }
      return physics.buildWorld({
        parts: descriptors,
        mates: latest.assembly.mates,
        gravity: latest.simulation.gravity,
        timeStepMs: latest.simulation.timeStepMs,
        ...(matchesCrankSliderConfiguration(latest.assembly, latest.simulation)
          ? {
            measurementPartIds: ['crank-slider-crank', 'crank-slider-slider'],
            solverSettings: CRANK_SLIDER_SOLVER_SETTINGS,
          } : {}),
        ...(latest.simulation.stewartMotion ? {
          stewartMotion: latest.simulation.stewartMotion,
          durationMs: latest.simulation.stewartMotion.moveDurationMs + latest.simulation.stewartMotion.settleDurationMs,
        } : {}),
        ...(dispatchedExperiment ? {
          appliedForces: dispatchedExperiment.partIds.map((partId) => ({ partId,
            forceN: dispatchedExperiment!.direction.map((v) => v * dispatchedExperiment!.forceN) as [number, number, number] })),
          durationMs: dispatchedExperiment.durationMs,
        } : !latest.simulation.stewartMotion && latest.simulation.durationMs ? { durationMs: latest.simulation.durationMs } : {}),
      });
    });

    // Stopping/disposal already queued the appropriate destruction. Never
    // enqueue another destroy from a stale reply: it could kill a new world.
    if (!result || !isCurrent(myToken)) return;

    if (!result.ok) {
      throw new Error(result.error);
    }
    if (result.warnings.length > 0) {
      // eslint-disable-next-line no-console
      console.warn(
        `[PHYSICS] world built with ${result.warnings.length} warnings:`,
        result.warnings,
      );
    }
    // eslint-disable-next-line no-console
    console.info(
      `[PHYSICS] world ready — ${result.bodyCount} bodies, ${result.jointCount} joints`,
    );

    worldReady = true;
    beginForceMeasurements(dispatchedExperiment, descriptors);
    // Edits arriving during the build RPC had no ready world to update.
    // Replay that delta before any RAF step can enter the worker FIFO.
    pushChangedMotorUpdates(useKinetiCADStore.getState().assembly.mates, dispatchedMates);
    simLayer.sync(partLayer);
    partLayer.group.visible = false;
    simLayer.setVisible(true);
    startRunLoop(myToken);
  };

  const launchBuild = () => {
    const token = ++buildToken;
    void buildAndStart(token).catch((error) => failRun(error, token));
  };

  const unsubscribe = useKinetiCADStore.subscribe((state) => {
    const running = state.simulation.running;
    const paused = state.simulation.paused;
    if (running !== lastRunning) {
      lastRunning = running;
      lastPaused = paused;
      if (running) {
        launchBuild();
      } else {
        void tearDownWorld();
      }
      return;
    }
    if (paused !== lastPaused) {
      lastPaused = paused;
      lastFrameMs = 0;
      if (!paused && pausedResult) {
        const result = pausedResult;
        pausedResult = null;
        publishResult(result);
      }
    }
  });

  // Phase 9 — live motor parameter updates. Subscribe to assembly.mates
  // and diff motor fields against the previous snapshot. Only emit
  // updateJointMotor calls while the simulation is running, otherwise
  // the world doesn't exist on the worker side and there'd be nothing
  // to update — buildWorld picks up the latest values on Play anyway.
  let lastMates: Mate[] = useKinetiCADStore.getState().assembly.mates;
  const unsubscribeMotors = useKinetiCADStore.subscribe((state) => {
    const mates = state.assembly.mates;
    if (mates === lastMates) return;
    const prev = lastMates;
    lastMates = mates;
    // While mass/geometry is being gathered there is no motor to update.
    // buildWorld reads the latest mate settings when it is actually dispatched.
    if (!state.simulation.running || !worldReady) return;

    pushChangedMotorUpdates(mates, prev);
  });

  active = {
    dispose: () => {
      if (disposed) return;
      disposed = true;
      unsubscribe();
      unsubscribeMotors();
      void tearDownWorld();
      active = null;
    },
  };
  // Scene changes can mount a new runner while the store still says Running.
  if (useKinetiCADStore.getState().simulation.running) {
    lastRunning = true;
    lastPaused = useKinetiCADStore.getState().simulation.paused;
    launchBuild();
  }
  return active;
}

function pushChangedMotorUpdates(mates: Mate[], previous: Mate[]): void {
  const prevById = new Map(previous.map((mate) => [mate.id, mate]));
  for (const mate of mates) {
    const prev = prevById.get(mate.id);
    if (mate.type === "revolute" && prev?.type === "revolute" && mate.motorSpeedRpm !== prev.motorSpeedRpm) {
      void pushMotorUpdate({ mateId: mate.id, motorSpeedRpm: mate.motorSpeedRpm ?? 0 });
    } else if (mate.type === "prismatic" && prev?.type === "prismatic" && mate.motorVelocityMmPerSec !== prev.motorVelocityMmPerSec) {
      void pushMotorUpdate({ mateId: mate.id, motorVelocityMmPerSec: mate.motorVelocityMmPerSec ?? 0 });
    }
  }
}

/**
 * Forward a motor update to the physics worker, swallowing the
 * "joint not found" failure mode that occurs when the simulation
 * tears down between the dispatch and the worker reply.
 */
async function pushMotorUpdate(args: {
  mateId: string;
  motorSpeedRpm?: number;
  motorVelocityMmPerSec?: number;
}): Promise<void> {
  const token = buildToken;
  try {
    const result = await queuePhysics<UpdateJointMotorResult | null>((physics) => {
      if (token !== buildToken || !useKinetiCADStore.getState().simulation.running) return Promise.resolve(null);
      return physics.updateJointMotor(args);
    });
    if (result && !result.ok && import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn(
        `[PHYSICS] live motor update for ${args.mateId} failed: ${result.error}`,
      );
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[PHYSICS] updateJointMotor threw:", err);
  }
}
