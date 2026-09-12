# Replit handoff

Use the existing KinetiCAD Replit project so its domain, secrets and publishing
settings stay attached to the same app.

KinetiCAD remains the Replit-built application created by Andrew and Kevin
Blumson using Replit Agent. Subsequent Codex development and automated/Chrome
computer-use testing are credited in the evidence records; they do not change
the original build's Replit identity. See [Current status](CURRENT-STATUS.md).

The current implementation baseline is `8e954ab` on
`codex/built-in-demo-gallery`: **298 automated tests pass**, along with the full
workspace typecheck/build. It includes six demos, complete STEP project
recovery, bounded six-axis Stewart controls, the three separate Engineering
tests, adjustable crank-slider, persistent sketch dimensions and direct
connected-Boolean simulation. Creator/social details, Replit UK Ambassador
biography, labelled file controls and desktop-only CAD access are included.

The [complete test catalog](TEST-CATALOG.md) details every automated test;
[maths and physics](MATHEMATICS-AND-PHYSICS.md) connects equations, units,
references, tolerances and measured errors. [Browser evidence](README.md#actual-browser-checks-recorded-by-stage)
is recorded by stage. The newly downloaded Boolean result-joint native Load
check remains pending; its Save, parser validation and refresh/new-tab recovery
checks passed. Finish that gate and Andrew's review before publication.
Do not mistake earlier 166/195/237-test milestones for the latest total.

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
   joints are rejected. Reopen the newly downloaded Boolean result-joint file
   through the actual native Load dialog: this is the remaining latest-stage gate.
9. Check the current landing feature groups, creator/social links, Replit UK
   Ambassador wording and labelled file controls. Preserve the Replit build credit.
10. Record the final source/bundle identifiers and browser acceptance matrix.
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
mesh deformation. No AI API or draw-a-path mechanism optimiser is included.
Geometry and these calculations remain in the browser.

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
