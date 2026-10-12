import Dexie, { type Table } from 'dexie'
import type { Era, GroupBy, Mapping, Shipment } from '../types'

// 4k+ rows exceed the ~5MB localStorage quota, so shipments live in IndexedDB
// (still browser-local, no backend). localStorage holds only small settings.
class AppDB extends Dexie {
  shipments!: Table<Shipment, string>
  constructor() {
    super('reminder')
    this.version(1).stores({ shipments: 'id,date,so,customerCode' })
  }
}
export const db = new AppDB()

export type Settings = { era: Era; groupBy: GroupBy }
const SETTINGS_KEY = 'reminder.settings.v1'
const MAPPING_KEY = 'reminder.mapping.v1'

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

export const loadSettings = () => read<Settings>(SETTINGS_KEY, { era: 'BE', groupBy: 'customer' })
export const saveSettings = (s: Settings) => write(SETTINGS_KEY, s)

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

export async function commitImport(items: Shipment[], mode: 'merge' | 'replace') {
  await db.transaction('rw', db.shipments, async () => {
    if (mode === 'replace') await db.shipments.clear()
    await db.shipments.bulkPut(items)
  })
}
