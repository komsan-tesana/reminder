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

export type Digest = { title: string; body: string; today: DaySummary; tomorrow: DaySummary }

/** What to tell the user about today's / tomorrow's shipments; null when there is nothing. */
export function dailyDigest(shipments: Shipment[], now: Date, opts: Pick<NotifySettings, 'today' | 'tomorrow'>): Digest | null {
  const todayIso = localDate(now)
  const today = daySummary(shipments, todayIso)
  const tomorrow = daySummary(shipments, addDays(todayIso, 1))
  const parts: string[] = []
  if (opts.today && today.total > 0) {
    parts.push(`วันนี้ ${today.total} รายการ${today.unassigned ? ` (ยังไม่จัดรถ ${today.unassigned})` : ''}`)
  }
  if (opts.tomorrow && tomorrow.total > 0) {
    parts.push(`พรุ่งนี้ ${tomorrow.total} รายการ${tomorrow.unassigned ? ` (ยังไม่จัดรถ ${tomorrow.unassigned})` : ''}`)
  }
  if (!parts.length) return null
  return { title: 'แผนขนส่ง', body: parts.join(' · '), today, tomorrow }
}

/** Reminders whose time has come and that have not fired yet. */
export function dueReminders(reminders: Reminder[], now: Date): Reminder[] {
  const t = localDateTime(now)
  return reminders.filter((r) => !r.done && !r.firedAt && r.at <= t)
}

/** True once per day, after the configured HH:mm. */
export function shouldFireDigest(notify: NotifySettings, now: Date, lastFiredDate: string | null): boolean {
  return notify.enabled && localTime(now) >= notify.time && lastFiredDate !== localDate(now)
}
