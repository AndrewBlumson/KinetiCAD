import { Link } from "wouter";

const LOGO   = `${import.meta.env.BASE_URL}logo.webp`;
const VIDEO  = `${import.meta.env.BASE_URL}orrery.mp4`;
const POSTER = `${import.meta.env.BASE_URL}opengraph.jpg`;

const FEATURE_COLS = [
  {
    id: "modelling",
    label: "// Modelling",
    items: [
      "Sketch on XY / XZ / YZ plane",
      "Line, rectangle, arc, circle tools",
      "Endpoint, midpoint & grid snapping",
      "Extrude (forward / backward / symmetric)",
      "Revolve around any axis",
      "Fillet & chamfer by edge selection",
      "Hole (through-all or depth)",
      "Boolean union, subtract, intersect",
      "Transform gizmo — translate & rotate",
      "Multi-part assembly",
      "Duplicate, rename, hide parts",
    ],
  },
  {
    id: "assembly",
    label: "// Assembly",
    items: [
      "Revolute mate",
      "Prismatic mate",
      "Spherical mate",
      "Fixed mate",
      "Planar mate",
      "Motorised revolute joints",
      "Motorised prismatic joints",
      "Grounded body constraint",
      "Named mates with editable parameters",
      "Visual mate-picker — click faces & edges",
    ],
  },
  {
    id: "simulation",
    label: "// Simulation",
    items: [
      "Rapier3D rigid-body physics (Rust → WASM)",
      "60 Hz simulation loop",
      "Real mass from material density × volume",
      "Inertia tensor from computed geometry",
      "Speed multiplier (0.1× – 10×)",
      "Pause, resume, reset",
      "Motor force applied per joint per frame",
      "Gravity along –Z (mechanical convention)",
    ],
  },
  {
    id: "io",
    label: "// Materials & I/O",
    items: [
      "8-material library with real density",
      "Aluminium 6061",
      "Steel",
      "Brass",
      "Titanium",
      "Nylon",
      "PLA",
      "ABS",
      "Acrylic",
      "STEP import",
      "STEP export (round-trip capable)",
      "STL export",
      "Save assembly → JSON",
      "Load assembly ← JSON",
    ],
  },
];

const TECH_ITEMS = [
  { label: "OpenCascade", sub: "B-rep kernel on WebAssembly" },
  { label: "Rapier3D", sub: "Rust physics, compiled to WASM" },
  { label: "Three.js r184", sub: "WebGPU renderer (M-series Chrome)" },
  { label: "Browser-native", sub: "Zero install · Zero licence" },
];

export function DesktopLanding() {
  return (
    <div
      className="min-h-screen"
      style={{ background: "#0A0E1A", color: "#F5F5F5" }}
    >
      {/* Background radial gradients */}
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          background:
            "radial-gradient(ellipse at 22% 18%, rgba(255,107,26,0.10) 0%, rgba(10,14,26,0) 50%), radial-gradient(ellipse at 78% 82%, rgba(70,90,170,0.08) 0%, rgba(10,14,26,0) 55%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
      {/* Faint grid */}
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          opacity: 0.035,
          backgroundImage:
            "linear-gradient(rgba(245,245,245,1) 1px, transparent 1px), linear-gradient(90deg, rgba(245,245,245,1) 1px, transparent 1px)",
          backgroundSize: "80px 80px",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      {/* ══════════════════════════════
          HERO
      ══════════════════════════════ */}
      <section
        style={{
          position: "relative",
          zIndex: 1,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "40px",
          padding: "clamp(64px, 10vh, 96px) 32px",
          textAlign: "center",
        }}
      >
        <img
          src={LOGO}
          alt="KinetiCAD"
          draggable={false}
          style={{
            width: "176px",
            height: "176px",
            borderRadius: "28px",
            boxShadow:
              "0 0 0 1px rgba(255,107,26,0.30), 0 24px 80px rgba(255,107,26,0.20), 0 8px 32px rgba(0,0,0,0.60)",
          }}
        />

        <div style={{ display: "flex", flexDirection: "column", gap: "12px", maxWidth: "680px" }}>
          <h1
            style={{
              margin: 0,
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 800,
              fontSize: "clamp(52px, 7vw, 96px)",
              lineHeight: 1.0,
              letterSpacing: "-0.03em",
              color: "#F5F5F5",
            }}
          >
            KinetiCAD
          </h1>
          <p
            style={{
              margin: 0,
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: "20px",
              fontWeight: 500,
              color: "rgba(245,245,245,0.68)",
            }}
          >
            Browser CAD. Real B-rep geometry. Live physics.
          </p>
          <p
            style={{
              margin: 0,
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "13px",
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              color: "rgba(255,107,26,0.75)",
            }}
          >
            No install&nbsp;&nbsp;·&nbsp;&nbsp;No licence&nbsp;&nbsp;·&nbsp;&nbsp;No CAD seat
          </p>
        </div>

        {/* ── Product demo video ── */}
        <div style={{ width: "100%", maxWidth: "860px" }}>
          <video
            autoPlay
            muted
            loop
            playsInline
            poster={POSTER}
            style={{
              display: "block",
              width: "100%",
              borderRadius: "12px",
              border: "1px solid rgba(255,107,26,0.22)",
              boxShadow:
                "0 0 0 1px rgba(255,107,26,0.10), 0 16px 48px rgba(0,0,0,0.70)",
            }}
          >
            <source src={VIDEO} type="video/mp4" />
          </video>
        </div>

        <a
          href="/app"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "14px 32px",
            background: "#FF6B1A",
            color: "#fff",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "13px",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            textDecoration: "none",
            borderRadius: "6px",
            boxShadow:
              "0 0 0 1px rgba(255,107,26,0.5), 0 8px 32px rgba(255,107,26,0.30)",
            transition: "box-shadow 0.15s",
          }}
        >
          Launch KinetiCAD <span aria-hidden="true">→</span>
        </a>

        {/* Scroll hint */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            bottom: "40px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "6px",
            color: "rgba(245,245,245,0.20)",
            animation: "bounce 2s infinite",
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 5v14M5 12l7 7 7-7"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <style>{`
          @keyframes bounce {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(6px); }
          }
        `}</style>
      </section>

      {/* ══════════════════════════════
          FEATURES
      ══════════════════════════════ */}
      <section style={{ position: "relative", zIndex: 1, padding: "80px 64px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            marginBottom: "56px",
          }}
        >
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "11px",
              textTransform: "uppercase",
              letterSpacing: "0.32em",
              color: "#FF6B1A",
            }}
          >
            // Features
          </span>
          <span
            style={{ height: "1px", flex: 1, background: "rgba(255,107,26,0.18)" }}
          />
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "11px",
              textTransform: "uppercase",
              letterSpacing: "0.32em",
              color: "rgba(245,245,245,0.28)",
            }}
          >
            Full feature list
          </span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "20px",
          }}
        >
          {FEATURE_COLS.map((col) => (
            <div
              key={col.id}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "16px",
                padding: "24px",
                borderRadius: "12px",
                border: "1px solid rgba(255,107,26,0.14)",
                background: "rgba(15,20,37,0.70)",
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "11px",
                  fontWeight: 400,
                  textTransform: "uppercase",
                  letterSpacing: "0.28em",
                  color: "#FF6B1A",
                }}
              >
                {col.label}
              </h2>
              <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "8px" }}>
                {col.items.map((item, i) => (
                  <li
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "10px",
                      fontFamily: "'Space Grotesk', sans-serif",
                      fontSize: "13px",
                      lineHeight: 1.45,
                      color: "rgba(245,245,245,0.70)",
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        marginTop: "2px",
                        flexShrink: 0,
                        fontSize: "10px",
                        color: "rgba(255,107,26,0.50)",
                      }}
                    >
                      ▸
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════
          TECH STRIP
      ══════════════════════════════ */}
      <section
        style={{
          position: "relative",
          zIndex: 1,
          padding: "56px 64px",
          borderTop: "1px solid rgba(255,107,26,0.09)",
          borderBottom: "1px solid rgba(255,107,26,0.09)",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: "24px",
          }}
        >
          {TECH_ITEMS.map((t) => (
            <div key={t.label} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "15px",
                  fontWeight: 600,
                  color: "#F5F5F5",
                }}
              >
                {t.label}
              </span>
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "12px",
                  color: "rgba(245,245,245,0.40)",
                }}
              >
                {t.sub}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════
          FOOTER
      ══════════════════════════════ */}
      <footer
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          padding: "36px 64px",
          flexWrap: "wrap",
          gap: "24px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <img
            src={LOGO}
            alt="KinetiCAD"
            draggable={false}
            style={{ width: "36px", height: "36px", borderRadius: "8px" }}
          />
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "13px",
              textTransform: "uppercase",
              letterSpacing: "0.28em",
              color: "rgba(245,245,245,0.45)",
            }}
          >
            KinetiCAD
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
            <a
              href="https://kineticad.co.uk"
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "13px",
                color: "rgba(245,245,245,0.32)",
                textDecoration: "none",
              }}
            >
              kineticad.co.uk
            </a>
            <Link
              href="/story"
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "13px",
                color: "rgba(255,107,26,0.70)",
                textDecoration: "none",
              }}
            >
              Story
            </Link>
            <Link
              href="/terms"
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "13px",
                color: "rgba(245,245,245,0.32)",
                textDecoration: "none",
              }}
            >
              Terms
            </Link>
            <Link
              href="/privacy"
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "13px",
                color: "rgba(245,245,245,0.32)",
                textDecoration: "none",
              }}
            >
              Privacy
            </Link>
          </div>
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "12px",
              color: "rgba(245,245,245,0.40)",
            }}
          >
            © 2026 Adevious Ltd. All rights reserved.
          </span>
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "11px",
              color: "rgba(245,245,245,0.24)",
              textAlign: "right",
            }}
          >
            Adevious AI is a trading name of Adevious Ltd. Company No. 08550853, registered in England and Wales.
          </span>
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "11px",
              color: "rgba(245,245,245,0.24)",
              textAlign: "right",
            }}
          >
            Registered Office: Rosedean House, 4 Argyle Road, Barnet, England, EN5 4DX
          </span>
        </div>
      </footer>
    </div>
  );
}
