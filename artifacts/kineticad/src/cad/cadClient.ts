// Main-thread client for the CAD Web Worker. Wraps Comlink in a typed
// singleton so any view can call `await getCadKernel()` and get the same
// initialised kernel back.

import * as Comlink from "comlink";
import CadWorker from "./cadWorker?worker";
import type { CadKernelApi, KernelInitResult } from "./types";

// HMR-safe singleton. Vite replaces module instances on hot reload, which
// would null out a plain `let kernelPromise` and re-spawn the OCCT worker
// every time any file in the CAD chain edits — QA observed `[KERNEL] Ready`
// firing 5× per session. Stash the live promise on `globalThis` so it
// survives module replacement during dev. Production builds have no HMR,
// so the global is set exactly once.
const KERNEL_KEY = "__kineticadKernel__";
type KernelGlobal = typeof globalThis & {
  [KERNEL_KEY]?: {
    promise: Promise<Comlink.Remote<CadKernelApi>> | null;
    meta: KernelInitResult | null;
  };
};
const g = globalThis as KernelGlobal;
if (!g[KERNEL_KEY]) g[KERNEL_KEY] = { promise: null, meta: null };
const slot = g[KERNEL_KEY]!;

export function getCadKernel(): Promise<Comlink.Remote<CadKernelApi>> {
  if (slot.promise) return slot.promise;

  slot.promise = (async () => {
    const worker = new CadWorker();

    // Bridge worker console logs to the page console, and forward self-test
    // results. Production builds do not surface worker console output in the
    // page DevTools context; the __log envelope fixes that. Comlink ignores
    // messages that lack its RPC envelope shape (no `id` field), so both
    // discriminators are safe to inspect here. 16/05/2026
    worker.addEventListener("message", (e: MessageEvent) => {
      const data = e.data as {
        type?: string; ok?: boolean; message?: string;
        __log?: boolean; level?: string; args?: unknown[];
      };
      if (data && data.__log === true) {
        const fn = (console as unknown as Record<string, unknown>)[data.level ?? 'log'];
        ((typeof fn === 'function' ? fn : console.log) as (...a: unknown[]) => void)(
          '[worker]', ...(data.args ?? []),
        );
      } else if (data && data.type === "self-test") {
        // eslint-disable-next-line no-console
        console.error(data.message ?? "[SELF-TEST] (no message)");
      }
    });

    const api = Comlink.wrap<CadKernelApi>(worker);
    const meta = await api.init();
    slot.meta = meta;
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.info(
        `[KERNEL] Ready in ${meta.initTimeMs}ms (opencascade.js ${meta.version})`,
      );
    }
    return api;
  })();

  return slot.promise;
}

export function getKernelMeta(): KernelInitResult | null {
  return slot.meta;
}
