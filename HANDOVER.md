# KinetiCAD Handover, 17/05/2026

## Project

KinetiCAD is an open-source browser-based parametric CAD tool with B-rep geometry underneath, real-time physics simulation, and mate constraints. Built on Replit by Andrew Blumson (Adevious AI Ltd, UK Replit Ambassador), co-built with Kevin Blumson. MIT licence.

- Repository: https://github.com/AndrewBlumson/KinetiCAD
- Live (CAD app): https://kineticad.co.uk/app
- Landing: https://kineticad.co.uk — routes `/story` (product story), `/terms` (Terms of Service), `/privacy` (Privacy Policy); OG tags, JSON-LD schema, `sitemap.xml` and `robots.txt` in place.
- Stack: React 19, Vite 8, TypeScript 6, Three.js r184 with WebGPURenderer, OpenCascade.js 2.0.0-beta.94e2944 (B-rep, WebAssembly, Web Worker, Comlink), Rapier3D 0.12.0 (physics, separate Web Worker), Zustand, Tailwind, Sonner toasts, Howler.js
- Coordinate system: Z-up, millimetre units. UK English, GBP, DD/MM/YYYY.
- Repository structure: pnpm monorepo at the root, with the main CAD app at `artifacts/kineticad/`.

This handover is the deep reference for anyone picking up the code. The phase-by-phase build log lives in `replit.md` at the repository root and is the authoritative record of what was built when. Where this handover and `replit.md` disagree, `replit.md` wins, because it is regenerated from git history.

## Current status

The build follows a 12-phase spec. Phases 0 to 10 are complete. Phases 0 to 9 cover: app shell, WebGPU scene, sketching, Extrude and Revolve, topology picking, modifier features (Fillet, Chamfer, Hole), boolean operations, multi-part scene management, mate joints, Rapier3D physics integration, and motor actuation. Phase 10 (Material Library) is also complete: eight engineering material presets with density-driven mass properties, per-part material selection, and a mass/volume readout in the inspector. Phases 11 to 12 are pending.

Post-phase work also complete: the Z-up convention switch, the STEP import fix session, the seed registry, the orrery showcase build, and the Save/Load model feature.

Nothing is in flight at the time of this handover. The outstanding and parked work is listed below.

## What ships and is verified

### Modelling

Sketching on the global XY, XZ and YZ planes, with line, rectangle, three-point arc and circle tools, a snap engine (endpoint, midpoint, grid priority), and a live overlay. Extrude and Revolve features with forward, backward and symmetric directions. Modifier features Fillet, Chamfer and Hole, driven by edge and face picking. Boolean operations Union, Subtract and Intersect at assembly level. Multi-part assemblies with per-part visibility, inline rename, duplicate, and a translate/rotate transform gizmo.

### Mates

Five mate types can be created: Revolute, Prismatic, Spherical, Fixed and Planar. Revolute and Prismatic carry a motor parameter (RPM for revolute, mm/s for prismatic). One part can be set as the ground anchor. Cascade delete removes dependent mates and booleans and resets the ground anchor when the ground part is deleted.

### Physics

Real-time rigid-body simulation via Rapier3D, in a dedicated Web Worker. Mate joints become Rapier joints; motorised joints sustain a commanded velocity. Four mate types actuate in simulation: Revolute, Prismatic, Spherical and Fixed. The Planar mate is created and stored but skipped by the physics joint builder, because Rapier 0.12 has no native planar joint. Mass properties are derived from the B-rep geometry. Default gravity is Z-down in mm/s squared.

### File interop

STL export, binary.

STEP import, single-part and multi-part assembly. The reader uses `STEPControl_Reader_1` with `TransferRoots(progress)` then `OneShape()`; compound shapes are decomposed into individual solids, each becoming its own part. Imported parts are auto-grounded: a single uniform Z translation across all solids drops the assembly onto the Z=0 plane while preserving relative positions.

STEP export, with full round-trip. KinetiCAD-exported STEP files re-import cleanly with geometry, hierarchy and relative positions preserved.

Verification done on the deployed `.replit.app` URL in Chrome on an M-series Mac:

- STL export: the windmill STL renders correctly in macOS Preview. A programmatic check confirms binary format, 408 triangles, 20,484 bytes, zero degenerate triangles, zero zero-normals, zero NaN or Inf values. Bambu Studio sliced the windmill to a complete 454-layer print plan and to 707 layers with tree-auto supports.
- STEP import, single part: McMaster-Carr M3 socket-head screw 91290A115 imported and grounded.
- STEP import, multi-part assembly: McMaster-Carr torque-limiting coupling 9132K11 imported as 12 separate parts with relative positions preserved.
- STEP round-trip: coupling exported and re-imported, geometry preserved. Hierarchy flattens on round-trip: 12 source parts return as 43 because export iterates over each solid directly. The windmill round-trips as 6 parts (post, rotor, four blades).
- Windmill physics canary: bodyBangvelMag stable at pi plus or minus 5e-7.

### Save and Load

Two toolbar buttons in the Modeller, placed after Export STEP. Save reads the persisted state from `localStorage["kineticad-state"]`, which the persist middleware writes synchronously on every state change, and downloads it as `kineticad-model-YYYYMMDD-HHMMSS.json`. The file is byte-for-byte identical to a seed file, in `{ state, version }` format. Load opens a JSON file picker and validates before touching state: the `version` and `state` keys must be present, `version` must equal the current persist version, and `state.assembly` must be present. Any failure shows a toast and leaves state untouched. On a valid file, the state is written to localStorage and the page reloaded, reusing the seed loader mechanism so the workers and physics engine rebuild cleanly.

Save and Load persists sketch-based parts, features, mates and booleans. It does not persist imported B-rep geometry: see the limitations below.

## Known limitations, by design or by format

STEP files do not carry mates or joints. Round-tripping an assembly through STEP loses the kinematic relationships, so mates must be re-established after import. This is a STEP format characteristic affecting all CAD tools, not specific to KinetiCAD. STEP AP242 has provisions for kinematic data but industry support is patchy.

STEP export flattens compound-of-solids hierarchy. Each solid is written as a separate root entity. Geometry is preserved, sub-assembly grouping is lost.

Imported parts do not survive a page refresh. B-rep geometry lives in OpenCascade.js WebAssembly memory, which is wiped on reload. The persist layer holds assembly metadata but cannot persist WebAssembly-managed objects. Sketch-based parts survive a refresh because the feature regeneration pipeline reconstructs them from the sketch and feature list; imported STEP parts have no regeneration path. The fix is an IndexedDB layer that persists the original STEP bytes and replays the import on load.

Imported parts are named after the source filename. STEP files contain a PRODUCT entity name per component, but reading it back was investigated and found impossible in this OpenCascade.js binding. `STEPCAFControl_Reader_1` is required to populate the XCAF label tree, but eight separate paths to read the `TDataStd_Name` attribute all failed against the embind binding. XCAF label name extraction is therefore not available; file-stem naming is permanent documented behaviour, not a roadmap item.

The Planar mate is created and stored but does not actuate in simulation. Rapier 0.12 has no native planar joint, and the generic six-degree-of-freedom API is awkward. This is left for a later polish phase.

## Outstanding and parked work

Not in flight; carried as the backlog.

### Bugs and technical debt

Arc-edge pivot, end-to-end verification. The topology-side fix is in and committed: `topology.ts` now writes the true circle centre into the emitted edge metadata. The windmill canary holds pi after it. What remains unverified is the full pick path: a user clicking a partial-arc edge, for example on a boolean-cut rim, and getting a correct pivot through `MatePickerCoordinator`. A diagnostic prompt was drafted for this but not run, partly because edge picking by hand and the browser automation both proved difficult. See "The arc versus circle issue" below for the underlying geometry.

The Hole feature position-picker clears the face selection on the second click.

Sketch profiles cannot contain multiple closed loops, for example a plate with a hole.

Sketch on a selected face is not implemented; only the global XY, XZ and YZ planes are available.

Boolean result meshes are not wired into the topology picker. They can be selected only from the BOOLEANS sidebar, not by clicking in the 3D view.

### Feature roadmap

- IndexedDB cache for imported STEP file bytes, so imported parts survive a refresh.
- IGES import and export, for wider CAD interop.
- Undo/redo via Zustand history middleware.
- WebGL2 fallback for browsers without WebGPU.
- Mobile responsive layout.
- Inline thumbnails in the Boolean inspector for input parts, the Subtract tool slot and the live result.
- Native planar joint actuation in physics.
- Test coverage (Vitest unit tests, Playwright end-to-end) and CI/CD via GitHub Actions.

## Developer Guide (permanent reference)

### Repository structure

```
/
|-- artifacts/
|   |-- kineticad/                 # Main CAD application
|   |   |-- src/
|   |   |   |-- cad/               # OCCT worker, topology, geometry operations
|   |   |   |-- three/             # Three.js scene, layers, MatePickerCoordinator
|   |   |   |-- physics/           # Rapier worker, joint construction, runner
|   |   |   |-- features/          # Feature regen, caching, kernel error mapping
|   |   |   |-- state/             # Zustand store
|   |   |   |-- components/        # React UI, inspectors
|   |   |   |-- views/             # Modeller, Simulator
|   |   |   `-- sketch/            # Sketch plane definitions
|   |   |-- public/
|   |   |   |-- seed-registry.js   # Defines window.loadSeed(id)
|   |   |   |-- seeds/
|   |   |   |   |-- windmill.js    # Canonical windmill seed
|   |   |   |   `-- orrery.js      # Orrery seed (generated)
|   |   |   |-- seed-windmill.js   # Backward-compat shim, three lines
|   |   |   `-- ...
|   |   |-- docs/
|   |   |   `-- orrery-build-spec.md
|   |   |-- serve.mjs              # Production Node server with cache headers
|   |   `-- package.json
|   `-- landing/                   # Landing page Vite app, serves at /
|       |-- src/                   # React app: home, /story, /terms, /privacy
|       `-- public/
|           |-- sitemap.xml
|           |-- robots.txt
|           `-- opengraph.jpg      # OG image; index.html has OG, Twitter Card, JSON-LD
|-- scripts/                       # Build and dev scripts, including the orrery seed generator
|-- README.md
|-- HANDOVER.md                    # This file
|-- replit.md                      # Phase-by-phase build log, authoritative
`-- LICENSE
```

The pnpm monorepo at the root contains multiple artifacts. The main CAD app lives at `artifacts/kineticad/`. The README, this handover and `replit.md` all sit at the repository root.

### Architecture: three threads

KinetiCAD runs three threads.

The main thread handles React rendering, Three.js scene management, user input and orchestration. It should never block.

The CAD Worker runs OpenCascade.js, compiled to WebAssembly. All B-rep operations (sketch curve evaluation, extrusion, revolve, boolean operations, edge and face classification, tessellation) happen here. It communicates with the main thread via Comlink and returns triangulated geometry plus topology metadata: edge IDs, types, polylines, circle centres, normals.

The Physics Worker runs Rapier3D, compiled to WebAssembly. It receives body definitions and joint configurations, steps the simulation at a fixed 60 Hz, and posts body transforms back each frame.

The two-worker split keeps both heavy computations off the main thread, so the UI stays responsive during a complex extrude or an active simulation.

### Data flow for a typical mate creation

1. The user clicks an edge in the Three.js viewport.
2. The main thread raycasts against the rendered geometry.
3. Edge metadata is looked up from the topology cache returned by the CAD worker.
4. `MatePickerCoordinator` validates the pick: axis alignment, edge type.
5. The pivot point is computed and converted into each part's local frame.
6. The pivot is stored on the mate via Zustand.
7. When the user presses Play, the mate is sent to the physics worker.
8. Rapier creates the joint with the supplied local-frame anchors.
9. The simulation steps and posts body transforms back.

### The pivot frame bug, explained

This was the most subtle bug hit during the build. It is worth understanding because it cuts to the core of how the mate system works.

Symptom: the rotor spun in place when stationary but jumped off-axis when physics started, then orbited around an offset point instead of rotating cleanly.

Diagnosis: mate pivots were being stored as world-space coordinates and passed to Rapier, which expects a part-local frame.

Rapier's revolute joint constraint is:

```
anchorA = bodyA.position + bodyA.rotation x pivotA_local
anchorB = bodyB.position + bodyB.rotation x pivotB_local
constraint: anchorA == anchorB at all times
```

When `pivotB_local` was a world-space point, for example [0, 0, 100] because the disc was at world z=100, and the body was also at world z=100, Rapier evaluated:

```
anchorB = [0, 0, 100] + identity x [0, 0, 100] = [0, 0, 200]
```

That does not match `anchorA` at [0, 0, 100], so Rapier yanked the body to satisfy the constraint, producing the visible jump and orbit.

Fix: after computing the pivot centre in world space, convert it to the part-local frame using `worldToLocalPoint(centre, part.transform)` before storing it. Anchors then coincide at simulation start, so there is no jump, and the local-frame Z component is invariant under Z-axis rotation, so there is no orbital drift.

### The arc versus circle issue

The `polylineCenter()` helper averages all polyline sample coordinates. For a uniformly sampled full circle this returns the exact centre. For an arc segment it returns the centroid of the arc, which is offset from the underlying circle's centre.

For a 90 degree arc of radius R, the centroid sits at roughly 0.9R from the circle centre along the arc bisector. For a windmill disc with R=12 and four 90 degree arcs, that is an offset of around 10.8 mm rather than zero.

This matters because a boolean union of intersecting solids splits shared edges. When four blades fuse into a disc rim, the rim circle is cut into four arc segments, and there is no full circle on the merged part to use as a pivot reference. The workaround used in the windmill seed is to add a separate cylindrical hub feature whose bottom edge is a clean full circle, not split by the blade intersections, and mate to that.

The proper fix has two parts. `topology.ts` can expose the true underlying circle centre of an arc-typed edge. That side is now done: the classifier computes `circleCenter` for every circle and arc edge, and a fix has been applied so the value is actually written into the emitted edge metadata, where previously it was computed but dropped. The remaining part is verifying the full pick path through `MatePickerCoordinator`: that a user clicking a partial-arc edge gets the correct circle centre as the pivot. That has not yet been verified end-to-end. See "Outstanding and parked work" above.

### OCCT aliasing, the recurring bug pattern

OpenCascade.js WebAssembly wrappers alias internal topology by reference. When a builder or reader object is deleted with `.delete()`, any `TopoDS_Shape` obtained from it, via `.Shape()`, `.OneShape()` and similar, becomes invalid. This shows up as empty meshes or silent geometry failures, not crashes.

The fix, applied consistently across the codebase: call `BRepBuilderAPI_Copy_2(shape, true, false)` to deep-copy the shape while the source object is still alive, then delete the source. The copy owns its topology independently.

Sites where this matters:

- `cad/operations/extrude.ts`: copy the prism shape before the builder is released.
- `cadWorker.ts` STEP import: copy the `OneShape()` result before the reader is released.
- `cadWorker.ts` STEP import: copy each grounded shape before its transformer is released.

If geometry comes back empty after an operation involving a builder, this is the first thing to check.

### OCCT API quirks, this build's bindings

- Constructors use numeric suffixes: `BRepPrimAPI_MakeBox_4`, `TopExp_Explorer_2`, `gp_Pnt_3`.
- OCCT enums are returned as embind value objects, not integers. Compare via a defensive helper that reads `.value`, not by strict equality against an integer constant. An early version of the topology classifier compared an embind enum object against a raw integer, which was always false, so every edge and face fell through to the "other" type. This silently broke the mate pick filters until it was traced and fixed.
- `Closed` on `TopoDS_Shape` is exposed as a numbered overload pair: `Closed_1()` is the getter, `Closed_2(value)` the setter. The unsuffixed `Closed()` does not exist in this binding.
- Poly_Triangulation nodes and triangles are 1-indexed.
- Always `.delete()` transient OCCT wrappers to free WebAssembly heap.

### Production deployment

The Replit deployment uses a custom Node server, `serve.mjs`, rather than a plain static serve, so it can set explicit cache headers. This was necessary because the CDN was caching `index.html` aggressively, which broke deploys: users loaded a stale `index.html` referencing dead asset hashes.

The server sets `Cache-Control: no-cache, must-revalidate` on `index.html`, `Cache-Control: public, max-age=31536000, immutable` on hashed assets under `/assets/`, and `no-cache` on the seed registry. This is the standard single-page-app caching pattern. New bundle hashes are picked up immediately.

The OpenCascade.js WebAssembly binary is loaded from a pinned jsDelivr CDN URL, not bundled. Replit's static-deploy pipeline returns an empty body for files past a size cap, and the 50 MB WebAssembly file tripped it, so production deploys crashed with an empty-buffer instantiate error. Pointing `locateFile` at the pinned `cdn.jsdelivr.net` URL for `opencascade.js@2.0.0-beta.94e2944` fixed it; the version literal is held in an `OCCT_VERSION` constant and must stay in lock-step with `package.json`.

### WebGPU testing note

The Replit preview iframe does not support WebGPU and will show the "WebGPU required" message. Real testing must be done on the deployed `.replit.app` URL in Chrome on an M-series Mac.

### Diagnostics note

The `[SELF-TEST]` kernel check logs its success line on the console error channel deliberately, so it survives Chrome's default "Errors only" DevTools filter. These lines are passing tests, not faults. Worker-side `console.error` is also bridged to the main-thread console with a `[worker]` prefix, because Chrome's filter otherwise hides worker errors.

## Verified physics

The pivot frame fix was verified on the seeded windmill demo.

```
Target:   30 RPM = pi rad/s = 3.141592653589793
Measured at runtime, sample range:
  bodyBangvelMag:  3.14159270 to 3.14159298
  bodyBangvel.x:   approximately 3e-16   (precision floor)
  bodyBangvel.y:   approximately 4e-10   (precision floor)
  bodyBangvel.z:   3.14159
Error from pi:     approximately 3e-7 rad/s
Stability:         plus or minus 5e-7 rad/s
Drift:             none
```

Off-axis components sit at floating-point single-precision noise. The rotation is pure Z-axis. The result is as clean as a real-time physics engine can produce.

To reproduce: open the live demo, paste `window.loadSeed('windmill')` into the browser console, switch to the Simulator, press Play, and watch the `[step-diag]` console output for live bodyBangvel values.

The orrery seed extends the same physics and mate system to 13 bodies and 12 motorised revolute joints in nested chains, and runs as a continuous mechanism. Load it with `window.loadSeed('orrery')`.

## Local development

```
git clone https://github.com/AndrewBlumson/KinetiCAD.git
cd KinetiCAD
pnpm install
cd artifacts/kineticad
pnpm dev
```

The dev server runs at http://localhost:5173. Build for production with `pnpm build`; artifacts go to `artifacts/kineticad/dist/`.

## Questions answered

These came up in public discussion of the open-source release.

Is the geometry manifold? Yes. OpenCascade.js produces manifold B-rep solids through the standard sketch, extrude and boolean pipeline.

Is it 3D printable? Yes. Binary STL export is implemented and the windmill STL slices to a complete print plan in Bambu Studio. STEP export enables round-tripping with Fusion 360, SolidWorks and other packages.

Are you using B-rep underneath? Yes. OpenCascade.js running in a Web Worker via Comlink. All boolean operations, edge classification and topology metadata come from OCCT.

Does it do physics? Yes. Rapier3D in a separate Web Worker, driven by the mate joints, with motorised revolute and prismatic joints.

What about WebGL2 for broader browser support? Currently WebGPU only. A WebGL2 fallback is possible through the Three.js renderer abstraction but is not implemented.

## Acronym index

AP: Application Protocol (STEP variant identifier, for example AP242)
API: Application Programming Interface
B-rep: Boundary Representation
CAD: Computer-Aided Design
CDN: Content Delivery Network
CI/CD: Continuous Integration and Continuous Deployment
DD/MM/YYYY: UK date format
GBP: Great British Pound
IGES: Initial Graphics Exchange Specification
JSON: JavaScript Object Notation
MIT: Massachusetts Institute of Technology
mm: millimetre
OCCT: Open CASCADE Technology
pnpm: performant npm
RPM: Revolutions Per Minute
STEP: Standard for the Exchange of Product Model Data
STL: Stereolithography
UI: User Interface
URL: Uniform Resource Locator
UV: surface parameter coordinates (U, V)
WebGL: Web Graphics Library
WebGPU: browser graphics and compute API
XCAF: Extended Common Application Framework (OCCT document model)
