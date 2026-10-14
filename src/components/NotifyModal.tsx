import Modal from './Modal'
import Select from './Select'
import Checkbox from './Checkbox'
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
          <Checkbox checked={notify.enabled} disabled={push.busy} onChange={onDigestToggle} />
          แจ้งเตือนอัตโนมัติทุกวัน สรุปงานวันนี้และล่วงหน้า แยกเป็นรายวัน
        </label>
        <div className="row">
          <label>
            เวลา
            <TimePicker label="เวลาแจ้งเตือน" value={notify.time} onChange={(time) => onNotify({ ...notify, time })} />
          </label>
          <label className="row">
            <Checkbox checked={notify.today} onChange={(today) => onNotify({ ...notify, today })} />
            วันนี้
          </label>
          <label>
            แจ้งล่วงหน้า
            <Select
              value={String(notify.daysAhead)}
              label="แจ้งล่วงหน้า"
              options={[{ value: '0', label: 'ไม่ล่วงหน้า' }, ...[1, 2, 3, 5, 7, 14].map((n) => ({ value: String(n), label: n === 1 ? 'พรุ่งนี้' : `${n} วันข้างหน้า` }))]}
              onChange={(v) => onNotify({ ...notify, daysAhead: Number(v) })}
            />
          </label>
          <label className="row">
            <Checkbox checked={notify.sound} onChange={(sound) => onNotify({ ...notify, sound })} />
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
