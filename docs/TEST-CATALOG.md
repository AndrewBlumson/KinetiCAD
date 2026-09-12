# Automated test catalog

**298 passed, 0 failed, 0 skipped or cancelled, across 39 files.** This is a fresh serialized run of commit `8e954ab89cbc7ab0753b4d3145622c76a0fd63ef`, started 2026-09-12T17:50:33.152387+00:00 and completed 2026-09-12T17:52:59.786891+00:00. Node reported **146.122 seconds**; measured process wall time was **146.635 seconds**. The runtime was Node `v25.4.0` with pnpm `10.28.2`.

The Replit configuration selects Node 24. This local capture used Node 25.4.0; it does not establish a passing run on Node 24. Rerun the suite in the configured Replit runtime before using this result as deployment acceptance.

This catalog names every executed test and links its exact declaration line. It records the checking method, representative assertion calls and measured duration. The [machine-readable inventory](test-inventory-results.json) retains every test result, complete test source, local assertion helpers, source hashes, reporter events and original JSONL bytes. Loop-generated tests have separate runtime names but share a source line. These **298 are test cases**, not 298 physical experiments; assertions, solver steps, BRep pairs and the standalone scenario counts below are not added to the total.

KinetiCAD was created by Andrew Blumson and Kevin Blumson with Replit Agent. The later verification record is credited as **Codex automated checks and computer-use checks**, with those forms of evidence kept separate. This capture performed automated checks only; it did not operate a browser, establish new visual acceptance or relabel original Replit results.

## Reproduce the run

From the repository root, with the workspace dependencies already installed:

```sh
pnpm --filter @workspace/kineticad test:all
```

The recorded run uses the exact same loader, serialized concurrency and 39 test files as `test:all`, replacing the default reporter with a JSON event reporter. Its complete argument vector and reporter source are in `provenance.command` and `provenance.reporterSource` in the JSON. To repeat a single file, run this from the repository root and replace the final filename:

```sh
pnpm --filter @workspace/kineticad exec node --import ../../scripts/node_modules/tsx/dist/loader.mjs --test --test-concurrency=1 tests/boolean-physics.test.mjs
```

OCCT runs are CPU intensive; keep them serialized. Some helpers reuse source-and-assembly-hash-validated temporary CAD descriptors; this run did not deliberately purge those caches. The companion crank-slider CAD tests rebuild the native solids. A successful test process is separate from a production build and from actual interface acceptance.

**Report preservation:** the suite rewrote `assembly-export-results.json` and `boolean-physics-results.json`. Both historical files were restored byte for byte. Their fresh measured payloads, raw bytes and before/after hashes are retained under `freshGeneratedReports` in the new inventory. All snapshotted historical JSON and tracked test-fixture bytes were verified restored. The run therefore does not silently replace older provenance.

## How to read the evidence

The method and limitation under each file apply to every test in that file. “Real OCCT” means the actual CAD implementation executes; “real Rapier” means the actual dynamics engine executes. Controlled CAD/worker adapters test orchestration, failure and race handling without claiming geometric or physical accuracy. Real Three.js tests use geometry and transforms but do not replace visible browser checks. Pure mathematics tests compare formulas or explicit inputs and guards.

The short checks below are exact source calls, shortened with an ellipsis when necessary. The JSON retains the complete source and predicates. A helper call such as `close(actual, expected, tolerance)` resolves to its source definition, including tolerance semantics. Static helper reachability is not runtime coverage or an assertion count. Tests with no explicit assertion are labelled as a non-throwing validation check.

For model assumptions and formula derivations see [Mathematics and physics](MATHEMATICS-AND-PHYSICS.md) and [Physics verification](PHYSICS-VERIFICATION.md). For browser evidence and remaining gaps use [Boolean simulation verification](BOOLEAN-SIMULATION-VERIFICATION.md), [Chrome acceptance](CHROME-ACCEPTANCE-2026-09-12.md) and [Known issues and follow-up](KNOWN-ISSUES-AND-FOLLOW-UP.md). General CAD collision/friction, finite-force Stewart and general FEA are not established by this suite.

## Capture JSON events in another checkout

The following command reconstructs the reporter from the tracked inventory, uses the recorded 39-file argument list and writes new evidence to a fresh temporary directory. It also preserves the two historical reports that this suite is known to overwrite, saving their new output bytes beside the events. It does not depend on the original machine’s temporary reporter path. Run it from the repository root at the recorded implementation revision with dependencies installed:

```sh
node --input-type=module <<'NODE'
import { readFileSync, writeFileSync, mkdtempSync, openSync, closeSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
const inventory = JSON.parse(readFileSync('docs/test-inventory-results.json', 'utf8'));
const outputDir = mkdtempSync(join(tmpdir(), 'kineticad-test-capture-'));
const reporterPath = join(outputDir, 'reporter.mjs');
writeFileSync(reporterPath, inventory.provenance.reporterSource);
const args = inventory.provenance.command.slice(1).map(arg =>
  arg.startsWith('--test-reporter=') ? `--test-reporter=${reporterPath}` : arg);
const originals = inventory.provenance.generatedArtifactsRestored.map(({ path }) =>
  ({ path, bytes: readFileSync(path) }));
const output = openSync(join(outputDir, 'events.jsonl'), 'w');
try {
  const result = spawnSync(process.execPath, args, {
    cwd: resolve('artifacts/kineticad'), stdio: ['ignore', output, 'inherit'],
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  closeSync(output);
  for (const { path, bytes } of originals) {
    writeFileSync(join(outputDir, path.replaceAll('/', '__')), readFileSync(path));
    writeFileSync(path, bytes);
  }
  console.log(`Reporter events and fresh generated reports: ${outputDir}`);
}
NODE
```

## File inventory

| File | Tests | Method | File time |
| --- | ---: | --- | ---: |
| [actuator-bench.test.mjs](../artifacts/kineticad/tests/actuator-bench.test.mjs) | 7 | Real Rapier bench | 0.254 s |
| [assembly-export.test.mjs](../artifacts/kineticad/tests/assembly-export.test.mjs) | 7 | Real OCCT worker | 12.065 s |
| [assembly-simulation.test.mjs](../artifacts/kineticad/tests/assembly-simulation.test.mjs) | 10 | Pure assembly policy | 0.052 s |
| [beam-analysis.test.mjs](../artifacts/kineticad/tests/beam-analysis.test.mjs) | 7 | Pure engineering mathematics | 0.028 s |
| [bench-elapsed-clock.test.mjs](../artifacts/kineticad/tests/bench-elapsed-clock.test.mjs) | 3 | Pure lifecycle logic | 0.017 s |
| [boolean-bodies.test.mjs](../artifacts/kineticad/tests/boolean-bodies.test.mjs) | 10 | Controlled CAD adapter | 0.057 s |
| [boolean-mate-store.test.mjs](../artifacts/kineticad/tests/boolean-mate-store.test.mjs) | 9 | Actual store / controlled topology | 0.051 s |
| [boolean-physics.test.mjs](../artifacts/kineticad/tests/boolean-physics.test.mjs) | 15 | Real OCCT + Rapier workers | 11.250 s |
| [boolean-result-picking.test.mjs](../artifacts/kineticad/tests/boolean-result-picking.test.mjs) | 9 | Actual Three.js / controlled CAD | 0.074 s |
| [cad-operations.test.mjs](../artifacts/kineticad/tests/cad-operations.test.mjs) | 11 | Real OCCT operations | 10.156 s |
| [contact-bench.test.mjs](../artifacts/kineticad/tests/contact-bench.test.mjs) | 9 | Real Rapier bench | 0.310 s |
| [crank-slider-cad.test.mjs](../artifacts/kineticad/tests/crank-slider-cad.test.mjs) | 2 | Real OCCT + analytic bounds | 27.209 s |
| [crank-slider-kinematics.test.mjs](../artifacts/kineticad/tests/crank-slider-kinematics.test.mjs) | 4 | Pure mechanism mathematics | 0.044 s |
| [crank-slider-physics.test.mjs](../artifacts/kineticad/tests/crank-slider-physics.test.mjs) | 2 | Real Rapier worker / exact CAD descriptors | 2.866 s |
| [crank-slider-readout.test.mjs](../artifacts/kineticad/tests/crank-slider-readout.test.mjs) | 14 | Pure measured-data processing | 0.037 s |
| [crank-slider-workspace.test.mjs](../artifacts/kineticad/tests/crank-slider-workspace.test.mjs) | 7 | Actual store / memory persistence | 0.094 s |
| [demos.test.mjs](../artifacts/kineticad/tests/demos.test.mjs) | 6 | Fixtures / actual store | 0.076 s |
| [desktop-support.test.mjs](../artifacts/kineticad/tests/desktop-support.test.mjs) | 9 | Pure device policy | 0.028 s |
| [engineering-bench-worker.test.mjs](../artifacts/kineticad/tests/engineering-bench-worker.test.mjs) | 3 | Real Comlink / Rapier worker | 0.511 s |
| [feature-regen.test.mjs](../artifacts/kineticad/tests/feature-regen.test.mjs) | 13 | Controlled CAD adapter | 0.060 s |
| [force-measurements.test.mjs](../artifacts/kineticad/tests/force-measurements.test.mjs) | 3 | Pure measured-data processing | 0.017 s |
| [force-physics.test.mjs](../artifacts/kineticad/tests/force-physics.test.mjs) | 6 | Real Rapier worker | 0.644 s |
| [hole-picker.test.mjs](../artifacts/kineticad/tests/hole-picker.test.mjs) | 5 | Actual Three.js / DOM adapter | 0.052 s |
| [mass-properties.test.mjs](../artifacts/kineticad/tests/mass-properties.test.mjs) | 8 | Real OCCT + Rapier mathematics | 8.622 s |
| [overlay-frames.test.mjs](../artifacts/kineticad/tests/overlay-frames.test.mjs) | 5 | Actual Three.js geometry | 0.053 s |
| [part-transform-occt.test.mjs](../artifacts/kineticad/tests/part-transform-occt.test.mjs) | 2 | Real OCCT operations | 7.280 s |
| [part-transform.test.mjs](../artifacts/kineticad/tests/part-transform.test.mjs) | 3 | Pure transform / controlled OCCT adapter | 0.035 s |
| [physics-worker.test.mjs](../artifacts/kineticad/tests/physics-worker.test.mjs) | 17 | Real Rapier worker | 1.101 s |
| [project-cad-roundtrip.test.mjs](../artifacts/kineticad/tests/project-cad-roundtrip.test.mjs) | 2 | Real OCCT worker restart | 27.035 s |
| [project-persistence.test.mjs](../artifacts/kineticad/tests/project-persistence.test.mjs) | 13 | Actual project code / memory repository | 0.169 s |
| [simulation-runner.test.mjs](../artifacts/kineticad/tests/simulation-runner.test.mjs) | 18 | Actual runner / controlled workers | 0.299 s |
| [sketch-arcs.test.mjs](../artifacts/kineticad/tests/sketch-arcs.test.mjs) | 7 | Real OCCT operations | 8.335 s |
| [sketch-dimensions-cad.test.mjs](../artifacts/kineticad/tests/sketch-dimensions-cad.test.mjs) | 10 | Real OCCT operations | 7.681 s |
| [sketch-dimensions.test.mjs](../artifacts/kineticad/tests/sketch-dimensions.test.mjs) | 9 | Pure dimension mathematics | 0.044 s |
| [sketch-edit.test.mjs](../artifacts/kineticad/tests/sketch-edit.test.mjs) | 14 | Actual store / controlled CAD | 0.060 s |
| [stewart-controller.test.mjs](../artifacts/kineticad/tests/stewart-controller.test.mjs) | 6 | Pure mechanism mathematics | 0.255 s |
| [stewart-geometry.test.mjs](../artifacts/kineticad/tests/stewart-geometry.test.mjs) | 5 | Pure fixture mathematics | 0.069 s |
| [stewart-integration.test.mjs](../artifacts/kineticad/tests/stewart-integration.test.mjs) | 3 | State / measured-data processing | 0.065 s |
| [stewart-workspace.test.mjs](../artifacts/kineticad/tests/stewart-workspace.test.mjs) | 5 | Floating-point geometry certificate | 0.461 s |

File times are Node’s per-file summaries, including initialization and teardown. Individual durations below are the runner’s measured test durations; neither is a performance promise for the interactive application.

## Every executed test

### actuator-bench.test.mjs

**7 passed · Real Rapier bench.** Runs the standalone, guided axial actuator with capped equal-and-opposite forces. Compares measured velocity, acceleration, displacement, reaction, energy and travel cutoff with F/m, gravity, momentum and work references.

**Limits:** A simple guided bench: no general CAD motor ratings, contact impacts, friction, electrical model or finite-force Stewart control.

1. **[capped axial force produces F/m acceleration with correct SI/mm conversion](../artifacts/kineticad/tests/actuator-bench.test.mjs#L13)** — PASS, 129.633 ms.
   Checks include: <code>close(s.accelerationMmPerSec2,expectedAcceleration,0.001,&#x27;actual step acceleration&#x27;)</code>; <code>close(s.inferredActuatorForceN,0.01,1e-6,&#x27;force inferred from measured acceleration&#x27;)</code>; <code>close(last.velocityMmPerSec[2],expectedAcceleration*0.1,0.0001,&#x27;velocity&#x27;)</code>.
   Assertion helpers: [run](../artifacts/kineticad/tests/actuator-bench.test.mjs#L5), [close](../artifacts/kineticad/tests/actuator-bench.test.mjs#L4).

2. **[a rated motor holds gravity and an overloaded motor saturates and falls at Fmax/m − g](../artifacts/kineticad/tests/actuator-bench.test.mjs#L23)** — PASS, 45.182 ms.
   Checks include: <code>close(hold.last.positionMm[2],300,1e-5,&#x27;held position&#x27;)</code>; <code>close(hold.last.velocityMmPerSec[2],0,1e-5,&#x27;held velocity&#x27;)</code>; <code>close(s.appliedForceN,9.81,1e-10,&#x27;static weight&#x27;)</code>.
   Assertion helpers: [run](../artifacts/kineticad/tests/actuator-bench.test.mjs#L5), [close](../artifacts/kineticad/tests/actuator-bench.test.mjs#L4).

3. **[free-base reaction conserves momentum and mass-weighted centre of mass](../artifacts/kineticad/tests/actuator-bench.test.mjs#L35)** — PASS, 21.495 ms.
   Checks include: <code>close(s.massKg*s.velocityMmPerSec[2]+4*s.baseVelocityMmPerSec[2],0,0.0001,&#x27;total linear momentum&#x27;)</code>; <code>close((s.massKg*s.positionMm[2]+4*s.basePositionMm[2])/5,60,0.0003,&#x27;centre of mass&#x27;)</code>; <code>assert(last.baseVelocityMmPerSec[2]&lt;0 &amp;&amp; last.velocityMmPerSec[2]&gt;0)</code>.
   Assertion helpers: [run](../artifacts/kineticad/tests/actuator-bench.test.mjs#L5), [close](../artifacts/kineticad/tests/actuator-bench.test.mjs#L4).

4. **[lift reaches its target without ever exceeding the actuator force rating](../artifacts/kineticad/tests/actuator-bench.test.mjs#L40)** — PASS, 19.209 ms.
   Checks include: <code>close(last.positionMm[2],380,0.02,&#x27;settled lift position&#x27;)</code>; <code>close(last.velocityMmPerSec[2],0,0.06,&#x27;settled lift velocity&#x27;)</code>; <code>close(s.inferredActuatorForceN,s.appliedForceN,0.0001,&#x27;applied versus inferred force&#x27;)</code>.
   Assertion helpers: [run](../artifacts/kineticad/tests/actuator-bench.test.mjs#L5), [close](../artifacts/kineticad/tests/actuator-bench.test.mjs#L4).

5. **[fixed-step partitioning is invariant and halving dt reduces overload position error](../artifacts/kineticad/tests/actuator-bench.test.mjs#L46)** — PASS, 10.049 ms.
   Checks include: <code>assert.deepEqual(a.last.positionMm,b.last.positionMm)</code>; <code>assert.deepEqual(a.last.velocityMmPerSec,b.last.velocityMmPerSec)</code>; <code>assert(Math.abs(fine.last.positionMm[2]-exact)&lt;0.75*Math.abs(a.last.positionMm[2]-exact),&#x27;smaller integration step improves position&#x27;)</code>.
   Assertion helpers: [run](../artifacts/kineticad/tests/actuator-bench.test.mjs#L5).

6. **[travel cutoff stops before geometry crosses the base and is distinguished from modeled impact](../artifacts/kineticad/tests/actuator-bench.test.mjs#L53)** — PASS, 1.214 ms.
   Checks include: <code>assert.equal(last.stopReason,&#x27;travel-boundary&#x27;)</code>; <code>assert(last.simulatedTimeMs&lt;2000)</code>; <code>assert(last.positionMm[2]&gt;80)</code>.
   Assertion helpers: [run](../artifacts/kineticad/tests/actuator-bench.test.mjs#L5).

7. **[invalid configuration and step requests reject explicitly](../artifacts/kineticad/tests/actuator-bench.test.mjs#L57)** — PASS, 1.101 ms.
   Checks include: <code>assert.throws(()=&gt;validateActuatorBenchConfig(c),/Actuator bench/)</code>; <code>assert.throws(()=&gt;b.step(-1),/non-negative/)</code>; <code>assert.throws(()=&gt;b.step(NaN),/non-negative/)</code>.

### assembly-export.test.mjs

**7 passed · Real OCCT worker.** Runs the shipped CAD worker, writes and re-imports STEP, and integrates binary STL triangles. Analytic boxes provide independent volume, centroid, bounds and solid-count references.

**Limits:** Covers the listed box/Boolean/compound cases; planar STL accuracy does not establish every curved mesh, native browser download, saved joint or editable-history round trip.

8. **[union STEP and STL export final transformed Boolean plus visible independent part, omitting hidden sources](../artifacts/kineticad/tests/assembly-export.test.mjs#L84)** — PASS, 10160.012 ms.
   Checks include: <code>verify(assembly(type), [{ volume, com: world([x, 10, 15]) }, witness], type)</code>.
   Assertion helpers: [verify](../artifacts/kineticad/tests/assembly-export.test.mjs#L61).

9. **[subtract STEP and STL export final transformed Boolean plus visible independent part, omitting hidden sources](../artifacts/kineticad/tests/assembly-export.test.mjs#L84)** — PASS, 301.255 ms.
   Checks include: <code>verify(assembly(type), [{ volume, com: world([x, 10, 15]) }, witness], type)</code>.
   Assertion helpers: [verify](../artifacts/kineticad/tests/assembly-export.test.mjs#L61).

10. **[intersect STEP and STL export final transformed Boolean plus visible independent part, omitting hidden sources](../artifacts/kineticad/tests/assembly-export.test.mjs#L84)** — PASS, 230.691 ms.
   Checks include: <code>verify(assembly(type), [{ volume, com: world([x, 10, 15]) }, witness], type)</code>.
   Assertion helpers: [verify](../artifacts/kineticad/tests/assembly-export.test.mjs#L61).

11. **[Hide inputs off exports visible originals as well as result, preserving deliberate overlapping solids](../artifacts/kineticad/tests/assembly-export.test.mjs#L90)** — PASS, 463.646 ms.
   Checks include: <code>verify(args, [{ volume: 6000, com: world([5, 10, 15]) }, { volume: 6000, com: world([10, 10, 15]) }, { volume: 9000, com: world([7.5, 10, 15]) }, witness], &#x27;hideInputs=false&#x27;)</code>.
   Assertion helpers: [verify](../artifacts/kineticad/tests/assembly-export.test.mjs#L61).

12. **[disconnected Boolean compound exports every solid without restoring hidden originals](../artifacts/kineticad/tests/assembly-export.test.mjs#L96)** — PASS, 191.417 ms.
   Checks include: <code>verify(assembly(&#x27;union&#x27;, { gap: 30 }), [{ volume: 6000, com: world([5, 10, 15]) }, { volume: 6000, com: world([35, 10, 15]) }, witness], &#x27;disconnected union compound&#x27;)</code>.
   Assertion helpers: [verify](../artifacts/kineticad/tests/assembly-export.test.mjs#L61).

13. **[multiple visible Boolean results share immutable source geometry safely](../artifacts/kineticad/tests/assembly-export.test.mjs#L101)** — PASS, 373.569 ms.
   Checks include: <code>verify(args, [{ volume: 9000, com: world([7.5, 10, 15]) }, { volume: 3000, com: world([7.5, 10, 15]) }, witness], &#x27;two results from shared sources&#x27;)</code>.
   Assertion helpers: [verify](../artifacts/kineticad/tests/assembly-export.test.mjs#L61).

14. **[invalid/empty output aborts; subsequent raw asset export and native feature chain remain intact](../artifacts/kineticad/tests/assembly-export.test.mjs#L108)** — PASS, 179.564 ms.
   Checks include: <code>assert.rejects(api[method](missing), /missing or empty part deleted/)</code>; <code>assert.rejects(api[method]({ parts: [{ ...part(&#x27;hidden&#x27;), visible: false }], booleanFeatures: [] }), /no visible committed solids/)</code>; <code>assert.rejects(api[method](assembly(&#x27;intersect&#x27;, { gap: 30 })), /Visible intersect.*empty-result/)</code>.
   Assertion helpers: [verify](../artifacts/kineticad/tests/assembly-export.test.mjs#L61).

### assembly-simulation.test.mjs

**10 passed · Pure assembly policy.** Checks the actual physical-body planner, stable result IDs and geometry signatures using constructed assemblies. Assertions cover input consumption, materials, grounding, shared inputs and joint provenance.

**Limits:** No OCCT rebuild or solver runs here; physical mass and motion are covered separately.

15. **[Boolean source parts never become duplicate physical bodies for either Hide inputs setting](../artifacts/kineticad/tests/assembly-simulation.test.mjs#L14)** — PASS, 3.485 ms.
   Checks include: <code>assert.deepEqual(plan.parts.map(p=&gt;p.id),[&#x27;witness&#x27;])</code>; <code>assert.deepEqual(plan.booleans.map(b=&gt;b.id),[&#x27;boolean:result&#x27;])</code>; <code>assert.deepEqual([...plan.consumed],[&#x27;tool&#x27;,&#x27;body&#x27;])</code>.

16. **[material inheritance uses the retained subtract body and requires uniform union/intersection inputs](../artifacts/kineticad/tests/assembly-simulation.test.mjs#L23)** — PASS, 1.130 ms.
   Checks include: <code>assert.equal(planAssemblySimulation(a).booleans[0].materialId,&#x27;steel-1018&#x27;)</code>; <code>assert.throws(()=&gt;planAssemblySimulation(a),/choose a finished solid material.*cannot be averaged/)</code>; <code>assert.equal(planAssemblySimulation(a).booleans[0].materialId,&#x27;titanium-grade5&#x27;)</code>.

17. **[unknown explicit result material fails instead of silently falling back to a default](../artifacts/kineticad/tests/assembly-simulation.test.mjs#L33)** — PASS, 0.093 ms.
   Checks include: <code>assert.equal(resolveBooleanMaterialId(a.booleanFeatures[0],a.parts),undefined)</code>; <code>assert.throws(()=&gt;planAssemblySimulation(a),/choose a finished solid material/)</code>.

18. **[result grounding is explicit; consumed/hidden input ground is not inherited or silently reassigned](../artifacts/kineticad/tests/assembly-simulation.test.mjs#L39)** — PASS, 1.639 ms.
   Checks include: <code>assert.throws(()=&gt;planAssemblySimulation(a),/fixed base.*hidden or consumed/)</code>; <code>assert.equal(planAssemblySimulation(a).groundId,undefined,&#x27;empty ground allows a free result&#x27;)</code>; <code>assert.equal(planAssemblySimulation(a).groundId,&#x27;boolean:result&#x27;)</code>.

19. **[an input reused by two finished Boolean bodies rejects ambiguous physical duplication](../artifacts/kineticad/tests/assembly-simulation.test.mjs#L47)** — PASS, 0.318 ms.
   Checks include: <code>assert.throws(()=&gt;planAssemblySimulation(a),/Second result.*another Boolean result/)</code>.

20. **[source joints are never migrated to new finished-body IDs or silently dropped](../artifacts/kineticad/tests/assembly-simulation.test.mjs#L52)** — PASS, 0.420 ms.
   Checks include: <code>assert.throws(()=&gt;planAssemblySimulation(a),/Old bearing.*hidden or consumed input/)</code>; <code>assert.throws(()=&gt;planAssemblySimulation(a),/Old bearing.*hidden or consumed input/)</code>.

21. **[new result joints require an exact geometry revision and become stale after native or transform edits](../artifacts/kineticad/tests/assembly-simulation.test.mjs#L58)** — PASS, 7.369 ms.
   Checks include: <code>assert.throws(()=&gt;planAssemblySimulation(a),/Result bearing.*changed since/)</code>; <code>assert.equal(planAssemblySimulation(a).booleans[0].hash,hash)</code>; <code>assert.throws(()=&gt;planAssemblySimulation(a),/Result bearing.*changed since/)</code>.

22. **[material/rename changes retain result joint geometry hashes and its stable synthetic identity](../artifacts/kineticad/tests/assembly-simulation.test.mjs#L68)** — PASS, 1.200 ms.
   Checks include: <code>assert.equal(planAssemblySimulation(a).booleans[0].id,id)</code>; <code>assert.equal(body.name,&#x27;Renamed result&#x27;)</code>; <code>assert.equal(body.materialId,&#x27;brass-c36000&#x27;)</code>.

23. **[native/Boolean identity collisions reject rather than replacing a source body](../artifacts/kineticad/tests/assembly-simulation.test.mjs#L77)** — PASS, 0.230 ms.
   Checks include: <code>assert.throws(()=&gt;planAssemblySimulation(a),/IDs collide/)</code>.

24. **[physical signatures exclude derived values and speed commands, while protecting geometry and joint structure](../artifacts/kineticad/tests/assembly-simulation.test.mjs#L82)** — PASS, 10.611 ms.
   Checks include: <code>assert.equal(assemblyPhysicsSignature(a),signature)</code>; <code>assert.notEqual(assemblyPhysicsSignature(changed),signature)</code>; <code>assert.equal(assemblyPhysicsSignature(slider),sliderSignature)</code>.

### beam-analysis.test.mjs

**7 passed · Pure engineering mathematics.** Checks the rectangular Euler–Bernoulli cantilever implementation against hand-calculated displacement, stress, reactions, curve values and scaling laws; checks eligibility and input rejection.

**Limits:** Linear, slender, small-deflection cantilever only. This is not general FEA, nonlinear deformation, buckling, fatigue or a certified failure prediction.

25. **[independent hand-calculated steel-like reference uses N/mm/GPa consistently](../artifacts/kineticad/tests/beam-analysis.test.mjs#L6)** — PASS, 1.557 ms.
   Checks include: <code>close(r.secondMomentMm4, 1666.6666666666667)</code>; <code>close(r.tipDeflectionMm, 0.27)</code>; <code>close(r.maxBendingStressMPa, 9)</code>.
   Assertion helpers: [close](../artifacts/kineticad/tests/beam-analysis.test.mjs#L5).

26. **[curve satisfies clamped/free-end solution and intermediate hand reference](../artifacts/kineticad/tests/beam-analysis.test.mjs#L13)** — PASS, 0.432 ms.
   Checks include: <code>close(r.curve[0].deflectionMm, 0)</code>; <code>close(r.curve.at(-1).deflectionMm, r.tipDeflectionMm)</code>; <code>close(r.curve[20].deflectionMm, r.tipDeflectionMm * 5 / 16)</code>.
   Assertion helpers: [close](../artifacts/kineticad/tests/beam-analysis.test.mjs#L5).

27. **[load reversal reverses displacement/reactions and retains stress magnitude](../artifacts/kineticad/tests/beam-analysis.test.mjs#L19)** — PASS, 0.653 ms.
   Checks include: <code>close(b.tipDeflectionMm, -2 * a.tipDeflectionMm)</code>; <code>close(b.clampForceN, -2 * a.clampForceN)</code>; <code>close(b.maxBendingStressMPa, 2 * a.maxBendingStressMPa)</code>.
   Assertion helpers: [close](../artifacts/kineticad/tests/beam-analysis.test.mjs#L5).

28. **[depth cubed, width, length cubed and modulus govern bending stiffness](../artifacts/kineticad/tests/beam-analysis.test.mjs#L25)** — PASS, 0.194 ms.
   Checks include: <code>close(analyseCantilever({ ...reference, depthMm: 20 }).tipDeflectionMm, a.tipDeflectionMm / 8)</code>; <code>close(analyseCantilever({ ...reference, widthMm: 40 }).tipDeflectionMm, a.tipDeflectionMm / 2)</code>; <code>close(analyseCantilever({ ...reference, lengthMm: 600 }).tipDeflectionMm, a.tipDeflectionMm * 8)</code>.
   Assertion helpers: [close](../artifacts/kineticad/tests/beam-analysis.test.mjs#L5).

29. **[elastic, slenderness and small-deflection failures are explicit](../artifacts/kineticad/tests/beam-analysis.test.mjs#L32)** — PASS, 0.292 ms.
   Checks include: <code>assert.match(analyseCantilever({ ...reference, elasticLimitMPa: 8 }).violations.join(&#x27; &#x27;), /elastic limit/)</code>; <code>assert.match(analyseCantilever({ ...reference, lengthMm: 100 }).violations.join(&#x27; &#x27;), /too short/)</code>; <code>assert.match(analyseCantilever({ ...reference, forceN: 1000, elasticLimitMPa: 1e5 }).violations.join(&#x27; &#x27;), /2%/)</code>.

30. **[missing/nonfinite/nonpositive material or geometry and overflow reject](../artifacts/kineticad/tests/beam-analysis.test.mjs#L37)** — PASS, 0.927 ms.
   Checks include: <code>assert.throws(() =&gt; analyseCantilever({ ...reference, [key]: value }))</code>.

31. **[eligible native dimensions respect sketch planes and exclude modified/imported/boolean shapes](../artifacts/kineticad/tests/beam-analysis.test.mjs#L42)** — PASS, 1.127 ms.
   Checks include: <code>assert.deepEqual(rectangularPartDimensions(part, assembly), { X: 300, Y: 20, Z: 10 })</code>; <code>assert.deepEqual(rectangularPartDimensions(part, assembly), { X: 300, Y: 10, Z: 20 })</code>; <code>assert.deepEqual(rectangularPartDimensions(part, assembly), { X: 10, Y: 300, Z: 20 })</code>.

### bench-elapsed-clock.test.mjs

**3 passed · Pure lifecycle logic.** Feeds explicit wall-clock timestamps into the engineering-bench elapsed clock and compares accumulated running time across pause/resume and irregular frames.

**Limits:** No real browser animation scheduler, background-tab throttling or rendering is exercised.

32. **[a paused background tab earns no simulation time when resumed before its next animation frame](../artifacts/kineticad/tests/bench-elapsed-clock.test.mjs#L5)** — PASS, 1.394 ms.
   Checks include: <code>assert.equal(clock.advance(100), 0)</code>; <code>assert.equal(clock.advance(116), 16)</code>; <code>assert.equal(clock.advance(600116), 0)</code>.

33. **[delayed first play and ordinary paused frames cannot consume a short test window](../artifacts/kineticad/tests/bench-elapsed-clock.test.mjs#L17)** — PASS, 0.286 ms.
   Checks include: <code>assert.equal(clock.advance(0), 0)</code>; <code>assert.equal(clock.advance(600000), 0)</code>; <code>assert.equal(clock.advance(600010), 10)</code>.

34. **[running cadence partitions retain elapsed time while repeated play calls do not reset the clock](../artifacts/kineticad/tests/bench-elapsed-clock.test.mjs#L31)** — PASS, 0.589 ms.
   Checks include: <code>assert.equal(regularMs, 50)</code>; <code>assert.equal(irregularMs, regularMs)</code>; <code>assert.throws(() =&gt; irregular.advance(NaN), /finite/)</code>.

### boolean-bodies.test.mjs

**10 passed · Controlled CAD adapter.** Exercises actual regeneration/hash/cache code with controlled asynchronous CAD responses. Checks immutable inputs, full source revisions, kernel isolation, pending sharing, retry and cache-clear generations.

**Limits:** The CAD responses are test doubles. This file does not establish BRep validity or inertia accuracy.

35. **[concurrent physical preparations dispatch one exact ordered, immutable full-chain snapshot](../artifacts/kineticad/tests/boolean-bodies.test.mjs#L25)** — PASS, 4.658 ms.
   Checks include: <code>assert.equal(c.calls.length,1)</code>; <code>assert.deepEqual(c.calls[0].args.inputs.map(p=&gt;p.partId),[&#x27;body&#x27;,&#x27;tool&#x27;])</code>; <code>assert.deepEqual(c.calls[0].args.inputs[0].features,p[0].features)</code>.

36. **[material/display-only changes reuse unit-density properties without changing the geometric result](../artifacts/kineticad/tests/boolean-bodies.test.mjs#L42)** — PASS, 2.096 ms.
   Checks include: <code>assert.equal(c.calls.length,1)</code>; <code>assert.equal(result.mesh,body.mesh)</code>; <code>assert.equal(scaled.massKg,0.0085)</code>.

37. **[settled and pending body caches remain independent across CAD worker instances](../artifacts/kineticad/tests/boolean-bodies.test.mjs#L54)** — PASS, 3.760 ms.
   Checks include: <code>assert.equal(b.calls.length,1)</code>; <code>assert.equal(b.calls.length,1)</code>; <code>assert.equal((await second).mesh.positions[0],2)</code>.

38. **[native edits, imported asset identity, Boolean operation and exact sub-0.0001 transforms invalidate geometry](../artifacts/kineticad/tests/boolean-bodies.test.mjs#L63)** — PASS, 4.675 ms.
   Checks include: <code>assert.notEqual(computeBooleanHash(f,p),computeBooleanHash(f,edited))</code>; <code>assert.equal(c.calls.length,2)</code>; <code>assert.equal((await original).mesh.positions[0],1)</code>.

39. **[display cache and its valid compound mesh cannot certify a physical single-solid body](../artifacts/kineticad/tests/boolean-bodies.test.mjs#L86)** — PASS, 4.824 ms.
   Checks include: <code>assert.equal(c.calls.length,1)</code>; <code>assert.rejects(request,/Finished housing.*2 disconnected solids/)</code>; <code>assert.equal((await regenerateBoolean(f,p,c.kernel)).mesh.positions[0],12)</code>.

40. **[shared failures retain each caller name and later attempts retry instead of caching an error](../artifacts/kineticad/tests/boolean-bodies.test.mjs#L96)** — PASS, 1.729 ms.
   Checks include: <code>assert.rejects(a,/Finished housing.*empty-result/)</code>; <code>assert.rejects(b,/Named cover.*empty-result/)</code>; <code>assert.equal(c.calls.length,1)</code>.

41. **[explicit cache reset separates pending generations and prevents old completions overwriting fresh bodies](../artifacts/kineticad/tests/boolean-bodies.test.mjs#L104)** — PASS, 0.389 ms.
   Checks include: <code>assert.equal(c.calls.length,2)</code>; <code>assert.equal((await regenerateBooleanBody(f,p,c.kernel)).mesh.positions[0],2)</code>; <code>assert.equal(c.calls.length,2)</code>.

42. **[invalid input configuration fails with a named error before contacting CAD](../artifacts/kineticad/tests/boolean-bodies.test.mjs#L114)** — PASS, 1.219 ms.
   Checks include: <code>assert.rejects(regenerateBooleanBody(f,p,c.kernel),/Cannot simulate Boolean &quot;Finished housing&quot;/)</code>; <code>assert.equal(c.calls.length,0)</code>.

43. **[preview regeneration shares pending operations, keeps worker-scoped settled results and retries failures](../artifacts/kineticad/tests/boolean-bodies.test.mjs#L126)** — PASS, 1.246 ms.
   Checks include: <code>assert.equal(c.previews.length,1)</code>; <code>assert.match(result.error,/preview build failed/)</code>; <code>assert.equal(c.previews.length,2)</code>.

44. **[the shared argument builder preserves source arrays and supports canonical object-key order](../artifacts/kineticad/tests/boolean-bodies.test.mjs#L136)** — PASS, 0.638 ms.
   Checks include: <code>assert.equal(computeBooleanHash(f,reordered),hash)</code>; <code>assert.equal(p[0].sketches[0].primitives[0].corner[0],0)</code>.

### boolean-mate-store.test.mjs

**9 passed · Actual store / controlled topology.** Uses the real Zustand store and project parser with controlled result-topology snapshots. Checks ground defaults, migration, picked result IDs/revisions, stale edits, deletion and Save/parse preservation.

**Limits:** Topology is supplied by a test adapter; no browser picking, OCCT rebuild or physical joint solve runs here.

45. **[ground badges match explicit Boolean anchoring while preserving native-only first-part defaults](../artifacts/kineticad/tests/boolean-mate-store.test.mjs#L42)** — PASS, 2.008 ms.
   Checks include: <code>assert.equal(getEffectiveGroundBodyId(model),&#x27;&#x27;,&#x27;a free Boolean result does not ground its first input&#x27;)</code>; <code>assert.equal(getEffectiveGroundBodyId(model),resultId)</code>; <code>assert.equal(getEffectiveGroundBodyId(model),&#x27;support&#x27;)</code>.

46. **[creating or importing a part preserves an explicitly free Boolean assembly](../artifacts/kineticad/tests/boolean-mate-store.test.mjs#L51)** — PASS, 1.014 ms.
   Checks include: <code>assert.ok(assembly.parts.some(part=&gt;part.id===id),&#x27;the new part was committed&#x27;)</code>; <code>assert.equal(assembly.groundPartId,&#x27;&#x27;,&#x27;adding geometry does not silently fix a body&#x27;)</code>; <code>assert.equal(getEffectiveGroundBodyId(assembly),&#x27;&#x27;)</code>.

47. **[native creation/import retain default promotion and preserve an already selected ground](../artifacts/kineticad/tests/boolean-mate-store.test.mjs#L62)** — PASS, 2.571 ms.
   Checks include: <code>assert.equal(store.getState().assembly.groundPartId,first,&#x27;first native part retains existing auto-ground behavior&#x27;)</code>; <code>assert.notEqual(first,second)</code>; <code>assert.equal(store.getState().assembly.groundPartId,first,&#x27;later native parts cannot replace the chosen ground&#x27;)</code>.

48. **[legacy v8/v9 migration preserves free Boolean worlds and the native-only ground default](../artifacts/kineticad/tests/boolean-mate-store.test.mjs#L77)** — PASS, 3.405 ms.
   Checks include: <code>assert.equal(migratedFree.assembly.groundPartId,&#x27;&#x27;,&#x27;a free result must not fix its consumed first input&#x27;)</code>; <code>assert.equal(getEffectiveGroundBodyId(migratedFree.assembly),&#x27;&#x27;)</code>; <code>assert.equal(migratedNative.assembly.groundPartId,native.assembly.parts[0].id,&#x27;native legacy default is preserved&#x27;)</code>.

49. **[actual Apply persists picked result IDs and geometry revision through Save/parse and Edit](../artifacts/kineticad/tests/boolean-mate-store.test.mjs#L93)** — PASS, 15.732 ms.
   Checks include: <code>assert.ok(mate)</code>; <code>assert.equal(mate.partA,resultId)</code>; <code>assert.equal(mate.partB,&#x27;support&#x27;)</code>.

50. **[geometry changed between picking and Apply rejects creation without relabelling the old attachment](../artifacts/kineticad/tests/boolean-mate-store.test.mjs#L106)** — PASS, 0.544 ms.
   Checks include: <code>assert.notEqual(currentHash(),hashAtPick[resultId])</code>; <code>assert.deepEqual(store.getState().assembly.mates,[])</code>; <code>assert.equal(store.getState().mateEditor.open,true)</code>.

51. **[name-only or motor-only Apply cannot revive a stale saved mate without repicking its geometry](../artifacts/kineticad/tests/boolean-mate-store.test.mjs#L114)** — PASS, 0.812 ms.
   Checks include: <code>assert.deepEqual(state.mateEditor.params.booleanGeometryHashes,before.booleanGeometryHashes)</code>; <code>assert.match(store.getState().mateEditor.error,/changed after its attachment was picked/)</code>; <code>assert.deepEqual(store.getState().assembly.mates[0],before)</code>.

52. **[an unchanged attachment permits normal edits while a missing geometry snapshot is rejected](../artifacts/kineticad/tests/boolean-mate-store.test.mjs#L127)** — PASS, 1.361 ms.
   Checks include: <code>assert.equal(store.getState().assembly.mates.length,0)</code>; <code>assert.match(store.getState().mateEditor.error,/Pick the attachment again/)</code>; <code>assert.equal(store.getState().mateEditor.open,false)</code>.

53. **[deleting an input cascades through result joints while retaining unrelated native joints](../artifacts/kineticad/tests/boolean-mate-store.test.mjs#L138)** — PASS, 0.881 ms.
   Checks include: <code>assert.deepEqual(store.getState().assembly.booleanFeatures,[])</code>; <code>assert.deepEqual(store.getState().assembly.mates.map(mate=&gt;mate.id),[&#x27;retained&#x27;])</code>; <code>assert.equal(store.getState().assembly.groundPartId,&#x27;&#x27;)</code>.

### boolean-physics.test.mjs

**15 passed · Real OCCT + Rapier workers.** Builds final Boolean bodies with the shipped CAD worker and tests exact analytic volume, COM and full inertia, including transformed and imported inputs. Then runs actual Rapier free fall, force and passive-hinge checks.

**Limits:** Only one connected result solid is admitted. Listed analytic fixtures do not establish arbitrary topology, automatic mating after geometry edits, general collision/contact or finite motor capacity.

54. **[union-identity: final solid mesh, volume, COM and all tensor components agree with independent geometry](../artifacts/kineticad/tests/boolean-physics.test.mjs#L141)** — PASS, 9222.453 ms.
   Checks include: <code>close(props.volumeMm3, item.reference.volumeMm3, limits.volumeMm3, &#x27;exact volume&#x27;)</code>; <code>close(props.massKg, item.reference.massKg, limits.massKg, &#x27;unit-density mass&#x27;)</code>; <code>close(v, expectedCentre[i], limits.centroidMm, &#x27;world-frame COM&#x27;)</code>.
   Assertion helpers: [close](../artifacts/kineticad/tests/boolean-physics.test.mjs#L54).

55. **[subtract-identity: final solid mesh, volume, COM and all tensor components agree with independent geometry](../artifacts/kineticad/tests/boolean-physics.test.mjs#L141)** — PASS, 103.034 ms.
   Checks include: <code>close(props.volumeMm3, item.reference.volumeMm3, limits.volumeMm3, &#x27;exact volume&#x27;)</code>; <code>close(props.massKg, item.reference.massKg, limits.massKg, &#x27;unit-density mass&#x27;)</code>; <code>close(v, expectedCentre[i], limits.centroidMm, &#x27;world-frame COM&#x27;)</code>.
   Assertion helpers: [close](../artifacts/kineticad/tests/boolean-physics.test.mjs#L54).

56. **[intersect-identity: final solid mesh, volume, COM and all tensor components agree with independent geometry](../artifacts/kineticad/tests/boolean-physics.test.mjs#L141)** — PASS, 86.632 ms.
   Checks include: <code>close(props.volumeMm3, item.reference.volumeMm3, limits.volumeMm3, &#x27;exact volume&#x27;)</code>; <code>close(props.massKg, item.reference.massKg, limits.massKg, &#x27;unit-density mass&#x27;)</code>; <code>close(v, expectedCentre[i], limits.centroidMm, &#x27;world-frame COM&#x27;)</code>.
   Assertion helpers: [close](../artifacts/kineticad/tests/boolean-physics.test.mjs#L54).

57. **[off-centre-cut-identity: final solid mesh, volume, COM and all tensor components agree with independent geometry](../artifacts/kineticad/tests/boolean-physics.test.mjs#L141)** — PASS, 80.944 ms.
   Checks include: <code>close(props.volumeMm3, item.reference.volumeMm3, limits.volumeMm3, &#x27;exact volume&#x27;)</code>; <code>close(props.massKg, item.reference.massKg, limits.massKg, &#x27;unit-density mass&#x27;)</code>; <code>close(v, expectedCentre[i], limits.centroidMm, &#x27;world-frame COM&#x27;)</code>.
   Assertion helpers: [close](../artifacts/kineticad/tests/boolean-physics.test.mjs#L54).

58. **[union-mixed-rotation: final solid mesh, volume, COM and all tensor components agree with independent geometry](../artifacts/kineticad/tests/boolean-physics.test.mjs#L141)** — PASS, 103.438 ms.
   Checks include: <code>close(props.volumeMm3, item.reference.volumeMm3, limits.volumeMm3, &#x27;exact volume&#x27;)</code>; <code>close(props.massKg, item.reference.massKg, limits.massKg, &#x27;unit-density mass&#x27;)</code>; <code>close(v, expectedCentre[i], limits.centroidMm, &#x27;world-frame COM&#x27;)</code>.
   Assertion helpers: [close](../artifacts/kineticad/tests/boolean-physics.test.mjs#L54).

59. **[subtract-mixed-rotation: final solid mesh, volume, COM and all tensor components agree with independent geometry](../artifacts/kineticad/tests/boolean-physics.test.mjs#L141)** — PASS, 79.022 ms.
   Checks include: <code>close(props.volumeMm3, item.reference.volumeMm3, limits.volumeMm3, &#x27;exact volume&#x27;)</code>; <code>close(props.massKg, item.reference.massKg, limits.massKg, &#x27;unit-density mass&#x27;)</code>; <code>close(v, expectedCentre[i], limits.centroidMm, &#x27;world-frame COM&#x27;)</code>.
   Assertion helpers: [close](../artifacts/kineticad/tests/boolean-physics.test.mjs#L54).

60. **[intersect-mixed-rotation: final solid mesh, volume, COM and all tensor components agree with independent geometry](../artifacts/kineticad/tests/boolean-physics.test.mjs#L141)** — PASS, 70.973 ms.
   Checks include: <code>close(props.volumeMm3, item.reference.volumeMm3, limits.volumeMm3, &#x27;exact volume&#x27;)</code>; <code>close(props.massKg, item.reference.massKg, limits.massKg, &#x27;unit-density mass&#x27;)</code>; <code>close(v, expectedCentre[i], limits.centroidMm, &#x27;world-frame COM&#x27;)</code>.
   Assertion helpers: [close](../artifacts/kineticad/tests/boolean-physics.test.mjs#L54).

61. **[off-centre-cut-mixed-rotation: final solid mesh, volume, COM and all tensor components agree with independent geometry](../artifacts/kineticad/tests/boolean-physics.test.mjs#L141)** — PASS, 62.280 ms.
   Checks include: <code>close(props.volumeMm3, item.reference.volumeMm3, limits.volumeMm3, &#x27;exact volume&#x27;)</code>; <code>close(props.massKg, item.reference.massKg, limits.massKg, &#x27;unit-density mass&#x27;)</code>; <code>close(v, expectedCentre[i], limits.centroidMm, &#x27;world-frame COM&#x27;)</code>.
   Assertion helpers: [close](../artifacts/kineticad/tests/boolean-physics.test.mjs#L54).

62. **[empty and disconnected Boolean bodies reject while ordinary Boolean compounds and later valid calls remain usable](../artifacts/kineticad/tests/boolean-physics.test.mjs#L168)** — PASS, 139.495 ms.
   Checks include: <code>close(meshVolume(compound), 12000, 1e-5, &#x27;ordinary CAD union still supports two disconnected solids&#x27;)</code>; <code>close(valid.massProperties.volumeMm3, 9000, limits.volumeMm3, &#x27;retry after failure&#x27;)</code>; <code>assert.rejects(cad.buildBooleanBody(disconnected), /solid&#124;connect/i)</code>.
   Assertion helpers: [close](../artifacts/kineticad/tests/boolean-physics.test.mjs#L54).

63. **[sub-four-decimal input translation changes final mesh and exact properties instead of reusing rounded geometry](../artifacts/kineticad/tests/boolean-physics.test.mjs#L182)** — PASS, 171.812 ms.
   Checks include: <code>close(measuredVolumeChange, expectedVolumeChange, limits.volumeMm3, &#x27;small-translation volume difference&#x27;)</code>; <code>assert.notDeepEqual(changed.mesh.positions, original.mesh.positions)</code>.
   Assertion helpers: [close](../artifacts/kineticad/tests/boolean-physics.test.mjs#L54).

64. **[a transformed imported STEP source and native cutter produce the analytic final body without changing the registered source](../artifacts/kineticad/tests/boolean-physics.test.mjs#L193)** — PASS, 763.607 ms.
   Checks include: <code>close(beforeMass.volumeMm3, 24000, limits.volumeMm3, &#x27;registered STEP source volume&#x27;)</code>; <code>close(v, [10, 15, 20][i], limits.centroidMm, &#x27;registered source stays in local coordinates&#x27;)</code>; <code>close(props.volumeMm3, nativeCase.reference.volumeMm3, limits.volumeMm3, &#x27;imported/native final volume&#x27;)</code>.
   Assertion helpers: [close](../artifacts/kineticad/tests/boolean-physics.test.mjs#L54).

65. **[actual Boolean bodies fall with mass-independent gravity using their baked world geometry once](../artifacts/kineticad/tests/boolean-physics.test.mjs#L262)** — PASS, 81.946 ms.
   Checks include: <code>close(end.simulatedTimeMs, 1000, 1e-9, &#x27;actual clock&#x27;)</code>; <code>close(body.massKg, part.massKg, 2e-8, &#x27;actual Rapier body mass&#x27;)</code>; <code>close(body.linearVelocityMmPerSec[2], -G, limits.freefallVelocityMmPerSec, &#x27;fall velocity&#x27;)</code>.
   Assertion helpers: [buildPhysics](../artifacts/kineticad/tests/boolean-physics.test.mjs#L253), [close](../artifacts/kineticad/tests/boolean-physics.test.mjs#L54), [pose](../artifacts/kineticad/tests/boolean-physics.test.mjs#L260), [reading](../artifacts/kineticad/tests/boolean-physics.test.mjs#L259).

66. **[equal COM forces measure acceleration from each final Boolean mass without adding torque](../artifacts/kineticad/tests/boolean-physics.test.mjs#L283)** — PASS, 62.207 ms.
   Checks include: <code>close(v, 0, 1e-6, &#x27;COM force has no torque&#x27;)</code>; <code>close(maximumAccelerationRelativeError, 0, limits.forceAccelerationRelative, &#x27;acceleration inferred from actual consecutive velocities&#x27;)</code>; <code>close(actual.linearVelocityMmPerSec[1], acceleration, acceleration * limits.forceAccelerationRelative, &#x27;velocity F t/m&#x27;)</code>.
   Assertion helpers: [buildPhysics](../artifacts/kineticad/tests/boolean-physics.test.mjs#L253), [reading](../artifacts/kineticad/tests/boolean-physics.test.mjs#L259), [close](../artifacts/kineticad/tests/boolean-physics.test.mjs#L54).

67. **[grounded Boolean stays fixed, zero-time readback pauses, and rebuilding restores original poses](../artifacts/kineticad/tests/boolean-physics.test.mjs#L314)** — PASS, 5.416 ms.
   Checks include: <code>assert.deepEqual(pose(end, fixed.id), pose(start, fixed.id))</code>; <code>assert.ok(pose(end, moving.id).positionMm[2] &lt; -100)</code>; <code>assert.equal(paused.dtMs, 0)</code>.
   Assertion helpers: [buildPhysics](../artifacts/kineticad/tests/boolean-physics.test.mjs#L253), [pose](../artifacts/kineticad/tests/boolean-physics.test.mjs#L260).

68. **[passive hinged Boolean follows its anisotropic final inertia and improves with timestep refinement](../artifacts/kineticad/tests/boolean-physics.test.mjs#L345)** — PASS, 33.400 ms.
   Checks include: <code>close(angle, reference.angle, limits.pendulumAngleRad, &#x27;passive nonlinear pendulum angle&#x27;)</code>; <code>close(body.angularVelocityRadPerSec[1], reference.velocity, limits.pendulumSpeedRadPerSec, &#x27;passive nonlinear pendulum angular speed&#x27;)</code>; <code>close(maximumClosureMm, 0, limits.pendulumClosureMm, &#x27;revolute anchor closure&#x27;)</code>.
   Assertion helpers: [buildPhysics](../artifacts/kineticad/tests/boolean-physics.test.mjs#L253), [pose](../artifacts/kineticad/tests/boolean-physics.test.mjs#L260), [reading](../artifacts/kineticad/tests/boolean-physics.test.mjs#L259), [close](../artifacts/kineticad/tests/boolean-physics.test.mjs#L54).

### boolean-result-picking.test.mjs

**9 passed · Actual Three.js / controlled CAD.** Exercises real result-layer and topology-picker code with Three.js geometry, controlled CAD promises and minimal DOM adapters. Checks current revisions, lifecycle, transforms and single-solid mate eligibility.

**Limits:** No native browser pointer, hover, focus or rendered visual acceptance is implied.

69. **[result body IDs and material inference preserve native frames without remapping inputs](../artifacts/kineticad/tests/boolean-result-picking.test.mjs#L36)** — PASS, 2.582 ms.
   Checks include: <code>assert.equal(booleanBodyId(&#x27;fuse&#x27;),&#x27;boolean:fuse&#x27;)</code>; <code>assert.equal(getAssemblyBody(model,&#x27;a&#x27;),model.parts[0])</code>; <code>assert.equal(body.id,&#x27;boolean:fuse&#x27;)</code>.

70. **[Boolean layer exposes identity mesh/topology/current hash and changes material without geometry regeneration](../artifacts/kineticad/tests/boolean-result-picking.test.mjs#L58)** — PASS, 18.974 ms.
   Checks include: <code>near(mesh.position.toArray(),[0,0,0])</code>; <code>near(mesh.rotation.toArray().slice(0,3),[0,0,0])</code>; <code>assert.equal(calls.length,1,&#x27;identical pending syncs share one operation&#x27;)</code>.
   Assertion helpers: [near](../artifacts/kineticad/tests/boolean-result-picking.test.mjs#L14).

71. **[source edits invalidate result picking immediately and older async geometry cannot replace the current revision](../artifacts/kineticad/tests/boolean-result-picking.test.mjs#L82)** — PASS, 13.763 ms.
   Checks include: <code>assert.equal(layer.getPartMesh(&#x27;boolean:fuse&#x27;),null)</code>; <code>assert.equal(layer.getPartTopology(&#x27;boolean:fuse&#x27;),null)</code>; <code>assert.equal(layer.getPartMesh(&#x27;boolean:fuse&#x27;),newest)</code>.

72. **[reverting an in-flight result edit restores complete cached topology; late failure and disposed results stay unavailable](../artifacts/kineticad/tests/boolean-result-picking.test.mjs#L100)** — PASS, 5.100 ms.
   Checks include: <code>assert.ok(layer.getPartTopology(&#x27;boolean:fuse&#x27;))</code>; <code>assert.ok(layer.getPartMesh(&#x27;boolean:fuse&#x27;))</code>; <code>assert.ok(layer.getPartTopology(&#x27;boolean:fuse&#x27;))</code>.

73. **[disconnected or unverified Boolean meshes remain visible but cannot supply mate topology or attachment hashes](../artifacts/kineticad/tests/boolean-result-picking.test.mjs#L111)** — PASS, 4.246 ms.
   Checks include: <code>assert.ok(layer.getPartMesh(&#x27;boolean:fuse&#x27;),&#x27;rendering remains available&#x27;)</code>; <code>assert.equal(layer.getPartTopology(&#x27;boolean:fuse&#x27;),null)</code>; <code>assert.deepEqual(candidates,[])</code>.

74. **[attachment hashes capture only the actual picked revision and preserve the opposite body snapshot](../artifacts/kineticad/tests/boolean-result-picking.test.mjs#L124)** — PASS, 3.613 ms.
   Checks include: <code>assert.notEqual(picked,prior)</code>; <code>assert.deepEqual(prior,{&#x27;boolean:other&#x27;:&#x27;other-picked-revision&#x27;})</code>; <code>assert.equal(captureBooleanGeometryHash(&#x27;native&#x27;,picked),picked,&#x27;a native pick cannot refresh result anchors&#x27;)</code>.

75. **[edge proximity and hover follow the full native XYZ transform instead of its old local position](../artifacts/kineticad/tests/boolean-result-picking.test.mjs#L177)** — PASS, 5.505 ms.
   Checks include: <code>near([...ctx.hover.edge.slice(0,3)],placed([-5,-5,0],rotation,translation))</code>; <code>near([...ctx.hover.edge.slice(3,6)],placed([5,-5,0],rotation,translation))</code>; <code>assert.equal(ctx.store.getState().selection.partId,&#x27;native&#x27;)</code>.
   Assertion helpers: [near](../artifacts/kineticad/tests/boolean-result-picking.test.mjs#L14).

76. **[native transformed face hover is world-correct and two-click point picking retains local face UV](../artifacts/kineticad/tests/boolean-result-picking.test.mjs#L190)** — PASS, 3.595 ms.
   Checks include: <code>near([...ctx.hover.face.positions.slice(0,3)],placed([-5,-5,0],rotation,translation))</code>; <code>near(selection.uv,[2,1])</code>; <code>near([...direct.slice(6,9)],placed([5,5,0],rotation,translation))</code>.
   Assertion helpers: [near](../artifacts/kineticad/tests/boolean-result-picking.test.mjs#L14).

77. **[world-baked Boolean face picks use stable body IDs once and are excluded outside mate editing](../artifacts/kineticad/tests/boolean-result-picking.test.mjs#L205)** — PASS, 4.043 ms.
   Checks include: <code>near([...ctx.hover.face.positions.slice(0,3)],[15,-5,10])</code>; <code>near(ctx.store.getState().selection.uv,[2,1])</code>; <code>assert.equal(ctx.store.getState().selection.partId,&#x27;boolean:fuse&#x27;)</code>.
   Assertion helpers: [near](../artifacts/kineticad/tests/boolean-result-picking.test.mjs#L14).

### cad-operations.test.mjs

**11 passed · Real OCCT operations.** Executes the real sketch/extrude/revolve/fillet/chamfer/hole/Boolean modules and measures analytic volumes, centroids, dimensions and unchanged input ownership.

**Limits:** A bounded operation matrix, not proof that every edge selection, sketch topology or arbitrary Boolean will succeed.

78. **[XY extrude forward/backward/symmetric preserves exact dimensions, centre and detached mesh](../artifacts/kineticad/tests/cad-operations.test.mjs#L60)** — PASS, 8184.755 ms.
   Checks include: <code>close(props.comLocal[axis], (expectedMin[axis] + expectedMax[axis]) / 2)</code>; <code>close(actualBounds[0][axis], expectedMin[axis])</code>; <code>close(actualBounds[1][axis], expectedMax[axis])</code>.
   Assertion helpers: [properties](../artifacts/kineticad/tests/cad-operations.test.mjs#L27), [close](../artifacts/kineticad/tests/cad-operations.test.mjs#L20).

79. **[XZ extrude forward/backward/symmetric preserves exact dimensions, centre and detached mesh](../artifacts/kineticad/tests/cad-operations.test.mjs#L60)** — PASS, 77.084 ms.
   Checks include: <code>close(props.comLocal[axis], (expectedMin[axis] + expectedMax[axis]) / 2)</code>; <code>close(actualBounds[0][axis], expectedMin[axis])</code>; <code>close(actualBounds[1][axis], expectedMax[axis])</code>.
   Assertion helpers: [properties](../artifacts/kineticad/tests/cad-operations.test.mjs#L27), [close](../artifacts/kineticad/tests/cad-operations.test.mjs#L20).

80. **[YZ extrude forward/backward/symmetric preserves exact dimensions, centre and detached mesh](../artifacts/kineticad/tests/cad-operations.test.mjs#L60)** — PASS, 72.310 ms.
   Checks include: <code>close(props.comLocal[axis], (expectedMin[axis] + expectedMax[axis]) / 2)</code>; <code>close(actualBounds[0][axis], expectedMin[axis])</code>; <code>close(actualBounds[1][axis], expectedMax[axis])</code>.
   Assertion helpers: [properties](../artifacts/kineticad/tests/cad-operations.test.mjs#L27), [close](../artifacts/kineticad/tests/cad-operations.test.mjs#L20).

81. **[quarter-turn revolve keeps analytical annular-sector volume and centroid](../artifacts/kineticad/tests/cad-operations.test.mjs#L85)** — PASS, 95.708 ms.
   Checks include: <code>close(props.comLocal[0], xyCentroid)</code>; <code>close(props.comLocal[1], xyCentroid)</code>; <code>close(props.comLocal[2], 3.5)</code>.
   Assertion helpers: [properties](../artifacts/kineticad/tests/cad-operations.test.mjs#L27), [close](../artifacts/kineticad/tests/cad-operations.test.mjs#L20).

82. **[single-edge fillet removes square-minus-quarter-circle volume and leaves its input unchanged](../artifacts/kineticad/tests/cad-operations.test.mjs#L97)** — PASS, 264.453 ms.
   Checks include: <code>verticalEdge(refs)</code>; <code>properties(result, 24000 - (4 - Math.PI) * 40)</code>; <code>properties(shape, 24000)</code>.
   Assertion helpers: [verticalEdge](../artifacts/kineticad/tests/cad-operations.test.mjs#L47), [properties](../artifacts/kineticad/tests/cad-operations.test.mjs#L27).

83. **[single-edge chamfer removes an exact triangular prism and leaves its input unchanged](../artifacts/kineticad/tests/cad-operations.test.mjs#L107)** — PASS, 46.832 ms.
   Checks include: <code>verticalEdge(refs)</code>; <code>properties(result, 24000 - 2 * 40)</code>; <code>properties(shape, 24000)</code>.
   Assertion helpers: [verticalEdge](../artifacts/kineticad/tests/cad-operations.test.mjs#L47), [properties](../artifacts/kineticad/tests/cad-operations.test.mjs#L27).

84. **[all six face pick bases drill inward for blind holes and span the correct dimension for through holes](../artifacts/kineticad/tests/cad-operations.test.mjs#L117)** — PASS, 1075.211 ms.
   Checks include: <code>assert.equal(faces.length, 6)</code>; <code>assert.ok(face.planeBasis &amp;&amp; refs.has(face.id))</code>; <code>assert.ok(axis &gt;= 0)</code>.
   Assertion helpers: [properties](../artifacts/kineticad/tests/cad-operations.test.mjs#L27).

85. **[Boolean union matches overlapping-box volume and preserves both input solids](../artifacts/kineticad/tests/cad-operations.test.mjs#L142)** — PASS, 114.154 ms.
   Checks include: <code>properties(result, expectedVolume)</code>; <code>properties(a, 6000)</code>; <code>properties(b, 6000)</code>.
   Assertion helpers: [properties](../artifacts/kineticad/tests/cad-operations.test.mjs#L27).

86. **[Boolean subtract matches overlapping-box volume and preserves both input solids](../artifacts/kineticad/tests/cad-operations.test.mjs#L142)** — PASS, 66.441 ms.
   Checks include: <code>properties(result, expectedVolume)</code>; <code>properties(a, 6000)</code>; <code>properties(b, 6000)</code>.
   Assertion helpers: [properties](../artifacts/kineticad/tests/cad-operations.test.mjs#L27).

87. **[Boolean intersect matches overlapping-box volume and preserves both input solids](../artifacts/kineticad/tests/cad-operations.test.mjs#L142)** — PASS, 60.258 ms.
   Checks include: <code>properties(result, expectedVolume)</code>; <code>properties(a, 6000)</code>; <code>properties(b, 6000)</code>.
   Assertion helpers: [properties](../artifacts/kineticad/tests/cad-operations.test.mjs#L27).

88. **[invalid dimensions, missing picks, non-solid inputs and empty booleans fail without consuming originals](../artifacts/kineticad/tests/cad-operations.test.mjs#L153)** — PASS, 29.604 ms.
   Checks include: <code>assert.throws(() =&gt; applyFillet(oc, a, refs, [verticalEdge(refs)], radius), /radius must be positive/)</code>; <code>assert.throws(() =&gt; applyChamfer(oc, a, refs, [verticalEdge(refs)], radius), /size must be positive/)</code>; <code>assert.throws(() =&gt; applyFillet(oc, a, refs, [&#x27;deleted-edge&#x27;], 2), /edge-not-found/)</code>.
   Assertion helpers: [verticalEdge](../artifacts/kineticad/tests/cad-operations.test.mjs#L47), [properties](../artifacts/kineticad/tests/cad-operations.test.mjs#L27).

### contact-bench.test.mjs

**9 passed · Real Rapier bench.** Runs an exact cuboid on a guided planar bed. Calibrates normal and tangential impulses against momentum, mg and Coulomb friction; checks stopping distance, energy and step-size convergence.

**Limits:** Straight guided sliding contact only. Tangential impulse magnitudes are not a general arbitrary-contact resultant; there are no CAD holes, arbitrary assembly collisions or deformable contacts.

89. **[step zero reads the actual initial body without advancing, and disposal prevents further use](../artifacts/kineticad/tests/contact-bench.test.mjs#L14)** — PASS, 78.330 ms.
   Checks include: <code>assert.deepEqual(first, second)</code>; <code>assert.equal(first.steps, 0)</code>; <code>assert.deepEqual(first.body.positionMm, [0, 0, 20])</code>.

90. **[resting cuboid has measured contact support equal to weight, without horizontal force](../artifacts/kineticad/tests/contact-bench.test.mjs#L27)** — PASS, 69.709 ms.
   Checks include: <code>close(snapshot.contact.normalForceN, 19.62, 0.0001)</code>; <code>close(snapshot.contact.frictionForceN, 0, 1e-7)</code>; <code>close(snapshot.body.positionMm[0], 0, 1e-8)</code>.
   Assertion helpers: [close](../artifacts/kineticad/tests/contact-bench.test.mjs#L12).

91. **[frictionless contact preserves horizontal velocity and kinetic energy while supporting weight](../artifacts/kineticad/tests/contact-bench.test.mjs#L39)** — PASS, 59.177 ms.
   Checks include: <code>close(snapshot.body.linearVelocityMmPerSec[0], 1000, 1e-5)</code>; <code>close(snapshot.body.positionMm[0], snapshot.simulatedTimeMs, 0.01)</code>; <code>close(snapshot.energy.kineticJ, 1, 1e-7)</code>.
   Assertion helpers: [close](../artifacts/kineticad/tests/contact-bench.test.mjs#L12).

92. **[Coulomb sliding stops within the fixed-step integration bound and contact impulses match momentum](../artifacts/kineticad/tests/contact-bench.test.mjs#L49)** — PASS, 29.146 ms.
   Checks include: <code>close(snapshot.body.linearVelocityMmPerSec[0], snapshot.reference.velocityXMmPerSec, 0.5)</code>; <code>close(snapshot.body.positionMm[0], snapshot.reference.positionXMm, 1000 * stepSeconds / 2 + 0.5)</code>; <code>close(snapshot.contact.penetrationMm, snapshot.contact.geometricPenetrationMm, 1e-5)</code>.
   Assertion helpers: [close](../artifacts/kineticad/tests/contact-bench.test.mjs#L12).

93. **[halving the timestep converges in stopping distance and penetration at 60, 120 and 240 Hz](../artifacts/kineticad/tests/contact-bench.test.mjs#L71)** — PASS, 31.828 ms.
   Checks include: <code>assert.ok(results[i].error &lt; results[i - 1].error * 0.55)</code>; <code>assert.ok(results[i].penetration &lt; results[i - 1].penetration * 0.4)</code>.

94. **[material mass changes support force but not Coulomb deceleration; increasing friction shortens travel](../artifacts/kineticad/tests/contact-bench.test.mjs#L84)** — PASS, 9.226 ms.
   Checks include: <code>close(light.at(-1).body.positionMm[0], heavy.at(-1).body.positionMm[0], 0.01)</code>; <code>close(heavy.at(-1).contact.normalForceN / light.at(-1).contact.normalForceN, 5, 1e-5)</code>; <code>assert.ok(rough.at(-1).body.positionMm[0] &lt; light.at(-1).body.positionMm[0] * 0.52)</code>.
   Assertion helpers: [close](../artifacts/kineticad/tests/contact-bench.test.mjs#L12).

95. **[accumulated frame partitions produce the same body state as a single elapsed-time request](../artifacts/kineticad/tests/contact-bench.test.mjs#L91)** — PASS, 4.535 ms.
   Checks include: <code>assert.equal(actual.steps, expected.steps)</code>; <code>assert.deepEqual(actual.body, expected.body)</code>; <code>assert.deepEqual(actual.contact, expected.contact)</code>.

96. **[airborne and impact phases disable the continuous-support reference](../artifacts/kineticad/tests/contact-bench.test.mjs#L104)** — PASS, 4.537 ms.
   Checks include: <code>assert.ok(trace.some((s) =&gt; !s.contact.active &amp;&amp; s.body.linearVelocityMmPerSec[2] &lt; 0))</code>; <code>assert.ok(trace.some((s) =&gt; s.contact.active &amp;&amp; s.contact.normalForceN &gt; 19.62 * 2))</code>; <code>assert.equal(snapshot.reference.valid, false)</code>.

97. **[invalid physical inputs and elapsed time are rejected](../artifacts/kineticad/tests/contact-bench.test.mjs#L115)** — PASS, 1.823 ms.
   Checks include: <code>assert.rejects(createContactBench(config))</code>; <code>assert.throws(() =&gt; bench.step(-1))</code>; <code>assert.throws(() =&gt; bench.step(NaN))</code>.

### crank-slider-cad.test.mjs

**2 passed · Real OCCT + analytic bounds.** Rebuilds native crank-slider solids at the declared parameter-domain cases, checks validity/mass and sampled exact intersections, and tests the companion analytic clearance bounds.

**Limits:** The sampled BRep checks and bounded factory geometry are distinct; this is not a clearance certificate for manual edits or arbitrary new mechanism geometry.

98. **[all domain vertices and the default produce four exact valid CAD solids with no sampled interference](../artifacts/kineticad/tests/crank-slider-cad.test.mjs#L10)** — PASS, 27198.204 ms.
   Checks include: <code>assert(overlap &lt;= report.overlapToleranceMm3, `${JSON.stringify(params)} angle${i * 15}: ${fixture.assembly.parts[a].id}/${fixture.assembly.parts[b].id} overlap ${overlap}mm³`)</code>.

99. **[continuous rigid-geometry clearances hold across the admitted parameter domain](../artifacts/kineticad/tests/crank-slider-cad.test.mjs#L44)** — PASS, 0.455 ms.
   Checks include: <code>assert(sketch, `missing ${name}`)</code>; <code>assert(rail.primitive.corner[0] - crankRadius &gt;= 2, &#x27;crank swept envelope to raised rail&#x27;)</code>; <code>assert(minSliderX - crankRadius &gt;= 8, &#x27;crank swept envelope to slider&#x27;)</code>.
   Assertion helpers: [profile](../artifacts/kineticad/tests/crank-slider-cad.test.mjs#L48).

### crank-slider-kinematics.test.mjs

**4 passed · Pure mechanism mathematics.** Checks factory dimensions and the independent closed-loop position/velocity/acceleration reference, including finite differences, reversal, zero speed and parameter rejection.

**Limits:** Analytic kinematics alone do not prove physical tracking, payload capacity, stress or contact behavior.

100. **[native crank-slider factory is deterministic, closed and has exactly one drive](../artifacts/kineticad/tests/crank-slider-kinematics.test.mjs#L5)** — PASS, 11.350 ms.
   Checks include: <code>assert.deepEqual(a, buildCrankSliderAssembly(DEFAULT_CRANK_SLIDER_PARAMS))</code>; <code>assert.equal(a.parts.length, 4)</code>; <code>assert.equal(a.mates.length, 4)</code>.

101. **[reference matches independent circle/link closure and numerical time derivatives throughout the admitted domain](../artifacts/kineticad/tests/crank-slider-kinematics.test.mjs#L22)** — PASS, 5.130 ms.
   Checks include: <code>assert(Math.abs(Math.hypot(ref.sliderPositionMm - pin[0], pin[1]) - p.rodLengthMm) &lt; 1e-10)</code>; <code>assert(Math.abs(ref.sliderVelocityMmPerSec - (x(t + h) - x(t - h)) / (2 * h)) &lt; 0.00001)</code>; <code>assert(Math.abs(ref.sliderAccelerationMmPerSec2 - (x(t + h) - 2 * x(t) + x(t - h)) / h ** 2) &lt; 0.0001)</code>.

102. **[zero/reverse RPM and nonconstant angular-speed chain rule have explicit reference semantics](../artifacts/kineticad/tests/crank-slider-kinematics.test.mjs#L36)** — PASS, 0.195 ms.
   Checks include: <code>assert.equal(crankSliderReference({ ...p, rpm: 0 }, 20).sliderPositionMm, 125)</code>; <code>assert.equal(Math.abs(crankSliderReference({ ...p, rpm: 0 }, 20).sliderVelocityMmPerSec), 0)</code>; <code>assert.equal(forward.sliderPositionMm, reverse.sliderPositionMm)</code>.

103. **[invalid dimensions, near-toggle rod ratios and nonfinite controls are rejected](../artifacts/kineticad/tests/crank-slider-kinematics.test.mjs#L50)** — PASS, 3.796 ms.
   Checks include: <code>assert.throws(() =&gt; buildCrankSliderAssembly({ ...DEFAULT_CRANK_SLIDER_PARAMS, ...patch }))</code>; <code>assert.throws(() =&gt; validateCrankSliderParams(null))</code>; <code>assert.throws(() =&gt; crankSliderReference(DEFAULT_CRANK_SLIDER_PARAMS, -1))</code>.

### crank-slider-physics.test.mjs

**2 passed · Real Rapier worker / exact CAD descriptors.** Runs the shipped worker over the crank-slider scenario matrix and compares measured poses, derivatives, closures and solver-profile behavior with independent references. CAD descriptors are keyed to source and complete assembly hashes.

**Limits:** The descriptor helper may reuse its validated local cache; the companion CAD tests rebuild solids. No collision friction, rated torque or payload analysis is claimed.

104. **[actual CAD crank-slider follows independent closed-loop kinematics with forward, reverse, zero and extreme settings](../artifacts/kineticad/tests/crank-slider-physics.test.mjs#L25)** — PASS, 2494.852 ms.
   Checks include: <code>assert.equal(built.ok, true, JSON.stringify(built))</code>; <code>assert.equal(built.bodyCount, 4)</code>; <code>assert.equal(built.jointCount, 4)</code>.
   Assertion helpers: [record](../artifacts/kineticad/tests/crank-slider-physics.test.mjs#L72).

105. **[per-world solver settings reject invalid worlds, govern live motors and reset to legacy defaults](../artifacts/kineticad/tests/crank-slider-physics.test.mjs#L119)** — PASS, 362.526 ms.
   Checks include: <code>assert.equal((await physics.buildWorld({ ...args, solverSettings: CRANK_SLIDER_SOLVER_SETTINGS })).ok, true)</code>; <code>assert.deepEqual((await physics.step(0)).solverSettings, CRANK_SLIDER_SOLVER_SETTINGS)</code>; <code>assert.equal((await physics.updateJointMotor({ mateId: ids.drive, motorSpeedRpm: 20 })).ok, true)</code>.

### crank-slider-readout.test.mjs

**14 passed · Pure measured-data processing.** Feeds explicit measured pose/velocity samples to the readout and interval selector. Checks independent mean acceleration, missing/nonfinite values, quaternion handling and minimum sampling interval.

**Limits:** Synthetic inputs test honest handling and comparison; this file does not execute a physics world or generate evidence of visible motion.

106. **[actual positions, velocities, angle and RPM remain independent from the nominal reference](../artifacts/kineticad/tests/crank-slider-readout.test.mjs#L23)** — PASS, 2.383 ms.
   Checks include: <code>close(actual.angleDeg, 60)</code>; <code>close(actual.rpm, -7.5)</code>; <code>close(actual.referencePositionMm, Math.sqrt(100 ** 2 - 25 ** 2))</code>.
   Assertion helpers: [close](../artifacts/kineticad/tests/crank-slider-readout.test.mjs#L8).

107. **[mean acceleration uses independent measured speed samples and their actual interval](../artifacts/kineticad/tests/crank-slider-readout.test.mjs#L37)** — PASS, 0.341 ms.
   Checks include: <code>close(actual.referenceAverageAccelerationMmPerSec2, -25 * Math.PI / 2)</code>; <code>close(irregular.averageAccelerationMmPerSec2, 18 / 0.37)</code>; <code>assert.equal(actual.averageAccelerationMmPerSec2, -28)</code>.
   Assertion helpers: [close](../artifacts/kineticad/tests/crank-slider-readout.test.mjs#L8).

108. **[reference interval acceleration is the mean velocity change, not point acceleration](../artifacts/kineticad/tests/crank-slider-readout.test.mjs#L48)** — PASS, 0.457 ms.
   Checks include: <code>close(actual.referenceAverageAccelerationMmPerSec2, 25 * Math.PI / 2)</code>; <code>assert.equal(actual.averageAccelerationMmPerSec2, 30)</code>; <code>assert.ok(Math.abs(actual.referenceAverageAccelerationMmPerSec2 - instantaneousAtHalfTurn) &gt; 1)</code>.
   Assertion helpers: [close](../artifacts/kineticad/tests/crank-slider-readout.test.mjs#L8).

109. **[missing actual poses or body velocity readbacks never fabricate a sample](../artifacts/kineticad/tests/crank-slider-readout.test.mjs#L58)** — PASS, 1.479 ms.
   Checks include: <code>assert.equal(sample(1000, data, sample(500)), undefined)</code>.

110. **[nonfinite measurements, invalid clocks and degenerate quaternions are unavailable](../artifacts/kineticad/tests/crank-slider-readout.test.mjs#L73)** — PASS, 0.251 ms.
   Checks include: <code>assert.equal(sample(time), undefined)</code>; <code>assert.equal(sample(1000, data), undefined)</code>.

111. **[duplicate, backward and invalid previous clocks cannot create interval acceleration](../artifacts/kineticad/tests/crank-slider-readout.test.mjs#L89)** — PASS, 0.180 ms.
   Checks include: <code>assert.equal(actual.averageAccelerationMmPerSec2, undefined)</code>; <code>assert.equal(actual.referenceAverageAccelerationMmPerSec2, undefined)</code>; <code>assert.equal(actual.positionMm, 123.125)</code>.

112. **[quaternion scale and sign do not change measured angle or mutate worker readbacks](../artifacts/kineticad/tests/crank-slider-readout.test.mjs#L105)** — PASS, 1.605 ms.
   Checks include: <code>close(sample(0, data).angleDeg, -45)</code>; <code>assert.equal(JSON.stringify(data), before)</code>.
   Assertion helpers: [close](../artifacts/kineticad/tests/crank-slider-readout.test.mjs#L8).

113. **[zero/reverse nominal RPM affects only the reference, never clamps measured motion](../artifacts/kineticad/tests/crank-slider-readout.test.mjs#L116)** — PASS, 0.225 ms.
   Checks include: <code>close(stopped.referenceVelocityMmPerSec, 0)</code>; <code>close(stopped.rpm, 6)</code>; <code>close(reverse.referencePositionMm, Math.sqrt(100 ** 2 - 25 ** 2))</code>.
   Assertion helpers: [close](../artifacts/kineticad/tests/crank-slider-readout.test.mjs#L8).

114. **[a reset remains detectable even if React observes only the next nonempty run snapshot](../artifacts/kineticad/tests/crank-slider-readout.test.mjs#L128)** — PASS, 1.004 ms.
   Checks include: <code>assert.ok(after.poses.length &gt; 0)</code>; <code>assert.ok(after.simulatedTimeMs &lt; before.simulatedTimeMs)</code>; <code>assert.equal(after.runGeneration, before.runGeneration + 1)</code>.

115. **[pose publication preserves actual readbacks and leaves zero-step or missing-body data unmeasured](../artifacts/kineticad/tests/crank-slider-readout.test.mjs#L145)** — PASS, 1.395 ms.
   Checks include: <code>assert.deepEqual(usePoseMeasurements.getState().poses, [])</code>; <code>assert.equal(sample(measured.simulatedTimeMs, measured).positionMm, 116.25)</code>; <code>assert.deepEqual(missing.bodies, [])</code>.

116. **[interval selection includes the exact 1/30 s boundary and only its declared roundoff tolerance](../artifacts/kineticad/tests/crank-slider-readout.test.mjs#L160)** — PASS, 0.341 ms.
   Checks include: <code>assert.equal(selectCrankSliderIntervalSample([previous], 1 / 30), previous)</code>; <code>assert.equal(selectCrankSliderIntervalSample([previous], 1 / 30 - 0.5e-8), previous)</code>; <code>assert.equal(selectCrankSliderIntervalSample([previous], 1 / 30 - 2e-8), undefined)</code>.

117. **[the final frame selects the latest sufficiently old actual sample, independent of array order](../artifacts/kineticad/tests/crank-slider-readout.test.mjs#L169)** — PASS, 0.602 ms.
   Checks include: <code>close(final.averageAccelerationMmPerSec2, (12 - 4) / 0.04)</code>; <code>assert.equal(selectCrankSliderIntervalSample(history, 8), eligible)</code>; <code>assert.deepEqual(history, [tooRecent, older, eligible])</code>.
   Assertion helpers: [close](../artifacts/kineticad/tests/crank-slider-readout.test.mjs#L8).

118. **[empty or restarted histories and invalid/backward clocks yield no acceleration endpoint](../artifacts/kineticad/tests/crank-slider-readout.test.mjs#L180)** — PASS, 0.099 ms.
   Checks include: <code>assert.equal(selectCrankSliderIntervalSample([], 0), undefined)</code>; <code>assert.equal(selectCrankSliderIntervalSample([], 8), undefined)</code>; <code>assert.equal(selectCrankSliderIntervalSample(history, 1), undefined)</code>.

119. **[nonfinite sample values are skipped without substituting a theoretical or corrupt endpoint](../artifacts/kineticad/tests/crank-slider-readout.test.mjs#L191)** — PASS, 1.350 ms.
   Checks include: <code>assert.equal(selectCrankSliderIntervalSample([eligible, { ...later, [field]: invalid }], 1), eligible, `${field}: ${invalid}`)</code>; <code>assert.equal(selectCrankSliderIntervalSample([{ ...later, [field]: invalid }], 1), undefined)</code>; <code>assert.equal(selectCrankSliderIntervalSample([{ ...later, timeSeconds: -1 }], 1), undefined)</code>.

### crank-slider-workspace.test.mjs

**7 passed · Actual store / memory persistence.** Uses the factory, real store, document parser and demo-session logic to check generated-mechanism identity, manual-edit protection, metadata round trips and original-workspace retention.

**Limits:** Memory storage and parser checks do not replace native file-picker, IndexedDB quota or real browser reload acceptance.

120. **[generated workspace is fresh, stopped and contains only its validated experiment](../artifacts/kineticad/tests/crank-slider-workspace.test.mjs#L17)** — PASS, 7.624 ms.
   Checks include: <code>assert.equal(doc.version, 9)</code>; <code>assert.equal(doc.state.mode, &#x27;simulator&#x27;)</code>; <code>assert.deepEqual(doc.state.simulation, { running: false, paused: false, simulationTimeMs: 0, timeStepMs: CRANK_SLIDER_TIME_STEP_MS, durationMs: CRANK_SLIDER_DURATION_MS, gravity: [0,0,0], speedMultiplier: 1, c…</code>.

121. **[demo parser and actual Save/project parser retain adjustable parameters and native history](../artifacts/kineticad/tests/crank-slider-workspace.test.mjs#L37)** — PASS, 21.405 ms.
   Checks include: <code>assert.equal(loaded.format, &#x27;kineticad-project&#x27;)</code>; <code>assert.deepEqual(loaded.assets, [])</code>; <code>assert.deepEqual(loaded.state.simulation.crankSlider, p)</code>.

122. **[physical assembly guard tolerates cosmetic names, computed fields and object-key order](../artifacts/kineticad/tests/crank-slider-workspace.test.mjs#L55)** — PASS, 2.495 ms.
   Checks include: <code>assert.equal(matchesCrankSliderAssembly(assembly, params()), true)</code>.

123. **[manual geometry, frame, material, visibility and joint edits disable parameter replacement](../artifacts/kineticad/tests/crank-slider-workspace.test.mjs#L71)** — PASS, 7.669 ms.
   Checks include: <code>assert.equal(matchesCrankSliderAssembly(assembly, params()), false, name)</code>; <code>assert.equal(matchesCrankSliderAssembly(create().state.assembly, { ...params(), radiusMm: 26 }), false)</code>.

124. **[reference guard rejects changed gravity, timing and stale experiment controllers](../artifacts/kineticad/tests/crank-slider-workspace.test.mjs#L95)** — PASS, 2.104 ms.
   Checks include: <code>assert.equal(matchesCrankSliderConfiguration(assembly, { ...simulation, running:true,paused:true,simulationTimeMs:200,speedMultiplier:2 }), true)</code>; <code>assert.equal(matchesCrankSliderConfiguration(assembly, { ...simulation, ...patch }), false, JSON.stringify(patch))</code>.

125. **[invalid adjustable metadata rejects before a document can replace the workspace](../artifacts/kineticad/tests/crank-slider-workspace.test.mjs#L108)** — PASS, 6.875 ms.
   Checks include: <code>assert.throws(() =&gt; createCrankSliderDocument(invalid))</code>; <code>assert.equal(matchesCrankSliderAssembly(create().state.assembly, invalid), false)</code>; <code>assert.throws(() =&gt; parseDemoDocument(doc))</code>.

126. **[parameter changes and Save remain isolated, then restore original live imported references](../artifacts/kineticad/tests/crank-slider-workspace.test.mjs#L119)** — PASS, 11.687 ms.
   Checks include: <code>assert.equal(saved.state.simulation.crankSlider.rpm,rpm)</code>; <code>assert.equal(saved.state.simulation.running,false)</code>; <code>assert.equal(stored.get(&#x27;project&#x27;),before)</code>.

### demos.test.mjs

**6 passed · Fixtures / actual store.** Checks bundled document references and validation, base-aware URLs, force settings and demo-session isolation with the actual store.

**Limits:** These are fixture and state checks, not CAD shape validity, motor accuracy or rendered gallery acceptance.

127. **[all bundled examples load and reference existing parts](../artifacts/kineticad/tests/demos.test.mjs#L12)** — PASS, 25.860 ms.
   Checks include: <code>assert.ok(parseDemoDocument(fixture(id)).state.assembly.parts.length &gt; 0)</code>.

128. **[asset paths work at the Replit /app base and a local root](../artifacts/kineticad/tests/demos.test.mjs#L16)** — PASS, 0.505 ms.
   Checks include: <code>assert.equal(demoAssetUrl(&#x27;windmill&#x27;, &#x27;/app&#x27;), &#x27;/app/demos/windmill.json&#x27;)</code>; <code>assert.equal(demoAssetUrl(&#x27;windmill&#x27;, &#x27;/app/&#x27;), &#x27;/app/demos/windmill.json&#x27;)</code>; <code>assert.equal(demoAssetUrl(&#x27;windmill&#x27;, &#x27;/&#x27;), &#x27;/demos/windmill.json&#x27;)</code>.

129. **[force experiment survives document parsing and rejects invalid target references](../artifacts/kineticad/tests/demos.test.mjs#L22)** — PASS, 4.604 ms.
   Checks include: <code>assert.deepEqual(parseDemoDocument(value).state.simulation.forceExperiment, value.state.simulation.forceExperiment)</code>; <code>assert.throws(() =&gt; parseDemoDocument(value), /invalid force experiment/)</code>.

130. **[invalid and unsupported documents fail before entering a workspace](../artifacts/kineticad/tests/demos.test.mjs#L29)** — PASS, 3.761 ms.
   Checks include: <code>assert.throws(() =&gt; parseDemoDocument(value))</code>; <code>assert.throws(() =&gt; parseDemoDocument(value), /invalid joint/)</code>; <code>assert.throws(() =&gt; parseDemoDocument(value))</code>.

131. **[editing and playing multiple demos never overwrite the original project](../artifacts/kineticad/tests/demos.test.mjs#L65)** — PASS, 8.551 ms.
   Checks include: <code>assert.equal(stored.get(&#x27;kineticad-state&#x27;), before)</code>; <code>assert.equal(store.getState().assembly, original.assembly)</code>; <code>assert.equal(store.getState().assembly.parts[0].features[0].shapeId, &#x27;live-wasm-shape&#x27;)</code>.

132. **[a second visit captures the newly edited original and begins stopped](../artifacts/kineticad/tests/demos.test.mjs#L84)** — PASS, 1.036 ms.
   Checks include: <code>assert.equal(store.getState().simulation.running, false)</code>; <code>assert.equal(store.getState().assembly.name, &#x27;Revised project&#x27;)</code>.

### desktop-support.test.mjs

**9 passed · Pure device policy.** Checks explicit user-agent, touch and pointer signals against the desktop-only startup policy, including iPadOS desktop user agents and touch Windows laptops.

**Limits:** Signals can be spoofed; these cases are not a survey of every physical device or proof of every browser startup path.

133. **[known phone UAs are blocked independently of their pointer reports](../artifacts/kineticad/tests/desktop-support.test.mjs#L10)** — PASS, 1.925 ms.
   Checks include: <code>assert.equal(isDesktopSupported({ ...desktop, userAgent }), false, userAgent)</code>.

134. **[tablet UAs without the word Mobile remain blocked](../artifacts/kineticad/tests/desktop-support.test.mjs#L22)** — PASS, 0.270 ms.
   Checks include: <code>assert.equal(isDesktopSupported({ ...desktop, userAgent }), false, userAgent)</code>.

135. **[desktop-mode iPadOS is blocked via Macintosh or MacIntel identity plus touch](../artifacts/kineticad/tests/desktop-support.test.mjs#L34)** — PASS, 0.215 ms.
   Checks include: <code>assert.equal(isDesktopSupported({ ...desktop, userAgent: safari, platform: &#x27;MacIntel&#x27;, maxTouchPoints: 5 }), false)</code>; <code>assert.equal(isDesktopSupported({ ...desktop, userAgent: safari, platform: &#x27;&#x27;, maxTouchPoints: 5 }), false)</code>; <code>assert.equal(isDesktopSupported({ ...desktop, userAgent: &#x27;Mozilla/5.0 Safari/605.1.15&#x27;, platform: &#x27;MacIntel&#x27;, maxTouchPoints: 5 }), false)</code>.

136. **[attaching a mouse does not allow a known phone or tablet to enter CAD](../artifacts/kineticad/tests/desktop-support.test.mjs#L41)** — PASS, 0.080 ms.
   Checks include: <code>assert.equal(isDesktopSupported({ ...desktop, userAgent, maxTouchPoints: 10, hasCoarsePointer: true, hasFinePointer: true }), false)</code>.

137. **[coarse-only touch devices are blocked even with a desktop-like or unknown UA](../artifacts/kineticad/tests/desktop-support.test.mjs#L47)** — PASS, 0.079 ms.
   Checks include: <code>assert.equal(isDesktopSupported({ ...desktop, hasCoarsePointer: true, hasFinePointer: false, maxTouchPoints: 10 }), false)</code>; <code>assert.equal(isDesktopSupported({ ...desktop, userAgent: &#x27;&#x27;, hasCoarsePointer: true, hasFinePointer: false }), false)</code>.

138. **[touch-capable Windows laptops with a fine pointer remain supported](../artifacts/kineticad/tests/desktop-support.test.mjs#L52)** — PASS, 0.257 ms.
   Checks include: <code>assert.equal(isDesktopSupported(laptop), true)</code>; <code>assert.equal(isDesktopSupported({ ...laptop, hasCoarsePointer: false }), true)</code>.

139. **[ordinary macOS, Windows and Linux desktop pointers remain supported](../artifacts/kineticad/tests/desktop-support.test.mjs#L58)** — PASS, 0.236 ms.
   Checks include: <code>assert.equal(isDesktopSupported(desktop), true)</code>; <code>assert.equal(isDesktopSupported({ ...desktop, userAgent: &#x27;Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/149.0 Safari/537.36&#x27;, platform: &#x27;MacIntel&#x27; }), true)</code>; <code>assert.equal(isDesktopSupported({ ...desktop, userAgent: &#x27;Mozilla/5.0 (X11; Linux x86_64; rv:149.0) Gecko/20100101 Firefox/149.0&#x27;, platform: &#x27;Linux x86_64&#x27; }), true)</code>.

140. **[narrow desktop windows and browser zoom are not mobile-device signals](../artifacts/kineticad/tests/desktop-support.test.mjs#L64)** — PASS, 0.062 ms.
   Checks include: <code>assert.equal(isDesktopSupported({ ...desktop, viewportWidth }), true)</code>.

141. **[detection is pure and optional platform/touch values do not reject a desktop](../artifacts/kineticad/tests/desktop-support.test.mjs#L70)** — PASS, 1.101 ms.
   Checks include: <code>assert.equal(isDesktopSupported(signals), true)</code>; <code>assert.deepEqual(signals, { userAgent: desktop.userAgent, hasCoarsePointer: false, hasFinePointer: true })</code>.

### engineering-bench-worker.test.mjs

**3 passed · Real Comlink / Rapier worker.** Calls the actual engineering worker through Comlink and checks build/step ordering, replacement/disposal and error recovery.

**Limits:** Worker lifecycle tests do not exercise modal controls, browser frame timing or all bench physics combinations.

142. **[real Comlink worker serializes initial asynchronous build before zero-time and advancing calls](../artifacts/kineticad/tests/engineering-bench-worker.test.mjs#L23)** — PASS, 417.331 ms.
   Checks include: <code>assert.equal(built.kind,&#x27;actuator&#x27;)</code>; <code>assert.equal(built.simulatedTimeMs,0)</code>; <code>assert.equal(built.dtMs,0)</code>.

143. **[queued actuator step, contact rebuild and contact step remain FIFO and reset the physical world](../artifacts/kineticad/tests/engineering-bench-worker.test.mjs#L32)** — PASS, 40.965 ms.
   Checks include: <code>assert.equal(first.kind,&#x27;actuator&#x27;)</code>; <code>assert.equal(first.simulatedTimeMs,200)</code>; <code>assert.equal(newWorld.kind,&#x27;contact&#x27;)</code>.

144. **[invalid build rejects and clears the previous world without poisoning subsequent queued rebuilds](../artifacts/kineticad/tests/engineering-bench-worker.test.mjs#L44)** — PASS, 19.486 ms.
   Checks include: <code>assert.equal(results[0].status,&#x27;rejected&#x27;)</code>; <code>assert.match(String(results[0].reason),/payloadKg/)</code>; <code>assert.equal(results[1].status,&#x27;rejected&#x27;)</code>.

### feature-regen.test.mjs

**13 passed · Controlled CAD adapter.** Uses the real regeneration pipeline with controlled kernel calls to check full-chain dispatch, pending sharing, hashes, failure retry, cache generations, unit-density mass caching and STEP preservation.

**Limits:** Controlled meshes/properties validate orchestration rather than OCCT geometry.

145. **[concurrent scene regenerations dispatch one operation per matching cold feature](../artifacts/kineticad/tests/feature-regen.test.mjs#L34)** — PASS, 3.633 ms.
   Checks include: <code>assert.equal(calls.length, 1)</code>; <code>assert.equal(result.mesh, output)</code>; <code>assert.equal(result.perFeature[0].ok, true)</code>.

146. **[pending operations on different kernel instances remain independent](../artifacts/kineticad/tests/feature-regen.test.mjs#L50)** — PASS, 1.847 ms.
   Checks include: <code>assert.equal(a.calls.length, 1)</code>; <code>assert.equal(b.calls.length, 1)</code>; <code>assert.equal((await first).mesh, outputA)</code>.

147. **[changed feature parameters do not join an older in-flight operation](../artifacts/kineticad/tests/feature-regen.test.mjs#L66)** — PASS, 1.161 ms.
   Checks include: <code>assert.equal(calls.length, 2)</code>; <code>assert.deepEqual(calls.map((call) =&gt; call.args.depthMm), [10, 25])</code>; <code>assert.equal((await first).mesh, outputA)</code>.

148. **[shared failures reach every caller and a later request retries the worker](../artifacts/kineticad/tests/feature-regen.test.mjs#L80)** — PASS, 2.563 ms.
   Checks include: <code>assert.rejects(preview, /kernel failed/)</code>; <code>assert.equal(calls.length, 1)</code>; <code>assert.equal(result.mesh, null)</code>.

149. **[clearing the cache separates pending work and rejects late cache repopulation](../artifacts/kineticad/tests/feature-regen.test.mjs#L101)** — PASS, 3.008 ms.
   Checks include: <code>assert.equal(calls.length, 2, &#x27;post-clear callers must not join pre-clear operations&#x27;)</code>; <code>assert.equal((await newer).mesh, fresh)</code>; <code>assert.equal(getCachedMesh(hash), fresh)</code>.

150. **[concurrent chains share each stage and preview uses the same full upstream hash](../artifacts/kineticad/tests/feature-regen.test.mjs#L125)** — PASS, 18.859 ms.
   Checks include: <code>assert.equal(calls.length, 1)</code>; <code>assert.equal(calls.length, 2)</code>; <code>assert.equal(calls.length, 3)</code>.

151. **[display regeneration sends one complete chain and caches its exact final-feature hash](../artifacts/kineticad/tests/feature-regen.test.mjs#L145)** — PASS, 3.040 ms.
   Checks include: <code>assert.equal(calls.length, 1, &#x27;one full-chain RPC replaces all prefix display meshes&#x27;)</code>; <code>assert.deepEqual(calls[0].args, { features: p.features, sketches: p.sketches })</code>; <code>assert.notEqual(calls[0].args.features, p.features)</code>.

152. **[display cache invalidates when an upstream feature or source sketch changes](../artifacts/kineticad/tests/feature-regen.test.mjs#L165)** — PASS, 0.807 ms.
   Checks include: <code>assert.equal(calls.length, 3)</code>; <code>assert.equal(new Set(results.map((result) =&gt; result.hash)).size, 3)</code>.

153. **[full-chain rejection reaches all display callers and retries without a poisoned cache](../artifacts/kineticad/tests/feature-regen.test.mjs#L179)** — PASS, 0.433 ms.
   Checks include: <code>assert.equal(calls.length, 1)</code>; <code>assert.equal(result.mesh, null)</code>; <code>assert.equal(result.error, &#x27;Earlier feature has an invalid sketch&#x27;)</code>.

154. **[unit-density mass data warms the cache and material/pose changes need no CAD rebuild](../artifacts/kineticad/tests/feature-regen.test.mjs#L197)** — PASS, 1.053 ms.
   Checks include: <code>assert.ok(cached)</code>; <code>assert.ok(Math.abs(steel.massKg - 0.0314) &lt; 1e-12)</code>; <code>assert.ok(Math.abs(value - properties.principalInertiaKgMm2[i] * 7.85) &lt; 1e-12)</code>.

155. **[unmodified STEP uses its live mesh; modified STEP dispatches its intact full history](../artifacts/kineticad/tests/feature-regen.test.mjs#L222)** — PASS, 0.638 ms.
   Checks include: <code>assert.equal(result.mesh, importedMesh)</code>; <code>assert.equal(calls.length, 0)</code>; <code>assert.equal(calls.length, 1)</code>.

156. **[a late full-chain result cannot repopulate mesh or physical caches after clear](../artifacts/kineticad/tests/feature-regen.test.mjs#L241)** — PASS, 0.132 ms.
   Checks include: <code>assert.equal(getCachedMesh(`part:${result.hash}`), undefined)</code>; <code>assert.equal(getVolumeData(result.hash), undefined)</code>.

157. **[a final-feature preview cannot hide an invalid earlier history from display regeneration](../artifacts/kineticad/tests/feature-regen.test.mjs#L256)** — PASS, 0.213 ms.
   Checks include: <code>assert.equal(calls.length, 2, &#x27;a preview cache hit must not bypass full-chain validation&#x27;)</code>; <code>assert.deepEqual(calls[1].args.features, p.features)</code>; <code>assert.equal(result.mesh, null)</code>.

### force-measurements.test.mjs

**3 passed · Pure measured-data processing.** Checks the actual force-measurement path using explicit pose/velocity observations and independent F/m comparisons, including unavailable data.

**Limits:** No actual solver or CAD geometry is executed in this file.

158. **[display measures acceleration from solver readback even when it disagrees with F/m](../artifacts/kineticad/tests/force-measurements.test.mjs#L13)** — PASS, 1.365 ms.
   Checks include: <code>assert.equal(result.rows[0].expectedAccelerationMmPerSec2,50)</code>; <code>assert.equal(result.rows[0].measuredAccelerationMmPerSec2,20)</code>; <code>assert.equal(result.rows[0].distanceMm,10)</code>.

159. **[measurement uses consecutive actual simulation timestamps and holds at completion](../artifacts/kineticad/tests/force-measurements.test.mjs#L20)** — PASS, 0.290 ms.
   Checks include: <code>assert.equal(final.rows[0].measuredAccelerationMmPerSec2,50)</code>; <code>assert.equal(final.timeMs,2000)</code>; <code>assert.equal(final.completed,true)</code>.

160. **[new runs clear prior readings and missing measurements cannot look successful](../artifacts/kineticad/tests/force-measurements.test.mjs#L29)** — PASS, 0.334 ms.
   Checks include: <code>assert.throws(() =&gt; reduceForceMeasurements(previous,{...reading(1000,50,25),bodyMeasurements:[]}),/No physics measurement/)</code>; <code>assert.equal(useForceMeasurements.getState().rows.length,0)</code>; <code>assert.equal(start().rows[0].measuredAccelerationMmPerSec2,null)</code>.

### force-physics.test.mjs

**6 passed · Real Rapier worker.** Runs the actual physics worker with analytic body descriptors. Tests SI/mm force conversion, inverse-mass response, gravity addition at COM, duration caps, reset and partition invariance.

**Limits:** Mass/inertia descriptors are analytic test inputs; this is not an OCCT rebuild or a general contact/actuator-strength model.

161. **[equal newton forces yield measured inverse-mass acceleration on unpowered prismatic sliders](../artifacts/kineticad/tests/force-physics.test.mjs#L33)** — PASS, 474.099 ms.
   Checks include: <code>close(current.linearVelocityMmPerSec[0], 0, 1e-5, &#x27;no transverse X velocity&#x27;)</code>; <code>close(current.linearVelocityMmPerSec[2], 0, 1e-5, &#x27;no transverse Z velocity&#x27;)</code>; <code>close(result.simulatedTimeMs, 2000, 1e-9, &#x27;two-second cap handles 60 Hz quotient roundoff&#x27;)</code>.
   Assertion helpers: [build](../artifacts/kineticad/tests/force-physics.test.mjs#L27), [close](../artifacts/kineticad/tests/force-physics.test.mjs#L17).

162. **[doubling force and mass preserves measured acceleration and motion](../artifacts/kineticad/tests/force-physics.test.mjs#L75)** — PASS, 14.944 ms.
   Checks include: <code>close(measuredA, 100, 0.005, &#x27;first acceleration&#x27;)</code>; <code>close(measuredB, measuredA, 1e-6, &#x27;doubled F/m acceleration&#x27;)</code>; <code>close(a.positionMm[1], b.positionMm[1], 1e-6, &#x27;equal travel&#x27;)</code>.
   Assertion helpers: [build](../artifacts/kineticad/tests/force-physics.test.mjs#L27), [close](../artifacts/kineticad/tests/force-physics.test.mjs#L17).

163. **[world-space COM force adds to gravity without creating torque on an offset, rotated body](../artifacts/kineticad/tests/force-physics.test.mjs#L88)** — PASS, 16.615 ms.
   Checks include: <code>close(measurement.linearVelocityMmPerSec[1]/seconds, 100, 0.005, &#x27;newtons convert to mm acceleration&#x27;)</code>; <code>close(measurement.linearVelocityMmPerSec[2]/seconds, -7810, 0.4, &#x27;gravity plus applied upward force&#x27;)</code>; <code>close(measurement.linearVelocityMmPerSec[0], 0, 1e-5, &#x27;force stays world-aligned despite body rotation&#x27;)</code>.
   Assertion helpers: [build](../artifacts/kineticad/tests/force-physics.test.mjs#L27), [close](../artifacts/kineticad/tests/force-physics.test.mjs#L17).

164. **[duration cap and force motion are invariant to elapsed-time partitions, including capped catch-up](../artifacts/kineticad/tests/force-physics.test.mjs#L103)** — PASS, 84.151 ms.
   Checks include: <code>assert(result.simulatedTimeMs &lt;= 2057)</code>; <code>assert.equal(result.completed, true)</code>; <code>assert.equal(result.simulatedTimeMs, 2050)</code>.
   Assertion helpers: [build](../artifacts/kineticad/tests/force-physics.test.mjs#L27).

165. **[zero requests pause a forced run and rebuilding removes its cap and persistent forces](../artifacts/kineticad/tests/force-physics.test.mjs#L125)** — PASS, 4.044 ms.
   Checks include: <code>assert.equal(initial.completed, false)</code>; <code>assert.equal(initial.simulatedTimeMs, 0)</code>; <code>assert.equal((await physics.step(4)).dtMs, 0)</code>.
   Assertion helpers: [build](../artifacts/kineticad/tests/force-physics.test.mjs#L27).

166. **[invalid force vectors, duplicate/fixed/missing targets and invalid caps reject the whole world](../artifacts/kineticad/tests/force-physics.test.mjs#L145)** — PASS, 11.497 ms.
   Checks include: <code>assert.equal(built.ok,false,JSON.stringify(invalid))</code>; <code>assert.deepEqual(empty.transforms,[])</code>; <code>assert.deepEqual(empty.bodyMeasurements,[])</code>.

### hole-picker.test.mjs

**5 passed · Actual Three.js / DOM adapter.** Raycasts real transformed Three.js geometry through the Hole picker and checks first/second-click UV coordinates plus reset/change behavior.

**Limits:** DOM and events are test adapters; native browser file controls and visible cursor behavior remain separate.

167. **[two real canvas clicks set Hole UV on the top face of an untransformed solid](../artifacts/kineticad/tests/hole-picker.test.mjs#L66)** — PASS, 8.227 ms.
   Checks include: <code>near(h.store.getState().featureEditor.params.positionUV, face.uv)</code>; <code>assert.equal(h.store.getState().featureEditor.params.targetFace, face.id)</code>; <code>assert.equal(h.store.getState().featureEditor.params.positionUV, null)</code>.
   Assertion helpers: [near](../artifacts/kineticad/tests/hole-picker.test.mjs#L10).

168. **[two real canvas clicks set Hole UV on the bottom face of an untransformed solid](../artifacts/kineticad/tests/hole-picker.test.mjs#L66)** — PASS, 2.633 ms.
   Checks include: <code>near(h.store.getState().featureEditor.params.positionUV, face.uv)</code>; <code>assert.equal(h.store.getState().featureEditor.params.targetFace, face.id)</code>; <code>assert.equal(h.store.getState().featureEditor.params.positionUV, null)</code>.
   Assertion helpers: [near](../artifacts/kineticad/tests/hole-picker.test.mjs#L10).

169. **[two real canvas clicks set Hole UV on the top face of an translated with mixed XYZ rotation solid](../artifacts/kineticad/tests/hole-picker.test.mjs#L66)** — PASS, 3.815 ms.
   Checks include: <code>near(h.store.getState().featureEditor.params.positionUV, face.uv)</code>; <code>assert.equal(h.store.getState().featureEditor.params.targetFace, face.id)</code>; <code>assert.equal(h.store.getState().featureEditor.params.positionUV, null)</code>.
   Assertion helpers: [near](../artifacts/kineticad/tests/hole-picker.test.mjs#L10).

170. **[two real canvas clicks set Hole UV on the bottom face of an translated with mixed XYZ rotation solid](../artifacts/kineticad/tests/hole-picker.test.mjs#L66)** — PASS, 1.014 ms.
   Checks include: <code>near(h.store.getState().featureEditor.params.positionUV, face.uv)</code>; <code>assert.equal(h.store.getState().featureEditor.params.targetFace, face.id)</code>; <code>assert.equal(h.store.getState().featureEditor.params.positionUV, null)</code>.
   Assertion helpers: [near](../artifacts/kineticad/tests/hole-picker.test.mjs#L10).

171. **[Clear face and a changed face both restart the Hole picker without stale UV](../artifacts/kineticad/tests/hole-picker.test.mjs#L79)** — PASS, 4.280 ms.
   Checks include: <code>near(h.store.getState().featureEditor.params.positionUV, [2, -3])</code>; <code>assert.equal(h.store.getState().selection, null)</code>; <code>assert.equal(h.store.getState().featureEditor.params.targetFace, null)</code>.
   Assertion helpers: [near](../artifacts/kineticad/tests/hole-picker.test.mjs#L10).

### mass-properties.test.mjs

**8 passed · Real OCCT + Rapier mathematics.** Measures actual cuboid, cylinder and bored-ring BReps; compares mass, COM and complete inertia with analytic references, material scaling and a real Rapier torque impulse.

**Limits:** Bounded exact solids and tensor-conditioning cases; no universal BRep validity or nonrigid material model.

172. **[OCCT cuboid volume, mass, centroid and all three anisotropic moments match analytic values](../artifacts/kineticad/tests/mass-properties.test.mjs#L59)** — PASS, 7893.805 ms.
   Checks include: <code>close(props.volumeMm3, 24_000)</code>; <code>close(props.massKg, 0.0648)</code>; <code>close(value, [10, 15, 20][i])</code>.
   Assertion helpers: [close](../artifacts/kineticad/tests/mass-properties.test.mjs#L19), [verifyTensor](../artifacts/kineticad/tests/mass-properties.test.mjs#L35).

173. **[translated and generally rotated cuboid retains centroidal tensor, including off-diagonal terms](../artifacts/kineticad/tests/mass-properties.test.mjs#L68)** — PASS, 13.174 ms.
   Checks include: <code>close(props.comLocal[i], value)</code>; <code>assert(props.principalInertiaLocalFrame.slice(0,3).some((v) =&gt; Math.abs(v) &gt; 0.1))</code>.
   Assertion helpers: [close](../artifacts/kineticad/tests/mass-properties.test.mjs#L19), [verifyTensor](../artifacts/kineticad/tests/mass-properties.test.mjs#L35).

174. **[solid cylinder moments match axial and transverse analytic inertia](../artifacts/kineticad/tests/mass-properties.test.mjs#L77)** — PASS, 34.961 ms.
   Checks include: <code>close(props.massKg, mass)</code>.
   Assertion helpers: [close](../artifacts/kineticad/tests/mass-properties.test.mjs#L19), [verifyTensor](../artifacts/kineticad/tests/mass-properties.test.mjs#L35).

175. **[bored ring retains removed-volume effects in its axial and transverse inertia](../artifacts/kineticad/tests/mass-properties.test.mjs#L88)** — PASS, 598.854 ms.
   Checks include: <code>close(props.massKg, mass)</code>; <code>assert(cut.IsDone())</code>.
   Assertion helpers: [close](../artifacts/kineticad/tests/mass-properties.test.mjs#L19), [verifyTensor](../artifacts/kineticad/tests/mass-properties.test.mjs#L35).

176. **[warm cache and a material change preserve the full tensor and principal frame](../artifacts/kineticad/tests/mass-properties.test.mjs#L102)** — PASS, 14.656 ms.
   Checks include: <code>close(v, aluminium.principalInertiaKgMm2[i])</code>; <code>close(v, directSteel.principalInertiaKgMm2[i])</code>; <code>close(steel.massKg / aluminium.massKg, 7.87 / 2.7)</code>.
   Assertion helpers: [close](../artifacts/kineticad/tests/mass-properties.test.mjs#L19).

177. **[Rapier torque impulse follows the full rotated inertia inverse, not part-local diagonal axes](../artifacts/kineticad/tests/mass-properties.test.mjs#L115)** — PASS, 26.640 ms.
   Checks include: <code>close(v,expected[i],3e-6)</code>; <code>close(body.mass(), props.massKg, 1e-6)</code>.
   Assertion helpers: [close](../artifacts/kineticad/tests/mass-properties.test.mjs#L19).

178. **[eigensolver handles tiny and large units and rejects non-physical tensors](../artifacts/kineticad/tests/mass-properties.test.mjs#L136)** — PASS, 1.130 ms.
   Checks include: <code>assert(Math.abs(restored[i][j]-v) &lt;= scale*1e-10)</code>; <code>assert.throws(() =&gt; principalInertia([[1,0,0],[0,1,0],[0,0,5]]), /triangle inequality/)</code>; <code>assert.throws(() =&gt; principalInertia([[-1,0,0],[0,1,0],[0,0,1]]), /positive definite/)</code>.

179. **[empty geometry and invalid density fail instead of creating fictitious physical bodies](../artifacts/kineticad/tests/mass-properties.test.mjs#L148)** — PASS, 2.348 ms.
   Checks include: <code>assert.throws(() =&gt; computeMassProperties(oc, empty, 2.7), /positive closed-solid volume/)</code>; <code>assert.throws(() =&gt; computeMassProperties(oc, box(20,20,10), 0), /density/)</code>; <code>assert.throws(() =&gt; computeMassProperties(oc, box(20,20,10), NaN), /density/)</code>.

### overlay-frames.test.mjs

**5 passed · Actual Three.js geometry.** Checks finished-sketch and mate-helper positions/directions under arbitrary part rotations and live body poses using real Three.js objects.

**Limits:** A rendered planar helper is not evidence that planar physics joints are supported. No visual browser check is performed here.

180. **[finished sketches follow arbitrary part transforms, including changes without geometry edits](../artifacts/kineticad/tests/overlay-frames.test.mjs#L32)** — PASS, 5.590 ms.
   Checks include: <code>near(sketch.localToWorld(new THREE.Vector3(...point)).toArray(), add(rotate(point, p.transform.rotationDeg), p.transform.positionMm))</code>; <code>near(sketch.localToWorld(new THREE.Vector3(...point)).toArray(), add(rotate(point, p.transform.rotationDeg), p.transform.positionMm))</code>; <code>assert.equal(overlay.group.children[0], sketch, &#x27;pose edits must reuse geometry&#x27;)</code>.
   Assertion helpers: [near](../artifacts/kineticad/tests/overlay-frames.test.mjs#L8).

181. **[consumed sketches show only when selected, unused profiles show, and hidden parts stay hidden](../artifacts/kineticad/tests/overlay-frames.test.mjs#L47)** — PASS, 4.178 ms.
   Checks include: <code>assert.equal(overlay.group.children[0].visible, false)</code>; <code>assert.equal(overlay.group.children[0].visible, true)</code>; <code>assert.equal(overlay.group.children[0].visible, false)</code>.

182. **[gyroscope profiles retain the assembly elevation instead of being drawn at the ground origin](../artifacts/kineticad/tests/overlay-frames.test.mjs#L69)** — PASS, 14.572 ms.
   Checks include: <code>near(sketch.getWorldPosition(new THREE.Vector3()).toArray(), p.transform.positionMm)</code>; <code>assert.ok(elevatedParts.length &gt;= 3, &#x27;fixture must exercise the elevated ring/rotor profiles&#x27;)</code>; <code>assert.equal(sketch.visible, true)</code>.
   Assertion helpers: [near](../artifacts/kineticad/tests/overlay-frames.test.mjs#L8).

183. **[joint glyph anchors and axes track moving body poses rather than static design transforms](../artifacts/kineticad/tests/overlay-frames.test.mjs#L84)** — PASS, 5.799 ms.
   Checks include: <code>near(glyph.getWorldPosition(new THREE.Vector3()).toArray(), add(rotate(anchor, p.transform.rotationDeg), p.transform.positionMm))</code>; <code>near(glyph.getWorldPosition(new THREE.Vector3()).toArray(), worldAnchor)</code>; <code>near(new THREE.Vector3(0, 1, 0).applyQuaternion(glyph.getWorldQuaternion(new THREE.Quaternion())).toArray(), expectedAxis)</code>.
   Assertion helpers: [near](../artifacts/kineticad/tests/overlay-frames.test.mjs#L8).

184. **[selection enlargement does not displace prismatic or planar anchors](../artifacts/kineticad/tests/overlay-frames.test.mjs#L119)** — PASS, 2.115 ms.
   Checks include: <code>near(glyph.getWorldPosition(new THREE.Vector3()).toArray(), expected)</code>; <code>near(glyph.getWorldPosition(new THREE.Vector3()).toArray(), expected)</code>; <code>assert.equal(glyph.scale.x, 1.5)</code>.
   Assertion helpers: [near](../artifacts/kineticad/tests/overlay-frames.test.mjs#L8).

### part-transform-occt.test.mjs

**2 passed · Real OCCT operations.** Applies the shared part transform to BReps and verifies transformed geometry, COM and Boolean overlap.

**Limits:** Only the declared transforms and analytic solids are exercised; file-format recovery is covered elsewhere.

185. **[a translated, generally rotated B-rep keeps its analytic volume and Three-world centroid](../artifacts/kineticad/tests/part-transform-occt.test.mjs#L12)** — PASS, 6842.002 ms.
   Checks include: <code>assert.ok(Math.abs(props.volumeMm3 - 24000) &lt; 1e-7)</code>; <code>assert.ok(Math.abs(v - centroid[i]) &lt; 1e-8)</code>; <code>assert.deepEqual(validateSolid(oc, placed).solids, 1)</code>.

186. **[the same world transform preserves boolean overlap between two independently transformed bodies](../artifacts/kineticad/tests/part-transform-occt.test.mjs#L30)** — PASS, 386.508 ms.
   Checks include: <code>assert.ok(Math.abs(intersectionVolume(oc, placedA, placedB) - 3000) &lt; 1e-6)</code>.

### part-transform.test.mjs

**3 passed · Pure transform / controlled OCCT adapter.** Compares the transform matrix with an independent Three.js quaternion and checks OCCT wrapper construction and cleanup with controlled objects.

**Limits:** The controlled-wrapper tests do not execute the OCCT kernel; the companion file does.

187. **[arbitrary mixed XYZ rotations and translations match the actual Three quaternion convention](../artifacts/kineticad/tests/part-transform.test.mjs#L14)** — PASS, 3.529 ms.
   Checks include: <code>assert.ok(Math.abs(v - expected[i]) &lt; 1e-10)</code>; <code>assert.deepEqual(transform(m, [0, 0, 0]), tx.positionMm, &#x27;world translation must never be rotated&#x27;)</code>.

188. **[invalid transforms fail before constructing OCCT values](../artifacts/kineticad/tests/part-transform.test.mjs#L26)** — PASS, 0.406 ms.
   Checks include: <code>assert.throws(() =&gt; partTransformMatrix({ positionMm: [value, 0, 0], rotationDeg: [0, 0, 0] }), /finite XYZ/)</code>; <code>assert.throws(() =&gt; partTransformMatrix({ positionMm: [0, 0, 0], rotationDeg: [0, NaN, 0] }), /finite XYZ/)</code>.

189. **[OCCT transform wrappers are released on constructor or shape-operation failures](../artifacts/kineticad/tests/part-transform.test.mjs#L32)** — PASS, 0.267 ms.
   Checks include: <code>assert.throws(() =&gt; makePartTransform({ gp_Trsf_1: FailingTransform }, cases[0]), /bad values/)</code>; <code>assert.equal(deleted, 1)</code>; <code>assert.throws(() =&gt; transformPartShape({ gp_Trsf_1: Transform, BRepBuilderAPI_Transform_2: FailingBuilder }, {}, cases[1]), /failed to apply/)</code>.

### physics-worker.test.mjs

**17 passed · Real Rapier worker.** Runs the shipped worker with analytic body descriptors and selected fixture joint settings. Checks motors, gravity, passive dynamics, supported local frames, rejection, timing and relative gimbal rates.

**Limits:** Selected fixture joints can use analytic test bodies, not all final demo BReps. Finite test gates are not general mechanical certification; unsupported frames and planar joints intentionally reject.

190. **[windmill seed mate retains pi ±5e-7 rad/s after five seconds with an analytical rotor](../artifacts/kineticad/tests/physics-worker.test.mjs#L82)** — PASS, 576.083 ms.
   Checks include: <code>close(entry.bodyBangvelMag, Math.PI, 5e-7, &#x27;30 RPM magnitude&#x27;)</code>; <code>close(entry.bodyBangvel.z, Math.PI, 5e-7, &#x27;30 RPM Z axis&#x27;)</code>; <code>close(Math.hypot(entry.bodyBangvel.x, entry.bodyBangvel.y), 0, 1e-6, &#x27;off-axis velocity&#x27;)</code>.
   Assertion helpers: [build](../artifacts/kineticad/tests/physics-worker.test.mjs#L64), [step](../artifacts/kineticad/tests/physics-worker.test.mjs#L72), [close](../artifacts/kineticad/tests/physics-worker.test.mjs#L45).

191. **[free fall uses millimetres, seconds, kilograms and is independent of mass](../artifacts/kineticad/tests/physics-worker.test.mjs#L107)** — PASS, 29.906 ms.
   Checks include: <code>close(pose.positionMm[2], expected, 12, &#x27;one-second free fall; at most 0.25% integration error&#x27;)</code>; <code>close(result.transforms[0].positionMm[2], result.transforms[1].positionMm[2], 0.001, &#x27;mass-independent acceleration&#x27;)</code>.
   Assertion helpers: [build](../artifacts/kineticad/tests/physics-worker.test.mjs#L64), [step](../artifacts/kineticad/tests/physics-worker.test.mjs#L72), [close](../artifacts/kineticad/tests/physics-worker.test.mjs#L45).

192. **[zero and blank live revolute commands release the motor so a rotor coasts](../artifacts/kineticad/tests/physics-worker.test.mjs#L116)** — PASS, 114.248 ms.
   Checks include: <code>close(diagnostics.at(-1).relativeAngularSpeedRadPerSec, Math.PI, 5e-7, &#x27;powered rotor&#x27;)</code>; <code>close(released.relativeAngularSpeedRadPerSec, Math.PI, 1e-5, &#x27;unpowered rotor retains angular momentum within float32 integration error&#x27;)</code>; <code>close(released.anchorSeparationMm, 0, 0.001, &#x27;released rotor retains hinge anchors&#x27;)</code>.
   Assertion helpers: [build](../artifacts/kineticad/tests/physics-worker.test.mjs#L64), [step](../artifacts/kineticad/tests/physics-worker.test.mjs#L72), [close](../artifacts/kineticad/tests/physics-worker.test.mjs#L45).

193. **[zero and blank live prismatic commands release the slider to gravity](../artifacts/kineticad/tests/physics-worker.test.mjs#L135)** — PASS, 62.439 ms.
   Checks include: <code>close(second.relativeLinearSpeedMmPerSec - first.relativeLinearSpeedMmPerSec, -9810 / 4, 1, &#x27;released slider has gravitational acceleration&#x27;)</code>; <code>close(diagnostics.at(-1).relativeLinearSpeedMmPerSec, poweredVelocity, 0.001, &#x27;slider drive resumes its previous response against gravity&#x27;)</code>; <code>assert.equal((await physics.updateJointMotor({ mateId: &#x27;slide&#x27;, motorVelocityMmPerSec: off })).ok, true)</code>.
   Assertion helpers: [build](../artifacts/kineticad/tests/physics-worker.test.mjs#L64), [step](../artifacts/kineticad/tests/physics-worker.test.mjs#L72), [close](../artifacts/kineticad/tests/physics-worker.test.mjs#L45).

194. **[unpowered pendulum follows the analytical physical-pendulum period](../artifacts/kineticad/tests/physics-worker.test.mjs#L156)** — PASS, 57.301 ms.
   Checks include: <code>close(observed, expected, expected * 0.02, &#x27;physical-pendulum period&#x27;)</code>; <code>close(maximumAnchorError, 0, 0.5, &#x27;hinge anchor drift in mm&#x27;)</code>; <code>assert.ok(crossings.length &gt;= 3, &#x27;pendulum oscillates freely without a motor&#x27;)</code>.
   Assertion helpers: [build](../artifacts/kineticad/tests/physics-worker.test.mjs#L64), [close](../artifacts/kineticad/tests/physics-worker.test.mjs#L45).

195. **[revolute motor follows part A local axis when both bodies share a rotated frame](../artifacts/kineticad/tests/physics-worker.test.mjs#L180)** — PASS, 22.365 ms.
   Checks include: <code>nearVector([omega.x, omega.y, omega.z], [Math.PI, 0, 0], 2e-5, &#x27;local Z becomes world X&#x27;)</code>.
   Assertion helpers: [build](../artifacts/kineticad/tests/physics-worker.test.mjs#L64), [step](../artifacts/kineticad/tests/physics-worker.test.mjs#L72), [nearVector](../artifacts/kineticad/tests/physics-worker.test.mjs#L46).

196. **[prismatic motor follows rotated local axis and preserves lateral position](../artifacts/kineticad/tests/physics-worker.test.mjs#L187)** — PASS, 25.279 ms.
   Checks include: <code>nearVector(subtract(second.positionMm, first.positionMm), [100, 0, 0], 0.05, &#x27;100 mm/s world-X motion&#x27;)</code>; <code>close(diagnostics.at(-1).relativeLinearSpeedMmPerSec, 100, 0.01, &#x27;diagnostic reports slider velocity, not angular speed&#x27;)</code>.
   Assertion helpers: [build](../artifacts/kineticad/tests/physics-worker.test.mjs#L64), [step](../artifacts/kineticad/tests/physics-worker.test.mjs#L72), [nearVector](../artifacts/kineticad/tests/physics-worker.test.mjs#L46), [close](../artifacts/kineticad/tests/physics-worker.test.mjs#L45).

197. **[fixed mate preserves an initially translated and rotated child](../artifacts/kineticad/tests/physics-worker.test.mjs#L197)** — PASS, 19.742 ms.
   Checks include: <code>nearVector(final.positionMm, position, 0.01, &#x27;fixed relative position&#x27;)</code>; <code>close(Math.abs(dot(first.rotationQuat, final.rotationQuat)), 1, 1e-5, &#x27;fixed relative orientation&#x27;)</code>.
   Assertion helpers: [build](../artifacts/kineticad/tests/physics-worker.test.mjs#L64), [step](../artifacts/kineticad/tests/physics-worker.test.mjs#L72), [nearVector](../artifacts/kineticad/tests/physics-worker.test.mjs#L46), [close](../artifacts/kineticad/tests/physics-worker.test.mjs#L45).

198. **[unsupported mismatched joint frames stop the whole world instead of snapping parts](../artifacts/kineticad/tests/physics-worker.test.mjs#L225)** — PASS, 8.024 ms.
   Checks include: <code>assert.equal(result.ok, false)</code>; <code>assert.match(result.error, /joint-frame-unsupported/)</code>; <code>assert.deepEqual((await physics.step()).transforms, [])</code>.

199. **[revolute allows initial twist about its shared axis; prismatic rejects that twist](../artifacts/kineticad/tests/physics-worker.test.mjs#L235)** — PASS, 24.668 ms.
   Checks include: <code>close(diagnostics.at(-1).relativeAngularSpeedRadPerSec, Math.PI, 5e-7, &#x27;supported revolute twist&#x27;)</code>; <code>assert.equal(result.ok, false)</code>; <code>assert.match(result.error, /joint-frame-unsupported/)</code>.
   Assertion helpers: [build](../artifacts/kineticad/tests/physics-worker.test.mjs#L64), [step](../artifacts/kineticad/tests/physics-worker.test.mjs#L72), [close](../artifacts/kineticad/tests/physics-worker.test.mjs#L45).

200. **[unsupported planar constraints stop simulation rather than being omitted](../artifacts/kineticad/tests/physics-worker.test.mjs#L247)** — PASS, 0.571 ms.
   Checks include: <code>assert.equal(result.ok, false)</code>; <code>assert.match(result.error, /planar mates are not supported/)</code>; <code>assert.deepEqual((await physics.step()).transforms, [])</code>.

201. **[a mate referencing a hidden or missing body rejects the whole incomplete assembly](../artifacts/kineticad/tests/physics-worker.test.mjs#L254)** — PASS, 0.673 ms.
   Checks include: <code>assert.equal(result.ok, false)</code>; <code>assert.match(result.error, /missing part geometry.*hidden-rotor/)</code>; <code>assert.deepEqual((await physics.step()).transforms, [])</code>.
   Assertion helpers: [build](../artifacts/kineticad/tests/physics-worker.test.mjs#L64).

202. **[new gimbal seed drives each relative joint speed, not each child world-speed magnitude](../artifacts/kineticad/tests/physics-worker.test.mjs#L266)** — PASS, 80.761 ms.
   Checks include: <code>close(entry.relativeAngularSpeedRadPerSec, speed, 1e-6, &#x27;production relative-speed diagnostic matches independent reconstruction&#x27;)</code>; <code>close(entry.targetAngularSpeedRadPerSec, target, 1e-12, &#x27;production diagnostic target&#x27;)</code>; <code>close(maximumError, 0, 0.02, &#x27;maximum relative motor-speed error in rad/s&#x27;)</code>.
   Assertion helpers: [build](../artifacts/kineticad/tests/physics-worker.test.mjs#L64), [step](../artifacts/kineticad/tests/physics-worker.test.mjs#L72), [close](../artifacts/kineticad/tests/physics-worker.test.mjs#L45).

203. **[fixed solver stepping gives identical motion at 30 Hz, 144 Hz and irregular render rates](../artifacts/kineticad/tests/physics-worker.test.mjs#L305)** — PASS, 27.536 ms.
   Checks include: <code>close(advanced, 1000, 1e-9, &#x27;actual solver time&#x27;)</code>; <code>assert.deepEqual(runs[1], runs[0])</code>; <code>assert.deepEqual(runs[2], runs[0])</code>.
   Assertion helpers: [build](../artifacts/kineticad/tests/physics-worker.test.mjs#L64), [close](../artifacts/kineticad/tests/physics-worker.test.mjs#L45).

204. **[fractional requests accumulate; zero pauses and undefined advances one configured step](../artifacts/kineticad/tests/physics-worker.test.mjs#L323)** — PASS, 6.229 ms.
   Checks include: <code>assert.equal(fraction.dtMs, 0)</code>; <code>assert.deepEqual(fraction.transforms, initial.transforms)</code>; <code>assert.equal((await physics.step(6)).dtMs, 10)</code>.
   Assertion helpers: [build](../artifacts/kineticad/tests/physics-worker.test.mjs#L64).

205. **[bounded catch-up retains time instead of dropping it and zero never drains backlog](../artifacts/kineticad/tests/physics-worker.test.mjs#L342)** — PASS, 2.118 ms.
   Checks include: <code>assert.equal(first.dtMs, 1200)</code>; <code>assert.equal(paused.dtMs, 0)</code>; <code>assert.deepEqual(paused.transforms, first.transforms)</code>.
   Assertion helpers: [build](../artifacts/kineticad/tests/physics-worker.test.mjs#L64).

206. **[playback time scaling advances only the actual zero, one or two seconds requested](../artifacts/kineticad/tests/physics-worker.test.mjs#L354)** — PASS, 10.045 ms.
   Checks include: <code>close(actualMs, speed * 1000, 1e-9, &#x27;scaled solver time&#x27;)</code>; <code>close(100000 - finalBySpeed.get(1), 4905, 15, &#x27;one-second displacement&#x27;)</code>; <code>close(100000 - finalBySpeed.get(2), 19620, 30, &#x27;two-second displacement&#x27;)</code>.
   Assertion helpers: [build](../artifacts/kineticad/tests/physics-worker.test.mjs#L64), [close](../artifacts/kineticad/tests/physics-worker.test.mjs#L45).

### project-cad-roundtrip.test.mjs

**2 passed · Real OCCT worker restart.** Packages imported STEP, terminates/restarts actual CAD workers and restores native history, transforms, imported topology/mass and subsequent feature edits; also checks legacy live-asset migration.

**Limits:** Automated worker restart and byte packaging do not click a native Save/Load dialog or test every browser storage failure.

207. **[actual worker restores embedded STEP after worker restart, retaining native history, transforms, topology and exportable geometry](../artifacts/kineticad/tests/project-cad-roundtrip.test.mjs#L29)** — PASS, 18404.967 ms.
   Checks include: <code>assert.equal(imported.parts.length, 1)</code>; <code>assert.ok(Math.abs(before.volumeMm3 - 3717.256661176908) &lt; 1e-6)</code>; <code>assert.ok(top?.planeBasis)</code>.

208. **[a legacy live import is packaged in local coordinates and missing old worker geometry fails clearly](../artifacts/kineticad/tests/project-cad-roundtrip.test.mjs#L86)** — PASS, 8621.495 ms.
   Checks include: <code>assert.equal(project.assets.length, 1)</code>; <code>assert.equal(project.assets[0].preserveCoordinates, true)</code>; <code>assert.notEqual(project.state.assembly.parts[1].features[0].shapeId, legacy.shapeId)</code>.

### project-persistence.test.mjs

**13 passed · Actual project code / memory repository.** Exercises packaging, parser, restore and recovery code with controlled storage/repository adapters, corruption/quota/version faults and real store/demo isolation.

**Limits:** The repository is controlled; real IndexedDB and native file-picker acceptance are separate evidence.

209. **[complete project downloads and both recovery generations retain Boolean material, result ground and joint revisions](../artifacts/kineticad/tests/project-persistence.test.mjs#L38)** — PASS, 40.032 ms.
   Checks include: <code>assert.deepEqual(loaded.state.assembly,state.assembly)</code>; <code>assert.equal(planAssemblySimulation(loaded.state.assembly).booleans[0].materialId,&#x27;titanium-grade5&#x27;)</code>; <code>assert.equal(JSON.parse(h.saved.current.payload).state.assembly.booleanFeatures[0].materialId,&#x27;brass-c36000&#x27;)</code>.

210. **[Boolean project parsing rejects invalid materials/body references and retains stale revisions for explicit repicking](../artifacts/kineticad/tests/project-persistence.test.mjs#L55)** — PASS, 7.732 ms.
   Checks include: <code>assert.throws(()=&gt;document(state))</code>; <code>assert.deepEqual(loaded.state.assembly.mates[0].booleanGeometryHashes,state.assembly.mates[0].booleanGeometryHashes)</code>; <code>assert.throws(()=&gt;planAssemblySimulation(loaded.state.assembly),/Finished attachment.*changed since/)</code>.

211. **[native history, transforms, materials and mates survive with runtime stopped](../artifacts/kineticad/tests/project-persistence.test.mjs#L67)** — PASS, 1.596 ms.
   Checks include: <code>assert.deepEqual(loaded.state.assembly, state.assembly)</code>; <code>assert.equal(loaded.state.simulation.running, false)</code>; <code>assert.equal(loaded.state.simulation.simulationTimeMs, 0)</code>.

212. **[Save accepts the live Zustand object without cloning actions or editor state](../artifacts/kineticad/tests/project-persistence.test.mjs#L75)** — PASS, 1.393 ms.
   Checks include: <code>assert.equal(saved.state.assembly.name, state.assembly.name)</code>; <code>assert.equal(&#x27;setMode&#x27; in saved.state, false)</code>; <code>assert.equal(&#x27;selection&#x27; in saved.state, false)</code>.

213. **[malformed references, dimensions, transforms and unknown features reject](../artifacts/kineticad/tests/project-persistence.test.mjs#L82)** — PASS, 4.816 ms.
   Checks include: <code>assert.throws(() =&gt; parseProjectState(state))</code>.

214. **[six-axis configuration persists and invalid target rejects](../artifacts/kineticad/tests/project-persistence.test.mjs#L93)** — PASS, 79.013 ms.
   Checks include: <code>assert.deepEqual(document(state).state.simulation.stewartMotion, state.simulation.stewartMotion)</code>; <code>assert.throws(() =&gt; document(state))</code>.

215. **[corrupt embedded bytes reject before asset reconstruction or storage changes](../artifacts/kineticad/tests/project-persistence.test.mjs#L101)** — PASS, 9.508 ms.
   Checks include: <code>assert.rejects(h.persistence.load(JSON.stringify(doc)), /checksum failed/)</code>; <code>assert.equal(h.restores.length, 0)</code>; <code>assert.deepEqual(h.saved, {})</code>.

216. **[invalid downloaded project does not replace the current or previous snapshots](../artifacts/kineticad/tests/project-persistence.test.mjs#L111)** — PASS, 3.078 ms.
   Checks include: <code>assert.rejects(h.persistence.load(&#x27;{broken&#x27;))</code>; <code>assert.rejects(h.persistence.load(JSON.stringify(invalid)), /embedded STEP/)</code>; <code>assert.deepEqual(h.saved, before)</code>.

217. **[autosave keeps two complete generations and quota failure retains both](../artifacts/kineticad/tests/project-persistence.test.mjs#L122)** — PASS, 3.404 ms.
   Checks include: <code>assert.equal(name(h.saved.current), &#x27;Second&#x27;)</code>; <code>assert.equal(name(h.saved.previous), &#x27;First&#x27;)</code>; <code>assert.deepEqual(h.saved, before)</code>.

218. **[corrupt newest recovery falls back to validated previous without overwriting either](../artifacts/kineticad/tests/project-persistence.test.mjs#L137)** — PASS, 2.980 ms.
   Checks include: <code>assert.deepEqual(restored.state, document().state)</code>; <code>assert.equal(h.reports.at(-1).recovered, true)</code>; <code>assert.deepEqual(h.saved, before)</code>.

219. **[newest state is captured before async work and load follows queued autosave](../artifacts/kineticad/tests/project-persistence.test.mjs#L146)** — PASS, 2.892 ms.
   Checks include: <code>assert.equal(name(h.saved.current), &#x27;Loaded&#x27;)</code>; <code>assert.equal(name(h.saved.previous), &#x27;Before load&#x27;)</code>.

220. **[real Zustand demo isolation preserves durable project and last-good copy](../artifacts/kineticad/tests/project-persistence.test.mjs#L155)** — PASS, 1.696 ms.
   Checks include: <code>assert.equal(name(h.saved.current), &#x27;My revised project&#x27;)</code>; <code>assert.equal(store.getState().assembly.name, &#x27;My revised project&#x27;)</code>; <code>assert.equal(name(h.saved.current), &#x27;My revised project&#x27;)</code>.

221. **[version 8 migration runs before validation; old missing STEP files reject clearly](../artifacts/kineticad/tests/project-persistence.test.mjs#L172)** — PASS, 2.553 ms.
   Checks include: <code>assert.equal(migratedVersion, 8)</code>; <code>assert.equal(doc.state.assembly.parts[0].materialId, &#x27;aluminium-6061&#x27;)</code>; <code>assert.rejects(persistence.parseFile(JSON.stringify(old)), /does not contain its imported STEP/)</code>.

### simulation-runner.test.mjs

**18 passed · Actual runner / controlled workers.** Exercises the shipped runner, physical planner and geometry signatures with deterministic frames and controlled CAD/physics/render adapters. Tests stale replies, editing, motor-only updates, pause and teardown.

**Limits:** This is a race/data-validity harness; it does not independently validate the physics solver or browser rendering.

222. **[runner simulates the final Boolean body once with world-frame mesh/mass and suppresses every consumed source](../artifacts/kineticad/tests/simulation-runner.test.mjs#L134)** — PASS, 171.435 ms.
   Checks include: <code>assert.deepEqual(args.parts.map(p=&gt;p.id),[&#x27;base&#x27;,&#x27;boolean:finished&#x27;])</code>; <code>assert.deepEqual(result.transform,{positionMm:[0,0,0],rotationDeg:[0,0,0]})</code>; <code>assert.deepEqual(result.meshPositions,body.mesh.positions)</code>.

223. **[a disconnected final-solid rejection creates no world and leaves the modelling layers visible](../artifacts/kineticad/tests/simulation-runner.test.mjs#L153)** — PASS, 11.778 ms.
   Checks include: <code>assert.equal(harness.calls.includes(&#x27;build&#x27;),false)</code>; <code>assert.equal(harness.store.getState().simulation.running,false)</code>; <code>assert.equal(harness.booleanLayer.group.visible,true)</code>.

224. **[native source edits during pending Boolean CAD preparation reject the stale result before physics dispatch](../artifacts/kineticad/tests/simulation-runner.test.mjs#L161)** — PASS, 5.966 ms.
   Checks include: <code>assert.equal(cadCalls,1)</code>; <code>assert.equal(harness.calls.includes(&#x27;build&#x27;),false)</code>; <code>assert.equal(harness.store.getState().simulation.running,false)</code>.

225. **[Boolean result motor-only edits during CAD preparation use the latest command and preserve valid geometry](../artifacts/kineticad/tests/simulation-runner.test.mjs#L171)** — PASS, 6.603 ms.
   Checks include: <code>assert.equal(args.mates[0].motorSpeedRpm,60)</code>; <code>assert.equal(updates,0)</code>; <code>assert.equal(harness.store.getState().simulation.running,true)</code>.

226. **[geometry changed during an in-flight world build cannot publish stale Boolean bodies or start its clock](../artifacts/kineticad/tests/simulation-runner.test.mjs#L183)** — PASS, 6.173 ms.
   Checks include: <code>assert.equal(harness.calls.includes(&#x27;build&#x27;),true)</code>; <code>assert.equal(harness.store.getState().simulation.running,false)</code>; <code>assert.equal(harness.store.getState().simulation.simulationTimeMs,0)</code>.

227. **[a geometry edit after Play stops the run and rejects an already-pending pose response](../artifacts/kineticad/tests/simulation-runner.test.mjs#L194)** — PASS, 5.095 ms.
   Checks include: <code>assert.equal(harness.store.getState().simulation.running,false)</code>; <code>assert.equal(harness.poses.length,0)</code>; <code>assert.equal(harness.store.getState().simulation.simulationTimeMs,0)</code>.
   Assertion helpers: [runningStep](../artifacts/kineticad/tests/simulation-runner.test.mjs#L105).

228. **[invalid Boolean material cannot silently simulate original uncut inputs](../artifacts/kineticad/tests/simulation-runner.test.mjs#L201)** — PASS, 17.459 ms.
   Checks include: <code>assert.equal(harness.store.getState().simulation.running, false)</code>; <code>assert.equal(harness.calls.includes(&#x27;build&#x27;), false)</code>; <code>assert.equal(harness.poses.length, 0)</code>.

229. **[runner permits one in-flight step, retains elapsed time, and counts actual worker time](../artifacts/kineticad/tests/simulation-runner.test.mjs#L213)** — PASS, 5.036 ms.
   Checks include: <code>assert.equal(harness.pending.length, 1)</code>; <code>assert.deepEqual(harness.calls.filter(Array.isArray), [[&#x27;step&#x27;, 10], [&#x27;step&#x27;, 30]])</code>; <code>assert.equal(harness.maxSimultaneousSteps, 1)</code>.
   Assertion helpers: [runningStep](../artifacts/kineticad/tests/simulation-runner.test.mjs#L105).

230. **[finite experiments hold the final solver pose and clock instead of resetting the model](../artifacts/kineticad/tests/simulation-runner.test.mjs#L230)** — PASS, 3.748 ms.
   Checks include: <code>assert.equal(harness.store.getState().simulation.running,true)</code>; <code>assert.equal(harness.store.getState().simulation.paused,true)</code>; <code>assert.equal(harness.store.getState().simulation.simulationTimeMs,10)</code>.
   Assertion helpers: [runningStep](../artifacts/kineticad/tests/simulation-runner.test.mjs#L105).

231. **[late RPC response cannot move the paused pose or clock; resume preserves its actual time](../artifacts/kineticad/tests/simulation-runner.test.mjs#L243)** — PASS, 7.499 ms.
   Checks include: <code>assert.equal(harness.pending.length, 1)</code>; <code>assert.equal(harness.store.getState().simulation.simulationTimeMs, 0)</code>; <code>assert.equal(harness.poses.length, 0)</code>.
   Assertion helpers: [runningStep](../artifacts/kineticad/tests/simulation-runner.test.mjs#L105).

232. **[stopped or replaced assembly ignores a late step response](../artifacts/kineticad/tests/simulation-runner.test.mjs#L262)** — PASS, 4.666 ms.
   Checks include: <code>assert.equal(harness.poses.length, 0)</code>; <code>assert.equal(harness.store.getState().simulation.simulationTimeMs, 0)</code>; <code>assert.equal(harness.partLayer.group.visible, true)</code>.
   Assertion helpers: [runningStep](../artifacts/kineticad/tests/simulation-runner.test.mjs#L105).

233. **[old build reply and teardown cannot destroy the replacement scene world](../artifacts/kineticad/tests/simulation-runner.test.mjs#L274)** — PASS, 3.932 ms.
   Checks include: <code>assert.deepEqual(harness.calls, [&#x27;build-1&#x27;, &#x27;destroy&#x27;, &#x27;build-2&#x27;])</code>; <code>assert.equal(harness.simLayer.visible, true)</code>; <code>assert.equal(harness.store.getState().simulation.running, true)</code>.

234. **[invalid cached mass stops the current run and restores modelling layers](../artifacts/kineticad/tests/simulation-runner.test.mjs#L297)** — PASS, 4.032 ms.
   Checks include: <code>assert.equal(harness.store.getState().simulation.running, false)</code>; <code>assert.equal(harness.partLayer.group.visible, true)</code>; <code>assert.equal(harness.simLayer.visible, false)</code>.

235. **[rejected build RPC is caught and does not poison the next successful build](../artifacts/kineticad/tests/simulation-runner.test.mjs#L309)** — PASS, 9.431 ms.
   Checks include: <code>assert.equal(harness.store.getState().simulation.running, false)</code>; <code>assert.equal(harness.toasts.length, 1)</code>; <code>assert.equal(builds, 2)</code>.

236. **[motor edits during pending CAD work reach the world that is eventually built](../artifacts/kineticad/tests/simulation-runner.test.mjs#L326)** — PASS, 3.743 ms.
   Checks include: <code>assert.equal(builtRpm, 60)</code>; <code>assert.equal(prematureUpdates, 0)</code>; <code>assert.equal(harness.store.getState().simulation.running, true)</code>.

237. **[motor edits during an in-flight build replay before the first solver step](../artifacts/kineticad/tests/simulation-runner.test.mjs#L350)** — PASS, 2.997 ms.
   Checks include: <code>assert.deepEqual(harness.calls, [[&#x27;build-rpm&#x27;, 30]])</code>; <code>assert.deepEqual(harness.calls, [[&#x27;build-rpm&#x27;, 30], [&#x27;update-rpm&#x27;, 90], [&#x27;step&#x27;, 10]])</code>.

238. **[six-axis build validates source solids and uses its own full movement duration](../artifacts/kineticad/tests/simulation-runner.test.mjs#L370)** — PASS, 2.719 ms.
   Checks include: <code>assert.equal(assembly, harness.store.getState().assembly)</code>; <code>assert.deepEqual(order, [&#x27;source guard&#x27;, &#x27;build&#x27;])</code>; <code>assert.deepEqual(args.stewartMotion, motion)</code>.

239. **[six-axis source rejection never creates a physics world](../artifacts/kineticad/tests/simulation-runner.test.mjs#L381)** — PASS, 3.813 ms.
   Checks include: <code>assert.equal(harness.store.getState().simulation.running, false)</code>; <code>assert.equal(harness.calls.includes(&#x27;build&#x27;), false)</code>; <code>assert.match(harness.toasts[0][1].description, /Edited solids/)</code>.

### sketch-arcs.test.mjs

**7 passed · Real OCCT operations.** Builds arcs in all three sketch UV planes, checks analytic sector/sphere geometry and validates the Stewart turned profiles.

**Limits:** These are explicit curve/profile fixtures; arbitrary mixed-wire closure and topology are not universally guaranteed.

240. **[XY arc endpoints and intermediate samples agree with sketch UV; sector extrudes with analytic volume and centroid](../artifacts/kineticad/tests/sketch-arcs.test.mjs#L19)** — PASS, 8098.159 ms.
   Checks include: <code>close(v, expected[i])</code>; <code>close(props.volumeMm3, radius ** 2 * sweep * depth / 2)</code>; <code>close(v, centroid[i])</code>.
   Assertion helpers: [close](../artifacts/kineticad/tests/sketch-arcs.test.mjs#L13).

241. **[XY semicircle revolves to an exact sphere about the sketch V axis](../artifacts/kineticad/tests/sketch-arcs.test.mjs#L60)** — PASS, 52.889 ms.
   Checks include: <code>close(props.volumeMm3, 4 * Math.PI * radius ** 3 / 3)</code>; <code>close(v, lift(plane, centre)[i])</code>; <code>assert.equal(validity.valid, true)</code>.
   Assertion helpers: [close](../artifacts/kineticad/tests/sketch-arcs.test.mjs#L13).

242. **[XZ arc endpoints and intermediate samples agree with sketch UV; sector extrudes with analytic volume and centroid](../artifacts/kineticad/tests/sketch-arcs.test.mjs#L19)** — PASS, 22.617 ms.
   Checks include: <code>close(v, expected[i])</code>; <code>close(props.volumeMm3, radius ** 2 * sweep * depth / 2)</code>; <code>close(v, centroid[i])</code>.
   Assertion helpers: [close](../artifacts/kineticad/tests/sketch-arcs.test.mjs#L13).

243. **[XZ semicircle revolves to an exact sphere about the sketch V axis](../artifacts/kineticad/tests/sketch-arcs.test.mjs#L60)** — PASS, 13.180 ms.
   Checks include: <code>close(props.volumeMm3, 4 * Math.PI * radius ** 3 / 3)</code>; <code>close(v, lift(plane, centre)[i])</code>; <code>assert.equal(validity.valid, true)</code>.
   Assertion helpers: [close](../artifacts/kineticad/tests/sketch-arcs.test.mjs#L13).

244. **[YZ arc endpoints and intermediate samples agree with sketch UV; sector extrudes with analytic volume and centroid](../artifacts/kineticad/tests/sketch-arcs.test.mjs#L19)** — PASS, 22.917 ms.
   Checks include: <code>close(v, expected[i])</code>; <code>close(props.volumeMm3, radius ** 2 * sweep * depth / 2)</code>; <code>close(v, centroid[i])</code>.
   Assertion helpers: [close](../artifacts/kineticad/tests/sketch-arcs.test.mjs#L13).

245. **[YZ semicircle revolves to an exact sphere about the sketch V axis](../artifacts/kineticad/tests/sketch-arcs.test.mjs#L60)** — PASS, 11.163 ms.
   Checks include: <code>close(props.volumeMm3, 4 * Math.PI * radius ** 3 / 3)</code>; <code>close(v, lift(plane, centre)[i])</code>; <code>assert.equal(validity.valid, true)</code>.
   Assertion helpers: [close](../artifacts/kineticad/tests/sketch-arcs.test.mjs#L13).

246. **[both Stewart turning profiles retain exact circular ends and rebuild as single valid solids](../artifacts/kineticad/tests/sketch-arcs.test.mjs#L79)** — PASS, 53.029 ms.
   Checks include: <code>assert.equal(part.sketches[0].primitives.filter((primitive) =&gt; primitive.type === &#x27;arc&#x27;).length, 1)</code>; <code>assert.equal(result.valid, true, id)</code>; <code>assert.equal(result.solids, 1, id)</code>.

### sketch-dimensions-cad.test.mjs

**10 passed · Real OCCT operations.** Rebuilds edited circles, rectangles, closed lines and arc sectors and compares analytic BRep volume, COM and bounds, including all sketch planes and invalid open profiles.

**Limits:** Checks the listed dimensions and persistence geometry. General sketch constraints and automatic neighboring-endpoint repair are not implemented or claimed.

247. **[editing circle diameter20→30 mm rebuilds an exact cylinder with the expected volume, bounds and mass](../artifacts/kineticad/tests/sketch-dimensions-cad.test.mjs#L64)** — PASS, 7199.008 ms.
   Checks include: <code>close(after.volumeMm3 / before.volumeMm3, 2.25)</code>; <code>close(after.massKg / before.massKg, 2.25)</code>; <code>close(v, [7, -4, 6][i])</code>.
   Assertion helpers: [edit](../artifacts/kineticad/tests/sketch-dimensions-cad.test.mjs#L24), [properties](../artifacts/kineticad/tests/sketch-dimensions-cad.test.mjs#L45), [close](../artifacts/kineticad/tests/sketch-dimensions-cad.test.mjs#L19), [compareBounds](../artifacts/kineticad/tests/sketch-dimensions-cad.test.mjs#L56).

248. **[XY rectangle width and height edits change exact solid dimensions in the sketch's U/V axes](../artifacts/kineticad/tests/sketch-dimensions-cad.test.mjs#L81)** — PASS, 79.806 ms.
   Checks include: <code>close(v, expectedCentre[axis])</code>.
   Assertion helpers: [edit](../artifacts/kineticad/tests/sketch-dimensions-cad.test.mjs#L24), [properties](../artifacts/kineticad/tests/sketch-dimensions-cad.test.mjs#L45), [close](../artifacts/kineticad/tests/sketch-dimensions-cad.test.mjs#L19), [compareBounds](../artifacts/kineticad/tests/sketch-dimensions-cad.test.mjs#L56).

249. **[XZ rectangle width and height edits change exact solid dimensions in the sketch's U/V axes](../artifacts/kineticad/tests/sketch-dimensions-cad.test.mjs#L81)** — PASS, 56.396 ms.
   Checks include: <code>close(v, expectedCentre[axis])</code>.
   Assertion helpers: [edit](../artifacts/kineticad/tests/sketch-dimensions-cad.test.mjs#L24), [properties](../artifacts/kineticad/tests/sketch-dimensions-cad.test.mjs#L45), [close](../artifacts/kineticad/tests/sketch-dimensions-cad.test.mjs#L19), [compareBounds](../artifacts/kineticad/tests/sketch-dimensions-cad.test.mjs#L56).

250. **[YZ rectangle width and height edits change exact solid dimensions in the sketch's U/V axes](../artifacts/kineticad/tests/sketch-dimensions-cad.test.mjs#L81)** — PASS, 58.348 ms.
   Checks include: <code>close(v, expectedCentre[axis])</code>.
   Assertion helpers: [edit](../artifacts/kineticad/tests/sketch-dimensions-cad.test.mjs#L24), [properties](../artifacts/kineticad/tests/sketch-dimensions-cad.test.mjs#L45), [close](../artifacts/kineticad/tests/sketch-dimensions-cad.test.mjs#L19), [compareBounds](../artifacts/kineticad/tests/sketch-dimensions-cad.test.mjs#L56).

251. **[line length/angle/start edits create a closed rotated rectangular profile with analytical area](../artifacts/kineticad/tests/sketch-dimensions-cad.test.mjs#L107)** — PASS, 21.698 ms.
   Checks include: <code>close(value, [...centre, 2.5][axis])</code>.
   Assertion helpers: [editedLineRectangle](../artifacts/kineticad/tests/sketch-dimensions-cad.test.mjs#L97), [properties](../artifacts/kineticad/tests/sketch-dimensions-cad.test.mjs#L45), [close](../artifacts/kineticad/tests/sketch-dimensions-cad.test.mjs#L19), [compareBounds](../artifacts/kineticad/tests/sketch-dimensions-cad.test.mjs#L56).

252. **[XY edited arc radius/start/sweep and its two lines rebuild the exact closed sector](../artifacts/kineticad/tests/sketch-dimensions-cad.test.mjs#L128)** — PASS, 27.851 ms.
   Checks include: <code>close(value, centroid[axis])</code>.
   Assertion helpers: [editedSector](../artifacts/kineticad/tests/sketch-dimensions-cad.test.mjs#L117), [properties](../artifacts/kineticad/tests/sketch-dimensions-cad.test.mjs#L45), [close](../artifacts/kineticad/tests/sketch-dimensions-cad.test.mjs#L19).

253. **[XZ edited arc radius/start/sweep and its two lines rebuild the exact closed sector](../artifacts/kineticad/tests/sketch-dimensions-cad.test.mjs#L128)** — PASS, 17.662 ms.
   Checks include: <code>close(value, centroid[axis])</code>.
   Assertion helpers: [editedSector](../artifacts/kineticad/tests/sketch-dimensions-cad.test.mjs#L117), [properties](../artifacts/kineticad/tests/sketch-dimensions-cad.test.mjs#L45), [close](../artifacts/kineticad/tests/sketch-dimensions-cad.test.mjs#L19).

254. **[YZ edited arc radius/start/sweep and its two lines rebuild the exact closed sector](../artifacts/kineticad/tests/sketch-dimensions-cad.test.mjs#L128)** — PASS, 17.755 ms.
   Checks include: <code>close(value, centroid[axis])</code>.
   Assertion helpers: [editedSector](../artifacts/kineticad/tests/sketch-dimensions-cad.test.mjs#L117), [properties](../artifacts/kineticad/tests/sketch-dimensions-cad.test.mjs#L45), [close](../artifacts/kineticad/tests/sketch-dimensions-cad.test.mjs#L19).

255. **[an arc-only edit does not silently move adjacent lines or disguise an open profile as a solid](../artifacts/kineticad/tests/sketch-dimensions-cad.test.mjs#L141)** — PASS, 19.336 ms.
   Checks include: <code>assert.deepEqual(candidate.slice(1), primitives.slice(1))</code>; <code>assert.throws(() =&gt; swept(candidate, &#x27;XY&#x27;, 4), /closed&#124;connect&#124;chain&#124;gap/i)</code>.
   Assertion helpers: [edit](../artifacts/kineticad/tests/sketch-dimensions-cad.test.mjs#L24), [properties](../artifacts/kineticad/tests/sketch-dimensions-cad.test.mjs#L45).

256. **[complete Save/parse preserves edited primitives and rebuilds identical actual CAD geometry](../artifacts/kineticad/tests/sketch-dimensions-cad.test.mjs#L154)** — PASS, 132.697 ms.
   Checks include: <code>close(second.volumeMm3, first.volumeMm3)</code>; <code>close(second.massKg, first.massKg, 1e-12)</code>; <code>close(value, first.comLocal[axis], 1e-9)</code>.
   Assertion helpers: [edit](../artifacts/kineticad/tests/sketch-dimensions-cad.test.mjs#L24), [editedLineRectangle](../artifacts/kineticad/tests/sketch-dimensions-cad.test.mjs#L97), [editedSector](../artifacts/kineticad/tests/sketch-dimensions-cad.test.mjs#L117), [properties](../artifacts/kineticad/tests/sketch-dimensions-cad.test.mjs#L45), [close](../artifacts/kineticad/tests/sketch-dimensions-cad.test.mjs#L19), [compareBounds](../artifacts/kineticad/tests/sketch-dimensions-cad.test.mjs#L56).

### sketch-dimensions.test.mjs

**9 passed · Pure dimension mathematics.** Checks complete form-value conversion, anchor conventions, line/arc angles, exact no-op identity, input limits and roundoff-safe boundary decoding.

**Limits:** This is dimensional editing without a geometric constraint graph or CAD-kernel validation.

257. **[fields expose persistent UV geometry with diameter and degree conventions](../artifacts/kineticad/tests/sketch-dimensions.test.mjs#L15)** — PASS, 2.599 ms.
   Checks include: <code>close(values(line).length, 5)</code>; <code>close(values(line).angle, 126.86989764584402)</code>; <code>close(values(arc).startAngle, 270)</code>.
   Assertion helpers: [close](../artifacts/kineticad/tests/sketch-dimensions.test.mjs#L7).

258. **[exact no-op edits retain primitive identity and all original floating-point coordinates](../artifacts/kineticad/tests/sketch-dimensions.test.mjs#L29)** — PASS, 1.535 ms.
   Checks include: <code>assert.equal(withPrimitiveDimensions(primitive, values(primitive)), primitive)</code>; <code>assert.deepEqual(primitive, original)</code>.

259. **[circle diameter and rectangle width/height edits preserve anchors and neighbours](../artifacts/kineticad/tests/sketch-dimensions.test.mjs#L39)** — PASS, 1.006 ms.
   Checks include: <code>assert.deepEqual(circle, { type: &#x27;circle&#x27;, centre: [7, -9], radius: 15 })</code>; <code>assert.deepEqual(rectangle, { type: &#x27;rectangle&#x27;, corner: [-7, 3], width: 31, height: 17 })</code>; <code>assert.equal(primitives[0].radius, 11)</code>.

260. **[line edits satisfy independent right-triangle, quadrant and winding references](../artifacts/kineticad/tests/sketch-dimensions.test.mjs#L51)** — PASS, 1.346 ms.
   Checks include: <code>close(longer.end[0], 13)</code>; <code>close(longer.end[1], -3)</code>; <code>close(coordinate, expected[axis])</code>.
   Assertion helpers: [close](../artifacts/kineticad/tests/sketch-dimensions.test.mjs#L7).

261. **[arc edits preserve centre and produce the stated circular endpoints and CCW sweep across zero](../artifacts/kineticad/tests/sketch-dimensions.test.mjs#L66)** — PASS, 0.486 ms.
   Checks include: <code>close(result.startAngle, 3 * Math.PI / 2)</code>; <code>close(result.endAngle, 5 * Math.PI / 2)</code>; <code>close(v, [4, -8][i])</code>.
   Assertion helpers: [close](../artifacts/kineticad/tests/sketch-dimensions.test.mjs#L7).

262. **[complete values reject unknown, missing, nonfinite, nonnumeric and out-of-domain edits without mutation](../artifacts/kineticad/tests/sketch-dimensions.test.mjs#L80)** — PASS, 2.389 ms.
   Checks include: <code>assert.throws(() =&gt; withPrimitiveDimensions(primitive, { ...complete, surprise: 1 }), /Unknown/)</code>; <code>assert.throws(() =&gt; withPrimitiveDimensions(primitive, missing), /Missing/)</code>; <code>assert.throws(() =&gt; withPrimitiveDimensions(primitive, { ...complete, [firstKey]: invalid }))</code>.

263. **[inclusive bounds accept valid stored coordinates and primitives remain editable after serialization](../artifacts/kineticad/tests/sketch-dimensions.test.mjs#L100)** — PASS, 3.945 ms.
   Checks include: <code>close(line.end[0], 1_000_000, 1e-6)</code>; <code>assert.equal(circle.radius, 0.0005)</code>; <code>assert.equal(withPrimitiveDimensions(primitive, values(primitive)), primitive)</code>.
   Assertion helpers: [close](../artifacts/kineticad/tests/sketch-dimensions.test.mjs#L7).

264. **[minimum lengths and arc sweeps survive cancellation at the maximum coordinate and angle scales](../artifacts/kineticad/tests/sketch-dimensions.test.mjs#L115)** — PASS, 3.154 ms.
   Checks include: <code>assert.equal(values(arc).sweepAngle, sweepAngle)</code>; <code>assert.equal(values(line).length, 0.001)</code>; <code>assert.equal(withPrimitiveDimensions(primitive, values(primitive)), primitive)</code>.

265. **[sketch validation allows empty/open geometry but rejects degenerate primitive dimensions](../artifacts/kineticad/tests/sketch-dimensions.test.mjs#L137)** — PASS, 1.362 ms.
   Checks include: <code>assert.throws(() =&gt; validateSketchDimensions([primitive]), /Primitive 1:/)</code>.

### sketch-edit.test.mjs

**14 passed · Actual store / controlled CAD.** Exercises the atomic edit coordinator with controlled CAD preflight and real store updates: downstream chains/Booleans, abort/CAS, failure retention, mates, cache reset and reference metadata invalidation.

**Limits:** CAD acceptance is supplied by the adapter; actual invalid/valid BReps are tested in sketch-dimensions-cad.

266. **[successful edit commits only after full-chain validation, preserving identities and clearing derived state](../artifacts/kineticad/tests/sketch-edit.test.mjs#L56)** — PASS, 9.178 ms.
   Checks include: <code>assert.equal(c.parts.length, 1)</code>; <code>assert.deepEqual(c.parts[0].args.features, before.assembly.parts[0].features)</code>; <code>assert.equal(store.getState(), before)</code>.

267. **[CAD history failure retains the committed sketch and can be retried](../artifacts/kineticad/tests/sketch-edit.test.mjs#L82)** — PASS, 2.603 ms.
   Checks include: <code>assert.rejects(first,/downstream fillet/)</code>; <code>assert.equal(store.getState(),before)</code>; <code>assert.equal(c.parts.length,2)</code>.

268. **[dependent assembly Boolean receives updated geometry and must succeed before commit](../artifacts/kineticad/tests/sketch-edit.test.mjs#L95)** — PASS, 14.706 ms.
   Checks include: <code>assert.equal(c.booleans.length,1)</code>; <code>assert.equal(c.booleans[0].args.inputs[0].sketches[0].primitives[0].width,30)</code>; <code>assert.deepEqual(c.booleans[0].args.inputs[1].features,before.assembly.parts[1].features)</code>.

269. **[a later geometry or Boolean-consumer edit invalidates a pending transaction](../artifacts/kineticad/tests/sketch-edit.test.mjs#L112)** — PASS, 1.910 ms.
   Checks include: <code>assert.rejects(pending,/model changed/)</code>; <code>assert.equal(store.getState(),newer)</code>; <code>assert.equal(source.primitives[0].width,20)</code>.

270. **[mass-cache churn and cosmetic part naming do not reject or overwrite newer display state](../artifacts/kineticad/tests/sketch-edit.test.mjs#L126)** — PASS, 1.033 ms.
   Checks include: <code>assert.equal(store.getState().assembly.name,&#x27;My renamed project&#x27;)</code>; <code>assert.equal(store.getState().assembly.parts[0].name,&#x27;Renamed part&#x27;)</code>; <code>assert.equal(store.getState().assembly.parts[1].massKg,123)</code>.

271. **[loading an identical-looking project during validation rejects its old Sketch identity](../artifacts/kineticad/tests/sketch-edit.test.mjs#L135)** — PASS, 1.407 ms.
   Checks include: <code>assert.rejects(pending,/model changed/)</code>; <code>assert.equal(store.getState(),loaded)</code>.

272. **[cancelled or closed editors cannot commit a late CAD result](../artifacts/kineticad/tests/sketch-edit.test.mjs#L144)** — PASS, 3.652 ms.
   Checks include: <code>assert.rejects(pending,abortSignal?/cancelled/:/Finish other edits/)</code>; <code>assert.equal(store.getState(),cancelled)</code>; <code>assert.equal(source.primitives[0].width,20)</code>.

273. **[two pending edits cannot commit out of order](../artifacts/kineticad/tests/sketch-edit.test.mjs#L156)** — PASS, 0.993 ms.
   Checks include: <code>assert.rejects(first,/Finish other edits&#124;model changed/)</code>; <code>assert.equal(store.getState(),committed)</code>; <code>assert.equal(committed.assembly.parts[0].sketches[0].primitives[0].width,40)</code>.

274. **[unchanged referenced edge geometry retains the exact joint and its local anchor](../artifacts/kineticad/tests/sketch-edit.test.mjs#L165)** — PASS, 2.722 ms.
   Checks include: <code>assert.equal(store.getState().assembly.mates[0],mate)</code>; <code>assert.deepEqual(mate.pivotA.localPoint,[0,5,0])</code>.

275. **[missing geometry IDs or a changed referenced face reject without guessing new pivots](../artifacts/kineticad/tests/sketch-edit.test.mjs#L173)** — PASS, 2.121 ms.
   Checks include: <code>assert.rejects(pending,/Pinned reference.*anchor has not been moved/)</code>; <code>assert.equal(store.getState(),before)</code>; <code>assert.equal(store.getState().assembly.mates[0],mate)</code>.

276. **[fixed mates and unused sketches need no geometric-pivot remapping](../artifacts/kineticad/tests/sketch-edit.test.mjs#L184)** — PASS, 0.311 ms.
   Checks include: <code>assert.equal(calls,0)</code>; <code>assert.equal(store.getState().assembly.mates[0],fixed)</code>.

277. **[meaningful edits clear canonical controllers and save the manual-geometry marker; no-op preserves them](../artifacts/kineticad/tests/sketch-edit.test.mjs#L191)** — PASS, 6.187 ms.
   Checks include: <code>assert.equal(store.getState().assembly,original.assembly)</code>; <code>assert.equal(store.getState().simulation,original.simulation)</code>; <code>assert.equal(store.getState().simulation.sketchGeometryEdited,undefined)</code>.

278. **[invalid dimensions, stale editor source and active editors reject before CAD dispatch](../artifacts/kineticad/tests/sketch-edit.test.mjs#L215)** — PASS, 0.865 ms.
   Checks include: <code>assert.rejects(apply(source,{buildPartMesh(){calls++;}},width))</code>; <code>assert.equal(calls,0)</code>; <code>assert.equal(source.primitives[0].width,20)</code>.

279. **[the store commit independently rejects a stale source signature](../artifacts/kineticad/tests/sketch-edit.test.mjs#L231)** — PASS, 0.312 ms.
   Checks include: <code>assert.throws(()=&gt;store.getState().updateSketch(&#x27;part&#x27;,&#x27;part-sketch&#x27;,edited(30),source,signature),/model changed/)</code>; <code>assert.equal(store.getState(),newer)</code>.

### stewart-controller.test.mjs

**6 passed · Pure mechanism mathematics.** Checks six-axis inverse kinematics, exact quaternion trajectory/reference calculations and stroke/speed/conditioning preflight guards, including all 64 simultaneous workspace corners.

**Limits:** Passing preflight is not a Rapier tracking test or force/torque capacity assessment. The 64-corner acceptance case checks non-rejection; separate bound tests examine the certificate.

280. **[six-axis IK agrees with independently transformed anchors for both directions of every axis](../artifacts/kineticad/tests/stewart-controller.test.mjs#L21)** — PASS, 78.074 ms.
   Checks include: <code>close(ik.legs[i].lengthMm,Math.hypot(...point.map((v,j)=&gt;v-leg.baseAnchor[j])))</code>; <code>close(v,r[i])</code>.
   Assertion helpers: [close](../artifacts/kineticad/tests/stewart-controller.test.mjs#L12).

281. **[all 64 simultaneous translation/rotation workspace corners satisfy stroke, speed and singularity guards](../artifacts/kineticad/tests/stewart-controller.test.mjs#L34)** — PASS, 123.164 ms.
   Validation must return without throwing: <code>validateStewartTrajectory(geometry,config(values.slice(0,3),values.slice(3)))</code>.

282. **[quintic trajectory starts and ends at rest and holds its final requested pose](../artifacts/kineticad/tests/stewart-controller.test.mjs#L41)** — PASS, 1.122 ms.
   Checks include: <code>close(v,geometry.home.positionMm[i])</code>; <code>close(stewartOrientationErrorDeg(start.rotationQuat,geometry.home.rotationQuat),0)</code>; <code>assert.deepEqual(end,stewartDesiredPose(geometry,c,6000))</code>.
   Assertion helpers: [close](../artifacts/kineticad/tests/stewart-controller.test.mjs#L12).

283. **[invalid values, speed requests, altered frames and altered anchors reject explicitly](../artifacts/kineticad/tests/stewart-controller.test.mjs#L55)** — PASS, 4.261 ms.
   Checks include: <code>assert.throws(()=&gt;validateStewartMotionConfig(c),/Stewart controller/)</code>; <code>assert.throws(()=&gt;validateStewartTrajectory(geometry,config([5,5,5],[2,2,2],1000)),/speed&#124;duration&#124;mm\/s/)</code>; <code>assert.throws(()=&gt;deriveStewartGeometry(changed,fixture.assembly.mates),/frames&#124;anchors/)</code>.

284. **[dimensionless Jacobian guard detects a collapsed singular geometry](../artifacts/kineticad/tests/stewart-controller.test.mjs#L64)** — PASS, 4.411 ms.
   Checks include: <code>close(stewartJacobianCondition(Array.from({length:6},(_,i)=&gt;Array.from({length:6},(_,j)=&gt;Number(i===j)))),1)</code>; <code>assert.equal(stewartJacobianCondition(Array.from({length:6},()=&gt;[1,0,0,0,0,0])),Infinity)</code>; <code>assert.throws(()=&gt;validateStewartTrajectory(g,config()),/singular/)</code>.
   Assertion helpers: [close](../artifacts/kineticad/tests/stewart-controller.test.mjs#L12).

285. **[orientation error measures tiny and sign-equivalent quaternions without acos cancellation](../artifacts/kineticad/tests/stewart-controller.test.mjs#L71)** — PASS, 0.340 ms.
   Checks include: <code>close(stewartOrientationErrorDeg([0,0,0,1],stewartQuaternion([0,0,0.00001])),0.00001,1e-12)</code>; <code>close(stewartOrientationErrorDeg(q,q.map(v=&gt;-v)),0)</code>.
   Assertion helpers: [close](../artifacts/kineticad/tests/stewart-controller.test.mjs#L12).

### stewart-geometry.test.mjs

**5 passed · Pure fixture mathematics.** Checks anchor coincidences, non-singular Jacobian arithmetic, symmetric heave and conservative geometry bounds from the native Stewart factory.

**Limits:** No OCCT intersections or loaded dynamics run in this file.

286. **[the editable v9 fixture forms one connected 14-body, 18-joint mechanism](../artifacts/kineticad/tests/stewart-geometry.test.mjs#L43)** — PASS, 11.145 ms.
   Checks include: <code>assert.equal(parts.length, 14)</code>; <code>assert.equal(mates.length, 18)</code>; <code>assert.equal(new Set(parts.map((part) =&gt; part.id)).size, 14)</code>.

287. **[every encoded joint closes in world space and each actuator uses compatible oblique frames](../artifacts/kineticad/tests/stewart-geometry.test.mjs#L67)** — PASS, 5.278 ms.
   Checks include: <code>near(world(a, mate.pivotA.localPoint), world(b, mate.pivotB.localPoint))</code>; <code>near(axis, rotate(mate.axisLocal, b.transform.rotationDeg))</code>; <code>near(axis, scale(direction, 1 / norm(direction)))</code>.
   Assertion helpers: [near](../artifacts/kineticad/tests/stewart-geometry.test.mjs#L14).

288. **[the six-axis length Jacobian stays nonsingular and equal actuator rates produce pure heave](../artifacts/kineticad/tests/stewart-geometry.test.mjs#L106)** — PASS, 5.091 ms.
   Checks include: <code>near([solution[0], solution[1], ...solution.slice(3)], [0, 0, 0, 0, 0], 1e-9)</code>; <code>assert(minimumPivot &gt; 0.25, `poorly conditioned pivot ${minimumPivot}`)</code>; <code>assert.ok(Math.abs(solution[2] - 2 * legLength / vertical) &lt; 1e-10)</code>.
   Assertion helpers: [solve](../artifacts/kineticad/tests/stewart-geometry.test.mjs#L87), [near](../artifacts/kineticad/tests/stewart-geometry.test.mjs#L14).

289. **[sampled lift retains rod overlap, radial bore clearance and conservative separation between legs](../artifacts/kineticad/tests/stewart-geometry.test.mjs#L144)** — PASS, 13.451 ms.
   Checks include: <code>assert.equal(p.boreRadiusMm - p.rodRadiusMm, 0.5)</code>; <code>assert(reference.remainingRodInsertionMm &gt;= 20 - 1e-9)</code>; <code>assert(reference.extensionMm &lt;= p.maximumStrokeMm)</code>.

290. **[the builder rejects an unsafe programme or insufficient rod overlap](../artifacts/kineticad/tests/stewart-geometry.test.mjs#L169)** — PASS, 2.917 ms.
   Checks include: <code>assert.throws(() =&gt; buildStewartPlatformDemo({ durationMs: 11000 }), /exceeds the designed stroke/)</code>; <code>assert.throws(() =&gt; buildStewartPlatformDemo({ initialRodInsertionMm: 25 }), /At least 10 mm/)</code>.

### stewart-integration.test.mjs

**3 passed · State / measured-data processing.** Checks validated saved controller configuration and measurement handling against explicit worker observations and unavailable inputs.

**Limits:** No real physical trajectory or rendered controls are exercised.

291. **[saved six-axis command survives demo parsing and invalid commands fail closed](../artifacts/kineticad/tests/stewart-integration.test.mjs#L9)** — PASS, 16.604 ms.
   Checks include: <code>assert.deepEqual(parseDemoDocument(document).state.simulation.stewartMotion, document.state.simulation.stewartMotion)</code>; <code>assert.throws(() =&gt; parseDemoDocument(document), /workspace/)</code>.

292. **[source guard permits labels and material changes but rejects altered solids, topology and visibility](../artifacts/kineticad/tests/stewart-integration.test.mjs#L16)** — PASS, 20.577 ms.
   Checks include: <code>assert.throws(() =&gt; validateStewartSourceGeometry(modified, reference), /original Stewart geometry/)</code>.

293. **[measurement state uses actual worker results, holds on zero step, and clears on reset or another experiment](../artifacts/kineticad/tests/stewart-integration.test.mjs#L33)** — PASS, 0.342 ms.
   Checks include: <code>assert.equal(usePoseMeasurements.getState().stewart, measurement)</code>; <code>assert.equal(usePoseMeasurements.getState().poses, transforms)</code>; <code>assert.equal(usePoseMeasurements.getState().stewart, measurement)</code>.

### stewart-workspace.test.mjs

**5 passed · Floating-point geometry certificate.** Checks independent conservative workspace/motion bounds, 64 corner paths, Rodrigues/quaternion interpolation, guard rejection and endpoint geometry formulas.

**Limits:** Bounded floating-point certificates, not formal interval arithmetic. Exact OCCT spot checks are a separate historical experiment; general contact and finite-force Stewart remain unsupported.

294. **[the entire ±5 mm / ±2° pose box is enclosed with no unresolved cells](../artifacts/kineticad/tests/stewart-workspace.test.mjs#L11)** — PASS, 174.476 ms.
   Checks include: <code>assert.equal(report.certified, true)</code>; <code>assert.deepEqual(report.unresolvedCells, [])</code>; <code>assert.ok(report.acceptedCells &gt; 1, &#x27;must subdivide, not relabel corner samples as an enclosure&#x27;)</code>.

295. **[insufficient subdivision and an enlarged unsafe range fail explicitly](../artifacts/kineticad/tests/stewart-workspace.test.mjs#L25)** — PASS, 3.433 ms.
   Checks include: <code>assert.equal(certifyStewartWorkspace(WORKSPACE_LIMITS, 0).certified, false)</code>; <code>assert.equal(certifyStewartWorkspace({ ...WORKSPACE_LIMITS, translationMm: 30 }, 6).certified, false)</code>.

296. **[independent Rodrigues progress matches exact quaternion axis-angle interpolation at intermediate poses](../artifacts/kineticad/tests/stewart-workspace.test.mjs#L30)** — PASS, 2.990 ms.
   Checks include: <code>near(matrixPoint(pose.rotationMatrix, p), new Vector3(...p).applyQuaternion(expected).toArray())</code>; <code>near(pose.translationMm, target.translationMm.map((v) =&gt; v * s))</code>.
   Assertion helpers: [near](../artifacts/kineticad/tests/stewart-workspace.test.mjs#L8).

297. **[all 64 extreme home-to-target paths are enclosed between progress samples](../artifacts/kineticad/tests/stewart-workspace.test.mjs#L47)** — PASS, 252.263 ms.
   Checks include: <code>assert.equal(report.certified, true, JSON.stringify({ target, failures: report.failures }))</code>; <code>assert.ok(report.maxActuatorSpeedBoundMmPerSec &lt; 8)</code>.

298. **[exact target solid placements close spherical endpoints and encode independent rod extension](../artifacts/kineticad/tests/stewart-workspace.test.mjs#L56)** — PASS, 4.208 ms.
   Checks include: <code>near(point(mate.partA, mate.pivotA.localPoint), point(mate.partB, mate.pivotB.localPoint))</code>; <code>near(displacement, result.legs[i - 1].direction.map((v) =&gt; v * result.legs[i - 1].extensionMm))</code>; <code>assert.ok(Math.abs(m.determinant() - 1) &lt; 1e-10)</code>.
   Assertion helpers: [near](../artifacts/kineticad/tests/stewart-workspace.test.mjs#L8).

## Standalone experiments — not additional automated tests

The scripts below do not match `tests/*.test.mjs` and were **not rerun by this capture**. Their linked reports are historical, retain their original timestamps and source hashes, and use scenario/sample/pair counts rather than Node test counts. A current script hash is recorded for reproducibility; it does not replace the source revision recorded by the historical report. Run CAD descriptor export before descriptor-dependent physics verifiers, then run clearance checks after their measured-pose reports. These scripts can rewrite their report files; preserve prior reports when comparing revisions.

### verify-demo-geometry.mjs

**Recorded scope:** Six fixture documents, 50 valid parts: 48 single solids and two preserved legacy compounds (windmill rotor 5 solids; orrery ring 24).

**Report:** [demo-geometry-results.json](demo-geometry-results.json) — recorded 2026-09-12T09:51:35.939Z; reported passed=true.

Rebuilds exact native CAD and writes /tmp/kineticad-demo-descriptors.json for the physics verifiers. Includes fixture-specific geometry checks. --refresh-metadata only refreshes metadata; it is not a numerical rerun.

From the repository root:

```sh
node --import ./scripts/node_modules/tsx/dist/loader.mjs scripts/src/verify-demo-geometry.mjs --export-descriptors
```

### verify-demo-physics.mjs

**Recorded scope:** Six demo worlds; report-specific motor samples and every-step anchor/drift checks.

**Report:** [demo-physics-results.json](demo-physics-results.json) — recorded 2026-09-12T09:51:58.283Z; reported passed=true.

Requires actual CAD descriptors from the preceding command. Sampled angular-rate maxima are not all-step peaks; reports record cadence.

From the repository root:

```sh
node --import ./scripts/node_modules/tsx/dist/loader.mjs artifacts/kineticad/tests/verify-demo-physics.mjs /tmp/kineticad-demo-descriptors.json
```

### verify-material-force.mjs

**Recorded scope:** Three eight-material runs, eight force-scaling comparisons and eight timestep comparisons.

**Report:** [material-force-results.json](material-force-results.json) — recorded 2026-09-12T09:52:00.395Z; reported passed=true.

The run/comparison counts are nested experiment measurements, not 19 additional automated tests. Requires CAD descriptors.

From the repository root:

```sh
node --import ./scripts/node_modules/tsx/dist/loader.mjs artifacts/kineticad/tests/verify-material-force.mjs /tmp/kineticad-demo-descriptors.json
```

### verify-material-clearance.mjs

**Recorded scope:** 72 exact OCCT pair checks across two measured endpoint poses, plus lane-envelope bounds.

**Report:** [material-clearance-results.json](material-clearance-results.json) — recorded 2026-09-12T09:52:02.679Z; reported passed=true.

Reads the fixture and material force report; endpoint intersections and travel-corridor bounds have distinct scopes.

From the repository root:

```sh
node --import ./scripts/node_modules/tsx/dist/loader.mjs artifacts/kineticad/tests/verify-material-clearance.mjs
```

### verify-stewart-physics.mjs

**Recorded scope:** One original six-second equal-extension/heave trajectory, with final poses for 14 bodies.

**Report:** [stewart-physics-results.json](stewart-physics-results.json) — recorded 2026-09-12T09:52:01.205Z; reported passed=true.

Requires actual CAD descriptors. This original motion is symmetric heave; it is separate from six-axis pose control.

From the repository root:

```sh
node --import ./scripts/node_modules/tsx/dist/loader.mjs artifacts/kineticad/tests/verify-stewart-physics.mjs /tmp/kineticad-demo-descriptors.json
```

### verify-stewart-clearance.mjs

**Recorded scope:** 182 exact OCCT pair checks: all 91 pairs at the initial pose and measured six-second final pose.

**Report:** [stewart-clearance-results.json](stewart-clearance-results.json) — recorded 2026-09-12T09:52:14.244Z; reported passed=true.

Uses the measured original-heave report. Endpoint checks alone do not prove continuous swept clearance.

From the repository root:

```sh
node --import ./scripts/node_modules/tsx/dist/loader.mjs artifacts/kineticad/tests/verify-stewart-clearance.mjs
```

### verify-stewart-controller.mjs

**Recorded scope:** 16 trajectories: 15 measured every fixed step and one partition-invariance case measured at batch endpoints.

**Report:** [stewart-controller-results.json](stewart-controller-results.json) — recorded 2026-09-12T09:32:38.279Z; reported passed=true.

Requires actual CAD descriptors. Ideal velocity-controlled joints; no finite-force load model. The report records separate tracking, closure and speed gates.

From the repository root:

```sh
node --import ./scripts/node_modules/tsx/dist/loader.mjs artifacts/kineticad/tests/verify-stewart-controller.mjs /tmp/kineticad-demo-descriptors.json
```

### verify-stewart-workspace.mjs

**Recorded scope:** One bounded workspace certificate, 72 motion certificates, 64 corner samples and 10 exact-OCCT spot poses (91 pairs per pose).

**Report:** [stewart-workspace-results.json](stewart-workspace-results.json) — recorded 2026-09-12T09:53:13.549Z; reported passed=true.

Floating-point conservative subdivision, not formal interval arithmetic; finite exact OCCT spots do not inspect every continuous pose. Reads the controller report for actual measured poses. Omitting --occt skips exact intersections.

From the repository root:

```sh
node --import ./scripts/node_modules/tsx/dist/loader.mjs artifacts/kineticad/tests/verify-stewart-workspace.mjs --occt
```

### verify-actuator-bench.mjs

**Recorded scope:** Five separate capped-force bench scenarios.

**Report:** [actuator-bench-results.json](actuator-bench-results.json) — recorded 2026-09-12T09:40:54.892Z; reported passed=true.

A simple guided axial bench with explicit force ratings; not general CAD actuator forces or finite-force Stewart.

From the repository root:

```sh
node --import ./scripts/node_modules/tsx/dist/loader.mjs artifacts/kineticad/tests/verify-actuator-bench.mjs
```

### verify-contact-bench.mjs

**Recorded scope:** Eight separate guided sliding-contact scenarios.

**Report:** [contact-bench-results.json](contact-bench-results.json) — recorded 2026-09-12T09:51:08.218Z; reported passed=true.

Exact cuboids and Coulomb friction; compare with the documented integration-error bound, not exact continuum endpoint equality.

From the repository root:

```sh
node --import ./scripts/node_modules/tsx/dist/loader.mjs artifacts/kineticad/tests/verify-contact-bench.mjs
```

### verify-browser-exports.mjs

**Recorded scope:** One previously downloaded STEP/STL pair, remeasured using actual CAD and triangle integration.

**Report:** [browser-export-results.json](browser-export-results.json) — recorded 2026-09-12T10:00:30.537Z; reported passed=true.

Default inputs are checked-in browser-edited-export.step/.stl. Optional positional STEP/STL paths select other saved files. This script reads bytes; it does not open or operate Chrome.

From the repository root:

```sh
node --import ./scripts/node_modules/tsx/dist/loader.mjs artifacts/kineticad/tests/verify-browser-exports.mjs
```

### verify-browser-boolean-export.mjs

**Recorded scope:** Three previously downloaded Boolean STEP files and one subtract STL file, plus explicit nested-result rejection.

**Report:** [browser-boolean-export-results.json](browser-boolean-export-results.json) — recorded 2026-09-12T10:18:44.900Z; reported passed=true.

Uses checked-in downloaded bytes. This is file-content analysis of historical browser outputs, not a fresh browser interaction.

From the repository root:

```sh
node --import ./scripts/node_modules/tsx/dist/loader.mjs artifacts/kineticad/tests/verify-browser-boolean-export.mjs
```

The supporting [Stewart workspace audit module](../scripts/src/stewart-workspace-audit.mjs) supplies the mathematical certificate used by tests and the workspace verifier; it is not another independently counted test run. Existing report hashes and the standalone script inventory are preserved in the JSON. None of these counts substitutes for the separately documented browser acceptance matrix.
