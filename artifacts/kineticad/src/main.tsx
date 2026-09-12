import { lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { isDesktopSupported } from "../../shared/desktopSupport";
import { DesktopRequired } from "./DesktopRequired";
import "./index.css";

const root = createRoot(document.getElementById("root")!);
const supported = isDesktopSupported({
  userAgent: navigator.userAgent,
  platform: navigator.platform,
  maxTouchPoints: navigator.maxTouchPoints,
  hasCoarsePointer: window.matchMedia("(any-pointer: coarse)").matches,
  hasFinePointer: window.matchMedia("(any-pointer: fine)").matches,
});

if (!supported) {
  root.render(<DesktopRequired />);
} else {
  // Keep the entire application graph behind eligibility. In particular, a
  // blocked direct /app visit must not mount recovery, stores, scenes or workers.
  const App = lazy(() => import("./App"));
  root.render(
    <Suspense fallback={<p role="status" className="p-6 text-sm text-slate-300">Loading KinetiCAD…</p>}>
      <App />
    </Suspense>,
  );
}
