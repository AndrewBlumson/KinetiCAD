# Public-release readiness — local preparation complete, release gates open

12 September 2026. Local audit snapshot: `80690884ceb9b46b991dfc0269bd39a631fe1cf1`
plus the reviewed working tree. Undo/redo and general object selection are
implemented. The final local capture passed **382/382 tests across 54 files**,
with workspace typecheck, full production build and scoped actual Chrome
acceptance complete. The [feature record](HISTORY-AND-SELECTION.md),
[test catalog](HISTORY-SELECTION-TEST-CATALOG.md),
[capture summary](evidence/history-selection/final/summary.json) and
[browser evidence](evidence/history-selection/browser.json) state that scope.
Earlier 351-test hinge results remain historical. Source/document preparation
is complete for the recorded feature stage; this does **not** declare public
release or deployment approved.

The later online dependency audit returned **58 advisory records** (11 critical,
28 high, 16 moderate, 3 low). Packages remain frozen at the owner's request.
See [dependency security review](DEPENDENCY-SECURITY-REVIEW.md) and its
[sanitised evidence](dependency-security-review.json). **Security readiness is
not cleared**; publication and deployment require separate explicit decisions
after reviewing the affected execution paths. A no-secret scan and passing
feature tests do not negate dependency advisories.

KinetiCAD remains the project originally built by Andrew Blumson and Kevin
Blumson with Replit Agent. Later Codex development and verification should stay
clearly credited without replacing that origin. The application is intended to
remain free. This audit changed no repository visibility, remotes, Git history,
deployment or external posts. Existing evidence is retained. A read-only GitHub metadata check on 12 September
2026 confirmed `AndrewBlumson/KinetiCAD` is **private**, with `main` as its
default branch. External issues, Actions, releases and the live Replit
environment still require their own publication check.

## Completed local inspection and acceptance

- The [publication rescan](evidence/history-selection/publication-scan.json)
  originally hashed **832 intended files**, including tracked and non-ignored new source,
  guides and evidence. It scanned **810 text files** outside dependencies,
  build/cache output and `.git`. No archive, environment/key/database filename
  or credential-pattern candidate was found in that inspected source area.
  No input changed during that recorded scan. A later [final source rescan](evidence/history-selection/final-publication-scan.json)
  includes the completed documentation and corrected notice inventory; the
  earlier report remains a dated snapshot with its additional metadata checks.
- All 14 locally reachable commits were inspected: 681 unique blobs, including
  663 text blobs checked for private-key/provider-token/credential-URL patterns.
  No matches or historical sensitive-file paths were found. Local author email
  entries use GitHub noreply addresses. The local remote URL contains no embedded
  credential, and no sensitive authentication config key was found.
- Seven STEP headers, seven embedded STEP occurrences representing two unique
  asset byte sequences, and four binary STL headers had no local-path/email
  flags. Embedded asset hashes matched. These are authored regression fixtures,
  and the scan did not replace geometry or raw evidence.
- The notice check passed again for 147 package versions and all 154 copied
  original texts. The security review's inspected browser import-graph hashes
  still matched the source, including the final edit guard. This does not
  resolve the separately disclosed dependency advisories.
- The final suite confirms unchanged source inputs and verified restoration
  of historical reports. [Workspace build](evidence/history-selection/final-build.txt),
  [typecheck](evidence/history-selection/final-typecheck.txt) and the explicit
  [root-route landing build](evidence/history-selection/final-landing-build.txt)
  passed. Actual Chrome acceptance covers the actions recorded in the browser
  evidence, including native/Boolean selection, movement history, precise input,
  keyboard guards and editor/demo isolation; it is not every possible input.
- The root reviewer visually inspected **all ten evidence PNG screenshots**
  (six four-bar, one Boolean reopening, three history/selection) and both Open
  Graph JPEGs. They show app/fixture UI without unrelated desktop/private data.
  The CAD Open Graph image is an old loading view; the landing image retains
  historical “NO LICENCE” artwork. That legacy artwork is retained and disclosed,
  not claimed to be refreshed; current text metadata says “No paid CAD licence”.
  The logo, favicon PNG and Apple touch icon were also visually reviewed. The
  ICO files were not visually decoded; the existing orrery video was not reviewed
  frame by frame. Two PNG icons have date text metadata without credential/path/
  email flags; the scan does not establish media ownership or licence rights.

These are bounded local pattern checks, not proof that every possible secret is
absent. Dependency binaries, unreachable Git objects, external GitHub refs,
issues/releases/actions and the deployed Replit environment were not scanned.
No credential values were printed or copied into this document.

## Concrete cleanup and review items

| Item | Observed source | Scoped action before release |
| --- | --- | --- |
| Credential exclusions added | [`.gitignore`](../.gitignore) now excludes `.env`/`.env.*`, private-key/certificate containers and common SSH-key names, with explicit value-free example/sample/template exceptions. No actual secret file was found in the earlier scan. | **Implemented locally.** Eleven representative credential paths were excluded and nine template/ordinary paths allowed by `git check-ignore --no-index`. Re-scan the final staged tree; ignoring a filename does not remove an already tracked file. |
| Automatic merge-time database write removed | [`.replit`](../.replit) still invokes [`scripts/post-merge.sh`](../scripts/post-merge.sh); the hook now runs only `pnpm install --frozen-lockfile`. Database work remains an explicit scaffold task. | **Implemented locally.** `bash -n` passed. An isolated fake-`pnpm` execution recorded exactly the frozen install and no database command; it did not install packages or touch a database. Preserve the existing Replit hook and frozen dependency graph. |
| Versioned third-party notice inventory added | [Third-party notices](../THIRD-PARTY-NOTICES.md) and the [full inventory](../licenses/README.md) cover 147 installed browser dependency versions, with 143 original installed texts and 11 upstream supplemental texts. The project [MIT licence](../LICENSE) is unchanged. | **Inventory implemented; distribution review remains bounded.** All copied hashes and installed metadata pass `node licenses/collect-notices.mjs --check`. Font Awesome artwork, externally loaded fonts and the OCCT exception have separate notices. One package's exact source-version correspondence and the exact OCCT binary's source/replacement arrangements remain explicitly recorded checks. Confirm notice availability in the actual final distribution; do not call this legal certification. |
| Public story copy corrected | [`StoryPage.tsx`](../artifacts/landing/src/pages/StoryPage.tsx) now describes four supported joints, numerical integration, ideal constraints and the unchanged Windmill tolerance. It preserves the original Replit/creator attribution, credits later Codex work and links to the third-party notices. | **Implemented locally; landing typecheck passed.** Review the final rendered page and ensure its notice link resolves on the intended published branch. The bounded windmill test is not certification of arbitrary mechanisms or material strength. |
| Storage/privacy facts refreshed | [`PrivacyPage.tsx`](../artifacts/landing/src/pages/PrivacyPage.tsx) now describes IndexedDB current/previous recovery, locally downloaded project/STEP assets and the font/jsDelivr requests present in the [CAD HTML](../artifacts/kineticad/index.html), [landing HTML](../artifacts/landing/index.html) and [CAD worker](../artifacts/kineticad/src/cad/cadWorker.ts). | **Implemented locally; landing typecheck passed.** The source policy date is 12 September 2026; publication has not occurred. Confirm actual production network behaviour and hosting policy at publication. No design-upload, analytics or new data-processing service was introduced. This factual source review is not legal clearance. |
| Evidence includes intentional provenance metadata | The [rescan](evidence/history-selection/publication-scan.json) lists 41 files with local/temp paths: 29 include machine-specific provenance and the remainder use generic temporary/virtual paths. Eleven email-bearing current files are three public business/legal pages and eight upstream copyright/metadata notices. Historical email-bearing blobs belong to those same three public pages. | Preserve originals, measured hashes and dates. No credential-pattern candidates were found; this is not proof that all possible private information is absent. Do not silently scrub/rewrite raw reports or Git history. Review the final intended file set, including intentional business contact details, before publication. |
| Portable capture command added; historical script retained | [`docs/evidence/four-bar/capture-suite.py`](evidence/four-bar/capture-suite.py) remains a historical machine-specific record. The current [`capture-test-suite.mjs`](../scripts/src/capture-test-suite.mjs) and [`capture-test-reporter.mjs`](../scripts/src/capture-test-reporter.mjs) are checked-in portable tooling used for the final capture. | **Implemented and used locally.** Follow the current feature/test guide. Do not run the historical Python capture unchanged on a fresh clone. The standard `test:all` command remains the direct test entry point; the capture wrapper adds source/report provenance. |
| Current feature documentation refreshed | [README](../README.md), [handover](../HANDOVER.md), [status](CURRENT-STATUS.md), [known issues](KNOWN-ISSUES-AND-FOLLOW-UP.md), [Replit notes](../replit.md) and the [history guide](HISTORY-AND-SELECTION.md) describe the completed bounded Undo/selection stage and its 382-test acceptance. | **Current stage recorded.** Keep dated 166/195/237/298/348/351 and earlier Undo checkpoint evidence historical. Do not add standalone scenario counts to the suite total or present numeric evidence as a universal proof. Final contribution/security guides, all local links and archive contents receive the final handoff pass. |
| Frozen dependencies have published advisories | The successful online audit returned 58 records / 56 unique GHSA IDs across 20 package names. The registry marked all dependencies non-development, so the [review](DEPENDENCY-SECURITY-REVIEW.md) separates explicit codegen, build/development tools, API middleware and unreferenced scaffolding using current source paths. | **Open decision gate.** Keep versions unchanged as instructed. Record a publication decision and a separate actual-host deployment decision; do not describe the repository as security-clean. Review Orval's untrusted-input/code-generation risks and any exposed development/API processes first. No exploit or package upgrade was attempted. |

The dependency licence labels were read from installed locked package metadata
and original licence files. Missing npm texts were supplemented from pinned
upstream source notices, with source URLs, hashes and limitations retained in
the [supplemental manifest](../licenses/supplemental-manifest.json). Seventeen
missing package notices have the release's source revision; the
`react-remove-scroll-bar` 2.3.8 reference is explicitly not proof of its exact
source tree. No legal certification was performed. A subsequent registry
vulnerability audit and bounded source triage are recorded in the security
review above; they do not establish exploitability or a clean security result.
No package was upgraded. The exact-distribution checks in the
[notice guide](../THIRD-PARTY-NOTICES.md) remain open.

Scoped cleanup verification: landing TypeScript check passed, all 154 copied
notice hashes passed, the 20-path ignore check passed, shell syntax and the
isolated merge-hook check passed, and the authored source/documentation whitespace check passed. Original upstream
notices and raw build logs retain their exact whitespace and line endings;
their staged whitespace warnings are not silently rewritten. These checks
are separate from the subsequently completed 382-test run and production Chrome
acceptance linked above. Neither local verification set published the policy
or verified the external repository/deployment.

## Source archive and handoff

- [x] Finish the recorded feature source/tests and current-stage documentation,
  with local acceptance linked above. Include new files deliberately; a ZIP made
  from an older Git commit omits uncommitted work.
- [x] Build a source archive from the reviewed file set or verified final commit,
  retaining the license, lockfile, Replit configuration, guides, fixtures and
  evidence. Exclude `.git`, dependencies, build/cache output, local environment
  files, database dumps, temporary logs and unrelated archives. Existing tracked
  verification logs are intentional evidence, not generic temporary logs.
- [x] List the archive contents and run bounded credential/name checks. Check
  for local `.env` files, dependency trees and unrelated desktop files. Record its hash and
  source revision. The staged archive extracted successfully; all file bytes
  matched the staged Git tree, and all 309 captured test inputs and the original
  May handover matched. The final ZIP is exported alongside the checkout, with
  a `KinetiCAD-demo-gallery-release.json` containing its commit, hash, file count
  and repeated extraction checks. No source ZIP is committed inside the repo.
  These checks do not establish absence of every possible secret.
- [ ] Test a clean extraction/clone with `pnpm install --frozen-lockfile`, the
  configured Node 24 runtime and serial OCCT tests. The recorded local Node
  25.4.0 result is not a Node 24 pass. Record the final complete test count and
  full workspace typecheck/build result for the finished source.
- [ ] Reconfirm [Replit handoff](REPLIT-HANDOFF.md) against the actual existing
  project's build/start/base-path settings. Preserve the `/app/` CAD route,
  landing routes, pinned WASM URL, cache handling and domain attachment. A Git
  source archive does not contain Replit secrets or external publishing setup.

## Final release gates

- [x] Complete the bounded Undo/redo and object-selection stage, with 382 tests,
  full workspace typecheck/build and actual Chrome acceptance recorded. Preserve
  the original Windmill gate and separate automated cases from browser actions.
- [x] Refresh current feature documentation and link the final local evidence,
  retaining historical records and the Replit origin/later Codex attribution.
- [x] Rescan the intended source/evidence and reachable history, and inspect the
  ten evidence screenshots plus two Open Graph JPEGs as recorded above.
- [x] Check new/changed files after the original scan and validate the staged
  source archive. The final rescan and archive metadata retain the scope.
- [ ] Confirm the remaining existing media's intended inclusion/provenance;
  do not claim every legacy asset was refreshed or every video frame reviewed.
- [x] Implement the scoped merge-hook, credential-exclusion, notice-inventory and
  source-copy changes above, with their local verification recorded.
- [ ] Complete the remaining notice/distribution review and verify the rendered
  public-copy/notice links in the finished build. Source cleanup is not a
  deployment or a blanket licence-compliance finding.
- [ ] Resolve the explicit publication/deployment decisions for the disclosed
  dependency advisories while honouring the package freeze. Record the actual
  exposed processes and accepted scope; no security-clean claim is authorised
  by the housekeeping, feature tests or registry source-path triage.
- [ ] Check the actual GitHub repository/settings, intended branch/revision and
  external release artifacts before the owner-directed visibility change. This
  read-only metadata check confirmed private visibility and default branch main;
  issues, Actions, releases and external refs were not inspected or changed.
- [ ] Handle Replit publication separately, then exercise the actual public route
  in a fresh desktop session. Local source/test success does not prove that the
  public site serves the new build. Retain desktop-only CAD behaviour and public
  information-page access.

Final status: **local feature/source/document preparation and recorded acceptance
complete; release gates remain open**. The dependency decision, Node 24 clean
handoff, exact-distribution notices, existing media provenance and external
GitHub/Replit/public-route checks still need their own results.
