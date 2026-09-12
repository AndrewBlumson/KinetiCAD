import type { Remote } from 'comlink';
import type { BooleanBodyResult, CadKernelApi } from '@/cad/types';
import type { BooleanFeature, Part } from '@/state/schemas';
import { computeBooleanHash, createBooleanOpArgs } from './assemblyRegen';
import { getCacheGeneration } from './featureCache';

export type BooleanBodyRegenResult = BooleanBodyResult & {
  /** Full geometry/transform revision; independent of material and display name. */
  hash: string;
};

type BodyCache = {
  generation: number;
  settled: Map<string, BooleanBodyRegenResult>;
  pending: Map<string, Promise<BooleanBodyRegenResult>>;
};
const caches = new WeakMap<Remote<CadKernelApi>, BodyCache>();

/**
 * Prepare the finished connected solid, without mutating CAD state or inputs.
 * Mesh and exact unit-density physical properties use world coordinates and an
 * identity body pose. Material scaling is a caller operation, not a CAD rebuild.
 * Unlike the display mesh, this cache proves valid single-solid mass properties.
 */
export async function regenerateBooleanBody(
  feature: BooleanFeature,
  parts: ReadonlyArray<Part>,
  kernel: Remote<CadKernelApi>,
): Promise<BooleanBodyRegenResult> {
  const name = feature.resultPartName || feature.id;
  try {
    const args = createBooleanOpArgs(feature, parts);
    const hash = computeBooleanHash(feature, parts);
    const generation = getCacheGeneration();
    let cache = caches.get(kernel);
    if (!cache || cache.generation !== generation) {
      cache = { generation, settled: new Map(), pending: new Map() };
      caches.set(kernel, cache);
    }
    const cached = cache.settled.get(hash);
    if (cached) return cached;
    let operation = cache.pending.get(hash);
    if (!operation) {
      const owner = cache;
      operation = kernel.buildBooleanBody(args).then((body) => {
        const value = { ...body, hash };
        if (generation === getCacheGeneration() && caches.get(kernel) === owner) {
          owner.settled.set(hash, value);
        }
        return value;
      }).finally(() => { owner.pending.delete(hash); });
      cache.pending.set(hash, operation);
    }
    return await operation;
  } catch (error) {
    throw new Error(`Cannot simulate Boolean "${name}": ${error instanceof Error ? error.message : String(error)}`);
  }
}
