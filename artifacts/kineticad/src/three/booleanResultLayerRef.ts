import type { BooleanResultLayer } from './BooleanResultLayer';
import { getPartMeshLayer } from './partMeshLayerRef';

let layer: BooleanResultLayer | null = null;

/** Scene owns publication and clears the reference before disposal. */
export function setBooleanResultLayer(value: BooleanResultLayer | null): void {
  layer = value;
}

export function getBooleanResultLayer(): BooleanResultLayer | null {
  return layer;
}

/** Native and result topology share local-body coordinates and stable IDs. */
export function getAssemblyBodyTopology(id: string) {
  return getPartMeshLayer()?.getPartTopology(id) ?? layer?.getPartTopology(id) ?? null;
}

export function getAssemblyBodyMesh(id: string) {
  return getPartMeshLayer()?.getPartMesh(id) ?? layer?.getPartMesh(id) ?? null;
}

/** Capture the geometry that was actually picked, never a later Apply revision. */
export function captureBooleanGeometryHash(
  pickedBodyId: string,
  previous: Record<string, string> | undefined,
): Record<string, string> | undefined {
  if (!pickedBodyId.startsWith('boolean:')) return previous;
  const hash = layer?.getGeometryHash(pickedBodyId);
  if (!hash || !layer?.getPartTopology(pickedBodyId)) {
    throw new Error('Pick a ready Boolean result containing one connected solid.');
  }
  return { ...previous, [pickedBodyId]: hash };
}
