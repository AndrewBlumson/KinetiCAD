# Editable sketch dimensions — 12 September 2026

## Implemented scope

In Modeller, select a finished sketch in the parts tree, choose **Edit dimensions**,
edit its measurements and press **Apply dimensions**. The existing native primitive
coordinates remain the source of truth. Save project, Load project and recovery
use the existing version 1 project envelope / state version 9; no migration is needed.

| Shape | Editable measurements | Fixed reference when changing size |
| --- | --- | --- |
| Circle | Centre U/V, diameter | Centre |
| Rectangle | Corner U/V, width, height | Lower-left corner |
| Line | Start U/V, length, angle from +U | Start point |
| Arc | Centre U/V, radius, start angle, anticlockwise sweep | Centre and specified start angle |

Lengths use millimetres and angles are entered in degrees. Stored arc angles use
radians. Local axes are U=X/V=Y on XY, U=X/V=Z on XZ and U=Y/V=Z on YZ. Part
transforms continue to place that local geometry in the assembly.

Inputs reject empty and non-finite values. Positive sizes are bounded to
0.001–1,000,000 mm, coordinates to ±1,000,000 mm and entered angles to ±360,000°.
Arcs require a positive sweep from 0.001° to 359.999°; use a circle for a full loop.
Readouts round for display; stored primitive values keep JavaScript number precision.

This is numeric editing of existing primitives. It does not introduce a general
constraint solver, dimension annotations in the viewport, sketch-on-face, or
multiple closed loops. Neighbouring endpoints do not move automatically. Several
primitive drafts can be adjusted before applying the whole connected profile.

## Preservation and rebuild checks

- Draft text stays outside saved project state. Apply preflights the complete part
  feature chain and dependent assembly Booleans with the CAD kernel before committing.
- Invalid geometry leaves the saved sketch and solid unchanged, with an explanatory
  error and the draft retained for correction. Cancel discards the draft.
- Cancelled, stale or superseded asynchronous results cannot overwrite a newer model.
- Changed geometric joint attachments are rejected conservatively. No anchor is
  silently moved or removed. A valid edit can still be rejected if topology cannot
  be confidently preserved; the user must explicitly revisit that joint.
- Save, Load, recovery switching, imports, exports and demo switching wait until the
  dimension edit is applied or cancelled. This prevents a download containing older
  dimensions while different draft numbers are displayed.
- A meaningful edit invalidates derived mesh/mass data, resets simulation, and clears
  the original crank-slider/Stewart motion reference configuration. The simulator
  explains that those original comparisons require a demo reset. Generic simulation
  still uses the rebuilt geometry. Numerically identical edits preserve configuration.

## Automated checks

The full serialized suite passed **237/237**, with zero failures, skips or cancellations
(133.44 seconds). The workspace TypeScript checks and production build passed. The
landing page was then built separately with its root `/` base; CAD uses `/app/`.

The new feature contributes **33 tests**:

| Suite | Tests | Evidence |
| --- | ---: | --- |
| `sketch-dimensions.test.mjs` | 9 | Independent conversions, anchors, angle handling, strict bounds, exact no-ops and saved-number round trips |
| `sketch-dimensions-cad.test.mjs` | 10 | Actual installed OpenCascade solids, volumes, density-derived masses, centroids, bounds, three sketch planes and reopened saved primitives |
| `sketch-edit.test.mjs` | 14 | Actual store transactions with controlled kernel outcomes: failed features/Booleans, joint preservation, stale/cancelled edits, persistence and simulation-reference invalidation |

The actual-CAD study compares against analytic geometry, with absolute tolerances of
**10⁻⁶ mm³ for volume**, **10⁻⁶ mm for coordinates** and **10⁻¹⁰ kg for mass**.
Its cylinder changes from diameter 20 to 30 mm at 12 mm depth: volume increases from
1200π to 2700π mm³ and mass scales by **2.25** at unchanged density. Rectangle edits
are checked on XY/XZ/YZ; line-loop rotation and circular-sector area/centroid are
checked independently. Disconnected sector edits must fail.

The combined runner exposed a pre-existing module boundary in the shared desktop
gate. Renaming the unchanged helper from `.ts` to `.mts` and updating its three
imports makes its ESM type explicit. All nine desktop tests pass both directly and
inside the combined suite.

Run from the repository root:

```sh
pnpm --filter @workspace/kineticad test:all
PORT=5184 BASE_PATH=/app pnpm run build
PORT=5186 BASE_PATH=/ pnpm --filter @workspace/landing build
```

Historical reports keep their original test counts and source snapshots. This new
count does not retroactively replace the 166- or 195-test reports.
[Source hashes and build/test evidence](sketch-dimensions-validation.json) identify
the current implementation separately.

## Actual Chrome interaction

Checks used the real production interface at `http://localhost:5187/app/`, an
isolated local test origin, and a fresh startup of the dev page on port 5184.
No browser-injected application state was used. The multi-shape fixture was loaded
through the app's Load project control and the native file picker.

| Interaction | Observed result |
| --- | --- |
| Draw circle, finish sketch, set diameter 20 mm, extrude 10 mm | Visible solid, displayed volume 3.14 cm³ |
| Edit consumed circle to diameter 30 mm | Solid visibly enlarges; volume 7.07 cm³, aluminium mass 0.019 kg |
| Empty diameter then Apply | Explicit finite-number error; saved model unchanged |
| Draft diameter 40 mm then Cancel | Saved diameter remains 30 mm |
| Edit in progress | File, recovery and demo controls visibly disabled |
| Actual Save, Load and refresh of edited cylinder | Download stores radius 15 mm and depth 10 mm; recovered/read-back diameter is 30 mm |
| Rectangle from 20×10 to 30×15 mm, depth 10 mm | Saved measurements and volume 4.50 cm³ |
| Change just one line of a closed loop | Gap error; edit rejected; draft retained |
| Correct adjoining lines within the same draft | Closed 30×10×10 mm solid; volume 3.00 cm³ |
| Quarter-circle radius 10→15 mm with both radial edges corrected | Radius 15 mm, sweep 90°, volume 1.77 cm³ |
| Save multi-shape project and refresh | Arc and rectangle measurements retained; all four solids return |
| Fresh development page | Modeller loads successfully after the earlier in-progress HMR errors |

The [saved multi-shape project](fixtures/sketch-dimensions/edited-four-shapes.kineticad.json)
is the actual browser download and can be loaded to repeat the UI checks.
Machine-precision trigonometric round-off in joined line endpoints is retained in
the file; OpenCascade accepts it within its geometric tolerance.

Native Chrome DevTools was inspected. The deliberate open-profile failure produced
the expected CAD-worker error. Fresh production recovery produced no uncaught
application error; the console also exposed the missing root favicon, addressed
with an explicit base-aware icon. Historical development HMR failures during
in-progress edits are not represented as a clean session. After the icon rebuild,
the console was cleared for a new recovery reload: zero new errors were shown,
with 29 ordinary messages hidden by the error filter.

## Actual exported geometry

Both files below were downloaded using the app's export controls after the cylinder
diameter edit. The STEP was reimported using the shipped CAD worker and installed
OpenCascade. STL was measured independently from its triangle data.

| File | Measured result | Acceptance |
| --- | --- | --- |
| [STEP cylinder](fixtures/sketch-dimensions/edited-cylinder.step) | 7068.583470577036 mm³ vs 2250π = 7068.583470577035 mm³ | Volume error 9.09×10⁻¹³ mm³; bounds and centroid within 10⁻⁶ mm |
| [STL cylinder](fixtures/sketch-dimensions/edited-cylinder.stl) | 152 triangles; 7038.045012438362 mm³, 0.432031% below exact | One closed, connected, consistently oriented manifold after 10⁻⁵ mm seam welding; maximum chord deviation 0.0486404 mm within 0.1 mm exporter deflection |

STL is a faceted approximation. The volume gate was derived from the export
deflection, not fitted to the result: for radius R=15 mm and deflection e=0.1 mm,
the maximum inscribed area deficit is 1−(1−e/R)², plus 10⁻⁶ numerical allowance.
The measured volume also agrees with the independent 39-sided polygon-prism
equation within 0.0000649 mm³ (gate 0.002 mm³).

[Full export measurements and hashes](sketch-dimensions-export-results.json)
record the exact downloads and tolerances. These are bounded geometry checks;
they do not establish a universal mesh self-intersection proof, general collision
physics, finite motor torque, friction or structural deformation. Those model
limitations and later implementation stages remain unchanged.

This addition is ready for user testing. No next-stage CAD implementation or public
deployment is included.
