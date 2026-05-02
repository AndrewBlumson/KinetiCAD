import type { CSSProperties } from "react";

interface ReplayButtonProps {
  visible: boolean;
  onClick: () => void;
}

export function ReplayButton({ visible, onClick }: ReplayButtonProps) {
  const style: CSSProperties = {
    transform: visible ? "translateY(0) scale(1)" : "translateY(8px) scale(0.96)",
    opacity: visible ? 1 : 0,
    pointerEvents: visible ? "auto" : "none",
    transition: "opacity 320ms ease, transform 320ms ease",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      style={style}
      className="absolute right-8 bottom-8 z-50 inline-flex items-center gap-2 rounded-full border border-orange/60 bg-navy-2/80 px-5 py-2.5 font-mono text-xs uppercase tracking-[0.18em] text-ink shadow-[0_0_30px_rgba(255,107,26,0.25)] backdrop-blur-md hover:bg-orange/20"
      aria-label="Replay the showcase"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M3 12a9 9 0 1 0 3.4-7.04"
          stroke="#FF6B1A"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path d="M3 4v5h5" stroke="#FF6B1A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Replay
    </button>
  );
}
