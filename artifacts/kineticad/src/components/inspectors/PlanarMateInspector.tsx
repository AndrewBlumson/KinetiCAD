// Existing project files can contain planar mates. Preserve those records for
// review/deletion, but do not offer creation of an unsupported physical joint.
import { useKinetiCADStore } from '@/state/store';
import { getAssemblyBodyName } from '@/state/assemblyBodies';
import MateInspectorShell from './MateInspectorShell';

export default function PlanarMateInspector() {
  const editor = useKinetiCADStore(s => s.mateEditor);
  const assembly = useKinetiCADStore(s => s.assembly);
  if (!editor.open || editor.params.type !== 'planar') return null;
  const names = [editor.params.partA, editor.params.partB].map(id => getAssemblyBodyName(assembly, id) ?? '—');
  return <MateInspectorShell heading="Planar mate unavailable" canApply={false} statusText="This joint type cannot be applied.">
    <p className="text-xs leading-relaxed text-amber-400" role="status">
      Planar constraints are not supported in the assembly simulation. A project
      containing this mate cannot run until it is removed or replaced.
    </p>
    <p className="text-xs leading-relaxed text-muted-foreground">
      Choose a supported joint that represents the intended mechanism:
      revolute, prismatic, spherical or fixed.
    </p>
    {editor.mode === 'edit' && <p className="text-xs text-muted-foreground">{names[0]} ↔ {names[1]}</p>}
  </MateInspectorShell>;
}
