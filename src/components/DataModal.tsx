import { useRef, useState } from 'react'
import Modal from './Modal'
import Select from './Select'
import { buildGroups } from '../lib/group'
import { parseBackup, toBackup, toCSV, toICS, toRows, toXlsxBlob, type DateFmt } from '../lib/exporters'
import { download } from '../lib/download'
import { localDate } from '../lib/reminders'
import type { GroupBy, Reminder, Shipment } from '../types'

type Props = {
  all: Shipment[]
  filtered: Shipment[]
  reminders: Reminder[]
  groupBy: GroupBy
  onRestore: (data: { shipments: Shipment[]; reminders: Reminder[] }, mode: 'merge' | 'replace') => Promise<void>
  /** a file was exported (the cat counts exports and backups) */
  onExported: (format: string) => void
  onClear: () => void
  onClose: () => void
}

type Format = 'xlsx' | 'csv' | 'ics' | 'json'

export default function DataModal({ all, filtered, reminders, groupBy, onRestore, onExported, onClear, onClose }: Props) {
  const [format, setFormat] = useState<Format>('xlsx')
  const [scope, setScope] = useState<'filtered' | 'all'>('filtered')
  const [dateFmt, setDateFmt] = useState<DateFmt>('CE')
  const [mode, setMode] = useState<'merge' | 'replace'>('merge')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const input = useRef<HTMLInputElement>(null)

  const rows = scope === 'all' ? all : filtered
  const stamp = localDate(new Date()).replace(/-/g, '')

  async function doExport() {
    setBusy(true)
    setMsg('')
    try {
      if (format === 'xlsx') download(await toXlsxBlob(toRows(rows, dateFmt)), `transport-${stamp}.xlsx`)
      else if (format === 'csv') download(new Blob([toCSV(toRows(rows, dateFmt))], { type: 'text/csv;charset=utf-8' }), `transport-${stamp}.csv`)
      else if (format === 'ics') download(new Blob([toICS(buildGroups(rows, groupBy))], { type: 'text/calendar;charset=utf-8' }), `transport-${stamp}.ics`)
      else download(new Blob([toBackup(all, reminders)], { type: 'application/json' }), `transport-backup-${stamp}.json`)
      onExported(format)
      setMsg('ส่งออกแล้ว')
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function restore(f: File | undefined) {
    if (!f) return
    setBusy(true)
    setMsg('')
    try {
      const data = parseBackup(await f.text())
      await onRestore(data, mode)
      setMsg(`กู้คืนแล้ว ${data.shipments.length.toLocaleString()} รายการ, เตือน ${data.reminders.length} รายการ`)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  const usesDates = format === 'xlsx' || format === 'csv'

  return (
    <Modal title="ข้อมูล: ส่งออก / สำรอง / กู้คืน" onClose={onClose} wide>
      <h3>ส่งออก</h3>
      <div className="form">
        <div className="row">
          <label>
            รูปแบบ
            <Select
              value={format}
              label="รูปแบบ"
              options={[
                { value: 'xlsx', label: 'Excel (.xlsx)' },
                { value: 'csv', label: 'CSV' },
                { value: 'ics', label: 'ปฏิทิน (.ics) สำหรับ Google/Outlook' },
                { value: 'json', label: 'สำรองข้อมูล (.json)' },
              ]}
              onChange={(v) => setFormat(v as Format)}
            />
          </label>
          {format !== 'json' && (
            <label>
              ข้อมูล
              <Select
                value={scope}
                label="ข้อมูล"
                options={[
                  { value: 'filtered', label: `ตามตัวกรองปัจจุบัน (${filtered.length.toLocaleString()})` },
                  { value: 'all', label: `ทั้งหมด (${all.length.toLocaleString()})` },
                ]}
                onChange={(v) => setScope(v as 'filtered' | 'all')}
              />
            </label>
          )}
          {usesDates && (
            <label>
              รูปแบบวันที่
              <Select
                value={dateFmt}
                label="รูปแบบวันที่"
                options={[
                  { value: 'CE', label: 'ค.ศ. 2026-10-12' },
                  { value: 'BE', label: 'พ.ศ. 12/10/2569' },
                ]}
                onChange={(v) => setDateFmt(v as DateFmt)}
              />
            </label>
          )}
          <button className="primary" disabled={busy || (format !== 'json' && rows.length === 0)} onClick={doExport}>
            ส่งออก
          </button>
        </div>
        {format === 'ics' && <p className="muted small">1 กลุ่มต่อวัน = 1 อีเวนต์ทั้งวัน (ตามการจัดกลุ่มบนปฏิทิน) พร้อมแจ้งเตือน 09:00 วันก่อนและ 08:00 วันนั้น</p>}
        {format === 'xlsx' && <p className="muted small">ใช้หัวคอลัมน์เดียวกับไฟล์ต้นฉบับ นำกลับมา import ได้ทันที</p>}
      </div>

      <h3>กู้คืนจากไฟล์สำรอง</h3>
      <div className="form">
        <div className="row">
          <label>
            วิธีกู้คืน
            <Select
              value={mode}
              label="วิธีกู้คืน"
              options={[
                { value: 'merge', label: 'รวมกับข้อมูลเดิม (ไฟล์สำรองทับตัวซ้ำ)' },
                { value: 'replace', label: 'แทนที่ข้อมูลเดิมทั้งหมด' },
              ]}
              onChange={(v) => setMode(v as 'merge' | 'replace')}
            />
          </label>
          <input ref={input} type="file" accept=".json,application/json" hidden onChange={(e) => restore(e.target.files?.[0])} />
          <button disabled={busy} onClick={() => input.current?.click()}>
            เลือกไฟล์ .json
          </button>
        </div>
      </div>

      <h3>ล้างข้อมูล</h3>
      <div className="row">
        <button className="danger" disabled={all.length === 0 && reminders.length === 0} onClick={onClear}>
          ลบข้อมูลทั้งหมดในเบราว์เซอร์นี้
        </button>
        <span className="muted small">ข้อมูลอยู่เฉพาะเครื่องนี้ แนะนำให้สำรองก่อนล้างหรือเปลี่ยนเครื่อง</span>
      </div>

      {msg && <p role="status">{msg}</p>}
    </Modal>
  )
}
