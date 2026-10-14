import { useMemo, useState } from 'react'
import { flexRender, getCoreRowModel, getSortedRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table'
import Modal from './Modal'
import { DateTimePicker } from './DateTimePicker'
import { addDays, localDateTime } from '../lib/reminders'
import { fmtDate } from '../lib/format'
import DeliveryNote, { type PushInfo } from './DeliveryNote'
import { countPendingReminders, pushWanted } from '../lib/pushStatus'
import type { Era, NotifySettings, Reminder } from '../types'

export type ReminderDraft = { title: string; date: string }

type Props = {
  era: Era
  notify: NotifySettings
  reminders: Reminder[]
  draft: ReminderDraft | null
  onAdd: (r: Reminder) => void
  onToggle: (r: Reminder) => void
  onDelete: (id: string) => void
  /** delete every reminder that has already fired */
  onClearFired: () => void
  push: PushInfo
  onClose: () => void
}

export default function ReminderModal({ era, notify, reminders, draft, onAdd, onToggle, onDelete, onClearFired, push, onClose }: Props) {
  const [title, setTitle] = useState(draft?.title ?? '')
  // default: 08:00 the day before the shipment
  const [at, setAt] = useState(draft ? `${addDays(draft.date, -1)}T08:00` : localDateTime(new Date()))

  function add() {
    if (!title.trim() || !at) return
    onAdd({ id: crypto.randomUUID(), title: title.trim(), at, done: false })
    setTitle('')
  }

  const pending = countPendingReminders(reminders)
  const firedCount = reminders.filter((r) => r.firedAt).length
  const now = localDateTime(new Date())

  const columns = useMemo<ColumnDef<Reminder>[]>(
    () => [
      {
        id: 'done',
        header: 'เสร็จ',
        meta: { th: 'w-10' },
        cell: ({ row }) => <input type="checkbox" checked={row.original.done} onChange={() => onToggle(row.original)} aria-label="เสร็จแล้ว" />,
      },
      { id: 'title', header: 'ข้อความ', accessorKey: 'title', cell: ({ row }) => <span className={row.original.done ? 'line-through' : ''}>{row.original.title}</span> },
      {
        id: 'at',
        header: 'วันที่ · เวลา',
        accessorKey: 'at',
        meta: { td: 'nw' },
        cell: ({ row }) => `${fmtDate(row.original.at.slice(0, 10), era, 'D MMM YYYY')} · ${row.original.at.slice(11)}`,
      },
      {
        id: 'state',
        header: 'สถานะ',
        enableSorting: false,
        meta: { td: 'nw' },
        cell: ({ row }) => {
          const r = row.original
          const due = !r.done && !r.firedAt && r.at <= now
          return <span className={due ? 'warn' : ''}>{r.done ? 'เสร็จแล้ว' : r.firedAt ? 'เตือนแล้ว' : due ? 'ถึงเวลาแล้ว' : 'รอเตือน'}</span>
        },
      },
      {
        id: 'delete',
        header: '',
        enableSorting: false,
        meta: { th: 'w-10' },
        cell: ({ row }) => (
          <button className="icon" onClick={() => onDelete(row.original.id)} aria-label="ลบ">
            ✕
          </button>
        ),
      },
    ],
    // onToggle / onDelete are recreated by the parent every render; the table only needs the latest ones on click
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [era, now, onToggle, onDelete],
  )
  const table = useReactTable({
    data: reminders,
    columns,
    getRowId: (r) => r.id,
    initialState: { sorting: [{ id: 'at', desc: false }] },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  return (
    <Modal title="เตือนเฉพาะรายการ" onClose={onClose} wide>
      <div className="form">
        <p className="muted small">
          รายการเตือนเด้งแม้ปิดแอปหรือล็อกจอ (Push) ครั้งแรกที่เพิ่มรายการ เบราว์เซอร์จะขออนุญาตแจ้งเตือน
        </p>
        <DeliveryNote wanted={pushWanted(notify.enabled, pending)} push={push} />
        <div className="row">
          <label className="grow">
            ข้อความ
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="เช่น SO21-00002 โทรยืนยันรถ" />
          </label>
          <label>
            เวลา
            <DateTimePicker label="วันและเวลาเตือน" era={era} value={at} onChange={setAt} />
          </label>
          <button className="primary" disabled={!title.trim() || !at} onClick={add}>
            เพิ่ม
          </button>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="muted small">
          {reminders.length} รายการ · รอเตือน {pending} · เตือนแล้ว {firedCount}
        </span>
        <button
          disabled={firedCount === 0}
          onClick={() => window.confirm(`ล้างรายการที่เตือนไปแล้ว ${firedCount} รายการ?`) && onClearFired()}
        >
          ล้างที่เตือนแล้ว ({firedCount})
        </button>
      </div>
      <div className="table-wrap mt-2">
        <table>
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th key={h.id} className={h.column.columnDef.meta?.th}>
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className={row.original.done ? 'opacity-60' : ''}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className={cell.column.columnDef.meta?.td}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
            {reminders.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="muted">
                  ยังไม่มีรายการเตือน
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Modal>
  )
}
