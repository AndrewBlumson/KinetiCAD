import type { Assembly, BooleanFeature, Part } from './schemas.ts';
import { MATERIALS } from '../cad/materials.ts';

/** Result IDs occupy a separate namespace; input part IDs are never remapped. */
export function booleanBodyId(featureId: string): string {
  return `boolean:${featureId}`;
}

/** A mixed-material union/intersection needs an explicit homogeneous material. */
export function resolveBooleanMaterialId(
  feature: BooleanFeature,
  parts: readonly Part[],
): string | undefined {
  if (feature.materialId !== undefined) {
    return MATERIALS[feature.materialId] ? feature.materialId : undefined;
  }
  const inputs = feature.inputPartIds.map(id => parts.find(part => part.id === id));
  if (inputs.length < 2 || inputs.some(part => !part)) return undefined;
  if (feature.operation.type === 'subtract') {
    const toolId = feature.operation.toolPartId;
    if (inputs.length !== 2 || !feature.inputPartIds.includes(toolId)) return undefined;
    const retained = inputs.find(part => part!.id !== toolId);
    return retained && MATERIALS[retained.materialId] ? retained.materialId : undefined;
  }
  const materialId = inputs[0]!.materialId;
  return MATERIALS[materialId] && inputs.every(part => part!.materialId === materialId)
    ? materialId : undefined;
}

/**
 * Synthetic results have world-baked geometry and therefore an identity frame.
 * An empty materialId means unresolved material, never implicit aluminium.
 * Geometry validity/connected-solid count is checked by the CAD/physics path.
 */
export function getAssemblyBody(assembly: Assembly, id: string | null | undefined): Part | undefined {
  if (!id) return undefined;
  const native = assembly.parts.find(part => part.id === id);
  if (native) return native;
  const feature = assembly.booleanFeatures.find(value => booleanBodyId(value.id) === id);
  if (!feature) return undefined;
  return {
    id,
    name: feature.resultPartName,
    visible: true,
    materialId: resolveBooleanMaterialId(feature, assembly.parts) ?? '',
    transform: { positionMm: [0, 0, 0], rotationDeg: [0, 0, 0] },
    sketches: [],
    features: [],
  };
}

export function getAssemblyBodyName(assembly: Assembly, id: string | null | undefined): string | undefined {
  return getAssemblyBody(assembly, id)?.name;
}

/** Keep the legacy native-only default; Boolean assemblies require an explicit anchor. */
export function getEffectiveGroundBodyId(assembly: Assembly): string {
  return assembly.groundPartId || ((assembly.booleanFeatures?.length ?? 0) === 0 ? assembly.parts[0]?.id ?? '' : '');
}
