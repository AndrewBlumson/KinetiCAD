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
- Phase 6 ✅ — Multi-Part Scene Management. Schema bumped persist v4→v5
  with `Transform { positionMm: [x,y,z]; rotationDeg: [x,y,z] }` and two new
  required `Part` fields: `visible: boolean` and `transform: Transform`
  (defaults: `true` + identity); migration maps every legacy part to
  defaults, plus a defensive guard for partially-migrated v5 rows that
  somehow lack the fields. Store gained `createPart` (unique default
  name + select), `renamePart`, `duplicatePart` (deep-copy of sketches +
  features with fresh ids via a `sketchIdMap` so duplicated extrudes/
  revolves point at the duplicated sketch; "X (copy)" name uniquified;
  +30mm X-offset to avoid z-fighting), `setPartVisible`,
  `setPartTransform`, `setPartTransformPartial`, `resetPartTransform`.
  `finishSketch` now lands the new sketch on the actively-selected part
  (else first existing, else auto-creates "Part 1") and promotes the
  selection so chained sketches stay on the same part.
  `three/PartMeshLayer.ts` applies `mesh.position` + `mesh.rotation`
  (Euler XYZ) on every sync (cheap, runs even on hash-cached regens so
  gizmo drags update visually without an OCCT call); hidden parts have
  `mesh.visible=false` AND a token bump so any in-flight regen can't
  resurrect them.
  New `three/TransformGizmo.ts` wraps `three/examples/jsm/controls/
  TransformControls.js` (v0.184: extends `Controls` not `Object3D`, so
  the visual is added via `getHelper()`). `objectChange` events are
  rAF-throttled into a single `onChange(position, rotation)` per frame
  with a final flush on drag end. `dragging-changed` toggles
  `controls.enabled` so OrbitControls don't fight the gizmo for pointer
  events. Modes: `translate | rotate | hidden`.
  `Scene.tsx` instantiates one gizmo, reconciles on every selection /
  assembly / sketchSession / featureEditor / booleanEditor change AND
  per-frame on topologyVersion bumps (the part mesh handle is recreated
  on regen completion). Attachment rules: only when one part is
  selected, visible, no editor open, no sketch active, and the part
  mesh exists; mid-drag detach is suppressed. R/T global keydown
  handler (skipped while typing in inputs) toggles between translate
  and rotate.
  Transform-aware booleans: `BooleanInputDescriptor.transform` is now
  required; `assemblyRegen.computeBooleanHash` folds each input's
  positionMm + rotationDeg (4-decimal fixed precision) into the cache
  key so a gizmo drag invalidates downstream booleans;
  `cadWorker.booleanOp` per-input composes `M = T·Rx·Ry·Rz` via
  `gp_Trsf.Multiply` (Z innermost → Y → X → translate, matching
  three.js Euler XYZ), runs `BRepBuilderAPI_Transform_2(base, trsf, true)`
  to bake the transform before the boolean, and `.delete()`s every
  `gp_Pnt/Dir/Ax1/Vec/Trsf` + transformer. Identity short-circuits the
  whole block. Cleanup tracks `baseShapes` + `transformedShapes`
  separately so finally drops both without double-freeing the
  identity-shared base.
  UI rewrite: new `components/PartsPanelItem.tsx` (eye icon toggle,
  click-to-select, double-click inline rename, hidden parts rendered
  in muted `#7A8599`, ⋮ context menu via `PartContextMenu.tsx` /
  Radix `dropdown-menu` with Rename / Hide-Show / Duplicate / Delete);
  new `components/NewPartButton.tsx` ("+ New Part" dashed button at
  the top of the Parts section); new `components/PartContextMenu.tsx`.
  `Modeller.tsx` swaps the legacy `PartTree` for the new component +
  passes `setCascadePartId` for the cascade-aware delete dialog
  (already existed). `ActiveSketchInspector` shows "On <part name>"
  using the same active-part resolution.
  `PartInspector.tsx` rewritten with inline rename input, Eye/EyeOff
  visibility toggle, Position X/Y/Z grid (1mm step, Shift×10) and
  Rotation X/Y/Z grid (5deg step, Shift×10) — inline `NumericField`
  with text input + ▲/▼ buttons + ArrowUp/Down keyboard support
  (focused field doesn't sync from external state so a gizmo drag
  doesn't clobber typing); Reset Transform button; Add Feature
  buttons (Fillet/Chamfer/Hole disabled until a base feature exists);
  Delete button.
  `SketchToolbar.tsx` shows "Sketching on: <part name>" left of the
  tool icons (md+ breakpoints).
- Phase 7 ✅ — Mate Joints (Revolute / Prismatic / Spherical / Fixed /
  Planar). Schema bumped persist v5→v6 with `Assembly.mates: Mate[]`
  and `groundPartId: string | null`; migration adds both fields with
  defaults `[]` / `null` (defensive guard for partial-migrated v6 rows).
  `Mate` is a discriminated union on `type`: every variant carries
  `id, name, type, partAId, partBId, pivotA, pivotB`; revolute/prismatic
  add a `motor: { rpm | speedMmPerS }` (params-only — Phase 7 stores
  but does not actuate). `MatePivot` is `{kind:'face', faceId,
  localPoint:[x,y,z]} | {kind:'edge', edgeId, localPoint:[x,y,z]}`;
  `applyMateEditor` strips planar pivots to the bare `{kind:'face',
  faceId}` shape required by the planar variant on commit.
  Store gained the full mate slice: `mateEditor` (separate from
  `featureEditor`/`booleanEditor`), `Selection {kind:'mate', mateId}`,
  actions `selectMate / beginCreateMate(type) / beginEditMate(mateId)
  / setMateEditorParams / setMateEditorStage / setMateEditorError /
  applyMateEditor / cancelMateEditor / addMate / removeMate /
  renameMate / setGroundPart / getMatesUsingPart`. `deletePartCascade`
  was extended to also drop every mate referencing the deleted part
  and to null out `groundPartId` if it was the deleted part. Auto-name
  picks "Revolute 1" / "Prismatic 1" / "Spherical 1" / "Fixed 1" /
  "Planar 1" (uniquified) on `beginCreateMate`.
  New `three/MatePickerCoordinator.ts` — pure helpers shared by every
  mate inspector: `axisOfEdge` (line/circle/arc canonical axis),
  `centroidOfFace` / `centroidOfEdge`, `parallelEnough(a, b, tolDeg=5°)`,
  plus per-type validators that return `string | null` so the inspector
  shell can render the inline `#FF6B6B` validation hint.
  New `three/MateVisualizer.ts` (added to `Scene.tsx` alongside
  `partMeshLayer` / `previewMeshLayer` / `booleanResultLayer`) renders
  one icon per committed mate at the mid-point of `pivotA`/`pivotB` in
  world space (each pivot `localPoint` transformed by its part's
  `Transform`). Icon mesh uses `depthTest: false` + `renderOrder` high
  so it stays visible through bodies; selected mate scales 1.5× and
  swaps to `highlightSelected` (#ff6b1a). One sync per assembly /
  selection change reuses geometry — cheap to rebuild every tick.
  Inspector readers couple to the live scene via a tiny module-level
  ref `three/partMeshLayerRef.ts` (`setPartMeshLayer / getPartMeshLayer`).
  Scene publishes the layer on create and clears it before dispose, so
  React inspectors can call `getPartTopology(partId)` without dragging
  WebGPU context through props.
  Five sub-inspectors share `MateInspectorShell` (NameField, Apply /
  Cancel / Delete, inline error chip): `RevoluteMateInspector` picks
  one edge per part (axis must be parallel within 5°, motor RPM
  inline), `PrismaticMateInspector` picks one face per part (face
  normals must be parallel within 5°, motor mm/s inline),
  `SphericalMateInspector` picks point-on-face on each part (uv +
  `face.planeBasis` → localPoint), `FixedMateInspector` picks parts in
  the parts tree (no topology), `PlanarMateInspector` picks one face
  per part. Router `MateInspector.tsx` switches on `mateEditor.params.
  type` and threads the same `partMeshLayerRef` singleton.
  UI: new `MatesPanelItem.tsx` (per-mate row in the Mates section, ⋮
  menu with Rename / Edit / Delete + inline motor RPM/N input for
  revolute/prismatic when present; per-type indexAmongType drives the
  default label suffix). `Modeller.tsx` adds the Mate toolbar group
  (5 buttons Revolute/Prismatic/Spherical/Fixed/Planar, gated on
  `parts.length >= 2 && !sketchSession.active && !featureEditor.open
  && !booleanEditor.open`), the "MATES" sidebar section (rendered
  only when `mates.length > 0`), and routes `mateEditor.open ||
  selection.kind === 'mate'` to `MateInspector` in `RightInspectorBody`
  (editor takes precedence).
  Ground anchor: `PartContextMenu` adds "Set as Ground" (icon ⚓);
  `PartsPanelItem` renders the anchor glyph on the ground part and
  threads `onSetGround`; `PartInspector` shows a "Set as Ground"
  button (or "Ground" badge if already ground). `setGroundPart` is
  idempotent and exclusive (only one ground at a time).
  `CascadeDeleteDialog` extended: lists `dependentMates` by name in
  `#FF6B6B` alongside booleans, plus a "Will reset ground" note when
  the deleted part was the ground; `mateLabel(mate)` helper renders
  "{type} ({partA} ↔ {partB})". On confirm, `deletePartCascade` runs
  the unified cascade and the dialog closes.
- Phases 8–12 — pending.
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
- **Body visibility per editor kind/mode (QA pass 5 follow-up)** ✅ —
  Previously `PartMeshLayer.sync` hid the editor's part whenever
  `featureEditor.open && livePreview`, regardless of feature kind
  or mode. That broke modifier inspectors (fillet/chamfer/hole)
  because the cube vanished the moment the user clicked +Fillet,
  leaving no body to hover edges on; same broke Revolve edit on
  an extruded part. Fix: `PartMeshLayer` and `BooleanResultLayer`
  each gained a second sync parameter `dimmedPartIds` /
  `dimmedBooleanIds` and a sibling `dimmedMaterial` (clone of the
  shared material with `transparent: true, opacity: 0.4,
  depthWrite: false`). `Scene.tsx`'s `computeHiddenPartIds` /
  `computeHiddenBooleanIds` were refactored into
  `computePartVisibility` / `computeBooleanVisibility`, returning
  `{ hidden, dimmed }`. Routing rules:
  - CREATE on base feature (extrude/revolve from sketch) → HIDE
  - CREATE on modifier (fillet/chamfer/hole) → DEFAULT (full
    opacity so edge/face picking still works)
  - EDIT on any feature → DIM (0.4) so user sees both before and
    after with the 0.85 preview overlay
  - Boolean inputs always HIDDEN when `hideInputs=true`
    (unchanged); the boolean being edited is now DIMMED instead
    of hidden when `livePreview` is on (mirrors per-part edit
    rule). Material swap happens synchronously in `sync()` BEFORE
    the regen so it takes effect even on hash-cached short-circuits.

**Sketch overlay & camera**: `Scene.tsx` subscribes to the Zustand store **and** runs the same reconciler once immediately after subscribe so a session that started before the WebGPU/OrbitControls were ready still triggers the camera tween, overlay reveal, and `controls.enabled = false`. Tweens are advanced inside the WebGPU `setAnimationLoop` callback (not `requestAnimationFrame`).

**WebGPU testing note**: The Replit preview iframe does not support WebGPU; it is expected to show the "WebGPU required" message. Real testing must be done on the deployed `.replit.app` URL in Chrome on an M-series Mac.

**OpenCascade.js bundling**: Bypasses the package's `index.js` wrapper (bare `.wasm` import that Vite cannot pre-bundle). The worker imports the Emscripten factory directly from `opencascade.js/dist/opencascade.full.js` and feeds the WASM URL via `locateFile`. Vite config has `optimizeDeps.exclude: ["opencascade.js"]` and `worker: { format: "es" }`.

**OCCT API quirks** (this build's bindings):
- Constructors use numeric suffixes: `BRepPrimAPI_MakeBox_4`, `TopExp_Explorer_2`, `gp_Pnt_3`, `TopLoc_Location_1`, `gp_Vec3f_1`.
- `gp_Vec3f` getters are `x_1()`, `y_1()`, `z_1()` (not properties).
- `TopAbs_Orientation` enum values are singleton objects → compare with `===`.
- `Poly_Triangulation` nodes/triangles are 1-indexed.
- Always `.delete()` transient OCCT wrappers (face, location, triangulationHandle, gp_Vec3f, gp_Pnt corners, builders) to free WASM heap.

### Phase 8 — Rapier3D Physics Integration ✅

Real-time rigid-body simulation of mate-driven mechanisms.

**Schema / store**:
- `SimulationState` extended with `paused`, `speedMultiplier` (0.25/0.5/1/2), `simulationTimeMs`. Default gravity is now `[0, 0, -9810]` mm/s² (Z-up). Persist version bumped 6→7; `partialize` zeroes runtime fields (`running`, `paused`, `simulationTimeMs`) on every reload so a dead world never auto-resumes. v6→v7 migration uses `isFullSimulation` + `isMmGravity` helpers — old m/s² gravities (any axis |g| < 50) are stomped with the mm/s² default.
- New actions: `setSimulationPaused`, `setSimulationSpeed`, `setSimulationGravity`, `tickSimulationTime`, `resetSimulation`. `setSimulationRunning(false)` also clears `paused` + zeroes elapsed.

**OCCT mass properties**:
- `cad/operations/massProperties.ts` wraps `BRepGProp.VolumeProperties_1` + `GProp_GProps.PrincipalProperties()`. Default density 2.70 g/cm³ (aluminium). Mass = volumeMm³ × density × 1e-6 (kg). Inertia kept in kg·mm².
- New `cadKernelApi.getMassProperties(features, sketches, density)` re-runs the upstream chain like a regen and returns `{volumeMm3, massKg, comLocal, principalInertiaKgMm2}`. Empty / zero-volume parts return a tiny fallback so Rapier never sees NaN.

**Physics worker** (`src/physics/`):
- `physicsWorker.ts` hosts a singleton `RAPIER.World` exposed via Comlink. `init()` boots `@dimforge/rapier3d-compat@0.12.0` once. `buildWorld({parts, mates, gravity, timeStepMs})` rebuilds from scratch; `step()` advances and returns per-body world transforms; `destroy()` tears the world down without unloading WASM.
- Body builder: `Fixed` if `isGround`, else `Dynamic`. Pose composed from `transform.positionMm` + Euler-XYZ rotation. Mass props injected via `setAdditionalMassProperties` AFTER attaching a zero-density collider so we override Rapier's auto-mass. Convex hull collider first; trimesh fallback if hull build fails.
- Joint builder: revolute / prismatic / spherical / fixed. Planar logs a warning + skip (Phase 12 polish — Rapier 0.12 has no native planar joint and the 6-DOF generic API is awkward).
- `physicsClient.ts` memoises a single worker instance per page (`getPhysicsKernel`).

**Scene wiring**:
- `three/SimulationLayer.ts` clones `PartMeshLayer` entries (shared geometry + material) into a sibling group. `setTransform(partId, posMm, quat)` mutates clones per-frame. `clear()` drops every clone but never disposes shared resources.
- `three/simulationLayerRef.ts` mirrors `partMeshLayerRef`.
- `Scene.tsx` creates the SimulationLayer at mount, publishes the ref, and starts `simulationRunner`. On teardown, the runner is disposed first, then the layer.
- `physics/simulationRunner.ts` subscribes to `simulation.running`. On false→true: snapshots PartMeshLayer geometry, asks the CAD worker for mass props per visible part, calls `buildWorld`, hides PartMeshLayer + shows SimulationLayer, starts a RAF loop that calls `step()` and pushes transforms into the layer. On true→false: cancels RAF, hides SimulationLayer, restores PartMeshLayer (whose transforms were never mutated). Pause is a flag inside the RAF tick — world stays built. `speedMultiplier` scales the wall-clock delta accumulated into `simulationTimeMs`. `buildToken` guards against the user toggling Stop mid-build.

**Simulator view** (`views/Simulator.tsx`):
- Replaced the placeholder canvas with the real lazy-loaded `<Scene />`. Top toolbar: Play/Pause toggle (play→pause→resume), Reset, 0.25x/0.5x/1x/2x speed selector, status pill (Stopped/Paused/Simulating). Top-right dashboard overlay: simulation time, body count, joint count. Sidebars enumerate parts (rigid bodies) and mates (joints). Play disabled when assembly has no parts.

**Density / unit convention**: every value in the physics layer is mm + s + kg. Rapier itself is unit-agnostic, but mass properties and gravity must agree. A 20×20×10 mm aluminium cube → 4000 mm³, 0.0108 kg.

### Phase 7/8 regression fixes ✅

Three bugs reported by QA pass 7b that blocked end-to-end mate creation
(and therefore Phase 8 physics verification).

**Bug 1 — Infinite render loop in mate inspectors** (CRITICAL, page-crashing):
- Symptom: clicking a part for a Fixed mate triggered "Maximum update
  depth exceeded" and whited out the page; on Revolute the validation
  banner appeared and never cleared.
- Root cause: `setMateEditorError` (and siblings) produced a fresh
  `mateEditor` reference even when the new value equalled the existing
  one. Each inspector's validation `useEffect` listed the entire
  `editor` object in its deps, so the fresh ref re-triggered the same
  effect, which re-fired `setError(...)` with the same string, ad
  infinitum. `FixedMateInspector` aggravated this by NOT calling
  `clearSelection()` on the same-part error path, keeping the trigger
  selection alive across re-renders.
- Fix: equality guards in `setMateEditorParams`, `setMateEditorStage`,
  `setMateEditorError` (return `{}` if value unchanged), and
  `clearSelection()` added to every error/transition path in
  `FixedMateInspector`.

**Bug 2 — `Material "<X>" is not compatible` warnings under WebGPU**:
- Source: `three/MateVisualizer.ts` was the only Phase 7-introduced
  layer still using the classic `THREE.MeshBasicMaterial` /
  `THREE.LineBasicMaterial`. Every other layer
  (EdgeHighlightLayer, FaceHighlightLayer, sketchPrimitiveRenderer)
  was already migrated to NodeMaterial variants.
- Fix: import `MeshBasicNodeMaterial` and `LineBasicNodeMaterial` from
  `three/webgpu`; force `NormalBlending` (NodeMaterials default to
  `NoBlending`) so the transparent overlay still composites.

**Bug 3 — `[KERNEL] Ready` firing 5× per session via HMR cascade**:
- Root cause: `cadClient.ts` and `physicsClient.ts` held their
  `kernelPromise` / `kernelMeta` in module-level `let` bindings. Vite
  HMR replaces module instances on every file edit, so any save in
  the cad / physics dependency chain reset the singleton and re-spawned
  the OCCT (or Rapier) worker.
- Fix: hoist the singleton state to a typed slot on `globalThis`
  (`__kineticadKernel__`, `__kineticadPhysics__`). The slot survives
  module replacement during dev and is set exactly once in production
  builds (where there is no HMR).

## Phase 9 — Motor Actuation (2026-05-02)

Wired mate motors to Rapier's joint motor API so the simulation can
drive a mechanism continuously instead of only reacting to gravity.

**Worker side (`physics/physicsWorker.ts`)**:
- Added a parallel `mateIdToJoint: Map<string, ImpulseJoint>` next to
  `partIdToBody`. Populated for revolute and prismatic joints in
  `buildJoint`; cleared in `destroyWorld`.
- Helpers `applyRevoluteMotor` / `applyPrismaticMotor` cast the joint
  to its `UnitImpulseJoint` subclass and call
  `configureMotorVelocity(targetVel, 1.0)`. RPM → rad/s conversion
  via `rpm × 2π / 60`; prismatic velocity passes through in mm/s.
- New Comlink method `updateJointMotor({ mateId, motorSpeedRpm?,
  motorVelocityMmPerSec? })`. Wakes both attached bodies via
  `body.wakeUp()` so a freshly-applied motor takes effect on a
  sleeping idle mechanism.

**Main thread (`physics/simulationRunner.ts`)**:
- Second store subscription dedicated to `assembly.mates`. Diffs the
  current vs. previous slice, and while `simulation.running` calls
  `physics.updateJointMotor(...)` for any mate whose `motorSpeedRpm`
  (revolute) or `motorVelocityMmPerSec` (prismatic) changed.
- Build-time motors are still picked up by `buildJoint` so users who
  hit Play with a pre-configured RPM see the mechanism start moving
  on frame 1 — the live subscription only handles parameter tweaks
  during a running sim.

**Types (`physics/types.ts`)**:
- Added `UpdateJointMotorArgs` / `UpdateJointMotorResult` and exposed
  `updateJointMotor` on the `PhysicsApi` Comlink contract.

**Verification status**: typecheck clean. The four-bar linkage
acceptance test (Ground/Crank/ConRod/Rocker, 60 RPM motor) was not
exercised end-to-end in this session — that requires WebGPU which
the in-IDE preview iframe does not provide; QA should run it on a
deployed `.replit.app` URL in Chrome.

## Phase 9.5 — bug fixes (Fixed mate physics + ground persistence)

Two concrete defects fixed; the inspector commit-on-click pattern was
already in place from prior work and needed no further code changes.

**Fixed mate joint math (`physics/physicsWorker.ts`)**:
- Bug: `JointData.fixed` was being constructed with identity anchors
  on both sides (`(0,0,0)` + identity quat for A and B). Rapier's
  fixed joint locks `bodyA·frame1 ≡ bodyB·frame2` in world space, so
  passing identity for both anchors yanked B's origin onto A's origin
  under solver forces — Part B drifted/snapped instead of staying
  rigidly fixed in place.
- Fix: at joint-creation time, sample `bodyA.translation()/rotation()`
  and `bodyB.translation()/rotation()`, then compute frame2 in B's
  local frame as `T_B^(-1) · T_A` (translation = q_B^(-1) ⊗ Δp ⊗ q_B,
  orientation = q_B^(-1) ⊗ q_A). Frame1 stays identity in A. New
  helpers `quatMul` + `quatRotateVec` live next to `eulerDegToQuat`.

**`assembly.groundPartId` persistence (`state/store.ts`)**:
- Bug: `groundPartId` defaulted to `""` and was never written when a
  user added their first part. The UI / sim used `groundPartId ||
  parts[0].id` as a display fallback, which silently rewired the
  ground anchor whenever `parts[0]` changed (re-orders, deletions),
  and the persisted state stayed empty across reloads.
- Fix: in `createPart`, if `groundPartId === ""`, promote the new
  part to ground inline. In the v6 migration, also promote
  `parts[0].id` when an existing persisted state has parts but an
  empty `groundPartId`. The `parts[0]` fallback in
  `simulationRunner` / UI components is retained as belt-and-braces
  but is now a no-op in practice.

**Verification**: `pnpm --filter @workspace/kineticad run typecheck`
clean. Behavioral verification (B stays welded to A under gravity;
ground anchor survives reload) requires WebGPU — QA on a deployed
`.replit.app` URL.

### Revolute click-rejection fix (pick filter)

Bug: while creating a Revolute mate, hovering a circular edge would
highlight it correctly, but clicking would intermittently surface
"Revolute requires circular geometry on both sides" and leave PART A
unset. QA hypothesised separate hover/click code paths; that was wrong
— `TopologyPicker.findEdgeHit` is the single entry point for both, and
mouseup-jitter (within `CLICK_PIXEL_TOL = 4 px`) could land marginally
closer to a side seam (`type: "line"`) than to the circular top edge.
The picker has no notion of inspector intent, so it returned the seam,
and the inspector's `isCircularEdge` rejected it.

Fix: introduce a per-mode geometry filter that lives in the store and
is honoured by both hover and click:

- `state/store.ts`: new `PickFilter = { edgeTypes?, faceTypes? }` slice
  with `setPickFilter`. Equality-guarded against array churn.
- `three/TopologyPicker.ts`: `findEdgeHit` / `findFaceHit` skip
  entities whose `type` is not in the active allowlist. Click handlers
  also emit `[mate-click]` console diagnostics with the picked
  entity's id+type and the active filter — trivially copy-pasteable
  evidence if QA reports the bug recurring.
- Mate inspectors set the filter on mount and clear on unmount:
  - `RevoluteMateInspector`: `edgeTypes: ["circle", "arc"]`
  - `PrismaticMateInspector`: `faceTypes: ["plane"]`
  - `PlanarMateInspector`: `faceTypes: ["plane"]`
  - Spherical (point-on-face, any face) and Fixed (no picking) need
    no filter.

Net effect: the user can no longer hover or click an edge/face the
inspector would later reject — non-matching geometry is invisible to
the picker for the duration of the inspector session.

**Verification**: `pnpm --filter @workspace/kineticad run typecheck`
clean; HMR re-applied across all three updated inspectors. Behavioural
QA (click on a circular edge near a side seam reliably advances Stage
A → Stage B) on the deployed `.replit.app` URL.

#### Follow-up: filter-aware proximity tolerance

QA's first deploy showed `[mate-click] edge pick { hit: null, filter:
{...} }` on every Revolute click. Hover and click really do share
`findEdgeHit`, so the symptom looked impossible — until walking
through the geometry: `EDGE_PROXIMITY_PX = 8` CSS px is tight enough
that hover can latch onto a circular edge for one frame at ~6 px while
mouseup-jitter (within `CLICK_PIXEL_TOL = 4`) carries the cursor to
~10 px from the circle and ~5 px from the side seam. Pre-filter the
seam was returned (and the inspector rejected it). Post-filter the
seam is skipped, the circle is now outside the 8 px window, and
`findEdgeHit` returns `null`. Same root cause, different symptom.

Fix: when a pick filter is active, widen the proximity window to
`FILTERED_EDGE_PROXIMITY_PX = 24 px`. The filter already restricts
candidates to inspector-valid types, so a wider window can't pick the
wrong thing. The default 8 px stays for unfiltered picks where
type-discrimination by proximity still matters.

Diagnostics also enriched: `findEdgeHit` now records `considered`
(filter-passing edges scanned), `bestDistAll` (min distance found),
and `proximity` (active threshold) into a closure-scoped `edgePickDiag`
that the click logger emits. Future regressions distinguish "no
candidates exist" from "candidates exist but cursor is too far" at a
glance.

#### Follow-up #2: full edge-type histogram in diagnostics

Second deploy: QA reported `diag: { considered: 0, bestDistAll:
Infinity, proximity: 24 }`. Their reading was "no edges match the
filter, therefore the filter strings must be wrong" — but `EdgeType`
is a TS string-literal union (`"line" | "circle" | "arc" | "spline" |
"other"`) and `setPickFilter({ edgeTypes: ["circle", "arc"] })` is
statically checked against it; a mismatch wouldn't compile, and
`topology.ts` literally writes `type: "circle"` / `type: "arc"`.

The likelier interpretation: the part the user is testing on has no
edges OCCT classifies as `circle`/`arc`. Its visually-round top edge
is a `spline` or `other` (revolved profile, imported step body,
non-exact curve approximation). The hover that "worked" pre-filter
was probably the line seam — exactly the bug class the filter was
meant to defeat. Without ground-truth on what types the part actually
contains, every "fix" is a guess.

To get ground truth in one round, `findEdgeHit` now also tallies
edges **before** the filter and emits a `typeHistogram` and
`totalEdges`. One click on the deployed app reveals exactly what
types exist in the user's scene — e.g.
`{ totalEdges: 9, typeHistogram: { line: 6, spline: 3 } }` would
prove the part has no circular edges and the filter is doing its
job. The fix path then becomes: relax the filter to include `spline`
when the spline is closed (cylinder approximations), or fix
upstream classification, or document the expected sketch workflow
(use Sketch → Circle → Extrude, not a polyline approximation).

#### Follow-up #3: classifier was always returning "other" (root cause)

QA's third deploy returned `{ totalEdges: 12, typeHistogram: { other:
12 } }` on a two-cylinder scene. None of the three predicted paths —
exact-circle classification was *broken*, full stop. The mate
inspector's filter had been doing the right thing all along; the data
it was filtering against was wrong.

**Root cause** (in `cad/operations/topology.ts`):

```ts
const GEOM_ABS_LINE = 0;
const GEOM_ABS_CIRCLE = 1;
…
const curveType = adaptor.GetType();   // ← embind enum object, not int
if (curveType === GEOM_ABS_LINE) { … } // ← always false
if (curveType === GEOM_ABS_CIRCLE) { … }
return { type: "other", … };           // ← every edge takes this branch
```

opencascade.js exposes OCCT enums as embind value-object instances:
`BRepAdaptor_Curve.GetType()` returns something like `{ value: 1 }`
for `GeomAbs_Circle`, not the integer `1`. The `===` strict-equality
check was always false → every dispatch fell through to the `"other"`
fallback. The same bug affected `classifyAndExtractSurface` (faces
were misclassified as `"other"` too — silently breaking the Planar
and Prismatic mate filters in the same way, just not yet exercised).

This is also why the original "click rejects what hover accepts"
report fingered `"line"` edges: the *seam* edges happened to be
genuine `Line`s, while what the user perceived as the "circular top"
was being tagged `"other"` by the broken classifier and skipped by
the filter.

**Fix**: defensive `enumVal()` helper that handles raw integers,
embind enum objects with `.value`, and `valueOf()`-coercible objects.
Applied at every `GetType()` call site (curve classification + surface
classification). Returns `-1` for unrecognised shapes, which routes
to `"other"` exactly as before — same fail-safe behaviour, but now
only when the type genuinely is unknown.

**Behavioural ramification**: edge and face *hash IDs* incorporate the
classified type prefix (`circle|…` vs `other|…`), so a fillet/hole
feature in an existing persisted project that referenced an edge ID
like `"other|<polyline-samples>"` will not match the newly-classified
`"circle|<centre|radius|axis>"` after this fix. Feature regeneration
will fail to locate the saved edge ID. Users with feature history
predating this commit must rebuild affected features (or the persist
version could be bumped to wipe trees — not done here, since the user
is mid-bringup and can rebuild trivially).

**Verification path**: after redeploy, the QA click should print
`{ typeHistogram: { line: 4, circle: 8 } }` for a two-cylinder scene
(each cylinder = 2 circle edges + 2 seam lines × 2 cylinders = 12)
and the Revolute Stage A click should commit.

#### Follow-up #4: simulator polish — mass-props BindingError + motor stalls after 1 rev

QA confirmed Phase 9.5's classifier fix unblocked end-to-end mate
creation: Part 1 + Part 2 + Revolute mate + 60 RPM motor all built and
the simulator reached Play. Two residual bugs surfaced once the
physics world actually started stepping.

**Bug A — `[MASS-PROPS] computeMassProperties failed: BindingError:
function GProp_PrincipalProps.Moments called with 0 arguments,
expected 3 args`**. The OCCT C++ method
`GProp_PrincipalProps::Moments(Real&, Real&, Real&)` is exposed in
opencascade.js as a strict 3-output-arg embind binding — calling it
with no args throws unconditionally before our defensive
property-probing in lines 87–108 of `cad/operations/massProperties.ts`
ever runs. Allocating writable `Standard_Real` reference boxes from
JS in this build of opencascade.js is build-specific and unreliable.

Fix: bypass principal diagonalisation entirely. Approximate each
part as a sphere of equivalent volume (`r_eq = (3V/4π)^(1/3)`,
`I = (2/5) m r²`) and feed Rapier an isotropic inertia diagonal.
Crude, but for a 50 mm cube the equivalent-sphere inertia (~131
kg·mm²) is the same order of magnitude as the true principal
moments (~70–110 kg·mm²) — sufficient for non-FEA dynamics where
inertia matters only through orders of magnitude. A future phase
can revisit with `BRepGProp.MatrixOfInertia` + a JS-side eigensolve.

**Bug B — motor spins Part 2 ~once, then it sticks**. Three-pronged
root cause:

1. *Rapier auto-sleep on dynamic bodies*. Once the velocity error
   between motor target and current angular velocity falls below
   Rapier's sleep threshold (default ~0.01 rad/s), the body is
   flagged idle and frozen. A frozen body never receives the joint
   motor's impulses → mechanism stalls.

2. *Damping fighting the motor*. The Phase 8 build set
   `linearDamping=0.01` and `angularDamping=0.05` "to prevent idle
   oscillation" — but in mm-units these damp every step and let the
   motor settle into a low-velocity steady state, which feeds
   directly into (1).

3. *Motor gain too low for mm-unit inertias*. Rapier's tutorial uses
   `configureMotorVelocity(target, 1.0)`. With sphere-equivalent
   inertia ~60 kg·mm² for a small part, gain 1.0 gives angular
   acceleration ~0.1 rad/s² → a 60 RPM target (6.28 rad/s) takes
   ~60 s to spin up, by which point the body has long since slept.

Fix in `physics/physicsWorker.ts`:

- `desc.setCanSleep(false)` for all dynamic bodies (negligible cost
  for the < 50-body assemblies KinetiCAD targets).
- Drop both `linearDamping` and `angularDamping` to 0; the joint
  motor handles velocity tracking, idle damping is a Phase-11+
  per-mate concern.
- Bump motor velocity-tracking gain from 1.0 to 100 (factored as
  `MOTOR_VELOCITY_GAIN`); ~10 rad/s² acceleration → spin-up under 1 s,
  visually instant.

**Verification path** (deployed app, since WebGPU is required):
build two cylinders, mate revolute axis-to-axis, set 60 RPM, Play —
Part 2 should rotate continuously at one revolution per second, no
`[MASS-PROPS]` errors in the console, and after 5 s of sim-time
should have completed ~5 revolutions. Switching back to Modeller
must still leave the original transforms intact.

#### Follow-up #5: motor still stalls — switching to MotorModel.ForceBased

After Follow-up #4 redeploy, QA confirmed the `[MASS-PROPS]` error
was gone but motor rotation still stalled after roughly one
revolution. Pasting the actual API signatures from
`@dimforge/rapier3d-compat@0.12.0/dynamics/impulse_joint.d.ts`
revealed the root cause was *not* the gain magnitude:

```ts
configureMotorVelocity(targetVel: number, factor: number): void;
configureMotorModel(model: MotorModel): void;   // never called
```

`MotorModel` defaults to `AccelerationBased` (enum value 0). In that
mode the motor commands a target *acceleration* that the constraint
solver enforces alongside the joint constraint itself — and once the
solver finds a state that satisfies both the joint and "velocity
error is small enough", it stops applying corrective impulses. Even
with `canSleep=false` and zero damping, the body coasts to a low-
velocity equilibrium and visibly stalls.

Fix: explicitly call
`configureMotorModel(RAPIER.MotorModel.ForceBased)` *before*
`configureMotorVelocity` in both `applyRevoluteMotor` and
`applyPrismaticMotor`. `ForceBased` converts the motor target into a
continuous force/torque applied every step regardless of constraint
settling — exactly the "always pushing toward target" semantics a
spinning-arm demo needs.

This means Phase 9.5 has been a four-stage symptom march:

1. *Filter rejects clicks* → added pick-filter slice + filtered
   proximity (correct, but built on broken classifier output).
2. *Histogram diagnostic* → revealed every edge tagged "other".
3. *Embind enum coercion fix* → classifier dispatch now works,
   mate creation unblocks end-to-end.
4. *MASS-PROPS BindingError + motor settings* → physics world
   builds, but motor uses `AccelerationBased` and stalls.
5. *MotorModel.ForceBased* → motor sustains rotation.

Each step was necessary; none would have been visible without the
preceding fix landing first.

#### Follow-up #6: AccelerationBased was right all along

QA's behavioural test on the deployed `.replit.app` after Follow-up
#5 reported that bodies stayed attached but Part 2 still appeared to
freeze at rest. To distinguish "motor not firing" from "motor firing
but rendering broken" from "motor firing but underpowered", we
shipped pure-diagnostic instrumentation: `[motor-apply]` on every
motor configuration, `[joint-build]` on every revolute build, and
`[step-diag]` once per second dumping `bodyB.angvel()` +
`isSleeping()`.

QA's logs were unambiguous:

```
[step-diag] bodyBangvel: { x: 0.06, y: -0.08, z: 1.08 }
                                                ^ target was 6.28
```

The motor *was* firing. Part 2 *was* spinning around its Z axis
(0.06/−0.08 are negligible wobble). But it was reaching only ~17 %
of the commanded velocity — visually indistinguishable from "frozen"
at this scale. That's the textbook signature of `MotorModel.ForceBased`
running as a P-controller without integral term: it applies a force
proportional to velocity error, so the steady state is wherever
`gain × (target − actual) ≈ damping × actual`, leaving a residual
that scales inversely with gain.

The Follow-up #5 narrative ("`AccelerationBased` makes the solver
stop applying impulses once velocity error is small") was wrong.
What actually happened is that Follow-ups #1–#4 fixed several
*independent* bugs (mate classifier, mass-props inertia, canSleep,
damping) and the next-most-broken thing was just the motor model
choice — but during #5 we hadn't yet built up the diagnostic
machinery to see that.

`AccelerationBased`, despite the name, behaves as a true velocity
servo in Rapier: the constraint solver computes the impulse needed
to reach the target velocity each step and applies it directly. It
converges to the commanded RPM and holds it, exactly the spinning-
arm demo semantics we want.

Fix: flip both `applyRevoluteMotor` and `applyPrismaticMotor` to
`RAPIER.MotorModel.AccelerationBased`. Diagnostic instrumentation
left in place for one more QA round to confirm angvel reaches
target.

#### Follow-up #7: gain bumped 100 → 10000

QA's transcript after #6 (AccelerationBased, gain=100) was almost
identical to #5: body rotating, but at z = −0.50 rad/s against the
6.28 rad/s target. Switching the motor model alone wasn't enough;
the `factor` argument we'd been calling "gain" since Follow-up #4
was still too low for KinetiCAD's mm-unit inertias.

Why mm-units matter here: most Rapier tutorials assume SI (kg, m,
s), where typical hand-built bodies have inertias in the 0.01–1
kg·m² range. KinetiCAD operates in mm, so a comparable part has an
inertia of 50–500 kg·mm² — three to six orders of magnitude larger
in raw value. The constraint solver computes the impulse it needs
based on `factor × inertia × Δv`, so to get the same effective
stiffness we need a `factor` correspondingly larger than the
tutorials' 1.0.

Single-line fix: bump `MOTOR_VELOCITY_GAIN` from 100 to 10000. The
inline comment above the constant now records the full progression
(1.0 → 100 → 10000) so future readers don't repeat the SI-unit
assumption mistake.

Acceptance criterion for the next QA round: with the motor at
60 RPM, `bodyBangvel.z` should converge to ~6.28 rad/s within 60
steps (1 s). If 10000 still doesn't converge, the fallback is
manual torque application (`body.applyTorqueImpulse` per step from
the worker's step loop) rather than chasing the gain higher.

#### Follow-up #8: WASM via jsDelivr CDN (production deploy fix)

Production deploys at `kineticad.replit.app` were crashing with
`WebAssembly.instantiate(): BufferSource argument is empty` while
dev kept working. Root cause: Vite's `?url` import pulled
`opencascade.full.wasm` (50.3 MB) into `dist/public/assets/`, and
Replit's static-deploy pipeline returns 200 with an empty body for
files past its size cap, so the streaming-instantiate call got an
empty ArrayBuffer.

Fix in `cad/cadWorker.ts`: drop the `?url` asset import and point
`locateFile` at the pinned jsDelivr URL
`https://cdn.jsdelivr.net/npm/opencascade.js@2.0.0-beta.94e2944/dist/opencascade.full.wasm`
(immutable, `application/wasm`, CORS open). The version literal is
extracted into an `OCCT_VERSION` constant that's now also reused as
the kernel-init `version` field, so it must stay in lock-step with
`opencascade.js` in `package.json`. Rebuild confirmed: no `.wasm`
emitted under `dist/` and the bundle is ~13× smaller; dev kernel
still boots in ~1.9 s with `[SELF-TEST] OK`.

### STEP import fix session (2026-05-08) ✅

End-to-end STEP import working. Four bugs peeled back in sequence:

**Bug 1 — `ErrnoError` on `ReadFile`**: virtual FS path was `/virtual/`
(non-existent in the WASM FS); changed to `/tmp/`.

**Bug 2 — no geometry / empty mesh**: `OneShape()` returns a `TopoDS_Shape`
that aliases the reader's internal topology. Deleting the reader in the
`finally` block silently neutered the shape before tessellation — same
aliasing pattern as the Phase 5–6 extrude regression. Fix: call
`BRepBuilderAPI_Copy_2(combined, true, false)` to deep-copy the shape
**while the reader is still alive** before the `finally` runs.
`TransferRoots(progress)` + `OneShape()` is the correct documented OCCT
import pattern; `TransferRoot(i)` (STEP-specific singular) throws raw WASM
C++ exception pointers and must not be used.

**Bug 3 — per-part auto-ground broke multi-part assemblies**: translating
each solid to Z=0 individually destroyed relative positions. Replaced with
per-assembly grounding: one pass over all extracted solids to find
`assemblyZMin`, then a single uniform `dz = -assemblyZMin` applied to every
solid only when `assemblyZMin < -0.001`. Each translated shape is
deep-copied via `BRepBuilderAPI_Copy_2` before its `BRepBuilderAPI_Transform_2`
is deleted.

**Bug 4 — success toast never fired**: the `imported.some(p =>
p.boundingBox…)` Y-up hint check was silently throwing after the Comlink
transfer, jumping to `catch` with no visible error. Replaced branching toast
logic with a single unconditional `toast.success(…)` call that always fires.

**Additional UX fixes**:
- `requestAnimationFrame(() => canvas?.focus())` after import toast restores
  OrbitControls pointer events without requiring a manual canvas click.
- Sonner `<Toaster>` container gets `style={{ pointerEvents: 'none' }}`;
  individual toasts get `toastOptions.style: { pointerEvents: 'auto' }` so the
  invisible dismissed-toast region no longer blocks orbit/zoom.

**Tested** (deployed `.replit.app`, Chrome, M-series Mac):
- McMaster M3 socket-head bolt (single part): import + STEP round-trip ✅
- McMaster torque-limiting coupling 9132K11 (12-part assembly): import +
  STEP round-trip, relative positions preserved, all parts grounded at Z=0 ✅
- Windmill canary regression: `bodyBangvelMag` stable at π ±5e-7 ✅

#### Issue 2 (visible cylinder rotation): no code change required

QA flagged that motor rotation looked invisible because Part 2 is
rotationally symmetric. The fix is a usage answer, not a code one:
the existing `BooleanInspector` already supports a cross-part
Union — pick ≥2 parts from the assembly, choose Union, hit Apply,
and you get a single asymmetric "lollipop" result part (e.g.
cylinder pin + offset bar). Mate that result part to the motor
shaft and the rotation becomes visible. The cadWorker
`booleanOp({ inputs: [...] })` path is what `assemblyRegen.ts`
already calls into, so no new feature work is needed for Phase 9.5.

### XCAF naming investigation (post STEP import) ✅ — concluded impossible

After STEP import worked, attempted to extract real part names from the
XCAF document tree (PRODUCT names from the STEP header) rather than
using file-stem fallbacks. Four commits of investigation:

- `STEPCAFControl_Reader_1` (not the base class) is required to populate
  the XCAF label tree — base class silently produces no labels.
- Eight candidate paths to read `TDataStd_Name` attribute all failed:
  `Handle_TDataStd_Name.DownCast` not present in binding;
  `TDataStd_Name.Get_1/Get_2` static methods not present;
  `FindAttribute_1` only accepts `Handle_TDF_Attribute` base (typed
  subclass handle rejected by embind); `TDF_Attribute.get()` doesn't
  expose `Get()`.
- **Conclusion**: XCAF label name extraction is structurally impossible
  in this `opencascade.js@2.0.0-beta.94e2944` binding. `extractLabelName`
  stubbed out to `return ''` with a comment block recording all 8 failed
  paths. File-stem fallback is now the documented silent behaviour.
  `STEP_NAME_DEBUG` permanently flipped to `false`.

### Worker→main-thread console log bridge ✅

`cadWorker.ts` and `physicsWorker.ts` now patch `console.log/info/debug/
warn/error` at module scope to also `postMessage({ __log: true, level,
args })`. A `try/catch` in the forwarder swallows `DataCloneError` so
non-cloneable OCCT handles never crash the worker. `cadClient.ts` and
`physicsClient.ts` add a `message` listener before `Comlink.wrap`
that intercepts `__log` envelopes and re-emits them via the matching
`console` method prefixed with `[worker]`. Comlink ignores messages
without its RPC `id` field so the bridge doesn't interfere with RPC.

### Arc-pivot circleCenter omission fix ✅

`topology.ts` was computing `curveInfo.circleCenter` for every
circle/arc edge but never writing it into the emitted `EdgeMetadata`
object, so `edge.circleCenter` was always `undefined` at runtime.
Callers fell back to `polylineCenter()` — the arithmetic mean of arc
sample points — which diverges from the true circle centre for partial
arcs (a 90° arc of r=12mm gives centroid ≈ [−7.64, −7.64, 0] vs
correct [0, 0, 0]). Fix: one-field addition `circleCenter:
curveInfo.circleCenter` in `out.push()`. `EdgeMetadata` already
declared `circleCenter?` optional — no type changes needed.
Effect: revolute pivots now use the geometric circle centre, eliminating
the ~10.5 mm lateral pivot offset that was preventing the motor from
reaching π rad/s (`bodyBangvelMag` regression from ≈3.14118 to π ±5e-7).

### Comlink incoming-message path trace ✅

Both workers received a `message` listener before `Comlink.expose` that
logs every incoming RPC message type to `console.debug('[comlink-in]
<type>')`. Aids diagnosing silent-failure cases where a method call
never reaches the worker.

### Seed registry ✅

The seed registry IIFE (`window.loadSeed(id)`) is **inlined directly into
`index.html`** as a `<script data-base="%BASE_URL%">` block. It is no longer
fetched as a separate file. `public/seed-registry.js` remains in the repo as
a readable reference copy only — it is not loaded.

**Why inlined:** when the app is at a non-root base path (`/app`), Vite dev
does not serve `public/` files at the base-prefixed URL. A
`<script src="%BASE_URL%seed-registry.js">` tag caused a 404 because Vite dev
served the file at `/seed-registry.js` but `%BASE_URL%` substitution made the
browser request `/app/seed-registry.js`.

**Base path derivation:** the inline script reads
`document.currentScript.dataset.base` (the `data-base` attribute set to
`"%BASE_URL%"` on the script element). Vite's HTML-attribute substitution is
reliable for both dev and production; inline-script-text substitution is not.
`document.currentScript` is captured synchronously into a local `base` variable
at the top of the IIFE so the async `fetch()` call uses the correct value.

Loads `public/seeds/<id>.js` dynamically; each seed IIFE writes the persist
JSON to `localStorage["kineticad-state"]` and calls `location.reload()`.
How to add a seed: create `seeds/<id>.js` IIFE, match `version: N` to the
current store persist version (currently 9), add one `SEEDS` array entry
**in the inlined block inside `index.html`** (not in `public/seed-registry.js`).

### Orrery — full build ✅

Orrery is a solar-system mechanical orrery: sun at centre, planets on
tiered arms at Z=15–120mm, 3 moons (Earth, Mars, Saturn), asteroid
ring at Z=7mm. Driven entirely by the existing physics + mate system.

**Generator**: `scripts/src/generate-orrery-seed.ts` produces
`public/seeds/orrery.js`. Run with `pnpm --filter @workspace/scripts
run generate-orrery-seed`. The seed is a JSON blob in the persist
`{ state, version: 8 }` format; `window.loadSeed('orrery')` installs it.

**Assembly** (13 bodies, 12 revolute joints):
- Hub cylinder (r=10mm, h=135mm) grounded at origin.
- Sun sphere (r=12mm) at Z=135mm on hub top.
- 8 planets (Mercury→Neptune) on arms at Z=15/30/45/60/75/90/105/120mm,
  arm lengths 40–200mm, planet radii 5–20mm; each arm+planet pair is
  one part with a revolute joint to the hub, motor RPM set to give
  visually distinct orbital periods.
- 3 moons: Earth (Z=45mm), Mars (Z=60mm), Saturn (Z=90mm) — each a
  small sphere part joined revolute to its planet arm, higher RPM.
- Asteroid ring: thin torus-approximated geometry at Z=7mm, very slow RPM.

**Physics fixes required for the orrery**:
- `physicsWorker.ts`: `setSolverGroups(0x00010000)` on all colliders —
  disables inter-part contact forces so planets don't collide with each
  other or the hub and fly off chaotically.
- Gravity set to `[0, 0, 0]` in the orrery seed (mechanical orrery, no
  gravitational collapse).
- Sun represented as a zero-feature imported-shape part (a sphere mesh)
  rather than an OCCT geometry part — avoids tessellation overhead.
- `MOTOR_VELOCITY_GAIN = 10000` confirmed as the correct value for
  mm-unit assemblies (see Phase 9.5 Follow-up #7). One temporary bump
  to 40000 was reverted per user instruction; 10000 is the settled value.

**Scene tweaks** (applied to main scene, affect all models):
- Fog disabled: `scene.fog = null` in `sceneSetup.ts`.
- Camera `far` bumped from default to 5000 in `sceneSetup.ts`.
- `OrbitControls.maxDistance` bumped to 1500 in `Scene.tsx`.

### Save / Load model buttons ✅

Two buttons added to the Modeller toolbar after Export STEP, separated
by a divider: **Save** (Download icon) and **Load** (Upload icon).

**Save** (`handleSaveModel`): reads `localStorage.getItem('kineticad-state')`
directly — the persist middleware writes this synchronously on every state
change so it's always current — and downloads it as
`kineticad-model-YYYYMMDD-HHMMSS.json`. The file is byte-for-byte
identical to a seed file in `{ state, version }` format.

**Load** (`handleLoadModel`): opens a `.json` file picker. Validates:
(1) `version` and `state` keys present; (2) `version === 8`; (3)
`state.assembly` present. Shows a toast error and leaves state untouched
on any failure. On valid file: `localStorage.setItem('kineticad-state',
text)` then `location.reload()` — the same mechanism as the seed loader,
so workers and physics engine rebuild cleanly. `modelFileInputRef` +
`onModelFileChange` follow the same pattern as the existing STEP import
file input.

### Social media sharing image ✅

`artifacts/kineticad-intro` (the marketing/landing page): Open Graph /
Twitter Card `<meta>` image updated to a new screenshot. No code changes
to the CAD tool itself.

---

## Phase 10 — Material Library (2026-05-17)

Eight engineering materials with physically-based rendering colours and
density values. Material is set per-part; mass properties are computed
after every regen and shown live in the inspector.

**`cad/materials.ts`** (new): defines the `Material` type and
`MATERIAL_LIST` constant with eight entries — aluminium-6061 (2.70 g/cm³,
#A8B0BC, m0.7 r0.35), steel-1018 (7.87, #8C909A), brass-c36000 (8.50,
#B5A642), titanium-grade5 (4.43, #9DA8B0), nylon-6 (1.14, #E8D8C0),
pla (1.25, #C8D8E8), abs (1.04, #D4C8B8), acrylic (1.18, #C0D8E8).
`getMaterial(id)` returns the entry or falls back to aluminium-6061.

**`cad/operations/massProperties.ts`**: `density` parameter is now
required (was optional with a hard-coded aluminium default). Callers
must pass `getMaterial(part.materialId).densityGcm3`.

**`state/store.ts`** (persist v8 → v9):
- `Part` schema already had optional `volumeCm3` / `massKg`; `materialId`
  was already required. New default is `"aluminium-6061"`.
- New actions: `setPartMaterial(partId, materialId)` and
  `updatePartMassProps(partId, volumeCm3, massKg)`.
- `partialize` now strips `volumeCm3` / `massKg` from every part before
  writing to `localStorage` so stale computed values never survive reload.
- v8→v9 migration: any part with `materialId` absent or `"default"` is
  promoted to `"aluminium-6061"`. A defensive second pass runs regardless
  of the recorded version to handle hot-reload edge cases.

**`three/PartMeshLayer.ts`** (rewritten):
- Replaced the single `sharedMaterial` + `dimmedMaterial` pair with a
  `Map<materialId, { opaque, dimmed }>` cache keyed by material id.
  Pairs are created lazily on first use and disposed together in
  `dispose()`.
- `Entry` gains `lastMaterialId: string | null`.
- `sync()` accepts an optional `onMassPropsUpdate` callback. The correct
  PBR pair is applied synchronously to the mesh every sync (colour change
  is instant, no regen needed).
- `regenAndApply` detects `hashChanged || materialChanged`; when either is
  true it calls `kernel.getMassProperties({ density })` and fires the
  callback. The async mass-props call shares the same token guard as regen
  so stale results from superseded syncs are dropped.

**`three/Scene.tsx`**: both `partMeshLayer.sync` call sites (initial
mount and store subscription) now pass `onMassPropsUpdate` which
dispatches `updatePartMassProps` to the store via `getState()`.

**`components/inspectors/PartInspector.tsx`**:
- Material picker: `<select>` pre-populated from `MATERIAL_LIST` with a
  colour swatch and a density hint (g/cm³) shown as a suffix. Calls
  `setPartMaterial` on change.
- Mass readout: two tiles (Volume cm³ / Mass kg) shown once
  `volumeCm3 > 0`; "Computing mass properties…" shown while the regen
  is in flight for a part that has a base feature.

**`views/Modeller.tsx`**: load validation now accepts `version === 8`
OR `version === 9` so saved v8 files still open (migrate runs on load).

**Seeds**:
- `scripts/src/generate-orrery-seed.ts`: `PERSIST_VERSION = 9`,
  all `materialId: "default"` → `"aluminium-6061"`.
- `public/seeds/orrery.js`: regenerated (version 9, 13 bodies, 12 joints).
- `public/seeds/windmill.js`: updated version 8→9 and
  `materialId: "default"` → `"aluminium-6061"` for both parts.

**Verification**: ✅ Verified on deployed `.replit.app` (Chrome, M-series Mac).
`pnpm --filter @workspace/kineticad run typecheck` — clean (zero errors).
1. ✅ Load the orrery seed — all 13 parts render with aluminium colouring.
2. ✅ Select a part, open PartInspector — material picker shows
   "Aluminium 6061 / 2.70 g/cm³"; volume + mass tiles populate.
3. ✅ Change material to "Steel 1018" — mesh colour updates immediately;
   mass readout refreshes with ~2.9× higher mass.
4. ✅ Save model → reload → v9 file loads without version error.
5. ✅ Windmill canary (v8 file) opens; migration promotes materialId; π
   joint holds under simulation.

**Note**: the simulation's physics mass was still using hardcoded aluminium
density at Phase 10 ship — the inspector readout was correct but Play was not.
Fixed in the post-Phase-10 patch below; the full material-library correctness
story is only complete with both entries.

---

## Post-Phase-10 fix — Volume cache + simulation density correctness (2026-05-17)

Two bugs found by diagnosis of Play latency on the 13-part orrery.

**Correctness fix (`physics/simulationRunner.ts`)**: removed the hardcoded
`ALUMINIUM_DENSITY_G_CM3 = 2.7` constant. The simulation now calls
`getMaterial(part.materialId).densityGcm3` per part so physics mass/inertia
reflects the material the user actually set. Previously the simulation always
treated every part as aluminium regardless of the inspector selection.

**Performance fix — volume cache (`features/volumeCache.ts`, new module)**:
`VolumeData = { volumeMm3: number; comLocal: [number, number, number] }` keyed
by tip-feature hash (the same FNV-1a string `featureCache` uses for tessellated
meshes). Volume and centre-of-mass are geometry-only; mass is just
`volume × density × 1e-6`, which is arithmetic. Caching by tip hash gives
automatic invalidation — geometry changes → new hash → cache miss; material
changes → same hash → cache hit.

**`three/PartMeshLayer.ts`** updated in `regenAndApply`:
- On geometry change (`hashChanged`): after the OCCT `getMassProperties` call,
  writes `{ volumeMm3, comLocal }` into the volume cache.
- On material-only change (`materialChanged && !hashChanged`): reads volume from
  cache and computes `massKg` as arithmetic — **zero OCCT calls**.
- Cold-cache fallback (first regen, imported-STEP): falls back to
  `getMassProperties` worker call, then populates cache.

**`physics/simulationRunner.ts`** updated in `buildAndStart`:
- Computes the tip hash with a pure-JS `computeTipHash` helper (loops over
  `part.features`, calls `computeFeatureHash`, no worker round-trip).
- Warm cache path: derives `massKg`, `rEqMm`, `isoInertia` on the main thread
  from `volumeMm3 + density` — no `await`, no OCCT. For the 13-part orrery
  with a warm cache the entire mass-props loop is now synchronous.
- Cold-cache fallback: calls `getMassProperties` with the correct per-material
  density, then writes result to the volume cache for subsequent Play presses.

**No schema or persist changes.** `volumeCache.ts` is a module-level `Map` with
the same in-memory lifecycle as `featureCache.ts`. `part.volumeCm3` / `massKg`
in the store remain non-persisted (stripped by `partialize`).

**Verification**: ✅ Verified on deployed `.replit.app`. Orrery (13 parts,
all aluminium) plays correctly; changing a part to Steel 1018 and pressing
Play produces ~2.9× higher simulated mass. Windmill canary holds π joint
under simulation with correct density. Typecheck clean.

---

## Routing / BASE_PATH notes (`artifacts/kineticad`)

The app lives at `/app` (BASE_PATH = `/app`, set in `.replit-artifact/artifact.toml`).

**ModeToggle double-prefix bug (fixed 17/05/2026):** `WouterRouter` is
initialised with `base={import.meta.env.BASE_URL.replace(/\/$/, '')}` = `/app`.
Wouter's `<Link>` automatically prepends this base on navigation, so hrefs
inside the routed tree must be plain internal paths (`"/"`, `"/simulator"`).
An earlier version of `ModeToggle` also manually prepended `BASE_URL`, causing
wouter to apply it twice → `/app/app/simulator`. Fixed by removing the manual
`base +` prefix; `const base` line deleted entirely.

**Seed paths:** Seeds live in `public/seeds/<id>.js` and are fetched via
`base + 'seeds/' + id + '.js'` where `base` comes from
`document.currentScript.dataset.base` (the `data-base="%BASE_URL%"` attribute
on the inlined script tag in `index.html`). This works in both dev (`/app/`) and
the production build. `generate-orrery-seed.ts` writes to
`artifacts/kineticad/public/seeds/orrery.js` — matches the registry path.
`public/seed-windmill.js` is a backwards-compat shim; the canonical windmill
seed is `public/seeds/windmill.js`.

**Seed registry inlining (17/05/2026):** the `window.loadSeed` IIFE was moved
from `public/seed-registry.js` (fetched via `<script src>`) into a single inline
`<script data-base="%BASE_URL%">` block in `index.html`. Root cause of the
regression: Vite dev serves public files at the root path, not at the base-prefixed
path, so `<script src="%BASE_URL%seed-registry.js">` produced a 404 at `/app`
even though the attribute substitution gave `/app/seed-registry.js`.

**serve.mjs BASE_PATH strip (18/05/2026):** `window.loadSeed` was failing with
`SyntaxError: Unexpected token '<'` on `spock.replit.dev` (the production URL
served by `serve.mjs`) but not in the workspace dev preview (served by the Vite
dev server). The cause: the reverse proxy forwards the full path unchanged, so
`serve.mjs` received `/app/seeds/windmill.js` and did `join(DIST, urlPath)` →
`dist/public/app/seeds/windmill.js`, which does not exist (Vite build copies
public files to `dist/public/seeds/…`, no base prefix). The stat failure triggered
the SPA catch-all, returning `index.html` as HTTP 200. Fix: `serve.mjs` now reads
`BASE_PATH` from env, strips the prefix via `stripBase()` before joining with DIST,
and uses the stripped path for the `isHashedAsset` check too. The traversal guard
is unchanged (still validates the resolved path stays inside DIST).

---

## Landing page legal routes (`artifacts/landing`)

Two legal pages added to the landing site (18/05/2026). Both are client-side
routes within `artifacts/landing` — they do not touch the `/app` artifact.

| URL | Component |
|-----|-----------|
| `/terms` | `src/pages/TermsPage.tsx` — Terms of Service |
| `/privacy` | `src/pages/PrivacyPage.tsx` — Privacy Policy |

**Routing**: `App.tsx` now uses wouter `<Switch>` + `<Route>`. `/` retains the
existing mobile/desktop detection (`Home` component). Legal pages are rendered
without the mobile gate — they are plain text, readable on any screen.

**Shared layout**: `src/components/LegalPage.tsx` — takes `title`,
`lastUpdated`, and `sections` props; renders the `#0A0E1A` background layers,
a 760px-wide content column, `← Back to KinetiCAD` wouter link at top, numbered
sections, and the full site footer.

**Footer** (`DesktopLanding.tsx`): right side updated from a single
`kineticad.co.uk` link to a stacked column:
- Row 1: `kineticad.co.uk` · `Terms` (wouter Link) · `Privacy` (wouter Link)
- Row 2: © 2026 Adevious Ltd. All rights reserved.
- Row 3 (11px, low opacity): Adevious AI is a trading name of Adevious Ltd.
  Company No. 08550853, registered in England and Wales.

**Legal text**: verbatim as supplied. Contact email `support@adevious.co.uk`.
`MobileHolding.tsx` is unchanged.

---

## Current persist version: 9
## MOTOR_VELOCITY_GAIN: 10000 (physicsWorker.ts)
## Seed registry: window.loadSeed('windmill') | window.loadSeed('orrery')
## WebGPU testing: deploy to .replit.app and open in Chrome on M-series Mac
