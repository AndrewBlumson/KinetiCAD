import { parentPort } from 'node:worker_threads';
import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import nodeEndpoint from 'comlink/dist/esm/node-adapter.mjs';
if (!parentPort) throw new Error('Run this adapter in a worker thread.');
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === 'opencascade.js/dist/opencascade.full.js') return { url: new URL('./cad-factory-node.mjs', import.meta.url).href, shortCircuit: true };
  if (specifier.startsWith('@/')) return { url: new URL(`../../src/${specifier.slice(2)}.ts`, import.meta.url).href, shortCircuit: true };
  if (specifier.startsWith('.') && context.parentURL?.includes('/src/')) {
    const candidate = new URL(`${specifier}.ts`, context.parentURL);
    if (existsSync(candidate)) return { url: candidate.href, shortCircuit: true };
  }
  return nextResolve(specifier, context);
} });
Object.assign(globalThis, nodeEndpoint(parentPort));
globalThis.self = globalThis;
console.log = console.info = console.debug = () => {};
await import('../../src/cad/cadWorker.ts');
