# Dependency security maintenance — 12 September 2026

This maintenance updates vulnerable build and code-generation dependencies,
hardens local server handling and records regression, build and browser checks.
The CAD and rigid-body engine versions remain pinned. The maintenance baseline
is commit `731c7d3f440b123e87036d10c1db1e2f17e006ea`; the release capture records
the exact source fingerprints for the later working tree.

The patched online `pnpm audit --json` completed with exit code **0**, an empty
advisory map and an empty `muted` list. No findings were suppressed. This is a
point-in-time dependency-registry result, not proof that the application is free
of security defects or that its deployment has been checked.

## Recorded audit progression

| Recorded stage | Critical | High | Moderate | Low | Total records |
| --- | ---: | ---: | ---: | ---: | ---: |
| Original baseline | 11 | 28 | 16 | 3 | 58 |
| First Orval update stage | 0 | 12 | 12 | 3 | 27 |
| Final patched graph | 0 | 0 | 0 | 0 | 0 |

The [comparison](evidence/security-maintenance/audit-comparison.json) retains the
baseline counts, source commit and advisory paths. The
[release registry response](evidence/security-maintenance/audit-release.json)
reports 523 dependencies, no advisories and no muted entries. Its development
dependency classification is registry output; it is not a runtime reachability
analysis. The original [review](DEPENDENCY-SECURITY-REVIEW.md) and
[sanitised baseline evidence](dependency-security-review.json) remain historical
records and have not been rewritten as a passing audit.

## Changes to the dependency graph

The [workspace settings](../pnpm-workspace.yaml),
[API generator manifest](../lib/api-spec/package.json) and
[lockfile](../pnpm-lock.yaml) are the authoritative version records. The changes
were directed at reported vulnerable tools and transitive dependencies rather
than a general upgrade of the CAD application.

| Area | Resolved patched versions |
| --- | --- |
| OpenAPI generator | Orval and its `@orval/*` family **8.32.0** |
| Browser build and API build | Vite **7.3.6**, esbuild **0.28.1** |
| Code-generation parser and documentation dependencies | js-yaml **4.3.2**, fast-uri **3.1.7**, brace-expansion **5.0.9**, markdown-it **14.3.1**, linkify-it **5.0.2** |
| Source transformation and browser targeting | `@babel/core` **7.29.6**, PostCSS **8.5.23**, Browserslist **4.28.7**, baseline-browser-mapping **2.11.0**, YAML **2.9.1**, Nano ID **3.3.18** |
| API middleware and routing | body-parser **2.3.0**, path-to-regexp **8.4.0**, qs **6.16.0** |
| Remaining reported transitive packages | Picomatch **2.3.2** and **4.0.4**, Lodash **4.18.0**, fflate **0.8.3** |

Three.js **0.184.0**, OpenCascade.js **2.0.0-beta.94e2944**, the separately loaded
OCCT **7.6.2** kernel and Rapier **0.12.0** remain unchanged. Passing tests from the
previous lockfile do not, by themselves, validate the new native build tools.

Orval 8.32.0 was selected after the first update because upstream published two
additional critical advisories absent from the saved baseline: a
[mock enum-generation issue](https://github.com/orval-labs/orval/security/advisories/GHSA-w68h-2r38-4cqq)
and a [core constant-generation issue](https://github.com/orval-labs/orval/security/advisories/GHSA-x4fj-j9hr-ccr6).
Their patched ranges begin at 8.32.0; the
[release notes](https://github.com/orval-labs/orval/releases/tag/v8.32.0) identify
the corresponding fixes. These findings concern generated code and controlled
OpenAPI input, not a demonstrated exploit against KinetiCAD's CAD imports.

The normal **1,440-minute minimum release age remains enabled**. Fourteen exact
exceptions cover only `orval@8.32.0` and its thirteen matching `@orval` packages;
there is no new wildcard exemption. npm reported the final package publication
at **12 September 2026, 13:51:48.246 UTC**. These entries become redundant after
**13 September 2026, 13:52 UTC** and should then be removed. Other versions remain
subject to the existing age policy. See the
[pnpm exact-version exception reference](https://pnpm.io/settings/dependency-resolution#minimumreleaseageexclude).

## Generator compatibility

The [Orval configuration](../lib/api-spec/orval.config.ts) now explicitly targets
TanStack Query **5** and points at the client package manifest. This prevents an
undetected/catalogue dependency from silently selecting Query 4 output. Both
outputs use `formatter: "prettier"` in place of the obsolete `prettier: true`
setting. These are supported [output options](https://orval.dev/docs/reference/configuration/output/).

The checked-in `/healthz` specification, `/api` base URL, custom fetch mutator and
client/Zod generation remain in place. No external-reference allowlist or
validation bypass was added. Actual generation and library typechecking passed;
the [generator log](evidence/security-maintenance/orval-codegen.txt) is retained.
The generator's `clean: true` option rewrites its dedicated generated directories,
so regeneration remains an explicit reviewed maintenance command.

## Verification status at this document freeze

| Check | Status |
| --- | --- |
| Release online dependency audit | Passed: exit 0, zero advisories, zero muted entries; [raw response](evidence/security-maintenance/audit-release.json) |
| Actual code generation and library typecheck | Passed; see generator log |
| Notice inventory and pinned upstream text comparison | Passed for the recorded scope; [notice review](../licenses/security-update-review.json) |
| Release full regression suite on Node 24 | **Passed: 402/402 cases across 57 files in 80.936 seconds**, zero failures/skips/cancellations; 527 source inputs unchanged and historical reports restored; [summary](evidence/security-maintenance/release/summary.json), [catalog](SECURITY-MAINTENANCE-TEST-CATALOG.md) |
| Workspace typecheck and production build | **Passed**; [workspace log](evidence/security-maintenance/final-workspace-build.txt). The final Story/Terms/Privacy landing source also passed its [typecheck](evidence/security-maintenance/story-typecheck.txt) and [root build](evidence/security-maintenance/story-build.txt). |
| Fresh disposable-copy install and typecheck | **Passed** with Node 24 ARM64 and the frozen lockfile; [install](evidence/security-maintenance/clean-copy-install.txt), [typecheck](evidence/security-maintenance/clean-copy-typecheck.txt). Local macOS, not the Replit host. |
| Local listening-server HTTP smoke | **Passed: 35/35 checks**; [request/response evidence](evidence/security-maintenance/http-smoke.json). Its recorded landing bundle predates the final legal/Story text changes; see the later build and Chrome checks below. |
| Actual Chrome acceptance of the patched build | **Passed for the recorded paths**; [browser evidence](evidence/security-maintenance/browser.json). This is a scoped local check, not a retest of every feature. |
| GitHub `main` source handoff | Verify the remote commit against the released source before the Replit pull; a source handoff is not a deployment. |
| Replit checkpoint and publication | **Pending user workflow** |

The final local checks use the bundled **Node 24.19.0 on macOS ARM64**. The
machine's default **Node 25.4.0 x64** runtime does not match the ARM64 native
packages in the refreshed install; switching back to it is not a valid way to
repeat this installation's native-tool checks. This local Node 24 run will still
be separate evidence from a Linux Replit install and deployment.

The main licence and Replit origin are unchanged. The original application was
built by Andrew Blumson and Kevin Blumson with Replit Agent; this is later Codex
maintenance. Repository visibility and deployment remain separate from the
local checks recorded here. The [notice inventory](../THIRD-PARTY-NOTICES.md) still records the exact
react-remove-scroll-bar 2.3.8 source-reference limitation and the separate OCCT
distribution checks.

## Recorded local browser scope

The [Chrome record](evidence/security-maintenance/browser.json) covers an imported
fixture's material change and Undo/Redo, waiting for recovery to report saved
before refreshing, and reopening the actual downloaded project through the native
file chooser. It also records the optional support link opening Buy Me a Coffee
in a new tab while retaining the app, the homepage creator section, and navigation
to Story, Terms and Privacy. The Windmill ran to 24.77 simulated seconds, paused
and reset to zero. These observations exercise loading, persistence, navigation
and basic simulation controls; the run is not a fresh browser measurement of the
strict angular-speed tolerance or of every mechanism.

Captured warning/error console logs were empty for these checks. That bounded
log observation does not establish that no other session or untested path can
produce an error. The 35 local HTTP checks are separate from both these browser
observations and the 402 automated test cases; their counts are not combined.

## GitHub and Replit handoff

GitHub `main` is the source handoff. Verify its remote commit against the released
source, then:

1. Pull that source into the existing Replit project.
2. Review the pulled source, install from the lockfile, and check the application
   in Replit's configured Node 24 environment.
3. Create Replit's own checkpoint/commit for that source.
4. Publish that checkpoint through Replit and verify the resulting public routes.

Replit installation, checkpointing and publication remain pending; local checks
do not establish their completion.

The GitHub push transfers source; it is not a GitHub deployment and does not
publish the website. Public-repository visibility is also a separate decision.
Keep production start settings and the actual external routes in the release
check: a zero-result dependency audit covers registry-reported findings, and does
not establish acceptance of deployment, secrets handling, imported-file safety
or licence obligations. See the [handoff guide](REPLIT-HANDOFF.md) and
[release checklist](PUBLIC-RELEASE-CHECKLIST.md).

## Optional app support

The landing page, its shared footer and the app mode bar link to
[Support KinetiCAD](https://buymeacoffee.com/andrewblumson). Support payments are
optional and received by Adevious Ltd; the app remains free to use. These are
ordinary external links opening a new tab with `noopener noreferrer`, without
an embedded payment widget, new package or feature gate. The Terms and Privacy
pages describe the separate payment services and link to the
[Buy Me a Coffee privacy policy](https://buymeacoffee.com/privacy-policy),
[Stripe privacy policy](https://stripe.com/privacy) and
[platform terms](https://buymeacoffee.com/terms). Those copy and link changes are
included in the release capture and final landing build; this verification is
not a legal-compliance certification.

The existing Story content is preserved, with one added sentence identifying the
separate motor/load, contact/friction and beam experiments and their stated
limits. It does not extend those models to ordinary CAD assemblies. The main MIT
licence and third-party notices remain unchanged.
