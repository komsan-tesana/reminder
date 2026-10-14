import { dailyDigest, localDate, addDays } from './reminders'
import type { NotifySettings, Reminder, Shipment } from '../types'

/** What the service worker shows when the server wakes it; stored on the device, never uploaded. */
export type OutboxItem = { id: string; at: number; title: string; body: string; tag: string }

export type PushPlan = {
  /** epoch seconds the server should wake this device (the only thing uploaded) */
  schedule: number[]
  outbox: OutboxItem[]
}

const HORIZON_DAYS = 30
const MAX_ITEMS = 200

/**
 * Work out every notification worth waking the phone for: the daily summary at the set time on each
 * day that has something to announce (same text as the in-app digest) plus pending reminders.
 * The server only learns *when*; the wording stays in the on-device outbox.
 */
export function buildPushPlan(shipments: Shipment[], reminders: Reminder[], notify: NotifySettings, now: Date): PushPlan {
  const nowSec = Math.floor(now.getTime() / 1000)
  const items: OutboxItem[] = []

  if (notify.enabled) {
    const [hh, mm] = notify.time.split(':').map(Number)
    const first = localDate(now)
    for (let i = 0; i <= HORIZON_DAYS; i++) {
      const day = addDays(first, i)
      const [y, mo, d] = day.split('-').map(Number)
      const at = new Date(y, mo - 1, d, hh, mm)
      if (at <= now) continue // that moment has passed (the in-app digest covers "late today")
      const dg = dailyDigest(shipments, at, notify)
      if (dg) items.push({ id: `digest:${day}`, at: Math.floor(at.getTime() / 1000), title: dg.title, body: dg.body, tag: 'digest' })
    }
  }

  for (const r of reminders) {
    if (r.done || r.firedAt) continue
    const [dp, tp] = r.at.split('T')
    const [y, mo, d] = dp.split('-').map(Number)
    const [hh, mm] = tp.split(':').map(Number)
    const at = Math.floor(new Date(y, mo - 1, d, hh, mm).getTime() / 1000)
    if (at <= nowSec) continue
    items.push({ id: `reminder:${r.id}`, at, title: 'เตือน', body: r.title, tag: `reminder-${r.id}` })
  }

  items.sort((a, b) => a.at - b.at)
  const outbox = items.slice(0, MAX_ITEMS)
  return { schedule: [...new Set(outbox.map((i) => i.at))], outbox }
}

/** The plan plus a one-off "test" notification 75 seconds from `nowSec`. */
export function withTestItem(plan: PushPlan, nowSec: number): PushPlan {
  const at = nowSec + 75
  const item: OutboxItem = { id: 'test', at, title: 'ทดสอบ Push', body: 'ถ้าเห็นข้อความนี้ตอนล็อกจอ แปลว่าการแจ้งเตือนใช้งานได้', tag: 'push-test' }
  return { schedule: [...new Set([...plan.schedule, at])].sort((a, b) => a - b), outbox: [...plan.outbox, item].sort((a, b) => a.at - b.at) }
}
