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
import type { Mate, Part } from "@/state/schemas";
import { useKinetiCADStore } from "@/state/store";
import { getPartMeshLayer } from "@/three/partMeshLayerRef";
import { getSimulationLayer } from "@/three/simulationLayerRef";
import { getPhysicsKernel } from "./physicsClient";
import type { PartDescriptor } from "./types";

const ALUMINIUM_DENSITY_G_CM3 = 2.7;

type RunnerHandle = {
  dispose: () => void;
};

let active: RunnerHandle | null = null;
let rafId: number | null = null;
let buildToken = 0;

/**
 * Bootstrap the runner once at app start. Idempotent; subsequent calls
 * are no-ops. Returns a disposer (currently only used for HMR / tests).
 */
export function startSimulationRunner(): RunnerHandle {
  if (active) return active;

  let lastRunning = false;
  let lastPaused = false;
  let lastFrameMs = 0;

  const tearDownWorld = async () => {
    buildToken += 1;
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    const simLayer = getSimulationLayer();
    const partLayer = getPartMeshLayer();
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
      const physics = await getPhysicsKernel();
      await physics.destroy();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[PHYSICS] destroy failed:", err);
    }
  };

  const startRunLoop = (): void => {
    const tick = (timestamp: number) => {
      const state = useKinetiCADStore.getState();
      if (!state.simulation.running) {
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
      // Step the worker. We don't await before requesting the next
      // frame — Comlink will queue, and worst case we drop a frame.
      stepOnce(dtWallMs * state.simulation.speedMultiplier);
    };
    lastFrameMs = 0;
    rafId = requestAnimationFrame(tick);
  };

  const stepOnce = async (dtWallMs: number): Promise<void> => {
    try {
      const physics = await getPhysicsKernel();
      const result = await physics.step(dtWallMs > 0 ? dtWallMs : undefined);
      const simLayer = getSimulationLayer();
      if (!simLayer) return;
      for (const t of result.transforms) {
        simLayer.setTransform(t.partId, t.positionMm, t.rotationQuat);
      }
      // Use the wall-clock delta scaled by speedMultiplier as our
      // physics-time accumulator. The fixed step inside the worker
      // is constant; the multiplier shows up here as the apparent rate.
      const tickDelta = dtWallMs > 0 ? dtWallMs : result.dtMs;
      useKinetiCADStore.getState().tickSimulationTime(tickDelta);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[PHYSICS] step failed:", err);
    }
  };

  const buildAndStart = async (): Promise<void> => {
    const myToken = ++buildToken;
    const state = useKinetiCADStore.getState();
    const partLayer = getPartMeshLayer();
    const simLayer = getSimulationLayer();
    if (!partLayer || !simLayer) {
      // eslint-disable-next-line no-console
      console.warn(
        "[PHYSICS] cannot start sim — Scene layers not yet mounted",
      );
      state.setSimulationRunning(false);
      return;
    }

    // Snapshot the SimulationLayer from the live PartMeshLayer.
    simLayer.sync(partLayer);
    // Hide modelling layers; show sim layer. Doing this before the
    // build call keeps the canvas from briefly showing duplicate
    // bodies if buildWorld takes >1 frame.
    partLayer.group.visible = false;
    simLayer.setVisible(true);

    // Gather mass properties + mesh data for every part with a mesh.
    const cad = await getCadKernel();
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

    for (const [partId, snap] of meshSnapshots) {
      const part = partsById.get(partId);
      if (!part) continue;
      try {
        const props = await cad.getMassProperties({
          features: part.features,
          sketches: part.sketches,
          density: ALUMINIUM_DENSITY_G_CM3,
        });
        descriptors.push({
          id: partId,
          transform: part.transform,
          meshPositions: snap.positions,
          meshIndices: snap.indices,
          massKg: props.massKg,
          comLocal: props.comLocal,
          principalInertiaKgMm2: props.principalInertiaKgMm2,
          isGround: partId === groundId,
        });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn(
          `[PHYSICS] mass-props failed for ${partId}, skipping body:`,
          err,
        );
      }
    }

    if (myToken !== buildToken) return; // user toggled off mid-build

    const physics = await getPhysicsKernel();
    const result = await physics.buildWorld({
      parts: descriptors,
      mates: state.assembly.mates,
      gravity: state.simulation.gravity,
      timeStepMs: state.simulation.timeStepMs,
    });

    if (myToken !== buildToken) {
      await physics.destroy();
      return;
    }

    if (!result.ok) {
      // eslint-disable-next-line no-console
      console.error("[PHYSICS] buildWorld failed:", result.error);
      useKinetiCADStore.getState().setSimulationRunning(false);
      return;
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

    startRunLoop();
  };

  const unsubscribe = useKinetiCADStore.subscribe((state) => {
    const running = state.simulation.running;
    const paused = state.simulation.paused;
    if (running !== lastRunning) {
      lastRunning = running;
      lastPaused = paused;
      if (running) {
        void buildAndStart();
      } else {
        void tearDownWorld();
      }
      return;
    }
    if (paused !== lastPaused) {
      lastPaused = paused;
      // RAF tick handles pause/resume internally.
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
    if (!state.simulation.running) return;

    const prevById = new Map(prev.map((m) => [m.id, m]));
    for (const m of mates) {
      const p = prevById.get(m.id);
      if (!p) continue;
      if (
        m.type === "revolute" &&
        p.type === "revolute" &&
        m.motorSpeedRpm !== p.motorSpeedRpm
      ) {
        void pushMotorUpdate({
          mateId: m.id,
          motorSpeedRpm: m.motorSpeedRpm ?? 0,
        });
      } else if (
        m.type === "prismatic" &&
        p.type === "prismatic" &&
        m.motorVelocityMmPerSec !== p.motorVelocityMmPerSec
      ) {
        void pushMotorUpdate({
          mateId: m.id,
          motorVelocityMmPerSec: m.motorVelocityMmPerSec ?? 0,
        });
      }
    }
  });

  active = {
    dispose: () => {
      unsubscribe();
      unsubscribeMotors();
      void tearDownWorld();
      active = null;
    },
  };
  return active;
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
  try {
    const physics = await getPhysicsKernel();
    const result = await physics.updateJointMotor(args);
    if (!result.ok && import.meta.env.DEV) {
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
