import { useMemo, useState } from 'react'
import {
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type FilterFn,
} from '@tanstack/react-table'
import { fmtDate, fmtQty } from '../lib/format'
import { groupKey } from '../lib/group'
import type { Available } from '../lib/available'
import ColumnFilter from './ColumnFilter'
import type { Era, GroupBy, Shipment } from '../types'

/** columns that get a header filter in the table; `get` is the text a row shows (and is filtered by) */
type ColKey = 'so' | 'customer' | 'item' | 'site' | 'driver' | 'truck' | 'status' | 'remark'
const COL_GET: Record<ColKey, (r: Shipment) => string> = {
  so: (r) => r.so ?? '',
  customer: (r) => r.customerName || r.customerCode || '',
  item: (r) => r.description ?? '',
  site: (r) => r.site ?? '',
  driver: (r) => r.driver ?? '',
  truck: (r) => [r.truckNo, r.plate].filter(Boolean).join(' / '),
  status: (r) => r.status ?? '',
  remark: (r) => r.remark ?? '',
}

/** keeps a row when its cell text is one of the ticked values (header filter); an empty list matches nothing */
const includesAny: FilterFn<Shipment> = (row, id, value: string[]) => value.includes(String(row.getValue(id) ?? ''))
includesAny.autoRemove = (v) => v === undefined

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
  const scoped = useMemo(() => (groupKeyFilter ? dayRows.filter((s) => groupKey(s, groupBy) === groupKeyFilter) : dayRows), [dayRows, groupKeyFilter, groupBy])
  const [colFilters, setColFilters] = useState<ColumnFiltersState>([])

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const columns = useMemo<ColumnDef<Shipment>[]>(() => {
    const text = (id: ColKey, header: string, show: boolean, td: string, cell?: ColumnDef<Shipment>['cell'], th?: string): ColumnDef<Shipment>[] =>
      show ? [{ id, accessorFn: COL_GET[id], header, filterFn: includesAny, meta: { th, td, filter: true }, ...(cell ? { cell } : {}) }] : []
    return [
      {
        id: 'select',
        enableColumnFilter: false,
        enableGlobalFilter: false,
        header: '',
        cell: ({ row }) => <input type="checkbox" checked={selected.has(row.id)} onChange={() => toggle(row.id)} aria-label={`เลือก ${row.original.so}`} />,
      },
      ...text('so', 'SO', av.so, 'nw so', ({ row }) => (
        <>
          {row.original.so}
          {row.original.editedAt && (
            <span className="edited" title="แก้ไขในแอป (import ครั้งถัดไปจะไม่ทับ)">
              {' '}
              ✎
            </span>
          )}
        </>
      ), 'so'),
      ...text('customer', 'ลูกค้า', av.customer, 'cust'),
      ...text('item', 'สินค้า', av.item, '', ({ row }) => (
        <div title={row.original.description}>
          <div className="clip">{row.original.description}</div>
          <div className="muted small">{row.original.itemNo}</div>
        </div>
      )),
      ...(av.qty
        ? [
            {
              id: 'qty',
              accessorFn: (r: Shipment) => r.qty,
              header: 'จำนวน',
              enableColumnFilter: false,
              meta: { th: 'num', td: 'num' },
              cell: ({ row }: { row: { original: Shipment } }) => (
                <>
                  {fmtQty(row.original.qty)} {row.original.unit}
                </>
              ),
            } satisfies ColumnDef<Shipment>,
          ]
        : []),
      ...text('site', 'Site', av.site, 'nw'),
      ...text('driver', 'คนขับ', av.driver, 'nw'),
      ...text('truck', 'รถ', av.truck, 'nw'),
      ...text('status', 'สถานะ', av.status, 'nw'),
      ...text('remark', 'หมายเหตุ', av.remark, ''),
    ]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [av, selected])

  // TanStack Table does the column filters (header checklists) and the search box; the panel renders what it returns
  const table = useReactTable({
    data: scoped,
    columns,
    getRowId: (r) => r.id,
    state: { columnFilters: colFilters, globalFilter: q },
    onColumnFiltersChange: setColFilters,
    globalFilterFn: (row, _id, needle: string) => {
      const n = needle.trim().toLowerCase()
      return !n || Object.values(row.original).some((v) => typeof v === 'string' && v.toLowerCase().includes(n))
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  })
  const rows = table.getRowModel().rows.map((r) => r.original)
  const activeFilters = colFilters.length

  // only rows that are still visible count as selected (edits can move rows away)
  const chosen = rows.filter((r) => selected.has(r.id))
  const allChosen = rows.length > 0 && chosen.length === rows.length
  const totalQty = rows.reduce((a, r) => a + r.qty, 0)

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
        {activeFilters > 0 && <button onClick={() => setColFilters([])}>ล้างตัวกรองคอลัมน์ ({activeFilters})</button>}
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
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th key={h.id} className={h.column.columnDef.meta?.th}>
                    {h.column.id === 'select' ? (
                      <input type="checkbox" checked={allChosen} onChange={toggleAll} aria-label="เลือกทั้งหมด" />
                    ) : (
                      <>
                        {flexRender(h.column.columnDef.header, h.getContext())}{' '}
                        {h.column.columnDef.meta?.filter && (
                          <ColumnFilter
                            label={String(h.column.columnDef.header)}
                            values={[...h.column.getFacetedUniqueValues().keys()].map(String)}
                            selected={h.column.getFilterValue() as string[] | undefined}
                            onChange={(v) => h.column.setFilterValue(v)}
                          />
                        )}
                      </>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className={selected.has(row.id) ? 'sel' : ''}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className={cell.column.columnDef.meta?.td}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={table.getVisibleLeafColumns().length} className="muted">
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
