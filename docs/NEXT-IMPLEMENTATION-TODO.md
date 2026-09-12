# Next implementation stages

Started 12 September 2026 from `81fd123`. Repository is private while development continues.

The user requested one item at a time, with a stop after each completed item for their own testing. Do not begin the following item until that testing is complete and the user asks to continue.

## 1. Adjustable crank-slider — ready for user testing

- [x] Build a native editable assembly with a driven crank, passive connecting rod and guided slider.
- [x] Add bounded radius, rod-length and speed controls without overwriting the original project.
- [x] Compare actual solver motion against independent position, velocity and mean-acceleration equations; retain the raw derivative diagnostic exceedances explicitly.
- [x] Check support geometry, joint closure, limiting dimensions, both drive directions and timestep refinement.
- [x] Verify Save/Load, parameter edits, pause/reset and actual Chrome interaction.
- [x] Run regressions and build; record measured errors and model limits. **195/195 tests passed; full build passed.**
- [ ] User acceptance: try this completed item before another stage begins.

See the [numerical verification](CRANK-SLIDER-VERIFICATION.md), [Chrome matrix](CRANK-SLIDER-CHROME-2026-09-12.md) and [source/build evidence](crank-slider-validation.json). Implementation stops here for the user's testing.

## Following stages — not started

- Persistent editable sketch dimensions.
- Direct simulation of finished assembly Boolean shapes.
- A local draw-a-path mechanism optimiser with an explicit supported mechanism family.
- Assembly motor force limits and load behaviour, then validated contact and bearing friction in separate stages.
- Broader structural deformation, with a separately defined and independently verified physical model.
- Final public release, Replit publication and public-route acceptance.

## Optional support link — release preparation

Keep the full application free. Add a discreet voluntary “Support KinetiCAD” link once the user chooses a payment provider and supplies their destination. Do not create a payment account or publish an unconfigured donation button. The repository can return to public visibility when the user is ready to release it.
