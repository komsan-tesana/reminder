import type { PushState } from './push'

// Push is not a separate setting: it follows the "daily summary" switch. These pure helpers hold the
// decisions so they can be tested without a browser.

export type PushAction = 'subscribe' | 'unsubscribe' | 'none'

/** What flipping the daily-summary switch does to the device's push subscription. */
export function digestPushAction(state: PushState, on: boolean): PushAction {
  if (on) return state === 'off' ? 'subscribe' : 'none' // 'on': already; the rest cannot subscribe
  return state === 'on' ? 'unsubscribe' : 'none'
}

/**
 * Subscribe quietly at start-up for someone who turned the summary on earlier (before push existed,
 * or on another install). Only when permission is already granted, so nothing is ever prompted
 * without a click.
 */
export function shouldAutoSubscribe(enabled: boolean, state: PushState, permission: NotificationPermission | 'unsupported'): boolean {
  return enabled && state === 'off' && permission === 'granted'
}

export type DeliveryNote = { kind: 'ok' | 'info' | 'warn'; text: string }

const APP_OPEN = 'ตอนนี้เด้งได้เฉพาะตอนเปิดแอปค้างไว้'

/** One line telling the user whether the summary will reach them with the app closed. */
export function describeDelivery(enabled: boolean, state: PushState): DeliveryNote | null {
  if (!enabled) return null
  switch (state) {
    case 'on':
      return { kind: 'ok', text: '✅ เด้งแม้ปิดแอปหรือล็อกจอ (Push เปิดอยู่)' }
    case 'off':
      return { kind: 'warn', text: `ยังไม่ได้เปิด Push (ไม่ได้กดอนุญาต หรือสมัครไม่สำเร็จ) ${APP_OPEN} ปิดแล้วเปิดสวิตช์ใหม่เพื่อลองอีกครั้ง` }
    case 'ios-install':
      return { kind: 'warn', text: `บน iPhone/iPad ต้องเพิ่มแอปลงหน้าจอโฮมก่อนจึงจะเด้งตอนล็อกจอ: กดปุ่มแชร์ใน Safari → “เพิ่มไปยังหน้าจอโฮม” แล้วเปิดจากไอคอนนั้น (iOS 16.4 ขึ้นไป) ${APP_OPEN}` }
    case 'denied':
      return { kind: 'warn', text: `เบราว์เซอร์บล็อกการแจ้งเตือนอยู่ เปิดสิทธิ์ที่ตั้งค่าของเว็บไซต์/แอปนี้ แล้วปิดและเปิดสวิตช์ใหม่ ${APP_OPEN}` }
    case 'unsupported':
      return { kind: 'info', text: `เบราว์เซอร์นี้ไม่รองรับ Push ${APP_OPEN}` }
    case 'unconfigured':
      return { kind: 'info', text: `ยังไม่ได้เปิดใช้ Push ที่เซิร์ฟเวอร์ ${APP_OPEN}` }
  }
}
