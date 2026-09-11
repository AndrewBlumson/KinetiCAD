# Physics verification for the demo gallery

This build retains the original windmill regression gate and adds numerical
checks of the CAD-to-physics pipeline. A moving picture or a successful build
does not establish physical accuracy. Results apply to the tested cases and
the model assumptions below; they are not a claim that every possible CAD
assembly has been validated.

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
- Fixed simulation increments; display frame timing controls the number of
  increments requested, not their duration. The clock counts time actually
  advanced by the solver. Pause and model changes invalidate stale responses.
- Unsupported planar joints and incompatible initial joint frames fail the
  world build. They must not be silently omitted from a running simulation.

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
pnpm --filter @workspace/kineticad run test:runner
pnpm --filter @workspace/kineticad run test:overlays
pnpm --filter @workspace/kineticad run test:regen
node --import ./scripts/node_modules/tsx/dist/loader.mjs scripts/src/verify-demo-geometry.mjs --export-descriptors
node artifacts/kineticad/tests/verify-demo-physics.mjs /tmp/kineticad-demo-descriptors.json
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

The tests contain their tolerances and measured results. The geometry sweep
is a deterministic sampled regression, not an exhaustive proof for all
possible joint angles or user edits.

## Local numerical evidence — 11 September 2026

The installed OpenCascade/Rapier mass suite passed all eight cases. For the
20 × 30 × 40 mm aluminium cuboid, the analytical mass is 0.0648 kg and the
principal moments are 7.02, 10.8 and 13.5 kg·mm². Tests compare the calculated
tensor with analytical values to a relative tolerance of 1e-9 (absolute floor
1e-9); the actual Rapier angular-impulse response uses a 3e-6 tolerance.

[Geometry results](demo-geometry-results.json) record the fixture SHA-256 hashes
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

[Actual-demo physics results](demo-physics-results.json) rebuild and test all
five fixtures with their real CAD meshes and exact mass tensors. Each runs
for 15 simulated seconds; motor velocities are sampled from 5–15 seconds and
anchor separation is checked every configured step. Fixture and worker hashes
bind the evidence to the tested source.

| Actual CAD assembly | Maximum motor-speed error (rad/s) | Maximum joint-anchor separation (mm) |
| --- | ---: | ---: |
| Windmill | 0.000000087423 | 0.000000002544 |
| Orrery | 0.011321 | 0.00016812 |
| Driven gimbal | 0.00024935 | 0.00000360 |
| Kinetic mobile | 0.00048099 | 0.070949 |

The original windmill magnitude gate remains **5e-7 rad/s**. Other driven
assemblies use explicit limits of 0.02 rad/s motor error, 0.03 rad/s forbidden
relative angular velocity and 0.1 mm anchor separation. Material studio has
no motors and passes its fixed-pose drift checks. These are numerical
acceptance tolerances, not a promise of exact real-world behaviour.

The initial four-iteration solver failed the orrery and mobile checks.
Sixteen iterations still failed the mobile's 0.1 mm anchor limit. The selected
32 iterations pass without changing those limits, timestep or motor targets.
The report records worker/Comlink step timings; those exclude CAD generation
and browser rendering and are not a browser frame-rate measurement.

The six test suites contain **56 passing cases** in total: five demo-document
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

## Browser and publication gate

### Final build

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

### Controls and file workflow

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
6. Repeat the motor gate and the relevant rendered flows at the republished
   public URL. Local verification does not establish deployment acceptance.

The pre-existing limitation remains: imported STEP geometry does not survive
a page refresh. The gallery avoids refreshing; it does not add STEP persistence.
