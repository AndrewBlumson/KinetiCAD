/**
 * Stylised KinetiCAD "K" placeholder, rendered in Replit Orange.
 * Used inline as a logomark next to titles and credits.
 */
export function KLogo({ size = 64, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="kineticadKGrad" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FF8A3A" />
          <stop offset="1" stopColor="#FF5A0A" />
        </linearGradient>
      </defs>
      {/* Soft outer glow plate */}
      <rect x="2" y="2" width="60" height="60" rx="14" ry="14" fill="rgba(255,107,26,0.08)" />
      <rect
        x="2"
        y="2"
        width="60"
        height="60"
        rx="14"
        ry="14"
        fill="none"
        stroke="rgba(255,107,26,0.25)"
        strokeWidth="1"
      />
      {/* Vertical stem of the K */}
      <rect x="14" y="10" width="8" height="44" rx="2" fill="url(#kineticadKGrad)" />
      {/* Upper diagonal — kinematic linkage arm */}
      <path
        d="M22 32 L48 12 L52 16 L26 36 Z"
        fill="url(#kineticadKGrad)"
        opacity="0.95"
      />
      {/* Lower diagonal */}
      <path
        d="M22 32 L48 52 L52 48 L26 28 Z"
        fill="url(#kineticadKGrad)"
        opacity="0.95"
      />
      {/* Pivot dot at the joint to suggest a mechanism */}
      <circle cx="22" cy="32" r="3.2" fill="#0A0E1A" stroke="#FF8A3A" strokeWidth="1.5" />
    </svg>
  );
}
