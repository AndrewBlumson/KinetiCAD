# Hosting KinetiCAD on Vercel

The public repository and MIT licence remain unchanged. The migration uses the existing landing page and CAD sources, with the same OpenCascade, Rapier and Three.js versions.

## Build

- Repository root, Node.js 24, pnpm 10.28.2.
- Install: `corepack pnpm install --frozen-lockfile`.
- Build: `pnpm run build:vercel`.
- Output: `dist`.
- The landing pages are prerendered from their existing React components.
- CAD remains a browser-only WebGPU application under `/app` and `/app/simulator`.
- The small `/api/healthz` function runs in London. The legacy Express server, database workspace and mockup sandbox are not deployed.
- No database, login provider or application secrets are required for this deployment.

The build materialises the simulator entry page so direct links and refresh work with clean URLs. Unknown pages and missing resources return real 404 responses. Static content uses Vercel's revalidation and CDN caching; wildcard immutable headers are deliberately avoided because they also cache missing assets.

## Data and external services

Designs, recovery copies, imported files and exports remain on the visitor's device. Keeping the same HTTPS domain preserves access to the existing browser storage. Users should still download their editable project files as backups. OpenCascade WASM is fetched from its existing pinned jsDelivr URL; Google Fonts and optional outbound support links are retained.

## Releases and checks

The existing GitHub `main` branch is linked to the `kineticad` Vercel project. Check a preview before releasing changes. For updates, run type checking and the applicable CAD tests, then verify the actual desktop WebGPU workflow as well as the deployment build. Engine upgrades require the full regression suite and manual geometry/simulation checks; do not blindly merge dependency upgrades.

The generated `/release.json` identifies the source revision. The canonical host is `kineticad.co.uk`; `www` redirects to it. Vercel-generated hosts carry `X-Robots-Tag: noindex, nofollow`, while the canonical public domain remains crawlable.

After release, verify landing/story/legal pages, direct CAD and simulator navigation, refresh, demo loading, simulation, project save/load/recovery and STEP/STL export. A successful Vite build alone does not validate WebGPU or geometry.

## Recovery

Promote a previously verified Vercel deployment for a code rollback. This does not restore browser storage: project recovery is local to the visitor's device. Keep downloaded project files separately. Before retiring an old host, preserve its source and DNS configuration and validate the custom domain on the replacement.
