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
          KinetiCAD is a desktop application
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
          KinetiCAD is a parametric CAD tool with a real geometry kernel and
          live physics. It is built for a large screen, a precise pointer, and
          the kind of focused work that CAD needs, so it runs on desktop and
          laptop computers, not mobile devices.
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
          Visit kineticad.co.uk on a desktop computer using a recent version
          of Chrome to launch it.
        </p>
      </div>
    </div>
  );
}
