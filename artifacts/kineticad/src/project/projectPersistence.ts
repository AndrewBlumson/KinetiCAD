import type { PersistStorage, StorageValue } from 'zustand/middleware';
import { create } from 'zustand';
import { createProjectDocument, restoreProjectAssets } from './projectAssets';
import { MAX_PROJECT_BYTES, parseProjectDocument, parseProjectState, validateAssetBytes, type ProjectDocument, type ProjectState } from './projectDocument';
import { indexedDbProjectRepository, makeSnapshot, verifySnapshot, type ProjectSnapshot, type SnapshotRepository } from './projectRepository';

export const useProjectRecovery = create<{ status: 'loading' | 'ready' | 'saving' | 'error'; message: string; recovered: boolean; savedAt?: string; hasPrevious: boolean }>(() => ({ status: 'loading', message: '', recovered: false, hasPrevious: false }));
const cad = async () => (await import('../cad/cadClient')).getCadKernel();

/** Testable orchestration. No async operation can publish a project: callers
 * receive a validated document only after its assets are reconstructed. */
export function createProjectPersistence(options: {
  repository: SnapshotRepository;
  packageState: (state: ProjectState) => Promise<ProjectDocument>;
  restoreAssets: (document: ProjectDocument) => Promise<void>;
  readLegacy?: () => string | null;
  migrateLegacy?: (state: unknown, version: number) => unknown | Promise<unknown>;
  report?: (patch: Partial<ReturnType<typeof useProjectRecovery.getState>>) => void;
}) {
  let lastGood: ProjectSnapshot | undefined;
  let lastQueuedState = '';
  let queuedState: ProjectState | null = null;
  let writeQueue: Promise<void> = Promise.resolve();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let allowEmpty = false;
  let enabled = false;
  const report = options.report ?? (() => {});
  const normaliseError = (error: unknown) => error instanceof Error ? error.message : String(error);
  const validate = async (value: unknown) => {
    const doc = parseProjectDocument(value);
    await Promise.all(doc.assets.map(validateAssetBytes));
    await options.restoreAssets(doc);
    return doc;
  };
  const parseFile = async (text: string): Promise<ProjectDocument> => {
    if (text.length > MAX_PROJECT_BYTES) throw new Error('Project exceeds the 100 MB file limit.');
    const value = JSON.parse(text);
    if (value?.format === 'kineticad-project') return validate(value);
    if ((value?.version !== 8 && value?.version !== 9) || !value.state) throw new Error('Use a KinetiCAD project or a native version 8/9 model file.');
    const migrated = await options.migrateLegacy?.(structuredClone(value.state), value.version) ?? value.state;
    const state = parseProjectState(migrated);
    // Older downloaded files never contained STEP data. Reject rather than
    // opening a project whose solids disappear during the next refresh.
    if (state.assembly.parts.some((p) => p.features.some((f) => f.type === 'imported-step'))) throw new Error('This older file does not contain its imported STEP geometry. Re-import the original STEP file, then Save project again.');
    return validate({ format: 'kineticad-project', version: 1, stateVersion: 9, state, assets: [] });
  };
  const commit = (document: ProjectDocument): Promise<void> => {
    const task = writeQueue.then(async () => {
      const next = await makeSnapshot(JSON.stringify(document));
      if (next.sha256 === lastGood?.sha256) { report({ status: 'ready' }); return; }
      const previous = lastGood;
      await options.repository.commit(next, previous);
      lastGood = next;
      report({ status: 'ready', message: '', savedAt: next.savedAt, hasPrevious: !!previous });
    });
    writeQueue = task.catch(() => {});
    return task;
  };
  const flush = async () => {
    if (timer) { clearTimeout(timer); timer = undefined; }
    const state = queuedState;
    queuedState = null;
    if (!state) { await writeQueue; return; }
    // Include packaging in the same FIFO as commits. A slow legacy STEP
    // export must never commit after a newer loaded project.
    const task = writeQueue.then(async () => {
      report({ status: 'saving' });
      const document = await options.packageState(state);
      const next = await makeSnapshot(JSON.stringify(document));
      if (next.sha256 !== lastGood?.sha256) {
        const previous = lastGood;
        await options.repository.commit(next, previous);
        lastGood = next;
        report({ hasPrevious: !!previous });
      }
      report({ status: 'ready', message: '', savedAt: lastGood?.savedAt });
    });
    writeQueue = task.catch((error) => {
      lastQueuedState = ''; // A later edit/retry can attempt this state again.
      report({ status: 'error', message: `Autosave failed: ${normaliseError(error)} Your last successful recovery copy is retained. Download Save project to keep current edits.` });
    });
    await writeQueue;
  };
  const storage: PersistStorage<ProjectState> = {
    async getItem() {
      enabled = false;
      report({ status: 'loading', message: '' });
      if (allowEmpty) { allowEmpty = false; enabled = true; report({ status: 'ready' }); return null; }
      try {
        const saved = await options.repository.read();
        report({ hasPrevious: !!saved.previous });
        const errors: string[] = [];
        for (const [label, snapshot] of [['current', saved.current], ['previous', saved.previous]] as const) {
          if (!snapshot) continue;
          try {
            await verifySnapshot(snapshot);
            const doc = await parseFile(snapshot.payload);
            lastGood = snapshot; enabled = true;
            lastQueuedState = JSON.stringify(doc.state);
            report({ status: 'ready', recovered: label === 'previous', message: label === 'previous' ? 'The latest recovery copy could not be opened. Your previous complete project has been recovered.' : '', savedAt: snapshot.savedAt });
            return { state: doc.state, version: 9 };
          } catch (error) { errors.push(normaliseError(error)); }
        }
        if (errors.length) throw new Error(errors.join(' '));
        const legacy = options.readLegacy?.();
        if (legacy) {
          const doc = await parseFile(legacy);
          // Validate before entering the store; old localStorage is retained
          // as an additional legacy copy until the new atomic save succeeds.
          await commit(doc); enabled = true; lastQueuedState = JSON.stringify(doc.state);
          return { state: doc.state, version: 9 };
        }
        enabled = true; report({ status: 'ready' }); return null;
      } catch (error) {
        report({ status: 'error', message: `Project recovery stopped: ${normaliseError(error)} Stored copies have not been changed.` });
        throw error;
      }
    },
    setItem(_name, value: StorageValue<ProjectState>) {
      if (!enabled) return;
      const state = structuredClone(value.state);
      const key = JSON.stringify(state);
      if (key === lastQueuedState) return;
      lastQueuedState = key; queuedState = state;
      report({ status: 'saving' });
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { void flush(); }, 150);
    },
    // Zustand clearStorage must not erase the last-good generation silently.
    removeItem() { throw new Error('Recovery copies are retained. Open or start a project to replace the current workspace.'); },
  };
  return {
    storage, parseFile, flush,
    async load(text: string) {
      const doc = await parseFile(text);
      // Drain the old project's queued save first, preserving it as Previous.
      await flush();
      enabled = false;
      if (timer) { clearTimeout(timer); timer = undefined; }
      queuedState = null;
      try {
        await commit(doc);
        lastQueuedState = JSON.stringify(doc.state);
      } finally { enabled = true; }
      return doc;
    },
    async recoverPrevious() {
      const saved = await options.repository.read();
      if (!saved.previous) throw new Error('No previous recovery copy is available yet.');
      await verifySnapshot(saved.previous);
      return this.load(saved.previous.payload);
    },
    async exportRecoveryCopies() { return JSON.stringify({ ...await options.repository.read(), legacyState: options.readLegacy?.() ?? null }, null, 2); },
    allowEmptyOnce() { allowEmpty = true; },
  };
}

let migrate: ((state: unknown, version: number) => unknown | Promise<unknown>) | undefined;
export const setProjectMigration = (fn: NonNullable<typeof migrate>) => { migrate = fn; };
export const projectPersistence = createProjectPersistence({
  repository: indexedDbProjectRepository(),
  packageState: (state) => createProjectDocument(state, cad),
  restoreAssets: async (doc) => { if (doc.assets.length) await restoreProjectAssets(doc, await cad()); },
  readLegacy: () => typeof localStorage === 'undefined' ? null : localStorage.getItem('kineticad-state'),
  migrateLegacy: (state, version) => migrate?.(state, version) ?? state,
  report: (patch) => useProjectRecovery.setState(patch),
});
