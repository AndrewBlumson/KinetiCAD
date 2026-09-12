import type { Assembly, SimulationState } from './schemas';

/** History contains editable source data, never renderer buffers or solver poses. */
export type HistoryDocument = { assembly: Assembly; simulation: SimulationState };
export type HistoryToken = number;
export type DocumentHistoryState = {
  canUndo: boolean;
  canRedo: boolean;
  historyBusy: boolean;
  historyBlockedReason: string | null;
  historyRevision: number;
  historyUndoLabel: string | null;
  historyRedoLabel: string | null;
};
export type DocumentHistoryActions = {
  undo: () => Promise<boolean>;
  redo: () => Promise<boolean>;
  clearHistory: () => void;
  beginHistoryTransaction: (label?: string) => HistoryToken;
  endHistoryTransaction: (token: HistoryToken) => void;
  cancelHistoryTransaction: (token: HistoryToken) => Promise<boolean>;
  beginHistoryOperation: (label: string) => () => void;
  setHistoryGeometryPending: (pending: boolean) => void;
};

type HistoryHost = HistoryDocument & {
  mode: string;
  sketchSession: { active: boolean };
  sketchDimensionsEditing: boolean;
  featureEditor: { open: boolean };
  booleanEditor: { open: boolean };
  mateEditor: { open: boolean };
};
type Entry = { before: string; after: string; label: string; bytes: number };
export const DOCUMENT_HISTORY_LIMITS = { steps: 50, bytes: 16 * 1024 * 1024 } as const;
const runtimeKeys = new Set(['running', 'paused', 'simulationTimeMs']);

export function captureHistoryDocument(state: HistoryDocument): HistoryDocument {
  return structuredClone({
    assembly: { ...state.assembly, parts: state.assembly.parts.map(part => {
      const { volumeCm3: _volume, massKg: _mass, meshHash: _mesh, ...source } = part;
      return source;
    }) },
    simulation: { ...state.simulation, running: false, paused: false, simulationTimeMs: 0 },
  });
}

function configurationChanged(a: SimulationState, b: SimulationState): boolean {
  if (a === b) return false;
  const left = a as unknown as Record<string, unknown>, right = b as unknown as Record<string, unknown>;
  return [...new Set([...Object.keys(left), ...Object.keys(right)])]
    .some(key => !runtimeKeys.has(key) && left[key] !== right[key]);
}

/** Immutable serialized entries impose both an entry and a UTF-16 storage bound.
 * Imported STEP bytes stay in the existing durable asset registry, not copied
 * fifty times into history. Oversize edits drop history rather than retain a
 * partial document that could not be restored safely. */
export function createDocumentHistory(limits: { steps: number; bytes: number } = DOCUMENT_HISTORY_LIMITS) {
  let past: Entry[] = [], future: Entry[] = [];
  const size = () => [...past, ...future].reduce((sum, item) => sum + item.bytes, 0);
  const trim = () => {
    while (past.length + future.length > limits.steps || size() > limits.bytes) {
      if (past.length) past.shift();
      else future.shift();
    }
  };
  return {
    record(before: string, after: string, label = 'model edit') {
      if (before === after) return false;
      future = [];
      past.push({ before, after, label, bytes: 2 * (before.length + after.length + label.length) });
      trim();
      return true;
    },
    clear() { past = []; future = []; },
    peek(direction: 'undo' | 'redo') { return (direction === 'undo' ? past : future).at(-1); },
    move(direction: 'undo' | 'redo', entry: Entry) {
      const source = direction === 'undo' ? past : future;
      if (source.at(-1) !== entry) return false;
      source.pop();
      (direction === 'undo' ? future : past).push(entry);
      return true;
    },
    get stats() { return { undo: past.length, redo: future.length, bytes: size() }; },
  };
}

/** Imported source references are reconstructed before publication. Native
 * restores need no worker call; the scene regenerates from the restored history
 * using its existing exact source hashes. This deliberately retains imported
 * caches: clearing those would destroy the source needed by a deleted part. */
export async function prepareHistoryRestore(document: HistoryDocument): Promise<HistoryDocument> {
  if (!document.assembly.parts.some(part => part.features.some(feature => feature.type === 'imported-step'))) return document;
  const { createProjectDocument, restoreProjectAssets } = await import('../project/projectAssets');
  // A live, validated asset needs no worker invocation. Resolve the CAD worker
  // only if the existing persistence layer actually needs to export/import.
  const getKernel = async () => (await import('../cad/cadClient')).getCadKernel();
  // Undo restores an earlier committed document, including an unfinished model
  // whose unrelated constraints/controller configuration may currently be
  // invalid. Package only imported source features; do not run a file parser
  // over, or silently normalize, the rest of that recorded document.
  const importedParts = document.assembly.parts.flatMap(part => {
    const features = part.features.filter(feature => feature.type === 'imported-step');
    return features.length ? [{ ...part, features, sketches: [], materialId: 'aluminium-6061' }] : [];
  });
  const packaged = await createProjectDocument({ mode: 'modeller',
    assembly: { id: 'history-assets', name: 'History source assets', parts: importedParts,
      mates: [], groundPartId: '', booleanFeatures: [] },
    simulation: { running: false, paused: false, simulationTimeMs: 0, timeStepMs: 1000 / 60,
      gravity: [0, 0, -9810], speedMultiplier: 1 },
  }, getKernel);
  await restoreProjectAssets(packaged, {
    importStep: async (...args) => (await getKernel()).importStep(...args),
    exportAssemblyStep: async (...args) => (await getKernel()).exportAssemblyStep(...args),
  });
  const sourceIds = new Map(packaged.state.assembly.parts.map(part => [part.id,
    new Map(part.features.flatMap(feature => feature.type === 'imported-step' ? [[feature.id, feature.shapeId] as const] : []))]));
  return captureHistoryDocument({ ...document, assembly: { ...document.assembly,
    parts: document.assembly.parts.map(part => ({ ...part, features: part.features.map(feature =>
      feature.type === 'imported-step' ? { ...feature, shapeId: sourceIds.get(part.id)!.get(feature.id)! } : feature) })) } });
}

export function createDocumentHistoryController<T extends HistoryHost>(adapter: {
  read: () => T;
  write: (patch: Partial<T> & DocumentHistoryState) => void;
  /** Clears selection/editor previews in the same atomic document publication. */
  resetTransient: () => Partial<T>;
  prepareRestore?: (document: HistoryDocument) => Promise<HistoryDocument>;
}) {
  const history = createDocumentHistory();
  let revision = 0, sequence = 0, restoring: number | null = null, geometryPending = false;
  const operations = new Map<number, string>();
  let transaction: { tokens: number[]; before: string; label: string } | null = null;
  const serialize = (state: HistoryDocument) => JSON.stringify(captureHistoryDocument(state));
  const editorReason = (state: T) => state.sketchSession.active || state.sketchDimensionsEditing
    || state.featureEditor.open || state.booleanEditor.open || state.mateEditor.open
    ? 'Finish or cancel the current edit before using Undo or Redo.' : null;
  const blocked = (state: T, ignoreTransaction = false) => {
    if (restoring !== null) return 'Restoring the model…';
    const editor = editorReason(state);
    if (editor) return editor;
    if (operations.size) return `Wait for ${operations.values().next().value} to finish.`;
    if (geometryPending) return 'Wait for the model geometry to finish rebuilding.';
    if (!ignoreTransaction && transaction) return 'Finish the current model change first.';
    return null;
  };
  const state = (host = adapter.read()): DocumentHistoryState => {
    const reason = blocked(host);
    return { canUndo: !reason && !!history.peek('undo'), canRedo: !reason && !!history.peek('redo'),
      historyBusy: restoring !== null, historyBlockedReason: reason, historyRevision: revision,
      historyUndoLabel: history.peek('undo')?.label ?? null, historyRedoLabel: history.peek('redo')?.label ?? null };
  };
  const publish = () => adapter.write(state() as Partial<T> & DocumentHistoryState);
  const clear = () => {
    history.clear(); transaction = null; restoring = null;
    operations.clear(); geometryPending = false; revision++;
  };
  const record = (before: T, after: T) => {
    // Opening another editor or navigating invalidates an outstanding restore
    // even when the user closes it again before the async preparation returns.
    if (restoring !== null && (editorReason(after) || before.mode !== after.mode)) {
      restoring = null; revision++;
    }
    if (before.assembly === after.assembly && !configurationChanged(before.simulation, after.simulation)) return;
    const left = serialize(before), right = serialize(after);
    if (left === right) return;
    revision++;
    if (!transaction) history.record(left, right);
  };
  const restore = async (direction: 'undo' | 'redo' | 'cancel', token?: number): Promise<boolean> => {
    const before = adapter.read();
    if (blocked(before, direction === 'cancel')) return false;
    const group = transaction;
    if (direction === 'cancel' && (!group || group.tokens.at(-1) !== token)) return false;
    const entry = direction === 'cancel' ? null : history.peek(direction);
    if (direction !== 'cancel' && !entry) return false;
    const source = serialize(before), sourceRevision = revision, sourceMode = before.mode;
    const target = direction === 'cancel' ? group!.before : direction === 'undo' ? entry!.before : entry!.after;
    const request = ++sequence;
    restoring = request; publish();
    try {
      const prepared = await (adapter.prepareRestore ?? prepareHistoryRestore)(JSON.parse(target));
      const current = adapter.read();
      if (restoring !== request || revision !== sourceRevision || serialize(current) !== source || current.mode !== sourceMode
        || editorReason(current) || operations.size || geometryPending) return false;
      if (direction === 'cancel') transaction = null;
      else if (!history.move(direction, entry!)) return false;
      restoring = null; revision++;
      adapter.write({ ...adapter.resetTransient(), ...captureHistoryDocument(prepared), ...state(current) } as Partial<T> & DocumentHistoryState);
      return true;
    } finally {
      if (restoring === request) { restoring = null; publish(); }
    }
  };
  const actions: DocumentHistoryActions = {
    undo: () => restore('undo'), redo: () => restore('redo'),
    clearHistory() { clear(); publish(); },
    beginHistoryTransaction(label = 'model edit') {
      if (restoring !== null || editorReason(adapter.read())) throw new Error(blocked(adapter.read()) ?? 'Finish the current edit first.');
      const token = ++sequence;
      if (transaction) transaction.tokens.push(token);
      else transaction = { tokens: [token], before: serialize(adapter.read()), label };
      publish();
      return token;
    },
    endHistoryTransaction(token) {
      if (!transaction?.tokens.includes(token)) return; // A document boundary invalidates old gesture tokens.
      if (transaction.tokens.at(-1) !== token) throw new Error('Finish the nested model change first.');
      transaction.tokens.pop();
      if (!transaction.tokens.length) {
        history.record(transaction.before, serialize(adapter.read()), transaction.label);
        transaction = null;
      }
      publish();
    },
    cancelHistoryTransaction: token => restore('cancel', token),
    beginHistoryOperation(label) {
      const token = ++sequence;
      operations.set(token, label || 'the current operation'); publish();
      let released = false;
      return () => { if (!released) { released = true; operations.delete(token); publish(); } };
    },
    setHistoryGeometryPending(pending) {
      if (geometryPending === pending) return;
      geometryPending = pending; publish();
    },
  };
  return { actions, state, record, clear };
}
