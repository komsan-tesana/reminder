import type { PushState } from '../lib/push'
import { describeDelivery } from '../lib/pushStatus'

export type PushInfo = { state: PushState; status: string; busy: boolean }

/** How Push delivery is doing; shared by the daily-summary and per-item reminder dialogs. */
export default function DeliveryNote({ wanted, push }: { wanted: boolean; push: PushInfo }) {
  const note = describeDelivery(wanted, push.state)
  if (!note) return null
  return (
    <>
      <p className={`muted small ${note.kind === 'warn' ? 'warn' : ''}`} role="status">
        {note.text}
      </p>
      {push.status && (
        <p className="muted small" role="status">
          {push.status}
        </p>
      )}
      {push.state === 'on' && (
        <p className="muted small">
          ความเป็นส่วนตัว: ส่งไปที่ server เฉพาะที่อยู่ปลายทางของเครื่องนี้กับ “เวลาที่ต้องปลุก” เท่านั้น ไม่มีชื่อลูกค้า เลข SO หรือข้อความแจ้งเตือน ตัวข้อความอยู่ในเครื่องแล้วประกอบเองตอนถูกปลุก
        </p>
      )}
    </>
  )
}
