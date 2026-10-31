import type { CorpusEntry } from './types';

const DB_NAME = 'vietvoice-corpus';
const STORE = 'entries';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const store = req.result.createObjectStore(STORE, { keyPath: 'id' });
      store.createIndex('word', 'word');
      store.createIndex('speaker', 'speaker');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const getAllEntries = () => tx<CorpusEntry[]>('readonly', (s) => s.getAll());
export const putEntry = (e: CorpusEntry) => tx('readwrite', (s) => s.put(e));
export const deleteEntry = (id: string) => tx('readwrite', (s) => s.delete(id));
export const clearEntries = () => tx('readwrite', (s) => s.clear());

