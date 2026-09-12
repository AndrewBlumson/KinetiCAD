import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowUpRight, Boxes, Loader2, RotateCcw, Settings2, Route } from 'lucide-react';
import { useLocation } from 'wouter';
import { useKinetiCADStore } from '@/state/store';
import { DEMOS } from '@/demos/catalog';
import { demoAssetUrl, parseDemoDocument } from '@/demos/demoDocument';
import { createDemoSession } from '@/demos/demoSession';
import { DemoGallery } from './DemoGallery';
import { DEFAULT_CRANK_SLIDER_PARAMS, type CrankSliderParams } from '@/mechanisms/crankSlider';
import { createCrankSliderDocument, matchesCrankSliderAssembly } from '@/mechanisms/crankSliderWorkspace';

import { PathDesignerDialog } from '../mechanisms/PathDesignerDialog';
import type { FourBarDesign } from '@/mechanisms/fourBarSynthesis';
import { createFourBarDocument } from '@/mechanisms/fourBarWorkspace';
import { preflightFourBarDocument } from '@/mechanisms/fourBarPreflight';
import { getCadKernel } from '@/cad/cadClient';
import { sketchEditAssemblySignature } from '@/sketch/sketchEditSource';

type Demo = (typeof DEMOS)[number];
type WorkspaceContext = {
  activeDemo: Demo | null;
  revision: number;
  openGallery: () => void;
  loadingId: string | null;
  setFileBusy: (busy: boolean) => void;
  editing: boolean;
  leaveDemo: () => void;
  resetDemo: () => void;
  openCrankSlider: () => void;
  openPathDesigner: () => void;
  applyCrankSlider: (params: CrankSliderParams) => void;
};
const crankSliderDemo: Demo = { id: 'crank-slider', title: 'Adjustable crank-slider', subtitle: 'Turning motion becomes straight motion',
  description: 'A powered crank drives a passive connecting rod and guided slider.', category: 'Mechanism', partCount: 4, jointCount: 4,
  highlights: ['Editable dimensions', 'Measured motion'], learningTip: 'Change the radius, rod length or speed, then compare the solver with the equations.', accent: '#ecab76' };
const fourBarDemo: Demo = { id: 'four-bar', title: 'Draw-a-path linkage', subtitle: 'Your drawing becomes a moving mechanism',
  description: 'One driven crank, a connecting bar and a passive rocker trace a closed path.', category: 'Mechanism', partCount: 4, jointCount: 4,
  highlights: ['Local search', 'Editable solids', 'Measured path'], learningTip: 'Compare the drawn target, calculated path and measured motion.', accent: '#ecab76' };
const DemoContext = createContext<WorkspaceContext | null>(null);
export function useDemoWorkspace() {
  const value = useContext(DemoContext);
  if (!value) throw new Error('Demo workspace is unavailable.');
  return value;
}

export function DemoWorkspaceProvider({ children }: { children: ReactNode }) {
  const [location, navigate] = useLocation();
  const [open, setOpen] = useState(false);
  const [pathDesignerOpen, setPathDesignerOpen] = useState(false);
  const [pathInitialDesign, setPathInitialDesign] = useState<FourBarDesign>();
  const acceptedFourBar = useRef<FourBarDesign | null>(null);
  const [activeDemo, setActiveDemo] = useState<Demo | null>(null);
  const [revision, setRevision] = useState(0);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState(0);
  const pendingFilesRef = useRef(0);
  const requestId = useRef(0);
  const originalRoute = useRef('/');
  const activeRef = useRef<Demo | null>(null);
  const blocked = useKinetiCADStore((s) => s.sketchSession.active || s.sketchDimensionsEditing || s.featureEditor.open || s.booleanEditor.open || s.mateEditor.open);
  const editing = blocked || pendingFiles > 0 || loadingId === 'four-bar';
  useEffect(() => () => { ++requestId.current; }, []);
  const setFileBusy = (busy: boolean) => {
    pendingFilesRef.current = Math.max(0, pendingFilesRef.current + (busy ? 1 : -1));
    setPendingFiles(pendingFilesRef.current);
  };
  const session = useRef(createDemoSession({
    read: useKinetiCADStore.getState,
    initial: useKinetiCADStore.getInitialState,
    write: (state) => useKinetiCADStore.setState(state),
    isolatePersistence: () => {
      const storage = useKinetiCADStore.persist.getOptions().storage;
      useKinetiCADStore.persist.setOptions({ storage: { getItem: () => null, setItem: () => {}, removeItem: () => {} } });
      return () => useKinetiCADStore.persist.setOptions({ storage });
    },
  }));

  async function openDemo(id: string) {
    if (editing) return;
    const demo = DEMOS.find((item) => item.id === id);
    if (!demo) return;
    const token = ++requestId.current;
    setLoadingId(id);
    setError(null);
    try {
      const response = await fetch(demoAssetUrl(id, import.meta.env.BASE_URL));
      if (!response.ok) throw new Error('The demo could not be downloaded. Please try again.');
      const document = parseDemoDocument(await response.json());
      if (token !== requestId.current) return;
      const current = useKinetiCADStore.getState();
      if (pendingFilesRef.current > 0 || current.sketchSession.active || current.sketchDimensionsEditing || current.featureEditor.open || current.booleanEditor.open || current.mateEditor.open) {
        throw new Error('Finish your current edit or file operation before opening the demo.');
      }
      if (!activeRef.current) originalRoute.current = location;
      session.current.enter(document);
      activeRef.current = demo;
      setActiveDemo(demo);
      setRevision((n) => n + 1);
      setOpen(false);
      navigate('/');
    } catch (err) {
      if (token === requestId.current) {
        setError(err instanceof Error && !('issues' in err) ? err.message : 'This demo could not be opened. Your model has not changed.');
        setOpen(true);
      }
    } finally {
      if (token === requestId.current) setLoadingId(null);
    }
  }

  function leaveDemo() {
    if (editing) return;
    ++requestId.current;
    setLoadingId(null);
    session.current.leave();
    activeRef.current = null;
    setActiveDemo(null);
    setRevision((n) => n + 1);
    navigate(originalRoute.current);
  }

  function openCrankSlider() {
    if (editing) return;
    ++requestId.current;
    setLoadingId(null);
    if (!activeRef.current) originalRoute.current = location;
    session.current.enter(createCrankSliderDocument(DEFAULT_CRANK_SLIDER_PARAMS));
    activeRef.current = crankSliderDemo;
    setActiveDemo(crankSliderDemo);
    setRevision(n => n + 1);
    setOpen(false);
    navigate('/simulator');
  }

  function applyCrankSlider(params: CrankSliderParams) {
    const current = useKinetiCADStore.getState();
    if (pendingFilesRef.current > 0 || current.sketchSession.active || current.sketchDimensionsEditing || current.featureEditor.open || current.booleanEditor.open || current.mateEditor.open) {
      throw new Error('Finish your current edit or file operation first.');
    }
    if (current.simulation.running) throw new Error('Reset the simulation before changing the mechanism.');
    if (!current.simulation.crankSlider || !matchesCrankSliderAssembly(current.assembly, current.simulation.crankSlider)) {
      throw new Error('This mechanism has manual edits. Open a fresh crank-slider to change its generated dimensions.');
    }
    const document = createCrankSliderDocument(params);
    ++requestId.current;
    setLoadingId(null);
    useKinetiCADStore.getState().resetSimulation();
    if (activeRef.current?.id === 'crank-slider') session.current.enter(document);
    else useKinetiCADStore.setState(document.state);
    setRevision(n => n + 1);
  }

  function openPathDesigner() {
    if (editing || loadingId) return;
    setPathInitialDesign(useKinetiCADStore.getState().simulation.fourBar);
    setPathDesignerOpen(true);
  }

  async function buildFourBar(design: FourBarDesign) {
    const before = useKinetiCADStore.getState();
    const signature = sketchEditAssemblySignature(before.assembly);
    if (editing || loadingId) throw new Error('Finish your current edit or file operation first.');
    const token = ++requestId.current;
    const assertCurrent = () => {
      const current = useKinetiCADStore.getState();
      if (token !== requestId.current || current.mode !== before.mode
        || signature !== sketchEditAssemblySignature(current.assembly)
        || pendingFilesRef.current > 0 || current.sketchSession.active || current.sketchDimensionsEditing
        || current.featureEditor.open || current.booleanEditor.open || current.mateEditor.open) {
        throw new Error('The project changed while checking the linkage. Your model is kept; try building again.');
      }
    };
    setLoadingId('four-bar');
    try {
      assertCurrent();
      const document = createFourBarDocument(design);
      await preflightFourBarDocument(document, await getCadKernel(), assertCurrent);
      assertCurrent();
      if (!activeRef.current) originalRoute.current = location;
      session.current.enter(document);
      acceptedFourBar.current = document.state.simulation.fourBar!;
      activeRef.current = fourBarDemo;
      setActiveDemo(fourBarDemo);
      setRevision(n => n + 1);
      setOpen(false);
      navigate('/simulator');
    } finally {
      if (token === requestId.current) setLoadingId(null);
    }
  }

  return (
    <DemoContext.Provider value={{
      activeDemo, revision, loadingId, editing, setFileBusy,
      openGallery: () => { if (!editing) { setError(null); setOpen(true); } },
      leaveDemo, openCrankSlider, applyCrankSlider, openPathDesigner,
      resetDemo: () => { if (activeDemo?.id === 'four-bar' && acceptedFourBar.current) {
        if (editing || loadingId) return;
        session.current.enter(createFourBarDocument(acceptedFourBar.current));
        setRevision(n => n + 1);
      } else if (activeDemo?.id === 'crank-slider') openCrankSlider(); else if (activeDemo) void openDemo(activeDemo.id); },
    }}>
      {children}
      <PathDesignerDialog open={pathDesignerOpen} onClose={() => setPathDesignerOpen(false)} onBuild={buildFourBar} initialDesign={pathInitialDesign} />
      <DemoGallery open={open} onOpenChange={(next) => {
        setOpen(next);
        if (!next) { ++requestId.current; setLoadingId(null); }
      }} onSelect={(id) => void openDemo(id)} loadingId={loadingId} error={error} />
    </DemoContext.Provider>
  );
}

export function CrankSliderButton() {
  const { openCrankSlider, editing, loadingId, activeDemo } = useDemoWorkspace();
  return <button type="button" onClick={openCrankSlider} disabled={editing || !!loadingId || activeDemo?.id === 'crank-slider'}
    title="Open an adjustable crank-slider; your current model is kept safe"
    className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-border px-2 text-xs hover:bg-secondary disabled:opacity-40">
    <Settings2 size={14} />Crank-slider
  </button>;
}

export function PathDesignerButton() {
  const { openPathDesigner, editing, loadingId } = useDemoWorkspace();
  return <button type="button" onClick={openPathDesigner} disabled={editing || !!loadingId}
    title="Draw a closed path and search locally for an editable linkage"
    className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-border px-2 text-xs hover:bg-secondary disabled:opacity-40">
    <Route size={14} />Draw a path
  </button>;
}

export function DemoButton() {
  const { openGallery, editing, loadingId } = useDemoWorkspace();
  return <button type="button" onClick={openGallery} disabled={editing || !!loadingId}
    title={editing ? 'Finish the current edit or file operation to explore demos' : 'Explore editable demo assemblies'}
    className="inline-flex h-8 shrink-0 items-center gap-2 rounded-md border border-orange-400/30 bg-orange-400/10 px-3 text-xs font-medium text-orange-300 transition hover:bg-orange-400/20 disabled:opacity-40">
    <Boxes size={15} /> Demos
  </button>;
}

export function DemoWorkspaceBar() {
  const { activeDemo, leaveDemo, resetDemo, editing, loadingId } = useDemoWorkspace();
  const [location, navigate] = useLocation();
  if (!activeDemo) return null;
  return <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-orange-400/15 bg-[#191b29] px-4 py-2.5 text-xs">
    <div className="flex min-w-0 items-center gap-3">
      <span className="rounded border border-orange-400/30 px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-orange-300">Demo</span>
      <div><p className="font-medium text-slate-100">{activeDemo.title}</p><p className="mt-0.5 text-slate-400">Your model is kept open. Save to download any demo edits.</p></div>
    </div>
    <div className="flex items-center gap-2">
      <button type="button" disabled={editing || !!loadingId} onClick={resetDemo} className="inline-flex items-center gap-1.5 rounded px-2 py-1.5 text-slate-400 hover:bg-white/5 hover:text-white disabled:opacity-40" title="Restore this demo's original dimensions and joints">
        {loadingId ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />} Reset demo
      </button>
      {activeDemo.jointCount > 0 && !location.startsWith('/simulator') && <button type="button" disabled={editing} onClick={() => { useKinetiCADStore.getState().setMode('simulator'); navigate('/simulator'); }} className="inline-flex items-center gap-1 rounded px-2 py-1.5 text-orange-300 hover:bg-orange-400/10 disabled:opacity-40">Try simulation <ArrowUpRight size={14} /></button>}
      <button type="button" disabled={editing} onClick={leaveDemo} className="inline-flex items-center gap-1.5 rounded-md border border-slate-600 px-3 py-1.5 text-slate-100 hover:bg-white/5 disabled:opacity-40"><ArrowLeft size={13} /> Return to my model</button>
    </div>
  </div>;
}

export function DemoWelcome({ onNewSketch }: { onNewSketch: () => void }) {
  const { openGallery } = useDemoWorkspace();
  return <div className="absolute inset-0 flex items-center justify-center p-6 pointer-events-none">
    <div className="pointer-events-auto w-full max-w-md rounded-2xl border border-slate-700/70 bg-[#101525]/95 p-7 shadow-2xl backdrop-blur-xl">
      <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl border border-orange-400/25 bg-orange-400/10 text-orange-300"><Boxes size={23} /></div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-orange-300">Your ideas, in motion</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">Start with something<br />that moves.</h1>
      <p className="mt-3 text-sm leading-relaxed text-slate-400">Explore a working assembly, change a dimension, or see how its joints move. Every demo is yours to edit.</p>
      <button type="button" onClick={openGallery} className="mt-6 flex w-full items-center justify-between rounded-lg bg-[#ff6b1a] px-4 py-3 text-sm font-semibold text-white hover:bg-[#ff7c36]">Explore the demos <ArrowUpRight size={18} /></button>
      <button type="button" onClick={onNewSketch} className="mt-3 w-full rounded-lg py-2 text-sm text-slate-400 hover:bg-white/5 hover:text-white">Or start a new sketch</button>
    </div>
  </div>;
}
