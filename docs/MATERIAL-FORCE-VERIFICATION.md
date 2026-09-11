# Material Studio: equal-force verification

The experiment gives eight geometrically identical CAD samples the same constant force. Different material densities produce different masses, so the lighter samples accelerate faster. This is a rigid-body inertia experiment; it does not model material strength, elasticity, contact friction or aerodynamic drag.

Each sample runs on an ideal, unpowered prismatic guide along world +Y. Gravity and damping are zero. The force acts at its centre of mass, with magnitude **0.001 N** for **2 seconds of simulated time**. The guide prevents lateral translation and rotation without prescribing the sample's Y velocity. The platform stays fixed.

The predictions are calculated independently from the exact mass obtained by rebuilding the sample's OpenCascade geometry. Positions, velocities and body masses used as measurements come from the actual Rapier worker. No analytical animation or prescribed velocity replaces the force calculation.

## Analytical reference and units

KinetiCAD uses kilograms, millimetres and seconds. A newton is a kg·m/s², so a force expressed in newtons must be multiplied by 1,000 before it is passed to this millimetre-scaled physics world:

```text
F_worker = 1,000 × F_newtons
a_mm/s² = F_worker / mass_kg
v_mm/s(t) = a × t
displacement_mm(t) = ½ × a × t²
```

For 0.001 N, `F_worker = 1 kg·mm/s²`. At two seconds, velocity and displacement happen to have the same numerical value, `2 / mass_kg`; their units remain different.

All samples must have identical local meshes and CAD volume. The mass ratio must therefore equal the density ratio. At a shared time, the velocity, acceleration and displacement ratios must be the inverse mass ratios. A motor commanding the same velocity on every sample would fail this experiment.

## Numerical acceptance

The executable check rebuilds the real worker world from exported CAD meshes, mass, centre of mass, principal inertias and principal frames. It verifies fixture SHA-256 before using the descriptors and records the current worker source hash in [material-force-results.json](./material-force-results.json).

It runs three cases:

1. 0.001 N with a 1/60-second configured timestep.
2. 0.001 N with a 1/120-second configured timestep.
3. 0.0005 N with a 1/60-second configured timestep.

Every solver-step response is checked for finite values, correct mass, lateral drift, unwanted rotation and the predicted velocity. Snapshots at 0.5, 1, 1.5 and 2 seconds retain the independently predicted and measured values. The measured acceleration is `measured COM velocity / actual elapsed time`, valid here because the initial velocity is zero and acceleration is constant.

Velocity and acceleration must agree with `F/m` within **0.01%**. Lateral displacement and velocity are limited to **0.001 mm** and **0.001 mm/s**, respectively. The quaternion difference from the initial orientation must stay below **1e-5**.

For first-order semi-implicit Euler integration with constant acceleration, a configured step `h`, and `n = t/h` steps:

```text
v_n = a × n × h = a × t
x_n = a × h² × n(n+1)/2
    = ½ × a × t² + ½ × a × t × h
```

The conservative displacement-error bound is therefore `½ × a × t × h`, with **0.002 mm** allowed for accumulated float32 roundoff. Rapier's internal solver substeps can produce substantially smaller errors; the check does not claim that this bound describes its exact internal integration scheme. Halving the configured timestep halves the analytical bound. The report also compares the observed final errors; the finer run must not increase error by more than the 0.002 mm roundoff allowance.

Halving the applied force must halve measured velocity and displacement. The measured acceleration ordering must match inverse mass ordering. This checks that the implementation applies a common force, rather than a common acceleration.

## Recorded result

The recorded actual-CAD run passes all three cases. At 60 Hz the maximum velocity/acceleration relative error over every returned step is **0.004769%**; at 120 Hz it is **0.009568%**. These differ because repeated float32 arithmetic also contributes error. Final displacement error decreases for every sample when the timestep is halved; the largest error decreases from **0.05129 mm** to **0.03356 mm**. Every sample stays within the conservative integration bound.

All reported lateral displacement, lateral velocity and rotation drift are **zero**. Halving the force gives exactly half the measured velocity in this run; the displacement ratios differ from one-half by less than **8.2e-7**. Both timing and pause/completion checks pass.

Measured travel after two simulated seconds with 0.001 N at 60 Hz:

| Material | CAD mass (g) | Ideal travel (mm) | Measured travel (mm) |
|---|---:|---:|---:|
| Aluminium 6061 | 27.1358 | 73.7035 | 73.7207 |
| Steel 1018 | 79.0957 | 25.2858 | 25.2922 |
| Brass C36000 | 85.4274 | 23.4117 | 23.4176 |
| Titanium Grade 5 | 44.5228 | 44.9209 | 44.9323 |
| Nylon 6 | 11.4573 | 174.5609 | 174.6032 |
| PLA | 12.5629 | 159.1995 | 159.2407 |
| ABS | 10.4523 | 191.3455 | 191.3968 |
| Acrylic | 11.8593 | 168.6435 | 168.6836 |

Every sample has the same CAD volume, **10,050.283064729765 mm³**. The JSON report contains the exact fixture and worker hashes for this result; rerun the script after relevant source or fixture changes.

## Time and lifecycle checks

The two-second duration is an exact whole number of configured steps in both runs: 120 at 60 Hz and 240 at 120 Hz. The worker must return `completed: true` only on the final step and report exactly 2,000 ms of simulated time within **1e-6 ms**. The runner uses actual returned time, rather than requested wall time.

A zero-duration call halfway through each run must hold positions, velocities and simulated time. A large additional duration requested after completion must advance zero time and preserve all final measurements. These worker checks complement the separate browser checks for Play, Pause, Reset and the displayed measurements.

## Reproduce

From the repository root, export freshly rebuilt CAD descriptors. The exporter uses the same installed OpenCascade feature and tessellation operations as the application:

```sh
node --import ./scripts/node_modules/tsx/dist/loader.mjs scripts/src/verify-demo-geometry.mjs --export-descriptors --descriptors-only
node artifacts/kineticad/tests/verify-material-force.mjs /tmp/kineticad-demo-descriptors.json
```

The second command writes [material-force-results.json](./material-force-results.json) and exits nonzero on a failed assertion. This is actual CAD and physics verification in Node; rendered browser behavior and usability are separate acceptance checks.
