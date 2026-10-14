import type { PushState } from './push'

// Push is not a separate setting. It is wanted whenever something needs the phone woken: the daily
// summary is switched on, or at least one reminder is still waiting. These pure helpers hold the
// decisions so they can be tested without a browser.

import type { Reminder } from '../types'

/** Reminders that have not fired and are not done: the ones push still has a job to do for. */
export const countPendingReminders = (reminders: Reminder[]): number => reminders.filter((r) => !r.done && !r.firedAt).length

/** Does anything need push right now? */
export const pushWanted = (summaryOn: boolean, pendingReminders: number): boolean => summaryOn || pendingReminders > 0

export type PushAction = 'subscribe' | 'unsubscribe' | 'none'

/** What to do with the device's push subscription, given whether anything needs it. */
export function pushAction(state: PushState, wanted: boolean): PushAction {
  if (wanted) return state === 'off' ? 'subscribe' : 'none' // 'on': already; the rest cannot subscribe
  return state === 'on' ? 'unsubscribe' : 'none'
}

/**
 * Subscribe quietly at start-up for someone who already needed push (summary on, or reminders
 * waiting) before this install had a subscription. Only when permission is already granted, so
 * nothing is ever prompted without a click.
 */
export function shouldAutoSubscribe(wanted: boolean, state: PushState, permission: NotificationPermission | 'unsupported'): boolean {
  return wanted && state === 'off' && permission === 'granted'
}

export type DeliveryNote = { kind: 'ok' | 'info' | 'warn'; text: string }

const APP_OPEN = 'ตอนนี้เด้งได้เฉพาะตอนเปิดแอปค้างไว้'

/** One line telling the user whether notifications will reach them with the app closed (null when push is not wanted). */
export function describeDelivery(wanted: boolean, state: PushState): DeliveryNote | null {
  if (!wanted) return null
  switch (state) {
    case 'on':
      return { kind: 'ok', text: '✅ เด้งแม้ปิดแอปหรือล็อกจอ (Push เปิดอยู่)' }
    case 'off':
      return { kind: 'warn', text: `ยังไม่ได้เปิด Push (ไม่ได้กดอนุญาต หรือสมัครไม่สำเร็จ) ${APP_OPEN} ลองใหม่ได้โดยปิดแล้วเปิดสวิตช์สรุปประจำวัน หรือเพิ่มรายการเตือนใหม่` }
    case 'ios-install':
      return { kind: 'warn', text: `บน iPhone/iPad ต้องเพิ่มแอปลงหน้าจอโฮมก่อนจึงจะเด้งตอนล็อกจอ: กดปุ่มแชร์ใน Safari → “เพิ่มไปยังหน้าจอโฮม” แล้วเปิดจากไอคอนนั้น (iOS 16.4 ขึ้นไป) ${APP_OPEN}` }
    case 'denied':
      return { kind: 'warn', text: `เบราว์เซอร์บล็อกการแจ้งเตือนอยู่ เปิดสิทธิ์ที่ตั้งค่าของเว็บไซต์/แอปนี้ แล้วลองใหม่ ${APP_OPEN}` }
    case 'unsupported':
      return { kind: 'info', text: `เบราว์เซอร์นี้ไม่รองรับ Push ${APP_OPEN}` }
    case 'unconfigured':
      return { kind: 'info', text: `ยังไม่ได้เปิดใช้ Push ที่เซิร์ฟเวอร์ ${APP_OPEN}` }
  }
}
