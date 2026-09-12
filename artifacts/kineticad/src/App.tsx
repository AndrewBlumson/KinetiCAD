import { lazy, Suspense, useEffect } from 'react';
import { Switch, Route, Router as WouterRouter, Link, useLocation } from 'wouter';
import { useKinetiCADStore } from '@/state/store';
import { DemoWorkspaceProvider } from '@/components/demos/DemoWorkspace';
import { Toaster } from '@/components/ui/sonner';
import { ProjectRecoveryGate } from '@/project/ProjectRecoveryGate';
import { KINETICAD_SUPPORT_URL } from '../../shared/support';

const Modeller = lazy(() => import('@/views/Modeller'));
const Simulator = lazy(() => import('@/views/Simulator'));

function Loading() {
  return (
    <div className="flex h-full items-center justify-center bg-background">
      <span className="font-technical text-xs text-muted-foreground animate-pulse uppercase tracking-widest">
        Loading&hellip;
      </span>
    </div>
  );
}

function ModeToggle() {
  const [location] = useLocation();
  const setMode = useKinetiCADStore((s) => s.setMode);
  const stopSimulation = useKinetiCADStore((s) => s.resetSimulation);

  const isModeller = !location.startsWith('/simulator');

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 20,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 50,
      }}
      className="flex items-center gap-0.5 bg-card border border-border rounded p-0.5 shadow-lg"
    >
      <Link
        href="/"
        onClick={() => { if (!isModeller) stopSimulation(); setMode('modeller'); }}
        title="Switch to Modeller. Changing modes resets the simulation."
        className={[
          'px-4 py-1.5 rounded text-xs font-technical uppercase tracking-widest transition-colors',
          isModeller
            ? 'bg-[#FF6B1A] text-white'
            : 'text-muted-foreground hover:text-foreground hover:bg-secondary',
        ].join(' ')}
      >
        Modeller
      </Link>
      <Link
        href="/simulator"
        onClick={() => { if (isModeller) stopSimulation(); setMode('simulator'); }}
        title="Switch to Simulator. Changing modes resets the simulation."
        className={[
          'px-4 py-1.5 rounded text-xs font-technical uppercase tracking-widest transition-colors',
          !isModeller
            ? 'bg-[#FF6B1A] text-white'
            : 'text-muted-foreground hover:text-foreground hover:bg-secondary',
        ].join(' ')}
      >
        Simulator
      </Link>
      <a
        href={KINETICAD_SUPPORT_URL}
        target="_blank"
        rel="noopener noreferrer"
        title="Support KinetiCAD on Buy Me a Coffee. Donations are optional; the app remains free. Opens in a new tab."
        className="ml-1 border-l border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FF6B1A]"
      >
        Support KinetiCAD <span aria-hidden="true">↗</span>
        <span className="sr-only"> — optional donation, opens in a new tab</span>
      </a>
    </div>
  );
}

function Router() {
  const [location] = useLocation();
  // History navigation bypasses the footer buttons. Each route owns a new
  // scene, so its design pose must begin stopped with a matching zero clock.
  useEffect(() => {
    useKinetiCADStore.getState().resetSimulation();
  }, [location]);

  return (
    <>
      <Suspense fallback={<Loading />}>
        <Switch>
          <Route path="/" component={Modeller} />
          <Route path="/simulator" component={Simulator} />
          <Route component={Modeller} />
        </Switch>
      </Suspense>
      <ModeToggle />
    </>
  );
}

function App() {
  return (
    <div className="h-full bg-background text-foreground">
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <ProjectRecoveryGate><DemoWorkspaceProvider><Router /></DemoWorkspaceProvider></ProjectRecoveryGate>
        <Toaster position="bottom-right" />
      </WouterRouter>
    </div>
  );
}

export default App;
