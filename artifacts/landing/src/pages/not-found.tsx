import { Link } from "wouter";

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0A0E1A",
        color: "#F5F5F5",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px",
        textAlign: "center",
        fontFamily: "'Space Grotesk', sans-serif",
      }}
    >
      <span
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: "11px",
          textTransform: "uppercase",
          letterSpacing: "0.28em",
          color: "#FF6B1A",
          marginBottom: "24px",
        }}
      >
        404
      </span>
      <h1
        style={{
          margin: "0 0 16px",
          fontFamily: "'Space Grotesk', sans-serif",
          fontWeight: 700,
          fontSize: "clamp(28px, 4vw, 40px)",
          lineHeight: 1.1,
          color: "#F5F5F5",
        }}
      >
        Page not found
      </h1>
      <p
        style={{
          margin: "0 0 40px",
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: "16px",
          lineHeight: 1.6,
          color: "rgba(245,245,245,0.55)",
          maxWidth: "400px",
        }}
      >
        The page you were looking for does not exist.
      </p>
      <Link
        href="/"
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: "12px",
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          color: "rgba(255,107,26,0.75)",
          textDecoration: "none",
        }}
      >
        ← Back to KinetiCAD
      </Link>
    </div>
  );
}
