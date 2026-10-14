// What the cat lets you unlock, and how the progress is counted. Pure, so it can be tested; storage lives in db.ts.
import { seasonOf, type Season } from './buddy'
import type { Outfit, Skin } from './buddySprite'

export type BuddyStats = {
  /** times the cat was poked */
  pets: number
  /** local dates (yyyy-mm-dd) the app was opened, newest last, last 120 kept */
  days: string[]
  /** reminders ticked off */
  remindersDone: number
  /** ERP files imported */
  imports: number
  /** opened between midnight and 5 am */
  nightOwl: boolean
  /** festivals the app was opened during (unlocks their outfit for good) */
  seasons: Season[]
}

export const DEFAULT_STATS: BuddyStats = { pets: 0, days: [], remindersDone: 0, imports: 0, nightOwl: false, seasons: [] }

const pad = (n: number) => String(n).padStart(2, '0')
const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export function recordVisit(s: BuddyStats, now: Date): BuddyStats {
  const today = isoDay(now)
  const season = seasonOf(now)
  return {
    ...s,
    days: s.days.includes(today) ? s.days : [...s.days, today].slice(-120),
    nightOwl: s.nightOwl || now.getHours() < 5,
    seasons: season && !s.seasons.includes(season) ? [...s.seasons, season] : s.seasons,
  }
}
export const recordPet = (s: BuddyStats): BuddyStats => ({ ...s, pets: s.pets + 1 })
export const recordReminderDone = (s: BuddyStats): BuddyStats => ({ ...s, remindersDone: s.remindersDone + 1 })
export const recordImport = (s: BuddyStats): BuddyStats => ({ ...s, imports: s.imports + 1 })

/** consecutive days the app was opened, counting back from today (yesterday still counts if today has not been recorded) */
export function streak(days: string[], now: Date): number {
  const set = new Set(days)
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (!set.has(isoDay(cursor))) cursor.setDate(cursor.getDate() - 1)
  let n = 0
  while (set.has(isoDay(cursor))) {
    n++
    cursor.setDate(cursor.getDate() - 1)
  }
  return n
}

export type ItemKind = 'skin' | 'outfit' | 'move'
export type Item = {
  id: string
  kind: ItemKind
  name: string
  /** how to get it, in words */
  hint: string
  /** progress toward it; unlocked when done >= total */
  progress: (s: BuddyStats, now: Date) => { done: number; total: number }
}

const count = (done: number, total: number) => ({ done: Math.min(done, total), total })
const flag = (on: boolean) => ({ done: on ? 1 : 0, total: 1 })

export const ITEMS: Item[] = [
  // fur colours (calico is the one it starts with)
  { id: 'calico', kind: 'skin', name: 'สามสี', hint: 'ตัวเริ่มต้น', progress: () => flag(true) },
  { id: 'orange', kind: 'skin', name: 'ส้มอ้วน', hint: 'เปิดแอปครบ 7 วัน (ไม่ต้องติดกัน)', progress: (s) => count(s.days.length, 7) },
  { id: 'tuxedo', kind: 'skin', name: 'ทักซิโด้', hint: 'ทักเปี๊ยก 50 ครั้ง', progress: (s) => count(s.pets, 50) },
  { id: 'grey', kind: 'skin', name: 'เทาเท่', hint: 'ติ๊กรายการเตือนเสร็จ 10 รายการ', progress: (s) => count(s.remindersDone, 10) },
  // outfits
  { id: 'none', kind: 'outfit', name: 'ไม่ใส่ชุด', hint: 'ตัวเริ่มต้น', progress: () => flag(true) },
  { id: 'scarf', kind: 'outfit', name: 'ผ้าพันคอ', hint: 'ทักเปี๊ยก 10 ครั้ง', progress: (s) => count(s.pets, 10) },
  { id: 'cap', kind: 'outfit', name: 'หมวกคนขับรถ', hint: 'เปิดแอปติดต่อกัน 3 วัน', progress: (s, now) => count(streak(s.days, now), 3) },
  { id: 'hardhat', kind: 'outfit', name: 'หมวกนิรภัย', hint: 'นำเข้าไฟล์ ERP ครั้งแรก', progress: (s) => count(s.imports, 1) },
  { id: 'glasses', kind: 'outfit', name: 'แว่นกันแดด', hint: 'ติ๊กรายการเตือนเสร็จ 3 รายการ', progress: (s) => count(s.remindersDone, 3) },
  { id: 'crown', kind: 'outfit', name: 'มงกุฎราชาทาสแมว', hint: 'ทักเปี๊ยก 100 ครั้ง', progress: (s) => count(s.pets, 100) },
  { id: 'party', kind: 'outfit', name: 'หมวกปาร์ตี้ปีใหม่', hint: 'เปิดแอปช่วง 30 ธ.ค. – 2 ม.ค.', progress: (s) => flag(s.seasons.includes('newyear')) },
  { id: 'songkran', kind: 'outfit', name: 'เสื้อลายดอกสงกรานต์', hint: 'เปิดแอปช่วง 13–15 เม.ย.', progress: (s) => flag(s.seasons.includes('songkran')) },
  { id: 'krathong', kind: 'outfit', name: 'กระทงบนหัว', hint: 'เปิดแอปในเดือนพฤศจิกายน', progress: (s) => flag(s.seasons.includes('krathong')) },
  // moves it starts doing on its own
  { id: 'stretch', kind: 'move', name: 'ท่ายืดตัว', hint: 'ทักเปี๊ยก 5 ครั้ง', progress: (s) => count(s.pets, 5) },
  { id: 'roll', kind: 'move', name: 'ท่ากลิ้งหงายท้อง', hint: 'เปิดแอปครบ 3 วัน', progress: (s) => count(s.days.length, 3) },
  { id: 'tail', kind: 'move', name: 'ท่าไล่หางตัวเอง', hint: 'ทักเปี๊ยก 25 ครั้ง', progress: (s) => count(s.pets, 25) },
]

export const itemById = (id: string): Item | undefined => ITEMS.find((i) => i.id === id)

export function isUnlocked(item: Item, s: BuddyStats, now: Date): boolean {
  const p = item.progress(s, now)
  return p.done >= p.total
}

/** items that became available between two states of the stats */
export function newlyUnlocked(before: BuddyStats, after: BuddyStats, now: Date): Item[] {
  return ITEMS.filter((i) => !isUnlocked(i, before, now) && isUnlocked(i, after, now))
}

/** ids of the unlocked items of one kind */
export function unlockedIds(kind: ItemKind, s: BuddyStats, now: Date): string[] {
  return ITEMS.filter((i) => i.kind === kind && isUnlocked(i, s, now)).map((i) => i.id)
}

/** what is equipped, corrected when it names something unknown or not unlocked (e.g. settings from another device) */
export function safeLook(skin: string, outfit: string, s: BuddyStats, now: Date): { skin: Skin; outfit: Outfit } {
  const ok = (kind: ItemKind, id: string, fallback: string) => (unlockedIds(kind, s, now).includes(id) ? id : fallback)
  return { skin: ok('skin', skin, 'calico') as Skin, outfit: ok('outfit', outfit, 'none') as Outfit }
}
