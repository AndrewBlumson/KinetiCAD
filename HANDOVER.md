# KinetiCAD developer handover

Release preparation: **382/382 automated tests across 54 files**, full workspace typecheck/build and scoped Chrome history/selection checks passed. See [verification](docs/HISTORY-AND-SELECTION.md) and [dependency security review](docs/DEPENDENCY-SECURITY-REVIEW.md). The pinned dependencies have **58 advisory records**; a security-update decision, distribution-notice checks and Replit/public-route acceptance remain open. Local functionality passing is not a security clearance.

Updated 12 September 2026 for Undo/Redo, object selection, release preparation
and the earlier four-bar/hinge improvements on `codex/built-in-demo-gallery`.
Local verification scope is recorded below. Start with [Current status](docs/CURRENT-STATUS.md) and the
[documentation index](docs/README.md).

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
simulation of connected assembly Boolean results. The source also includes a local **Draw a path** four-bar designer, bounded
Undo/Redo, and whole-solid canvas selection. The three Engineering tests tabs remain
separate scoped models: Motor & load, Friction & contact, Elastic beam.

Desktop WebGPU is required for CAD. Phone/tablet access to both CAD routes is
blocked; public information pages remain readable. There is no mobile CAD or
WebGL fallback. File controls have labels and hover/keyboard help. Creator and
social links are included on the landing page and shared footer.

The [current test catalog](docs/HISTORY-SELECTION-TEST-CATALOG.md) and
[history/selection verification](docs/HISTORY-AND-SELECTION.md) identify the
latest combined regression/build/browser evidence. Undo's first checkpoint
passed 369/369 tests before selection work. Earlier 298/348/351-test records
remain historical and must not be relabelled as final acceptance.

The [revolute picking follow-up](docs/REVOLUTE-PICKING-VERIFICATION.md) records an
actual Chrome translated-arc pivot error reduced from **54.08 mm** to
**less than 1.31e-8 mm**, plus the **37° Z-rotated** case. The translated saved
project passed native Load and Play/Pause/Resume/Reset; the rotated saved
project passed Load and full refresh, then Save produced an assembly exactly
equal to the original corrected download, including transforms and pivots.
Previously saved incorrect joints must be picked again; this correction does
not automatically migrate them.

[Actual Chrome checks](docs/evidence/four-bar/browser.json) passed the 60 mm
preset search/build, native Save/Load and refresh, saved-target restoration,
Pause/Resume/Reset, and reference invalidation after a manual material edit.
Live custom-path checks used the keyboard editor; a closed freehand pointer
stroke was exercised by seven controlled component-handler tests, not replayed
as a successful curved gesture in Chrome. This is a coverage distinction, not
a claim that every feature was retested through every input method.

The Boolean native downloaded-file reopening gate has now passed for the fixed
joint fixture: actual Load, Play/Pause/Reset and browser refresh retained its
Brass material, fixed base and joint. See the [browser record](docs/evidence/boolean-reopen/browser.json).
This does not claim native file-dialog reopening of every joint fixture.
Andrew's review of the new stage and public Replit publication/route acceptance
remain separate gates.

### Bounded four-bar path designer

**Draw a path** accepts a simple closed outline, three known-mechanism presets
or an ellipse target. The initial width is 60 mm; 40–160 mm edits preserve aspect
ratio. An explicit closing segment and a keyboard point editor make the target
reviewable before search. A dedicated local worker searches a bounded family of
planar mechanisms; progress is provisional and Cancel stops that worker.

The final typical RMS and worst sampled gaps compare corresponding progress
around complete loops. They are sampled geometric errors, not timed tracking or
a global-optimum guarantee. **Build editable model** prepares four native parts
and four revolute joints before entering the protected generated workspace.
The original project remains available through **Return to my model**. Save
retains the drawing, parameters, seed and editable history.

Play drives one input crank at 10 RPM for one six-second turn with zero gravity
and ideal joints. The measured tracer comes from the actual coupler pose; its
screen label follows the displayed material point. No contact, finite motor
load rating or arbitrary-machine synthesis is implied. Manual physical edits
invalidate the generated reference. The [four-bar guide](docs/FOUR-BAR-PATH-VERIFICATION.md)
defines the narrower mechanism domain and acceptance tolerances.

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
| `artifacts/kineticad/src/state/` | Typed document state, bounded Undo/Redo transactions, editor actions and body identities |
| `artifacts/kineticad/src/project/` | Complete document validation, STEP asset restoration and IndexedDB recovery |
| `artifacts/kineticad/src/sketch/` | Plane geometry and validated numeric sketch edits |
| `artifacts/kineticad/src/mechanisms/` | Bounded crank-slider/four-bar geometry, local path search and generated-workspace contracts |
| `artifacts/kineticad/src/components/` and `views/` | Modeller/Simulator, inspectors, demos and measurement panels |
| `artifacts/kineticad/tests/` | Automated suites, standalone verifiers and fixtures |
| `artifacts/landing/` | Replit landing app, creator profile, story and legal pages |
| `scripts/src/` | Demo generation and geometry verification |
| `docs/` | Current guides, dated numerical/browser evidence and follow-up register |

React/Three.js and orchestration run on the main thread. The CAD worker owns
OCCT; the assembly physics worker owns Rapier. Path synthesis runs in its own
cancellable search worker. Separate engineering experiments have a dedicated
worker lifecycle. Retain asynchronous snapshot/ownership guards and search
request IDs. Search candidates must not trigger native CAD replacement; only
the explicit, preflighted Build action does that. No paid AI API is needed.

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
[KNOWN-ISSUES-AND-FOLLOW-UP.md](docs/KNOWN-ISSUES-AND-FOLLOW-UP.md). The current
Undo/Redo → selection → documentation sequence is authorised and tested in
separate checkpoints. Review the final release checklist before publication. The prior Boolean Load-dialog gate is
closed by the linked fixed-joint record.
Old issues are queued for later investigation, not assumed still broken merely
because they appear in the original handover. Ordinary assembly force/contact/
friction and general deformation remain future stages. Keep each change bounded
and tested before proceeding; do not upgrade packages or publish as part of this
documentation handoff.

## History and picking implementation contracts

`state/documentHistory.ts` stores immutable serialised source snapshots with
50-entry/16 MiB bounds. `store.ts` records committed document actions; derived
mass/mesh updates, frames, selection and editor previews do not create entries.
Group multi-part imports and movement gestures explicitly. External assembly
replacement, hydration and demo boundaries clear history. Imported source assets
must remain available after deletion; restore prepares them and rejects stale
async publication. Do not clear the asset registry during Undo.

`three/ObjectPicker.ts` handles whole-object selection separately from topology
picking. Use visible native meshes and display Boolean meshes, including
compounds, while retaining single-solid restrictions for physical bodies.
Selection outlines use transformed CAD polylines, not shared-material mutations.
Boolean results derive their placement from inputs and do not receive a gizmo.

Use `node scripts/src/capture-test-suite.mjs --output-dir <new-directory>` for a
portable serial suite capture with named test results and source hashes. It
preserves the two historical JSON reports normally rewritten by tests. Do not
run parallel CAD suites or change source during a capture. The old four-bar
`capture-suite.py` is retained as historical evidence, not a clone-ready command.
See [publication preparation](docs/PUBLIC-RELEASE-CHECKLIST.md) and
[third-party notices](THIRD-PARTY-NOTICES.md).
