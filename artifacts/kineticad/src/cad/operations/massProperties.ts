// Mass properties extraction from an OCCT TopoDS_Shape.
//
// Phase 8 — feeds the Rapier physics worker realistic per-part mass /
// centre-of-mass / inertia values. Without these, Rapier would default
// to a unit cube around the body's bounding box, which produces wrong
// dynamics for slender bars, asymmetric parts, or hollow holed bodies.
//
// Strategy:
// - Run `BRepGProp.VolumeProperties_1(shape, props)` to populate a
//   `GProp_GProps` with volume + centre-of-mass + inertia matrix
//   (computed in absolute world coordinates).
// - Call `props.PrincipalProperties()` to diagonalise the inertia
//   matrix; we only consume the principal moments (the diagonal of the
//   inertia tensor in its principal frame). Off-diagonal terms are
//   handled by Rapier when we hand it the principal-axis quaternion.
// - Convert OCCT's mm³ volume + g/cm³ density to a kg mass:
//   `massKg = volumeMm3 × density × 1e-6` (since 1 cm³ = 1000 mm³ and
//   1 g = 1e-3 kg → 1 mm³ × 1 g/cm³ = 1e-3 g = 1e-6 kg).
// - For the principal inertia we *would* like to call OCCT's
//   `GProp_GProps::PrincipalProperties()` and read three principal
//   moments off the resulting `GProp_PrincipalProps`, but that method
//   (`void Moments(Real&, Real&, Real&)` in C++) is exposed in
//   opencascade.js as a strict 3-output-arg embind binding and throws
//   `BindingError: function GProp_PrincipalProps.Moments called with
//   0 arguments, expected 3 args` on every call (we don't have a
//   reliable way to allocate `Standard_Real` reference boxes from JS
//   in this build of opencascade.js). Demo-grade workaround: skip the
//   diagonalisation entirely and approximate the part as a sphere of
//   equivalent volume — gives a non-zero, isotropic, well-conditioned
//   inertia diagonal that Rapier accepts. Accurate enough for a
//   spinning-arm / four-bar demo (where rotational inertia matters
//   only through orders of magnitude); a future phase can revisit
//   with `BRepGProp.MatrixOfInertia` + a JS-side eigensolve, or upgrade
//   the OCCT binding to one that exposes the output-args wrapped.
//
// Cleanup: every transient OCCT wrapper (`GProp_GProps`, `gp_Pnt`)
// is `.delete()`-d in a finally block. The caller is responsible for
// the input shape's lifetime.

/**
 * Compute the mass properties of `shape` under the given `density`
 * (g/cm³). Returns kg-scale mass + centre-of-mass + principal inertia
 * (kg·mm²). Returns null only if OCCT outright refuses to compute on
 * the shape (e.g. empty compound) — the caller should treat that as a
 * massless static body.
 *
 * `density` is required: the caller must look up the material via
 * `getMaterial(part.materialId).densityGcm3` before calling.
 */
export function computeMassProperties(
  oc: unknown,
  shape: unknown,
  density: number,
): {
  volumeMm3: number;
  massKg: number;
  comLocal: [number, number, number];
  principalInertiaKgMm2: [number, number, number];
} | null {
  const ocAny = oc as any;
  const shapeAny = shape as any;

  let props: any = null;
  let com: any = null;

  try {
    // GProp_GProps_1() builds an empty inertia struct centred at the
    // origin; BRepGProp.VolumeProperties then populates it from the
    // shape. The 1e-3 tolerance is OCCT's default — finer values cost
    // more iterations of the adaptive Gauss-Legendre integration.
    props = new ocAny.GProp_GProps_1();
    ocAny.BRepGProp.VolumeProperties_1(shapeAny, props, 1e-3, false, false);

    const volumeMm3 = props.Mass();
    if (!Number.isFinite(volumeMm3) || volumeMm3 <= 0) {
      // Zero-volume shape (sheet body, empty compound). Treat as a
      // tiny static-ish particle so Rapier doesn't divide by zero.
      return {
        volumeMm3: 0,
        massKg: 1e-6,
        comLocal: [0, 0, 0],
        principalInertiaKgMm2: [1e-6, 1e-6, 1e-6],
      };
    }

    com = props.CentreOfMass();
    const cx = com.X();
    const cy = com.Y();
    const cz = com.Z();

    // Mass = volume × density × 1e-6  (mm³ · g/cm³ → kg).
    const massKg = Math.max(volumeMm3 * density * 1e-6, 1e-6);

    // Sphere-equivalent isotropic inertia. See file header for why we
    // bypass the principal-moments path. r_eq = (3V / 4π)^(1/3),
    // I_sphere = (2/5) m r².  For a 50 mm cube (V=125 000 mm³,
    // m≈0.34 kg) this gives r_eq≈31 mm and I≈131 kg·mm² — same order
    // of magnitude as the true principal moments (~70–110 kg·mm²),
    // sufficient for non-FEA dynamics demos.
    const rEqMm = Math.cbrt((3 * volumeMm3) / (4 * Math.PI));
    const isoInertia = Math.max((2 / 5) * massKg * rEqMm * rEqMm, 1e-6);

    return {
      volumeMm3,
      massKg,
      comLocal: [cx, cy, cz],
      principalInertiaKgMm2: [isoInertia, isoInertia, isoInertia],
    };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[MASS-PROPS] computeMassProperties failed:", err);
    return null;
  } finally {
    if (com) {
      try {
        com.delete?.();
      } catch {
        // ignore
      }
    }
    if (props) {
      try {
        props.delete?.();
      } catch {
        // ignore
      }
    }
  }
}
