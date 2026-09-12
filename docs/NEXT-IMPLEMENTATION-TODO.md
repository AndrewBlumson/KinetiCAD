# Next implementation stages

Started 12 September 2026 from `81fd123`. Repository is private while development continues.

The latest authorised sequence is Undo/Redo, then improved object selection, then repository/publication preparation and documentation. Test each implementation before proceeding to the next. This supersedes the earlier request to wait for user input between those particular items; it does not authorise a public deployment or repository visibility change.

## 1. Adjustable crank-slider — implemented

- [x] Build a native editable assembly with a driven crank, passive connecting rod and guided slider.
- [x] Add bounded radius, rod-length and speed controls without overwriting the original project.
- [x] Compare actual solver motion against independent position, velocity and mean-acceleration equations; retain the raw derivative diagnostic exceedances explicitly.
- [x] Check support geometry, joint closure, limiting dimensions, both drive directions and timestep refinement.
- [x] Verify Save/Load, parameter edits, pause/reset and actual Chrome interaction.
- [x] Run regressions and build; record measured errors and model limits. **195/195 tests passed; full build passed.**
- [x] User authorised continuation to sketch dimensions on 12 September 2026; this records permission to continue, not a claim of formal engineering acceptance.

See the [numerical verification](CRANK-SLIDER-VERIFICATION.md), [Chrome matrix](CRANK-SLIDER-CHROME-2026-09-12.md) and [source/build evidence](crank-slider-validation.json).

## 2. Persistent editable sketch dimensions — implemented

Authorised by the user on 12 September 2026. The dev server is running on port 5184.

- [x] Add numeric editing for existing circle, rectangle, line and arc geometry, with explicit millimetres/degrees.
- [x] Keep the last valid model if an edit breaks the part's feature chain or dependent assembly geometry.
- [x] Preserve the sketch dimensions through Save/Load and recovery without changing the existing project format.
- [x] Verify geometric equations against independently measured OpenCascade solids and test failed/stale edits.
- [x] Exercise the actual Chrome editor, exports/reload and input errors, then run regression/build checks. **237/237 tests and the full build passed.**
- [x] User authorised continuation on 12 September 2026; this records permission to continue, not formal engineering acceptance.

See [sketch dimensions verification](SKETCH-DIMENSIONS-VERIFICATION.md) for measured results, tolerances, browser checks and limitations.

Visual follow-up, 12 September 2026: enlarged the shared world-reference grid from
200 × 200 mm to 600 × 600 mm while keeping 10 mm squares. The grid stays at its
existing origin and height; model geometry, camera fitting and physics are unchanged.
CAD typecheck and production build passed. Actual Chrome preview on port 5185
showed the complete crank-slider bed within the grid, with no captured runtime errors.
This visual-only change does not advance the next CAD stage or add physics claims.

## 3. Direct simulation of finished assembly Boolean shapes — implemented

- [x] Prepare each connected final solid and its mass properties from the same OpenCascade shape.
- [x] Define finished material, fixed base and result joints; exclude construction inputs.
- [x] Verify independent geometry/inertia equations and actual solver motion, including rejected ambiguous cases.
- [x] Exercise the actual Chrome editing, simulation, Save, refresh/recovery, stale-joint rejection and lifecycle controls. Parse the actual downloaded files with the shipped loader.
- [x] Reopen the downloaded result-joint project through the native Chrome Load dialog. On 12 September, the fixed-joint project reopened on port 5190 with brass, fixed base, two bodies and its joint intact. Play/pause/reset and a further browser refresh passed. See [captured Chrome evidence](evidence/boolean-reopen/browser.json).
- [x] Run final regression/build checks and document measured scope: **298/298 tests and the full build passed.**

See [Boolean simulation verification](BOOLEAN-SIMULATION-VERIFICATION.md) for numerical tolerances, actual Chrome observations and the recorded browser checks.

## 4. Local draw-a-path linkage — implemented

The user authorised continuation on 12 September 2026. Package upgrades remain deferred.

- [x] Search locally in a cancellable worker for a bounded planar four-bar crank-rocker.
- [x] Show the drawn path and sampled fit errors; do not promise an exact fit or global optimum.
- [x] Build connected native editable CAD parts and four revolute joints after a successful solid preflight.
- [x] Measure actual Rapier motion against independently calculated linkage geometry.
- [x] Verify persistence, failed/stale builds, real Chrome interactions and regressions.
- [x] Update equations, assumptions, raw evidence and current documentation, then stop for user testing.

Stage 4 capture: **348/348 automated tests across 51 files**, full workspace
typecheck/build passed. Actual Chrome checks covered search/cancel, presets and
keyboard coordinates, native model creation, Save/Load/refresh, motion controls,
export and manual-reference invalidation. Actual Chrome also exercised a straight
start/end drag and open-loop rejection. Seven component tests cover pointer
coordinate/closure handling; no continuous curved live gesture is claimed,
because the available mouse tool supports straight drags. See [four-bar verification](FOUR-BAR-PATH-VERIFICATION.md) and
[the four-bar stage catalog](FOUR-BAR-TEST-CATALOG.md). That capture is separate
from the targeted hinge-picking follow-up below.

## Follow-up after stage 4 — revolute edge picking verified within the recorded scope

Actual Chrome computer use reproduced an incorrect hinge pivot when picking a
translated circle and partial circular arc. This is a measured picking defect,
not a conclusion inferred from an untested UI path. The bounded fix and its
recorded picking/persistence checks have passed. This does not start the later
assembly-force or deformation stages.

- [x] Reproduce the translated circular-edge/partial-arc error through the actual Chrome interface.
- [x] Correct the coordinate conversion in `MatePickerCoordinator`: use each edge's true circle centre already transformed to world coordinates before converting it to a stored part-local pivot. The old path applied a world-to-local transform directly to already-local centre metadata.
- [x] Add three regressions for translated native picks, shared centres under mixed XYZ rotation and identity-frame Boolean/native picks. All three failed before the fix and pass after it; the full overlay file passes **8/8**.
- [x] Pass CAD production build and workspace typechecking.
- [x] Repeat the translated circle/partial-arc picks in actual Chrome after the fix, Save and Load the actual download, and exercise Play/Pause/Resume/Reset. Rotate the arc 37° about Z in the UI, repick and save: local-pivot error is at most **1.31×10⁻⁸ mm**, against a **10⁻⁶ mm** acceptance bound.
- [x] Complete the final full regression run: **351/351 tests across 51 files**, zero failures/skips. Workspace typecheck and CAD production build pass.

The [revolute-picking record](REVOLUTE-PICKING-VERIFICATION.md) retains the
reproduction, fix and acceptance evidence, including the actual
[before-fix](evidence/revolute-picking/before-fix.kineticad.json),
[after-fix](evidence/revolute-picking/after-fix.kineticad.json) and
[rotated](evidence/revolute-picking/rotated-after-fix.kineticad.json) downloads.
The browser motion checks establish lifecycle behaviour; this specific hinge
case did not record a quantitative speed or joint-closure benchmark. The full
suite retains the independent unchanged Windmill speed canary.

Existing saved joints keep their
stored pivots: this fix does **not** automatically repair them. Repick or recreate
an affected joint, verify its attachment and save a new project copy. This closes
the reproduced true-centre picking/persistence gap for the recorded fixtures;
it does not certify every arc/transform/joint workflow.

## 5. Undo/Redo — checkpoint passed

- [x] Add bounded document history, atomic multi-action edits, imported source retention and async restoration guards.
- [x] Add labelled buttons and model shortcuts while preserving text-input keyboard behaviour.
- [x] Verify real store/controller regressions, numeric/material edits, native/STEP deletion, cascade restoration and multi-part import.
- [x] Pass **369/369** tests, workspace typecheck and CAD build before selection work.
- [x] Actual Chrome Save/Load/full refresh returns identical restored eight-part geometry, hinge and embedded STEP assets.

## 6. Object selection — implemented and locally verified

- [x] Select visible native/imported/Boolean solids by nearest canvas hit, with orange outlines.
- [x] Keep camera/movement drags separate from clicks; retain editor topology-picking rules.
- [x] Show derived Boolean details and an explicit edit action without an independent transform.
- [x] Test in actual Chrome and the complete regression suite; retain [history/selection evidence](HISTORY-AND-SELECTION.md).

## 7. Repository cleanup and documentation

- [x] Refresh current guides, feature copy, source links, test catalog and release handoff.
- [x] Document the [publication checklist](PUBLIC-RELEASE-CHECKLIST.md), implement ignore-rule/hook cleanup and third-party notices, and record scoped scans.
- [x] Final local aggregate **382/382 tests across 54 files**, full workspace typecheck/build and actual Chrome selection/history checks pass.
- [ ] Resolve the [dependency security review](DEPENDENCY-SECURITY-REVIEW.md) before public-release readiness; the user was asked whether to permit a separate security-only update pass. No package version changed.
- [ ] Refresh the reviewed source archive and record its source identity/hash.
- [ ] Replit runtime and final public-route checks remain release work.

## Following stages — not started
- Assembly motor force limits and load behaviour, then validated contact and bearing friction in separate stages.
- Broader structural deformation, with a separately defined and independently verified physical model.
- Final public release, Replit publication and public-route acceptance.

## Additional user request — creator profile and desktop access

- [x] Add Andrew's personal website, Adevious AI, X and LinkedIn to a creator section and shared site footer.
- [x] Keep the public information readable on phones, while blocking CAD startup on phones and tablets, including direct modeller/simulator links.
- [x] Verify the new device rules, production builds, actual Chrome navigation and desktop simulator startup.
- [x] Refresh the landing feature list to six groups covering current modelling, assemblies, simulation, materials/projects, demos and separate engineering tests. Correct obsolete planar-joint, playback, revolve-axis and motor-force claims. Landing typecheck/build and actual Chrome checks passed: six cards in three desktop columns, no horizontal overflow or captured runtime errors. Creator details and desktop access rules are preserved.
- [ ] User review and final published-route acceptance.

See [profile and desktop-access verification](CREATOR-PROFILE-AND-DESKTOP-ACCESS.md). This additional request does not advance the next CAD stage before user testing.

## Optional support link — release preparation

Keep the full application free. Add a discreet voluntary “Support KinetiCAD” link once the user chooses a payment provider and supplies their destination. Do not create a payment account or publish an unconfigured donation button. The repository can return to public visibility when the user is ready to release it.


## Documentation refresh and historical issue review — 12 September 2026

- [x] Preserve the Replit/Replit Agent origin and distinguish later Codex development, automated checks and actual Chrome computer use.
- [x] Update current README, developer/Replit handoffs, capability and recovery/export guides; preserve the original May handover separately.
- [x] Catalogue every automated test and document equations, units, reference methods, tolerances, errors and exclusions.
- [x] Rerun the complete suite: **298/298 passed across 39 files**. Validate 981 local documentation links, including 503 source-line anchors; preserve the original handover byte-for-byte. Application source and historical measurement reports are unchanged by this refresh.
- [x] Reconcile older known issues against current source/evidence without implementing new features.
- [ ] Review the [known-issues and follow-up register](KNOWN-ISSUES-AND-FOLLOW-UP.md) in a later bounded task after the current acceptance gate/user review.

[Current status](CURRENT-STATUS.md) and [the documentation index](README.md) are
the entry points for returning contributors. Do not use historical phase lists
or old test totals as current acceptance claims.
