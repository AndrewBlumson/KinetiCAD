/** Wall time earned while a bench is playing. A new run/resume starts at its
 * first animation frame, so a backgrounded paused tab cannot accrue work. */
export function createBenchElapsedClock() {
  let running = false;
  let previous: number | undefined;
  return {
    setRunning(next: boolean) {
      if (next !== running) previous = undefined;
      running = next;
    },
    advance(now: number): number {
      if (!Number.isFinite(now)) throw new Error('Animation timestamp must be finite.');
      if (!running) { previous = undefined; return 0; }
      const elapsed = previous === undefined ? 0 : Math.max(0, now - previous);
      previous = now;
      return elapsed;
    },
  };
}
