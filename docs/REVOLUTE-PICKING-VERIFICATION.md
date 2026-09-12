# Curved-edge hinge picking verification — 12 September 2026

Actual Chrome computer use found and reproduced a coordinate error when creating
a revolute joint from a translated part's circular edge. The targeted correction
passes the repeated browser workflow and the complete **351/351-test** suite
across 51 files. Workspace typecheck and the CAD production build passed.
This follow-up is identified by source fingerprints in the
[machine-readable record](evidence/revolute-picking/verification.json); the
[348-test four-bar capture](four-bar-validation.json) remains historical.
The application remains a Replit-built project; these are later Codex checks.

## Reproduction and correction

Load [the existing four-shape fixture](fixtures/sketch-dimensions/edited-four-shapes.kineticad.json).
Its quarter-circle sector has radius 15 mm, a 10 mm extrusion and translation
(45, 30, 0) mm. The grounded cylinder is translated (-45, -30, 0) mm. Both top
circular edges have the true centre **(0, 0, 10) mm in their own part's frame**.

In Chrome, select Revolute, click the visible top curved rim of the sector,
click the grounded cylinder's top rim, enter 30 RPM, Apply, then Save project.
The actual [before-fix download](evidence/revolute-picking/before-fix.kineticad.json)
stored sector pivot (-45.0000000093, -30.0000000093, 10) mm and cylinder pivot
(45, 30, 10) mm. Each differs from its expected local centre by about **54.0833 mm**.
These values came from the actual downloaded project, not injected browser state.

The kernel's edge metadata is local. For rotation R and translation t:

```text
world point = R × local point + t
local point = transpose(R) × (world point - t)
```

`getEdgeAxisWorld` already supplies the world-space centre. The validator was
instead passing the original local metadata into `worldToLocalPoint`, applying
the inverse transform a second time. The fix passes the derived world centre to
that inverse conversion. The axis calculation and physics solver are unchanged.
See [the validator](../artifacts/kineticad/src/three/MatePickerCoordinator.ts#L328).

## Measured browser results

The isolated test used `http://127.0.0.1:5190/app/`; the user's existing
`localhost:5190` model was preserved. Picks were real screenshot-based clicks.
Project reopening used Chrome's file chooser and actual saved files.

| Check | Observed result |
| --- | --- |
| Repeat the same picks after rebuilding | Maximum local-centre error **1.30866e-8 mm**, passing the 1e-6 mm comparison tolerance |
| Reopen the actual corrected download | Hinge name, part references and 30 RPM setting retained |
| Simulator Play, Pause, Resume and Reset | All state transitions observed; Reset returned to 0 s |
| Rotate sector 37° around Z using the numeric inspector, then pick again | Maximum local-centre error **1.30866e-8 mm** |
| Reopen rotated download, refresh Chrome, Save again | Entire recovered assembly equals the saved assembly, including part transforms and pivots |
| Captured Chrome warnings/errors after the final refresh | None returned by the tab log API |

Retained actual downloads: [corrected translation](evidence/revolute-picking/after-fix.kineticad.json),
[corrected rotation](evidence/revolute-picking/rotated-after-fix.kineticad.json),
and [reopened/refreshed rotation](evidence/revolute-picking/rotated-reopened-refreshed.kineticad.json).
The 1e-6 mm threshold checks coordinate storage; it is not a manufacturing tolerance.

This fixture tests picking. Its unused parts are unconstrained and fall under
gravity; its initially separated hinge anchors settle together. It is not a
collision-checked machine. No quantitative angular-speed or joint-closure trace
was captured for this browser fixture. Observed motion/lifecycle checks do not
replace the separate numerical solver benchmarks in the complete suite.

## Automated regressions and commands

Three controlled-topology regressions failed before the correction and pass
afterwards. They call the real final picker validator, with independently
specified local centres and scalar rotation references; they are not presented
as kernel or browser execution.

1. Translated native circle and quarter arc retain their local true centres;
   returned arrays do not alias or mutate topology metadata.
2. Parts with mixed XYZ rotations retain an independently defined shared
   world pivot and the expected local axis.
3. Identity-frame finished Boolean topology pairs correctly with a translated
   native part's circular topology.

These are appended to [overlay-frames.test.mjs](../artifacts/kineticad/tests/overlay-frames.test.mjs#L137).
All eight tests in that file passed. All previous 348 tests plus the three new
ones passed in the full serial run: **351 passed, zero failed, zero skipped**,
229,659.49925 ms, Node 25.4.0. The existing windmill benchmark remains in the suite.

```sh
pnpm --filter @workspace/kineticad test:all
pnpm run typecheck
PORT=5184 BASE_PATH=/app/ pnpm --filter @workspace/kineticad build
```

Evidence: [before-fix failures](evidence/revolute-picking/before-fix-tests.txt),
[all 351 named results](evidence/revolute-picking/suite.txt),
[workspace typecheck](evidence/revolute-picking/typecheck.txt),
[CAD build](evidence/revolute-picking/build.txt), and
[source hashes and measured coordinates](evidence/revolute-picking/verification.json).
The suite also regenerated [assembly export measurements](evidence/revolute-picking/assembly-export-results.json)
and [Boolean physics measurements](evidence/revolute-picking/boolean-physics-results.json).
Those fresh copies are retained with this run; the earlier historical reports
keep their original timestamps and provenance.
An initial build invocation omitted required PORT/BASE_PATH variables; the
configured command above passed. The build retains its chunk-size warning.
Replit's Node 24 runtime and public deployment remain separate acceptance steps.

## Existing files and remaining scope

This fixes **newly picked** hinges. It cannot infer which earlier stored pivots
were intentional. Previously mispicked joints must be re-picked/recreated and
saved; no automatic project migration was added. General contact, bearing
friction, force ratings and deformation are not enabled by this correction.

During the same computer-use session, a straight mouse stroke in Draw a path
produced an open loop and correctly disabled search. Closing that stroke was
rejected by the area/span/perimeter guard, and closing the designer preserved the
existing linkage. The exposed mouse API accepts one start and one end point;
it cannot execute a continuous curved drag. That exact freehand gesture remains
unverified and is not relabelled as passed by preset or keyboard testing.
