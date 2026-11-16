export type DemoSnapshot = {
  version: string;
  savedAt: number;
  db: Uint8Array;
  files: Record<string, Uint8Array>;
};

const DB_NAME = 'arch-register-demo';
const STORE = 'snapshots';
const KEY = 'current';

/** Bump to invalidate every stored snapshot (e.g. when the snapshot shape or seed data changes). */
const SNAPSHOT_FORMAT = 1;

export const currentSnapshotVersion = () =>
  `${SNAPSHOT_FORMAT}:${(import.meta.env?.VITE_DEMO_BUILD_ID as string | undefined) ?? 'dev'}`;

const openDb = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const run = async <T>(
  mode: IDBTransactionMode,
  op: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> => {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const request = op(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
};

const isSnapshot = (value: unknown): value is DemoSnapshot => {
  const s = value as Partial<DemoSnapshot> | undefined;
  return (
    !!s &&
    typeof s.version === 'string' &&
    s.db instanceof Uint8Array &&
    typeof s.files === 'object' &&
    s.files !== null
  );
};

/** Returns the stored snapshot, or null when none exists, it is malformed, or IndexedDB fails. */
export const loadSnapshot = async (): Promise<DemoSnapshot | null> => {
  try {
    const value = await run('readonly', store => store.get(KEY));
    return isSnapshot(value) ? value : null;
  } catch {
    return null;
  }
};

/** Best effort: failures (quota, private mode) are swallowed so the demo keeps working unpersisted. */
export const saveSnapshot = async (snapshot: DemoSnapshot): Promise<boolean> => {
  try {
    await run('readwrite', store => store.put(snapshot, KEY));
    return true;
  } catch {
    return false;
  }
};

export const clearSnapshot = async (): Promise<void> => {
  try {
    await run('readwrite', store => store.delete(KEY));
  } catch {
    // nothing to clear
  }
};
