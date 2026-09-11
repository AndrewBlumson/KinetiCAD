# Replit handoff

Use the existing KinetiCAD Replit project so its domain, secrets and publishing
settings stay attached to the same app.

The current source extends the gallery to six demos, replaces static Material
studio with the equal-force experiment, and adds file-button labels/tooltips.
The six-demo actual-CAD physics report, material-force experiment and Stewart
lift/endpoint-clearance reports pass. The post-arc-fix production build and
local Chrome Stewart run pass. All 79 tests passed in serialized runs,
including mass/regeneration after the arc fix. The final local windmill
browser canary also passes; public deployment acceptance remains pending. Current evidence
is recorded separately from the earlier five-demo Chrome bundle; see
[Physics verification](PHYSICS-VERIFICATION.md) and the
[current Chrome record](force-stewart-browser-results.json).

1. Save any outstanding Replit edits, then fetch the GitHub repository and
   check out `codex/built-in-demo-gallery` in Replit's Git interface. Review
   any differences before replacing local changes.
2. Run `pnpm install --frozen-lockfile`, then the verification commands in
   [Physics verification](PHYSICS-VERIFICATION.md). This repository already
   specifies Node 24 in `.replit`.
3. Build using the app's existing deployment configuration. The CAD Vite
   configuration requires both `PORT` and `BASE_PATH`; its public route is
   `/app/`. For a local production check, use:

   ```sh
   PORT=5184 BASE_PATH=/app pnpm run build
   PORT=5184 BASE_PATH=/app node artifacts/kineticad/serve.mjs
   ```

4. Open the preview as a top-level Chrome page. Check all six cards under
   **Demos**, the updated gimbal shafts/bearings, simulation controls and
   **Return to my model**. Read the numerical console measurements alongside
   the actual rendered movement. For Material force lab, run both 0.5 and
   1 mN, compare measured acceleration/travel, pause/resume, and confirm the
   result holds at two simulated seconds. For Stewart platform, inspect all
   six actuators during the coordinated lift, compare the deck with the
   independent leg-length reference, and confirm the six-second hold.
   Check the five labelled file buttons and their hover/keyboard tooltips,
   including the explanation for disabled Load project inside a demo.
5. Republish from Replit, then repeat the windmill's unchanged π ±5e-7 rad/s
   gate after five simulated seconds at the public URL. Record the deployed
   revision and results. Local tests do not replace this final check.

If importing a ZIP instead, import it into a separate project first and carry
over the intended publishing configuration deliberately. A source archive
does not include secrets, dependency directories, generated build output or
the original Replit project's domain attachment.

This change adds the built-in demo gallery, physics corrections, a real
equal-force experiment and a six-actuator Stewart demonstration. The Stewart
programme is a symmetric vertical lift with ideal joints and motors, not a
general six-axis controller or a certified payload simulation. This change does
not implement the proposed draw-a-path mechanism optimiser or an AI API.
The complete geometry and simulation computation remains in the browser.

The gallery preserves the original in-memory model while exploring examples.
Its **Save project** button downloads the current demo including edits. **Load project** is
disabled inside an example until **Return to my model**. Imported STEP shapes
remain available across gallery visits, but the existing loss on page refresh
is still documented and is not solved by this change.
