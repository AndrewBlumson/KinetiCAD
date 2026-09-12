import type { CadKernelApi, ImportedPart, TessellatedMesh } from '../cad/types';
import { getImportedShapeMesh, setImportedShapeMesh } from '../cad/importedShapeCache';
import { MAX_PROJECT_BYTES, encodeBytes, parseProjectDocument, parseProjectState, sha256, shapeIdForAsset, validateAssetBytes, type ProjectDocument, type ProjectState, type StepAsset } from './projectDocument';

type Kernel = Pick<CadKernelApi, 'importStep' | 'exportAssemblyStep'>;
const assetsByShape = new Map<string, { asset: StepAsset; index: number }>();
const loadedAssets = new Set<string>();
export function registerProjectAsset(asset: StepAsset, parts: ImportedPart[]) {
  parts.forEach((p, index) => {
    assetsByShape.set(p.shapeId, { asset, index });
    setImportedShapeMesh(p.shapeId, p.tessellated);
  });
  loadedAssets.add(asset.id);
}
export function clearProjectAssetMemory() { assetsByShape.clear(); loadedAssets.clear(); }

export async function meshFingerprint(mesh: TessellatedMesh): Promise<string> {
  const positions = new Uint8Array(mesh.positions.buffer, mesh.positions.byteOffset, mesh.positions.byteLength);
  const indices = new Uint8Array(mesh.indices.buffer, mesh.indices.byteOffset, mesh.indices.byteLength);
  const joined = new Uint8Array(positions.length + indices.length);
  joined.set(positions); joined.set(indices, positions.length);
  return sha256(joined);
}

export async function importDurableStep(kernel: Kernel, bytes: Uint8Array, fileName: string, preserveCoordinates = false) {
  const digest = await sha256(bytes);
  const id = `${digest}-${preserveCoordinates ? 'local' : 'ground'}`;
  const parts = await kernel.importStep(bytes, fileName, { assetId: id, preserveCoordinates });
  if (!parts.length) throw new Error('No geometry found in the STEP file.');
  const asset: StepAsset = { id, sha256: digest, fileName, data: encodeBytes(bytes), preserveCoordinates,
    bodies: await Promise.all(parts.map(async (p) => ({ meshSha256: await meshFingerprint(p.tessellated), min: p.boundingBox.min, max: p.boundingBox.max }))),
  };
  registerProjectAsset(asset, parts);
  return { asset, parts };
}

/** Rebuild and validate all assets before a caller may expose any new state. */
export async function restoreProjectAssets(document: ProjectDocument, kernel: Kernel) {
  // Check every checksum first: a corrupt later asset cannot start any import.
  const bytes = await Promise.all(document.assets.map(validateAssetBytes));
  const staged: { asset: StepAsset; parts: ImportedPart[] }[] = [];
  for (let i = 0; i < document.assets.length; i++) {
    const asset = document.assets[i];
    const cached = assetsByShape.get(shapeIdForAsset(asset, 0))?.asset;
    if (loadedAssets.has(asset.id) && JSON.stringify(cached) === JSON.stringify(asset)
      && asset.bodies.every((_, j) => getImportedShapeMesh(shapeIdForAsset(asset, j)))) continue;
    const parts = await kernel.importStep(bytes[i], asset.fileName, { assetId: asset.id, preserveCoordinates: asset.preserveCoordinates });
    if (parts.length !== asset.bodies.length) throw new Error(`${asset.fileName}: restored body count differs from the saved project.`);
    for (let j = 0; j < parts.length; j++) {
      const expected = asset.bodies[j], actual = parts[j];
      if (actual.shapeId !== shapeIdForAsset(asset, j) || await meshFingerprint(actual.tessellated) !== expected.meshSha256
        || expected.min.some((v, axis) => Math.abs(v - actual.boundingBox.min[axis]) > 1e-5)
        || expected.max.some((v, axis) => Math.abs(v - actual.boundingBox.max[axis]) > 1e-5)) {
        throw new Error(`${asset.fileName}: body ${j + 1} does not match its saved geometry. A changed CAD kernel or tessellation format can cause this; re-import the original STEP file if using a newer app version. The current project is unchanged.`);
      }
    }
    staged.push({ asset, parts });
  }
  for (const { asset, parts } of staged) registerProjectAsset(asset, parts);
}

/** Capture immutable state now; asynchronous migration cannot follow later edits. */
export async function createProjectDocument(state: ProjectState, getKernel: () => Promise<Kernel>): Promise<ProjectDocument> {
  // Zustand's live object also contains actions and renderer/editor state.
  // Select the durable fields before cloning; functions are not cloneable.
  const copy = parseProjectState(structuredClone({ mode: state.mode, assembly: state.assembly, simulation: state.simulation }));
  const required = new Map<string, StepAsset>();
  for (const part of copy.assembly.parts) for (const f of part.features) {
    if (f.type !== 'imported-step') continue;
    let entry = assetsByShape.get(f.shapeId);
    if (!entry) {
      // Upgrade an import that still exists in a pre-durable live worker. The
      // isolated imported feature is exported in local coordinates; downstream
      // feature history and the part transform remain in the native document.
      const kernel = await getKernel();
      const bytes = await kernel.exportAssemblyStep([{ partId: part.id, sketches: [], features: [f], transform: { positionMm: [0, 0, 0], rotationDeg: [0, 0, 0] } }]);
      const imported = await importDurableStep(kernel, bytes, `${part.name}.step`, true);
      if (imported.parts.length !== 1) throw new Error(`${part.name}: legacy imported body could not be packaged without changing its identity.`);
      entry = { asset: imported.asset, index: 0 };
      assetsByShape.set(f.shapeId, entry);
    }
    f.shapeId = shapeIdForAsset(entry.asset, entry.index);
    required.set(entry.asset.id, entry.asset);
  }
  const document = parseProjectDocument({ format: 'kineticad-project', version: 1, stateVersion: 9, state: copy, assets: [...required.values()] });
  if (JSON.stringify(document).length > MAX_PROJECT_BYTES) throw new Error('The complete project exceeds 100 MB. Remove unused imported parts or split the project before saving.');
  return document;
}
