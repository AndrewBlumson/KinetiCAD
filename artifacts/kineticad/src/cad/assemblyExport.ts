import type { AssemblyExportArgs, ExportPartDescriptor } from './types';
import type { BooleanFeature } from '@/state/schemas';

export type AssemblyExportPlan = {
  partsById: Map<string, ExportPartDescriptor>;
  visiblePartIds: string[];
  booleans: Array<{ feature: BooleanFeature; orderedInputIds: string[] }>;
};

/** Match committed Scene visibility. Editor overlays are never export geometry. */
export function planAssemblyExport(args: AssemblyExportArgs): AssemblyExportPlan {
  const { parts, booleanFeatures } = Array.isArray(args)
    ? { parts: args, booleanFeatures: [] }
    : args;
  const partsById = new Map<string, ExportPartDescriptor>();
  for (const part of parts) {
    if (partsById.has(part.partId)) throw new Error(`assembly-export-failed: duplicate part ${part.partId}.`);
    partsById.set(part.partId, part);
  }
  const hiddenInputs = new Set<string>();
  const booleanIds = new Set<string>();
  const booleans = booleanFeatures.map((feature) => {
    const label = feature.resultPartName || feature.id;
    if (booleanIds.has(feature.id)) throw new Error(`assembly-export-failed: duplicate Boolean ${label}.`);
    booleanIds.add(feature.id);
    const ids = feature.inputPartIds;
    if (ids.length < 2 || ids.length > 8 || new Set(ids).size !== ids.length) {
      throw new Error(`assembly-export-failed: Boolean "${label}" needs 2–8 distinct input parts.`);
    }
    for (const id of ids) {
      const part = partsById.get(id);
      if (!part || part.features.length === 0) throw new Error(`assembly-export-failed: Boolean "${label}" needs missing or empty part ${id}.`);
      if (feature.hideInputs) hiddenInputs.add(id);
    }
    let orderedInputIds = [...ids];
    if (feature.operation.type === 'subtract') {
      const tool = feature.operation.toolPartId;
      if (ids.length !== 2 || !ids.includes(tool)) throw new Error(`assembly-export-failed: Boolean "${label}" needs one body and a selected cutter.`);
      orderedInputIds = [ids.find((id) => id !== tool)!, tool];
    } else if (feature.operation.type !== 'union' && feature.operation.type !== 'intersect') {
      throw new Error(`assembly-export-failed: Boolean "${label}" has an unsupported operation.`);
    }
    return { feature, orderedInputIds };
  });
  return {
    partsById,
    visiblePartIds: parts.filter((part) => part.visible !== false && part.features.length > 0 && !hiddenInputs.has(part.partId)).map((part) => part.partId),
    booleans,
  };
}
