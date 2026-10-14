import Dexie, { type Table } from 'dexie'
import type { Era, GroupBy, Mapping, NotifySettings, Reminder, Shipment, Theme } from '../types'
import { isTheme } from './theme'
import { DEFAULT_TONES, migrateToneColor, type ToneSetting } from './tones'

export { DEFAULT_TONES }
export type { ToneSetting }
import type { Tone } from './group'

// 4k+ rows exceed the ~5MB localStorage quota, so data lives in IndexedDB
// (still browser-local, no backend). localStorage holds only small settings.
class AppDB extends Dexie {
  shipments!: Table<Shipment, string>
  reminders!: Table<Reminder, string>
  constructor() {
    super('reminder')
    this.version(1).stores({ shipments: 'id,date,so,customerCode' })
    this.version(2).stores({ shipments: 'id,date,so,customerCode', reminders: 'id,at' })
  }
}
export const db = new AppDB()

/** statusColors is the master switch; each tone can also be hidden or recoloured. */
export type DisplaySettings = { statusColors: boolean; tones: Record<Tone, ToneSetting> }

export type Settings = { era: Era; groupBy: GroupBy; theme: Theme; notify: NotifySettings; display: DisplaySettings }
export const DEFAULT_SETTINGS: Settings = {
  era: 'BE',
  groupBy: 'customer',
  theme: 'system',
  notify: { enabled: false, time: '08:00', today: true, daysAhead: 1, sound: true },
  display: { statusColors: true, tones: DEFAULT_TONES },
}
const SETTINGS_KEY = 'reminder.settings.v1'
const MAPPING_KEY = 'reminder.mapping.v1'
const DIGEST_KEY = 'reminder.lastDigest.v1'

function read<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key)
    return v ? { ...fallback, ...JSON.parse(v) } : fallback
  } catch {
    return fallback
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage blocked or full: settings just won't persist */
  }
}

export function loadSettings(): Settings {
  const s = read<Settings>(SETTINGS_KEY, DEFAULT_SETTINGS)
  const tones = Object.fromEntries(
    (Object.keys(DEFAULT_TONES) as Tone[]).map((t) => {
      const saved = s.display?.tones?.[t]
      return [t, { ...DEFAULT_TONES[t], ...saved, color: migrateToneColor(t, saved?.color) }]
    }),
  ) as Record<Tone, ToneSetting>
  // older versions stored `tomorrow: boolean` instead of `daysAhead`
  const { tomorrow, ...savedNotify } = (s.notify ?? {}) as Partial<NotifySettings> & { tomorrow?: boolean }
  const notify = { ...DEFAULT_SETTINGS.notify, ...savedNotify }
  if (savedNotify.daysAhead === undefined && tomorrow === false) notify.daysAhead = 0
  return {
    ...s,
    theme: isTheme(s.theme) ? s.theme : 'system',
    notify,
    display: { statusColors: s.display?.statusColors ?? true, tones },
  }
}
const PANEL_KEY = 'reminder.panel.v1'
export function loadPanelSize(): { w: number | null; h: number | null } {
  const v = read<{ w: unknown; h: unknown }>(PANEL_KEY, { w: null, h: null })
  const ok = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : null)
  return { w: ok(v.w), h: ok(v.h) }
}
export const savePanelSize = (s: { w: number | null; h: number | null }) => write(PANEL_KEY, s)

export const saveSettings = (s: Settings) => write(SETTINGS_KEY, s)

export function lastDigestDate(): string | null {
  try {
    return localStorage.getItem(DIGEST_KEY)
  } catch {
    return null
  }
}
export function setLastDigestDate(d: string) {
  try {
    localStorage.setItem(DIGEST_KEY, d)
  } catch {
    /* ignore */
  }
}

const sig = (headers: string[]) => headers.join('\u0001')
export function loadMapping(headers: string[]): Mapping | null {
  const all = read<Record<string, Mapping>>(MAPPING_KEY, {})
  return all[sig(headers)] ?? null
}
export function saveMapping(headers: string[], mapping: Mapping) {
  const all = read<Record<string, Mapping>>(MAPPING_KEY, {})
  all[sig(headers)] = mapping
  write(MAPPING_KEY, all)
}

/**
 * Merge keeps rows the user edited in the app (their ids match even if the date was moved),
 * everything else is overwritten by the file. Replace wipes the table first.
 */
export async function commitImport(items: Shipment[], mode: 'merge' | 'replace'): Promise<{ kept: number }> {
  let kept = 0
  await db.transaction('rw', db.shipments, async () => {
    if (mode === 'replace') {
      await db.shipments.clear()
      await db.shipments.bulkPut(items)
      return
    }
    const existing = await db.shipments.bulkGet(items.map((i) => i.id))
    const toWrite = items.filter((_, i) => !existing[i]?.editedAt)
    kept = items.length - toWrite.length
    await db.shipments.bulkPut(toWrite)
  })
  return { kept }
}

export async function restoreBackup(data: { shipments: Shipment[]; reminders: Reminder[] }, mode: 'merge' | 'replace') {
  await db.transaction('rw', db.shipments, db.reminders, async () => {
    if (mode === 'replace') {
      await db.shipments.clear()
      await db.reminders.clear()
    }
    await db.shipments.bulkPut(data.shipments)
    await db.reminders.bulkPut(data.reminders)
  })
}

/** Apply an edit to rows; moving the date records it as the confirmed ship date. */
export async function editShipments(ids: string[], patch: Partial<Shipment>): Promise<Shipment[]> {
  const rows = (await db.shipments.bulkGet(ids)).filter((r): r is Shipment => !!r)
  const updated = rows.map((r) => ({
    ...r,
    ...patch,
    ...(patch.date && patch.date !== r.date ? { confirmedDate: patch.date } : {}),
    editedAt: Date.now(),
  }))
  await db.shipments.bulkPut(updated)
  return updated
}
