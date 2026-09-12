# Dependency security review — decision pending

> **Historical baseline:** This document records the initial 58-finding audit
> before the user authorised dependency updates. Its references to unchanged
> packages and unresolved findings describe that earlier snapshot. The later
> [12 September security maintenance](SECURITY-MAINTENANCE-2026-09-12.md) records
> the patched zero-advisory audit and the separate verification/release gates.
> The original evidence and triage below are retained unchanged.

The 12 September 2026 online `pnpm audit --json` request succeeded and returned
**58 advisory records: 11 critical, 28 high, 16 moderate and 3 low**. Its exit
code was 1 because findings remain. **This repository is not being described as
security-clean.** Packages and the lockfile remain unchanged, as requested.
Publication and deployment decisions remain pending; this triage approves neither.

The [sanitised evidence](dependency-security-review.json) retains advisory IDs,
affected installed versions, dependency paths, severity, upstream URLs and
reported fixed-version ranges. It omits long advisory descriptions, payloads and
local machine paths. It records the original report hash, source hashes and
inspection limits. The 58 records represent **56 unique GHSA IDs across 20
package names**: two Picomatch advisories appear separately for two installed
major versions. These are dependency findings, not 58 demonstrated exploits.

## What the reported paths mean here

The registry response counted all 518 dependencies as non-development and
reported zero development dependencies. That classification does not describe
this workspace's actual execution paths. For example, most React application
libraries live under `devDependencies`, while Orval is an explicit generator
and Vite processes development/build inputs. The table below classifies the
reported paths using the current manifests, imports and commands.

| Source role | Records | Severity split | Current source observation |
| --- | ---: | --- | --- |
| Explicit OpenAPI generation and its tooling | 30 | 11 critical, 16 high, 3 moderate | `lib/api-spec → orval` and its parser/documentation dependencies. The generator reads the checked-in specification; normal install/build scripts do not invoke it. |
| Browser build/development tools | 16 | 9 high, 6 moderate, 1 low | Vite, PostCSS, Babel, Browserslist, Nano ID, Picomatch and YAML. Their inputs are source/build configuration and development-server requests, not CAD project geometry. |
| API-server scaffold runtime | 6 | 1 high, 4 moderate, 1 low | Express brings `path-to-regexp`, `qs` and `body-parser`. The current router exposes a static health route and installs body parsers. Whether that server is publicly running requires a deployment check. |
| API-server build tool | 1 | 1 low | The scaffold calls esbuild's build API; its build script does not start an esbuild development server. |
| Unreferenced chart scaffold | 2 | 1 high, 1 moderate | Recharts brings Lodash. Each app has a `ui/chart.tsx` wrapper, but neither browser entry-point graph reaches it. |
| Type-definition dependency | 1 | 1 moderate | `@types/three → fflate`. No application import/call to `fflate` or `unzipSync` was found. |
| Separate mockup-sandbox tooling | 2 | 1 high, 1 moderate | `fast-glob → micromatch → picomatch` in the mockup workspace, separate from the two product entry points. |

Every advisory's original path remains in the JSON, including versions and
categories. These are source-based exposure observations, not suppressions or
changes to the registry's severity ratings.

## Most relevant decisions

**OpenAPI generation is the highest-severity group.** All 11 critical records
flag Orval 8.5.3. The reported cases concern attacker-controlled OpenAPI values
becoming executable generated JavaScript, including generated Zod modules; a
further high-severity record concerns external/local references. See the
[upstream Orval advisory](https://github.com/orval-labs/orval/security/advisories/GHSA-p4cg-3328-rvfg).
The current [configuration](../lib/api-spec/orval.config.ts) explicitly produces
both a client and Zod schemas from [openapi.yaml](../lib/api-spec/openapi.yaml).
The explicit [codegen command](../lib/api-spec/package.json) is absent from
the [normal build](../package.json) and [merge hook](../scripts/post-merge.sh).
Keep untrusted specifications/refs out of that command under the package freeze;
do not import or execute unreviewed generated output. The API scaffold imports
generated validation code, so treating generation as “only a developer tool”
does not erase the consequences of malicious generated code. No exploit was
attempted, and each registry-reported version range was retained rather than
independently proven against the older installed generator.

**Development-server exposure is a real configuration consideration.** The
[CAD](../artifacts/kineticad/vite.config.ts) and
[landing](../artifacts/landing/vite.config.ts) Vite configurations bind to
`0.0.0.0` and allow all hostnames for the existing Replit workflow. The flagged
[Vite file-deny bypass](https://github.com/vitejs/vite/security/advisories/GHSA-fx2h-pf6j-xcff)
has Windows/NTFS conditions; the other Vite record concerns Windows UNC/editor
handling. Those conditions were not reproduced. The audit does not establish
the operating system, process or access controls of the eventual public host.
Do not interpret a successful static build as acceptance of exposing a dev
server. PostCSS/Babel/source-map and glob/parser findings also matter when a
build processes untrusted CSS, maps, specifications or repository inputs.
The current product does not offer user-uploaded CSS/OpenAPI processing.

**The API scaffold is not the CAD engine, but its middleware still needs a
deployment decision.** Its [app](../artifacts/api-server/src/app.ts) installs
JSON and extended URL-encoded parsers before the
[static `/api/healthz` route](../artifacts/api-server/src/routes/health.ts).
The inspected source has no user-defined route patterns, custom invalid body
limit, `qs.stringify` call or `comma: true` parsing option. These observations
reduce some advisory-specific paths; they do not establish that all hostile
requests are harmless. Confirm whether this process is exposed at all, its
request limits and production configuration before accepting that surface.

**The Lodash reports need an actual call path.** The high-severity
[template-import issue](https://github.com/lodash/lodash/security/advisories/GHSA-r5fr-rjxr-66jc)
requires untrusted template import keys; the other record concerns `unset`/`omit`
paths. No direct Lodash use was found in the two application sources. Their
Recharts imports are confined to the unreferenced chart wrappers. This is a
reason to distinguish a present package from a demonstrated product attack
path, not a reason to erase its advisory from the inventory.

## Inspection and limits

A TypeScript syntax-tree walk followed value imports/exports, literal dynamic
imports, Vite `?worker` imports and worker URLs from both `src/main.tsx` entries.
It visited **145 CAD source/assets files and 16 landing source/assets files**,
with no unresolved local imports. Declaration-only imports were excluded. Both
chart wrappers were unreachable in that source graph. The installed dependency
closure of those external value imports contained no package/version flagged
by this particular registry report.

That last result is **not a clean bill of health for the shipped application**.
It is not a final bundle analysis, a full scan of code vendored inside external
libraries, runtime taint analysis, malicious-file testing or a penetration test.
It does not assess unknown vulnerabilities or independently audit OpenCascade,
Rapier/WASM, CDN-delivered files, browser extensions, the hosting environment or
secrets. Optional/peer dependency behaviour also needs its actual distribution
context. The registry's zero development count was not used as evidence that
everything ships to a browser. No attack payloads were executed and no package
version, lockfile, server setting or exposure setting was changed by this review.

## Release gate and repeatable follow-up

1. Keep the requested dependency freeze. Record an explicit owner decision about
   public source publication with this disclosure and, separately, about the
   actual runtime deployment. Neither decision is supplied by test counts or
   this document. A public source repository and a running network service have
   different exposure, but neither should be labelled security-clean here.
2. Verify the public host's exact build/start process and whether any Vite
   development server, mockup sandbox, API scaffold or code-generation command
   is exposed. Preserve the Replit project identity and inspect its actual
   configuration instead of inferring it from local ports.
3. If a later maintenance stage is authorised, review the affected package groups
   and actual patched ranges before changing them. Prioritise Orval and exposed
   development/build/server surfaces, preserve the numerical canaries and
   imported-project compatibility, then repeat full build/tests and browser
   acceptance. No automatic `audit fix`, forced upgrade or lockfile rewrite is
   part of this stage.
4. After the final reviewed source is frozen, rerun `pnpm audit --json` from the
   repository root with registry access. Preserve a fresh report/hash and compare
   IDs, versions, paths and severity; registry findings can change independently
   of the lockfile. Refresh the source reachability checks if imports or routes
   change, and inspect the actual production bundles/configuration before
   claiming runtime exclusion.

The [public-release checklist](PUBLIC-RELEASE-CHECKLIST.md) carries these open
security decisions alongside source cleanup, attribution and final verification.
