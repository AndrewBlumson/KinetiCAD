import { useEffect, useState } from "react";
import { DesktopLanding } from "./components/DesktopLanding";
import { MobileHolding } from "./components/MobileHolding";

function detectMobile(): boolean {
  const touchDevice =
    window.matchMedia("(hover: none) and (pointer: coarse)").matches;
  const manyTouchPoints = navigator.maxTouchPoints > 1;
  return touchDevice || manyTouchPoints;
}

export default function App() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(detectMobile());
  }, []);

  if (isMobile) return <MobileHolding />;
  return <DesktopLanding />;
}
