/**
 * The slice of Cloudflare KV we use, so tests can back it with a Map. There is deliberately no
 * list(): the free plan allows only 1,000 list calls a day and the cron runs every minute.
 */
export type KVLike = {
  get<T = unknown>(key: string, type: 'json'): Promise<T | null>
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>
  delete(key: string): Promise<void>
}

export type SubRow = { endpoint: string; p256dh: string; auth: string; schedule: string }

export type Store = {
  /** store a device's schedule (replacing the old one); writes only what changed */
  upsert(sub: { endpoint: string; p256dh: string; auth: string }, schedule: number[], nowSec: number): Promise<void>
  remove(endpoint: string): Promise<void>
  /** devices with something due at or before `nowSec`, most overdue first */
  due(nowSec: number, limit: number): Promise<SubRow[]>
  /** replace a device's schedule after waking it (what is left in the future) */
  setSchedule(endpoint: string, schedule: number[]): Promise<void>
  /** persist the index changes of this run: one write, or none when nothing changed */
  flush(): Promise<void>
}

// KV layout, shaped by the free-plan limits (reads 100k/day, writes/lists 1,000/day):
//   sub:<id>  one record per device {endpoint, keys, schedule, updatedAt}, expires on its own
//   index     {<id>: earliest wake-up}  -> an idle cron minute is ONE read and no writes
// The index is the only shared key. Every change re-reads it first, and every /sync repairs the
// device's entry, so a lost update (two writers at once) heals the next time the app syncs.
const INDEX_KEY = 'index'
export const RECORD_TTL_SEC = 120 * 86400
/** an unchanged record is still rewritten after this long, to renew its expiry */
const RENEW_AFTER_SEC = 7 * 86400

type Rec = { endpoint: string; p256dh: string; auth: string; schedule: number[]; updatedAt: number }
type Index = Record<string, number>

/** short stable id for a device: KV keys are limited to 512 bytes and endpoints can be longer */
export async function deviceId(endpoint: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint)))
  let s = ''
  for (const b of digest.slice(0, 16)) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const same = (a: number[], b: number[]) => a.length === b.length && a.every((x, i) => x === b[i])

export class KVStore implements Store {
  private index: Index | null = null
  private dirty = false
  /** records read by due(), so setSchedule need not read them again just to learn the keys */
  private seen = new Map<string, Rec>()

  constructor(private kv: KVLike) {}

  private async loadIndex(): Promise<Index> {
    this.index ??= (await this.kv.get<Index>(INDEX_KEY, 'json')) ?? {}
    return this.index
  }

  private async saveIndex() {
    await this.kv.put(INDEX_KEY, JSON.stringify(this.index))
    this.dirty = false
  }

  private putRecord(id: string, rec: Rec) {
    return this.kv.put(`sub:${id}`, JSON.stringify(rec), { expirationTtl: RECORD_TTL_SEC })
  }

  /** returns true if the entry changed */
  private setEntry(index: Index, id: string, next: number | null): boolean {
    if (next === null) return delete index[id]
    if (index[id] === next) return false
    index[id] = next
    return true
  }

  async upsert(sub: { endpoint: string; p256dh: string; auth: string }, schedule: number[], nowSec: number) {
    const id = await deviceId(sub.endpoint)
    const cur = await this.kv.get<Rec>(`sub:${id}`, 'json')
    const unchanged = cur && cur.p256dh === sub.p256dh && cur.auth === sub.auth && same(cur.schedule, schedule) && nowSec - cur.updatedAt < RENEW_AFTER_SEC
    if (!unchanged) await this.putRecord(id, { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth, schedule, updatedAt: nowSec })
    const index = await this.loadIndex()
    // checked even for an unchanged record: this is what repairs an entry lost to a race
    const before = JSON.stringify(index[id] ?? null)
    this.setEntry(index, id, schedule.length ? schedule[0] : null)
    if (JSON.stringify(index[id] ?? null) !== before) await this.saveIndex()
  }

  async remove(endpoint: string) {
    const id = await deviceId(endpoint)
    await this.kv.delete(`sub:${id}`)
    const index = await this.loadIndex()
    if (id in index) {
      delete index[id]
      await this.saveIndex()
    }
  }

  async due(nowSec: number, limit: number) {
    const index = await this.loadIndex()
    const ids = Object.entries(index)
      .filter(([, next]) => next <= nowSec)
      .sort((a, b) => a[1] - b[1])
      .slice(0, limit)
      .map(([id]) => id)
    const rows: SubRow[] = []
    for (const id of ids) {
      const rec = await this.kv.get<Rec>(`sub:${id}`, 'json')
      if (!rec) {
        // the record expired (KV TTL) or was removed: forget the index entry
        delete index[id]
        this.dirty = true
        continue
      }
      this.seen.set(rec.endpoint, rec)
      rows.push({ endpoint: rec.endpoint, p256dh: rec.p256dh, auth: rec.auth, schedule: JSON.stringify(rec.schedule) })
    }
    return rows
  }

  async setSchedule(endpoint: string, schedule: number[]) {
    const id = await deviceId(endpoint)
    const index = await this.loadIndex()
    const latest = await this.kv.get<Rec>(`sub:${id}`, 'json')
    if (!latest) {
      if (delete index[id]) this.dirty = true
      return
    }
    // the device synced while its push was in flight: keep that newer schedule, don't overwrite it
    const read = this.seen.get(endpoint)
    const raced = !!read && !same(read.schedule, latest.schedule)
    const rest = raced ? latest.schedule : schedule
    if (!raced) await this.putRecord(id, { ...latest, schedule })
    const before = JSON.stringify(index[id] ?? null)
    this.setEntry(index, id, rest.length ? rest[0] : null)
    if (JSON.stringify(index[id] ?? null) !== before) this.dirty = true
  }

  async flush() {
    if (this.dirty) await this.saveIndex()
  }
}
