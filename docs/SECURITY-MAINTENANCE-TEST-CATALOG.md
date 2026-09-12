# Security maintenance: complete test catalog

**402/402 tests passed across 57 files**, with **zero failures, cancellations, skips or TODOs**. Every executed name, source declaration, result and duration is listed below. The [release capture summary](evidence/security-maintenance/release/summary.json) and [per-test JSONL](evidence/security-maintenance/release/tests.jsonl) are the machine-readable authority. The [382-test history/selection catalog](HISTORY-SELECTION-TEST-CATALOG.md) remains an unchanged historical snapshot; its count is not added to this run.

The capture started **2026-09-12T22:04:17.500Z** and completed **2026-09-12T22:05:38.634Z**. Node reported **80.936 seconds**; capture wall time was **81.160 seconds**. Runtime: **Node v24.19.0, pnpm 10.28.2, darwin arm64**, with test files run serially. This establishes a local Node 24 run; it does not establish an actual Replit/Linux host run or deployment acceptance.

KinetiCAD was created by Andrew Blumson and Kevin Blumson with **Replit Agent**. Later maintenance, implementation and these automated checks were carried out with **Codex** under Andrew's direction. Automated tests, computer-use observations and publication are separate forms of evidence.

## What changed and what the count means

The maintenance adds **20 cases**: three generated-health-API contracts, nine production-server cases and eight exact-host/Vite cases. The prior 382 cases remain, including seven drawing-handler checks. That drawing test now resolves its compiler through the declared Vite dependency, avoiding an unrelated parent-directory esbuild installation. No physical acceptance tolerance was relaxed. Three.js **0.184.0**, OpenCascade.js **2.0.0-beta.94e2944** and Rapier **0.12.0** remain pinned.

A row is one executed Node test case. Assertions, parameter-loop scenarios, fixed solver steps, CAD bodies and intersection pairs inside a test are not additional test cases. The 402 results combine pure mathematics, actual OCCT/Rapier execution, controlled integration, actual Three.js with input adapters, generated-client contracts and HTTP middleware tests. They are neither 402 physical experiments nor a blanket security/physics certification.

The [maintenance guide](SECURITY-MAINTENANCE-2026-09-12.md) records the package changes, vulnerability assessment and separate build/browser status. The suite does not perform a vulnerability scan, prove advisory non-exploitability or click the new optional support link. Source fingerprints include that UI change and the final Terms/Privacy update naming Adevious Ltd as the optional-support recipient; fingerprinting is not an interaction test or a legal-compliance assessment. The shared legal renderer now accepts inline React nodes for provider links. The final freeze also includes one Story-page paragraph identifying the separate motor/load, contact/friction and beam experiments with their stated limits. No CAD, mathematical or physical behavior changed in these four landing-file updates.

## Retained earlier attempts

The first [Node 24 capture](evidence/security-maintenance/node24-suite/summary.json) recorded **395 passes and one file-load failure**. Its raw [events](evidence/security-maintenance/node24-suite/suite-events.jsonl) show that bare esbuild resolution escaped to a parent checkout's x64 binary while the process ran on ARM64. The seven drawing cases could not register and became one file-failure event: **402 − 7 + 1 = 396** reported tests. The one-line compiler-resolution correction preserves their assertions and declaration lines. That failed capture remains unchanged.

The [interrupted capture](evidence/security-maintenance/interrupted-before-support/summary.json) stopped when the support-link source changed; its **179 result events are an incomplete stream**, not a passing suite total. Historical report restoration succeeded. A subsequent [402-test passing capture](evidence/security-maintenance/passed-before-backup-cleanup/summary.json) preceded removal of five unused generated-source backup files. The preserved [pre-legal-update capture](evidence/security-maintenance/final/summary.json) then passed all 402 cases after that cleanup. The next [capture](evidence/security-maintenance/source-changed-before-story-freeze/summary.json) passed all 402 cases in 79.303 seconds but was correctly rejected as a frozen-source acceptance: StoryPage changed during the run, its only changed input. It was not interrupted, and historical report restoration succeeded. The release capture linked at the top ran after the final LegalPage, PrivacyPage, TermsPage and StoryPage updates; comparison against the pre-legal-update fingerprint set found exactly those four changed inputs. All complete runs remain available separately. Moved attempt directories retain their original absolute output path in raw provenance; their bytes were preserved. None of these attempt totals is added to the release 402.

## Reproduce with the frozen dependencies

Use the intended **Node 24** executable first on `PATH`, so pnpm scripts and child tools use the same runtime. Verify `node --version` and `pnpm --version`; the capture records the actual executable, architecture and versions. With the lockfile already installed, run from the repository root into a **new or empty** directory:

```sh
node scripts/src/capture-test-suite.mjs --output-dir ./test-captures/security-maintenance-new-run
```

The [portable runner](../scripts/src/capture-test-suite.mjs) discovers all current top-level `artifacts/kineticad/tests/*.test.mjs`, uses the installed TSX loader and runs with `--test-concurrency=1`. New files may change future counts. To inspect the source fingerprint set without running tests, taking a lock or writing evidence:

```sh
node scripts/src/capture-test-suite.mjs --list-inputs
```

A focused maintenance check can use the same runner with explicit files; it is a subset, not the complete suite:

```sh
node scripts/src/capture-test-suite.mjs --output-dir ./test-captures/security-maintenance-focused-new-run \
  --test tests/api-generation.test.mjs \
  --test tests/production-server.test.mjs \
  --test tests/vite-allowed-hosts.test.mjs \
  --test tests/path-drawing.test.mjs
```

Keep source changes, code generation, installs and OCCT suites serialized. The runner backs up the two known overwritten historical JSON reports before starting tests, saves fresh outputs separately and restores the originals after success/failure or handled SIGINT/SIGTERM. Do not replace that command with an unprotected rerun if retaining those dates matters. SIGKILL/power loss cannot run cleanup; recover from `original-reports/` and `run-start.json`. Other generated artifacts are not promised a general rollback, and the lock only coordinates this capture tool.

## Source and result identity

Recorded HEAD: `731c7d3f440b123e87036d10c1db1e2f17e006ea`. The measured working tree included uncommitted maintenance; **HEAD alone does not identify the tested implementation**. The [start record](evidence/security-maintenance/release/run-start.json) and [summary](evidence/security-maintenance/release/summary.json) retain the exact command, status, file lists, source hashes and capture/reporter identities. All **527 listed regular-file inputs** were unchanged across the release run: `sourceInputsUnchanged: true`, empty `sourceInputChanges`.

The expanded input scope covers `artifacts/`, `lib/`, `scripts/`, optional `attached_assets/` and root manifests, lockfile, TypeScript, pnpm and Replit configuration. It includes production servers, Vite host configuration, public demo assets, the API specification/generator configuration and regenerated clients. It excludes installed dependency trees, `dist`, caches, TypeScript build-info files, docs/evidence and environment-file values. The lockfile identifies dependency resolution; this is not a byte hash of every installed transitive dependency or a capture of the hosting environment. Some solver helpers may reuse temporary CAD descriptors after their source/geometry hashes match; a cache hit is not another fresh OCCT rebuild.

The [complete raw event stream](evidence/security-maintenance/release/suite-events.jsonl) has SHA-256 `98d69b250df3a112e5795c4c84015495bac5edb4cda4da58dab0a9394e7dd1ee`. [Per-test JSONL](evidence/security-maintenance/release/tests.jsonl) retains full-precision durations; tables round milliseconds to three decimals. These times are neither browser performance nor an unbiased comparison with the earlier x64 run. [Process stderr](evidence/security-maintenance/release/stderr.log) is separate from test stderr captured inside the event stream.

| Preserved historical report | Fresh output retained for this run | Result |
| --- | --- | --- |
| [Assembly export](assembly-export-results.json) | [Fresh export payload](evidence/security-maintenance/release/generated-reports/docs/assembly-export-results.json) | Original bytes restored exactly. |
| [Boolean physics](boolean-physics-results.json) | [Fresh Boolean payload](evidence/security-maintenance/release/generated-reports/docs/boolean-physics-results.json) | Original bytes restored exactly. |

`restorationVerified: true`. The output folder also holds original backups and both hashes. Other dated standalone physics/demo/clearance reports keep their original source snapshots; this regression run does not silently remeasure all of them.

## Independent mathematics and physical scope

The file-specific method below identifies whether an actual kernel/solver runs. Use the [equation, units, assumptions and tolerance reference](MATHEMATICS-AND-PHYSICS.md), [physics verification](PHYSICS-VERIFICATION.md) and [capability audit](simulator-capability-audit.md) for measured limits. Selected families include:

| Family | Independent reference and boundary |
| --- | --- |
| Solid volume, centre of mass, full inertia and transforms | Analytic solids, parallel-axis/full-tensor arithmetic and independent frame transforms; [final Boolean bodies](BOOLEAN-SIMULATION-VERIFICATION.md) and [assembly export](ASSEMBLY-EXPORT.md). Mass uses kg, geometry mm and rotational inertia kg·mm². |
| Gravity, forces, joints, motors and fixed steps | Newtonian freefall/equal-force references, relative joint frames and timestep/partition invariance; [material-force experiment](MATERIAL-FORCE-VERIFICATION.md). The original Windmill angular-speed gate stays **5 × 10⁻⁷ rad/s**. |
| Crank-slider and four-bar linkages | Independent loop closure and derivatives, coupler-point traces, branches and bounded search/error metrics; [crank-slider](CRANK-SLIDER-VERIFICATION.md) and [four-bar](FOUR-BAR-PATH-VERIFICATION.md). Crank acceleration acceptance is the documented interval mean, not a universal single-step derivative guarantee. |
| Stewart geometry/workspace | Independent inverse kinematics, closed-loop heave and conservative subdivision; [workspace audit](STEWART-WORKSPACE-AUDIT.md). Floating-point conservative bounds and finite exact-CAD samples do not become formal interval arithmetic or a new all-pose contact simulation. |
| Motor/load, contact and beam studies | Newtonian force/reaction/energy, guided Coulomb contact and Euler–Bernoulli beam equations; [contact](CONTACT-BENCH.md), [beam](ELASTIC-BEAM.md) and the mathematical reference. These are explicitly scoped benches/calculators, not new ordinary-CAD friction or flexible-body behavior. |
| Editable sketch dimensions | Independent circle, line, rectangle and arc equations plus selected exact-CAD volume/bounds and save/rebuild references; [dimension verification](SKETCH-DIMENSIONS-VERIFICATION.md). This is primitive editing, not a general constraint solver. |

The new HTTP/host tests are engineering tests of request policy. Their use of actual Node/Vite implementations does not make them physical measurements. The generated client checks use controlled network responses and do not establish browser query-hook rendering, server deployment or runtime TypeScript inference.

## Complete file inventory

| Source file | Cases | Checking method |
| --- | ---: | --- |
| [actuator-bench.test.mjs](../artifacts/kineticad/tests/actuator-bench.test.mjs) | 7 | Real Rapier axial-force bench. |
| [api-generation.test.mjs](../artifacts/kineticad/tests/api-generation.test.mjs) | 3 | Actual regenerated API client/query-option functions and custom fetch code, with controlled Fetch responses; actual generated Zod response parsing. |
| [assembly-export.test.mjs](../artifacts/kineticad/tests/assembly-export.test.mjs) | 7 | Actual shipped CAD worker and installed OCCT. |
| [assembly-simulation.test.mjs](../artifacts/kineticad/tests/assembly-simulation.test.mjs) | 10 | Pure assembly planning and identity policy. |
| [beam-analysis.test.mjs](../artifacts/kineticad/tests/beam-analysis.test.mjs) | 7 | Pure Euler–Bernoulli cantilever equations and eligibility/validity guards. |
| [bench-elapsed-clock.test.mjs](../artifacts/kineticad/tests/bench-elapsed-clock.test.mjs) | 3 | Pure elapsed-time bookkeeping for the engineering UI. |
| [boolean-bodies.test.mjs](../artifacts/kineticad/tests/boolean-bodies.test.mjs) | 10 | Real regeneration/cache orchestration with controlled CAD responses. |
| [boolean-mate-store.test.mjs](../artifacts/kineticad/tests/boolean-mate-store.test.mjs) | 9 | Actual Zustand document actions, project parsing and geometry hashes with controlled topology references. |
| [boolean-physics.test.mjs](../artifacts/kineticad/tests/boolean-physics.test.mjs) | 15 | Actual OCCT and shipped Comlink/Rapier workers. |
| [boolean-result-picking.test.mjs](../artifacts/kineticad/tests/boolean-result-picking.test.mjs) | 9 | Actual Three.js transforms and production topology picker/result layer with controlled CAD/DOM collaborators. |
| [cad-operations.test.mjs](../artifacts/kineticad/tests/cad-operations.test.mjs) | 11 | Actual installed OCCT and production sketch/solid operations. |
| [contact-bench.test.mjs](../artifacts/kineticad/tests/contact-bench.test.mjs) | 9 | Actual Rapier cuboid contact experiment. |
| [crank-slider-cad.test.mjs](../artifacts/kineticad/tests/crank-slider-cad.test.mjs) | 2 | Actual OCCT native feature chains and interference operations, with independent geometry/envelope references. |
| [crank-slider-kinematics.test.mjs](../artifacts/kineticad/tests/crank-slider-kinematics.test.mjs) | 4 | Pure factory/closure and independent analytical kinematics. |
| [crank-slider-physics.test.mjs](../artifacts/kineticad/tests/crank-slider-physics.test.mjs) | 2 | Actual shipped Rapier worker using source-and-geometry-validated exact-CAD descriptors. |
| [crank-slider-readout.test.mjs](../artifacts/kineticad/tests/crank-slider-readout.test.mjs) | 14 | Pure processing of explicit measured-pose/velocity fixtures and the actual measurement store. |
| [crank-slider-workspace.test.mjs](../artifacts/kineticad/tests/crank-slider-workspace.test.mjs) | 7 | Real project/demo parsers and Zustand with memory storage. |
| [demos.test.mjs](../artifacts/kineticad/tests/demos.test.mjs) | 6 | Fixture parsing, demo-session behavior and real Zustand with memory persistence. |
| [desktop-support.test.mjs](../artifacts/kineticad/tests/desktop-support.test.mjs) | 9 | Pure desktop-support policy using supplied device/capability inputs. |
| [document-history.test.mjs](../artifacts/kineticad/tests/document-history.test.mjs) | 6 | Actual history controller and bounded serialized-entry engine, with deferred restore preparation and an explicit host adapter. |
| [engineering-bench-worker.test.mjs](../artifacts/kineticad/tests/engineering-bench-worker.test.mjs) | 3 | Actual Comlink engineering worker and real Rapier bench modules. |
| [feature-regen.test.mjs](../artifacts/kineticad/tests/feature-regen.test.mjs) | 13 | Production feature/part regeneration and caches with controlled CAD responses. |
| [force-measurements.test.mjs](../artifacts/kineticad/tests/force-measurements.test.mjs) | 3 | Pure force-readout reduction and actual measurement state using explicit velocity/time fixtures. |
| [force-physics.test.mjs](../artifacts/kineticad/tests/force-physics.test.mjs) | 6 | Actual shipped Comlink/Rapier worker with analytic body descriptors. |
| [four-bar-assembly.test.mjs](../artifacts/kineticad/tests/four-bar-assembly.test.mjs) | 4 | Pure native factory, anchor/envelope arithmetic and real Three.js frame transforms. |
| [four-bar-cad.test.mjs](../artifacts/kineticad/tests/four-bar-cad.test.mjs) | 1 | Actual OCCT rebuilds of selected four-bar feature chains, marker-material probes and sampled exact intersections. |
| [four-bar-kinematics.test.mjs](../artifacts/kineticad/tests/four-bar-kinematics.test.mjs) | 5 | Pure circle-intersection closure, branch, bounds, whole-cycle and independent derivative references. |
| [four-bar-physics.test.mjs](../artifacts/kineticad/tests/four-bar-physics.test.mjs) | 1 | Actual shipped Rapier worker, source/geometry-validated exact-CAD descriptors and an independent closure reference. |
| [four-bar-preflight.test.mjs](../artifacts/kineticad/tests/four-bar-preflight.test.mjs) | 4 | Production build preflight with controlled CAD/mass promises. |
| [four-bar-readout.test.mjs](../artifacts/kineticad/tests/four-bar-readout.test.mjs) | 5 | Pure calculation from explicit body poses and independent linkage references. |
| [four-bar-search-worker.test.mjs](../artifacts/kineticad/tests/four-bar-search-worker.test.mjs) | 2 | Actual production search worker through a Node message endpoint. |
| [four-bar-synthesis.test.mjs](../artifacts/kineticad/tests/four-bar-synthesis.test.mjs) | 6 | Pure bounded deterministic optimisation and target validation. |
| [four-bar-worker-cad.test.mjs](../artifacts/kineticad/tests/four-bar-worker-cad.test.mjs) | 1 | Actual shipped CAD worker and native preflight. |
| [four-bar-workspace.test.mjs](../artifacts/kineticad/tests/four-bar-workspace.test.mjs) | 9 | Real native/project/demo parsing and canonical-identity checks with memory persistence. |
| [history-store.test.mjs](../artifacts/kineticad/tests/history-store.test.mjs) | 12 | Actual singleton Zustand actions, production history and project packaging. |
| [hole-picker.test.mjs](../artifacts/kineticad/tests/hole-picker.test.mjs) | 5 | Actual Three.js topology interaction and hole-selection state with controlled DOM/topology fixtures. |
| [mass-properties.test.mjs](../artifacts/kineticad/tests/mass-properties.test.mjs) | 8 | Actual installed OCCT mass integration and Rapier inertia assignment, with independent analytic tensor/density/frame references and invalid-data rejection. |
| [object-selection.test.mjs](../artifacts/kineticad/tests/object-selection.test.mjs) | 13 | Actual Three.js meshes, raycaster and TransformControls with controlled DOM/pointer/rAF adapters; selected cases use the actual Zustand store/history. |
| [overlay-frames.test.mjs](../artifacts/kineticad/tests/overlay-frames.test.mjs) | 8 | Actual Three.js overlay/glyph transforms with controlled mesh/topology and saved fixtures. |
| [part-transform-occt.test.mjs](../artifacts/kineticad/tests/part-transform-occt.test.mjs) | 2 | Actual OCCT transformed solids, mass and intersections against independently computed Three.js/analytic frames. |
| [part-transform.test.mjs](../artifacts/kineticad/tests/part-transform.test.mjs) | 3 | Pure transform matrix/math and actual Three.js comparison; the OCCT call boundary is controlled. |
| [path-drawing.test.mjs](../artifacts/kineticad/tests/path-drawing.test.mjs) | 7 | Actual compiled PathDrawing event handlers with controlled hook state and SVG affine matrices. |
| [path-trace-label.test.mjs](../artifacts/kineticad/tests/path-trace-label.test.mjs) | 4 | Actual Three.js scene/material-point label logic with controlled DOM and explicit poses. |
| [physics-worker.test.mjs](../artifacts/kineticad/tests/physics-worker.test.mjs) | 17 | Actual shipped Comlink/Rapier worker with independent analytic descriptors/references. |
| [production-server.test.mjs](../artifacts/kineticad/tests/production-server.test.mjs) | 9 | Actual production request handler, temporary filesystem and Node HTTP response serialization over an in-memory Duplex. |
| [project-cad-roundtrip.test.mjs](../artifacts/kineticad/tests/project-cad-roundtrip.test.mjs) | 2 | Actual shipped CAD worker/OCCT restart and durable project packaging. |
| [project-persistence.test.mjs](../artifacts/kineticad/tests/project-persistence.test.mjs) | 13 | Real project parser, packaging, recovery orchestration and Zustand, with a memory repository and controlled asset restore. |
| [simulation-runner.test.mjs](../artifacts/kineticad/tests/simulation-runner.test.mjs) | 19 | Actual production runner and planning/hash logic with controlled worker, renderer, clock and frame adapters. |
| [sketch-arcs.test.mjs](../artifacts/kineticad/tests/sketch-arcs.test.mjs) | 7 | Actual installed OCCT sketches, sweeps and mass integration. |
| [sketch-dimensions-cad.test.mjs](../artifacts/kineticad/tests/sketch-dimensions-cad.test.mjs) | 10 | Actual installed OCCT with edited primitives and production project parsing. |
| [sketch-dimensions.test.mjs](../artifacts/kineticad/tests/sketch-dimensions.test.mjs) | 9 | Pure primitive dimension equations, exact no-op preservation and finite/domain validation. |
| [sketch-edit.test.mjs](../artifacts/kineticad/tests/sketch-edit.test.mjs) | 14 | Actual store/coordinator with controlled CAD and topology promises. |
| [stewart-controller.test.mjs](../artifacts/kineticad/tests/stewart-controller.test.mjs) | 6 | Pure inverse kinematics/controller math, independent pose/reference calculations and motion/workspace guards. |
| [stewart-geometry.test.mjs](../artifacts/kineticad/tests/stewart-geometry.test.mjs) | 5 | Pure Stewart factory/configuration and independent closed-loop/heave geometry. |
| [stewart-integration.test.mjs](../artifacts/kineticad/tests/stewart-integration.test.mjs) | 3 | Production source-geometry/configuration gates, parsing and measurement store with explicit fixtures. |
| [stewart-workspace.test.mjs](../artifacts/kineticad/tests/stewart-workspace.test.mjs) | 5 | Conservative floating-point workspace/path subdivision and independent geometric arithmetic. |
| [vite-allowed-hosts.test.mjs](../artifacts/kineticad/tests/vite-allowed-hosts.test.mjs) | 8 | Pure exact-host parser plus actual loading of all three Vite configurations and installed Vite development middleware over Node HTTP/Duplex. |

## Every executed test

### actuator-bench.test.mjs

7 passing tests. Real Rapier axial-force bench. Independent Newtonian, momentum, energy and integration references; this does not cap the motors in ordinary CAD assemblies.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [capped axial force produces F/m acceleration with correct SI/mm conversion](../artifacts/kineticad/tests/actuator-bench.test.mjs#L13) | passed | 30.449 |
| [a rated motor holds gravity and an overloaded motor saturates and falls at Fmax/m − g](../artifacts/kineticad/tests/actuator-bench.test.mjs#L23) | passed | 8.281 |
| [free-base reaction conserves momentum and mass-weighted centre of mass](../artifacts/kineticad/tests/actuator-bench.test.mjs#L35) | passed | 7.920 |
| [lift reaches its target without ever exceeding the actuator force rating](../artifacts/kineticad/tests/actuator-bench.test.mjs#L40) | passed | 8.097 |
| [fixed-step partitioning is invariant and halving dt reduces overload position error](../artifacts/kineticad/tests/actuator-bench.test.mjs#L46) | passed | 4.629 |
| [travel cutoff stops before geometry crosses the base and is distinguished from modeled impact](../artifacts/kineticad/tests/actuator-bench.test.mjs#L53) | passed | 0.551 |
| [invalid configuration and step requests reject explicitly](../artifacts/kineticad/tests/actuator-bench.test.mjs#L57) | passed | 0.200 |

### api-generation.test.mjs

3 passing tests. Actual regenerated API client/query-option functions and custom fetch code, with controlled Fetch responses; actual generated Zod response parsing. Checks URL/method/headers/cancellation/payload and required string status. Does not operate React hooks, a listening API server, or prove TypeScript inference by runtime assertions.

| Test / exact source declaration | Status | Duration (ms) | Purpose |
| --- | --- | ---: | --- |
| [regenerated health client preserves the API path, GET request and JSON response](../artifacts/kineticad/tests/api-generation.test.mjs#L8) | passed | 8.643 | Preserve the generated endpoint and plain JSON response while forwarding caller headers and AbortSignal. |
| [regenerated query accepts partial options and forwards query cancellation to the request](../artifacts/kineticad/tests/api-generation.test.mjs#L22) | passed | 0.230 | Preserve partial query options and query-function cancellation without manually supplying an internal query key. |
| [regenerated health response schema retains the required string status contract](../artifacts/kineticad/tests/api-generation.test.mjs#L35) | passed | 0.527 | Preserve the schema contract: status is required and must be a string. |

### assembly-export.test.mjs

7 passing tests. Actual shipped CAD worker and installed OCCT. Final Boolean/native STEP and STL geometry is checked against selected analytic solids; browser file-picker behavior is separate.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [union STEP and STL export final transformed Boolean plus visible independent part, omitting hidden sources](../artifacts/kineticad/tests/assembly-export.test.mjs#L84) | passed | 2138.686 |
| [subtract STEP and STL export final transformed Boolean plus visible independent part, omitting hidden sources](../artifacts/kineticad/tests/assembly-export.test.mjs#L84) | passed | 142.678 |
| [intersect STEP and STL export final transformed Boolean plus visible independent part, omitting hidden sources](../artifacts/kineticad/tests/assembly-export.test.mjs#L84) | passed | 136.469 |
| [Hide inputs off exports visible originals as well as result, preserving deliberate overlapping solids](../artifacts/kineticad/tests/assembly-export.test.mjs#L90) | passed | 215.242 |
| [disconnected Boolean compound exports every solid without restoring hidden originals](../artifacts/kineticad/tests/assembly-export.test.mjs#L96) | passed | 110.365 |
| [multiple visible Boolean results share immutable source geometry safely](../artifacts/kineticad/tests/assembly-export.test.mjs#L101) | passed | 249.893 |
| [invalid/empty output aborts; subsequent raw asset export and native feature chain remain intact](../artifacts/kineticad/tests/assembly-export.test.mjs#L108) | passed | 107.560 |

### assembly-simulation.test.mjs

10 passing tests. Pure assembly planning and identity policy. Checks finished-body inputs, material/ground decisions, attachment revisions and physics signatures; no solver execution in this file.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [Boolean source parts never become duplicate physical bodies for either Hide inputs setting](../artifacts/kineticad/tests/assembly-simulation.test.mjs#L14) | passed | 1.023 |
| [material inheritance uses the retained subtract body and requires uniform union/intersection inputs](../artifacts/kineticad/tests/assembly-simulation.test.mjs#L23) | passed | 0.389 |
| [unknown explicit result material fails instead of silently falling back to a default](../artifacts/kineticad/tests/assembly-simulation.test.mjs#L33) | passed | 0.084 |
| [result grounding is explicit; consumed/hidden input ground is not inherited or silently reassigned](../artifacts/kineticad/tests/assembly-simulation.test.mjs#L39) | passed | 0.211 |
| [an input reused by two finished Boolean bodies rejects ambiguous physical duplication](../artifacts/kineticad/tests/assembly-simulation.test.mjs#L47) | passed | 0.099 |
| [source joints are never migrated to new finished-body IDs or silently dropped](../artifacts/kineticad/tests/assembly-simulation.test.mjs#L52) | passed | 0.129 |
| [new result joints require an exact geometry revision and become stale after native or transform edits](../artifacts/kineticad/tests/assembly-simulation.test.mjs#L58) | passed | 0.186 |
| [material/rename changes retain result joint geometry hashes and its stable synthetic identity](../artifacts/kineticad/tests/assembly-simulation.test.mjs#L68) | passed | 0.134 |
| [native/Boolean identity collisions reject rather than replacing a source body](../artifacts/kineticad/tests/assembly-simulation.test.mjs#L77) | passed | 0.161 |
| [physical signatures exclude derived values and speed commands, while protecting geometry and joint structure](../artifacts/kineticad/tests/assembly-simulation.test.mjs#L82) | passed | 0.408 |

### beam-analysis.test.mjs

7 passing tests. Pure Euler–Bernoulli cantilever equations and eligibility/validity guards. An analytical calculator, not CAD deformation or general finite-element analysis.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [independent hand-calculated steel-like reference uses N/mm/GPa consistently](../artifacts/kineticad/tests/beam-analysis.test.mjs#L6) | passed | 0.441 |
| [curve satisfies clamped/free-end solution and intermediate hand reference](../artifacts/kineticad/tests/beam-analysis.test.mjs#L13) | passed | 0.066 |
| [load reversal reverses displacement/reactions and retains stress magnitude](../artifacts/kineticad/tests/beam-analysis.test.mjs#L19) | passed | 0.104 |
| [depth cubed, width, length cubed and modulus govern bending stiffness](../artifacts/kineticad/tests/beam-analysis.test.mjs#L25) | passed | 0.073 |
| [elastic, slenderness and small-deflection failures are explicit](../artifacts/kineticad/tests/beam-analysis.test.mjs#L32) | passed | 0.096 |
| [missing/nonfinite/nonpositive material or geometry and overflow reject](../artifacts/kineticad/tests/beam-analysis.test.mjs#L37) | passed | 0.139 |
| [eligible native dimensions respect sketch planes and exclude modified/imported/boolean shapes](../artifacts/kineticad/tests/beam-analysis.test.mjs#L42) | passed | 0.360 |

### bench-elapsed-clock.test.mjs

3 passing tests. Pure elapsed-time bookkeeping for the engineering UI. Controlled timestamps establish pause/reset and packet limits, not force or contact accuracy.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [a paused background tab earns no simulation time when resumed before its next animation frame](../artifacts/kineticad/tests/bench-elapsed-clock.test.mjs#L5) | passed | 0.315 |
| [delayed first play and ordinary paused frames cannot consume a short test window](../artifacts/kineticad/tests/bench-elapsed-clock.test.mjs#L17) | passed | 0.061 |
| [running cadence partitions retain elapsed time while repeated play calls do not reset the clock](../artifacts/kineticad/tests/bench-elapsed-clock.test.mjs#L31) | passed | 0.168 |

### boolean-bodies.test.mjs

10 passing tests. Real regeneration/cache orchestration with controlled CAD responses. Checks pending-call sharing, exact input identity, material scaling and rejection/retry; separate kernel tests establish solid geometry.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [concurrent physical preparations dispatch one exact ordered, immutable full-chain snapshot](../artifacts/kineticad/tests/boolean-bodies.test.mjs#L25) | passed | 1.359 |
| [material/display-only changes reuse unit-density properties without changing the geometric result](../artifacts/kineticad/tests/boolean-bodies.test.mjs#L42) | passed | 0.235 |
| [settled and pending body caches remain independent across CAD worker instances](../artifacts/kineticad/tests/boolean-bodies.test.mjs#L54) | passed | 0.211 |
| [native edits, imported asset identity, Boolean operation and exact sub-0.0001 transforms invalidate geometry](../artifacts/kineticad/tests/boolean-bodies.test.mjs#L63) | passed | 0.818 |
| [display cache and its valid compound mesh cannot certify a physical single-solid body](../artifacts/kineticad/tests/boolean-bodies.test.mjs#L86) | passed | 0.422 |
| [shared failures retain each caller name and later attempts retry instead of caching an error](../artifacts/kineticad/tests/boolean-bodies.test.mjs#L96) | passed | 0.207 |
| [explicit cache reset separates pending generations and prevents old completions overwriting fresh bodies](../artifacts/kineticad/tests/boolean-bodies.test.mjs#L104) | passed | 0.181 |
| [invalid input configuration fails with a named error before contacting CAD](../artifacts/kineticad/tests/boolean-bodies.test.mjs#L114) | passed | 0.198 |
| [preview regeneration shares pending operations, keeps worker-scoped settled results and retries failures](../artifacts/kineticad/tests/boolean-bodies.test.mjs#L126) | passed | 0.730 |
| [the shared argument builder preserves source arrays and supports canonical object-key order](../artifacts/kineticad/tests/boolean-bodies.test.mjs#L136) | passed | 0.124 |

### boolean-mate-store.test.mjs

9 passing tests. Actual Zustand document actions, project parsing and geometry hashes with controlled topology references. Checks material/ground defaults and stale Boolean attachments without remapping them.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [ground badges match explicit Boolean anchoring while preserving native-only first-part defaults](../artifacts/kineticad/tests/boolean-mate-store.test.mjs#L42) | passed | 0.728 |
| [creating or importing a part preserves an explicitly free Boolean assembly](../artifacts/kineticad/tests/boolean-mate-store.test.mjs#L51) | passed | 0.695 |
| [native creation/import retain default promotion and preserve an already selected ground](../artifacts/kineticad/tests/boolean-mate-store.test.mjs#L62) | passed | 0.468 |
| [legacy v8/v9 migration preserves free Boolean worlds and the native-only ground default](../artifacts/kineticad/tests/boolean-mate-store.test.mjs#L77) | passed | 0.400 |
| [actual Apply persists picked result IDs and geometry revision through Save/parse and Edit](../artifacts/kineticad/tests/boolean-mate-store.test.mjs#L93) | passed | 2.237 |
| [geometry changed between picking and Apply rejects creation without relabelling the old attachment](../artifacts/kineticad/tests/boolean-mate-store.test.mjs#L106) | passed | 0.238 |
| [name-only or motor-only Apply cannot revive a stale saved mate without repicking its geometry](../artifacts/kineticad/tests/boolean-mate-store.test.mjs#L114) | passed | 0.283 |
| [an unchanged attachment permits normal edits while a missing geometry snapshot is rejected](../artifacts/kineticad/tests/boolean-mate-store.test.mjs#L127) | passed | 0.316 |
| [deleting an input cascades through result joints while retaining unrelated native joints](../artifacts/kineticad/tests/boolean-mate-store.test.mjs#L138) | passed | 0.286 |

### boolean-physics.test.mjs

15 passing tests. Actual OCCT and shipped Comlink/Rapier workers. Independent Boolean cuboid volume/COM/tensor references, units, freefall, equal force, grounded and joint behavior; selected connected solids only.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [union-identity: final solid mesh, volume, COM and all tensor components agree with independent geometry](../artifacts/kineticad/tests/boolean-physics.test.mjs#L141) | passed | 2088.601 |
| [subtract-identity: final solid mesh, volume, COM and all tensor components agree with independent geometry](../artifacts/kineticad/tests/boolean-physics.test.mjs#L141) | passed | 44.990 |
| [intersect-identity: final solid mesh, volume, COM and all tensor components agree with independent geometry](../artifacts/kineticad/tests/boolean-physics.test.mjs#L141) | passed | 45.837 |
| [off-centre-cut-identity: final solid mesh, volume, COM and all tensor components agree with independent geometry](../artifacts/kineticad/tests/boolean-physics.test.mjs#L141) | passed | 45.486 |
| [union-mixed-rotation: final solid mesh, volume, COM and all tensor components agree with independent geometry](../artifacts/kineticad/tests/boolean-physics.test.mjs#L141) | passed | 58.376 |
| [subtract-mixed-rotation: final solid mesh, volume, COM and all tensor components agree with independent geometry](../artifacts/kineticad/tests/boolean-physics.test.mjs#L141) | passed | 43.716 |
| [intersect-mixed-rotation: final solid mesh, volume, COM and all tensor components agree with independent geometry](../artifacts/kineticad/tests/boolean-physics.test.mjs#L141) | passed | 43.407 |
| [off-centre-cut-mixed-rotation: final solid mesh, volume, COM and all tensor components agree with independent geometry](../artifacts/kineticad/tests/boolean-physics.test.mjs#L141) | passed | 38.143 |
| [empty and disconnected Boolean bodies reject while ordinary Boolean compounds and later valid calls remain usable](../artifacts/kineticad/tests/boolean-physics.test.mjs#L168) | passed | 85.602 |
| [sub-four-decimal input translation changes final mesh and exact properties instead of reusing rounded geometry](../artifacts/kineticad/tests/boolean-physics.test.mjs#L182) | passed | 97.554 |
| [a transformed imported STEP source and native cutter produce the analytic final body without changing the registered source](../artifacts/kineticad/tests/boolean-physics.test.mjs#L193) | passed | 131.632 |
| [actual Boolean bodies fall with mass-independent gravity using their baked world geometry once](../artifacts/kineticad/tests/boolean-physics.test.mjs#L262) | passed | 10.273 |
| [equal COM forces measure acceleration from each final Boolean mass without adding torque](../artifacts/kineticad/tests/boolean-physics.test.mjs#L283) | passed | 18.323 |
| [grounded Boolean stays fixed, zero-time readback pauses, and rebuilding restores original poses](../artifacts/kineticad/tests/boolean-physics.test.mjs#L314) | passed | 1.757 |
| [passive hinged Boolean follows its anisotropic final inertia and improves with timestep refinement](../artifacts/kineticad/tests/boolean-physics.test.mjs#L345) | passed | 5.044 |

### boolean-result-picking.test.mjs

9 passing tests. Actual Three.js transforms and production topology picker/result layer with controlled CAD/DOM collaborators. Checks result-body identity and attachment eligibility; no browser rendering or new OCCT measurement.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [result body IDs and material inference preserve native frames without remapping inputs](../artifacts/kineticad/tests/boolean-result-picking.test.mjs#L36) | passed | 0.803 |
| [Boolean layer exposes identity mesh/topology/current hash and changes material without geometry regeneration](../artifacts/kineticad/tests/boolean-result-picking.test.mjs#L58) | passed | 4.726 |
| [source edits invalidate result picking immediately and older async geometry cannot replace the current revision](../artifacts/kineticad/tests/boolean-result-picking.test.mjs#L82) | passed | 0.946 |
| [reverting an in-flight result edit restores complete cached topology; late failure and disposed results stay unavailable](../artifacts/kineticad/tests/boolean-result-picking.test.mjs#L100) | passed | 1.117 |
| [disconnected or unverified Boolean meshes remain visible but cannot supply mate topology or attachment hashes](../artifacts/kineticad/tests/boolean-result-picking.test.mjs#L111) | passed | 1.033 |
| [attachment hashes capture only the actual picked revision and preserve the opposite body snapshot](../artifacts/kineticad/tests/boolean-result-picking.test.mjs#L124) | passed | 0.433 |
| [edge proximity and hover follow the full native XYZ transform instead of its old local position](../artifacts/kineticad/tests/boolean-result-picking.test.mjs#L177) | passed | 2.238 |
| [native transformed face hover is world-correct and two-click point picking retains local face UV](../artifacts/kineticad/tests/boolean-result-picking.test.mjs#L190) | passed | 1.130 |
| [world-baked Boolean face picks use stable body IDs once and are excluded outside mate editing](../artifacts/kineticad/tests/boolean-result-picking.test.mjs#L205) | passed | 2.673 |

### cad-operations.test.mjs

11 passing tests. Actual installed OCCT and production sketch/solid operations. Independent geometry references and invalid-input checks cover selected extrude/revolve/fillet/chamfer/hole/Boolean cases.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [XY extrude forward/backward/symmetric preserves exact dimensions, centre and detached mesh](../artifacts/kineticad/tests/cad-operations.test.mjs#L60) | passed | 1851.983 |
| [XZ extrude forward/backward/symmetric preserves exact dimensions, centre and detached mesh](../artifacts/kineticad/tests/cad-operations.test.mjs#L60) | passed | 25.401 |
| [YZ extrude forward/backward/symmetric preserves exact dimensions, centre and detached mesh](../artifacts/kineticad/tests/cad-operations.test.mjs#L60) | passed | 24.674 |
| [quarter-turn revolve keeps analytical annular-sector volume and centroid](../artifacts/kineticad/tests/cad-operations.test.mjs#L85) | passed | 14.478 |
| [single-edge fillet removes square-minus-quarter-circle volume and leaves its input unchanged](../artifacts/kineticad/tests/cad-operations.test.mjs#L97) | passed | 32.739 |
| [single-edge chamfer removes an exact triangular prism and leaves its input unchanged](../artifacts/kineticad/tests/cad-operations.test.mjs#L107) | passed | 17.032 |
| [all six face pick bases drill inward for blind holes and span the correct dimension for through holes](../artifacts/kineticad/tests/cad-operations.test.mjs#L117) | passed | 348.300 |
| [Boolean union matches overlapping-box volume and preserves both input solids](../artifacts/kineticad/tests/cad-operations.test.mjs#L142) | passed | 53.955 |
| [Boolean subtract matches overlapping-box volume and preserves both input solids](../artifacts/kineticad/tests/cad-operations.test.mjs#L142) | passed | 43.967 |
| [Boolean intersect matches overlapping-box volume and preserves both input solids](../artifacts/kineticad/tests/cad-operations.test.mjs#L142) | passed | 43.524 |
| [invalid dimensions, missing picks, non-solid inputs and empty booleans fail without consuming originals](../artifacts/kineticad/tests/cad-operations.test.mjs#L153) | passed | 17.356 |

### contact-bench.test.mjs

9 passing tests. Actual Rapier cuboid contact experiment. Coulomb, momentum, work/energy and timestep comparisons are scoped to this guided bench, not arbitrary CAD contacts.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [step zero reads the actual initial body without advancing, and disposal prevents further use](../artifacts/kineticad/tests/contact-bench.test.mjs#L14) | passed | 24.493 |
| [resting cuboid has measured contact support equal to weight, without horizontal force](../artifacts/kineticad/tests/contact-bench.test.mjs#L27) | passed | 8.137 |
| [frictionless contact preserves horizontal velocity and kinetic energy while supporting weight](../artifacts/kineticad/tests/contact-bench.test.mjs#L39) | passed | 4.923 |
| [Coulomb sliding stops within the fixed-step integration bound and contact impulses match momentum](../artifacts/kineticad/tests/contact-bench.test.mjs#L49) | passed | 4.365 |
| [halving the timestep converges in stopping distance and penetration at 60, 120 and 240 Hz](../artifacts/kineticad/tests/contact-bench.test.mjs#L71) | passed | 25.173 |
| [material mass changes support force but not Coulomb deceleration; increasing friction shortens travel](../artifacts/kineticad/tests/contact-bench.test.mjs#L84) | passed | 3.727 |
| [accumulated frame partitions produce the same body state as a single elapsed-time request](../artifacts/kineticad/tests/contact-bench.test.mjs#L91) | passed | 2.455 |
| [airborne and impact phases disable the continuous-support reference](../artifacts/kineticad/tests/contact-bench.test.mjs#L104) | passed | 1.253 |
| [invalid physical inputs and elapsed time are rejected](../artifacts/kineticad/tests/contact-bench.test.mjs#L115) | passed | 0.284 |

### crank-slider-cad.test.mjs

2 passing tests. Actual OCCT native feature chains and interference operations, with independent geometry/envelope references. Body/pair/sample counts inside these tests are not extra tests.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [all domain vertices and the default produce four exact valid CAD solids with no sampled interference](../artifacts/kineticad/tests/crank-slider-cad.test.mjs#L10) | passed | 16371.638 |
| [continuous rigid-geometry clearances hold across the admitted parameter domain](../artifacts/kineticad/tests/crank-slider-cad.test.mjs#L44) | passed | 0.308 |

### crank-slider-kinematics.test.mjs

4 passing tests. Pure factory/closure and independent analytical kinematics. Checks bounds, anchors and signed motion; reference equations alone do not prove solver behavior.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [native crank-slider factory is deterministic, closed and has exactly one drive](../artifacts/kineticad/tests/crank-slider-kinematics.test.mjs#L5) | passed | 1.011 |
| [reference matches independent circle/link closure and numerical time derivatives throughout the admitted domain](../artifacts/kineticad/tests/crank-slider-kinematics.test.mjs#L22) | passed | 0.952 |
| [zero/reverse RPM and nonconstant angular-speed chain rule have explicit reference semantics](../artifacts/kineticad/tests/crank-slider-kinematics.test.mjs#L36) | passed | 0.102 |
| [invalid dimensions, near-toggle rod ratios and nonfinite controls are rejected](../artifacts/kineticad/tests/crank-slider-kinematics.test.mjs#L50) | passed | 0.168 |

### crank-slider-physics.test.mjs

2 passing tests. Actual shipped Rapier worker using source-and-geometry-validated exact-CAD descriptors. Independent trajectory comparisons and timestep/partition checks; cached descriptors may be reused, so each scenario is not necessarily a fresh OCCT rebuild.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [actual CAD crank-slider follows independent closed-loop kinematics with forward, reverse, zero and extreme settings](../artifacts/kineticad/tests/crank-slider-physics.test.mjs#L25) | passed | 1416.674 |
| [per-world solver settings reject invalid worlds, govern live motors and reset to legacy defaults](../artifacts/kineticad/tests/crank-slider-physics.test.mjs#L119) | passed | 84.019 |

### crank-slider-readout.test.mjs

14 passing tests. Pure processing of explicit measured-pose/velocity fixtures and the actual measurement store. Checks the reported interval and reference semantics; fixtures are not newly measured motion.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [actual positions, velocities, angle and RPM remain independent from the nominal reference](../artifacts/kineticad/tests/crank-slider-readout.test.mjs#L23) | passed | 0.583 |
| [mean acceleration uses independent measured speed samples and their actual interval](../artifacts/kineticad/tests/crank-slider-readout.test.mjs#L37) | passed | 0.122 |
| [reference interval acceleration is the mean velocity change, not point acceleration](../artifacts/kineticad/tests/crank-slider-readout.test.mjs#L48) | passed | 0.073 |
| [missing actual poses or body velocity readbacks never fabricate a sample](../artifacts/kineticad/tests/crank-slider-readout.test.mjs#L58) | passed | 0.151 |
| [nonfinite measurements, invalid clocks and degenerate quaternions are unavailable](../artifacts/kineticad/tests/crank-slider-readout.test.mjs#L73) | passed | 0.078 |
| [duplicate, backward and invalid previous clocks cannot create interval acceleration](../artifacts/kineticad/tests/crank-slider-readout.test.mjs#L89) | passed | 0.072 |
| [quaternion scale and sign do not change measured angle or mutate worker readbacks](../artifacts/kineticad/tests/crank-slider-readout.test.mjs#L105) | passed | 0.088 |
| [zero/reverse nominal RPM affects only the reference, never clamps measured motion](../artifacts/kineticad/tests/crank-slider-readout.test.mjs#L116) | passed | 0.060 |
| [a reset remains detectable even if React observes only the next nonempty run snapshot](../artifacts/kineticad/tests/crank-slider-readout.test.mjs#L128) | passed | 0.201 |
| [pose publication preserves actual readbacks and leaves zero-step or missing-body data unmeasured](../artifacts/kineticad/tests/crank-slider-readout.test.mjs#L145) | passed | 0.218 |
| [interval selection includes the exact 1/30 s boundary and only its declared roundoff tolerance](../artifacts/kineticad/tests/crank-slider-readout.test.mjs#L160) | passed | 0.067 |
| [the final frame selects the latest sufficiently old actual sample, independent of array order](../artifacts/kineticad/tests/crank-slider-readout.test.mjs#L169) | passed | 0.097 |
| [empty or restarted histories and invalid/backward clocks yield no acceleration endpoint](../artifacts/kineticad/tests/crank-slider-readout.test.mjs#L180) | passed | 0.049 |
| [nonfinite sample values are skipped without substituting a theoretical or corrupt endpoint](../artifacts/kineticad/tests/crank-slider-readout.test.mjs#L191) | passed | 0.087 |

### crank-slider-workspace.test.mjs

7 passing tests. Real project/demo parsers and Zustand with memory storage. Checks native metadata, canonical configuration and protected-workspace ownership; storage adapters do not establish a browser reload.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [generated workspace is fresh, stopped and contains only its validated experiment](../artifacts/kineticad/tests/crank-slider-workspace.test.mjs#L17) | passed | 2.043 |
| [demo parser and actual Save/project parser retain adjustable parameters and native history](../artifacts/kineticad/tests/crank-slider-workspace.test.mjs#L37) | passed | 2.591 |
| [physical assembly guard tolerates cosmetic names, computed fields and object-key order](../artifacts/kineticad/tests/crank-slider-workspace.test.mjs#L55) | passed | 0.424 |
| [manual geometry, frame, material, visibility and joint edits disable parameter replacement](../artifacts/kineticad/tests/crank-slider-workspace.test.mjs#L71) | passed | 3.579 |
| [reference guard rejects changed gravity, timing and stale experiment controllers](../artifacts/kineticad/tests/crank-slider-workspace.test.mjs#L95) | passed | 1.140 |
| [invalid adjustable metadata rejects before a document can replace the workspace](../artifacts/kineticad/tests/crank-slider-workspace.test.mjs#L108) | passed | 0.899 |
| [parameter changes and Save remain isolated, then restore original live imported references](../artifacts/kineticad/tests/crank-slider-workspace.test.mjs#L119) | passed | 2.846 |

### demos.test.mjs

6 passing tests. Fixture parsing, demo-session behavior and real Zustand with memory persistence. Covers content/ownership/loader paths, not six new dynamic measurements.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [all bundled examples load and reference existing parts](../artifacts/kineticad/tests/demos.test.mjs#L12) | passed | 3.264 |
| [asset paths work at the Replit /app base and a local root](../artifacts/kineticad/tests/demos.test.mjs#L16) | passed | 0.108 |
| [force experiment survives document parsing and rejects invalid target references](../artifacts/kineticad/tests/demos.test.mjs#L22) | passed | 0.728 |
| [invalid and unsupported documents fail before entering a workspace](../artifacts/kineticad/tests/demos.test.mjs#L29) | passed | 0.504 |
| [editing and playing multiple demos never overwrite the original project](../artifacts/kineticad/tests/demos.test.mjs#L65) | passed | 2.215 |
| [a second visit captures the newly edited original and begins stopped](../artifacts/kineticad/tests/demos.test.mjs#L84) | passed | 0.575 |

### desktop-support.test.mjs

9 passing tests. Pure desktop-support policy using supplied device/capability inputs. Does not establish performance or compatibility on every accepted desktop.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [known phone UAs are blocked independently of their pointer reports](../artifacts/kineticad/tests/desktop-support.test.mjs#L10) | passed | 0.442 |
| [tablet UAs without the word Mobile remain blocked](../artifacts/kineticad/tests/desktop-support.test.mjs#L22) | passed | 0.053 |
| [desktop-mode iPadOS is blocked via Macintosh or MacIntel identity plus touch](../artifacts/kineticad/tests/desktop-support.test.mjs#L34) | passed | 0.079 |
| [attaching a mouse does not allow a known phone or tablet to enter CAD](../artifacts/kineticad/tests/desktop-support.test.mjs#L41) | passed | 0.041 |
| [coarse-only touch devices are blocked even with a desktop-like or unknown UA](../artifacts/kineticad/tests/desktop-support.test.mjs#L47) | passed | 0.042 |
| [touch-capable Windows laptops with a fine pointer remain supported](../artifacts/kineticad/tests/desktop-support.test.mjs#L52) | passed | 0.038 |
| [ordinary macOS, Windows and Linux desktop pointers remain supported](../artifacts/kineticad/tests/desktop-support.test.mjs#L58) | passed | 0.037 |
| [narrow desktop windows and browser zoom are not mobile-device signals](../artifacts/kineticad/tests/desktop-support.test.mjs#L64) | passed | 0.038 |
| [detection is pure and optional platform/touch values do not reject a desktop](../artifacts/kineticad/tests/desktop-support.test.mjs#L70) | passed | 0.300 |

### document-history.test.mjs

6 passing tests. Actual history controller and bounded serialized-entry engine, with deferred restore preparation and an explicit host adapter. Exercises failure/race order without OCCT, a browser or timing sleeps.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [failed preparation preserves source and stack, releases busy state and permits a successful retry](../artifacts/kineticad/tests/document-history.test.mjs#L19) | passed | 1.094 |
| [a document edit during pending preparation cannot be overwritten by an old Undo result](../artifacts/kineticad/tests/document-history.test.mjs#L31) | passed | 0.148 |
| [replacement by an identical-looking loaded project invalidates pending history and gesture tokens](../artifacts/kineticad/tests/document-history.test.mjs#L38) | passed | 0.178 |
| [opening and then closing an editor or navigating invalidates a pending restore even when the model is unchanged](../artifacts/kineticad/tests/document-history.test.mjs#L46) | passed | 0.458 |
| [overlapping Undo calls and a newly started operation cannot publish partial or out-of-order restores](../artifacts/kineticad/tests/document-history.test.mjs#L56) | passed | 0.151 |
| [history entry and byte limits evict whole oldest records, with retained Undo/Redo order intact](../artifacts/kineticad/tests/document-history.test.mjs#L65) | passed | 0.101 |

### engineering-bench-worker.test.mjs

3 passing tests. Actual Comlink engineering worker and real Rapier bench modules. The Node message endpoint replaces the browser worker endpoint; initialization, queueing, switching and teardown are exercised.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [real Comlink worker serializes initial asynchronous build before zero-time and advancing calls](../artifacts/kineticad/tests/engineering-bench-worker.test.mjs#L23) | passed | 83.767 |
| [queued actuator step, contact rebuild and contact step remain FIFO and reset the physical world](../artifacts/kineticad/tests/engineering-bench-worker.test.mjs#L32) | passed | 6.172 |
| [invalid build rejects and clears the previous world without poisoning subsequent queued rebuilds](../artifacts/kineticad/tests/engineering-bench-worker.test.mjs#L44) | passed | 1.352 |

### feature-regen.test.mjs

13 passing tests. Production feature/part regeneration and caches with controlled CAD responses. Verifies dispatch, full-chain identity, lifecycle and density-cache behavior; no replacement response is described as an OCCT solid.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [concurrent scene regenerations dispatch one operation per matching cold feature](../artifacts/kineticad/tests/feature-regen.test.mjs#L34) | passed | 1.055 |
| [pending operations on different kernel instances remain independent](../artifacts/kineticad/tests/feature-regen.test.mjs#L50) | passed | 0.135 |
| [changed feature parameters do not join an older in-flight operation](../artifacts/kineticad/tests/feature-regen.test.mjs#L66) | passed | 0.340 |
| [shared failures reach every caller and a later request retries the worker](../artifacts/kineticad/tests/feature-regen.test.mjs#L80) | passed | 0.322 |
| [clearing the cache separates pending work and rejects late cache repopulation](../artifacts/kineticad/tests/feature-regen.test.mjs#L101) | passed | 0.187 |
| [concurrent chains share each stage and preview uses the same full upstream hash](../artifacts/kineticad/tests/feature-regen.test.mjs#L125) | passed | 2.393 |
| [display regeneration sends one complete chain and caches its exact final-feature hash](../artifacts/kineticad/tests/feature-regen.test.mjs#L145) | passed | 0.512 |
| [display cache invalidates when an upstream feature or source sketch changes](../artifacts/kineticad/tests/feature-regen.test.mjs#L165) | passed | 0.180 |
| [full-chain rejection reaches all display callers and retries without a poisoned cache](../artifacts/kineticad/tests/feature-regen.test.mjs#L179) | passed | 0.131 |
| [unit-density mass data warms the cache and material/pose changes need no CAD rebuild](../artifacts/kineticad/tests/feature-regen.test.mjs#L197) | passed | 0.210 |
| [unmodified STEP uses its live mesh; modified STEP dispatches its intact full history](../artifacts/kineticad/tests/feature-regen.test.mjs#L222) | passed | 0.092 |
| [a late full-chain result cannot repopulate mesh or physical caches after clear](../artifacts/kineticad/tests/feature-regen.test.mjs#L241) | passed | 0.523 |
| [a final-feature preview cannot hide an invalid earlier history from display regeneration](../artifacts/kineticad/tests/feature-regen.test.mjs#L256) | passed | 0.079 |

### force-measurements.test.mjs

3 passing tests. Pure force-readout reduction and actual measurement state using explicit velocity/time fixtures. Independent acceleration comes from delta velocity over actual elapsed time; this is not another force simulation.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [display measures acceleration from solver readback even when it disagrees with F/m](../artifacts/kineticad/tests/force-measurements.test.mjs#L13) | passed | 0.435 |
| [measurement uses consecutive actual simulation timestamps and holds at completion](../artifacts/kineticad/tests/force-measurements.test.mjs#L20) | passed | 0.073 |
| [new runs clear prior readings and missing measurements cannot look successful](../artifacts/kineticad/tests/force-measurements.test.mjs#L29) | passed | 0.175 |

### force-physics.test.mjs

6 passing tests. Actual shipped Comlink/Rapier worker with analytic body descriptors. Equal-force/different-mass, gravity, fixed duration, partitioning and invalid-world cases check units and dynamics.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [equal newton forces yield measured inverse-mass acceleration on unpowered prismatic sliders](../artifacts/kineticad/tests/force-physics.test.mjs#L33) | passed | 106.502 |
| [doubling force and mass preserves measured acceleration and motion](../artifacts/kineticad/tests/force-physics.test.mjs#L75) | passed | 1.921 |
| [world-space COM force adds to gravity without creating torque on an offset, rotated body](../artifacts/kineticad/tests/force-physics.test.mjs#L88) | passed | 1.917 |
| [duration cap and force motion are invariant to elapsed-time partitions, including capped catch-up](../artifacts/kineticad/tests/force-physics.test.mjs#L103) | passed | 26.967 |
| [zero requests pause a forced run and rebuilding removes its cap and persistent forces](../artifacts/kineticad/tests/force-physics.test.mjs#L125) | passed | 1.352 |
| [invalid force vectors, duplicate/fixed/missing targets and invalid caps reject the whole world](../artifacts/kineticad/tests/force-physics.test.mjs#L145) | passed | 2.764 |

### four-bar-assembly.test.mjs

4 passing tests. Pure native factory, anchor/envelope arithmetic and real Three.js frame transforms. Checks construction contracts; actual solids and sampled interference belong to the separate CAD file.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [native four-bar factory creates four connected-history bodies and only one driven revolute](../artifacts/kineticad/tests/four-bar-assembly.test.mjs#L8) | passed | 1.229 |
| [every local joint anchor agrees with independent closure in both branches and arbitrary placement](../artifacts/kineticad/tests/four-bar-assembly.test.mjs#L21) | passed | 0.821 |
| [authored plate/pin envelopes match the continuous rigid-geometry clearance proof](../artifacts/kineticad/tests/four-bar-assembly.test.mjs#L35) | passed | 0.192 |
| [near-zero tracing arms are omitted inside the existing solid; invalid geometry cannot be generated](../artifacts/kineticad/tests/four-bar-assembly.test.mjs#L56) | passed | 0.204 |

### four-bar-cad.test.mjs

1 passing test. Actual OCCT rebuilds of selected four-bar feature chains, marker-material probes and sampled exact intersections. Conservative full-cycle envelope reasoning is separate from finite OCCT sampling.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [seven native four-bar geometries are valid single solids with supported tracing points and zero sampled interference](../artifacts/kineticad/tests/four-bar-cad.test.mjs#L11) | passed | 20771.628 |

### four-bar-kinematics.test.mjs

5 passing tests. Pure circle-intersection closure, branch, bounds, whole-cycle and independent derivative references. Does not prescribe any solver body pose.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [four-bar circle intersection has an independent exact coordinate fixture and both branches](../artifacts/kineticad/tests/four-bar-kinematics.test.mjs#L9) | passed | 0.718 |
| [complete rotations preserve all link lengths, branch sign and continuous clearance bounds](../artifacts/kineticad/tests/four-bar-kinematics.test.mjs#L19) | passed | 9.903 |
| [implicit velocity and acceleration agree with independent finite differences and chain rule](../artifacts/kineticad/tests/four-bar-kinematics.test.mjs#L33) | passed | 0.700 |
| [placement transforms once and a complete cycle returns the same geometry](../artifacts/kineticad/tests/four-bar-kinematics.test.mjs#L47) | passed | 0.337 |
| [Grashof equality, lost closure, small transmission angle, markers and invalid fields reject](../artifacts/kineticad/tests/four-bar-kinematics.test.mjs#L55) | passed | 0.231 |

### four-bar-physics.test.mjs

1 passing test. Actual shipped Rapier worker, source/geometry-validated exact-CAD descriptors and an independent closure reference. Thirty-four scenarios, signed branches/speeds, refinement and packet timing remain measurements within one test, not 34 extra test cases.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [actual CAD four-bar follows independent coupler geometry through complete forward/reverse cycles and both branches](../artifacts/kineticad/tests/four-bar-physics.test.mjs#L18) | passed | 5763.642 |

### four-bar-preflight.test.mjs

4 passing tests. Production build preflight with controlled CAD/mass promises. Checks incomplete geometry, invalid mass and stale source rejection; the worker-CAD test separately executes the real kernel boundary.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [four-bar project retains its drawing and rejects corrupt metadata before loading](../artifacts/kineticad/tests/four-bar-preflight.test.mjs#L13) | passed | 6.768 |
| [four-bar preflight checks every full feature chain without mutating the document](../artifacts/kineticad/tests/four-bar-preflight.test.mjs#L20) | passed | 1.741 |
| [four-bar preflight rejects failed geometry, invalid mesh and missing or invalid mass properties](../artifacts/kineticad/tests/four-bar-preflight.test.mjs#L27) | passed | 4.890 |
| [four-bar stale model detection after a delayed CAD response prevents the next part building](../artifacts/kineticad/tests/four-bar-preflight.test.mjs#L33) | passed | 0.889 |

### four-bar-readout.test.mjs

5 passing tests. Pure calculation from explicit body poses and independent linkage references. Checks actual-material-point coordinates, nominal versus measured-angle comparisons and invalid samples; no new physical run.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [four-bar readout transforms the actual material point under both branches, placement and motor directions](../artifacts/kineticad/tests/four-bar-readout.test.mjs#L8) | passed | 1.562 |
| [perturbed solver coordinates remain visible and cannot be replaced by predicted positions](../artifacts/kineticad/tests/four-bar-readout.test.mjs#L18) | passed | 0.444 |
| [measured-angle reference and nominal motor schedule disclose phase lag separately](../artifacts/kineticad/tests/four-bar-readout.test.mjs#L28) | passed | 0.112 |
| [missing, duplicate, nonfinite or invalid poses yield no invented path sample](../artifacts/kineticad/tests/four-bar-readout.test.mjs#L34) | passed | 0.177 |
| [normalizing valid quaternion scale/sign preserves measured points without mutating snapshots](../artifacts/kineticad/tests/four-bar-readout.test.mjs#L44) | passed | 0.124 |

### four-bar-search-worker.test.mjs

2 passing tests. Actual production search worker through a Node message endpoint. Verifies real progress, completion, termination and invalid input; no CAD or Rapier world is used.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [production search worker delivers provisional progress and a separately recomputable ellipse fit](../artifacts/kineticad/tests/four-bar-search-worker.test.mjs#L16) | passed | 667.447 |
| [terminating a running search cancels it before a result; a fresh worker rejects invalid input clearly](../artifacts/kineticad/tests/four-bar-search-worker.test.mjs#L36) | passed | 112.462 |

### four-bar-synthesis.test.mjs

6 passing tests. Pure bounded deterministic optimisation and target validation. Includes a held-out non-preset path and complete-loop metrics; the search is not a proven global optimum or exact fit for every outline.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [closed target validation rejects crossings, open paths, retracing, tiny/huge and nonfinite data](../artifacts/kineticad/tests/four-bar-synthesis.test.mjs#L6) | passed | 0.770 |
| [arc-length resampling is independent of drawing speed and duplicated collinear vertices](../artifacts/kineticad/tests/four-bar-synthesis.test.mjs#L16) | passed | 0.131 |
| [known mechanism paths have a declared source, while an ellipse remains an approximation](../artifacts/kineticad/tests/four-bar-synthesis.test.mjs#L22) | passed | 94.303 |
| [complete-cycle score allows cyclic start/reversal but cannot match a displaced or partial target for free](../artifacts/kineticad/tests/four-bar-synthesis.test.mjs#L32) | passed | 52.642 |
| [seeded search is deterministic, reports real monotone progress and supports cancellation](../artifacts/kineticad/tests/four-bar-synthesis.test.mjs#L42) | passed | 43.500 |
| [default search fits a nonpreset independently supplied mechanism path without receiving its parameters](../artifacts/kineticad/tests/four-bar-synthesis.test.mjs#L53) | passed | 453.512 |

### four-bar-worker-cad.test.mjs

1 passing test. Actual shipped CAD worker and native preflight. Selected bodies compare to independent exact-volume integrals and separately rebuilt mass/frame references; disconnected geometry must reject.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [shipped CAD worker preflight returns one solid per factory body and exact independently integrated bed/link volumes](../artifacts/kineticad/tests/four-bar-worker-cad.test.mjs#L25) | passed | 4421.602 |

### four-bar-workspace.test.mjs

9 passing tests. Real native/project/demo parsing and canonical-identity checks with memory persistence. Includes an actual saved Chrome DTO as input and tight roundoff-only matching; reading that fixture is not a new browser interaction.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [four-bar document is fresh, stopped, isolated from the input and limited to the validated cycle profile](../artifacts/kineticad/tests/four-bar-workspace.test.mjs#L16) | passed | 2.242 |
| [native Save/project and demo parsers retain four-bar target, seed, branch, placement and complete feature histories](../artifacts/kineticad/tests/four-bar-workspace.test.mjs#L24) | passed | 2.978 |
| [cosmetic names and derived caches do not disable a physically unchanged saved four-bar](../artifacts/kineticad/tests/four-bar-workspace.test.mjs#L33) | passed | 0.603 |
| [manual geometry, transforms, materials, visibility, ground or joint changes disable generated reference claims](../artifacts/kineticad/tests/four-bar-workspace.test.mjs#L39) | passed | 3.029 |
| [reference profile rejects altered gravity, fixed step, duration, manual-edit marker and other experiment controllers](../artifacts/kineticad/tests/four-bar-workspace.test.mjs#L44) | passed | 0.848 |
| [invalid loaded design metadata rejects before replacing a workspace](../artifacts/kineticad/tests/four-bar-workspace.test.mjs#L50) | passed | 2.325 |
| [multiple generated builds and native Save preserve original persistence and live STEP references until return](../artifacts/kineticad/tests/four-bar-workspace.test.mjs#L56) | passed | 2.913 |
| [actual Chrome native Save is canonical despite platform transcendental rounding](../artifacts/kineticad/tests/four-bar-workspace.test.mjs#L67) | passed | 0.910 |
| [roundoff matching preserves exact structure and rejects tiny meaningful edits and nonfinite values](../artifacts/kineticad/tests/four-bar-workspace.test.mjs#L76) | passed | 1.564 |

### history-store.test.mjs

12 passing tests. Actual singleton Zustand actions, production history and project packaging. Imported STEP bytes and fingerprints are real persistence inputs, while only the CAD import endpoint is controlled; no new solid reconstruction is claimed here.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [Undo and Redo restore a cascading part/Boolean/joint/ground deletion in one atomic document publication](../artifacts/kineticad/tests/history-store.test.mjs#L44) | passed | 1.915 |
| [invalid/no-op actions preserve Redo, while a new successful document edit branches it](../artifacts/kineticad/tests/history-store.test.mjs#L73) | passed | 1.286 |
| [a transform gesture groups all pose samples into one step and copies caller arrays](../artifacts/kineticad/tests/history-store.test.mjs#L101) | passed | 0.932 |
| [nested transforms and cancellation preserve the preceding edit and the previous Redo branch](../artifacts/kineticad/tests/history-store.test.mjs#L115) | passed | 0.594 |
| [selection, preview, picker, simulation frames and derived mass writes do not create history](../artifacts/kineticad/tests/history-store.test.mjs#L135) | passed | 0.400 |
| [feature and sketch drafts add no history, while each committed source edit restores its exact stable IDs](../artifacts/kineticad/tests/history-store.test.mjs#L154) | passed | 0.974 |
| [part duplication retains unique remapped feature/sketch IDs through Undo and Redo without mutating its source](../artifacts/kineticad/tests/history-store.test.mjs#L178) | passed | 0.599 |
| [editors, geometry rebuilds and overlapping operations block history without consuming it](../artifacts/kineticad/tests/history-store.test.mjs#L191) | passed | 0.261 |
| [sketch geometry and its controller invalidation restore together as one document edit](../artifacts/kineticad/tests/history-store.test.mjs#L207) | passed | 0.452 |
| [an external assembly replacement is a boundary even when its document bytes are identical](../artifacts/kineticad/tests/history-store.test.mjs#L220) | passed | 1.069 |
| [entering, replacing and leaving demo workspaces cannot expose another document history](../artifacts/kineticad/tests/history-store.test.mjs#L230) | passed | 0.825 |
| [deleted imported STEP assets survive Undo, native Save/parse and a cold asset restore](../artifacts/kineticad/tests/history-store.test.mjs#L245) | passed | 12.015 |

### hole-picker.test.mjs

5 passing tests. Actual Three.js topology interaction and hole-selection state with controlled DOM/topology fixtures. Checks two-click creation and local/world coordinates; actual Chrome creation remains separate evidence.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [two real canvas clicks set Hole UV on the top face of an untransformed solid](../artifacts/kineticad/tests/hole-picker.test.mjs#L66) | passed | 2.766 |
| [two real canvas clicks set Hole UV on the bottom face of an untransformed solid](../artifacts/kineticad/tests/hole-picker.test.mjs#L66) | passed | 0.396 |
| [two real canvas clicks set Hole UV on the top face of an translated with mixed XYZ rotation solid](../artifacts/kineticad/tests/hole-picker.test.mjs#L66) | passed | 0.358 |
| [two real canvas clicks set Hole UV on the bottom face of an translated with mixed XYZ rotation solid](../artifacts/kineticad/tests/hole-picker.test.mjs#L66) | passed | 0.279 |
| [Clear face and a changed face both restart the Hole picker without stale UV](../artifacts/kineticad/tests/hole-picker.test.mjs#L79) | passed | 0.461 |

### mass-properties.test.mjs

8 passing tests. Actual installed OCCT mass integration and Rapier inertia assignment, with independent analytic tensor/density/frame references and invalid-data rejection.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [OCCT cuboid volume, mass, centroid and all three anisotropic moments match analytic values](../artifacts/kineticad/tests/mass-properties.test.mjs#L59) | passed | 1903.042 |
| [translated and generally rotated cuboid retains centroidal tensor, including off-diagonal terms](../artifacts/kineticad/tests/mass-properties.test.mjs#L68) | passed | 4.369 |
| [solid cylinder moments match axial and transverse analytic inertia](../artifacts/kineticad/tests/mass-properties.test.mjs#L77) | passed | 3.055 |
| [bored ring retains removed-volume effects in its axial and transverse inertia](../artifacts/kineticad/tests/mass-properties.test.mjs#L88) | passed | 49.505 |
| [warm cache and a material change preserve the full tensor and principal frame](../artifacts/kineticad/tests/mass-properties.test.mjs#L102) | passed | 5.720 |
| [Rapier torque impulse follows the full rotated inertia inverse, not part-local diagonal axes](../artifacts/kineticad/tests/mass-properties.test.mjs#L115) | passed | 4.447 |
| [eigensolver handles tiny and large units and rejects non-physical tensors](../artifacts/kineticad/tests/mass-properties.test.mjs#L136) | passed | 0.307 |
| [empty geometry and invalid density fail instead of creating fictitious physical bodies](../artifacts/kineticad/tests/mass-properties.test.mjs#L148) | passed | 0.577 |

### object-selection.test.mjs

13 passing tests. Actual Three.js meshes, raycaster and TransformControls with controlled DOM/pointer/rAF adapters; selected cases use the actual Zustand store/history. This is not a browser render or arbitrary imported-CAD visibility certificate.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [real raycast selects the nearest visible solid, ignores hidden ancestors and clears an empty ray](../artifacts/kineticad/tests/object-selection.test.mjs#L46) | passed | 2.377 |
| [actual mesh holes pass the ray through to the visible body behind them](../artifacts/kineticad/tests/object-selection.test.mjs#L56) | passed | 1.902 |
| [hidden Boolean inputs are excluded even before the render layer catches up; compounds stay selectable](../artifacts/kineticad/tests/object-selection.test.mjs#L68) | passed | 1.069 |
| [coincident visible source/result surfaces deterministically select the finished result](../artifacts/kineticad/tests/object-selection.test.mjs#L94) | passed | 0.455 |
| [orange outline source points follow full XYZ placement without changing CAD arrays or shared materials](../artifacts/kineticad/tests/object-selection.test.mjs#L104) | passed | 0.435 |
| [normal pointer click selects the actual body and an empty canvas click clears it without creating history](../artifacts/kineticad/tests/object-selection.test.mjs#L142) | passed | 1.050 |
| [orbit drags that return to their starting point cannot select; a fresh click can](../artifacts/kineticad/tests/object-selection.test.mjs#L153) | passed | 1.269 |
| [gizmo ownership is latched through release, including a handle click with no displacement](../artifacts/kineticad/tests/object-selection.test.mjs#L163) | passed | 0.210 |
| [right clicks, outside releases, pointer cancellation and leaving the canvas never select](../artifacts/kineticad/tests/object-selection.test.mjs#L173) | passed | 0.109 |
| [every edit/physics mode suppresses object picking and a mid-click mode or document change cancels it](../artifacts/kineticad/tests/object-selection.test.mjs#L184) | passed | 0.188 |
| [disposed pointer picker releases all listeners and cannot make a later selection](../artifacts/kineticad/tests/object-selection.test.mjs#L199) | passed | 0.093 |
| [actual TransformControls uses the native part origin and flushes the last drag value before closing its transaction](../artifacts/kineticad/tests/object-selection.test.mjs#L204) | passed | 8.773 |
| [detaching or hiding actual TransformControls mid-drag releases interaction and cancels stale deferred writes](../artifacts/kineticad/tests/object-selection.test.mjs#L226) | passed | 10.950 |

### overlay-frames.test.mjs

8 passing tests. Actual Three.js overlay/glyph transforms with controlled mesh/topology and saved fixtures. Includes the three prior hinge-placement regressions; no OCCT or browser session is executed in this file.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [finished sketches follow arbitrary part transforms, including changes without geometry edits](../artifacts/kineticad/tests/overlay-frames.test.mjs#L32) | passed | 2.545 |
| [consumed sketches show only when selected, unused profiles show, and hidden parts stay hidden](../artifacts/kineticad/tests/overlay-frames.test.mjs#L47) | passed | 0.515 |
| [gyroscope profiles retain the assembly elevation instead of being drawn at the ground origin](../artifacts/kineticad/tests/overlay-frames.test.mjs#L69) | passed | 2.467 |
| [joint glyph anchors and axes track moving body poses rather than static design transforms](../artifacts/kineticad/tests/overlay-frames.test.mjs#L84) | passed | 2.206 |
| [selection enlargement does not displace prismatic or planar anchors](../artifacts/kineticad/tests/overlay-frames.test.mjs#L119) | passed | 0.669 |
| [revolute picks retain local true centres for the translated native circle and partial-arc browser fixture](../artifacts/kineticad/tests/overlay-frames.test.mjs#L154) | passed | 0.654 |
| [revolute picks preserve shared world centres under mixed XYZ rotation without inverse-transforming local metadata twice](../artifacts/kineticad/tests/overlay-frames.test.mjs#L170) | passed | 0.161 |
| [revolute picks support identity-frame Boolean topology paired with translated native circular topology](../artifacts/kineticad/tests/overlay-frames.test.mjs#L187) | passed | 0.090 |

### part-transform-occt.test.mjs

2 passing tests. Actual OCCT transformed solids, mass and intersections against independently computed Three.js/analytic frames. Covers the selected mixed-axis transforms.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [a translated, generally rotated B-rep keeps its analytic volume and Three-world centroid](../artifacts/kineticad/tests/part-transform-occt.test.mjs#L12) | passed | 1811.955 |
| [the same world transform preserves boolean overlap between two independently transformed bodies](../artifacts/kineticad/tests/part-transform-occt.test.mjs#L30) | passed | 44.878 |

### part-transform.test.mjs

3 passing tests. Pure transform matrix/math and actual Three.js comparison; the OCCT call boundary is controlled. The separate OCCT file establishes kernel execution.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [arbitrary mixed XYZ rotations and translations match the actual Three quaternion convention](../artifacts/kineticad/tests/part-transform.test.mjs#L14) | passed | 0.770 |
| [invalid transforms fail before constructing OCCT values](../artifacts/kineticad/tests/part-transform.test.mjs#L26) | passed | 0.173 |
| [OCCT transform wrappers are released on constructor or shape-operation failures](../artifacts/kineticad/tests/part-transform.test.mjs#L32) | passed | 0.122 |

### path-drawing.test.mjs

7 passing tests. Actual compiled PathDrawing event handlers with controlled hook state and SVG affine matrices. Checks drawing-coordinate/input semantics, not React lifecycle, rendered layout or a human Chrome stroke.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [actual drawing handlers convert translated and letterboxed screen coordinates to millimetres with Y up](../artifacts/kineticad/tests/path-drawing.test.mjs#L96) | passed | 2.073 |
| [a complete pointer stroke forms a valid closed ellipse through the shipped target validator](../artifacts/kineticad/tests/path-drawing.test.mjs#L106) | passed | 1.522 |
| [an open stroke stays open at the drawing boundary and is rejected until explicitly closed](../artifacts/kineticad/tests/path-drawing.test.mjs#L119) | passed | 0.734 |
| [disabled, secondary-button and outside-grid starts cannot replace a path](../artifacts/kineticad/tests/path-drawing.test.mjs#L128) | passed | 0.925 |
| [pointer cancellation and another pointer leave the previous target untouched](../artifacts/kineticad/tests/path-drawing.test.mjs#L140) | passed | 0.348 |
| [a changing preview cannot shift the coordinate frame during a pointer stroke](../artifacts/kineticad/tests/path-drawing.test.mjs#L149) | passed | 0.336 |
| [an overlong stroke reports the vertex limit without committing a silently truncated loop](../artifacts/kineticad/tests/path-drawing.test.mjs#L160) | passed | 7.492 |

### path-trace-label.test.mjs

4 passing tests. Actual Three.js scene/material-point label logic with controlled DOM and explicit poses. Tests projection, visibility and measured-tracer placement without rendered browser acceptance.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [trace label uses the actual coupler and ancestor matrices instead of a predicted or saved pose](../artifacts/kineticad/tests/path-trace-label.test.mjs#L42) | passed | 3.628 |
| [trace projection refreshes a camera moved since the previous rendered frame](../artifacts/kineticad/tests/path-trace-label.test.mjs#L69) | passed | 0.946 |
| [trace annotation hides on missing meshes, clipped depth and invalidated geometry or experiment configuration](../artifacts/kineticad/tests/path-trace-label.test.mjs#L76) | passed | 1.967 |
| [trace annotation holds a paused material point and releases its own DOM node on disposal](../artifacts/kineticad/tests/path-trace-label.test.mjs#L91) | passed | 0.628 |

### physics-worker.test.mjs

17 passing tests. Actual shipped Comlink/Rapier worker with independent analytic descriptors/references. Covers units, joints/frames, motor behavior and lifecycle; preserves the original strict windmill gate. Ordinary CAD contact and finite motor-force ratings remain outside its model.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [windmill seed mate retains pi ±5e-7 rad/s after five seconds with an analytical rotor](../artifacts/kineticad/tests/physics-worker.test.mjs#L82) | passed | 135.155 |
| [free fall uses millimetres, seconds, kilograms and is independent of mass](../artifacts/kineticad/tests/physics-worker.test.mjs#L107) | passed | 7.642 |
| [zero and blank live revolute commands release the motor so a rotor coasts](../artifacts/kineticad/tests/physics-worker.test.mjs#L116) | passed | 63.757 |
| [zero and blank live prismatic commands release the slider to gravity](../artifacts/kineticad/tests/physics-worker.test.mjs#L135) | passed | 39.422 |
| [unpowered pendulum follows the analytical physical-pendulum period](../artifacts/kineticad/tests/physics-worker.test.mjs#L156) | passed | 36.637 |
| [revolute motor follows part A local axis when both bodies share a rotated frame](../artifacts/kineticad/tests/physics-worker.test.mjs#L180) | passed | 14.680 |
| [prismatic motor follows rotated local axis and preserves lateral position](../artifacts/kineticad/tests/physics-worker.test.mjs#L187) | passed | 17.226 |
| [fixed mate preserves an initially translated and rotated child](../artifacts/kineticad/tests/physics-worker.test.mjs#L197) | passed | 11.721 |
| [unsupported mismatched joint frames stop the whole world instead of snapping parts](../artifacts/kineticad/tests/physics-worker.test.mjs#L225) | passed | 1.228 |
| [revolute allows initial twist about its shared axis; prismatic rejects that twist](../artifacts/kineticad/tests/physics-worker.test.mjs#L235) | passed | 16.584 |
| [unsupported planar constraints stop simulation rather than being omitted](../artifacts/kineticad/tests/physics-worker.test.mjs#L247) | passed | 0.285 |
| [a mate referencing a hidden or missing body rejects the whole incomplete assembly](../artifacts/kineticad/tests/physics-worker.test.mjs#L254) | passed | 0.325 |
| [new gimbal seed drives each relative joint speed, not each child world-speed magnitude](../artifacts/kineticad/tests/physics-worker.test.mjs#L266) | passed | 58.001 |
| [fixed solver stepping gives identical motion at 30 Hz, 144 Hz and irregular render rates](../artifacts/kineticad/tests/physics-worker.test.mjs#L305) | passed | 13.080 |
| [fractional requests accumulate; zero pauses and undefined advances one configured step](../artifacts/kineticad/tests/physics-worker.test.mjs#L323) | passed | 1.086 |
| [bounded catch-up retains time instead of dropping it and zero never drains backlog](../artifacts/kineticad/tests/physics-worker.test.mjs#L342) | passed | 1.214 |
| [playback time scaling advances only the actual zero, one or two seconds requested](../artifacts/kineticad/tests/physics-worker.test.mjs#L354) | passed | 4.626 |

### production-server.test.mjs

9 passing tests. Actual production request handler, temporary filesystem and Node HTTP response serialization over an in-memory Duplex. Checks base paths, MIME, cache policy, HEAD, missing assets and request-local errors without a listening socket or deployed reverse proxy.

| Test / exact source declaration | Status | Duration (ms) | Purpose |
| --- | --- | ---: | --- |
| [production handler returns 400 for malformed URLs and serves a later request](../artifacts/kineticad/tests/production-server.test.mjs#L66) | passed | 7.356 | Contain URL-constructor failures in an uncached 400 and keep later requests usable. |
| [production base and extensionless SPA routes return the uncached app shell](../artifacts/kineticad/tests/production-server.test.mjs#L79) | passed | 3.210 | Preserve /app and nested extensionless SPA refreshes with uncached HTML. |
| [existing hashed JavaScript, CSS and WASM retain exact bytes, MIME and immutable caching](../artifacts/kineticad/tests/production-server.test.mjs#L92) | passed | 2.651 | Preserve exact static bytes and browser-critical JavaScript/CSS/WASM MIME and immutable caching. |
| [public demo JSON, seed scripts, icons and HTML remain uncached with their real content](../artifacts/kineticad/tests/production-server.test.mjs#L109) | passed | 1.947 | Keep public fixtures, seed scripts, icons and HTML uncached. |
| [missing static resources return uncached 404 rather than successful or immutable HTML](../artifacts/kineticad/tests/production-server.test.mjs#L125) | passed | 2.635 | Reject stale assets with 404 rather than returning cached successful HTML. |
| [base stripping respects path boundaries and still supports root deployment](../artifacts/kineticad/tests/production-server.test.mjs#L140) | passed | 2.862 | Strip only an exact base prefix, while retaining the existing root-deployment behavior. |
| [HEAD returns GET status and content/cache headers without a response body](../artifacts/kineticad/tests/production-server.test.mjs#L150) | passed | 2.633 | Return GET-equivalent status/content/cache headers for HEAD without a body. |
| [missing app shell returns 404 and an unexpected filesystem failure stays in its request](../artifacts/kineticad/tests/production-server.test.mjs#L162) | passed | 1.922 | Distinguish missing files from unexpected filesystem failures and contain both to their request. |
| [a disconnected response is left closed and cannot reject the asynchronous handler](../artifacts/kineticad/tests/production-server.test.mjs#L176) | passed | 1.835 | Do not write to a disconnected response or reject the async handler for that condition. |

### project-cad-roundtrip.test.mjs

2 passing tests. Actual shipped CAD worker/OCCT restart and durable project packaging. Exercises imported-source restoration and edited geometry after re-opening; browser picker/download steps are separate.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [actual worker restores embedded STEP after worker restart, retaining native history, transforms, topology and exportable geometry](../artifacts/kineticad/tests/project-cad-roundtrip.test.mjs#L29) | passed | 4319.646 |
| [a legacy live import is packaged in local coordinates and missing old worker geometry fails clearly](../artifacts/kineticad/tests/project-cad-roundtrip.test.mjs#L86) | passed | 2037.421 |

### project-persistence.test.mjs

13 passing tests. Real project parser, packaging, recovery orchestration and Zustand, with a memory repository and controlled asset restore. Validates transactional data handling, not browser IndexedDB quotas or interface behavior.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [complete project downloads and both recovery generations retain Boolean material, result ground and joint revisions](../artifacts/kineticad/tests/project-persistence.test.mjs#L38) | passed | 9.693 |
| [Boolean project parsing rejects invalid materials/body references and retains stale revisions for explicit repicking](../artifacts/kineticad/tests/project-persistence.test.mjs#L55) | passed | 1.535 |
| [native history, transforms, materials and mates survive with runtime stopped](../artifacts/kineticad/tests/project-persistence.test.mjs#L67) | passed | 0.366 |
| [Save accepts the live Zustand object without cloning actions or editor state](../artifacts/kineticad/tests/project-persistence.test.mjs#L75) | passed | 0.284 |
| [malformed references, dimensions, transforms and unknown features reject](../artifacts/kineticad/tests/project-persistence.test.mjs#L82) | passed | 0.939 |
| [six-axis configuration persists and invalid target rejects](../artifacts/kineticad/tests/project-persistence.test.mjs#L93) | passed | 0.367 |
| [corrupt embedded bytes reject before asset reconstruction or storage changes](../artifacts/kineticad/tests/project-persistence.test.mjs#L101) | passed | 1.136 |
| [invalid downloaded project does not replace the current or previous snapshots](../artifacts/kineticad/tests/project-persistence.test.mjs#L111) | passed | 0.754 |
| [autosave keeps two complete generations and quota failure retains both](../artifacts/kineticad/tests/project-persistence.test.mjs#L122) | passed | 1.319 |
| [corrupt newest recovery falls back to validated previous without overwriting either](../artifacts/kineticad/tests/project-persistence.test.mjs#L137) | passed | 0.671 |
| [newest state is captured before async work and load follows queued autosave](../artifacts/kineticad/tests/project-persistence.test.mjs#L146) | passed | 0.808 |
| [real Zustand demo isolation preserves durable project and last-good copy](../artifacts/kineticad/tests/project-persistence.test.mjs#L155) | passed | 0.788 |
| [version 8 migration runs before validation; old missing STEP files reject clearly](../artifacts/kineticad/tests/project-persistence.test.mjs#L172) | passed | 0.362 |

### simulation-runner.test.mjs

19 passing tests. Actual production runner and planning/hash logic with controlled worker, renderer, clock and frame adapters. Deferred RPCs test stale/overlapping work, model changes and reset; they are not additional physics measurements.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [runner simulates the final Boolean body once with world-frame mesh/mass and suppresses every consumed source](../artifacts/kineticad/tests/simulation-runner.test.mjs#L134) | passed | 58.198 |
| [a disconnected final-solid rejection creates no world and leaves the modelling layers visible](../artifacts/kineticad/tests/simulation-runner.test.mjs#L153) | passed | 3.506 |
| [native source edits during pending Boolean CAD preparation reject the stale result before physics dispatch](../artifacts/kineticad/tests/simulation-runner.test.mjs#L161) | passed | 2.389 |
| [Boolean result motor-only edits during CAD preparation use the latest command and preserve valid geometry](../artifacts/kineticad/tests/simulation-runner.test.mjs#L171) | passed | 2.561 |
| [geometry changed during an in-flight world build cannot publish stale Boolean bodies or start its clock](../artifacts/kineticad/tests/simulation-runner.test.mjs#L183) | passed | 2.426 |
| [a geometry edit after Play stops the run and rejects an already-pending pose response](../artifacts/kineticad/tests/simulation-runner.test.mjs#L194) | passed | 2.417 |
| [invalid Boolean material cannot silently simulate original uncut inputs](../artifacts/kineticad/tests/simulation-runner.test.mjs#L201) | passed | 3.613 |
| [runner permits one in-flight step, retains elapsed time, and counts actual worker time](../artifacts/kineticad/tests/simulation-runner.test.mjs#L213) | passed | 2.215 |
| [finite experiments hold the final solver pose and clock instead of resetting the model](../artifacts/kineticad/tests/simulation-runner.test.mjs#L230) | passed | 1.806 |
| [late RPC response cannot move the paused pose or clock; resume preserves its actual time](../artifacts/kineticad/tests/simulation-runner.test.mjs#L243) | passed | 1.814 |
| [stopped or replaced assembly ignores a late step response](../artifacts/kineticad/tests/simulation-runner.test.mjs#L262) | passed | 2.258 |
| [old build reply and teardown cannot destroy the replacement scene world](../artifacts/kineticad/tests/simulation-runner.test.mjs#L274) | passed | 1.764 |
| [invalid cached mass stops the current run and restores modelling layers](../artifacts/kineticad/tests/simulation-runner.test.mjs#L297) | passed | 2.486 |
| [rejected build RPC is caught and does not poison the next successful build](../artifacts/kineticad/tests/simulation-runner.test.mjs#L309) | passed | 1.788 |
| [motor edits during pending CAD work reach the world that is eventually built](../artifacts/kineticad/tests/simulation-runner.test.mjs#L326) | passed | 1.508 |
| [motor edits during an in-flight build replay before the first solver step](../artifacts/kineticad/tests/simulation-runner.test.mjs#L350) | passed | 1.677 |
| [six-axis build validates source solids and uses its own full movement duration](../artifacts/kineticad/tests/simulation-runner.test.mjs#L370) | passed | 1.694 |
| [six-axis source rejection never creates a physics world](../artifacts/kineticad/tests/simulation-runner.test.mjs#L381) | passed | 1.897 |
| [canonical path linkage dispatches its measured solver profile and six-second real-body run](../artifacts/kineticad/tests/simulation-runner.test.mjs#L390) | passed | 7.227 |

### sketch-arcs.test.mjs

7 passing tests. Actual installed OCCT sketches, sweeps and mass integration. Independent all-plane arc samples, sector properties and sphere/profile references check the UV-frame correction.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [XY arc endpoints and intermediate samples agree with sketch UV; sector extrudes with analytic volume and centroid](../artifacts/kineticad/tests/sketch-arcs.test.mjs#L19) | passed | 1835.583 |
| [XY semicircle revolves to an exact sphere about the sketch V axis](../artifacts/kineticad/tests/sketch-arcs.test.mjs#L60) | passed | 5.274 |
| [XZ arc endpoints and intermediate samples agree with sketch UV; sector extrudes with analytic volume and centroid](../artifacts/kineticad/tests/sketch-arcs.test.mjs#L19) | passed | 7.756 |
| [XZ semicircle revolves to an exact sphere about the sketch V axis](../artifacts/kineticad/tests/sketch-arcs.test.mjs#L60) | passed | 2.501 |
| [YZ arc endpoints and intermediate samples agree with sketch UV; sector extrudes with analytic volume and centroid](../artifacts/kineticad/tests/sketch-arcs.test.mjs#L19) | passed | 6.145 |
| [YZ semicircle revolves to an exact sphere about the sketch V axis](../artifacts/kineticad/tests/sketch-arcs.test.mjs#L60) | passed | 2.486 |
| [both Stewart turning profiles retain exact circular ends and rebuild as single valid solids](../artifacts/kineticad/tests/sketch-arcs.test.mjs#L79) | passed | 17.488 |

### sketch-dimensions-cad.test.mjs

10 passing tests. Actual installed OCCT with edited primitives and production project parsing. Independent cylinder, rectangle, line and sector references plus Save/parse/rebuild establish selected geometry/persistence cases.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [editing circle diameter20→30 mm rebuilds an exact cylinder with the expected volume, bounds and mass](../artifacts/kineticad/tests/sketch-dimensions-cad.test.mjs#L64) | passed | 1850.352 |
| [XY rectangle width and height edits change exact solid dimensions in the sketch's U/V axes](../artifacts/kineticad/tests/sketch-dimensions-cad.test.mjs#L81) | passed | 27.286 |
| [XZ rectangle width and height edits change exact solid dimensions in the sketch's U/V axes](../artifacts/kineticad/tests/sketch-dimensions-cad.test.mjs#L81) | passed | 25.709 |
| [YZ rectangle width and height edits change exact solid dimensions in the sketch's U/V axes](../artifacts/kineticad/tests/sketch-dimensions-cad.test.mjs#L81) | passed | 24.306 |
| [line length/angle/start edits create a closed rotated rectangular profile with analytical area](../artifacts/kineticad/tests/sketch-dimensions-cad.test.mjs#L107) | passed | 8.098 |
| [XY edited arc radius/start/sweep and its two lines rebuild the exact closed sector](../artifacts/kineticad/tests/sketch-dimensions-cad.test.mjs#L128) | passed | 7.609 |
| [XZ edited arc radius/start/sweep and its two lines rebuild the exact closed sector](../artifacts/kineticad/tests/sketch-dimensions-cad.test.mjs#L128) | passed | 7.480 |
| [YZ edited arc radius/start/sweep and its two lines rebuild the exact closed sector](../artifacts/kineticad/tests/sketch-dimensions-cad.test.mjs#L128) | passed | 8.349 |
| [an arc-only edit does not silently move adjacent lines or disguise an open profile as a solid](../artifacts/kineticad/tests/sketch-dimensions-cad.test.mjs#L141) | passed | 7.804 |
| [complete Save/parse preserves edited primitives and rebuilds identical actual CAD geometry](../artifacts/kineticad/tests/sketch-dimensions-cad.test.mjs#L154) | passed | 57.330 |

### sketch-dimensions.test.mjs

9 passing tests. Pure primitive dimension equations, exact no-op preservation and finite/domain validation. Does not implement a general geometric-constraint solver.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [fields expose persistent UV geometry with diameter and degree conventions](../artifacts/kineticad/tests/sketch-dimensions.test.mjs#L15) | passed | 0.775 |
| [exact no-op edits retain primitive identity and all original floating-point coordinates](../artifacts/kineticad/tests/sketch-dimensions.test.mjs#L29) | passed | 0.288 |
| [circle diameter and rectangle width/height edits preserve anchors and neighbours](../artifacts/kineticad/tests/sketch-dimensions.test.mjs#L39) | passed | 0.121 |
| [line edits satisfy independent right-triangle, quadrant and winding references](../artifacts/kineticad/tests/sketch-dimensions.test.mjs#L51) | passed | 0.160 |
| [arc edits preserve centre and produce the stated circular endpoints and CCW sweep across zero](../artifacts/kineticad/tests/sketch-dimensions.test.mjs#L66) | passed | 0.098 |
| [complete values reject unknown, missing, nonfinite, nonnumeric and out-of-domain edits without mutation](../artifacts/kineticad/tests/sketch-dimensions.test.mjs#L80) | passed | 0.982 |
| [inclusive bounds accept valid stored coordinates and primitives remain editable after serialization](../artifacts/kineticad/tests/sketch-dimensions.test.mjs#L100) | passed | 0.199 |
| [minimum lengths and arc sweeps survive cancellation at the maximum coordinate and angle scales](../artifacts/kineticad/tests/sketch-dimensions.test.mjs#L115) | passed | 0.228 |
| [sketch validation allows empty/open geometry but rejects degenerate primitive dimensions](../artifacts/kineticad/tests/sketch-dimensions.test.mjs#L137) | passed | 0.172 |

### sketch-edit.test.mjs

14 passing tests. Actual store/coordinator with controlled CAD and topology promises. Checks atomic commit, stale/cancelled/failed validation, references and metadata; kernel correctness is checked separately.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [successful edit commits only after full-chain validation, preserving identities and clearing derived state](../artifacts/kineticad/tests/sketch-edit.test.mjs#L56) | passed | 1.968 |
| [CAD history failure retains the committed sketch and can be retried](../artifacts/kineticad/tests/sketch-edit.test.mjs#L82) | passed | 0.606 |
| [dependent assembly Boolean receives updated geometry and must succeed before commit](../artifacts/kineticad/tests/sketch-edit.test.mjs#L95) | passed | 3.116 |
| [a later geometry or Boolean-consumer edit invalidates a pending transaction](../artifacts/kineticad/tests/sketch-edit.test.mjs#L112) | passed | 0.444 |
| [mass-cache churn and cosmetic part naming do not reject or overwrite newer display state](../artifacts/kineticad/tests/sketch-edit.test.mjs#L126) | passed | 0.374 |
| [loading an identical-looking project during validation rejects its old Sketch identity](../artifacts/kineticad/tests/sketch-edit.test.mjs#L135) | passed | 0.239 |
| [cancelled or closed editors cannot commit a late CAD result](../artifacts/kineticad/tests/sketch-edit.test.mjs#L144) | passed | 0.363 |
| [two pending edits cannot commit out of order](../artifacts/kineticad/tests/sketch-edit.test.mjs#L156) | passed | 0.324 |
| [unchanged referenced edge geometry retains the exact joint and its local anchor](../artifacts/kineticad/tests/sketch-edit.test.mjs#L165) | passed | 2.020 |
| [missing geometry IDs or a changed referenced face reject without guessing new pivots](../artifacts/kineticad/tests/sketch-edit.test.mjs#L173) | passed | 0.589 |
| [fixed mates and unused sketches need no geometric-pivot remapping](../artifacts/kineticad/tests/sketch-edit.test.mjs#L184) | passed | 0.178 |
| [meaningful edits clear canonical controllers and save the manual-geometry marker; no-op preserves them](../artifacts/kineticad/tests/sketch-edit.test.mjs#L191) | passed | 1.595 |
| [invalid dimensions, stale editor source and active editors reject before CAD dispatch](../artifacts/kineticad/tests/sketch-edit.test.mjs#L215) | passed | 0.289 |
| [the store commit independently rejects a stale source signature](../artifacts/kineticad/tests/sketch-edit.test.mjs#L231) | passed | 0.099 |

### stewart-controller.test.mjs

6 passing tests. Pure inverse kinematics/controller math, independent pose/reference calculations and motion/workspace guards. Actual platform trajectories are documented separately and are not implied by this file alone.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [six-axis IK agrees with independently transformed anchors for both directions of every axis](../artifacts/kineticad/tests/stewart-controller.test.mjs#L21) | passed | 19.462 |
| [all 64 simultaneous translation/rotation workspace corners satisfy stroke, speed and singularity guards](../artifacts/kineticad/tests/stewart-controller.test.mjs#L34) | passed | 69.634 |
| [quintic trajectory starts and ends at rest and holds its final requested pose](../artifacts/kineticad/tests/stewart-controller.test.mjs#L41) | passed | 0.451 |
| [invalid values, speed requests, altered frames and altered anchors reject explicitly](../artifacts/kineticad/tests/stewart-controller.test.mjs#L55) | passed | 0.582 |
| [dimensionless Jacobian guard detects a collapsed singular geometry](../artifacts/kineticad/tests/stewart-controller.test.mjs#L64) | passed | 0.217 |
| [orientation error measures tiny and sign-equivalent quaternions without acos cancellation](../artifacts/kineticad/tests/stewart-controller.test.mjs#L71) | passed | 0.052 |

### stewart-geometry.test.mjs

5 passing tests. Pure Stewart factory/configuration and independent closed-loop/heave geometry. Does not rebuild B-rep solids or run Rapier in this file.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [the editable v9 fixture forms one connected 14-body, 18-joint mechanism](../artifacts/kineticad/tests/stewart-geometry.test.mjs#L43) | passed | 2.406 |
| [every encoded joint closes in world space and each actuator uses compatible oblique frames](../artifacts/kineticad/tests/stewart-geometry.test.mjs#L67) | passed | 0.651 |
| [the six-axis length Jacobian stays nonsingular and equal actuator rates produce pure heave](../artifacts/kineticad/tests/stewart-geometry.test.mjs#L106) | passed | 0.967 |
| [sampled lift retains rod overlap, radial bore clearance and conservative separation between legs](../artifacts/kineticad/tests/stewart-geometry.test.mjs#L144) | passed | 1.892 |
| [the builder rejects an unsafe programme or insufficient rod overlap](../artifacts/kineticad/tests/stewart-geometry.test.mjs#L169) | passed | 0.490 |

### stewart-integration.test.mjs

3 passing tests. Production source-geometry/configuration gates, parsing and measurement store with explicit fixtures. No newly simulated six-axis motion.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [saved six-axis command survives demo parsing and invalid commands fail closed](../artifacts/kineticad/tests/stewart-integration.test.mjs#L9) | passed | 2.806 |
| [source guard permits labels and material changes but rejects altered solids, topology and visibility](../artifacts/kineticad/tests/stewart-integration.test.mjs#L16) | passed | 8.539 |
| [measurement state uses actual worker results, holds on zero step, and clears on reset or another experiment](../artifacts/kineticad/tests/stewart-integration.test.mjs#L33) | passed | 0.160 |

### stewart-workspace.test.mjs

5 passing tests. Conservative floating-point workspace/path subdivision and independent geometric arithmetic. Not formal interval arithmetic, universal dynamics acceptance or exact OCCT at every pose.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [the entire ±5 mm / ±2° pose box is enclosed with no unresolved cells](../artifacts/kineticad/tests/stewart-workspace.test.mjs#L11) | passed | 65.128 |
| [insufficient subdivision and an enlarged unsafe range fail explicitly](../artifacts/kineticad/tests/stewart-workspace.test.mjs#L25) | passed | 1.637 |
| [independent Rodrigues progress matches exact quaternion axis-angle interpolation at intermediate poses](../artifacts/kineticad/tests/stewart-workspace.test.mjs#L30) | passed | 0.470 |
| [all 64 extreme home-to-target paths are enclosed between progress samples](../artifacts/kineticad/tests/stewart-workspace.test.mjs#L47) | passed | 150.653 |
| [exact target solid placements close spherical endpoints and encode independent rod extension](../artifacts/kineticad/tests/stewart-workspace.test.mjs#L56) | passed | 0.952 |

### vite-allowed-hosts.test.mjs

8 passing tests. Pure exact-host parser plus actual loading of all three Vite configurations and installed Vite development middleware over Node HTTP/Duplex. Configuration loading disables Replit editor plugins. Does not operate a preview listener or live Replit proxy; Vite's separate additional-host environment override is explicitly cleared for the middleware case.

| Test / exact source declaration | Status | Duration (ms) | Purpose |
| --- | --- | ---: | --- |
| [absent Replit domains leave Vite localhost and IP defaults intact](../artifacts/kineticad/tests/vite-allowed-hosts.test.mjs#L12) | passed | 0.585 | Keep local/IP defaults when the documented Replit domain variables are absent. |
| [Replit development and comma-separated application domains produce exact unique hosts](../artifacts/kineticad/tests/vite-allowed-hosts.test.mjs#L18) | passed | 0.172 | Normalize and deduplicate the development domain and comma-separated application domains. |
| [HTTP(S) origins are reduced to exact hostnames without making subdomain wildcards](../artifacts/kineticad/tests/vite-allowed-hosts.test.mjs#L25) | passed | 0.049 | Reduce HTTP(S) origins to exact names without trusting arbitrary subdomains. |
| [wildcard and leading-dot tenant-domain settings fail closed](../artifacts/kineticad/tests/vite-allowed-hosts.test.mjs#L32) | passed | 0.235 | Reject wildcard and leading-dot tenant allowlists. |
| [invalid origins, credentials and hostname labels cannot silently widen trusted hosts](../artifacts/kineticad/tests/vite-allowed-hosts.test.mjs#L40) | passed | 0.199 | Reject invalid names and origins rather than broadening trust silently. |
| [host parsing does not mutate environment values or retain another invocation list](../artifacts/kineticad/tests/vite-allowed-hosts.test.mjs#L51) | passed | 0.071 | Keep invocations independent and leave environment inputs unmodified. |
| [CAD, landing and mockup configs apply the exact allowlist to development and preview](../artifacts/kineticad/tests/vite-allowed-hosts.test.mjs#L72) | passed | 95.569 | Check that CAD, landing and mockup configure both development and preview allowlists. |
| [actual installed Vite middleware accepts configured/local hosts and rejects other tenants](../artifacts/kineticad/tests/vite-allowed-hosts.test.mjs#L87) | passed | 11.378 | Exercise actual Vite middleware: configured/local names accepted, sibling tenants/subdomains rejected. |
