// Adapt Node's MessagePort to the browser worker endpoint. The application
// physics module, Comlink RPC, and Rapier WASM are imported without rewriting.
import { parentPort } from 'node:worker_threads';
import nodeEndpoint from 'comlink/dist/esm/node-adapter.mjs';

if (!parentPort) throw new Error('Run this helper in a worker thread.');
Object.assign(globalThis, nodeEndpoint(parentPort));
globalThis.self = globalThis;
// Production diagnostics still travel through their existing __log bridge;
// avoid also printing every frame diagnostic to the test runner's stdout.
console.log = console.info = console.debug = () => {};
await import('../../src/physics/physicsWorker.ts');
