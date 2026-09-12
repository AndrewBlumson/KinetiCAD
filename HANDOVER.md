# KinetiCAD developer handover

Updated 12 September 2026 for implementation baseline `8e954ab` on
`codex/built-in-demo-gallery`. Start with [Current status](docs/CURRENT-STATUS.md)
and the [documentation index](docs/README.md).

## Project identity and continuation

KinetiCAD was originally built on Replit with Replit Agent by Andrew Blumson,
co-built with Kevin Blumson, during the Replit 10 Buildathon in May 2026.
It remains a Replit-built, MIT-licensed application intended to be free.
Andrew is a Replit UK Ambassador and the creator of KinetiCAD at Adevious AI.
Later development, automated checks and actual Chrome computer-use verification
were performed by Codex under Andrew's direction. Do not rebrand that original
Replit build or attribute its May tests to Codex.

The original [17 May handover](docs/history/HANDOVER-2026-05-17.md) is preserved
unchanged for engineering history. Its old storage, Planar-joint and Boolean
limitations are not current instructions. Current source, dated evidence and
[the reconciled issue list](docs/KNOWN-ISSUES-AND-FOLLOW-UP.md) take precedence.

- Repository: [AndrewBlumson/KinetiCAD](https://github.com/AndrewBlumson/KinetiCAD).
- Intended production app: [kineticad.co.uk/app](https://kineticad.co.uk/app).
- Landing routes: `/`, `/story`, `/terms`, `/privacy`.
- Development remains private until Andrew chooses public release. A branch
  within a public repository cannot independently be private.
- Use the existing Replit project, preserving its domain and publishing setup;
  follow [Replit handoff](docs/REPLIT-HANDOFF.md). Local source changes do not
  prove that the public deployment has been updated.

## Current implementation

The source includes six editable gallery demos, a separate adjustable
crank-slider, bounded six-axis Stewart control, complete native/imported STEP
projects and recovery, persistent numeric sketch dimensions, and direct
simulation of connected assembly Boolean results. The three Engineering tests
tabs are separate scoped models: Motor & load, Friction & contact, Elastic beam.

Desktop WebGPU is required for CAD. Phone/tablet access to both CAD routes is
blocked; public information pages remain readable. There is no mobile CAD or
WebGL fallback. File controls have labels and hover/keyboard help. Creator and
social links are included on the landing page and shared footer.

**Current automated baseline: 298/298 tests and full typecheck/build pass.**
The [test catalog](docs/TEST-CATALOG.md) lists every test, and
[mathematics/physics](docs/MATHEMATICS-AND-PHYSICS.md) states equations and limits.
The latest Boolean stage still awaits user review and one native downloaded-file
Load check. Actual downloads, parser validation, refresh and new-tab recovery
passed. Public Replit publication/route acceptance remains pending.

## Runtime and source map

Pinned primary dependencies: React 19, Vite 7, TypeScript 5.9, Three.js 0.184.0,
OpenCascade.js `2.0.0-beta.94e2944`, Rapier3D `0.12.0`, Comlink `4.4.1`.
Use Node 24 as configured in `.replit`, pnpm and the committed lockfile.
Do not upgrade the geometry or physics kernel as part of a routine handoff.
The fresh local test inventory used Node 25.4.0/pnpm 10.28.2; testing in the
configured Replit runtime remains part of the publication handoff.

| Location | Responsibility |
| --- | --- |
| `artifacts/kineticad/src/cad/` | OCCT worker/API, exact solid operations, topology, tessellation and mass properties |
| `artifacts/kineticad/src/features/` | Ordered feature regeneration, caches, assembly Boolean preparation |
| `artifacts/kineticad/src/three/` | WebGPU scene/layers, topology selection, joint overlays and simulation meshes |
| `artifacts/kineticad/src/physics/` | Assembly planning, Rapier worker/runner, demo controllers and engineering experiments |
| `artifacts/kineticad/src/state/` | Typed assembly/project state, editor actions and derived body identities |
| `artifacts/kineticad/src/project/` | Complete document validation, STEP asset restoration and IndexedDB recovery |
| `artifacts/kineticad/src/sketch/` | Plane geometry and validated numeric sketch edits |
| `artifacts/kineticad/src/components/` and `views/` | Modeller/Simulator, inspectors, demos and measurement panels |
| `artifacts/kineticad/tests/` | Automated suites, standalone verifiers and fixtures |
| `artifacts/landing/` | Replit landing app, creator profile, story and legal pages |
| `scripts/src/` | Demo generation and geometry verification |
| `docs/` | Current guides, dated numerical/browser evidence and follow-up register |

React/Three.js and orchestration run on the main thread. The CAD worker owns
OCCT; the assembly physics worker owns Rapier. Separate engineering experiments
have a dedicated worker lifecycle. Use Comlink APIs and retain asynchronous
snapshot/ownership guards. No paid AI API is needed for these calculations.

## Physical and geometric contracts

1. Coordinates use Z-up, mm, seconds and kg. Convert newtons to kg·mm/s² with
   a factor of 1000. CAD density presets are in g/cm³; mass is volume × density
   × 10⁻⁶ kg. Gravity is normally `[0, 0, -9810]` mm/s².
2. Mesh, volume, COM and full centroidal inertia must describe the same final
   OCCT shape. Preserve the principal-axis orientation when passing inertia to
   Rapier. Material changes rescale geometric mass data; do not replace it with
   a sphere or bounding box approximation.
3. Native topology is part-local. Rotate/translate picks exactly once. Boolean
   result geometry is already in assembly coordinates and uses an identity
   body transform. Its ID is `boolean:<feature ID>`.
4. Simulation excludes all construction inputs consumed by a Boolean, even
   when the Modeller displays them. Results require one connected solid and a
   uniform finished material. Empty/disconnected results, ambiguous materials,
   reused inputs and stale result attachments fail explicitly.
5. Boolean joint revisions are captured when picked, persisted, and rechecked
   at Apply and simulation startup. Reapplying a name or RPM edit must not make
   obsolete attachments valid. No automatic input-to-result joint remapping.
6. Native-only workspaces retain the original default fixed-base policy.
   Boolean assemblies permit an explicitly free world. Creating/importing parts
   or migrating old data must not silently ground a free Boolean assembly.
7. Fixed joints preserve their initial relative pose; spherical joints use two
   local anchors. Revolute/prismatic frame combinations must meet the installed
   binding's restrictions. Unsupported frames and legacy Planar joints reject
   the entire build; constraints must never be silently omitted.
8. CAD assembly contact is disabled. Ordinary motors are ideal velocity
   drives without finite force/torque ratings. Friction, strength, deformation
   and payload capacity cannot be inferred from rendered motion or material names.
9. Fixed solver steps accumulate requested elapsed time. Pause, reset and mode
   changes invalidate stale responses. Rendering frequency is not the timestep.
10. Preserve the original Windmill gate: after five simulated seconds,
    30 RPM = π rad/s within **±5e-7 rad/s**. Do not relax it to pass a change.

The [capability audit](docs/simulator-capability-audit.md) and feature records
provide the exact narrower limits of each demo and bench.

## Saving, loading and geometry exchange

**Save project** downloads a complete `.kineticad.json` document: project format
1 wraps state version 9 and embeds original STEP assets alongside native history,
materials, transforms, supported experiment settings and joints. IndexedDB holds
current and previous complete recovery generations. Raw WASM handles remain
transient and must be reconstructed before scene hydration.

Load validates before replacing the live project. Invalid data, quota failures
and stale asynchronous writes must preserve the last good recovery copy. Legacy
v8/v9 files without imported geometry still require their original STEP. Kernel
or tessellation changes may require explicit project migration.

STEP/STL exports are geometry exchange, not complete project recovery. STEP
preserves solid geometry/placement through this app's round-trip, but this
export path does not preserve mates, feature history, materials or subassembly
hierarchy. STL is a triangle mesh. Export visibility deliberately differs from
simulation: **Hide inputs off** can export original operands alongside a result.
See [project recovery](docs/PROJECT-RECOVERY.md) and [exports](docs/ASSEMBLY-EXPORT.md).

## Working and testing

```sh
pnpm install --frozen-lockfile
PORT=5184 BASE_PATH=/app pnpm --filter @workspace/kineticad dev
```

Open a top-level desktop Chrome tab at `http://localhost:5184/app/`. CAD Vite
requires both variables even outside Replit. The embedded Replit preview may
lack WebGPU; test its direct application route instead.

```sh
pnpm --filter @workspace/kineticad test:all
PORT=5184 BASE_PATH=/app pnpm run build
```

Heavy OCCT suites run serially. The full build includes typechecking. For a
standalone local landing build use `PORT=5186 BASE_PATH=/` with the landing
package, rather than accidentally building its URLs under `/app`.

Follow [Replit handoff](docs/REPLIT-HANDOFF.md) for production serving. Retain
`serve.mjs` cache headers and the pinned OCCT WASM CDN/version setup described
in `replit.md`; do not replace deployment configuration from another artifact.

Before declaring a feature verified, record its independent expected value,
units, tolerance, measured result, source/fixture identity and model assumptions.
Then exercise the actual interface where applicable. A unit test, screenshot,
mocked worker or healthy build is not a substitute for the other evidence layers.
Preserve historical numerical reports; rerun into a new named record.

## Next work

Use [NEXT-IMPLEMENTATION-TODO.md](docs/NEXT-IMPLEMENTATION-TODO.md), then
[KNOWN-ISSUES-AND-FOLLOW-UP.md](docs/KNOWN-ISSUES-AND-FOLLOW-UP.md). Finish the
outstanding Boolean Load-dialog check and Andrew's review before a new feature.
Old issues are queued for later investigation, not assumed still broken merely
because they appear in the original handover. The draw-a-path optimiser,
ordinary assembly force/contact/friction, and general deformation remain future
stages. Keep each change bounded and tested before proceeding.
