import { useMemo } from 'react'
import { customerOf, EMPTY, hasFilters, NO_FILTERS, uniqueValues } from '../lib/filters'
import type { Filters, Shipment } from '../types'

type Props = { shipments: Shipment[]; filters: Filters; shown: number; onChange: (f: Filters) => void }

export default function FilterBar({ shipments, filters, shown, onChange }: Props) {
  const opts = useMemo(
    () => ({
      site: uniqueValues(shipments, (s) => s.site),
      status: uniqueValues(shipments, (s) => s.status),
      driver: uniqueValues(shipments, (s) => s.driver),
      customer: uniqueValues(shipments, customerOf),
    }),
    [shipments],
  )
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch })

  return (
    <div className="filterbar">
      <input
        type="search"
        placeholder="ค้นหา SO / ลูกค้า / สินค้า / คนขับ…"
        aria-label="ค้นหา"
        value={filters.q}
        onChange={(e) => set({ q: e.target.value })}
      />
      <select aria-label="กรองตาม Site" value={filters.site} onChange={(e) => set({ site: e.target.value })}>
        <option value="">Site: ทั้งหมด</option>
        {opts.site.map((v) => (
          <option key={v}>{v}</option>
        ))}
      </select>
      <select aria-label="กรองตามสถานะ" value={filters.status} onChange={(e) => set({ status: e.target.value })}>
        <option value="">สถานะ: ทั้งหมด</option>
        <option value={EMPTY}>(ยังไม่มีสถานะ)</option>
        {opts.status.map((v) => (
          <option key={v}>{v}</option>
        ))}
      </select>
      <select aria-label="กรองตามคนขับ" value={filters.driver} onChange={(e) => set({ driver: e.target.value })}>
        <option value="">คนขับ: ทั้งหมด</option>
        <option value={EMPTY}>(ยังไม่จัดคนขับ)</option>
        {opts.driver.map((v) => (
          <option key={v}>{v}</option>
        ))}
      </select>
      <select aria-label="กรองตามลูกค้า" value={filters.customer} onChange={(e) => set({ customer: e.target.value })}>
        <option value="">ลูกค้า: ทั้งหมด</option>
        {opts.customer.map((v) => (
          <option key={v}>{v}</option>
        ))}
      </select>
      {hasFilters(filters) && (
        <>
          <span className="muted small">{shown.toLocaleString()} รายการ</span>
          <button onClick={() => onChange(NO_FILTERS)}>ล้างตัวกรอง</button>
        </>
      )}
    </div>
  )
}
