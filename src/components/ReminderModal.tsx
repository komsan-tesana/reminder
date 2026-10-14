import { useState } from 'react'
import Modal from './Modal'
import { addDays, localDateTime } from '../lib/reminders'
import { fmtDate } from '../lib/format'
import { currentNotifyState, currentPlatform } from '../lib/platform'
import type { PushState } from '../lib/push'
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
  push: { state: PushState; status: string; busy: boolean }
  onPushToggle: (on: boolean) => void
  onPushTest: () => void
  onClose: () => void
}

export default function ReminderModal({ era, notify, reminders, draft, onNotify, onAdd, onToggle, onDelete, onTest, onExportCalendar, push, onPushToggle, onPushTest, onClose }: Props) {
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
        <p className="muted small">
          {perm === 'granted' && 'เบราว์เซอร์อนุญาตการแจ้งเตือนแล้ว'}
          {perm === 'denied' && 'เบราว์เซอร์บล็อกการแจ้งเตือน จะแสดงเป็นข้อความในหน้านี้แทน (เปิดสิทธิ์ได้ที่ตั้งค่าของเว็บไซต์)'}
          {perm === 'default' && 'ยังไม่ได้ขออนุญาตเบราว์เซอร์ จะขอเมื่อเปิดสวิตช์ด้านบน'}
          {perm === 'unsupported' && 'เบราว์เซอร์นี้ไม่รองรับการแจ้งเตือน จะแสดงเป็นข้อความในหน้านี้แทน'}
          {perm === 'ios-install' && 'บน iPhone/iPad แจ้งเตือนของเว็บใช้ได้เมื่อเพิ่มแอปลงหน้าจอโฮมก่อน: กดปุ่มแชร์ใน Safari → “เพิ่มไปยังหน้าจอโฮม” แล้วเปิดจากไอคอนนั้น (ต้อง iOS 16.4 ขึ้นไป)'}
        </p>
      </div>

      <h3>เด้งเตือนแม้ปิดแอป/ล็อกจอ (Push)</h3>
      <div className="form">
        <p className="muted small">
          การแจ้งเตือนด้านบนเด้งได้เฉพาะตอนเปิดหน้านี้ค้างไว้ ({platform === 'ios' ? 'iOS หยุดแอปทันทีที่ล็อกจอ' : 'เบราว์เซอร์อาจหยุดแท็บที่อยู่เบื้องหลัง'}) ถ้าต้องการให้เด้งเองแม้ล็อกจอ เปิด Push ด้านล่าง
        </p>
        {push.state === 'unconfigured' && <p className="muted small">ยังไม่ได้ตั้งค่า server สำหรับ Push (ผู้ดูแลต้อง deploy Worker และใส่ค่าใน src/lib/pushConfig.ts ตามคู่มือ worker/README.md)</p>}
        {push.state === 'unsupported' && <p className="muted small">เบราว์เซอร์นี้ไม่รองรับ Push</p>}
        {push.state === 'ios-install' && (
          <p className="muted small">บน iPhone/iPad ต้องเพิ่มแอปลงหน้าจอโฮมก่อน: กดปุ่มแชร์ใน Safari → “เพิ่มไปยังหน้าจอโฮม” แล้วเปิดจากไอคอนนั้น (iOS 16.4 ขึ้นไป) จากนั้นกลับมาเปิดส่วนนี้</p>
        )}
        {push.state === 'denied' && <p className="muted small">เบราว์เซอร์บล็อกการแจ้งเตือนอยู่ เปิดสิทธิ์ได้ที่ตั้งค่าของเว็บไซต์/แอปนี้ แล้วกลับมาเปิดใหม่</p>}
        {push.state === 'off' && (
          <div className="row">
            <button className="primary" disabled={push.busy} onClick={() => onPushToggle(true)}>
              🔔 เปิดแจ้งเตือนแบบ Push
            </button>
          </div>
        )}
        {push.state === 'on' && (
          <div className="row">
            <span>✅ เปิดอยู่</span>
            <button disabled={push.busy} onClick={onPushTest}>
              ทดสอบ (ล็อกจอแล้วรอ ~2 นาที)
            </button>
            <button disabled={push.busy} onClick={() => onPushToggle(false)}>
              ปิด
            </button>
          </div>
        )}
        {push.status && <p className="muted small" role="status">{push.status}</p>}
        <p className="muted small">
          ความเป็นส่วนตัว: ส่งไปที่ server เฉพาะที่อยู่ปลายทางของเครื่องนี้กับ “เวลาที่ต้องปลุก” เท่านั้น ไม่มีชื่อลูกค้า เลข SO หรือข้อความแจ้งเตือน ตัวข้อความอยู่ในเครื่องแล้วประกอบเองตอนถูกปลุก · ใช้ร่วมกับ “แจ้งเตือนอัตโนมัติทุกวัน” ด้านบนและรายการเตือน ถ้าซิงก์ปฏิทินเครื่องด้วย อาจเตือนซ้ำสองทาง
        </p>
      </div>

      <h3>หรือซิงก์ลงแอปปฏิทินของเครื่อง</h3>
      <div className="form">
        <p className="muted small">
          ไม่ต้องใช้ server: ซิงก์ลงแอปปฏิทินของเครื่อง เมื่อเปิดสวิตช์ “แจ้งเตือนอัตโนมัติ” ไว้ ไฟล์จะมีสรุปรายวันตามเวลา/จำนวนวันที่ตั้ง เป็นอีเวนต์เตือนในปฏิทินเครื่อง
        </p>
        <div className="row">
          <button className="primary" onClick={onExportCalendar}>
            📅 ซิงก์ลงปฏิทินเครื่อง
          </button>
        </div>
        <p className="muted small">
          ส่งงานตั้งแต่วันนี้เป็นต้นไป + รายการเตือนที่ตั้งไว้ (ถ้าปิดสวิตช์แจ้งเตือนอัตโนมัติ จะเตือนทีละกลุ่ม 09:00 วันก่อนและ 08:00 วันนั้นแทน) · ต้องซิงก์ใหม่เมื่อมีงานเพิ่ม/แก้ไข ·{' '}
          {platform === 'ios'
            ? 'iPhone จะขึ้นหน้าต่าง “เพิ่มทั้งหมด” ของแอปปฏิทิน กดยืนยัน 1 ครั้ง (iOS ไม่ให้เว็บเพิ่มลงปฏิทินเองโดยไม่ถาม) ต้องเปิดจาก Safari ถ้าเปิดจากแอปบนหน้าจอโฮมแล้วไม่ขึ้น ให้เปิดเว็บใน Safari'
            : 'จะดาวน์โหลดไฟล์ .ics แล้วเปิดไฟล์นั้นเพื่อนำเข้า Google/Outlook/Apple Calendar'}
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
