# KinetiCAD

Release preparation: **382/382 automated tests across 54 files**, full workspace typecheck/build and scoped Chrome history/selection checks passed. See [verification](docs/HISTORY-AND-SELECTION.md) and [dependency security review](docs/DEPENDENCY-SECURITY-REVIEW.md). The pinned dependencies have **58 advisory records**; a security-update decision, distribution-notice checks and Replit/public-route acceptance remain open. Local functionality passing is not a security clearance.

Browser-native parametric CAD with B-rep geometry and live physics simulation.

Built during the Replit 10 Buildathon (May 2026) by Andrew Blumson (@AndrewBlumson) using Replit and Replit Agent. Co-built with Kevin Blumson (@KevinBlumson).

KinetiCAD remains a **Replit-built application**. Subsequent development, automated
verification and actual Chrome computer-use testing were performed by Codex under
Andrew’s direction. The original Replit build and its historical evidence retain
their own attribution.

## Current source — 12 September 2026

The current source includes six gallery demos, an adjustable crank-slider,
persistent sketch dimensions, complete STEP project recovery, direct simulation
of connected Boolean results, a local **Draw a path** linkage designer,
**Undo/Redo**, and **click-to-select solids**. CAD is desktop-only and requires
WebGPU. Package upgrades remain deferred.

Start with [Current status](docs/CURRENT-STATUS.md) and the
[documentation index](docs/README.md). The [latest test catalog](docs/HISTORY-SELECTION-TEST-CATALOG.md)
lists the final combined regression run; [history and selection](docs/HISTORY-AND-SELECTION.md)
records the new behaviour and actual Chrome checks. [Maths and physics](docs/MATHEMATICS-AND-PHYSICS.md)
records equations, units, observed errors, tolerances and model limits. Earlier
298/348/351-test catalogs and reports retain their original source identities.

Actual Chrome computer use covered local search, cancellation, native CAD creation,
measured motion, Save/Load, refresh recovery and invalidating the original reference
after manual edits. See [four-bar verification](docs/FOUR-BAR-PATH-VERIFICATION.md).
The previous Boolean native-file reopening check also
[passed](docs/evidence/boolean-reopen/browser.json). These checks establish their
stated cases, not a claim that every possible CAD model is physically correct.
Replit republishing and public-route acceptance remain separate steps.

The subsequent [curved-edge hinge check](docs/REVOLUTE-PICKING-VERIFICATION.md)
found and fixed a double coordinate conversion on moved parts. Actual Chrome
picking, saved-file reopening and refresh checks passed for translated and
rotated partial arcs. Earlier incorrectly saved hinges need to be re-picked.

Older known issues are reconciled in the [follow-up register](docs/KNOWN-ISSUES-AND-FOLLOW-UP.md).
The original [May handover](docs/history/HANDOVER-2026-05-17.md) is historical;
[HANDOVER.md](HANDOVER.md) is the current continuation guide.

## Production destination

https://kineticad.co.uk/app

Landing page: https://kineticad.co.uk/ — Story at `/story`, Terms of Service at `/terms`, Privacy Policy at `/privacy`. Open Graph tags and `sitemap.xml` are in place.

These are the established Replit publication destinations. The repository
is temporarily private, and the public site is not claimed to contain
all changes documented here until the final Replit publication checks pass.

## Demo gallery

The current source includes a **Demos** button in both Modeller and Simulator,
plus an example chooser in an empty workspace. Open an example, inspect or edit
its features and mates, then choose **Try simulation**. Gallery artwork is
illustrative; opening a card loads the actual editable CAD assembly.

| Example | Parts / joints | Explore |
|---|---|---|
| Windmill | 2 / 1 | The original 30 RPM revolute-joint canary |
| Solar-system orrery | 13 / 12 | Eight orbital arms, three nested moons and a driven ring; illustrative speeds |
| Three-axis driven gimbal | 4 / 3 | Nested rings, shafts, bearing housings and a steel flywheel driven about intersecting axes |
| Kinetic mobile | 8 / 7 | A turning crown, two branches and four independently driven medallions |
| Material force lab | 9 / 8 | Equal force on eight identical samples with different CAD masses; measured acceleration and travel over two seconds |
| Stewart platform | 14 / 18 | Six actuators translate and rotate a deck through a bounded six-axis motion, with measured pose and joint closure |

Examples run in a temporary workspace. **Return to my model** restores the
original in-memory assembly, including live imported STEP references. Demo
edits do not replace its persisted project. Use **Save project** to download demo edits;
**Reset demo** restores the example. Complete project files embed imported STEP
assets, and the original project's durable recovery copy survives page refresh.

The gimbal and mobile are motor-driven studies with gravity off. The gimbal
does not demonstrate passive gyroscopic precession or predict the behaviour of
an unpowered physical gyroscope. Material force lab uses unpowered straight
guides, a constant 0.5 or 1 mN force through each centre of mass, and zero
gravity. Stewart now offers X/Y/Z translation, roll/pitch/yaw and combined
motion. Its inverse kinematics commands six actuator lengths; the joints and
physics solver determine the deck pose. Targets stay within ±5 mm per translation
axis and ±2° per rotation axis. Default presets move for four seconds and
settle for two; saved validated configurations retain their bounded durations. These are ideal drives with gravity off, not a finite-force payload test.

The recorded numerical checks include six-demo CAD/physics, the equal-force
experiment, 16 six-axis Stewart runs, and a bounded workspace audit with 910
exact CAD pair checks. Each result has a stated scope and source provenance.
Aggregate tests and final browser acceptance are tracked separately in [Physics verification](docs/PHYSICS-VERIFICATION.md); older Chrome
records establish only their recorded bundles. Public deployment remains a
separate acceptance step.

The legacy console loaders remain for development:

```
window.loadSeed('windmill')
window.loadSeed('orrery')
```

These older loaders write legacy localStorage and reload the page; an existing
durable project takes precedence. Use the gallery to explore examples. Gallery fixtures and
metadata are generated by `scripts/src/generate-demo-library.mjs`.

## Stack

- React 19, Vite 7, TypeScript 5.9
- Three.js r184 with WebGPURenderer
- OpenCascade.js 2.0.0-beta.94e2944 for B-rep geometry, in a Web Worker via Comlink
- Rapier3D 0.12.0 for physics, in a separate Web Worker
- Zustand state, Tailwind and Sonner toasts
- Coordinate system: Z-up, millimetre units. Locale: en-GB.

## Undo, Redo and selecting solids

Use **Undo / Redo** in the Modeller toolbar, **Ctrl/⌘Z** and **Ctrl/⌘Shift+Z**.
Committed model changes return together, including deleted parts and their
joints. A drag or multi-part STEP import is one action. New edits replace the
old Redo branch. Apply/cancel an active editor before using model history.
History holds up to 50 changes / 16 MiB of snapshots and starts afresh on reload,
Load, recovery and demo transitions; downloaded projects preserve the current
model, not its Undo stack.

Click a visible solid to select it and outline its CAD edges in orange. Click
empty space to clear selection. Native/imported parts expose the part inspector;
Boolean results show their source parts and an explicit **Edit Boolean operation**
button. A derived Boolean result has no independent transform gizmo. Selection
does not change the model or its history. See [usage and verification](docs/HISTORY-AND-SELECTION.md).

## Complete projects and engineering tests

**Save project** now embeds imported STEP assets alongside native sketches,
feature history, materials, transforms and joints. IndexedDB keeps current and
previous complete recovery copies; startup restores imported solids before the
scene opens. Invalid files and failed writes retain the existing recovery data.
Native version 8/9 project files remain supported, but old files that never
contained their imported geometry still require the original STEP. See
[Project recovery](docs/PROJECT-RECOVERY.md) for the format, failure behavior,
kernel-version limits and rerunnable tests.

Simulator’s **Engineering tests** panel contains three separate, dimensioned
experiments. **Motor & load** applies capped equal-and-opposite actuator forces
to a guided payload: it can lift, hold or fall when the load exceeds the motor
strength. **Friction & contact** measures a guided cuboid sliding on an exact
cuboid floor, including support force, friction, penetration, energy loss and
timestep error. These two Rapier worlds are independent of the CAD assembly.
See [Physics verification](docs/PHYSICS-VERIFICATION.md) and
[Contact bench](docs/CONTACT-BENCH.md) for measured tolerances.

The independent **Elastic beam** tab uses an eligible native rectangle/extrude
part or an explicitly dimensioned benchmark, a stated clamp
and tip force, and user-supplied Young's modulus and elastic limit. It reports
analytical bending deflection/stress and flags slenderness, small-deflection
and elastic-limit failures. It does not deform the CAD mesh or provide general
finite-element analysis. [Elastic beam scope and verification](docs/ELASTIC-BEAM.md)
documents the equations, units, omitted effects and seven passing tests.

## Draw a path

Choose **Draw a path** in either workspace. Draw a closed outline, choose a
preset or enter coordinates; then select **Find a mechanism**. A cancellable
worker searches locally for a four-bar linkage whose tracing point follows a
nearby path. No AI API or paid service is involved.

The preview reports typical and largest sampled shape gaps. **Build editable
model** first checks four connected native solids, then opens their four-joint
assembly in a protected temporary workspace. **Run one cycle** compares its
actual physics trace with the calculated geometry. **Save project** retains the
drawing, dimensions, materials and joints; **Return to my model** restores your
original project. Manual edits disable the original comparison.

This is a bounded planar linkage search, with ideal rigid joints and a 10 RPM
drive. It cannot reproduce every outline or guarantee a global optimum. Motor
loads, friction, contact and deformation are outside this mechanism's model.
See [equations, limits and measured verification](docs/FOUR-BAR-PATH-VERIFICATION.md).

## Adjustable crank-slider

The new **Crank-slider** workspace adds one editable four-part mechanism: a
powered crank, passive connecting rod and guided slider on a grounded bed.
Adjust the crank radius, rod length and RPM, then compare actual solver motion
with the exact rigid-link position, speed and mean-acceleration reference.
The mechanism uses native CAD features and preserves its settings in Save project.
Its ideal drive has no finite-torque or contact-load rating.

This stage's complete serialized suite passed **195/195 tests**, separately from
the historical 166-test baseline below. The actual-CAD study covers 16 physics
scenarios and 864 sampled geometric intersections. The interface reports mean
acceleration; finer single-step derivative errors remain explicitly documented.
The [local Chrome checks](docs/CRANK-SLIDER-CHROME-2026-09-12.md) cover motion,
parameter changes, pause/reset and the actual Save/Load/refresh path.
See
[Crank-slider equations, limits and verification](docs/CRANK-SLIDER-VERIFICATION.md).

## Editable sketch dimensions — ready to try

Select a finished sketch in the parts tree, choose **Edit dimensions**, enter
millimetres or degrees, then **Apply dimensions**. Circles, rectangles, lines
and arcs retain their measurements through project downloads and recovery.
The app rebuilds the affected features before accepting an edit; failed geometry
or a changed joint attachment keeps the saved model intact. Connected endpoints
must be edited together; automatic sketch constraints are still future work.

The sketch-dimension milestone passed **237/237 tests**, including 33 new dimension,
actual OpenCascade and edit-transaction checks. Chrome checks cover numeric input,
connected profiles, rejected edits, Save/Load, recovery and actual STEP/STL downloads.
See [measurements, tolerances and browser evidence](docs/SKETCH-DIMENSIONS-VERIFICATION.md).
Andrew subsequently authorised the Boolean stage. Its latest status and remaining
acceptance checks are listed in [Current status](docs/CURRENT-STATUS.md).

## What works

Modeller:

- Sketching on the global XY, XZ and YZ planes (line, rectangle, three-point arc, circle) with a snap engine
- Persistent numeric editing of finished sketches, with dependent-feature rebuild and joint-attachment checks
- Extrude and Revolve features, with forward, backward and symmetric extrude directions
- Modifier features: Fillet, Chamfer, Hole
- Boolean operations at assembly level: Union, Subtract, Intersect
- Multi-part assemblies with per-part visibility and a translate/rotate transform gizmo
- Edge and face picking for mate creation
- Four supported mate types: Revolute, Prismatic, Spherical and Fixed. Legacy Planar records remain inspectable, but new creation and simulation are unavailable.
- Motor configuration in RPM on Revolute mates and mm/s on Prismatic mates
- Material Library: eight engineering presets (aluminium, steel, brass, titanium, nylon, PLA, ABS, acrylic) with physically-based colours and density values; per-part material selection; mass and volume readout in the inspector
- Save and Load: complete editable projects with native history, materials, transforms, joints and embedded imported STEP geometry
- File controls have persistent small labels and explanatory keyboard/hover tooltips: Import STEP, Export STEP, Export STL, Save project and Load project
- Finished sketches follow their part's translation and rotation; consumed profiles show when selected and are hidden in Simulator

Physics:

- Real-time rigid-body simulation via Rapier3D, driven by the mate joints
- Revolute, Prismatic, Spherical and Fixed mates are supported within the frame restrictions below
- Motorised joints sustain a commanded velocity
- B-rep volume, centre of mass and the full centroidal inertia tensor, including principal-axis orientation, feed Rapier
- Fixed solver timesteps with accumulated elapsed time; playback speed changes the requested duration rather than the solver timestep
- Joint glyphs follow the displayed rigid-body pose and use the same stored local anchors as physics
- Constant forces applied at the centre of mass, with newtons converted to the mm/s/kg world; the material lab compares measured velocity changes with F/m
- Timed experiments hold their final poses and measured results at the configured duration; reset or repeat starts a new run
- Bounded six-axis inverse kinematics for the supplied Stewart mechanism, with live solver pose, tracking-error and actuator measurements
- Separate motor/load and contact/friction benches, plus an analytical elastic-beam calculation

### Simulation assumptions and joint frames

The CAD assembly simulator uses rigid bodies and joints. Material density
affects mass and inertia; it does not make those bodies deform or fail.
The separate elastic-beam calculation has its own material inputs and limits.
The former equivalent-volume-sphere inertia approximation has been replaced by
OCCT tensor integration and principal-axis decomposition. This retains the
shape's directional inertia through cache hits and material changes, within
the numerical precision of the CAD and physics engines.

Display regeneration evaluates the complete feature chain once and calculates
the mesh and unit-density mass properties from the same final solid. Concurrent
requests share unfinished work; explicit cache resets cannot receive stale
results. Material changes rescale the cached geometric properties.

Part-to-part contact response is disabled in CAD assemblies. Parts can pass
through one another; gear-tooth contact and bearing resistance are not modelled.
There is no general-purpose clearance checker; specific demo geometry has
separate offline B-rep intersection and travel-envelope checks. CAD joint motors
are ideal velocity servos without enforced torque or force limits, including
Stewart’s six drives. Stored torque/force fields are not active load limits.
Visual shafts and bearing housings do not add contact constraints. The separate
contact bench and force-limited actuator bench validate their declared simple
setups; they do not enable general CAD collisions or finite-force Stewart.

Connected assembly Boolean results now simulate directly. A union joins shapes,
a subtraction removes a cutter, and an intersection keeps their shared volume.
The finished solid supplies both the rendered mesh and integrated mass properties;
construction inputs are excluded even when shown in the Modeller. Each result has
a uniform material and an explicit fixed/free choice in its Boolean editor.
Subtraction can inherit the retained body's material. Mixed-material unions or
intersections require a material choice, not a density average.

Attach new joints to the finished result. Existing input joints are not silently
remapped, and editing a result invalidates its old attachment picks. Save/Load
and recovery preserve result materials, fixed-base IDs and joint geometry revisions.
Empty/disconnected results, shared source parts between physical results, missing
materials and ambiguous input grounding/joints block simulation with guidance.
These checks do not introduce contact response or structural deformation.
See [Boolean simulation verification](docs/BOOLEAN-SIMULATION-VERIFICATION.md)
for independent numerical checks, Chrome coverage and supported limits.

Rapier 0.12's JavaScript joint constructors use one shared local axis for both
bodies. A revolute joint is accepted only when that axis points in the same
world direction for both starting poses; relative twist about that axis is
permitted. A prismatic joint additionally requires the same full starting
orientation, because it locks all relative rotation. Fixed joints retain the
initial relative pose using separate frames; spherical joints use separate
local anchors without an axis restriction. Unsupported frame combinations and
Planar mates stop the entire simulation build instead of silently dropping a
constraint or rotating the assembly into another configuration.

The worker advances only whole configured timesteps and carries the remainder
forward. It limits work per call while retaining outstanding time. The runner
serializes worker calls and guards paused or superseded runs so late results
cannot move the displayed paused assembly. Numerical tests and live-browser
acceptance are recorded separately in [Physics verification](docs/PHYSICS-VERIFICATION.md).
An optional duration cap stops at the final whole configured step within the
requested window. The bundled two- and six-second windows divide exactly at
their configured timesteps. This is simulated time, independent of playback speed.

Changing between Modeller and Simulator stops the run, restores the design
pose and resets elapsed time to zero. This also applies to browser Back/Forward
navigation. Play waits for all visible solid geometry to load, including STEP
parts; switching views does not preserve a running physics world.

File interop:

- STL export, binary
- STEP import, single-part and multi-part assembly
- STEP/STL exports of committed visible solids, including assembly Boolean results and current transforms; see [Assembly export](docs/ASSEMBLY-EXPORT.md)
- STEP round-trip with geometry and relative positions preserved; export flattens sub-assembly grouping
- Imported assemblies receive a common Z translation to place them on the Z=0 plane while preserving relative positions; this placement is distinct from fixing a body in physics

The build follows a 12-phase spec; phases 0 to 10 are complete, with later post-phase work covering the seed registry, the orrery, and Save/Load. See `replit.md` at the repository root for the phase-by-phase log.

<a id="verified"></a>

## Historical validation — May 2026

The measurements below are prior results from the original build. They are
preserved as regression references, not claimed as fresh verification of the
current gallery, inertia or timestep changes. Current evidence and open gates
belong in [Physics verification](docs/PHYSICS-VERIFICATION.md).

### Windmill physics canary

The windmill seed is the standing physics regression test. Target: 30 RPM, which is pi rad/s, 3.141592653589793.

| Channel | Value |
|---|---|
| bodyBangvelMag | 3.14159270 to 3.14159298 |
| bodyBangvel.x | approximately 3e-16 (floating-point precision floor) |
| bodyBangvel.y | approximately 4e-10 (floating-point precision floor) |
| bodyBangvel.z | 3.14159 (pure Z-axis rotation) |

The original run reported stability within plus or minus 5e-7 rad/s with no
drift. **The acceptance gate remains 30 RPM = π rad/s ±5e-7 after at least five
seconds. Do not relax that tolerance to make a changed implementation pass.**

### Multi-mate kinematic chains

The original orrery run exercised 13 rigid bodies connected by 12 motorised
revolute joints in nested chains: planet arms on a central hub, with moons on
three of the planet arms. That historical observation does not establish the
accuracy of every joint under the new inertia implementation.

### File interop (08/05/2026)

STL export: the windmill STL renders correctly in macOS Preview; a programmatic check confirms binary format, 408 triangles, 20,484 bytes, watertight per part, zero degenerate triangles. Bambu Studio sliced it to a complete print plan.

STEP import: a McMaster-Carr M3 socket-head screw (91290A115) imported as a single grounded part; a McMaster-Carr torque-limiting coupling (9132K11) imported as a 12-part assembly with relative positions preserved.

STEP round-trip: KinetiCAD-exported STEP files re-import with geometry and relative positions intact. Export flattens sub-assembly grouping; STEP does not retain mates.

## Known issues and limitations

The [known-issues register](docs/KNOWN-ISSUES-AND-FOLLOW-UP.md) tracks original
issues, fixes already delivered, unverified paths and later work. Historical
items are not automatically treated as current bugs.

### Geometry-exchange limitations in this app

KinetiCAD’s STEP import/export path exchanges solid geometry and placement, not
its mate/joint definitions. Re-establish those joints after STEP import, or use
**Save project / Load project** to retain the full KinetiCAD assembly.

STEP export flattens compound-of-solids hierarchy. Geometry is preserved, sub-assembly grouping is lost.

### KinetiCAD-specific

Imported STEP geometry now survives refresh through validated source assets in
IndexedDB and complete downloaded project files. Raw WebAssembly handles remain
transient and are rebuilt before the scene opens. Old JSON files that never
contained their imported geometry still need the original STEP file; see
[Project recovery](docs/PROJECT-RECOVERY.md) for failure and version limits.

Imported parts are named after the source filename. STEP files do carry a PRODUCT entity name per component, but reading it back is not possible in this OpenCascade.js binding. This was investigated and confirmed to be a binding limitation, not a roadmap item. File-stem naming is permanent documented behaviour.

Arc-edge pivots: the underlying fix is in. topology.ts now emits the true geometric circle centre for circle and arc edges; previously the centre was computed but never written to the emitted metadata, so callers fell back to an arc centroid that is offset for partial arcs. The windmill canary holds pi after this fix. The subsequent translated/rotated partial-arc pick path passed actual Chrome checks and three new frame regressions; see [the bounded follow-up](docs/REVOLUTE-PICKING-VERIFICATION.md). Existing incorrect saved joints must be repicked.

Other known issues:

- Click a finished Boolean solid to select its orange outline and summary; choose **Edit Boolean operation** to edit it. Its shape and placement derive from source parts. Connected result faces/edges retain separate joint-picking rules.
- Sketch profiles cannot contain multiple closed loops, for example a plate with a hole
- Sketches can be created only on the global XY, XZ and YZ planes; sketch on a selected face is not implemented
- Legacy Planar mates remain inspectable; new creation is unavailable and existing Planar mates prevent simulation from starting
- Revolute/prismatic frame combinations outside the restrictions above prevent simulation from starting
- Undo/Redo is in-memory and bounded; reopening a project or a demo starts fresh history. It does not reverse unfinished editor previews.

### Not yet covered

The follow-up register defines the remaining coverage work:

- Fresh supported-browser testing; historical Safari observations are not a new-build pass.
- Systematic assembly-size, frame-time, memory and preparation-latency measurements.
- Physical-device checks of the intentional phone/tablet CAD block and readable public pages.

CAD remains desktop WebGPU. Mobile CAD and a WebGL2 fallback are not current
product promises; revisiting either requires a separate support-policy decision.

## Roadmap and contribution opportunities

Pull requests are welcome. The most useful contributions:

- Broader transformed-edge/joint coverage beyond the recorded partial-arc fixtures
- Multi-loop sketch profiles (plates with holes, ring shapes)
- Sketch on a selected face
- IGES import and export for wider CAD interop
- Broader performance and supported-browser measurements

The bounded local four-bar linkage optimiser is implemented and locally checked
within its [documented search and physics limits](docs/FOUR-BAR-PATH-VERIFICATION.md). Persistent automatic sketch constraints remain future
work. Complete project recovery is implemented.
Finite-force Stewart, general CAD contact/friction and general finite-element
analysis remain future work. No AI API is used for the local mechanism search.

CAD or graphics experience is particularly valuable on the sketch-on-face, multi-loop sketch and arc-pivot items.

## Demo files for testing

Real-world STEP files for verification, all free:

- McMaster-Carr: industrial parts catalogue. Search any part number, open Product CAD, download the STEP file. Good single-part and assembly test cases include 91290A115 (M3 socket-head screw) and 9132K11 (torque-limiting coupling).
- GrabCAD: community-uploaded parts and assemblies, free with signup.

## Local development

```sh
git clone https://github.com/AndrewBlumson/KinetiCAD.git
cd KinetiCAD
pnpm install --frozen-lockfile
PORT=5184 BASE_PATH=/app pnpm --filter @workspace/kineticad dev
```

Open http://localhost:5184/app/. The Vite configuration requires both `PORT`
and `BASE_PATH`, including outside Replit. WebGPU is required: use a top-level
Chrome tab on a supported device, such as an M-series Mac. The Replit preview
iframe may lack WebGPU and show a "WebGPU required" message; open
the local app or intended deployment directly in Chrome.

Build and preview the production bundle from the repository root with:

```sh
PORT=5184 BASE_PATH=/app pnpm --filter @workspace/kineticad build
PORT=5184 BASE_PATH=/app pnpm --filter @workspace/kineticad serve
```

## Rerunnable verification

From the repository root, after `pnpm install`, using the configured Node 24 runtime:

```sh
pnpm --filter @workspace/kineticad typecheck
pnpm --filter @workspace/kineticad test:all
```

`test:all` runs the test files sequentially. Focused scripts include `test:project`,
`test:controller`, `test:workspace`, `test:engineering`, `test:transforms` and
`test:beam`, alongside the original CAD/physics suites.

The mass tests use the installed OCCT and Rapier WASM kernels. Worker tests use
the shipped physics worker over Comlink with analytical body descriptors; they
isolate mechanics and do not replace CAD-to-browser acceptance. Overlay tests
check scene-graph point/direction transforms without rendering pixels. The demo
tests check documents and restoration of the original workspace.

The six-demo check rebuilds all 50 parts in OpenCascade, then sends their
actual meshes, mass tensors and mates through the shipped physics worker.
**These standalone commands write tracked report files.** Run them in an isolated
checkout or preserve the existing report bytes first, retain new outputs under
a separately dated run, and restore historical files. Do not overwrite a dated
measurement record to make its provenance appear current. See
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
node --experimental-strip-types artifacts/kineticad/tests/verify-actuator-bench.mjs
node --experimental-strip-types artifacts/kineticad/tests/verify-contact-bench.mjs
```

The physics check rejects descriptors whose fixture hashes are stale. Its
measured speed, anchor and timing results are saved in
`docs/demo-physics-results.json`. The force experiment has a separate
[derivation and measured results](docs/MATERIAL-FORCE-VERIFICATION.md), plus
`docs/material-force-results.json` and `docs/material-clearance-results.json`.
`docs/stewart-physics-results.json` retains the original symmetric-lift
regression; its endpoint intersections are in `docs/stewart-clearance-results.json`.
The six-axis controller and wider geometric audit are recorded separately in
`docs/stewart-controller-results.json` and `docs/stewart-workspace-results.json`.
[Workspace audit](docs/STEWART-WORKSPACE-AUDIT.md) explains the conservative
pose/path bounds, sampled exact solids and exclusions. None of these geometric
checks enables contact forces.
Run heavyweight OpenCascade commands sequentially.
[Report provenance](docs/REPORT-PROVENANCE.md) explains retained measured
revisions and metadata-only refresh after separate clearance reruns.

The last completed serialized `test:all` aggregate has **298 passing tests**. See the
[individual test inventory](docs/TEST-CATALOG.md) for each source, purpose and
recorded result; the full workspace typecheck/build also passed at `8e954ab`.
The older 166-, 195- and 237-test totals identify earlier stages, not additional
cases to add to this total. Standalone CAD/physics experiment counts are separate.

Actual Chrome computer-use checks by Codex are recorded by stage in the
[documentation index](docs/README.md#actual-browser-checks-recorded-by-stage).
They cover the specified controls and outputs of each recorded bundle. The final
Boolean downloaded-file Load-dialog reopening has since passed for the saved
Fixed-joint project, including Play/Pause/Reset and another refresh; see
[the actual browser record](docs/evidence/boolean-reopen/browser.json).
That closes the prior stage's gate, not the in-progress four-bar stage's
regression/browser checks. Numerical and local browser results do not replace
final user or public deployment acceptance.

Regenerate the six bundled documents and their catalog when their source
definitions change:

```sh
node scripts/src/generate-demo-library.mjs
```

For browser acceptance, open a top-level WebGPU-capable Chrome tab against the
local app or the intended deployment. Exercise each gallery card, editing,
Play/Pause/Reset, speed changes and **Return to my model**. Inspect actual worker
errors and numerical diagnostics alongside rendered motion. A passing command,
an illustration or an animation alone does not establish physical accuracy;
record the measured results and unresolved gates in the verification report.

## Built with

Replit and Replit Agent. The existing Replit project remains the intended build
and publishing home. Codex assisted with subsequent development, automated
numerical checks and desktop Chrome computer-use verification; see the dated
evidence records for exactly what was checked.

## Author

Andrew Blumson ([andrewblumson.com](https://andrewblumson.com/)), Replit UK
Ambassador and creator of KinetiCAD at [Adevious AI](https://adevious.co.uk/).
[X: @Andrew_Blumson](https://x.com/Andrew_Blumson) ·
[LinkedIn](https://www.linkedin.com/in/andrewblumson/) ·
[GitHub](https://github.com/AndrewBlumson). Co-built with Kevin Blumson (@KevinBlumson).

## Licence

MIT. See LICENSE for the full text.

## Acronym index

B-rep: Boundary Representation
CAD: Computer-Aided Design
IGES: Initial Graphics Exchange Specification
JSON: JavaScript Object Notation
MIT: Massachusetts Institute of Technology
RPM: Revolutions Per Minute
STEP: Standard for the Exchange of Product Model Data
STL: Stereolithography
URL: Uniform Resource Locator
WebGPU: browser graphics and compute API

## Preparing a public release

Use the [public-release checklist](docs/PUBLIC-RELEASE-CHECKLIST.md). The project
retains its MIT licence and original Replit attribution; dependencies retain
their [separate third-party terms](THIRD-PARTY-NOTICES.md). The Replit merge hook
installs locked dependencies only; it no longer pushes a database schema. CAD
geometry and simulation do not require database or paid AI credentials.

## Contributions and security

Read [CONTRIBUTING.md](CONTRIBUTING.md) for setup, testing, evidence and Replit conventions. Use [SECURITY.md](SECURITY.md) for private issue reporting and the current dependency-review boundary.
