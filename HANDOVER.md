# KinetiCAD Handover

Technical handover document for anyone forking, contributing to, or extending this project. This goes deeper than the README into architecture, the bug history, and concrete file pointers for contributors.

## Purpose of this document

KinetiCAD was built in a weekend during the Replit 10 Buildathon. The README presents the public face. This document presents what a developer needs to know to actually work on the code.

If you're considering a pull request or a fork, read this first.

## Repo structure

```
/
├── artifacts/
│   ├── kineticad/                # Main CAD application
│   │   ├── src/
│   │   │   ├── cad/              # OCCT worker, topology, geometry helpers
│   │   │   ├── three/            # Three.js scene, MatePickerCoordinator
│   │   │   ├── physics/          # Rapier worker, joint construction
│   │   │   ├── state/            # Zustand stores
│   │   │   ├── components/       # React UI (Modeller, Simulator, Inspector)
│   │   │   └── shared/           # Types and constants
│   │   ├── public/
│   │   │   ├── seed-windmill.js  # Pre-baked demo assembly
│   │   │   └── ...
│   │   ├── serve.mjs             # Production Node server with cache headers
│   │   └── package.json
│   └── kineticad-intro/          # Intro showcase app
├── lib/                          # Shared utilities across artifacts
├── scripts/                      # Build and dev scripts
├── pnpm-workspace.yaml
├── README.md
├── HANDOVER.md                   # This file
└── LICENSE
```

The pnpm monorepo at root contains multiple artifacts. The main CAD app lives at `artifacts/kineticad/`.

## Architecture

KinetiCAD runs three threads:

**Main thread** handles React rendering, Three.js scene management, user input, and orchestration. Should never block.

**CAD Worker** runs OpenCascade.js compiled to WASM. All B-rep operations (sketch curve evaluation, extrusion, boolean ops, edge classification, polyline tessellation) happen here. Communicates with main via Comlink. Returns triangulated geometry plus topology metadata (edge IDs, types, polylines, circle centres, normals).

**Physics Worker** runs Rapier3D compiled to WASM. Receives body definitions and joint configurations from main. Steps the simulation at fixed 60Hz. Posts back body transforms each frame.

The two-worker split keeps both heavy computations off the main thread, so the UI stays responsive even during a complex extrude or active simulation.

### Data flow for a typical mate creation

1. User clicks an edge in the Three.js viewport
2. Main thread raycasts against the rendered geometry
3. Edge metadata is looked up from the topology cache returned by the CAD worker
4. `MatePickerCoordinator.validateRevolutePicks` validates the pick (axis alignment, edge type)
5. `polylineCenter()` computes the geometric centre from polyline samples
6. `worldToLocalPoint()` converts the centre into each part's local frame
7. The pivot is stored on the mate via Zustand
8. When the user clicks Play, the mate is sent to the physics worker
9. Rapier creates a `RevoluteJoint` with the supplied local-frame anchors
10. The simulation steps and posts body transforms back

## The pivot frame bug, explained

This is the most subtle bug we hit during the build, fixed in the latest revision. Worth understanding because it cuts to the core of how the mate system works.

**Symptom:** rotor spun in place when stationary but jumped off-axis when physics started, then orbited around an offset point instead of rotating cleanly.

**Diagnosis:** mate pivots were being stored as world-space coordinates and passed to Rapier, which expects part-local frame.

Rapier's revolute joint constraint is:

```
anchorA = bodyA.position + bodyA.rotation × pivotA_local
anchorB = bodyB.position + bodyB.rotation × pivotB_local
constraint: anchorA == anchorB at all times
```

When `pivotB_local` was a world-space point (e.g. `[0, 0, 100]` because the disc was at world z=100), and the body was also at world z=100, Rapier evaluated:

```
anchorB = [0, 0, 100] + identity × [0, 0, 100] = [0, 0, 200]
```

That doesn't match `anchorA` at `[0, 0, 100]`, so Rapier yanked the body to satisfy the constraint, producing the visible jump and orbit.

**Fix:** in `MatePickerCoordinator.ts`, after computing the polyline centre in world space, convert it to part-local frame using `worldToLocalPoint(centre, part.transform)` before storing as `localPoint`. The corresponding update was made in `RevoluteMateInspector.tsx` to overwrite the captured pivot with the validated local-frame value.

**Result:** anchors now coincide at sim start (no jump), and the local-frame Z-component is invariant under Z-axis rotation (no orbital drift).

The fix touches three call sites:

- `validateRevolutePicks` (returns local-frame pivots)
- `getEdgeAxisWorld` (centroid for axis indicator visual)
- `RevoluteMateInspector` apply path (writes validated values to mate state)

## Geometry and topology subtleties

### The arc vs circle issue

The `polylineCenter()` helper averages all polyline sample coordinates. For a uniformly sampled full circle, this returns the exact centre. For an arc segment, it returns the centroid of the arc, which is offset from the underlying circle's centre.

For a 90° arc of radius R, the centroid sits at distance `2R/π × sin(45°) ≈ 0.9R` from origin along the arc bisector. For our windmill disc with R=12 and four 90° arcs, that's a 10.8mm offset rather than zero.

This matters because boolean union of intersecting solids splits shared edges. When 4 blades fuse into a disc rim, the rim circle gets cut into 4 arc segments. There's no full circle on the boolean-merged Part 2 to use as a pivot reference.

**Workaround used in the windmill demo:** add a separate cylindrical hub feature whose edges are not split by the blade intersections. The hub's bottom circle (extruded with negative depth so it points downward from the disc) is a clean full circle and serves as the pivot reference.

**The smarter fix not yet implemented:** OCCT can expose the underlying circle of an arc-typed edge via its geometry curve. A future `MatePickerCoordinator` could detect arc edges and use the underlying circle's centre rather than the arc centroid. This would let users click any circular feature on the geometry without needing a clean full circle. Likely a single-line addition in `topology.ts` plus a fallback in `MatePickerCoordinator.ts`.

### Negative-direction extrude

The extrude tool supports negative depth. Sketch on XY, extrude with depth -12, and the resulting solid extends from part-local z=0 to z=-12. This was used for the windmill hub so the disc could sit above the post tip with the hub extending down to meet it.

### Sketch plane limitations

Sketches can be created on global XY, XZ, or YZ planes only. Sketch on selected face is not implemented. This means features can only originate from one of the three global planes.

## Verified physics

The pivot frame fix was verified on the seeded windmill demo:

```
Target:   30 RPM = π rad/s = 3.141592653589793

Measured at runtime (sample range across 23s of sim time):
  bodyBangvelMag:  3.14159270 to 3.14159298
  bodyBangvel.x:   3.24e-16    (precision floor)
  bodyBangvel.y:   -3.78e-10   (precision floor)
  bodyBangvel.z:   3.14159

Error from π:    ~3e-7 rad/s
Stability:       ±5e-7 rad/s over 23 seconds
Drift:           none
```

Off-axis components sit at floating-point single-precision noise. Pure Z-axis rotation. The result is mathematically as clean as a real-time physics engine can produce.

To reproduce: open the live demo, paste this in the browser console:

```js
fetch('/seed-windmill.js').then(r=>r.text()).then(code=>eval(code))
```

The page reloads with the assembly pre-built and the mate pre-configured. Switch to Simulator, press Play, and observe the `[step-diag]` console output for live `bodyBangvel` values.

## Production deployment

The Replit deployment uses a custom Node server (`serve.mjs`) rather than static-serve to set explicit cache headers. This was necessary because Replit's CDN was caching `index.html` aggressively, which broke deploys (users would load stale `index.html` referencing dead asset hashes).

The server sets:

- `Cache-Control: no-cache, must-revalidate` on `index.html`
- `Cache-Control: public, max-age=31536000, immutable` on hashed assets in `/assets/`
- `Cache-Control: no-cache` on `/seed-windmill.js`

This is the standard SPA caching pattern used by Vercel, Netlify, and CloudFront. Future deploys with new bundle hashes will pick up immediately.

## Known issues with file pointers

**Mate pivot picker requires full circle edges.**
Location: `artifacts/kineticad/src/three/MatePickerCoordinator.ts`
The `polylineCenter()` helper handles full circles correctly but gives an arc centroid for arc-typed edges. See "Geometry and topology subtleties" above.

**Sketch profiles cannot contain multiple closed loops.**
Location: `artifacts/kineticad/src/cad/` (sketch worker pipeline)
A plate with a hole through it would require the inner loop to be subtracted from the outer loop before extrusion. Currently each sketch supports one outer loop only.

**Hole feature position-pick clears face selection on second click.**
Location: relevant React component for the Hole feature inspector.
The hole feature is implemented but the position-picker UI has a state bug.

**Sketch on selected face not implemented.**
Currently only XY, XZ, YZ globals are available as sketch planes. Implementing this requires capturing the picked face's world transform and presenting it as a custom sketch plane in the sketcher.

**No save/load.**
There is no STEP/IGES/JSON export. The seed script approach used for `seed-windmill.js` shows how an assembly state can be serialised to localStorage, which is a starting point for a save/load implementation.

**No undo/redo.**
The Zustand store does not currently maintain a history stack.

## Local development

Clone the repo:

```bash
git clone https://github.com/AndrewBlumson/KinetiCAD.git
cd KinetiCAD
pnpm install
```

Run the dev server for the main app:

```bash
cd artifacts/kineticad
pnpm dev
```

The dev server runs at http://localhost:5173 by default.

Build for production:

```bash
pnpm build
```

Build artifacts go to `artifacts/kineticad/dist/`.

## Contribution areas

Listed in rough order of value to the project:

1. **STEP / IGES / native JSON export** — the obvious next priority. Would unlock 3D printing workflows and CAD interop. OpenCascade.js exposes export functions; the work is in the UI plumbing and file download flow.
2. **Smart pivot picker for arc edges** — small but high-impact. Detect arc-typed edges in `MatePickerCoordinator` and use the underlying circle centre from `topology.ts` rather than the arc centroid. Would remove the "must pick a full circle" UX constraint.
3. **Multi-loop sketch profiles** — supports plates with holes, ring shapes, and any sketch with disjoint closed loops. Touches the sketch worker pipeline in `artifacts/kineticad/src/cad/`.
4. **Sketch on selected face** — required for any kind of practical CAD work beyond simple primitives. The picker already returns face metadata; the work is in capturing the face transform and presenting it as a sketch plane.
5. **Hole feature position-pick fix** — small, contained UI bug. State-management fix in the relevant React component.
6. **Save / load assembly state** — see the `seed-windmill.js` script for a serialisation pattern.
7. **Undo / redo** — Zustand history middleware would handle this.

CAD or graphics engineering experience is particularly valuable on items 1, 2, and 3.

## Questions answered

These came up in public discussion of the open-source release.

**Is the geometry manifold?**
Yes. OpenCascade.js produces manifold B-rep solids through the standard sketch + extrude + boolean pipeline.

**Is it 3D printable?**
The geometry is manifold, but there is no STEP, IGES, or STL export yet. Adding STL export would be the most direct path to a 3D printing workflow. STEP export would enable round-tripping with Fusion 360, SolidWorks, and other CAD packages.

**Are you using B-rep underneath?**
Yes. OpenCascade.js running in a Web Worker via Comlink. All boolean operations, edge classification, and topology metadata come from OCCT.

**What about WebGL2 for broader browser support?**
Currently WebGPU only. The WebGPU codepath was chosen for compute shader support and modern rendering features. A WebGL2 fallback is possible via Three.js's renderer abstraction but is not implemented.
