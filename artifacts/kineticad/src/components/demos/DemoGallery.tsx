import { useId, useRef } from 'react';
import { ArrowUpRight, CircleDot, Layers, LoaderCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { DEMOS } from '@/demos/catalog';
import { DemoArtwork } from './DemoArtwork';

type DemoGalleryProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (id: string) => void;
  loadingId?: string | null;
  error?: string | null;
};

export function DemoGallery({ open, onOpenChange, onSelect, loadingId, error }: DemoGalleryProps) {
  const uid = useId();
  const titleRef = useRef<HTMLHeadingElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const loading = Boolean(loadingId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex h-[calc(100dvh-32px)] max-h-[850px] w-[calc(100vw-24px)] max-w-[1120px] flex-col gap-0 overflow-hidden rounded-2xl border-[#29364A] bg-[#0D1422] p-0 shadow-[0_32px_120px_rgba(0,0,0,0.65)] sm:w-[calc(100vw-48px)] [&>button]:right-5 [&>button]:top-5 [&>button]:flex [&>button]:h-8 [&>button]:w-8 [&>button]:items-center [&>button]:justify-center [&>button]:rounded-full [&>button]:bg-white/5"
        // The shared dialog's translated zoom animation is unsuitable for this large panel.
        style={{ animation: 'none' }}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          if (scrollRef.current) scrollRef.current.scrollTop = 0;
          titleRef.current?.focus({ preventScroll: true });
        }}
        data-testid="demo-gallery"
      >
        <div className="shrink-0 border-b border-[#253146] px-5 pb-5 pt-6 sm:px-7 sm:pb-6 sm:pt-7">
          <div className="mb-2 flex items-center gap-2.5 pr-10 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#FF995F]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#FF7D35]" />
            KinetiCAD examples
          </div>
          <DialogTitle ref={titleRef} tabIndex={-1} className="pr-9 text-2xl font-semibold leading-tight tracking-[-0.035em] text-[#F3F6FB] outline-none sm:text-[30px]">
            Start with something that moves.
          </DialogTitle>
          <DialogDescription className="mt-2 max-w-[650px] text-[13px] leading-relaxed text-[#A9B8CD] sm:text-sm">
            Explore an editable CAD assembly. Inspect its parts and joints, try the simulation, then make it your own.
          </DialogDescription>
        </div>

        {error && (
          <div role="alert" className="shrink-0 border-b border-[#7B4333] bg-[#38241F] px-5 py-3 text-sm leading-relaxed text-[#FFD1B9] sm:px-7">
            {error}
          </div>
        )}

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6" aria-label="Example assemblies">
          <div className="grid grid-cols-1 gap-4 min-[600px]:grid-cols-2 min-[1000px]:grid-cols-3">
            {DEMOS.map((demo) => {
              const opening = loadingId === demo.id;
              const titleId = `${uid}-${demo.id}`;
              return (
                <article
                  key={demo.id}
                  aria-labelledby={titleId}
                  className="group flex min-w-0 flex-col overflow-hidden rounded-xl border border-[#2B384C] bg-[#151F30] transition-colors hover:border-[#53657D]"
                  data-testid={`demo-card-${demo.id}`}
                >
                  <div className="relative h-[140px] shrink-0 overflow-hidden border-b border-[#26344A]">
                    <DemoArtwork id={demo.id} accent={demo.accent} />
                    <span className="absolute left-3 top-3 rounded-full border border-white/10 bg-[#101929]/90 px-2.5 py-1 text-[10px] font-medium tracking-wide text-[#D5DEEA]">
                      {demo.category}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col p-4">
                    <div className="mb-1 text-[10px] font-medium uppercase tracking-[0.12em] text-[#91A4BE]">{demo.subtitle}</div>
                    <h3 id={titleId} className="text-lg font-semibold leading-snug tracking-[-0.025em] text-[#F3F6FB]">
                      {demo.title}
                    </h3>
                    <p className="mt-2 text-[12px] leading-[1.65] text-[#B1BDD0]">{demo.description}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[#C1CBD9]">
                      <span className="flex items-center gap-1.5"><Layers size={13} className="text-[#879AB3]" aria-hidden="true" />{demo.partCount} parts</span>
                      <span className="flex items-center gap-1.5"><CircleDot size={13} className="text-[#879AB3]" aria-hidden="true" />{demo.jointCount} {demo.jointCount === 1 ? 'joint' : 'joints'}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Features to explore">
                      {demo.highlights.map((highlight) => (
                        <span key={highlight} className="rounded border border-[#344258] bg-[#1B293D] px-2 py-0.5 text-[10px] leading-relaxed text-[#B6C5D8]">{highlight}</span>
                      ))}
                    </div>
                    <details className="mb-4 mt-3 text-[11px] leading-relaxed text-[#97AAC3]">
                      <summary className="w-fit cursor-pointer rounded text-[#CDD6E2] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#FF995F]">Things to try</summary>
                      <p className="mt-2">{demo.learningTip}</p>
                    </details>
                    <button
                      type="button"
                      onClick={() => onSelect(demo.id)}
                      disabled={loading}
                      aria-label={`Open ${demo.title} demo`}
                      aria-busy={opening}
                      className="mt-auto flex min-h-10 w-full items-center justify-between gap-3 rounded-lg border border-[#415169] bg-[#223148] px-3 text-xs font-semibold text-[#EFF4FA] transition-colors hover:border-[#FF8D4B] hover:bg-[#FF7D35] hover:text-[#111827] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#FF995F] disabled:cursor-wait disabled:opacity-60"
                      data-testid={`open-demo-${demo.id}`}
                    >
                      <span>{opening ? 'Opening demo…' : 'Open demo'}</span>
                      {opening ? <LoaderCircle size={15} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <ArrowUpRight size={16} aria-hidden="true" />}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <div className="shrink-0 border-t border-[#253146] px-5 py-3 text-[11px] leading-relaxed text-[#879BB5] sm:px-7">
          Simplified illustrations. Each example opens as a full, editable assembly.
          <span role="status" className="sr-only">{loading ? 'Opening your selected demo. Please wait.' : ''}</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default DemoGallery;
