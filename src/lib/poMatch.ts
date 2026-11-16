import type { PoRecord, Shipment } from '../types'
import { poKey, refTokens } from './poRead'

export type PoStatus = 'nokey' | 'unplanned' | 'check' | 'planned'

export type PoMatch = {
  status: PoStatus
  rows: Shipment[]
  /** distinct plan dates, sorted */
  planDates: string[]
  qty: number
  /** rows that already have a driver / truck / plate */
  assigned: number
  /** plain-language reason for ⚠️ */
  note: string
}

/** Plan rows whose Customer reference is this PO (exact, or one of several POs in the cell). */
export function rowsForPo(poNo: string, shipments: Shipment[]): Shipment[] {
  const key = poKey(poNo)
  if (!key) return []
  return shipments.filter((s) => {
    if (!s.customerRef) return false
    if (poKey(s.customerRef) === key) return true
    return refTokens(s.customerRef).some((t) => poKey(t) === key)
  })
}

export function matchPo(po: Pick<PoRecord, 'poNo' | 'poDate' | 'dates'>, shipments: Shipment[]): PoMatch {
  if (!poKey(po.poNo)) return { status: 'nokey', rows: [], planDates: [], qty: 0, assigned: 0, note: 'ยังไม่ระบุเลข PO' }
  const rows = rowsForPo(po.poNo, shipments)
  if (!rows.length) return { status: 'unplanned', rows, planDates: [], qty: 0, assigned: 0, note: 'ไม่พบเลข PO นี้ใน plan' }
  const planDates = [...new Set(rows.map((r) => r.date))].sort()
  const qty = rows.reduce((s, r) => s + (r.qty || 0), 0)
  const assigned = rows.filter((r) => r.driver || r.truckNo || r.plate).length
  // dates the PO itself mentions, other than the day it was issued
  const poDates = po.dates.filter((d) => d !== po.poDate)
  const aligned = !poDates.length || planDates.some((d) => poDates.includes(d))
  return {
    status: aligned ? 'planned' : 'check',
    rows,
    planDates,
    qty,
    assigned,
    note: aligned ? '' : 'วันที่ใน plan ไม่ตรงกับวันที่ใดใน PO',
  }
}

export const PO_STATUS_LABEL: Record<PoStatus, string> = {
  planned: '✅ อยู่ใน plan',
  check: '⚠️ ควรตรวจวันที่',
  unplanned: '❌ ยังไม่ plan',
  nokey: '❓ ไม่มีเลข PO',
}

/**
 * For the calendar: which plan rows (and so which days) belong to an imported PO.
 * One pass over the rows using a key index, so it stays cheap with ~4k rows.
 */
export function poMarks(poNos: string[], shipments: Shipment[]): { byDate: Map<string, string[]>; byRow: Map<string, string> } {
  const index = new Map<string, string>()
  for (const n of poNos) if (poKey(n) && !index.has(poKey(n))) index.set(poKey(n), n)
  const byRow = new Map<string, string>()
  const byDate = new Map<string, string[]>()
  if (!index.size) return { byDate, byRow }
  for (const s of shipments) {
    if (!s.customerRef) continue
    const hit = [poKey(s.customerRef), ...refTokens(s.customerRef).map(poKey)].map((k) => index.get(k)).find(Boolean)
    if (!hit) continue
    byRow.set(s.id, hit)
    const day = byDate.get(s.date)
    if (!day) byDate.set(s.date, [hit])
    else if (!day.includes(hit)) day.push(hit)
  }
  return { byDate, byRow }
}
