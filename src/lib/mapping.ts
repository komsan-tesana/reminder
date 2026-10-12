import { FIELDS, type EraMode, type FieldKey, type Mapping, type RowError, type Shipment } from '../types'
import { parseDate } from './dateParse'

const norm = (h: unknown) => String(h ?? '').toLowerCase().trim()

/** Guess which column feeds which field from the header names. */
export function autoMap(headers: string[]): Mapping {
  const mapping: Mapping = {}
  const used = new Set<number>()
  for (const f of FIELDS) {
    const idx = headers.findIndex((h, i) => !used.has(i) && f.match.test(norm(h)))
    if (idx >= 0) {
      mapping[f.key] = idx
      used.add(idx)
    }
  }
  return mapping
}

// cyrb53: small, fast, good-enough string hash for stable row ids
function hash(str: string): string {
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 2654435761)
    h2 = Math.imul(h2 ^ c, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)
}

export function buildShipments(
  headers: string[],
  rows: unknown[][],
  mapping: Mapping,
  era: EraMode,
  source: string,
): { items: Shipment[]; errors: RowError[] } {
  const items: Shipment[] = []
  const errors: RowError[] = []
  const seen = new Map<string, number>()

  const cell = (row: unknown[], key: FieldKey) => {
    const i = mapping[key]
    return i === undefined ? undefined : row[i]
  }
  const text = (row: unknown[], key: FieldKey) => String(cell(row, key) ?? '').trim()

  rows.forEach((row, n) => {
    if (row.every((c) => c === '' || c == null)) return
    const rowNo = n + 2 // 1-based, header is row 1

    const requested = parseDate(cell(row, 'requestedDate'), era)
    const confirmed = parseDate(cell(row, 'confirmedDate'), era)
    const date = confirmed ?? requested
    if (!date) {
      errors.push({ row: rowNo, reason: 'วันที่ไม่ถูกต้องหรือว่าง' })
      return
    }

    const qtyRaw = cell(row, 'qty')
    const qty = typeof qtyRaw === 'number' ? qtyRaw : Number(String(qtyRaw ?? '').replace(/,/g, '')) || 0

    const so = text(row, 'so')
    const itemNo = text(row, 'itemNo')
    const description = text(row, 'description')
    // identical lines inside one file get a counter so none are collapsed
    const base = [date, so, itemNo, description, qty].join('|')
    const k = seen.get(base) ?? 0
    seen.set(base, k + 1)

    const raw: Record<string, unknown> = {}
    headers.forEach((h, i) => {
      if (row[i] !== '' && row[i] != null) raw[h] = row[i]
    })

    items.push({
      id: hash(`${base}|${k}`),
      date,
      requestedDate: requested ?? date,
      confirmedDate: confirmed ?? undefined,
      so,
      customerRef: text(row, 'customerRef'),
      customerCode: text(row, 'customerCode'),
      customerName: text(row, 'customerName'),
      itemNo,
      description,
      qty,
      unit: text(row, 'unit'),
      site: text(row, 'site'),
      location: text(row, 'location'),
      remark: text(row, 'remark'),
      deliveryOrder: text(row, 'deliveryOrder'),
      driver: text(row, 'driver'),
      truckNo: text(row, 'truckNo'),
      plate: text(row, 'plate'),
      status: text(row, 'status'),
      source,
      raw,
    })
  })
  return { items, errors }
}
