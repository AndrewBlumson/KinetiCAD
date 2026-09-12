import { useEffect, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { useKinetiCADStore } from '../state/store';
import { projectPersistence, useProjectRecovery } from './projectPersistence';

let hydration: Promise<unknown> | undefined;
const hydrate = () => hydration ??= Promise.resolve(useKinetiCADStore.persist.rehydrate()).finally(() => { hydration = undefined; });
export function downloadProjectText(text: string, filename: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function ProjectRecoveryGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(useKinetiCADStore.persist.hasHydrated());
  const { status, message } = useProjectRecovery();
  useEffect(() => {
    const unsubscribe = useKinetiCADStore.persist.onFinishHydration(() => setReady(true));
    if (!useKinetiCADStore.persist.hasHydrated()) void hydrate();
    else setReady(true);
    const flush = () => { void projectPersistence.flush(); };
    document.addEventListener('visibilitychange', flush);
    window.addEventListener('pagehide', flush);
    return () => { unsubscribe(); document.removeEventListener('visibilitychange', flush); window.removeEventListener('pagehide', flush); };
  }, []);
  if (ready) return <>
    {children}
    {message && <div role="status" className="fixed z-[90] bottom-16 left-3 right-3 mx-auto max-w-2xl rounded border border-amber-500/40 bg-slate-950 px-4 py-3 text-xs text-amber-100 shadow-xl">
      {message}
      <button className="ml-3 underline" onClick={() => useProjectRecovery.setState({ message: '' })}>Dismiss</button>
    </div>}
  </>;
  return <div className="flex h-full items-center justify-center bg-background p-8 text-foreground">
    <div className="max-w-xl space-y-4">
      <h1 className="text-lg font-semibold">{status === 'error' ? 'Project recovery needs attention' : 'Restoring your project…'}</h1>
      <p className="text-sm text-muted-foreground">{message || 'Checking the saved project and rebuilding its imported CAD solids before opening the workspace.'}</p>
      {status === 'error' && <div className="flex flex-wrap gap-3 text-sm">
        <button className="rounded bg-orange-600 px-3 py-2" onClick={() => void hydrate()}>Retry recovery</button>
        <button className="rounded border px-3 py-2" onClick={() => {
          void projectPersistence.exportRecoveryCopies().then((text) => downloadProjectText(text, 'kineticad-recovery-copies.json')).catch((error) => toast.error(String(error)));
        }}>Download recovery copies</button>
        <button className="rounded border px-3 py-2" onClick={() => { projectPersistence.allowEmptyOnce(); void hydrate(); }}>Open empty workspace</button>
      </div>}
    </div>
  </div>;
}
