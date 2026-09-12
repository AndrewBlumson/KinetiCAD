import type { Remote } from 'comlink';
import type { CadKernelApi, TessellatedMesh } from '../cad/types';
import type { Mate, MatePivot, Sketch, SketchPrimitive } from '../state/schemas';
import { useKinetiCADStore } from '../state/store';
import { regeneratePartTip } from '../features/featureRegen';
import { computePartChainHash, regenerateBoolean } from '../features/assemblyRegen';
import { validateSketchDimensions } from './sketchDimensions';
import { sketchEditAssemblySignature, sketchEditPrimitivesSignature } from './sketchEditSource';

function cancelled(signal?: AbortSignal) {
  if (signal?.aborted) throw new Error('The dimensions edit was cancelled.');
}

function validMesh(mesh: TessellatedMesh | null): mesh is TessellatedMesh {
  return !!mesh && mesh.positions.length >= 9 && mesh.positions.length % 3 === 0
    && mesh.indices.length >= 3 && mesh.indices.length % 3 === 0
    && mesh.positions.every(Number.isFinite)
    && mesh.indices.every(index => index < mesh.positions.length / 3);
}

// This is a conservative comparison, not topology remapping. Changing or
// re-tessellating a referenced face may be rejected even if a human could
// establish a new valid attachment. No joint is silently moved or removed.
function pivotGeometry(mesh: TessellatedMesh, pivot: Pick<MatePivot, 'kind'> & { edgeId?: string; faceId?: string }): string | null {
  if (pivot.kind === 'edge') {
    const edge = mesh.edges.find(item => item.id === pivot.edgeId);
    if (!edge) return null;
    return JSON.stringify({ ...edge, polyline: Array.from(edge.polyline) });
  }
  const face = mesh.faces.find(item => item.id === pivot.faceId);
  if (!face) return null;
  const triangles = Array.from(face.triangles, triangle => {
    const vertices = [0, 1, 2].map(corner => {
      const vertex = mesh.indices[triangle * 3 + corner];
      return JSON.stringify(Array.from(mesh.positions.slice(vertex * 3, vertex * 3 + 3)));
    });
    return vertices.sort().join('|');
  }).sort();
  return JSON.stringify({ ...face, triangles });
}

function assertMateGeometry(mates: Mate[], partId: string, before: TessellatedMesh, after: TessellatedMesh) {
  for (const mate of mates) {
    if (mate.type === 'fixed') continue;
    const pivot = mate.partA === partId ? mate.pivotA : mate.partB === partId ? mate.pivotB : null;
    if (!pivot) continue;
    const original = pivotGeometry(before, pivot);
    const updated = pivotGeometry(after, pivot);
    if (!original || !updated || original !== updated) {
      throw new Error(`Joint "${mate.name || mate.id}" refers to geometry that these dimensions change or cannot preserve. Its anchor has not been moved. Edit or remove that joint before changing this sketch.`);
    }
  }
}

/** Validate without touching the committed model, then publish exactly once.
 * The original Sketch object is an optimistic identity captured when Edit
 * dimensions opens. Abort the signal when that editor cancels or unmounts. */
export async function applySketchDimensions(
  partId: string,
  sketchId: string,
  primitives: SketchPrimitive[],
  expectedSource: Sketch,
  kernel: Remote<CadKernelApi>,
  signal?: AbortSignal,
): Promise<void> {
  cancelled(signal);
  validateSketchDimensions(primitives);
  const state = useKinetiCADStore.getState();
  const signature = sketchEditAssemblySignature(state.assembly);
  const assertCurrent = () => {
    cancelled(signal);
    const current = useKinetiCADStore.getState();
    if (!current.sketchDimensionsEditing || current.mode !== 'modeller' || current.simulation.running
      || current.sketchSession.active || current.featureEditor.open || current.booleanEditor.open || current.mateEditor.open) {
      throw new Error('Finish other edits and reset the simulation before applying sketch dimensions.');
    }
    if (current.assembly.parts.find(part => part.id === partId)?.sketches.find(sketch => sketch.id === sketchId) !== expectedSource
      || sketchEditAssemblySignature(current.assembly) !== signature) {
      throw new Error('The model changed while checking these dimensions. Reopen the sketch and try again.');
    }
  };
  assertCurrent();
  const part = state.assembly.parts.find(item => item.id === partId)!;
  const nextPrimitives = structuredClone(primitives);
  if (sketchEditPrimitivesSignature(expectedSource.primitives) === sketchEditPrimitivesSignature(nextPrimitives)) {
    useKinetiCADStore.getState().updateSketch(partId, sketchId, nextPrimitives, expectedSource, signature);
    return;
  }
  const candidate = { ...part, sketches: part.sketches.map(sketch =>
    sketch.id === sketchId ? { ...sketch, primitives: nextPrimitives } : sketch) };
  if (candidate.features.length > 0) {
    const result = await regeneratePartTip(candidate, kernel);
    assertCurrent();
    if (result.error || !validMesh(result.mesh)) throw new Error(`Cannot apply dimensions: ${result.error || 'the feature history produced no valid solid mesh.'}`);
    const geometricMates = state.assembly.mates.filter(mate => mate.type !== 'fixed' && (mate.partA === partId || mate.partB === partId));
    if (geometricMates.length && computePartChainHash(part) !== result.hash) {
      const original = await regeneratePartTip(part, kernel);
      assertCurrent();
      if (original.error || !validMesh(original.mesh)) throw new Error('The current joint geometry could not be checked. The sketch has not changed.');
      assertMateGeometry(geometricMates, partId, original.mesh, result.mesh);
    }
  }
  const candidateParts = state.assembly.parts.map(item => item.id === partId ? candidate : item);
  for (const feature of state.assembly.booleanFeatures.filter(item => item.inputPartIds.includes(partId))) {
    const result = await regenerateBoolean(feature, candidateParts, kernel);
    assertCurrent();
    if (result.error || !validMesh(result.mesh)) throw new Error(`Cannot apply dimensions: Boolean "${feature.resultPartName}" failed: ${result.error || 'no valid solid mesh was produced.'}`);
  }
  assertCurrent();
  useKinetiCADStore.getState().updateSketch(partId, sketchId, nextPrimitives, expectedSource, signature);
}
