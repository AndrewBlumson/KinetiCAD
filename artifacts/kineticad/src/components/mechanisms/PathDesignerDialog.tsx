import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, Loader2, PencilLine, RotateCcw, Square, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { CommittedNumberInput } from '@/components/ui/committed-number-input';
import type { Point2 } from '@/mechanisms/fourBarKinematics';
import {
  FOUR_BAR_PRESETS, scaleTargetPath, validateTargetPath, validateFourBarDesign, type FourBarDesign,
  type FourBarSearchProgress as Progress, type FourBarSearchResult as SearchResult,
} from '@/mechanisms/fourBarSynthesis';
import { PathDrawing } from './PathDrawing';

export type PathDesignerDialogProps = {
  open: boolean;
  onClose: () => void;
  onBuild: (design: FourBarDesign) => void | Promise<void>;
  initialDesign?: FourBarDesign;
};

type SearchMessage =
  | ({ type: 'progress'; requestId: number } & Progress)
  | { type: 'result'; requestId: number; result: SearchResult }
  | { type: 'error'; requestId: number; message: string };

const button = 'inline-flex items-center justify-center gap-2 rounded-md border border-slate-700 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 disabled:cursor-not-allowed disabled:opacity-40';
const primary = `${button} border-orange-500 bg-orange-500 text-white hover:bg-orange-600`;
const inputClass = 'mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-orange-400 disabled:opacity-40';
const samePoint = (a: Point2, b: Point2) => Math.hypot(a[0] - b[0], a[1] - b[1]) <= 1e-7;
const pointText = (points: readonly Point2[]) => points.map(p => `${Number(p[0].toFixed(6))}, ${Number(p[1].toFixed(6))}`).join('\n');
const pathWidth = (points: readonly Point2[]) => points.length ? Math.max(...points.map(p => p[0])) - Math.min(...points.map(p => p[0])) : 0;
const closedCopy = (points: readonly Point2[]): Point2[] => {
  const copy = points.map(p => [p[0], p[1]] as Point2);
  if (copy.length && !samePoint(copy[0], copy.at(-1)!)) copy.push([...copy[0]] as Point2);
  return copy;
};

/** Search is draft-only. Only an explicit, completed onBuild may replace the
 * parent's CAD workspace. Worker termination and request IDs guard every exit. */
export function PathDesignerDialog({ open, onClose, onBuild, initialDesign }: PathDesignerDialogProps) {
  const [target, setTarget] = useState<Point2[]>([]);
  const [pendingStroke, setPendingStroke] = useState<Point2[]>([]);
  const [widthMm, setWidthMm] = useState(60);
  const [presetId, setPresetId] = useState('');
  const [pointsDraft, setPointsDraft] = useState('');
  const [pointsDirty, setPointsDirty] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [progress, setProgress] = useState<Progress | null>(null);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [building, setBuilding] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const workerRef = useRef<Worker | null>(null);
  const requestId = useRef(0);
  const seed = useRef(20260912);
  const mounted = useRef(true);
  const openRef = useRef(open);
  const buildRef = useRef(false);
  const wasOpen = useRef(false);
  openRef.current = open;

  function stopWorker() {
    requestId.current += 1;
    workerRef.current?.terminate();
    workerRef.current = null;
  }

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      requestId.current += 1;
      workerRef.current?.terminate();
    };
  }, []);

  useEffect(() => {
    if (!open) {
      stopWorker();
      setSearching(false);
      wasOpen.current = false;
      return;
    }
    if (wasOpen.current) return;
    wasOpen.current = true;
    setError(''); setNotice(''); setProgress(null); setResult(null); setPendingStroke([]); setPointsDirty(false);
    setSearching(false); setBuilding(false); setElapsedSeconds(0);
    buildRef.current = false;
    try {
      const existing = initialDesign ? validateFourBarDesign(initialDesign) : undefined;
      const firstPreset = FOUR_BAR_PRESETS[0];
      const initial = existing?.targetPathMm ?? firstPreset?.targetPathMm ?? [];
      const width = existing ? Math.min(160, Math.max(40, pathWidth(initial))) : 60;
      // Reopening an existing design is not a width/placement edit. Preserve
      // its exact target; only explicit drawing/preset/width actions rescale it.
      const points = existing ? existing.targetPathMm.map(p => [...p] as Point2)
        : initial.length ? scaleTargetPath(validateTargetPath(initial), width) : [];
      setTarget(points); setPointsDraft(pointText(points)); setWidthMm(width);
      setPresetId(existing ? '' : firstPreset?.id ?? '');
      seed.current = existing?.search.seed ?? 20260912;
      if (existing) setNotice('Your saved path is loaded. Search again to find or compare a mechanism.');
    } catch (cause) {
      setTarget([]); setPointsDraft(''); setPresetId(''); setWidthMm(60);
      setError(cause instanceof Error ? cause.message : 'This saved path could not be opened.');
    }
  }, [open, initialDesign]);

  useEffect(() => {
    if (!searching) return;
    const began = performance.now();
    setElapsedSeconds(0);
    const timer = window.setInterval(() => setElapsedSeconds((performance.now() - began) / 1000), 250);
    return () => window.clearInterval(timer);
  }, [searching]);

  function invalidateResult() {
    stopWorker();
    setSearching(false); setResult(null); setProgress(null); setError(''); setNotice('');
  }

  function acceptPath(raw: readonly Point2[], source: string, requestedWidth = widthMm): boolean {
    try {
      const next = scaleTargetPath(validateTargetPath(raw), requestedWidth);
      invalidateResult();
      setTarget(next); setPendingStroke([]); setPointsDraft(pointText(next)); setPointsDirty(false); setPresetId(source);
      setWidthMm(requestedWidth);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'This loop could not be used. Try a simpler shape.');
      return false;
    }
  }

  function drawn(points: Point2[]) {
    if (building) return;
    invalidateResult();
    if (points.length < 3 || pathWidth(points) < 1) {
      setError('Draw a larger loop, finishing near the point where you started.');
      return;
    }
    setPendingStroke(points);
    const gap = Math.hypot(points[0][0] - points.at(-1)![0], points[0][1] - points.at(-1)![1]);
    if (gap <= Math.max(1, pathWidth(points) * .06)) {
      if (acceptPath(closedCopy(points), '')) setNotice(`Loop centred and scaled to ${widthMm} mm wide.`);
    } else {
      setNotice('Your drawing has a gap. The amber line shows how Close loop will join the ends.');
    }
  }

  function search() {
    if (buildRef.current || searching || pendingStroke.length || pointsDirty) return;
    let points: Point2[];
    try { points = validateTargetPath(target); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Draw a valid closed loop first.'); return; }
    stopWorker();
    const id = requestId.current;
    setError(''); setNotice(''); setProgress(null); setResult(null); setSearching(true);
    try {
      const worker = new Worker(new URL('../../mechanisms/fourBarSearchWorker.ts', import.meta.url), { type: 'module' });
      workerRef.current = worker;
      const current = () => mounted.current && openRef.current && requestId.current === id && workerRef.current === worker;
      worker.onmessage = (event: MessageEvent<SearchMessage>) => {
        const message = event.data;
        if (!current() || message.requestId !== id) return;
        if (message.type === 'progress') setProgress(message);
        else if (message.type === 'result') {
          try {
            validateFourBarDesign(message.result.design);
            if (![message.result.fit.rmsMm, message.result.fit.maxGapMm, message.result.fit.symmetricMaxGapMm].every(v => Number.isFinite(v) && v >= 0)) throw new Error('Search returned invalid fit measurements.');
            setResult(message.result); setProgress(null); setSearching(false);
            setNotice('Search finished. Review the gap before building your editable model.');
          } catch (cause) {
            setSearching(false); setError(cause instanceof Error ? cause.message : 'The result could not be checked.');
          }
          worker.terminate(); workerRef.current = null;
        } else if (message.type === 'error') {
          setSearching(false); setError(message.message); worker.terminate(); workerRef.current = null;
        }
      };
      worker.onerror = event => {
        if (!current()) return;
        setSearching(false); setError(event.message || 'The local search stopped unexpectedly. Your model is unchanged.');
        worker.terminate(); workerRef.current = null;
      };
      worker.onmessageerror = () => {
        if (!current()) return;
        setSearching(false); setError('The local search returned an unreadable result. Please try again.');
        worker.terminate(); workerRef.current = null;
      };
      worker.postMessage({ type: 'start', requestId: id, targetPathMm: points, seed: seed.current });
      seed.current = (seed.current + 104729) >>> 0;
    } catch (cause) {
      stopWorker(); setSearching(false);
      setError(cause instanceof Error ? cause.message : 'The local search could not start.');
    }
  }

  async function build() {
    if (!result || searching || buildRef.current || pointsDirty) return;
    buildRef.current = true; setBuilding(true); setError('');
    try {
      await onBuild(validateFourBarDesign(result.design));
      if (mounted.current && openRef.current) onClose();
    } catch (cause) {
      if (mounted.current && openRef.current) setError(cause instanceof Error ? cause.message : 'The CAD model could not be built. Your current project is unchanged.');
    } finally {
      buildRef.current = false;
      if (mounted.current) setBuilding(false);
    }
  }

  const candidate = result ? { predictedPathMm: result.predictedPathMm, rmsMm: result.fit.rmsMm, maxGapMm: result.fit.maxGapMm } : progress?.best;
  const locked = searching || building;
  const selectedPreset = FOUR_BAR_PRESETS.find(p => p.id === presetId);
  const validTarget = target.length > 3 && pendingStroke.length === 0 && !pointsDirty;

  return <Dialog open={open} onOpenChange={next => {
    if (next || buildRef.current) return;
    stopWorker(); setSearching(false); onClose();
  }}>
    <DialogContent className="flex h-[92vh] w-[calc(100vw-32px)] max-w-6xl flex-col gap-0 overflow-hidden border-slate-700 bg-[#0e1624] p-0 text-slate-100 [&>button:last-child]:hidden"
      onInteractOutside={event => event.preventDefault()}
      onEscapeKeyDown={event => { if (buildRef.current) event.preventDefault(); }}>
      <header className="shrink-0 border-b border-slate-700 px-6 py-4 pr-12">
        <DialogTitle className="flex items-center gap-2"><PencilLine size={20} className="text-orange-400" />Draw a path</DialogTitle>
        <DialogDescription className="mt-2 max-w-3xl text-slate-400">Draw a closed loop and find a simple four-bar linkage whose marked point follows it. Your current model stays unchanged until you build the result.</DialogDescription>
        <button type="button" aria-label="Close path designer" disabled={building} className="absolute right-4 top-4 rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 disabled:cursor-wait disabled:opacity-40" onClick={() => {
          if (buildRef.current) return;
          stopWorker(); setSearching(false); onClose();
        }}><X size={18} /></button>
      </header>
      <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto p-5 lg:grid-cols-[250px_minmax(0,1fr)]">
        <section className="space-y-4" aria-label="Path settings">
          <div><h2 className="text-sm font-semibold">1. Choose or draw a loop</h2><p className="mt-2 text-xs leading-relaxed text-slate-400">Drag once in the grid and finish near your starting point. The finished loop is centred and scaled to your chosen width.</p></div>
          <div className="grid grid-cols-2 gap-2" aria-label="Path presets">{FOUR_BAR_PRESETS.map(preset => <button type="button" key={preset.id} disabled={locked} aria-pressed={presetId === preset.id}
            onClick={() => acceptPath(preset.targetPathMm, preset.id)} className={`${button} min-w-0 w-full justify-start px-2 text-left ${presetId === preset.id ? 'border-teal-600 bg-teal-950/40' : ''}`}>
            <span className="min-w-0"><span className="block">{preset.title}</span><span className="mt-1 block text-[10px] font-normal text-slate-400">{preset.knownParams ? 'Known four-bar path' : 'Approximate fit target'}</span></span>
            {presetId === preset.id && <Check size={14} className="ml-auto shrink-0 text-teal-300" />}
          </button>)}</div>
          {selectedPreset && <p className="text-xs leading-relaxed text-slate-400">{selectedPreset.description}</p>}
          <label className="block text-xs">Path width (mm)
            <CommittedNumberInput label="Path width in millimetres" value={widthMm} min={40} max={160} step={5} disabled={locked || !!pendingStroke.length} className={inputClass}
              onCommit={value => { if (target.length) acceptPath(target, presetId, value); else { setWidthMm(value); invalidateResult(); } }} />
          </label>
          <p className="text-[11px] leading-relaxed text-slate-400">40–160 mm wide. Height scales in proportion; the drawing is not stretched.</p>
          <button type="button" disabled={locked} className={`${button} w-full`} onClick={() => {
            invalidateResult(); setTarget([]); setPendingStroke([]); setPointsDraft(''); setPointsDirty(false); setPresetId('');
          }}><RotateCcw size={13} />Clear drawing</button>
          <div className="border-t border-slate-700 pt-4">
            <h2 className="text-sm font-semibold">2. Find a mechanism</h2>
            <p className="my-2 text-xs leading-relaxed text-slate-400">Two pivots stay fixed. Three connected bars move, and a point on one bar traces a loop.</p>
            <p className="text-xs text-slate-300">Use Find a mechanism below when your loop is ready.</p>
          </div>
          <p className="text-[11px] leading-relaxed text-slate-400">Search runs locally without an AI service. It finds a nearby match within a supported linkage family; it cannot reproduce every drawing or guarantee the best possible mechanism.</p>
        </section>
        <section className="min-w-0 space-y-3" aria-label="Path and fit preview">
          <PathDrawing target={target} predicted={candidate?.predictedPathMm} pendingStroke={pendingStroke} widthMm={widthMm} disabled={locked}
            onBegin={invalidateResult} onDraw={drawn} onError={setError} />
          {!!pendingStroke.length && <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-amber-800/70 bg-amber-950/20 p-3 text-xs">
            <p className="max-w-md text-amber-200">Check the amber closing segment. A loop must not cross itself or retrace an edge.</p>
            <button type="button" className={button} disabled={locked} onClick={() => {
              if (acceptPath(closedCopy(pendingStroke), '')) setNotice(`Loop closed and scaled to ${widthMm} mm wide.`);
            }}>Close loop</button>
          </div>}
          {searching && <div role="status" aria-live="polite" className="rounded border border-slate-700 p-3 text-xs">
            <p className="flex flex-wrap items-center gap-2 text-orange-300"><Loader2 size={14} className="animate-spin" />Searching · {progress ? `${progress.evaluations.toLocaleString()} of ${progress.totalEvaluations.toLocaleString()} candidates checked` : 'Starting local search…'}<span aria-hidden="true">· {elapsedSeconds.toFixed(1)} s</span></p>
            {progress && progress.totalEvaluations > 0 && <progress value={progress.evaluations} max={progress.totalEvaluations} aria-label="Candidate search progress" className="mt-2 h-2 w-full accent-orange-500" />}
            <p className="mt-2 text-slate-400">Preview gaps are provisional. The completed result is checked with a denser curve.</p>
          </div>}
          {candidate && <div className="rounded border border-slate-700 p-3">
            <h2 className="text-sm font-semibold">{result ? 'Closest result found' : 'Best candidate so far'}</h2>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-xs tabular-nums">
              <div><dt className="text-slate-400">Typical path gap (RMS)</dt><dd className="mt-1 text-lg text-orange-300">{candidate.rmsMm.toFixed(3)} <span className="text-xs">mm</span></dd></div>
              <div><dt className="text-slate-400">Worst sampled path gap</dt><dd className="mt-1 text-lg text-orange-300">{candidate.maxGapMm.toFixed(3)} <span className="text-xs">mm</span></dd></div>
            </dl>
            <p className="mt-2 text-[11px] leading-relaxed text-slate-400">A smaller gap is a closer shape match. These are geometric predictions; run the built model to see the actual solver trace.</p>
            <details className="mt-2 text-[11px] text-slate-400"><summary className="cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400">How is the gap measured?</summary>
              <p className="mt-2 leading-relaxed">Points are compared at equal progress around each loop by distance, allowing a different start point and direction. RMS summarises those distances; the worst value is the largest sampled gap. This compares shape, not matching motion at the same time.</p>
              {result && <p className="mt-2">{result.fit.sampleCount} comparison samples. Independent two-way nearest-curve check: {result.fit.symmetricMaxGapMm.toFixed(3)} mm maximum. Sampling is not a continuous accuracy guarantee.</p>}
            </details>
          </div>}
          <details className="rounded border border-slate-700 p-3 text-xs">
            <summary className="cursor-pointer rounded font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400">Keyboard point editor</summary>
            <p id="path-points-help" className="my-2 leading-relaxed text-slate-400">Enter one X, Y pair per line in millimetres, walking around the outline. At least three different points; at most 512. The last point joins the first when you use the points. Presets also work entirely with the keyboard.</p>
            <label className="sr-only" htmlFor="path-point-list">Closed path coordinates</label>
            <textarea id="path-point-list" aria-describedby="path-points-help" disabled={locked} rows={5} value={pointsDraft} maxLength={30000}
              onChange={event => { invalidateResult(); setPointsDraft(event.target.value); setPointsDirty(true); }} className={`${inputClass} font-mono text-xs`} spellCheck={false} />
            <button type="button" className={`${button} mt-2`} disabled={locked} onClick={() => {
              try {
                const rows = pointsDraft.trim().split(/\n+/).filter(Boolean);
                if (rows.length < 3 || rows.length > 513) throw new Error('Enter 3–512 different points, with an optional repeated starting point.');
                const points = rows.map((row, i): Point2 => {
                  const fields = row.trim().split(/[\s,;]+/);
                  if (fields.length !== 2 || !fields.every(v => v.trim() && Number.isFinite(Number(v)))) throw new Error(`Line ${i + 1}: enter two finite numbers, X and Y.`);
                  return [Number(fields[0]), Number(fields[1])];
                });
                if (acceptPath(closedCopy(points), '')) setNotice(`Point list applied as a closed loop, ${widthMm} mm wide.`);
              } catch (cause) { setError(cause instanceof Error ? cause.message : 'The point list could not be read.'); }
            }}>Use points as closed loop</button>
            {pointsDirty && <><button type="button" className={`${button} ml-2 mt-2`} disabled={locked} onClick={() => {
              setPointsDraft(pointText(target)); setPointsDirty(false); setError('');
            }}>Discard point edits</button><p className="mt-2 text-[11px] text-amber-200">Use or discard these point edits before searching.</p></>}
          </details>
          {error && <p role="alert" className="rounded border border-orange-700 bg-orange-950/20 p-3 text-xs leading-relaxed text-orange-200">{error}</p>}
          {notice && !error && <p role="status" className="text-xs leading-relaxed text-slate-300">{notice}</p>}
        </section>
      </div>
      <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-700 px-5 py-3">
        <p className="max-w-sm text-[11px] leading-relaxed text-slate-400">Creates native editable parts and joints. Ideal rigid motion; no contact, bearing friction or motor-load rating. {building ? 'Preparing CAD. Please wait before closing.' : 'Search previews do not change your project.'}</p>
        <div className="flex flex-wrap items-center gap-2">
        {searching ? <button type="button" className={button} onClick={() => {
          stopWorker(); setSearching(false); setProgress(null); setNotice('Search cancelled. Your drawing and current model are unchanged.');
        }}><Square size={12} />Cancel search</button> : <button type="button" className={result ? button : primary} disabled={!validTarget || building} onClick={search}>
          {result ? 'Search again' : 'Find a mechanism'}<ArrowRight size={14} />
        </button>}
        <button type="button" className={primary} disabled={!result || locked || !!pendingStroke.length || pointsDirty} onClick={() => void build()}>
          {building ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}{building ? 'Building editable model…' : 'Build editable model'}
        </button>
        </div>
      </footer>
    </DialogContent>
  </Dialog>;
}
