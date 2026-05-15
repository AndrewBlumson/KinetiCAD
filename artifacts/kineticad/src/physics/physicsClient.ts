// Main-thread client for the Physics Web Worker. Mirrors cadClient.ts.
//
// The physics kernel (Rapier) is heavy and synchronous once initialised,
// so we host it in a dedicated worker. This module memoises a single
// worker instance per page and returns the typed Comlink remote.

import * as Comlink from "comlink";
import PhysicsWorker from "./physicsWorker?worker";
import type { PhysicsApi, PhysicsInitResult } from "./types";

// HMR-safe singleton — see cadClient.ts for rationale.
const PHYSICS_KEY = "__kineticadPhysics__";
type PhysicsGlobal = typeof globalThis & {
  [PHYSICS_KEY]?: {
    promise: Promise<Comlink.Remote<PhysicsApi>> | null;
    meta: PhysicsInitResult | null;
  };
};
const g = globalThis as PhysicsGlobal;
if (!g[PHYSICS_KEY]) g[PHYSICS_KEY] = { promise: null, meta: null };
const slot = g[PHYSICS_KEY]!;

export function getPhysicsKernel(): Promise<Comlink.Remote<PhysicsApi>> {
  if (slot.promise) return slot.promise;

  slot.promise = (async () => {
    const worker = new PhysicsWorker();
    // Bridge worker console logs to the page console before handing the
    // worker to Comlink. See cadClient.ts for full rationale. 16/05/2026
    worker.addEventListener('message', (e: MessageEvent) => {
      const data = e.data as { __log?: boolean; level?: string; args?: unknown[] };
      if (data && data.__log === true) {
        const fn = (console as unknown as Record<string, unknown>)[data.level ?? 'log'];
        ((typeof fn === 'function' ? fn : console.log) as (...a: unknown[]) => void)(
          '[worker]', ...(data.args ?? []),
        );
      }
    });
    const api = Comlink.wrap<PhysicsApi>(worker);
    const meta = await api.init();
    slot.meta = meta;
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.info(
        `[PHYSICS] Ready in ${meta.initTimeMs}ms (rapier3d-compat ${meta.version})`,
      );
    }
    return api;
  })();

  return slot.promise;
}

export function getPhysicsMeta(): PhysicsInitResult | null {
  return slot.meta;
}
