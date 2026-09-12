# KinetiCAD implementation and verification

Started 12 September 2026. Working branch: `codex/built-in-demo-gallery`.
Baseline: `f85dfde` (79 passing tests, six validated demo fixtures).

## Working rules

- Keep the development server running at http://localhost:5184/app/.
- Complete each stage with numerical tests and actual browser interaction.
- Preserve the original windmill gate: 30 RPM = pi rad/s within 5e-7 after settling.
- Record model assumptions, units, tolerances and measured errors. Appearance alone is not evidence of physical correctness.
- Keep the original model safe when exploring demos or rejecting invalid files.
- Serialize memory-heavy OpenCascade checks. Keep each stage reviewable in Git.
- Replit publication and public-route acceptance follow the local work.

## 1. Development environment

- [x] Confirm the existing feature branch and clean baseline checkout.
- [x] Start Vite development server on port 5184.
- [x] Open the running app and check startup/worker errors.

## 2. Complete project saving and recovery

- [x] Persist imported STEP solids with stable references, alongside native feature history, transforms, materials and mates.
- [x] Make Save project produce a self-contained editable document.
- [x] Validate Load before replacing the current project; retain compatibility with native v8/v9 documents.
- [x] Restore imported solids after refresh or a new browser session.
- [x] Retain a last-good recovery snapshot and report storage/import failures clearly.
- [x] Preserve demo isolation and the original model across save/reload/recovery paths.
- [x] Test native/imported/mixed assemblies, missing/corrupt data and round-trip geometry/mass.
- [x] Verify real Import STEP -> Save -> refresh -> Load -> edit/simulate/export in Chrome.
- [x] Update tooltips/documentation to reflect the completed behavior.

## 3. Six-axis Stewart controls

- [x] Derive six actuator lengths from a requested deck position and orientation.
- [x] Move the deck through physical actuator constraints with smooth fixed-step control.
- [x] Enforce a documented reachable workspace, leg travel and movement-rate limits.
- [x] Provide plain-language controls and presets for translation, tilt, twist and combined movement.
- [x] Display requested versus measured pose and actuator travel; preserve pause/reset behavior.
- [x] Verify all six axes, combined motion, invalid commands and timing independence numerically.
- [x] Verify geometry clearance throughout the supplied motion programme and state the limits of the check.
- [x] Test the real model and controls in Chrome, plus the unchanged windmill canary.

## 4. Motor strength and load behavior

- [x] Define an actuator force model with explicit strength/rate limits and correct units.
- [x] Implement capped physical forces without using an unlimited servo as evidence of lifting capacity.
- [x] Add a controllable payload/load experiment and live measured force/motion readings.
- [x] Validate force balance, acceleration, stall/hold behavior and conservation/reaction forces with independent references.
- [x] Test the supplied loaded mechanism in Chrome and document supported assumptions.

## 5. Friction and contact

- [x] Establish exact collision geometry for the first supported case: a guided cuboid and flat floor. Keep arbitrary CAD collisions disabled so holes and clearances are not replaced with filled convex proxies.
- [x] Define an explicit Coulomb contact coefficient for the cuboid bench. Bearing friction remains unsupported and is labelled as such.
- [x] Add bounded contact/friction behavior with independent sliding, resting and contact tests.
- [x] Check energy loss, penetration and timestep convergence in the separate contact bench. Do not apply the unvalidated general-contact model to the coupled Stewart demo.
- [x] Verify the rendered contact behavior and preserve earlier ideal-model comparisons.

## 6. Deformation (separate structural-analysis stage)

- [x] Specify a physically meaningful first case, required elastic material properties, boundary conditions and accuracy target.
- [x] Select a mesh-free Euler–Bernoulli cantilever calculation for a slender uniform rectangle/extrude or explicit benchmark; exclude modified/imported shapes and general FEA.
- [x] Implement only a scoped deformation model that can be independently validated; do not substitute an animated bend for a structural calculation.
- [x] Record clearly what is implemented and what remains future general-purpose analysis.

## 7. Handoff

- [x] Run relevant final regression suites and production build.
- [x] Finish recording browser evidence separately from numerical/unit evidence.
- [x] Finalize README, verification reports and Replit handoff after the last browser repair.
- [x] Commit/push completed stages and refresh the source ZIP.
- [x] Leave the app running on the completed result.

## Execution notes

- Initial port binding was restricted by the sandbox. The requested Vite server was then started successfully with the approved execution permission.
- This checklist tracks implementation and evidence; an unchecked item is not a delivered capability.
- Chrome startup passed with the CAD worker self-test. A stable production preview on port 5185 runs alongside development on 5184 so hot reload cannot interrupt acceptance measurements.
- Six-axis actual-CAD tests: 16 accepted runs, maximum final position error 0.000568945 mm and orientation error 0.000899051 degrees. Independent source-solid guards, saved configuration and measurement lifecycle tests pass; runner suite now has 12 passing cases.
- Chrome production preview: combined motion completed at 6.00 seconds, all six requested and actual pose values agree to displayed precision; individual leg travel readings are shown. All six individual axes, combined and typed negative custom poses have since passed in Chrome; details are in the browser report.

## Current acceptance and scope

- The complete serial suite passed **166/166 tests**, zero failures, in 101.047 seconds. The full workspace typecheck/build also passed. The final UI-only Boolean guard wording was rebuilt and checked in Chrome; solver behavior did not change after the suite. Source, bundle and log fingerprints are recorded in release-validation.json.
- Actual Chrome downloads now pass exact OCCT checks for mixed STEP/native edits and committed union/subtract/intersect results; hidden geometry is absent. Binary STL geometry was independently measured.
- The separate motor/load, contact/friction and beam experiments all passed their reference and control checks in Chrome. No AI API is used.
- Chrome's original Windmill measured 3.1415927410125732 rad/s at 30 RPM, retaining the original pi +/- 5e-7 gate.
- The first implementation stages for load, contact and deformation are deliberately bounded and independently testable. Finite-force Stewart control, arbitrary CAD contact, bearing friction and general 3D deformation are future capabilities, **not delivered claims**. The app and README state this.
- Native modeller browser checks have additionally exercised new part, rectangle sketch, extrusion, real edge picking for fillet/chamfer, Boolean editing, and export preview gating. Hole creation was repaired and repeated successfully on native and mixed-axis rotated parts.
- Current detailed browser evidence: [Chrome acceptance](CHROME-ACCEPTANCE-2026-09-12.md). Publication from Replit and final public-route acceptance remain separate from this local implementation.
- Implementation commit `5c94f61` is pushed to `codex/built-in-demo-gallery`. The source ZIP contains 488 files, includes the STEP recovery fixture and verification reports, and passes archive CRC checks. Development remains running on port 5184, with the completed combined Stewart movement open in Chrome.
