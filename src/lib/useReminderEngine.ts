import { useEffect, useRef } from 'react'
import { lastDigestDate, setLastDigestDate } from './db'
import { playChime } from './sound'
import { dailyDigest, dueReminders, localDate, shouldFireDigest } from './reminders'
import type { NotifySettings, Reminder, Shipment } from '../types'

type Msg = { title: string; body: string }

/** Native notification when permitted; the in-page toast is always shown as well. */
export function systemNotify({ title, body }: Msg) {
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') new Notification(title, { body })
  } catch {
    /* some browsers throw outside a service worker; the toast still shows */
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
          systemNotify(d)
          push(d)
          alerted = true
        }
      }

      const due = dueReminders(reminders, now)
      if (due.length) {
        markFired(due.map((r) => r.id))
        for (const r of due) {
          const m = { title: 'เตือน', body: r.title }
          systemNotify(m)
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
