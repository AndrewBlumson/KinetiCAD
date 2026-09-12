import { Link } from "wouter";

import { SiteFooter } from "@/components/SiteFooter";

const SECTIONS = [
  {
    heading: "It started with \u201cthat\u2019s not possible\u201d",
    paras: [
      "KinetiCAD began as an entry to the Replit 10th birthday buildathon on 02/05/2026, a 24 hour challenge to build something from nothing.",
      "The idea came from a simple piece of pushback. CAD software is hard. It needs a real geometry kernel, real physics, real engineering. The received wisdom, from other developers and from AI tools alike, was that a proper CAD application was not something a solo builder could put together in a matter of days. Browser-native, no install, no paid CAD licence: not realistic.",
      "That was the whole appeal. I build for two companies as their AI Officer, both of which rely on CAD every day, so I knew the problem properly. And being told it could not be done by one person was exactly the reason to try.",
    ],
  },
  {
    heading: "What it became",
    paras: [
      "The 24 hour buildathon produced the seed: a working browser-based CAD tool. It did not stop there.",
      "Over the following weeks KinetiCAD grew into a parametric CAD platform that runs in the browser. OpenCascade provides B-rep geometry through WebAssembly, and Rapier provides rigid-body simulation. Sketching, extrude, revolve, fillet, chamfer and boolean operations sit alongside STEP import and export. Four joint types are supported: revolute, prismatic, spherical and fixed. Materials set density, and mass comes from the finished CAD solid. No installation or paid CAD seat is required.",
      "The simulation uses numerical integration and ideal joints, with its assumptions and limits stated alongside the engineering examples. An unchanged regression checks the windmill's 30 RPM drive against pi radians per second, within 0.0000005 rad/s after five simulated seconds. Ordinary assembly contact, bearing friction and finite motor torque are not modelled. That measured test establishes its stated case, not the accuracy or strength of every possible mechanism.",
    ],
  },
  {
    heading: "Who built it",
    paras: [
      "KinetiCAD was originally built by Andrew Blumson at Adevious AI, co-built with Kevin Blumson, using Replit Agent. The project source is released under the MIT licence; its dependencies retain their own licences.",
      "Later development, automated checks and desktop Chrome verification were carried out with Codex under Andrew's direction. KinetiCAD remains the same Replit-built project, with the same aim: make useful browser CAD freely available.",
    ],
  },
];

export default function StoryPage() {
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
        <div style={{ marginBottom: "56px", borderBottom: "1px solid rgba(255,107,26,0.14)", paddingBottom: "32px" }}>
          <h1
            style={{
              margin: 0,
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 700,
              fontSize: "clamp(28px, 4vw, 40px)",
              lineHeight: 1.1,
              color: "#F5F5F5",
            }}
          >
            The story behind KinetiCAD
          </h1>
        </div>

        {/* Sections */}
        <div style={{ display: "flex", flexDirection: "column", gap: "48px" }}>
          {SECTIONS.map((section) => (
            <section key={section.heading}>
              <h2
                style={{
                  margin: "0 0 18px",
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontWeight: 600,
                  fontSize: "19px",
                  lineHeight: 1.3,
                  color: "#F5F5F5",
                }}
              >
                {section.heading}
              </h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {section.paras.map((para, i) => (
                  <p
                    key={i}
                    style={{
                      margin: 0,
                      fontFamily: "'Space Grotesk', sans-serif",
                      fontSize: "15px",
                      lineHeight: 1.75,
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
        <p style={{ marginTop: "32px", fontFamily: "'Space Grotesk', sans-serif", fontSize: "14px", lineHeight: 1.75 }}>
          <a href="https://github.com/AndrewBlumson/KinetiCAD/blob/main/THIRD-PARTY-NOTICES.md" style={{ color: "#FF8F50" }}>
            Third-party software, icon and font notices
          </a>
        </p>
      </main>

      <SiteFooter />
    </div>
  );
}
