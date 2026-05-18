import { useEffect, useState } from "react";
import { Switch, Route, useLocation } from "wouter";
import { DesktopLanding } from "./components/DesktopLanding";
import { MobileHolding } from "./components/MobileHolding";
import TermsPage from "./pages/TermsPage";
import PrivacyPage from "./pages/PrivacyPage";
import StoryPage from "./pages/StoryPage";
import NotFound from "./pages/not-found";

function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location]);
  return null;
}

function detectMobile(): boolean {
  const touchDevice =
    window.matchMedia("(hover: none) and (pointer: coarse)").matches;
  const manyTouchPoints = navigator.maxTouchPoints > 1;
  return touchDevice || manyTouchPoints;
}

function Home() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(detectMobile());
  }, []);

  if (isMobile) return <MobileHolding />;
  return <DesktopLanding />;
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/story" component={StoryPage} />
        <Route path="/terms" component={TermsPage} />
        <Route path="/privacy" component={PrivacyPage} />
        <Route component={NotFound} />
      </Switch>
    </>
  );
}
