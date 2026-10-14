import { useState } from 'react'
import Modal from './Modal'
import { addDays, localDateTime } from '../lib/reminders'
import { fmtDate } from '../lib/format'
import { currentNotifyState, currentPlatform } from '../lib/platform'
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
  onExportCalendar: () => void
  onClose: () => void
}

export default function ReminderModal({ era, notify, reminders, draft, onNotify, onAdd, onToggle, onDelete, onTest, onExportCalendar, onClose }: Props) {
  const [perm, setPerm] = useState(currentNotifyState())
  const platform = currentPlatform()
  const [title, setTitle] = useState(draft?.title ?? '')
  // default: 08:00 the day before the shipment
  const [at, setAt] = useState(draft ? `${addDays(draft.date, -1)}T08:00` : localDateTime(new Date()))

  async function toggleEnabled(on: boolean) {
    if (on && perm === 'default') {
      await Notification.requestPermission()
      setPerm(currentNotifyState())
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
          {perm === 'ios-install' && 'บน iPhone/iPad แจ้งเตือนของเว็บใช้ได้เมื่อเพิ่มแอปลงหน้าจอโฮมก่อน: กดปุ่มแชร์ใน Safari → “เพิ่มไปยังหน้าจอโฮม” แล้วเปิดจากไอคอนนั้น (ต้อง iOS 16.4 ขึ้นไป)'}
        </p>
      </div>

      <h3>ให้เด้งเตือนแม้ปิดแอป/ล็อกจอ</h3>
      <div className="form">
        <p className="muted small">
          เว็บนี้ไม่มี server เลยส่งแจ้งเตือนได้เฉพาะตอนแอปเปิดอยู่ ({platform === 'ios' ? 'iOS จะหยุดแอปทันทีที่ล็อกจอ' : 'เบราว์เซอร์อาจหยุดแท็บที่อยู่เบื้องหลัง'})
          วิธีที่เด้งตอนล็อกจอได้แน่นอน คือเพิ่มงานและรายการเตือนลงแอปปฏิทินของเครื่อง ซึ่งจะเตือนเองโดยไม่ต้องเปิดเว็บ
        </p>
        <div className="row">
          <button className="primary" onClick={onExportCalendar}>
            📅 ซิงก์ลงปฏิทินเครื่อง
          </button>
        </div>
        <p className="muted small">
          ส่งงานตั้งแต่วันนี้เป็นต้นไป (1 กลุ่ม/วัน เตือน 09:00 วันก่อนและ 08:00 วันนั้น) + รายการเตือนที่ตั้งไว้ ·{' '}
          {platform === 'desktop'
            ? 'บนคอมพิวเตอร์จะดาวน์โหลดไฟล์ .ics ให้เปิดนำเข้า Google/Outlook/Apple Calendar'
            : 'กดแล้วเลือก “ปฏิทิน” ในหน้าต่างแชร์ และกดเพิ่มทั้งหมด (เว็บเขียนลงปฏิทินเองโดยไม่ให้คุณยืนยันไม่ได้ ระบบกำหนดไว้)'}
          {' '}· กดซ้ำเมื่อข้อมูลเปลี่ยนเพื่ออัปเดต โดยปกติอีเวนต์เดิมจะถูกอัปเดตไม่ซ้ำ แต่งานที่ลบไปแล้วจะไม่ถูกลบออกจากปฏิทินให้
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
