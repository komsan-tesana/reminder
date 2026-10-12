import { useMemo, useState } from 'react'
import SearchSelect, { type Option } from './SearchSelect'
import type { Available } from '../lib/available'
import { customerOf, EMPTY, hasFilters, NO_FILTERS, uniqueValues } from '../lib/filters'
import type { Filters, Shipment } from '../types'

type Props = {
  shipments: Shipment[]
  available: Available
  filters: Filters
  shown: number
  onChange: (f: Filters) => void
}

const build = (values: string[], emptyLabel?: string): Option[] => [
  { value: '', label: 'ทั้งหมด' },
  ...(emptyLabel ? [{ value: EMPTY, label: emptyLabel }] : []),
  ...values.map((v) => ({ value: v, label: v })),
]

export default function FilterBar({ shipments, available, filters, shown, onChange }: Props) {
  const opts = useMemo(
    () => ({
      site: build(uniqueValues(shipments, (s) => s.site)),
      status: build(uniqueValues(shipments, (s) => s.status), '(ยังไม่มีสถานะ)'),
      driver: build(uniqueValues(shipments, (s) => s.driver), '(ยังไม่จัดคนขับ)'),
      customer: build(uniqueValues(shipments, customerOf)),
    }),
    [shipments],
  )
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch })
  // on narrow screens the dropdowns fold away behind one button
  const [open, setOpen] = useState(false)
  const active = (['site', 'status', 'driver', 'customer'] as const).filter((k) => filters[k] !== '').length

  return (
    <div className="filterbar">
      <input
        type="search"
        placeholder="ค้นหา SO / ลูกค้า / สินค้า / คนขับ…"
        aria-label="ค้นหา"
        value={filters.q}
        onChange={(e) => set({ q: e.target.value })}
      />
      <button className={`filter-toggle ${active ? 'on' : ''}`} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        ตัวกรอง{active > 0 && ` (${active})`} {open ? '▴' : '▾'}
      </button>
      <div className={`filter-selects ${open ? 'open' : ''}`}>
      {available.site && <SearchSelect title="Site" value={filters.site} options={opts.site} onChange={(site) => set({ site })} />}
      {available.status && <SearchSelect title="สถานะ" value={filters.status} options={opts.status} onChange={(status) => set({ status })} />}
      {available.driver && <SearchSelect title="คนขับ" value={filters.driver} options={opts.driver} onChange={(driver) => set({ driver })} />}
      {available.customer && <SearchSelect title="ลูกค้า" value={filters.customer} options={opts.customer} onChange={(customer) => set({ customer })} />}
      </div>
      {hasFilters(filters) && (
        <>
          <span className="muted small">{shown.toLocaleString()} รายการ</span>
          <button onClick={() => onChange(NO_FILTERS)}>ล้างตัวกรอง</button>
        </>
      )}
    </div>
  )
}
