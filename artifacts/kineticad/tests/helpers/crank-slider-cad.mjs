import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildCrankSliderAssembly, validateCrankSliderParams } from '../../src/mechanisms/crankSlider.ts';
import { loadGeometryKernel, rebuildPart, validateSolid } from '../../../../scripts/src/verify-demo-geometry.mjs';
import { computeMassProperties } from '../../src/cad/operations/massProperties.ts';
import { tessellateShape } from '../../src/cad/operations/tessellate.ts';
import { getMaterial } from '../../src/cad/materials.ts';

const sha = data => createHash('sha256').update(data).digest('hex');
const sources = ['../../src/mechanisms/crankSlider.ts', '../../src/cad/operations/sketchToWire.ts', '../../src/cad/operations/extrude.ts', '../../src/cad/operations/boolean.ts', '../../src/cad/operations/massProperties.ts', '../../src/cad/operations/tessellate.ts', '../../src/cad/materials.ts'];
export const crankSliderCadSourceSha256 = sha(sources.map(path => readFileSync(new URL(path, import.meta.url), 'utf8')).join('\n'));
export const crankSliderCadCases = [
  { radiusMm: 25, rodLengthMm: 100, rpm: 15 },
  { radiusMm: 15, rodLengthMm: 75, rpm: 30 },
  { radiusMm: 25, rodLengthMm: 75, rpm: 30 },
  { radiusMm: 40, rodLengthMm: 120, rpm: 30 },
  { radiusMm: 40, rodLengthMm: 180, rpm: 30 },
  { radiusMm: 15, rodLengthMm: 180, rpm: 30 },
];
let kernel;
export const getCrankSliderCadKernel = () => kernel ??= loadGeometryKernel();
export async function loadCrankSliderCad(input, { keepShapes = false } = {}) {
  const params = validateCrankSliderParams(input), assembly = buildCrankSliderAssembly(params);
  const sourceSha256 = crankSliderCadSourceSha256;
  const filename = join(tmpdir(), `kineticad-crank-slider-${sha(sourceSha256 + JSON.stringify(params))}.json`);
  if (!keepShapes && existsSync(filename)) {
    const result = JSON.parse(readFileSync(filename, 'utf8'));
    if (result.sourceSha256 === sourceSha256 && JSON.stringify(result.assembly) === JSON.stringify(assembly)) return result;
  }
  const oc = await getCrankSliderCadKernel(), shapes = [], descriptors = [], solids = [];
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
    const result = { schemaVersion: 1, sourceSha256, params, assembly, descriptors, solids };
    writeFileSync(filename, JSON.stringify(result));
    return keepShapes ? { ...result, shapes, oc } : result;
  } finally { if (!keepShapes) shapes.forEach(shape => shape.delete()); }
}
