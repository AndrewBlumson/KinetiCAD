// Main-thread client for the CAD Web Worker. Wraps Comlink in a typed
// singleton so any view can call `await getCadKernel()` and get the same
// initialised kernel back.

import * as Comlink from "comlink";
import CadWorker from "./cadWorker?worker";
import type { CadKernelApi, KernelInitResult } from "./types";

let kernelPromise: Promise<Comlink.Remote<CadKernelApi>> | null = null;
let kernelMeta: KernelInitResult | null = null;

export function getCadKernel(): Promise<Comlink.Remote<CadKernelApi>> {
  if (kernelPromise) return kernelPromise;

  kernelPromise = (async () => {
    const worker = new CadWorker();
    const api = Comlink.wrap<CadKernelApi>(worker);
    const meta = await api.init();
    kernelMeta = meta;
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.info(
        `[KERNEL] Ready in ${meta.initTimeMs}ms (opencascade.js ${meta.version})`,
      );
    }
    return api;
  })();

  return kernelPromise;
}

export function getKernelMeta(): KernelInitResult | null {
  return kernelMeta;
}
