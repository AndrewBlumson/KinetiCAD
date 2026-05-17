// Backward-compat shim. The canonical seed is now at /app/seeds/windmill.js.
// fetch('/app/seed-windmill.js').then(r=>r.text()).then(eval) continues to work
// from the browser console. Uses window.__seedBase (set by index.html) to
// resolve the seed path correctly regardless of BASE_PATH. Updated 17/05/2026.
fetch((window.__seedBase || '/') + 'seeds/windmill.js').then(function (r) { return r.text(); }).then(eval);

// ---------------------------------------------------------------------------
// Original IIFE kept below for reference only. Not executed.
// ---------------------------------------------------------------------------
/* (function () {
  const state = {
    mode: "modeller",
    assembly: {
      id: "asm-windmill",
      name: "Assembly 1",
      groundPartId: "part-post",
      booleanFeatures: [],
      parts: [
        /* ── Part 1: post ─────────────────────────────────────────────── */
        {
          id: "part-post",
          name: "Part 1",
          visible: true,
          materialId: "default",
          transform: { positionMm: [0, 0, 0], rotationDeg: [0, 0, 0] },
          sketches: [
            {
              id: "sk-post-1",
              name: "Sketch 1",
              plane: "XY",
              primitives: [{ type: "circle", centre: [0, 0], radius: 6 }],
            },
          ],
          features: [
            {
              id: "feat-post-1",
              type: "extrude",
              sketchId: "sk-post-1",
              depthMm: 100,
              direction: "forward",
              extrudeMode: "new-body",
            },
          ],
        },

        /* ── Part 2: rotor ─────────────────────────────────────────────── */
        {
          id: "part-rotor",
          name: "Part 2",
          visible: true,
          materialId: "default",
          // Hub bottom at world z=100 → part-local z=-12 → part z-origin=112
          transform: { positionMm: [0, 0, 112], rotationDeg: [0, 0, 0] },
          sketches: [
            // Disc (r=12)
            {
              id: "sk-rotor-1",
              name: "Sketch 1",
              plane: "XY",
              primitives: [{ type: "circle", centre: [0, 0], radius: 12 }],
            },
            // Hub (r=3, will extrude BACKWARD = -Z)
            {
              id: "sk-rotor-2",
              name: "Sketch 2",
              plane: "XY",
              primitives: [{ type: "circle", centre: [0, 0], radius: 3 }],
            },
            // Blade +X  (x=12..24, y=-1..+1)
            {
              id: "sk-rotor-3",
              name: "Sketch 3",
              plane: "XY",
              primitives: [
                { type: "rectangle", corner: [12, -1], width: 12, height: 2 },
              ],
            },
            // Blade -X  (x=-24..-12, y=-1..+1)
            {
              id: "sk-rotor-4",
              name: "Sketch 4",
              plane: "XY",
              primitives: [
                { type: "rectangle", corner: [-24, -1], width: 12, height: 2 },
              ],
            },
            // Blade +Y  (x=-1..+1, y=12..24)
            {
              id: "sk-rotor-5",
              name: "Sketch 5",
              plane: "XY",
              primitives: [
                { type: "rectangle", corner: [-1, 12], width: 2, height: 12 },
              ],
            },
            // Blade -Y  (x=-1..+1, y=-24..-12)
            {
              id: "sk-rotor-6",
              name: "Sketch 6",
              plane: "XY",
              primitives: [
                { type: "rectangle", corner: [-1, -24], width: 2, height: 12 },
              ],
            },
          ],
          features: [
            // Disc: z=0..+4
            {
              id: "feat-rotor-disc",
              type: "extrude",
              sketchId: "sk-rotor-1",
              depthMm: 4,
              direction: "forward",
              extrudeMode: "new-body",
            },
            // Hub: z=0..-12  (backward = -Z in XY plane)
            {
              id: "feat-rotor-hub",
              type: "extrude",
              sketchId: "sk-rotor-2",
              depthMm: 12,
              direction: "backward",
              extrudeMode: "add",
            },
            // Blade +X: z=0..+4
            {
              id: "feat-rotor-b1",
              type: "extrude",
              sketchId: "sk-rotor-3",
              depthMm: 4,
              direction: "forward",
              extrudeMode: "add",
            },
            // Blade -X: z=0..+4
            {
              id: "feat-rotor-b2",
              type: "extrude",
              sketchId: "sk-rotor-4",
              depthMm: 4,
              direction: "forward",
              extrudeMode: "add",
            },
            // Blade +Y: z=0..+4
            {
              id: "feat-rotor-b3",
              type: "extrude",
              sketchId: "sk-rotor-5",
              depthMm: 4,
              direction: "forward",
              extrudeMode: "add",
            },
            // Blade -Y: z=0..+4
            {
              id: "feat-rotor-b4",
              type: "extrude",
              sketchId: "sk-rotor-6",
              depthMm: 4,
              direction: "forward",
              extrudeMode: "add",
            },
          ],
        },
      ],

      /* ── Revolute mate ─────────────────────────────────────────────────── */
      mates: [
        {
          id: "mate-rev-1",
          type: "revolute",
          name: "Revolute 1",
          partA: "part-post",
          partB: "part-rotor",
          // pivotA: post-top circle centre in part-A local frame
          // partA at [0,0,0], top circle at world z=100 → local [0,0,100]
          pivotA: {
            kind: "edge",
            edgeId: "post-top-circle",
            localPoint: [0, 0, 100],
          },
          // pivotB: hub-bottom circle centre in part-B local frame
          // partB at [0,0,112], hub bottom at world z=100 → local [0,0,-12]
          pivotB: {
            kind: "edge",
            edgeId: "hub-bottom-circle",
            localPoint: [0, 0, -12],
          },
          // Rotation axis = Z in part-A's local frame
          axisLocal: [0, 0, 1],
          motorSpeedRpm: 30,
        },
      ],
    },

    simulation: {
      running: false,
      paused: false,
      timeStepMs: 1000 / 60,
      gravity: [0, 0, -9810],
      speedMultiplier: 1,
      simulationTimeMs: 0,
    },
  };

  localStorage.setItem("kineticad-state", JSON.stringify({ state, version: 8 }));
  console.log("[seed] State written. Reloading…");
  location.reload();
})(); */
