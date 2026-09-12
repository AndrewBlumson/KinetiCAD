# KinetiCAD documentation

Start with [Current status](CURRENT-STATUS.md). It identifies the implementation
baseline, Replit provenance, available features and unfinished acceptance gates.

## Using or resuming the project

- [Main README](../README.md): features, controls, installation and scope.
- [Current developer handover](../HANDOVER.md): architecture and continuation rules.
- [Replit handoff](REPLIT-HANDOFF.md): bring the source into the existing Replit project, test and publish deliberately.
- [Replit build notes](../replit.md): current engineering guidance followed by original dated build history.
- [Next implementation stages](NEXT-IMPLEMENTATION-TODO.md): active task order.
- [Known issues and follow-up](KNOWN-ISSUES-AND-FOLLOW-UP.md): original issues reconciled with current evidence, plus future acceptance checks.

## Verification: what was tested and how

- [Current four-bar stage catalog](FOUR-BAR-TEST-CATALOG.md): all 348 passing tests across 51 files, with source links and actual timings.
- [Current stage acceptance](four-bar-validation.json): source provenance, unchanged-input check, complete results and [raw events](evidence/four-bar/suite-events.jsonl).
- [Prior baseline test catalog](TEST-CATALOG.md): all 298 names, source locations, statuses and purposes from the completed `8e954ab` audit; separate standalone measurement scripts.
- [Raw baseline test inventory](test-inventory-results.json): actual test events and recorded source provenance from that documentation audit run.
- [Mathematics and physics](MATHEMATICS-AND-PHYSICS.md): equations, units, independent references, errors, tolerances and model limits.
- [Physics verification](PHYSICS-VERIFICATION.md): cross-feature numerical evidence and browser/publication gates.
- [Simulator capability audit](simulator-capability-audit.md): supported physical behaviour versus explicit exclusions.
- [Report provenance](REPORT-PROVENANCE.md): why dated measurements and hashes are preserved, and how to reproduce rather than relabel them.

The four-bar stage passed **348/348 tests**, without failures or skips, and the
full workspace typecheck/build. Its [feature guide](FOUR-BAR-PATH-VERIFICATION.md)
separates search, native geometry, solver and interface evidence. The older
298-test catalog retains its historical source scope. Andrew's testing and
publication acceptance remain separate from local automated and Chrome checks.

## Feature-specific records

| Feature | Specification and evidence |
| --- | --- |
| Project Save/Load and recovery | [PROJECT-RECOVERY.md](PROJECT-RECOVERY.md) |
| STEP/STL assembly export | [ASSEMBLY-EXPORT.md](ASSEMBLY-EXPORT.md) |
| Material force experiment | [MATERIAL-FORCE-VERIFICATION.md](MATERIAL-FORCE-VERIFICATION.md) |
| Stewart geometry/workspace | [STEWART-WORKSPACE-AUDIT.md](STEWART-WORKSPACE-AUDIT.md) |
| Contact/friction experiment | [CONTACT-BENCH.md](CONTACT-BENCH.md) |
| Elastic beam calculation | [ELASTIC-BEAM.md](ELASTIC-BEAM.md) |
| Adjustable crank-slider | [CRANK-SLIDER-VERIFICATION.md](CRANK-SLIDER-VERIFICATION.md) |
| Numeric sketch editing | [SKETCH-DIMENSIONS-VERIFICATION.md](SKETCH-DIMENSIONS-VERIFICATION.md) |
| Direct Boolean result simulation | [BOOLEAN-SIMULATION-VERIFICATION.md](BOOLEAN-SIMULATION-VERIFICATION.md) |
| Local four-bar path designer | [FOUR-BAR-PATH-VERIFICATION.md](FOUR-BAR-PATH-VERIFICATION.md) |
| Creator profile and desktop access | [CREATOR-PROFILE-AND-DESKTOP-ACCESS.md](CREATOR-PROFILE-AND-DESKTOP-ACCESS.md) |

## Actual browser checks, recorded by stage

Codex used computer use against the real application in desktop Chrome. The
following are scoped observations of their recorded revisions, not one claim
that every feature was clicked again on the latest bundle.

1. [Baseline Chrome acceptance](CHROME-ACCEPTANCE-2026-09-12.md): demos, native features, project recovery, files and engineering tabs.
2. [Crank-slider Chrome checks](CRANK-SLIDER-CHROME-2026-09-12.md): controls, motion, pause/reset, Save/Load and refresh.
3. [Sketch-dimension browser checks](SKETCH-DIMENSIONS-VERIFICATION.md#actual-chrome-interaction): see that record's browser section for the actual edited geometry and downloaded files.
4. [Boolean browser checks](BOOLEAN-SIMULATION-VERIFICATION.md#chrome-checks-on-the-actual-application): result material/ground, joint picking, stale attachment rejection, motion and recovery. The subsequent [native file-reopening record](evidence/boolean-reopen/browser.json) and [screenshot](evidence/boolean-reopen/after-load-and-refresh.png) close the fixed-joint fixture's actual Load, run controls and refresh gate. This is not a native reopening claim for every joint fixture.
5. [Four-bar Chrome checks](evidence/four-bar/browser.json): 60 mm preset search/build, native Save/Load/refresh, saved-target preservation, Pause/Resume/Reset and manual-material reference invalidation. Valid custom paths used the keyboard editor. Seven drawing-handler tests exercise a closed pointer stroke and invalid/cancelled input; no successful curved mouse gesture is claimed in Chrome. Four real-Three-matrix label tests separately cover displayed material-point projection and lifecycle.

## Historical records

- [Original May handover](history/HANDOVER-2026-05-17.md): preserved unchanged, including limitations that have since been fixed or superseded. Do not use it as current setup guidance.
- [First September implementation checklist](IMPLEMENTATION-TODO.md): the completed 166-test milestone, not the latest total.
- Dated JSON reports and older browser records retain their original measurements and source identities. Use the provenance guide to interpret them.

KinetiCAD remains the Replit-built project created by Andrew and Kevin Blumson.
Later Codex development and testing are credited separately. Replit publication
and acceptance on the public route remain explicit steps.
