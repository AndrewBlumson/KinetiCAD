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

    // Bridge worker-side `[SELF-TEST]` results to the main-thread console.
    // Chrome's default DevTools filter hides worker console output from the
    // page console, so the kernel boot smoke-test was invisible to QA. We
    // re-emit it on the main thread (always at error level so it survives
    // the default filter) before handing the worker over to Comlink.
    //
    // We keep the listener registered for the worker's lifetime — Comlink
    // ignores messages it doesn't recognise (no `id` field), so this won't
    // interfere with the RPC channel.
    worker.addEventListener("message", (e: MessageEvent) => {
      const data = e.data as { type?: string; ok?: boolean; message?: string };
      if (data && data.type === "self-test") {
        // eslint-disable-next-line no-console
        console.error(data.message ?? "[SELF-TEST] (no message)");
      }
    });

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
