# Physics verification for the demo gallery

This build retains the original windmill regression gate and adds numerical
checks of the CAD-to-physics pipeline. A moving picture or a successful build
does not establish physical accuracy. Results apply to the tested cases and
the model assumptions below; they are not a claim that every possible CAD
assembly has been validated.

## Current six-demo extension: acceptance status

The current source replaces the static material display with Material force
lab and adds a 14-body, 18-joint Stewart platform. File actions also have
persistent labels and explanatory tooltips. Evidence for the earlier five-demo
production bundle is preserved below and is not fresh acceptance of these changes.

| Gate | Current status |
| --- | --- |
| Actual-CAD material force, timestep and scaling checks | Passed; [force results](material-force-results.json) |
| Material rails, samples and bounded travel clearance | Passed; [clearance results](material-clearance-results.json) |
| Current unit suites | Passed: 79 cases in serialized runs, including post-arc mass/regeneration reruns |
| Six-demo CAD validity and general physics report | Passed: 50 actual CAD bodies and 49 joints; [geometry](demo-geometry-results.json), [physics](demo-physics-results.json) |
| Stewart actual-CAD solver/closure/heave acceptance | Passed; [Stewart physics](stewart-physics-results.json) |
| Stewart initial/final exact B-rep clearance | Passed: 182 pairs, zero overlap; [Stewart clearance](stewart-clearance-results.json) |
| Current production build and Chrome force/Stewart/windmill checks | Passed; [current Chrome record](force-stewart-browser-results.json) records exact bundle scope |
| Republished public route | Pending |

All **79 cases** passed across nine suites: demos 6, mass/inertia 8, worker 17,
force/measurement 9, runner 9, overlays 5, regeneration 13, Stewart geometry 5
and actual-OCCT arcs/profiles 7. Mass and regeneration were rerun after the
arc fix; runner was rerun after the solver-pose readout was added. Heavy OCCT
suites ran sequentially. Full workspace typecheck and the production build pass.

The Stewart turning profiles exposed an XZ trimmed-arc UV-frame defect.
The correction supplies an explicit OCCT circle frame matching each sketch's
UV axes; XZ uses U=+X, V=+Z and normal=−Y. Seven actual-OCCT regressions cover
arc endpoints and intermediate points, sector volumes/centroids, sphere
revolutions in all three planes and valid connected Stewart barrel/rod
profiles with positive inertia. Full-circle and extrude directions are unchanged.

The six-demo geometry report contains 50 valid B-reps: 48 single solids and
two unchanged legacy compounds. All 35 bodies in the four new demos are single
solids. Its provenance identifies the unchanged five-fixture geometry checks
and the 14 Stewart solids rebuilt after the arc correction. The current
physics report uses the actual exported CAD meshes and exact mass tensors for
all six fixtures. The original windmill maximum error remains
**8.7422783e-8 rad/s**, below the unchanged ±5e-7 limit.

### Current local Chrome evidence

The post-arc-fix production route at `http://localhost:5184/app/` used
`Scene-C4W79P0P.js`, `cadWorker-vhcso9P8.js` and
`physicsWorker-CaLcPm-G.js`. Chrome displayed six cards in two full rows and
all five file-button tooltips were reachable by keyboard focus. At 1470 × 685,
all eight force readouts fit. Full and half-force runs plus pause/resume were
first checked on the intermediate `Scene-B0o527pg.js` bundle with the identical
physics worker; the half-force two-second completion and eight-row fit were
repeated on the final bundle. The [current Chrome record](force-stewart-browser-results.json)
preserves rounded readings, exact bundle scope and source hashes.

The actual Stewart assembly rendered all 14 solids without failed-part logs
and held at **6.00 s**. Its solver readout showed height **172.832 mm**, rise
**12.832 mm**, sideways drift **0.003 mm** and tilt **0.000°** at display
precision. Rounded zero tilt is not a claim of mathematically zero rotation.
Replay and Reset clear/restart the readings. The six live slider speeds at
completion were **2.005524, 2.002309, 2.000435, 2.003406, 1.998754 and
1.996598 mm/s**, against the commanded 2 mm/s. The readout uses the same
actual solver poses as the viewport, holds on Pause and clears on teardown.
It does not substitute the expected trajectory.

The final local windmill browser canary passes: **22 samples from five to 26
simulated seconds** measured **3.1415927410125732 rad/s**, with maximum
absolute error **8.7422791e-8 rad/s** against π. The original **±5e-7 rad/s**
acceptance limit is unchanged. Rotation was visibly observed. Public Replit
republish and verification at the public route remain outstanding.

### Material force lab: current numerical evidence

The eight samples have identical CAD meshes and volume
**10,050.283064729765 mm³**. Each receives 0.001 N along world +Y at its
centre of mass for two simulated seconds, with ideal unpowered prismatic
guides and zero gravity. Forces are converted from N to kg·mm/s² by multiplying
by 1,000. The independent prediction is `a = 1,000F/m`, `v = at`, and
`s = ½at²`, using the exported CAD mass.

The real-CAD script passes three runs: 0.001 N at 60 and 120 Hz, and 0.0005 N
at 60 Hz. Maximum whole-run `v/t` relative error over the returned steps is
**0.004769%** at 60 Hz and **0.009568%** at 120 Hz, below its stated 0.01%
limit. Maximum displacement error decreases from **0.05129 mm** to
**0.03356 mm** with the finer timestep; every sample's final displacement
error decreases and remains within the derived integration bound. Measured
lateral displacement/velocity and rotation drift are zero. Halving the force
halves measured velocity, with displacement ratios within 8.2e-7 of one-half.
The exact two-second completion, zero-duration pause and post-completion hold
checks pass. The UI's acceleration readout separately uses successive solver
velocity changes divided by actual elapsed time; its reducer has its own tests.

The [derivation and complete readings](MATERIAL-FORCE-VERIFICATION.md) state
the analytical error bound and the distinction between measurements and
predictions. This demonstrates inertia from density, not elasticity, strength,
friction or unequal acceleration in free fall.

Material clearance uses the actual OCCT solids: **72 pair intersections**,
covering every pair initially and at the measured two-second pose, have
**0 mm³** overlap. A conservative straight-Y travel envelope retains about
4 mm lateral rail clearance, 15.06 mm rail-end margin and 12 mm between sample
lanes. This interval argument relies on the measured absence of rotation and
off-axis movement plus the specified straight rails. It is a scoped geometric
check, not collision-force validation or a general assembly clearance tool.

### Stewart platform: measured closed-joint lift

The supplied programme extends all six telescopic actuators at 2 mm/s for six
seconds. The platform is a dynamic body closed through 12 spherical joints
and six prismatic drives; the simulation assigns no prescribed deck pose.
Its independent symmetric-heave reference follows from
initial anchor geometry:

```text
z(t) = z_base_anchor + sqrt((initial_leg_length + 2t)^2 - horizontal_span^2)
```

`test:stewart` covers fixture geometry, stroke constraints and the initial
six-by-six length Jacobian. The actual-CAD acceptance script separately checks
every-step spherical closure, slider travel and lateral error, reconstructed
leg length, deck heave, lateral drift and rotation, plus sampled drive speed
and the six-second cap. The actual run passes **360 steps over six seconds**
at 32 solver iterations. Its declared tolerances are 0.1 mm for position/closure
quantities, 0.002 rad deck rotation and 0.05 mm/s settled slider-speed error.

| Quantity | Maximum measured error |
| --- | ---: |
| Spherical anchor closure | 0.00003356 mm |
| Slider lateral error | 0.00003154 mm |
| Slider travel | 0.011267 mm |
| Reconstructed leg length | 0.011268 mm |
| Deck heave | 0.010287 mm |
| Deck sideways drift | 0.003391 mm |
| Deck rotation | 0.00003946 rad |
| Settled slider speed | 0.010986 mm/s |

Pose residuals are checked at every fixed step. Motor speeds are sampled
at the worker's one-second diagnostic cadence. Final deck Z is
**172.832474 mm**, versus **172.836621 mm** from the independent reference;
post-completion requests leave time and poses unchanged.

All 14 actual OCCT bodies are valid single solids. The separate clearance
script checks **182 exact B-rep pairs**, every pair initially and at the
measured six-second transforms, with **0 mm³** intersection volume. The final
pose includes solver residual translations and rotations. This establishes
endpoint noninterference only; it is not continuous collision detection.
The separate 61-pose analytic capsule test concerns intermediate leg spacing,
not all intermediate solid surfaces. Ideal bearings do not validate retention,
seals, friction, manufacturing tolerances or load ratings.
This programme is not arbitrary six-axis control, a payload rating or a
guarantee against singularities elsewhere in the workspace.

## Physical model

- Length: millimetres; time: seconds; mass: kilograms. Standard gravity is
  `[0, 0, -9810]` mm/s² in the Z-up world.
- Homogeneous, rigid solids. OpenCascade integrates volume, centre of mass
  and the complete centroidal inertia tensor. Material density scales both
  mass and inertia. The principal-axis orientation is passed to Rapier.
- Ideal joint constraints and velocity-controlled motors. Collision contact
  forces, bearing friction, motor torque limits, deformation and fracture
  are not modelled. A driven gimbal is not a passive gyroscopic-precession
  validation case.
- The material experiment additionally applies real constant centre-of-mass
  forces to unpowered guides. Stored motor force/torque fields are still not
  enforced load limits. The two concepts must remain distinct.
- Fixed simulation increments; display frame timing controls the number of
  increments requested, not their duration. The clock counts time actually
  advanced by the solver. Pause and model changes invalidate stale responses.
- Unsupported planar joints and incompatible initial joint frames fail the
  world build. They must not be silently omitted from a running simulation.
- Optional duration limits hold the final whole configured step; further
  requests after completion advance no time. Bundled experiment durations
  divide exactly into their configured steps.

The original seed documents are preserved exactly. Their orrery rates are
illustrative, not astronomical. Disconnected solids contained in one legacy
part are treated as one ideal rigid body, as in the original build; that is
not evidence of a manufacturable connection between those solids.

## Repeatable checks

Run from the repository root after `pnpm install --frozen-lockfile`. Run the
OpenCascade suites one at a time on a memory-constrained computer.

```sh
node scripts/src/generate-demo-library.mjs --check
pnpm --filter @workspace/kineticad run test:demos
pnpm --filter @workspace/kineticad run test:mass
pnpm --filter @workspace/kineticad run test:physics
pnpm --filter @workspace/kineticad run test:forces
pnpm --filter @workspace/kineticad run test:runner
pnpm --filter @workspace/kineticad run test:overlays
pnpm --filter @workspace/kineticad run test:regen
pnpm --filter @workspace/kineticad run test:stewart
pnpm --filter @workspace/kineticad run test:arcs
node --import ./scripts/node_modules/tsx/dist/loader.mjs scripts/src/verify-demo-geometry.mjs --export-descriptors
node artifacts/kineticad/tests/verify-demo-physics.mjs /tmp/kineticad-demo-descriptors.json
node artifacts/kineticad/tests/verify-material-force.mjs /tmp/kineticad-demo-descriptors.json
node artifacts/kineticad/tests/verify-stewart-physics.mjs /tmp/kineticad-demo-descriptors.json
node --import ./scripts/node_modules/tsx/dist/loader.mjs artifacts/kineticad/tests/verify-material-clearance.mjs
node --import ./scripts/node_modules/tsx/dist/loader.mjs artifacts/kineticad/tests/verify-stewart-clearance.mjs
PORT=5184 BASE_PATH=/app pnpm run build
```

| Check | Independent reference |
| --- | --- |
| Windmill motor | 30 RPM = π rad/s; unchanged maximum error ±5e-7 rad/s after settling |
| Free fall | Displacement ½gt², with stated integration tolerance |
| Physical pendulum | Period from inertia about the hinge and mass/COM lever arm |
| Cuboid inertia | m/12 times the sum of the other two squared side lengths |
| Cylinder and hollow ring | Analytical axial and transverse inertias |
| Rotated solids | Full tensor transformation and retained centroid under translation |
| Angular impulse | Rapier response compared with the inverse analytical inertia tensor |
| Material changes | Warm-cache and freshly calculated mass/inertia agree |
| Joint frames | Allowed poses remain aligned; unsupported frame combinations reject the world |
| Nested drives | Relative angular velocity along each live joint axis; world-space body speed alone is insufficient |
| Timing | Equivalent elapsed-time partitions produce the same fixed-step result |
| Display overlays | Stored anchors transformed into the actual rendered body pose; selection does not move anchors |
| Gimbal geometry | Valid connected solids and sampled B-rep intersection volumes |
| Equal-force materials | Actual CAD mass; F/m, at and ½at²; force scaling and timestep convergence |
| Material clearance | Exact initial/final B-rep intersections plus bounded straight-Y travel envelopes |
| Stewart platform | Leg-length-derived symmetric heave and independently reconstructed closed-joint residuals |
| Stewart clearance | Every B-rep pair at initial and measured final poses; endpoint scope only |
| Trimmed arcs and turned profiles | Actual OCCT endpoints, intermediate points, analytical volumes/centroids and valid connected revolved solids |

The tests contain their tolerances and measured results. The geometry sweep
is a deterministic sampled regression, not an exhaustive proof for all
possible joint angles or user edits.

## Earlier five-demo numerical evidence — 11 September 2026

This section records the earlier gallery revision, when Material studio was
static. Its counts, geometry totals and reports must not be read as acceptance
of the later force/Stewart extension. JSON reports may be regenerated for newer
fixtures; inspect their recorded hashes and case lists before citing them.

The installed OpenCascade/Rapier mass suite passed all eight cases. For the
20 × 30 × 40 mm aluminium cuboid, the analytical mass is 0.0648 kg and the
principal moments are 7.02, 10.8 and 13.5 kg·mm². Tests compare the calculated
tensor with analytical values to a relative tolerance of 1e-9 (absolute floor
1e-9); the actual Rapier angular-impulse response uses a 3e-6 tolerance.

The earlier [geometry report](demo-geometry-results.json) recorded fixture SHA-256 hashes
and measured volumes for all 36 parts. Every generated B-rep was valid. All
new-demo parts were single connected solids. The gimbal passed 96 pair checks
across 16 orientations with maximum intersection volume **0 mm³**, plus two
probes confirming that the cleared shaft regions contain no solid. The mobile
passed 28 pair checks at its initial pose, also with **0 mm³** overlap.

During development, these checks rejected a gimbal cut that reported success
but left 846.757745 mm³ of intersecting material. A wider trim cutter removed
the unintended stock; the central-void probes retain a regression for that
specific failure. This is why successful kernel calls alone are insufficient.

These numerical results are separate from the browser/publication gate below.

The worker and runner suites passed **25 cases**: 17 against the real Rapier
worker and eight covering asynchronous runner behaviour. These include free
fall, physical-pendulum period, joint frames, elapsed-time partitioning and
live motor release/reactivation. Zero or blank motor commands now remove the
drive while retaining the joint; they do not apply a brake. Missing bodies
referenced by a mate reject the whole world rather than dropping the joint.

The earlier [actual-demo physics run](demo-physics-results.json) tested all
five fixtures with real CAD meshes and exact mass tensors. Each ran
for 15 simulated seconds; motor velocities were sampled from 5–15 seconds and
anchor separation was checked every configured step. Fixture and worker hashes
bind each generated report to its tested source.

| Actual CAD assembly | Maximum motor-speed error (rad/s) | Maximum joint-anchor separation (mm) |
| --- | ---: | ---: |
| Windmill | 0.000000087423 | 0.000000002544 |
| Orrery | 0.011321 | 0.00016812 |
| Driven gimbal | 0.00024935 | 0.00000360 |
| Kinetic mobile | 0.00048099 | 0.070949 |

The original windmill magnitude gate remains **5e-7 rad/s**. Other driven
assemblies use explicit limits of 0.02 rad/s motor error, 0.03 rad/s forbidden
relative angular velocity and 0.1 mm anchor separation. At that revision,
Material studio had no motors and passed fixed-pose drift checks. These are numerical
acceptance tolerances, not a promise of exact real-world behaviour.

The initial four-iteration solver failed the orrery and mobile checks.
Sixteen iterations still failed the mobile's 0.1 mm anchor limit. The selected
32 iterations pass without changing those limits, timestep or motor targets.
The report records worker/Comlink step timings; those exclude CAD generation
and browser rendering and are not a browser frame-rate measurement.

At that revision, six test suites passed **56 cases** in total: five demo-document
and workspace tests, eight mass/inertia tests, 17 worker tests, eight runner
tests, five overlay tests and 13 CAD-regeneration tests. The last
suite protects a loading fix found in Chrome: repeated state updates and
scene mounts now share unfinished work for the same feature/worker/cache
generation. Failures can retry, and cache resets reject stale cache writes.
Display regeneration evaluates each complete feature chain once and produces
the mesh and unit-density mass data from the same final solid. Intermediate
meshes are generated only when requested by the diagnostic/preview path.
Full-history cache entries have a separate namespace so a preview cannot stand
in for successful evaluation of the complete history.

## Earlier five-demo browser evidence — 11 September 2026

These observations apply to the listed earlier production bundles. They do
not cover the new material experiment, Stewart platform or labelled file
controls. Current six-demo observations are recorded separately above.

### Earlier five-demo final build

Chrome exercised all five demos at `http://localhost:5184/app/` with the final
`Scene-BW8mnfhS.js`, `cadWorker-DuilWpZn.js` and
`physicsWorker-D4Fkel5t.js` bundles, including the complete-chain loading fix.
The actual viewport was inspected alongside the worker console measurements.

| Demo | Settled joint samples | Simulated interval | Maximum speed error (rad/s) | Maximum sampled anchor separation (mm) |
| --- | ---: | --- | ---: | ---: |
| Windmill | 5 | 5–9 s | 8.7422781e-8 | 3.1553225e-10 |
| Orrery | 204 across 12 joints | 5–21 s | 0.011320939 | 0.000117841 |
| Driven gimbal | 93 across 3 joints | 5–35 s | 0.000250466 | 2.3175385e-7 |
| Kinetic mobile | 112 across 7 joints | 5–20 s | 0.000480990 | 0.000304650 |

These are once-per-simulated-second console samples after settling, not
every-step maxima. The independent worker report above covers startup and
every-step anchor separation. Windmill's original magnitude error was
8.742278012618954e-8 rad/s, passing the unchanged 5e-7 limit. All other driven
cases pass the stated speed, off-axis and anchor limits.

The gimbal's shafts and bored bearing housings remained visibly connected at
different orientations. The mobile visibly changed its branching pose while
retaining its supports. Material studio displayed all eight samples on its
plinth and remained assembled through 31.93 simulated seconds. Eight material
mass logs had maximum relative requested-to-Rapier mass error
4.612089206854731e-8. Fixed-joint drift is measured in the independent worker
report; it is not part of the browser motor diagnostics.

[Final browser measurements](browser-physics-results.json) retain the exact
aggregates, intervals and bundle identifiers. The following earlier-build
checks additionally cover controls, rejected input and the complete file flow.

### Earlier controls and file workflow

Local production build: `PORT=5184 BASE_PATH=/app pnpm run build` passed on
11 September 2026. Chrome loaded `Scene-veCIWWmK.js` and
`physicsWorker-D4Fkel5t.js` at `http://127.0.0.1:5184/app/`.

The fresh Chrome windmill run yielded 69 settled console samples through
73 simulated seconds, including playback-speed changes. Maximum magnitude
error was **8.742279122841978e-8 rad/s**; maximum sampled anchor separation
was **1.7841420330210327e-9 mm**. Requested rotor mass 0.006838693312649631 kg
became 0.006838693283498287 kg in Rapier; its unequal inertia components were
retained. Pause held the displayed clock at 11.38 s across subsequent checks;
all four speed controls, reset to 0 s and a running mode change were exercised.

A negative Chrome test hid the grounded windmill body before Play. The app
remained stopped and visibly reported the missing geometry rather than
simulating a free rotor. These expected test errors are distinct from runtime
failures during valid runs.

The corrected gimbal was inspected at its starting pose and while running in
Chrome. Its opposed trunnions, shaft and bearing housings visibly connect the
rings; the unrelated finished-sketch rings are absent from Simulator. Across
159 settled samples covering all three motors through 57 simulated seconds,
maximum relative speed error was 0.000252308 rad/s, maximum sampled anchor
separation was 2.39685e-7 mm and maximum off-axis relative angular velocity
was 0.000862275 rad/s. These observations were recorded with
`Scene-CRr6TkTW.js` before the subsequent final-solid loading optimization.

The in-app browser exercised the complete file workflow: imported the supplied
reference STEP solid, opened Material studio, saved its nine-part/eight-mate
JSON, returned to the original solid, and downloaded STEP successfully. The
saved JSON was inspected and contained the current demo, not the original
import. The restored solid and all eight material samples were also inspected
in the rendered viewport. Chrome's automated file picker was unavailable;
this file-flow evidence is from the in-app browser.

The downloaded STEP was independently reopened in OpenCascade:
[round-trip results](step-roundtrip-results.json). It contains one root and
one valid solid, with volume 3717.256661176908 mm³ (analytical error
1.0459e-11 mm³) and 20 × 20 × 10 mm bounds within the kernel's tolerance.

## Current browser and publication acceptance checklist

Use the actual production build in Chrome with WebGPU. The embedded Replit
preview is not the final graphics acceptance environment.

1. Open **Demos → Windmill → Try simulation → Play**. Let it settle for at
   least five simulated seconds. Read `[physics-measurement]` in the Chrome
   console; the original `bodyBangvelMag` must remain within π ±5e-7 rad/s.
2. Compare `[mass-properties]` requested and actual Rapier mass/inertia.
   The log includes the principal frame; unequal principal moments must not
   collapse to one equivalent-sphere value.
3. Run the orrery, driven gimbal and kinetic mobile. Record each joint's
   relative speed, target, off-axis angular velocity and anchor separation.
   Inspect the rendered mechanism as well as the log.
4. Exercise pause/resume, all playback speeds, reset and demo switching.
   Confirm the clock and geometry correspond to the same simulation run.
5. Import `artifacts/kineticad/tests/fixtures/recovery-block.step`, explore
   demos, return to the imported model and export STEP successfully. Demo
   switching must retain its in-memory CAD solid without a page reload.
6. Run Material force lab with both force options. Compare the visible measured
   acceleration and distance with the independent report, confirm each sample
   remains in its lane, and exercise pause/resume, the two-second hold, reset
   and Run again. Verify the file controls' visible labels and hover/focus tooltips.
7. Run Stewart platform for its six-second window. Inspect the actual deck,
   telescopic rods and spherical connections. Compare measured slider speeds,
   closed-joint residuals and heave with the analytical reference; a moving
   picture alone does not pass this gate. Record current bundle identifiers.
8. Repeat the motor gate and the relevant rendered flows at the republished
   public URL. Local verification does not establish deployment acceptance.

The pre-existing limitation remains: imported STEP geometry does not survive
a page refresh. The gallery avoids refreshing; it does not add STEP persistence.
