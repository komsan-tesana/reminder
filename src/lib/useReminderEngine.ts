import { useEffect, useRef } from 'react'
import { lastDigestDate, setLastDigestDate } from './db'
import { playChime } from './sound'
import { dailyDigest, dueReminders, localDate, shouldFireDigest } from './reminders'
import type { NotifySettings, Reminder, Shipment } from '../types'

type Msg = { title: string; body: string; tag?: string }

/**
 * Native notification when permitted; the in-page toast is always shown as well.
 * Goes through the service worker when one is active: that is the only way on Android Chrome
 * (new Notification() throws there) and on an iOS Home Screen app.
 */
export async function systemNotify({ title, body, tag }: Msg) {
  try {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined
    if (reg?.active) {
      await reg.showNotification(title, { body, tag, icon: new URL('icons/icon-192.png', document.baseURI).href })
      return
    }
    new Notification(title, { body, tag })
  } catch {
    /* blocked by the browser; the toast still shows */
  }
}

type Args = {
  ready: boolean
  shipments: Shipment[]
  reminders: Reminder[]
  notify: NotifySettings
  push: (m: Msg) => void
  markFired: (ids: string[]) => void
}

/** While the tab is open: daily digest at the configured time, and per-item reminders when due. */
export function useReminderEngine(args: Args) {
  const latest = useRef(args)
  latest.current = args

  useEffect(() => {
    if (!args.ready) return
    const tick = () => {
      const { shipments, reminders, notify, push, markFired } = latest.current
      const now = new Date()
      let alerted = false

      if (shouldFireDigest(notify, now, lastDigestDate())) {
        setLastDigestDate(localDate(now))
        const d = dailyDigest(shipments, now, notify)
        if (d) {
          void systemNotify({ ...d, tag: 'digest' })
          push(d)
          alerted = true
        }
      }

      const due = dueReminders(reminders, now)
      if (due.length) {
        markFired(due.map((r) => r.id))
        for (const r of due) {
          const m = { title: 'เตือน', body: r.title, tag: `reminder-${r.id}` }
          void systemNotify(m)
          push(m)
        }
        alerted = true
      }

      // one chime per tick, even if a digest and several reminders fire together
      if (alerted && notify.sound) void playChime()
    }
    tick()
    const id = setInterval(tick, 30_000)
    return () => clearInterval(id)
  }, [args.ready])
}
