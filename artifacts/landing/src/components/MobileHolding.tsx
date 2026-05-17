const LOGO = `${import.meta.env.BASE_URL}logo.webp`;

export function MobileHolding() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "32px",
        padding: "0 32px",
        textAlign: "center",
        background:
          "radial-gradient(ellipse at 50% 0%, rgba(255,107,26,0.18) 0%, rgba(10,14,26,0) 55%), #0A0E1A",
      }}
    >
      <img
        src={LOGO}
        alt="KinetiCAD"
        draggable={false}
        style={{
          width: "96px",
          height: "96px",
          borderRadius: "20px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        }}
      />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          maxWidth: "320px",
        }}
      >
        <h1
          style={{
            margin: 0,
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: "28px",
            fontWeight: 700,
            letterSpacing: "-0.02em",
            color: "#F5F5F5",
          }}
        >
          KinetiCAD
        </h1>
        <p
          style={{
            margin: 0,
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: "15px",
            lineHeight: 1.6,
            color: "rgba(245,245,245,0.62)",
          }}
        >
          Browser-based parametric CAD with real B-rep geometry and live
          physics simulation.
        </p>
        <p
          style={{
            margin: 0,
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: "13px",
            lineHeight: 1.6,
            color: "rgba(245,245,245,0.40)",
          }}
        >
          KinetiCAD requires a desktop computer with a recent version of
          Chrome. WebGPU is not available on mobile.
        </p>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: "12px",
          textTransform: "uppercase",
          letterSpacing: "0.12em",
        }}
      >
        <span style={{ color: "rgba(245,245,245,0.30)" }}>Visit</span>
        <span style={{ color: "#FF6B1A" }}>kineticad.co.uk</span>
        <span style={{ color: "rgba(245,245,245,0.30)" }}>on desktop</span>
      </div>
    </div>
  );
}
