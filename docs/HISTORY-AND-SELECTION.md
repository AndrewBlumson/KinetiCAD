# Undo, Redo and object selection

Added in September 2026 to the original Replit-built KinetiCAD application.
Codex implemented these changes and performed the automated and actual Chrome
computer-use checks described below. The final combined local verification passed;
[Current status](CURRENT-STATUS.md) is the release acceptance entry point.

## Using Undo and Redo

The Modeller toolbar has labelled **Undo** and **Redo** buttons. Use **Ctrl+Z**
on Windows/Linux or **⌘Z** on macOS to undo; add **Shift** to redo. **Ctrl+Y**
also redoes. When a text or number field has focus, those keys belong to its
normal text editing, not the model history. Finish entering a number with Enter,
Tab or a click outside the field before using model Undo.

Undo restores committed parts, sketches, features, transforms, names, materials,
visibility, ground choices, Boolean operations, joints and saved simulation
settings together. A deleted part and its dependent joints/Boolean operations
return as one change. A movement-handle drag and a multi-part STEP import each
form one history entry. Applying an editor commits a change; temporary previews
and unfinished sketches are not separate model-history steps.

Apply or cancel an open editor before undoing. File operations, active drags,
restoration and committed geometry rebuilding temporarily disable history.
Restoring a model clears selection and returns simulation to its initial,
stopped design pose. A new edit after Undo replaces the old Redo branch.

History holds at most **50 changes** and **16 MiB of serialized document
snapshots**. Large edits can evict older entries, or clear history if one entry
alone exceeds the budget. That limit covers history strings, not all CAD-worker,
renderer or retained STEP-asset memory. Imported source assets remain available
while the session needs them; they are not copied into every history snapshot.

History is **in-memory**. Reload, Load project, recovery and entering/resetting/
leaving a demo begin a fresh history. Switching between Modeller and Simulator
keeps the document history, while resetting motion. Save project and autosave
retain the current restored model, not its Undo/Redo stack. See
[complete project recovery](PROJECT-RECOVERY.md) for portable backups and crash
recovery; those are different from reversing an edit.

## Selecting an object

In the Modeller, click a visible solid to select it. Its CAD edges are outlined
in orange, its row is selected, and the inspector shows the selected object.
Click empty canvas space to clear selection. Camera drags and movement-handle
drags do not count as selection clicks. Selection itself does not add history.

Native and imported parts expose their existing material, position, rotation
and feature controls. A finished Boolean shape shows its operation, source parts
and material, with **Edit Boolean operation** as an explicit action. Its position
and dimensions come from the source parts; it has no independent movement gizmo.

The nearest visible solid is selected. Hidden parts and consumed Boolean inputs
are excluded from canvas hits. A disconnected Boolean result may be selected
and edited as a modelling feature; that does not make it a valid single rigid
body or joint target. Face/edge picking inside feature and joint editors retains
its separate rules. Ordinary object selection is disabled during those edits
and in Simulator mode.

The permanent coloured axes mark the world origin. Movement handles belong to
the selected part's coordinate origin, which can differ from its shape's centre.
The grid and outlines are visual aids, not collision geometry or measurements.

## Verification method and retained evidence

The Undo checkpoint passed **369/369 automated tests**, zero failures/skips,
including **18 new history regressions**. Workspace typecheck and CAD production
build passed. [Checkpoint source identity and scope](evidence/history-selection/undo-checkpoint.json),
[all named results](evidence/history-selection/undo-suite.txt) and
[build log](evidence/history-selection/undo-build.txt) are retained.

The tests use the actual Zustand document actions and history controller. They
cover cascade deletion, stable IDs, committed feature/sketch changes, no-op and
invalid edits, redo branching, grouped/cancelled changes, bounded history,
excluded solver/selection/cache writes, operation/editor/rebuild locks, stale
asynchronous results and project/demo isolation. The imported-asset history test
uses controlled CAD responses to check asset identity and durable packaging;
actual browser tests below also use the shipped CAD worker.

Actual Chrome checks on a local production build covered:

| Action | Observed result / evidence |
| --- | --- |
| Delete rotated arc with a hinge, then Undo | Both return. The actual [download](evidence/history-selection/undo-cascade-restored.kineticad.json) exactly equals the original four-part assembly and hinge, including all coordinates, feature data and material IDs. |
| Import a four-solid STEP into the native assembly | One Undo removes all four imported parts; one Redo restores all four. |
| Delete one imported part, Undo and Save project | The [saved document](evidence/history-selection/undo-import-restored.kineticad.json) contains eight parts, the original hinge and the embedded STEP source. |
| Load that actual download, refresh, then Save again | The [new download](evidence/history-selection/undo-import-reopened-refreshed.kineticad.json) has an exactly equal assembly and STEP assets. Undo/Redo history is empty after reopening. |
| Position and material edits in development Chrome | Position 70→85 mm, Undo→70, keyboard Redo→85 and keyboard Undo→70. Aluminium→Brass clears abandoned Redo; Undo restores aluminium's 4.50 cm³ / displayed 0.012 kg readout. |
| Arrow-key numeric editing | Two increases followed by Tab retain 72 mm rather than reverting to the old typed draft. |

The restored model screenshot is retained [here](evidence/history-selection/undo-import-recovered.png).
No error/warning entries were captured by the Chrome developer-log tool after
that production refresh. This is a statement about the captured entries, not an
assertion that every possible browser error is excluded.

The final combined run passed **382/382 tests across 54 files**, with zero failures, cancellations or skips in **248.848 seconds** of Node test-runner time. Source inputs were unchanged throughout the capture and the two historical reports were restored byte-for-byte. The [complete catalog](HISTORY-SELECTION-TEST-CATALOG.md), [summary](evidence/history-selection/final/summary.json), [raw events](evidence/history-selection/final/suite-events.jsonl) and [per-test results](evidence/history-selection/final/tests.jsonl) retain the measured source and results. The full [workspace typecheck/build](evidence/history-selection/final-build.txt) and the [landing build at its root base path](evidence/history-selection/final-landing-build.txt) passed. Local runtime: Node 25.4.0 / pnpm 10.28.2; the actual Replit Node 24 environment remains a separate handoff check.

Thirteen new selection tests use real Three.js raycasting, transformed meshes and CAD-edge outlines. They cover nearest visible hit, native/Boolean overlap, hidden and consumed inputs, holes, disconnected compounds, mode/editor guards, maximum pointer excursion, latched gizmo ownership and outline cleanup. The original Windmill tolerance is unchanged.

The [final production Chrome record](evidence/history-selection/browser.json) adds these observed checks:

| Action | Observed result |
| --- | --- |
| Click a native solid, then drag its Z handle | Orange edges and matching inspector; the handle remains attached. One Undo restores the entire drag and keyboard Redo returns the same movement. |
| Type X = −44.123456 mm; Save, focus/leave the field and Save again | The two actual project files have exactly equal assemblies. Merely viewing a rounded display no longer changes saved precision. [Before](evidence/history-selection/precision-before-focus.kineticad.json), [after](evidence/history-selection/precision-after-focus.kineticad.json). |
| Use Cmd+Z in a focused number field | Model history is not triggered. Toolbar Undo after leaving the field restores the preceding deliberate numeric edit. |
| Hide a solid and click its previous location | It cannot intercept the ray; selection, outline and movement handles clear on the empty hit. |
| Click a finished Boolean result | Its material/operation/source details appear with an explicit Edit button and no independent transform handle. [Screenshot](evidence/history-selection/boolean-selected.png). |
| Open Boolean editor, click another solid and change material | Editor retains ownership. Apply changes Brass to Aluminium; Undo restores Brass. |
| Orbit with a selected Boolean | Camera changes; selected object and the Redo branch remain intact. |
| Enter Windmill, hide/Undo its post, return to my model | Demo edits work locally; original Boolean assembly returns with fresh history. |
| Landing, Story and Privacy navigation | Updated features, Replit/creator attribution and accurate storage/network facts render. [Feature screenshot](evidence/history-selection/landing-features.png). |

No error/warning entries were captured in either final Chrome tab. Earlier native/STEP import-reopen checks belong to the Undo checkpoint and are not falsely labelled as all reclicked on the final bundle. A first combined capture passed its tests but rejected source drift because the numeric-focus fix landed during it; that [rejected capture](evidence/history-selection/source-drift-checkpoint/summary.json) is retained separately, with its original report paths. Only the later unchanged-source capture is final acceptance.

These changes do not add new contact, friction, motor-force or structural physics. Existing independent numerical tests remain separate from
interface, state-restoration and export observations. Passing them does not
prove every possible CAD model or manufactured mechanism correct.


## Publication status

Local feature verification is complete. Public visibility, Replit deployment and dependency-security acceptance are separate: the [security review](DEPENDENCY-SECURITY-REVIEW.md) records 58 advisory records in the pinned dependency graph. Package versions were left unchanged at the user's request; that is not a security clearance. See the [release checklist](PUBLIC-RELEASE-CHECKLIST.md).
