import { Link } from "wouter";

const LOGO = `${import.meta.env.BASE_URL}logo.webp`;

export interface LegalSection {
  num: number;
  heading: string;
  paras: string[];
}

interface LegalPageProps {
  title: string;
  lastUpdated: string;
  sections: LegalSection[];
}

export function LegalPage({ title, lastUpdated, sections }: LegalPageProps) {
  return (
    <div style={{ minHeight: "100vh", background: "#0A0E1A", color: "#F5F5F5", display: "flex", flexDirection: "column" }}>

      {/* Background radial gradients */}
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          inset: 0,
          background:
            "radial-gradient(ellipse at 22% 18%, rgba(255,107,26,0.07) 0%, rgba(10,14,26,0) 50%), radial-gradient(ellipse at 78% 82%, rgba(70,90,170,0.06) 0%, rgba(10,14,26,0) 55%)",
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
          opacity: 0.025,
          backgroundImage:
            "linear-gradient(rgba(245,245,245,1) 1px, transparent 1px), linear-gradient(90deg, rgba(245,245,245,1) 1px, transparent 1px)",
          backgroundSize: "80px 80px",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      {/* Content */}
      <main
        style={{
          position: "relative",
          zIndex: 1,
          flex: 1,
          width: "100%",
          maxWidth: "760px",
          margin: "0 auto",
          padding: "48px 32px 64px",
        }}
      >
        {/* Back link */}
        <Link
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "12px",
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            color: "rgba(255,107,26,0.75)",
            textDecoration: "none",
            marginBottom: "48px",
          }}
        >
          ← Back to KinetiCAD
        </Link>

        {/* Title block */}
        <div style={{ marginBottom: "48px", borderBottom: "1px solid rgba(255,107,26,0.14)", paddingBottom: "32px" }}>
          <h1
            style={{
              margin: "0 0 10px",
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 700,
              fontSize: "clamp(28px, 4vw, 40px)",
              lineHeight: 1.1,
              color: "#F5F5F5",
            }}
          >
            {title}
          </h1>
          <p
            style={{
              margin: 0,
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "12px",
              color: "rgba(245,245,245,0.35)",
              letterSpacing: "0.06em",
            }}
          >
            Last updated: {lastUpdated}
          </p>
        </div>

        {/* Sections */}
        <div style={{ display: "flex", flexDirection: "column", gap: "40px" }}>
          {sections.map((section) => (
            <section key={section.num}>
              <h2
                style={{
                  margin: "0 0 14px",
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontWeight: 600,
                  fontSize: "17px",
                  color: "#F5F5F5",
                  display: "flex",
                  alignItems: "baseline",
                  gap: "10px",
                }}
              >
                <span
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: "11px",
                    fontWeight: 400,
                    color: "#FF6B1A",
                    flexShrink: 0,
                  }}
                >
                  {section.num}.
                </span>
                {section.heading}
              </h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {section.paras.map((para, i) => (
                  <p
                    key={i}
                    style={{
                      margin: 0,
                      fontFamily: "'Space Grotesk', sans-serif",
                      fontSize: "15px",
                      lineHeight: 1.7,
                      color: "rgba(245,245,245,0.72)",
                    }}
                  >
                    {para}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer
        style={{
          position: "relative",
          zIndex: 1,
          borderTop: "1px solid rgba(255,107,26,0.09)",
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
        </div>
      </footer>
    </div>
  );
}
