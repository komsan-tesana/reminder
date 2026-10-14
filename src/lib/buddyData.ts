// Facts the cat's data-based unlocks read from the app's own data. Pure and tested; only numbers ever leave these
// functions (never a customer name or an SO number), and they are kept as "highest seen" counters, not as data.
import type { Filters, Shipment } from '../types'

export type DataFacts = { customers: number; sos: number; maxDayRows: number; months: number }

/** how big the current data is: distinct customers and SO numbers, the busiest day, and how many months it spans */
export function dataFacts(shipments: Shipment[]): DataFacts {
  const customers = new Set<string>()
  const sos = new Set<string>()
  const months = new Set<string>()
  const perDay = new Map<string, number>()
  for (const s of shipments) {
    const customer = (s.customerName || s.customerCode || '').trim()
    if (customer) customers.add(customer)
    if (s.so.trim()) sos.add(s.so.trim())
    if (s.date) {
      months.add(s.date.slice(0, 7))
      perDay.set(s.date, (perDay.get(s.date) ?? 0) + 1)
    }
  }
  return { customers: customers.size, sos: sos.size, maxDayRows: Math.max(0, ...perDay.values()), months: months.size }
}

const isAssigned = (s: Shipment) => !!(s.driver || s.truckNo || s.plate)

/** rows that had no driver or truck before an edit and have one after it */
export function countAssigned(before: Shipment[], after: Shipment[]): number {
  const now = new Map(after.map((s) => [s.id, s]))
  return before.filter((b) => !isAssigned(b) && now.has(b.id) && isAssigned(now.get(b.id)!)).length
}

export type FilterUse = 'pick' | 'search' | null

/**
 * Did this change of the filter bar count as using it? Choosing a dropdown value counts at once; typing counts
 * (once the user stops, which the caller debounces) when the search has at least two characters.
 */
export function filterUseKind(prev: Filters, next: Filters): FilterUse {
  const picked = (['site', 'status', 'driver', 'customer'] as const).some((k) => prev[k] !== next[k] && next[k] !== '')
  if (picked) return 'pick'
  if (prev.q !== next.q && next.q.trim().length >= 2) return 'search'
  return null
}
