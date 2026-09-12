# Simulator capability audit

This audit describes the implemented models and the scope of their numerical
checks. It does not certify every possible imported model, assembly, material,
operating speed or user edit. Browser acceptance is recorded separately.

| Feature | Implemented and measured | Boundary of the claim |
| --- | --- | --- |
| CAD mass and inertia | OCCT B-rep volume, centre of mass and full centroidal inertia; principal-axis frame passed to Rapier; analytic mass regressions cover known solids and rotated frames. | Uniform density per part. Invalid mass/inertia rejects the simulation. A material name does not establish stiffness, strength or friction. |
| Revolute joint | One free rotation, stored local anchors and axis; ideal velocity drive; positive/negative RPM and motor release/reactivation tested. The windmill retains its unchanged ±5e-7 rad/s acceptance gate. | Finite-gain ideal drive, without a torque rating, angular travel stop, bearing friction or backlash. |
| Prismatic joint | One free translation; velocity units mm/s; passive gravity response and live motor release tested. | Ordinary assembly sliders have no force rating or travel stops. The bounded Stewart controller is a separate exception with explicit stroke limits. |
| Spherical joint | Three free rotations with coincident anchors; all twelve Stewart spherical closures measured throughout its test runs. | Ideal joint; bearing angular retention, friction, wear and load rating are not modeled. Stewart's geometric workspace imposes a separate conservative angular envelope. |
| Fixed joint | Preserves the existing relative position and orientation, including initially rotated parts. | Ideal rigid attachment, without weld, adhesive, fastener or fracture strength. |
| Joint frames | Valid rotated axes are exercised. Unsupported separate local-axis/orientation frames reject the whole assembly build with an explanation. | The installed Rapier JS binding does not represent every arbitrary local-frame combination. Rejection is intentional; the parts are not silently reoriented. |
| Planar joint | Existing saved records remain inspectable and deletable. New creation is unavailable; the inspector cannot Apply. | No implemented planar solver constraint. A loaded assembly containing one is rejected when simulation starts. |
| Stored motor torque/force fields | Legacy values remain in project data and are labeled **not applied** in the mate tree. | These fields do not cap ordinary assembly motors. They must not be used to infer payload capacity. |
| Gravity and external force | mm/kg/s conversion, mass-independent free fall, and the equal-force material experiment have independent Newtonian references. | Equal-force demonstration uses ideal guides with gravity disabled. It does not include friction or material elasticity. |
| Simulation clock | Fixed solver substeps, pause/reset, duration completion and render-message partition independence are tested. | Displayed time is time actually simulated. Solver results have finite numerical error; rendering cadence is not a physics timestep. |
| Engineering worker lifecycle | The shipped Comlink worker is exercised through its actual build/step/destroy boundary: asynchronous initialization, zero-time readback, queued world switching, invalid-build rejection and valid rebuild recovery. | Node supplies only the worker message endpoint. Browser pause/reset interaction remains separate acceptance evidence. |
| Assembly contact | Selected demo B-reps have geometric interference checks with stated pose/path scope. | All ordinary assembly collision-contact impulses are disabled. Geometric nonintersection is not a contact, friction or impact model. |
| Stewart baseline | Original six-second, zero-gravity equal-extension heave retains identical measured results after the controller addition. | This baseline is a coordinated vertical lift, not a load test. |
| Stewart six-axis controller | Physical leg actuation toward IK length targets; no prescribed deck transform. Sixteen actual-CAD runs cover ±X/Y/Z/roll/pitch/yaw, combined motion, a corner, irregular message timing and 120 Hz. Continuous geometric workspace/path bounds and exact B-rep spot checks are separate evidence. | Bundled, unchanged geometry only; ±5 mm translations and ±2° intrinsic-XYZ rotations; stroke −12 to +20 mm, commanded actuator speed at most 8 mm/s, condition/deflection checks. Zero gravity and no external loads. Ideal velocity servos do not establish a motor-force or payload rating. |
| Actuator load bench | Separate real Rapier world with an unpowered guide and explicitly capped equal/opposite forces. F/m, gravity hold, overload descent, free-base momentum, work/energy, timing and timestep convergence are tested. | A simple axial experiment, not a Stewart load rating. Commanded speed does not cap overload fall speed. The declared travel boundary stops the experiment before a possible crossing; it is not a modeled impact. |
| Contact/friction bench | Separate exact-cuboid experiment with actual support and Coulomb friction. Contact impulses are calibrated against momentum change; rest, glide, stopping, energy and timestep behavior are tested. | Guided straight motion with locked rotation/Y translation. This does not enable contacts in CAD assemblies or validate arbitrary bearing friction. Continuous-contact references are disabled for the diagnostic drop. |
| Cantilever calculator | Independent Euler–Bernoulli rectangular cantilever equations, explicit E and elastic limit, signed end load, and clearly scaled analytical curve. Benchmark dimensions or an eligible unchanged rectangle/extrude are accepted. | No CAD mesh deformation. Homogeneous isotropic linear elasticity; stated slenderness, small-deflection and stress bounds; no shear deformation, self-weight, buckling, plasticity or 3D stress concentration model. |

## Evidence

- [Six-axis numerical results](stewart-controller-results.json) and
  [workspace/clearance evidence](stewart-workspace-results.json).
- [Preserved Stewart heave baseline](stewart-physics-results.json).
- [Finite-force actuator results](actuator-bench-results.json).
- [Detailed physics verification](PHYSICS-VERIFICATION.md) contains earlier
  mass, ordinary-motor, material-force and browser acceptance evidence.
- Runnable tests: `tests/mass-properties.test.mjs`,
  `tests/physics-worker.test.mjs`, `tests/force-physics.test.mjs`,
  `tests/stewart-controller.test.mjs`, `tests/actuator-bench.test.mjs`,
  `tests/contact-bench.test.mjs`, `tests/beam-analysis.test.mjs`, and
  `tests/engineering-bench-worker.test.mjs`, under
  `artifacts/kineticad`.

## UI corrections from this audit

The mate tree identifies ordinary drives as ideal, identifies controller-owned
Stewart sliders as length-controlled, and explicitly marks legacy force/torque
values as unapplied. The unsupported Planar creation option is removed and its
legacy inspector explains the limitation with Apply disabled. The simulator's
existing contact/friction/load-limit disclosure remains applicable to ordinary
assemblies; the two standalone engineering benches have their own scopes.

Future implementations of assembly contacts, force-limited assembly motors,
arbitrary local joint frames, planar joints or structural deformation need their
own validated models and acceptance evidence before these limitations change.
