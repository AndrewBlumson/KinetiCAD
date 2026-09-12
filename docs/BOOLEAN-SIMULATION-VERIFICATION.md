# Direct assembly Boolean simulation

12 September 2026. Development branch: `codex/built-in-demo-gallery`.

A committed union, subtraction or intersection containing one connected solid
can run directly in the simulator. The CAD worker calculates its mesh, volume,
centre of mass and principal inertia from the same final OpenCascade shape.
The result geometry is in world coordinates and its rigid-body starting transform
is identity, so input transforms are applied once. There is no STEP export/import
workaround in the simulation path.

## Physical interpretation

- Construction inputs are excluded from the physical world whether `hideInputs`
  is true or false. Unrelated visible parts retain their own bodies.
- Each result has one uniform material. A subtraction can inherit its retained
  body's material. A union/intersection can inherit a material shared by every
  input; otherwise the user must choose the finished material explicitly.
- The Boolean editor's **Fix result to world** checkbox sets the result as the
  assembly's fixed base. Applying an unchecked result clears a consumed input
  anchor. Loading an old project with an ambiguous input anchor displays guidance
  rather than silently choosing a base.
- Result faces/edges are available in supported joint creation workflows. Fixed
  joints can select a result from the tree. Results are separately identified by
  `boolean:<feature ID>`; native input attachments are never automatically remapped.
- Geometry revisions are recorded at the actual attachment pick, retained through
  Save/Load and recovery, and checked both at Apply and before simulation. Changing
  a joint's name or motor setting cannot renew an obsolete attachment.
- Empty results, disconnected solids, shared inputs between physical results,
  missing/ambiguous materials and stale/missing joint attachments block simulation.
  Disconnected output is not welded into a fictitious single body.

## Numerical evidence

The actual OpenCascade and Rapier tests are in
[`boolean-physics.test.mjs`](../artifacts/kineticad/tests/boolean-physics.test.mjs).
Raw measurements, tolerances and source hashes are in
[`boolean-physics-results.json`](boolean-physics-results.json).

The reference cuboids use independently calculated volumes, centroids and
`I = m/12 × diag(b²+c², a²+c², a²+b²)`. Off-centre cuts use volume subtraction
and the parallel-axis theorem. Mixed Euler rotation and translation are checked
against transformed centroids and `R I Rᵀ`, including off-diagonal tensor entries.
Mesh bounds and signed mesh volume are independently inspected.

| Check | Result / acceptance |
| --- | --- |
| Union, cut, overlap and off-centre cut, identity and mixed transformed frames | 8 exact-shape cases; volume tolerance 0.000001 mm³, centroid tolerance 0.000001 mm, tensor tolerance 0.0000001 kg·mm² |
| Imported STEP source plus transformed native cutter | 24,000 mm³ source → 23,040 mm³ result; source geometry, topology and mass properties remain unchanged |
| Fine transform change | 0.00001 mm changes invalidate the final geometry; old four-decimal rounding was removed |
| Freefall | Actual velocity after 1 s is −9810.0009766 mm/s; expected −9810 mm/s; tolerance 0.5 mm/s |
| Equal applied force | Largest relative acceleration error 0.01167%; tolerance 0.02% |
| Grounding / destroy / rebuild | Fixed output remains fixed; rebuilding restores the original geometry and pose |
| Passive hinge / pendulum | Angular error reduces from 0.00031194 rad at 240 Hz to 0.00015509 rad at 480 Hz; joint closure error ≤0.00001925 mm |
| Empty or disconnected results | Rejected; a later valid operation succeeds; display metadata distinguishes connected and disconnected solids |

These are numerical validation cases for a declared ideal rigid-body model,
not a certification of every possible assembly or real manufactured mechanism.
CAD contact, bearing friction, finite motor loads and deformation remain outside
this stage. Existing revolute/prismatic frame restrictions and the rejection of
legacy planar mates remain in force.

## Integration regression coverage

- Worker-scoped Boolean cache, shared pending requests, retries and explicit cache
  generation invalidation; display cache cannot substitute for physical properties.
- The exact mesh/property snapshot is sent to physics; queued source edits fail
  safely, and live geometry edits tear down the old world. Motor-only changes
  still use the existing motor-update path.
- Simulation hides both modelling layers and owns/disposes its generated Boolean
  render buffers. Pause/reset retains/restores the original CAD state.
- Result material, fixed-base IDs and joint revisions survive project parsing.
- Actual Zustand store tests reject stale picks and stale saved joint edits, and
  verify cascade deletion of dependent result joints without deleting unrelated ones.
- Real Three.js raycasts check transformed native and world-baked result picking,
  face UVs, result topology readiness, compound exclusion and pick-time revisions.
- The original five Hole-picker tests remain unchanged and pass after adapting
  the new optional Boolean layer handling to all picker consumers.

## Chrome checks on the actual application

Isolated production preview: `http://localhost:5188/app/` and `/app/simulator`.
The dev server on port 5184 remains available. User work on other preview origins
was not overwritten.

1. Loaded the existing subtraction project using **Load project** and a native
   file dialog. Its old consumed-input ground anchor correctly disabled Play
   with an explanation.
2. Selected brass and **Fix result to world** in the Boolean editor. Downloaded
   the project, inspected the actual file, refreshed the browser and verified
   recovery retained the shape, material and result ground ID.
3. Ran the subtraction directly: one body, no input duplicates, 2,000 mm³,
   0.017 kg, COM (5, 10, 5) mm and principal moments
   (0.283333, 0.708333, 0.708333) kg·mm². Visually inspected the final brass solid.
4. Tested pause, resume, reset and mode switching. Reset restores 0 s and the
   original CAD shape. Chrome logs confirm the real worker built one body.
5. Made an unrelated cube visible and created a Fixed joint by selecting the
   Boolean result and cube in the tree. Downloaded that complete project and
   inspected its actual saved result attachment revision. The solver built
   two bodies and one joint under gravity.
6. Changed subtraction to union. Play was blocked because the old joint was
   stale; opening that joint and pressing Apply also rejected the old attachment.
   Deleted the obsolete test joint and ran the 6,000 mm³ union, mass 0.051 kg,
   COM (15, 10, 5) mm; visually confirmed its longer solid.
7. Changed to intersection, selected inherited steel and made construction inputs
   visible in the Modeller. Simulation still built only the one final solid:
   2,000 mm³ and 0.01574 kg. Visually confirmed only the overlap is simulated.
8. Released the result from the world. At 0.25× playback, observed it fall under
   gravity, pause at 0.03 s, continue to 0.08 s and return to its original position
   on reset. No construction-input duplicates or stationary result ghost remained.
9. Created a Spherical joint by clicking a Boolean face and then an attachment
   point, followed by a native cube face and point. The actual downloaded project
   contains both picked pivots and the Boolean geometry revision. Refresh restored
   the joint and both endpoint names. Checked the clarified two-click instructions
   and the absence of a false fixed-base badge in the free Boolean assembly.
10. Parsed all three actual browser-downloaded fixtures through the shipped
    project loader and simulation planner: respectively one body/no joints,
    two bodies/one Fixed joint and two bodies/one Spherical joint. This automated
    file check is distinct from reopening the downloaded file through Chrome's
    native file dialog, which was pending at this earlier check and has since
    passed in the follow-up below.
11. Inspected the updated landing-page feature card at port 5186 in Chrome.
    The description fits the desktop layout and distinguishes direct Boolean
    simulation from the still unsupported contact/friction/load features.
12. Reopened the final-build preview in a new Chrome tab and recovered the whole
    result-joint project. Created an empty native part in the free Boolean
    assembly; its inspector correctly offered **Set as ground** instead of
    silently fixing it. Removed that disposable empty part through the UI.

Chrome's captured console contains no warnings or errors for these application
checks. The native DevTools window was not separately opened in this stage.
At that earlier session, the native file-dialog reopening check was incomplete:
browser automation could not set local files, and native actions were interrupted
while Chrome was in use. Refresh/recovery and actual downloaded-file parsing had
passed, but did not replace that UI check. The subsequent native-file follow-up
below closes the gate with its own dated browser evidence.

Downloaded browser fixtures are retained in
[`fixtures/boolean-simulation`](fixtures/boolean-simulation).
The 100 ms freefall fixture is a documented derivative of a downloaded project.

The completed stage's suite/build results and then-pending Chrome checks are recorded in
[`boolean-simulation-validation.json`](boolean-simulation-validation.json).
The fresh export regression measurements are retained separately in
[`boolean-simulation-export-results.json`](boolean-simulation-export-results.json);
earlier stage reports remain historical snapshots. The original JSON acceptance
record is retained unchanged; its pending file-check status is superseded only
by the separate follow-up evidence below.

## Native file reopening follow-up — 12 September 2026

The previously pending Chrome Load check passed on the isolated preview at
`http://localhost:5190/app/`. After the user enabled the browser extension's
file-URL permission, the actual file chooser reopened
`docs/fixtures/boolean-simulation/browser-fixed-joint.kineticad.json`.
The simulator showed two bodies, the saved fixed joint, the grounded brass
result, 2,000 mm³ and 0.017 kg. Play advanced time; pause held the run at
14.23 s; reset restored 0 s. A browser reload then recovered the same model
and properties. No warning or error was captured for this check.

See [browser observations and console records](evidence/boolean-reopen/browser.json)
and [the rendered restored model](evidence/boolean-reopen/after-load-and-refresh.png).
This closes the file-reopening gate; it does not expand the physical model.
The user has authorised the next, local four-bar path-design stage. That stage
is in progress; this Boolean report does not claim its new full-suite or browser
acceptance has passed.
