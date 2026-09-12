# Current KinetiCAD status

Updated 12 September 2026. **Document Undo/Redo and canvas object selection**
are implemented on `codex/built-in-demo-gallery`, following the local four-bar
designer and revolute-picking correction. The current
[feature and browser record](HISTORY-AND-SELECTION.md) and
[combined test catalog](HISTORY-SELECTION-TEST-CATALOG.md) collect this stage's
completed local acceptance. Public release remains pending the
[dependency security review](DEPENDENCY-SECURITY-REVIEW.md) and Replit acceptance.
Earlier hinge and four-bar records retain their original source identities.
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
| Document history | Undo/Redo for committed document edits, grouped drags/imports and cascading deletion; bounded, session-local history | [History and selection](HISTORY-AND-SELECTION.md) |
| Canvas selection | Nearest visible native/imported or final Boolean shape, orange CAD-edge outline and empty-click clearing; derived results have no independent transform | [History and selection](HISTORY-AND-SELECTION.md) |
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

The final Undo/Redo and selection capture passed **382/382 tests across 54 files**,
with zero failures, cancellations or skips. The
[capture summary](evidence/history-selection/final/summary.json) confirms unchanged
source inputs and verified restoration of historical reports. The
[test catalog](HISTORY-SELECTION-TEST-CATALOG.md) lists the recorded cases.
Workspace typecheck and the full production build passed; the
[workspace log](evidence/history-selection/final-build.txt) and explicit
[landing build at its root route](evidence/history-selection/final-landing-build.txt)
are retained. The earlier Undo checkpoint
passed **369/369 tests**, with workspace typecheck and CAD production build,
as recorded in the [history guide](HISTORY-AND-SELECTION.md).

Actual production Chrome passed native canvas selection and orange outlines,
a complete movement-handle drag followed by Undo and keyboard Redo, full-precision
numeric editing, unchanged Save data after focus/blur, and keyboard input guards.
Hidden parts were not picked and camera orbit preserved selection. Boolean
selection showed read-only details, an explicit Edit action and no independent
gizmo; material Undo, editor isolation and demo/history boundaries also passed.
The [feature record](HISTORY-AND-SELECTION.md) separates these observations from
the earlier exact native/STEP Save/Load/refresh comparisons.

The preceding hinge checkpoint passed **351/351 tests across 51 files**, with
zero failures or skips, workspace typecheck and CAD production build. Its
[verification record](evidence/revolute-picking/verification.json) and
[full suite output](evidence/revolute-picking/suite.txt) remain historical. The
**348-test four-bar stage** passed a full workspace typecheck/build; its
[catalog](FOUR-BAR-TEST-CATALOG.md) and [record](four-bar-validation.json)
remain evidence for that stage. The earlier [298-test catalog](TEST-CATALOG.md) and numerical reports
also retain their original attribution and source identity. Standalone scenario
and clearance-pair counts are separate; do not add them to the test count.

Actual Chrome edge picking exposed a **54.08 mm** local-pivot error on the
translated partial arc. After correction, that error was **less than 1.31e-8 mm**;
a part rotated **37° about Z** also passed. The translated saved project passed
native Load and Play/Pause/Resume/Reset. The rotated project passed native Load
and full refresh; saving again produced an assembly exactly equal to the
original corrected download, including transforms and pivots.
The [revolute picking guide](REVOLUTE-PICKING-VERIFICATION.md)
records this scope. Existing incorrectly saved joints need to be picked again;
there is no automatic migration.

The final local capture used Node **25.4.0** and pnpm **10.28.2**. Replit's
committed configuration specifies Node **24**; repeat the suite in that actual
Replit runtime during handoff. The local run is not labelled as a Node 24 run.

[Mathematics and physics](MATHEMATICS-AND-PHYSICS.md) records equations, units,
reference methods, tolerances, observed errors and exclusions. Passing these
checks supports those stated cases and models. It is not a mathematical proof
for arbitrary CAD geometry, every possible operating condition or a manufactured
machine's strength and safety.

| Acceptance layer | Status |
| --- | --- |
| Automated tests | 382/382 passed across 54 files; zero failures, cancellations or skips; source inputs unchanged and historical-report restoration verified. |
| Production build | Workspace typecheck and full production build passed; the explicit root-route landing build also passed. |
| Codex computer use | Scoped history/import restoration, native/Boolean selection, drag history, numeric precision and editor/demo isolation passed; earlier four-bar and hinge observations remain separately attributed. |
| Final Boolean file reopening | **Passed:** actual saved Fixed-joint file reopened through Chrome's native chooser on port 5190; properties, Play/Pause/Reset and another refresh passed |
| Dependency security | 58 advisory records remain unresolved; see the security review. Passing functional tests does not establish a security-clean release. |
| Publication preparation | Local feature acceptance is complete for the recorded scope; security decisions, owner review and public-route acceptance remain pending. |
| Replit republish/public route | Pending; local results do not establish that the public app contains these changes |

The earlier file-dialog limitation was resolved after file-URL access was enabled.
The actual saved project restored two bodies, its Fixed joint, the grounded brass
result, 2,000 mm³ and 0.017 kg. See the [browser capture](evidence/boolean-reopen/browser.json)
and [Boolean follow-up](BOOLEAN-SIMULATION-VERIFICATION.md#native-file-reopening-follow-up--12-september-2026).
This closes that recorded UI check without enlarging its physical-model scope.

The online dependency audit returned **58 advisory records** (56 unique GHSA IDs),
including development/generation tooling and scaffold paths with differing
exposure. Packages remain unchanged. The [security review](DEPENDENCY-SECURITY-REVIEW.md)
records applicability and remaining decisions; these findings are not 58
demonstrated exploits, and this source is not described as security-clean.

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

Undo/Redo and object selection follow those earlier checkpoints; the current
work is publication preparation. Future modelling and engineering extensions
need their own agreed scope and evidence. Replit import/run/publication instructions are in
[Replit handoff](REPLIT-HANDOFF.md). An optional donation link awaits Andrew's
chosen provider and destination; the application remains free.
