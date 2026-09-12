import { useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { DesktopLanding } from "./components/DesktopLanding";
import { MobileHolding } from "./components/MobileHolding";
import TermsPage from "./pages/TermsPage";
import PrivacyPage from "./pages/PrivacyPage";
import StoryPage from "./pages/StoryPage";
import NotFound from "./pages/not-found";
import { isDesktopSupported } from "../../shared/desktopSupport";

function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => {
    const anchor = document.getElementById(window.location.hash.slice(1));
    if (anchor) anchor.scrollIntoView();
    else window.scrollTo(0, 0);
  }, [location]);
  return null;
}

function detectMobile(): boolean {
  return !isDesktopSupported({
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    maxTouchPoints: navigator.maxTouchPoints,
    hasCoarsePointer: window.matchMedia("(any-pointer: coarse)").matches,
    hasFinePointer: window.matchMedia("(any-pointer: fine)").matches,
  });
}

function Home() {
  if (detectMobile()) return <MobileHolding />;
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
