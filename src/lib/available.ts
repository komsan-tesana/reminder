import type { GroupBy, Shipment } from '../types'

export type FieldKey2 =
  | 'so' | 'customer' | 'item' | 'qty' | 'site' | 'driver' | 'truck' | 'status' | 'remark'

const test: Record<FieldKey2, (s: Shipment) => boolean> = {
  so: (s) => !!s.so,
  customer: (s) => !!(s.customerName || s.customerCode),
  item: (s) => !!(s.description || s.itemNo),
  qty: (s) => s.qty !== 0,
  site: (s) => !!s.site,
  driver: (s) => !!s.driver,
  truck: (s) => !!(s.truckNo || s.plate),
  status: (s) => !!s.status,
  remark: (s) => !!s.remark,
}

export type Available = Record<FieldKey2, boolean>

/**
 * Which columns carry any data at all. A column that was not mapped on import, or is empty
 * in every row, is hidden from the table, the filters and the group options.
 * (The edit dialog still offers every field so a plan can be filled in from scratch.)
 */
export function availableFields(shipments: Shipment[]): Available {
  const out = Object.fromEntries((Object.keys(test) as FieldKey2[]).map((k) => [k, false])) as Available
  let missing = Object.keys(out).length
  for (const s of shipments) {
    for (const k of Object.keys(test) as FieldKey2[]) {
      if (!out[k] && test[k](s)) {
        out[k] = true
        if (--missing === 0) return out
      }
    }
  }
  return out
}

const GROUP_NEEDS: Record<GroupBy, FieldKey2> = { customer: 'customer', so: 'so', truck: 'truck' }

export function groupOptions(av: Available): GroupBy[] {
  const list = (Object.keys(GROUP_NEEDS) as GroupBy[]).filter((g) => av[GROUP_NEEDS[g]])
  return list.length ? list : ['customer']
}

/** The saved choice if it still has data, otherwise the first one that does. */
export function effectiveGroupBy(saved: GroupBy, av: Available): GroupBy {
  const opts = groupOptions(av)
  return opts.includes(saved) ? saved : opts[0]
}
