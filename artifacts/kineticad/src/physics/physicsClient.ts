// Main-thread client for the Physics Web Worker. Mirrors cadClient.ts.
//
// The physics kernel (Rapier) is heavy and synchronous once initialised,
// so we host it in a dedicated worker. This module memoises a single
// worker instance per page and returns the typed Comlink remote.

import * as Comlink from "comlink";
import PhysicsWorker from "./physicsWorker?worker";
import type { PhysicsApi, PhysicsInitResult } from "./types";

let kernelPromise: Promise<Comlink.Remote<PhysicsApi>> | null = null;
let kernelMeta: PhysicsInitResult | null = null;

export function getPhysicsKernel(): Promise<Comlink.Remote<PhysicsApi>> {
  if (kernelPromise) return kernelPromise;

  kernelPromise = (async () => {
    const worker = new PhysicsWorker();
    const api = Comlink.wrap<PhysicsApi>(worker);
    const meta = await api.init();
    kernelMeta = meta;
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.info(
        `[PHYSICS] Ready in ${meta.initTimeMs}ms (rapier3d-compat ${meta.version})`,
      );
    }
    return api;
  })();

  return kernelPromise;
}

export function getPhysicsMeta(): PhysicsInitResult | null {
  return kernelMeta;
}
