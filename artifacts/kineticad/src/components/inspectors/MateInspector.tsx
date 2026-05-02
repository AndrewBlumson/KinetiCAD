// Phase 7 — Mate inspector router.
//
// Reads the `mateEditor` slice and dispatches to the per-type sub-inspector
// based on `params.type`. The sub-inspectors share the same outer shell:
//
//   - Heading ("<Type> Mate" or "Edit <Name>")
//   - Stage indicator ("Click first piece on Part A..." / "Click second
//     piece on a different part..." / "Ready to apply")
//   - Type-specific body (parts/pivots/motor params)
//   - Inline error in #FF6B6B
//   - Apply / Cancel / Delete (edit-mode) buttons
//
// All five inspectors subscribe to `selection` changes via `useEffect`.
// They consume the picker selection (face / edge / point-on-face / part),
// run the validators in `MatePickerCoordinator`, and advance the editor
// stage (`pick-a` → `pick-b` → `ready`) as picks land.

import { useKinetiCADStore } from "@/state/store";
import RevoluteMateInspector from "./RevoluteMateInspector";
import PrismaticMateInspector from "./PrismaticMateInspector";
import SphericalMateInspector from "./SphericalMateInspector";
import FixedMateInspector from "./FixedMateInspector";
import PlanarMateInspector from "./PlanarMateInspector";

export default function MateInspector() {
  const editor = useKinetiCADStore((s) => s.mateEditor);
  if (!editor.open) return null;
  switch (editor.params.type) {
    case "revolute":
      return <RevoluteMateInspector />;
    case "prismatic":
      return <PrismaticMateInspector />;
    case "spherical":
      return <SphericalMateInspector />;
    case "fixed":
      return <FixedMateInspector />;
    case "planar":
      return <PlanarMateInspector />;
  }
}
