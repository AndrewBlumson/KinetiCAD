# Known issues and follow-up audit

12 September 2026. Current implementation reviewed: `8e954ab` on
`codex/built-in-demo-gallery`. Original local `main` reviewed: `d01f814`
(`d01f8149bbf52fc1091aba82496d968466800643`, “Update docs for public GitHub
release”). No fetch, application changes or deployment were part of this audit.

This reconciles the original issue notes with current code and recorded evidence.
It is a queue for later work, not an instruction to begin fixing the items. The
user requested one stage at a time, with their testing between stages. KinetiCAD
remains the Replit-built project created by Andrew Blumson, co-built with Kevin
Blumson; the existing Replit project remains its intended publishing destination.

Later on 12 September, the native Boolean file-reopening gate passed and the
user authorised stage 4, the local four-bar path designer. That bounded implementation is now locally verified in the [four-bar record](FOUR-BAR-PATH-VERIFICATION.md); the original audit's 298-test snapshot remains historical. The older feature requests below remain deferred.

## How to read the dispositions

- **implemented:** the requested capability exists, with linked evidence for its stated scope.
- **resolved-with-limits:** the reported failure is addressed, or a supported subset exists; the remaining boundary is stated.
- **still-open:** current source still lacks the requested capability. This does not mean a fix is authorised now.
- **not-freshly-verified:** the relevant complete acceptance check is not recorded for the current stage; this is not a confirmed failure.
- **binding-limitation:** the installed library/API cannot currently express or expose the required behaviour through the implemented path. A future binding change needs its own investigation and regression checks.

The current [status](CURRENT-STATUS.md), [test catalog](TEST-CATALOG.md) and
[Boolean-stage validation record](boolean-simulation-validation.json) distinguish
automated tests, actual Chrome interaction, user review and publication. Test
counts do not establish every UI path or every possible engineering model.

## Original source trail

The original [README issue list][original-readme], [HANDOVER backlog][original-handover]
and [replit.md phase notes][original-replit] are pinned to the original commit in
the references below. The handover is also preserved in
[the historical archive](history/HANDOVER-2026-05-17.md).

The original `main` tree contains no separate tracked TODO/task document for these
issues. Later tracked work is in [IMPLEMENTATION-TODO](IMPLEMENTATION-TODO.md)
and [NEXT-IMPLEMENTATION-TODO](NEXT-IMPLEMENTATION-TODO.md). Their 166-, 195-,
237- and 298-test milestones are separate source snapshots, not interchangeable
release claims. Original `replit.md` labels phases 11–12 pending without defining
a complete acceptance checklist for them; this audit does not declare those
phases finished by inference.

Reproduce the historical comparison locally with:

```sh
git show d01f814:README.md
git show d01f814:HANDOVER.md
git show d01f814:replit.md
```

## Files, imports and recovery

| Original issue and source | Current disposition and evidence | Concrete future acceptance check |
| --- | --- | --- |
| Imported STEP disappears on refresh; Save omits its B-rep. [README 100][original-step], [HANDOVER 66][original-handover] | **implemented.** Complete project files embed raw STEP assets with stable references and integrity checks. IndexedDB retains current and previous recovery copies; restoration validates/reimports before replacing the active project. Native feature history, materials, transforms and mates are preserved. See [recovery contract](PROJECT-RECOVERY.md), [actual-worker results](project-recovery-results.json) and [baseline Chrome checks](CHROME-ACCEPTANCE-2026-09-12.md). | Keep the regression path Import → native downstream edit → Save → fresh session → Load → edit → simulate/export. Include corrupt/missing assets and a failed storage commit, checking that the original project and last good recovery copy survive. Do not treat an old file that never contained STEP bytes as recoverable without its source file. |
| Latest downloaded Boolean result-joint project needed a native Chrome Load check. [Tracked stage](NEXT-IMPLEMENTATION-TODO.md), rather than an original May defect | **resolved-with-limits.** The actual saved Fixed-joint project reopened through Chrome's native chooser on port 5190. Brass, its fixed base, two bodies, the Fixed joint, 2,000 mm³ and 0.017 kg were retained; Play/Pause/Reset and another browser refresh passed. See [dated browser evidence](evidence/boolean-reopen/browser.json) and [scope](BOOLEAN-SIMULATION-VERIFICATION.md). This closes the recorded gate; the separate Spherical file's parser/recovery evidence is not relabelled as a native-dialog reopening. | Retain the actual saved-file reopening regression after loader or result-joint changes. Confirm material, grounding and joint identity, run/reset and refresh; record any expanded fixture coverage separately from the fixed-joint case already measured. |
| STEP round trips lose subassembly grouping. [README 96][original-step], [HANDOVER 64][original-handover] | **still-open.** The app models a flat part list and exports solids, including complete disconnected Boolean compounds. Geometry/placement preservation is tested; subassembly identity and grouping are not preserved. See [export contract](ASSEMBLY-EXPORT.md) and [export measurements](assembly-export-results.json). The original README's general “hierarchy intact” sentence conflicts with its own explicit limitation; it is not evidence that hierarchy worked. | Define a nested-assembly project representation, then import/export a fixture with two subassemblies, repeated component instances and mixed transforms. Compare hierarchy, instance identity and world geometry after reopening. Until then, describe the existing path as flat geometry interchange. |
| Imported component PRODUCT names become filename-derived names. [README 102][original-step], [HANDOVER 68][original-handover] | **binding-limitation.** The pinned OpenCascade.js importer still has a documented `extractLabelName` stub and filename fallback in [cadWorker.ts](../artifacts/kineticad/src/cad/cadWorker.ts). The historical investigation found the necessary `TDataStd_Name` access unavailable in this binding. “Permanent” in the old notes describes that implementation, not all future OCCT versions. | Before a library change, prove name extraction against the actual candidate binding with distinct PRODUCT names, repeated instances and a nested fixture. Verify association with the correct solid rather than relying only on enumeration order. Re-run durable asset and STEP regressions if the binding changes. |
| STEP loses KinetiCAD mates. [README 94][original-step], [HANDOVER 62][original-handover] | **resolved-with-limits.** **Save project** preserves mates; this app's STEP import/export path exchanges geometry without reconstructing KinetiCAD joints or editable history. See [project contract](PROJECT-RECOVERY.md) and [export contract](ASSEMBLY-EXPORT.md). The old statement that this is universally impossible in STEP is too broad; the original handover itself mentions AP242 kinematic provisions. | If kinematic STEP interchange is later wanted, specify the exact schema and a second CAD tool, then verify axes, anchors, relative transforms and drive semantics in both directions. Continue recommending the project format for complete editable KinetiCAD assemblies. |
| IGES import/export. [README 132][original-roadmap], [HANDOVER 91][original-roadmap-handover] | **still-open.** The current [CAD API](../artifacts/kineticad/src/cad/types.ts) and file controls expose STEP import and STEP/STL export, without an IGES path. | Establish a supported surface/solid subset and unit policy. Use an independent IGES fixture to compare validity, units, volume/area, placement and failure handling through the actual import/export UI. |

Recovery remains origin/device-local and can be cleared by the browser. Its
strict imported-body fingerprint is tied to the installed kernel/tessellation
behaviour; an incompatible future version needs migration or explicit reimport.
Those limits are documented in [PROJECT-RECOVERY](PROJECT-RECOVERY.md), not hidden
behind the completed persistence checkbox.

## Sketching, picking and modelling

| Original issue and source | Current disposition and evidence | Concrete future acceptance check |
| --- | --- | --- |
| Partial-arc pivot metadata fixed, but real edge-to-mate picking unverified. [README 104][original-step], [HANDOVER 78][original-handover] | **not-freshly-verified.** [Topology extraction](../artifacts/kineticad/src/cad/operations/topology.ts) emits `circleCenter`; [MatePickerCoordinator](../artifacts/kineticad/src/three/MatePickerCoordinator.ts) uses it. Actual [arc CAD tests](../artifacts/kineticad/tests/sketch-arcs.test.mjs) verify trimmed-arc construction on all three sketch planes. They do not prove that a user-picked partial arc reaches the mate with the correct pivot. Neither the full-circle windmill nor the Boolean box face tests closes this gap. | Create a known partial circular rim, including a translated/rotated case. Click that actual edge in the revolute inspector, verify the stored pivot equals the true circle centre rather than the arc's sampled centroid, then Apply, Save/Load and run. Capture joint-axis, closure and angular-speed measurements with declared tolerances. |
| Hole position picker clears the selected face on the second click. [README 109][original-sketch], [HANDOVER 80][original-handover] | **resolved-with-limits.** The face and point are retained through the two-stage planar-face path. The unchanged [five picker regressions](../artifacts/kineticad/tests/hole-picker.test.mjs) cover top/bottom faces, mixed XYZ transforms, Clear face and replacement selection; [Chrome acceptance](CHROME-ACCEPTANCE-2026-09-12.md) includes actual native/imported Hole creation and editing. | Preserve those regressions when picking changes. Repeat a native and an imported transformed planar face through two actual clicks, change the hole diameter, and reopen the saved result. Do not extend this result to unsupported curved-face drilling. |
| Multiple closed sketch loops, e.g. a plate outline plus a hole. [README 110/129][original-sketch], [HANDOVER 82][original-handover] | **still-open.** [sketchToWire.ts](../artifacts/kineticad/src/cad/operations/sketchToWire.ts) explicitly rejects multiple closed primitives. Connected single-loop line/arc profiles and numeric edits work, but [editable dimensions](SKETCH-DIMENSIONS-VERIFICATION.md) did not add inner wires or a general sketch constraint solver. | Define outer/inner-loop orientation and containment, including nested/disjoint/self-intersecting cases. Build and edit a plate/ring on XY/XZ/YZ, measure analytic volume/centroid, and verify Save/Load and downstream Hole/Boolean operations without accepting ambiguous profiles. |
| Sketch on a selected face. [README 111/130][original-sketch], [HANDOVER 84][original-handover] | **still-open.** [PlanePicker](../artifacts/kineticad/src/components/PlanePicker.tsx) creates sketches only on XY/XZ/YZ. Plane-related types do not establish a working face-attachment workflow. | Define a stable face reference and local UV frame, then create a sketch on a rotated/translated planar face. Verify inward/outward extrusion, parent feature edits, invalid/deleted support faces and project reopening. State whether curved faces remain excluded. |
| No undo/redo. [README 113/133][original-sketch], [HANDOVER 92][original-roadmap-handover] | **still-open.** [Store actions](../artifacts/kineticad/src/state/store.ts) have no document undo/redo history. Cancel, failed-edit rollback, demo return and **Recover previous** serve different purposes. | Specify document transactions before adding history. Exercise sketch/feature edits, imported assets, transforms, materials, joints and cascading deletion; undo/redo each through actual UI, test redo branching after a new edit and confirm history cannot resurrect invalid WASM handles. |
| Boolean meshes cannot be picked in the 3D view. [README 108/136][original-sketch], [HANDOVER 86][original-handover], [replit.md 55][original-replit] | **resolved-with-limits.** Connected Boolean result topology is selectable in supported joint creation workflows; Fixed also accepts tree selection. [Boolean verification](BOOLEAN-SIMULATION-VERIFICATION.md) records actual Fixed/Spherical paths, ready-geometry checks and pick-time revisions. General result click-to-select outside mate editing remains unimplemented; disconnected results render but are not physical mate targets. | First close the partial-arc and native-file checks above. For a later general selection stage, define whether clicking opens the Boolean editor or selects an object, verify occlusion and native/result overlap, and avoid implying an independently transformable result when its geometry is derived from inputs. |
| Inline Boolean input/tool/result thumbnails. [HANDOVER 95][original-roadmap-handover], [replit.md 56][original-replit] | **still-open.** [BooleanInspector](../artifacts/kineticad/src/components/inspectors/BooleanInspector.tsx) uses named input controls and a live scene preview; it does not contain the requested inline geometry thumbnails. | Verify a Union, ordered Subtract and Intersect with similarly named parts. Thumbnails must correspond to the current transformed input/result, handle regeneration failure and remain usable without replacing textual accessible names. |

The completed [numeric sketch-dimension stage](SKETCH-DIMENSIONS-VERIFICATION.md)
is a separate improvement. Its tested primitive editing and atomic rebuilds do
not silently mark the multi-loop, face-sketch or undo items complete.

## Physics and joint boundaries

| Original issue or later tracked request | Current disposition and evidence | Concrete future acceptance check |
| --- | --- | --- |
| Planar mates were offered and stored but not simulated. [README 112][original-sketch], [HANDOVER 70/96][original-handover] | **binding-limitation.** No planar solver is implemented with the installed binding. The misleading successful-looking path is addressed: creation is unavailable, legacy records are inspectable/deletable, and a world containing one is rejected. See [capability audit](simulator-capability-audit.md) and [Planar inspector](../artifacts/kineticad/src/components/inspectors/PlanarMateInspector.tsx). | Prove a supported constraint representation before restoring creation. Measure all three permitted and three constrained relative degrees of freedom under forces/torques, with rotated starting frames, fixed-step partition checks and Save/Load. Reject unsupported frames explicitly. |
| General joint frames, travel stops and rated motor force. Original phase-7/9 capability wording in [replit.md][original-replit]; later [load stage](IMPLEMENTATION-TODO.md) | **resolved-with-limits.** Four ordinary joint types work within declared frame restrictions. Revolute/prismatic motors are ideal velocity drives; ordinary sliders have no travel stop or force rating, and revolutes have no angular stop. Unsupported independent local frames reject rather than reorient parts. Legacy torque/force fields are labelled not applied. See [capability audit](simulator-capability-audit.md). | Treat arbitrary frames, stops and finite-force drives as separate stages. Use known rotated axes/anchors; for limits, verify both ends and impacts; for drive ratings, measure applied force/torque, acceleration, stall and reaction momentum under declared loads. The original windmill tolerance must remain unchanged. |
| Material selection did not change simulation mass; warm/cold Play latency. [replit.md 227–269][original-density] | **resolved-with-limits.** Both warm and cold paths now use the selected material, exact CAD COM and full inertia tensor. Geometry cache data is rescaled by density; invalid mass/inertia stops the world. [Mass regressions](../artifacts/kineticad/tests/mass-properties.test.mjs), [equal-force experiment](MATERIAL-FORCE-VERIFICATION.md) and [Boolean physical results](boolean-physics-results.json) provide independent checks. No general large-assembly latency guarantee follows. | Preserve same-shape/eight-density force checks, transformed asymmetric inertia cases, and warm/cold material edits. Benchmark Play preparation latency separately with documented hardware and assembly sizes if performance work is authorised. |
| Assembly load, contact/friction and deformation. Later [implementation stages 4–6](IMPLEMENTATION-TODO.md) and [next-stage queue](NEXT-IMPLEMENTATION-TODO.md) | **resolved-with-limits.** Separate finite-force actuator and exact-cuboid contact benches, plus an analytical rectangular cantilever calculator, are implemented. Ordinary CAD contact, bearing friction, finite-force Stewart/assembly drives and general solid deformation remain open. See [capability audit](simulator-capability-audit.md), [contact bench](CONTACT-BENCH.md) and [beam scope](ELASTIC-BEAM.md). | Select one supported assembly/contact or structural model at a time, with explicit geometry, units, constitutive/load parameters and reference solutions. Verify forces/energy and rendered contact or deformation in that actual model. Existing ideal-joint demos and standalone benches do not certify a machine's payload or strength. |

## Platform, verification and publication

| Original issue or source | Current disposition and evidence | Concrete future acceptance check |
| --- | --- | --- |
| Cross-browser coverage beyond the original Chrome/Safari observations. [README 119][original-coverage] | **not-freshly-verified.** September interaction reports describe Chrome. Historical Safari observations are not a fresh pass for the new recovery, dimension or Boolean workflows. | Record current browser/OS/GPU versions and run startup, native file exchange/recovery, sketch picking, simulation and worker error handling in each supported browser. State unsupported combinations; do not infer support from a successful TypeScript build. |
| Performance beyond a few parts. [README 120][original-coverage] | **not-freshly-verified.** Larger demo mechanisms and numerical studies exist, but no current systematic assembly-size, frame-time, memory or cold/warm latency envelope is published. [Demo results](demo-physics-results.json) and [Stewart workspace evidence](STEWART-WORKSPACE-AUDIT.md) validate their stated cases, not a scale limit. | Choose representative native/imported/Boolean fixtures at increasing sizes. Measure load/regeneration/Play latency, frame times, memory and long-running rebuild stability on named hardware, while retaining geometry and physics acceptance. |
| WebGL2 fallback. [README 121/134][original-coverage], [HANDOVER 93][original-roadmap-handover] | **still-open, deferred.** CAD still requires desktop WebGPU. No WebGL2 renderer fallback exists. See [current status](CURRENT-STATUS.md). This old roadmap entry does not authorise changing the current renderer/support policy. | First obtain a support-scope decision. If a fallback is selected later, verify topology overlays, materials, picking and full model/physics lifecycle in both renderers, plus a clear failure path when neither is available. |
| Mobile responsive CAD. [README 121/135][original-coverage], [HANDOVER 94][original-roadmap-handover] | **resolved-with-limits; scope changed.** The later explicit product decision is desktop-only CAD. Phone/tablet startup is blocked; the public information pages remain readable. See [device-access checks](CREATOR-PROFILE-AND-DESKTOP-ACCESS.md) and [tracked user request](NEXT-IMPLEMENTATION-TODO.md). Mobile CAD is not a promised unfinished feature. | Preserve direct-route startup blocking and readable public pages. Repeat on physical devices before publication. Reopening mobile CAD support would require a new product decision and an interaction design suitable for touch. |
| Automated tests and GitHub Actions CI/CD. [HANDOVER 97][original-roadmap-handover] | **resolved-with-limits** for tests; **still-open** for repository CI. The current Node test suite and actual-kernel studies are catalogued in [TEST-CATALOG](TEST-CATALOG.md); manual Chrome acceptance is separately recorded. This is not an installed Playwright/Vitest end-to-end pipeline, and no tracked `.github/workflows` exists in the reviewed checkout. | Establish a reproducible CI job for supported Node/pnpm/build/test versions, retain logs and serialize memory-heavy OCCT runs. Any browser automation job must exercise real UI/file paths and report skips or unavailable GPU support honestly. Do not configure publication without a separate release decision. |
| Local success versus the published Replit route. Historical deployed checks and [WASM/route notes][original-runtime] | **not-freshly-verified.** Current implementation evidence is local; latest Replit republish/public-route acceptance remains pending. Original deployed results retain their May provenance. See [current status](CURRENT-STATUS.md) and [Replit handoff](REPLIT-HANDOFF.md). | After an authorised republish of the correct source, open the actual public route in a fresh session. Verify `/` and `/app/` routing, CAD WASM startup, demo assets, project recovery/file paths and the unchanged 30 RPM windmill gate. Confirm creator/Replit identity and desktop gating on the deployed site. [StoryPage](../artifacts/landing/src/pages/StoryPage.tsx) still narrates the original five mate types; final release-copy acceptance must distinguish that historical story from the four currently supported joints. |

## Historical regressions that should not be reclassified as open bugs

| Historical note | Current disposition / evidence | Regression to retain |
| --- | --- | --- |
| Unsuffixed `Closed()` broke extrusion; enum coercion broke edge/face classes; builder-owned shape lifetimes broke geometry. [replit.md 64–74][original-runtime] | **resolved-with-limits.** The corrected binding calls, classification and ownership paths remain in current CAD code. Actual [operation tests](../artifacts/kineticad/tests/cad-operations.test.mjs), [STEP recovery tests](../artifacts/kineticad/tests/project-cad-roundtrip.test.mjs) and [picking tests](../artifacts/kineticad/tests/boolean-result-picking.test.mjs) cover relevant current behaviour. These old root causes are not newly observed failures. | Retain actual installed-OCCT solid validity/volume tests and real picking checks, especially after changing the binding or wrapper disposal. A mocked builder alone cannot establish B-rep validity. |
| Empty-body deployed WASM response; `/app/app/simulator`; malformed `/appseeds/…` URLs. [replit.md 76–80][original-runtime], [277–320][original-routing] | **resolved-with-limits.** The pinned CDN WASM URL and explicit seed URL joining remain in [cadWorker.ts](../artifacts/kineticad/src/cad/cadWorker.ts) and [index.html](../artifacts/kineticad/index.html). Current Chrome reports exercise modeller/simulator navigation. The latest public deployment still needs its own check. | On an authorised Replit publish, verify non-empty WASM bytes and correct MIME/content, internal route navigation/reload, and actual JavaScript/JSON demo responses rather than an HTML fallback. Use the gallery for normal demo isolation; the legacy console seed loader is not equivalent to the durable recovery workflow. |

## Suggested deferred order after the current stage

1. **Close the original partial-arc acceptance gap:** exercise the real edge-to-mate
   pivot workflow. This is verification first; do not assume a defect before
   measuring one. The separate Boolean native Load gate has now passed.
2. **Choose one modelling feature:** undo/redo, multi-loop sketches or face
   sketches. Each needs its own document/reference model and user test stop.
3. **Choose one engineering or interchange extension:** supported planar/local
   frames, rated assembly drives/contact, or STEP hierarchy/names/IGES. Binding
   investigations should precede promised UI capability.
4. **Establish supported-platform and scale evidence:** fresh browser matrix,
   performance measurements and a reproducible CI job. Preserve desktop-only CAD
   unless the user explicitly changes that policy.
5. **Release separately:** user review, optional support-link destination, owner
   decision on repository visibility, authorised Replit republish and actual
   public-route acceptance. None is implied by this documentation pass.

The local four-bar path designer is now the **implemented, locally verified** stage in
the [tracked queue](NEXT-IMPLEMENTATION-TODO.md). Broader assembly physics and
general deformation remain later work. The historical issue audit itself made
no application fixes, and no public deployment was started by it.

[original-readme]: https://github.com/AndrewBlumson/KinetiCAD/blob/d01f8149bbf52fc1091aba82496d968466800643/README.md#L90-L138
[original-step]: https://github.com/AndrewBlumson/KinetiCAD/blob/d01f8149bbf52fc1091aba82496d968466800643/README.md#L88-L104
[original-sketch]: https://github.com/AndrewBlumson/KinetiCAD/blob/d01f8149bbf52fc1091aba82496d968466800643/README.md#L106-L136
[original-coverage]: https://github.com/AndrewBlumson/KinetiCAD/blob/d01f8149bbf52fc1091aba82496d968466800643/README.md#L115-L135
[original-roadmap]: https://github.com/AndrewBlumson/KinetiCAD/blob/d01f8149bbf52fc1091aba82496d968466800643/README.md#L123-L138
[original-handover]: https://github.com/AndrewBlumson/KinetiCAD/blob/d01f8149bbf52fc1091aba82496d968466800643/HANDOVER.md#L60-L97
[original-roadmap-handover]: https://github.com/AndrewBlumson/KinetiCAD/blob/d01f8149bbf52fc1091aba82496d968466800643/HANDOVER.md#L88-L97
[original-replit]: https://github.com/AndrewBlumson/KinetiCAD/blob/d01f8149bbf52fc1091aba82496d968466800643/replit.md#L37-L56
[original-runtime]: https://github.com/AndrewBlumson/KinetiCAD/blob/d01f8149bbf52fc1091aba82496d968466800643/replit.md#L60-L80
[original-density]: https://github.com/AndrewBlumson/KinetiCAD/blob/d01f8149bbf52fc1091aba82496d968466800643/replit.md#L227-L269
[original-routing]: https://github.com/AndrewBlumson/KinetiCAD/blob/d01f8149bbf52fc1091aba82496d968466800643/replit.md#L273-L320
