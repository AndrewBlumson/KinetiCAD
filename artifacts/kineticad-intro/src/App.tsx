import { useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { FourBarLinkage } from "./three/FourBarLinkage";
import { StaticLinkageSVG } from "./components/StaticLinkageSVG";
import { OpeningAddress } from "./scenes/OpeningAddress";
import { TitleCard } from "./scenes/TitleCard";
import { Mission } from "./scenes/Mission";
import { TechnicalDepth } from "./scenes/TechnicalDepth";
import { Maths } from "./scenes/Maths";
import { Testing } from "./scenes/Testing";
import { KillerDemo } from "./scenes/KillerDemo";
import { Close } from "./scenes/Close";
import { ReplayButton } from "./components/ReplayButton";
import type { SceneHandle } from "./types";

// Scene start times (seconds) on the master timeline.
const T = {
  scene1: 0, // Opening address
  scene2: 12, // Title card
  scene3: 17, // Mission
  scene4: 25, // Technical depth
  scene5: 55, // Maths
  scene6: 70, // Testing
  scene7: 80, // Killer demo
  scene8: 105, // Close
} as const;

const TOTAL_DURATION = 120;

function App() {
  // Linkage canvas + manager
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const linkageRef = useRef<FourBarLinkage | null>(null);
  // Wrapper around the canvas; size/position is animated to frame the scene.
  const linkageWrapRef = useRef<HTMLDivElement>(null);
  // The black overlay that handles top-level fade-in / fade-out.
  const fadeRef = useRef<HTMLDivElement>(null);

  // Scene refs
  const scene1Ref = useRef<SceneHandle>(null);
  const scene2Ref = useRef<SceneHandle>(null);
  const scene3Ref = useRef<SceneHandle>(null);
  const scene4Ref = useRef<SceneHandle>(null);
  const scene5Ref = useRef<SceneHandle>(null);
  const scene6Ref = useRef<SceneHandle>(null);
  const scene7Ref = useRef<SceneHandle>(null);
  const scene8Ref = useRef<SceneHandle>(null);

  const masterRef = useRef<gsap.core.Timeline | null>(null);
  const [done, setDone] = useState(false);
  const [ready, setReady] = useState(false);
  const [linkageFailed, setLinkageFailed] = useState(false);

  /**
   * Build the master timeline. Runs after the linkage manager is ready and
   * the scene refs have populated. Returns a kill-able timeline.
   */
  const buildTimeline = useCallback(() => {
    const linkage = linkageRef.current;
    const wrap = linkageWrapRef.current;
    const fade = fadeRef.current;
    if (!wrap || !fade) return null;
    // Linkage may be null if WebGL was unavailable in this environment.
    // The timeline still runs; we just skip the camera-state tweens.

    const tl = gsap.timeline({
      onComplete: () => setDone(true),
    });

    // ====== Top-level fade ======
    tl.set(fade, { opacity: 1 }, 0); // start on black
    tl.to(fade, { opacity: 0, duration: 1.2, ease: "power2.out" }, 0.4);

    // ====== Linkage container choreography ======
    // Hidden by default. Visible as a small inset for scene 3, then expands to
    // full screen for scene 7 with a camera move, finally hides for scene 8.
    tl.set(
      wrap,
      {
        opacity: 0,
        right: "8vw",
        top: "50%",
        left: "auto",
        bottom: "auto",
        width: "44vw",
        height: "62vh",
        xPercent: 0,
        yPercent: -50,
        borderRadius: "16px",
      },
      0,
    );
    if (linkage) {
      tl.set(
        linkage,
        {
          cameraDistance: 5.5,
          cameraPolar: 1.05,
          cameraAzimuth: 0.55,
          cameraTargetX: 0.55,
          cameraTargetY: 0,
          cameraTargetZ: 0.1,
          cameraFov: 32,
          orbitSpeed: 0.05,
          angularVelocity: (60 / 60) * Math.PI * 2, // 60 RPM
        },
        0,
      );
    }

    // ----- Scene 3: small inset reveal at right -----
    tl.to(
      wrap,
      {
        opacity: 1,
        duration: 0.7,
        ease: "power2.inOut",
      },
      T.scene3 + 0.2,
    );

    // ----- Scene 3 -> Scene 4 transition: shrink + fade out as scene 4 begins -----
    tl.to(
      wrap,
      {
        opacity: 0,
        scale: 0.92,
        duration: 0.6,
        ease: "power2.inOut",
      },
      T.scene4 - 0.6,
    );

    // ----- Scene 7: expand to fullscreen with a dramatic camera change -----
    // Reset wrap to fullscreen, but invisible, just before scene 7 starts.
    tl.set(
      wrap,
      {
        scale: 1,
        right: "auto",
        top: 0,
        left: 0,
        bottom: 0,
        width: "100vw",
        height: "100vh",
        xPercent: 0,
        yPercent: 0,
        borderRadius: "0px",
        opacity: 0,
      },
      T.scene7 - 0.05,
    );
    tl.to(
      wrap,
      { opacity: 1, duration: 0.8, ease: "power2.inOut" },
      T.scene7,
    );

    if (linkage) {
      // Kick off camera framing for scene 7 — slow orbit, wider FOV.
      tl.to(
        linkage,
        {
          cameraDistance: 6.0,
          cameraPolar: 1.05,
          cameraAzimuth: 0.6,
          cameraFov: 28,
          cameraTargetX: 0.6,
          cameraTargetY: 0,
          cameraTargetZ: 0.05,
          orbitSpeed: 0.07,
          duration: 1.2,
          ease: "power2.inOut",
        },
        T.scene7,
      );

      // 8 seconds later: zoom in on the input crank's motor pivot
      tl.to(
        linkage,
        {
          cameraDistance: 1.9,
          cameraPolar: 1.18,
          cameraAzimuth: 0.4,
          cameraFov: 28,
          cameraTargetX: -0.05,
          cameraTargetY: 0.1,
          cameraTargetZ: 0,
          orbitSpeed: 0.04,
          duration: 1.6,
          ease: "power2.inOut",
        },
        T.scene7 + 9,
      );

      // ~13s in: pull back to a cinematic wide 3/4 view to show the cycle
      tl.to(
        linkage,
        {
          cameraDistance: 6.4,
          cameraPolar: 1.0,
          cameraAzimuth: 0.85,
          cameraFov: 30,
          cameraTargetX: 0.55,
          cameraTargetY: 0,
          cameraTargetZ: 0.05,
          orbitSpeed: 0.08,
          duration: 1.6,
          ease: "power2.inOut",
        },
        T.scene7 + 13,
      );
    }

    // ----- Scene 8: hide linkage so credits read clean -----
    tl.to(
      wrap,
      {
        opacity: 0,
        duration: 0.8,
        ease: "power2.inOut",
      },
      T.scene8 - 0.6,
    );

    // ====== Register each scene's tweens ======
    scene1Ref.current?.register(tl, T.scene1);
    scene2Ref.current?.register(tl, T.scene2);
    scene3Ref.current?.register(tl, T.scene3);
    scene4Ref.current?.register(tl, T.scene4);
    scene5Ref.current?.register(tl, T.scene5);
    scene6Ref.current?.register(tl, T.scene6);
    scene7Ref.current?.register(tl, T.scene7);
    scene8Ref.current?.register(tl, T.scene8);

    // ====== Final fade-out to black ======
    tl.to(
      fade,
      { opacity: 1, duration: 1.5, ease: "power2.inOut" },
      TOTAL_DURATION - 1.5,
    );

    // Pin total duration so the timeline always reports the full length
    tl.to({}, { duration: 0 }, TOTAL_DURATION);

    return tl;
  }, []);

  // Initialise the linkage once.
  useEffect(() => {
    let cancelled = false;
    let resizeObs: ResizeObserver | null = null;
    let resizeHandler: (() => void) | null = null;

    async function init() {
      const canvas = canvasRef.current;
      const wrap = linkageWrapRef.current;
      if (!canvas || !wrap) return;
      let linkage: FourBarLinkage | null = null;
      try {
        linkage = new FourBarLinkage(canvas);
        await linkage.init();
      } catch (err) {
        console.warn(
          "[KinetiCAD Intro] Live linkage unavailable — using static fallback.",
          err,
        );
        if (linkage) linkage.dispose();
        if (!cancelled) setLinkageFailed(true);
        setReady(true);
        return;
      }
      if (cancelled) {
        linkage.dispose();
        return;
      }
      linkageRef.current = linkage;

      const apply = () => {
        const rect = wrap.getBoundingClientRect();
        const w = Math.max(2, Math.round(rect.width));
        const h = Math.max(2, Math.round(rect.height));
        linkage!.setSize(w, h);
      };
      apply();
      resizeObs = new ResizeObserver(apply);
      resizeObs.observe(wrap);
      resizeHandler = apply;
      window.addEventListener("resize", resizeHandler);

      linkage.start();
      setReady(true);
    }

    void init();

    return () => {
      cancelled = true;
      resizeObs?.disconnect();
      if (resizeHandler) window.removeEventListener("resize", resizeHandler);
      linkageRef.current?.dispose();
      linkageRef.current = null;
    };
  }, []);

  // Build the timeline once the linkage manager is ready (or has failed and
  // committed to the static fallback). Gating on `ready` guarantees the
  // timeline registers linkage-property tweens against a live FourBarLinkage
  // instance rather than `null`, which would silently drop the Scene 3 / 7
  // camera choreography.
  useEffect(() => {
    if (!ready) return;
    const tl = buildTimeline();
    if (tl) {
      masterRef.current = tl;
      setDone(false);

      // Debug: ?t=N seeks the timeline to N seconds (and ?t=end pauses on
      // the post-roll). Useful for verifying individual scenes in dev.
      if (typeof window !== "undefined") {
        const q = new URLSearchParams(window.location.search);
        const seek = q.get("t");
        if (seek !== null) {
          const target =
            seek === "end" ? TOTAL_DURATION - 0.05 : Number(seek);
          if (Number.isFinite(target)) {
            tl.seek(target, false);
            if (q.get("pause") === "1") tl.pause();
          }
        }
      }
    }
    return () => {
      masterRef.current?.kill();
      masterRef.current = null;
    };
  }, [ready, buildTimeline]);

  const replay = useCallback(() => {
    masterRef.current?.kill();
    masterRef.current = null;
    setDone(false);
    // Rebuild on next frame
    requestAnimationFrame(() => {
      const tl = buildTimeline();
      if (tl) masterRef.current = tl;
    });
  }, [buildTimeline]);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-navy">
      {/* ------ Persistent ambient background ------ */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(ellipse at 22% 18%, rgba(255,107,26,0.14) 0%, rgba(10,14,26,0) 55%), radial-gradient(ellipse at 78% 82%, rgba(70,90,170,0.12) 0%, rgba(10,14,26,0) 60%), linear-gradient(180deg, #0A0E1A 0%, #060912 100%)",
        }}
      />
      {/* Faint grid for technical feel */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        aria-hidden="true"
        style={{
          backgroundImage:
            "linear-gradient(rgba(245,245,245,1) 1px, transparent 1px), linear-gradient(90deg, rgba(245,245,245,1) 1px, transparent 1px)",
          backgroundSize: "80px 80px",
        }}
      />

      {/* ------ Linkage canvas wrapper (size/position animated by GSAP) ------ */}
      <div
        ref={linkageWrapRef}
        className="absolute overflow-hidden"
        style={{
          // Initial state set by GSAP at timeline build; ensure visible canvas
          // box for the ResizeObserver to sample on first paint.
          right: "8vw",
          top: "50%",
          width: "44vw",
          height: "62vh",
          transform: "translateY(-50%)",
          opacity: 0,
          borderRadius: "16px",
          boxShadow:
            "0 30px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,107,26,0.2)",
        }}
      >
        <canvas
          ref={canvasRef}
          className="block h-full w-full"
          style={{
            display: linkageFailed ? "none" : "block",
            width: "100%",
            height: "100%",
          }}
        />
        {linkageFailed && (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-navy-2 to-navy">
            <StaticLinkageSVG />
          </div>
        )}
      </div>

      {/* ------ All eight scenes (always mounted, faded by GSAP) ------ */}
      <OpeningAddress ref={scene1Ref} />
      <TitleCard ref={scene2Ref} />
      <Mission ref={scene3Ref} />
      <TechnicalDepth ref={scene4Ref} />
      <Maths ref={scene5Ref} />
      <Testing ref={scene6Ref} />
      <KillerDemo ref={scene7Ref} />
      <Close ref={scene8Ref} />

      {/* ------ Black fade overlay used at start/end ------ */}
      <div
        ref={fadeRef}
        className="pointer-events-none absolute inset-0 bg-black"
        style={{ opacity: 1 }}
        aria-hidden="true"
      />

      {/* ------ Replay button (post-roll only) ------ */}
      <ReplayButton visible={done} onClick={replay} />
    </div>
  );
}

export default App;
