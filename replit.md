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
- Phases 4–12 — pending.

**Sketch overlay & camera**: `Scene.tsx` subscribes to the Zustand store **and** runs the same reconciler once immediately after subscribe so a session that started before the WebGPU/OrbitControls were ready still triggers the camera tween, overlay reveal, and `controls.enabled = false`. Tweens are advanced inside the WebGPU `setAnimationLoop` callback (not `requestAnimationFrame`).

**WebGPU testing note**: The Replit preview iframe does not support WebGPU; it is expected to show the "WebGPU required" message. Real testing must be done on the deployed `.replit.app` URL in Chrome on an M-series Mac.

**OpenCascade.js bundling**: Bypasses the package's `index.js` wrapper (bare `.wasm` import that Vite cannot pre-bundle). The worker imports the Emscripten factory directly from `opencascade.js/dist/opencascade.full.js` and feeds the WASM URL via `locateFile`. Vite config has `optimizeDeps.exclude: ["opencascade.js"]` and `worker: { format: "es" }`.

**OCCT API quirks** (this build's bindings):
- Constructors use numeric suffixes: `BRepPrimAPI_MakeBox_4`, `TopExp_Explorer_2`, `gp_Pnt_3`, `TopLoc_Location_1`, `gp_Vec3f_1`.
- `gp_Vec3f` getters are `x_1()`, `y_1()`, `z_1()` (not properties).
- `TopAbs_Orientation` enum values are singleton objects → compare with `===`.
- `Poly_Triangulation` nodes/triangles are 1-indexed.
- Always `.delete()` transient OCCT wrappers (face, location, triangulationHandle, gp_Vec3f, gp_Pnt corners, builders) to free WASM heap.
