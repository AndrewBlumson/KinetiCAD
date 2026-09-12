# Numerical report provenance

Report dates and measured source hashes identify the run that produced the
numbers. A later UI, export or logging change does not justify replacing those
hashes with the current checkout. This note records the bounded source review;
it is not a new OCCT or physics measurement.

## Current interpretation at implementation baseline `8e954ab`

The September documentation audit reran the complete **298-test** suite without
changing application code. [test-inventory-results.json](test-inventory-results.json)
records actual per-test events, source locations and source hashes, and retains
freshly generated measurement payloads separately. Existing dated JSON reports
were restored to their original bytes. [TEST-CATALOG.md](TEST-CATALOG.md) explains
which results are real-kernel experiments, pure calculations or mocked lifecycle
checks. The [maths reference](MATHEMATICS-AND-PHYSICS.md) connects their tolerances.

The earlier source-match observations later in this document are historical.
In particular, the worker hash `a7c7e843…` in the generic demo, material-force,
original Stewart-lift and six-axis controller reports **does not match** the
current `7143f9f0…` physics worker. Their measured values are retained as dated
snapshots. Do not present them as newly executed on the latest worker merely
because a later aggregate passes. Controller/kinematics inputs and other scoped
sources can match independently; those narrower matches do not make the whole
historical run current.

The crank-slider and Boolean physics reports record the current worker hash.
The Boolean stage's export report is
[boolean-simulation-export-results.json](boolean-simulation-export-results.json);
[assembly-export-results.json](assembly-export-results.json) remains the earlier
export milestone. Current automated rerun provenance is in the test inventory.
None of those results claims a newly republished Replit route.

## Evidence ownership and reproducibility

KinetiCAD's original build was made in Replit with Replit Agent by Andrew and
Kevin Blumson. Later Codex development, automated verification and actual Chrome
computer-use checks have their own dated records. Credit each activity where it
was performed; keep original Replit provenance intact.

For a new verification record, retain:

1. Commit/source and fixture hashes, dependency versions, command and timestamp.
2. The test or scenario name and its independent reference calculation.
3. Units, requested parameters, tolerance, observed value/error and pass/fail.
4. Whether the path used the actual OCCT/Rapier worker, a mock or pure arithmetic.
5. Browser route and bundle identity, interactions actually performed, visible
   observations and captured console/runtime errors for UI checks.
6. Unsupported cases, failed/rejected cases and pending gates. Do not turn an
   uncompleted check into a pass or omit it from the summary.

A source hash identifies bytes; it is not a proof of physical correctness.
Tests do not certify every possible user model. The original windmill tolerance
must remain unchanged; any new tolerance must state its numerical/model basis,
not simply match an observed error. Published acceptance must be measured again
on the intended Replit route.

## Historical earlier-September provenance review

The remainder preserves the earlier review's scope and findings. References to
matching “current” hashes below mean current **at that earlier review** and may
have been superseded, as explicitly noted above. This section is not the current
source-match ledger.

## Restored geometry metadata

The complete measured payload in [demo-geometry-results.json](demo-geometry-results.json)
matches the retained stdout of the final six-demo OCCT run. Its original JSON
SHA-256 was `9c5d0a898b0e063c321f004771cf33fad6c87691836e20bfccadc7da39840f8f`.
The restored `generatedAt` is the original report's modification time,
`2026-09-12T09:51:35.939Z`; that timestamp basis is explicit because the old
verifier did not write a date. Metadata restoration has a separate timestamp.
The run log hash and original measured payload hash remain in provenance.

The summary is calculated from its 50 measured records: 50 valid parts, 48
single solids and 35 single-solid parts in the four added demos. The preserved
legacy compounds are Windmill `part-rotor` with five solids and Orrery `part-ring`
with 24. No pre-arc or older five-demo measurements were substituted.

All six fixture hashes still match their current JSON files. The geometry
verifier directly imports sketch/wire, extrude, revolve, Boolean, tessellation
and mass operations; it does not import the CAD worker's STEP/STL assembly
export or startup self-test. The seven imported operation/material files match
the restored source snapshot. The four shape-building operation hashes also
match the independently rerun Stewart clearance report.

The measured verifier hash remains
`dd240b619b96928a1212c42df372a1685ad1a536a670bb7dfe9189a20ac88b3a`.
Its subsequent change only adds metadata assembly and a metadata-only refresh
path. Direct text comparison confirms the geometry helper bodies and actual
measurement loops are unchanged. Future OCCT runs capture their own source
snapshot before executing; refreshing metadata preserves the original snapshot.

The aggregate links to these separate reports with their current file hashes,
their recorded dates and their own scope:

- [Material clearance](material-clearance-results.json): 72 initial/final pairs.
- [Original Stewart lift clearance](stewart-clearance-results.json): 182
  initial/actual-final pairs.
- [Six-axis Stewart workspace](stewart-workspace-results.json): 910 exact pairs
  at ten spots plus conservative pose/path bounds.

Each clearance report's link to its measured solver-pose report also matches
the current file bytes. These links do not turn endpoint checks into continuous
contact-force validation. After separately rerunning those reports, refresh
the aggregate links without running OCCT:

```sh
node --import ./scripts/node_modules/tsx/dist/loader.mjs scripts/src/verify-demo-geometry.mjs --refresh-metadata
```

This rejects a stale fixture. It preserves measurements, measurement date and
measured source hashes, then recomputes counts and related-report links. It
does not make an old numerical result valid after a geometric operation changes.

## Sources retained by the other reports

The physics worker hash in the current general demo, material-force, Stewart
lift and controller reports is
`a7c7e84367b88438bec20e0ce5285bdfcd7a6fb961c94deead006b2543718e46`,
which still matches the worker. The controller and kinematics module hashes,
workspace audit source, mass-properties module, independent actuator/contact
modules, and beam source/test hashes also match their respective reports.
The later assembly-Boolean runner guard changes which assemblies may start;
it does not change these worker or operation measurements. UI lifecycle and
browser acceptance require their own regression and rendered checks.

The following differences are intentional and must not be disguised:

| Report | Measured revision and current interpretation |
| --- | --- |
| [Browser export](browser-export-results.json) | Measured CAD worker `23c731d3…`; tests the identified downloaded mixed native/imported files, and explicitly excludes assembly booleans. Keep that measured hash. |
| [Project recovery](project-recovery-results.json) | Also records CAD worker `23c731d3…`. Its 13-test suite passed again after the export change and in the 160-case aggregate; the original detailed measurement record keeps its original revision. |
| [Assembly export](assembly-export-results.json) | Seven actual-worker cases record the newer CAD worker `49cfd6ce…` and current export planner. Its full hashes match the source at this review. |
| [Earlier force/Stewart browser](force-stewart-browser-results.json) | Keeps the 11 September worker/runner hashes and bundle names. It predates six-axis control and current recovery/engineering UI. |
| [Earlier five-demo browser](browser-physics-results.json) | Keeps its named 11 September bundles and sampled scope; it is historical evidence. |

The final browser matrix identifies its own source and bundle revisions.
Unrelated-source reasoning preserves scoped numerical evidence; it is not a
substitute for final rendered flows or public deployment verification.
