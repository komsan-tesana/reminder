import type { GroupBy, Shipment } from '../types'

export type Tone = 'unassigned' | 'pending' | 'assigned'

export type Group = {
  id: string
  date: string
  key: string
  label: string
  rows: Shipment[]
  tone: Tone
}

export const UNASSIGNED = 'ยังไม่จัดรถ'

export function groupKey(s: Shipment, by: GroupBy): string {
  if (by === 'so') return s.so || '(ไม่มี SO)'
  if (by === 'truck') return s.truckNo || s.plate || UNASSIGNED
  return s.customerCode || s.customerName || '(ไม่ระบุลูกค้า)'
}

function labelOf(rows: Shipment[], by: GroupBy, key: string): string {
  if (by === 'customer') return rows[0].customerName || key
  return key
}

function toneOf(rows: Shipment[]): Tone {
  if (rows.some((r) => r.status.includes('ค้าง'))) return 'pending'
  if (rows.every((r) => !r.driver && !r.truckNo && !r.plate)) return 'unassigned'
  return 'assigned'
}

export function buildGroups(shipments: Shipment[], by: GroupBy): Group[] {
  const map = new Map<string, Shipment[]>()
  for (const s of shipments) {
    const id = `${s.date}|${groupKey(s, by)}`
    const list = map.get(id)
    if (list) list.push(s)
    else map.set(id, [s])
  }
  return [...map].map(([id, rows]) => {
    const key = groupKey(rows[0], by)
    return { id, date: rows[0].date, key, label: labelOf(rows, by, key), rows, tone: toneOf(rows) }
  })
}
