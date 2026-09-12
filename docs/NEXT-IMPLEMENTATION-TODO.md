# Next implementation stages

Started 12 September 2026 from `81fd123`. Repository is private while development continues.

The user requested one item at a time, with a stop after each completed item for their own testing. Do not begin the following item until that testing is complete and the user asks to continue.

## 1. Adjustable crank-slider — implemented

- [x] Build a native editable assembly with a driven crank, passive connecting rod and guided slider.
- [x] Add bounded radius, rod-length and speed controls without overwriting the original project.
- [x] Compare actual solver motion against independent position, velocity and mean-acceleration equations; retain the raw derivative diagnostic exceedances explicitly.
- [x] Check support geometry, joint closure, limiting dimensions, both drive directions and timestep refinement.
- [x] Verify Save/Load, parameter edits, pause/reset and actual Chrome interaction.
- [x] Run regressions and build; record measured errors and model limits. **195/195 tests passed; full build passed.**
- [x] User authorised continuation to sketch dimensions on 12 September 2026; this records permission to continue, not a claim of formal engineering acceptance.

See the [numerical verification](CRANK-SLIDER-VERIFICATION.md), [Chrome matrix](CRANK-SLIDER-CHROME-2026-09-12.md) and [source/build evidence](crank-slider-validation.json).

## 2. Persistent editable sketch dimensions — ready for user testing

Authorised by the user on 12 September 2026. The dev server is running on port 5184.

- [x] Add numeric editing for existing circle, rectangle, line and arc geometry, with explicit millimetres/degrees.
- [x] Keep the last valid model if an edit breaks the part's feature chain or dependent assembly geometry.
- [x] Preserve the sketch dimensions through Save/Load and recovery without changing the existing project format.
- [x] Verify geometric equations against independently measured OpenCascade solids and test failed/stale edits.
- [x] Exercise the actual Chrome editor, exports/reload and input errors, then run regression/build checks. **237/237 tests and the full build passed.**
- [ ] User testing: implementation stops at this stage until the user asks to continue.

See [sketch dimensions verification](SKETCH-DIMENSIONS-VERIFICATION.md) for measured results, tolerances, browser checks and limitations.

## Following stages — not started

- Direct simulation of finished assembly Boolean shapes.
- A local draw-a-path mechanism optimiser with an explicit supported mechanism family.
- Assembly motor force limits and load behaviour, then validated contact and bearing friction in separate stages.
- Broader structural deformation, with a separately defined and independently verified physical model.
- Final public release, Replit publication and public-route acceptance.

## Additional user request — creator profile and desktop access

- [x] Add Andrew's personal website, Adevious AI, X and LinkedIn to a creator section and shared site footer.
- [x] Keep the public information readable on phones, while blocking CAD startup on phones and tablets, including direct modeller/simulator links.
- [x] Verify the new device rules, production builds, actual Chrome navigation and desktop simulator startup.
- [ ] User review and final published-route acceptance.

See [profile and desktop-access verification](CREATOR-PROFILE-AND-DESKTOP-ACCESS.md). This additional request does not advance the next CAD stage before user testing.

## Optional support link — release preparation

Keep the full application free. Add a discreet voluntary “Support KinetiCAD” link once the user chooses a payment provider and supplies their destination. Do not create a payment account or publish an unconfigured donation button. The repository can return to public visibility when the user is ready to release it.
