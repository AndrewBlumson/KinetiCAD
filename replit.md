# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## KinetiCAD (`artifacts/kineticad`)

Browser-based parametric CAD tool with planned live physics simulation. Built per a 12-phase spec; one phase at a time.

**Stack**: Vite + React 19 + TypeScript, Tailwind, Zustand store, Three.js r184 (WebGPURenderer), OpenCascade.js (Web Worker via Comlink).

**Phase status**:
- Phase 0 ✅ — App shell, dark navy theme (`#0A0E1A` bg, `#FF6B1A` orange), routes (`/` Modeller, `/simulator` Simulator), Zustand store + Zod schemas, sidebar/toolbar/inspector layout.
- Phase 1 ✅ — WebGPU scene with grid/axes/orbit camera + OpenCascade.js worker rendering a tessellated 10mm test cube. Real `requestAdapter()` detection with graceful "WebGPU required" fallback.
- Phase 2 Split A ✅ — Sketch entry: PlanePicker (XY/XZ/YZ), 600 ms `easeInOutCubic` camera tween to plane-aligned view, sketch-mode toolbar swap, sketch plane overlay (400×400 mm `#141B2E` rect + 3-tier `#1F2942` grid at 1/5/10 mm), Zustand `sketchSession` state machine + `persist` middleware (key `kineticad-state`, partialised to exclude `sketchSession` and live `simulation.running`). Auto-creates "Part 1" on first `finishSketch` since spec stores sketches inside `assembly.parts[].sketches`. Inspector shows `Sketch N (plane) — N primitives`. Drawing tools deferred to Split B.
- Phase 2 Split B ✅ — Sketch drawing tools (line, rectangle, 3-point arc, circle), per-tool state machines, snap engine (endpoint > midpoint > grid priority, Alt = free, ~5px screen pickup radius via `screenRadiusToWorldMm`), in-flight rubber-band rendering and committed primitive lines via Three.js `Line2`/`LineGeometry`/`LineMaterial`, snap markers (orange dot/diamond/triangle, `depthTest:false`), DOM crosshair + coordinate label updated via module-level event bus to bypass React re-renders. Persistent `finishedSketchesLayer` overlays past sketches (1.5px @ 0.6 opacity) on every camera angle. The in-flight primitive is intentionally LOCAL to the `SketchSession` class (not Zustand) so 60Hz mousemoves don't trigger any React renders; only `committedPrimitives` lives in the store. `SketchSession.ts` exports `SketchSessionHandle` (renamed to avoid clashing with the store's `SketchSession` state type). `Scene.tsx` reconciler creates/disposes the handle on session entry/exit, propagates plane and tool changes, and pipes ResizeObserver into both layers' Line2 `resolution` uniforms. Right-click cancels in-flight, Escape resets tool state, re-clicking the active tool toggles back to idle. CSS `cursor: none` is scoped to `main[data-kineticad-canvas-host="true"]` while sketch mode is active.
- Phase 3 Split A ✅ — Kernel + state plumbing for Extrude/Revolve. **No UI/Scene changes** in this split. Schema split out `ExtrudeFeature`/`RevolveFeature`; `Feature.extrude` now uses `direction: 'forward'|'backward'|'symmetric'` instead of `symmetric: boolean` (persist v1→v2 migration in `store.ts` maps the legacy field). Store gained `selection` and `featureEditor` slices with `selectSketch/selectFeature/clearSelection`, `beginCreateFeature/beginEditFeature`, `setFeatureEditor*Params`, `setFeatureEditorLivePreview`, `applyFeatureEditor`, `cancelFeatureEditor`. Worker now exposes `extrude(args)` and `revolve(args)` over Comlink, returning transferred `TessellatedMesh` buffers. New `src/cad/operations/`: `tessellate.ts` (extracted from cadWorker, fixes a transient gp_Pnt leak in the node loop by `.delete()`-ing `pnt` and `transformed` per node), `sketchToWire.ts` (vertex-merge graph at 0.001mm tolerance, edge-chain ordering with reverse support via `edge.Reversed()` + `TopoDS.Edge_1`, special cases: empty/mixed/multi-closed rejected, single circle uses `MakeEdge_8`), `extrude.ts` (face from wire, symmetric translate via `gp_Trsf.SetTranslation_1`, prism via `BRepPrimAPI_MakePrism_1`), `revolve.ts` (`gp_Ax1_2(origin, dir)` through world origin, `BRepPrimAPI_MakeRevol_1`). New `src/features/`: `featureCache.ts` (hash → mesh map) and `featureRegen.ts` (`regeneratePart` walks features in order, computes stable FNV-1a hash of `feature + sketch.{plane,primitives} + upstreamHashes` for cascade invalidation; `previewFeature` for the inspector's live-preview path).
- Phase 3 Split B ✅ — UI + Scene integration. Phase 1's hard-coded test cube is gone; the scene now reflects the assembly. New `src/three/PartMeshLayer.ts` (imperative class, `Map<partId, Mesh>`, shared `MeshStandardMaterial` `#A0A8B5` metal 0.4 rough 0.5 disposed once on layer dispose, per-entry `inFlightToken` + `alive` flags **plus** layer-level `isDisposed` so stale `regeneratePart` resolutions cannot resurrect hidden parts or leak geometry; the token is bumped on every state transition including hide / no-features / remove / dispose) and `src/three/PreviewMeshLayer.ts` (single optional preview mesh, transparent at opacity 0.85, `depthWrite:false`, geometry rebuilt and prior disposed on every `setMesh`). `Scene.tsx` instantiates both layers once the kernel resolves, subscribes to `assembly`/`featureEditor` changes, and runs a 200ms-debounced live-preview pipeline (`computeFeatureHash` skip, incrementing `previewToken` race guard, `mapKernelError` for user-facing errors, preview cleared and token invalidated on editor close). `hiddenPartId = editor.open && editor.livePreview ? editor.partId : null` so the preview overlay visually replaces the targeted part. New store slice `featurePreview: { status, error }` (non-persisted), reset on apply/cancel; written by Scene in idle/computing/ok/error states; read by Extrude/RevolveInspector to surface red error chips. New `src/features/kernelErrors.ts` maps OCCT/sketchToWire throw strings to user-facing copy (wire-not-closed / empty / multiple-closed / mixed / gap / self-intersection / depth/angle / generic OCCT). New components: `NumericInput.tsx` (text + ▲/▼, hold-to-repeat 100ms→50ms after 1s, Arrow keys with Shift×10, blur clamp + format, 200ms-debounced external `onChange` flushed immediately on step/arrow/Enter), `SegmentedControl.tsx` (typed `<T extends string>`), and inspectors `SketchInspector` / `ExtrudeInspector` / `RevolveInspector` / `FeatureInspector` (router). `Modeller.tsx` rebuilt: feature tree clicks dispatch `selectSketch` or `selectFeature`+`beginEditFeature`; selection highlight is a 2px `#FF6B1A` left border + `rgba(255,107,26,.08)` bg; right inspector switch order = active sketch → editor open → selection.kind sketch → selection.kind feature → empty; clicking the inspector's empty area calls `clearSelection`. Persist v2 unchanged.
- Phase 4 Split A ✅ — Topology picking infrastructure (no Fillet/Chamfer/Hole yet — those are Split B). New `src/cad/operations/topology.ts` enumerates edges + faces from any TopoDS_Shape: stable IDs are FNV-1a hashes of canonical geometry (line: sorted endpoints; circle/arc: centre+radius+canonical-axis(+normalized angles); plane: canonical-normal+origin; cylinder/cone/sphere/torus: axis+radii+angles; everything de-canonicalized via `canonicalDir` so OCCT's direction-sign caprices don't fragment IDs across regenerations) plus a per-bucket *occurrence index* tie-breaker that keeps geometrically-coincident-but-topologically-distinct entities (e.g. a cylinder seam edge that the explorer reports twice) distinguishable — TopExp_Explorer order is deterministic for a given B-Rep so the indices are reproducible. **Critical**: edge polylines are sampled directly through `BRepAdaptor_Curve.D0(t, gp_Pnt)` (not via a manually-built `cross(axis, seed)` frame) so circle/arc segments land on the curve's actual angular sector rather than an arbitrary plane. Per-face triangle ranges flow from `tessellate.ts` (now per-face try/finally with explicit `.delete()` for every transient: `face`, `location`, `triangulationHandle`, `transformation` from `location.Transformation()`, `tri` from `triangulation.Triangle(i)`, `pnt`/`transformed`, `gp_Vec3f`) and zip with the topology walk's k-th face. Every accessor wrapper in `topology.ts` (`adaptor.Circle/Plane/Cylinder/Cone/Sphere/Torus`, then `.Axis/.Position/.Location/.Direction/.XDirection/.YDirection`) is run through a `withWrapper(make, fn)` helper that always `.delete()`s in finally. `TessellatedMesh` extended with `edges: EdgeMetadata[]` + `faces: FaceMetadata[]`; the worker transfers all polyline + triangle buffers via `collectTransferables`. Schemas got `EdgeRef` / `FaceRef`. Store gained a `Selection` union extension (`'edges'|'face'|'point-on-face'`), non-persisted `pickingMode` + `showPickerTestPanel`, and actions `selectEdges(partId, ids, additive?)` (toggle semantics; merged-empty → `selection:null`), `selectFace(partId, faceId)`, `selectPointOnFace(partId, faceId, uv)`, `togglePickerTestPanel`. `PartMeshLayer` carries per-Entry `topology` + a `faceForTriangle: Uint32Array(triCount)` (sentinel `0xffffffff`) and exposes `getPartMesh` / `getPartTopology` / `forEachVisible` / `topologyVersion()`; topology is cleared on hide / no-features / remove / dispose alongside the existing token bump. New `src/three/EdgeHighlightLayer.ts` and `FaceHighlightLayer.ts` use shared `Line2`+`LineGeometry`+`LineMaterial` with `polygonOffset:true` polygons (depthWrite:false, transparent, doubleSide) and dispose all geometries + the shared materials exactly once; boundary outlines for selected faces extracted with `extractBoundaryPolylines` (count edges per face, emit those with count===1 as 2-point Float32Arrays — robust enough for manifold tessellations). `TopologyPicker.ts` does screen-space edge proximity (8px) via `vec.project(camera)` segment-distance with a single-slot result-box to defeat closure narrowing, raycaster face hits → `faceForTriangle` lookup, click-vs-drag distinction (4px on mousedown→mouseup, mouseup listened on `window` so off-canvas releases still cancel the click), and planar point-on-face UV via the captured `planeBasis`. `Scene.tsx` instantiates all three plus `topologyPicker.setResolution` on `ResizeObserver`; the selection subscriber runs `resolveSelectionHighlights` which now also invalidates stale selections (clears `selection:null` when topology is loaded but the referenced edge/face IDs no longer resolve, e.g. after the user re-extruded with different topology); a per-frame `topologyVersion()` check re-resolves on regen completion without busy-looping (only re-runs when version or selection identity actually changes). `Modeller.tsx` listens for Cmd/Ctrl+Shift+T (matched by `KeyboardEvent.code === 'KeyT'`, ignored when an INPUT/TEXTAREA/SELECT/contentEditable is focused) and floats the diagnostic `TopologyPickerTestInspector` (radio mode + selection readout + Clear) at top-right of the canvas while `showPickerTestPanel` is true. COLOURS extended with `highlightHover` (#ffd24a) and `highlightSelected` (#ff6b1a). All new state is non-persisted; persist key remains `kineticad-state` v2.
- Phase 4 Split B ✅ — Modifier features Fillet, Chamfer, Hole. Schema bumped persist v2→v3 with idempotent `positionXY → positionUV` rename on hole features (no-op for v2 data, which has none). New `cad/operations/`: `fillet.ts` uses `BRepFilletAPI_MakeFillet(shape, ChFi3d_Rational)` + `Add_2(radius, edge)` per target edge resolved through `enumerateEdgeRefs`, with `Build(Message_ProgressRange_1)` + `IsDone()` gate; errors classified as `fillet-radius-too-large` / `fillet-self-intersect` / `edge-not-found`. `chamfer.ts` mirrors the structure with `BRepFilletAPI_MakeChamfer` + `Add_2(size, edge)` and `chamfer-size-too-large`. `hole.ts` builds a cylinder via `gp_Pnt_3 + gp_Dir_4 + gp_Ax2_3 + BRepPrimAPI_MakeCylinder_3` along the inward face normal, then `BRepAlgoAPI_Cut_3` with a one-shot `SetFuzzyValue(0.001)` retry on first failure. Through-all sizing = `2 × Bnd_Box_1.CornerMin/Max` diagonal in mm with the cylinder origin shifted outward by `length/2` so it spans the part on both sides; explicit `depthMm > 0` runs origin-at-surface inward. `topology.ts` got `enumerateEdgeRefs` and `enumerateFaceRefs` (same canonical-hashing + occurrence-index disambiguation) returning `Map<id, TopoDS_Edge|Face>` plus `disposeRefMap` for `.delete()` hygiene. `cadWorker.ts` exposes `fillet/chamfer/hole`, each driven by `executeUpstreamChain(features, sketches)` that walks the upstream chain in order, freeing intermediate shapes; the hole branch tessellates+enumerates the upstream once to grab the target face's `planeBasis` + `normalAtCentroid` alongside its TopoDS_Face wrapper. `features/featureRegen.ts` `runFeature` now takes `upstreamFeatures: Feature[]`; modifier hashes fold in upstream feature hashes so editing an upstream extrude invalidates downstream modifier caches. `features/kernelErrors.ts` extended with `edge-not-found / face-not-found / fillet-radius-too-large / fillet-self-intersect / chamfer-size-too-large / boolean-failed` and matching pattern detection. Store: `FeatureEditor` union extended with fillet/chamfer/hole variants (modifier `sketchId: ""`); new `beginCreateFilletFeature/ChamferFeature/HoleFeature` (each set `pickingMode` to `'edges'` or `'point-on-face'` and clear selection); `beginEditFeature` populates from existing feature; `applyFeatureEditor` skips when targets missing; `cancelFeatureEditor` resets `pickingMode` to `'idle'`; new `Selection` kind `'part'` + `selectPart` action; `showPickerTestPanel/togglePickerTestPanel` removed. New inspectors: `PartInspector` ("+ Fillet/Chamfer/Hole" buttons, disabled until the part has a base feature) — **this is the v1 placement of the "+ Add Feature" menu** (clicking the part name in the tree opens it); `FilletInspector`/`ChamferInspector` (edge list with × remove, single distance NumericInput, useEffect on `[selection]` toggles edge ids into params then `clearSelection` to break the loop); `HoleInspector` (face slot + Clear, position slot, diameter, depth with "Through-all" label when 0; useEffect handles both face- and point-on-face stages with stale-selection defence). `FeatureInspector` routes the three new types. `Modeller.tsx` removed Cmd+Shift+T diagnostic, the picker test panel render, and the test inspector import; deleted `TopologyPickerTestInspector.tsx`; part-name sidebar item is now clickable + selectable, surfaces `PartInspector` in the right panel. `Scene.tsx` `runPreview` constructs fillet/chamfer/hole feature objects, derives `upstreamFeatures` (excluding the feature being edited in `mode === 'edit'`), and calls the new `previewFeature(feature, sketches, upstream, kernel)` signature — skips entirely when targets are missing.
- Phase 5 ✅ — Boolean Operations (Union / Subtract / Intersect) at the assembly level. Schema bumped persist v3→v4 with `Assembly.booleanFeatures: BooleanFeature[]` (id, type, `operation: { union | subtract+toolPartId | intersect }`, `inputPartIds`, `resultPartName`, `hideInputs`); migration adds `booleanFeatures: []` and strips any legacy per-part `boolean` Feature stubs, with a defensive guard for partially-migrated v4 rows that lack the field. New `cad/operations/boolean.ts` validates each input is a solid via `BRepCheck_Analyzer` + `ShapeType()` (rejects with `invalid-input-not-solid`), then runs `BRepAlgoAPI_Fuse_3 / Cut_3 / Common_3` pairwise across all inputs (subtract requires exactly 2 in `[body, tool]` order — `subtract-needs-tool` if violated) with a single one-shot `SetFuzzyValue(0.001)` retry on first `IsDone()` failure; an empty-result `Bnd_Box` zero-volume probe surfaces `empty-result` distinctly from `boolean-failed`. `cadWorker.ts` exposes `booleanOp(args)` that re-executes every input part's chain via `executeUpstreamChain`, applies the operation, tessellates with topology, transfers buffers, and `.delete()`s every input + intermediate + result in `finally`. New `features/assemblyRegen.ts`: `computePartChainHash(part)` (folds sketch + ordered feature hashes), `computeBooleanHash(feature, parts)` (operation type + ordered input chain hashes; subtract canonicalised to `[body, tool]`), `regenerateBoolean(feature, parts, kernel)` cache-aware orchestrator returning `{ mesh, hash, error }`. Store gained `booleanEditor` slice (separate shape from `featureEditor`), `Selection { kind: 'boolean', booleanId }`, actions `selectBoolean / beginCreateBoolean(opType) / beginEditBoolean(featureId) / setBooleanEditorParams / setBooleanEditorLivePreview / applyBooleanEditor / cancelBooleanEditor / deleteBooleanFeature / deletePartCascade / getBooleansUsingPart`; `applyBooleanEditor` validates 2–8 inputs (Union/Intersect), exactly 2 ordered inputs for Subtract, unique non-empty `resultPartName` (clashes with other booleans rejected); auto-suggests "Union 1" / "Subtract 1" / "Intersect 1" on `beginCreate`. New `components/inspectors/BooleanInspector.tsx` (operation `SegmentedControl`, input-parts checkbox list, tool-part radio shown only for Subtract — auto-pick first input on op switch + auto-fix when the chosen tool drops out of inputs, result-name TextInput, hide-inputs checkbox default on, live-preview toggle, inline validation hints, error chip, Apply / Cancel + edit-mode Delete). New `three/BooleanResultLayer.ts` mirrors `PartMeshLayer`'s lifecycle keyed by `booleanFeature.id` (slightly warmer base colour `0xA8B0BC`) — uses `regenerateBoolean` with the same per-entry `inFlightToken + alive` flags + layer-level `isDisposed` race guard; the editor's currently-edited boolean is hidden from this layer so the preview mesh replaces it. `three/PartMeshLayer.ts` `sync` signature changed from `hiddenPartId: string | null` to `hiddenPartIds: Set<string>`; the hidden set in Scene unions (a) the live-preview feature editor's part, (b) every committed boolean's input parts when `hideInputs=true` (excluding the one being edited), and (c) the in-flight boolean editor's input parts when `hideInputs=true`. `Scene.tsx` constructs `booleanResultLayer` alongside `partMeshLayer`, runs a second 200ms-debounced live-preview pipeline driven by `regenerateBoolean` that writes into the same `previewMeshLayer` (the two editor pipelines are mutually exclusive), with a `setsEqual` shallow comparison to skip no-op syncs and `mapKernelError` for boolean error copy. `Modeller.tsx` adds a Boolean toolbar group (∪ / − / ∩, gated on `parts.length >= 2 && !sketchSession.active && !featureEditor.open`), a "BOOLEANS" sidebar section (only when `booleanFeatures.length > 0`) where each row reads `{glyph} {name} ({input1, input2, ...})` and routes click → `selectBoolean + beginEditBoolean`, RightInspectorBody routes `booleanEditor.open || selection.kind === 'boolean'` to `BooleanInspector` (editor takes precedence over selection), and a `CascadeDeleteDialog` overlay shown when the user clicks the new "Delete" button on `PartInspector` — lists affected booleans by name in `#FF6B6B` and dispatches `deletePartCascade(partId)` on confirm. `features/kernelErrors.ts` extended with `empty-result / invalid-input-not-solid / subtract-needs-tool` codes + matching patterns; `boolean-failed` copy generalised. `HoleInspector` fixed to early-return on `selection.kind === 'boolean'` so the new selection variant doesn't break TS narrowing of `partId`.
- QA fix pass between Phase 5 and 6 ✅ — Six deployed-build bugs:
  (1) **Extrude silently produced no geometry** — added defensive
  `BRepBuilderAPI_Copy_2` deep-copy of the prism shape in
  `cad/operations/extrude.ts` before the `prismBuilder`/face wrappers
  are released in `finally` (opencascade.js TopoDS_Shape wrappers
  alias intermediate sub-shapes; tessellating after cleanup produced
  empty meshes). (2) **WebGPU `Material "LineMaterial" is not
  compatible` warnings + invisible sketch primitives** — swapped
  legacy `three/examples` LineMaterial → `three/webgpu`
  `Line2NodeMaterial` + webgpu `Line2` in `EdgeHighlightLayer`,
  `FaceHighlightLayer`, and `sketchPrimitiveRenderer`; explicitly
  set `blending: NormalBlending` so opacity renders; guarded
  `material.resolution.set` (newer material binds resolution via the
  viewport node). (3) **PMREM `Cannot read 'buffers'`** at
  `sceneSetup.ts` — switched to `three/webgpu` PMREMGenerator and
  cast through the webgpu `Renderer` base type. (4) **Grid too
  dark** — `sceneSetup.COLOURS.grid` → `0x3a4560`, opacity 0.65.
  (5) **Inspector showed "This feature type isn't editable yet" after
  Apply** — `applyFeatureEditor` in `state/store.ts` now sets
  `selection = { kind: 'part', partId }` so the existing
  `PartInspector` renders; Modeller's feature-selection branch
  pruned to a SketchInspector fallback. (6) **NumericInput value
  lost on rapid Tab** — `handleBlur` always commits the typed
  value, dropping the racy `clamped !== lastReportedRef.current`
  guard. Diagnostic additions: `console.error` in every cadWorker
  catch (extrude/revolve/fillet/chamfer/hole/booleanOp), and a
  `runSelfTest` in `ensureKernel` that builds a 20mm square,
  extrudes 10mm and logs tri count + bbox (or red `console.error`
  on failure) so kernel-pipeline regressions surface at boot.
- **Z-up convention switch (post-Phase 5 fix)** — flipped world from
  Three.js default Y-up to mechanical-CAD Z-up (SolidWorks/Onshape):
  X=right, Y=forward, Z=up; floor = XY plane (Z=0). Fixes T11 (XY
  sketches rendering on a vertical wall) and T12 (primitives scattered
  along Y instead of coplanar); likely also T3 (extrude regression).
  Touches three files only — no functional refactor:
  (1) `three/sceneSetup.ts`: `camera.up.set(0,0,1)` BEFORE
  OrbitControls construction (controls cache `_quat` from `object.up`);
  default camera position (80,-80,60); GridHelper rotated +π/2 around X
  to lie on XY (was XZ); grid offset now `position.z = -0.01`; key
  light moved to (50,30,80). (2) `sketch/plane.ts`: `DEFAULT_CAMERA_UP`
  → [0,0,1], `DEFAULT_CAMERA_POSITION` → [80,-80,60]; `PLANE_VIEWS` XZ
  cameraPosition flipped to [0,-120,0] (in Z-up the XZ plane is the
  front wall), YZ cameraUp → [0,0,1]; XY view kept ([0,0,120] up
  [0,1,0]) since "screen-up = world +Y" for top-down. (3)
  `three/Scene.tsx` shadowCatcher: dropped `rotation.x = -π/2`
  (PlaneGeometry's default XY IS the floor in Z-up); offset switched
  from `position.y = -5` → `position.z = -5`. NOT changed (verified
  safe): sketchOverlay applyOrientation already produces coplanar
  rect+grid for each cardinal plane in Z-up; `planeNormal` /
  `planeToWorld` already match the spec; PartMeshLayer applies no
  per-part transform; createAxes pivots already point red/green/blue
  along world +X/+Y/+Z. Architect approved as a focused
  axis-convention patch.
- Phases 6–12 — pending.
- **Deferred to Phase 12 polish** (per user, end of Phase 5):
  - 3D click-to-select on boolean result meshes (BooleanResultLayer is rendered but not wired into TopologyPicker; selection only works via the BOOLEANS sidebar today).
  - Inline thumbnails in BooleanInspector for input parts, the Subtract tool slot, and the live result.
- **Diagnostic surfacing pass (post Z-up)** ✅ — Single-purpose patch
  to make the previously-invisible OCCT failures visible. (a)
  `FeaturePreview` widened with `details: string | null` carrying
  raw kernel `message + '\n\n' + stack`; every `setFeaturePreview`
  callsite in `Scene.tsx` updated. All six inspectors
  (Extrude/Revolve/Fillet/Chamfer/Hole/Boolean) render the raw text
  under a collapsed `<details><summary>Technical details</summary>`
  disclosure when populated. (b) `Scene.tsx` per-feature and boolean
  preview catches now also `console.error('[CAD] <op> preview failed:',
  message, stack)` on the **main thread** — Chrome's default DevTools
  filter ("Errors" only) hides worker-side `console.error`, which is
  why QA had been blind to the real OCCT message. (c) Worker
  `runSelfTest` switched its success log from `console.info` →
  `console.error` (so it survives the same filter) and now
  `self.postMessage({ type: 'self-test', ok, message })`; `cadClient.ts`
  registers a worker `message` listener BEFORE Comlink wraps the worker
  to re-emit `[SELF-TEST] ...` on the page console. The listener is
  Comlink-safe because Comlink ignores messages without an `id` field.
  (d) `BooleanRegenResult` extended with `stack: string | null`
  threaded through all 7 return sites of `assemblyRegen.regenerateBoolean`.
  (e) **T5 regression fix**: "Edit Extrude N" was failing to pre-load
  the saved depth when the inspector stayed mounted across feature
  switches — `NumericInput`'s local `draft`/`lastReportedRef` state
  outlived the prop change. Added `key={\`depth-${editor.featureId
  ?? 'create'}\`}` on `ExtrudeInspector`'s NumericInput so React
  forcibly remounts the input per-feature, guaranteeing
  `useState(() => format(value, decimals))` re-runs with the saved
  depth. **Outcome verified in browser logs**: the previously-hidden
  exception is now plainly visible — `[SELF-TEST] FAILED:
  wire.Closed is not a function` (a separate OCCT API binding bug to
  fix in the next pass; this diagnostic patch only surfaces it).
- **`wire.Closed_1()` fix (immediate follow-up to diagnostic pass)** ✅
  — Two-line fix in `cad/operations/sketchToWire.ts`. OCCT exposes
  `Closed` on `TopoDS_Shape` as a numbered overload pair —
  `Closed_1(): Standard_Boolean` (getter) and
  `Closed_2(value): void` (setter); the unsuffixed `Closed()` does
  NOT exist in this opencascade.js binding. Both call sites
  (lines 327 and 383) updated to `wire.Closed_1()`. **This is the
  root cause of T3 — every extrude has been silently failing on
  this method call since Phase 3.** Phase 3 acceptance never
  caught it because the runtime test never executed (it was a
  code review only). After fix: `[SELF-TEST] OK: tris=12
  bbox=[-10, -10, 0] → [10, 10, 10]` (a real 20×20×10mm extruded
  box) prints on every kernel boot.

**Sketch overlay & camera**: `Scene.tsx` subscribes to the Zustand store **and** runs the same reconciler once immediately after subscribe so a session that started before the WebGPU/OrbitControls were ready still triggers the camera tween, overlay reveal, and `controls.enabled = false`. Tweens are advanced inside the WebGPU `setAnimationLoop` callback (not `requestAnimationFrame`).

**WebGPU testing note**: The Replit preview iframe does not support WebGPU; it is expected to show the "WebGPU required" message. Real testing must be done on the deployed `.replit.app` URL in Chrome on an M-series Mac.

**OpenCascade.js bundling**: Bypasses the package's `index.js` wrapper (bare `.wasm` import that Vite cannot pre-bundle). The worker imports the Emscripten factory directly from `opencascade.js/dist/opencascade.full.js` and feeds the WASM URL via `locateFile`. Vite config has `optimizeDeps.exclude: ["opencascade.js"]` and `worker: { format: "es" }`.

**OCCT API quirks** (this build's bindings):
- Constructors use numeric suffixes: `BRepPrimAPI_MakeBox_4`, `TopExp_Explorer_2`, `gp_Pnt_3`, `TopLoc_Location_1`, `gp_Vec3f_1`.
- `gp_Vec3f` getters are `x_1()`, `y_1()`, `z_1()` (not properties).
- `TopAbs_Orientation` enum values are singleton objects → compare with `===`.
- `Poly_Triangulation` nodes/triangles are 1-indexed.
- Always `.delete()` transient OCCT wrappers (face, location, triangulationHandle, gp_Vec3f, gp_Pnt corners, builders) to free WASM heap.
