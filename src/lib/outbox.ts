import type { OutboxItem } from './pushPlan'

// A tiny IndexedDB of its own so public/sw.js can read it with plain browser APIs (no bundling,
// no Dexie). public/sw.js repeats DB_NAME / STORE: keep them in sync.
const DB_NAME = 'reminder-push'
const STORE = 'outbox'

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' })
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/** Replace the whole outbox (the plan is recomputed from scratch on every sync). */
export async function replaceOutbox(items: OutboxItem[]): Promise<void> {
  const db = await open()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    store.clear()
    for (const i of items) store.put(i)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}
