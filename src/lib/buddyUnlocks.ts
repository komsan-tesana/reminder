// What the cat lets you unlock, and how the progress is counted. Pure, so it can be tested; storage lives in db.ts.
import { seasonOf, type Season } from './buddy'
import { hasToyArt, type Outfit, type Skin, type Toy } from './buddySprite'
import type { DataFacts } from './buddyData'

/** pokes that count toward unlocks per day, so the big numbers mean "keep coming back", not "hold the mouse button" */
export const DAILY_POKE_CAP = 200
/** filter-bar uses that count per day (searching a lot in one afternoon should not unlock the magnifier) */
export const DAILY_FILTER_CAP = 30

export type BuddyStats = {
  /** pokes counted (at most DAILY_POKE_CAP a day; scaring the cat by poking too fast is not counted) */
  pets: number
  /** pokes counted on `day`, for the daily cap */
  petsToday: { day: string; n: number }
  /** local dates (yyyy-mm-dd) the app was opened, newest last, last 120 kept (the counters below outlive this) */
  days: string[]
  /** every distinct day the app was opened */
  totalDays: number
  /** longest run of consecutive days */
  bestStreak: number
  /** reminders ticked off */
  remindersDone: number
  /** ERP files imported */
  imports: number
  /** opened between midnight and 5 am at least once */
  nightOwl: boolean
  /** distinct days opened between midnight and 5 am, and the last such day */
  nightVisits: number
  lastNight: string
  /** days with work and nothing left to assign (counted once per day), and the last such day */
  perfectDays: number
  lastPerfect: string
  /** times a sleeping cat was woken by a poke */
  wakes: number
  /** festivals the app was opened during (unlocks their outfit for good) */
  seasons: Season[]
  /** rows added by imports that were not in the app before (re-importing the same file adds none) */
  rowsImported: number
  /** the most distinct customers / SO numbers / rows in one day / months the data has covered at once */
  maxCustomers: number
  maxSOs: number
  maxDayRows: number
  maxMonths: number
  /** files exported (any format) and distinct days a backup (.json) was made, with the last such day */
  exports: number
  backupDays: number
  lastBackup: string
  /** rows given a driver or truck, and rows edited, in the edit dialog */
  assigned: number
  edits: number
  /** filter-bar uses, and today's count for the daily cap */
  filterUses: number
  filterToday: { day: string; n: number }
  /** everything ever unlocked: once earned it stays, even if a threshold is raised later */
  earned: string[]
  /** earned items already looked at in the wardrobe (the rest show a dot on the paw button) */
  seen: string[]
}

export const DEFAULT_STATS: BuddyStats = {
  pets: 0,
  petsToday: { day: '', n: 0 },
  days: [],
  totalDays: 0,
  bestStreak: 0,
  remindersDone: 0,
  imports: 0,
  nightOwl: false,
  nightVisits: 0,
  lastNight: '',
  perfectDays: 0,
  lastPerfect: '',
  wakes: 0,
  rowsImported: 0,
  maxCustomers: 0,
  maxSOs: 0,
  maxDayRows: 0,
  maxMonths: 0,
  exports: 0,
  backupDays: 0,
  lastBackup: '',
  assigned: 0,
  edits: 0,
  filterUses: 0,
  filterToday: { day: '', n: 0 },
  seasons: [],
  earned: [],
  seen: [],
}

const pad = (n: number) => String(n).padStart(2, '0')
export const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const fmt = (n: number) => n.toLocaleString('en-US')

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

/** festivals earned just by opening the app; the one-day ones need a poke too (see recordPet) */
const POKE_SEASONS: Season[] = ['halloween', 'christmas']

export function recordVisit(s: BuddyStats, now: Date): BuddyStats {
  const today = isoDay(now)
  const season = seasonOf(now)
  const isNew = !s.days.includes(today)
  const days = isNew ? [...s.days, today].slice(-120) : s.days
  const night = now.getHours() < 5
  const newNight = night && s.lastNight !== today
  return {
    ...s,
    days,
    totalDays: isNew ? s.totalDays + 1 : s.totalDays,
    bestStreak: Math.max(s.bestStreak, streak(days, now)),
    nightOwl: s.nightOwl || night,
    nightVisits: newNight ? s.nightVisits + 1 : s.nightVisits,
    lastNight: newNight ? today : s.lastNight,
    seasons: season && !POKE_SEASONS.includes(season) && !s.seasons.includes(season) ? [...s.seasons, season] : s.seasons,
  }
}

/** how many more pokes still count today */
export function petsLeftToday(s: BuddyStats, now: Date): number {
  return s.petsToday.day === isoDay(now) ? Math.max(0, DAILY_POKE_CAP - s.petsToday.n) : DAILY_POKE_CAP
}
/** a poke: counted unless today's cap is used up (then the very same object comes back) */
export function recordPet(s: BuddyStats, now: Date): BuddyStats {
  if (petsLeftToday(s, now) === 0) return s
  const today = isoDay(now)
  // the one-day festivals only count if the cat was poked that day, not just if the app was opened
  const season = seasonOf(now)
  const seasons = season && POKE_SEASONS.includes(season) && !s.seasons.includes(season) ? [...s.seasons, season] : s.seasons
  return { ...s, pets: s.pets + 1, petsToday: { day: today, n: (s.petsToday.day === today ? s.petsToday.n : 0) + 1 }, seasons }
}
export const recordWake = (s: BuddyStats): BuddyStats => ({ ...s, wakes: s.wakes + 1 })
export const recordReminderDone = (s: BuddyStats): BuddyStats => ({ ...s, remindersDone: s.remindersDone + 1 })
/** an import finished; `added` = rows that were not in the app before */
export const recordImport = (s: BuddyStats, added = 0): BuddyStats => ({ ...s, imports: s.imports + 1, rowsImported: s.rowsImported + Math.max(0, added) })

/** the data got bigger than ever before? (same object back when nothing grew) */
export function recordData(s: BuddyStats, f: DataFacts): BuddyStats {
  const next = { maxCustomers: Math.max(s.maxCustomers, f.customers), maxSOs: Math.max(s.maxSOs, f.sos), maxDayRows: Math.max(s.maxDayRows, f.maxDayRows), maxMonths: Math.max(s.maxMonths, f.months) }
  return next.maxCustomers === s.maxCustomers && next.maxSOs === s.maxSOs && next.maxDayRows === s.maxDayRows && next.maxMonths === s.maxMonths ? s : { ...s, ...next }
}

/** a file was exported; a .json export is a backup and counts once per day */
export function recordExport(s: BuddyStats, format: string, now: Date): BuddyStats {
  const today = isoDay(now)
  const newBackupDay = format === 'json' && s.lastBackup !== today
  return { ...s, exports: s.exports + 1, backupDays: newBackupDay ? s.backupDays + 1 : s.backupDays, lastBackup: newBackupDay ? today : s.lastBackup }
}

/** the edit dialog saved `rows` rows, `assigned` of which got a driver or truck (same object back for an empty edit) */
export const recordEdit = (s: BuddyStats, rows: number, assigned: number): BuddyStats => (rows <= 0 ? s : { ...s, edits: s.edits + rows, assigned: s.assigned + Math.max(0, assigned) })

/** the filter bar was used; counted up to DAILY_FILTER_CAP a day (same object back after that) */
export function recordFilterUse(s: BuddyStats, now: Date): BuddyStats {
  const today = isoDay(now)
  const n = s.filterToday.day === today ? s.filterToday.n : 0
  return n >= DAILY_FILTER_CAP ? s : { ...s, filterUses: s.filterUses + 1, filterToday: { day: today, n: n + 1 } }
}
/** today had work and all of it is assigned: counts once per day */
export function recordPerfect(s: BuddyStats, now: Date): BuddyStats {
  const today = isoDay(now)
  return s.lastPerfect === today ? s : { ...s, perfectDays: s.perfectDays + 1, lastPerfect: today }
}
/** the wardrobe was opened: everything earned so far has been seen */
export const markSeen = (s: BuddyStats): BuddyStats => (s.seen.length === s.earned.length && s.earned.every((id) => s.seen.includes(id)) ? s : { ...s, seen: [...s.earned] })

export type ItemKind = 'skin' | 'outfit' | 'move' | 'toy'
export type Item = {
  id: string
  kind: ItemKind
  name: string
  /** how to get it, in words */
  hint: string
  /** progress toward it; unlocked when done >= total */
  progress: (s: BuddyStats, now: Date) => { done: number; total: number }
  /** tied to a date, so it does not count toward "everything unlocked" */
  seasonal?: boolean
}

const count = (done: number, total: number) => ({ done: Math.min(done, total), total })
const flag = (on: boolean) => ({ done: on ? 1 : 0, total: 1 })
const cap = `(นับวันละไม่เกิน ${DAILY_POKE_CAP} ครั้ง)`

export const ITEMS: Item[] = [
  // fur colours (calico is the one it starts with)
  { id: 'calico', kind: 'skin', name: 'สามสี', hint: 'ตัวเริ่มต้น', progress: () => flag(true) },
  { id: 'orange', kind: 'skin', name: 'ส้มอ้วน', hint: 'เปิดแอปครบ 7 วัน (ไม่ต้องติดกัน)', progress: (s) => count(s.totalDays, 7) },
  { id: 'grey', kind: 'skin', name: 'เทาเท่', hint: 'ติ๊กรายการเตือนเสร็จ 10 รายการ', progress: (s) => count(s.remindersDone, 10) },
  { id: 'tuxedo', kind: 'skin', name: 'ทักซิโด้', hint: `ทักเปี๊ยก ${fmt(3000)} ครั้ง ${cap}`, progress: (s) => count(s.pets, 3000) },
  { id: 'black', kind: 'skin', name: 'แมวดำ', hint: 'เปิดแอปติดต่อกัน 14 วัน', progress: (s) => count(s.bestStreak, 14) },
  {
    id: 'gold',
    kind: 'skin',
    name: 'แมวทองมงคล',
    hint: 'ปลดล็อกของอื่นให้ครบทุกชิ้น (ยกเว้นชุดตามวันสำคัญ)',
    progress: (s, now) => {
      const rest = ITEMS.filter((i) => i.id !== 'gold' && !i.seasonal)
      return count(rest.filter((i) => isUnlocked(i, s, now)).length, rest.length)
    },
  },
  // outfits
  { id: 'none', kind: 'outfit', name: 'ไม่ใส่ชุด', hint: 'ตัวเริ่มต้น', progress: () => flag(true) },
  { id: 'scarf', kind: 'outfit', name: 'ผ้าพันคอ', hint: `ทักเปี๊ยก ${fmt(1500)} ครั้ง ${cap}`, progress: (s) => count(s.pets, 1500) },
  { id: 'cap', kind: 'outfit', name: 'หมวกคนขับรถ', hint: 'เปิดแอปติดต่อกัน 3 วัน', progress: (s, now) => count(streak(s.days, now), 3) },
  { id: 'hardhat', kind: 'outfit', name: 'หมวกนิรภัย', hint: 'นำเข้าไฟล์ ERP ครั้งแรก', progress: (s) => count(s.imports, 1) },
  { id: 'bowtie', kind: 'outfit', name: 'โบว์ไทด์', hint: 'สำรองข้อมูล (.json) ครั้งแรก', progress: (s) => count(s.backupDays, 1) },
  { id: 'bell', kind: 'outfit', name: 'ปลอกคอกระดิ่ง', hint: 'จัดรถ (ใส่คนขับหรือรถให้งานที่ยังไม่มี) 20 รายการ', progress: (s) => count(s.assigned, 20) },
  { id: 'glasses', kind: 'outfit', name: 'แว่นกันแดด', hint: 'ติ๊กรายการเตือนเสร็จ 3 รายการ', progress: (s) => count(s.remindersDone, 3) },
  { id: 'vest', kind: 'outfit', name: 'เสื้อกั๊กสะท้อนแสง', hint: 'ติ๊กรายการเตือนเสร็จ 100 รายการ', progress: (s) => count(s.remindersDone, 100) },
  { id: 'nightcap', kind: 'outfit', name: 'หมวกนอนมีปอมปอม', hint: 'เปิดแอปช่วงเที่ยงคืนถึงตี 5 รวม 10 คืน', progress: (s) => count(s.nightVisits, 10) },
  { id: 'tie', kind: 'outfit', name: 'เนคไทผู้จัดรถมือโปร', hint: 'นำเข้าไฟล์ ERP 30 ครั้ง', progress: (s) => count(s.imports, 30) },
  { id: 'ninja', kind: 'outfit', name: 'ผ้าโพกหัวนินจา', hint: '“วันจัดรถครบ” 14 วัน (วันที่มีงานและไม่เหลืองานค้างจัดรถ)', progress: (s) => count(s.perfectDays, 14) },
  { id: 'medal', kind: 'outfit', name: 'เหรียญทาสแมวดีเด่น', hint: `ทักเปี๊ยก ${fmt(10000)} ครั้ง ${cap}`, progress: (s) => count(s.pets, 10000) },
  { id: 'crown', kind: 'outfit', name: 'มงกุฎราชาทาสแมว', hint: `ทักเปี๊ยก ${fmt(5000)} ครั้ง ${cap}`, progress: (s) => count(s.pets, 5000) },
  { id: 'party', kind: 'outfit', name: 'หมวกปาร์ตี้ปีใหม่', hint: 'เปิดแอปช่วง 30 ธ.ค. – 2 ม.ค.', seasonal: true, progress: (s) => flag(s.seasons.includes('newyear')) },
  { id: 'songkran', kind: 'outfit', name: 'เสื้อลายดอกสงกรานต์', hint: 'เปิดแอปช่วง 13–15 เม.ย.', seasonal: true, progress: (s) => flag(s.seasons.includes('songkran')) },
  { id: 'krathong', kind: 'outfit', name: 'กระทงบนหัว', hint: 'เปิดแอปในเดือนพฤศจิกายน', seasonal: true, progress: (s) => flag(s.seasons.includes('krathong')) },
  { id: 'halloween', kind: 'outfit', name: 'หมวกแม่มดฮาโลวีน', hint: 'ทักเปี๊ยกในวันที่ 31 ต.ค. (ต้องเปิดแอปและทักในวันนั้น)', seasonal: true, progress: (s) => flag(s.seasons.includes('halloween')) },
  { id: 'christmas', kind: 'outfit', name: 'หมวกซานต้า', hint: 'ทักเปี๊ยกในวันที่ 24–25 ธ.ค. (ต้องเปิดแอปและทักในวันนั้น)', seasonal: true, progress: (s) => flag(s.seasons.includes('christmas')) },
  { id: 'headphones', kind: 'outfit', name: 'หูฟังครอบหู', hint: 'เปิดแอปช่วงเที่ยงคืนถึงตี 5 ครั้งแรก', progress: (s) => count(s.nightVisits, 1) },
  { id: 'starclip', kind: 'outfit', name: 'กิ๊บดาวหนีบหู', hint: '“วันจัดรถครบ” 1 วัน (วันที่มีงานและไม่เหลืองานค้างจัดรถ)', progress: (s) => count(s.perfectDays, 1) },
  { id: 'eartag', kind: 'outfit', name: 'ป้ายหู', hint: 'ส่งออกข้อมูล 3 ครั้ง', progress: (s) => count(s.exports, 3) },
  { id: 'earplaster', kind: 'outfit', name: 'พลาสเตอร์ปิดหู', hint: 'แก้ไขรายการ 20 แถว', progress: (s) => count(s.edits, 20) },
  { id: 'earflower', kind: 'outfit', name: 'ดอกไม้ทัดหู', hint: 'เปิดแอปครบ 12 วัน (ไม่ต้องติดกัน)', progress: (s) => count(s.totalDays, 12) },
  { id: 'earmuffs', kind: 'outfit', name: 'ที่ปิดหูกันหนาว', hint: 'เปิดแอปติดต่อกัน 7 วัน', progress: (s) => count(s.bestStreak, 7) },
  { id: 'hairclip', kind: 'outfit', name: 'กิ๊บม่วงติดหู', hint: 'ติ๊กรายการเตือนเสร็จ 15 รายการ', progress: (s) => count(s.remindersDone, 15) },
  { id: 'hoop', kind: 'outfit', name: 'ต่างหูห่วงทอง', hint: 'แก้ไขรายการ 60 แถว', progress: (s) => count(s.edits, 60) },
  { id: 'earribbon', kind: 'outfit', name: 'โบว์ชมพูติดหู', hint: 'จัดรถ (ใส่คนขับหรือรถให้งานที่ยังไม่มี) 50 รายการ', progress: (s) => count(s.assigned, 50) },
  { id: 'earcuff', kind: 'outfit', name: 'ที่หนีบหูสีเงิน', hint: 'ค้นหาหรือกรองข้อมูล 40 ครั้ง', progress: (s) => count(s.filterUses, 40) },
  // moves it starts doing on its own
  { id: 'stretch', kind: 'move', name: 'ท่ายืดตัว', hint: `ทักเปี๊ยก ${fmt(1000)} ครั้ง ${cap}`, progress: (s) => count(s.pets, 1000) },
  { id: 'roll', kind: 'move', name: 'ท่ากลิ้งหงายท้อง', hint: 'เปิดแอปครบ 3 วัน', progress: (s) => count(s.totalDays, 3) },
  { id: 'tail', kind: 'move', name: 'ท่าไล่หางตัวเอง', hint: `ทักเปี๊ยก ${fmt(2500)} ครั้ง ${cap}`, progress: (s) => count(s.pets, 2500) },
  { id: 'groom', kind: 'move', name: 'ท่าเลียหน้า', hint: 'ปลุกเปี๊ยกตอนหลับ 250 ครั้ง (ทักตอนมันกำลังหลับ)', progress: (s) => count(s.wakes, 250) },
  { id: 'zoom', kind: 'move', name: 'ท่าวิ่งซิ่งตอนดึก', hint: 'เปิดแอปช่วงเที่ยงคืนถึงตี 5 รวม 5 คืน', progress: (s) => count(s.nightVisits, 5) },
  { id: 'stand', kind: 'move', name: 'ท่ายืนสองขา', hint: 'เปิดแอปติดต่อกัน 30 วัน', progress: (s) => count(s.bestStreak, 30) },
  // toys carried in the mouth; each reads a number from the app's own data
  { id: 'notoy', kind: 'toy', name: 'ไม่คาบอะไร', hint: 'ตัวเริ่มต้น', progress: () => flag(true) },
  { id: 'mackerel', kind: 'toy', name: 'ปลาทู', hint: `นำเข้าแถวข้อมูลใหม่สะสม ${fmt(8000)} แถว (ไฟล์เดิมที่นำเข้าซ้ำไม่นับ)`, progress: (s) => count(s.rowsImported, 8000) },
  { id: 'mouse', kind: 'toy', name: 'หนูไขลาน', hint: 'พบลูกค้าไม่ซ้ำในข้อมูล 30 ราย', progress: (s) => count(s.maxCustomers, 30) },
  { id: 'pompom', kind: 'toy', name: 'ลูกบอลปอมปอม', hint: 'มีวันหนึ่งที่งานแน่น 80 รายการขึ้นไป', progress: (s) => count(s.maxDayRows, 80) },
  { id: 'feather', kind: 'toy', name: 'ไม้ตกแมวขนนก', hint: 'ส่งออกไฟล์ 15 ครั้ง', progress: (s) => count(s.exports, 15) },
  { id: 'can', kind: 'toy', name: 'ปลากระป๋อง', hint: 'สำรองข้อมูล (.json) ใน 5 วันที่ต่างกัน', progress: (s) => count(s.backupDays, 5) },
  { id: 'key', kind: 'toy', name: 'กุญแจรถบรรทุก', hint: 'จัดรถ (ใส่คนขับหรือรถให้งานที่ยังไม่มี) สะสม 150 รายการ', progress: (s) => count(s.assigned, 150) },
  { id: 'receipt', kind: 'toy', name: 'ใบ SO ม้วนยาว', hint: 'พบเลข SO ไม่ซ้ำในข้อมูล 500 ใบ', progress: (s) => count(s.maxSOs, 500) },
  { id: 'yarn', kind: 'toy', name: 'ลูกบอลด้าย', hint: 'แก้ไขรายการสะสม 200 แถว', progress: (s) => count(s.edits, 200) },
  { id: 'fishbone', kind: 'toy', name: 'ก้างปลา', hint: 'ข้อมูลครอบคลุม 4 เดือนขึ้นไป', progress: (s) => count(s.maxMonths, 4) },
  { id: 'catnip', kind: 'toy', name: 'ใบแคทนิป', hint: 'ติ๊กรายการเตือนเสร็จครั้งแรก', progress: (s) => count(s.remindersDone, 1) },
  { id: 'treat', kind: 'toy', name: 'ขนมแมวเลีย', hint: 'ส่งออกไฟล์ครั้งแรก', progress: (s) => count(s.exports, 1) },
  { id: 'pencil', kind: 'toy', name: 'ดินสอเหลือง', hint: 'ค้นหาหรือกรองข้อมูล 10 ครั้ง', progress: (s) => count(s.filterUses, 10) },
  { id: 'magnifier', kind: 'toy', name: 'แว่นขยาย', hint: `ค้นหาหรือกรองข้อมูล 150 ครั้ง (นับวันละไม่เกิน ${DAILY_FILTER_CAP} ครั้ง)`, progress: (s) => count(s.filterUses, 150) },
]

export const itemById = (id: string): Item | undefined => ITEMS.find((i) => i.id === id)

/** earned for good, or the progress is complete right now */
export function isUnlocked(item: Item, s: BuddyStats, now: Date): boolean {
  if (s.earned.includes(item.id)) return true
  const p = item.progress(s, now)
  return p.done >= p.total
}

/** add everything unlocked right now to the permanent list (a few passes, because the gold cat depends on the others) */
export function withEarned(s: BuddyStats, now: Date): BuddyStats {
  let cur = s
  for (let pass = 0; pass < 3; pass++) {
    const add = ITEMS.filter((i) => !cur.earned.includes(i.id) && isUnlocked(i, cur, now)).map((i) => i.id)
    if (add.length === 0) break
    cur = { ...cur, earned: [...cur.earned, ...add] }
  }
  return cur
}

/** items that became available between two states of the stats */
export function newlyUnlocked(before: BuddyStats, after: BuddyStats, now: Date): Item[] {
  return ITEMS.filter((i) => !isUnlocked(i, before, now) && isUnlocked(i, after, now))
}

/** a toy whose art is not drawn yet is counted and kept but not announced, shown as wearable, or flagged as new */
export const isShown = (item: Item): boolean => item.kind !== 'toy' || item.id === 'notoy' || hasToyArt(item.id)

/** earned but not yet looked at in the wardrobe */
export const unseenCount = (s: BuddyStats): number => s.earned.filter((id) => !s.seen.includes(id) && isShown(itemById(id) ?? ITEMS[0])).length

/** ids of the unlocked items of one kind */
export function unlockedIds(kind: ItemKind, s: BuddyStats, now: Date): string[] {
  return ITEMS.filter((i) => i.kind === kind && isUnlocked(i, s, now)).map((i) => i.id)
}

/** what is equipped, corrected when it names something unknown or not unlocked (e.g. settings from another device) */
export function safeLook(skin: string, outfit: string, toy: string, s: BuddyStats, now: Date): { skin: Skin; outfit: Outfit; toy: Toy } {
  const ok = (kind: ItemKind, id: string, fallback: string) => (unlockedIds(kind, s, now).includes(id) ? id : fallback)
  // a toy without art is never worn, even if the saved setting names it
  const wearable = toy !== 'notoy' && hasToyArt(toy) ? toy : 'notoy'
  return { skin: ok('skin', skin, 'calico') as Skin, outfit: ok('outfit', outfit, 'none') as Outfit, toy: ok('toy', wearable, 'notoy') as Toy }
}

/** the poke thresholds before they were raised; whoever had reached them keeps those items */
const LEGACY_POKES: Record<string, number> = { stretch: 5, scarf: 10, tail: 25, tuxedo: 50, crown: 100 }

/** first load after the earned list existed: keep what the old rules had already given out */
export function grandfather(s: BuddyStats, now: Date): BuddyStats {
  const keep = ITEMS.filter((i) => (LEGACY_POKES[i.id] !== undefined ? s.pets >= LEGACY_POKES[i.id] : isUnlocked(i, s, now))).map((i) => i.id)
  return withEarned({ ...s, earned: keep, seen: keep }, now)
}
