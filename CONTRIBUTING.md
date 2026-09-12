# Contributing to KinetiCAD

KinetiCAD was created by Andrew Blumson and Kevin Blumson with Replit Agent. It
remains a free, MIT-licensed, Replit-built project. Later contributions and
verification should credit their authors and tools without rewriting that origin.

Read [current status](docs/CURRENT-STATUS.md), [known issues](docs/KNOWN-ISSUES-AND-FOLLOW-UP.md)
and the [security review](docs/DEPENDENCY-SECURITY-REVIEW.md) before choosing work.
Do not treat an old handover or a past test total as the current acceptance record.

## Development

Use the committed pnpm workspace and lockfile. Replit specifies Node 24; the
recorded September local run used Node 25.4.0 and is labelled accordingly.

```sh
pnpm install --frozen-lockfile
PORT=5184 BASE_PATH=/app/ pnpm --filter @workspace/kineticad dev
```

Open the printed `/app/` URL in desktop Chrome with WebGPU support. The CAD
workspace intentionally blocks phones/tablets. The public information pages
remain readable on those devices. Keep file processing and the mechanism search
local; the existing geometry and physics paths require no paid AI API.

For landing development, run `PORT=5186 BASE_PATH=/ pnpm --filter @workspace/landing dev`
in another terminal. Its local development origin is separate from the CAD one;
the existing Replit router combines them at publication. Follow the
[Replit handoff](docs/REPLIT-HANDOFF.md) for deployment configuration.

## Checks for a change

Run focused tests while implementing, then the complete serial suite and build:

```sh
pnpm run typecheck
node scripts/src/capture-test-suite.mjs --output-dir docs/evidence/my-new-run
PORT=5184 BASE_PATH=/app/ pnpm run build
PORT=5186 BASE_PATH=/ pnpm --filter @workspace/landing build
```

Use a new evidence directory and do not edit source or run a second suite during
capture. The last command gives the standalone landing output its correct `/`
base; the CAD output keeps `/app/`. OCCT tests are memory-intensive and run
serially. See [report provenance](docs/REPORT-PROVENANCE.md) for raw results,
source fingerprints and preserving historical reports.

Test changed interactions in the real Chrome interface. For project changes,
include Save, native Load and full refresh with imported STEP assets; a visible
in-session model alone does not establish recovery. For picking, include moved
parts, occlusion, hidden inputs, camera and movement-handle drags. Keep failed
cases and declared limits in the record. Screenshot evidence should contain the
app, without unrelated desktop or private project content.

Physics changes need independent equations, units, assumptions, tolerances and
measured errors. Preserve the original Windmill 30 RPM gate of π ±5e-7 rad/s after
five simulated seconds. Do not loosen a tolerance simply to pass a failing test,
or claim that numerical tests certify every mechanism. Reference the
[mathematics and physics guide](docs/MATHEMATICS-AND-PHYSICS.md).

Keep dependency updates separate and tested. Update third-party notices when
the distributed dependency set changes. Never commit environment files, tokens,
private keys, customer models, dependencies or build output. Update current
guides and the known-issues register; preserve dated historical evidence.

Repository visibility changes, merging the release and publishing the existing
Replit project are separate maintainer decisions. See the
[release checklist](docs/PUBLIC-RELEASE-CHECKLIST.md).
