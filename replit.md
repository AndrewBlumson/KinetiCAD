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
- Phases 2 Split B–12 — pending.

**Sketch overlay & camera**: `Scene.tsx` subscribes to the Zustand store **and** runs the same reconciler once immediately after subscribe so a session that started before the WebGPU/OrbitControls were ready still triggers the camera tween, overlay reveal, and `controls.enabled = false`. Tweens are advanced inside the WebGPU `setAnimationLoop` callback (not `requestAnimationFrame`).

**WebGPU testing note**: The Replit preview iframe does not support WebGPU; it is expected to show the "WebGPU required" message. Real testing must be done on the deployed `.replit.app` URL in Chrome on an M-series Mac.

**OpenCascade.js bundling**: Bypasses the package's `index.js` wrapper (bare `.wasm` import that Vite cannot pre-bundle). The worker imports the Emscripten factory directly from `opencascade.js/dist/opencascade.full.js` and feeds the WASM URL via `locateFile`. Vite config has `optimizeDeps.exclude: ["opencascade.js"]` and `worker: { format: "es" }`.

**OCCT API quirks** (this build's bindings):
- Constructors use numeric suffixes: `BRepPrimAPI_MakeBox_4`, `TopExp_Explorer_2`, `gp_Pnt_3`, `TopLoc_Location_1`, `gp_Vec3f_1`.
- `gp_Vec3f` getters are `x_1()`, `y_1()`, `z_1()` (not properties).
- `TopAbs_Orientation` enum values are singleton objects → compare with `===`.
- `Poly_Triangulation` nodes/triangles are 1-indexed.
- Always `.delete()` transient OCCT wrappers (face, location, triangulationHandle, gp_Vec3f, gp_Pnt corners, builders) to free WASM heap.
