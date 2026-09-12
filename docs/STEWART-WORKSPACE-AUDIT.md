# Six-axis Stewart workspace audit

The current geometry supports the controller's full target box: each translation component is within ±5 mm and each intrinsic XYZ rotation component is within ±2°. This result concerns the bundled rigid geometry and ideal joints. It does not establish actuator load capacity, bearing retention or contact dynamics.

The independent audit does not import the production inverse-kinematics implementation. It reconstructs the anchors from the parametric fixture, composes scalar XYZ rotations and calculates each leg length, clearance and length Jacobian. This follows the distinction between a six-dimensional requested pose and six actuator-length targets described in the [MathWorks Stewart example](https://www.mathworks.com/help/sm/ug/stewart-platform.html).

## Current measured evidence

The full report is [stewart-workspace-results.json](stewart-workspace-results.json). Its source and fixture hashes identify the audited version.

| Quantity | Conservative enclosure across the entire pose box |
| --- | ---: |
| Actuator extension relative to home | −11.9969 to +13.4427 mm |
| Separation of radius-9 mm capsules enclosing different legs | at least 8.6387 mm |
| Neck clearance from the adjacent plate face | at least 1.9163 mm |
| Barrel clearance from the plate faces | at least 4.7510 mm |
| Relative bearing deflection | at most 7.9985° |
| Normalized Jacobian infinity-norm condition | below 87.928 |
| Rod still inside its bore | at least 18.5573 mm |
| Rod bottom above the closed barrel floor | at least 36.0031 mm |
| Shaft-to-bore radial clearance | 0.5 mm |
| Spherical end-to-seat radial clearance | 0.6 mm |
| Vertical separation of the two plates | at least 133.1743 mm |

The calculation evaluated 2,411 cells and accepted 1,206 enclosing cells, with no unresolved cells. These are conservative bounds, not claims that the mechanism reaches each bound. Direct corner values are tighter: the 64 corners span approximately −11.2984 to +11.5472 mm of extension.

All 64 extreme target paths and the eight supplied presets also pass separate continuous progress-interval checks. Those 72 paths use exact shortest-axis rotation and linear translation in progress space. The monotone quintic time law traverses the same paths and gives zero endpoint speed and acceleration. A separate velocity bound remains below 8 mm/s for the four-second moves. This avoids assuming that quaternion interpolation stays inside an Euler-coordinate box.

Actual OCCT checks rebuilt all 14 solids and intersected every pair at ten selected poses: four geometric extremes, home, combined motion and four measured controller final poses. All **910 pair intersections had zero overlapping volume** within the 0.00001 mm³ gate. The measured poses include combined motion, a workspace corner, negative roll and positive pitch. Geometric target checks and actual solver-pose checks are identified separately in the report.

## Why the spaces between samples are covered

For each small pose cell, let the translation half-width vector be δt and the sum of angular half-widths be δθ in radians. Each deck anchor is 75 mm from the deck origin, so its displacement from the centre pose is bounded by:

`δP ≤ ||δt||₂ + 75 δθ`.

The leg base remains fixed. If the centre-pose leg length is L, then the changed direction lies within `asin(δP/L)` of its centre direction. Length differs by at most δP. Two leg capsules can approach one another by at most 2δP, because both centreline segments are enclosed by that endpoint displacement.

The neck and barrel inequalities bound the furthest point of each circular cross-section toward the adjacent plate plane. Spherical ends remain inside radius-6 mm spheres centred in radius-6.6 mm through-bores. The rod and barrel remain coaxial in the ideal prismatic constraint, so the bore-clearance and retained-insertion checks cover the same-leg solids. Separate plate bounds cover plate-to-plate interference.

For conditioning, use the dimensionless Jacobian row `[u, (r × u)/75]`. The maximum infinity-norm perturbation is bounded by `sqrt(3) × (δθ + 2δu)`, where `δu = 2 sin(asin(δP/L)/2)`. If `||J⁻¹||∞ ||δJ||∞ < 1`, the Neumann bound encloses the inverse throughout the cell; otherwise the cell is subdivided. A cell that still cannot be enclosed at the depth/budget limit fails explicitly.

The path checks use the same enclosure with a bound on displacement over each progress interval. They use Rodrigues' formula independently of the controller's quaternion implementation. A regression compares that rotation to exact quaternion axis-angle interpolation. Three's convenience `slerp` uses a normalized-linear approximation at these small angles, so it is not the strict reference for angular progress.

These are conservative numerical certificates evaluated with ordinary floating-point arithmetic, not formally verified directed-rounding interval proofs. Their physical margins are much larger than floating-point rounding. They do not enclose uncontrolled dynamic overshoot, deformation, arbitrary changes to the fixture or an unmodeled bearing cartridge.

## Rerun

From the repository root:

```sh
node --experimental-strip-types --test artifacts/kineticad/tests/stewart-workspace.test.mjs
node --import ./scripts/node_modules/tsx/dist/loader.mjs artifacts/kineticad/tests/verify-stewart-workspace.mjs --occt
```

The OCCT command requires a current passing `docs/stewart-controller-results.json`; it rejects stale controller sources or fixture bytes. Coordinate it with other heavy OCCT verification jobs. The five regression tests cover the complete box, rejected insufficient/unsafe bounds, exact interpolation, all 64 extreme paths and the individual body placements used by the B-rep checks.
