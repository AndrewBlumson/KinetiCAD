# Four-bar stage: complete test catalog

Captured 12 September 2026 from the source hashes in [the acceptance record](four-bar-validation.json). **348/348 tests passed across 51 files**, with no failures, cancellations or skips. Run: Node 25.4.0 / pnpm 10.28.2, serialized Node test execution. Replit Node 24 has a separate handoff check.

Every actual test result is listed below. Scenario, geometry and intersection-pair counts are separate measurements, not additional tests. The [previous detailed catalog](TEST-CATALOG.md) preserves the 298-test historical snapshot and its assertion descriptions; [four-bar equations and verification](FOUR-BAR-PATH-VERIFICATION.md) covers new mathematics, geometry, solver gates and exclusions. Raw events are [retained here](evidence/four-bar/suite-events.jsonl).

Reproduce from `artifacts/kineticad`: `node --import ../../scripts/node_modules/tsx/dist/loader.mjs --test --test-concurrency=1 tests/*.test.mjs`. Tests that regenerate historical reports should run in an isolated checkout or their original report bytes restored afterward. This capture preserved those originals and retained fresh results separately.

## actuator-bench.test.mjs

7 passing tests.

| Test | Time (ms) |
| --- | ---: |
| [capped axial force produces F/m acceleration with correct SI/mm conversion](../artifacts/kineticad/tests/actuator-bench.test.mjs#L13) | 141.680 |
| [a rated motor holds gravity and an overloaded motor saturates and falls at Fmax/m − g](../artifacts/kineticad/tests/actuator-bench.test.mjs#L23) | 74.059 |
| [free-base reaction conserves momentum and mass-weighted centre of mass](../artifacts/kineticad/tests/actuator-bench.test.mjs#L35) | 10.416 |
| [lift reaches its target without ever exceeding the actuator force rating](../artifacts/kineticad/tests/actuator-bench.test.mjs#L40) | 20.405 |
| [fixed-step partitioning is invariant and halving dt reduces overload position error](../artifacts/kineticad/tests/actuator-bench.test.mjs#L46) | 10.748 |
| [travel cutoff stops before geometry crosses the base and is distinguished from modeled impact](../artifacts/kineticad/tests/actuator-bench.test.mjs#L53) | 1.453 |
| [invalid configuration and step requests reject explicitly](../artifacts/kineticad/tests/actuator-bench.test.mjs#L57) | 1.190 |

## assembly-export.test.mjs

7 passing tests.

| Test | Time (ms) |
| --- | ---: |
| [union STEP and STL export final transformed Boolean plus visible independent part, omitting hidden sources](../artifacts/kineticad/tests/assembly-export.test.mjs#L84) | 18333.454 |
| [subtract STEP and STL export final transformed Boolean plus visible independent part, omitting hidden sources](../artifacts/kineticad/tests/assembly-export.test.mjs#L84) | 441.367 |
| [intersect STEP and STL export final transformed Boolean plus visible independent part, omitting hidden sources](../artifacts/kineticad/tests/assembly-export.test.mjs#L84) | 414.031 |
| [Hide inputs off exports visible originals as well as result, preserving deliberate overlapping solids](../artifacts/kineticad/tests/assembly-export.test.mjs#L90) | 589.722 |
| [disconnected Boolean compound exports every solid without restoring hidden originals](../artifacts/kineticad/tests/assembly-export.test.mjs#L96) | 307.210 |
| [multiple visible Boolean results share immutable source geometry safely](../artifacts/kineticad/tests/assembly-export.test.mjs#L101) | 601.190 |
| [invalid/empty output aborts; subsequent raw asset export and native feature chain remain intact](../artifacts/kineticad/tests/assembly-export.test.mjs#L108) | 300.692 |

## assembly-simulation.test.mjs

10 passing tests.

| Test | Time (ms) |
| --- | ---: |
| [Boolean source parts never become duplicate physical bodies for either Hide inputs setting](../artifacts/kineticad/tests/assembly-simulation.test.mjs#L14) | 5.940 |
| [material inheritance uses the retained subtract body and requires uniform union/intersection inputs](../artifacts/kineticad/tests/assembly-simulation.test.mjs#L23) | 2.453 |
| [unknown explicit result material fails instead of silently falling back to a default](../artifacts/kineticad/tests/assembly-simulation.test.mjs#L33) | 0.349 |
| [result grounding is explicit; consumed/hidden input ground is not inherited or silently reassigned](../artifacts/kineticad/tests/assembly-simulation.test.mjs#L39) | 3.809 |
| [an input reused by two finished Boolean bodies rejects ambiguous physical duplication](../artifacts/kineticad/tests/assembly-simulation.test.mjs#L47) | 1.717 |
| [source joints are never migrated to new finished-body IDs or silently dropped](../artifacts/kineticad/tests/assembly-simulation.test.mjs#L52) | 0.638 |
| [new result joints require an exact geometry revision and become stale after native or transform edits](../artifacts/kineticad/tests/assembly-simulation.test.mjs#L58) | 6.560 |
| [material/rename changes retain result joint geometry hashes and its stable synthetic identity](../artifacts/kineticad/tests/assembly-simulation.test.mjs#L68) | 4.574 |
| [native/Boolean identity collisions reject rather than replacing a source body](../artifacts/kineticad/tests/assembly-simulation.test.mjs#L77) | 0.928 |
| [physical signatures exclude derived values and speed commands, while protecting geometry and joint structure](../artifacts/kineticad/tests/assembly-simulation.test.mjs#L82) | 5.724 |

## beam-analysis.test.mjs

7 passing tests.

| Test | Time (ms) |
| --- | ---: |
| [independent hand-calculated steel-like reference uses N/mm/GPa consistently](../artifacts/kineticad/tests/beam-analysis.test.mjs#L6) | 2.140 |
| [curve satisfies clamped/free-end solution and intermediate hand reference](../artifacts/kineticad/tests/beam-analysis.test.mjs#L13) | 0.533 |
| [load reversal reverses displacement/reactions and retains stress magnitude](../artifacts/kineticad/tests/beam-analysis.test.mjs#L19) | 1.444 |
| [depth cubed, width, length cubed and modulus govern bending stiffness](../artifacts/kineticad/tests/beam-analysis.test.mjs#L25) | 0.299 |
| [elastic, slenderness and small-deflection failures are explicit](../artifacts/kineticad/tests/beam-analysis.test.mjs#L32) | 0.412 |
| [missing/nonfinite/nonpositive material or geometry and overflow reject](../artifacts/kineticad/tests/beam-analysis.test.mjs#L37) | 1.307 |
| [eligible native dimensions respect sketch planes and exclude modified/imported/boolean shapes](../artifacts/kineticad/tests/beam-analysis.test.mjs#L42) | 1.736 |

## bench-elapsed-clock.test.mjs

3 passing tests.

| Test | Time (ms) |
| --- | ---: |
| [a paused background tab earns no simulation time when resumed before its next animation frame](../artifacts/kineticad/tests/bench-elapsed-clock.test.mjs#L5) | 5.413 |
| [delayed first play and ordinary paused frames cannot consume a short test window](../artifacts/kineticad/tests/bench-elapsed-clock.test.mjs#L17) | 1.135 |
| [running cadence partitions retain elapsed time while repeated play calls do not reset the clock](../artifacts/kineticad/tests/bench-elapsed-clock.test.mjs#L31) | 4.167 |

## boolean-bodies.test.mjs

10 passing tests.

| Test | Time (ms) |
| --- | ---: |
| [concurrent physical preparations dispatch one exact ordered, immutable full-chain snapshot](../artifacts/kineticad/tests/boolean-bodies.test.mjs#L25) | 7.726 |
| [material/display-only changes reuse unit-density properties without changing the geometric result](../artifacts/kineticad/tests/boolean-bodies.test.mjs#L42) | 3.429 |
| [settled and pending body caches remain independent across CAD worker instances](../artifacts/kineticad/tests/boolean-bodies.test.mjs#L54) | 12.180 |
| [native edits, imported asset identity, Boolean operation and exact sub-0.0001 transforms invalidate geometry](../artifacts/kineticad/tests/boolean-bodies.test.mjs#L63) | 18.737 |
| [display cache and its valid compound mesh cannot certify a physical single-solid body](../artifacts/kineticad/tests/boolean-bodies.test.mjs#L86) | 5.925 |
| [shared failures retain each caller name and later attempts retry instead of caching an error](../artifacts/kineticad/tests/boolean-bodies.test.mjs#L96) | 2.604 |
| [explicit cache reset separates pending generations and prevents old completions overwriting fresh bodies](../artifacts/kineticad/tests/boolean-bodies.test.mjs#L104) | 2.893 |
| [invalid input configuration fails with a named error before contacting CAD](../artifacts/kineticad/tests/boolean-bodies.test.mjs#L114) | 2.666 |
| [preview regeneration shares pending operations, keeps worker-scoped settled results and retries failures](../artifacts/kineticad/tests/boolean-bodies.test.mjs#L126) | 2.150 |
| [the shared argument builder preserves source arrays and supports canonical object-key order](../artifacts/kineticad/tests/boolean-bodies.test.mjs#L136) | 2.349 |

## boolean-mate-store.test.mjs

9 passing tests.

| Test | Time (ms) |
| --- | ---: |
| [ground badges match explicit Boolean anchoring while preserving native-only first-part defaults](../artifacts/kineticad/tests/boolean-mate-store.test.mjs#L42) | 3.842 |
| [creating or importing a part preserves an explicitly free Boolean assembly](../artifacts/kineticad/tests/boolean-mate-store.test.mjs#L51) | 2.817 |
| [native creation/import retain default promotion and preserve an already selected ground](../artifacts/kineticad/tests/boolean-mate-store.test.mjs#L62) | 3.458 |
| [legacy v8/v9 migration preserves free Boolean worlds and the native-only ground default](../artifacts/kineticad/tests/boolean-mate-store.test.mjs#L77) | 3.770 |
| [actual Apply persists picked result IDs and geometry revision through Save/parse and Edit](../artifacts/kineticad/tests/boolean-mate-store.test.mjs#L93) | 23.889 |
| [geometry changed between picking and Apply rejects creation without relabelling the old attachment](../artifacts/kineticad/tests/boolean-mate-store.test.mjs#L106) | 2.471 |
| [name-only or motor-only Apply cannot revive a stale saved mate without repicking its geometry](../artifacts/kineticad/tests/boolean-mate-store.test.mjs#L114) | 3.033 |
| [an unchanged attachment permits normal edits while a missing geometry snapshot is rejected](../artifacts/kineticad/tests/boolean-mate-store.test.mjs#L127) | 1.717 |
| [deleting an input cascades through result joints while retaining unrelated native joints](../artifacts/kineticad/tests/boolean-mate-store.test.mjs#L138) | 1.541 |

## boolean-physics.test.mjs

15 passing tests.

| Test | Time (ms) |
| --- | ---: |
| [union-identity: final solid mesh, volume, COM and all tensor components agree with independent geometry](../artifacts/kineticad/tests/boolean-physics.test.mjs#L141) | 10447.306 |
| [subtract-identity: final solid mesh, volume, COM and all tensor components agree with independent geometry](../artifacts/kineticad/tests/boolean-physics.test.mjs#L141) | 141.508 |
| [intersect-identity: final solid mesh, volume, COM and all tensor components agree with independent geometry](../artifacts/kineticad/tests/boolean-physics.test.mjs#L141) | 181.135 |
| [off-centre-cut-identity: final solid mesh, volume, COM and all tensor components agree with independent geometry](../artifacts/kineticad/tests/boolean-physics.test.mjs#L141) | 125.668 |
| [union-mixed-rotation: final solid mesh, volume, COM and all tensor components agree with independent geometry](../artifacts/kineticad/tests/boolean-physics.test.mjs#L141) | 153.422 |
| [subtract-mixed-rotation: final solid mesh, volume, COM and all tensor components agree with independent geometry](../artifacts/kineticad/tests/boolean-physics.test.mjs#L141) | 109.399 |
| [intersect-mixed-rotation: final solid mesh, volume, COM and all tensor components agree with independent geometry](../artifacts/kineticad/tests/boolean-physics.test.mjs#L141) | 122.501 |
| [off-centre-cut-mixed-rotation: final solid mesh, volume, COM and all tensor components agree with independent geometry](../artifacts/kineticad/tests/boolean-physics.test.mjs#L141) | 88.945 |
| [empty and disconnected Boolean bodies reject while ordinary Boolean compounds and later valid calls remain usable](../artifacts/kineticad/tests/boolean-physics.test.mjs#L168) | 196.623 |
| [sub-four-decimal input translation changes final mesh and exact properties instead of reusing rounded geometry](../artifacts/kineticad/tests/boolean-physics.test.mjs#L182) | 206.854 |
| [a transformed imported STEP source and native cutter produce the analytic final body without changing the registered source](../artifacts/kineticad/tests/boolean-physics.test.mjs#L193) | 1710.763 |
| [actual Boolean bodies fall with mass-independent gravity using their baked world geometry once](../artifacts/kineticad/tests/boolean-physics.test.mjs#L262) | 110.203 |
| [equal COM forces measure acceleration from each final Boolean mass without adding torque](../artifacts/kineticad/tests/boolean-physics.test.mjs#L283) | 88.496 |
| [grounded Boolean stays fixed, zero-time readback pauses, and rebuilding restores original poses](../artifacts/kineticad/tests/boolean-physics.test.mjs#L314) | 8.700 |
| [passive hinged Boolean follows its anisotropic final inertia and improves with timestep refinement](../artifacts/kineticad/tests/boolean-physics.test.mjs#L345) | 43.118 |

## boolean-result-picking.test.mjs

9 passing tests.

| Test | Time (ms) |
| --- | ---: |
| [result body IDs and material inference preserve native frames without remapping inputs](../artifacts/kineticad/tests/boolean-result-picking.test.mjs#L36) | 2.974 |
| [Boolean layer exposes identity mesh/topology/current hash and changes material without geometry regeneration](../artifacts/kineticad/tests/boolean-result-picking.test.mjs#L58) | 22.757 |
| [source edits invalidate result picking immediately and older async geometry cannot replace the current revision](../artifacts/kineticad/tests/boolean-result-picking.test.mjs#L82) | 7.487 |
| [reverting an in-flight result edit restores complete cached topology; late failure and disposed results stay unavailable](../artifacts/kineticad/tests/boolean-result-picking.test.mjs#L100) | 3.779 |
| [disconnected or unverified Boolean meshes remain visible but cannot supply mate topology or attachment hashes](../artifacts/kineticad/tests/boolean-result-picking.test.mjs#L111) | 4.450 |
| [attachment hashes capture only the actual picked revision and preserve the opposite body snapshot](../artifacts/kineticad/tests/boolean-result-picking.test.mjs#L124) | 4.468 |
| [edge proximity and hover follow the full native XYZ transform instead of its old local position](../artifacts/kineticad/tests/boolean-result-picking.test.mjs#L177) | 6.642 |
| [native transformed face hover is world-correct and two-click point picking retains local face UV](../artifacts/kineticad/tests/boolean-result-picking.test.mjs#L190) | 4.091 |
| [world-baked Boolean face picks use stable body IDs once and are excluded outside mate editing](../artifacts/kineticad/tests/boolean-result-picking.test.mjs#L205) | 4.409 |

## cad-operations.test.mjs

11 passing tests.

| Test | Time (ms) |
| --- | ---: |
| [XY extrude forward/backward/symmetric preserves exact dimensions, centre and detached mesh](../artifacts/kineticad/tests/cad-operations.test.mjs#L60) | 7044.731 |
| [XZ extrude forward/backward/symmetric preserves exact dimensions, centre and detached mesh](../artifacts/kineticad/tests/cad-operations.test.mjs#L60) | 59.288 |
| [YZ extrude forward/backward/symmetric preserves exact dimensions, centre and detached mesh](../artifacts/kineticad/tests/cad-operations.test.mjs#L60) | 53.244 |
| [quarter-turn revolve keeps analytical annular-sector volume and centroid](../artifacts/kineticad/tests/cad-operations.test.mjs#L85) | 82.199 |
| [single-edge fillet removes square-minus-quarter-circle volume and leaves its input unchanged](../artifacts/kineticad/tests/cad-operations.test.mjs#L97) | 222.234 |
| [single-edge chamfer removes an exact triangular prism and leaves its input unchanged](../artifacts/kineticad/tests/cad-operations.test.mjs#L107) | 46.611 |
| [all six face pick bases drill inward for blind holes and span the correct dimension for through holes](../artifacts/kineticad/tests/cad-operations.test.mjs#L117) | 1025.847 |
| [Boolean union matches overlapping-box volume and preserves both input solids](../artifacts/kineticad/tests/cad-operations.test.mjs#L142) | 100.566 |
| [Boolean subtract matches overlapping-box volume and preserves both input solids](../artifacts/kineticad/tests/cad-operations.test.mjs#L142) | 66.427 |
| [Boolean intersect matches overlapping-box volume and preserves both input solids](../artifacts/kineticad/tests/cad-operations.test.mjs#L142) | 62.558 |
| [invalid dimensions, missing picks, non-solid inputs and empty booleans fail without consuming originals](../artifacts/kineticad/tests/cad-operations.test.mjs#L153) | 51.575 |

## contact-bench.test.mjs

9 passing tests.

| Test | Time (ms) |
| --- | ---: |
| [step zero reads the actual initial body without advancing, and disposal prevents further use](../artifacts/kineticad/tests/contact-bench.test.mjs#L14) | 69.016 |
| [resting cuboid has measured contact support equal to weight, without horizontal force](../artifacts/kineticad/tests/contact-bench.test.mjs#L27) | 56.275 |
| [frictionless contact preserves horizontal velocity and kinetic energy while supporting weight](../artifacts/kineticad/tests/contact-bench.test.mjs#L39) | 32.188 |
| [Coulomb sliding stops within the fixed-step integration bound and contact impulses match momentum](../artifacts/kineticad/tests/contact-bench.test.mjs#L49) | 23.470 |
| [halving the timestep converges in stopping distance and penetration at 60, 120 and 240 Hz](../artifacts/kineticad/tests/contact-bench.test.mjs#L71) | 40.719 |
| [material mass changes support force but not Coulomb deceleration; increasing friction shortens travel](../artifacts/kineticad/tests/contact-bench.test.mjs#L84) | 8.466 |
| [accumulated frame partitions produce the same body state as a single elapsed-time request](../artifacts/kineticad/tests/contact-bench.test.mjs#L91) | 4.490 |
| [airborne and impact phases disable the continuous-support reference](../artifacts/kineticad/tests/contact-bench.test.mjs#L104) | 5.212 |
| [invalid physical inputs and elapsed time are rejected](../artifacts/kineticad/tests/contact-bench.test.mjs#L115) | 2.694 |

## crank-slider-cad.test.mjs

2 passing tests.

| Test | Time (ms) |
| --- | ---: |
| [all domain vertices and the default produce four exact valid CAD solids with no sampled interference](../artifacts/kineticad/tests/crank-slider-cad.test.mjs#L10) | 26775.241 |
| [continuous rigid-geometry clearances hold across the admitted parameter domain](../artifacts/kineticad/tests/crank-slider-cad.test.mjs#L44) | 0.543 |

## crank-slider-kinematics.test.mjs

4 passing tests.

| Test | Time (ms) |
| --- | ---: |
| [native crank-slider factory is deterministic, closed and has exactly one drive](../artifacts/kineticad/tests/crank-slider-kinematics.test.mjs#L5) | 5.266 |
| [reference matches independent circle/link closure and numerical time derivatives throughout the admitted domain](../artifacts/kineticad/tests/crank-slider-kinematics.test.mjs#L22) | 4.384 |
| [zero/reverse RPM and nonconstant angular-speed chain rule have explicit reference semantics](../artifacts/kineticad/tests/crank-slider-kinematics.test.mjs#L36) | 0.205 |
| [invalid dimensions, near-toggle rod ratios and nonfinite controls are rejected](../artifacts/kineticad/tests/crank-slider-kinematics.test.mjs#L50) | 2.597 |

## crank-slider-physics.test.mjs

2 passing tests.

| Test | Time (ms) |
| --- | ---: |
| [actual CAD crank-slider follows independent closed-loop kinematics with forward, reverse, zero and extreme settings](../artifacts/kineticad/tests/crank-slider-physics.test.mjs#L25) | 3223.307 |
| [per-world solver settings reject invalid worlds, govern live motors and reset to legacy defaults](../artifacts/kineticad/tests/crank-slider-physics.test.mjs#L119) | 443.986 |

## crank-slider-readout.test.mjs

14 passing tests.

| Test | Time (ms) |
| --- | ---: |
| [actual positions, velocities, angle and RPM remain independent from the nominal reference](../artifacts/kineticad/tests/crank-slider-readout.test.mjs#L23) | 3.415 |
| [mean acceleration uses independent measured speed samples and their actual interval](../artifacts/kineticad/tests/crank-slider-readout.test.mjs#L37) | 0.315 |
| [reference interval acceleration is the mean velocity change, not point acceleration](../artifacts/kineticad/tests/crank-slider-readout.test.mjs#L48) | 0.802 |
| [missing actual poses or body velocity readbacks never fabricate a sample](../artifacts/kineticad/tests/crank-slider-readout.test.mjs#L58) | 1.414 |
| [nonfinite measurements, invalid clocks and degenerate quaternions are unavailable](../artifacts/kineticad/tests/crank-slider-readout.test.mjs#L73) | 0.252 |
| [duplicate, backward and invalid previous clocks cannot create interval acceleration](../artifacts/kineticad/tests/crank-slider-readout.test.mjs#L89) | 0.238 |
| [quaternion scale and sign do not change measured angle or mutate worker readbacks](../artifacts/kineticad/tests/crank-slider-readout.test.mjs#L105) | 1.859 |
| [zero/reverse nominal RPM affects only the reference, never clamps measured motion](../artifacts/kineticad/tests/crank-slider-readout.test.mjs#L116) | 0.294 |
| [a reset remains detectable even if React observes only the next nonempty run snapshot](../artifacts/kineticad/tests/crank-slider-readout.test.mjs#L128) | 1.343 |
| [pose publication preserves actual readbacks and leaves zero-step or missing-body data unmeasured](../artifacts/kineticad/tests/crank-slider-readout.test.mjs#L145) | 2.090 |
| [interval selection includes the exact 1/30 s boundary and only its declared roundoff tolerance](../artifacts/kineticad/tests/crank-slider-readout.test.mjs#L160) | 0.362 |
| [the final frame selects the latest sufficiently old actual sample, independent of array order](../artifacts/kineticad/tests/crank-slider-readout.test.mjs#L169) | 0.921 |
| [empty or restarted histories and invalid/backward clocks yield no acceleration endpoint](../artifacts/kineticad/tests/crank-slider-readout.test.mjs#L180) | 0.146 |
| [nonfinite sample values are skipped without substituting a theoretical or corrupt endpoint](../artifacts/kineticad/tests/crank-slider-readout.test.mjs#L191) | 1.838 |

## crank-slider-workspace.test.mjs

7 passing tests.

| Test | Time (ms) |
| --- | ---: |
| [generated workspace is fresh, stopped and contains only its validated experiment](../artifacts/kineticad/tests/crank-slider-workspace.test.mjs#L17) | 8.208 |
| [demo parser and actual Save/project parser retain adjustable parameters and native history](../artifacts/kineticad/tests/crank-slider-workspace.test.mjs#L37) | 19.076 |
| [physical assembly guard tolerates cosmetic names, computed fields and object-key order](../artifacts/kineticad/tests/crank-slider-workspace.test.mjs#L55) | 4.376 |
| [manual geometry, frame, material, visibility and joint edits disable parameter replacement](../artifacts/kineticad/tests/crank-slider-workspace.test.mjs#L71) | 15.966 |
| [reference guard rejects changed gravity, timing and stale experiment controllers](../artifacts/kineticad/tests/crank-slider-workspace.test.mjs#L95) | 2.839 |
| [invalid adjustable metadata rejects before a document can replace the workspace](../artifacts/kineticad/tests/crank-slider-workspace.test.mjs#L108) | 5.953 |
| [parameter changes and Save remain isolated, then restore original live imported references](../artifacts/kineticad/tests/crank-slider-workspace.test.mjs#L119) | 11.086 |

## demos.test.mjs

6 passing tests.

| Test | Time (ms) |
| --- | ---: |
| [all bundled examples load and reference existing parts](../artifacts/kineticad/tests/demos.test.mjs#L12) | 22.569 |
| [asset paths work at the Replit /app base and a local root](../artifacts/kineticad/tests/demos.test.mjs#L16) | 0.480 |
| [force experiment survives document parsing and rejects invalid target references](../artifacts/kineticad/tests/demos.test.mjs#L22) | 3.922 |
| [invalid and unsupported documents fail before entering a workspace](../artifacts/kineticad/tests/demos.test.mjs#L29) | 4.165 |
| [editing and playing multiple demos never overwrite the original project](../artifacts/kineticad/tests/demos.test.mjs#L65) | 6.956 |
| [a second visit captures the newly edited original and begins stopped](../artifacts/kineticad/tests/demos.test.mjs#L84) | 1.116 |

## desktop-support.test.mjs

9 passing tests.

| Test | Time (ms) |
| --- | ---: |
| [known phone UAs are blocked independently of their pointer reports](../artifacts/kineticad/tests/desktop-support.test.mjs#L10) | 2.624 |
| [tablet UAs without the word Mobile remain blocked](../artifacts/kineticad/tests/desktop-support.test.mjs#L22) | 0.286 |
| [desktop-mode iPadOS is blocked via Macintosh or MacIntel identity plus touch](../artifacts/kineticad/tests/desktop-support.test.mjs#L34) | 0.276 |
| [attaching a mouse does not allow a known phone or tablet to enter CAD](../artifacts/kineticad/tests/desktop-support.test.mjs#L41) | 0.107 |
| [coarse-only touch devices are blocked even with a desktop-like or unknown UA](../artifacts/kineticad/tests/desktop-support.test.mjs#L47) | 0.117 |
| [touch-capable Windows laptops with a fine pointer remain supported](../artifacts/kineticad/tests/desktop-support.test.mjs#L52) | 0.181 |
| [ordinary macOS, Windows and Linux desktop pointers remain supported](../artifacts/kineticad/tests/desktop-support.test.mjs#L58) | 0.370 |
| [narrow desktop windows and browser zoom are not mobile-device signals](../artifacts/kineticad/tests/desktop-support.test.mjs#L64) | 0.115 |
| [detection is pure and optional platform/touch values do not reject a desktop](../artifacts/kineticad/tests/desktop-support.test.mjs#L70) | 1.458 |

## engineering-bench-worker.test.mjs

3 passing tests.

| Test | Time (ms) |
| --- | ---: |
| [real Comlink worker serializes initial asynchronous build before zero-time and advancing calls](../artifacts/kineticad/tests/engineering-bench-worker.test.mjs#L23) | 464.221 |
| [queued actuator step, contact rebuild and contact step remain FIFO and reset the physical world](../artifacts/kineticad/tests/engineering-bench-worker.test.mjs#L32) | 43.981 |
| [invalid build rejects and clears the previous world without poisoning subsequent queued rebuilds](../artifacts/kineticad/tests/engineering-bench-worker.test.mjs#L44) | 14.518 |

## feature-regen.test.mjs

13 passing tests.

| Test | Time (ms) |
| --- | ---: |
| [concurrent scene regenerations dispatch one operation per matching cold feature](../artifacts/kineticad/tests/feature-regen.test.mjs#L34) | 4.564 |
| [pending operations on different kernel instances remain independent](../artifacts/kineticad/tests/feature-regen.test.mjs#L50) | 1.360 |
| [changed feature parameters do not join an older in-flight operation](../artifacts/kineticad/tests/feature-regen.test.mjs#L66) | 1.082 |
| [shared failures reach every caller and a later request retries the worker](../artifacts/kineticad/tests/feature-regen.test.mjs#L80) | 2.564 |
| [clearing the cache separates pending work and rejects late cache repopulation](../artifacts/kineticad/tests/feature-regen.test.mjs#L101) | 2.433 |
| [concurrent chains share each stage and preview uses the same full upstream hash](../artifacts/kineticad/tests/feature-regen.test.mjs#L125) | 28.500 |
| [display regeneration sends one complete chain and caches its exact final-feature hash](../artifacts/kineticad/tests/feature-regen.test.mjs#L145) | 3.000 |
| [display cache invalidates when an upstream feature or source sketch changes](../artifacts/kineticad/tests/feature-regen.test.mjs#L165) | 0.948 |
| [full-chain rejection reaches all display callers and retries without a poisoned cache](../artifacts/kineticad/tests/feature-regen.test.mjs#L179) | 0.369 |
| [unit-density mass data warms the cache and material/pose changes need no CAD rebuild](../artifacts/kineticad/tests/feature-regen.test.mjs#L197) | 1.123 |
| [unmodified STEP uses its live mesh; modified STEP dispatches its intact full history](../artifacts/kineticad/tests/feature-regen.test.mjs#L222) | 0.388 |
| [a late full-chain result cannot repopulate mesh or physical caches after clear](../artifacts/kineticad/tests/feature-regen.test.mjs#L241) | 0.086 |
| [a final-feature preview cannot hide an invalid earlier history from display regeneration](../artifacts/kineticad/tests/feature-regen.test.mjs#L256) | 0.191 |

## force-measurements.test.mjs

3 passing tests.

| Test | Time (ms) |
| --- | ---: |
| [display measures acceleration from solver readback even when it disagrees with F/m](../artifacts/kineticad/tests/force-measurements.test.mjs#L13) | 1.622 |
| [measurement uses consecutive actual simulation timestamps and holds at completion](../artifacts/kineticad/tests/force-measurements.test.mjs#L20) | 0.405 |
| [new runs clear prior readings and missing measurements cannot look successful](../artifacts/kineticad/tests/force-measurements.test.mjs#L29) | 0.569 |

## force-physics.test.mjs

6 passing tests.

| Test | Time (ms) |
| --- | ---: |
| [equal newton forces yield measured inverse-mass acceleration on unpowered prismatic sliders](../artifacts/kineticad/tests/force-physics.test.mjs#L33) | 527.528 |
| [doubling force and mass preserves measured acceleration and motion](../artifacts/kineticad/tests/force-physics.test.mjs#L75) | 17.633 |
| [world-space COM force adds to gravity without creating torque on an offset, rotated body](../artifacts/kineticad/tests/force-physics.test.mjs#L88) | 16.184 |
| [duration cap and force motion are invariant to elapsed-time partitions, including capped catch-up](../artifacts/kineticad/tests/force-physics.test.mjs#L103) | 88.649 |
| [zero requests pause a forced run and rebuilding removes its cap and persistent forces](../artifacts/kineticad/tests/force-physics.test.mjs#L125) | 4.840 |
| [invalid force vectors, duplicate/fixed/missing targets and invalid caps reject the whole world](../artifacts/kineticad/tests/force-physics.test.mjs#L145) | 14.173 |

## four-bar-assembly.test.mjs

4 passing tests.

| Test | Time (ms) |
| --- | ---: |
| [native four-bar factory creates four connected-history bodies and only one driven revolute](../artifacts/kineticad/tests/four-bar-assembly.test.mjs#L8) | 3.786 |
| [every local joint anchor agrees with independent closure in both branches and arbitrary placement](../artifacts/kineticad/tests/four-bar-assembly.test.mjs#L21) | 5.451 |
| [authored plate/pin envelopes match the continuous rigid-geometry clearance proof](../artifacts/kineticad/tests/four-bar-assembly.test.mjs#L35) | 1.030 |
| [near-zero tracing arms are omitted inside the existing solid; invalid geometry cannot be generated](../artifacts/kineticad/tests/four-bar-assembly.test.mjs#L56) | 0.921 |

## four-bar-cad.test.mjs

1 passing tests.

| Test | Time (ms) |
| --- | ---: |
| [seven native four-bar geometries are valid single solids with supported tracing points and zero sampled interference](../artifacts/kineticad/tests/four-bar-cad.test.mjs#L11) | 37743.046 |

## four-bar-kinematics.test.mjs

5 passing tests.

| Test | Time (ms) |
| --- | ---: |
| [four-bar circle intersection has an independent exact coordinate fixture and both branches](../artifacts/kineticad/tests/four-bar-kinematics.test.mjs#L9) | 9.065 |
| [complete rotations preserve all link lengths, branch sign and continuous clearance bounds](../artifacts/kineticad/tests/four-bar-kinematics.test.mjs#L19) | 44.878 |
| [implicit velocity and acceleration agree with independent finite differences and chain rule](../artifacts/kineticad/tests/four-bar-kinematics.test.mjs#L33) | 5.264 |
| [placement transforms once and a complete cycle returns the same geometry](../artifacts/kineticad/tests/four-bar-kinematics.test.mjs#L47) | 1.652 |
| [Grashof equality, lost closure, small transmission angle, markers and invalid fields reject](../artifacts/kineticad/tests/four-bar-kinematics.test.mjs#L55) | 1.571 |

## four-bar-physics.test.mjs

1 passing tests.

| Test | Time (ms) |
| --- | ---: |
| [actual CAD four-bar follows independent coupler geometry through complete forward/reverse cycles and both branches](../artifacts/kineticad/tests/four-bar-physics.test.mjs#L18) | 10230.438 |

## four-bar-preflight.test.mjs

4 passing tests.

| Test | Time (ms) |
| --- | ---: |
| [four-bar project retains its drawing and rejects corrupt metadata before loading](../artifacts/kineticad/tests/four-bar-preflight.test.mjs#L13) | 36.056 |
| [four-bar preflight checks every full feature chain without mutating the document](../artifacts/kineticad/tests/four-bar-preflight.test.mjs#L20) | 13.901 |
| [four-bar preflight rejects failed geometry, invalid mesh and missing or invalid mass properties](../artifacts/kineticad/tests/four-bar-preflight.test.mjs#L27) | 46.131 |
| [four-bar stale model detection after a delayed CAD response prevents the next part building](../artifacts/kineticad/tests/four-bar-preflight.test.mjs#L33) | 5.718 |

## four-bar-readout.test.mjs

5 passing tests.

| Test | Time (ms) |
| --- | ---: |
| [four-bar readout transforms the actual material point under both branches, placement and motor directions](../artifacts/kineticad/tests/four-bar-readout.test.mjs#L8) | 8.127 |
| [perturbed solver coordinates remain visible and cannot be replaced by predicted positions](../artifacts/kineticad/tests/four-bar-readout.test.mjs#L18) | 1.832 |
| [measured-angle reference and nominal motor schedule disclose phase lag separately](../artifacts/kineticad/tests/four-bar-readout.test.mjs#L28) | 0.815 |
| [missing, duplicate, nonfinite or invalid poses yield no invented path sample](../artifacts/kineticad/tests/four-bar-readout.test.mjs#L34) | 0.799 |
| [normalizing valid quaternion scale/sign preserves measured points without mutating snapshots](../artifacts/kineticad/tests/four-bar-readout.test.mjs#L44) | 1.322 |

## four-bar-search-worker.test.mjs

2 passing tests.

| Test | Time (ms) |
| --- | ---: |
| [production search worker delivers provisional progress and a separately recomputable ellipse fit](../artifacts/kineticad/tests/four-bar-search-worker.test.mjs#L16) | 7923.256 |
| [terminating a running search cancels it before a result; a fresh worker rejects invalid input clearly](../artifacts/kineticad/tests/four-bar-search-worker.test.mjs#L36) | 660.847 |

## four-bar-synthesis.test.mjs

6 passing tests.

| Test | Time (ms) |
| --- | ---: |
| [closed target validation rejects crossings, open paths, retracing, tiny/huge and nonfinite data](../artifacts/kineticad/tests/four-bar-synthesis.test.mjs#L6) | 3.401 |
| [arc-length resampling is independent of drawing speed and duplicated collinear vertices](../artifacts/kineticad/tests/four-bar-synthesis.test.mjs#L16) | 0.827 |
| [known mechanism paths have a declared source, while an ellipse remains an approximation](../artifacts/kineticad/tests/four-bar-synthesis.test.mjs#L22) | 884.862 |
| [complete-cycle score allows cyclic start/reversal but cannot match a displaced or partial target for free](../artifacts/kineticad/tests/four-bar-synthesis.test.mjs#L32) | 578.574 |
| [seeded search is deterministic, reports real monotone progress and supports cancellation](../artifacts/kineticad/tests/four-bar-synthesis.test.mjs#L42) | 674.320 |
| [default search fits a nonpreset independently supplied mechanism path without receiving its parameters](../artifacts/kineticad/tests/four-bar-synthesis.test.mjs#L53) | 7848.806 |

## four-bar-worker-cad.test.mjs

1 passing tests.

| Test | Time (ms) |
| --- | ---: |
| [shipped CAD worker preflight returns one solid per factory body and exact independently integrated bed/link volumes](../artifacts/kineticad/tests/four-bar-worker-cad.test.mjs#L25) | 12727.258 |

## four-bar-workspace.test.mjs

9 passing tests.

| Test | Time (ms) |
| --- | ---: |
| [four-bar document is fresh, stopped, isolated from the input and limited to the validated cycle profile](../artifacts/kineticad/tests/four-bar-workspace.test.mjs#L16) | 7.580 |
| [native Save/project and demo parsers retain four-bar target, seed, branch, placement and complete feature histories](../artifacts/kineticad/tests/four-bar-workspace.test.mjs#L24) | 20.619 |
| [cosmetic names and derived caches do not disable a physically unchanged saved four-bar](../artifacts/kineticad/tests/four-bar-workspace.test.mjs#L33) | 4.561 |
| [manual geometry, transforms, materials, visibility, ground or joint changes disable generated reference claims](../artifacts/kineticad/tests/four-bar-workspace.test.mjs#L39) | 12.996 |
| [reference profile rejects altered gravity, fixed step, duration, manual-edit marker and other experiment controllers](../artifacts/kineticad/tests/four-bar-workspace.test.mjs#L44) | 2.356 |
| [invalid loaded design metadata rejects before replacing a workspace](../artifacts/kineticad/tests/four-bar-workspace.test.mjs#L50) | 10.029 |
| [multiple generated builds and native Save preserve original persistence and live STEP references until return](../artifacts/kineticad/tests/four-bar-workspace.test.mjs#L56) | 4.767 |
| [actual Chrome native Save is canonical despite platform transcendental rounding](../artifacts/kineticad/tests/four-bar-workspace.test.mjs#L67) | 1.727 |
| [roundoff matching preserves exact structure and rejects tiny meaningful edits and nonfinite values](../artifacts/kineticad/tests/four-bar-workspace.test.mjs#L76) | 5.143 |

## hole-picker.test.mjs

5 passing tests.

| Test | Time (ms) |
| --- | ---: |
| [two real canvas clicks set Hole UV on the top face of an untransformed solid](../artifacts/kineticad/tests/hole-picker.test.mjs#L66) | 8.354 |
| [two real canvas clicks set Hole UV on the bottom face of an untransformed solid](../artifacts/kineticad/tests/hole-picker.test.mjs#L66) | 2.712 |
| [two real canvas clicks set Hole UV on the top face of an translated with mixed XYZ rotation solid](../artifacts/kineticad/tests/hole-picker.test.mjs#L66) | 3.271 |
| [two real canvas clicks set Hole UV on the bottom face of an translated with mixed XYZ rotation solid](../artifacts/kineticad/tests/hole-picker.test.mjs#L66) | 2.149 |
| [Clear face and a changed face both restart the Hole picker without stale UV](../artifacts/kineticad/tests/hole-picker.test.mjs#L79) | 4.929 |

## mass-properties.test.mjs

8 passing tests.

| Test | Time (ms) |
| --- | ---: |
| [OCCT cuboid volume, mass, centroid and all three anisotropic moments match analytic values](../artifacts/kineticad/tests/mass-properties.test.mjs#L59) | 7255.445 |
| [translated and generally rotated cuboid retains centroidal tensor, including off-diagonal terms](../artifacts/kineticad/tests/mass-properties.test.mjs#L68) | 15.284 |
| [solid cylinder moments match axial and transverse analytic inertia](../artifacts/kineticad/tests/mass-properties.test.mjs#L77) | 33.858 |
| [bored ring retains removed-volume effects in its axial and transverse inertia](../artifacts/kineticad/tests/mass-properties.test.mjs#L88) | 572.689 |
| [warm cache and a material change preserve the full tensor and principal frame](../artifacts/kineticad/tests/mass-properties.test.mjs#L102) | 16.759 |
| [Rapier torque impulse follows the full rotated inertia inverse, not part-local diagonal axes](../artifacts/kineticad/tests/mass-properties.test.mjs#L115) | 26.209 |
| [eigensolver handles tiny and large units and rejects non-physical tensors](../artifacts/kineticad/tests/mass-properties.test.mjs#L136) | 0.907 |
| [empty geometry and invalid density fail instead of creating fictitious physical bodies](../artifacts/kineticad/tests/mass-properties.test.mjs#L148) | 2.331 |

## overlay-frames.test.mjs

5 passing tests.

| Test | Time (ms) |
| --- | ---: |
| [finished sketches follow arbitrary part transforms, including changes without geometry edits](../artifacts/kineticad/tests/overlay-frames.test.mjs#L32) | 6.236 |
| [consumed sketches show only when selected, unused profiles show, and hidden parts stay hidden](../artifacts/kineticad/tests/overlay-frames.test.mjs#L47) | 3.537 |
| [gyroscope profiles retain the assembly elevation instead of being drawn at the ground origin](../artifacts/kineticad/tests/overlay-frames.test.mjs#L69) | 14.889 |
| [joint glyph anchors and axes track moving body poses rather than static design transforms](../artifacts/kineticad/tests/overlay-frames.test.mjs#L84) | 5.953 |
| [selection enlargement does not displace prismatic or planar anchors](../artifacts/kineticad/tests/overlay-frames.test.mjs#L119) | 1.791 |

## part-transform-occt.test.mjs

2 passing tests.

| Test | Time (ms) |
| --- | ---: |
| [a translated, generally rotated B-rep keeps its analytic volume and Three-world centroid](../artifacts/kineticad/tests/part-transform-occt.test.mjs#L12) | 7251.275 |
| [the same world transform preserves boolean overlap between two independently transformed bodies](../artifacts/kineticad/tests/part-transform-occt.test.mjs#L30) | 637.267 |

## part-transform.test.mjs

3 passing tests.

| Test | Time (ms) |
| --- | ---: |
| [arbitrary mixed XYZ rotations and translations match the actual Three quaternion convention](../artifacts/kineticad/tests/part-transform.test.mjs#L14) | 3.716 |
| [invalid transforms fail before constructing OCCT values](../artifacts/kineticad/tests/part-transform.test.mjs#L26) | 0.513 |
| [OCCT transform wrappers are released on constructor or shape-operation failures](../artifacts/kineticad/tests/part-transform.test.mjs#L32) | 0.286 |

## path-drawing.test.mjs

7 passing tests.

| Test | Time (ms) |
| --- | ---: |
| [actual drawing handlers convert translated and letterboxed screen coordinates to millimetres with Y up](../artifacts/kineticad/tests/path-drawing.test.mjs#L96) | 11.627 |
| [a complete pointer stroke forms a valid closed ellipse through the shipped target validator](../artifacts/kineticad/tests/path-drawing.test.mjs#L106) | 9.882 |
| [an open stroke stays open at the drawing boundary and is rejected until explicitly closed](../artifacts/kineticad/tests/path-drawing.test.mjs#L119) | 3.465 |
| [disabled, secondary-button and outside-grid starts cannot replace a path](../artifacts/kineticad/tests/path-drawing.test.mjs#L128) | 2.008 |
| [pointer cancellation and another pointer leave the previous target untouched](../artifacts/kineticad/tests/path-drawing.test.mjs#L140) | 1.305 |
| [a changing preview cannot shift the coordinate frame during a pointer stroke](../artifacts/kineticad/tests/path-drawing.test.mjs#L149) | 2.172 |
| [an overlong stroke reports the vertex limit without committing a silently truncated loop](../artifacts/kineticad/tests/path-drawing.test.mjs#L160) | 26.285 |

## path-trace-label.test.mjs

4 passing tests.

| Test | Time (ms) |
| --- | ---: |
| [trace label uses the actual coupler and ancestor matrices instead of a predicted or saved pose](../artifacts/kineticad/tests/path-trace-label.test.mjs#L42) | 19.888 |
| [trace projection refreshes a camera moved since the previous rendered frame](../artifacts/kineticad/tests/path-trace-label.test.mjs#L69) | 7.338 |
| [trace annotation hides on missing meshes, clipped depth and invalidated geometry or experiment configuration](../artifacts/kineticad/tests/path-trace-label.test.mjs#L76) | 16.791 |
| [trace annotation holds a paused material point and releases its own DOM node on disposal](../artifacts/kineticad/tests/path-trace-label.test.mjs#L91) | 7.919 |

## physics-worker.test.mjs

17 passing tests.

| Test | Time (ms) |
| --- | ---: |
| [windmill seed mate retains pi ±5e-7 rad/s after five seconds with an analytical rotor](../artifacts/kineticad/tests/physics-worker.test.mjs#L82) | 700.665 |
| [free fall uses millimetres, seconds, kilograms and is independent of mass](../artifacts/kineticad/tests/physics-worker.test.mjs#L107) | 34.904 |
| [zero and blank live revolute commands release the motor so a rotor coasts](../artifacts/kineticad/tests/physics-worker.test.mjs#L116) | 128.946 |
| [zero and blank live prismatic commands release the slider to gravity](../artifacts/kineticad/tests/physics-worker.test.mjs#L135) | 69.072 |
| [unpowered pendulum follows the analytical physical-pendulum period](../artifacts/kineticad/tests/physics-worker.test.mjs#L156) | 61.059 |
| [revolute motor follows part A local axis when both bodies share a rotated frame](../artifacts/kineticad/tests/physics-worker.test.mjs#L180) | 23.061 |
| [prismatic motor follows rotated local axis and preserves lateral position](../artifacts/kineticad/tests/physics-worker.test.mjs#L187) | 31.914 |
| [fixed mate preserves an initially translated and rotated child](../artifacts/kineticad/tests/physics-worker.test.mjs#L197) | 20.993 |
| [unsupported mismatched joint frames stop the whole world instead of snapping parts](../artifacts/kineticad/tests/physics-worker.test.mjs#L225) | 8.496 |
| [revolute allows initial twist about its shared axis; prismatic rejects that twist](../artifacts/kineticad/tests/physics-worker.test.mjs#L235) | 27.517 |
| [unsupported planar constraints stop simulation rather than being omitted](../artifacts/kineticad/tests/physics-worker.test.mjs#L247) | 0.574 |
| [a mate referencing a hidden or missing body rejects the whole incomplete assembly](../artifacts/kineticad/tests/physics-worker.test.mjs#L254) | 0.663 |
| [new gimbal seed drives each relative joint speed, not each child world-speed magnitude](../artifacts/kineticad/tests/physics-worker.test.mjs#L266) | 96.279 |
| [fixed solver stepping gives identical motion at 30 Hz, 144 Hz and irregular render rates](../artifacts/kineticad/tests/physics-worker.test.mjs#L305) | 37.814 |
| [fractional requests accumulate; zero pauses and undefined advances one configured step](../artifacts/kineticad/tests/physics-worker.test.mjs#L323) | 5.282 |
| [bounded catch-up retains time instead of dropping it and zero never drains backlog](../artifacts/kineticad/tests/physics-worker.test.mjs#L342) | 4.674 |
| [playback time scaling advances only the actual zero, one or two seconds requested](../artifacts/kineticad/tests/physics-worker.test.mjs#L354) | 16.927 |

## project-cad-roundtrip.test.mjs

2 passing tests.

| Test | Time (ms) |
| --- | ---: |
| [actual worker restores embedded STEP after worker restart, retaining native history, transforms, topology and exportable geometry](../artifacts/kineticad/tests/project-cad-roundtrip.test.mjs#L29) | 22644.275 |
| [a legacy live import is packaged in local coordinates and missing old worker geometry fails clearly](../artifacts/kineticad/tests/project-cad-roundtrip.test.mjs#L86) | 11145.369 |

## project-persistence.test.mjs

13 passing tests.

| Test | Time (ms) |
| --- | ---: |
| [complete project downloads and both recovery generations retain Boolean material, result ground and joint revisions](../artifacts/kineticad/tests/project-persistence.test.mjs#L38) | 34.221 |
| [Boolean project parsing rejects invalid materials/body references and retains stale revisions for explicit repicking](../artifacts/kineticad/tests/project-persistence.test.mjs#L55) | 7.550 |
| [native history, transforms, materials and mates survive with runtime stopped](../artifacts/kineticad/tests/project-persistence.test.mjs#L67) | 1.365 |
| [Save accepts the live Zustand object without cloning actions or editor state](../artifacts/kineticad/tests/project-persistence.test.mjs#L75) | 2.020 |
| [malformed references, dimensions, transforms and unknown features reject](../artifacts/kineticad/tests/project-persistence.test.mjs#L82) | 3.831 |
| [six-axis configuration persists and invalid target rejects](../artifacts/kineticad/tests/project-persistence.test.mjs#L93) | 4.240 |
| [corrupt embedded bytes reject before asset reconstruction or storage changes](../artifacts/kineticad/tests/project-persistence.test.mjs#L101) | 6.807 |
| [invalid downloaded project does not replace the current or previous snapshots](../artifacts/kineticad/tests/project-persistence.test.mjs#L111) | 75.573 |
| [autosave keeps two complete generations and quota failure retains both](../artifacts/kineticad/tests/project-persistence.test.mjs#L122) | 3.435 |
| [corrupt newest recovery falls back to validated previous without overwriting either](../artifacts/kineticad/tests/project-persistence.test.mjs#L137) | 3.414 |
| [newest state is captured before async work and load follows queued autosave](../artifacts/kineticad/tests/project-persistence.test.mjs#L146) | 2.915 |
| [real Zustand demo isolation preserves durable project and last-good copy](../artifacts/kineticad/tests/project-persistence.test.mjs#L155) | 1.646 |
| [version 8 migration runs before validation; old missing STEP files reject clearly](../artifacts/kineticad/tests/project-persistence.test.mjs#L172) | 1.189 |

## simulation-runner.test.mjs

19 passing tests.

| Test | Time (ms) |
| --- | ---: |
| [runner simulates the final Boolean body once with world-frame mesh/mass and suppresses every consumed source](../artifacts/kineticad/tests/simulation-runner.test.mjs#L134) | 194.373 |
| [a disconnected final-solid rejection creates no world and leaves the modelling layers visible](../artifacts/kineticad/tests/simulation-runner.test.mjs#L153) | 19.522 |
| [native source edits during pending Boolean CAD preparation reject the stale result before physics dispatch](../artifacts/kineticad/tests/simulation-runner.test.mjs#L161) | 8.736 |
| [Boolean result motor-only edits during CAD preparation use the latest command and preserve valid geometry](../artifacts/kineticad/tests/simulation-runner.test.mjs#L171) | 9.512 |
| [geometry changed during an in-flight world build cannot publish stale Boolean bodies or start its clock](../artifacts/kineticad/tests/simulation-runner.test.mjs#L183) | 6.484 |
| [a geometry edit after Play stops the run and rejects an already-pending pose response](../artifacts/kineticad/tests/simulation-runner.test.mjs#L194) | 5.471 |
| [invalid Boolean material cannot silently simulate original uncut inputs](../artifacts/kineticad/tests/simulation-runner.test.mjs#L201) | 15.358 |
| [runner permits one in-flight step, retains elapsed time, and counts actual worker time](../artifacts/kineticad/tests/simulation-runner.test.mjs#L213) | 8.412 |
| [finite experiments hold the final solver pose and clock instead of resetting the model](../artifacts/kineticad/tests/simulation-runner.test.mjs#L230) | 5.363 |
| [late RPC response cannot move the paused pose or clock; resume preserves its actual time](../artifacts/kineticad/tests/simulation-runner.test.mjs#L243) | 4.254 |
| [stopped or replaced assembly ignores a late step response](../artifacts/kineticad/tests/simulation-runner.test.mjs#L262) | 3.373 |
| [old build reply and teardown cannot destroy the replacement scene world](../artifacts/kineticad/tests/simulation-runner.test.mjs#L274) | 4.014 |
| [invalid cached mass stops the current run and restores modelling layers](../artifacts/kineticad/tests/simulation-runner.test.mjs#L297) | 7.036 |
| [rejected build RPC is caught and does not poison the next successful build](../artifacts/kineticad/tests/simulation-runner.test.mjs#L309) | 6.919 |
| [motor edits during pending CAD work reach the world that is eventually built](../artifacts/kineticad/tests/simulation-runner.test.mjs#L326) | 3.207 |
| [motor edits during an in-flight build replay before the first solver step](../artifacts/kineticad/tests/simulation-runner.test.mjs#L350) | 3.406 |
| [six-axis build validates source solids and uses its own full movement duration](../artifacts/kineticad/tests/simulation-runner.test.mjs#L370) | 3.119 |
| [six-axis source rejection never creates a physics world](../artifacts/kineticad/tests/simulation-runner.test.mjs#L381) | 4.484 |
| [canonical path linkage dispatches its measured solver profile and six-second real-body run](../artifacts/kineticad/tests/simulation-runner.test.mjs#L390) | 15.097 |

## sketch-arcs.test.mjs

7 passing tests.

| Test | Time (ms) |
| --- | ---: |
| [XY arc endpoints and intermediate samples agree with sketch UV; sector extrudes with analytic volume and centroid](../artifacts/kineticad/tests/sketch-arcs.test.mjs#L19) | 7496.525 |
| [XY semicircle revolves to an exact sphere about the sketch V axis](../artifacts/kineticad/tests/sketch-arcs.test.mjs#L60) | 53.433 |
| [XZ arc endpoints and intermediate samples agree with sketch UV; sector extrudes with analytic volume and centroid](../artifacts/kineticad/tests/sketch-arcs.test.mjs#L19) | 25.823 |
| [XZ semicircle revolves to an exact sphere about the sketch V axis](../artifacts/kineticad/tests/sketch-arcs.test.mjs#L60) | 13.005 |
| [YZ arc endpoints and intermediate samples agree with sketch UV; sector extrudes with analytic volume and centroid](../artifacts/kineticad/tests/sketch-arcs.test.mjs#L19) | 21.935 |
| [YZ semicircle revolves to an exact sphere about the sketch V axis](../artifacts/kineticad/tests/sketch-arcs.test.mjs#L60) | 10.737 |
| [both Stewart turning profiles retain exact circular ends and rebuild as single valid solids](../artifacts/kineticad/tests/sketch-arcs.test.mjs#L79) | 52.093 |

## sketch-dimensions-cad.test.mjs

10 passing tests.

| Test | Time (ms) |
| --- | ---: |
| [editing circle diameter20→30 mm rebuilds an exact cylinder with the expected volume, bounds and mass](../artifacts/kineticad/tests/sketch-dimensions-cad.test.mjs#L64) | 7532.564 |
| [XY rectangle width and height edits change exact solid dimensions in the sketch's U/V axes](../artifacts/kineticad/tests/sketch-dimensions-cad.test.mjs#L81) | 85.289 |
| [XZ rectangle width and height edits change exact solid dimensions in the sketch's U/V axes](../artifacts/kineticad/tests/sketch-dimensions-cad.test.mjs#L81) | 59.926 |
| [YZ rectangle width and height edits change exact solid dimensions in the sketch's U/V axes](../artifacts/kineticad/tests/sketch-dimensions-cad.test.mjs#L81) | 64.788 |
| [line length/angle/start edits create a closed rotated rectangular profile with analytical area](../artifacts/kineticad/tests/sketch-dimensions-cad.test.mjs#L107) | 22.331 |
| [XY edited arc radius/start/sweep and its two lines rebuild the exact closed sector](../artifacts/kineticad/tests/sketch-dimensions-cad.test.mjs#L128) | 31.695 |
| [XZ edited arc radius/start/sweep and its two lines rebuild the exact closed sector](../artifacts/kineticad/tests/sketch-dimensions-cad.test.mjs#L128) | 19.183 |
| [YZ edited arc radius/start/sweep and its two lines rebuild the exact closed sector](../artifacts/kineticad/tests/sketch-dimensions-cad.test.mjs#L128) | 18.012 |
| [an arc-only edit does not silently move adjacent lines or disguise an open profile as a solid](../artifacts/kineticad/tests/sketch-dimensions-cad.test.mjs#L141) | 21.399 |
| [complete Save/parse preserves edited primitives and rebuilds identical actual CAD geometry](../artifacts/kineticad/tests/sketch-dimensions-cad.test.mjs#L154) | 135.649 |

## sketch-dimensions.test.mjs

9 passing tests.

| Test | Time (ms) |
| --- | ---: |
| [fields expose persistent UV geometry with diameter and degree conventions](../artifacts/kineticad/tests/sketch-dimensions.test.mjs#L15) | 2.679 |
| [exact no-op edits retain primitive identity and all original floating-point coordinates](../artifacts/kineticad/tests/sketch-dimensions.test.mjs#L29) | 2.620 |
| [circle diameter and rectangle width/height edits preserve anchors and neighbours](../artifacts/kineticad/tests/sketch-dimensions.test.mjs#L39) | 0.342 |
| [line edits satisfy independent right-triangle, quadrant and winding references](../artifacts/kineticad/tests/sketch-dimensions.test.mjs#L51) | 1.578 |
| [arc edits preserve centre and produce the stated circular endpoints and CCW sweep across zero](../artifacts/kineticad/tests/sketch-dimensions.test.mjs#L66) | 0.671 |
| [complete values reject unknown, missing, nonfinite, nonnumeric and out-of-domain edits without mutation](../artifacts/kineticad/tests/sketch-dimensions.test.mjs#L80) | 2.045 |
| [inclusive bounds accept valid stored coordinates and primitives remain editable after serialization](../artifacts/kineticad/tests/sketch-dimensions.test.mjs#L100) | 2.804 |
| [minimum lengths and arc sweeps survive cancellation at the maximum coordinate and angle scales](../artifacts/kineticad/tests/sketch-dimensions.test.mjs#L115) | 3.282 |
| [sketch validation allows empty/open geometry but rejects degenerate primitive dimensions](../artifacts/kineticad/tests/sketch-dimensions.test.mjs#L137) | 1.067 |

## sketch-edit.test.mjs

14 passing tests.

| Test | Time (ms) |
| --- | ---: |
| [successful edit commits only after full-chain validation, preserving identities and clearing derived state](../artifacts/kineticad/tests/sketch-edit.test.mjs#L56) | 5.830 |
| [CAD history failure retains the committed sketch and can be retried](../artifacts/kineticad/tests/sketch-edit.test.mjs#L82) | 3.026 |
| [dependent assembly Boolean receives updated geometry and must succeed before commit](../artifacts/kineticad/tests/sketch-edit.test.mjs#L95) | 15.267 |
| [a later geometry or Boolean-consumer edit invalidates a pending transaction](../artifacts/kineticad/tests/sketch-edit.test.mjs#L112) | 1.554 |
| [mass-cache churn and cosmetic part naming do not reject or overwrite newer display state](../artifacts/kineticad/tests/sketch-edit.test.mjs#L126) | 1.213 |
| [loading an identical-looking project during validation rejects its old Sketch identity](../artifacts/kineticad/tests/sketch-edit.test.mjs#L135) | 1.163 |
| [cancelled or closed editors cannot commit a late CAD result](../artifacts/kineticad/tests/sketch-edit.test.mjs#L144) | 2.376 |
| [two pending edits cannot commit out of order](../artifacts/kineticad/tests/sketch-edit.test.mjs#L156) | 0.894 |
| [unchanged referenced edge geometry retains the exact joint and its local anchor](../artifacts/kineticad/tests/sketch-edit.test.mjs#L165) | 3.923 |
| [missing geometry IDs or a changed referenced face reject without guessing new pivots](../artifacts/kineticad/tests/sketch-edit.test.mjs#L173) | 2.221 |
| [fixed mates and unused sketches need no geometric-pivot remapping](../artifacts/kineticad/tests/sketch-edit.test.mjs#L184) | 0.233 |
| [meaningful edits clear canonical controllers and save the manual-geometry marker; no-op preserves them](../artifacts/kineticad/tests/sketch-edit.test.mjs#L191) | 6.801 |
| [invalid dimensions, stale editor source and active editors reject before CAD dispatch](../artifacts/kineticad/tests/sketch-edit.test.mjs#L215) | 0.753 |
| [the store commit independently rejects a stale source signature](../artifacts/kineticad/tests/sketch-edit.test.mjs#L231) | 0.323 |

## stewart-controller.test.mjs

6 passing tests.

| Test | Time (ms) |
| --- | ---: |
| [six-axis IK agrees with independently transformed anchors for both directions of every axis](../artifacts/kineticad/tests/stewart-controller.test.mjs#L21) | 78.623 |
| [all 64 simultaneous translation/rotation workspace corners satisfy stroke, speed and singularity guards](../artifacts/kineticad/tests/stewart-controller.test.mjs#L34) | 135.148 |
| [quintic trajectory starts and ends at rest and holds its final requested pose](../artifacts/kineticad/tests/stewart-controller.test.mjs#L41) | 1.366 |
| [invalid values, speed requests, altered frames and altered anchors reject explicitly](../artifacts/kineticad/tests/stewart-controller.test.mjs#L55) | 4.052 |
| [dimensionless Jacobian guard detects a collapsed singular geometry](../artifacts/kineticad/tests/stewart-controller.test.mjs#L64) | 4.324 |
| [orientation error measures tiny and sign-equivalent quaternions without acos cancellation](../artifacts/kineticad/tests/stewart-controller.test.mjs#L71) | 0.179 |

## stewart-geometry.test.mjs

5 passing tests.

| Test | Time (ms) |
| --- | ---: |
| [the editable v9 fixture forms one connected 14-body, 18-joint mechanism](../artifacts/kineticad/tests/stewart-geometry.test.mjs#L43) | 10.969 |
| [every encoded joint closes in world space and each actuator uses compatible oblique frames](../artifacts/kineticad/tests/stewart-geometry.test.mjs#L67) | 2.670 |
| [the six-axis length Jacobian stays nonsingular and equal actuator rates produce pure heave](../artifacts/kineticad/tests/stewart-geometry.test.mjs#L106) | 7.230 |
| [sampled lift retains rod overlap, radial bore clearance and conservative separation between legs](../artifacts/kineticad/tests/stewart-geometry.test.mjs#L144) | 10.324 |
| [the builder rejects an unsafe programme or insufficient rod overlap](../artifacts/kineticad/tests/stewart-geometry.test.mjs#L169) | 1.387 |

## stewart-integration.test.mjs

3 passing tests.

| Test | Time (ms) |
| --- | ---: |
| [saved six-axis command survives demo parsing and invalid commands fail closed](../artifacts/kineticad/tests/stewart-integration.test.mjs#L9) | 23.346 |
| [source guard permits labels and material changes but rejects altered solids, topology and visibility](../artifacts/kineticad/tests/stewart-integration.test.mjs#L16) | 31.920 |
| [measurement state uses actual worker results, holds on zero step, and clears on reset or another experiment](../artifacts/kineticad/tests/stewart-integration.test.mjs#L33) | 0.613 |

## stewart-workspace.test.mjs

5 passing tests.

| Test | Time (ms) |
| --- | ---: |
| [the entire ±5 mm / ±2° pose box is enclosed with no unresolved cells](../artifacts/kineticad/tests/stewart-workspace.test.mjs#L11) | 235.394 |
| [insufficient subdivision and an enlarged unsafe range fail explicitly](../artifacts/kineticad/tests/stewart-workspace.test.mjs#L25) | 5.127 |
| [independent Rodrigues progress matches exact quaternion axis-angle interpolation at intermediate poses](../artifacts/kineticad/tests/stewart-workspace.test.mjs#L30) | 4.277 |
| [all 64 extreme home-to-target paths are enclosed between progress samples](../artifacts/kineticad/tests/stewart-workspace.test.mjs#L47) | 337.771 |
| [exact target solid placements close spherical endpoints and encode independent rod extension](../artifacts/kineticad/tests/stewart-workspace.test.mjs#L56) | 4.870 |
