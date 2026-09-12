import type { KinetiCADStore } from '../../state/store';

type HoleSelectionState = Pick<KinetiCADStore, 'featureEditor' | 'selection' | 'setFeatureEditorHoleParams' | 'clearSelection'>;

/** Consume the pick without discarding the face needed by the second click. */
export function consumeHoleSelection(state: HoleSelectionState): void {
  const editor = state.featureEditor, selection = state.selection;
  if (!editor.open || editor.type !== 'hole' || !selection || !('partId' in selection)
    || selection.partId !== editor.partId) return;
  if (selection.kind === 'face') {
    state.setFeatureEditorHoleParams({ ...editor.params, targetFace: selection.faceId, positionUV: null });
    // TopologyPicker uses this retained face selection to interpret the next
    // click as a UV position. Clearing it here restarts stage one forever.
  } else if (selection.kind === 'point-on-face' && selection.faceId === editor.params.targetFace) {
    state.setFeatureEditorHoleParams({ ...editor.params, positionUV: [...selection.uv] });
    state.clearSelection();
  }
}

export function clearHoleFace(state: HoleSelectionState): void {
  const editor = state.featureEditor;
  if (!editor.open || editor.type !== 'hole') return;
  state.setFeatureEditorHoleParams({ ...editor.params, targetFace: null, positionUV: null });
  state.clearSelection();
}
