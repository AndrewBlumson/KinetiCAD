# Current KinetiCAD status

Updated 12 September 2026. Implementation baseline: `8e954ab` on
`codex/built-in-demo-gallery`. This documentation refresh changes no application
behaviour. Check the checkout and report fingerprints before reusing results
after future code changes.

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
| Finished Boolean simulation | Connected union, cut and intersection results use their final mesh/mass, uniform material, explicit ground and revision-checked joints | [Boolean verification](BOOLEAN-SIMULATION-VERIFICATION.md) |
| Engineering experiments | Separate finite-force actuator and cuboid-contact worlds; analytical rectangular cantilever calculation | [Capabilities and limits](simulator-capability-audit.md) |
| Usability/profile | Labelled file controls, enlarged visual grid, creator/social links and Replit UK Ambassador biography | [Creator/access record](CREATOR-PROFILE-AND-DESKTOP-ACCESS.md) |
| Device support | Desktop WebGPU CAD; phone/tablet startup blocked, public information pages remain readable | [Desktop access](CREATOR-PROFILE-AND-DESKTOP-ACCESS.md) |

The grid is a visual reference, 600 × 600 mm with 10 mm squares. It is not a
contact floor or a physical constraint. In the Modeller, select a part for
Position/Rotation controls; select one of its sketches for **Edit dimensions**.

## Verification and open acceptance

The implementation-stage aggregate passed **298/298 tests**, zero failures or
skips, and the full workspace typecheck/build passed. The detailed implementation
record is [boolean-simulation-validation.json](boolean-simulation-validation.json).
The documentation audit reruns those same tests and lists each actual result in
[the complete test catalog](TEST-CATALOG.md) and
[its raw inventory](test-inventory-results.json). Scenario and clearance-pair
counts in standalone reports are separate; do not add them to the test count.

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
| Automated tests | 298 passing cases, individually catalogued; actual kernels and mocked orchestration are identified separately |
| Production build | Passed at the implementation baseline; this refresh edits documentation only |
| Codex computer use | Actual Chrome checks recorded across the baseline, crank-slider, sketch-dimension and Boolean stages; each report names its scope |
| Final Boolean file reopening | **Pending:** reopening a newly downloaded result-joint project through the native Load dialog; actual downloads, shipped parser checks and browser refresh/new-tab recovery passed |
| User review | Pending for the latest Boolean stage |
| Replit republish/public route | Pending; local results do not establish that the public app contains these changes |

The final file-dialog check was interrupted while Chrome was in use and the
extension could not select local files. This is an uncompleted UI acceptance
step, not evidence of a failed project loader. See the exact observations in
[Boolean verification](BOOLEAN-SIMULATION-VERIFICATION.md).

## What comes later

The [next-stage checklist](NEXT-IMPLEMENTATION-TODO.md) is the active work queue.
The [known-issues review](KNOWN-ISSUES-AND-FOLLOW-UP.md) reconciles older notes
with current implementation and evidence. It schedules investigation; this
documentation pass does not implement those deferred changes.

Still outside ordinary CAD assembly simulation: part-to-part contact, bearing
friction, motor torque/force limits and structural deformation. The separate
engineering experiments do not enable those behaviours in a user's assembly.
The draw-a-path mechanism optimiser is also not implemented. No paid AI API is
required for the existing browser geometry and physics calculations.

Continue one stage at a time, record its evidence, and stop for Andrew's review
before moving on. Replit import/run/publication instructions are in
[Replit handoff](REPLIT-HANDOFF.md). An optional donation link awaits Andrew's
chosen provider and destination; the application remains free.
