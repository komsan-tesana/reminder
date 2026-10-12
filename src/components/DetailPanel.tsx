import { useMemo, useState } from 'react'
import { fmtDate, fmtQty } from '../lib/format'
import { groupKey } from '../lib/group'
import type { Era, GroupBy, Shipment } from '../types'

type Props = {
  date: string
  /** when set, show only this group's rows */
  groupKeyFilter: string | null
  shipments: Shipment[]
  era: Era
  groupBy: GroupBy
  onShowWholeDay: () => void
  onClose: () => void
}

export default function DetailPanel({ date, groupKeyFilter, shipments, era, groupBy, onShowWholeDay, onClose }: Props) {
  const [q, setQ] = useState('')

  const dayRows = useMemo(() => shipments.filter((s) => s.date === date), [shipments, date])
  const rows = useMemo(() => {
    const scoped = groupKeyFilter ? dayRows.filter((s) => groupKey(s, groupBy) === groupKeyFilter) : dayRows
    const needle = q.trim().toLowerCase()
    if (!needle) return scoped
    return scoped.filter((s) => Object.values(s).some((v) => typeof v === 'string' && v.toLowerCase().includes(needle)))
  }, [dayRows, groupKeyFilter, groupBy, q])

  const totalQty = rows.reduce((a, r) => a + r.qty, 0)

  return (
    <aside className="panel">
      <header>
        <div>
          <h2>{fmtDate(date, era, 'dddd D MMMM YYYY')}</h2>
          <p className="muted">
            {groupKeyFilter ? `กลุ่ม: ${groupKeyFilter} · ` : ''}
            {rows.length} รายการ · รวม {fmtQty(totalQty)}
          </p>
        </div>
        <button className="icon" onClick={onClose} aria-label="ปิด">
          ✕
        </button>
      </header>
      <div className="panel-tools">
        <input placeholder="ค้นหา SO / ลูกค้า / สินค้า / คนขับ…" value={q} onChange={(e) => setQ(e.target.value)} />
        {groupKeyFilter && (
          <button onClick={onShowWholeDay}>ดูทั้งวัน ({dayRows.length})</button>
        )}
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>SO</th>
              <th>ลูกค้า</th>
              <th>สินค้า</th>
              <th className="num">จำนวน</th>
              <th>Site</th>
              <th>คนขับ</th>
              <th>รถ</th>
              <th>สถานะ</th>
              <th>หมายเหตุ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.so}</td>
                <td>{r.customerName || r.customerCode}</td>
                <td title={r.description}>
                  <div className="clip">{r.description}</div>
                  <div className="muted small">{r.itemNo}</div>
                </td>
                <td className="num">
                  {fmtQty(r.qty)} {r.unit}
                </td>
                <td>{r.site}</td>
                <td>{r.driver}</td>
                <td>{[r.truckNo, r.plate].filter(Boolean).join(' / ')}</td>
                <td>{r.status}</td>
                <td>{r.remark}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="muted">
                  ไม่พบรายการ
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </aside>
  )
}
