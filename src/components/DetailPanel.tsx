import { useMemo, useState } from 'react'
import { fmtDate, fmtQty } from '../lib/format'
import { groupKey } from '../lib/group'
import type { Available } from '../lib/available'
import type { Era, GroupBy, Shipment } from '../types'

type Props = {
  date: string
  /** when set, show only this group's rows */
  groupKeyFilter: string | null
  shipments: Shipment[]
  era: Era
  groupBy: GroupBy
  available: Available
  onShowWholeDay: () => void
  onEdit: (rows: Shipment[]) => void
  onDelete: (rows: Shipment[]) => void
  onRemind: (rows: Shipment[], date: string) => void
  onClose: () => void
  /** phone bottom sheet: rows as cards, actions pinned at the bottom */
  compact?: boolean
  /** compact only: the sheet is fully open, so the list may scroll */
  expanded?: boolean
}

export default function DetailPanel({ date, groupKeyFilter, shipments, era, groupBy, available: av, onShowWholeDay, onEdit, onDelete, onRemind, onClose, compact = false, expanded = true }: Props) {
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
  const confirmDelete = () => {
    // deleting everything shown without selecting anything is easy to do by accident, so say how many
    if (window.confirm(`ลบ ${target.length} รายการ? การลบถูกจำไว้ นำเข้าไฟล์เดิมซ้ำก็ไม่กลับมา (ยกเว้นเลือกแทนที่ทั้งหมด)`)) onDelete(target)
  }

  const title = fmtDate(date, era, 'dddd D MMMM YYYY')
  const summary = `${groupKeyFilter ? `กลุ่ม: ${groupKeyFilter} · ` : ''}${rows.length} รายการ · รวม ${fmtQty(totalQty)}`

  if (compact)
    return (
      <div className="flex min-h-0 flex-1 flex-col" aria-label="รายละเอียดรายการ">
        <header className="flex items-start justify-between gap-2 px-4">
          <div>
            <h2>{title}</h2>
            <p className="muted m-0">{summary}</p>
          </div>
          <button className="icon" onClick={onClose} aria-label="ปิด">
            ✕
          </button>
        </header>
        <div className="flex gap-2 px-4 pt-2">
          <input className="min-w-0 flex-1" type="search" placeholder="ค้นหาในรายการนี้…" aria-label="ค้นหาในรายการนี้" value={q} onChange={(e) => setQ(e.target.value)} />
          {groupKeyFilter && <button onClick={onShowWholeDay}>ทั้งวัน ({dayRows.length})</button>}
        </div>
        <div className="flex items-center gap-2 px-4 pt-2">
          <button className="primary" disabled={rows.length === 0} onClick={() => onEdit(target)}>
            แก้ไข ({target.length})
          </button>
          <button disabled={rows.length === 0} onClick={() => onRemind(target, date)}>
            เตือน
          </button>
          <button className="danger" disabled={rows.length === 0} onClick={confirmDelete}>
            ลบ ({target.length})
          </button>
          <span className="muted small ml-auto">{chosen.length ? `เลือก ${chosen.length}` : 'ทั้งหมด'}</span>
        </div>
        <ul className={`m-0 min-h-0 flex-1 list-none space-y-2 px-4 pt-3 pb-[max(16px,env(safe-area-inset-bottom))] ${expanded ? 'overflow-y-auto' : 'overflow-hidden'}`}>
          {rows.map((r) => {
            const on = selected.has(r.id)
            const meta = [av.site && r.site, av.driver && r.driver, av.truck && [r.truckNo, r.plate].filter(Boolean).join(' / ')].filter(Boolean).join(' · ')
            return (
              <li key={r.id}>
                <label className={`flex gap-3 rounded-lg border p-3 ${on ? 'border-accent bg-accent/10' : 'border-line bg-bg'}`}>
                  <input type="checkbox" className="mt-1 h-5 w-5 shrink-0" checked={on} onChange={() => toggle(r.id)} aria-label={`เลือก ${r.so}`} />
                  <span className="min-w-0 flex-1 break-words">
                    <span className="flex items-baseline justify-between gap-2">
                      <b>
                        {av.so ? r.so : r.customerName || r.customerCode}
                        {r.editedAt && <span className="edited"> ✎</span>}
                      </b>
                      {av.status && r.status && <span className="muted small shrink-0">{r.status}</span>}
                    </span>
                    {av.customer && av.so && <span className="block">{r.customerName || r.customerCode}</span>}
                    {av.item && (
                      <span className="block">
                        {r.description} <span className="muted small">{r.itemNo}</span>
                      </span>
                    )}
                    {av.qty && (
                      <span className="block font-semibold">
                        {fmtQty(r.qty)} {r.unit}
                      </span>
                    )}
                    {meta && <span className="muted small block">{meta}</span>}
                    {av.remark && r.remark && <span className="muted small block">{r.remark}</span>}
                  </span>
                </label>
              </li>
            )
          })}
          {rows.length === 0 && <li className="muted">ไม่พบรายการ</li>}
        </ul>
      </div>
    )

  return (
    <aside className="panel" aria-label="รายละเอียดรายการ">
      <header>
        <div>
          <h2>{title}</h2>
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
        <button className="danger" disabled={rows.length === 0} onClick={confirmDelete}>
          ลบ ({target.length})
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
              {av.so && <th className="so">SO</th>}
              {av.customer && <th>ลูกค้า</th>}
              {av.item && <th>สินค้า</th>}
              {av.qty && <th className="num">จำนวน</th>}
              {av.site && <th>Site</th>}
              {av.driver && <th>คนขับ</th>}
              {av.truck && <th>รถ</th>}
              {av.status && <th>สถานะ</th>}
              {av.remark && <th>หมายเหตุ</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={selected.has(r.id) ? 'sel' : ''}>
                <td>
                  <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} aria-label={`เลือก ${r.so}`} />
                </td>
                {av.so && (
                  <td className="nw so">
                    {r.so}
                    {r.editedAt && (
                      <span className="edited" title="แก้ไขในแอป (import ครั้งถัดไปจะไม่ทับ)">
                        {' '}
                        ✎
                      </span>
                    )}
                  </td>
                )}
                {av.customer && <td className="cust">{r.customerName || r.customerCode}</td>}
                {av.item && (
                  <td title={r.description}>
                    <div className="clip">{r.description}</div>
                    <div className="muted small">{r.itemNo}</div>
                  </td>
                )}
                {av.qty && (
                  <td className="num">
                    {fmtQty(r.qty)} {r.unit}
                  </td>
                )}
                {av.site && <td className="nw">{r.site}</td>}
                {av.driver && <td className="nw">{r.driver}</td>}
                {av.truck && <td className="nw">{[r.truckNo, r.plate].filter(Boolean).join(' / ')}</td>}
                {av.status && <td className="nw">{r.status}</td>}
                {av.remark && <td>{r.remark}</td>}
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
