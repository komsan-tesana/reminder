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
  onEdit: (rows: Shipment[]) => void
  onRemind: (rows: Shipment[], date: string) => void
  onClose: () => void
}

export default function DetailPanel({ date, groupKeyFilter, shipments, era, groupBy, onShowWholeDay, onEdit, onRemind, onClose }: Props) {
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const dayRows = useMemo(() => shipments.filter((s) => s.date === date), [shipments, date])
  const rows = useMemo(() => {
    const scoped = groupKeyFilter ? dayRows.filter((s) => groupKey(s, groupBy) === groupKeyFilter) : dayRows
    const needle = q.trim().toLowerCase()
    if (!needle) return scoped
    return scoped.filter((s) => Object.values(s).some((v) => typeof v === 'string' && v.toLowerCase().includes(needle)))
  }, [dayRows, groupKeyFilter, groupBy, q])

  // only rows that are still visible count as selected (edits can move rows away)
  const chosen = rows.filter((r) => selected.has(r.id))
  const allChosen = rows.length > 0 && chosen.length === rows.length
  const totalQty = rows.reduce((a, r) => a + r.qty, 0)

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  const toggleAll = () => setSelected(allChosen ? new Set() : new Set(rows.map((r) => r.id)))
  const target = chosen.length ? chosen : rows

  return (
    <aside className="panel" aria-label="รายละเอียดรายการ">
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
        <input type="search" placeholder="ค้นหาในรายการนี้…" aria-label="ค้นหาในรายการนี้" value={q} onChange={(e) => setQ(e.target.value)} />
        {groupKeyFilter && <button onClick={onShowWholeDay}>ดูทั้งวัน ({dayRows.length})</button>}
      </div>
      <div className="panel-tools">
        <button className="primary" disabled={rows.length === 0} onClick={() => onEdit(target)}>
          แก้ไข ({target.length})
        </button>
        <button disabled={rows.length === 0} onClick={() => onRemind(target, date)}>
          ตั้งเตือน
        </button>
        <span className="muted small">{chosen.length ? `เลือก ${chosen.length}` : 'ไม่ได้เลือก = ทั้งหมดที่แสดง'}</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>
                <input type="checkbox" checked={allChosen} onChange={toggleAll} aria-label="เลือกทั้งหมด" />
              </th>
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
              <tr key={r.id} className={selected.has(r.id) ? 'sel' : ''}>
                <td>
                  <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} aria-label={`เลือก ${r.so}`} />
                </td>
                <td>
                  {r.so}
                  {r.editedAt && (
                    <span className="edited" title="แก้ไขในแอป (import ครั้งถัดไปจะไม่ทับ)">
                      {' '}
                      ✎
                    </span>
                  )}
                </td>
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
                <td colSpan={10} className="muted">
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
