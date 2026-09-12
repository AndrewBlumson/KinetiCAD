# Replit handoff

Use the existing KinetiCAD Replit project so its domain, secrets and publishing
settings stay attached to the same app.

The current branch also includes the subsequent adjustable **Crank-slider**
workbench. Its [separate verification record](CRANK-SLIDER-VERIFICATION.md) and
[Chrome checks](CRANK-SLIDER-CHROME-2026-09-12.md) describe the new stage.
Stop for the user's testing before starting another roadmap item or publishing.

The preceding release baseline includes six editable demos, complete native/imported STEP
project recovery, bounded six-axis Stewart control and three **Engineering tests**
tabs: **Motor & load**, **Friction & contact** and **Elastic beam**. Its recorded
serialized aggregate passed 166/166 cases with zero failures in 101.047 seconds,
including committed assembly STEP/STL exports and pause-clock regressions.
The full workspace build and final production bundle passed. The
[Chrome acceptance matrix](CHROME-ACCEPTANCE-2026-09-12.md) records actual UI
checks, final input/point-picking repairs and measured downloads.
The older 79-case and Chrome results apply only to their recorded revisions;
no local result establishes final publication approval.
See [Physics verification](PHYSICS-VERIFICATION.md) for report scope and gates.

1. Save outstanding Replit edits, then fetch the GitHub repository and check
   out `codex/built-in-demo-gallery` in Replit's Git interface. Review differences
   before replacing local changes. Confirm the intended final revision exists
   on the remote; a local working-tree change is not fetched by Git.
2. Run `pnpm install --frozen-lockfile`, then the verification commands in
   [Physics verification](PHYSICS-VERIFICATION.md). Node 24 is specified in
   `.replit`. Run heavyweight OCCT tests sequentially. The aggregate entry is
   `pnpm --filter @workspace/kineticad test:all`.
3. Build with the existing deployment configuration. CAD Vite requires `PORT`
   and `BASE_PATH`; its route is `/app/`. For a local production check:

   ```sh
   PORT=5184 BASE_PATH=/app pnpm run build
   PORT=5184 BASE_PATH=/app node artifacts/kineticad/serve.mjs
   ```

4. Open a top-level WebGPU-capable Chrome page. Exercise all six demo cards,
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
8. Record the final source/bundle identifiers and browser acceptance matrix.
   Republish from Replit, then repeat the unchanged Windmill gate and relevant
   user flows at the public URL. Local passes do not establish deployment acceptance.

Stewart uses inverse kinematics to command six actuator lengths within ±5 mm
per translation axis and ±2° per rotation axis. The physics solver determines
the deck pose through ideal joints. It has no finite drive force, external load
or gravity in this example. The separate motor/load bench applies real capped
forces, and the contact bench enables contact only for its guided cuboid setup.
Neither enables finite-force Stewart, general CAD collisions or bearing friction.
Assembly-level Boolean results are blocked from simulation; export their final
STEP solids, re-import and assign materials/joints. Per-part feature cuts remain
supported. This avoids simulating the original uncut Boolean inputs.
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
