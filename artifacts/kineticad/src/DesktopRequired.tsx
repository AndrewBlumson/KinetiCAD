/** This screen intentionally has no application, store, recovery or CAD imports. */
export function DesktopRequired() {
  return (
    <main className="h-full overflow-y-auto bg-[#0A0E1A] text-slate-100">
      <section className="mx-auto flex min-h-full w-full max-w-lg flex-col justify-center px-6 py-12">
        <svg viewBox="0 0 64 64" width="64" height="64" fill="none" aria-hidden="true" className="mb-7 text-orange-400">
          <rect x="7" y="9" width="50" height="34" rx="4" stroke="currentColor" strokeWidth="2" />
          <path d="M23 55h18M27 43v12m10-12v12M8 36h48" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="m26 21 5 5 9-10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-orange-300">KinetiCAD</p>
        <h1 className="text-3xl font-semibold leading-tight tracking-tight">Open KinetiCAD on a desktop or laptop</h1>
        <p className="mt-5 text-base leading-relaxed text-slate-300">
          The CAD modeller and simulator require a desktop or laptop with a mouse or trackpad.
          They are not available on phones or tablets.
        </p>
        <p className="mt-4 text-sm leading-relaxed text-slate-400">
          Visit kineticad.co.uk in a recent version of Chrome on your computer to start modelling.
        </p>
        <a href="/" className="mt-8 inline-flex min-h-12 items-center justify-center self-start rounded-md border border-orange-400/50 px-5 py-3 text-sm font-medium text-orange-200 hover:bg-orange-400/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-300">
          Back to the KinetiCAD home page
        </a>
      </section>
    </main>
  );
}
