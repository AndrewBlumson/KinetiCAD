# Current KinetiCAD status

Updated 12 September 2026. The bounded **local draw-a-path four-bar designer**
is implemented and checked on `codex/built-in-demo-gallery`. The current
[acceptance record](four-bar-validation.json) identifies source hashes and the
parent commit `9a73c52`; the earlier implementation baseline was `8e954ab`.
Check report fingerprints before reusing results after source changes.

## Replit project and attribution

KinetiCAD was created by Andrew Blumson, co-built with Kevin Blumson, during
the Replit 10 Buildathon in May 2026 using Replit and Replit Agent. It remains
a Replit-built application, with the existing Replit project as the intended
publishing destination. The project is MIT licensed and intended to remain free.
The repository was temporarily made private during unfinished development;
returning it to public visibility is a separate owner decision.

The September improvements include development, numerical regression checks
and actual Chrome computer-use checks performed by Codex under Andrew's
direction. This credits later work without changing the original build's
Replit provenance. Original May evidence remains attributed to its historical
record; it is not relabelled as Codex testing.

## What is in this source

| Area | Available now | Details |
| --- | --- | --- |
| Desktop CAD | Native sketches, solid features, assemblies, transforms, materials, supported joints and STEP/STL exchange | [README](../README.md) |
| Editable dimensions | Numeric circle, rectangle, line and arc editing; validated rebuilds before commit | [Sketch dimensions](SKETCH-DIMENSIONS-VERIFICATION.md) |
| Complete projects | Save/Load with embedded STEP assets; current/previous local recovery copies | [Recovery contract](PROJECT-RECOVERY.md) |
| Examples | Six editable gallery demos plus a separate adjustable crank-slider workspace | [Crank-slider](CRANK-SLIDER-VERIFICATION.md), [demo physics](PHYSICS-VERIFICATION.md) |
| Stewart platform | Bounded six-axis targets with six actuator constraints and measured deck pose | [Workspace audit](STEWART-WORKSPACE-AUDIT.md) |
| Local path designer | Cancellable four-bar search, sampled fit gaps, native solid preflight, editable assembly and actual solver trace | [Four-bar verification](FOUR-BAR-PATH-VERIFICATION.md) |
| Finished Boolean simulation | Connected union, cut and intersection results use their final mesh/mass, uniform material, explicit ground and revision-checked joints | [Boolean verification](BOOLEAN-SIMULATION-VERIFICATION.md) |
| Engineering experiments | Separate finite-force actuator and cuboid-contact worlds; analytical rectangular cantilever calculation | [Capabilities and limits](simulator-capability-audit.md) |
| Usability/profile | Labelled file controls, enlarged visual grid, creator/social links and Replit UK Ambassador biography | [Creator/access record](CREATOR-PROFILE-AND-DESKTOP-ACCESS.md) |
| Device support | Desktop WebGPU CAD; phone/tablet startup blocked, public information pages remain readable | [Desktop access](CREATOR-PROFILE-AND-DESKTOP-ACCESS.md) |

The grid is a visual reference, 600 × 600 mm with 10 mm squares. It is not a
contact floor or a physical constraint. In the Modeller, select a part for
Position/Rotation controls; select one of its sketches for **Edit dimensions**.

## Verification and open acceptance

The current complete aggregate passed **348/348 tests across 51 files**, zero
failures or skips, and the full workspace typecheck/build passed. Each test is
listed in the [current catalog](FOUR-BAR-TEST-CATALOG.md), with raw events and
source fingerprints in [four-bar-validation.json](four-bar-validation.json).
The previous [298-test catalog](TEST-CATALOG.md) and historical measurement
reports retain their original attribution and source identity. Scenario and
clearance-pair counts in standalone reports are separate; do not add them to
the test count.

The fresh local capture used Node **25.4.0** and pnpm **10.28.2**. Replit's
committed configuration specifies Node **24**; repeat the suite in that actual
Replit runtime during handoff. The local run is not labelled as a Node 24 run.

[Mathematics and physics](MATHEMATICS-AND-PHYSICS.md) records equations, units,
reference methods, tolerances, observed errors and exclusions. Passing these
checks supports those stated cases and models. It is not a mathematical proof
for arbitrary CAD geometry, every possible operating condition or a manufactured
machine's strength and safety.

| Acceptance layer | Status |
| --- | --- |
| Automated tests | 348 passing cases across 51 files, individually catalogued |
| Production build | Full workspace typecheck and production builds passed at the recorded source hashes |
| Codex computer use | Actual Chrome checks include four-bar search/cancel/build, Save/Load/refresh, measured motion and reference invalidation; each report names its scope |
| Final Boolean file reopening | **Passed:** actual saved Fixed-joint file reopened through Chrome's native chooser on port 5190; properties, Play/Pause/Reset and another refresh passed |
| User review | Stage 4 is ready for the user to test before another stage begins |
| Replit republish/public route | Pending; local results do not establish that the public app contains these changes |

The earlier file-dialog limitation was resolved after file-URL access was enabled.
The actual saved project restored two bodies, its Fixed joint, the grounded brass
result, 2,000 mm³ and 0.017 kg. See the [browser capture](evidence/boolean-reopen/browser.json)
and [Boolean follow-up](BOOLEAN-SIMULATION-VERIFICATION.md#native-file-reopening-follow-up--12-september-2026).
This closes that recorded UI check without enlarging its physical-model scope.

## What comes later

The [next-stage checklist](NEXT-IMPLEMENTATION-TODO.md) is the active work queue.
The [known-issues review](KNOWN-ISSUES-AND-FOLLOW-UP.md) reconciles older notes
with current implementation and evidence. It schedules investigation; this
documentation pass does not implement those deferred changes.

Still outside ordinary CAD assembly simulation: part-to-part contact, bearing
friction, motor torque/force limits and structural deformation. The separate
engineering experiments do not enable those behaviours in a user's assembly.
The bounded draw-a-path four-bar optimiser is implemented and locally verified
as stage 4. The current public route has not been republished. No paid AI API is
required for the browser geometry, physics or local search.

Continue one stage at a time, record its evidence, and stop for Andrew's review
before moving on. Replit import/run/publication instructions are in
[Replit handoff](REPLIT-HANDOFF.md). An optional donation link awaits Andrew's
chosen provider and destination; the application remains free.
