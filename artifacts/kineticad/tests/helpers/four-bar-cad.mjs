import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildFourBarAssembly } from '../../src/mechanisms/fourBarAssembly.ts';
import { validateFourBarParams } from '../../src/mechanisms/fourBarKinematics.ts';
import { loadGeometryKernel, rebuildPart, validateSolid } from '../../../../scripts/src/verify-demo-geometry.mjs';
import { computeMassProperties } from '../../src/cad/operations/massProperties.ts';
import { tessellateShape } from '../../src/cad/operations/tessellate.ts';
import { getMaterial } from '../../src/cad/materials.ts';

const sha = data => createHash('sha256').update(data).digest('hex');
const sources = ['../../src/mechanisms/fourBarAssembly.ts', '../../src/mechanisms/fourBarKinematics.ts',
  '../../src/cad/operations/sketchToWire.ts', '../../src/cad/operations/extrude.ts', '../../src/cad/operations/boolean.ts',
  '../../src/cad/operations/massProperties.ts', '../../src/cad/operations/tessellate.ts', '../../src/cad/materials.ts'];
export const fourBarCadSourceSha256 = sha(sources.map(path => readFileSync(new URL(path, import.meta.url), 'utf8')).join('\n'));
const params = (d, a, b, c, trace) => ({ groundLengthMm: d, crankLengthMm: a, couplerLengthMm: b, rockerLengthMm: c,
  couplerPointLocalMm: trace, branch: 1, originMm: [0, 0], rotationDeg: 0, initialCrankAngleDeg: 0, rpm: 10 });
export const fourBarCadCases = [
  params(100, 25, 90, 70, [45, 20]),
  params(60, 15, 45, 45, [22.5, -20]),
  params(60, 38, 63, 63, [78.75, 31.5]),
  params(160, 50, 180, 150, [-45, -90]),
  params(148, 15, 35, 130, [43.75, 17.5]),
  params(160, 50, 200, 200, [100, 0]),
  { ...params(159.01929026673065, 24.26480983371903, 103.5498359491352, 89.41157211703141, [-17.12415147579941, 34.15661157457768]), originMm: [-22.44104890927602, -29.333506801167974], rotationDeg: -94.59023978725699 },
];
let kernel;
export const getFourBarCadKernel = () => kernel ??= loadGeometryKernel();
export async function loadFourBarCad(input, { keepShapes = false } = {}) {
  const params = validateFourBarParams(input), assembly = buildFourBarAssembly(params);
  // Geometry is independent of branch, placement, initial angle and motor
  // speed. Include all local feature histories and materials in the cache key.
  const geometry = assembly.parts.map(p => ({ id: p.id, sketches: p.sketches, features: p.features, materialId: p.materialId }));
  const filename = join(tmpdir(), `kineticad-four-bar-${sha(fourBarCadSourceSha256 + JSON.stringify(geometry))}.json`);
  if (!keepShapes && existsSync(filename)) {
    const result = JSON.parse(readFileSync(filename, 'utf8'));
    if (result.sourceSha256 === fourBarCadSourceSha256 && JSON.stringify(result.geometry) === JSON.stringify(geometry)) {
      return { ...result, params, assembly, descriptors: result.descriptors.map((d, i) => ({ ...d, transform: assembly.parts[i].transform })) };
    }
  }
  const oc = await getFourBarCadKernel(), shapes = [], descriptors = [], solids = [];
  let transferred = false;
  try {
    for (const part of assembly.parts) {
      const shape = rebuildPart(oc, part); shapes.push(shape);
      const validity = validateSolid(oc, shape); solids.push({ id: part.id, ...validity });
      if (!validity.valid || validity.solids !== 1 || !(validity.volumeMm3 > 0)) throw new Error(`${part.name}: not one valid positive solid (${JSON.stringify(validity)}).`);
      const props = computeMassProperties(oc, shape, getMaterial(part.materialId).densityGcm3);
      const mesh = tessellateShape(oc, shape);
      descriptors.push({ id: part.id, transform: part.transform, meshPositions: [...mesh.positions], meshIndices: [...mesh.indices],
        massKg: props.massKg, comLocal: props.comLocal, principalInertiaKgMm2: props.principalInertiaKgMm2,
        principalInertiaLocalFrame: props.principalInertiaLocalFrame, isGround: part.id === assembly.groundPartId });
    }
    const result = { schemaVersion: 1, sourceSha256: fourBarCadSourceSha256, geometry, params, assembly, descriptors, solids };
    writeFileSync(filename, JSON.stringify(result));
    if (keepShapes) { transferred = true; return { ...result, shapes, oc }; }
    return result;
  } finally { if (!transferred) shapes.forEach(shape => shape.delete()); }
}
