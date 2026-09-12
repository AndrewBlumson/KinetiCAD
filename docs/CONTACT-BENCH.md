# Guided sliding-block contact bench

`src/physics/contactBench.ts` delivers an isolated Rapier experiment with a dynamic 100 × 60 × 40 mm cuboid and a fixed cuboid floor. X translation and vertical support are dynamic; rotations and lateral Y motion are guided. It does not enable collisions in the user's CAD assembly.

The module exports `ContactBenchConfig`, `ContactBenchSnapshot`, `CONTACT_BENCH_PRESETS` and `createContactBench`. The returned `step(requestedMs)` accumulates elapsed time into whole fixed steps; `step(0)` only reads the initial/current state. `dispose()` frees the world. Inputs include mass, initial speed, the single friction coefficient and a 60/120/240 Hz timestep. Duration must contain whole fixed steps.

The geometry is shared with the snapshot's dimensions so the UI can draw the actual collider dimensions. Both colliders have the same explicitly selected friction coefficient and average combination rule; restitution is zero. The coefficients are test parameters, not asserted friction properties of a named real material. Friction can be zero while vertical collision support remains active.

## Physical references and measurements

For continuous contact on a horizontal plane, the reference is:

`N = mg`, `F_friction = μmg`, `v(t) = max(v₀ − μgt, 0)`.

Before stopping, `x(t) = v₀t − μgt²/2`; afterwards `x = v₀²/(2μg)`. For μ = 0, the reference is constant velocity. The phase-aware expected friction readout becomes zero after the block rests. The separate `slidingFrictionForceN` field is the μN capacity and should not be presented as the actual friction of an unforced resting block.

Contact impulses come from Rapier's actual contact manifolds. The installed 0.12 binding reports the last internal small-step impulse when several outer solver iterations are used. This bench therefore uses one outer step, 16 internal PGS iterations and eight friction iterations. Dividing the recorded impulse by that full fixed-step duration now gives the mean force for the latest fixed step. Independent changes in body momentum calibrate both normal and tangential force readouts. A call that advances several steps returns the most recent step's force, not a fabricated mean for the whole call.

The world uses mm/kg/s: impulse in kg·mm/s divided by seconds and by 1000 gives newtons. Kinetic and gravitational potential energy are reported in joules. Friction work uses the impulse-work identity with the average pre/post horizontal velocity. This is consistent with [Rapier's distinction between accumulated forces and instantaneous impulses](https://rapier.rs/docs/user_guides/javascript/rigid_body_forces_and_impulses/).

The optional initial-gap diagnostic disables the continuous-support reference throughout free fall and impact. Predictive-contact reach covers a conservative one-step downward travel bound. This diagnostic checks reference validity and collision capture; it does not assert the sliding formula across an impact.

## Current numerical acceptance

[contact-bench-results.json](contact-bench-results.json) records every fixed-step metric and sampled traces, bound to the source hash. Nine actual-Rapier regression tests and eight report scenarios pass.

For a 2 kg block starting at 1000 mm/s with μ = 0.25, the analytic stopping distance is 203.8736 mm:

| Fixed rate | Measured stopping distance | Largest supported penetration |
| --- | ---: | ---: |
| 60 Hz | 195.7567 mm | 0.02263 mm |
| 120 Hz | 199.7884 mm | 0.00641 mm |
| 240 Hz | 201.8457 mm | 0.00236 mm |

The position error decreases approximately in proportion to timestep, as expected for the solver's position integration. This error is shown rather than overwritten with the analytic trajectory. The tested position allowance is `v₀dt/2 + 0.5 mm`; the report states separate velocity, force-calibration, energy and penetration gates. The original CAD motor tolerance is unrelated and unchanged.

Measured support for the 2 kg block is 19.6200 N. Contact-impulse and momentum force readouts differ by less than 0.0002 N across the recorded scenarios. Friction removes the initial 1 J of horizontal kinetic energy in the default slide. Frictionless motion preserves horizontal speed and energy, and heavier blocks have proportionally larger support forces while retaining the same Coulomb deceleration. The 20 mm drop diagnostic has less than 0.045 mm penetration and never displays an applicable sliding reference.

Rerun from the repository root:

```sh
node --experimental-strip-types --test artifacts/kineticad/tests/contact-bench.test.mjs
node --experimental-strip-types artifacts/kineticad/tests/verify-contact-bench.mjs
```

## Path toward CAD assembly contacts

The installed Rapier binding exposes cuboids, triangle meshes and convex hull/mesh colliders. It does not expose automatic convex decomposition in its collider descriptor. A whole-part convex hull fills bores and other concavities, so it cannot represent the Stewart barrels or plate apertures correctly.

The next bounded implementation should explicitly classify supported collider geometry. Native cuboids and other supported primitives can retain exact dimensions. Fixed concave geometry may use a validated oriented triangle mesh. Moving concave parts need authored compound convex pieces or a separately verified decomposition pipeline; several colliders can attach to one body without adding unintended mass when exact CAD mass properties are supplied separately. The renderer and collider representation need a shared, visible approximation tolerance and a rejected unsupported-shape path.

Before enabling those contacts for a mechanism, verify bores with pass-through probes, occupied material with blocked probes, resting support, sliding coefficient, impulse balance, passive energy, penetration and timestep convergence. Check the actual assembly over its motion range. The separate Stewart audit already proves geometric clearance of its current B-reps; it does not validate this future contact representation. Bearing retention, hard stops, seals, static/kinetic coefficient separation and flexible contact still require explicit models and evidence.
