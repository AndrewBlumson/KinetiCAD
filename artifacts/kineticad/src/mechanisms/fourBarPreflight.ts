import type { Remote } from 'comlink';
import type { CadKernelApi } from '../cad/types';
import type { DemoDocument } from '../demos/demoDocument';
import { regeneratePartTip } from '../features/featureRegen';
import { getVolumeData, massPropertiesForMaterial } from '../features/volumeCache';
import { getMaterial } from '../cad/materials';

/** Warm and validate the same complete B-rep meshes used by the renderer and
 * simulator. The caller commits only after this whole transaction succeeds. */
export async function preflightFourBarDocument(document: DemoDocument, kernel: Remote<CadKernelApi>, assertCurrent: () => void) {
  assertCurrent();
  for (const part of document.state.assembly.parts) {
    const result = await regeneratePartTip(part, kernel);
    assertCurrent();
    const mesh = result.mesh;
    if (result.error || !mesh || !result.hash || mesh.positions.length < 9 || mesh.positions.length % 3 !== 0
      || mesh.indices.length < 3 || mesh.indices.length % 3 !== 0 || !mesh.positions.every(Number.isFinite)
      || !mesh.indices.every(index => Number.isInteger(index) && index >= 0 && index < mesh.positions.length / 3)) {
      throw new Error(`${part.name}: ${result.error || 'the CAD kernel did not produce a valid solid mesh.'}`);
    }
    if (mesh.solidCount !== 1) throw new Error(`${part.name}: the linkage requires one connected solid per part.`);
    const volume = getVolumeData(result.hash);
    if (!volume) throw new Error(`${part.name}: exact solid mass properties are missing.`);
    massPropertiesForMaterial(volume, getMaterial(part.materialId).densityGcm3);
  }
  assertCurrent();
}
