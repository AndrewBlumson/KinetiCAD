// Only adapt the browser message endpoint; import the shipped worker intact.
import {parentPort} from 'node:worker_threads';
import nodeEndpoint from 'comlink/dist/esm/node-adapter.mjs';
if(!parentPort)throw new Error('Run this adapter in a worker thread.');
Object.assign(globalThis,nodeEndpoint(parentPort));
globalThis.self=globalThis;
await import('../../src/physics/engineeringBenchWorker.ts');
parentPort.postMessage({__benchReady:true});
