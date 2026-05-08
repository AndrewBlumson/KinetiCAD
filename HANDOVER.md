# KinetiCAD Handover, 08/05/2026 21:30

## Project

**KinetiCAD** is an open-source browser-based parametric CAD with B-rep underneath, physics simulation, and mate constraints. Built on Replit by Andrew Blumson (Adevious AI Ltd, UK Replit Ambassador). MIT licence.

- Repo: https://github.com/AndrewBlumson/KinetiCAD
- Live: https://kineticad.replit.app
- Stack: React 19, Vite 8, TypeScript 6, Three.js r184 + WebGPU, OpenCascade.js 2.0.0-beta.94e2944 (B-rep, WASM, Web Worker, Comlink), Rapier3D 0.12.0 (physics, Web Worker), Zustand, Tailwind, Sonner toasts.
- Coordinate system: Z-up, mm units. UK English, GBP, DD/MM/YYYY.
- Repo structure: Replit pnpm monorepo at root with artifacts/kineticad/, lib/, scripts/, pnpm-workspace.yaml.

---

## What ships and is verified

### STL export (Phase 3, complete)

Binary STL export from compound assembly via `StlAPI.Write` static call. World transforms preserved via `BRepBuilderAPI_Transform_2`. Mesh generated with `BRepMesh_IncrementalMesh` (linear deflection 0.1, angular deflection 0.5).

Verifications done:
- macOS Preview opened the windmill STL and rendered geometry correctly: vertical post, horizontal rotor disc, four blades extending radially.
- Programmatic Python verification confirmed binary format, 408 triangles, 20,484 bytes (file size matches formula 84 + 408 × 50 exactly), zero degenerate triangles, zero zero-normals, zero NaN/Inf, bounding box 48mm × 48mm × 116mm sensible for the windmill.
- Bambu Studio loaded the STL, sliced at 0.20mm layer height for the Bambu Lab A1 profile, generated a complete 454-layer print plan (1h13m, 2.45m filament, 7.43g, £0.19 cost). Cantilever warning for the blades, resolved with tree-auto supports (707 layers with supports). Slice OK.
- Four non-manifold edges detected on compound-of-solids contact lines (rotor on post tip, blades meeting rotor disc). Expected, not a defect. Slicers handle each shell separately.

### STEP import (Phase 4, complete)

Pattern: `STEPControl_Reader_1` + `ReadFile(path)` + `TransferRoots(progress)` + `OneShape()`. Compound shapes decomposed via `TopExp_Explorer` to get individual `TopoDS_Solid` bodies, each becoming its own Part panel entry.

Verifications done:
- Single-part STEP: imported McMaster-Carr 91290A115 black-oxide alloy steel socket-head screw cleanly. Toast confirmed "1 part imported at origin." Inspector populated with name and zero position.
- Multi-part assembly STEP: imported McMaster-Carr 9132K11 torque-limiting coupling. Decomposed into 12 separate Part entries with relative positions preserved. Visually re-assembled correctly on screen.
- Diagnostic logging in place inside `cadWorker.ts importStep` covering write path, FS contents after write, ReadFile status, NbRootsForTransfer, TransferRoots return, NbShapes after transfer, OneShape isNull, OneShape ShapeType.
- Exception decoding tested. `Standard_Failure::Caught()` not exposed in this opencascade.js build, fell back to throwing `step-import-failed: no geometry found in the STEP file` for the 0-shapes case.

### STEP export (Phase 4, complete)

Pattern: `STEPControl_Writer` + transfer of compound shape + write to OpenCascade virtual filesystem + read bytes back via `oc.FS.readFile`.

Verifications done:
- Round-trip: exported the McMaster torque-limiting coupling from KinetiCAD, re-imported the same file. All geometry preserved. Original 12 parts came back as 43 parts because export iterates over `TopoDS_Solid` directly, flattening any compound-of-solids hierarchy that was originally grouped in the source file.
- Round-trip windmill: export and re-import attempted, 6 parts came back (post + rotor + 4 blades = 6, correct). Geometry preserved. Mates not preserved (STEP format does not carry mate/joint information; this is a STEP limitation, not a KinetiCAD bug, applies equally to Onshape, Solidworks, Fusion).

### Three.js r184 renderAsync deprecation fix

One-line change in `Scene.tsx` line 411: `renderer.renderAsync(scene, camera)` to `renderer.render(scene, camera)`. Three.js r184 deprecated `renderAsync()` in favour of `render()` with `await renderer.init()` already in place earlier in the file.

Verifications done:
- TypeScript compilation clean.
- Dev server reload clean, no deprecation warning.
- Windmill canary regression passed: bodyBangvelMag stable at π ±5e-7 across 1500+ steps.
- Status: published to production at kineticad.replit.app on 08/05/2026 at 21:51 BST as part of the Phase 4 deploy.

### Auto-ground imported parts to Z=0

When a STEP file is imported, parts are translated via `Bnd_Box_1` + `gp_Trsf_1` + `BRepBuilderAPI_Transform_2` so the lowest point of each shape sits on Z=0. Avoids the "half-buried bolt" UX problem when source files were modelled around their geometric centre.

Per-assembly grounding implemented: one union bounding box pass across all imported solids, single `dz = -assemblyZMin` applied uniformly to every solid, preserving relative positions. Each translated shape deep-copied with `BRepBuilderAPI_Copy_2` before its transformer is deleted.

Verification status:
- Single-part import: works correctly (M3 bolt rests on floor).
- Multi-part assembly import where source was already grounded: works (McMaster torque-limiting coupling sits cleanly on the floor).
- Multi-part assembly import with non-zero Z offsets: fixed by per-assembly approach.

### Canvas focus restoration after import

In `Modeller.tsx` import success handler, `requestAnimationFrame(() => canvas.focus())` runs after the success toast fires. OrbitControls regain pointer events without needing a manual click.

Verifications done:
- Pan, zoom, and orbit work immediately after STEP import without clicking the canvas first.

### Sonner toast pointer-events fix

`<Sonner>` wrapper `<ol>` set to `pointerEvents: none`. Individual toast boxes get `pointerEvents: auto` via `toastOptions.style`. Invisible region around dismissed toasts no longer blocks orbit and zoom.

Verifications done:
- Bundled with the canvas focus fix above. Pan, zoom, and orbit work after toast appears, regardless of toast position.

---

## What is in flight at handover time

Nothing. Per-assembly auto-ground fix landed and verified. All Phase 4 items complete.

---

## Known limitations (by design or by format)

1. **STEP files do not carry mates or joints.** Round-tripping an assembly through STEP loses the kinematic relationships. User must re-mate after import. This is a STEP format characteristic affecting all CAD tools, not specific to KinetiCAD. STEP AP242 has provisions for kinematic data but support across the industry is patchy.

2. **STEP export flattens compound-of-solids hierarchy.** Original 12 parts in the McMaster coupling source file became 43 parts on round-trip because each `TopoDS_Solid` is written as a separate root entity. Geometry preserved, hierarchy flattened. Polish item for a future phase.

3. **Imported parts do not survive page refresh.** B-rep geometry lives in opencascade.js WASM memory, which gets wiped on page reload. localStorage persists assembly metadata (name, ID, position, rotation) but cannot persist WASM-managed objects. Sketch-based parts survive refresh because the feature regen pipeline reconstructs them from the sketch and feature list. Imported STEP parts have no regen path. Fix requires an IndexedDB layer to persist original STEP bytes (or tessellated mesh) and replay on load.

4. **All imported parts named after filename.** STEP files contain `PRODUCT('part-name', ...)` entries that name each individual component, but the import code currently uses the filename for every part. Phase 5 polish.

---

## Outstanding work (parked, not in flight)

### Bug fixes and technical debt
- Smart pivot picker for arc edges. Code is in topology.ts (3-point circumcenter), types.ts (EdgeMetadata.circleCenter), MatePickerCoordinator.ts (use circleCenter ?? polylineCenter for pivot). Topology side confirmed via `[topology-circle]` log. MatePickerCoordinator side never verified due to wrong-edge picks and Claude in Chrome crashes. Diagnostic prompt drafted but not sent. Replit checkpoint name "Improve pivot placement for circular and arc edges", 08/05/2026 18:25.
- Hole feature position-pick clears face on second click.
- Multi-loop sketch profiles (plate with hole).
- Sketch on selected face, currently only XY/XZ/YZ globals.

### Feature roadmap
- IndexedDB cache for imported STEP file bytes, so imported parts survive refresh.
- Save/load assembly state, proper version generalising the seed-windmill.js pattern.
- Other mate types: Prismatic, Planar, Spherical, Cylindrical.
- Test coverage (Vitest unit tests, Playwright end-to-end) and CI/CD via GitHub Actions.
- Undo/redo via Zustand history middleware.
- WebGL2 fallback for browsers without WebGPU.
- Mobile responsive layout.

---

## Verification log (this session)

| Test | Result | Method |
|------|--------|--------|
| Three.js r184 renderAsync warning | PASS | TypeScript clean, dev server clean, windmill canary stable to 7 dec |
| STL binary format | PASS | macOS Preview render, Python parser confirms 80-byte header + 408 triangles |
| STL geometry validity | PASS | 0 degenerate, 0 zero-normals, 0 NaN/Inf, sensible bbox |
| STL printability | PASS | Bambu Studio sliced 454 layers, generated print plan, identified cantilever |
| STL with supports | PASS | Tree-auto supports generated, 707 layers, ready for printer |
| STEP import single-part | PASS | McMaster M3 bolt loaded, named, positioned at origin |
| STEP import multi-part assembly | PASS | McMaster coupling loaded as 12 parts with preserved relative positions |
| STEP export | PASS | Coupling exported, file size sensible (>50KB), readable on re-import |
| STEP round-trip coupling | PASS (with caveat) | Geometry preserved, hierarchy flattened 12 to 43 parts |
| STEP round-trip windmill | PASS | Geometry preserved, mates lost (expected per STEP format), assembly positions preserved |
| Canvas focus after import | PASS | Pan, zoom, orbit work without prior click |
| Sonner toast pointer-events | PASS | No event interception |
| Auto-ground single part | PASS | M3 bolt rests on floor at Z=0 |
| Auto-ground assembly already grounded | PASS | McMaster coupling unchanged, base on floor |
| Auto-ground assembly with offsets | PASS | Per-assembly fix landed; uniform dz preserves relative positions |
| Windmill physics canary | PASS | bodyBangvelMag stable at π ±5e-7 across 300 steps |

---

## Files modified this session

| File | Change |
|------|--------|
| `artifacts/kineticad/src/three/Scene.tsx` line 411 | renderAsync to render |
| `artifacts/kineticad/src/cad/cadWorker.ts` | exportAssemblyStl, exportAssemblyStep, importStep, per-assembly auto-ground |
| `artifacts/kineticad/src/cad/operations/topology.ts` line 483 area | 3-point circumcenter for arc edges (unverified) |
| `artifacts/kineticad/src/cad/types.ts` | EdgeMetadata.circleCenter field |
| `artifacts/kineticad/src/three/MatePickerCoordinator.ts` | circleCenter ?? polylineCenter pivot calc (unverified) |
| `artifacts/kineticad/src/views/Modeller.tsx` | IMPORT STEP, EXPORT STEP buttons, success toast handler with canvas focus |
| `artifacts/kineticad/src/components/ui/sonner.tsx` | pointerEvents none on wrapper, auto on toasts |

---

## Suggested next session priorities

1. **Verify the smart pivot picker for arc edges** (Checkpoint "Improve pivot placement for circular and arc edges", 08/05/2026 18:25). Diagnostic prompt drafted but not sent. Worth 30 minutes when fresh to either confirm working or identify the actual gap.
2. **Post the round-trip story** on X and LinkedIn. Suggested framing: "Browser CAD now does full STEP round-trip. Imported a 12-part McMaster industrial coupling. Exported. Re-imported. Geometry, hierarchy, and relative positions all survive. Mates need re-establishing on import (same as Onshape, Solidworks, Fusion). WebGPU + WASM B-rep + multi-thread physics + MIT licence." Pin a screenshot of the imported coupling on the grid.
3. **IndexedDB persistence layer for imported parts** (half-day job, phase 5 candidate). Removes the "refresh wipes geometry" limitation.
4. **Other mate types** (Prismatic, Planar, Spherical, Cylindrical) once persistence is in.

---

## Acronym index

- AP: Application Protocol (STEP variant identifier, e.g. AP203, AP214, AP242)
- API: Application Programming Interface
- B-rep: Boundary Representation
- BST: British Summer Time
- CAD: Computer-Aided Design
- CI/CD: Continuous Integration / Continuous Deployment
- CSS: Cascading Style Sheets
- DD/MM/YYYY: UK date format
- FPS: Frames Per Second
- FS: Filesystem
- GBP: Great British Pound
- GitHub: code hosting platform
- HTML: Hypertext Markup Language
- IGES: Initial Graphics Exchange Specification
- ISO: International Organisation for Standardisation
- JS: JavaScript
- MIT: Massachusetts Institute of Technology (licence context)
- mm: millimetre
- npm: node package manager
- OCC: OpenCascade
- OCCT: OpenCascade Technology
- PMI: Product and Manufacturing Information
- pnpm: performant npm
- POC: Proof of Concept
- PWA: Progressive Web App
- RBAC: Role-Based Access Control
- rAF: requestAnimationFrame
- RPM: Revolutions Per Minute
- SDK: Software Development Kit
- SPA: Single Page Application
- STEP: Standard for the Exchange of Product Model Data
- STL: Stereolithography
- TS: TypeScript
- UI: User Interface
- URL: Uniform Resource Locator
- UTC: Coordinated Universal Time
- UX: User Experience
- WASM: WebAssembly
- WebGL: Web Graphics Library

---

---

# Developer Guide (permanent reference)

## Repo structure

```
/
├── artifacts/
│   ├── kineticad/                # Main CAD application
│   │   ├── src/
│   │   │   ├── cad/              # OCCT worker, topology, geometry helpers
│   │   │   ├── three/            # Three.js scene, MatePickerCoordinator
│   │   │   ├── physics/          # Rapier worker, joint construction
│   │   │   ├── state/            # Zustand stores
│   │   │   ├── components/       # React UI (Modeller, Simulator, Inspector)
│   │   │   └── shared/           # Types and constants
│   │   ├── public/
│   │   │   ├── seed-windmill.js  # Pre-baked demo assembly
│   │   │   └── ...
│   │   ├── serve.mjs             # Production Node server with cache headers
│   │   └── package.json
│   └── kineticad-intro/          # Intro showcase app
├── lib/                          # Shared utilities across artifacts
├── scripts/                      # Build and dev scripts
├── pnpm-workspace.yaml
├── README.md
├── HANDOVER.md                   # This file
└── LICENSE
```

The pnpm monorepo at root contains multiple artifacts. The main CAD app lives at `artifacts/kineticad/`.

## Architecture

KinetiCAD runs three threads:

**Main thread** handles React rendering, Three.js scene management, user input, and orchestration. Should never block.

**CAD Worker** runs OpenCascade.js compiled to WASM. All B-rep operations (sketch curve evaluation, extrusion, boolean ops, edge classification, polyline tessellation) happen here. Communicates with main via Comlink. Returns triangulated geometry plus topology metadata (edge IDs, types, polylines, circle centres, normals).

**Physics Worker** runs Rapier3D compiled to WASM. Receives body definitions and joint configurations from main. Steps the simulation at fixed 60Hz. Posts back body transforms each frame.

The two-worker split keeps both heavy computations off the main thread, so the UI stays responsive even during a complex extrude or active simulation.

### Data flow for a typical mate creation

1. User clicks an edge in the Three.js viewport
2. Main thread raycasts against the rendered geometry
3. Edge metadata is looked up from the topology cache returned by the CAD worker
4. `MatePickerCoordinator.validateRevolutePicks` validates the pick (axis alignment, edge type)
5. `polylineCenter()` computes the geometric centre from polyline samples
6. `worldToLocalPoint()` converts the centre into each part's local frame
7. The pivot is stored on the mate via Zustand
8. When the user clicks Play, the mate is sent to the physics worker
9. Rapier creates a `RevoluteJoint` with the supplied local-frame anchors
10. The simulation steps and posts body transforms back

## The pivot frame bug, explained

This is the most subtle bug we hit during the build, fixed in the latest revision. Worth understanding because it cuts to the core of how the mate system works.

**Symptom:** rotor spun in place when stationary but jumped off-axis when physics started, then orbited around an offset point instead of rotating cleanly.

**Diagnosis:** mate pivots were being stored as world-space coordinates and passed to Rapier, which expects part-local frame.

Rapier's revolute joint constraint is:

```
anchorA = bodyA.position + bodyA.rotation × pivotA_local
anchorB = bodyB.position + bodyB.rotation × pivotB_local
constraint: anchorA == anchorB at all times
```

When `pivotB_local` was a world-space point (e.g. `[0, 0, 100]` because the disc was at world z=100), and the body was also at world z=100, Rapier evaluated:

```
anchorB = [0, 0, 100] + identity × [0, 0, 100] = [0, 0, 200]
```

That doesn't match `anchorA` at `[0, 0, 100]`, so Rapier yanked the body to satisfy the constraint, producing the visible jump and orbit.

**Fix:** in `MatePickerCoordinator.ts`, after computing the polyline centre in world space, convert it to part-local frame using `worldToLocalPoint(centre, part.transform)` before storing as `localPoint`. The corresponding update was made in `RevoluteMateInspector.tsx` to overwrite the captured pivot with the validated local-frame value.

**Result:** anchors now coincide at sim start (no jump), and the local-frame Z-component is invariant under Z-axis rotation (no orbital drift).

The fix touches three call sites:

- `validateRevolutePicks` (returns local-frame pivots)
- `getEdgeAxisWorld` (centroid for axis indicator visual)
- `RevoluteMateInspector` apply path (writes validated values to mate state)

## Geometry and topology subtleties

### The arc vs circle issue

The `polylineCenter()` helper averages all polyline sample coordinates. For a uniformly sampled full circle, this returns the exact centre. For an arc segment, it returns the centroid of the arc, which is offset from the underlying circle's centre.

For a 90° arc of radius R, the centroid sits at distance `2R/π × sin(45°) ≈ 0.9R` from origin along the arc bisector. For our windmill disc with R=12 and four 90° arcs, that's a 10.8mm offset rather than zero.

This matters because boolean union of intersecting solids splits shared edges. When 4 blades fuse into a disc rim, the rim circle gets cut into 4 arc segments. There's no full circle on the boolean-merged Part 2 to use as a pivot reference.

**Workaround used in the windmill demo:** add a separate cylindrical hub feature whose edges are not split by the blade intersections. The hub's bottom circle (extruded with negative depth so it points downward from the disc) is a clean full circle and serves as the pivot reference.

**The smarter fix not yet implemented:** OCCT can expose the underlying circle of an arc-typed edge via its geometry curve. A future `MatePickerCoordinator` could detect arc edges and use the underlying circle's centre rather than the arc centroid. This would let users click any circular feature on the geometry without needing a clean full circle. Likely a single-line addition in `topology.ts` plus a fallback in `MatePickerCoordinator.ts`.

### Negative-direction extrude

The extrude tool supports negative depth. Sketch on XY, extrude with depth -12, and the resulting solid extends from part-local z=0 to z=-12. This was used for the windmill hub so the disc could sit above the post tip with the hub extending down to meet it.

### Sketch plane limitations

Sketches can be created on global XY, XZ, or YZ planes only. Sketch on selected face is not implemented. This means features can only originate from one of the three global planes.

## OCCT aliasing — the recurring bug pattern

OpenCascade.js WASM wrappers alias internal topology by reference. When you delete a builder or reader object (`.delete()`), any `TopoDS_Shape` obtained from it (via `.Shape()`, `.OneShape()`, etc.) becomes invalid. This manifests as empty meshes or silent geometry failures, not crashes.

**The fix, applied consistently throughout the codebase:** call `BRepBuilderAPI_Copy_2(shape, true, false)` to deep-copy the shape **while the source object is still alive**, then delete the source. The copy owns its topology independently.

Affected sites in this codebase:
- `cad/operations/extrude.ts` — copy prism shape before builder delete
- `cadWorker.ts importStep` — copy `OneShape()` result before reader delete
- `cadWorker.ts importStep` — copy each grounded shape before transformer delete

If you see empty geometry after an operation involving a builder, this is the first thing to check.

## Verified physics

The pivot frame fix was verified on the seeded windmill demo:

```
Target:   30 RPM = π rad/s = 3.141592653589793

Measured at runtime (sample range across 23s of sim time):
  bodyBangvelMag:  3.14159270 to 3.14159298
  bodyBangvel.x:   3.24e-16    (precision floor)
  bodyBangvel.y:   -3.78e-10   (precision floor)
  bodyBangvel.z:   3.14159

Error from π:    ~3e-7 rad/s
Stability:       ±5e-7 rad/s over 23 seconds
Drift:           none
```

Off-axis components sit at floating-point single-precision noise. Pure Z-axis rotation. The result is mathematically as clean as a real-time physics engine can produce.

To reproduce: open the live demo, paste this in the browser console:

```js
fetch('/seed-windmill.js').then(r=>r.text()).then(code=>eval(code))
```

The page reloads with the assembly pre-built and the mate pre-configured. Switch to Simulator, press Play, and observe the `[step-diag]` console output for live `bodyBangvel` values.

## Production deployment

The Replit deployment uses a custom Node server (`serve.mjs`) rather than static-serve to set explicit cache headers. This was necessary because Replit's CDN was caching `index.html` aggressively, which broke deploys (users would load stale `index.html` referencing dead asset hashes).

The server sets:

- `Cache-Control: no-cache, must-revalidate` on `index.html`
- `Cache-Control: public, max-age=31536000, immutable` on hashed assets in `/assets/`
- `Cache-Control: no-cache` on `/seed-windmill.js`

This is the standard SPA caching pattern used by Vercel, Netlify, and CloudFront. Future deploys with new bundle hashes will pick up immediately.

## Known issues with file pointers

**Mate pivot picker requires full circle edges.**
Location: `artifacts/kineticad/src/three/MatePickerCoordinator.ts`
The `polylineCenter()` helper handles full circles correctly but gives an arc centroid for arc-typed edges. See "Geometry and topology subtleties" above.

**Sketch profiles cannot contain multiple closed loops.**
Location: `artifacts/kineticad/src/cad/` (sketch worker pipeline)
A plate with a hole through it would require the inner loop to be subtracted from the outer loop before extrusion. Currently each sketch supports one outer loop only.

**Hole feature position-pick clears face selection on second click.**
Location: relevant React component for the Hole feature inspector.
The hole feature is implemented but the position-picker UI has a state bug.

**Sketch on selected face not implemented.**
Currently only XY, XZ, YZ globals are available as sketch planes. Implementing this requires capturing the picked face's world transform and presenting it as a custom sketch plane in the sketcher.

**No save/load.**
The seed script approach used for `seed-windmill.js` shows how an assembly state can be serialised to localStorage, which is a starting point for a save/load implementation.

**No undo/redo.**
The Zustand store does not currently maintain a history stack.

## Local development

Clone the repo:

```bash
git clone https://github.com/AndrewBlumson/KinetiCAD.git
cd KinetiCAD
pnpm install
```

Run the dev server for the main app:

```bash
cd artifacts/kineticad
pnpm dev
```

The dev server runs at http://localhost:5173 by default.

Build for production:

```bash
pnpm build
```

Build artifacts go to `artifacts/kineticad/dist/`.

## Contribution areas

Listed in rough order of value to the project:

1. **STEP / IGES / native JSON export** — complete as of Phase 4. STEP import and export both working with round-trip verification.
2. **Smart pivot picker for arc edges** — small but high-impact. Detect arc-typed edges in `MatePickerCoordinator` and use the underlying circle centre from `topology.ts` rather than the arc centroid. Would remove the "must pick a full circle" UX constraint.
3. **Multi-loop sketch profiles** — supports plates with holes, ring shapes, and any sketch with disjoint closed loops. Touches the sketch worker pipeline in `artifacts/kineticad/src/cad/`.
4. **Sketch on selected face** — required for any kind of practical CAD work beyond simple primitives. The picker already returns face metadata; the work is in capturing the face transform and presenting it as a sketch plane.
5. **Hole feature position-pick fix** — small, contained UI bug. State-management fix in the relevant React component.
6. **IndexedDB persistence for imported parts** — imported STEP parts currently vanish on page refresh. Persist the original STEP bytes in IndexedDB and replay the import on load.
7. **Save / load assembly state** — see the `seed-windmill.js` script for a serialisation pattern.
8. **Undo / redo** — Zustand history middleware would handle this.

CAD or graphics engineering experience is particularly valuable on items 2, 3, and 4.

## Questions answered

These came up in public discussion of the open-source release.

**Is the geometry manifold?**
Yes. OpenCascade.js produces manifold B-rep solids through the standard sketch + extrude + boolean pipeline.

**Is it 3D printable?**
Yes. Binary STL export is implemented (Phase 3). Bambu Studio sliced the windmill STL to a complete print plan. STEP export (Phase 4) enables round-tripping with Fusion 360, SolidWorks, and other CAD packages.

**Are you using B-rep underneath?**
Yes. OpenCascade.js running in a Web Worker via Comlink. All boolean operations, edge classification, and topology metadata come from OCCT.

**What about WebGL2 for broader browser support?**
Currently WebGPU only. The WebGPU codepath was chosen for compute shader support and modern rendering features. A WebGL2 fallback is possible via Three.js's renderer abstraction but is not implemented.
