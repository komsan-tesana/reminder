import type { NotifySettings, Reminder, Shipment } from '../types'

const pad = (n: number) => String(n).padStart(2, '0')

export const localDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const localDateTime = (d: Date) => `${localDate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`
export const localTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`

export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  return localDate(new Date(y, m - 1, d + n))
}

export type DaySummary = { total: number; unassigned: number; pending: number }

export function daySummary(shipments: Shipment[], iso: string): DaySummary {
  let total = 0
  let unassigned = 0
  let pending = 0
  for (const s of shipments) {
    if (s.date !== iso) continue
    total++
    if (!s.driver && !s.truckNo && !s.plate) unassigned++
    if (s.status.includes('ค้าง')) pending++
  }
  return { total, unassigned, pending }
}

export type DigestDay = DaySummary & { date: string; offset: number; label: string }
export type Digest = { title: string; body: string; days: DigestDay[] }

const dayLabel = (offset: number, iso: string) => {
  if (offset === 0) return 'วันนี้'
  if (offset === 1) return 'พรุ่งนี้'
  const [, m, d] = iso.split('-')
  return `อีก ${offset} วัน (${+d}/${+m})`
}

export const MAX_DAYS_AHEAD = 14

/**
 * Day-by-day summary of what is coming up: today (optional) plus the next `daysAhead` days.
 * Days with nothing scheduled are left out; null when there is nothing at all.
 */
export function dailyDigest(shipments: Shipment[], now: Date, opts: Pick<NotifySettings, 'today' | 'daysAhead'>): Digest | null {
  const todayIso = localDate(now)
  const ahead = Math.min(Math.max(Math.floor(opts.daysAhead) || 0, 0), MAX_DAYS_AHEAD)
  const days: DigestDay[] = []
  for (let offset = opts.today ? 0 : 1; offset <= ahead; offset++) {
    const date = addDays(todayIso, offset)
    const sum = daySummary(shipments, date)
    if (sum.total > 0) days.push({ ...sum, date, offset, label: dayLabel(offset, date) })
  }
  if (!days.length) return null
  const body = days.map((d) => `${d.label} ${d.total} รายการ${d.unassigned ? ` (ยังไม่จัดรถ ${d.unassigned})` : ''}`).join('\n')
  return { title: 'แผนขนส่ง', body, days }
}

/** Reminders whose time has come and that have not fired yet. */
export function dueReminders(reminders: Reminder[], now: Date): Reminder[] {
  const t = localDateTime(now)
  return reminders.filter((r) => !r.done && !r.firedAt && r.at <= t)
}

/**
 * The digest to show right now, or null. Pure so the "when" can be tested: it is null before the
 * set time, once today's digest has gone out, and when there is nothing in the window yet. The
 * caller must only record the day as done when this returns a digest, otherwise work added later
 * the same day would never be announced.
 */
export function digestToFire(shipments: Shipment[], now: Date, notify: NotifySettings, lastFiredDate: string | null): Digest | null {
  if (!shouldFireDigest(notify, now, lastFiredDate)) return null
  return dailyDigest(shipments, now, notify)
}

/** True once per day, after the configured HH:mm. */
export function shouldFireDigest(notify: NotifySettings, now: Date, lastFiredDate: string | null): boolean {
  return notify.enabled && localTime(now) >= notify.time && lastFiredDate !== localDate(now)
}
