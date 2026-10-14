import { parseDate } from './dateParse'
import type { Group } from './group'
import { addDays, dailyDigest, localDate, localDateTime } from './reminders'
import type { NotifySettings, Reminder, Shipment } from '../types'

export type DateFmt = 'CE' | 'BE'

/** ISO -> 'yyyy-mm-dd' (CE) or 'dd/mm/yyyy' with Buddhist year; both re-import cleanly. */
export function fmtExportDate(iso: string, mode: DateFmt): string {
  if (mode === 'CE') return iso
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${+y + 543}`
}

const raw = (s: Shipment, key: string) => String(s.raw[key] ?? '')

// Same headers as the source ERP export, so an exported file imports straight back in.
export const EXPORT_COLUMNS: { header: string; get: (s: Shipment, f: DateFmt) => string | number }[] = [
  { header: 'Requested ship date', get: (s, f) => fmtExportDate(s.requestedDate, f) },
  { header: 'Confirmed ship date', get: (s, f) => (s.confirmedDate ? fmtExportDate(s.confirmedDate, f) : '') },
  { header: 'Sales Order / Journal Number', get: (s) => s.so },
  { header: 'Customer reference', get: (s) => s.customerRef },
  { header: 'Customer', get: (s) => s.customerCode },
  { header: 'Name', get: (s) => s.customerName },
  { header: 'Item number', get: (s) => s.itemNo },
  { header: 'Product Description', get: (s) => s.description },
  { header: 'Quantity', get: (s) => s.qty },
  { header: 'Unit', get: (s) => s.unit },
  { header: 'From Site', get: (s) => s.site },
  { header: 'From Location', get: (s) => s.location },
  { header: 'From Warehouse', get: (s) => raw(s, 'From Warehouse') },
  { header: 'Remark', get: (s) => s.remark },
  { header: 'Delivery order(เลขที่ใบขนส่ง)', get: (s) => s.deliveryOrder },
  { header: 'Driver name(ชื่อคนขับ)', get: (s) => s.driver },
  { header: 'Licens Truck(เลขที่รถ)', get: (s) => s.truckNo },
  { header: 'Mode of delivery(ทะเบียนรถ)', get: (s) => s.plate },
  { header: 'Status delivery(สถานะการขนส่ง)', get: (s) => s.status },
  { header: 'Update', get: (s) => raw(s, 'Update') },
]

export function toRows(shipments: Shipment[], fmt: DateFmt): (string | number)[][] {
  const sorted = [...shipments].sort((a, b) => a.date.localeCompare(b.date) || a.so.localeCompare(b.so))
  return [EXPORT_COLUMNS.map((c) => c.header), ...sorted.map((s) => EXPORT_COLUMNS.map((c) => c.get(s, fmt)))]
}

/** CSV with a BOM so Excel opens Thai text correctly. */
export function toCSV(rows: (string | number)[][]): string {
  const esc = (v: string | number) => {
    const t = String(v)
    return /[",\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t
  }
  return '\uFEFF' + rows.map((r) => r.map(esc).join(',')).join('\r\n') + '\r\n'
}

export async function toXlsxBlob(rows: (string | number)[][]): Promise<Blob> {
  const XLSX = await import('xlsx') // loaded on demand to keep the main bundle small
  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = EXPORT_COLUMNS.map((c, i) => ({ wch: i === 7 ? 40 : Math.min(Math.max(c.header.length, 12), 30) }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
  return new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

// ---------- iCalendar ----------

const icsEscape = (t: string) => t.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')

/** RFC 5545 line folding: max 75 octets per line, never splitting a UTF-8 character. */
export function foldLine(line: string): string {
  const enc = new TextEncoder()
  const out: string[] = []
  let cur = ''
  let bytes = 0
  let limit = 75
  for (const ch of line) {
    const n = enc.encode(ch).length
    if (bytes + n > limit) {
      out.push(cur)
      cur = ''
      bytes = 0
      limit = 74 // continuation lines start with a space
    }
    cur += ch
    bytes += n
  }
  out.push(cur)
  return out.join('\r\n ')
}

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
const compact = (iso: string) => iso.replace(/-/g, '')
const nextDay = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10)
}

/** One all-day event per group, with alarms at 09:00 the day before and 08:00 the same day. */
export type IcsDigest = { shipments: Shipment[] } & Pick<NotifySettings, 'time' | 'today' | 'daysAhead'>

const DIGEST_HORIZON_DAYS = 90

/**
 * With `digest`, the file also carries the in-app daily summary as one timed event per day at the
 * set time (alert at start), so the phone's Calendar announces it even when the app is closed,
 * and the per-group events become silent so each day alerts once instead of once per group.
 */
export function toICS(groups: Group[], now: Date = new Date(), reminders: Reminder[] = [], digest?: IcsDigest): string {
  // calendars treat a re-imported UID with a higher SEQUENCE as an update to the existing event
  const seq = Math.floor(now.getTime() / 60000)
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Transport Calendar//TH', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:Transport Calendar']
  const sorted = [...groups].sort((a, b) => a.date.localeCompare(b.date) || a.label.localeCompare(b.label))
  for (const g of sorted) {
    const detail = g.rows.slice(0, 40).map((r) => {
      const parts = [r.so, `${r.description} x${r.qty}${r.unit ? ' ' + r.unit : ''}`, r.driver, r.truckNo || r.plate, r.status]
      return parts.filter(Boolean).join(' | ')
    })
    if (g.rows.length > 40) detail.push(`… อีก ${g.rows.length - 40} รายการ`)
    const uid = `${g.id}`.replace(/[^\w|-]/g, '_') + '@transport-calendar'
    lines.push(
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${stamp(now)}`,
      `LAST-MODIFIED:${stamp(now)}`,
      `SEQUENCE:${seq}`,
      `DTSTART;VALUE=DATE:${compact(g.date)}`,
      `DTEND;VALUE=DATE:${compact(nextDay(g.date))}`,
      `SUMMARY:${icsEscape(`${g.label} (${g.rows.length})`)}`,
      `DESCRIPTION:${icsEscape(detail.join('\n'))}`,
      'TRANSP:TRANSPARENT',
      ...(digest
        ? []
        : [
            'BEGIN:VALARM',
            'ACTION:DISPLAY',
            `DESCRIPTION:${icsEscape(g.label)}`,
            'TRIGGER:-PT15H',
            'END:VALARM',
            'BEGIN:VALARM',
            'ACTION:DISPLAY',
            `DESCRIPTION:${icsEscape(g.label)}`,
            'TRIGGER:PT8H',
            'END:VALARM',
          ]),
      'END:VEVENT',
    )
  }
  if (digest) {
    const [hh, mm] = digest.time.split(':').map(Number)
    const last = digest.shipments.reduce((m, s) => (s.date > m ? s.date : m), '')
    const horizon = addDays(localDate(now), DIGEST_HORIZON_DAYS)
    for (let day = localDate(now); day <= last && day <= horizon; day = addDays(day, 1)) {
      const [y, mo, da] = day.split('-').map(Number)
      const at = new Date(y, mo - 1, da, hh, mm)
      if (at <= now) continue // that moment has already passed
      const dg = dailyDigest(digest.shipments, at, digest)
      if (!dg) continue
      const end = new Date(at.getTime() + 15 * 60000)
      const p2 = (n: number) => String(n).padStart(2, '0')
      const floating = (d: Date) => `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}T${p2(d.getHours())}${p2(d.getMinutes())}00`
      lines.push(
        'BEGIN:VEVENT',
        `UID:digest-${day}@transport-calendar`,
        `DTSTAMP:${stamp(now)}`,
        `LAST-MODIFIED:${stamp(now)}`,
        `SEQUENCE:${seq}`,
        `DTSTART:${floating(at)}`,
        `DTEND:${floating(end)}`,
        `SUMMARY:${icsEscape(`📅 แผนขนส่ง: ${dg.days.map((d) => `${d.label} ${d.total}`).join(' · ')}`)}`,
        `DESCRIPTION:${icsEscape(dg.body)}`,
        'BEGIN:VALARM',
        'ACTION:DISPLAY',
        `DESCRIPTION:${icsEscape(dg.body)}`,
        'TRIGGER:PT0S',
        'END:VALARM',
        'END:VEVENT',
      )
    }
  }

  // per-item reminders: timed events with an alert at the start, so the phone's own Calendar
  // alerts even when the app is closed or the screen is locked
  const nowLocal = localDateTime(now)
  for (const r of reminders.filter((x) => !x.done && x.at >= nowLocal).sort((a, b) => a.at.localeCompare(b.at))) {
    const [d, t] = r.at.split('T')
    const [y, mo, da] = d.split('-').map(Number)
    const [h, mi] = t.split(':').map(Number)
    const end = new Date(y, mo - 1, da, h, mi + 30)
    const pad = (n: number) => String(n).padStart(2, '0')
    const endStr = `${end.getFullYear()}${pad(end.getMonth() + 1)}${pad(end.getDate())}T${pad(end.getHours())}${pad(end.getMinutes())}00`
    lines.push(
      'BEGIN:VEVENT',
      `UID:reminder-${r.id.replace(/[^\w-]/g, '_')}@transport-calendar`,
      `DTSTAMP:${stamp(now)}`,
      `LAST-MODIFIED:${stamp(now)}`,
      `SEQUENCE:${seq}`,
      `DTSTART:${compact(d)}T${t.replace(':', '')}00`,
      `DTEND:${endStr}`,
      `SUMMARY:${icsEscape(`🔔 ${r.title}`)}`,
      ...(r.note ? [`DESCRIPTION:${icsEscape(r.note)}`] : []),
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${icsEscape(r.title)}`,
      'TRIGGER:PT0S',
      'END:VALARM',
      'END:VEVENT',
    )
  }
  lines.push('END:VCALENDAR')
  return lines.map(foldLine).join('\r\n') + '\r\n'
}

// ---------- JSON backup ----------

const APP_MARK = 'transport-calendar-backup'

export function toBackup(shipments: Shipment[], reminders: Reminder[]): string {
  return JSON.stringify({ app: APP_MARK, version: 1, exportedAt: new Date().toISOString(), shipments, reminders })
}

const str = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v))

function sanitizeShipment(o: unknown): Shipment | null {
  if (!o || typeof o !== 'object') return null
  const r = o as Record<string, unknown>
  const date = parseDate(r.date, 'CE')
  if (!r.id || !date) return null
  const rawObj = r.raw && typeof r.raw === 'object' && !Array.isArray(r.raw) ? Object.fromEntries(Object.entries(r.raw)) : {}
  return {
    id: str(r.id),
    date,
    requestedDate: parseDate(r.requestedDate, 'CE') ?? date,
    confirmedDate: parseDate(r.confirmedDate, 'CE') ?? undefined,
    so: str(r.so),
    customerRef: str(r.customerRef),
    customerCode: str(r.customerCode),
    customerName: str(r.customerName),
    itemNo: str(r.itemNo),
    description: str(r.description),
    qty: Number(r.qty) || 0,
    unit: str(r.unit),
    site: str(r.site),
    location: str(r.location),
    remark: str(r.remark),
    deliveryOrder: str(r.deliveryOrder),
    driver: str(r.driver),
    truckNo: str(r.truckNo),
    plate: str(r.plate),
    status: str(r.status),
    source: str(r.source),
    raw: rawObj,
    editedAt: typeof r.editedAt === 'number' ? r.editedAt : undefined,
  }
}

function sanitizeReminder(o: unknown): Reminder | null {
  if (!o || typeof o !== 'object') return null
  const r = o as Record<string, unknown>
  if (!r.id || typeof r.at !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(r.at)) return null
  return {
    id: str(r.id),
    title: str(r.title),
    at: r.at,
    note: r.note ? str(r.note) : undefined,
    done: r.done === true,
    firedAt: typeof r.firedAt === 'number' ? r.firedAt : undefined,
  }
}

/** Validate a backup file; only known fields are kept. */
export function parseBackup(text: string): { shipments: Shipment[]; reminders: Reminder[] } {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('ไฟล์ไม่ใช่ JSON ที่ถูกต้อง')
  }
  const d = data as { app?: unknown; shipments?: unknown; reminders?: unknown } | null
  if (!d || d.app !== APP_MARK || !Array.isArray(d.shipments)) throw new Error('ไม่ใช่ไฟล์สำรองของแอปนี้')
  const shipments = d.shipments.map(sanitizeShipment).filter((s): s is Shipment => s !== null)
  const reminders = (Array.isArray(d.reminders) ? d.reminders : []).map(sanitizeReminder).filter((r): r is Reminder => r !== null)
  return { shipments, reminders }
}
