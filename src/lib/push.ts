import { PUSH_SERVER_URL, VAPID_PUBLIC_KEY, pushConfigured } from './pushConfig'
import { replaceOutbox } from './outbox'
import { currentNotifyState } from './platform'
import { withTestItem, type PushPlan } from './pushPlan'

export type PushState = 'unconfigured' | 'unsupported' | 'ios-install' | 'denied' | 'off' | 'on'

const urlB64ToBytes = (s: string) => {
  const raw = atob((s + '='.repeat((4 - (s.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

/** `ready` never resolves when no worker is registered (dev server), so do not wait forever. */
async function registration(): Promise<ServiceWorkerRegistration> {
  const reg = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise<undefined>((r) => setTimeout(() => r(undefined), 4000)),
  ])
  if (!reg) throw new Error('ยังไม่มี service worker (ใช้ได้เฉพาะเวอร์ชันที่ deploy แล้ว)')
  return reg
}

async function currentSubscription(): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator)) return null
  const reg = await navigator.serviceWorker.getRegistration()
  return (await reg?.pushManager.getSubscription()) ?? null
}

export async function pushState(): Promise<PushState> {
  if (!pushConfigured()) return 'unconfigured'
  const n = currentNotifyState()
  if (n === 'ios-install' || n === 'unsupported' || n === 'denied') return n
  if (!('PushManager' in window) || !('serviceWorker' in navigator)) return 'unsupported'
  return (await currentSubscription()) ? 'on' : 'off'
}

/** Ask permission and subscribe. Must run from a click (iOS only shows the prompt for a gesture). */
export async function enablePush(): Promise<void> {
  const permission = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission
  if (permission !== 'granted') throw new Error('ไม่ได้รับอนุญาตให้แจ้งเตือน')
  const reg = await registration()
  const existing = await reg.pushManager.getSubscription()
  if (!existing) await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToBytes(VAPID_PUBLIC_KEY) as BufferSource })
}

async function call(path: string, body: unknown) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 10_000)
  try {
    const res = await fetch(PUSH_SERVER_URL + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: ctrl.signal })
    if (!res.ok) throw new Error(`server ตอบ ${res.status}`)
    return (await res.json()) as { scheduled?: number }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Store the notification texts on the device first (the worker reads them when woken), then tell the
 * server *when* to wake it. The server never receives any text.
 */
export async function syncPush(plan: PushPlan): Promise<number> {
  const sub = await currentSubscription()
  if (!sub) throw new Error('ยังไม่ได้สมัครรับ push')
  await replaceOutbox(plan.outbox)
  const r = await call('/sync', { subscription: sub.toJSON(), schedule: plan.schedule })
  return r.scheduled ?? plan.schedule.length
}

export async function disablePush(): Promise<void> {
  const sub = await currentSubscription()
  if (sub) {
    await call('/unsubscribe', { endpoint: sub.endpoint }).catch(() => {}) // best effort: the server also prunes dead devices
    await sub.unsubscribe()
  }
  await replaceOutbox([])
}

/** Schedule a one-off notice ~75 s ahead so the user can lock the phone and watch it arrive. */
export async function testPush(plan: PushPlan): Promise<void> {
  await syncPush(withTestItem(plan, Math.floor(Date.now() / 1000)))
}
