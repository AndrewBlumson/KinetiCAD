// Only adapt the message endpoint; execute the unchanged production search worker.
import { parentPort } from 'node:worker_threads';
if (!parentPort) throw new Error('Run the search adapter in a worker thread.');
globalThis.self = globalThis;
globalThis.postMessage = data => parentPort.postMessage(data);
parentPort.on('message', data => globalThis.onmessage({ data }));
await import('../../src/mechanisms/fourBarSearchWorker.ts');
parentPort.postMessage({ __searchReady: true });
