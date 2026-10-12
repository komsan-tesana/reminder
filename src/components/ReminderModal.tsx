import { useState } from 'react'
import Modal from './Modal'
import { addDays, localDateTime } from '../lib/reminders'
import { fmtDate } from '../lib/format'
import type { Era, NotifySettings, Reminder } from '../types'

export type ReminderDraft = { title: string; date: string }

type Props = {
  era: Era
  notify: NotifySettings
  reminders: Reminder[]
  draft: ReminderDraft | null
  onNotify: (n: NotifySettings) => void
  onAdd: (r: Reminder) => void
  onToggle: (r: Reminder) => void
  onDelete: (id: string) => void
  onTest: () => void
  onClose: () => void
}

const permission = () => (typeof Notification === 'undefined' ? 'unsupported' : Notification.permission)

export default function ReminderModal({ era, notify, reminders, draft, onNotify, onAdd, onToggle, onDelete, onTest, onClose }: Props) {
  const [perm, setPerm] = useState(permission())
  const [title, setTitle] = useState(draft?.title ?? '')
  // default: 08:00 the day before the shipment
  const [at, setAt] = useState(draft ? `${addDays(draft.date, -1)}T08:00` : localDateTime(new Date()))

  async function toggleEnabled(on: boolean) {
    if (on && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      setPerm(await Notification.requestPermission())
    }
    onNotify({ ...notify, enabled: on })
  }

  function add() {
    if (!title.trim() || !at) return
    onAdd({ id: crypto.randomUUID(), title: title.trim(), at, done: false })
    setTitle('')
  }

  const sorted = [...reminders].sort((a, b) => a.at.localeCompare(b.at))
  const now = localDateTime(new Date())

  return (
    <Modal title="การแจ้งเตือน" onClose={onClose} wide>
      <h3>สรุปประจำวัน</h3>
      <div className="form">
        <label className="row">
          <input type="checkbox" checked={notify.enabled} onChange={(e) => toggleEnabled(e.target.checked)} />
          แจ้งเตือนอัตโนมัติทุกวัน สรุปงานวันนี้และล่วงหน้า แยกเป็นรายวัน (ขณะเปิดแท็บนี้ไว้)
        </label>
        <div className="row">
          <label>
            เวลา
            <input type="time" value={notify.time} onChange={(e) => onNotify({ ...notify, time: e.target.value })} />
          </label>
          <label className="row">
            <input type="checkbox" checked={notify.today} onChange={(e) => onNotify({ ...notify, today: e.target.checked })} />
            วันนี้
          </label>
          <label>
            แจ้งล่วงหน้า
            <select value={notify.daysAhead} onChange={(e) => onNotify({ ...notify, daysAhead: Number(e.target.value) })}>
              <option value={0}>ไม่ล่วงหน้า</option>
              {[1, 2, 3, 5, 7, 14].map((n) => (
                <option key={n} value={n}>
                  {n === 1 ? 'พรุ่งนี้' : `${n} วันข้างหน้า`}
                </option>
              ))}
            </select>
          </label>
          <label className="row">
            <input type="checkbox" checked={notify.sound} onChange={(e) => onNotify({ ...notify, sound: e.target.checked })} />
            🔊 เสียงแจ้งเตือน
          </label>
          <button onClick={onTest}>ทดสอบ</button>
        </div>
        <p className="muted small">
          {perm === 'granted' && 'เบราว์เซอร์อนุญาตการแจ้งเตือนแล้ว'}
          {perm === 'denied' && 'เบราว์เซอร์บล็อกการแจ้งเตือน จะแสดงเป็นข้อความในหน้านี้แทน (เปิดสิทธิ์ได้ที่ตั้งค่าของเว็บไซต์)'}
          {perm === 'default' && 'ยังไม่ได้ขออนุญาตเบราว์เซอร์ จะขอเมื่อเปิดสวิตช์ด้านบน'}
          {perm === 'unsupported' && 'เบราว์เซอร์นี้ไม่รองรับการแจ้งเตือน จะแสดงเป็นข้อความในหน้านี้แทน'}
          <br />
          เว็บบน GitHub Pages ส่งการแจ้งเตือนได้เฉพาะตอนเปิดแท็บค้างไว้ ถ้าต้องการให้เตือนแม้ปิดแอป ให้ส่งออกเป็น .ics แล้วนำเข้า Google/Outlook Calendar
        </p>
      </div>

      <h3>เตือนเฉพาะรายการ</h3>
      <div className="form">
        <div className="row">
          <label className="grow">
            ข้อความ
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="เช่น SO21-00002 โทรยืนยันรถ" />
          </label>
          <label>
            เวลา
            <input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} />
          </label>
          <button className="primary" disabled={!title.trim() || !at} onClick={add}>
            เพิ่ม
          </button>
        </div>
      </div>

      <ul className="rem-list">
        {sorted.map((r) => (
          <li key={r.id} className={r.done ? 'done' : r.at <= now ? 'due' : ''}>
            <input type="checkbox" checked={r.done} onChange={() => onToggle(r)} aria-label="เสร็จแล้ว" />
            <span className="grow">{r.title}</span>
            <span className="muted small">
              {fmtDate(r.at.slice(0, 10), era, 'D MMM YYYY')} {r.at.slice(11)}
              {!r.done && r.firedAt ? ' · เตือนแล้ว' : ''}
            </span>
            <button className="icon" onClick={() => onDelete(r.id)} aria-label="ลบ">
              ✕
            </button>
          </li>
        ))}
        {sorted.length === 0 && <li className="muted">ยังไม่มีรายการเตือน</li>}
      </ul>
    </Modal>
  )
}
