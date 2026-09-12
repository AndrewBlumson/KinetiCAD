import { sampleFourBarPath, solveFourBarLocal, validateFourBarParams, type FourBarParams, type Point2 } from './fourBarKinematics.ts';
export type { Point2, FourBarParams } from './fourBarKinematics.ts';
export const FOUR_BAR_ALGORITHM_VERSION = 1 as const;
export type FourBarDesign = { kind: 'four-bar-path'; version: 1; targetPathMm: Point2[]; params: FourBarParams;
  search: { algorithmVersion: 1; seed: number } };
export type FourBarConfig = FourBarDesign;
export type FourBarFit = { rmsMm: number; maxGapMm: number; symmetricMaxGapMm: number; sampleCount: number };
export type FourBarSearchBest = { params: FourBarParams; predictedPathMm: Point2[]; rmsMm: number; maxGapMm: number };
export type FourBarSearchProgress = { evaluations: number; totalEvaluations: number; best: FourBarSearchBest | null };
export type FourBarSearchResult = { design: FourBarDesign; fit: FourBarFit; predictedPathMm: Point2[]; evaluations: number };
export const FOUR_BAR_SEARCH_BUDGET = Object.freeze({ populationSize: 64, generations: 128 });
const TAU = 2 * Math.PI;
const hypot = (a: Point2, b: Point2) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const orient = (a: Point2, b: Point2, c: Point2) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);

/** Deliberately explicit closure: callers must preview/accept their closing segment. */
export function validateTargetPath(value: unknown): Point2[] {
  if (!Array.isArray(value) || value.length < 4 || value.length > 513) throw new Error('A closed target needs 3–512 vertices plus its repeated starting point.');
  const path: Point2[] = [];
  for (const q of value) {
    if (!Array.isArray(q) || q.length !== 2 || q.some(v => typeof v !== 'number' || !Number.isFinite(v) || Math.abs(v) > 1000)) throw new Error('Target coordinates must be finite and within ±1000 mm.');
    const point: Point2 = [q[0], q[1]];
    if (!path.length || hypot(point, path[path.length - 1]) > 1e-8) path.push(point);
  }
  if (path.length < 4 || hypot(path[0], path[path.length - 1]) > 1e-7) throw new Error('Close the target loop before searching.');
  path[path.length - 1] = [...path[0]];
  const xs = path.map(p => p[0]), ys = path.map(p => p[1]);
  const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  const perimeter = path.slice(1).reduce((s, p, i) => s + hypot(p, path[i]), 0);
  const area2 = path.slice(1).reduce((s, p, i) => s + path[i][0] * p[1] - p[0] * path[i][1], 0);
  if (span < 10 || span > 500 || perimeter < 25 || perimeter > 2000 || Math.abs(area2) < 2) throw new Error('Target must enclose at least 1 mm², span 10–500 mm and have a 25–2000 mm perimeter.');
  const eps = 1e-10 * Math.max(1, span * span), n = path.length - 1;
  const within = (a: Point2, b: Point2, p: Point2) => p[0] >= Math.min(a[0], b[0]) - 1e-8 && p[0] <= Math.max(a[0], b[0]) + 1e-8 && p[1] >= Math.min(a[1], b[1]) - 1e-8 && p[1] <= Math.max(a[1], b[1]) + 1e-8;
  for (let i = 0; i < n; i++) {
    const prev = path[(i + n - 1) % n], a = path[i], b = path[i + 1];
    if (Math.abs(orient(prev, a, b)) <= eps && (a[0] - prev[0]) * (b[0] - a[0]) + (a[1] - prev[1]) * (b[1] - a[1]) < 0) throw new Error('Target segments must not double back over one another.');
    for (let j = i + 1; j < n; j++) {
      if (j === i + 1 || (i === 0 && j === n - 1)) continue;
      const c = path[j], d = path[j + 1], o1 = orient(a, b, c), o2 = orient(a, b, d), o3 = orient(c, d, a), o4 = orient(c, d, b);
      if (((o1 > eps && o2 < -eps || o1 < -eps && o2 > eps) && (o3 > eps && o4 < -eps || o3 < -eps && o4 > eps))
        || Math.abs(o1) <= eps && within(a, b, c) || Math.abs(o2) <= eps && within(a, b, d)
        || Math.abs(o3) <= eps && within(c, d, a) || Math.abs(o4) <= eps && within(c, d, b)) throw new Error('Target must be one loop without crossings or nonadjacent touching segments.');
    }
  }
  return path;
}

export function scaleTargetPath(value: unknown, widthMm: number): Point2[] {
  const p = validateTargetPath(value);
  if (!Number.isFinite(widthMm) || widthMm < 40 || widthMm > 160) throw new Error('Target width must be 40–160 mm.');
  const xs = p.map(q => q[0]), ys = p.map(q => q[1]), minX = Math.min(...xs), maxX = Math.max(...xs);
  const scale = widthMm / (maxX - minX), cx = (minX + maxX) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  return validateTargetPath(p.map(q => [(q[0] - cx) * scale, (q[1] - cy) * scale]));
}

export function validateFourBarDesign(value: unknown): FourBarDesign {
  if (!value || typeof value !== 'object') throw new Error('Four-bar design is missing.');
  const d = value as FourBarDesign;
  if (d.kind !== 'four-bar-path' || d.version !== 1 || d.search?.algorithmVersion !== 1 || !Number.isInteger(d.search.seed) || d.search.seed < 0 || d.search.seed > 0xffffffff) throw new Error('Unsupported four-bar design or search version/seed.');
  return { kind: 'four-bar-path', version: 1, targetPathMm: validateTargetPath(d.targetPathMm), params: validateFourBarParams(d.params), search: { algorithmVersion: 1, seed: d.search.seed } };
}

/** Arc-length samples exclude the duplicate endpoint. Input may be any closed prediction. */
export function resampleClosedPath(path: Point2[], count: number): Point2[] {
  if (!Number.isInteger(count) || count < 3 || count > 4096 || path.length < 4 || hypot(path[0], path[path.length - 1]) > 1e-7) throw new Error('Closed resampling requires a closed polyline and 3–4096 samples.');
  const distances = [0];
  for (let i = 1; i < path.length; i++) distances.push(distances[i - 1] + hypot(path[i], path[i - 1]));
  const length = distances[distances.length - 1];
  if (!Number.isFinite(length) || length <= 1e-8) throw new Error('Cannot sample a zero-length or nonfinite path.');
  const out: Point2[] = []; let j = 1;
  for (let i = 0; i < count; i++) {
    const x = length * i / count;
    while (j < path.length - 1 && distances[j] < x) j++;
    const f = (x - distances[j - 1]) / Math.max(1e-30, distances[j] - distances[j - 1]);
    out.push([path[j - 1][0] + f * (path[j][0] - path[j - 1][0]), path[j - 1][1] + f * (path[j][1] - path[j - 1][1])]);
  }
  return out;
}

type Cloud = { p: Point2[]; centred: Point2[]; centre: Point2; norm: number };
function cloud(p: Point2[]): Cloud {
  const centre: Point2 = [p.reduce((s, q) => s + q[0], 0) / p.length, p.reduce((s, q) => s + q[1], 0) / p.length];
  const centred = p.map(q => [q[0] - centre[0], q[1] - centre[1]] as Point2);
  return { p, centred, centre, norm: centred.reduce((s, q) => s + q[0] ** 2 + q[1] ** 2, 0) };
}
type Alignment = { rms: number; shift: number; direction: 1 | -1; scale: number; angle: number; origin: Point2 };
function align(source: Cloud, target: Cloud, minScale: number, maxScale: number): Alignment {
  const n = source.p.length; let bestSse = Infinity, shift = 0, direction: 1 | -1 = 1, scale = 1, angle = 0;
  for (const dir of [1, -1] as const) for (let k = 0; k < n; k++) {
    let dot = 0, cross = 0;
    for (let i = 0; i < n; i++) {
      const p = source.centred[i], q = target.centred[(k + dir * i + n) % n];
      dot += p[0] * q[0] + p[1] * q[1]; cross += p[0] * q[1] - p[1] * q[0];
    }
    const correlation = Math.hypot(dot, cross), s = Math.max(minScale, Math.min(maxScale, correlation / source.norm));
    const sse = Math.max(0, s * s * source.norm + target.norm - 2 * s * correlation);
    if (sse < bestSse) { bestSse = sse; shift = k; direction = dir; scale = s; angle = Math.atan2(cross, dot); }
  }
  const co = Math.cos(angle), si = Math.sin(angle);
  return { rms: Math.sqrt(bestSse / n), shift, direction, scale, angle,
    origin: [target.centre[0] - scale * (co * source.centre[0] - si * source.centre[1]), target.centre[1] - scale * (si * source.centre[0] + co * source.centre[1])] };
}

/** Fixed-placement, complete-cycle score: cyclic start/direction can change; shape cannot. */
export function scoreFourBarPath(params: FourBarParams, targetPath: Point2[], sampleCount = 256): FourBarFit {
  const target = resampleClosedPath(validateTargetPath(targetPath), sampleCount), curve = sampleFourBarPath(params, 2048), prediction = resampleClosedPath(curve, sampleCount);
  let bestSse = Infinity, maxGapMm = Infinity;
  for (const dir of [1, -1]) for (let k = 0; k < sampleCount; k++) {
    // Free starting point is continuous along the sampled target, not rounded
    // to a vertex. One global phase is shared by all samples (no order cheating).
    let numerator = 0, denominator = 0;
    for (let i = 0; i < sampleCount; i++) {
      const j = (k + dir * i + sampleCount) % sampleCount, a = target[j], b = target[(j + 1) % sampleCount];
      const vx = b[0] - a[0], vy = b[1] - a[1];
      numerator += (prediction[i][0] - a[0]) * vx + (prediction[i][1] - a[1]) * vy; denominator += vx * vx + vy * vy;
    }
    const fraction = Math.max(0, Math.min(1, numerator / Math.max(1e-30, denominator)));
    let sse = 0, max = 0;
    for (let i = 0; i < sampleCount; i++) {
      const j = (k + dir * i + sampleCount) % sampleCount, a = target[j], b = target[(j + 1) % sampleCount];
      const distance = Math.hypot(prediction[i][0] - a[0] - fraction * (b[0] - a[0]), prediction[i][1] - a[1] - fraction * (b[1] - a[1]));
      sse += distance * distance; max = Math.max(max, distance);
    }
    if (sse < bestSse) { bestSse = sse; maxGapMm = max; }
  }
  const pointSegment = (p: Point2, a: Point2, b: Point2) => {
    const x = b[0] - a[0], y = b[1] - a[1], f = Math.max(0, Math.min(1, ((p[0] - a[0]) * x + (p[1] - a[1]) * y) / Math.max(1e-30, x * x + y * y)));
    return Math.hypot(p[0] - a[0] - f * x, p[1] - a[1] - f * y);
  };
  const directional = (points: Point2[], segments: Point2[]) => points.reduce((max, p) => Math.max(max, segments.slice(1).reduce((min, q, j) => Math.min(min, pointSegment(p, segments[j], q)), Infinity)), 0);
  return { rmsMm: Math.sqrt(bestSse / sampleCount), maxGapMm,
    symmetricMaxGapMm: Math.max(directional(prediction, targetPath), directional(target, curve)), sampleCount };
}

const RAW_PRESETS: { id: string; title: string; description: string; params: FourBarParams }[] = [
  { id: 'offset-tracer', title: 'Offset tracer', description: 'A known four-bar path with a tracer above the coupler.', params: makeParams(100, 25, 95, 80, 55, 30) },
  { id: 'long-coupler', title: 'Long coupler', description: 'A known four-bar path with an extended connecting link.', params: makeParams(100, 30, 105, 75, 70, -25) },
  { id: 'compact-linkage', title: 'Compact linkage', description: 'A known four-bar path from a compact crank and rocker.', params: makeParams(90, 20, 90, 65, 35, 15) },
];
function makeParams(d: number, a: number, b: number, c: number, u: number, v: number): FourBarParams {
  return { groundLengthMm: d, crankLengthMm: a, couplerLengthMm: b, rockerLengthMm: c, couplerPointLocalMm: [u, v], branch: 1, originMm: [0, 0], rotationDeg: 0, initialCrankAngleDeg: 0, rpm: 10 };
}
export const FOUR_BAR_PRESETS: { id: string; title: string; description: string; targetPathMm: Point2[]; knownParams?: FourBarParams }[] = RAW_PRESETS.map(preset => {
  const raw = sampleFourBarPath(preset.params), xs = raw.map(q => q[0]), ys = raw.map(q => q[1]), cx = (Math.max(...xs) + Math.min(...xs)) / 2, cy = (Math.max(...ys) + Math.min(...ys)) / 2;
  const s = 60 / (Math.max(...xs) - Math.min(...xs)), p = preset.params;
  const knownParams = validateFourBarParams({ ...p, groundLengthMm: p.groundLengthMm * s, crankLengthMm: p.crankLengthMm * s, couplerLengthMm: p.couplerLengthMm * s, rockerLengthMm: p.rockerLengthMm * s, couplerPointLocalMm: p.couplerPointLocalMm.map(v => v * s), originMm: [-cx * s, -cy * s] });
  return { id: preset.id, title: preset.title, description: preset.description, knownParams, targetPathMm: validateTargetPath(sampleFourBarPath(knownParams)) };
});
const ellipse: Point2[] = Array.from({ length: 256 }, (_, i) => [30 * Math.cos(TAU * i / 256), 20 * Math.sin(TAU * i / 256)]);
ellipse.push([...ellipse[0]]);
FOUR_BAR_PRESETS.push({ id: 'ellipse', title: 'Ellipse', description: 'A requested shape to approximate; no exact four-bar solution is promised.', targetPathMm: validateTargetPath(ellipse) });

type Genome = number[];
type Candidate = { genes: Genome; best: FourBarSearchBest; score: number };
const BOUNDS = [[0.12, 0.6], [0.35, 2.8], [0.35, 2.8], [-0.25, 1.25], [-0.5, 0.5], [-1, 1]];
function evaluate(genes: Genome, target: Cloud): Candidate | null {
  const [a, b, c, uRatio, vRatio, sign] = genes, u = b * uRatio, v = b * vRatio, branch = sign >= 0 ? 1 : -1;
  const shortestMargin = Math.min(1, b, c) - a, triangleMargin = Math.min(1 - a - Math.abs(b - c), b + c - 1 - a);
  const maxCos = Math.max(Math.abs((b * b + c * c - (1 - a) ** 2) / (2 * b * c)), Math.abs((b * b + c * c - (1 + a) ** 2) / (2 * b * c)));
  if (shortestMargin <= 0 || triangleMargin <= 0 || maxCos > Math.cos(Math.PI / 9)) return null;
  const markerDistance = Math.min(Math.hypot(u, v), Math.hypot(u - b, v));
  const minScale = Math.max(60, 15 / a, 35 / b, 35 / c, 22 / (1 - a), 2 / shortestMargin, 2 / triangleMargin, 6 / markerDistance);
  const maxScale = Math.min(160, 50 / a, 200 / b, 200 / c);
  if (!Number.isFinite(minScale) || minScale > maxScale) return null;
  const path: Point2[] = [];
  for (let i = 0; i < 256; i++) path.push(solveFourBarLocal(1, a, b, c, u, v, branch, TAU * i / 256).P);
  path.push([...path[0]]);
  const source = cloud(resampleClosedPath(path, target.p.length));
  if (source.norm < 1e-12) return null;
  const fit = align(source, target, minScale, maxScale), s = fit.scale;
  const params = makeParams(s, a * s, b * s, c * s, u * s, v * s);
  params.branch = branch; params.originMm = fit.origin; params.rotationDeg = fit.angle * 180 / Math.PI;
  if (fit.origin.some(v => Math.abs(v) > 1000)) return null;
  const co = Math.cos(fit.angle), si = Math.sin(fit.angle), transform = (q: Point2): Point2 => [fit.origin[0] + s * (co * q[0] - si * q[1]), fit.origin[1] + s * (si * q[0] + co * q[1])];
  const predictedPathMm = path.map(transform);
  const maxGapMm = source.p.reduce((max, q, i) => Math.max(max, hypot(transform(q), target.p[(fit.shift + fit.direction * i + target.p.length) % target.p.length])), 0);
  return { genes: [...genes], score: fit.rms, best: { params, predictedPathMm, rmsMm: fit.rms, maxGapMm } };
}

/** Deterministic seeded DE; fixed evaluation budget, no optimum/exact-fit guarantee. */
export async function searchFourBarPath(request: { targetPathMm: Point2[]; seed?: number; populationSize?: number; generations?: number },
  options: { onProgress?: (p: FourBarSearchProgress) => void; yieldControl?: () => Promise<void>; isCancelled?: () => boolean } = {}): Promise<FourBarSearchResult> {
  const targetPathMm = validateTargetPath(request.targetPathMm), seed = request.seed ?? 20260912;
  const populationSize = request.populationSize ?? FOUR_BAR_SEARCH_BUDGET.populationSize, generations = request.generations ?? FOUR_BAR_SEARCH_BUDGET.generations;
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff || !Number.isInteger(populationSize) || populationSize < 16 || populationSize > 96 || !Number.isInteger(generations) || generations < 1 || generations > 240) throw new Error('Search requires a uint32 seed, 16–96 candidates and 1–240 generations.');
  let rng = seed >>> 0;
  const random = () => { rng = (rng + 0x6d2b79f5) | 0; let t = Math.imul(rng ^ rng >>> 15, 1 | rng); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const target = cloud(resampleClosedPath(targetPathMm, 64)), totalEvaluations = populationSize * (generations + 1);
  let evaluations = 0, best: Candidate | null = null;
  const assess = (g: Genome) => { evaluations++; const candidate = evaluate(g, target); if (candidate && (!best || candidate.score < best.score)) best = candidate; return candidate; };
  const seedGenes = RAW_PRESETS.map(({ params: p }) => [p.crankLengthMm / p.groundLengthMm, p.couplerLengthMm / p.groundLengthMm, p.rockerLengthMm / p.groundLengthMm, p.couplerPointLocalMm[0] / p.couplerLengthMm, p.couplerPointLocalMm[1] / p.couplerLengthMm, p.branch]);
  const population: { genes: Genome; candidate: Candidate | null }[] = [];
  for (let i = 0; i < populationSize; i++) {
    const genes = i < seedGenes.length * 2 ? [...seedGenes[i % seedGenes.length]] : [0.15 + random() * 0.3, 0.6 + random(), 0.45 + random(), -0.2 + random() * 1.4, random() - 0.5, random() < 0.5 ? -1 : 1];
    if (i >= seedGenes.length && i < seedGenes.length * 2) genes[5] = -1;
    population.push({ genes, candidate: assess(genes) });
  }
  const progress = async () => { if (options.isCancelled?.()) throw new Error('Search cancelled.'); options.onProgress?.({ evaluations, totalEvaluations, best: best?.best ?? null }); await options.yieldControl?.(); };
  await progress();
  for (let generation = 0; generation < generations; generation++) {
    for (let i = 0; i < populationSize; i++) {
      const indices: number[] = [];
      while (indices.length < 3) { const k = Math.floor(random() * populationSize); if (k !== i && !indices.includes(k)) indices.push(k); }
      const forced = Math.floor(random() * 6), [x, y, z] = indices.map(k => population[k].genes);
      const genes = population[i].genes.map((old, j) => {
        if (j !== forced && random() >= 0.9) return old;
        return Math.max(BOUNDS[j][0], Math.min(BOUNDS[j][1], x[j] + 0.7 * (y[j] - z[j])));
      });
      const candidate = assess(genes);
      if (candidate && (!population[i].candidate || candidate.score <= population[i].candidate!.score)) population[i] = { genes, candidate };
    }
    await progress();
  }
  if (!best) throw new Error('No feasible linkage was found within the search budget. Try a different target or width.');
  const winner = best as Candidate;
  const params = validateFourBarParams(winner.best.params), fit = scoreFourBarPath(params, targetPathMm);
  const design = validateFourBarDesign({ kind: 'four-bar-path', version: 1, params, targetPathMm, search: { algorithmVersion: 1, seed } });
  return { design, fit, predictedPathMm: sampleFourBarPath(params, 512), evaluations };
}
