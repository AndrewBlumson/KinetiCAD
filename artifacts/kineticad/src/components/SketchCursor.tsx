// DOM-overlay crosshair + coordinate label for sketch mode.
//
// Uses the module-level `sketchUiEvents` bus rather than Zustand so that
// 60Hz pointer movement doesn't trigger any React re-renders. The cursor
// position is applied imperatively to a ref'd <div> via CSS transform.

import { useEffect, useRef } from "react";
import { useKinetiCADStore } from "@/state/store";
import { subscribeCursor } from "@/sketch/sketchUiEvents";

const CROSSHAIR_PX = 16;
const LABEL_OFFSET_X = 12;
const LABEL_OFFSET_Y = -12;

export default function SketchCursor() {
  const sketchActive = useKinetiCADStore((s) => s.sketchSession.active);
  const tool = useKinetiCADStore((s) => s.sketchSession.tool);

  const crosshairRef = useRef<HTMLDivElement | null>(null);
  const labelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!sketchActive) return;
    const unsubscribe = subscribeCursor((info) => {
      const crosshair = crosshairRef.current;
      const label = labelRef.current;
      if (!crosshair || !label) return;

      if (!info.visible) {
        crosshair.style.opacity = "0";
        label.style.opacity = "0";
        return;
      }

      // Position crosshair centred on the cursor.
      crosshair.style.transform = `translate3d(${info.screenX - CROSSHAIR_PX / 2}px, ${info.screenY - CROSSHAIR_PX / 2}px, 0)`;
      crosshair.style.opacity = "1";

      // Coordinate label only when there's a snap result (i.e. cursor is on
      // the sketch plane). Off-plane cursor still shows the crosshair so the
      // user can see where they are.
      if (info.snap) {
        const u = Math.round(info.snap.position[0]);
        const v = Math.round(info.snap.position[1]);
        label.textContent = `(${u}, ${v})`;
        label.style.transform = `translate3d(${info.screenX + LABEL_OFFSET_X}px, ${info.screenY + LABEL_OFFSET_Y}px, 0)`;
        label.style.opacity = tool === "idle" ? "0" : "1";
      } else {
        label.style.opacity = "0";
      }
    });
    return unsubscribe;
  }, [sketchActive, tool]);

  if (!sketchActive) return null;

  return (
    <>
      {/* Hide the system cursor inside the canvas while sketch mode is
        * active. Restored by the body when sketch exits since we're scoped to
        * <main>. */}
      <style>{`main[data-kineticad-canvas-host="true"] { cursor: none; }`}</style>

      <div
        ref={crosshairRef}
        aria-hidden
        style={{
          position: "fixed",
          left: 0,
          top: 0,
          width: CROSSHAIR_PX,
          height: CROSSHAIR_PX,
          pointerEvents: "none",
          zIndex: 50,
          opacity: 0,
          willChange: "transform, opacity",
        }}
      >
        {/* Two thin orange lines forming a crosshair. */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: 0,
            width: "100%",
            height: 1,
            background: "#FF6B1A",
            transform: "translateY(-0.5px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: 0,
            width: 1,
            height: "100%",
            background: "#FF6B1A",
            transform: "translateX(-0.5px)",
          }}
        />
      </div>

      <div
        ref={labelRef}
        aria-hidden
        data-testid="sketch-coord-label"
        style={{
          position: "fixed",
          left: 0,
          top: 0,
          pointerEvents: "none",
          zIndex: 50,
          opacity: 0,
          padding: "2px 6px",
          borderRadius: 3,
          background: "rgba(10, 14, 26, 0.85)",
          color: "white",
          fontFamily:
            '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
          fontSize: 11,
          lineHeight: "14px",
          whiteSpace: "nowrap",
          willChange: "transform, opacity",
        }}
      />
    </>
  );
}
