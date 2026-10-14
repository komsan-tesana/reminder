import { useMemo, useState } from 'react'
import Modal from './Modal'
import { DatePicker } from './DateTimePicker'
import { parseDate } from '../lib/dateParse'
import { fmtDate } from '../lib/format'
import type { Era, Shipment } from '../types'

type TextField = 'driver' | 'truckNo' | 'plate' | 'status' | 'deliveryOrder' | 'remark'
type Patch = Partial<Pick<Shipment, TextField | 'date'>>

const TEXT_FIELDS: { key: TextField; label: string; list?: 'drivers' | 'statuses' }[] = [
  { key: 'driver', label: 'คนขับ', list: 'drivers' },
  { key: 'truckNo', label: 'เลขที่รถ' },
  { key: 'plate', label: 'ทะเบียนรถ' },
  { key: 'status', label: 'สถานะการขนส่ง', list: 'statuses' },
  { key: 'deliveryOrder', label: 'เลขที่ใบขนส่ง' },
  { key: 'remark', label: 'หมายเหตุ' },
]

type Props = {
  rows: Shipment[]
  /** all rows, used only for autocomplete suggestions */
  all: Shipment[]
  era: Era
  onSave: (patch: Patch) => void
  onClose: () => void
}

/** Bulk edit: a field is only written if the user touched it. Untouched fields stay as they are. */
export default function EditModal({ rows, all, era, onSave, onClose }: Props) {
  const common = (pick: (s: Shipment) => string) => {
    const first = pick(rows[0])
    return rows.every((r) => pick(r) === first) ? first : ''
  }
  const [values, setValues] = useState<Record<string, string>>(() => ({
    date: common((s) => s.date),
    ...Object.fromEntries(TEXT_FIELDS.map((f) => [f.key, common((s) => s[f.key])])),
  }))
  const [touched, setTouched] = useState<Set<string>>(new Set())

  const suggestions = useMemo(
    () => ({
      drivers: [...new Set(all.map((s) => s.driver).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'th')),
      statuses: [...new Set(all.map((s) => s.status).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'th')),
    }),
    [all],
  )

  const set = (key: string, v: string) => {
    setValues((x) => ({ ...x, [key]: v }))
    setTouched((t) => new Set(t).add(key))
  }

  const dateOk = !touched.has('date') || parseDate(values.date, 'CE') !== null
  const mixed = (key: string) => key === 'date' ? new Set(rows.map((r) => r.date)).size > 1 : new Set(rows.map((r) => r[key as TextField])).size > 1

  function save() {
    const patch: Patch = {}
    for (const k of touched) {
      if (k === 'date') patch.date = parseDate(values.date, 'CE') ?? undefined
      else patch[k as TextField] = values[k].trim()
    }
    onSave(patch)
  }

  return (
    <Modal
      title={`แก้ไข ${rows.length} รายการ`}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose}>ยกเลิก</button>
          <button className="primary" disabled={touched.size === 0 || !dateOk} onClick={save}>
            บันทึก
          </button>
        </>
      }
    >
      {rows.length > 1 && <p className="muted small">ช่องที่ไม่ได้แก้จะไม่เปลี่ยน · ช่องที่แต่ละรายการค่าไม่เหมือนกันจะว่างไว้</p>}
      <div className="form">
        <label>
          วันที่ส่ง
          <DatePicker label="วันที่ส่ง" era={era} value={values.date} placeholder={mixed('date') ? '(หลายค่า)' : 'เลือกวันที่'} onChange={(v) => set('date', v)} />
          {touched.has('date') && dateOk && values.date && (
            <span className="small muted">= {fmtDate(values.date, era, 'D MMMM YYYY')} · จะบันทึกเป็น Confirmed ship date</span>
          )}
          {!dateOk && <span className="small warn">วันที่ไม่ถูกต้อง</span>}
        </label>
        {TEXT_FIELDS.map((f) => (
          <label key={f.key}>
            {f.label}
            <input
              value={values[f.key]}
              list={f.list}
              placeholder={mixed(f.key) ? '(หลายค่า)' : ''}
              onChange={(e) => set(f.key, e.target.value)}
            />
          </label>
        ))}
      </div>
      <datalist id="drivers">
        {suggestions.drivers.map((v) => (
          <option key={v} value={v} />
        ))}
      </datalist>
      <datalist id="statuses">
        {suggestions.statuses.map((v) => (
          <option key={v} value={v} />
        ))}
      </datalist>
    </Modal>
  )
}
