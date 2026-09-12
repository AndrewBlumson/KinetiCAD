# KinetiCAD Replit workspace

Security maintenance: **402/402 tests across 57 files passed in 80.936 seconds on Node 24.19.0 ARM64**, with unchanged test inputs and historical reports restored. Workspace typecheck/build, the root-route landing build, a clean-copy frozen install/typecheck and **35/35 HTTP checks** passed. The patched dependency audit reports **zero advisories, none muted**. Scoped production Chrome checks passed for imported-project editing, Undo/Redo, native file reopening, recovery and public-page/support navigation. Earlier feature records retain their separate scope. Pull verified GitHub `main` into the existing Replit project; Replit checkpoint publication and public-route acceptance remain separate steps. See [maintenance evidence](docs/SECURITY-MAINTENANCE-2026-09-12.md).

## Overview

KinetiCAD was originally built on Replit with Replit Agent by Andrew Blumson,
co-built with Kevin Blumson, during the Replit 10 Buildathon in May 2026.
It remains a Replit-built application. Later development, numerical checks and
actual Chrome computer-use checks were performed by Codex under Andrew’s direction.
Keep that later credit distinct from the original build attribution.

This is a pnpm/TypeScript monorepo. Each package manages its own dependencies.
The CAD application is browser-local; API/database scaffold packages do not imply
that a paid AI API or server is required for its geometry/physics calculations.

The earlier 382-test feature results are in the [history/selection test catalog](docs/HISTORY-SELECTION-TEST-CATALOG.md)
and [history/selection guide](docs/HISTORY-AND-SELECTION.md). Undo/Redo passed
its 369-test checkpoint before object selection; older 298/348/351-test records
retain their original source identities. The current source includes both
features and the publication cleanups described in the [release checklist](docs/PUBLIC-RELEASE-CHECKLIST.md).
[Current status](docs/CURRENT-STATUS.md) and [HANDOVER.md](HANDOVER.md)
are the resumption entry points. The Boolean fixed-joint project has now passed
actual native Load, run controls and refresh: [browser record](docs/evidence/boolean-reopen/browser.json).
New-stage user review and Replit/public-route acceptance remain separate gates.
The [revolute picking follow-up](docs/REVOLUTE-PICKING-VERIFICATION.md) records
actual Chrome correction of the translated arc's **54.08 mm** pivot error to
**less than 1.31e-8 mm**, including a **37° Z-rotated** case. The translated
saved file passed native Load and Play/Pause/Resume/Reset; the rotated file
passed Load and full refresh, then Save produced an assembly exactly equal to
the original corrected download, including transforms and pivots. Existing
incorrectly saved joints need to be picked again; there is no automatic migration.
Historical phase logs below are not current backlog or automatic evidence for
later revisions. Use the reviewed patched lockfile. The current [security maintenance](docs/SECURITY-MAINTENANCE-2026-09-12.md) updates Orval/build tools and targeted transitives, retaining Three.js/OCCT/Rapier. No paid AI service is required.

Pull the verified GitHub `main` into the existing Replit project, test it there, create Replit's own checkpoint/commit, then publish that checkpoint. Replit may assign a different SHA; compare the source content and record both identities. A GitHub source push is not a website deployment.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `PORT=5184 BASE_PATH=/app pnpm run build` — typecheck + build all packages for a local CAD check; retain the existing Replit deployment configuration for publication
- `PORT=5184 BASE_PATH=/app pnpm --filter @workspace/kineticad dev` — start the CAD development server at `/app/`
- `pnpm --filter @workspace/kineticad test:all` — run all automated tests sequentially
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See `pnpm-workspace.yaml`, the package manifests and [Replit handoff](docs/REPLIT-HANDOFF.md) for workspace and publishing details.

---

## KinetiCAD (`artifacts/kineticad`)

Browser-based parametric CAD with B-rep modelling and joint-driven rigid-body
simulation. The original 12-phase build history is retained below; the current
gallery, complete projects and engineering tests are documented in the
current-source section.

**Stack**: Vite + React 19 + TypeScript, Tailwind, Zustand store, Three.js r184 (WebGPURenderer), OpenCascade.js (Web Worker via Comlink).

**Original phase status (May 2026)**:

- Phase 0 ✅ — App shell, dark navy theme (`#0A0E1A` bg, `#FF6B1A` orange), routes (`/` Modeller, `/simulator` Simulator), Zustand store + Zod schemas, sidebar/toolbar/inspector layout.
- Phase 1 ✅ — WebGPU scene, grid/axes/orbit camera, OpenCascade.js worker, graceful "WebGPU required" fallback.
- Phase 2 Split A ✅ — Sketch entry: PlanePicker (XY/XZ/YZ), 600ms easeInOutCubic camera tween, sketch overlay, `sketchSession` state machine, persist middleware.
- Phase 2 Split B ✅ — Drawing tools (line/rect/arc/circle), snap engine, Line2 rendering; in-flight primitive is LOCAL to `SketchSession` (not Zustand) so 60Hz mousemoves don't trigger React renders.
- Phase 3 Split A ✅ — Extrude/Revolve kernel plumbing: `featureCache`, `featureRegen`, FNV-1a cascade-invalidation hash, OCCT worker methods.
- Phase 3 Split B ✅ — Scene integration: `PartMeshLayer`, `PreviewMeshLayer`, 200ms-debounced live-preview pipeline, `NumericInput`, feature inspectors.
- Phase 4 Split A ✅ — Topology picking: stable edge/face IDs via FNV-1a canonical geometry hashing, `withWrapper` OCCT hygiene, `TopologyPicker` screen-space picking.
- Phase 4 Split B ✅ — Modifier features: Fillet (`BRepFilletAPI`), Chamfer, Hole (`BRepAlgoAPI_Cut` along inward face normal).
- Phase 5 ✅ — Boolean operations (Union/Subtract/Intersect): `BRepAlgoAPI_Fuse/Cut/Common`, `BooleanResultLayer`, cascade delete, `BooleanEditor`.
- Phase 6 ✅ — Multi-part: `TransformGizmo` (R/T keys), per-part visibility/position/rotation, `PartsPanelItem` + context menu, duplicate/rename, transform-aware booleans.
- Phase 7 ✅ — Mate joints (Revolute/Prismatic/Spherical/Fixed/Planar): `MatePickerCoordinator`, `MateVisualizer`, motor params stored (not yet actuated). Ground-part persistence fixed: `groundPartId` promotes to `parts[0].id` on `createPart` if previously empty.
- Phase 8 ✅ — Rapier3D rigid-body physics: `physicsWorker`, `SimulationLayer`, Play/Pause/Reset, speed multiplier (0.25×–2×), mass props via `BRepGProp.VolumeProperties_1`.
- Phase 9 / 9.5 ✅ — Motor actuation wired to Rapier joint API; mate inspector end-to-end: pick-filter slice, OCCT classifier fixed (embind enum coercion), motor model tuned, WASM CDN deploy fix, diagnostic console bridge.
- Phase 10 ✅ — Material Library: eight engineering materials, per-part picker, density-driven mass props, volume cache, v8→v9 migrate. (Full notes in the Phase 10 section below.)
- Phases 11–12 ⏳ — Pending.

**Historical Phase 12 notes, reconciled 12 September 2026:**
- Boolean result topology is now available for supported joint creation. General
  whole-solid canvas selection now outlines the result and shows its source/material summary; choose Edit Boolean operation to edit. A derived result has no independent transform.
- Inline Boolean input/tool/result thumbnails remain deferred.
- Do not revive the old mobile/WebGL roadmap: CAD is intentionally desktop WebGPU.
  See [the issue register](docs/KNOWN-ISSUES-AND-FOLLOW-UP.md) for all dispositions.

---

## Constraints & Gotchas

### OpenCascade.js

**OCCT API quirks in this binding** (`opencascade.js@2.0.0-beta.94e2944`):
- Constructors use numeric suffixes: `BRepPrimAPI_MakeBox_4`, `TopExp_Explorer_2`, `gp_Pnt_3`, `TopLoc_Location_1`, `gp_Vec3f_1`.
- **Overloaded methods also use numeric suffixes**: `wire.Closed_1()` (getter), `wire.Closed_2(value)` (setter). Unsuffixed `wire.Closed()` does NOT exist and fails silently — root cause of the T3 extrude regression (every extrude failed from Phase 3 until the diagnostic pass). When a method seems to do nothing, check for a numbered variant.
- `gp_Vec3f` getters are `x_1()`, `y_1()`, `z_1()` (not properties).
- `TopAbs_Orientation` enum values are singleton objects → compare with `===`.
- `Poly_Triangulation` nodes/triangles are 1-indexed.
- Always `.delete()` transient OCCT wrappers (face, location, triangulationHandle, gp_Vec3f, gp_Pnt corners, builders) to free WASM heap.

**Embind enum coercion** — `BRepAdaptor_Curve.GetType()` and `GetSurface()` return `{ value: N }` objects, **not** integers. The `===` comparison against integer constants is always false, routing every edge/face to the `"other"` fallback. Fix: use an `enumVal()` helper that handles raw integers, embind objects with `.value`, and `valueOf()`-coercible objects. Applied at every `GetType()`/`GetSurface()` call site in `topology.ts`. (QA impact: broke all Revolute/Prismatic/Planar mate filters silently; discovered via a `typeHistogram` diagnostic showing `{ other: 12 }` for a two-cylinder scene.)

**`BRepBuilderAPI_Copy_2` deep-copy pattern** — `TopoDS_Shape` wrappers alias internal sub-shapes. Any shape obtained from a builder (prism, reader, transform) must be deep-copied via `BRepBuilderAPI_Copy_2(shape, true, false)` **before** the builder or reader is `.delete()`-d in `finally`. Failing to do so produces empty meshes silently (extrude regression, STEP import regression). Applied in: `extrude.ts`, `cadWorker.importStep`.

**WASM CDN** — `opencascade.full.wasm` (50 MB) exceeds Replit's static-deploy size cap; the deploy pipeline returns HTTP 200 with an empty body, and `WebAssembly.instantiate()` throws `BufferSource argument is empty`. Fix: drop the `?url` asset import and use `locateFile` pointing to the pinned jsDelivr URL:
```
https://cdn.jsdelivr.net/npm/opencascade.js@2.0.0-beta.94e2944/dist/opencascade.full.wasm
```
The version string is factored into `OCCT_VERSION` in `cadWorker.ts` and must stay in lock-step with `opencascade.js` in `package.json`. No `.wasm` file is emitted under `dist/`.

**Vite config for OCCT** — the package's `index.js` wrapper uses a bare `.wasm` import that Vite cannot pre-bundle. Required config in `vite.config.ts`:
```ts
optimizeDeps: { exclude: ["opencascade.js"] }
worker: { format: "es" }
```

**XCAF naming** — STEP part-name extraction via `STEPCAFControl_Reader_1` + `TDataStd_Name` is structurally impossible in this binding. Eight candidate paths all failed (missing `DownCast`, missing statics, typed handle rejected by embind). `extractLabelName` is stubbed to `return ''`; file-stem fallback is the documented behaviour. `STEP_NAME_DEBUG` permanently `false`.

**Self-test on boot** — `cadWorker.ts` runs `runSelfTest` on kernel init: builds a 20×20mm sketch, extrudes 10mm, checks tri count + bbox. Logs `[SELF-TEST] OK` on success or `console.error([SELF-TEST] FAILED: …)` on failure. Chrome's DevTools "Errors only" filter hides worker `console.error` by default — errors surface on the page console via the worker→main console bridge in `cadClient.ts` (message listener before Comlink.wrap intercepts `{ __log: true }` envelopes).

---

### Rapier3D physics (mm + s + kg world)

**Unit convention**: all values in the physics layer are mm, s, kg. Gravity: `[0, 0, -9810]` mm/s² (Z-up). A 20×20×10mm aluminium cube → 4000 mm³, 0.0108 kg. Rapier is unit-agnostic; mass properties and gravity must agree.

**Applied force**: `BuildWorldArgs.appliedForces` carries one constant
world-space force vector in newtons per dynamic target. The worker multiplies
by 1,000 and adds it once at the centre of mass; re-adding a persistent force
each step would accidentally create a force ramp. Duplicate, missing, fixed
or invalid force targets fail the build. This is separate from velocity-motor
force/torque limits, which remain unsupported.

**Default assembly motor settings** (in `physicsWorker.ts`; verified workspaces can override them):
- `setCanSleep(false)` on every dynamic body — a sleeping body ignores motor impulses and appears frozen.
- `MotorModel.AccelerationBased` — velocity servo with finite gain and solver tracking error. Acceptance depends on the measured residuals and thresholds in `docs/demo-physics-results.json`; the configured target is not evidence of exact tracking.
- `MOTOR_VELOCITY_GAIN = 10000` — mm-unit inertias (50–500 kg·mm²) are 3–6 orders of magnitude larger than SI tutorial values; the effective gain must scale accordingly. Progression history: 1.0 → 100 → 10000. Comment in `physicsWorker.ts` records this so future readers don't repeat the SI assumption.
- `body.wakeUp()` must be called on both attached bodies after `updateJointMotor`, or a sleeping idle mechanism ignores the new motor settings.
- RPM → rad/s: `rpm × 2π / 60`.
- Default solver: 32 iterations at the configured fixed timestep. The actual
  CAD orrery/mobile regression failed lower iteration counts; retain the
  measured limits in `docs/demo-physics-results.json` when changing this.
- Zero or blank commands release the motor, preserving its joint and current
  body velocities. Rapier 0.12 keeps braking when a configured drive is merely
  given zero gain, so release recreates only the unpowered impulse joint from
  its validated local frames. Tests cover coasting, gravity and reactivation.

The adjustable crank-slider uses its separately validated 120 Hz configuration:
8 outer iterations, 16 internal PGS iterations and motor gain 100000. Its settings
are not ordinary-world defaults; rebuilding an ordinary world restores defaults.
See [the crank-slider limits](docs/CRANK-SLIDER-VERIFICATION.md).

**Fixed joint frame math** — `JointData.fixed` with identity anchors on both sides yanks body B's origin onto body A's under solver forces. Correct: at creation time sample `bodyA/bodyB.translation()/rotation()`, compute `frame2` in B's local frame as `T_B^{-1} · T_A` (translation = `q_B^{-1} ⊗ Δp ⊗ q_B`, orientation = `q_B^{-1} ⊗ q_A`). Frame1 stays identity in A. Helpers `quatMul` + `quatRotateVec` live in `physicsWorker.ts`.

**Inertia — current implementation**: `GProp_GProps.MatrixOfInertia()` provides
the full centroidal tensor without the unusable output-reference arguments of
`GProp_PrincipalProps.Moments()`. `cad/operations/massProperties.ts` diagonalizes
the tensor, verifies the reconstruction and returns principal moments plus a
part-local principal-frame quaternion. Rapier receives both the moments and
frame, with material density applied in kg/mm³. Invalid mass properties fail
explicitly. The previous equivalent-volume-sphere approximation is historical
and must not be restored as a fallback.

**HMR singleton** — `cadClient.ts` and `physicsClient.ts` must hoist their kernel singletons to `globalThis.__kineticadKernel__` / `__kineticadPhysics__`. Module-level `let` bindings are reset on every Vite HMR module replacement, re-spawning the WASM worker on every file save. The `globalThis` slot survives module replacement in dev and is set exactly once in production.

---

### React / Zustand patterns

**Equality guards on editor state actions** — `setMateEditorError`, `setMateEditorParams`, `setMateEditorStage` (and equivalents for `featureEditor`/`booleanEditor`) must return the existing state object unchanged when the new value equals the current one. Without this, each call produces a fresh object reference, re-triggers every `useEffect` that lists the editor in its deps, re-fires the same setter, and page-crashes with "Maximum update depth exceeded". Pattern: `if (current === next) return {}` at the top of the action.

---

### WebGPU / Three.js

**WebGPU testing** — the Replit preview iframe may show the "WebGPU required"
message. Use a top-level Chrome tab with a real WebGPU adapter, on an M-series
Mac or equivalent supported desktop, against the local application or intended
deployment. Test the real rendered CAD route as well as numerical worker code.

**Windmill canary** — after any physics change, open Windmill through the Demos
gallery in the actual browser route, press Play, wait at least five seconds,
and confirm `bodyBangvelMag = π ±5e-7` rad/s from worker diagnostics. Retain the
original strict **5e-7 rad/s** threshold; do not widen it to accept a failing
change. Use the legacy console seed only in a disposable workspace because it
overwrites localStorage. Historical passing readings below do not certify a
new build; record fresh evidence in `docs/PHYSICS-VERIFICATION.md`.

**NodeMaterial rule** — every Three.js material in the WebGPU renderer must use the `three/webgpu` NodeMaterial variants (`MeshBasicNodeMaterial`, `MeshStandardNodeMaterial`, `Line2NodeMaterial`, `LineBasicNodeMaterial`). Classic `THREE.MeshBasicMaterial` etc. produce "Material X is not compatible with WebGPURenderer" warnings and may render invisible. Always force `blending: NormalBlending` on NodeMaterials that need transparency (they default to `NoBlending`).

---

### Seed registry

This is the legacy development loader. The current in-app gallery below uses
validated JSON documents and an isolated temporary workspace instead.

`window.loadSeed(id)` IIFE is **inlined directly into `index.html`** as a `<script data-base="%BASE_URL%">` block. `public/seed-registry.js` is a readable reference copy only — not loaded.

Loads `public/seeds/<id>.js` dynamically; each seed IIFE writes the persist JSON to `localStorage["kineticad-state"]` and calls `location.reload()`.

**To add a seed**: create `public/seeds/<id>.js` IIFE, set `version: N` to match the current store persist version (currently **9**), add one entry to the `SEEDS` array **in the inlined block inside `index.html`** (not in `public/seed-registry.js`).

**Seed URL join rule** — `%BASE_URL%` in a `data-*` attribute is substituted by Vite without a trailing slash (`"/app"`, not `"/app/"`). Always strip any trailing slash from `rawBase` then join with an explicit leading slash: `base + '/seeds/' + id + '.js'`. The bare concatenation `base + 'seeds/…'` produces `/appseeds/…` (confirmed from production request log).

Available seeds: `window.loadSeed('windmill')` | `window.loadSeed('orrery')`

Orrery generator: `pnpm --filter @workspace/scripts run generate-orrery-seed` → writes `public/seeds/orrery.js`. Must set `PERSIST_VERSION = 9` and `materialId: "aluminium-6061"` (not `"default"`).

---

## Current source — September 2026 additions

The source now delivers durable native/imported project recovery, bounded
six-axis Stewart control, separate finite-force motor/load and contact/friction
benches, an analytical elastic-beam tool, an adjustable crank-slider, persistent
sketch dimensions and direct connected-Boolean simulation. The current stage
also adds the local **Draw a path** four-bar designer described below. Its local
automated and scoped Chrome checks are complete; these physical models and
limits remain distinct. [Scoped production Chrome checks](docs/evidence/security-maintenance/browser.json) also passed imported-project material Undo/Redo, saved-status recovery after refresh, native downloaded-file reopening, public-page navigation and the external support link preserving the current model.

The earlier 382-test run is catalogued in [HISTORY-SELECTION-TEST-CATALOG.md](docs/HISTORY-SELECTION-TEST-CATALOG.md); the latest [402-test summary](docs/evidence/security-maintenance/release/summary.json) records the patched Node 24 ARM64 run.
Earlier four-bar and hinge captures preserve their 348/351-test scope. Complete
per-test results, original reports, source hashes and actual browser downloads
are retained alongside the [history/selection record](docs/HISTORY-AND-SELECTION.md).
[MATHEMATICS-AND-PHYSICS.md](docs/MATHEMATICS-AND-PHYSICS.md) records equations,
units, independent references, tolerances and observed errors. Preserve the
original Windmill **π ±5e-7 rad/s after five simulated seconds** gate.

See the current catalog and build logs for the final workspace build and
typecheck status; each older stage retains its own acceptance scope. Recorded Chrome
computer-use checks by Codex are linked by stage in [the docs index](docs/README.md).
Their source/bundle scope matters. Actual Boolean downloads and refresh/new-tab
recovery passed. The subsequent [fixed-joint file-dialog check](docs/evidence/boolean-reopen/browser.json)
also passed Load, Play/Pause/Reset and browser refresh with the saved material,
ground and joint. It does not establish native file-dialog reopening of every
joint fixture. The four-bar [browser record](docs/evidence/four-bar/browser.json)
covers 60 mm preset search/build, native Save/Load/refresh, saved-target
preservation, Pause/Resume/Reset and reference invalidation after manual material
editing. Closed freehand pointer input was exercised by seven controlled
component-handler tests; no successful curved gesture is claimed in Chrome.
Local checks do not establish Replit publication acceptance. The 79-, 166-, 195-,
237- and 298-test captures retain their original source scope.

### Local four-bar path designer

**Draw a path** opens a desktop dialog with three known-mechanism references,
an approximate ellipse target, freehand input and a keyboard point list. The
default known loop is 60 mm wide. Width edits from 40 to 160 mm preserve aspect
ratio; even a known target at another size may lack an exact admissible mechanism.
Targets must be simple closed loops. A visibly open stroke requires explicit
**Close loop**; crossed/retraced loops and unapplied point edits cannot be built.

`mechanisms/fourBarSynthesis.ts` and `fourBarSearchWorker.ts` perform a seeded,
bounded search locally. Progress is provisional; Cancel terminates the worker.
The final **Typical path gap (RMS)** and **Worst sampled path gap** compare equal
arc-length progress around complete loops, allowing a different start and
direction. They are sampled shape errors, not speed matching, arbitrary machine
design or a proof of global optimality.

**Build editable model** preflights four native feature chains and mass data
before entering the protected generated workspace. Only this explicit action
changes the displayed project. Late search/build responses must not replace a
changed source project. Save retains the target, dimensions, search seed and
history; reopening an existing design preserves exact target placement and seed.
**Return to my model** restores the original project and imported shape handles.

The generated mechanism has four parts and four revolute joints. Its ideal
input crank makes one turn at 10 RPM in six simulated seconds, with zero gravity
and 120 Hz fixed stepping. The measured material-point trace derives from the
actual coupler pose; `three/FourBarTraceLabel.ts` projects the displayed mesh's
point and refreshes camera matrices before projection. It does not drive motion.
Physical edits invalidate generated reference claims. This adds no contact,
bearing friction or finite motor/load rating. See
[FOUR-BAR-PATH-VERIFICATION.md](docs/FOUR-BAR-PATH-VERIFICATION.md) for the supported
domain, equations and separately scoped search/CAD/solver evidence. The final
[stage catalog](docs/FOUR-BAR-TEST-CATALOG.md) and
[aggregate acceptance](docs/four-bar-validation.json) record the completed local run.

### Numeric editing and current usability

In Modeller, select a part for Position/Rotation controls. Select its sketch,
choose **Edit dimensions**, and Apply numeric mm/degree changes to circles,
rectangles, lines or arcs. The full feature chain is rebuilt and validated before
commit; rejected geometry or invalidated attachment checks retain the saved model.
This is numeric editing, not an automatic sketch constraint solver.

The separate **Crank-slider** workspace exposes bounded crank radius, rod length
and RPM, plus measured/reference plots and complete Save/Load settings. Six demo
cards remain in the gallery. The visual grid is 600 × 600 mm with 10 mm spacing;
it is neither a floor collider nor a limitation on model coordinates.

All file controls have labels and tooltips. The landing page includes Andrew’s
sites, X/LinkedIn and Replit UK Ambassador biography. Phone/tablet CAD startup is
blocked; public information pages remain readable. **Support KinetiCAD** links to [Buy Me a Coffee](https://buymeacoffee.com/andrewblumson), with Adevious Ltd as the recipient. The optional external link adds no payment widget, payment code or feature gate; the app remains free and MIT-licensed.

### Connected Boolean rigid bodies

`features/booleanBodies.ts` shares worker-scoped preparation of the final mesh
and unit-density OCCT mass properties. `physics/assemblySimulation.ts` excludes
consumed input bodies, resolves a homogeneous result material and validates
explicit ground/joint references. Empty/disconnected results, reused inputs and
ambiguous material/ground choices are rejected. Subtraction may inherit the
retained body material; mixed unions/intersections require an explicit result
material. Results are world-baked with identity rigid-body transform.

The result ID is `boolean:<feature ID>`. `BooleanResultLayer` exposes connected
result topology during supported mate creation. Store exact geometry revisions
at attachment-pick time; old joint name/RPM edits cannot renew stale picks.
Save/Load and IndexedDB recovery retain the material, result ground and joint
revisions. Creating/importing parts or migrating a free Boolean assembly must
not silently give it a fixed base. See [Boolean verification](docs/BOOLEAN-SIMULATION-VERIFICATION.md).

### Editable demo workspaces

`components/demos/DemoGallery.tsx` presents six authored SVG illustrations
inside an accessible, scrollable Radix dialog. These are illustrations, not
captured CAD screenshots. Opening focuses the title without scrolling and
starts the grid at the top. `DemoWorkspace.tsx` supplies the toolbar entry,
empty-workspace chooser, loading/errors, reset and return controls.

`scripts/src/generate-demo-library.mjs` owns definitions and regenerates
`public/demos/*.json` plus `src/demos/catalog.ts`:

| ID | Current title | Parts / joints | Scope |
|---|---|---|---|
| `windmill` | Windmill | 2 / 1 | Original 30 RPM canary |
| `orrery` | Solar-system orrery | 13 / 12 | Original nested orbital-arm mechanism; illustrative speeds |
| `gyroscope` | Three-axis driven gimbal | 4 / 3 | Powered intersecting axes, bored housings, shafts and steel flywheel |
| `kinetic-mobile` | Kinetic mobile | 8 / 7 | Crown, two branches and four separately driven medallions |
| `material-studio` | Material force lab | 9 / 8 | Equal force on eight identical samples with different masses, on unpowered straight guides |
| `stewart-platform` | Stewart platform | 14 / 18 | Bounded six-axis deck translation/rotation through six telescopic drives and a closed joint network |

The gimbal/mobile use zero gravity and independently commanded motors. Do not
describe the gimbal as verified passive-gyroscope dynamics or its shaft geometry
as a simulated bearing contact. Material force lab replaces the earlier static
fixed-mount example. The Stewart source is defined in
`scripts/src/stewart-platform-demo.mjs` and included by the common generator;
each leg contains a lower spherical joint, a motorised prismatic joint and an
upper spherical joint. `stewartKinematics.ts` and `stewartController.ts` now
command actuator lengths/velocities for X/Y/Z, roll/pitch/yaw, combined and Home
presets. The dynamic solver determines the deck pose; it is not assigned by
the controller. Targets are bounded to ±5 mm per translation component and
±2° per intrinsic XYZ rotation component. Default presets use a four-second
quintic move and two-second settling period; saved validated configurations
retain other bounded durations. Stroke −12/+20 mm, speed 8 mm/s, bearing deflection
8° and normalized Jacobian condition 100 are guarded. Rapier prismatic limits
also enforce the stroke interval, without a contact/impact model. Reference topology/frame
edits require new validation. Gravity and external loads are off, and the six
velocity drives have no finite-force rating. The original 2 mm/s six-second
symmetric lift remains a separate numerical regression.

`demos/demoDocument.ts` validates files and normalizes base-path asset URLs.
`demoSession.ts` retains the original state and temporarily isolates persistence
while a demo is open. Returning restores original object references, including
live STEP shape IDs, without reloading the workers. Save exports a complete
edited demo; reset reloads its bundled document. Demo edits never enter the
original project’s durable autosave. File operations and unfinished
feature/sketch/mate edits block workspace switching. On refresh, the original
complete project is restored, including embedded imported STEP assets.

`Modeller.tsx` keeps short labels visible for Import STEP, Export STEP, Export
STL, Save project and Load project. Radix tooltips explain each format and
operation. Disabled file actions retain keyboard focus and guard activation,
so the reason that Load project is unavailable inside a demo is discoverable.
The Save tooltip describes an editable complete project with embedded STEP
assets; STEP exports solid geometry and STL exports a tessellated mesh.

### Complete project recovery

`project/` defines project format 1 around state version 9. Save retains native
history, materials, transforms, assembly booleans, mates and simulation settings,
plus immutable imported STEP source bytes and stable body associations. Asset
checksums and reconstructed body count/bounds/mesh fingerprints are checked
before state is exposed. STEP features added in KinetiCAD regenerate after
restoration; another CAD application's original feature tree is not recovered.

IndexedDB stores current/previous complete snapshots in one transaction.
Autosave captures edits before asynchronous packaging, debounces and serializes
writes, and retains old copies on quota/transaction failures. Startup imports
assets before scene hydration; failed current data tries the previous copy,
then exposes retry/download/empty-workspace choices without discarding failed
copies. An abrupt close may lose an unfinished save. Portable downloads remain
necessary because browser storage belongs to its origin/device.

Native legacy v8/v9 documents remain supported. A legacy live imported handle
can be packaged, but a file containing only a dead handle never stored its
geometry and needs the original STEP. Future OCCT/tessellation changes can
require fingerprint migration. `docs/PROJECT-RECOVERY.md` defines these limits
and the actual fresh-worker round-trip tests, including downstream Hole edits.

### Engineering tests: scoped models

`components/engineering/EngineeringTests.tsx` opens three tabs from Simulator.
`engineeringBenchWorker.ts` hosts separate fixed-step Rapier worlds through
`actuatorBench.ts` and `contactBench.ts`; they do not alter the CAD assembly.
The plots and dimensioned diagrams use the returned solver measurements.
`step(0)` observes without advancing; pause/reset/completion have explicit clocks.

**Motor & load** has a passive vertical guide with capped equal/opposite forces
applied at a common world point. N→kg·mm/s² uses ×1,000. The motor can hold,
lift or fail to support a payload; a free-base test checks reaction momentum.
At 120 Hz, 2 kg with a 16 N limit falls 226.3684 mm in 0.5 s, against 226.25 mm
from F/m−g; the position error falls from 0.1184 to 0.0573 mm at 240 Hz.
The report's force-inference gate is 0.0004 N and overload-position gate 0.2 mm.
The travel guard ends the test before a boundary crossing; it is not an impact
or hard stop. This bench is not finite-force Stewart or a motor electrical model.

**Friction & contact** uses an exact 100×60×40 mm cuboid on a cuboid floor;
rotation and lateral Y movement are guided. Its single explicitly selected μ
and zero restitution are experiment parameters, not named material properties.
Actual manifold impulses give latest-fixed-step mean forces, independently
calibrated by momentum change. The sliding reference is disabled during the
free-fall/impact diagnostic and expected tangential force is zero at rest.
For 2 kg, 1000 mm/s and μ=0.25, stopping distance is 199.7884 mm at the UI's
120 Hz default and 201.8457 mm at 240 Hz, versus 203.8736 mm analytically.
The declared position bound v₀dt/2+0.5 mm is 4.6667/2.5833 mm respectively.
Supported penetration is below its 0.025 mm gate and force/momentum mismatch
below 0.0002 N in the recorded runs. See `docs/CONTACT-BENCH.md` for velocity,
energy, impact and scope limits. General CAD contact needs a hole-preserving
collision representation; a whole-part convex hull fills the Stewart bores.

**Elastic beam** is an independent uniform rectangular cantilever calculation,
with a stated clamp, transverse tip force, Young's modulus and elastic limit.
Use an eligible native rectangle/extrude part or explicit benchmark dimensions.
Imported or modified solids are not replaced with bounding-box beams. The
300×20×10 mm, 10 N, E=200 GPa reference yields 0.27 mm tip deflection and 9 MPa
stress. Checks require slenderness≥10, relative deflection≤2% and stress within
the supplied elastic limit. Failing checks marks results outside the accepted
model range. No CAD mesh deformation or general FEA is implemented; see
`docs/ELASTIC-BEAM.md` for equations, scaling and omitted effects.

### Six-axis numerical and geometric evidence

`docs/stewart-controller-results.json` passes 16 actual-CAD solver scenarios.
Final position/orientation errors are at most 0.000569 mm/0.000900° against
0.05 mm/0.05° gates; peak position error is 0.004891 mm against 0.1 mm.
Fifteen scenarios reconstruct every solver step; the render-partition scenario
checks returned batch endpoints and identical final transforms. The UI monitors
actual pose and actuator measurements; expected values remain separate.

`docs/STEWART-WORKSPACE-AUDIT.md` explains conservative numerical enclosures
of the full pose box and 72 home-to-target paths. Bounds include leg separation
≥8.6387 mm, neck/plate clearance≥1.9163 mm and retained rod insertion≥18.5573 mm.
Ten exact CAD poses, including four measured final poses, have 910 pairwise
intersections with zero overlap within 1e-5 mm³. These are ordinary
floating-point certificates with margins plus exact B-rep spot checks, not
formal interval arithmetic, contact-force validation, dynamic-overshoot bounds,
a manufacturing or payload rating, or acceptance of edited geometry.

### Equal-force material experiment

`simulation.forceExperiment` identifies eight targets, the constant force,
world direction and duration. Material force lab uses +Y, 0.001 N by default,
and 2,000 ms; the interface also offers 0.0005 N. Eight identical bored-boss
solids have volume 10,050.283064729765 mm³ and different density-derived masses.
They slide between drawn rails on ideal unpowered prismatic joints. Gravity,
friction and contact response are off; the rails do not produce contact forces.

`forceMeasurements.ts` stores transient readouts outside persisted CAD state.
Expected acceleration is `1,000 × forceN / CAD massKg`; measured acceleration
is the change in actual worker COM velocity divided by actual elapsed seconds.
The force panel separates expected and measured values and shows displacement
from the starting pose. A completed run holds its final pose; Run again builds
a fresh world. This demonstrates mass-dependent acceleration, not material
deformation, strength or unequal free-fall acceleration.

The independent real-CAD force check passes full force at 60/120 Hz and half
force at 60 Hz. See `docs/MATERIAL-FORCE-VERIFICATION.md`,
`docs/material-force-results.json` and `docs/material-clearance-results.json`.
The clearance report has 72 exact initial/final B-rep pair checks with zero
intersection volume and a conservative straight-motion lane-envelope check.

### Mass properties and time integration

The CAD worker now extracts the full OCCT centroidal inertia tensor. A symmetric
eigensolve yields principal moments and a right-handed principal-axis frame;
the frame quaternion travels through `MassPropertiesResult`, the volume cache,
the simulation descriptor and Rapier's additional mass properties. The cache
stores geometric moments in mm⁵ plus the frame; applying a different density
rescales mass/inertia without replacing the tensor with an isotropic sphere.
This is numerical B-rep integration, with finite kernel/solver precision.

The fixed-timestep worker accumulates requested elapsed milliseconds and
advances whole `timeStepMs` steps, retaining the remainder and any capped work.
Each call performs at most 120 substeps. Playback speed scales requested time,
not `world.timestep`. The runner serializes worker requests, accumulates time
while an RPC is outstanding, guards superseded builds and holds an in-flight
result across Pause until Resume. Reset destroys the world and clears pending
time. This describes the source implementation; acceptance measurements belong
in the verification report rather than being inferred from the code.

An optional `durationMs` caps a run at the final whole configured step within
the requested interval. The worker returns `simulatedTimeMs`, `completed` and
actual body measurements for force targets; after completion, further step
requests advance zero time. The two-second force and six-second Stewart
windows divide exactly at their configured timesteps. Pause holds late results;
the displayed clock and measurements advance together on publication.

Mode changes deliberately stop/reset simulation to its design pose and zero
clock. Footer clicks reset immediately, and the route effect also handles
browser history navigation. `Scene` registers both layer references and waits
for visible solid meshes/topology before attaching the runner. Simulator's
readiness gate applies to all assemblies, including imported STEP parts, not
only demos. This lifecycle does not preserve a running world across modes.

### Overlay coordinate corrections

`finishedSketchesLayer.ts` now applies each part's full translation and XYZ
rotation even when its cached profile geometry has not changed. Consumed
profiles show only when selected; hidden parts' sketches remain hidden.
`Scene` hides this modelling layer in Simulator and during a physics run.
The old gyro screenshot's orange circles below the assembly were untransformed
sketch profiles, not misplaced physical joints.

`MateVisualizer.ts` uses the same stored local anchors as Rapier, without
replacing a picked point with a freshly calculated face centroid. A parent frame
tracks the live body's world position/quaternion on each render; glyph geometry
is reused. Enlarging a selected prismatic or planar icon no longer scales its
anchor away from the joint. Overlay tests measure points/directions and geometry
reuse; browser verification must still inspect the displayed result.

### Supported physics and rejected frames

- CAD simulation units: mm, seconds and kg. Density sets rigid-body mass and
  inertia; those CAD bodies do not deform or fail. The separate analytical
  beam tool uses explicitly supplied elasticity and stress-limit properties.
- CAD part-to-part contact response is disabled through collider solver groups.
  Parts can interpenetrate. General gear/cam contact, bearing resistance and
  automatic clearance checking are unavailable. The independent contact bench
  and offline demo-specific geometry audits do not enable CAD collision physics.
- Revolute motors command rad/s derived from RPM; prismatic motors command
  mm/s. They are velocity servos without enforced torque or force limits.
  Stored torque/force fields must not be presented as active load limits.
  The separate capped-force actuator bench does not change these joint motors.
- The installed Rapier 0.12 JS `intoRaw()` consumes `frame1/frame2` only for
  Fixed joints. Revolute, Prismatic and Generic constructors all use a single
  local axis. Merely setting those descriptor fields does not fix two-frame
  joint behaviour.
- Revolute joints require their shared signed local axis to map to the same
  world direction in both starting poses. Relative twist about that axis is
  allowed. Prismatic joints also require identical full starting orientations.
  `supportedJointAxis()` allows float32 roundoff, not visible frame corrections.
- Fixed joints preserve the initial relative transform with separate frames.
  Spherical joints accept distinct local anchors with no axis restriction.
- Incompatible revolute/prismatic frames and Planar mates throw during
  `buildJoint`; `buildWorld` destroys the incomplete world and returns `ok:false`.
  Simulating the remaining bodies after dropping a constraint is not acceptable.
- Connected Boolean results simulate their exact final shape directly, with
  construction inputs excluded. Invalid geometry, ambiguous material/ground and
  stale result attachments fail before the world starts. Structural edits during
  asynchronous preparation invalidate that snapshot; edits during a running
  world stop it. Do not reinstate the old blanket Boolean blocker or simulate
  uncut operands as a substitute.
- A mate referencing an absent body also fails the whole build, including
  when a mated part was hidden and excluded from the simulation meshes.

### Verification and evidence

From repository root, after `pnpm install`, on the configured Node 24 runtime:

```sh
pnpm --filter @workspace/kineticad typecheck
pnpm --filter @workspace/kineticad test:all
```

Mass tests exercise actual OCCT shapes and Rapier torque response. Physics tests
run the shipped worker through Comlink with analytical descriptors, separating
mechanics from CAD generation and rendering. Overlay tests exercise Three.js
scene-graph transforms without a GPU. Demo tests cover file validation and
restoration of the original workspace. Regenerate fixtures with
`node scripts/src/generate-demo-library.mjs` when source definitions change.

`test:all` runs test files sequentially. Focused scripts include `test:project`,
`test:controller`, `test:workspace`, `test:engineering`, `test:transforms` and
`test:beam`, plus the earlier CAD/physics suites. The completed 298-case baseline
includes seven actual-worker assembly-export regressions. The earlier four-bar
aggregate passed all 348 tests. The hinge checkpoint passed **351/351** after
three revolute picking frame regressions; use the
[hinge verification](docs/REVOLUTE-PICKING-VERIFICATION.md) and
[hinge-stage suite output](docs/evidence/revolute-picking/suite.txt) for that follow-up,
while retaining the four-bar catalog's original 348-test scope.
New four-bar tests cover pure geometry/search, real worker messages, native OCCT
and Rapier, project/preflight/readout contracts, drawing handlers and Three.js
trace-label projection. Handler/matrix tests do not establish browser drawing
or rendered appearance. Preserve the new stage's named evidence separately.
Mathematical tests never substitute for actual CAD, solver or rendered acceptance.

The Stewart turning profiles exposed a trimmed-arc construction bug: OCCT's
circle frame did not explicitly match the sketch's UV axes. `sketchToWire`
now supplies the UV normal and U direction for XY, XZ and YZ arcs. In
particular XZ uses U=+X, V=+Z and UV normal=−Y; extrude directions and full
circles are unchanged. Seven actual-OCCT tests check arc endpoints/intermediate
points, sector volumes and centroids, sphere revolutions, and valid single-solid
Stewart barrel/rod profiles with positive inertia.

Run the heavier geometry commands sequentially, then the real-CAD worker checks.
These scripts write tracked numerical reports. Use an isolated checkout or preserve
old report bytes, archive new measurements as a separately dated run, and restore
the old records. Do not replace their measured hashes without rerunning; see
[report provenance](docs/REPORT-PROVENANCE.md).

```sh
node --import ./scripts/node_modules/tsx/dist/loader.mjs scripts/src/verify-demo-geometry.mjs --export-descriptors
node artifacts/kineticad/tests/verify-demo-physics.mjs /tmp/kineticad-demo-descriptors.json
node artifacts/kineticad/tests/verify-material-force.mjs /tmp/kineticad-demo-descriptors.json
node artifacts/kineticad/tests/verify-stewart-physics.mjs /tmp/kineticad-demo-descriptors.json
node artifacts/kineticad/tests/verify-stewart-controller.mjs /tmp/kineticad-demo-descriptors.json
node --import ./scripts/node_modules/tsx/dist/loader.mjs artifacts/kineticad/tests/verify-material-clearance.mjs
node --import ./scripts/node_modules/tsx/dist/loader.mjs artifacts/kineticad/tests/verify-stewart-clearance.mjs
node --import ./scripts/node_modules/tsx/dist/loader.mjs artifacts/kineticad/tests/verify-stewart-workspace.mjs --occt
node --import ./scripts/node_modules/tsx/dist/loader.mjs scripts/src/verify-demo-geometry.mjs --refresh-metadata
node --experimental-strip-types artifacts/kineticad/tests/verify-actuator-bench.mjs
node --experimental-strip-types artifacts/kineticad/tests/verify-contact-bench.mjs
```

The descriptor exporter rebuilds 50 bodies across six fixtures. Reports under
`docs/` bind to their recorded fixture/source hashes: `demo-geometry-results.json`,
`demo-physics-results.json`, `material-force-results.json`,
`material-clearance-results.json`, `stewart-physics-results.json`,
`stewart-clearance-results.json`, `stewart-controller-results.json`,
`stewart-workspace-results.json`, `actuator-bench-results.json`,
`contact-bench-results.json` and `beam-analysis-results.json`. Inspect hashes
and case scopes before reuse; a later source edit is not automatically covered.

The original six-second Stewart heave and its 182 endpoint intersections remain
baseline regressions; the six-axis workspace/controller reports are separate.
`force-stewart-browser-results.json` preserves the prior six-demo Chrome bundle,
not acceptance of the latest persistence/controller/Engineering tests changes.
`browser-export-results.json` measures downloaded native/imported STEP/STL and
explicitly excludes assembly-level booleans. `assembly-export-results.json`
separately passes seven actual-worker cases: committed visibility, ordered
subtraction, hidden operands, disconnected/multiple results and raw imported
assets. See `docs/ASSEMBLY-EXPORT.md`; Hide inputs off intentionally exports
visible originals alongside the result. Final browser evidence must identify
the current source and actual covered cases. `docs/REPORT-PROVENANCE.md`
explains the restored geometry metadata and intentionally retained older
CAD-worker/browser hashes.

See [Physics verification](docs/PHYSICS-VERIFICATION.md) for current measured
results, browser evidence and unresolved gates. Keep the original Windmill
`π ±5e-7 rad/s` criterion. Passing analytical descriptors alone does not confirm
the full CAD/cache/worker/render path. The May 2026 observations below are
historical, including the older isotropic-inertia implementation, and remain
separate from new acceptance evidence.

---

## Phase 10 — Material Library (2026-05-17)

Eight engineering materials with physically-based rendering colours and
density values. Material is set per-part; mass properties are computed
after every regen and shown live in the inspector.

**`cad/materials.ts`** (new): defines the `Material` type and
`MATERIAL_LIST` constant with eight entries — aluminium-6061 (2.70 g/cm³,
#A8B0BC, m0.7 r0.35), steel-1018 (7.87, #8C909A), brass-c36000 (8.50,
#B5A642), titanium-grade5 (4.43, #9DA8B0), nylon-6 (1.14, #E8D8C0),
pla (1.25, #C8D8E8), abs (1.04, #D4C8B8), acrylic (1.18, #C0D8E8).
`getMaterial(id)` returns the entry or falls back to aluminium-6061.

**`cad/operations/massProperties.ts`**: `density` parameter is now
required (was optional with a hard-coded aluminium default). Callers
must pass `getMaterial(part.materialId).densityGcm3`.

**`state/store.ts`** (persist v8 → v9):
- `Part` schema already had optional `volumeCm3` / `massKg`; `materialId`
  was already required. New default is `"aluminium-6061"`.
- New actions: `setPartMaterial(partId, materialId)` and
  `updatePartMassProps(partId, volumeCm3, massKg)`.
- `partialize` now strips `volumeCm3` / `massKg` from every part before
  writing to `localStorage` so stale computed values never survive reload.
- v8→v9 migration: any part with `materialId` absent or `"default"` is
  promoted to `"aluminium-6061"`. A defensive second pass runs regardless
  of the recorded version to handle hot-reload edge cases.

**`three/PartMeshLayer.ts`** (rewritten):
- Replaced the single `sharedMaterial` + `dimmedMaterial` pair with a
  `Map<materialId, { opaque, dimmed }>` cache keyed by material id.
  Pairs are created lazily on first use and disposed together in
  `dispose()`.
- `Entry` gains `lastMaterialId: string | null`.
- `sync()` accepts an optional `onMassPropsUpdate` callback. The correct
  PBR pair is applied synchronously to the mesh every sync (colour change
  is instant, no regen needed).
- `regenAndApply` detects `hashChanged || materialChanged`; when either is
  true it calls `kernel.getMassProperties({ density })` and fires the
  callback. The async mass-props call shares the same token guard as regen
  so stale results from superseded syncs are dropped.

**`three/Scene.tsx`**: both `partMeshLayer.sync` call sites (initial
mount and store subscription) now pass `onMassPropsUpdate` which
dispatches `updatePartMassProps` to the store via `getState()`.

**`components/inspectors/PartInspector.tsx`**:
- Material picker: `<select>` pre-populated from `MATERIAL_LIST` with a
  colour swatch and a density hint (g/cm³) shown as a suffix. Calls
  `setPartMaterial` on change.
- Mass readout: two tiles (Volume cm³ / Mass kg) shown once
  `volumeCm3 > 0`; "Computing mass properties…" shown while the regen
  is in flight for a part that has a base feature.

**`views/Modeller.tsx`**: load validation now accepts `version === 8`
OR `version === 9` so saved v8 files still open (migrate runs on load).

**Seeds**:
- `scripts/src/generate-orrery-seed.ts`: `PERSIST_VERSION = 9`,
  all `materialId: "default"` → `"aluminium-6061"`.
- `public/seeds/orrery.js`: regenerated (version 9, 13 bodies, 12 joints).
- `public/seeds/windmill.js`: updated version 8→9 and
  `materialId: "default"` → `"aluminium-6061"` for both parts.

**Verification**: ✅ Verified on deployed `.replit.app` (Chrome, M-series Mac).
`pnpm --filter @workspace/kineticad run typecheck` — clean (zero errors).
1. ✅ Load the orrery seed — all 13 parts render with aluminium colouring.
2. ✅ Select a part, open PartInspector — material picker shows
   "Aluminium 6061 / 2.70 g/cm³"; volume + mass tiles populate.
3. ✅ Change material to "Steel 1018" — mesh colour updates immediately;
   mass readout refreshes with ~2.9× higher mass.
4. ✅ Save model → reload → v9 file loads without version error.
5. ✅ Windmill canary (v8 file) opens; migration promotes materialId; π
   joint holds under simulation.

**Note**: the simulation's physics mass was still using hardcoded aluminium
density at Phase 10 ship — the inspector readout was correct but Play was not.
Fixed in the post-Phase-10 patch below; the full material-library correctness
story is only complete with both entries.

---

## Post-Phase-10 fix — Volume cache + simulation density correctness (2026-05-17)

Historical implementation and verification record. The equivalent-sphere warm
cache path described here is superseded by the full tensor cache above.

Two bugs found by diagnosis of Play latency on the 13-part orrery.

**Correctness fix (`physics/simulationRunner.ts`)**: removed the hardcoded
`ALUMINIUM_DENSITY_G_CM3 = 2.7` constant. The simulation now calls
`getMaterial(part.materialId).densityGcm3` per part so physics mass/inertia
reflects the material the user actually set. Previously the simulation always
treated every part as aluminium regardless of the inspector selection.

**Performance fix — volume cache (`features/volumeCache.ts`, new module)**:
`VolumeData = { volumeMm3: number; comLocal: [number, number, number] }` keyed
by tip-feature hash (the same FNV-1a string `featureCache` uses for tessellated
meshes). Volume and centre-of-mass are geometry-only; mass is just
`volume × density × 1e-6`, which is arithmetic. Caching by tip hash gives
automatic invalidation — geometry changes → new hash → cache miss; material
changes → same hash → cache hit.

**`three/PartMeshLayer.ts`** updated in `regenAndApply`:
- On geometry change (`hashChanged`): after the OCCT `getMassProperties` call,
  writes `{ volumeMm3, comLocal }` into the volume cache.
- On material-only change (`materialChanged && !hashChanged`): reads volume from
  cache and computes `massKg` as arithmetic — **zero OCCT calls**.
- Cold-cache fallback (first regen, imported-STEP): falls back to
  `getMassProperties` worker call, then populates cache.

**`physics/simulationRunner.ts`** updated in `buildAndStart`:
- Computes the tip hash with a pure-JS `computeTipHash` helper (loops over
  `part.features`, calls `computeFeatureHash`, no worker round-trip).
- Warm cache path: derives `massKg`, `rEqMm`, `isoInertia` on the main thread
  from `volumeMm3 + density` — no `await`, no OCCT. For the 13-part orrery
  with a warm cache the entire mass-props loop is now synchronous.
- Cold-cache fallback: calls `getMassProperties` with the correct per-material
  density, then writes result to the volume cache for subsequent Play presses.

**No schema or persist changes.** `volumeCache.ts` is a module-level `Map` with
the same in-memory lifecycle as `featureCache.ts`. `part.volumeCm3` / `massKg`
in the store remain non-persisted (stripped by `partialize`).

**Verification**: ✅ Verified on deployed `.replit.app`. Orrery (13 parts,
all aluminium) plays correctly; changing a part to Steel 1018 and pressing
Play produces ~2.9× higher simulated mass. Windmill canary holds π joint
under simulation with correct density. Typecheck clean.

---

## Routing / BASE_PATH notes (`artifacts/kineticad`)

The app lives at `/app` (BASE_PATH = `/app`, set in `.replit-artifact/artifact.toml`).

**ModeToggle double-prefix bug (fixed 17/05/2026):** `WouterRouter` is
initialised with `base={import.meta.env.BASE_URL.replace(/\/$/, '')}` = `/app`.
Wouter's `<Link>` automatically prepends this base on navigation, so hrefs
inside the routed tree must be plain internal paths (`"/"`, `"/simulator"`).
An earlier version of `ModeToggle` also manually prepended `BASE_URL`, causing
wouter to apply it twice → `/app/app/simulator`. Fixed by removing the manual
`base +` prefix; `const base` line deleted entirely.

**Seed paths:** Seeds live in `public/seeds/<id>.js` and are fetched via
`base + '/seeds/' + id + '.js'` where `base` comes from
`document.currentScript.dataset.base` (the `data-base="%BASE_URL%"` attribute
on the inlined script tag in `index.html`). This works in both dev (`/app/`) and
the production build. `generate-orrery-seed.ts` writes to
`artifacts/kineticad/public/seeds/orrery.js` — matches the registry path.
`public/seed-windmill.js` is a backwards-compat shim; the canonical windmill
seed is `public/seeds/windmill.js`.

**Seed registry inlining (17/05/2026):** the `window.loadSeed` IIFE was moved
from `public/seed-registry.js` (fetched via `<script src>`) into a single inline
`<script data-base="%BASE_URL%">` block in `index.html`. Root cause of the
regression: Vite dev serves public files at the root path, not at the base-prefixed
path, so `<script src="%BASE_URL%seed-registry.js">` produced a 404 at `/app`
even though the attribute substitution gave `/app/seed-registry.js`.

**serve.mjs BASE_PATH strip (18/05/2026):** `serve.mjs` now reads `BASE_PATH`
from env and strips the prefix via `stripBase()` before joining with DIST (so
`/app/index.html` → `dist/public/index.html`, `/app/assets/…` → `dist/public/assets/…`).
This was a valid defensive fix but it was *not* the root cause of the seed error.

**Seed URL missing-slash bug — real root cause (18/05/2026):** the actual
production failure was a malformed fetch URL: `/appseeds/windmill.js` instead of
`/app/seeds/windmill.js`. Confirmed from a real production request log.

Cause: `%BASE_URL%` in a `data-*` HTML attribute is substituted by Vite without a
trailing slash (`"/app"`, not `"/app/"`). The old join was `base + 'seeds/' + id`
which produced `"/app" + "seeds/…"` = `"/appseeds/…"`. The missing slash meant
serve.mjs could not find the file and fell through to index.html (HTTP 200, HTML
body), which `eval()` rejected with `SyntaxError: Unexpected token '<'`.

Fix (in `index.html` only): strip any trailing slash from `rawBase` then join with
an explicit leading slash — `base + '/seeds/' + id + '.js'`. Handles all cases:
- `"/app"` → `"/app/seeds/windmill.js"` ✓
- `"/app/"` → strip → `"/app"` → `"/app/seeds/windmill.js"` ✓
- `"/"` → strip → `""` → `"/seeds/windmill.js"` ✓
`window.__seedBase` is set to the normalised (no trailing slash) value.

---

## Landing page (`artifacts/landing`)

### kineticad-intro artifact removed (18/05/2026)

`artifacts/kineticad-intro` (standalone GSAP/Three.js animation) deleted from the
repository. Served at `/kineticad-intro/`; no cross-dependencies. Workflow and
stale task files removed at the same time.

### SEO + /story page (18/05/2026)

New `/story` page (`StoryPage.tsx`) linked from the footer of all pages in orange.
Hero spacing: `clamp(64px, 10vh, 96px) 32px`.

SEO pass:
- `index.html`: canonical, Open Graph (og:type/url/title/description/image), Twitter Card (summary_large_image), `SoftwareApplication` JSON-LD schema.
- `public/sitemap.xml`: four URLs — `/`, `/story`, `/terms`, `/privacy`.
- `public/robots.txt`: `Sitemap:` directive added.
- `DesktopLanding.tsx`: four feature-column labels promoted `<span>` → `<h2>`.
- `not-found.tsx`: user-facing 404 + back link (replaced dev copy).
- `LegalPage.tsx` footer: registered office address added.

### Legal routes (18/05/2026)

| URL | Component |
|-----|-----------|
| `/terms` | `src/pages/TermsPage.tsx` — Terms of Service |
| `/privacy` | `src/pages/PrivacyPage.tsx` — Privacy Policy |

`App.tsx` uses wouter `<Switch>` + `<Route>`. Legal pages rendered without the mobile gate. Shared layout: `src/components/LegalPage.tsx` (760px column, `← Back`, numbered sections, site footer).

**Footer** (all pages): Story · Terms · Privacy links; © Adevious Ltd; company number; registered office (Rosedean House, 4 Argyle Road, Barnet, England, EN5 4DX).

---

## attached_assets/ cleared 18/05/2026 — all 7 orphaned files deleted (~28 MB); directory is gitignored so this note is the only git-level record.

## Current project format: 1, wrapping state version 9
## MOTOR_VELOCITY_GAIN: 10000 (physicsWorker.ts)
## Current examples: six editable gallery assemblies, adjustable crank-slider and bounded four-bar path designer; automated and scoped local Chrome checks complete; Replit/public acceptance separate
## Legacy seed registry: window.loadSeed('windmill') | window.loadSeed('orrery')
## WebGPU testing: top-level Chrome against local app or intended deployment

## September release preparation: history and selection

The implemented usability improvements add document Undo/Redo and nearest-visible-solid
selection. See [usage, boundaries and checks](docs/HISTORY-AND-SELECTION.md).
Model history is bounded, in-memory, grouped for drags/imports, and excludes
solver frames, UI selection and previews. Load/recovery/demo changes start fresh
history; Save retains the restored current model and its imported assets.

The merge hook now only installs the frozen dependencies; it does not push a
database schema. CAD needs no DB/paid-AI credentials. Local environment/key files
are ignored and [third-party notices](THIRD-PARTY-NOTICES.md) preserve dependency
licences. GitHub main push and Replit publication remain separate release steps; repository visibility and the MIT licence are unchanged. Use the [release checklist](docs/PUBLIC-RELEASE-CHECKLIST.md).

Portable evidence capture: `node scripts/src/capture-test-suite.mjs --output-dir <new-directory>`.
It records all serial test results and source fingerprints and preserves the two
historical reports rewritten by tests. Do not run it concurrently with another
CAD suite or source edits. The old `docs/evidence/four-bar/capture-suite.py` is
a historical machine-specific capture, not the supported rerun command.
