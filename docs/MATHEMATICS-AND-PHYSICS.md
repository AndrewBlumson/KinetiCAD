# Mathematics and physics: models, measurements and limits

This is the equation and numerical-evidence reference for KinetiCAD, reviewed against commit `8e954ab89cbc7ab0753b4d3145622c76a0fd63ef` on 12 September 2026. KinetiCAD was originally built with **Replit Agent**; the later development and verification described here were carried out with **Codex**. Those development tools are not the physical model: the application uses OpenCascade for B-rep geometry and Rapier for rigid-body dynamics.

**Passing the stated tests establishes the stated cases and tolerances, not universal mathematical or physical certification.** This document was assembled by reading source, tests, retained logs and JSON reports. The historical standalone scenario reports were not rerun for this documentation audit; the aggregate test suite was rerun separately and is recorded in the [test catalog](TEST-CATALOG.md) and [machine-readable inventory](test-inventory-results.json). That fresh run passed **298 tests across 39 files in 146.122 seconds**. The [stage validation record](boolean-simulation-validation.json) and [physics verification overview](PHYSICS-VERIFICATION.md) track regression/build status. Historical reports retain their own dates, source hashes and counts.

## 1. How to read the evidence

There are four distinct kinds of evidence:

1. **Analytical checks:** independently calculated geometry, equations, units, boundary conditions and scaling laws. These can detect implementation errors without relying on a rendered picture.
2. **Actual kernel/solver checks:** installed OCCT or the shipped Comlink/Rapier worker runs real geometry or dynamics. The Node adapters substitute the worker endpoint and local WASM loader, not a replacement physics engine. See the [CAD adapter](../artifacts/kineticad/tests/helpers/cad-worker-node.mjs) and [physics adapter](../artifacts/kineticad/tests/helpers/physics-worker-node.mjs).
3. **Controlled integration checks:** asynchronous responses, caches, state transactions, errors and lifecycle ordering are exercised with controlled collaborators. These establish application behavior; they are not additional measurements of physical accuracy.
4. **Browser acceptance:** the actual interface is used and its downloads/readouts inspected. A numerical report does not establish rendering, file-picker behavior or the public deployment. Browser records identify their own bundles and exercised flows.

A **test** is one executable test case. A **scenario** is one configuration/run in a report. A pair intersection, time sample, body or parameter vertex is a measurement within a scenario. For example, the six-axis report has 16 solver scenarios, while its workspace report has 910 pair intersections at ten poses; neither number means 910 independently tested product features.

An absolute tolerance is `|measured − reference| ≤ ε`. A relative tolerance is `|measured/reference − 1| ≤ ε` when the reference is nonzero. Some tests use a mixed bound `ε·max(1, |reference|)`. A report's observed maximum is only the maximum over its declared sampling cadence. If a suite stores pass/fail but no maximum residual, this document says so rather than inventing zero error.

### Physical models exposed by the app

| Area | Model actually used | Effects outside that model |
| --- | --- | --- |
| CAD assembly simulator | Rigid bodies with CAD mass, centre of mass and full inertia; ideal joints and velocity motors | General part-to-part contact, friction, finite motor torque/force, flexible bodies, backlash and strength |
| Material force lab | Actual equal-volume CAD bodies, fixed centre-of-mass forces, ideal straight guides, zero gravity | Material strength, elasticity, drag and contact |
| Crank-slider and Stewart controls | Physical closed-loop rigid mechanisms driven through joints; reference equations are comparisons | Load ratings, motor efficiency, impacts and manufactured bearing behavior |
| Motor & load bench | Separate Rapier world with an explicit capped axial force and reaction | A force limit on the user's CAD motors or a Stewart payload rating |
| Friction & contact bench | Separate guided cuboid on a cuboid floor | General concave CAD contact or a validated material friction library |
| Elastic beam | Independent Euler–Bernoulli cantilever calculation | CAD mesh deformation or general finite-element analysis |

## 2. Units, frames and exact solid mass properties

### Units

The CAD and rigid-body world use **millimetres, kilograms and seconds**. Stored Euler angles are degrees; quaternions are `[x,y,z,w]`; angular velocity is radians per second. Store/RPC durations are milliseconds and are divided by 1,000 before solver integration. Z is up; ordinary Earth-gravity fixtures use `[0,0,−9810]` mm/s².

| Quantity | Conversion used |
| --- | --- |
| Density entered as g/cm³ | `ρkg/mm³ = ρg/cm³ × 10⁻⁶` |
| Volume display | `Vcm³ = Vmm³ / 1000` |
| Force | `Fkg·mm/s² = 1000 FN` |
| Torque, if supplied as N·m | `τkg·mm²/s² = 10⁶ τN·m` |
| Linear impulse to force | `FN = Jkg·mm/s / (1000 Δts)` |
| Inertia | `Ikg·m² = Ikg·mm² × 10⁻⁶` |
| Kinetic energy | `KJ = ½ m |vmm/s|² × 10⁻⁶` |
| Work | `WJ = FN Δxmm / 1000` |
| Young's modulus | `EMPa = 1000 EGPa`; `1 MPa = 1 N/mm²` |
| Revolute speed | `ω = RPM × 2π/60` rad/s |

The torque conversion is a unit identity, **not a claim that CAD mate torque-limit fields are enforced**. The current CAD velocity motors have no exposed finite strength model.

### Volume, centre of mass and tensor

For a solid region Ω with uniform density ρ:

$$
V=\int_\Omega dV,\qquad m=\rho V,\qquad
\mathbf c=\frac1V\int_\Omega\mathbf x\,dV.
$$

Writing `r=x−c`, the centroidal inertia tensor is:

$$
\mathbf I_c=\rho\int_\Omega
\left[(\mathbf r\cdot\mathbf r)\mathbf 1-\mathbf r\mathbf r^T\right]dV.
$$

Thus `Ixx=∫ρ(y²+z²)dV` and the off-diagonal term `Ixy=−∫ρxy dV`, with coordinates measured from the centre of mass. The [mass-properties implementation](../artifacts/kineticad/src/cad/operations/massProperties.ts) validates solid topology, calls OCCT volume integration with closed-solid handling, reads `MatrixOfInertia().Value(i,j)`, and scales the nine entries by density. “Exact CAD mass” here means integration of the B-rep instead of a bounding box, equivalent sphere or display mesh; the computation still has OCCT and floating-point tolerances.

The symmetric tensor is diagonalized as:

$$
\mathbf I_c=\mathbf R_p\operatorname{diag}(I_1,I_2,I_3)\mathbf R_p^T.
$$

The principal-frame quaternion carries `Rp` to Rapier along with all three moments. Sorting eigenvalues must retain a proper right-handed eigenvector frame. Reconstruction is checked; nonfinite, nonpositive, nonsymmetric or nonphysical tensors are rejected. The principal moments must satisfy `Imax ≤ Iother1+Iother2`, within the stated floating-point allowance. There is no equivalent-sphere mass/inertia fallback for dynamic CAD bodies.

For a material change at fixed geometry:

$$
m_2=m_1\frac{\rho_2}{\rho_1},\qquad
\mathbf I_2=\mathbf I_1\frac{\rho_2}{\rho_1};
\quad \mathbf c,\mathbf R_p\text{ are unchanged}.
$$

The [volume cache](../artifacts/kineticad/src/features/volumeCache.ts) preserves the full tensor's principal frame when applying this scaling. Collider density is zero when explicit CAD mass properties are supplied, avoiding a second addition of collider-derived mass.

Independent references in [mass-properties.test.mjs](../artifacts/kineticad/tests/mass-properties.test.mjs) include:

| Shape/reference | Equations and numerical check |
| --- | --- |
| Cuboid `a×b×c` | `V=abc`, `Ixx=m(b²+c²)/12`, cyclically. A 20×30×40 mm aluminium-density box has `m=0.0648 kg`, COM `(10,15,20)` mm and tensor diagonal `(13.5,10.8,7.02)` kg·mm². |
| Solid cylinder, radius R and height h | `V=πR²h`, `Iz=mR²/2`, `Ix=Iy=m(3R²+h²)/12`. |
| Bored ring, radii R and r | `V=π(R²−r²)h`, `Iz=m(R²+r²)/2`, `Ix=Iy=m[3(R²+r²)+h²]/12`. |
| Generally rotated cuboid | Independent orthonormal axes reconstruct every component of `R I Rᵀ`, including products of inertia. |
| Applied angular impulse J | Actual Rapier readback must satisfy `Δω=I⁻¹J`, checking that the principal frame reaches the solver correctly. |

These eight tests use `10⁻⁹·max(1,|reference|)` for ordinary mass/tensor comparisons; the torque-impulse angular response uses `3×10⁻⁶·max(1,|reference|)`. The eigensolver's tiny/large tensor tests use `10⁻¹⁰` times the tensor scale. The suite retains pass/fail, not a separate maximum-error JSON; [the retained regression log](tests-2026-09-12.log) records its run. The Boolean report below provides explicit measured tensor residuals for further real-CAD cases.

### World transforms and anchors

For intrinsic XYZ Euler angles, the shared [part transform](../artifacts/kineticad/src/cad/operations/partTransform.ts) is:

$$
\mathbf x_w=\mathbf t+\mathbf R_x\mathbf R_y\mathbf R_z\mathbf x_l,
\quad\mathbf c_w=\mathbf t+\mathbf R\mathbf c_l,
\quad\mathbf I_w=\mathbf R\mathbf I_l\mathbf R^T.
$$

This order is shared with the renderer and STEP/STL export. Translation does not change a centroidal tensor. For inertia about a different pivot, use the parallel-axis theorem:

$$
\mathbf I_p=\mathbf I_c+m[(\mathbf d\cdot\mathbf d)\mathbf 1-\mathbf d\mathbf d^T].
$$

Native meshes and COM values are part-local and receive the part transform once. Finished assembly Boolean meshes, COM and principal frames are already in assembly coordinates; they therefore receive an **identity body transform**. This is also the convention for Boolean mate anchors.

[part-transform.test.mjs](../artifacts/kineticad/tests/part-transform.test.mjs) and [part-transform-occt.test.mjs](../artifacts/kineticad/tests/part-transform-occt.test.mjs) compare arbitrary Euler rotations with independent Three.js transforms. The actual B-rep box gates are `10⁻⁷ mm³` volume and `10⁻⁸ mm` COM; original local COM preservation uses `10⁻⁹ mm`. A common transform must preserve a 3,000 mm³ overlap within `10⁻⁶ mm³`. These tests retain assertions rather than a standalone residual report.

## 3. Geometry and editable sketch mathematics

### Sketch coordinates and operations

The local plane maps are `XY:(u,v)→(u,v,0)`, `XZ:(u,v)→(u,0,v)`, `YZ:(u,v)→(0,u,v)`. Extrusion uses the application's defined positive sweep direction: +Z, +Y and +X respectively. In particular, XZ's chosen positive extrusion direction should not be inferred from `U×V`; the UV arc frame and sweep direction have separately tested conventions.

For profile area A and depth h, `V=Ah`. Forward/backward/symmetric extrusion occupies `[0,h]`, `[−h,0]`, or `[−h/2,h/2]` along the defined sweep direction. Independent arc/sector references, with angles in radians, are:

$$
\mathbf p(\theta)=\mathbf c+R(\cos\theta,\sin\theta),\qquad
A_{sector}=\frac{R^2\phi}{2}.
$$

For a sector from α to β with `φ=β−α`, relative centroid coordinates are:

$$
\bar u=\frac{2R(\sin\beta-\sin\alpha)}{3\phi},\qquad
\bar v=\frac{2R(\cos\alpha-\cos\beta)}{3\phi}.
$$

A semicircle revolved about its diameter has volume `4πR³/3`. An annular sector of height h has volume `φ(R²−r²)h/2`; for its centroid, integrate `r²dr` in the first moment and `r dr` in area. For example, a quarter-annulus has `ū=v̄=4(R³−r³)/[3π(R²−r²)]`. The partial-revolution tests compare against that independently calculated centroid.

For the tested single straight box edge of length ℓ, radius-R filleting removes `(1−π/4)R²ℓ`; an equal-distance chamfer of size s removes `s²ℓ/2`. A straight cylindrical bore removes `πD²h/4` when its complete cylinder lies in the retained material. General fillets, intersecting holes or changing wall thickness require the actual solid result, not those special-case formulas.

| Verification family | Independent comparison | Tolerance/evidence |
| --- | --- | --- |
| [CAD operations](../artifacts/kineticad/tests/cad-operations.test.mjs) | All three extrusion planes/directions; annular-sector revolve; single-edge fillet/chamfer; blind/through bores from all six face frames; overlapping-box Booleans; invalid-input recovery | Main volume/coordinate assertions `10⁻⁶` in their stated mm-based units. Passing source-shape preservation and meshability checks are distinct from mass accuracy. |
| [Arc frames](../artifacts/kineticad/tests/sketch-arcs.test.mjs) | Endpoints and intermediate arc samples in XY/XZ/YZ, sector mass/centroid, sphere revolutions and both Stewart turned profiles | `10⁻⁷` absolute for compared geometry quantities; valid single solids and positive inertia required. |
| [Hole picker](../artifacts/kineticad/tests/hole-picker.test.mjs) | Face selection followed by point selection, inverse world→part-local transform, UV projection and forward/backward face frames | Interaction/frame assertions; this is not another machining-accuracy measurement. |
| [Overlay frames](../artifacts/kineticad/tests/overlay-frames.test.mjs) | Stored sketch/mate anchors transformed into the part's actual pose | Coordinate/visibility assertions. Rendered overlays must follow solver/CAD poses rather than alter them. |

These suites do not store per-case maxima in JSON; their assertions and execution logs establish pass/fail. [Aggregate validation](boolean-simulation-validation.json) and the [test catalog](TEST-CATALOG.md) identify the regression run separately.

### Persistent dimension edits

The [dimension helper](../artifacts/kineticad/src/sketch/sketchDimensions.ts) edits primitive parameters, not a general constraint system:

| Primitive | Parameters and edit equation |
| --- | --- |
| Circle | Centre `(u,v)` and diameter `D`; stored radius is `D/2`. |
| Rectangle | Lower-left corner, positive width and height; changing size preserves the specified corner. |
| Line | Start `P`, length ℓ and angle θ from +U; `end=P+ℓ(cosθ,sinθ)`. |
| Arc | Centre, radius, start angle and positive anticlockwise sweep; `endAngle=startAngle+sweep`, stored in radians. |

Entered sizes lie in `[0.001,10⁶]` mm; stored coordinates in `±10⁶` mm; entered angles in `±360000°`; arc sweep in `[0.001,359.999]°`. A circle represents a full loop. Exact no-op values return the original primitive without a trigonometric round trip. A boundary-only floating-point allowance decodes previously stored geometry; it does not relax typed numeric limits. Adjacent endpoints do not move automatically, so the user must edit adjoining primitives to preserve a connected profile.

The dimension stage has three different verification families:

- [Nine mathematical tests](../artifacts/kineticad/tests/sketch-dimensions.test.mjs): independent right triangles, quadrants, winding, circular endpoints, degree/radian conversions, anchors, input bounds and serialization. Ordinary comparison tolerance is `10⁻¹⁰` absolute; explicitly extreme-coordinate cases state their own allowance.
- [Ten actual-OCCT tests](../artifacts/kineticad/tests/sketch-dimensions-cad.test.mjs): a diameter 20→30 mm cylinder at depth 12 has volume `1200π→2700π mm³`, so volume/mass scale by 2.25; rectangle edits on all planes, a closed rotated line loop, sectors and saved/reopened geometry are independently checked. Volume gate `10⁻⁶ mm³`, coordinate gate `10⁻⁶ mm`, mass gate `10⁻¹⁰ kg`.
- [Fourteen transaction tests](../artifacts/kineticad/tests/sketch-edit.test.mjs): full feature/Boolean preflight, failure/cancel/retry, stale source identity, concurrent edits, joint preservation and simulation-reference invalidation. These use controlled kernel outcomes and do not claim another OCCT precision measurement.

The [dimension validation record](sketch-dimensions-validation.json) retains the historical 237-test stage. The [downloaded-cylinder report](sketch-dimensions-export-results.json) independently reopens actual browser files: diameter 30 mm, depth 10 mm gives `2250π = 7068.583470577035 mm³`. STEP volume error was `9.095×10⁻¹³ mm³` against `10⁻⁶ mm³`; COM/bounds gates were `10⁻⁶ mm`.

STL is deliberately approximate. That cylinder's STL volume was `7038.045012438362 mm³`, a **0.4320308%** deficit. With radius `R=15 mm` and export chord deflection `e=0.1 mm`, the retained bound is:

$$
\frac{|\Delta V|}{V}\le 1-(1-e/R)^2+10^{-6}
=0.013289888888889016.
$$

It also agrees with the independently reconstructed circumference polygon prism within `0.002 mm³`; measured difference is about `0.000064805 mm³`. After `10⁻⁵ mm` vertex welding it has one connected, closed, consistently oriented two-manifold shell, Euler characteristic 2 and no boundary/nonmanifold edges. This is a bounded cylinder/topology check, not a general mesh self-intersection proof. See [the complete dimension scope](SKETCH-DIMENSIONS-VERIFICATION.md).

## 4. Rigid-body dynamics, forces, joints and time

### Newton/Euler references

For a force specified in newtons in the millimetre world:

$$
\dot{\mathbf v}=\mathbf g+\frac{1000\mathbf F_N}{m},\qquad
\mathbf v(t)=\mathbf v_0+\mathbf a t,\qquad
\mathbf x(t)=\mathbf x_0+\mathbf v_0t+\tfrac12\mathbf a t^2
$$

for constant acceleration. A force applied at the COM adds no direct torque; at another point its torque is `(p−c)×F`. General rigid-body angular motion obeys `I ω̇ + ω×(Iω)=τ` in a body-fixed frame. Motor-driven demonstrations also receive constraint impulses and are not unforced angular-momentum experiments.

The [force worker tests](../artifacts/kineticad/tests/force-physics.test.mjs) check equal forces/different masses, doubled force and doubled mass, combined force+gravity on an offset rotated body, zero-step pause, duration/catch-up partitioning and rejection of invalid/fixed/missing/duplicate targets. For their analytic sliders, the measured acceleration is:

$$
\bar{\mathbf a}_{measured}=\frac{\mathbf v_2-\mathbf v_1}{(t_{2,ms}-t_{1,ms})/1000}.
$$

It is read from actual velocities and actual elapsed solver time; it is not assigned `F/m`. The pure-force consecutive-readout gate is `2×10⁻⁴` relative. Doubling F and m must preserve acceleration within `10⁻⁶ mm/s²` and travel within `10⁻⁶ mm` for that paired case. Force-measurement publication and stale/zero-time behavior are separately tested in [force-measurements.test.mjs](../artifacts/kineticad/tests/force-measurements.test.mjs).

### Gravity and physical pendulum

The [worker regressions](../artifacts/kineticad/tests/physics-worker.test.mjs) drop 0.1 kg and 10 kg bodies for one second at 240 Hz. The continuum fall is `½gt²=4905 mm`; the retained log measures `4905.64404296875 mm`, an error of `0.644043 mm` within the **12 mm** test allowance. The two masses must agree within `0.001 mm`. This test establishes gravity/units/mass independence for the fixture, not a floor collision.

For the passive 1000 mm rod, hinge-to-COM distance d and pivot inertia `Ip=Ic+md²`, the equation is:

$$
I_p\ddot\theta+mgd\sin\theta=0.
$$

At 10° initial amplitude `θ₀`, the test uses the small finite-amplitude approximation:

$$
T\approx2\pi\sqrt{I_p/(mgd)}\left(1+\theta_0^2/16\right).
$$

It linearly interpolates repeated same-direction zero crossings. The [retained log](tests-2026-09-12.log) gives **1.641144188848 s** observed versus **1.641147056254 s** reference: error about **2.8674 μs**, against a **2%** period gate. Maximum anchor drift was **0.000030551 mm**, against **0.5 mm**. Higher finite-amplitude terms are omitted by this reference; that omission is small at the tested amplitude but is not a general large-angle period guarantee. A separate Boolean pendulum below uses independent nonlinear RK4 integration instead.

### Joints and motors

For local anchors `aA,aB`, world points are `pA=tA+RAaA` and `pB=tB+RBaB`. Spherical/revolute closure is `|pB−pA|`. A prismatic joint allows translation along its world axis `n=RA axisLocal`; its measured extension and lateral residual are:

$$
s=(\mathbf p_B-\mathbf p_A)\cdot\mathbf n,\qquad
e_\perp=\left|\mathbf p_B-\mathbf p_A-s\mathbf n\right|.
$$

A hinge's axial **relative** speed is `(ωB−ωA)·n`. The magnitude of child world angular velocity is not its motor speed when the parent also rotates. World anchor velocities, when required, are `vpoint=vCOM+ω×(p−c)`; finite differences of measured extension provide an independent slider-speed check.

Current [worker joint construction](../artifacts/kineticad/src/physics/physicsWorker.ts) accepts fixed and spherical mates and bounded frame combinations for revolute/prismatic mates. The installed Rapier 0.12 binding supplies a shared local axis. A revolute pair can have an initial twist about that common axis; a prismatic pair must preserve the compatible complete frame. Unsupported mismatched frames reject the whole world instead of snapping bodies. Planar mates are unavailable, and legacy planar documents fail explicitly on Play. Missing/hidden/consumed body references cannot be silently dropped.

Motor commands are ideal velocity targets. `RPM=0` or blank disables/releases the motor; it is **not a brake**. Tests verify coasting, gravity-driven slider release, re-enabling/reversing motors and retained joint anchors. Live reversal of the windmill to −15 RPM is checked against `−π/2 rad/s` with the unchanged `5×10⁻⁷ rad/s` tolerance. Motor-off recreation preserves the current joint frame; it must not teleport the mechanism.

The original **30 RPM windmill gate is `π ± 5×10⁻⁷ rad/s`**. It is a tight, settled, simple-drive canary, not a tolerance for every coupled mechanism. Rotated-axis, fixed-child and nested-gimbal cases have their own gates in [physics-worker.test.mjs](../artifacts/kineticad/tests/physics-worker.test.mjs). The retained rotated slider moved `99.9773483 mm` during its second second at a nominal 100 mm/s; its travel allowance is `0.05 mm`.

### Fixed stepping, pause and completion

The [physics worker](../artifacts/kineticad/src/physics/physicsWorker.ts) accumulates requested elapsed time and advances only complete configured steps. Returned `dtMs` is actual advanced time, not requested wall time. At most 120 solver steps are performed by one worker call; excess time remains pending. A zero-duration request is a readback/pause and does not drain pending time. Invalid negative/nonfinite requests reject.

For a generic duration cap D and fixed step h, the allowable number of steps is `floor(D/h+10⁻⁹)`; it does not shorten the last step to manufacture an exact endpoint. Consequently a 2057 ms request with h=10 ms ends at 2050 ms. Roundoff in `2000/(1000/60)` is handled so it permits 120 steps. Stewart and the separate engineering benches require durations to fit whole configured steps.

Independent partition tests give the same 100 fixed 10 ms steps through 30 Hz, 144 Hz and irregular render requests and require **bit-identical final transforms**, with actual elapsed-time accounting within `10⁻⁹ ms`. Capped catch-up, zero-step pause, destroy/rebuild, force clearing and invalid-world rejection are covered by [worker tests](../artifacts/kineticad/tests/physics-worker.test.mjs) and [force tests](../artifacts/kineticad/tests/force-physics.test.mjs).

[simulation-runner.test.mjs](../artifacts/kineticad/tests/simulation-runner.test.mjs), [bench-elapsed-clock.test.mjs](../artifacts/kineticad/tests/bench-elapsed-clock.test.mjs) and [engineering-bench-worker.test.mjs](../artifacts/kineticad/tests/engineering-bench-worker.test.mjs) cover pending RPC results at Pause, no paused wall-time catch-up, stale build/destroy ordering, actual clock publication and switching/rebuilding independent worlds. These are lifecycle guarantees, not numerical accuracy claims. Completing a capped simulation preserves the final measured pose; Reset restores initial geometry.

## 5. The six bundled demos and equal-force materials

The [six-demo geometry report](demo-geometry-results.json) records 50 valid CAD part records: 48 single solids and two retained legacy compounds. Windmill `part-rotor` has five solids; Orrery `part-ring` has 24. The four later demos contain 35 single-solid parts. Treating the legacy compounds as one rigid body is an explicit ideal rigid-body representation; their separate solids are not evidence of material connectivity. The new assembly-Boolean body API has a stricter one-solid rule.

The same geometry report checks the driven gimbal at 16 selected poses, all six pairs per pose: **96 intersections with zero overlap**, against `10⁻⁵ mm³`. Additional radius-2.9 mm probe cylinders in the outer/middle clearance regions also intersect zero material. The mobile has **28 zero-overlap pair checks at its initial pose only**. Neither the mobile's initial check nor the gimbal's selected poses establishes continuous collision clearance for arbitrary motion. Material and Stewart have the additional separately scoped checks described below.

The [actual-demo physics script](../artifacts/kineticad/tests/verify-demo-physics.mjs) reads CAD-derived descriptors, verifies fixture hashes and measures the shipped worker. Its [JSON report](demo-physics-results.json) is the **09:51 UTC historical worker snapshot**, not a newly measured current-worker report. All six current fixture hashes match it at this review.

For the four driven demonstrations, run duration is 15 s at 60 Hz. Motor velocities are sampled once per 60 steps: 11 settled samples from 5 through 15 s. Anchors and fixed-body drift are checked every fixed step, including startup. The following velocity maxima are therefore sampled maxima, not every-step peaks:

| Demo | Bodies/joints | Maximum relative motor error, rad/s | Maximum anchor error, mm |
| --- | ---: | ---: | ---: |
| Windmill | 2 / 1 | `8.7422781×10⁻⁸` | `2.54372×10⁻⁹` |
| Orrery | 13 / 12 | `0.0113209383` | `0.000168118` |
| Three-axis driven gimbal | 4 / 3 | `0.000249345` | `0.00000359321` |
| Kinetic mobile | 8 / 7 | `0.000480989` | `0.0709481132` |
| Material force lab | 9 / 8 | No velocity motors; see F/m study | Guide lateral residual 0 in this report |
| Stewart baseline lift | 14 / 18 | Six linear drives; see next section | Maximum spherical closure `0.0000335562` |

The windmill gate is `5×10⁻⁷ rad/s`; the other angular drives use `0.02 rad/s`, off-axis relative angular velocity `0.03 rad/s`, anchor separation `0.1 mm` and fixed-body drift `0.001 mm`. Recorded fixed-body drift is zero. Maximum off-axis speed among the four is `0.00149149 rad/s`. Orrery motion is driven display kinematics, not a gravitational orbital model; the driven gimbal is not an unpowered gyroscopic-precession benchmark; the mobile's joints are powered, not a passive balance experiment.

### Material force lab

Each of eight samples has volume **10,050.283064729765 mm³**, with identical local CAD mesh/topology. Mass is `Vρ×10⁻⁶ kg`; 0.001 N acts at each COM along +Y for 2 s, with zero gravity, no damping and unpowered prismatic guides. The independent equations are `a=1000F/m`, `v=at`, `s=at²/2`. Densities are the explicit values in the [material library](../artifacts/kineticad/src/cad/materials.ts), not measurements of a manufactured sample.

The [force verifier](../artifacts/kineticad/tests/verify-material-force.mjs) and [report](material-force-results.json) compare the actual solver to that reference:

| Scenario | Maximum velocity or whole-run v/t relative error | Maximum displacement error |
| --- | ---: | ---: |
| 0.001 N, 60 Hz | `0.004768925%` | `0.051287078 mm` |
| 0.001 N, 120 Hz | `0.009568204%` | `0.033563995 mm` |
| 0.0005 N, 60 Hz | `0.004768925%` | `0.025677484 mm` |

The relative gate is **0.01%**. This report's acceleration is `v/t` from a rest start, whereas the UI and force-unit regressions also use consecutive velocity/time readouts. Do not quote the v/t gate as a guarantee for a shorter finite-difference interval. The position allowance is `½|a|t h + 0.002 mm`, a conservative first-order bound using the configured outer step h. Off-axis position/velocity gates are `0.001 mm` and `0.001 mm/s`; quaternion-component difference `10⁻⁵`; clock `10⁻⁶ ms`. Recorded off-axis/rotation deviations are zero.

All eight displacement errors decrease with the finer timestep. Half-force final velocity ratios are 0.5; half-force displacement ratios differ from 0.5 by at most about `8.15×10⁻⁷`. The [clearance verifier](../artifacts/kineticad/tests/verify-material-clearance.mjs) checks 72 exact initial/final pair intersections with zero measured overlap, plus straight-Y travel containment; see [material-clearance-results.json](material-clearance-results.json). Geometric separation does not supply simulated contact forces. The detailed interpretation is in [MATERIAL-FORCE-VERIFICATION.md](MATERIAL-FORCE-VERIFICATION.md).

## 6. Adjustable crank-slider

The [factory/reference](../artifacts/kineticad/src/mechanisms/crankSlider.ts) constructs four native parts, three revolute joints and one unpowered prismatic guide. The grounded crank motor drives a real closed loop; reference slider coordinates are never assigned to solver bodies. Admitted settings are `15≤r≤40 mm`, `75≤L≤180 mm`, `L≥3r`, RPM in `±30`, zero offset/gravity, 120 Hz and an 8 s cap. Default: r=25 mm, L=100 mm, +15 RPM. Negative RPM reverses; zero starts an unforced freshly rebuilt mechanism at rest.

With crank pin `A=(r cosθ,r sinθ)` and slider pin `B=(x,0)`:

$$
(x-r\cos\theta)^2+r^2\sin^2\theta=L^2,\quad
q=\sqrt{L^2-r^2\sin^2\theta},\quad x=r\cos\theta+q.
$$

The positive root selects the slider on the +X side. The rod angle is `atan2(−r sinθ,q)`, travel endpoints are `L±r`, and stroke is `2r`. Different Z levels provide part clearance without changing this planar closure. Differentiating:

$$
x_\theta=-r\sin\theta-\frac{r^2\sin\theta\cos\theta}{q},
$$
$$
x_{\theta\theta}=-r\cos\theta
-\frac{r^2(\cos^2\theta-\sin^2\theta)}q
-\frac{r^4\sin^2\theta\cos^2\theta}{q^3},
\quad v=x_\theta\omega,\quad a=x_{\theta\theta}\omega^2+x_\theta\alpha.
$$

The nominal comparison uses `θ=ωt`, `ω=RPM·2π/60`, `α=0`. A second comparison uses measured θ and ω, distinguishing linkage closure from motor phase/tracking error. The positive square root stays defined over the admitted domain; usual stroke-end dead centres still exist.

Only the intact canonical study receives [its solver profile](../artifacts/kineticad/src/mechanisms/crankSliderSolver.ts): 8 outer iterations, 16 internal PGS iterations and motor gain 100,000. Other CAD worlds retain 32 outer iterations, 1 internal PGS iteration and gain 10,000. These are numerical convergence settings, not physical force ratings. Manual geometry/material/transform/joint changes disable the canonical comparison and replacement controls.

The [geometry report](crank-slider-geometry-results.json) covers 24 valid single solids across six dimension configurations, with all six body pairs checked at 24 angles/configuration: **864 exact intersections, zero overlap** against `10⁻⁵ mm³`. These 15° samples are not a continuous swept-volume proof. Separate conservative pin/rail/envelope inequalities give at least 0.5 mm bore/guide clearance over the admitted dimensions.

The [physics report](crank-slider-physics-results.json) contains 16 actual-CAD scenarios: 15 at 120 Hz and a 240 Hz diagnostic, including the default, all five parameter-region vertices forward/reverse, an interior reverse case, zero speed and irregular request packets. Position/closure include startup. Motor/velocity acceptance excludes the first 0.25 s because the real motor starts from rest while the nominal equation assumes target speed from t=0.

| 120 Hz maximum error | Observed | Gate |
| --- | ---: | ---: |
| Nominal slider position | `0.037907006 mm` | `0.1 mm` |
| Nominal slider velocity | `0.368160770 mm/s` | `0.5 mm/s` |
| Mean acceleration over ≥1/30 s | `2.710264404 mm/s²` | `5 mm/s²` |
| Position from measured crank angle | `0.000369599 mm` | `0.05 mm` |
| Velocity from measured crank angle/speed | `0.317139765 mm/s` | `0.5 mm/s` |
| Revolute anchor closure | `0.000248815 mm` | `0.05 mm` |
| Guide lateral residual | `6.318×10⁻¹² mm` | `0.01 mm` |
| Crank angular-speed error | `0.001855048 rad/s` | `0.005 rad/s` |
| Out-of-plane tilt | `6.450×10⁻⁷ rad` | `10⁻⁵ rad` |
| Slider rotation / ground drift | `0 rad / 0 mm` | `10⁻⁵ rad / 10⁻⁷ mm` |

The acceleration gate applies to `[v(t₂)−v(t₁)]/(t₂−t₁)` over **at least 1/30 s**, compared with the reference velocity difference over exactly the same interval. It is not an instantaneous derivative. The last readout also selects an older eligible endpoint. Raw one-step diagnostics exceeded the original 5 mm/s² comparison in two cases: **5.077892384 mm/s² at 120 Hz** (`r=40,L=180,−30 RPM`) and **8.234163082 mm/s² at 240 Hz** (default +15 RPM). Both remain published as non-gating failures; shrinking the interval amplifies float32 velocity jitter. The 240 Hz mean-acceleration error is `0.908908789 mm/s²` and passes its mean gate.

Normal scenarios sample every solver step; irregular packets sample returned endpoints and additionally require identical final fixed-step transforms. Every run reaches the 8 s cap, then advances no time. Nine invalid solver configurations reject. Sources: [kinematics tests](../artifacts/kineticad/tests/crank-slider-kinematics.test.mjs), [CAD tests](../artifacts/kineticad/tests/crank-slider-cad.test.mjs), [actual physics tests](../artifacts/kineticad/tests/crank-slider-physics.test.mjs), [readout tests](../artifacts/kineticad/tests/crank-slider-readout.test.mjs), [workspace/persistence tests](../artifacts/kineticad/tests/crank-slider-workspace.test.mjs), and [complete verification discussion](CRANK-SLIDER-VERIFICATION.md).

## 7. Stewart platform: lift, six-axis inverse kinematics and workspace

### Baseline symmetric lift

The fixture has 14 bodies and 18 joints: six base spherical bearings, six prismatic actuators and six deck spherical bearings. Initial base-anchor Z is 12 mm, deck Z 160 mm, base radius 110 mm and deck-anchor radius 75 mm; paired angular offset is 30°. Consequently:

$$
b=\sqrt{110^2+75^2-2(110)(75)\cos30^\circ}
=58.6138280405\text{ mm},
$$
$$
L_0=\sqrt{148^2+b^2}=159.1841098777\text{ mm},\qquad
z(t)=12+\sqrt{(L_0+2t)^2-b^2}.
$$

With six +2 mm/s extension commands for 6 s, nominal extension is 12 mm and deck Z is `172.8366209452 mm`. The [baseline verifier](../artifacts/kineticad/tests/verify-stewart-physics.mjs) independently reconstructs the measured slider displacement, spherical anchors, deck-to-base leg lengths and deck pose every 60 Hz step. [Reported maxima](stewart-physics-results.json):

| Quantity | Error | Gate |
| --- | ---: | ---: |
| Spherical closure | `0.0000335562 mm` | `0.1 mm` |
| Slider lateral residual | `0.0000315384 mm` | `0.1 mm` |
| Slider extension vs 2t | `0.011266862 mm` | `0.1 mm` |
| Pose-derived leg length vs L₀+2t | `0.011268118 mm` | `0.1 mm` |
| Deck heave | `0.010286731 mm` | `0.1 mm` |
| Deck lateral drift | `0.003391443 mm` | `0.1 mm` |
| Deck rotation | `0.0000394574 rad` | `0.002 rad` |
| Settled slider speed | `0.010986401 mm/s` | `0.05 mm/s` |

The [clearance report](stewart-clearance-results.json) checks all 91 pairs at the initial and **actual measured final** poses: 182 pairs, zero overlap against `10⁻⁵ mm³`. [Geometry tests](../artifacts/kineticad/tests/stewart-geometry.test.mjs) additionally check conservative leg capsules at 61 intermediate analytic poses. Endpoints are not continuous contact detection.

### Six-axis controller

For fixed base anchor `Bi`, deck-local anchor `pi`, absolute world-space deck origin t and rotation R, t is the home origin `[0,0,160] mm` plus the requested translation offset; it is not the UI offset alone:

$$
\mathbf d_i=\mathbf t+\mathbf R\mathbf p_i-\mathbf B_i,\qquad
L_i=|\mathbf d_i|,\quad e_i=L_i-L_{i0},\quad\mathbf n_i=\mathbf d_i/L_i.
$$

The normalized length Jacobian has row:

$$
\mathbf J_i=\left[\mathbf n_i^T\quad
\frac{(\mathbf R\mathbf p_i\times\mathbf n_i)^T}{75\text{ mm}}\right],
\qquad \kappa_\infty=\|J\|_\infty\|J^{-1}\|_\infty.
$$

The 75 mm characteristic length makes rotational columns comparable with translation rather than letting chosen units determine condition number. See [stewartKinematics.ts](../artifacts/kineticad/src/physics/stewartKinematics.ts).

For normalized time u in `[0,1]`, trajectory progress is `s(u)=10u³−15u⁴+6u⁵`, with zero endpoint speed and acceleration and maximum derivative 1.875. Translation is linear in s. Rotation follows the shortest quaternion/axis-angle path in s; it does not interpolate Euler components. If total angular distance is ψ, an independent bound on actuator speed is `1.875(|Δt|+75ψ)/T`, with ψ in radians and T in seconds. The controller computes consecutive desired leg lengths, adds bounded extension feedback and drives the six physical prismatic joints. It never assigns a deck pose.

Accepted target controls are translations `±5 mm` per axis and intrinsic XYZ rotations `±2°`; stroke `−12…+20 mm`; commanded speed ≤8 mm/s; relative bearing deflection ≤8°; normalized condition ≤100. Default movement/settling is 4 s + 2 s. Other saved durations are validated; shorter duration can fail the speed guard. Zero gravity and no external force are required. Actual excessive tracking/stroke deviations stop the run. A target is “reached” only when actual deck position, orientation and all pose-derived leg lengths meet their respective 0.05 mm/0.05° tolerances.

The [controller report](stewart-controller-results.json) independently reconstructs 16 actual-CAD solver scenarios. Fifteen inspect every fixed step; irregular render packets inspect returned endpoints and require identical final transforms to their fixed-step reference.

| Measured quantity | Largest reported error | Gate |
| --- | ---: | ---: |
| Position during movement | `0.004890154 mm` | `0.1 mm` |
| Orientation during movement | `0.000965157°` | `0.05°` |
| Final position | `0.000568945 mm` | `0.05 mm` |
| Final orientation | `0.000899051°` | `0.05°` |
| Spherical closure | `0.0000478002 mm` | `0.1 mm` |
| Slider lateral error | `0.0000374759 mm` | `0.1 mm` |

Maximum measured actuator speed was `4.900139 mm/s`, against the report's `8.1 mm/s` measured-speed allowance; command limit remains 8 mm/s. Orientation error uses a normalized quaternion difference with sign equivalence, not subtraction of wrapped Euler angles. Sources: [controller](../artifacts/kineticad/src/physics/stewartController.ts), [controller tests](../artifacts/kineticad/tests/stewart-controller.test.mjs), [integration tests](../artifacts/kineticad/tests/stewart-integration.test.mjs), [actual-CAD verifier](../artifacts/kineticad/tests/verify-stewart-controller.mjs).

### Continuous conservative workspace bounds and discrete exact checks

The independent [workspace audit](../scripts/src/stewart-workspace-audit.mjs) subdivides the six-dimensional pose box. For one cell it bounds anchor movement by `|δt|+75∑|δEuler|`, direction variation using `asin(δP/Lcentre)`, and capsule separation by the centre separation minus both endpoint movement bounds. A Jacobian perturbation bound and the Neumann-series inverse condition `|Jc⁻¹ ΔJ|<1` bound nonsingularity throughout accepted cells. Separate Rodrigues-path enclosures cover progress intervals of shortest quaternion paths; Euler-box containment is not assumed for those paths.

The [workspace report](stewart-workspace-results.json) evaluates 2,411 cells and accepts 1,206 terminal cells with no unresolved cell, plus 72 paths (64 extreme target combinations and eight presets):

| Conservative whole-box quantity | Reported bound | Required limit |
| --- | ---: | ---: |
| Stroke | `−11.996820…+13.442622 mm` | `−12…+20 mm` |
| Inter-leg enclosing-capsule gap | `≥8.638748 mm` | Positive |
| Neck/plate gap | `≥1.916368 mm` | Positive |
| Barrel/plate gap | `≥4.751019 mm` | Positive |
| Remaining rod insertion | `≥18.557378 mm` | Retained positive engagement |
| Bearing deflection | `≤7.998416°` | `8°` |
| Normalized condition | `≤87.927770` | `100` |

Rod/bore radial clearance is 0.5 mm and ball/seat radial clearance 0.6 mm. Exact OCCT intersections supplement these bounds: all 91 body pairs at ten selected poses, including four actual controller final poses, give **910 zero-overlap checks** against `10⁻⁵ mm³`.

This is **ordinary floating-point conservative subdivision with margins**, not formally rounded interval arithmetic. Exact OCCT spots are discrete. The evidence does not certify uncontrolled dynamic overshoot, edited geometry, bearing retention, seals, friction, manufacturing tolerances, deformation or payload capacity. [Workspace tests](../artifacts/kineticad/tests/stewart-workspace.test.mjs), [workspace verifier](../artifacts/kineticad/tests/verify-stewart-workspace.mjs) and [audit discussion](STEWART-WORKSPACE-AUDIT.md) state those boundaries.

## 8. Separate engineering benches

### Motor & load: capped actuator force

The [actuator bench](../artifacts/kineticad/src/physics/actuatorBench.ts) is a separate vertical guided-body experiment. Its prismatic guide is passive, without an ideal motor. The controller requests a velocity from position error and an axial force from velocity error:

$$
v_{cmd}=\operatorname{clamp}(4(h_{target}-h),-v_{max},v_{max}),
$$
$$
F_{demand}=m g_{SI}+\frac{m\,80(v_{cmd}-v_{relative})}{1000},\qquad
F=\operatorname{clamp}(F_{demand},-F_{max},F_{max}).
$$

The gravity-compensation term is used for the fixed-base case; the independent free-base reaction case omits it. The gains have the required inverse-time dimensions. They specify this experiment's feedback controller, not a motor electrical model or a universal tuning rule.

Every step resets owned user forces/torques, then applies `+1000F` to the payload and `−1000F` to the base at the **same world point**. The net actuator force and net couple of that pair are zero. The fixed base transfers its reaction to the world; a free base accelerates oppositely. No ideal velocity drive remains active behind the finite cap.

Independent checks use `a=1000(F/m−gSI)` and reconstruct force from actual successive velocity readbacks:

$$
F_{inferred}=m\left(\frac{v_2-v_1}{1000\Delta t}+g_{SI}\right).
$$

The report also integrates the actual piecewise-constant force schedule with `xnext=x+vΔt+½aΔt²`, `vnext=v+aΔt`; this is an independent Newton integration of the measured applied-force schedule, not an independently predicted closed-loop force schedule. Kinetic/potential energy and actuator work are checked in joules. The free-base zero-gravity case checks `m vpayload + M vbase` conservation, rather than assuming the base is fixed.

[actuator-bench-results.json](actuator-bench-results.json) contains five measured scenarios:

| Check | Observed value/error | Gate |
| --- | ---: | ---: |
| Hold 1 kg at 300 mm | Force 9.81 N; position error 0 mm | `10⁻⁵ mm` |
| Lift 1 kg toward 380 mm, 16 N capacity | Final 379.986816 mm; target error `0.013183594 mm` | `0.02 mm` |
| Overload: 2 kg, 16 N, 0.5 s | Weight 19.62 N; continuum drop 226.25 mm; measured drop 226.368401 mm | Position error `0.118401 mm ≤0.2 mm` |
| Overload at 240 Hz | Position error `0.057251 mm` | `0.2 mm`; improves on 120 Hz |
| Force inference, all scenarios | Maximum `0.0003125 N` | `0.0004 N` |
| Actual velocity vs independent force-schedule integration | Maximum `0.02508545 mm/s` | `0.05 mm/s` |
| Actual position vs force-schedule integration | Maximum `0.11840058 mm` | `0.2 mm` |
| Energy balance | Maximum `0.000405963 J` | `0.003 J` |
| Free-base momentum residual | 0 kg·mm/s in the report | `0.0001 kg·mm/s` |

Overload acceleration is `(16/2−9.81)×1000=−1810 mm/s²`; nominal final downward speed is 905 mm/s. The command-speed bound does **not** clamp a falling overloaded body's actual speed. A conservative travel check stops the experiment before a possible crossing of its permitted travel region and preserves the measured state. That cutoff is not a collision, impact, contact hard stop or energy-conserving physical boundary.

Sources: [bench regression tests](../artifacts/kineticad/tests/actuator-bench.test.mjs), [independent measurement script](../artifacts/kineticad/tests/verify-actuator-bench.mjs), [Comlink bench bridge tests](../artifacts/kineticad/tests/engineering-bench-worker.test.mjs). Bearing friction, transmission efficiency, current/voltage/temperature, deformation and arbitrary CAD assemblies are outside this bench. Its 16 N example does not rate the Stewart or crank-slider drives.

### Friction & contact: guided block on a plane

The [contact bench](../artifacts/kineticad/src/physics/contactBench.ts) uses an actual 100×60×40 mm cuboid and fixed cuboid floor. X and vertical Z motion are dynamic; Y motion and rotation are guided. Both colliders have the same explicit single coefficient μ, average friction combination and zero restitution.

Under continuous support, with positive initial speed v₀:

$$
N=m g_{SI},\qquad F_f=-\mu m g_{SI},\qquad
v(t)=\max(v_0-\mu g_{mm}t,0),
$$
$$
t_{stop}=v_0/(\mu g_{mm}),\quad
x(t)=v_0t-\tfrac12\mu g_{mm}t^2\ (t<t_{stop}),\quad
x_{stop}=v_0^2/(2\mu g_{mm}).
$$

For μ=0 the block retains constant horizontal velocity. At rest with no horizontal applied force, expected tangential friction is zero; `μN` is the sliding capacity, not an ever-present force. There are not independently modeled static and kinetic coefficients.

Rapier contact manifold impulses are read from the actual solver, with `FN=J/(1000Δt)`. This installed 0.12 binding exposes the last internal small-step impulse when multiple outer solver steps are used. The bench therefore deliberately uses **one outer iteration, 16 internal PGS iterations and eight friction iterations**, so the measured impulse/full-step conversion can be calibrated against actual momentum changes. This profile is separate from the CAD assembly profile. A batched call reports forces from its final fixed step, not an invented average over the whole batch.

Independent momentum references are `Fx=mΔvx/(1000Δt)` and `Nz=m[Δvz/(1000Δt)+gSI]`. Friction work uses contact impulse times mean pre/post horizontal velocity, with `10⁻⁶` converting kg·mm²/s² to joules. The optional initial-gap/drop case disables the continuous-support reference through free fall and impact; its predictive contact distance and bounded penetration are checked separately.

The [eight-scenario report](contact-bench-results.json) records a 2 kg block with v₀=1000 mm/s and μ=0.25. The independent stopping distance is **203.873598 mm**:

| Rate | Measured stopping distance | Maximum position error | Position gate `v₀h/2+0.5` | Velocity error / gate |
| --- | ---: | ---: | ---: | ---: |
| 60 Hz | `195.756699 mm` | `8.116900 mm` | `8.833333 mm` | `0.339783 / 0.508750 mm/s` |
| 120 Hz | `199.788422 mm` | `4.085177 mm` | `4.666667 mm` | `0.194183 / 0.304375 mm/s` |
| 240 Hz | `201.845657 mm` | `2.027941 mm` | `2.583333 mm` | `0.141479 / 0.202188 mm/s` |

The velocity gate is `0.01 μ gmm h + 0.1 mm/s`. The recorded position error visibly converges as timestep decreases; it is not replaced by the exact trajectory. Across all scenarios, the largest contact-impulse/momentum force mismatch is **0.000194350 N**, against **0.0005 N**. Maximum continuous-support penetration is **0.0226288 mm**, against **0.025 mm**; the 20 mm drop reaches **0.0446587 mm**, against **0.1 mm**. Passive step energy increase is zero in these reports, below its `10⁻⁷ J` allowance; the default slide dissipates its initial 1 J of horizontal kinetic energy. Rest, frictionless, heavy-mass and higher-friction cases are included.

Sources: [nine contact tests](../artifacts/kineticad/tests/contact-bench.test.mjs), [measurement script](../artifacts/kineticad/tests/verify-contact-bench.mjs), [model discussion](CONTACT-BENCH.md). These coefficients are experiment inputs, not measured properties of named materials. No general CAD collision/contact behavior follows from this cuboid experiment. A whole-body convex hull fills bores and concavities; it cannot be silently used to claim correct concave contact.

### Elastic beam: independent cantilever analysis

The [beam calculator](../artifacts/kineticad/src/engineering/beamAnalysis.ts) models a uniform homogeneous isotropic rectangular cantilever, rigidly clamped at x=0 and loaded by a transverse tip force F at x=L. Dimensions are mm, force is N and E is N/mm². The user supplies Young's modulus and elastic limit; density does not infer either.

$$
I=\frac{bh^3}{12},\quad M(x)=F(L-x),\quad EI y''=M(x),
\quad y(0)=y'(0)=0,
$$
$$
y(x)=\frac{Fx^2(3L-x)}{6EI},\quad
\delta=\frac{FL^3}{3EI},\quad
\theta_{tip}=\frac{FL^2}{2EI},
$$
$$
\sigma_{max}=\frac{|F|Lh}{2I},\quad
\epsilon_{max}=\sigma_{max}/E,\quad
R=-F,\quad M_{clamp}=-FL.
$$

With `L=300,b=20,h=10 mm,F=10 N,E=200 GPa`, the reference is `I=1666.6666667 mm⁴`, `δ=0.27 mm`, `σmax=9 MPa`, tip slope `0.00135 rad`, clamp force −10 N and moment −3 N·m. At L/2, deflection is `5/16` of the tip value. Force reversal reverses displacement/reactions; stress magnitude remains positive. Doubling depth reduces displacement by eight, doubling width by two, and doubling length increases displacement by eight.

[Seven analytical tests](../artifacts/kineticad/tests/beam-analysis.test.mjs) check those independent values, boundaries, scaling, invalid numbers and CAD eligibility within `10⁻¹¹·max(1,|reference|)`. The [machine-readable report](beam-analysis-results.json) retains the reference and passing tests, not a sampled dynamic error curve or a measured physical deflection.

Accepted model range requires `L/max(b,h)≥10`, `|δ|/L≤0.02` and stress within the supplied elastic limit. These are conservative tool limits, not a design safety factor. Native CAD selection is limited to one rectangle and one extrusion with explicit length/bending axes; imported, modified or Boolean-participating geometry is not reduced to a bounding box. The plotted analytical displacement has a labelled transverse display scale; it does not deform CAD. Shear deformation, self-weight, plasticity, buckling, fatigue, stress concentrations, flexible contact and general 3D FEA are omitted. See [ELASTIC-BEAM.md](ELASTIC-BEAM.md).

## 9. Direct simulation of finished assembly Boolean solids

The [Boolean body API](../artifacts/kineticad/src/cad/cadWorker.ts) rebuilds complete source feature chains and exact part transforms, applies union/subtract/intersect, then derives the mesh and unit-density mass properties from **the same final connected OCCT solid**. Empty or disconnected results reject direct simulation. Ordinary modeller rendering/export can still contain a multi-solid compound; that is a different contract.

### Independent geometry and mass references

For overlapping boxes A and B:

$$
V_{A\cup B}=V_A+V_B-V_{A\cap B},\qquad
V_{A\setminus B}=V_A-V_{A\cap B}.
$$

First moments and inertia are added/subtracted using the same signed volumes, followed by recomputing the resulting COM and applying the parallel-axis theorem to each component. Merely summing source masses would double-count the overlap; taking only source inertia would miss material removal and the new COM.

The [15-case real-OCCT/Rapier suite](../artifacts/kineticad/tests/boolean-physics.test.mjs) includes:

- Union, subtract and intersect of two 10×20×30 mm boxes offset 5 mm in X: respective final volumes **9000, 3000 and 3000 mm³**. Each is checked both untransformed and under translation `(43,−27,59)` mm with mixed intrinsic XYZ rotation `(19,−37,61)°`.
- A 20×30×40 mm box with an off-centre 4×6×40 mm through-cut beginning at `(4,8,0)` mm. Result volume **23,040 mm³**; the removed material shifts COM and creates nonzero products of inertia. Both identity and transformed variants are checked.
- An actual native→STEP export/import, content-addressed source registration, transformed imported source plus native cutter, and comparison with the same off-centre analytic result. Rebuilding the registered source afterward must return unchanged exact mass properties, mesh vertices/normals/indices and face/edge topology. The source remains **24,000 mm³**, not a destructively cut or transformed asset.
- Empty/disconnected rejection, ordinary two-solid compound metadata, valid retry after failure, and a **0.00001 mm** input translation. That tiny translation changes union volume by **0.006 mm³**, measured `0.005999999999403 mm³`; it must not be rounded out of cache identity.

[boolean-physics-results.json](boolean-physics-results.json) records exact measurements and current worker/operation hashes. Maximum reported full-tensor error among the checked cases is about **5.60×10⁻¹⁴ kg·mm²**, within `10⁻⁷ kg·mm²`. Other gates are `10⁻⁶ mm³` volume, `10⁻¹⁰ kg` mass, `10⁻⁶ mm` COM, `2×10⁻⁵ mm` float32 mesh bounds and `5×10⁻⁶` relative mesh-volume error. Mesh-volume tolerance is for these planar fixtures, not arbitrary curved surfaces.

### Actual dynamics from final-solid properties

| Response | Independent reference and recorded error | Gate |
| --- | --- | --- |
| Gravity on transformed union and cut with different masses | At 1 s, velocity −9810.0009766 mm/s vs −9810; body-origin fall 4906.288574 mm vs 4905 | Velocity `0.5 mm/s`; position `gh/2+0.01 mm` for t=1 s |
| Equal 0.001 N COM forces on union/subtract/intersect | Consecutive velocity/time acceleration vs `1000F/m`; maximum relative error `0.0001166992` = `0.01166992%` | `0.02%`; no induced angular motion |
| Ground / zero-step pause / rebuild | Fixed result unchanged; zero-time call unchanged; rebuild reproduces initial transforms | Fixed position `10⁻⁷ mm`; exact compared reset/pause arrays |
| Passive hinged anisotropic cut | Independent nonlinear RK4 described below; frame/inertia reach real solver | Angle `0.003 rad`, speed `0.03 rad/s`, anchor `0.01 mm` |

The Boolean pendulum starts horizontally with a 100 mm lever from hinge to COM, rotating about world Y. Its independent equation is `θ̈=(mgℓ/Ip)cosθ`, with `Ip=Iworld,yy+mℓ²`, integrated by a separate RK4 routine with reference steps no larger than 10 μs. At 50 ms its reference is approximately θ=0.12031147435 rad and ω=4.8078149983 rad/s:

| Solver rate | Angle error | Speed error | Maximum hinge closure |
| --- | ---: | ---: | ---: |
| 240 Hz | `0.000311943 rad` | `0.000087662 rad/s` | `0.000019249 mm` |
| 480 Hz | `0.000155086 rad` | `0.000044270 rad/s` | `0.000012263 mm` |

The angle error approximately halves with timestep. This checks final-solid anisotropic inertia in an actual constrained response; it is not a universal tolerance for loaded Boolean mechanisms.

### Identity, material and ground rules are part of correctness

The [assembly simulation planner](../artifacts/kineticad/src/physics/assemblySimulation.ts) gives a result stable ID `boolean:<featureId>`. All its input parts remain editable construction geometry and are excluded as duplicate physical bodies, regardless of Hide inputs. Reusing an input in two physical Boolean results is rejected instead of double-counting material. There is no nesting or automatic source-mate migration.

Subtract inherits the retained body's material unless explicitly overridden. Union/intersect inherit only if all source material IDs agree; otherwise the user must choose one **uniform finished-solid material**. The model does not average densities or represent a heterogeneous composite. Material scaling changes mass and inertia, not Boolean geometry or its COM/frame.

Boolean assemblies require an explicit fixed body or remain free. They do not inherit a consumed cutter/source as ground. Creating/importing another part or migrating a legacy Boolean file preserves a deliberately free assembly. Native-only legacy ground defaults remain unchanged. Deleting inputs/results cleans up their dependent result joints and ground references.

Mate anchors carry the exact Boolean geometry revision captured from the picked mesh. Geometry/transform changes invalidate them; Apply of an unrelated name/RPM edit cannot relabel a stale anchor as current. Current world preparation compares complete assembly physics signatures before/after asynchronous work; later physical edits stop an obsolete world. The renderer uses the result mesh with an identity initial pose and actual subsequent solver transforms.

These are application guarantees covered independently by [planner tests](../artifacts/kineticad/tests/assembly-simulation.test.mjs), [body-cache tests](../artifacts/kineticad/tests/boolean-bodies.test.mjs), [actual store/Save/mate tests](../artifacts/kineticad/tests/boolean-mate-store.test.mjs), [picking/layer tests](../artifacts/kineticad/tests/boolean-result-picking.test.mjs), and [runner lifecycle tests](../artifacts/kineticad/tests/simulation-runner.test.mjs). They do not add contact forces, load ratings or general topology remapping. [The stage verification record](BOOLEAN-SIMULATION-VERIFICATION.md) separates numerical, browser and remaining user acceptance.

## 10. Export, persistence and regeneration: preserving the mathematical model

Save/Load correctness matters to physics: a visually similar replacement mesh is not necessarily the same solid, COM, inertia or joint attachment. The [project format](../artifacts/kineticad/src/project/projectDocument.ts) retains editable native history, transforms, material IDs, Booleans, mates and imported STEP bytes with SHA-256/body associations. File parsing is not a substitute for rebuilding those solids.

| Family | Independent check and tolerance | Evidence |
| --- | --- | --- |
| STEP recovery across worker restart | Rebuild the 20×20×10 mm block with radius-3 through bore: `V=4000−90π=3717.256661… mm³`. A second radius-1 through bore gives `4000−100π mm³`. Original volume reference `10⁻⁶ mm³`; downstream-hole volume `10⁻⁵ mm³`; restored before/after volume agreement `10⁻⁷ mm³`; original COM/topology comparisons retained. | [Actual restart tests](../artifacts/kineticad/tests/project-cad-roundtrip.test.mjs), [recovery report](project-recovery-results.json), [project recovery scope](PROJECT-RECOVERY.md) |
| Recovery transactions | Corrupt/missing assets, bad hashes, saved current/previous snapshots, failed writes, legacy migration and isolation must retain the prior complete project | [Persistence tests](../artifacts/kineticad/tests/project-persistence.test.mjs); controlled repository checks are separate from actual IndexedDB browser acceptance |
| Full-chain regeneration and caching | The complete feature history must be validated before accepting a final mesh; hashes preserve source geometry/transform identity; stale/failed/pending operations cannot publish an old tip | [Feature regeneration tests](../artifacts/kineticad/tests/feature-regen.test.mjs), [Boolean cache tests](../artifacts/kineticad/tests/boolean-bodies.test.mjs) |
| Committed STEP/STL assembly export | Seven actual-worker cases cover transformed Booleans, visibility, source suppression, ordered cuts, shared-source display outputs, disconnected compounds and successful retry. STEP volume/COM gates `10⁻⁵ mm³ / 10⁻⁵ mm`; planar-fixture STL volume `10⁻⁵` relative and COM `10⁻⁴ mm`. | [Export tests](../artifacts/kineticad/tests/assembly-export.test.mjs), [historical report](assembly-export-results.json), [fresh report retained in the inventory](test-inventory-results.json), [export contract](ASSEMBLY-EXPORT.md) |
| Actual browser downloads | Retained mixed native/imported, Boolean and edited-cylinder files are reopened/measured separately; STEP is B-rep, STL tessellated triangles | [Mixed export measurements](browser-export-results.json), [Boolean export measurements](browser-boolean-export-results.json), [dimension export measurements](sketch-dimensions-export-results.json) |

Report fixture names, source hashes, tolerance values and dates determine the scope. An old successful downloaded file does not prove a newly changed exporter; an exporter unit test does not prove that the browser downloaded/reopened the intended project. Native history is editable in a KinetiCAD project; ordinary STEP retains flat B-rep geometry, not the original parametric sketch history. A missing asset or failed feature must fail clearly rather than produce an apparently valid lighter body.

The detailed [simulator capability audit](simulator-capability-audit.md) is a useful companion, but older statements that all committed assembly Booleans require a STEP workaround have been superseded by the bounded final-solid API above. The new one-solid/material/anchor restrictions still apply.

## 11. Reproducing the checks

Use the repository's installed dependencies/lockfile: **Rapier 0.12.0, OpenCascade.js 2.0.0-beta.94e2944, Three.js 0.184.0** in this checkout. Do not upgrade the physics/CAD engine as part of reproducing a recorded result. An engine upgrade requires a new report and comparison of meaningful tolerances. Do not “fix” a failure by changing a report hash or widening a tolerance without investigation and explicit justification.

**Preserve report outputs before rerunning.** Some tests and standalone verifiers overwrite dated JSON reports, and fixture generators can rewrite fixture files. Keep the original bytes and hashes, save new measurements as separately identified evidence, and restore historical outputs when retaining their original provenance. The catalog's portable capture command preserves the two reports rewritten by this suite. Updating a historical source hash without actually rerunning its measurements does not create fresh evidence.

### Full regression run

From the repository root:

```sh
pnpm --filter @workspace/kineticad test:all
pnpm --filter @workspace/kineticad typecheck
```

`test:all` serializes `tests/*.test.mjs`, including the actual-OCCT families. **Standalone `verify-*.mjs` report scripts are not included by that glob.** Some tests regenerate their own JSON reports; others retain only assertion output. Save complete stdout/stderr if numerical diagnostics such as pendulum period are needed. The separate fresh catalog run retained every test source, result and reporter event in [test-inventory-results.json](test-inventory-results.json); it preserved the fresh generated export/Boolean payloads there and restored historical report files byte for byte. Historical standalone scenario reports were not rerun by that aggregate run.

### Focused equation/kernel checks

Run from `artifacts/kineticad` so TS path aliases resolve against the app's configuration:

```sh
node --import ../../scripts/node_modules/tsx/dist/loader.mjs --test --test-concurrency=1 \
  tests/mass-properties.test.mjs tests/cad-operations.test.mjs \
  tests/sketch-arcs.test.mjs tests/part-transform.test.mjs tests/part-transform-occt.test.mjs

node --import ../../scripts/node_modules/tsx/dist/loader.mjs --test --test-concurrency=1 \
  tests/physics-worker.test.mjs tests/force-physics.test.mjs tests/force-measurements.test.mjs

node --import ../../scripts/node_modules/tsx/dist/loader.mjs --test --test-concurrency=1 \
  tests/sketch-dimensions.test.mjs tests/sketch-dimensions-cad.test.mjs tests/sketch-edit.test.mjs

node --import ../../scripts/node_modules/tsx/dist/loader.mjs --test --test-concurrency=1 \
  tests/boolean-physics.test.mjs tests/boolean-bodies.test.mjs \
  tests/assembly-simulation.test.mjs tests/boolean-mate-store.test.mjs tests/boolean-result-picking.test.mjs

node --import ../../scripts/node_modules/tsx/dist/loader.mjs --test --test-concurrency=1 \
  tests/crank-slider-kinematics.test.mjs tests/crank-slider-cad.test.mjs \
  tests/crank-slider-physics.test.mjs tests/crank-slider-readout.test.mjs tests/crank-slider-workspace.test.mjs
```

Keep heavy OCCT processes serialized. Running several simultaneously can exhaust memory and does not make the geometric evidence more independent.

### Rebuild actual demo descriptors, then regenerate numerical reports

From the repository root, execute in this order, waiting for each process to exit:

```sh
node --import ./scripts/node_modules/tsx/dist/loader.mjs \
  scripts/src/verify-demo-geometry.mjs --export-descriptors

node artifacts/kineticad/tests/verify-demo-physics.mjs /tmp/kineticad-demo-descriptors.json
node artifacts/kineticad/tests/verify-material-force.mjs /tmp/kineticad-demo-descriptors.json
node artifacts/kineticad/tests/verify-stewart-physics.mjs /tmp/kineticad-demo-descriptors.json
node artifacts/kineticad/tests/verify-stewart-controller.mjs /tmp/kineticad-demo-descriptors.json

node --import ./scripts/node_modules/tsx/dist/loader.mjs artifacts/kineticad/tests/verify-material-clearance.mjs
node --import ./scripts/node_modules/tsx/dist/loader.mjs artifacts/kineticad/tests/verify-stewart-clearance.mjs
node --import ./scripts/node_modules/tsx/dist/loader.mjs artifacts/kineticad/tests/verify-stewart-workspace.mjs --occt

node --import ./scripts/node_modules/tsx/dist/loader.mjs scripts/src/verify-demo-geometry.mjs --refresh-metadata
```

The descriptor file is temporary and contains large meshes; the report scripts reject stale fixture hashes. `--descriptors-only` may be combined with `--export-descriptors` if only a fresh descriptor export is wanted; it explicitly skips interference sweeps and therefore cannot replace their report. `--refresh-metadata` updates aggregate report links/counts without rerunning OCCT and must never be described as a new measurement.

For the separate benches, from the repository root:

```sh
pnpm --filter @workspace/kineticad test:engineering
node --experimental-strip-types artifacts/kineticad/tests/verify-actuator-bench.mjs
node --experimental-strip-types artifacts/kineticad/tests/verify-contact-bench.mjs
```

The seven beam tests are included by `test:engineering`; `pnpm --filter @workspace/kineticad test:beam` runs them alone. [The beam JSON](beam-analysis-results.json) is a retained reference/validation artifact; its date should not be refreshed unless its recorded validation was actually performed.

### Preserving useful evidence

For each new numerical report, keep the source/fixture hashes, configured solver profile, actual step size/duration, measurement cadence, independent reference, declared tolerance, measured errors and failures. Keep failing refinements as diagnostics where appropriate. Do not discard a poor result merely because a different quantity passes. Compare reports by their model and measured quantity, not only their `passed` flag.

The current renderer uses float32 mesh/solver data in places; OCCT mass and JavaScript calculations use different numerical paths. A tighter CAD integration tolerance does not imply equally tight dynamic integration, render position, or differentiated-velocity accuracy.

## 12. Source-snapshot audit and machine-readable evidence index

This is a **read-only hash comparison at the reviewed checkout**, not a numerical rerun. Full hashes are retained in each linked JSON; shortened prefixes here identify the comparison. A matching recorded source proves byte identity for that listed file, not complete environment equivalence. An unlisted dependency is not implicitly verified. Fixture hashes must also match.

| Report / JSON key | Recorded snapshot compared with current source | Interpretation at this review |
| --- | --- | --- |
| [Demo physics](demo-physics-results.json) `.physicsWorkerSha256` | `a7c7e84367b8…` vs current `7143f9f0464f…` | **Changed worker.** Retain historical numerical results; do not relabel them current. |
| [Material force](material-force-results.json) `.physicsWorkerSha256`, `.massPropertiesSha256` | Worker changed as above; mass source `dafa18c94965…` matches | Historical actual-CAD response, current matching mass integration file. |
| [Stewart baseline](stewart-physics-results.json) `.physicsWorkerSha256` | `a7c7e84367b8…` vs `7143f9f0464f…` | Historical actual-CAD heave measurement. |
| [Stewart controller](stewart-controller-results.json) `.sourceSha256` | `physicsWorker.ts` changed; `stewartController.ts`=`876b4d062d13…` and `stewartKinematics.ts`=`0344e61651fa…` match | Controller equations are byte-identical; the old worker run is still an old worker run. |
| [Stewart workspace](stewart-workspace-results.json) `.auditSourceSha256`, `.controllerSourceSha256` | Audit `3efe900bc513…` and kinematics `0344e61651fa…` match | Here the misleadingly broad key `controllerSourceSha256` actually hashes **stewartKinematics.ts**. Its exact spots retain the measured pose report they cite. |
| [Crank geometry](crank-slider-geometry-results.json) `.sourceSha256`; [crank physics](crank-slider-physics-results.json) `.physicsWorkerSha256`, `.solverProfileSha256` | Combined CAD source hash `6a99008c3970…`, worker `7143f9f0464f…`, profile `86cf2cb18ec96…` match | `.sourceSha256` hashes the concatenation of seven factory/operation/material files, in the order declared by [the descriptor helper](../artifacts/kineticad/tests/helpers/crank-slider-cad.mjs); it is **not** the hash of crankSlider.ts alone. |
| [Actuator](actuator-bench-results.json) `.moduleSha256` | `b977c7e1a9fd…` matches actuatorBench.ts | Bench module matches. |
| [Contact](contact-bench-results.json) `.sourceSha256` | `ad19ef99bec1…` matches contactBench.ts | Bench module matches; one-outer-step impulse interpretation remains scoped to this installed version. |
| [Beam](beam-analysis-results.json) `.sourceHashes` | Equation module, panel and test files match their listed hashes | Retained analytical reference/validation; not a dynamic deformation measurement. |
| [Boolean physics](boolean-physics-results.json) `.sources` | CAD worker `272364444f85…`, physics worker `7143f9f0464f…`, mass `dafa18c94965…`, transform `7392d41ed249…` match | All four recorded source files match the reviewed implementation. |
| [Historical assembly export](assembly-export-results.json) `.sources` | Recorded CAD worker `49cfd6cea197…` differs from current `272364444f85…`; planner `10a78894c99a…` matches | The historical file was restored. The fresh current-source run is retained separately in the inventory row below. |
| [Fresh generated reports](test-inventory-results.json) `.freshGeneratedReports[]` | Select entry by `.path`; read `.freshRunReport.sources`. Fresh export and Boolean reports record CAD worker `272364444f85…` | `.freshRunRawUtf8`, historical/generated hashes and `restored` retain the exact new payload without replacing old report history. |
| [Project recovery](project-recovery-results.json) `.sourceHashes` | Records an older CAD worker `23c731d38f10…` and older project parser | Preserve its detailed historical run; later full regression execution is recorded separately. |
| [Demo geometry](demo-geometry-results.json) `.provenance.sourceSha256` | All seven operation/material hashes and all six fixture hashes match; verifier `dd240b619b96…` differs from current `1d35e6c6c16e…` | The documented later verifier change adds metadata/report handling. Original geometry measurements and metadata restoration must not be confused. |

The earlier [provenance review](REPORT-PROVENANCE.md) was written before later worker changes; statements there that the older `a7c7e843…` worker still matches are historical. A later passing aggregate suite does not automatically rerun standalone `verify-demo-physics`, `verify-material-force` or `verify-stewart-*` reports. Use their own hashes and the current validation overlay.

For a direct comparison of any recorded field with its source, this read-only example can be run from the repository root:

```sh
node - <<'NODE'
const fs = require('node:fs');
const crypto = require('node:crypto');
const report = JSON.parse(fs.readFileSync('docs/boolean-physics-results.json', 'utf8'));
const file = 'artifacts/kineticad/src/physics/physicsWorker.ts';
const actual = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
console.log({ file, measured: report.sources.physicsWorkerSha256, current: actual,
  matches: report.sources.physicsWorkerSha256 === actual });
NODE
```

The test and report links above cover geometry operations/frames, exact mass and density scaling, rigid-body units and passive motion, joints/motors, time/lifecycle behavior, all six demos, adjustable crank-slider, baseline and six-axis Stewart, geometric clearances, both dynamic benches, the analytical beam, persistent sketch dimensions, final Boolean physics, export and project recovery. The [test catalog](TEST-CATALOG.md) supplies the complete executable inventory. Any remaining untested assembly, material behavior, dynamic contact geometry or numerical range should be described as unverified rather than inferred from a large test count.
