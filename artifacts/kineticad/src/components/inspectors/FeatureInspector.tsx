// Routes the right-panel inspector to the appropriate per-feature-type
// editor when `featureEditor` is open.

import { useKinetiCADStore } from "@/state/store";
import ExtrudeInspector from "./ExtrudeInspector";
import RevolveInspector from "./RevolveInspector";

export default function FeatureInspector() {
  const editor = useKinetiCADStore((s) => s.featureEditor);
  if (!editor.open) return null;
  if (editor.type === "extrude") return <ExtrudeInspector />;
  if (editor.type === "revolve") return <RevolveInspector />;
  return null;
}
