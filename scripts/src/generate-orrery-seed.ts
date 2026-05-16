// Generated orrery seed for KinetiCAD.
// Run with: pnpm --filter @workspace/scripts run generate-orrery-seed
// Output:   artifacts/kineticad/public/seeds/orrery.js
// Spec:     artifacts/kineticad/docs/orrery-build-spec.md
// 16/05/2026

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Parametric configuration ─────────────────────────────────────────────────
// Change these to scale up across build phases.
// Phase 1: 2 planets, no moons, no ring.

const PARAMS = {
  // Scale toggles — the only things that change between phases 1–4.
  planetCount: 8,                           // Phase 1: 2 | Phase 2+: 8
  moonOnPlanets: [] as number[],            // Phase 1: [] | Phase 3: [2,4,6] (1-based)
  ring: false,                              // Phase 1: false | Phase 4: true

  // Geometry — sun
  sunRadius: 25,                            // mm disc radius
  sunHeight: 25,                            // mm symmetric extrude depth (±12.5 mm in Z)

  // Geometry — planets (one entry per planet slot, index 0 = planet 1)
  planetRadii: [12, 12, 14, 10, 16, 11, 13, 9] as number[],
  planetHeight: 8,                          // mm disc height (extrude forward)
  armRadius: 2.5,                           // mm arm cylinder radius

  // Geometry — moons
  moonRadius: 5,                            // mm disc radius
  moonHeight: 6,                            // mm disc height (extrude forward)
  moonArmRadius: 2,                         // mm arm cylinder radius
  // moonOrbitRadius is computed per planet: planetRadii[i] + moonClearanceGap
  // Spec section 6.4 (revised): relative to planet radius, not a flat constant.
  moonClearanceGap: 16,                     // mm gap between planet surface and moon orbit

  // Geometry — asteroid ring
  ringRadius: 224,                          // mm orbit radius of ring lumps
  ringLumpCount: 24,                        // number of lumps around the ring
  ringLumpRadius: 3,                        // mm radius per lump disc
  ringLumpHeight: 4,                        // mm height per lump disc

  // Layout (spec section 6)
  orbitRadiusBase: 70,                      // mm orbit radius for planet 1
  orbitRadiusStep: 42,                      // mm increment per planet

  // Speeds (spec section 8) — tuned for video readability, not orbital accuracy.
  periodInner: 5,                           // seconds (planet 1 orbit period)
  periodOuter: 13,                          // seconds (planet 8 orbit period — fixed span)
  moonPeriod: 2.5,                          // seconds per moon orbit
  ringPeriod: 18,                           // seconds per ring orbit

  // Physics
  // [0,0,0] = weightless. An orrery is a powered mechanism; gravity is
  // irrelevant to its operation and creates large bending loads on the
  // joint constraints that destabilise the solver. Spec section 4.
  gravity: [0, 0, 0] as [number, number, number],
};

// Must match the `version` field in src/state/store.ts persist config.
// Check store.ts before bumping this — wrong version triggers migrations.
const PERSIST_VERSION = 8;

// ── Maths helpers ─────────────────────────────────────────────────────────────

function orbitRadius(i: number): number {
  // i is 1-based. Spec section 6.1.
  return PARAMS.orbitRadiusBase + (i - 1) * PARAMS.orbitRadiusStep;
}

function planetRpm(i: number): number {
  // Spec section 8.1. Denominator fixed at 7 (8-planet span) so speeds are
  // stable across all phases regardless of planetCount.
  const period =
    PARAMS.periodInner +
    ((i - 1) * (PARAMS.periodOuter - PARAMS.periodInner)) / 7;
  return 60 / period;
}

function r4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

// ── Part builders ─────────────────────────────────────────────────────────────

function buildSunPart(): object {
  return {
    id: "part-sun",
    name: "Sun",
    visible: true,
    materialId: "default",
    transform: { positionMm: [0, 0, 0], rotationDeg: [0, 0, 0] },
    sketches: [
      {
        id: "sk-sun-1",
        name: "Sketch 1",
        plane: "XY",
        primitives: [{ type: "circle", centre: [0, 0], radius: PARAMS.sunRadius }],
      },
    ],
    features: [
      {
        id: "feat-sun-1",
        type: "extrude",
        sketchId: "sk-sun-1",
        depthMm: PARAMS.sunHeight,
        direction: "forward",
        extrudeMode: "new-body",
      },
    ],
  };
}

function buildPlanetPart(i: number): object {
  // i is 1-based planet index.
  // Arm: YZ-plane circle extruded forward (+X) → cylinder from [0,0,0] to [r,0,0].
  // Planet disc: XY-plane circle at [r,0] extruded forward (+Z) → disc at local X=r.
  // Initial fan-out: (i-1)*45 deg rotation about Z so arms spread evenly (spec 6.3).
  const r = orbitRadius(i);
  const pr = PARAMS.planetRadii[i - 1] ?? 12;
  const pid = `part-planet-${i}`;

  return {
    id: pid,
    name: `Planet ${i}`,
    visible: true,
    materialId: "default",
    transform: { positionMm: [0, 0, 0], rotationDeg: [0, 0, (i - 1) * 45] },
    sketches: [
      {
        id: `sk-${pid}-arm`,
        name: "Arm",
        plane: "YZ",
        primitives: [{ type: "circle", centre: [0, 0], radius: PARAMS.armRadius }],
      },
      {
        id: `sk-${pid}-disc`,
        name: "Planet disc",
        plane: "XY",
        primitives: [{ type: "circle", centre: [r, 0], radius: pr }],
      },
    ],
    features: [
      {
        id: `feat-${pid}-arm`,
        type: "extrude",
        sketchId: `sk-${pid}-arm`,
        depthMm: r,
        direction: "forward",
        extrudeMode: "new-body",
      },
      {
        id: `feat-${pid}-disc`,
        type: "extrude",
        sketchId: `sk-${pid}-disc`,
        depthMm: PARAMS.planetHeight,
        direction: "forward",
        extrudeMode: "add",
      },
    ],
  };
}

function buildMoonPart(moonIndex: number, planetIndex: number): object {
  // moonIndex is a 1-based global moon counter.
  // planetIndex is the 1-based planet this moon orbits.
  // moonOrbitRadius = planetRadius + moonClearanceGap (spec section 6.4 revised).
  const pr = PARAMS.planetRadii[planetIndex - 1] ?? 12;
  const moonOrbitR = pr + PARAMS.moonClearanceGap;
  const mid = `part-moon-${moonIndex}`;

  return {
    id: mid,
    name: `Moon ${moonIndex}`,
    visible: true,
    materialId: "default",
    transform: { positionMm: [0, 0, 0], rotationDeg: [0, 0, 0] },
    sketches: [
      {
        id: `sk-${mid}-arm`,
        name: "Moon arm",
        plane: "YZ",
        primitives: [{ type: "circle", centre: [0, 0], radius: PARAMS.moonArmRadius }],
      },
      {
        id: `sk-${mid}-disc`,
        name: "Moon disc",
        plane: "XY",
        primitives: [{ type: "circle", centre: [moonOrbitR, 0], radius: PARAMS.moonRadius }],
      },
    ],
    features: [
      {
        id: `feat-${mid}-arm`,
        type: "extrude",
        sketchId: `sk-${mid}-arm`,
        depthMm: moonOrbitR,
        direction: "forward",
        extrudeMode: "new-body",
      },
      {
        id: `feat-${mid}-disc`,
        type: "extrude",
        sketchId: `sk-${mid}-disc`,
        depthMm: PARAMS.moonHeight,
        direction: "forward",
        extrudeMode: "add",
      },
    ],
  };
}

function buildRingPart(): object {
  const sketches: object[] = [];
  const features: object[] = [];

  for (let k = 0; k < PARAMS.ringLumpCount; k++) {
    const angle = (k / PARAMS.ringLumpCount) * 2 * Math.PI;
    const cx = r4(PARAMS.ringRadius * Math.cos(angle));
    const cy = r4(PARAMS.ringRadius * Math.sin(angle));

    sketches.push({
      id: `sk-ring-lump-${k}`,
      name: `Ring lump ${k + 1}`,
      plane: "XY",
      primitives: [{ type: "circle", centre: [cx, cy], radius: PARAMS.ringLumpRadius }],
    });

    features.push({
      id: `feat-ring-lump-${k}`,
      type: "extrude",
      sketchId: `sk-ring-lump-${k}`,
      depthMm: PARAMS.ringLumpHeight,
      direction: "forward",
      extrudeMode: k === 0 ? "new-body" : "add",
    });
  }

  return {
    id: "part-ring",
    name: "Asteroid ring",
    visible: true,
    materialId: "default",
    transform: { positionMm: [0, 0, 0], rotationDeg: [0, 0, 0] },
    sketches,
    features,
  };
}

// ── Mate builders ─────────────────────────────────────────────────────────────

function buildPlanetMate(i: number): object {
  // Both pivots at local [0,0,0]: each part's origin sits at world origin,
  // so the joint axis passes through [0,0,0] in both local frames.
  return {
    id: `mate-planet-${i}`,
    type: "revolute",
    name: `Planet ${i}`,
    partA: "part-sun",
    partB: `part-planet-${i}`,
    pivotA: { kind: "edge", edgeId: "sun-center", localPoint: [0, 0, 0] },
    pivotB: { kind: "edge", edgeId: `planet-${i}-origin`, localPoint: [0, 0, 0] },
    axisLocal: [0, 0, 1],
    motorSpeedRpm: r4(planetRpm(i)),
  };
}

function buildMoonMate(moonIndex: number, planetIndex: number): object {
  // Pivot on the parent arm-planet part is [orbitRadius,0,0]: the planet disc centre
  // in that part's local frame (spec section 6.5).
  const r = orbitRadius(planetIndex);
  return {
    id: `mate-moon-${moonIndex}`,
    type: "revolute",
    name: `Moon ${moonIndex}`,
    partA: `part-planet-${planetIndex}`,
    partB: `part-moon-${moonIndex}`,
    pivotA: {
      kind: "edge",
      edgeId: `planet-${planetIndex}-disc-center`,
      localPoint: [r, 0, 0],
    },
    pivotB: { kind: "edge", edgeId: `moon-${moonIndex}-origin`, localPoint: [0, 0, 0] },
    axisLocal: [0, 0, 1],
    motorSpeedRpm: r4(60 / PARAMS.moonPeriod),
  };
}

function buildRingMate(): object {
  return {
    id: "mate-ring",
    type: "revolute",
    name: "Asteroid ring",
    partA: "part-sun",
    partB: "part-ring",
    pivotA: { kind: "edge", edgeId: "sun-center", localPoint: [0, 0, 0] },
    pivotB: { kind: "edge", edgeId: "ring-origin", localPoint: [0, 0, 0] },
    axisLocal: [0, 0, 1],
    motorSpeedRpm: r4(60 / PARAMS.ringPeriod),
  };
}

// ── Assemble ──────────────────────────────────────────────────────────────────

const parts: object[] = [buildSunPart()];
const mates: object[] = [];

for (let i = 1; i <= PARAMS.planetCount; i++) {
  parts.push(buildPlanetPart(i));
  mates.push(buildPlanetMate(i));
}

let moonCounter = 1;
for (const planetIdx of PARAMS.moonOnPlanets) {
  if (planetIdx < 1 || planetIdx > PARAMS.planetCount) continue;
  parts.push(buildMoonPart(moonCounter, planetIdx));
  mates.push(buildMoonMate(moonCounter, planetIdx));
  moonCounter++;
}

if (PARAMS.ring) {
  parts.push(buildRingPart());
  mates.push(buildRingMate());
}

const state = {
  mode: "modeller",
  assembly: {
    id: "asm-orrery",
    name: "Orrery",
    groundPartId: "part-sun",
    booleanFeatures: [],
    parts,
    mates,
  },
  simulation: {
    running: false,
    paused: false,
    timeStepMs: 1000 / 60,
    gravity: PARAMS.gravity,
    speedMultiplier: 1,
    simulationTimeMs: 0,
  },
};

// ── Emit seed file ────────────────────────────────────────────────────────────

const bodyCount = parts.length;
const jointCount = mates.length;
const partNames = (parts as Array<{ name: string }>).map((p) => p.name).join(", ");
const today = new Date().toISOString().slice(0, 10);

const iife = `\
// Generated by scripts/src/generate-orrery-seed.ts — do not edit directly.
// Phase 1 settings: planetCount=${PARAMS.planetCount}, moonOnPlanets=[], ring=false.
// Bodies: ${bodyCount}, joints: ${jointCount}. Generated: ${today}.
// Paste in the browser console while on the KinetiCAD tab.
(function () {
  var state = ${JSON.stringify(state, null, 2)};
  localStorage.setItem("kineticad-state", JSON.stringify({ state: state, version: ${PERSIST_VERSION} }));
  console.log("[seed] Orrery state written (${bodyCount} bodies, ${jointCount} joints). Reloading\u2026");
  location.reload();
})();
`;

const outPath = path.resolve(
  __dirname,
  "../../artifacts/kineticad/public/seeds/orrery.js"
);
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, iife, "utf-8");

console.log(`[generate-orrery-seed] Written: ${outPath}`);
console.log(`  Bodies : ${bodyCount} (${partNames})`);
console.log(`  Joints : ${jointCount}`);
console.log(`  Version: ${PERSIST_VERSION}`);
