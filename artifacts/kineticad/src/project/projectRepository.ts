import { sha256, textBytes } from './projectDocument';

export type ProjectSnapshot = { payload: string; sha256: string; savedAt: string };
export type SnapshotRepository = {
  read: () => Promise<{ current?: ProjectSnapshot; previous?: ProjectSnapshot }>;
  commit: (current: ProjectSnapshot, previous?: ProjectSnapshot) => Promise<void>;
};
export async function makeSnapshot(payload: string): Promise<ProjectSnapshot> {
  return { payload, sha256: await sha256(textBytes(payload)), savedAt: new Date().toISOString() };
}
export async function verifySnapshot(snapshot: ProjectSnapshot) {
  if (!snapshot || typeof snapshot.payload !== 'string' || await sha256(textBytes(snapshot.payload)) !== snapshot.sha256) throw new Error('Recovery snapshot checksum failed.');
}

/** Both complete generations change in one IDB transaction. On quota failure
 * the transaction aborts, retaining the old current and previous generations. */
export function indexedDbProjectRepository(): SnapshotRepository {
  const open = () => new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('Browser project storage is unavailable.')); return; }
    const request = indexedDB.open('kineticad-projects', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('snapshots');
    request.onerror = () => reject(request.error ?? new Error('Could not open project storage.'));
    request.onblocked = () => reject(new Error('Project storage is blocked by another app tab. Close it and retry.'));
    request.onsuccess = () => resolve(request.result);
  });
  return {
    async read() {
      const db = await open();
      try {
        return await new Promise<{ current?: ProjectSnapshot; previous?: ProjectSnapshot }>((resolve, reject) => {
          const tx = db.transaction('snapshots', 'readonly');
          const store = tx.objectStore('snapshots');
          const current = store.get('current'), previous = store.get('previous');
          tx.oncomplete = () => resolve({ current: current.result, previous: previous.result });
          tx.onerror = tx.onabort = () => reject(tx.error ?? new Error('Could not read recovery snapshots.'));
        });
      } finally { db.close(); }
    },
    async commit(current, previous) {
      const db = await open();
      try {
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction('snapshots', 'readwrite');
          const store = tx.objectStore('snapshots');
          store.put(current, 'current');
          if (previous) store.put(previous, 'previous');
          tx.oncomplete = () => resolve();
          tx.onerror = tx.onabort = () => reject(tx.error ?? new Error('Could not save project. The previous recovery copy is retained.'));
        });
      } finally { db.close(); }
    },
  };
}
