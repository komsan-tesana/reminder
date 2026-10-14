// "เปี๊ยก", the cat that lives in the corner of the app. Everything here is pure (no DOM, no timers) so it can be
// tested: what the cat does next, how long, and what it says. Buddy.tsx only drives it.

export const BUDDY_NAME = 'เปี๊ยก'

export type BuddyState = 'sit' | 'walk' | 'yawn' | 'sleep' | 'play' | 'happy' | 'stretch' | 'roll' | 'tail' | 'groom' | 'zoom' | 'stand' | 'shout'
/** moves the cat only does once they are unlocked (see buddyUnlocks.ts); `shout` is an easter egg for poking too fast */
export const LOCKABLE_MOVES = ['stretch', 'roll', 'tail', 'groom', 'zoom', 'stand'] as const
export type Period = 'latenight' | 'morning' | 'noon' | 'afternoon' | 'evening' | 'night'
export type Rnd = () => number // like Math.random: [0, 1)

export function periodOf(d: Date): Period {
  const h = d.getHours()
  if (h < 5) return 'latenight'
  if (h < 11) return 'morning'
  if (h < 14) return 'noon'
  if (h < 18) return 'afternoon'
  if (h < 22) return 'evening'
  return 'night'
}

/** how likely each activity is to come next, per time of day: lively in the morning, drowsy after lunch, asleep at night */
const WEIGHTS: Record<Period, Record<BuddyState, number>> = {
  latenight: { sit: 1, walk: 0.3, yawn: 2, sleep: 7, play: 0.2, happy: 0, stretch: 0, roll: 0, tail: 0.1, groom: 0.3, zoom: 2.5, stand: 0.2, shout: 0 },
  morning: { sit: 2, walk: 4, yawn: 1, sleep: 0.3, play: 3, happy: 0, stretch: 1.5, roll: 0.5, tail: 1, groom: 0.6, zoom: 0.3, stand: 0.5, shout: 0 },
  noon: { sit: 3, walk: 3, yawn: 1.5, sleep: 1, play: 1.5, happy: 0, stretch: 0.5, roll: 1, tail: 0.5, groom: 1, zoom: 0.2, stand: 1, shout: 0 },
  afternoon: { sit: 3, walk: 2, yawn: 3.5, sleep: 3, play: 1, happy: 0, stretch: 1, roll: 1, tail: 0.5, groom: 1.5, zoom: 0.2, stand: 1, shout: 0 },
  evening: { sit: 2, walk: 3, yawn: 1, sleep: 1, play: 3.5, happy: 0, stretch: 1, roll: 1.5, tail: 1.5, groom: 1, zoom: 1, stand: 1.5, shout: 0 },
  night: { sit: 2, walk: 0.8, yawn: 3.5, sleep: 5, play: 0.4, happy: 0, stretch: 0, roll: 0, tail: 0.2, groom: 1, zoom: 2, stand: 0.2, shout: 0 },
}

const SLEEPY: Period[] = ['latenight', 'afternoon', 'night']

/** the next thing the cat does; never the same thing twice in a row, except a long sleep */
export function nextState(cur: BuddyState, period: Period, rnd: Rnd, allowed: readonly BuddyState[] = []): BuddyState {
  // a yawn in a sleepy hour usually ends in a nap
  if (cur === 'yawn' && SLEEPY.includes(period) && rnd() < 0.7) return 'sleep'
  const w = { ...WEIGHTS[period] }
  for (const m of LOCKABLE_MOVES) if (!allowed.includes(m)) w[m] = 0 // not unlocked yet
  if (cur !== 'sleep') w[cur] = 0
  else w.sleep *= 0.4
  // waking up from a nap starts with a yawn
  if (cur === 'sleep') w.yawn += 4
  const entries = Object.entries(w) as [BuddyState, number][]
  const total = entries.reduce((a, [, n]) => a + n, 0)
  let r = rnd() * total
  for (const [s, n] of entries) {
    r -= n
    if (r < 0 && n > 0) return s
  }
  return 'sit'
}

/** how long an activity lasts, in ms (walking is timed by the distance instead, see Buddy.tsx) */
export function durationMs(state: BuddyState, rnd: Rnd): number {
  const between = (a: number, b: number) => Math.round(a + rnd() * (b - a))
  switch (state) {
    case 'sit':
      return between(4000, 9000)
    case 'walk':
      return between(5000, 9000)
    case 'yawn':
      return 2600
    case 'sleep':
      return between(12000, 28000)
    case 'play':
      return between(5000, 8000)
    case 'happy':
      return 2600
    case 'stretch':
      return 3600
    case 'roll':
      return between(4500, 6500)
    case 'tail':
      return between(5000, 7000)
    case 'groom':
      return between(4500, 6500)
    case 'zoom':
      return between(4000, 6000) // the real time is set by the distance it runs
    case 'stand':
      return between(5000, 8000)
    case 'shout':
      return 3200
  }
}

/** what the app knows right now; only used to make the cat's jokes about today's work, never sent anywhere */
export type WorkCtx = { today: number; unassigned: number; tomorrow: number; pending: number }
export const EMPTY_CTX: WorkCtx = { today: 0, unassigned: 0, tomorrow: 0, pending: 0 }

const LINES: Record<Period, string[]> = {
  latenight: [
    'ดึกป่านนี้แล้ว… เปี๊ยกยังไม่หลับ เพราะรอรถยังไม่จัดเหรอ?',
    'ตีสามแล้วนะ งานไม่หนีไปไหนหรอก ไปนอนเถอะ',
    'ซู่… ขออีกห้านาที',
    'แมวกลางคืนวิ่งเล่นได้ แต่คนต้องนอนนะเมี๊ยว',
  ],
  morning: [
    'อรุณสวัสดิ์! วันนี้เปี๊ยกพร้อมช่วยดูรถแล้ว',
    'เช้าแล้ว กาแฟยัง? เปี๊ยกขอปลาทูแทนก็ได้',
    'ตื่นเช้ามาจัดรถ แต่คนขับยังไม่ตื่นเลยมั้ง',
    'วันนี้ขอให้ไม่มีรถเสียนะเมี๊ยว',
  ],
  noon: [
    'เที่ยงแล้ว ข้าวยัง? เปี๊ยกขอปลากระป๋อง',
    'พักกินข้าวก่อน งานอยู่ตรงนี้ไม่หนีไปไหน',
    'ง่วงหลังข้าวเที่ยงนี่ แมวก็เป็นนะ',
  ],
  afternoon: [
    'บ่ายแล้ว… ฮ้าว~ ขอหาวนิดนึง',
    'บ่ายสามโมง คือเวลานอนของแมว ขอโทษที',
    'อีกนิดเดียวก็เลิกงานแล้ว สู้ๆ!',
  ],
  evening: [
    'เย็นแล้ว ปิดงานแล้วกลับบ้านได้นะ',
    'ตอนเย็นเปี๊ยกชอบวิ่งไล่หางตัวเอง (ไม่เคยทัน)',
    'รถกลับเข้าลานหรือยังเอ่ย',
  ],
  night: [
    'ดึกแล้วนะ พอได้แล้ว พรุ่งนี้ค่อยจัดรถ',
    'เปี๊ยกง่วงแล้ว… ฮ้าวว',
    'ปิดคอมแล้วไปนอนเถอะ เปี๊ยกเฝ้าให้เอง',
  ],
}

export type Season = 'songkran' | 'newyear' | 'krathong' | 'halloween' | 'christmas'
/** Songkran 13–15 April, New Year 30 Dec–2 Jan, Loy Krathong falls in November (the exact full-moon date moves, so the whole month counts), Halloween 31 Oct, Christmas 24–25 Dec */
export function seasonOf(d: Date): Season | null {
  const m = d.getMonth() + 1
  const day = d.getDate()
  if (m === 4 && day >= 13 && day <= 15) return 'songkran'
  if ((m === 12 && day >= 30) || (m === 1 && day <= 2)) return 'newyear'
  if (m === 11) return 'krathong'
  if (m === 10 && day === 31) return 'halloween'
  if (m === 12 && (day === 24 || day === 25)) return 'christmas'
  return null
}

const SEASON_LINES: Record<Season, string[]> = {
  songkran: ['สุขสันต์วันสงกรานต์! เปี๊ยกเปียกหมดแล้วเมี๊ยว', 'สาดน้ำได้ แต่อย่าสาดคอมนะ', 'สงกรานต์นี้ขอให้รถไม่ติด คนขับไม่เปียก'],
  newyear: ['สวัสดีปีใหม่! ปีนี้ขอให้ไม่มีรถค้างนะ', 'ปีใหม่แล้ว เปี๊ยกขอปลาทูเป็นของขวัญ', 'นับถอยหลังกันหรือยัง? เปี๊ยกขอหลับก่อนนับ'],
  krathong: ['ลอยกระทงแล้ว… เปี๊ยกขอลอยตัวไปด้วย', 'เดือนพฤศจิกายน ลมหนาวมา แมวขอนอนขดนะ'],
  halloween: ['ฮาโลวีน! ถ้ามีรถเสียกลางคืน อันนั้นผีหลอกของจริง', 'เปี๊ยกไม่กลัวผีหรอก… แต่ขอนั่งข้างๆ นะ'],
  christmas: ['คริสต์มาสแล้ว เปี๊ยกขอปลาทูเป็นของขวัญ', 'ซานต้ายังต้องจัดรถส่งของเลย เหมือนเราเนี่ยแหละ'],
}
const WEEKDAY_LINES: Record<number, string[]> = {
  1: ['วันจันทร์… ฮ้าว แต่เปี๊ยกเชียร์อยู่นะ'],
  5: ['วันศุกร์แล้ว! อีกนิดเดียวก็หยุด', 'ศุกร์นี้ใครจัดรถครบ เปี๊ยกให้ปลาทูหนึ่งตัว'],
  0: ['วันหยุดแท้ๆ ยังมาดูงาน เปี๊ยกนับถือ'],
  6: ['วันหยุดแท้ๆ ยังมาดูงาน เปี๊ยกนับถือ'],
}
/** lines that depend on the date: festivals, Monday blues, Friday cheer */
export function occasionLines(d: Date): string[] {
  const season = seasonOf(d)
  return [...(season ? SEASON_LINES[season] : []), ...(WEEKDAY_LINES[d.getDay()] ?? [])]
}

/** poked five times within three seconds: it gets scared */
export function isFlurry(times: number[], now: number, count = 5, windowMs = 3000): boolean {
  return times.filter((t) => now - t <= windowMs).length >= count
}

/** jokes about today's work; only the ones that apply to the numbers are offered */
export function workLines(c: WorkCtx): string[] {
  const out: string[] = []
  if (c.unassigned > 0) out.push(`วันนี้ยังไม่จัดรถ ${c.unassigned} รายการ เปี๊ยกนับให้แล้วนะเมี๊ยว`)
  if (c.today === 0) out.push('วันนี้ไม่มีงานส่งเลย เปี๊ยกขอนอนยาวนะ')
  if (c.today > 0 && c.unassigned === 0) out.push(`วันนี้ ${c.today} รายการ จัดรถครบแล้ว เก่งมาก ขอปลาทูหนึ่งตัว`)
  if (c.tomorrow > 0) out.push(`พรุ่งนี้มี ${c.tomorrow} รายการ เตรียมตัวไว้นะ`)
  if (c.pending > 0) out.push(`มีเตือนรออยู่ ${c.pending} รายการ เปี๊ยกจดไว้ให้แล้ว`)
  return out
}

const choose = <T>(items: T[], rnd: Rnd, avoid?: T): T => {
  const pool = items.length > 1 && avoid !== undefined ? items.filter((x) => x !== avoid) : items
  return pool[Math.floor(rnd() * pool.length)]
}

/** a line the cat says on its own: mostly a joke about the hour, sometimes one about today's work */
export function pickLine(period: Period, ctx: WorkCtx, last: string | null, rnd: Rnd, now?: Date): string {
  // a joke that was just said is not offered again, so a single applicable one cannot repeat back to back
  const work = workLines(ctx).filter((l) => l !== last)
  const occasion = now ? occasionLines(now).filter((l) => l !== last) : []
  let pool = LINES[period]
  if (work.length > 0 && rnd() < 0.4) pool = work
  else if (occasion.length > 0 && rnd() < 0.35) pool = occasion
  return choose(pool, rnd, last ?? undefined)
}

const POKED = ['เมี๊ยว! สวัสดี~', 'ทักเปี๊ยกทำไมเอ่ย มีขนมไหม', 'จิ้มอีกทีสิ เปี๊ยกไม่โกรธ', 'เปี๊ยกอยู่นี่เสมอ ทำงานต่อได้เลย', 'ครืดๆๆ (นี่คือเสียงเปี๊ยกดีใจ)']
const SHOUTS = ['อ๊ากกก อย่าจิ้มรัวๆ! เปี๊ยกตกใจ', 'ฮือออ จิ้มแรงไป! เปี๊ยกจะร้องแล้วนะ', 'ไม่ไหวแล้วเมี๊ยววว!']
const WOKEN = ['ซู่… อย่าเพิ่งปลุก ขออีกห้านาที', 'ฮึ่ม ปลุกทำไมเนี่ย (ง่วง)', 'อะไรเนี่ย… กำลังฝันถึงปลาทู']
const MILESTONES: Record<number, string> = {
  1000: 'ทักครบ 1,000 ครั้งแล้ว! เปี๊ยกนับเธอเป็นทาสแมวแล้วนะ',
  5000: '5,000 ครั้ง! เธอคือทาสแมวตัวจริง',
  10000: '10,000 ครั้งเลยเหรอ… เปี๊ยกซึ้งใจ ขอนอนตักได้ไหม',
}
const CAPPED = ['วันนี้ทักครบ 200 ครั้งแล้วนะ พรุ่งนี้ค่อยมานับต่อ (เปี๊ยกยังรักเธออยู่)', 'ทักเก่งจัง แต่วันนี้นับครบแล้ว เปี๊ยกขอพักหน่อย']

/** what happens when the cat is poked: what it says and what it does next (`pets` includes this poke) */
export function clickReply(state: BuddyState, period: Period, ctx: WorkCtx, pets: number, rnd: Rnd, flurry = false, counted = true, capped = false): { line: string; next: BuddyState } {
  if (flurry) return { line: choose(SHOUTS, rnd), next: 'shout' }
  if (counted && MILESTONES[pets]) return { line: MILESTONES[pets], next: 'happy' }
  if (state === 'sleep') return { line: choose(WOKEN, rnd), next: 'yawn' }
  if (capped && rnd() < 0.3) return { line: choose(CAPPED, rnd), next: 'happy' }
  const work = workLines(ctx)
  const line = work.length > 0 && rnd() < 0.35 ? choose(work, rnd) : choose(POKED, rnd)
  void period
  return { line, next: 'happy' }
}
