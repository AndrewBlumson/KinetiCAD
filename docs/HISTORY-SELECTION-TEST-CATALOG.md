# Undo/Redo and object selection: complete test catalog

**382/382 tests passed across 54 files**, with **zero failures, cancellations, skips or TODOs**. This catalog lists every actual result in the final [per-test JSONL](evidence/history-selection/final/tests.jsonl), grouped by its source file. The [capture summary](evidence/history-selection/final/summary.json) is the machine-readable authority for counts, runtime, source identity and report restoration. The earlier [298-test catalog](TEST-CATALOG.md) and [four-bar catalog](FOUR-BAR-TEST-CATALOG.md) retain their historical snapshots; their totals are not added to this run.

The run started **2026-09-12T20:45:54.733Z** and completed **2026-09-12T20:50:04.379Z**. Node reported **248.848 seconds**; the capture runner measured **249.754 seconds** of total wall time. Runtime: **Node v25.4.0, pnpm 10.28.2, macOS x64**, with serial test-file execution. The recorded Replit Node 24 configuration requires its own runtime check; this Node 25 capture does not establish a Node 24 run.

KinetiCAD was created by Andrew Blumson and Kevin Blumson with **Replit Agent**. The later implementation and automated/computer-use checks were carried out with **Codex** under Andrew's direction. The identity of those development tools is not a physics model or a certification.

## What the count establishes

One row below is one executed Node test case. Loop-generated runtime cases have their own names but may share a declaration line. A solver scenario, time sample, CAD body, Boolean-intersection pair or assertion is a measurement inside a test; it is not an additional test. All 382 result events are test cases in this run; none are suite-container rows.

The checks have different purposes:

- **Mathematics and data policy:** independent reference equations, finite/domain guards, frame arithmetic, feature identity and document validity. These can pass without running a physics engine.
- **Actual kernel/solver:** selected files execute installed OCCT, the production CAD worker, Rapier or the shipped physics/engineering worker. Node adapters replace the browser message endpoint or WASM file loader, not those geometry/dynamics implementations.
- **Controlled integration:** real store/coordinator code runs with explicitly controlled CAD responses, renderer collaborators, restore promises or memory storage. These establish transactions and race handling; their supplied meshes/poses are not new physical measurements.
- **Actual Three.js and input adapters:** real raycasting, geometry transforms and TransformControls run with controlled DOM/pointer/rAF collaborators. They do not establish rendered browser layout, browser pointer capture or a human interaction.

Passing these cases establishes their declared conditions and tolerances. It does not certify every CAD model, imported shape, material behavior or mechanism. Ordinary CAD contacts, bearing friction, finite motor-force ratings and flexible-body behavior are not added by Undo/Redo or selection. Use the [equations and measured tolerance reference](MATHEMATICS-AND-PHYSICS.md), [capability audit](simulator-capability-audit.md) and [four-bar numerical guide](FOUR-BAR-PATH-VERIFICATION.md) for the physical scopes and limitations.

## History, selection and retained hinge coverage

The current run includes **18 history tests**: six history-controller/limit cases and twelve actual-store cases. They distinguish committed model data from transient selection/preview/solver state; preserve cascading deletion and stable IDs; group/cancel gestures; reject stale or failed asynchronous restoration; respect operation/editor/rebuild locks; and prevent history crossing Load/demo boundaries. The imported-asset case exercises real project packaging/fingerprints with a controlled CAD import endpoint, including preservation of unrelated stale experiment metadata. It is not described as another OCCT rebuild. Each history row below has a specific purpose alongside its actual test result.

There are **13 object-selection tests**. They cover nearest visible geometry, real mesh holes, finished Boolean/hidden-input rules, full XYZ outlines, click-versus-orbit/gizmo discrimination, cancellation and disposal, native-origin placement, multi-frame drag emission and completion of interrupted TransformControls gestures. Their per-row purposes identify the exact interaction boundary checked.

The eight-test overlay file includes **three previously added hinge-placement regressions**: true centres for a translated circle/partial arc, mixed XYZ placement without applying the inverse transform twice, and identity-frame Boolean topology paired with translated native topology. These three are part of the eight, and part of 382; they are not added again. They use controlled topology/saved fixtures and real Three.js transforms. [Hinge verification](REVOLUTE-PICKING-VERIFICATION.md)

The [feature and use guide](HISTORY-AND-SELECTION.md) and the separate [Chrome record](evidence/history-selection/browser.json) describe actual interface acceptance. The [final workspace typecheck log](evidence/history-selection/final-typecheck.txt), [workspace build log](evidence/history-selection/final-build.txt) and [landing build log](evidence/history-selection/final-landing-build.txt) are distinct from this automated-test capture. A passing test row does not imply that its corresponding UI was operated in Chrome.

## Reproduction without machine-specific paths

With the existing pinned workspace dependencies installed, run this from the repository root and choose a **new or empty** output directory:

```sh
node scripts/src/capture-test-suite.mjs --output-dir ./test-captures/history-selection-new-run
```

The [portable capture runner](../scripts/src/capture-test-suite.mjs) discovers the current top-level `artifacts/kineticad/tests/*.test.mjs` files, uses the installed TS loader and executes with `--test-concurrency=1`. It copies its [reporter](../scripts/src/capture-test-reporter.mjs) into the selected evidence folder. There is no dependency on the previous machine's absolute checkout or temporary reporter path. Use a different output directory for each capture; the runner refuses to overwrite existing evidence.

For only the history and selection files, while retaining the same evidence format:

```sh
node scripts/src/capture-test-suite.mjs --output-dir ./test-captures/history-selection-focused-new-run \
  --test tests/document-history.test.mjs \
  --test tests/history-store.test.mjs \
  --test tests/object-selection.test.mjs
```

A subset is explicitly labelled `explicit-subset`; it is not a rerun of all 382 cases. New test files or source edits can change subsequent counts/results. The historical [capture-suite.py](evidence/four-bar/capture-suite.py) remains an unchanged record of its original machine-bound capture; use the new runner for a portable current capture.

Keep OCCT processes and captures serialized. Do not run another test suite or edit source/report files concurrently. Some mechanism helpers may reuse temporary exact-CAD descriptors only after validating their declared source and assembly/material hashes. The CAD interference tests rebuild native solids; a descriptor-cache hit in a solver test is not an additional CAD reconstruction. The capture does not deliberately purge those caches.

The runner backs up the two known overwritten historical reports **before starting tests**, saves their post-run bytes separately and restores the originals byte for byte. It retains events even after test failure and handles SIGINT/SIGTERM cleanup. SIGKILL or power loss cannot run cleanup; the output folder's `original-reports/` and `run-start.json` provide recovery bytes and paths. The lock prevents cooperating captures from overlapping; it cannot stop unrelated commands. Other generated artifacts are not promised a general rollback. See `--help` for the complete contract.

## Source and report provenance

The recorded HEAD is `80690884ceb9b46b991dfc0269bd39a631fe1cf1`, with uncommitted implementation changes recorded in `provenance.gitStatus`. **HEAD alone does not identify the measured implementation.** The [start record](evidence/history-selection/final/run-start.json) and [summary](evidence/history-selection/final/summary.json) retain the exact command, selected/available files, runtime, reporter/capture hashes and all **309 listed source-input hashes**. Those listed files were unchanged across the run: `sourceInputsUnchanged: true`, with an empty `sourceInputChanges` array. This is byte identity for the declared input set, not proof about every unlisted transitive dependency or every future checkout.

The [complete raw reporter stream](evidence/history-selection/final/suite-events.jsonl) has SHA-256 `f30356b5406c4728bd549514eede360c228f5ae364869aa62744bbb382218e0f`. It retains test stdout/stderr, event ordering, source locations and Node's final summary. [Process stderr](evidence/history-selection/final/stderr.log) is retained separately. The normalized [tests.jsonl](evidence/history-selection/final/tests.jsonl) preserves full-precision durations; tables below round milliseconds to three decimal places for readability. Per-case duration is not the enclosing file's total wall time or a rendering-performance benchmark.

| Historical report | This run's separately retained payload | Preservation |
| --- | --- | --- |
| [Assembly export](assembly-export-results.json) | [Fresh export results](evidence/history-selection/final/generated-reports/docs/assembly-export-results.json) | Historical bytes restored exactly; original backup and both hashes are retained. |
| [Boolean physics](boolean-physics-results.json) | [Fresh Boolean results](evidence/history-selection/final/generated-reports/docs/boolean-physics-results.json) | Historical bytes restored exactly; original backup and both hashes are retained. |

`restorationVerified` is true. These fresh payloads belong to this source snapshot; the older standalone files keep their prior timestamps/identities. Other standalone demo/Stewart/bench verification reports are not automatically remeasured merely because their related regression tests pass. The [current status](CURRENT-STATUS.md) links stage acceptance and remaining limitations.

## Complete file inventory

| Source file | Cases | Checking method |
| --- | ---: | --- |
| [actuator-bench.test.mjs](../artifacts/kineticad/tests/actuator-bench.test.mjs) | 7 | Real Rapier axial-force bench. |
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

## Every executed test

### actuator-bench.test.mjs

7 passing tests. Real Rapier axial-force bench. Independent Newtonian, momentum, energy and integration references; this does not cap the motors in ordinary CAD assemblies.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [capped axial force produces F/m acceleration with correct SI/mm conversion](../artifacts/kineticad/tests/actuator-bench.test.mjs#L13) | passed | 131.477 |
| [a rated motor holds gravity and an overloaded motor saturates and falls at Fmax/m − g](../artifacts/kineticad/tests/actuator-bench.test.mjs#L23) | passed | 37.682 |
| [free-base reaction conserves momentum and mass-weighted centre of mass](../artifacts/kineticad/tests/actuator-bench.test.mjs#L35) | passed | 24.346 |
| [lift reaches its target without ever exceeding the actuator force rating](../artifacts/kineticad/tests/actuator-bench.test.mjs#L40) | passed | 22.013 |
| [fixed-step partitioning is invariant and halving dt reduces overload position error](../artifacts/kineticad/tests/actuator-bench.test.mjs#L46) | passed | 12.447 |
| [travel cutoff stops before geometry crosses the base and is distinguished from modeled impact](../artifacts/kineticad/tests/actuator-bench.test.mjs#L53) | passed | 1.217 |
| [invalid configuration and step requests reject explicitly](../artifacts/kineticad/tests/actuator-bench.test.mjs#L57) | passed | 1.056 |

### assembly-export.test.mjs

7 passing tests. Actual shipped CAD worker and installed OCCT. Final Boolean/native STEP and STL geometry is checked against selected analytic solids; browser file-picker behavior is separate.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [union STEP and STL export final transformed Boolean plus visible independent part, omitting hidden sources](../artifacts/kineticad/tests/assembly-export.test.mjs#L84) | passed | 10566.975 |
| [subtract STEP and STL export final transformed Boolean plus visible independent part, omitting hidden sources](../artifacts/kineticad/tests/assembly-export.test.mjs#L84) | passed | 344.586 |
| [intersect STEP and STL export final transformed Boolean plus visible independent part, omitting hidden sources](../artifacts/kineticad/tests/assembly-export.test.mjs#L84) | passed | 225.581 |
| [Hide inputs off exports visible originals as well as result, preserving deliberate overlapping solids](../artifacts/kineticad/tests/assembly-export.test.mjs#L90) | passed | 578.620 |
| [disconnected Boolean compound exports every solid without restoring hidden originals](../artifacts/kineticad/tests/assembly-export.test.mjs#L96) | passed | 176.450 |
| [multiple visible Boolean results share immutable source geometry safely](../artifacts/kineticad/tests/assembly-export.test.mjs#L101) | passed | 418.669 |
| [invalid/empty output aborts; subsequent raw asset export and native feature chain remain intact](../artifacts/kineticad/tests/assembly-export.test.mjs#L108) | passed | 163.064 |

### assembly-simulation.test.mjs

10 passing tests. Pure assembly planning and identity policy. Checks finished-body inputs, material/ground decisions, attachment revisions and physics signatures; no solver execution in this file.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [Boolean source parts never become duplicate physical bodies for either Hide inputs setting](../artifacts/kineticad/tests/assembly-simulation.test.mjs#L14) | passed | 4.051 |
| [material inheritance uses the retained subtract body and requires uniform union/intersection inputs](../artifacts/kineticad/tests/assembly-simulation.test.mjs#L23) | passed | 1.302 |
| [unknown explicit result material fails instead of silently falling back to a default](../artifacts/kineticad/tests/assembly-simulation.test.mjs#L33) | passed | 0.124 |
| [result grounding is explicit; consumed/hidden input ground is not inherited or silently reassigned](../artifacts/kineticad/tests/assembly-simulation.test.mjs#L39) | passed | 1.846 |
| [an input reused by two finished Boolean bodies rejects ambiguous physical duplication](../artifacts/kineticad/tests/assembly-simulation.test.mjs#L47) | passed | 0.430 |
| [source joints are never migrated to new finished-body IDs or silently dropped](../artifacts/kineticad/tests/assembly-simulation.test.mjs#L52) | passed | 0.856 |
| [new result joints require an exact geometry revision and become stale after native or transform edits](../artifacts/kineticad/tests/assembly-simulation.test.mjs#L58) | passed | 6.185 |
| [material/rename changes retain result joint geometry hashes and its stable synthetic identity](../artifacts/kineticad/tests/assembly-simulation.test.mjs#L68) | passed | 0.800 |
| [native/Boolean identity collisions reject rather than replacing a source body](../artifacts/kineticad/tests/assembly-simulation.test.mjs#L77) | passed | 0.171 |
| [physical signatures exclude derived values and speed commands, while protecting geometry and joint structure](../artifacts/kineticad/tests/assembly-simulation.test.mjs#L82) | passed | 4.205 |

### beam-analysis.test.mjs

7 passing tests. Pure Euler–Bernoulli cantilever equations and eligibility/validity guards. An analytical calculator, not CAD deformation or general finite-element analysis.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [independent hand-calculated steel-like reference uses N/mm/GPa consistently](../artifacts/kineticad/tests/beam-analysis.test.mjs#L6) | passed | 1.562 |
| [curve satisfies clamped/free-end solution and intermediate hand reference](../artifacts/kineticad/tests/beam-analysis.test.mjs#L13) | passed | 0.419 |
| [load reversal reverses displacement/reactions and retains stress magnitude](../artifacts/kineticad/tests/beam-analysis.test.mjs#L19) | passed | 0.657 |
| [depth cubed, width, length cubed and modulus govern bending stiffness](../artifacts/kineticad/tests/beam-analysis.test.mjs#L25) | passed | 0.197 |
| [elastic, slenderness and small-deflection failures are explicit](../artifacts/kineticad/tests/beam-analysis.test.mjs#L32) | passed | 0.281 |
| [missing/nonfinite/nonpositive material or geometry and overflow reject](../artifacts/kineticad/tests/beam-analysis.test.mjs#L37) | passed | 0.857 |
| [eligible native dimensions respect sketch planes and exclude modified/imported/boolean shapes](../artifacts/kineticad/tests/beam-analysis.test.mjs#L42) | passed | 0.994 |

### bench-elapsed-clock.test.mjs

3 passing tests. Pure elapsed-time bookkeeping for the engineering UI. Controlled timestamps establish pause/reset and packet limits, not force or contact accuracy.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [a paused background tab earns no simulation time when resumed before its next animation frame](../artifacts/kineticad/tests/bench-elapsed-clock.test.mjs#L5) | passed | 1.838 |
| [delayed first play and ordinary paused frames cannot consume a short test window](../artifacts/kineticad/tests/bench-elapsed-clock.test.mjs#L17) | passed | 0.667 |
| [running cadence partitions retain elapsed time while repeated play calls do not reset the clock](../artifacts/kineticad/tests/bench-elapsed-clock.test.mjs#L31) | passed | 1.550 |

### boolean-bodies.test.mjs

10 passing tests. Real regeneration/cache orchestration with controlled CAD responses. Checks pending-call sharing, exact input identity, material scaling and rejection/retry; separate kernel tests establish solid geometry.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [concurrent physical preparations dispatch one exact ordered, immutable full-chain snapshot](../artifacts/kineticad/tests/boolean-bodies.test.mjs#L25) | passed | 5.343 |
| [material/display-only changes reuse unit-density properties without changing the geometric result](../artifacts/kineticad/tests/boolean-bodies.test.mjs#L42) | passed | 1.794 |
| [settled and pending body caches remain independent across CAD worker instances](../artifacts/kineticad/tests/boolean-bodies.test.mjs#L54) | passed | 3.833 |
| [native edits, imported asset identity, Boolean operation and exact sub-0.0001 transforms invalidate geometry](../artifacts/kineticad/tests/boolean-bodies.test.mjs#L63) | passed | 14.159 |
| [display cache and its valid compound mesh cannot certify a physical single-solid body](../artifacts/kineticad/tests/boolean-bodies.test.mjs#L86) | passed | 3.703 |
| [shared failures retain each caller name and later attempts retry instead of caching an error](../artifacts/kineticad/tests/boolean-bodies.test.mjs#L96) | passed | 1.149 |
| [explicit cache reset separates pending generations and prevents old completions overwriting fresh bodies](../artifacts/kineticad/tests/boolean-bodies.test.mjs#L104) | passed | 0.349 |
| [invalid input configuration fails with a named error before contacting CAD](../artifacts/kineticad/tests/boolean-bodies.test.mjs#L114) | passed | 1.072 |
| [preview regeneration shares pending operations, keeps worker-scoped settled results and retries failures](../artifacts/kineticad/tests/boolean-bodies.test.mjs#L126) | passed | 1.465 |
| [the shared argument builder preserves source arrays and supports canonical object-key order](../artifacts/kineticad/tests/boolean-bodies.test.mjs#L136) | passed | 0.755 |

### boolean-mate-store.test.mjs

9 passing tests. Actual Zustand document actions, project parsing and geometry hashes with controlled topology references. Checks material/ground defaults and stale Boolean attachments without remapping them.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [ground badges match explicit Boolean anchoring while preserving native-only first-part defaults](../artifacts/kineticad/tests/boolean-mate-store.test.mjs#L42) | passed | 2.387 |
| [creating or importing a part preserves an explicitly free Boolean assembly](../artifacts/kineticad/tests/boolean-mate-store.test.mjs#L51) | passed | 2.794 |
| [native creation/import retain default promotion and preserve an already selected ground](../artifacts/kineticad/tests/boolean-mate-store.test.mjs#L62) | passed | 2.322 |
| [legacy v8/v9 migration preserves free Boolean worlds and the native-only ground default](../artifacts/kineticad/tests/boolean-mate-store.test.mjs#L77) | passed | 2.221 |
| [actual Apply persists picked result IDs and geometry revision through Save/parse and Edit](../artifacts/kineticad/tests/boolean-mate-store.test.mjs#L93) | passed | 10.129 |
| [geometry changed between picking and Apply rejects creation without relabelling the old attachment](../artifacts/kineticad/tests/boolean-mate-store.test.mjs#L106) | passed | 0.619 |
| [name-only or motor-only Apply cannot revive a stale saved mate without repicking its geometry](../artifacts/kineticad/tests/boolean-mate-store.test.mjs#L114) | passed | 2.666 |
| [an unchanged attachment permits normal edits while a missing geometry snapshot is rejected](../artifacts/kineticad/tests/boolean-mate-store.test.mjs#L127) | passed | 0.883 |
| [deleting an input cascades through result joints while retaining unrelated native joints](../artifacts/kineticad/tests/boolean-mate-store.test.mjs#L138) | passed | 1.080 |

### boolean-physics.test.mjs

15 passing tests. Actual OCCT and shipped Comlink/Rapier workers. Independent Boolean cuboid volume/COM/tensor references, units, freefall, equal force, grounded and joint behavior; selected connected solids only.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [union-identity: final solid mesh, volume, COM and all tensor components agree with independent geometry](../artifacts/kineticad/tests/boolean-physics.test.mjs#L141) | passed | 9378.452 |
| [subtract-identity: final solid mesh, volume, COM and all tensor components agree with independent geometry](../artifacts/kineticad/tests/boolean-physics.test.mjs#L141) | passed | 107.689 |
| [intersect-identity: final solid mesh, volume, COM and all tensor components agree with independent geometry](../artifacts/kineticad/tests/boolean-physics.test.mjs#L141) | passed | 82.697 |
| [off-centre-cut-identity: final solid mesh, volume, COM and all tensor components agree with independent geometry](../artifacts/kineticad/tests/boolean-physics.test.mjs#L141) | passed | 87.206 |
| [union-mixed-rotation: final solid mesh, volume, COM and all tensor components agree with independent geometry](../artifacts/kineticad/tests/boolean-physics.test.mjs#L141) | passed | 98.900 |
| [subtract-mixed-rotation: final solid mesh, volume, COM and all tensor components agree with independent geometry](../artifacts/kineticad/tests/boolean-physics.test.mjs#L141) | passed | 78.933 |
| [intersect-mixed-rotation: final solid mesh, volume, COM and all tensor components agree with independent geometry](../artifacts/kineticad/tests/boolean-physics.test.mjs#L141) | passed | 71.774 |
| [off-centre-cut-mixed-rotation: final solid mesh, volume, COM and all tensor components agree with independent geometry](../artifacts/kineticad/tests/boolean-physics.test.mjs#L141) | passed | 62.575 |
| [empty and disconnected Boolean bodies reject while ordinary Boolean compounds and later valid calls remain usable](../artifacts/kineticad/tests/boolean-physics.test.mjs#L168) | passed | 137.604 |
| [sub-four-decimal input translation changes final mesh and exact properties instead of reusing rounded geometry](../artifacts/kineticad/tests/boolean-physics.test.mjs#L182) | passed | 191.304 |
| [a transformed imported STEP source and native cutter produce the analytic final body without changing the registered source](../artifacts/kineticad/tests/boolean-physics.test.mjs#L193) | passed | 779.715 |
| [actual Boolean bodies fall with mass-independent gravity using their baked world geometry once](../artifacts/kineticad/tests/boolean-physics.test.mjs#L262) | passed | 78.441 |
| [equal COM forces measure acceleration from each final Boolean mass without adding torque](../artifacts/kineticad/tests/boolean-physics.test.mjs#L283) | passed | 62.765 |
| [grounded Boolean stays fixed, zero-time readback pauses, and rebuilding restores original poses](../artifacts/kineticad/tests/boolean-physics.test.mjs#L314) | passed | 3.901 |
| [passive hinged Boolean follows its anisotropic final inertia and improves with timestep refinement](../artifacts/kineticad/tests/boolean-physics.test.mjs#L345) | passed | 33.188 |

### boolean-result-picking.test.mjs

9 passing tests. Actual Three.js transforms and production topology picker/result layer with controlled CAD/DOM collaborators. Checks result-body identity and attachment eligibility; no browser rendering or new OCCT measurement.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [result body IDs and material inference preserve native frames without remapping inputs](../artifacts/kineticad/tests/boolean-result-picking.test.mjs#L36) | passed | 2.842 |
| [Boolean layer exposes identity mesh/topology/current hash and changes material without geometry regeneration](../artifacts/kineticad/tests/boolean-result-picking.test.mjs#L58) | passed | 14.799 |
| [source edits invalidate result picking immediately and older async geometry cannot replace the current revision](../artifacts/kineticad/tests/boolean-result-picking.test.mjs#L82) | passed | 12.972 |
| [reverting an in-flight result edit restores complete cached topology; late failure and disposed results stay unavailable](../artifacts/kineticad/tests/boolean-result-picking.test.mjs#L100) | passed | 2.752 |
| [disconnected or unverified Boolean meshes remain visible but cannot supply mate topology or attachment hashes](../artifacts/kineticad/tests/boolean-result-picking.test.mjs#L111) | passed | 4.220 |
| [attachment hashes capture only the actual picked revision and preserve the opposite body snapshot](../artifacts/kineticad/tests/boolean-result-picking.test.mjs#L124) | passed | 3.271 |
| [edge proximity and hover follow the full native XYZ transform instead of its old local position](../artifacts/kineticad/tests/boolean-result-picking.test.mjs#L177) | passed | 5.738 |
| [native transformed face hover is world-correct and two-click point picking retains local face UV](../artifacts/kineticad/tests/boolean-result-picking.test.mjs#L190) | passed | 3.173 |
| [world-baked Boolean face picks use stable body IDs once and are excluded outside mate editing](../artifacts/kineticad/tests/boolean-result-picking.test.mjs#L205) | passed | 4.056 |

### cad-operations.test.mjs

11 passing tests. Actual installed OCCT and production sketch/solid operations. Independent geometry references and invalid-input checks cover selected extrude/revolve/fillet/chamfer/hole/Boolean cases.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [XY extrude forward/backward/symmetric preserves exact dimensions, centre and detached mesh](../artifacts/kineticad/tests/cad-operations.test.mjs#L60) | passed | 8098.831 |
| [XZ extrude forward/backward/symmetric preserves exact dimensions, centre and detached mesh](../artifacts/kineticad/tests/cad-operations.test.mjs#L60) | passed | 86.291 |
| [YZ extrude forward/backward/symmetric preserves exact dimensions, centre and detached mesh](../artifacts/kineticad/tests/cad-operations.test.mjs#L60) | passed | 91.650 |
| [quarter-turn revolve keeps analytical annular-sector volume and centroid](../artifacts/kineticad/tests/cad-operations.test.mjs#L85) | passed | 88.394 |
| [single-edge fillet removes square-minus-quarter-circle volume and leaves its input unchanged](../artifacts/kineticad/tests/cad-operations.test.mjs#L97) | passed | 258.553 |
| [single-edge chamfer removes an exact triangular prism and leaves its input unchanged](../artifacts/kineticad/tests/cad-operations.test.mjs#L107) | passed | 46.880 |
| [all six face pick bases drill inward for blind holes and span the correct dimension for through holes](../artifacts/kineticad/tests/cad-operations.test.mjs#L117) | passed | 1164.457 |
| [Boolean union matches overlapping-box volume and preserves both input solids](../artifacts/kineticad/tests/cad-operations.test.mjs#L142) | passed | 103.047 |
| [Boolean subtract matches overlapping-box volume and preserves both input solids](../artifacts/kineticad/tests/cad-operations.test.mjs#L142) | passed | 66.512 |
| [Boolean intersect matches overlapping-box volume and preserves both input solids](../artifacts/kineticad/tests/cad-operations.test.mjs#L142) | passed | 60.378 |
| [invalid dimensions, missing picks, non-solid inputs and empty booleans fail without consuming originals](../artifacts/kineticad/tests/cad-operations.test.mjs#L153) | passed | 30.642 |

### contact-bench.test.mjs

9 passing tests. Actual Rapier cuboid contact experiment. Coulomb, momentum, work/energy and timestep comparisons are scoped to this guided bench, not arbitrary CAD contacts.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [step zero reads the actual initial body without advancing, and disposal prevents further use](../artifacts/kineticad/tests/contact-bench.test.mjs#L14) | passed | 71.090 |
| [resting cuboid has measured contact support equal to weight, without horizontal force](../artifacts/kineticad/tests/contact-bench.test.mjs#L27) | passed | 63.888 |
| [frictionless contact preserves horizontal velocity and kinetic energy while supporting weight](../artifacts/kineticad/tests/contact-bench.test.mjs#L39) | passed | 32.147 |
| [Coulomb sliding stops within the fixed-step integration bound and contact impulses match momentum](../artifacts/kineticad/tests/contact-bench.test.mjs#L49) | passed | 19.922 |
| [halving the timestep converges in stopping distance and penetration at 60, 120 and 240 Hz](../artifacts/kineticad/tests/contact-bench.test.mjs#L71) | passed | 31.899 |
| [material mass changes support force but not Coulomb deceleration; increasing friction shortens travel](../artifacts/kineticad/tests/contact-bench.test.mjs#L84) | passed | 11.456 |
| [accumulated frame partitions produce the same body state as a single elapsed-time request](../artifacts/kineticad/tests/contact-bench.test.mjs#L91) | passed | 5.031 |
| [airborne and impact phases disable the continuous-support reference](../artifacts/kineticad/tests/contact-bench.test.mjs#L104) | passed | 4.632 |
| [invalid physical inputs and elapsed time are rejected](../artifacts/kineticad/tests/contact-bench.test.mjs#L115) | passed | 1.781 |

### crank-slider-cad.test.mjs

2 passing tests. Actual OCCT native feature chains and interference operations, with independent geometry/envelope references. Body/pair/sample counts inside these tests are not extra tests.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [all domain vertices and the default produce four exact valid CAD solids with no sampled interference](../artifacts/kineticad/tests/crank-slider-cad.test.mjs#L10) | passed | 26829.108 |
| [continuous rigid-geometry clearances hold across the admitted parameter domain](../artifacts/kineticad/tests/crank-slider-cad.test.mjs#L44) | passed | 0.450 |

### crank-slider-kinematics.test.mjs

4 passing tests. Pure factory/closure and independent analytical kinematics. Checks bounds, anchors and signed motion; reference equations alone do not prove solver behavior.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [native crank-slider factory is deterministic, closed and has exactly one drive](../artifacts/kineticad/tests/crank-slider-kinematics.test.mjs#L5) | passed | 7.009 |
| [reference matches independent circle/link closure and numerical time derivatives throughout the admitted domain](../artifacts/kineticad/tests/crank-slider-kinematics.test.mjs#L22) | passed | 7.444 |
| [zero/reverse RPM and nonconstant angular-speed chain rule have explicit reference semantics](../artifacts/kineticad/tests/crank-slider-kinematics.test.mjs#L36) | passed | 0.750 |
| [invalid dimensions, near-toggle rod ratios and nonfinite controls are rejected](../artifacts/kineticad/tests/crank-slider-kinematics.test.mjs#L50) | passed | 2.482 |

### crank-slider-physics.test.mjs

2 passing tests. Actual shipped Rapier worker using source-and-geometry-validated exact-CAD descriptors. Independent trajectory comparisons and timestep/partition checks; cached descriptors may be reused, so each scenario is not necessarily a fresh OCCT rebuild.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [actual CAD crank-slider follows independent closed-loop kinematics with forward, reverse, zero and extreme settings](../artifacts/kineticad/tests/crank-slider-physics.test.mjs#L25) | passed | 2388.921 |
| [per-world solver settings reject invalid worlds, govern live motors and reset to legacy defaults](../artifacts/kineticad/tests/crank-slider-physics.test.mjs#L119) | passed | 340.106 |

### crank-slider-readout.test.mjs

14 passing tests. Pure processing of explicit measured-pose/velocity fixtures and the actual measurement store. Checks the reported interval and reference semantics; fixtures are not newly measured motion.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [actual positions, velocities, angle and RPM remain independent from the nominal reference](../artifacts/kineticad/tests/crank-slider-readout.test.mjs#L23) | passed | 2.579 |
| [mean acceleration uses independent measured speed samples and their actual interval](../artifacts/kineticad/tests/crank-slider-readout.test.mjs#L37) | passed | 0.274 |
| [reference interval acceleration is the mean velocity change, not point acceleration](../artifacts/kineticad/tests/crank-slider-readout.test.mjs#L48) | passed | 0.437 |
| [missing actual poses or body velocity readbacks never fabricate a sample](../artifacts/kineticad/tests/crank-slider-readout.test.mjs#L58) | passed | 1.637 |
| [nonfinite measurements, invalid clocks and degenerate quaternions are unavailable](../artifacts/kineticad/tests/crank-slider-readout.test.mjs#L73) | passed | 0.193 |
| [duplicate, backward and invalid previous clocks cannot create interval acceleration](../artifacts/kineticad/tests/crank-slider-readout.test.mjs#L89) | passed | 0.205 |
| [quaternion scale and sign do not change measured angle or mutate worker readbacks](../artifacts/kineticad/tests/crank-slider-readout.test.mjs#L105) | passed | 1.462 |
| [zero/reverse nominal RPM affects only the reference, never clamps measured motion](../artifacts/kineticad/tests/crank-slider-readout.test.mjs#L116) | passed | 0.214 |
| [a reset remains detectable even if React observes only the next nonempty run snapshot](../artifacts/kineticad/tests/crank-slider-readout.test.mjs#L128) | passed | 0.923 |
| [pose publication preserves actual readbacks and leaves zero-step or missing-body data unmeasured](../artifacts/kineticad/tests/crank-slider-readout.test.mjs#L145) | passed | 1.369 |
| [interval selection includes the exact 1/30 s boundary and only its declared roundoff tolerance](../artifacts/kineticad/tests/crank-slider-readout.test.mjs#L160) | passed | 0.305 |
| [the final frame selects the latest sufficiently old actual sample, independent of array order](../artifacts/kineticad/tests/crank-slider-readout.test.mjs#L169) | passed | 0.560 |
| [empty or restarted histories and invalid/backward clocks yield no acceleration endpoint](../artifacts/kineticad/tests/crank-slider-readout.test.mjs#L180) | passed | 0.082 |
| [nonfinite sample values are skipped without substituting a theoretical or corrupt endpoint](../artifacts/kineticad/tests/crank-slider-readout.test.mjs#L191) | passed | 0.910 |

### crank-slider-workspace.test.mjs

7 passing tests. Real project/demo parsers and Zustand with memory storage. Checks native metadata, canonical configuration and protected-workspace ownership; storage adapters do not establish a browser reload.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [generated workspace is fresh, stopped and contains only its validated experiment](../artifacts/kineticad/tests/crank-slider-workspace.test.mjs#L17) | passed | 7.453 |
| [demo parser and actual Save/project parser retain adjustable parameters and native history](../artifacts/kineticad/tests/crank-slider-workspace.test.mjs#L37) | passed | 18.395 |
| [physical assembly guard tolerates cosmetic names, computed fields and object-key order](../artifacts/kineticad/tests/crank-slider-workspace.test.mjs#L55) | passed | 1.849 |
| [manual geometry, frame, material, visibility and joint edits disable parameter replacement](../artifacts/kineticad/tests/crank-slider-workspace.test.mjs#L71) | passed | 8.939 |
| [reference guard rejects changed gravity, timing and stale experiment controllers](../artifacts/kineticad/tests/crank-slider-workspace.test.mjs#L95) | passed | 2.864 |
| [invalid adjustable metadata rejects before a document can replace the workspace](../artifacts/kineticad/tests/crank-slider-workspace.test.mjs#L108) | passed | 6.301 |
| [parameter changes and Save remain isolated, then restore original live imported references](../artifacts/kineticad/tests/crank-slider-workspace.test.mjs#L119) | passed | 8.588 |

### demos.test.mjs

6 passing tests. Fixture parsing, demo-session behavior and real Zustand with memory persistence. Covers content/ownership/loader paths, not six new dynamic measurements.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [all bundled examples load and reference existing parts](../artifacts/kineticad/tests/demos.test.mjs#L12) | passed | 24.071 |
| [asset paths work at the Replit /app base and a local root](../artifacts/kineticad/tests/demos.test.mjs#L16) | passed | 0.554 |
| [force experiment survives document parsing and rejects invalid target references](../artifacts/kineticad/tests/demos.test.mjs#L22) | passed | 2.425 |
| [invalid and unsupported documents fail before entering a workspace](../artifacts/kineticad/tests/demos.test.mjs#L29) | passed | 4.769 |
| [editing and playing multiple demos never overwrite the original project](../artifacts/kineticad/tests/demos.test.mjs#L65) | passed | 9.493 |
| [a second visit captures the newly edited original and begins stopped](../artifacts/kineticad/tests/demos.test.mjs#L84) | passed | 1.005 |

### desktop-support.test.mjs

9 passing tests. Pure desktop-support policy using supplied device/capability inputs. Does not establish performance or compatibility on every accepted desktop.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [known phone UAs are blocked independently of their pointer reports](../artifacts/kineticad/tests/desktop-support.test.mjs#L10) | passed | 1.624 |
| [tablet UAs without the word Mobile remain blocked](../artifacts/kineticad/tests/desktop-support.test.mjs#L22) | passed | 0.242 |
| [desktop-mode iPadOS is blocked via Macintosh or MacIntel identity plus touch](../artifacts/kineticad/tests/desktop-support.test.mjs#L34) | passed | 0.273 |
| [attaching a mouse does not allow a known phone or tablet to enter CAD](../artifacts/kineticad/tests/desktop-support.test.mjs#L41) | passed | 0.060 |
| [coarse-only touch devices are blocked even with a desktop-like or unknown UA](../artifacts/kineticad/tests/desktop-support.test.mjs#L47) | passed | 0.069 |
| [touch-capable Windows laptops with a fine pointer remain supported](../artifacts/kineticad/tests/desktop-support.test.mjs#L52) | passed | 0.581 |
| [ordinary macOS, Windows and Linux desktop pointers remain supported](../artifacts/kineticad/tests/desktop-support.test.mjs#L58) | passed | 0.134 |
| [narrow desktop windows and browser zoom are not mobile-device signals](../artifacts/kineticad/tests/desktop-support.test.mjs#L64) | passed | 0.068 |
| [detection is pure and optional platform/touch values do not reject a desktop](../artifacts/kineticad/tests/desktop-support.test.mjs#L70) | passed | 1.079 |

### document-history.test.mjs

6 passing tests. Actual history controller and bounded serialized-entry engine, with deferred restore preparation and an explicit host adapter. Exercises failure/race order without OCCT, a browser or timing sleeps.

| Test / exact source declaration | Status | Duration (ms) | Purpose |
| --- | --- | ---: | --- |
| [failed preparation preserves source and stack, releases busy state and permits a successful retry](../artifacts/kineticad/tests/document-history.test.mjs#L19) | passed | 5.265 | Keep a failed STEP preparation from consuming the Undo entry or exposing the target; release busy state and allow a successful retry. |
| [a document edit during pending preparation cannot be overwritten by an old Undo result](../artifacts/kineticad/tests/document-history.test.mjs#L31) | passed | 1.294 | Reject a late Undo result after a newer document edit, preserving the newer source and stack order. |
| [replacement by an identical-looking loaded project invalidates pending history and gesture tokens](../artifacts/kineticad/tests/document-history.test.mjs#L38) | passed | 0.522 | Treat a byte-identical Load as a new document owner and invalidate earlier gesture tokens. |
| [opening and then closing an editor or navigating invalidates a pending restore even when the model is unchanged](../artifacts/kineticad/tests/document-history.test.mjs#L46) | passed | 0.803 | Invalidate an outstanding restore if an editor opens/closes or the user navigates away and back during preparation. |
| [overlapping Undo calls and a newly started operation cannot publish partial or out-of-order restores](../artifacts/kineticad/tests/document-history.test.mjs#L56) | passed | 0.485 | Allow only one restore at a time, and reject its result if a new operation starts before publication. |
| [history entry and byte limits evict whole oldest records, with retained Undo/Redo order intact](../artifacts/kineticad/tests/document-history.test.mjs#L65) | passed | 0.389 | Evict complete oldest records under entry/byte limits; retain valid stack order and preserve Redo across no-ops. |

### engineering-bench-worker.test.mjs

3 passing tests. Actual Comlink engineering worker and real Rapier bench modules. The Node message endpoint replaces the browser worker endpoint; initialization, queueing, switching and teardown are exercised.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [real Comlink worker serializes initial asynchronous build before zero-time and advancing calls](../artifacts/kineticad/tests/engineering-bench-worker.test.mjs#L23) | passed | 426.782 |
| [queued actuator step, contact rebuild and contact step remain FIFO and reset the physical world](../artifacts/kineticad/tests/engineering-bench-worker.test.mjs#L32) | passed | 44.481 |
| [invalid build rejects and clears the previous world without poisoning subsequent queued rebuilds](../artifacts/kineticad/tests/engineering-bench-worker.test.mjs#L44) | passed | 16.440 |

### feature-regen.test.mjs

13 passing tests. Production feature/part regeneration and caches with controlled CAD responses. Verifies dispatch, full-chain identity, lifecycle and density-cache behavior; no replacement response is described as an OCCT solid.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [concurrent scene regenerations dispatch one operation per matching cold feature](../artifacts/kineticad/tests/feature-regen.test.mjs#L34) | passed | 5.033 |
| [pending operations on different kernel instances remain independent](../artifacts/kineticad/tests/feature-regen.test.mjs#L50) | passed | 1.394 |
| [changed feature parameters do not join an older in-flight operation](../artifacts/kineticad/tests/feature-regen.test.mjs#L66) | passed | 1.063 |
| [shared failures reach every caller and a later request retries the worker](../artifacts/kineticad/tests/feature-regen.test.mjs#L80) | passed | 2.437 |
| [clearing the cache separates pending work and rejects late cache repopulation](../artifacts/kineticad/tests/feature-regen.test.mjs#L101) | passed | 1.519 |
| [concurrent chains share each stage and preview uses the same full upstream hash](../artifacts/kineticad/tests/feature-regen.test.mjs#L125) | passed | 33.088 |
| [display regeneration sends one complete chain and caches its exact final-feature hash](../artifacts/kineticad/tests/feature-regen.test.mjs#L145) | passed | 2.564 |
| [display cache invalidates when an upstream feature or source sketch changes](../artifacts/kineticad/tests/feature-regen.test.mjs#L165) | passed | 0.750 |
| [full-chain rejection reaches all display callers and retries without a poisoned cache](../artifacts/kineticad/tests/feature-regen.test.mjs#L179) | passed | 0.406 |
| [unit-density mass data warms the cache and material/pose changes need no CAD rebuild](../artifacts/kineticad/tests/feature-regen.test.mjs#L197) | passed | 1.331 |
| [unmodified STEP uses its live mesh; modified STEP dispatches its intact full history](../artifacts/kineticad/tests/feature-regen.test.mjs#L222) | passed | 0.372 |
| [a late full-chain result cannot repopulate mesh or physical caches after clear](../artifacts/kineticad/tests/feature-regen.test.mjs#L241) | passed | 0.091 |
| [a final-feature preview cannot hide an invalid earlier history from display regeneration](../artifacts/kineticad/tests/feature-regen.test.mjs#L256) | passed | 0.182 |

### force-measurements.test.mjs

3 passing tests. Pure force-readout reduction and actual measurement state using explicit velocity/time fixtures. Independent acceleration comes from delta velocity over actual elapsed time; this is not another force simulation.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [display measures acceleration from solver readback even when it disagrees with F/m](../artifacts/kineticad/tests/force-measurements.test.mjs#L13) | passed | 1.523 |
| [measurement uses consecutive actual simulation timestamps and holds at completion](../artifacts/kineticad/tests/force-measurements.test.mjs#L20) | passed | 0.372 |
| [new runs clear prior readings and missing measurements cannot look successful](../artifacts/kineticad/tests/force-measurements.test.mjs#L29) | passed | 0.932 |

### force-physics.test.mjs

6 passing tests. Actual shipped Comlink/Rapier worker with analytic body descriptors. Equal-force/different-mass, gravity, fixed duration, partitioning and invalid-world cases check units and dynamics.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [equal newton forces yield measured inverse-mass acceleration on unpowered prismatic sliders](../artifacts/kineticad/tests/force-physics.test.mjs#L33) | passed | 509.790 |
| [doubling force and mass preserves measured acceleration and motion](../artifacts/kineticad/tests/force-physics.test.mjs#L75) | passed | 26.493 |
| [world-space COM force adds to gravity without creating torque on an offset, rotated body](../artifacts/kineticad/tests/force-physics.test.mjs#L88) | passed | 11.245 |
| [duration cap and force motion are invariant to elapsed-time partitions, including capped catch-up](../artifacts/kineticad/tests/force-physics.test.mjs#L103) | passed | 90.383 |
| [zero requests pause a forced run and rebuilding removes its cap and persistent forces](../artifacts/kineticad/tests/force-physics.test.mjs#L125) | passed | 3.545 |
| [invalid force vectors, duplicate/fixed/missing targets and invalid caps reject the whole world](../artifacts/kineticad/tests/force-physics.test.mjs#L145) | passed | 12.277 |

### four-bar-assembly.test.mjs

4 passing tests. Pure native factory, anchor/envelope arithmetic and real Three.js frame transforms. Checks construction contracts; actual solids and sampled interference belong to the separate CAD file.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [native four-bar factory creates four connected-history bodies and only one driven revolute](../artifacts/kineticad/tests/four-bar-assembly.test.mjs#L8) | passed | 3.607 |
| [every local joint anchor agrees with independent closure in both branches and arbitrary placement](../artifacts/kineticad/tests/four-bar-assembly.test.mjs#L21) | passed | 6.197 |
| [authored plate/pin envelopes match the continuous rigid-geometry clearance proof](../artifacts/kineticad/tests/four-bar-assembly.test.mjs#L35) | passed | 0.947 |
| [near-zero tracing arms are omitted inside the existing solid; invalid geometry cannot be generated](../artifacts/kineticad/tests/four-bar-assembly.test.mjs#L56) | passed | 0.944 |

### four-bar-cad.test.mjs

1 passing test. Actual OCCT rebuilds of selected four-bar feature chains, marker-material probes and sampled exact intersections. Conservative full-cycle envelope reasoning is separate from finite OCCT sampling.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [seven native four-bar geometries are valid single solids with supported tracing points and zero sampled interference](../artifacts/kineticad/tests/four-bar-cad.test.mjs#L11) | passed | 34842.345 |

### four-bar-kinematics.test.mjs

5 passing tests. Pure circle-intersection closure, branch, bounds, whole-cycle and independent derivative references. Does not prescribe any solver body pose.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [four-bar circle intersection has an independent exact coordinate fixture and both branches](../artifacts/kineticad/tests/four-bar-kinematics.test.mjs#L9) | passed | 2.205 |
| [complete rotations preserve all link lengths, branch sign and continuous clearance bounds](../artifacts/kineticad/tests/four-bar-kinematics.test.mjs#L19) | passed | 39.603 |
| [implicit velocity and acceleration agree with independent finite differences and chain rule](../artifacts/kineticad/tests/four-bar-kinematics.test.mjs#L33) | passed | 5.826 |
| [placement transforms once and a complete cycle returns the same geometry](../artifacts/kineticad/tests/four-bar-kinematics.test.mjs#L47) | passed | 0.983 |
| [Grashof equality, lost closure, small transmission angle, markers and invalid fields reject](../artifacts/kineticad/tests/four-bar-kinematics.test.mjs#L55) | passed | 1.460 |

### four-bar-physics.test.mjs

1 passing test. Actual shipped Rapier worker, source/geometry-validated exact-CAD descriptors and an independent closure reference. Thirty-four scenarios, signed branches/speeds, refinement and packet timing remain measurements within one test, not 34 extra test cases.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [actual CAD four-bar follows independent coupler geometry through complete forward/reverse cycles and both branches](../artifacts/kineticad/tests/four-bar-physics.test.mjs#L18) | passed | 7940.212 |

### four-bar-preflight.test.mjs

4 passing tests. Production build preflight with controlled CAD/mass promises. Checks incomplete geometry, invalid mass and stale source rejection; the worker-CAD test separately executes the real kernel boundary.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [four-bar project retains its drawing and rejects corrupt metadata before loading](../artifacts/kineticad/tests/four-bar-preflight.test.mjs#L13) | passed | 42.194 |
| [four-bar preflight checks every full feature chain without mutating the document](../artifacts/kineticad/tests/four-bar-preflight.test.mjs#L20) | passed | 15.860 |
| [four-bar preflight rejects failed geometry, invalid mesh and missing or invalid mass properties](../artifacts/kineticad/tests/four-bar-preflight.test.mjs#L27) | passed | 61.607 |
| [four-bar stale model detection after a delayed CAD response prevents the next part building](../artifacts/kineticad/tests/four-bar-preflight.test.mjs#L33) | passed | 4.544 |

### four-bar-readout.test.mjs

5 passing tests. Pure calculation from explicit body poses and independent linkage references. Checks actual-material-point coordinates, nominal versus measured-angle comparisons and invalid samples; no new physical run.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [four-bar readout transforms the actual material point under both branches, placement and motor directions](../artifacts/kineticad/tests/four-bar-readout.test.mjs#L8) | passed | 8.359 |
| [perturbed solver coordinates remain visible and cannot be replaced by predicted positions](../artifacts/kineticad/tests/four-bar-readout.test.mjs#L18) | passed | 1.724 |
| [measured-angle reference and nominal motor schedule disclose phase lag separately](../artifacts/kineticad/tests/four-bar-readout.test.mjs#L28) | passed | 0.776 |
| [missing, duplicate, nonfinite or invalid poses yield no invented path sample](../artifacts/kineticad/tests/four-bar-readout.test.mjs#L34) | passed | 0.943 |
| [normalizing valid quaternion scale/sign preserves measured points without mutating snapshots](../artifacts/kineticad/tests/four-bar-readout.test.mjs#L44) | passed | 2.761 |

### four-bar-search-worker.test.mjs

2 passing tests. Actual production search worker through a Node message endpoint. Verifies real progress, completion, termination and invalid input; no CAD or Rapier world is used.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [production search worker delivers provisional progress and a separately recomputable ellipse fit](../artifacts/kineticad/tests/four-bar-search-worker.test.mjs#L16) | passed | 7340.461 |
| [terminating a running search cancels it before a result; a fresh worker rejects invalid input clearly](../artifacts/kineticad/tests/four-bar-search-worker.test.mjs#L36) | passed | 491.024 |

### four-bar-synthesis.test.mjs

6 passing tests. Pure bounded deterministic optimisation and target validation. Includes a held-out non-preset path and complete-loop metrics; the search is not a proven global optimum or exact fit for every outline.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [closed target validation rejects crossings, open paths, retracing, tiny/huge and nonfinite data](../artifacts/kineticad/tests/four-bar-synthesis.test.mjs#L6) | passed | 5.411 |
| [arc-length resampling is independent of drawing speed and duplicated collinear vertices](../artifacts/kineticad/tests/four-bar-synthesis.test.mjs#L16) | passed | 0.710 |
| [known mechanism paths have a declared source, while an ellipse remains an approximation](../artifacts/kineticad/tests/four-bar-synthesis.test.mjs#L22) | passed | 478.043 |
| [complete-cycle score allows cyclic start/reversal but cannot match a displaced or partial target for free](../artifacts/kineticad/tests/four-bar-synthesis.test.mjs#L32) | passed | 255.563 |
| [seeded search is deterministic, reports real monotone progress and supports cancellation](../artifacts/kineticad/tests/four-bar-synthesis.test.mjs#L42) | passed | 297.982 |
| [default search fits a nonpreset independently supplied mechanism path without receiving its parameters](../artifacts/kineticad/tests/four-bar-synthesis.test.mjs#L53) | passed | 6685.596 |

### four-bar-worker-cad.test.mjs

1 passing test. Actual shipped CAD worker and native preflight. Selected bodies compare to independent exact-volume integrals and separately rebuilt mass/frame references; disconnected geometry must reject.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [shipped CAD worker preflight returns one solid per factory body and exact independently integrated bed/link volumes](../artifacts/kineticad/tests/four-bar-worker-cad.test.mjs#L25) | passed | 15424.444 |

### four-bar-workspace.test.mjs

9 passing tests. Real native/project/demo parsing and canonical-identity checks with memory persistence. Includes an actual saved Chrome DTO as input and tight roundoff-only matching; reading that fixture is not a new browser interaction.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [four-bar document is fresh, stopped, isolated from the input and limited to the validated cycle profile](../artifacts/kineticad/tests/four-bar-workspace.test.mjs#L16) | passed | 7.601 |
| [native Save/project and demo parsers retain four-bar target, seed, branch, placement and complete feature histories](../artifacts/kineticad/tests/four-bar-workspace.test.mjs#L24) | passed | 21.943 |
| [cosmetic names and derived caches do not disable a physically unchanged saved four-bar](../artifacts/kineticad/tests/four-bar-workspace.test.mjs#L33) | passed | 2.561 |
| [manual geometry, transforms, materials, visibility, ground or joint changes disable generated reference claims](../artifacts/kineticad/tests/four-bar-workspace.test.mjs#L39) | passed | 11.985 |
| [reference profile rejects altered gravity, fixed step, duration, manual-edit marker and other experiment controllers](../artifacts/kineticad/tests/four-bar-workspace.test.mjs#L44) | passed | 3.801 |
| [invalid loaded design metadata rejects before replacing a workspace](../artifacts/kineticad/tests/four-bar-workspace.test.mjs#L50) | passed | 8.916 |
| [multiple generated builds and native Save preserve original persistence and live STEP references until return](../artifacts/kineticad/tests/four-bar-workspace.test.mjs#L56) | passed | 4.995 |
| [actual Chrome native Save is canonical despite platform transcendental rounding](../artifacts/kineticad/tests/four-bar-workspace.test.mjs#L67) | passed | 1.477 |
| [roundoff matching preserves exact structure and rejects tiny meaningful edits and nonfinite values](../artifacts/kineticad/tests/four-bar-workspace.test.mjs#L76) | passed | 6.515 |

### history-store.test.mjs

12 passing tests. Actual singleton Zustand actions, production history and project packaging. Imported STEP bytes and fingerprints are real persistence inputs, while only the CAD import endpoint is controlled; no new solid reconstruction is claimed here.

| Test / exact source declaration | Status | Duration (ms) | Purpose |
| --- | --- | ---: | --- |
| [Undo and Redo restore a cascading part/Boolean/joint/ground deletion in one atomic document publication](../artifacts/kineticad/tests/history-store.test.mjs#L44) | passed | 8.128 | Restore source parts, dependent Boolean, both affected joint types and explicit result ground in one assembly publication. |
| [invalid/no-op actions preserve Redo, while a new successful document edit branches it](../artifacts/kineticad/tests/history-store.test.mjs#L73) | passed | 4.812 | Keep invalid/no-op actions out of history, preserve their Redo branch, and replace that branch only after a successful new edit. |
| [a transform gesture groups all pose samples into one step and copies caller arrays](../artifacts/kineticad/tests/history-store.test.mjs#L101) | passed | 2.531 | Group twenty pose updates plus the final sample into one Undo entry, without retaining mutable caller arrays. |
| [nested transforms and cancellation preserve the preceding edit and the previous Redo branch](../artifacts/kineticad/tests/history-store.test.mjs#L115) | passed | 2.523 | Require nested gestures to finish in order; cancel to the original document without consuming prior Redo or recording zero motion. |
| [selection, preview, picker, simulation frames and derived mass writes do not create history](../artifacts/kineticad/tests/history-store.test.mjs#L135) | passed | 1.677 | Exclude selection, picker, previews, solver time and derived mass writes; Undo restores source data and stops/zeros motion. |
| [feature and sketch drafts add no history, while each committed source edit restores its exact stable IDs](../artifacts/kineticad/tests/history-store.test.mjs#L154) | passed | 3.609 | Exclude cancelled feature/sketch drafts; restore the exact committed feature/sketch IDs on Undo/Redo. |
| [part duplication retains unique remapped feature/sketch IDs through Undo and Redo without mutating its source](../artifacts/kineticad/tests/history-store.test.mjs#L178) | passed | 1.612 | Keep duplicate sketch/feature IDs unique and correctly remapped, with an independent transform and stable Redo identity. |
| [editors, geometry rebuilds and overlapping operations block history without consuming it](../artifacts/kineticad/tests/history-store.test.mjs#L191) | passed | 0.620 | Block history during an editor, committed rebuild or overlapping operations without losing the available entry. |
| [sketch geometry and its controller invalidation restore together as one document edit](../artifacts/kineticad/tests/history-store.test.mjs#L207) | passed | 2.021 | Restore sketch dimensions and their generated-controller metadata invalidation atomically. |
| [an external assembly replacement is a boundary even when its document bytes are identical](../artifacts/kineticad/tests/history-store.test.mjs#L220) | passed | 1.277 | Clear history on an external assembly replacement even when its bytes match, so stale gesture completion cannot bridge a Load. |
| [entering, replacing and leaving demo workspaces cannot expose another document history](../artifacts/kineticad/tests/history-store.test.mjs#L230) | passed | 1.056 | Prevent Undo from crossing original/demo, reset-demo or return-to-original document boundaries. |
| [deleted imported STEP assets survive Undo, native Save/parse and a cold asset restore](../artifacts/kineticad/tests/history-store.test.mjs#L245) | passed | 39.605 | Retain an imported source through deletion/Undo, Save/parse and cold controlled asset restoration; preserve unrelated stale experiment metadata. |

### hole-picker.test.mjs

5 passing tests. Actual Three.js topology interaction and hole-selection state with controlled DOM/topology fixtures. Checks two-click creation and local/world coordinates; actual Chrome creation remains separate evidence.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [two real canvas clicks set Hole UV on the top face of an untransformed solid](../artifacts/kineticad/tests/hole-picker.test.mjs#L66) | passed | 7.842 |
| [two real canvas clicks set Hole UV on the bottom face of an untransformed solid](../artifacts/kineticad/tests/hole-picker.test.mjs#L66) | passed | 2.616 |
| [two real canvas clicks set Hole UV on the top face of an translated with mixed XYZ rotation solid](../artifacts/kineticad/tests/hole-picker.test.mjs#L66) | passed | 3.724 |
| [two real canvas clicks set Hole UV on the bottom face of an translated with mixed XYZ rotation solid](../artifacts/kineticad/tests/hole-picker.test.mjs#L66) | passed | 1.391 |
| [Clear face and a changed face both restart the Hole picker without stale UV](../artifacts/kineticad/tests/hole-picker.test.mjs#L79) | passed | 13.488 |

### mass-properties.test.mjs

8 passing tests. Actual installed OCCT mass integration and Rapier inertia assignment, with independent analytic tensor/density/frame references and invalid-data rejection.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [OCCT cuboid volume, mass, centroid and all three anisotropic moments match analytic values](../artifacts/kineticad/tests/mass-properties.test.mjs#L59) | passed | 7860.316 |
| [translated and generally rotated cuboid retains centroidal tensor, including off-diagonal terms](../artifacts/kineticad/tests/mass-properties.test.mjs#L68) | passed | 13.175 |
| [solid cylinder moments match axial and transverse analytic inertia](../artifacts/kineticad/tests/mass-properties.test.mjs#L77) | passed | 34.088 |
| [bored ring retains removed-volume effects in its axial and transverse inertia](../artifacts/kineticad/tests/mass-properties.test.mjs#L88) | passed | 588.363 |
| [warm cache and a material change preserve the full tensor and principal frame](../artifacts/kineticad/tests/mass-properties.test.mjs#L102) | passed | 14.084 |
| [Rapier torque impulse follows the full rotated inertia inverse, not part-local diagonal axes](../artifacts/kineticad/tests/mass-properties.test.mjs#L115) | passed | 27.257 |
| [eigensolver handles tiny and large units and rejects non-physical tensors](../artifacts/kineticad/tests/mass-properties.test.mjs#L136) | passed | 0.940 |
| [empty geometry and invalid density fail instead of creating fictitious physical bodies](../artifacts/kineticad/tests/mass-properties.test.mjs#L148) | passed | 2.226 |

### object-selection.test.mjs

13 passing tests. Actual Three.js meshes, raycaster and TransformControls with controlled DOM/pointer/rAF adapters; selected cases use the actual Zustand store/history. This is not a browser render or arbitrary imported-CAD visibility certificate.

| Test / exact source declaration | Status | Duration (ms) | Purpose |
| --- | --- | ---: | --- |
| [real raycast selects the nearest visible solid, ignores hidden ancestors and clears an empty ray](../artifacts/kineticad/tests/object-selection.test.mjs#L46) | passed | 10.945 | Choose the nearest visible solid, honor hidden ancestors and return no body on an empty ray. |
| [actual mesh holes pass the ray through to the visible body behind them](../artifacts/kineticad/tests/object-selection.test.mjs#L56) | passed | 8.030 | Use real triangle intersections so a ray through a mesh hole can select the body behind it. |
| [hidden Boolean inputs are excluded even before the render layer catches up; compounds stay selectable](../artifacts/kineticad/tests/object-selection.test.mjs#L68) | passed | 4.461 | Exclude consumed native inputs before the layer catches up, while permitting a compound Boolean as a modelling selection. |
| [coincident visible source/result surfaces deterministically select the finished result](../artifacts/kineticad/tests/object-selection.test.mjs#L94) | passed | 2.882 | Resolve coincident source/result surfaces consistently in favor of the finished Boolean. |
| [orange outline source points follow full XYZ placement without changing CAD arrays or shared materials](../artifacts/kineticad/tests/object-selection.test.mjs#L104) | passed | 1.338 | Transform outline points through the full live XYZ placement without changing CAD arrays or shared materials. |
| [normal pointer click selects the actual body and an empty canvas click clears it without creating history](../artifacts/kineticad/tests/object-selection.test.mjs#L142) | passed | 3.609 | Select a clicked body or clear an empty click through the production picker without creating a history entry. |
| [orbit drags that return to their starting point cannot select; a fresh click can](../artifacts/kineticad/tests/object-selection.test.mjs#L153) | passed | 0.886 | Reject an orbit drag even if it returns to its starting point; accept a later independent click. |
| [gizmo ownership is latched through release, including a handle click with no displacement](../artifacts/kineticad/tests/object-selection.test.mjs#L163) | passed | 1.808 | Latch gizmo pointer ownership through release, including a handle click with no displacement. |
| [right clicks, outside releases, pointer cancellation and leaving the canvas never select](../artifacts/kineticad/tests/object-selection.test.mjs#L173) | passed | 0.281 | Ignore right clicks, releases outside the canvas, pointer cancellation and a pointer that leaves the canvas. |
| [every edit/physics mode suppresses object picking and a mid-click mode or document change cancels it](../artifacts/kineticad/tests/object-selection.test.mjs#L184) | passed | 1.732 | Disable object picking during edits/physics and invalidate an in-flight click when mode or document changes. |
| [disposed pointer picker releases all listeners and cannot make a later selection](../artifacts/kineticad/tests/object-selection.test.mjs#L199) | passed | 0.607 | Remove subscriptions/listeners on disposal so later events cannot select anything. |
| [actual TransformControls uses the native part origin and flushes the last drag value before closing its transaction](../artifacts/kineticad/tests/object-selection.test.mjs#L204) | passed | 40.315 | Use the actual native part origin, preserve two emitted drag frames and flush the final transform before ending history. |
| [detaching or hiding actual TransformControls mid-drag releases interaction and cancels stale deferred writes](../artifacts/kineticad/tests/object-selection.test.mjs#L226) | passed | 40.466 | End an actual TransformControls gesture on detach, hide or dispose, releasing orbit/history and cancelling deferred stale writes. |

### overlay-frames.test.mjs

8 passing tests. Actual Three.js overlay/glyph transforms with controlled mesh/topology and saved fixtures. Includes the three prior hinge-placement regressions; no OCCT or browser session is executed in this file.

| Test / exact source declaration | Status | Duration (ms) | Purpose |
| --- | --- | ---: | --- |
| [finished sketches follow arbitrary part transforms, including changes without geometry edits](../artifacts/kineticad/tests/overlay-frames.test.mjs#L32) | passed | 8.592 | Place finished sketches using the part transform, including transform-only updates. |
| [consumed sketches show only when selected, unused profiles show, and hidden parts stay hidden](../artifacts/kineticad/tests/overlay-frames.test.mjs#L47) | passed | 4.869 | Display selected consumed sketches and unused profiles without showing hidden parts. |
| [gyroscope profiles retain the assembly elevation instead of being drawn at the ground origin](../artifacts/kineticad/tests/overlay-frames.test.mjs#L69) | passed | 16.628 | Keep gyroscope sketch overlays at their assembly elevation instead of the ground origin. |
| [joint glyph anchors and axes track moving body poses rather than static design transforms](../artifacts/kineticad/tests/overlay-frames.test.mjs#L84) | passed | 9.010 | Draw joint anchors/axes from actual moving-body poses instead of static design transforms. |
| [selection enlargement does not displace prismatic or planar anchors](../artifacts/kineticad/tests/overlay-frames.test.mjs#L119) | passed | 2.958 | Enlarge selected joint glyphs without moving prismatic/legacy planar anchors. |
| [revolute picks retain local true centres for the translated native circle and partial-arc browser fixture](../artifacts/kineticad/tests/overlay-frames.test.mjs#L154) | passed | 2.363 | Preserve true local circular centres for the saved translated circle and partial-arc hinge fixture. |
| [revolute picks preserve shared world centres under mixed XYZ rotation without inverse-transforming local metadata twice](../artifacts/kineticad/tests/overlay-frames.test.mjs#L170) | passed | 0.423 | Apply mixed XYZ placement exactly once to local metadata, keeping paired hinge centres coincident. |
| [revolute picks support identity-frame Boolean topology paired with translated native circular topology](../artifacts/kineticad/tests/overlay-frames.test.mjs#L187) | passed | 0.635 | Pair identity-frame final-Boolean topology with a translated native circular attachment in a shared world frame. |

### part-transform-occt.test.mjs

2 passing tests. Actual OCCT transformed solids, mass and intersections against independently computed Three.js/analytic frames. Covers the selected mixed-axis transforms.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [a translated, generally rotated B-rep keeps its analytic volume and Three-world centroid](../artifacts/kineticad/tests/part-transform-occt.test.mjs#L12) | passed | 8388.144 |
| [the same world transform preserves boolean overlap between two independently transformed bodies](../artifacts/kineticad/tests/part-transform-occt.test.mjs#L30) | passed | 454.901 |

### part-transform.test.mjs

3 passing tests. Pure transform matrix/math and actual Three.js comparison; the OCCT call boundary is controlled. The separate OCCT file establishes kernel execution.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [arbitrary mixed XYZ rotations and translations match the actual Three quaternion convention](../artifacts/kineticad/tests/part-transform.test.mjs#L14) | passed | 3.980 |
| [invalid transforms fail before constructing OCCT values](../artifacts/kineticad/tests/part-transform.test.mjs#L26) | passed | 0.526 |
| [OCCT transform wrappers are released on constructor or shape-operation failures](../artifacts/kineticad/tests/part-transform.test.mjs#L32) | passed | 0.345 |

### path-drawing.test.mjs

7 passing tests. Actual compiled PathDrawing event handlers with controlled hook state and SVG affine matrices. Checks drawing-coordinate/input semantics, not React lifecycle, rendered layout or a human Chrome stroke.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [actual drawing handlers convert translated and letterboxed screen coordinates to millimetres with Y up](../artifacts/kineticad/tests/path-drawing.test.mjs#L96) | passed | 11.197 |
| [a complete pointer stroke forms a valid closed ellipse through the shipped target validator](../artifacts/kineticad/tests/path-drawing.test.mjs#L106) | passed | 11.339 |
| [an open stroke stays open at the drawing boundary and is rejected until explicitly closed](../artifacts/kineticad/tests/path-drawing.test.mjs#L119) | passed | 5.957 |
| [disabled, secondary-button and outside-grid starts cannot replace a path](../artifacts/kineticad/tests/path-drawing.test.mjs#L128) | passed | 2.622 |
| [pointer cancellation and another pointer leave the previous target untouched](../artifacts/kineticad/tests/path-drawing.test.mjs#L140) | passed | 1.489 |
| [a changing preview cannot shift the coordinate frame during a pointer stroke](../artifacts/kineticad/tests/path-drawing.test.mjs#L149) | passed | 2.528 |
| [an overlong stroke reports the vertex limit without committing a silently truncated loop](../artifacts/kineticad/tests/path-drawing.test.mjs#L160) | passed | 31.577 |

### path-trace-label.test.mjs

4 passing tests. Actual Three.js scene/material-point label logic with controlled DOM and explicit poses. Tests projection, visibility and measured-tracer placement without rendered browser acceptance.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [trace label uses the actual coupler and ancestor matrices instead of a predicted or saved pose](../artifacts/kineticad/tests/path-trace-label.test.mjs#L42) | passed | 21.652 |
| [trace projection refreshes a camera moved since the previous rendered frame](../artifacts/kineticad/tests/path-trace-label.test.mjs#L69) | passed | 9.469 |
| [trace annotation hides on missing meshes, clipped depth and invalidated geometry or experiment configuration](../artifacts/kineticad/tests/path-trace-label.test.mjs#L76) | passed | 18.468 |
| [trace annotation holds a paused material point and releases its own DOM node on disposal](../artifacts/kineticad/tests/path-trace-label.test.mjs#L91) | passed | 7.149 |

### physics-worker.test.mjs

17 passing tests. Actual shipped Comlink/Rapier worker with independent analytic descriptors/references. Covers units, joints/frames, motor behavior and lifecycle; preserves the original strict windmill gate. Ordinary CAD contact and finite motor-force ratings remain outside its model.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [windmill seed mate retains pi ±5e-7 rad/s after five seconds with an analytical rotor](../artifacts/kineticad/tests/physics-worker.test.mjs#L82) | passed | 891.304 |
| [free fall uses millimetres, seconds, kilograms and is independent of mass](../artifacts/kineticad/tests/physics-worker.test.mjs#L107) | passed | 46.036 |
| [zero and blank live revolute commands release the motor so a rotor coasts](../artifacts/kineticad/tests/physics-worker.test.mjs#L116) | passed | 163.575 |
| [zero and blank live prismatic commands release the slider to gravity](../artifacts/kineticad/tests/physics-worker.test.mjs#L135) | passed | 84.000 |
| [unpowered pendulum follows the analytical physical-pendulum period](../artifacts/kineticad/tests/physics-worker.test.mjs#L156) | passed | 68.415 |
| [revolute motor follows part A local axis when both bodies share a rotated frame](../artifacts/kineticad/tests/physics-worker.test.mjs#L180) | passed | 26.372 |
| [prismatic motor follows rotated local axis and preserves lateral position](../artifacts/kineticad/tests/physics-worker.test.mjs#L187) | passed | 39.404 |
| [fixed mate preserves an initially translated and rotated child](../artifacts/kineticad/tests/physics-worker.test.mjs#L197) | passed | 24.029 |
| [unsupported mismatched joint frames stop the whole world instead of snapping parts](../artifacts/kineticad/tests/physics-worker.test.mjs#L225) | passed | 9.452 |
| [revolute allows initial twist about its shared axis; prismatic rejects that twist](../artifacts/kineticad/tests/physics-worker.test.mjs#L235) | passed | 31.549 |
| [unsupported planar constraints stop simulation rather than being omitted](../artifacts/kineticad/tests/physics-worker.test.mjs#L247) | passed | 0.661 |
| [a mate referencing a hidden or missing body rejects the whole incomplete assembly](../artifacts/kineticad/tests/physics-worker.test.mjs#L254) | passed | 0.897 |
| [new gimbal seed drives each relative joint speed, not each child world-speed magnitude](../artifacts/kineticad/tests/physics-worker.test.mjs#L266) | passed | 95.624 |
| [fixed solver stepping gives identical motion at 30 Hz, 144 Hz and irregular render rates](../artifacts/kineticad/tests/physics-worker.test.mjs#L305) | passed | 34.765 |
| [fractional requests accumulate; zero pauses and undefined advances one configured step](../artifacts/kineticad/tests/physics-worker.test.mjs#L323) | passed | 10.621 |
| [bounded catch-up retains time instead of dropping it and zero never drains backlog](../artifacts/kineticad/tests/physics-worker.test.mjs#L342) | passed | 2.522 |
| [playback time scaling advances only the actual zero, one or two seconds requested](../artifacts/kineticad/tests/physics-worker.test.mjs#L354) | passed | 9.367 |

### project-cad-roundtrip.test.mjs

2 passing tests. Actual shipped CAD worker/OCCT restart and durable project packaging. Exercises imported-source restoration and edited geometry after re-opening; browser picker/download steps are separate.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [actual worker restores embedded STEP after worker restart, retaining native history, transforms, topology and exportable geometry](../artifacts/kineticad/tests/project-cad-roundtrip.test.mjs#L29) | passed | 21809.608 |
| [a legacy live import is packaged in local coordinates and missing old worker geometry fails clearly](../artifacts/kineticad/tests/project-cad-roundtrip.test.mjs#L86) | passed | 11519.199 |

### project-persistence.test.mjs

13 passing tests. Real project parser, packaging, recovery orchestration and Zustand, with a memory repository and controlled asset restore. Validates transactional data handling, not browser IndexedDB quotas or interface behavior.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [complete project downloads and both recovery generations retain Boolean material, result ground and joint revisions](../artifacts/kineticad/tests/project-persistence.test.mjs#L38) | passed | 41.452 |
| [Boolean project parsing rejects invalid materials/body references and retains stale revisions for explicit repicking](../artifacts/kineticad/tests/project-persistence.test.mjs#L55) | passed | 7.379 |
| [native history, transforms, materials and mates survive with runtime stopped](../artifacts/kineticad/tests/project-persistence.test.mjs#L67) | passed | 2.108 |
| [Save accepts the live Zustand object without cloning actions or editor state](../artifacts/kineticad/tests/project-persistence.test.mjs#L75) | passed | 1.668 |
| [malformed references, dimensions, transforms and unknown features reject](../artifacts/kineticad/tests/project-persistence.test.mjs#L82) | passed | 6.804 |
| [six-axis configuration persists and invalid target rejects](../artifacts/kineticad/tests/project-persistence.test.mjs#L93) | passed | 1.015 |
| [corrupt embedded bytes reject before asset reconstruction or storage changes](../artifacts/kineticad/tests/project-persistence.test.mjs#L101) | passed | 10.313 |
| [invalid downloaded project does not replace the current or previous snapshots](../artifacts/kineticad/tests/project-persistence.test.mjs#L111) | passed | 1.827 |
| [autosave keeps two complete generations and quota failure retains both](../artifacts/kineticad/tests/project-persistence.test.mjs#L122) | passed | 3.274 |
| [corrupt newest recovery falls back to validated previous without overwriting either](../artifacts/kineticad/tests/project-persistence.test.mjs#L137) | passed | 3.520 |
| [newest state is captured before async work and load follows queued autosave](../artifacts/kineticad/tests/project-persistence.test.mjs#L146) | passed | 1.695 |
| [real Zustand demo isolation preserves durable project and last-good copy](../artifacts/kineticad/tests/project-persistence.test.mjs#L155) | passed | 2.371 |
| [version 8 migration runs before validation; old missing STEP files reject clearly](../artifacts/kineticad/tests/project-persistence.test.mjs#L172) | passed | 1.026 |

### simulation-runner.test.mjs

19 passing tests. Actual production runner and planning/hash logic with controlled worker, renderer, clock and frame adapters. Deferred RPCs test stale/overlapping work, model changes and reset; they are not additional physics measurements.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [runner simulates the final Boolean body once with world-frame mesh/mass and suppresses every consumed source](../artifacts/kineticad/tests/simulation-runner.test.mjs#L134) | passed | 238.835 |
| [a disconnected final-solid rejection creates no world and leaves the modelling layers visible](../artifacts/kineticad/tests/simulation-runner.test.mjs#L153) | passed | 10.818 |
| [native source edits during pending Boolean CAD preparation reject the stale result before physics dispatch](../artifacts/kineticad/tests/simulation-runner.test.mjs#L161) | passed | 11.633 |
| [Boolean result motor-only edits during CAD preparation use the latest command and preserve valid geometry](../artifacts/kineticad/tests/simulation-runner.test.mjs#L171) | passed | 11.642 |
| [geometry changed during an in-flight world build cannot publish stale Boolean bodies or start its clock](../artifacts/kineticad/tests/simulation-runner.test.mjs#L183) | passed | 7.763 |
| [a geometry edit after Play stops the run and rejects an already-pending pose response](../artifacts/kineticad/tests/simulation-runner.test.mjs#L194) | passed | 4.882 |
| [invalid Boolean material cannot silently simulate original uncut inputs](../artifacts/kineticad/tests/simulation-runner.test.mjs#L201) | passed | 14.257 |
| [runner permits one in-flight step, retains elapsed time, and counts actual worker time](../artifacts/kineticad/tests/simulation-runner.test.mjs#L213) | passed | 6.419 |
| [finite experiments hold the final solver pose and clock instead of resetting the model](../artifacts/kineticad/tests/simulation-runner.test.mjs#L230) | passed | 5.280 |
| [late RPC response cannot move the paused pose or clock; resume preserves its actual time](../artifacts/kineticad/tests/simulation-runner.test.mjs#L243) | passed | 5.067 |
| [stopped or replaced assembly ignores a late step response](../artifacts/kineticad/tests/simulation-runner.test.mjs#L262) | passed | 4.565 |
| [old build reply and teardown cannot destroy the replacement scene world](../artifacts/kineticad/tests/simulation-runner.test.mjs#L274) | passed | 4.208 |
| [invalid cached mass stops the current run and restores modelling layers](../artifacts/kineticad/tests/simulation-runner.test.mjs#L297) | passed | 5.191 |
| [rejected build RPC is caught and does not poison the next successful build](../artifacts/kineticad/tests/simulation-runner.test.mjs#L309) | passed | 8.693 |
| [motor edits during pending CAD work reach the world that is eventually built](../artifacts/kineticad/tests/simulation-runner.test.mjs#L326) | passed | 4.599 |
| [motor edits during an in-flight build replay before the first solver step](../artifacts/kineticad/tests/simulation-runner.test.mjs#L350) | passed | 3.487 |
| [six-axis build validates source solids and uses its own full movement duration](../artifacts/kineticad/tests/simulation-runner.test.mjs#L370) | passed | 3.240 |
| [six-axis source rejection never creates a physics world](../artifacts/kineticad/tests/simulation-runner.test.mjs#L381) | passed | 8.421 |
| [canonical path linkage dispatches its measured solver profile and six-second real-body run](../artifacts/kineticad/tests/simulation-runner.test.mjs#L390) | passed | 19.394 |

### sketch-arcs.test.mjs

7 passing tests. Actual installed OCCT sketches, sweeps and mass integration. Independent all-plane arc samples, sector properties and sphere/profile references check the UV-frame correction.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [XY arc endpoints and intermediate samples agree with sketch UV; sector extrudes with analytic volume and centroid](../artifacts/kineticad/tests/sketch-arcs.test.mjs#L19) | passed | 8209.014 |
| [XY semicircle revolves to an exact sphere about the sketch V axis](../artifacts/kineticad/tests/sketch-arcs.test.mjs#L60) | passed | 50.560 |
| [XZ arc endpoints and intermediate samples agree with sketch UV; sector extrudes with analytic volume and centroid](../artifacts/kineticad/tests/sketch-arcs.test.mjs#L19) | passed | 24.258 |
| [XZ semicircle revolves to an exact sphere about the sketch V axis](../artifacts/kineticad/tests/sketch-arcs.test.mjs#L60) | passed | 12.492 |
| [YZ arc endpoints and intermediate samples agree with sketch UV; sector extrudes with analytic volume and centroid](../artifacts/kineticad/tests/sketch-arcs.test.mjs#L19) | passed | 21.182 |
| [YZ semicircle revolves to an exact sphere about the sketch V axis](../artifacts/kineticad/tests/sketch-arcs.test.mjs#L60) | passed | 10.664 |
| [both Stewart turning profiles retain exact circular ends and rebuild as single valid solids](../artifacts/kineticad/tests/sketch-arcs.test.mjs#L79) | passed | 49.014 |

### sketch-dimensions-cad.test.mjs

10 passing tests. Actual installed OCCT with edited primitives and production project parsing. Independent cylinder, rectangle, line and sector references plus Save/parse/rebuild establish selected geometry/persistence cases.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [editing circle diameter20→30 mm rebuilds an exact cylinder with the expected volume, bounds and mass](../artifacts/kineticad/tests/sketch-dimensions-cad.test.mjs#L64) | passed | 12082.896 |
| [XY rectangle width and height edits change exact solid dimensions in the sketch's U/V axes](../artifacts/kineticad/tests/sketch-dimensions-cad.test.mjs#L81) | passed | 139.512 |
| [XZ rectangle width and height edits change exact solid dimensions in the sketch's U/V axes](../artifacts/kineticad/tests/sketch-dimensions-cad.test.mjs#L81) | passed | 78.802 |
| [YZ rectangle width and height edits change exact solid dimensions in the sketch's U/V axes](../artifacts/kineticad/tests/sketch-dimensions-cad.test.mjs#L81) | passed | 93.633 |
| [line length/angle/start edits create a closed rotated rectangular profile with analytical area](../artifacts/kineticad/tests/sketch-dimensions-cad.test.mjs#L107) | passed | 33.194 |
| [XY edited arc radius/start/sweep and its two lines rebuild the exact closed sector](../artifacts/kineticad/tests/sketch-dimensions-cad.test.mjs#L128) | passed | 41.278 |
| [XZ edited arc radius/start/sweep and its two lines rebuild the exact closed sector](../artifacts/kineticad/tests/sketch-dimensions-cad.test.mjs#L128) | passed | 24.904 |
| [YZ edited arc radius/start/sweep and its two lines rebuild the exact closed sector](../artifacts/kineticad/tests/sketch-dimensions-cad.test.mjs#L128) | passed | 26.845 |
| [an arc-only edit does not silently move adjacent lines or disguise an open profile as a solid](../artifacts/kineticad/tests/sketch-dimensions-cad.test.mjs#L141) | passed | 33.895 |
| [complete Save/parse preserves edited primitives and rebuilds identical actual CAD geometry](../artifacts/kineticad/tests/sketch-dimensions-cad.test.mjs#L154) | passed | 277.027 |

### sketch-dimensions.test.mjs

9 passing tests. Pure primitive dimension equations, exact no-op preservation and finite/domain validation. Does not implement a general geometric-constraint solver.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [fields expose persistent UV geometry with diameter and degree conventions](../artifacts/kineticad/tests/sketch-dimensions.test.mjs#L15) | passed | 4.767 |
| [exact no-op edits retain primitive identity and all original floating-point coordinates](../artifacts/kineticad/tests/sketch-dimensions.test.mjs#L29) | passed | 3.673 |
| [circle diameter and rectangle width/height edits preserve anchors and neighbours](../artifacts/kineticad/tests/sketch-dimensions.test.mjs#L39) | passed | 0.464 |
| [line edits satisfy independent right-triangle, quadrant and winding references](../artifacts/kineticad/tests/sketch-dimensions.test.mjs#L51) | passed | 2.021 |
| [arc edits preserve centre and produce the stated circular endpoints and CCW sweep across zero](../artifacts/kineticad/tests/sketch-dimensions.test.mjs#L66) | passed | 1.415 |
| [complete values reject unknown, missing, nonfinite, nonnumeric and out-of-domain edits without mutation](../artifacts/kineticad/tests/sketch-dimensions.test.mjs#L80) | passed | 5.327 |
| [inclusive bounds accept valid stored coordinates and primitives remain editable after serialization](../artifacts/kineticad/tests/sketch-dimensions.test.mjs#L100) | passed | 4.731 |
| [minimum lengths and arc sweeps survive cancellation at the maximum coordinate and angle scales](../artifacts/kineticad/tests/sketch-dimensions.test.mjs#L115) | passed | 5.109 |
| [sketch validation allows empty/open geometry but rejects degenerate primitive dimensions](../artifacts/kineticad/tests/sketch-dimensions.test.mjs#L137) | passed | 3.204 |

### sketch-edit.test.mjs

14 passing tests. Actual store/coordinator with controlled CAD and topology promises. Checks atomic commit, stale/cancelled/failed validation, references and metadata; kernel correctness is checked separately.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [successful edit commits only after full-chain validation, preserving identities and clearing derived state](../artifacts/kineticad/tests/sketch-edit.test.mjs#L56) | passed | 13.379 |
| [CAD history failure retains the committed sketch and can be retried](../artifacts/kineticad/tests/sketch-edit.test.mjs#L82) | passed | 6.400 |
| [dependent assembly Boolean receives updated geometry and must succeed before commit](../artifacts/kineticad/tests/sketch-edit.test.mjs#L95) | passed | 27.077 |
| [a later geometry or Boolean-consumer edit invalidates a pending transaction](../artifacts/kineticad/tests/sketch-edit.test.mjs#L112) | passed | 2.950 |
| [mass-cache churn and cosmetic part naming do not reject or overwrite newer display state](../artifacts/kineticad/tests/sketch-edit.test.mjs#L126) | passed | 2.332 |
| [loading an identical-looking project during validation rejects its old Sketch identity](../artifacts/kineticad/tests/sketch-edit.test.mjs#L135) | passed | 1.538 |
| [cancelled or closed editors cannot commit a late CAD result](../artifacts/kineticad/tests/sketch-edit.test.mjs#L144) | passed | 3.928 |
| [two pending edits cannot commit out of order](../artifacts/kineticad/tests/sketch-edit.test.mjs#L156) | passed | 1.295 |
| [unchanged referenced edge geometry retains the exact joint and its local anchor](../artifacts/kineticad/tests/sketch-edit.test.mjs#L165) | passed | 7.939 |
| [missing geometry IDs or a changed referenced face reject without guessing new pivots](../artifacts/kineticad/tests/sketch-edit.test.mjs#L173) | passed | 3.119 |
| [fixed mates and unused sketches need no geometric-pivot remapping](../artifacts/kineticad/tests/sketch-edit.test.mjs#L184) | passed | 0.583 |
| [meaningful edits clear canonical controllers and save the manual-geometry marker; no-op preserves them](../artifacts/kineticad/tests/sketch-edit.test.mjs#L191) | passed | 12.423 |
| [invalid dimensions, stale editor source and active editors reject before CAD dispatch](../artifacts/kineticad/tests/sketch-edit.test.mjs#L215) | passed | 1.630 |
| [the store commit independently rejects a stale source signature](../artifacts/kineticad/tests/sketch-edit.test.mjs#L231) | passed | 0.496 |

### stewart-controller.test.mjs

6 passing tests. Pure inverse kinematics/controller math, independent pose/reference calculations and motion/workspace guards. Actual platform trajectories are documented separately and are not implied by this file alone.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [six-axis IK agrees with independently transformed anchors for both directions of every axis](../artifacts/kineticad/tests/stewart-controller.test.mjs#L21) | passed | 101.722 |
| [all 64 simultaneous translation/rotation workspace corners satisfy stroke, speed and singularity guards](../artifacts/kineticad/tests/stewart-controller.test.mjs#L34) | passed | 178.060 |
| [quintic trajectory starts and ends at rest and holds its final requested pose](../artifacts/kineticad/tests/stewart-controller.test.mjs#L41) | passed | 1.923 |
| [invalid values, speed requests, altered frames and altered anchors reject explicitly](../artifacts/kineticad/tests/stewart-controller.test.mjs#L55) | passed | 5.320 |
| [dimensionless Jacobian guard detects a collapsed singular geometry](../artifacts/kineticad/tests/stewart-controller.test.mjs#L64) | passed | 5.516 |
| [orientation error measures tiny and sign-equivalent quaternions without acos cancellation](../artifacts/kineticad/tests/stewart-controller.test.mjs#L71) | passed | 0.250 |

### stewart-geometry.test.mjs

5 passing tests. Pure Stewart factory/configuration and independent closed-loop/heave geometry. Does not rebuild B-rep solids or run Rapier in this file.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [the editable v9 fixture forms one connected 14-body, 18-joint mechanism](../artifacts/kineticad/tests/stewart-geometry.test.mjs#L43) | passed | 11.394 |
| [every encoded joint closes in world space and each actuator uses compatible oblique frames](../artifacts/kineticad/tests/stewart-geometry.test.mjs#L67) | passed | 4.255 |
| [the six-axis length Jacobian stays nonsingular and equal actuator rates produce pure heave](../artifacts/kineticad/tests/stewart-geometry.test.mjs#L106) | passed | 7.579 |
| [sampled lift retains rod overlap, radial bore clearance and conservative separation between legs](../artifacts/kineticad/tests/stewart-geometry.test.mjs#L144) | passed | 11.206 |
| [the builder rejects an unsafe programme or insufficient rod overlap](../artifacts/kineticad/tests/stewart-geometry.test.mjs#L169) | passed | 1.617 |

### stewart-integration.test.mjs

3 passing tests. Production source-geometry/configuration gates, parsing and measurement store with explicit fixtures. No newly simulated six-axis motion.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [saved six-axis command survives demo parsing and invalid commands fail closed](../artifacts/kineticad/tests/stewart-integration.test.mjs#L9) | passed | 56.749 |
| [source guard permits labels and material changes but rejects altered solids, topology and visibility](../artifacts/kineticad/tests/stewart-integration.test.mjs#L16) | passed | 56.243 |
| [measurement state uses actual worker results, holds on zero step, and clears on reset or another experiment](../artifacts/kineticad/tests/stewart-integration.test.mjs#L33) | passed | 3.904 |

### stewart-workspace.test.mjs

5 passing tests. Conservative floating-point workspace/path subdivision and independent geometric arithmetic. Not formal interval arithmetic, universal dynamics acceptance or exact OCCT at every pose.

| Test / exact source declaration | Status | Duration (ms) |
| --- | --- | ---: |
| [the entire ±5 mm / ±2° pose box is enclosed with no unresolved cells](../artifacts/kineticad/tests/stewart-workspace.test.mjs#L11) | passed | 411.394 |
| [insufficient subdivision and an enlarged unsafe range fail explicitly](../artifacts/kineticad/tests/stewart-workspace.test.mjs#L25) | passed | 9.128 |
| [independent Rodrigues progress matches exact quaternion axis-angle interpolation at intermediate poses](../artifacts/kineticad/tests/stewart-workspace.test.mjs#L30) | passed | 4.139 |
| [all 64 extreme home-to-target paths are enclosed between progress samples](../artifacts/kineticad/tests/stewart-workspace.test.mjs#L47) | passed | 430.938 |
| [exact target solid placements close spherical endpoints and encode independent rod extension](../artifacts/kineticad/tests/stewart-workspace.test.mjs#L56) | passed | 6.090 |
