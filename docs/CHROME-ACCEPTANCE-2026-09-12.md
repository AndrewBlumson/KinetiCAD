# Chrome acceptance — 12 September 2026

Tested the actual KinetiCAD interface in Chrome, using the browser extension's interaction and DevTools log APIs. Development runs on `http://localhost:5184/app/`; a production build on `http://localhost:5185/app/` avoids hot-reload interruptions. Browser acceptance and numerical verification are separate evidence. The tables below record observed actions and results, not a claim that every possible user-created assembly is correct.

## Portable projects and existing CAD operations

| Actual browser action | Observed result |
| --- | --- |
| Load native project; import `recovery-block.step` | Native 60 × 60 × 3 mm plate and bored 20 × 20 × 10 mm solid both render; imported volume 3.72 cm³. |
| Save mixed project | Download contains both parts, native feature history and the original STEP bytes (25,368 base64 characters). Source SHA-256 `8ebd0dc51eab7eb4369054ebfe5abe22ef1e054b51316df245be9488c9d93f7e`. |
| Refresh | Recovery gate restores actual imported geometry before opening the workspace; both parts return. |
| Load invalid project referencing a missing sketch | “Project was not replaced”; current native and imported parts remain. |
| Edit native extrusion from 3 to 6 mm | Volume doubles from 10.80 to 21.60 cm³ and mass from approximately 0.085 to 0.170 kg. |
| Recover previous project | Extrusion returns to 3.0 mm; imported solid remains. |
| Load the file actually downloaded by Chrome | Both solids and their editable history return. |
| Load modified imported solid with brass material, mixed XYZ rotation and a fixed mate | Hole history, material, position [31, −17, 23] mm, rotation [19, −37, 61]° and mate are restored. |
| Edit imported solid's additional hole diameter 2 → 4 mm | Volume becomes 3.59 cm³, matching 4000 − 130π mm³; subsequent modifiers remain available. |
| Export this edited assembly to STEP and STL | Actual downloads independently inspected with OCCT and binary STL analysis: [export measurements](browser-export-results.json). STEP exact volume/centroid/bounds pass; STL volume error 0.02754%. |
| Refresh and run recovered mixed assembly | Two rigid bodies and one fixed joint remain; simulation runs and pauses; opening Engineering tests resets the assembly timer while retaining CAD. |

Save initially exposed an action-bearing Zustand object being passed to `structuredClone`; that was fixed and the real Save/download/refresh/load route repeated successfully. Imported-hole editing exposed an inherited OCCT lazy-builder bug; it was fixed and covered by actual-kernel tests.

## Six-axis Stewart controls

Each single-axis preset completed its 6.00-second motion and settling programme in Chrome, with requested and measured values agreeing to displayed precision: X = 5.000 mm, Y = 5.000 mm, Z lift = 5.000 mm, roll = 2.000°, pitch = 2.000°, yaw = 2.000°. Other axes remained zero to displayed precision.

Combined pose [4, −3, 4] mm / [1.5, −1, 2]° completed and was visibly supported by all six actuators. Target / measured leg travel in mm: 5.054 / 5.053, 6.723 / 6.723, 5.158 / 5.158, 0.352 / 0.352, 3.928 / 3.928, 1.736 / 1.737. Pause held the time at 0.30 seconds; resume continued the same run. All axes were also independently tested numerically using actual CAD mass properties: [controller report](stewart-controller-results.json), [workspace report](stewart-workspace-results.json).

## Engineering experiments

| Browser experiment | Measured result |
| --- | --- |
| Lift 1 kg with 16 N maximum actuator force | At 4.000 s: height 379.987 mm, Newton integration reference 380.085 mm, velocity 0.053 mm/s; holding force 9.810 N. |
| Hold 1 kg | Height 300.000 mm, speed zero, force 9.810 N, equal/opposite actuator reaction −9.810 N. Pause held 0.592 s; resume advanced to 0.608 s and completed at 2.000 s. |
| Overload with 2 kg | Weight 19.620 N exceeds 16 N motor cap. At 0.500 s the slider falls to 93.632 mm (reference 93.750 mm); velocity −905.013 mm/s. |
| Sliding friction, μ = 0.25, 2 kg, 1000 mm/s, 120 Hz | Stops at 199.788 mm versus analytical 203.874 mm, inside displayed ±4.667 mm integration allowance; support 19.620 N, final penetration 0.00641 mm. |
| Same sliding test at 240 Hz | Stops at 201.846 mm, closer to 203.874 mm; allowance ±2.583 mm, penetration 0.00235 mm. |
| Frictionless glide at 240 Hz | At 2.000 s: travel 1999.992 mm versus 2000.000 mm; speed 1000.000 mm/s. |
| Resting contact | Travel/speed zero; support 19.620 N balances weight. |
| Beam without supplied stiffness/elastic limit | No result until explicit values or the clearly specified reference case are selected. |
| Reference cantilever: 300 × 20 × 10 mm, 10 N, E = 200 GPa | Deflection 0.27 mm, bending stress 9 MPa, I = 1666.67 mm⁴, slope 0.00135 rad, clamp force −10 N and moment −3 N·m. |
| Double beam force to 20 N | Deflection doubles to 0.54 mm and stress to 18 MPa. |
| Also double bending depth to 20 mm | Deflection falls eightfold to 0.0675 mm and stress fourfold to 4.5 MPa. |
| Select actual native 60 × 60 × 3 mm plate | Correct dimensions shown; slenderness check fails explicitly. Changing local length axis to Z gives L = 3, b = 60, h = 60 mm. Imported bored solid is excluded from eligible beam choices. |
| Reference beam with 1000 N | Large-deflection and elastic-stress validity checks both fail explicitly. |

These are focused physical models. The motor bench does not establish Stewart lifting capacity, the cuboid contact bench does not enable arbitrary CAD collisions, and the beam calculation does not deform the CAD mesh or perform general FEA.

## Original demo regression

The unchanged Windmill was run in Chrome past 15 simulated seconds. DevTools records `relativeAngularSpeedRadPerSec = 3.1415927410125732` against target π (3.1415926535897927), absolute error approximately **8.74228 × 10⁻⁸ rad/s**, below the original **5 × 10⁻⁷ rad/s** gate. At 15 seconds anchor separation was 8.92409 × 10⁻¹⁰ mm. Pause and Reset worked; Reset returned to 0.00 s with two bodies and one joint.

The orrery ran with 13 bodies / 12 joints and visible nested motion; the supported gimbal ran with four bodies / three joints. Their motor errors are bounded solver measurements, not the stricter single-axis Windmill tolerance: see the separate [six-demo physics report](demo-physics-results.json).

## Evidence limits

- Numerical operation tests cover actual OCCT fillet/chamfer, all plane/direction extrusion combinations, partial revolve, six-face blind/through holes, booleans, transforms and invalid inputs. This does not imply every topology-picking combination was manually exercised in Chrome.
- Screenshots were inspected through the browser tool, alongside visible measurements and real worker logs. No hidden application state was injected to manufacture results.
- Console inspection found successful CAD self-tests incorrectly logged at error level; the success severity and duplicate forwarding were corrected. The final production page reported no error/warning logs during the accepted native modelling and engineering workflows.
- Final serial suite: **166 tests passed, zero failures**, 101.047 seconds. Full workspace typecheck/build and the final production build passed. Exact source/bundle and test-log fingerprints are in [release validation](release-validation.json). Publication from Replit remains a separate acceptance stage.
- Final fingerprinted production bundle was reloaded and the combined Stewart motion repeated: completed at 6.00 s, target [4, −3, 4] mm / [1.5, −1, 2]° matched measured values to three decimal places; DevTools returned no warnings or errors.

## Final repairs and repeated Chrome checks

- **Committed assembly Booleans:** Loaded a two-box subtraction with hidden source solids and a separate hidden cube; exported STEP and STL. Changed the operation to Union and then Intersect using the real editor, applied each and downloaded STEP. Exact volumes were 2000 / 6000 / 2000 mm³ and all bounds/centroids were correct. Every STEP contained one solid; hidden geometry was absent. See [actual browser download measurements](browser-boolean-export-results.json). Export buttons are disabled during unapplied previews.
- **Native modelling:** Created a new part, drew a 30 × 20 mm rectangle on XY, finished the sketch and extruded 5 mm. Displayed volume was 3.00 cm³, matching 3000 mm³. Selected real 3D edges, applied a 1 mm fillet and then 1 mm chamfer; regenerated volumes were 2.99 and 2.98 cm³.
- **Hole placement:** The original two-click workflow failed because selecting a face cleared its own selection. After repair, face plus position clicks produced U/V coordinates and a real 5 mm through-hole; volume became 2.88 cm³. Moved the part to X = 20 mm and rotation [23, −37, 61]°, then placed a second 2 mm hole by clicking its rendered face. It cut the correct solid and reduced volume to 2.86 cm³. Five genuine raycast/picker tests independently cover local/world frames, top/bottom faces and reselection.
- **Circle and revolve:** Drew a radius-10 mm circle centred 30 mm from the Y axis, then revolved it 360°. The rendered torus measured 59.22 cm³, matching 2π²Rr² = 59,217.626 mm³. Save and refresh restored the native sketch/revolve and modifier chains.
- **Boolean simulation guard:** The original solver consumed uncut source parts for assembly-level booleans. This is now explicitly prevented, with disabled Play, zero built-body count and a visible explanation to export/import the final STEP solids before defining materials and joints. Native per-part cuts continue to simulate. This guard prevents an incorrect physics claim; it is not new Boolean rigid-body support.
- **Decimal and negative inputs:** Typed 1.5 kg and 250 mm across consecutive fields without losing focus during asynchronous preparation. Typed −2.5 mm into Stewart X, paused at 0.30 s, resumed and reached the combined custom target [−2.5, −3, 4] mm / [1.5, −1, 2]° at 6.00 s. An attempted 99 mm target was rejected and the prior −2.5 mm value retained with an explicit message.
- **Background pause:** Paused the 1.5 kg custom motor test at 0.350 s, switched to the other local Chrome tab, then returned. Time remained 0.350 s; Resume advanced normally to 0.700 s before the next pause. Plot data includes the actual 300 mm / 0 s initial sample. Reset returns to the initial state.
- **Changed contact inputs:** At μ = 0.5 and 10 kg, 120 Hz, the block stopped at 97.887 mm versus 101.937 mm reference, inside ±4.667 mm. Support was 98.100 N; friction work was 5.00000 J.
- **Six demo replays:** Kinetic mobile ran with eight bodies/seven joints and visible branching motion. Material force lab finished at 2.00 s; halving force from 1 to 0.5 mN halved all eight displayed accelerations and distances (ABS 191.40 → 95.70 mm; brass 23.42 → 11.71 mm). The original Stewart lift finished at Z = 172.832 mm, rise 12.832 mm, sideways drift 0.003 mm, tilt 0.000° to displayed precision.

The final application preserves labels and tooltips for Export STL, Import STEP, Export STEP, Save project and Load project. A disabled action reflects an incomplete edit or unavailable model operation; numerical assumptions and unsupported modes remain visible.
