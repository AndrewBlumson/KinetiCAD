import { Link } from "wouter";
import { CreatorProfile } from "./CreatorProfile";
import { SiteFooter } from "./SiteFooter";

const LOGO   = `${import.meta.env.BASE_URL}logo.webp`;
const VIDEO  = `${import.meta.env.BASE_URL}orrery.mp4`;
const POSTER = `${import.meta.env.BASE_URL}opengraph.jpg`;

const FEATURE_COLS = [
  {
    id: "modelling",
    label: "// Modelling",
    items: [
      "Sketch on XY, XZ and YZ planes",
      "Line, rectangle, arc and circle tools",
      "Endpoint, midpoint and grid snapping",
      "Edit and save dimensions in mm and degrees",
      "Extrude forward, backward or symmetrically",
      "Add, cut or create a new body",
      "Revolve around X, Y or Z",
      "Edge fillets, chamfers and depth/through holes",
      "Editable feature history and live previews",
      "Invalid dimension edits keep the last valid model",
    ],
  },
  {
    id: "assembly",
    label: "// Assembly",
    items: [
      "Multiple parts in one assembly",
      "Translate and rotate with the 3D gizmo",
      "Exact numeric position and rotation controls",
      "Duplicate, rename and hide parts",
      "Union, subtract and intersect solid parts",
      "Revolute, prismatic, spherical and fixed joints",
      "Pick faces and edges for joint attachments",
      "Rotation in RPM; sliding speed in mm/s",
      "Fixed bases and editable joint settings",
    ],
    note: "Connected Boolean results simulate directly with their finished material, mass and joints. Construction inputs are excluded; disconnected results need separate bodies.",
  },
  {
    id: "simulation",
    label: "// Simulation",
    items: [
      "Fixed-step rigid-body simulation",
      "Mass, balance point and inertia from solid geometry",
      "Material density affects mass and motion",
      "Timing independent of display frame rate",
      "0.25×, 0.5×, 1× and 2× playback",
      "Pause, resume, reset and timed runs",
      "Measured motion and reference plots",
      "Downward gravity or zero-gravity studies",
    ],
    note: "Assembly simulation uses ideal joints and speed-controlled motors. Part-to-part contact, bearing friction and motor force limits are not yet modelled here.",
  },
  {
    id: "projects",
    label: "// Materials & projects",
    items: [
      "8 materials with density presets",
      "Aluminium 6061, Steel 1018 and Brass C36000",
      "Titanium Grade 5, Nylon 6, PLA, ABS and Acrylic",
      "Per-part material, mass and volume readouts",
      "Import and export STEP solid geometry",
      "Export STL meshes, including Boolean results",
      "Save and load complete editable projects",
      "Imported STEP shapes included in project files",
      "Automatic recovery and a previous saved copy",
    ],
    note: "Recovery stays on this device. Download a project to keep or transfer its editable history, materials and joints alongside the geometry.",
  },
  {
    id: "demos",
    label: "// Demos & mechanisms",
    items: [
      "Six editable demos plus an adjustable crank-slider",
      "Windmill and solar-system orrery",
      "Three-axis driven gimbal and kinetic mobile",
      "Material force lab: same force, different masses",
      "Bounded six-axis Stewart platform motion",
      "Crank-slider size and motor-speed controls",
      "Position, speed and mean-acceleration comparisons",
      "Try and edit demos while keeping your own model",
    ],
    note: "Demo comparisons show measured motion against stated reference equations. Reset a demo to restore its original geometry and settings.",
  },
  {
    id: "engineering",
    label: "// Engineering tests",
    items: [
      "Separate experiments with adjustable inputs",
      "Motor & load: lift, hold and overload",
      "Friction & contact: sliding, support and stopping",
      "Elastic beam: bending stress and deflection",
      "Use eligible CAD beams or dimensioned examples",
      "Compare measured and calculated behaviour",
      "View numerical errors and validity limits",
    ],
    note: "These experiments are separate from assembly simulation. The beam calculation does not deform the CAD mesh or provide general finite-element analysis.",
  },
];

const TECH_ITEMS = [
  { label: "OpenCascade", sub: "B-rep kernel on WebAssembly" },
  { label: "Rapier3D", sub: "Rust physics, compiled to WASM" },
  { label: "Three.js r184", sub: "WebGPU renderer for desktop browsers" },
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
          <p className="creator-byline">Created by <a href="#creator">Andrew Blumson</a> at Adevious AI</p>
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
      <section id="features" aria-label="KinetiCAD features" style={{ position: "relative", zIndex: 1, padding: "80px clamp(24px, 4.5vw, 64px)" }}>
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

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
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
                {col.items.map((item) => (
                  <li
                    key={item}
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
              {col.note && <p style={{
                margin: "auto 0 0",
                paddingTop: "16px",
                borderTop: "1px solid rgba(255,107,26,0.14)",
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: "12px",
                lineHeight: 1.55,
                color: "rgba(245,245,245,0.55)",
              }}>{col.note}</p>}
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
      <CreatorProfile />
      <SiteFooter />
    </div>
  );
}
