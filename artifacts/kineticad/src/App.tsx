import { lazy, Suspense } from 'react';
import { Switch, Route, Router as WouterRouter, Link, useLocation } from 'wouter';
import { useKinetiCADStore } from '@/state/store';

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

  const base = import.meta.env.BASE_URL.replace(/\/$/, '');

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
        href={base + '/'}
        onClick={() => setMode('modeller')}
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
        href={base + '/simulator'}
        onClick={() => setMode('simulator')}
        className={[
          'px-4 py-1.5 rounded text-xs font-technical uppercase tracking-widest transition-colors',
          !isModeller
            ? 'bg-[#FF6B1A] text-white'
            : 'text-muted-foreground hover:text-foreground hover:bg-secondary',
        ].join(' ')}
      >
        Simulator
      </Link>
    </div>
  );
}

function Router() {
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
        <Router />
      </WouterRouter>
    </div>
  );
}

export default App;
