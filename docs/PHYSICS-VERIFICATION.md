# KinetiCAD physics verification

This build retains the original windmill regression gate and adds numerical
checks of the CAD-to-physics pipeline. A moving picture or a successful build
does not establish physical accuracy. Results apply to the tested cases and
the model assumptions below; they are not a claim that every possible CAD
assembly has been validated.

## Current source and verification status — 12 September 2026

The current source includes Undo/Redo, visible-solid object selection, local draw-a-path four-bar synthesis, complete projects, six demos, bounded
six-axis Stewart control, the separate engineering experiments, adjustable
crank-slider, persistent sketch dimensions and direct connected-Boolean
simulation. KinetiCAD remains the original Replit/Replit Agent build by Andrew
and Kevin Blumson; later development and the recorded September numerical and
Chrome computer-use checks were performed by Codex under Andrew's direction.

Read [Current status](CURRENT-STATUS.md), the [complete current test catalog](SECURITY-MAINTENANCE-TEST-CATALOG.md)
and [mathematics/physics reference](MATHEMATICS-AND-PHYSICS.md) first. The latter
connects equations, units, expected values, observed errors and tolerances to
source tests and raw reports. It separates actual-kernel measurements, pure
analytical checks, mocked orchestration tests and rendered browser observations.

| Gate | Recorded status and scope |
| --- | --- |
| Current automated aggregate | **402/402 cases across 57 files in 80.936 seconds on Node 24 ARM64**, with 527 source inputs unchanged; [release aggregate](evidence/security-maintenance/release/summary.json), [individual test catalog](SECURITY-MAINTENANCE-TEST-CATALOG.md). This includes the earlier stages; do not add their totals. |
| Current typecheck/build | Workspace checks and the final landing [typecheck](evidence/security-maintenance/story-typecheck.txt)/[build](evidence/security-maintenance/story-build.txt) passed; [maintenance record](SECURITY-MAINTENANCE-2026-09-12.md). Older milestones retain their original source identity. |
| Undo/Redo and object selection | Document/source restoration and actual-mesh raycasting, with guarded drag/input transactions; [scope and Chrome checks](HISTORY-AND-SELECTION.md). These are editing correctness checks, not additional load or contact models. |
| Local four-bar path | Native four-part mechanism, local bounded search, sampled fit gaps and actual solver trace; [maths, geometry and Chrome evidence](FOUR-BAR-PATH-VERIFICATION.md). |
| Direct Boolean physics | Actual final OCCT shape/mass and Rapier response, transformed/imported inputs, explicit ground and revision-checked joints; [verification](BOOLEAN-SIMULATION-VERIFICATION.md), [measurements](boolean-physics-results.json). |
| Persistent sketch dimensions | Independent primitive equations, actual OCCT rebuilds and transaction/recovery checks; [stage record](SKETCH-DIMENSIONS-VERIFICATION.md). |
| Adjustable crank-slider | 16 recorded actual-CAD motion scenarios and 864 sampled pair intersections; [errors and limits](CRANK-SLIDER-VERIFICATION.md). These scenario counts are not extra unit tests. |
| Six-demo CAD/physics snapshots | 50 valid B-reps and 49 joints; [geometry](demo-geometry-results.json), [physics](demo-physics-results.json). Retain their measured source identities. |
| Materials/Stewart snapshots | [Equal-force](material-force-results.json), [material clearance](material-clearance-results.json), [16 six-axis runs](stewart-controller-results.json), [910 exact workspace pairs](stewart-workspace-results.json), [original lift](stewart-physics-results.json). Historical run provenance is separate from the current aggregate. |
| Separate engineering models | [Finite-force actuator](actuator-bench-results.json), [guided contact](contact-bench-results.json), [analytical beam](beam-analysis-results.json). Their scoped regression tests pass in the aggregate. |
| Complete projects and exports | [Recovery contract](PROJECT-RECOVERY.md), [export contract](ASSEMBLY-EXPORT.md), [Boolean-stage export run](boolean-simulation-export-results.json). |
| Actual Chrome acceptance | Latest [scoped local checks](evidence/security-maintenance/browser.json): imported material Undo/Redo, saved recovery followed by refresh, native reopening of a downloaded project, support-link and landing navigation, and Windmill Play/Pause/Reset. Earlier observations remain linked by stage in [the docs index](README.md#actual-browser-checks-recorded-by-stage); no claim that every path was reclicked on one final bundle. |
| Latest Boolean downloaded-file reopening | **Passed for the saved Fixed-joint file.** Native Chrome chooser, two bodies, brass fixed result, Play/Pause/Reset and refresh are in [the follow-up capture](evidence/boolean-reopen/browser.json). |
| GitHub source / republished Replit route | Verify the remote commit for the GitHub source handoff. Replit installation and publication remain pending; local measurements do not establish public deployment acceptance. |

The latest browser Windmill run reached 24.77 simulated seconds, paused and reset
to zero; it exercised controls rather than independently remeasuring the angular
speed gate. Captured warning/error logs were empty for those recorded checks.
The [35 local HTTP checks](evidence/security-maintenance/http-smoke.json) and
[zero-finding release dependency audit](evidence/security-maintenance/audit-release.json)
are separate engineering/security evidence, not additional physical experiments.
The HTTP record retains the landing bundle identity from before the final
legal/Story text changes; the later build and browser record cover that update.

The earlier 166-, 195-, 237- and 298-test milestones remain dated evidence, not the
latest aggregate. Original source hashes and browser bundle identities are
preserved; a later documentation update does not make an older measurement a
fresh run. [Report provenance](REPORT-PROVENANCE.md) explains those boundaries.

The recorded six-demo CAD report contains 48 single solids and two unchanged
legacy compounds; all 35 bodies in the four added demos are single solids.
The original Windmill gate remains **30 RPM = π rad/s ±5e-7 after five simulated
seconds**. The recorded worker regression error is **8.7422783e-8 rad/s**;
no later bench tolerance replaces that motor criterion.

The detailed experiment sections below retain their recorded measurements.
Consult each report's source identity before applying a number to future code.

### Six-axis Stewart: ideal actuator control

The controller accepts deck translations up to ±5 mm on each axis and intrinsic
XYZ rotations up to ±2° on each axis. Presets cover X, Y, Z, roll, pitch, yaw,
home and a combined movement. Default presets use a four-second quintic move
and two-second settling period to produce six actuator-length/velocity targets.
Saved validated configurations can use other bounded durations. The platform is
a dynamic body connected through 12 spherical and six prismatic joints; the
controller never assigns a deck transform. Readouts use actual solver poses.

Requested trajectories are checked against −12 through +20 mm stroke relative
to home, 8 mm/s command speed, 8° relative bearing deflection and normalized
Jacobian condition 100. Speed, bearing and condition bounds are planning guards;
the Rapier prismatic joints also enforce the stroke interval. No contact/impact
or finite motor-strength model is implied. The controller rejects altered
reference topology/frames and invalid
or excessive trajectories. These checks are specific to the bundled mechanism.
Gravity and external loads are off; its velocity servos have no finite force
rating. The separate actuator bench does not make Stewart load-rated.

The [actual-CAD controller report](stewart-controller-results.json) independently
reconstructs motion in 16 scenarios. Fifteen check every fixed solver step;
the irregular render-partition scenario checks returned batch endpoints and
requires identical final transforms to its every-step reference.

| Quantity | Largest measured error | Acceptance limit |
| --- | ---: | ---: |
| Position during motion | 0.004891 mm | 0.1 mm |
| Orientation during motion | 0.000966° | 0.05° |
| Final position | 0.000569 mm | 0.05 mm |
| Final orientation | 0.000900° | 0.05° |
| Spherical joint closure | 0.00004781 mm | 0.1 mm |
| Slider lateral error | 0.00003748 mm | 0.1 mm |

The independent [workspace audit](STEWART-WORKSPACE-AUDIT.md) encloses the full
pose box and all 64 extreme target paths plus eight presets. Conservative
bounds retain at least 8.6387 mm between leg-enclosing capsules, 1.9163 mm
neck/plate clearance and 18.5573 mm rod insertion, with bearing deflection
below 7.9985° and normalized condition below 87.928. Ordinary floating-point
bounds with margins are not a formal directed-rounding interval proof.

Exact OCCT intersections cover all 91 body pairs at ten selected poses,
including four actual controller final poses: **910 pairs, zero overlap**
within the 0.00001 mm³ gate. Those exact samples supplement the conservative
geometry bounds; they do not constitute continuous contact-force simulation.
Edited CAD, uncontrolled dynamic overshoot, bearing retention, deformation,
manufacturing tolerances and payload ratings remain outside this evidence.

### Motor and load bench

This independent Rapier world has a guided vertical payload and a passive
prismatic joint. It applies a capped force in newtons and the equal-and-opposite
reaction at a common world point on the base. Multiplication by 1,000 converts
newtons to the kg·mm/s² world. The guide has no ideal velocity motor. An
independent Newton reference integrates the applied force schedule, and a
free-base run checks momentum conservation.

The [measured runs](actuator-bench-results.json) hold 1 kg at 300 mm with
9.81 N and lift it to 379.986816 mm against a 380 mm target. A 2 kg payload
with a 16 N limit weighs 19.62 N and falls: at 120 Hz its half-second drop is
226.368401 mm, against 226.25 mm analytically. The position error decreases
from 0.118401 mm at 120 Hz to 0.057251 mm at 240 Hz. Force-inference error
stays below 0.0004 N; the declared lift target error is 0.02 mm, overload
position error 0.2 mm and overload velocity error 0.05 mm/s.

A travel boundary ends the experiment before a possible crossing and retains
the measured state. It is not an impact or hard-stop model. The bench omits
bearing friction, electrical drive behaviour, transmission losses, structural
deformation and arbitrary CAD mechanisms. CAD joint torque/force fields are
still not enforced actuator limits.

### Friction and contact bench

The separate world contains an exact 100 × 60 × 40 mm cuboid and a fixed
cuboid floor. Rotation and lateral Y motion are guided; X translation and
vertical support remain dynamic. Both colliders use the explicitly selected
single friction coefficient, average combination and zero restitution.
The coefficients are experiment inputs, not measured material properties.

Normal/friction forces come from actual Rapier manifold impulses, converted
by the fixed-step duration and unit scale. Independent momentum differences
calibrate them. Force readouts are means over the latest fixed step. A resting
unforced block has zero expected tangential force; μN is a sliding capacity.
The continuous-contact reference is disabled in the drop/impact diagnostic.

For 2 kg, initial speed 1000 mm/s and μ=0.25, the analytical stopping distance
is 203.8736 mm. Measured stopping distances are 195.7567, 199.7884 and
201.8457 mm at 60, 120 and 240 Hz. This visible integration error decreases
with timestep. The positional allowance is **v₀dt/2 + 0.5 mm**: 4.6667 mm
at the UI's default 120 Hz and 2.5833 mm at 240 Hz. The results are not
replaced with the analytical trajectory.

The [contact report](contact-bench-results.json) checks eight cases. Supported
penetration stays below 0.025 mm; the 20 mm drop has under 0.045 mm penetration
against a 0.1 mm gate. Contact/momentum force mismatch is below 0.0002 N in
these runs, inside the stated 0.0005 N base gate. Support is 19.6200 N for 2 kg;
friction removes the initial 1 J horizontal kinetic energy, and passive step
energy does not increase beyond its 1e-7 J allowance. Full equations, velocity
bounds and omitted effects are in [Contact bench](CONTACT-BENCH.md).

This does not enable CAD assembly collisions. A whole-part convex hull would
fill holes and bores. General moving concave contact needs a separately
validated compound/decomposition representation before being exposed.

### Elastic beam calculation

The **Elastic beam** tab is an independent Euler–Bernoulli calculation for a
uniform rectangular cantilever, rigidly clamped at one end with a transverse
tip load. It accepts an eligible native rectangle/extrude part or explicitly
entered benchmark dimensions. Imported STEP and modified/Boolean parts are
not approximated by their bounding box. Young's modulus and elastic limit
must be supplied explicitly; material density does not infer them.

The 300 × 20 × 10 mm reference with 10 N and E=200 GPa gives tip deflection
0.27 mm, maximum stress 9 MPa, slope 0.00135 rad, clamp reaction −10 N and
moment −3 N·m. Seven tests cover the equations, boundary conditions, signed
and dimensional scaling, invalid inputs and CAD eligibility. The accepted
range requires L/max(b,h)≥10, |tip deflection|/L≤0.02 and stress within the
supplied elastic limit. Failing a check marks the equation outputs outside
the model's accepted range. See [Elastic beam](ELASTIC-BEAM.md).

This is not general FEA and does not deform the CAD mesh. Shear deformation,
plasticity, buckling, fatigue, self-weight and stress concentrations are omitted.

### Complete projects and export evidence

Project format 1 wraps state version 9 and embeds imported STEP assets,
checksums and stable body associations alongside editable native history,
materials, transforms, booleans and mates. Imported shapes rebuild before
state becomes visible. Current/previous IndexedDB snapshots provide local
recovery; failed files or writes retain the prior complete copies. Demo edits
remain isolated. See [Project recovery](PROJECT-RECOVERY.md) for migration,
corruption checks, origin/device limits and the unfinished-save window.

Actual shipped-worker tests restore a mixed project after destroying the
original OCCT worker, then check topology, volume, centre of mass and downstream
Hole regeneration. The shared transform helper uses T·Rx·Ry·Rz consistently
with rendered intrinsic XYZ transforms. [Browser export measurements](browser-export-results.json)
cover the identified native/imported benchmark's downloaded STEP/STL files;
that report explicitly excludes assembly-level booleans. The separate
[assembly-export report](assembly-export-results.json) passes seven actual-worker
cases for committed visible output, hidden operands, ordered subtraction,
multiple results, disconnected compounds and isolated raw imported assets.
STEP volume/centroid gates are 1e-5 mm³/1e-5 mm; planar-fixture STL gates are
1e-5 relative volume and 1e-4 mm centroid. These mesh tolerances do not apply
to arbitrary curved surfaces. [Assembly export](ASSEMBLY-EXPORT.md) explains
that Hide inputs off retains overlapping originals alongside results. Final
Boolean-export browser acceptance is recorded separately.

### Material force lab: recorded numerical evidence

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

### Original Stewart symmetric-lift regression

The retained baseline programme extends all six telescopic actuators at 2 mm/s
for six seconds. This is a separate regression from the current six-axis UI.
The platform is a dynamic body closed through 12 spherical joints and six
prismatic drives; the simulation assigns no prescribed deck pose.
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
This baseline programme validates symmetric heave only. The bounded six-axis
controller and workspace evidence are recorded separately above.

## CAD assembly physical model

- Length: millimetres; time: seconds; mass: kilograms. Standard gravity is
  `[0, 0, -9810]` mm/s² in the Z-up world.
- Homogeneous, rigid solids. OpenCascade integrates volume, centre of mass
  and the complete centroidal inertia tensor. Material density scales both
  mass and inertia. The principal-axis orientation is passed to Rapier.
- Ideal joint constraints and velocity-controlled motors, including Stewart.
  General CAD collision contact, bearing friction, finite motor force/torque,
  deformation and fracture are not modelled. Separate Engineering tests use
  the scoped models above. A driven gimbal is not a passive gyroscopic-precession
  validation case.
- The material experiment additionally applies real constant centre-of-mass
  forces to unpowered guides. Stored motor force/torque fields are still not
  enforced load limits. The two concepts must remain distinct.
- Fixed simulation increments; display frame timing controls the number of
  increments requested, not their duration. The clock counts time actually
  advanced by the solver. Pause and model changes invalidate stale responses.
- Connected assembly Boolean results simulate directly using the final OCCT
  mesh and integrated mass properties. Construction inputs are excluded regardless
  of their Modeller visibility. Each result has a homogeneous finished material,
  an explicit fixed/free choice and new result-level joint attachments. Empty or
  disconnected results, ambiguous input grounding, stale attachments and shared
  inputs between physical results fail explicitly. See [Boolean verification](BOOLEAN-SIMULATION-VERIFICATION.md).
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
OpenCascade suites one at a time on a memory-constrained computer. The standalone
verifiers below write tracked numerical JSON. Run them in an isolated checkout
or preserve original report bytes, archive fresh output as a new dated run and
restore the original files. The aggregate can also emit reports; this audit
retained its fresh output separately. [Report provenance](REPORT-PROVENANCE.md)
defines that preservation workflow.

```sh
node scripts/src/generate-demo-library.mjs --check
pnpm --filter @workspace/kineticad typecheck
pnpm --filter @workspace/kineticad test:all
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
| Stewart baseline | Leg-length-derived symmetric heave and independently reconstructed closed-joint residuals |
| Stewart six-axis | Independent target/actual poses, closure, actuator travel, exact rotation interpolation and timing partitions |
| Stewart workspace | Conservative pose/path bounds and sampled exact intersections of actual solids |
| Motor/load bench | F=m(a+g), equal/opposite reaction, free-base momentum, work/energy and overload convergence |
| Contact bench | Coulomb slide/stop, support mg, measured impulse versus momentum, passive energy and penetration |
| Elastic beam | Cantilever closed-form curve/stress, boundary conditions and dimensional/load scaling |
| Complete project | Fresh-worker STEP restoration, native/imported edits and failed/corrupt recovery handling |
| Stewart clearance | Every B-rep pair at initial and measured final poses; endpoint scope only |
| Trimmed arcs and turned profiles | Actual OCCT endpoints, intermediate points, analytical volumes/centroids and valid connected revolved solids |

The tests contain their tolerances and measured results. The geometry sweep
is a deterministic sampled regression, not an exhaustive proof for all
possible joint angles or user edits.

## Earlier six-demo milestone — 11 September 2026

The prior gallery/force/heave revision passed **79 cases** across nine suites:
demos 6, mass/inertia 8, worker 17, force/measurement 9, runner 9, overlays 5,
regeneration 13, Stewart geometry 5 and actual-OCCT arcs/profiles 7. Its
production build and browser results below are historical, not final acceptance
of complete persistence, six-axis control or the Engineering tests panel.

The turning-profile fix gave trimmed arcs explicit OCCT UV frames in XY, XZ
and YZ; XZ uses U=+X, V=+Z and normal=−Y. Seven actual-OCCT regressions checked
arc points, sector volumes/centroids, revolved spheres and connected Stewart
barrel/rod profiles. Full-circle and extrude directions were unchanged.

### Earlier six-demo Chrome evidence — 11 September 2026

The post-arc-fix production route at `http://localhost:5184/app/` used
`Scene-C4W79P0P.js`, `cadWorker-vhcso9P8.js` and
`physicsWorker-CaLcPm-G.js`. Chrome displayed six cards in two full rows and
all five file-button tooltips were reachable by keyboard focus. At 1470 × 685,
all eight force readouts fit. Full and half-force runs plus pause/resume were
first checked on the intermediate `Scene-B0o527pg.js` bundle with the identical
physics worker; the half-force two-second completion and eight-row fit were
repeated on the final bundle. The [recorded Chrome evidence](force-stewart-browser-results.json)
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
5. Import `artifacts/kineticad/tests/fixtures/recovery-block.step`, add a native
   part and a downstream imported-part feature, save the complete project and
   refresh. Verify geometry/history/transforms, reload the downloaded file,
   recover a previous copy, reject a malformed file without loss, and export
   STEP/STL. Separately exercise assembly booleans with hidden inputs, since
   the earlier browser-export benchmark did not contain them.
6. Enter a demo, edit it, save it, return to the original and refresh. Confirm
   the original recovery copy and imported geometry survive; check disabled
   Load inside a demo and the file controls' keyboard/hover tooltips.
7. Run Material force lab with both forces; compare measured acceleration and
   distance, lanes, pause/resume, the two-second hold and Run again.
8. Run Stewart X/Y/Z, roll/pitch/yaw, combined and Home presets; inspect actual
   rods and deck movement alongside measured target/error, joint closure and
   actuator readings. Exercise pause, reset, completion and changed controls.
9. In Engineering tests, run motor Hold/Lift/Overload, then resting,
   frictionless and sliding contact at 120/240 Hz. Compare measured forces,
   stopping distances and the displayed integration bounds. Check pause/reset
   and tab switching. Verify the beam reference, load/section scaling and
   visible out-of-range warnings, including an eligible native CAD part.
10. Exercise the adjustable crank-slider controls and reference readouts, numeric
    sketch edits including rejected changes, and direct Boolean result materials,
    grounding, joint picking and stale-attachment rejection. Reopen a newly saved
    Boolean result-joint project through the native Load dialog; this is the
    remaining latest-stage manual gate.
11. Record exact source/bundle identities and this browser matrix. Repeat the
    unchanged motor gate and relevant flows at the republished public URL.
    Local numerical or browser evidence does not establish deployment acceptance.
