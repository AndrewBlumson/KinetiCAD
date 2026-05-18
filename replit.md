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

---

## KinetiCAD (`artifacts/kineticad`)

Browser-based parametric CAD tool with planned live physics simulation. Built per a 12-phase spec; one phase at a time.

**Stack**: Vite + React 19 + TypeScript, Tailwind, Zustand store, Three.js r184 (WebGPURenderer), OpenCascade.js (Web Worker via Comlink).

**Phase status**:
- Phase 0 ✅ — App shell, dark navy theme (`#0A0E1A` bg, `#FF6B1A` orange), routes (`/` Modeller, `/simulator` Simulator), Zustand store + Zod schemas, sidebar/toolbar/inspector layout.
- Phase 1 ✅ — WebGPU scene, grid/axes/orbit camera, OpenCascade.js worker, graceful "WebGPU required" fallback.
- Phase 2 Split A ✅ — Sketch entry: PlanePicker (XY/XZ/YZ), 600ms easeInOutCubic camera tween, sketch overlay, `sketchSession` state machine, persist middleware.
- Phase 2 Split B ✅ — Drawing tools (line/rect/arc/circle), snap engine, Line2 rendering; in-flight primitive is LOCAL to `SketchSession` (not Zustand) so 60Hz mousemoves don't trigger React renders.
- Phase 3 Split A ✅ — Extrude/Revolve kernel plumbing: `featureCache`, `featureRegen`, FNV-1a cascade-invalidation hash, OCCT worker methods.
- Phase 3 Split B ✅ — Scene integration: `PartMeshLayer`, `PreviewMeshLayer`, 200ms-debounced live-preview pipeline, `NumericInput`, feature inspectors.
- Phase 4 Split A ✅ — Topology picking: stable edge/face IDs via FNV-1a canonical geometry hashing, `withWrapper` OCCT hygiene, `TopologyPicker` screen-space picking.
- Phase 4 Split B ✅ — Modifier features: Fillet (`BRepFilletAPI`), Chamfer, Hole (`BRepAlgoAPI_Cut` along inward face normal).
- Phase 5 ✅ — Boolean operations (Union/Subtract/Intersect): `BRepAlgoAPI_Fuse/Cut/Common`, `BooleanResultLayer`, cascade delete, `BooleanEditor`.
- Phase 6 ✅ — Multi-part: `TransformGizmo` (R/T keys), per-part visibility/position/rotation, `PartsPanelItem` + context menu, duplicate/rename, transform-aware booleans.
- Phase 7 ✅ — Mate joints (Revolute/Prismatic/Spherical/Fixed/Planar): `MatePickerCoordinator`, `MateVisualizer`, motor params stored (not yet actuated). Ground-part persistence fixed: `groundPartId` promotes to `parts[0].id` on `createPart` if previously empty.
- Phase 8 ✅ — Rapier3D rigid-body physics: `physicsWorker`, `SimulationLayer`, Play/Pause/Reset, speed multiplier (0.25×–2×), mass props via `BRepGProp.VolumeProperties_1`.
- Phase 9 / 9.5 ✅ — Motor actuation wired to Rapier joint API; mate inspector end-to-end: pick-filter slice, OCCT classifier fixed (embind enum coercion), motor model tuned, WASM CDN deploy fix, diagnostic console bridge.

**Deferred to Phase 12 polish** (per user, end of Phase 5):
- 3D click-to-select on boolean result meshes (`BooleanResultLayer` rendered but not wired into `TopologyPicker`; selection only via sidebar).
- Inline thumbnails in `BooleanInspector` for input parts, Subtract tool slot, and live result.

---

## Constraints & Gotchas

### OpenCascade.js

**OCCT API quirks in this binding** (`opencascade.js@2.0.0-beta.94e2944`):
- Constructors use numeric suffixes: `BRepPrimAPI_MakeBox_4`, `TopExp_Explorer_2`, `gp_Pnt_3`, `TopLoc_Location_1`, `gp_Vec3f_1`.
- **Overloaded methods also use numeric suffixes**: `wire.Closed_1()` (getter), `wire.Closed_2(value)` (setter). Unsuffixed `wire.Closed()` does NOT exist and fails silently — root cause of the T3 extrude regression (every extrude failed from Phase 3 until the diagnostic pass). When a method seems to do nothing, check for a numbered variant.
- `gp_Vec3f` getters are `x_1()`, `y_1()`, `z_1()` (not properties).
- `TopAbs_Orientation` enum values are singleton objects → compare with `===`.
- `Poly_Triangulation` nodes/triangles are 1-indexed.
- Always `.delete()` transient OCCT wrappers (face, location, triangulationHandle, gp_Vec3f, gp_Pnt corners, builders) to free WASM heap.

**Embind enum coercion** — `BRepAdaptor_Curve.GetType()` and `GetSurface()` return `{ value: N }` objects, **not** integers. The `===` comparison against integer constants is always false, routing every edge/face to the `"other"` fallback. Fix: use an `enumVal()` helper that handles raw integers, embind objects with `.value`, and `valueOf()`-coercible objects. Applied at every `GetType()`/`GetSurface()` call site in `topology.ts`. (QA impact: broke all Revolute/Prismatic/Planar mate filters silently; discovered via a `typeHistogram` diagnostic showing `{ other: 12 }` for a two-cylinder scene.)

**`BRepBuilderAPI_Copy_2` deep-copy pattern** — `TopoDS_Shape` wrappers alias internal sub-shapes. Any shape obtained from a builder (prism, reader, transform) must be deep-copied via `BRepBuilderAPI_Copy_2(shape, true, false)` **before** the builder or reader is `.delete()`-d in `finally`. Failing to do so produces empty meshes silently (extrude regression, STEP import regression). Applied in: `extrude.ts`, `cadWorker.importStep`.

**WASM CDN** — `opencascade.full.wasm` (50 MB) exceeds Replit's static-deploy size cap; the deploy pipeline returns HTTP 200 with an empty body, and `WebAssembly.instantiate()` throws `BufferSource argument is empty`. Fix: drop the `?url` asset import and use `locateFile` pointing to the pinned jsDelivr URL:
```
https://cdn.jsdelivr.net/npm/opencascade.js@2.0.0-beta.94e2944/dist/opencascade.full.wasm
```
The version string is factored into `OCCT_VERSION` in `cadWorker.ts` and must stay in lock-step with `opencascade.js` in `package.json`. No `.wasm` file is emitted under `dist/`.

**Vite config for OCCT** — the package's `index.js` wrapper uses a bare `.wasm` import that Vite cannot pre-bundle. Required config in `vite.config.ts`:
```ts
optimizeDeps: { exclude: ["opencascade.js"] }
worker: { format: "es" }
```

**XCAF naming** — STEP part-name extraction via `STEPCAFControl_Reader_1` + `TDataStd_Name` is structurally impossible in this binding. Eight candidate paths all failed (missing `DownCast`, missing statics, typed handle rejected by embind). `extractLabelName` is stubbed to `return ''`; file-stem fallback is the documented behaviour. `STEP_NAME_DEBUG` permanently `false`.

**Self-test on boot** — `cadWorker.ts` runs `runSelfTest` on kernel init: builds a 20×20mm sketch, extrudes 10mm, checks tri count + bbox. Logs `[SELF-TEST] OK` on success or `console.error([SELF-TEST] FAILED: …)` on failure. Chrome's DevTools "Errors only" filter hides worker `console.error` by default — errors surface on the page console via the worker→main console bridge in `cadClient.ts` (message listener before Comlink.wrap intercepts `{ __log: true }` envelopes).

---

### Rapier3D physics (mm + s + kg world)

**Unit convention**: all values in the physics layer are mm, s, kg. Gravity: `[0, 0, -9810]` mm/s² (Z-up). A 20×20×10mm aluminium cube → 4000 mm³, 0.0108 kg. Rapier is unit-agnostic; mass properties and gravity must agree.

**Motor settings** (in `physicsWorker.ts`):
- `setCanSleep(false)` on every dynamic body — a sleeping body ignores motor impulses and appears frozen.
- `MotorModel.AccelerationBased` (not `ForceBased`) — behaves as a true velocity servo; the constraint solver computes the impulse to reach target velocity each step and holds it. `ForceBased` is a P-controller with steady-state error.
- `MOTOR_VELOCITY_GAIN = 10000` — mm-unit inertias (50–500 kg·mm²) are 3–6 orders of magnitude larger than SI tutorial values; the effective gain must scale accordingly. Progression history: 1.0 → 100 → 10000. Comment in `physicsWorker.ts` records this so future readers don't repeat the SI assumption.
- `body.wakeUp()` must be called on both attached bodies after `updateJointMotor`, or a sleeping idle mechanism ignores the new motor settings.
- RPM → rad/s: `rpm × 2π / 60`.

**Fixed joint frame math** — `JointData.fixed` with identity anchors on both sides yanks body B's origin onto body A's under solver forces. Correct: at creation time sample `bodyA/bodyB.translation()/rotation()`, compute `frame2` in B's local frame as `T_B^{-1} · T_A` (translation = `q_B^{-1} ⊗ Δp ⊗ q_B`, orientation = `q_B^{-1} ⊗ q_A`). Frame1 stays identity in A. Helpers `quatMul` + `quatRotateVec` live in `physicsWorker.ts`.

**Inertia approximation** — principal-moment extraction via `GProp_PrincipalProps.Moments()` requires 3 output-arg ref boxes that this JS binding cannot allocate reliably. Workaround: approximate each part as an equivalent-volume sphere (`r_eq = (3V/4π)^{1/3}`, `I = (2/5) m r²`) for an isotropic diagonal. Sufficient for non-FEA dynamics.

**HMR singleton** — `cadClient.ts` and `physicsClient.ts` must hoist their kernel singletons to `globalThis.__kineticadKernel__` / `__kineticadPhysics__`. Module-level `let` bindings are reset on every Vite HMR module replacement, re-spawning the WASM worker on every file save. The `globalThis` slot survives module replacement in dev and is set exactly once in production.

---

### React / Zustand patterns

**Equality guards on editor state actions** — `setMateEditorError`, `setMateEditorParams`, `setMateEditorStage` (and equivalents for `featureEditor`/`booleanEditor`) must return the existing state object unchanged when the new value equals the current one. Without this, each call produces a fresh object reference, re-triggers every `useEffect` that lists the editor in its deps, re-fires the same setter, and page-crashes with "Maximum update depth exceeded". Pattern: `if (current === next) return {}` at the top of the action.

---

### WebGPU / Three.js

**WebGPU testing** — the Replit preview iframe does not support WebGPU; it is expected to show the "WebGPU required" message. All real testing must be done on the deployed `.replit.app` URL in Chrome on an M-series Mac.

**Windmill canary** — after any physics change, deploy to `.replit.app`, load `window.loadSeed('windmill')`, press Play, wait 5+ seconds, confirm `bodyBangvelMag ≈ π ±5e-7`. This is the regression signal for motor / inertia / joint regressions. A result outside that band means something in the physics pipeline broke.

**NodeMaterial rule** — every Three.js material in the WebGPU renderer must use the `three/webgpu` NodeMaterial variants (`MeshBasicNodeMaterial`, `MeshStandardNodeMaterial`, `Line2NodeMaterial`, `LineBasicNodeMaterial`). Classic `THREE.MeshBasicMaterial` etc. produce "Material X is not compatible with WebGPURenderer" warnings and may render invisible. Always force `blending: NormalBlending` on NodeMaterials that need transparency (they default to `NoBlending`).

---

### Seed registry

`window.loadSeed(id)` IIFE is **inlined directly into `index.html`** as a `<script data-base="%BASE_URL%">` block. `public/seed-registry.js` is a readable reference copy only — not loaded.

Loads `public/seeds/<id>.js` dynamically; each seed IIFE writes the persist JSON to `localStorage["kineticad-state"]` and calls `location.reload()`.

**To add a seed**: create `public/seeds/<id>.js` IIFE, set `version: N` to match the current store persist version (currently **9**), add one entry to the `SEEDS` array **in the inlined block inside `index.html`** (not in `public/seed-registry.js`).

**Seed URL join rule** — `%BASE_URL%` in a `data-*` attribute is substituted by Vite without a trailing slash (`"/app"`, not `"/app/"`). Always strip any trailing slash from `rawBase` then join with an explicit leading slash: `base + '/seeds/' + id + '.js'`. The bare concatenation `base + 'seeds/…'` produces `/appseeds/…` (confirmed from production request log).

Available seeds: `window.loadSeed('windmill')` | `window.loadSeed('orrery')`

Orrery generator: `pnpm --filter @workspace/scripts run generate-orrery-seed` → writes `public/seeds/orrery.js`. Must set `PERSIST_VERSION = 9` and `materialId: "aluminium-6061"` (not `"default"`).

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
`base + '/seeds/' + id + '.js'` where `base` comes from
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

**serve.mjs BASE_PATH strip (18/05/2026):** `serve.mjs` now reads `BASE_PATH`
from env and strips the prefix via `stripBase()` before joining with DIST (so
`/app/index.html` → `dist/public/index.html`, `/app/assets/…` → `dist/public/assets/…`).
This was a valid defensive fix but it was *not* the root cause of the seed error.

**Seed URL missing-slash bug — real root cause (18/05/2026):** the actual
production failure was a malformed fetch URL: `/appseeds/windmill.js` instead of
`/app/seeds/windmill.js`. Confirmed from a real production request log.

Cause: `%BASE_URL%` in a `data-*` HTML attribute is substituted by Vite without a
trailing slash (`"/app"`, not `"/app/"`). The old join was `base + 'seeds/' + id`
which produced `"/app" + "seeds/…"` = `"/appseeds/…"`. The missing slash meant
serve.mjs could not find the file and fell through to index.html (HTTP 200, HTML
body), which `eval()` rejected with `SyntaxError: Unexpected token '<'`.

Fix (in `index.html` only): strip any trailing slash from `rawBase` then join with
an explicit leading slash — `base + '/seeds/' + id + '.js'`. Handles all cases:
- `"/app"` → `"/app/seeds/windmill.js"` ✓
- `"/app/"` → strip → `"/app"` → `"/app/seeds/windmill.js"` ✓
- `"/"` → strip → `""` → `"/seeds/windmill.js"` ✓
`window.__seedBase` is set to the normalised (no trailing slash) value.

---

## Landing page (`artifacts/landing`)

### kineticad-intro artifact removed (18/05/2026)

`artifacts/kineticad-intro` (standalone GSAP/Three.js animation) deleted from the
repository. Served at `/kineticad-intro/`; no cross-dependencies. Workflow and
stale task files removed at the same time.

### SEO + /story page (18/05/2026)

New `/story` page (`StoryPage.tsx`) linked from the footer of all pages in orange.
Hero spacing: `clamp(64px, 10vh, 96px) 32px`.

SEO pass:
- `index.html`: canonical, Open Graph (og:type/url/title/description/image), Twitter Card (summary_large_image), `SoftwareApplication` JSON-LD schema.
- `public/sitemap.xml`: four URLs — `/`, `/story`, `/terms`, `/privacy`.
- `public/robots.txt`: `Sitemap:` directive added.
- `DesktopLanding.tsx`: four feature-column labels promoted `<span>` → `<h2>`.
- `not-found.tsx`: user-facing 404 + back link (replaced dev copy).
- `LegalPage.tsx` footer: registered office address added.

### Legal routes (18/05/2026)

| URL | Component |
|-----|-----------|
| `/terms` | `src/pages/TermsPage.tsx` — Terms of Service |
| `/privacy` | `src/pages/PrivacyPage.tsx` — Privacy Policy |

`App.tsx` uses wouter `<Switch>` + `<Route>`. Legal pages rendered without the mobile gate. Shared layout: `src/components/LegalPage.tsx` (760px column, `← Back`, numbered sections, site footer).

**Footer** (all pages): Story · Terms · Privacy links; © Adevious Ltd; company number; registered office (Rosedean House, 4 Argyle Road, Barnet, England, EN5 4DX).

---

## Current persist version: 9
## MOTOR_VELOCITY_GAIN: 10000 (physicsWorker.ts)
## Seed registry: window.loadSeed('windmill') | window.loadSeed('orrery')
## WebGPU testing: deploy to .replit.app and open in Chrome on M-series Mac
