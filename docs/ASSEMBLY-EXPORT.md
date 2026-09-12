# STEP and STL assembly exports

Export STEP and Export STL download the committed solids visible in the modeller. Apply or cancel an open sketch, feature, Boolean or mate editor first; preview overlays are not included.

- A normal part exports its complete native/imported feature chain at its current position and XYZ rotation.
- A part with its visibility switched off does not export as a separate solid.
- Each committed Union, Subtract or Intersect exports its actual OpenCascade Boolean result. Hidden input parts still supply geometry to the calculation.
- **Hide inputs on:** only the Boolean result exports in place of its input parts.
- **Hide inputs off:** visible originals export alongside the Boolean result, just as they appear in the viewport. This can intentionally create overlapping solids; the exporter does not fuse all visible objects together.
- A disconnected Boolean result retains all its solids. Multiple Boolean results sharing source parts each remain present.
- Boolean inputs are original assembly parts. Using another Boolean result as an input is not supported; such a reference fails explicitly.
- A missing input, failed Boolean or empty final assembly stops the export with a descriptive message. It does not silently substitute the original parts or download an incomplete result.

These are geometry files. STEP carries exact boundary representation; STL carries triangles. Neither format carries KinetiCAD's editable feature history, materials, mates or simulation configuration. **Save project** preserves that information and embeds imported STEP assets. Internal project-asset packaging exports the isolated original imported shape in local coordinates, independent of modeller visibility and Boolean output.

Selecting a part or Boolean result does not filter the export: it still includes
all committed visible solids under the rules above. Undo/Redo restores the
committed model that subsequent exports rebuild. Apply/cancel open editors and
finish restoration before exporting. See [history and selection](HISTORY-AND-SELECTION.md).

## Simulation uses the final shape directly

A committed assembly Boolean containing one connected solid now simulates
directly: no STEP export/reimport is required. The result's final OCCT shape
provides its mesh, volume, COM and inertia. Set its finished material and fixed
base in the Boolean editor, then attach supported joints to the result itself.
See [Boolean simulation](BOOLEAN-SIMULATION-VERIFICATION.md) for exact limits,
numerical evidence and the completed native Chrome Fixed-joint file reopening.

Export and simulation deliberately have different inclusion rules. **Hide inputs
off** can export visible originals alongside the result. Simulation always
excludes consumed inputs so mass is not counted twice. Exports can retain
multiple disconnected solids or shared-input outputs; those configurations
cannot silently become one physical Boolean body in the simulator.

STEP reimport remains a geometry-exchange option. It loses KinetiCAD's editable
history and joint definitions; Save/Load project retains them and the new
result material, fixed-base ID and attachment revisions.

## Verification

Run from the repository root, without another heavy OCCT test running:

```sh
node --import ./scripts/node_modules/tsx/dist/loader.mjs --test artifacts/kineticad/tests/assembly-export.test.mjs
pnpm --filter @workspace/kineticad test:project
```

The seven actual-worker export tests rebuild native shapes with mixed XYZ rotation and translation, write both formats, and re-import STEP through the shipped CAD worker. They compare exact solid counts, volume and centroid against independent box calculations. STL's oriented triangle volume and centroid are checked independently. They cover Union, ordered Subtract, Intersect, hidden operands and unrelated hidden parts, retained originals, disconnected compounds, shared inputs, failed exports and the internal raw-asset path. The last case also checks a native per-part Subtract feature survives export.

The original export-stage numerical evidence and source hashes remain in
[assembly-export-results.json](assembly-export-results.json). The later direct-Boolean
stage reran the same seven export cases and recorded
[boolean-simulation-export-results.json](boolean-simulation-export-results.json).
The complete current [test inventory](HISTORY-SELECTION-TEST-CATALOG.md) includes those seven cases. The planar test shapes have no curved-surface tessellation error; their STL tolerances must not be assumed for arbitrary curved geometry. Browser interaction acceptance is recorded separately by the UI verification task.

The actual Chrome downloads for Subtract STEP/STL and subsequent applied Union/Intersect STEP exports are retained in `tests/fixtures/browser-boolean-*`. Their independent numerical check is [browser-boolean-export-results.json](browser-boolean-export-results.json), reproduced with:

```sh
node --import ./scripts/node_modules/tsx/dist/loader.mjs artifacts/kineticad/tests/verify-browser-boolean-export.mjs
```

The four-bar stage additionally checks actual Chrome exports of curved native
solids. [Its downloaded-file report](evidence/four-bar/export-check.json) verifies
four STEP solids against volume, centroid, full inertia and bounds, and a
2,488-triangle STL with four closed components. The STL volume differs from
exact CAD by 0.08334%, below that fixture's 0.1% gate; it is a tessellation
approximation. Both [STEP](fixtures/four-bar/browser-custom-loop.step) and
[STL](fixtures/four-bar/browser-custom-loop.stl) bytes are retained beside the
complete native project. This is a separate download audit, not extra unit tests.
