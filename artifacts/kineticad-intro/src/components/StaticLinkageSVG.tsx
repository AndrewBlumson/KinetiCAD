/**
 * Static SVG fallback for environments where WebGL is unavailable
 * (e.g. headless preview iframes without GPU access).
 *
 * Renders a stylised four-bar linkage so the video still composes correctly
 * during local verification. The recording target — M-series Chrome — uses
 * the live Three.js scene instead.
 */
export function StaticLinkageSVG() {
  return (
    <svg
      viewBox="0 0 800 500"
      xmlns="http://www.w3.org/2000/svg"
      className="h-full w-full"
      aria-label="Four-bar linkage (static preview)"
    >
      <defs>
        <linearGradient id="bar" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FF8A3A" />
          <stop offset="1" stopColor="#FF5A0A" />
        </linearGradient>
        <radialGradient id="pivot" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#F5F5F5" />
          <stop offset="0.6" stopColor="#cdd2d8" />
          <stop offset="1" stopColor="#7a8090" />
        </radialGradient>
        <linearGradient id="ground" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#9aa0ad" />
          <stop offset="1" stopColor="#6a707d" />
        </linearGradient>
      </defs>

      {/* faint grid */}
      <g opacity="0.15" stroke="#F5F5F5" strokeWidth="1">
        {Array.from({ length: 17 }).map((_, i) => (
          <line key={`v${i}`} x1={i * 50} y1="0" x2={i * 50} y2="500" />
        ))}
        {Array.from({ length: 11 }).map((_, i) => (
          <line key={`h${i}`} x1="0" y1={i * 50} x2="800" y2={i * 50} />
        ))}
      </g>

      {/* ground bar */}
      <rect
        x="200"
        y="345"
        width="400"
        height="14"
        rx="3"
        fill="url(#ground)"
      />
      {/* fixed bases */}
      <rect x="180" y="350" width="40" height="40" rx="4" fill="#222838" />
      <rect x="580" y="350" width="40" height="40" rx="4" fill="#222838" />

      {/* crank (input) */}
      <g transform="translate(200,350) rotate(-58)">
        <rect
          x="0"
          y="-9"
          width="135"
          height="18"
          rx="6"
          fill="url(#bar)"
        />
        <circle cx="135" cy="0" r="9" fill="url(#pivot)" />
      </g>

      {/* coupler (connecting rod) */}
      <g transform="translate(271,235) rotate(8)">
        <rect
          x="0"
          y="-7"
          width="380"
          height="14"
          rx="5"
          fill="url(#bar)"
          opacity="0.95"
        />
      </g>

      {/* rocker (output) */}
      <g transform="translate(600,350) rotate(-115)">
        <rect
          x="0"
          y="-9"
          width="280"
          height="18"
          rx="6"
          fill="url(#bar)"
        />
        <circle cx="280" cy="0" r="9" fill="url(#pivot)" />
      </g>

      {/* base pivots */}
      <circle cx="200" cy="350" r="11" fill="url(#pivot)" stroke="#0A0E1A" strokeWidth="2" />
      <circle cx="600" cy="350" r="11" fill="url(#pivot)" stroke="#0A0E1A" strokeWidth="2" />

      {/* corner label */}
      <text
        x="32"
        y="464"
        fontFamily="ui-monospace, monospace"
        fontSize="14"
        letterSpacing="2"
        fill="#FF6B1A"
      >
        FOUR-BAR · GRASHOF CRANK-ROCKER
      </text>
      <text
        x="32"
        y="484"
        fontFamily="ui-monospace, monospace"
        fontSize="11"
        letterSpacing="1.5"
        fill="rgba(245,245,245,0.45)"
      >
        Static preview · WebGL renders on the recording target
      </text>
    </svg>
  );
}
