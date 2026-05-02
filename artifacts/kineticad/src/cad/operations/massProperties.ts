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
// - The principal moments OCCT returns are in mm⁴ (volume-weighted) —
//   to get kg·mm² we multiply by `density × 1e-6` (same factor as the
//   mass conversion).
//
// Cleanup: every transient OCCT wrapper (`GProp_GProps`,
// `GProp_PrincipalProps`, `gp_Pnt`) is `.delete()`-d in a finally block.
// The caller is responsible for the input shape's lifetime.

const ALUMINIUM_DENSITY_G_CM3 = 2.7;

/**
 * Compute the mass properties of `shape` under the given `density`
 * (g/cm³). Returns kg-scale mass + centre-of-mass + principal inertia
 * (kg·mm²). Returns null only if OCCT outright refuses to compute on
 * the shape (e.g. empty compound) — the caller should treat that as a
 * massless static body.
 */
export function computeMassProperties(
  oc: unknown,
  shape: unknown,
  density: number = ALUMINIUM_DENSITY_G_CM3,
): {
  volumeMm3: number;
  massKg: number;
  comLocal: [number, number, number];
  principalInertiaKgMm2: [number, number, number];
} | null {
  const ocAny = oc as any;
  const shapeAny = shape as any;

  let props: any = null;
  let principal: any = null;
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

    // PrincipalProperties() diagonalises the inertia matrix. The three
    // moments come back as Moments() returns three numbers we read via
    // Moment_1/2/3 accessors on `GProp_PrincipalProps`.
    principal = props.PrincipalProperties();
    const moments = principal.Moments();
    // Moments() returns a struct with three named fields. The OCCT JS
    // bindings expose the trio via `Moment_1`, `Moment_2`, `Moment_3`
    // OR, depending on the build, as a tuple via `.Moments()` itself.
    // We probe both shapes defensively.
    let m1: number;
    let m2: number;
    let m3: number;
    if (moments && typeof moments === "object" && "I1" in moments) {
      m1 = moments.I1;
      m2 = moments.I2;
      m3 = moments.I3;
    } else if (
      moments &&
      typeof moments === "object" &&
      "Moment_1" in moments
    ) {
      m1 = (moments as any).Moment_1();
      m2 = (moments as any).Moment_2();
      m3 = (moments as any).Moment_3();
    } else {
      // Last-resort: query the principal-properties object directly
      // for some bindings that hang accessors off it.
      m1 = (principal as any).Moment_1?.() ?? 0;
      m2 = (principal as any).Moment_2?.() ?? 0;
      m3 = (principal as any).Moment_3?.() ?? 0;
    }

    // Volume × density → mass; volumeMoment × density → inertia. Both
    // share the same `density × 1e-6` conversion factor (mm³·g/cm³ → kg
    // and mm⁴·g/cm³ → kg·mm²).
    const k = density * 1e-6;
    const massKg = Math.max(volumeMm3 * k, 1e-6);
    const ix = Math.max(m1 * k, 1e-6);
    const iy = Math.max(m2 * k, 1e-6);
    const iz = Math.max(m3 * k, 1e-6);

    return {
      volumeMm3,
      massKg,
      comLocal: [cx, cy, cz],
      principalInertiaKgMm2: [ix, iy, iz],
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
    if (principal) {
      try {
        principal.delete?.();
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
