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

## Simulating exported results

Assemblies containing assembly-level Boolean results are blocked from simulation.
Play is disabled with an explanation, and the runner independently rejects them,
including a Boolean added during world preparation. The previous input-body
path would have simulated uncut operands instead of the displayed result.

To simulate the final geometry, export STEP and import its solids, then assign
materials, grounding and joints. Export only the intended bodies: Hide inputs
off deliberately includes originals alongside the Boolean result. Native per-part
additive/subtractive features remain supported directly; this restriction applies
to assembly-level Boolean results.

## Verification

Run from the repository root, without another heavy OCCT test running:

```sh
node --import ./scripts/node_modules/tsx/dist/loader.mjs --test artifacts/kineticad/tests/assembly-export.test.mjs
pnpm --filter @workspace/kineticad test:project
```

The seven actual-worker export tests rebuild native shapes with mixed XYZ rotation and translation, write both formats, and re-import STEP through the shipped CAD worker. They compare exact solid counts, volume and centroid against independent box calculations. STL's oriented triangle volume and centroid are checked independently. They cover Union, ordered Subtract, Intersect, hidden operands and unrelated hidden parts, retained originals, disconnected compounds, shared inputs, failed exports and the internal raw-asset path. The last case also checks a native per-part Subtract feature survives export.

Numerical evidence and source hashes are in [assembly-export-results.json](assembly-export-results.json). The planar test shapes have no curved-surface tessellation error; their STL tolerances must not be assumed for arbitrary curved geometry. Browser interaction acceptance is recorded separately by the UI verification task.

The actual Chrome downloads for Subtract STEP/STL and subsequent applied Union/Intersect STEP exports are retained in `tests/fixtures/browser-boolean-*`. Their independent numerical check is [browser-boolean-export-results.json](browser-boolean-export-results.json), reproduced with:

```sh
node --import ./scripts/node_modules/tsx/dist/loader.mjs artifacts/kineticad/tests/verify-browser-boolean-export.mjs
```
