import { useEffect, useRef, useState } from 'react';
import { wrap } from 'comlink';
import type { BenchRequest, BenchSnapshot, EngineeringBenchApi } from '@/physics/engineeringBenchWorker';
import { createBenchElapsedClock } from '@/physics/benchElapsedClock';

export function useEngineeringBench(request: BenchRequest) {
  const [snapshot, setSnapshot] = useState<BenchSnapshot>();
  const [history, setHistory] = useState<BenchSnapshot[]>([]);
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const playing = useRef(false), replay = useRef(false);
  const clock = useRef<ReturnType<typeof createBenchElapsedClock> | undefined>(undefined);
  useEffect(() => {
    let active = true, frame = 0, pending = 0, inFlight = false;
    const elapsedClock = createBenchElapsedClock(); clock.current = elapsedClock;
    let held: BenchSnapshot | undefined;
    const worker = new Worker(new URL('../../physics/engineeringBenchWorker.ts', import.meta.url), { type: 'module' });
    const api = wrap<EngineeringBenchApi>(worker);
    setSnapshot(undefined); setHistory([]); setBusy(true); setError('');
    playing.current = false; setRunning(false);
    const publish = (result: BenchSnapshot) => {
      setSnapshot(result);
      if (result.dtMs > 0) setHistory(rows => rows.length
        ? [rows[0], ...rows.slice(1).slice(-598), result] : [result]);
      if (result.completed) { playing.current = false; elapsedClock.setRunning(false); setRunning(false); }
    };
    const fail = (reason: unknown) => {
      if (!active) return;
      playing.current = false; elapsedClock.setRunning(false); setRunning(false); setBusy(false);
      setError(reason instanceof Error ? reason.message : String(reason));
    };
    const tick = (now: number) => {
      if (!active) return;
      frame = requestAnimationFrame(tick);
      const elapsed = elapsedClock.advance(now);
      if (!playing.current) return;
      if (held) { publish(held); held = undefined; if (!playing.current) return; }
      pending += elapsed;
      if (inFlight || pending <= 0) return;
      const elapsedMs = pending; pending = 0; inFlight = true;
      void api.step(elapsedMs).then(result => {
        if (!active) return;
        if (playing.current) publish(result); else held = result;
      }).catch(fail).finally(() => { inFlight = false; });
    };
    worker.onerror = event => fail(event.message || 'The experiment worker stopped.');
    void api.build(request).then(result => {
      if (!active) return;
      publish(result); setHistory([result]); setBusy(false);
      if (replay.current) { replay.current = false; playing.current = true; elapsedClock.setRunning(true); setRunning(true); }
      frame = requestAnimationFrame(tick);
    }).catch(fail);
    return () => { active = false; elapsedClock.setRunning(false); cancelAnimationFrame(frame); worker.terminate(); };
  }, [request, revision]);
  return { snapshot, history, running, busy, error,
    toggle() {
      if (busy || error) return;
      if (snapshot?.completed) { replay.current = true; setRevision(n => n + 1); }
      else { playing.current = !playing.current; clock.current?.setRunning(playing.current); setRunning(playing.current); }
    },
    reset() { playing.current = false; clock.current?.setRunning(false); replay.current = false; setRevision(n => n + 1); },
  };
}
