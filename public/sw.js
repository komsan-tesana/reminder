// Service worker: makes the app installable (required for notifications on iOS/Android),
// shows notifications, and keeps a copy of visited files so it opens offline.
// Network-first, so a new deploy is always picked up when online.
const CACHE = 'transport-calendar-v1'

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key)
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return
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
