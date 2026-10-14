import { useState } from 'react'
import Modal from './Modal'
import { addDays, localDateTime } from '../lib/reminders'
import { fmtDate } from '../lib/format'
import type { PushState } from '../lib/push'
import { describeDelivery } from '../lib/pushStatus'
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
  onTest: () => void | Promise<void>
  push: { state: PushState; status: string; busy: boolean }
  /** switching the daily summary also turns Push on/off (permission is asked inside this click) */
  onDigestToggle: (on: boolean) => void
  onClose: () => void
}

export default function ReminderModal({ era, notify, reminders, draft, onNotify, onAdd, onToggle, onDelete, onTest, push, onDigestToggle, onClose }: Props) {
  const [title, setTitle] = useState(draft?.title ?? '')
  // default: 08:00 the day before the shipment
  const [at, setAt] = useState(draft ? `${addDays(draft.date, -1)}T08:00` : localDateTime(new Date()))

  function add() {
    if (!title.trim() || !at) return
    onAdd({ id: crypto.randomUUID(), title: title.trim(), at, done: false })
    setTitle('')
  }

  const note = describeDelivery(notify.enabled, push.state)
  const sorted = [...reminders].sort((a, b) => a.at.localeCompare(b.at))
  const now = localDateTime(new Date())

  return (
    <Modal title="การแจ้งเตือน" onClose={onClose} wide>
      <h3>สรุปประจำวัน</h3>
      <div className="form">
        <label className="row">
          <input type="checkbox" checked={notify.enabled} disabled={push.busy} onChange={(e) => onDigestToggle(e.target.checked)} />
          แจ้งเตือนอัตโนมัติทุกวัน สรุปงานวันนี้และล่วงหน้า แยกเป็นรายวัน
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
        {note && (
          <p className={`muted small ${note.kind === 'warn' ? 'warn' : ''}`} role="status">
            {note.text}
          </p>
        )}
        {push.status && (
          <p className="muted small" role="status">
            {push.status}
          </p>
        )}
        {notify.enabled && push.state === 'on' && (
          <p className="muted small">
            ความเป็นส่วนตัว: ส่งไปที่ server เฉพาะที่อยู่ปลายทางของเครื่องนี้กับ “เวลาที่ต้องปลุก” เท่านั้น ไม่มีชื่อลูกค้า เลข SO หรือข้อความแจ้งเตือน ตัวข้อความอยู่ในเครื่องแล้วประกอบเองตอนถูกปลุก · ปุ่ม “ทดสอบ” จะส่งทั้งในแอปและ Push (ล็อกจอแล้วรอ ~2 นาที)
          </p>
        )}
      </div>

      <h3>เตือนเฉพาะรายการ</h3>
      <div className="form">
        <p className="muted small">รายการเตือนจะเด้งแม้ล็อกจอเมื่อเปิด “แจ้งเตือนอัตโนมัติ” ด้านบน (Push) ถ้าปิดสวิตช์ จะเตือนเฉพาะตอนเปิดแอปค้างไว้</p>
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
