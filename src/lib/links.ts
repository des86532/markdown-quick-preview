export type LinkKind = 'github' | 'url' | 'paste';

export interface SavedLink {
  /** Viewer query without leading '?', e.g. 'paste=<uuid>'. IndexedDB key. */
  query: string;
  title: string;
  kind: LinkKind;
  createdAt: number;
  /** Paste only: paste createdAt + PASTE_TTL_MS. */
  expiresAt: number | null;
}

const DB_NAME = 'md-quick-preview';
const DB_VERSION = 1;
const STORE = 'links';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE, { keyPath: 'query' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };
  });
  return dbPromise;
}

async function run<T>(mode: IDBTransactionMode, op: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = op(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = () => reject(tx.error ?? request.error);
    tx.onabort = () => reject(tx.error ?? request.error);
  });
}

export async function listLinks(): Promise<SavedLink[]> {
  const links = await run('readonly', (store) => store.getAll() as IDBRequest<SavedLink[]>);
  return links.sort((a, b) => b.createdAt - a.createdAt);
}

export function getLink(query: string): Promise<SavedLink | undefined> {
  return run('readonly', (store) => store.get(query) as IDBRequest<SavedLink | undefined>);
}

export async function putLink(link: SavedLink): Promise<void> {
  await run('readwrite', (store) => store.put(link));
}

export async function deleteLink(query: string): Promise<void> {
  await run('readwrite', (store) => store.delete(query));
}
