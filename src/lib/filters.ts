import type { Filters, Shipment } from '../types'

/** sentinel select value meaning "field is empty" */
export const EMPTY = '__empty__'

export const NO_FILTERS: Filters = { q: '', site: '', status: '', driver: '', customer: '' }

export const customerOf = (s: Shipment) => s.customerName || s.customerCode

const SEARCH_KEYS = [
  'so', 'customerRef', 'customerCode', 'customerName', 'itemNo', 'description',
  'driver', 'truckNo', 'plate', 'status', 'remark', 'deliveryOrder',
] as const

const pass = (value: string, selected: string) =>
  selected === '' || (selected === EMPTY ? value === '' : value === selected)

export const hasFilters = (f: Filters) => Object.values(f).some((v) => v !== '')

export function applyFilters(rows: Shipment[], f: Filters): Shipment[] {
  if (!hasFilters(f)) return rows
  const needle = f.q.trim().toLowerCase()
  return rows.filter(
    (s) =>
      pass(s.site, f.site) &&
      pass(s.status, f.status) &&
      pass(s.driver, f.driver) &&
      pass(customerOf(s), f.customer) &&
      (!needle || SEARCH_KEYS.some((k) => s[k].toLowerCase().includes(needle))),
  )
}

export function uniqueValues(rows: Shipment[], pick: (s: Shipment) => string): string[] {
  const set = new Set<string>()
  for (const s of rows) {
    const v = pick(s)
    if (v) set.add(v)
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'th'))
}
