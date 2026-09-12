import type { Assembly } from '../state/schemas';
import { booleanBodyId, resolveBooleanMaterialId, getEffectiveGroundBodyId } from '../state/assemblyBodies';
import { computeBooleanHash } from '../features/assemblyRegen';

/** Inputs remain editable construction geometry, never extra physical bodies. */
export function planAssemblySimulation(assembly: Assembly) {
  const features = assembly.booleanFeatures ?? [];
  const consumed = new Set<string>();
  const booleans = features.map(feature => {
    for (const input of feature.inputPartIds) {
      if (consumed.has(input)) throw new Error(`${feature.resultPartName}: an input also belongs to another Boolean result. Use separate input parts for each physical result.`);
      consumed.add(input);
    }
    const materialId = resolveBooleanMaterialId(feature, assembly.parts);
    if (!materialId) throw new Error(`${feature.resultPartName}: choose a finished solid material in the Boolean editor. Different input materials cannot be averaged.`);
    return { feature, id: booleanBodyId(feature.id), materialId, hash: computeBooleanHash(feature, assembly.parts) };
  });
  const parts = assembly.parts.filter(p => p.visible && p.features.length > 0 && !consumed.has(p.id));
  const ids = new Set([...parts.map(p => p.id), ...booleans.map(b => b.id)]);
  if (ids.size !== parts.length + booleans.length) throw new Error('Native and Boolean body IDs collide.');
  const groundId = getEffectiveGroundBodyId(assembly) || undefined;
  if (features.length && groundId && !ids.has(groundId)) {
    throw new Error('The fixed base is a hidden or consumed input. Open the Boolean result, choose “Fix result to world” or leave it free, then Apply.');
  }
  for (const mate of assembly.mates) {
    if (features.length && (!ids.has(mate.partA) || !ids.has(mate.partB))) {
      throw new Error(`${mate.name ?? mate.type}: a joint refers to a hidden or consumed input. Delete it and attach a new joint to the finished result.`);
    }
    for (const result of booleans) {
      if ((mate.partA === result.id || mate.partB === result.id) && mate.booleanGeometryHashes?.[result.id] !== result.hash) {
        throw new Error(`${mate.name ?? mate.type}: ${result.feature.resultPartName} has changed since its joint was attached. Delete this joint and pick its attachments again.`);
      }
    }
  }
  return { parts, booleans, consumed, groundId };
}

/** Ignore derived display readouts and live motor commands, but retain geometry,
 * materials, joint anchors, topology revisions, visibility and ground choices. */
export function assemblyPhysicsSignature(assembly: Assembly): string {
  return JSON.stringify({
    parts: assembly.parts.map(p => ({ id: p.id, visible: p.visible, transform: p.transform,
      features: p.features, sketches: p.sketches, materialId: p.materialId })),
    booleans: assembly.booleanFeatures ?? [], ground: assembly.groundPartId,
    mates: assembly.mates.map(m => {
      const { motorSpeedRpm, motorVelocityMmPerSec, ...structure } = m as typeof m & { motorSpeedRpm?: number; motorVelocityMmPerSec?: number };
      return structure;
    }),
  });
}
