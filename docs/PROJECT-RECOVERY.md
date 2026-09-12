# Complete project files and local recovery

**Save project** downloads a self-contained `.kineticad.json` document. Native
sketches, feature history, materials, transforms, assembly booleans, mates and
simulation configuration remain editable. Imported STEP geometry is embedded
as its source bytes, including a stable association between asset and body.
The original feature history of another CAD application's STEP export cannot
be recovered from a flat B-rep file. KinetiCAD features added after import are
saved and regenerated against the restored imported solid.

Project format 1 wraps state version 9. The existing bundled demos and native
version 8/9 JSON files remain supported. Older JSON files containing only a
dead imported shape ID are rejected with a request for the original STEP file;
they never contained the geometry needed to reconstruct that shape. A legacy
import still alive in the current CAD worker can be upgraded by Save project.

## Restoration contract

- The document schema checks finite geometry and simulation values, unique
  IDs, feature/sketch references, part/joint references, boolean inputs,
  material IDs and supported experiment configuration before replacing state.
- Each STEP asset has a SHA-256 checksum. Its identity includes whether import
  should preserve local coordinates or apply the usual initial grounding.
  Body IDs combine that immutable asset identity with the extracted body index.
- Every restored body must match its saved count/order, bounding box and mesh
  fingerprint. A mismatched or corrupted asset aborts opening the document.
  These are corruption/identity checks, not digital signatures or proof of a
  trusted author.
- Imported assets are rebuilt before hydration releases the scene. Load also
  reconstructs and checks assets before atomically saving and exposing the new
  state. It deliberately navigates to the saved modelling/simulation mode.
- Running, paused and elapsed physics state reset on opening. The persisted
  geometry remains the design pose; worker handles, caches, selections and
  in-progress editors are transient.

The body mesh fingerprint is coupled to the pinned OCCT/tessellation output.
A future kernel or tessellation change can require a project-format migration;
the current loader rejects mismatched bodies and explains that the original
STEP should be re-imported. It does not silently bind an old reference to a
different body. The original source bytes remain embedded for that recovery.

## Autosave and failure behavior

IndexedDB database `kineticad-projects` contains `current` and `previous`
complete snapshots. A single read/write transaction updates both generations.
Quota or transaction failure retains the old generations and displays an
autosave error; **Save project** can still download current in-memory work.
Changes are captured before asynchronous packaging, debounced for 150 ms and
serialized so an older slow operation cannot overwrite a newly loaded project.
Visibility/page-hide events request a flush. As with browser storage generally,
an abrupt process loss can lose an unfinished save; the last successful complete
snapshot remains the recovery point.

The UI says **Autosave ready** before the first completed save and
**Saving recovery copy…** as soon as an edit is queued. **Recover previous
project** becomes available once a previous generation exists. If the current
copy fails validation on startup, the previous complete copy is attempted.
If neither can be restored, opening is blocked; Retry, Download recovery copies
and Open empty workspace remain available. Failed copies are not silently
deleted. Local browser storage belongs to its origin/device and can be cleared;
a downloaded project is the portable backup.

Demo sessions keep the existing no-op persistence adapter. The original model
and worker remain alive while exploring examples. An already queued original
save may finish; demo edits never enter durable autosave. Save project can
explicitly download an edited demo, including STEP assets imported into it.

## Verification

Run from the repository root, with heavyweight OCCT suites run sequentially:

```sh
pnpm --filter @workspace/kineticad test:project
```

The suite includes native document validation, an action-bearing live Zustand
save regression, corrupted assets, quota failure, recovery fallback, asynchronous
ordering, actual Zustand demo isolation and legacy migration. The CAD tests use
the shipped worker over Comlink with the installed OCCT WASM loader. They import
the reference STEP, download a mixed native/imported project, destroy the worker,
reconstruct assets in a new worker, compare volume/COM/topology, regenerate native
history, and export STEP. A downstream Hole feature is independently checked
against its removed cylinder volume and regenerated after restart.

The reference solid is a 20 × 20 × 10 mm block with a radius-3 through bore:
`V = 4000 − 90π = 3717.2566611769184 mm³`, centroid `[10,10,5]` mm. The extra
radius-1 through hole at `[5,5]` gives `V = 4000 − 100π` mm³. Its disjoint hole
location makes the analytical volume independent of tessellation.

Browser acceptance must separately exercise import, save, refresh, load,
previous-copy recovery, rejected malformed files, modifications and STEP export
through the actual interface. Headless passing tests do not establish that UI
acceptance or successful deployment.
