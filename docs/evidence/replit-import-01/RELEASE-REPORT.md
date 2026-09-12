# Replit import verification

## Source and scope

- Incoming GitHub release: `d245ee6046a0990f590cda21ac1d805b135bbb3b`.
- The user had already pulled this release before verification. The initial working tree was clean and `HEAD` matched the handover exactly.
- No additional pull, merge, push, reset or source replacement was performed. A direct GitHub remote query timed out, so this record does not independently establish whether GitHub `main` advanced after the handover.
- Application source, dependency manifests, lockfile, CAD/physics engine versions, routing and publishing configuration remain unchanged. No database migration, secret change, repository visibility change or publication was performed.
- Only fresh verification evidence was added here. The uploaded handover remains gitignored under `attached_assets/`; it was not added to product documentation.
- Verification ran from the incoming source commit. A separate Replit checkpoint identifier was not available during the run; the platform's subsequent checkpoint must not be confused with the incoming GitHub revision.

## Environment and automated results

| Check | Result |
| --- | --- |
| Host | Replit Linux x64 |
| Node | `24.13.0` |
| pnpm | `10.26.1` |
| Frozen dependency installation | Passed, committed lockfile unchanged |
| Full workspace typecheck | Passed |
| Serial CAD suite | **402 passed across 57 files**, zero failures, skips or cancellations |
| Reported test duration | **191.627 seconds** |
| Source stability | **528 captured source inputs unchanged** |
| Historical report restoration | Both original reports restored and verified |
| CAD production build | Passed with `PORT=25157 BASE_PATH=/app` |
| Landing production build | Passed with `PORT=18150 BASE_PATH=/` |
| API production build | Passed |
| Dependency audit | **Zero advisories**, exit code 0; point-in-time dependency result, not a full security certification |
| Development HTTP checks | **26/26 passed** through the existing shared proxy |

The CAD build emitted non-fatal sourcemap-location messages for three UI files and a large-chunk warning. Neither was suppressed, and the build exited successfully.

See `summary.json`, `tests.jsonl`, `suite-events.jsonl`, `frozen-install.txt`, `typecheck.txt`, the three build logs, `audit.json`, and `http-preview.json`.

## Browser acceptance

The current preview was tested in a separate automated browser context, without changing the user's saved models.

- Landing launch navigation and `/story`, `/terms`, `/privacy` passed.
- Public content and profile/support/footer links were inspected.
- Both CAD routes correctly blocked phone and tablet touch contexts.
- Desktop CAD interaction acceptance is blocked by the automated browser's WebGPU context creation failure. A bounded read-only clarification confirmed that `navigator.gpu` exists but `await navigator.gpu.requestAdapter()` returns `null`, without an exception.
- The initial screenshot caption incorrectly described the visible centre panel as the WebGPU message. It actually shows the welcome panel. The GPU clarification confirmed that the welcome panel obscures the underlying unsupported-browser message. This is a separate existing usability issue; no source fix was made during import verification.
- No imported-model editing, Undo/Redo, actual project download/reopen, malformed-load protection, current/previous recovery, Boolean native reopening or simulation lifecycle was completed in that browser pass.
- Gallery motion, material experiments, Stewart targets, Engineering tests, crank-slider, four-bar freehand drawing and numeric browser tolerances therefore remain unverified on Replit. Automated test success and earlier Codex evidence do not replace these browser checks.
- No payment was made and no external checkout integration was added.

See `browser-acceptance.json` and `browser-gpu-clarification.json`. `landing-preview.jpg` is a direct screenshot of the current development landing page.

## Publication status and build identity

The existing public deployment is attached to `https://kineticad.co.uk`. It was not republished during this verification.

| Surface | Public entry before publication | Locally built candidate entry |
| --- | --- | --- |
| Landing | `/assets/index-CnYyFwDr.js` | `/assets/index-ByrLL69G.js` |
| CAD | `/app/assets/index-DoZSoV00.js` | `/app/assets/index-C9rIVqTg.js` |

The old public landing and CAD entry pages returned HTTP 200. Their different asset names confirm that this check must not be presented as acceptance of the candidate release on the public domain.

See `public-before-publication.json` and `production-build-fingerprints.json`. Build fingerprints are comparison evidence, not a promise that a subsequent publishing environment produces byte-identical bundles.

## Remaining release gates

1. Obtain WebGPU-capable browser acceptance for the outstanding CAD workflows, with actual saved-file/recovery checks and unchanged numerical tolerances.
2. The owner republishes the existing project, retaining its custom domain and service routing.
3. Confirm the new served build identity and repeat relevant route, WebGPU, numerical, project/recovery and public-profile checks on the published domain.

**Conclusion:** frozen installation, automated tests, production builds, dependency audit and development HTTP checks passed. Full Replit CAD browser sign-off and publication remain outstanding. The candidate has not been declared live.