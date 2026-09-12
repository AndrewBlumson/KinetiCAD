# Replit handoff

Release preparation: **382/382 automated tests across 54 files**, full workspace typecheck/build and scoped Chrome history/selection checks passed. See [verification](HISTORY-AND-SELECTION.md) and [dependency security review](DEPENDENCY-SECURITY-REVIEW.md). The pinned dependencies have **58 advisory records**; a security-update decision, distribution-notice checks and Replit/public-route acceptance remain open. Local functionality passing is not a security clearance.

Use the existing KinetiCAD Replit project so its domain, secrets and publishing
settings stay attached to the same app.

KinetiCAD remains the Replit-built application created by Andrew and Kevin
Blumson using Replit Agent. Subsequent Codex development and automated/Chrome
computer-use testing are credited in the evidence records; they do not change
the original build's Replit identity. See [Current status](CURRENT-STATUS.md).

The prior completed baseline is `8e954ab` on
`codex/built-in-demo-gallery`: **298 automated tests passed**, along with the full
workspace typecheck/build. It includes six demos, complete STEP project
recovery, bounded six-axis Stewart controls, the three separate Engineering
tests, adjustable crank-slider, persistent sketch dimensions and direct
connected-Boolean simulation. Creator/social details, Replit UK Ambassador
biography, labelled file controls and desktop-only CAD access are included.
The subsequent bounded **Draw a path** four-bar stage passed **348/348 tests
across 51 files** and a full workspace typecheck/build. Its
[catalog](FOUR-BAR-TEST-CATALOG.md) and [record](four-bar-validation.json) retain
that historical scope, distinct from the preserved 298-test baseline.

The latest local release evidence is in the [current test catalog](HISTORY-SELECTION-TEST-CATALOG.md),
[history/selection verification](HISTORY-AND-SELECTION.md) and
[public-release checklist](PUBLIC-RELEASE-CHECKLIST.md). Undo's checkpoint passed
369/369 tests before selection work. Earlier 298/348/351-test records preserve
their own results; use the final combined source fingerprints for this handoff.

The [baseline test catalog](TEST-CATALOG.md) details that automated run;
[maths and physics](MATHEMATICS-AND-PHYSICS.md) connects equations, units,
references, tolerances and measured errors. [Browser evidence](README.md#actual-browser-checks-recorded-by-stage)
is recorded by stage. The Boolean fixed-joint download has now passed actual
native Load, Play/Pause/Reset and browser refresh, preserving its material,
ground and joint: [record](evidence/boolean-reopen/browser.json). Other joint
fixtures retain their separately recorded scope. Four-bar
[Chrome checks](evidence/four-bar/browser.json) passed preset search/build,
native Save/Load/refresh, saved-target restoration, Pause/Resume/Reset and
reference invalidation after a manual material edit. Valid custom paths were
entered through the keyboard editor. Closed freehand pointer drawing has seven
component-handler tests; a successful curved mouse gesture was not replayed in
Chrome. The subsequent Undo/selection/documentation sequence is authorised;
publication remains a separate final step. See the [four-bar guide](FOUR-BAR-PATH-VERIFICATION.md).
Do not treat an earlier 166/195/237/298/348-test milestone as the current rerun.

The [revolute picking guide](REVOLUTE-PICKING-VERIFICATION.md) records actual
Chrome translated-arc pivot error reduced from **54.08 mm** to
**less than 1.31e-8 mm**, plus a **37° Z-rotated** case. The translated saved
project passed native Load and Play/Pause/Resume/Reset; the rotated saved file
passed Load and full refresh, then Save produced an assembly exactly equal to
the original corrected download, including transforms and pivots. Existing
incorrectly saved joints must be picked again; there is no automatic migration.

1. Save outstanding Replit edits, then fetch the GitHub repository and check
   out `codex/built-in-demo-gallery` in Replit's Git interface. Review differences
   before replacing local changes. Confirm the intended final revision exists
   on the remote; a local working-tree change is not fetched by Git.
2. Run `pnpm install --frozen-lockfile`, then the verification commands in
   [Physics verification](PHYSICS-VERIFICATION.md). Node 24 is specified in
   `.replit`. Run heavyweight OCCT tests sequentially. The aggregate entry is
   `pnpm --filter @workspace/kineticad test:all`.
   The fresh local inventory used Node 25.4.0/pnpm 10.28.2, so record this Replit
   runtime's own result rather than calling that local capture a Node 24 pass.
   Keep the committed package/kernel versions; this stage needs no dependency
   upgrade or paid service credentials.
3. Build with the existing deployment configuration. CAD Vite requires `PORT`
   and `BASE_PATH`; its route is `/app/`. For a local production check:

   ```sh
   PORT=5184 BASE_PATH=/app pnpm run build
   PORT=5184 BASE_PATH=/app node artifacts/kineticad/serve.mjs
   ```

4. Open a top-level WebGPU-capable desktop Chrome page. Verify phone/tablet CAD
   startup remains blocked while public information pages remain readable.
   Exercise all six demo cards,
   editable features, Play/Pause/Reset, speed changes, and Return to my model.
   Observe real motion and read actual worker measurements. Keep the Windmill
   criterion at π ±5e-7 rad/s after five simulated seconds.
5. For Material force lab, compare 0.5/1 mN acceleration and travel and verify
   its two-second hold. For Stewart, run X/Y/Z, roll/pitch/yaw, combined and
   Home presets. Inspect the deck/rods and actual target/error/joint readouts
   during the default four-second move and two-second settling period.
   Saved validated configurations retain their own bounded durations.
6. In Engineering tests, run Hold/Lift/Overload, then resting, frictionless and
   sliding contact with timestep refinement. The 2 kg, 1000 mm/s, μ=0.25 slide
   stops at about 199.788 mm at 120 Hz and 201.846 mm at 240 Hz, against an
   analytical 203.874 mm. Its visible integration bounds are ±4.667/2.583 mm.
   Verify the elastic-beam reference and load/dimension scaling and invalid-range
   warnings. Check pause/reset, completion and tab switching.
7. Import STEP, add/edit native and imported features, Save project, refresh,
   reload the downloaded project and recover a previous copy. Reject a malformed
   file without losing the prior project. Open/edit/save a demo, return and refresh;
   the original imported geometry must survive. Check STEP/STL exports of both
   mixed native/imported geometry and assembly booleans with hidden inputs.
   Inspect all labelled file buttons and their hover/keyboard tooltips.
8. Exercise the separate Crank-slider workspace: dimensions, signed/zero RPM,
   measured/reference plots and Save/Load. Edit a native sketch's numeric dimensions,
   test a rejected change, then reopen the project. Create a connected Boolean,
   choose its final material/fixed base and attach supported joints to its result.
   Run it without duplicate input bodies; edit its geometry and verify stale
   joints are rejected. Repeat the completed local fixed-joint native Load
   check on the intended Replit origin; local evidence does not prove that route.
9. In **Draw a path**, inspect the initial 60 mm known-reference loop, change its
   40–160 mm width, try the ellipse and a valid custom loop, and reject crossed
   or unapplied input. Test search progress/cancellation and inspect the sampled
   RMS/maximum gaps before **Build editable model**. Confirm four native parts
   and four joints, actual tracer motion for one six-second turn, pause/reset,
   saved design reopening and original-project restoration. Reopening an existing
   design must preserve its target coordinates and seed. Editing its physical
   assembly must invalidate the generated reference. Follow the
   [four-bar acceptance scope](FOUR-BAR-PATH-VERIFICATION.md); handler tests do
   not establish browser freehand drawing acceptance.
10. Test Undo/Redo before and after a native edit, transform drag, cascade delete
   and multi-part STEP import. Reopen a saved Undo-restored project and refresh;
   geometry/assets must survive, while history starts afresh. Test new-edit Redo
   branching and that focused text fields keep their own shortcuts. Click native,
   imported and Boolean solids, confirm orange outlines and nearest visible hits,
   and verify camera/gizmo drags do not select objects. Edit a Boolean explicitly;
   its derived geometry must not gain an independent transform.
11. Check the current landing feature groups, creator/social links, Replit UK
   Ambassador wording and labelled file controls. Preserve the Replit build credit.
12. Record the final source/bundle identifiers and browser acceptance matrix.
    Republish from Replit, then repeat the unchanged Windmill gate and relevant
    user flows at the public URL. Local passes do not establish deployment acceptance.

Stewart uses inverse kinematics to command six actuator lengths within ±5 mm
per translation axis and ±2° per rotation axis. The physics solver determines
the deck pose through ideal joints. It has no finite drive force, external load
or gravity in this example. The separate motor/load bench applies real capped
forces, and the contact bench enables contact only for its guided cuboid setup.
Neither enables finite-force Stewart, general CAD collisions or bearing friction.
Connected assembly Boolean results now simulate directly from the final OCCT
solid. The result requires a uniform material and appropriate ground/joint
choices; consumed inputs never become extra simulation bodies. Empty/disconnected
results, shared inputs and stale/ambiguous attachments fail explicitly.
See [Boolean verification](BOOLEAN-SIMULATION-VERIFICATION.md).
The beam tab is an analytical cantilever calculation, not general FEA or CAD
mesh deformation. The path designer searches a bounded planar four-bar family
locally, then builds native parts only after an explicit accepted result. Its
sampled complete-loop gaps measure shape agreement, not user-drawn timing or a
guaranteed optimum. The one-turn programme uses zero gravity and an ideal input
motor; it does not add bearing contact, finite motor capacity or general machine
design. Geometry and these calculations remain in the browser without an AI API.

Save project downloads a complete editable document with embedded imported STEP
assets. IndexedDB retains current and previous local recovery copies; browser
storage is origin/device-specific and an unfinished autosave can be lost on an
abrupt close. Older JSON files that never contained imported geometry require
the original STEP. See [Project recovery](PROJECT-RECOVERY.md). Demo edits are
isolated from the original autosave; Load project is disabled inside a demo
until Return to my model. STEP is solid geometry exchange and STL is a mesh;
use the project file to retain editable KinetiCAD history.

If importing a ZIP, use a separate project first and deliberately carry over the
intended publishing configuration. Source archives omit secrets, dependencies,
build output and the original Replit project's domain attachment.


The current [developer handover](../HANDOVER.md) and
[known-issues register](KNOWN-ISSUES-AND-FOLLOW-UP.md) replace older incomplete
lists as continuation guidance. Investigate those items in later bounded stages;
do not implement them as an incidental part of importing or republishing.
Historical numerical JSON files retain their measured source/date. New runs
should retain new provenance rather than overwrite old evidence as if it were
fresh. This applies equally to tests run by Replit Agent, Codex or a human.
This document is a handoff recipe, not authorization to publish; no deployment
or dependency changes are included in the current stage.

## Source-publication preparation

Follow the [release checklist](PUBLIC-RELEASE-CHECKLIST.md) and retain the project's
MIT licence, [third-party notices](../THIRD-PARTY-NOTICES.md), Replit configuration,
lockfile and evidence. The merge hook installs dependencies only; a Git merge
no longer triggers database changes. Do not include local environment files,
credentials, `.git`, dependencies or build output in a source archive.

For a portable fresh evidence run, use
`node scripts/src/capture-test-suite.mjs --output-dir <new-directory>`. It preserves
the two historical reports overwritten by tests and records every test name,
source, duration and result. Use the pinned configured Node 24 runtime in Replit;
local Node 25 results are not a Node 24 pass. Final publication must still verify
the existing Replit project's actual branch/build/domain settings.
