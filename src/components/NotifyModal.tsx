import Modal from './Modal'
import { TimePicker } from './DateTimePicker'
import DeliveryNote, { type PushInfo } from './DeliveryNote'
import { countPendingReminders, pushWanted } from '../lib/pushStatus'
import type { NotifySettings, Reminder } from '../types'

type Props = {
  notify: NotifySettings
  reminders: Reminder[]
  onNotify: (n: NotifySettings) => void
  onTest: () => void | Promise<void>
  push: PushInfo
  /** switching the daily summary also turns Push on/off (permission is asked inside this click) */
  onDigestToggle: (on: boolean) => void
  onClose: () => void
}

/** Daily summary settings. Per-item reminders live in ReminderModal. */
export default function NotifyModal({ notify, reminders, onNotify, onTest, push, onDigestToggle, onClose }: Props) {
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
            <TimePicker label="เวลาแจ้งเตือน" value={notify.time} onChange={(time) => onNotify({ ...notify, time })} />
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
        {notify.enabled && <DeliveryNote wanted={pushWanted(true, countPendingReminders(reminders))} push={push} />}
        {notify.enabled && push.state === 'on' && <p className="muted small">ปุ่ม “ทดสอบ” จะส่งทั้งในแอปและ Push (ล็อกจอแล้วรอ ~2 นาที)</p>}
      </div>
    </Modal>
  )
}
