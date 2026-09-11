import type { MassPropertiesResult } from "../types";

type Matrix3 = [[number, number, number], [number, number, number], [number, number, number]];

/**
 * Diagonalise a symmetric physical inertia tensor. Eigenvectors are columns
 * of the returned principal-frame rotation: I_local = R diag(moments) R^T.
 * Scaling before Jacobi rotations keeps the convergence tolerance independent
 * of CAD units and part size. No equivalent-shape approximation is permitted.
 */
export function principalInertia(tensor: Matrix3): {
  moments: [number, number, number];
  frame: [number, number, number, number];
} {
  if (tensor.length !== 3 || tensor.some((row) => row.length !== 3 || row.some((n) => !Number.isFinite(n)))) {
    throw new Error("Inertia tensor must contain nine finite values.");
  }
  const scale = Math.max(...tensor.flat().map(Math.abs));
  if (!(scale > 0)) throw new Error("Inertia tensor must be positive definite.");
  const a = tensor.map((row) => row.map((v) => v / scale));
  for (let i = 0; i < 3; i++) {
    for (let j = i + 1; j < 3; j++) {
      if (Math.abs(a[i][j] - a[j][i]) > 1e-10) throw new Error("Inertia tensor is not symmetric.");
      a[i][j] = a[j][i] = (a[i][j] + a[j][i]) / 2;
    }
  }
  const vectors = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (let iteration = 0; iteration < 64; iteration++) {
    let p = 0, q = 1;
    for (const [i, j] of [[0, 2], [1, 2]]) {
      if (Math.abs(a[i][j]) > Math.abs(a[p][q])) { p = i; q = j; }
    }
    if (Math.abs(a[p][q]) <= 1e-14) break;
    const tau = (a[q][q] - a[p][p]) / (2 * a[p][q]);
    const t = (tau < 0 ? -1 : 1) / (Math.abs(tau) + Math.hypot(1, tau));
    const c = 1 / Math.hypot(1, t);
    const s = t * c;
    const off = a[p][q];
    a[p][p] -= t * off;
    a[q][q] += t * off;
    a[p][q] = a[q][p] = 0;
    for (let k = 0; k < 3; k++) {
      if (k !== p && k !== q) {
        const kp = a[k][p], kq = a[k][q];
        a[k][p] = a[p][k] = c * kp - s * kq;
        a[k][q] = a[q][k] = s * kp + c * kq;
      }
      const vp = vectors[k][p], vq = vectors[k][q];
      vectors[k][p] = c * vp - s * vq;
      vectors[k][q] = s * vp + c * vq;
    }
  }
  const order = [0, 1, 2].sort((i, j) => a[i][i] - a[j][j]);
  const moments = order.map((i) => a[i][i] * scale) as [number, number, number];
  if (moments.some((v) => !Number.isFinite(v) || v <= 0)) throw new Error("Inertia tensor must be positive definite.");
  if (moments[2] > (moments[0] + moments[1]) * (1 + 1e-9)) {
    throw new Error("Inertia moments violate the physical triangle inequality.");
  }
  const r = vectors.map((row) => order.map((i) => row[i]));
  const determinant = r[0][0] * (r[1][1] * r[2][2] - r[1][2] * r[2][1])
    - r[0][1] * (r[1][0] * r[2][2] - r[1][2] * r[2][0])
    + r[0][2] * (r[1][0] * r[2][1] - r[1][1] * r[2][0]);
  // Sorting can produce a reflection; flipping one eigenvector preserves I.
  if (determinant < 0) for (let i = 0; i < 3; i++) r[i][2] *= -1;
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      const reconstructed = moments.reduce((sum, inertia, k) => sum + r[i][k] * inertia * r[j][k], 0);
      if (Math.abs(reconstructed - tensor[i][j]) > scale * 1e-10) {
        throw new Error("Inertia eigensolver did not converge.");
      }
    }
  }

  const trace = r[0][0] + r[1][1] + r[2][2];
  let x: number, y: number, z: number, w: number;
  if (trace > 0) {
    const s = 2 * Math.sqrt(trace + 1);
    w = s / 4; x = (r[2][1] - r[1][2]) / s; y = (r[0][2] - r[2][0]) / s; z = (r[1][0] - r[0][1]) / s;
  } else if (r[0][0] > r[1][1] && r[0][0] > r[2][2]) {
    const s = 2 * Math.sqrt(1 + r[0][0] - r[1][1] - r[2][2]);
    w = (r[2][1] - r[1][2]) / s; x = s / 4; y = (r[0][1] + r[1][0]) / s; z = (r[0][2] + r[2][0]) / s;
  } else if (r[1][1] > r[2][2]) {
    const s = 2 * Math.sqrt(1 + r[1][1] - r[0][0] - r[2][2]);
    w = (r[0][2] - r[2][0]) / s; x = (r[0][1] + r[1][0]) / s; y = s / 4; z = (r[1][2] + r[2][1]) / s;
  } else {
    const s = 2 * Math.sqrt(1 + r[2][2] - r[0][0] - r[1][1]);
    w = (r[1][0] - r[0][1]) / s; x = (r[0][2] + r[2][0]) / s; y = (r[1][2] + r[2][1]) / s; z = s / 4;
  }
  const norm = Math.hypot(x, y, z, w) * (w < 0 ? -1 : 1);
  return { moments, frame: [x / norm, y / norm, z / norm, w / norm] };
}

/**
 * Integrate the B-rep volume, centre of mass and full inertia tensor in OCCT.
 * MatrixOfInertia() is about the centre of mass, with axes parallel to the
 * shape's local axes. Its scalar Value(i,j) binding avoids the unsupported
 * output-reference arguments of GProp_PrincipalProps.Moments().
 *
 * Geometry is in mm; density is g/cm³. OCCT's geometric inertia (mm⁵) is
 * multiplied by density × 1e-6 to obtain kg·mm². Invalid/empty geometry fails
 * explicitly; it must never become a small sphere or a fictitious mass.
 */
export function computeMassProperties(oc: unknown, shape: unknown, density: number): MassPropertiesResult {
  if (!Number.isFinite(density) || density <= 0) throw new Error("Material density must be finite and positive.");
  const ocAny = oc as any;
  let props: any = null, com: any = null, matrix: any = null;
  try {
    const solids = new ocAny.TopExp_Explorer_2(shape, ocAny.TopAbs_ShapeEnum.TopAbs_SOLID, ocAny.TopAbs_ShapeEnum.TopAbs_SHAPE);
    try {
      if (!solids.More()) throw new Error("A positive closed-solid volume is required for physical mass properties.");
      while (solids.More()) {
        const solid = solids.Current();
        let check: any = null;
        try {
          check = new ocAny.BRepCheck_Analyzer(solid, true, false);
          if (!check.IsValid_2()) throw new Error("Invalid solid topology cannot provide trustworthy physical mass properties.");
        } finally {
          check?.delete?.();
          solid.delete?.();
        }
        solids.Next();
      }
    } finally { solids.delete(); }
    props = new ocAny.GProp_GProps_1();
    ocAny.BRepGProp.VolumeProperties_1(shape, props, 1e-6, true, false);
    const volumeMm3 = props.Mass();
    if (!Number.isFinite(volumeMm3) || volumeMm3 <= 0) {
      throw new Error("A positive closed-solid volume is required for physical mass properties.");
    }
    com = props.CentreOfMass();
    const comLocal: [number, number, number] = [com.X(), com.Y(), com.Z()];
    if (comLocal.some((v) => !Number.isFinite(v))) throw new Error("Centre of mass is not finite.");
    matrix = props.MatrixOfInertia();
    const densityKgPerMm3 = density * 1e-6;
    const tensor = [1, 2, 3].map((i) => [1, 2, 3].map((j) => matrix.Value(i, j) * densityKgPerMm3)) as Matrix3;
    const { moments, frame } = principalInertia(tensor);
    const massKg = volumeMm3 * densityKgPerMm3;
    if (!Number.isFinite(massKg) || massKg <= 0) throw new Error("Physical mass is not finite and positive.");
    return { volumeMm3, massKg, comLocal, principalInertiaKgMm2: moments, principalInertiaLocalFrame: frame };
  } finally {
    for (const object of [matrix, com, props]) {
      try { object?.delete?.(); } catch { /* preserve the original integration error */ }
    }
  }
}
