import { useRef, useState } from 'react'
import Modal from './Modal'
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
  onClear: () => void
  onClose: () => void
}

type Format = 'xlsx' | 'csv' | 'ics' | 'json'

export default function DataModal({ all, filtered, reminders, groupBy, onRestore, onClear, onClose }: Props) {
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
            <select value={format} onChange={(e) => setFormat(e.target.value as Format)}>
              <option value="xlsx">Excel (.xlsx)</option>
              <option value="csv">CSV</option>
              <option value="ics">ปฏิทิน (.ics) สำหรับ Google/Outlook</option>
              <option value="json">สำรองข้อมูล (.json)</option>
            </select>
          </label>
          {format !== 'json' && (
            <label>
              ข้อมูล
              <select value={scope} onChange={(e) => setScope(e.target.value as 'filtered' | 'all')}>
                <option value="filtered">ตามตัวกรองปัจจุบัน ({filtered.length.toLocaleString()})</option>
                <option value="all">ทั้งหมด ({all.length.toLocaleString()})</option>
              </select>
            </label>
          )}
          {usesDates && (
            <label>
              รูปแบบวันที่
              <select value={dateFmt} onChange={(e) => setDateFmt(e.target.value as DateFmt)}>
                <option value="CE">ค.ศ. 2026-10-12</option>
                <option value="BE">พ.ศ. 12/10/2569</option>
              </select>
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
            <select value={mode} onChange={(e) => setMode(e.target.value as 'merge' | 'replace')}>
              <option value="merge">รวมกับข้อมูลเดิม (ไฟล์สำรองทับตัวซ้ำ)</option>
              <option value="replace">แทนที่ข้อมูลเดิมทั้งหมด</option>
            </select>
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
