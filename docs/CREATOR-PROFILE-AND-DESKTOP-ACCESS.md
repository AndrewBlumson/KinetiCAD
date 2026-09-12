# Creator profile and desktop access — 12 September 2026

This stage adds the user's public profile links and enforces the desktop-only CAD policy. It changes presentation and application startup, not the geometry or physics model.

## Delivered behaviour

- The landing hero credits Andrew Blumson and links to a dedicated creator section with four profile cards.
- Home, Story, Terms and Privacy share one footer with Andrew's attribution, all four profiles, company details and contact links.
- Profile destinations are `https://andrewblumson.com/`, `https://adevious.co.uk/`, `https://x.com/Andrew_Blumson` and `https://www.linkedin.com/in/andrewblumson/`. External profile links open a new tab with `noopener noreferrer` and an accessible new-tab notice.
- Author metadata identifies Andrew; publisher metadata identifies Adevious AI. The existing favicon PNG is also provided in a lossless ICO container for the browser's conventional `/favicon.ico` request.
- Mobile visitors can read the public website, creator links and legal pages. They cannot launch the CAD application. Both the landing page and CAD startup use the same device detector.
- Known phone/tablet user agents, iPadOS's Macintosh identity with multiple touch points, and coarse-pointer-only devices receive the desktop-required screen. A mouse attached to a recognised mobile device does not bypass it. Window width does not exclude desktop users; Windows touch laptops with a fine pointer remain eligible.
- Direct `/app/` and `/app/simulator` visits pass through the startup gate. The application is dynamically imported only in the supported branch, before recovery, stores, CAD and physics workers can initialise. No continue-anyway control is provided.

This is a browser device-eligibility check, not a security boundary against deliberately spoofed browser signals.

## Verification

| Check | Result |
| --- | --- |
| Pure desktop-support tests | 9 passed, 0 failed. Covers phones, tablets, desktop-mode iPadOS, mouse-equipped mobile devices, touch-only devices, touch laptops, normal desktops and narrow windows. |
| Full workspace typecheck and production build | Passed with `PORT=5185 BASE_PATH=/app pnpm run build`. |
| Landing production build at its correct root | Passed with `PORT=5186 BASE_PATH=/ pnpm --filter @workspace/landing build`. |
| Independent source and built-entry review | Passed. CAD HTML has no App module preload; the initial JS imports App only inside the supported branch. |
| Chrome desktop landing | Hero attribution, creator anchor, four cards and shared footer inspected in the rendered page. Direct `/#creator` reload initially hit the existing route scroll-to-top behaviour; it now honours the anchor, verified with a fresh reload. Landing typecheck/build passed again after that fix. |
| Chrome navigation | Footer Privacy → Story → Terms → Home exercised. Destinations, headings and shared profile links checked. |
| Narrow public website | Creator cards and legal footer inspected at 390 × 844. Public information remains readable; this is not mobile CAD support. |
| Chrome DevTools touch emulation | Fresh direct visits to production `/app/` and `/app/simulator` showed only the desktop-required screen. Reloading the landing page showed its desktop-only holding page and profiles, with no Launch CAD link. |
| Chrome desktop startup regression | After disabling device emulation, the existing project recovered in the modeller. The crank-slider demo ran to COMPLETE at 8.00 s with 4 bodies and 4 joints; the displayed final position was 125.000 mm measured/calculated, with 0.0001 mm position error. Returning to the original model restored its 40 mm crank, 150 mm rod and -30 RPM drive. |
| Console and favicon | A temporary Vite import-resolution error occurred while the shared source file was being created. Fresh landing reloads succeeded after that file existed; no new runtime errors appeared in the final landing/desktop CAD checks. The previously missing `/favicon.ico` now returns HTTP 200. Historical messages were not treated as new failures or silently presented as a clean session. |
| Metadata and favicon structure | JSON-LD parsed successfully with expected author/publisher/profile values; ICO payload equals the original 32 × 32 PNG bytes. |

Browser checks used the actual Chrome interface and native DevTools, not injected app state. Device emulation was disabled and temporary viewport overrides removed afterwards. The return-home link uses `/`, as required on the combined deployed host; the separate local CAD and landing servers do not exercise that cross-app production routing.

The prior 195-test crank-slider report and earlier 166-test release snapshot remain historical evidence for their respective source revisions. They were not regenerated or relabelled for this presentation/startup stage. No new claim of universal physical accuracy is made here.

## Release state

Prepared on the private `codex/built-in-demo-gallery` branch for user review. The public Replit site has not been republished. Physical-device testing and final deployed routing acceptance remain release checks. The next CAD implementation stage remains paused for the user's testing.
