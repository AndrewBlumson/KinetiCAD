# Adjustable crank-slider — separate development stage

This is the first mechanism-workbench stage after the recorded 166-test baseline. It adds one adjustable crank-slider. It does not alter the historical acceptance claim in `release-validation.json` or implement the remaining roadmap. **User testing is pending; this stage must stop for that review before another feature begins.**

## What the mechanism does

The crank rotates about a fixed spindle. A connecting rod joins its outer pin to a slider, which moves along a straight guide. A larger crank radius makes a longer stroke; rod length changes the shape of the motion curve. Even at constant crank RPM, the slider speeds up, slows down and reverses twice per revolution.

The assembly contains four native CAD parts: a grounded bed with spindle support and rails, a brass crank, an aluminium connecting rod and a steel slider. Three revolute joints and one prismatic joint close the mechanism. Only the spindle joint has a motor. The rod and slider move because the rigid-body solver enforces their joints; their displayed positions are not assigned from the reference formula.

The **Crank-slider** button opens an isolated workspace. Adjust the dimensions and speed, then choose **Apply dimensions & speed** before running. Reset the simulation before changing these controls. **Save project** retains the native feature history and settings; **Return to my model** restores the original project. Manual changes to geometry, material, transforms or joints disable parameter replacement/reference comparisons so the generated controls do not overwrite that work. Cosmetic renaming alone does not change the mechanism.

## Supported configuration

| Quantity | Accepted range | Default |
|---|---|---|
| Crank radius `r` | 15–40 mm | 25 mm |
| Connecting rod pin-to-pin length `L` | 75–180 mm, with `L ≥ 3r` | 100 mm |
| Crank speed | −30 to +30 RPM | +15 RPM |
| Slider offset from crank centreline | 0 mm, fixed | 0 mm |
| Gravity | Zero for this study | `[0,0,0]` mm/s² |
| Solver timestep | Fixed 1/120 s | 8.333… ms |
| Run duration | 8 s | 8 s |

Negative RPM reverses the motor. Zero RPM disables it; a freshly rebuilt, unforced mechanism begins at rest. RPM is an ideal velocity target, not a torque rating. Playback speed changes how quickly simulated time advances without changing the solver timestep.

Only the intact generated crank-slider receives its dedicated numerical profile: 8 outer solver iterations, 16 internal PGS iterations and velocity-motor gain 100,000. These are convergence settings, not physical motor specifications. Other assemblies retain their existing 32 outer iterations, 1 internal PGS iteration and gain 10,000; their prior accuracy gates are unchanged.

The admitted `r,L` region has five vertices: `(15,75)`, `(25,75)`, `(40,120)`, `(40,180)` and `(15,180)` mm. The extra default configuration is `(25,100)` mm. These limits constrain geometry and the verified numerical study; they are not a manufacturing standard or a load-capacity envelope. They keep `L²−r² sin²θ` positive throughout a revolution. The usual stroke-end dead-centre positions still exist.

## Exact rigid-link reference

MIT OpenCourseWare's *Topics in Machine Elements*, PDF page 12, presents slider-crank vector-loop closure with a possible guide offset. The derivation below specialises that construction to zero offset and explicitly selects the slider on the positive-X side of the crank. This is an independent geometric reference for the solver, not a motion command. [MIT 2.017 machine-elements notes](https://ocw.mit.edu/courses/2-017j-design-of-electromechanical-robotic-systems-fall-2009/16cb0f850752422026a85d838f30e340_MIT2_017JF09_machines.pdf#page=12)

Let the fixed spindle centre be `O=(0,0)`, the crank pin be `A=(r cosθ,r sinθ)` and the slider pin be `B=(x,0)` in the mechanism's XY plane. The connecting rod has length `L`, so:

\[
(x-r\cos\theta)^2+(r\sin\theta)^2=L^2.
\]

Choosing the positive horizontal separation between the pins gives:

\[
q=\sqrt{L^2-r^2\sin^2\theta},\qquad x=r\cos\theta+q.
\]

Here `x` is the slider-pin X coordinate measured from the fixed spindle centre in millimetres. The rod angle, measured from +X towards the slider, is `atan2(−r sinθ,q)`. The fixed Z levels in the CAD assembly provide physical spacing between its parts and do not change this planar closure.

With angular speed `ω=dθ/dt` and angular acceleration `α=dω/dt`, differentiate with respect to angle first:

\[
x_\theta=-r\sin\theta-\frac{r^2\sin\theta\cos\theta}{q},
\]

\[
x_{\theta\theta}=-r\cos\theta
-\frac{r^2(\cos^2\theta-\sin^2\theta)}{q}
-\frac{r^4\sin^2\theta\cos^2\theta}{q^3}.
\]

Then apply the chain rule:

\[
v=x_\theta\omega,\qquad a=x_{\theta\theta}\omega^2+x_\theta\alpha.
\]

For the nominal constant-speed comparison, `ω=RPM·2π/60`, `α=0` and `θ=ωt`, with time in seconds and initial angle zero. Velocity is in mm/s and acceleration in mm/s². The angle-based reference also accepts measured `θ,ω,α` for an instantaneous closure/derivative comparison; that is a different check from tracking the nominal time programme.

At the two stroke ends, `xmax=L+r` and `xmin=L−r`; stroke is therefore `2r`. The default travels between 75 and 125 mm, has a 50 mm stroke and completes one revolution every four seconds. Its eight-second run covers two nominal revolutions.

## What the readouts measure

The orange trace uses actual solver positions. Slider speed is the solver's X velocity. Crank RPM is read from angular velocity about the spindle axis. The calculated trace uses the nominal constant-speed reference at the same simulated time.

The acceleration table is labelled **Mean accel.** It reports `(v₂−v₁)/(t₂−t₁)` using the latest available earlier measured readout that is at least 1/30 s old, and compares that with the reference velocity difference over the identical interval. This rule also applies to the final-duration sample: its final pose is shown while acceleration uses an older eligible endpoint. If the required history is unavailable, acceleration remains unavailable. It must not be interpreted as an exact instantaneous second derivative. Readout cadence can differ from the internal solver-step cadence.

The motor starts from rest, while the nominal equation assumes its target speed from time zero. Velocity, acceleration and motor-speed acceptance exclude the first 0.25 s; position and geometric closure include startup. Comparing measured crank-angle geometry isolates linkage closure from any motor phase lag. Numerical reports state their sampling cadence, run durations and absolute tolerances; a visually close curve alone does not establish accuracy.

## Verification evidence for this stage

The geometry run passed: **24 valid single OpenCascade solids across six dimension configurations, and 864 sampled exact pair intersections with maximum overlap 0 mm³**. The [geometry report](crank-slider-geometry-results.json) records each configuration, solid and sampled pair count. The [physics report](crank-slider-physics-results.json) records **16 actual-CAD/Rapier scenarios passing their stated acceptance scope**, including the acceleration limitations below. Its worker/profile source hashes matched the files at publication. [Local production-preview Chrome acceptance](CRANK-SLIDER-CHROME-2026-09-12.md) is recorded separately. User testing and public deployment acceptance remain pending.

The verification design uses the actual native feature rebuild, OpenCascade volume/centre of mass/full inertia and the shipped Rapier worker. It checks the default and admitted parameter vertices, forward/reverse/zero speed, exact reference derivatives, motor and guide behavior, joint closure, pause/end-stop handling and persistence isolation. These checks extend the prior release; they do not retroactively change its 166-case result.

The CAD clearance suite rebuilds all four solids for six dimension configurations and checks all six part pairs at 24 crank angles per configuration: 864 exact intersection operations. These are discrete rigid poses at 15° intervals, not a continuous swept-volume proof or contact simulation. Separate analytical envelope and pin/rail clearance inequalities cover the admitted geometry domain; the fixed radial/guide clearances are at least 0.5 mm.

The exposed product runs at 120 Hz. Its position, velocity, closure and motor-speed thresholds retain their original values. The acceleration quantity accepted for display is the measured velocity difference over at least 1/30 s, with the original 5 mm/s² error threshold applied to that mean. All quantities use actual CAD-derived bodies and solver readbacks.

The final 16-scenario numerical run includes 15 runs at the product timestep and one 240 Hz refinement. It covers the default, five dimension-domain vertices in both directions, an interior reverse configuration `(40,150,−30)`, zero speed and variable request packets. Each run lasts eight simulated seconds. The following maxima are across the 120 Hz runs; normal cases measure every fixed solver step, while the variable-packet case measures returned batch endpoints. Position/closure include startup. Speed and motor samples are taken after 0.25 s; acceleration intervals have their ending time after 0.25 s and may start earlier.

| Error quantity | Maximum measured error | Acceptance limit |
|---|---:|---:|
| Slider position against nominal time programme | 0.037907006 mm | 0.1 mm |
| Slider speed against nominal programme | 0.368160770 mm/s | 0.5 mm/s |
| Mean acceleration over at least 1/30 s | 2.710264404 mm/s² | 5 mm/s² |
| Slider position using measured crank angle | 0.000369599 mm | 0.05 mm |
| Slider speed using measured crank angle/speed | 0.317139765 mm/s | 0.5 mm/s |
| Revolute-joint anchor separation | 0.000248815 mm | 0.05 mm |
| Slider-guide lateral deviation | 6.318 × 10⁻¹² mm | 0.01 mm |
| Crank angular-speed tracking | 0.001855048 rad/s | 0.005 rad/s |
| Out-of-plane tilt | 6.450 × 10⁻⁷ rad | 10⁻⁵ rad |
| Slider rotation | 0 rad | 10⁻⁵ rad |
| Ground drift | 0 mm | 10⁻⁷ mm |

**The initially considered 5 mm/s² single-step derivative target was not met in two cases.** The raw consecutive-step velocity derivative is retained in the report as a non-gating diagnostic at both timesteps; it is not presented as an instantaneous-acceleration accuracy guarantee:

| Diagnostic | Configuration | Maximum error | Original comparison level |
|---|---|---:|---:|
| 120 Hz raw 8.333… ms derivative | `r=40 mm, L=180 mm, −30 RPM` | 5.077892384 mm/s² | 5 mm/s² — exceeded |
| 240 Hz raw 4.166… ms derivative | Default dimensions, +15 RPM | 8.234163082 mm/s² | 5 mm/s² — exceeded |

Differentiating float32 solver velocities over a smaller interval amplifies numerical jitter. The 240 Hz refinement is not a selectable product setting; its position, velocity, closure, motor tracking and interval-mean acceleration remain checked. Its mean-acceleration error is 0.908908789 mm/s², within the 5 mm/s² limit. Publishing the interval mean does not establish the rejected finer derivative target. The physics report retains both exceedances in `nongatingDiagnostics` and states the accepted quantity in `acceptanceScope`.

Every run reached the eight-second cap, and a further step advanced no time. Variable request packets produced exactly the same final fixed-step transforms as the corresponding default run. Nine invalid solver configurations were rejected; live motor updates used the current world's gain, and rebuilding an ordinary world restored the prior defaults. These checks do not change the historical 166-case release result.

The complete serialized suite for this stage passed **195/195 tests, with zero failures or skips, in 134.175 seconds**. The raw output is [crank-slider-tests-2026-09-12.log](crank-slider-tests-2026-09-12.log). Geometry and physics report copies were refreshed from this full run.

The final local Chrome checks cover default, reverse and zero-speed motion; invalid paired dimensions; direct-click Apply; pause/resume; eight-second stopping; restart/reset; an actual downloaded project's Save/Load/refresh roundtrip; restoration of the original workspace; and disabled reference controls after manual CAD edits. The zero-speed run held 125.000 mm with zero speed, mean acceleration and RPM. The repeated final-bundle default ended at 125.000 mm with displayed position error 0.0001 mm. Console warning/error capture was empty during those final motion checks. See the [Chrome record](CRANK-SLIDER-CHROME-2026-09-12.md) and retained [browser-saved reverse project](crank-slider-evidence/saved-reverse.kineticad.json) for the exact scope. **The stage is ready for the user's own testing; no next feature is included or started.**

Run the stage's tests serially from the repository root, without another heavy OpenCascade process:

```sh
node --import ./scripts/node_modules/tsx/dist/loader.mjs --test --test-concurrency=1 artifacts/kineticad/tests/crank-slider*.test.mjs
```

## Physical scope

This is a rigid, zero-gravity mechanism with ideal joints and an ideal spindle velocity drive. CAD-derived masses and inertia enter its dynamics. Part-to-part contact, bearing friction, motor torque limits, contact forces, backlash, elastic bending, fatigue and strength are not established by this example. Rendered pin bores and rails do not supply simulated contact forces. Geometric clearance results are not a finite-force or contact-load rating.

The separate engineering benches and analytical elastic-beam tool retain their own scopes. Persistent sketch constraints, four-bar path fitting, general CAD contact and finite-force mechanism design remain future work. They are not part of this stage.
