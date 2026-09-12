/// <reference lib="webworker" />
import { searchFourBarPath } from './fourBarSynthesis.ts';

/** Each UI search owns a worker; terminate it to cancel without accepting stale output. */
let started = false;
self.onmessage = async (event: MessageEvent) => {
  const message = event.data;
  if (!message || message.type !== 'start' || started) return;
  started = true;
  const requestId = message.requestId;
  try {
    if (typeof requestId !== 'string' && typeof requestId !== 'number') throw new Error('Search request id is missing.');
    const result = await searchFourBarPath({ targetPathMm: message.targetPathMm, seed: message.seed }, {
      onProgress: progress => self.postMessage({ type: 'progress', requestId, ...progress }),
      yieldControl: () => new Promise(resolve => setTimeout(resolve, 0)),
    });
    self.postMessage({ type: 'result', requestId, result });
  } catch (error) {
    self.postMessage({ type: 'error', requestId, message: error instanceof Error ? error.message : String(error) });
  }
};
