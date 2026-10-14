// Service worker: makes the app installable (required for notifications on iOS/Android),
// shows notifications, and keeps a copy of visited files so it opens offline.
// Network-first, so a new deploy is always picked up when online.
const CACHE = 'transport-calendar-v1'
// A virtual https file: the page stores the generated calendar here and then navigates to
// ./calendar.ics. iOS Safari only opens Calendar's "Add All" sheet for a real http(s) response of
// type text/calendar (data: and blob: links do not work), and a static host cannot produce one.
const ICS_CACHE = 'transport-calendar-ics'
const ICS_FILE = 'calendar.ics'

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== CACHE && key !== ICS_CACHE) await caches.delete(key)
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  const url = new URL(req.url)
  if (req.method !== 'GET' || url.origin !== self.location.origin) return
  if (url.pathname.endsWith('/' + ICS_FILE)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(ICS_CACHE)
        // ?v=<time> is only a cache-buster for the browser, so ignore it when looking up
        return (await cache.match(req, { ignoreSearch: true })) || new Response('ไม่พบไฟล์ปฏิทิน กรุณากดซิงก์ใหม่', { status: 404 })
      })(),
    )
    return
  }
  event.respondWith(
    (async () => {
      try {
        const res = await fetch(req)
        if (res.status === 200) {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {})
        }
        return res
      } catch (err) {
        const hit = (await caches.match(req)) || (req.mode === 'navigate' ? await caches.match(self.registration.scope) : undefined)
        if (hit) return hit
        throw err
      }
    })(),
  )
})

// tapping a notification brings the app to the front (or opens it)
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      if (all.length) return all[0].focus()
      return self.clients.openWindow(self.registration.scope)
    })(),
  )
})

// ---- Web Push -------------------------------------------------------------------------------
// The server only wakes us ({"due": <epoch seconds>}); the texts were stored on this device by the
// page (src/lib/outbox.ts). DB_NAME / STORE must match that file.
const PUSH_DB = 'reminder-push'
const PUSH_STORE = 'outbox'

function openOutbox() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(PUSH_DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(PUSH_STORE, { keyPath: 'id' })
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

// remove and return everything that is due, so a notice is shown once
async function takeDue(nowSec) {
  const db = await openOutbox()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PUSH_STORE, 'readwrite')
    const store = tx.objectStore(PUSH_STORE)
    const all = store.getAll()
    all.onsuccess = () => {
      const due = all.result.filter((i) => i.at <= nowSec).sort((a, b) => a.at - b.at)
      for (const i of due) store.delete(i.id)
      tx.oncomplete = () => {
        db.close()
        resolve(due)
      }
    }
    tx.onerror = () => reject(tx.error)
  })
}

self.addEventListener('push', (event) => {
  event.waitUntil(
    (async () => {
      const icon = new URL('icons/icon-192.png', self.registration.scope).href
      let due = []
      try {
        due = await takeDue(Math.floor(Date.now() / 1000) + 5)
      } catch {
        /* storage unavailable: fall through to the generic notice */
      }
      for (const i of due) await self.registration.showNotification(i.title, { body: i.body, tag: i.tag, icon })
      // iOS revokes a subscription whose pushes show nothing, so always show something
      if (!due.length) {
        await self.registration.showNotification('แผนขนส่ง', { body: 'เปิดแอปเพื่อดูแผนล่าสุด', tag: 'push-generic', icon })
      }
    })(),
  )
})
