import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DAILY_FILTER_CAP,
  DAILY_POKE_CAP,
  DEFAULT_STATS,
  ITEMS,
  grandfather,
  isUnlocked,
  itemById,
  markSeen,
  newlyUnlocked,
  petsLeftToday,
  isShown,
  recordData,
  recordEdit,
  recordExport,
  recordFilterUse,
  recordImport,
  recordPerfect,
  recordPet,
  recordReminderDone,
  recordVisit,
  recordWake,
  safeLook,
  streak,
  unlockedIds,
  unseenCount,
  withEarned,
  type BuddyStats,
} from './buddyUnlocks'

const day = (m: number, d: number, h = 12) => new Date(2026, m - 1, d, h)
const at = (patch: Partial<BuddyStats>): BuddyStats => ({ ...DEFAULT_STATS, ...patch })
const withDays = (...days: string[]): BuddyStats => at({ days, totalDays: days.length })
const NOW = day(10, 14)

describe('buddy: progress and unlocks', () => {
  it('starts with only the default look and no moves', () => {
    expect(unlockedIds('skin', DEFAULT_STATS, NOW)).toEqual(['calico'])
    expect(unlockedIds('outfit', DEFAULT_STATS, NOW)).toEqual(['none'])
    expect(unlockedIds('move', DEFAULT_STATS, NOW)).toEqual([])
  })

  it('counts a visit once per day, notes night visits once per night, and festivals', () => {
    let s = recordVisit(DEFAULT_STATS, day(10, 14, 9))
    s = recordVisit(s, day(10, 14, 15))
    expect(s.days).toEqual(['2026-10-14'])
    expect(s.totalDays).toBe(1)
    expect(s.nightOwl).toBe(false)
    const night = recordVisit(s, day(10, 15, 2))
    expect(night).toMatchObject({ nightOwl: true, nightVisits: 1, totalDays: 2, lastNight: '2026-10-15' })
    expect(recordVisit(night, day(10, 15, 3)).nightVisits).toBe(1) // same night again
    expect(recordVisit(night, day(10, 16, 1)).nightVisits).toBe(2)
    expect(recordVisit(DEFAULT_STATS, day(4, 14)).seasons).toEqual(['songkran'])
    expect(recordVisit(DEFAULT_STATS, day(11, 3)).seasons).toEqual(['krathong'])
    expect(recordVisit(DEFAULT_STATS, day(10, 14)).seasons).toEqual([])
  })

  it('keeps only the last 120 days in the list, but the counters keep counting', () => {
    let s = DEFAULT_STATS
    for (let i = 0; i < 150; i++) s = recordVisit(s, new Date(2026, 0, 1 + i))
    expect(s.days).toHaveLength(120)
    expect(s.days.at(-1)).toBe('2026-05-30')
    expect(s.totalDays).toBe(150)
    expect(s.bestStreak).toBe(120) // streaks are measured over the days kept
  })

  it('streaks count consecutive days back from today, or from yesterday if today is not recorded yet', () => {
    expect(streak(['2026-10-12', '2026-10-13', '2026-10-14'], NOW)).toBe(3)
    expect(streak(['2026-10-12', '2026-10-13'], NOW)).toBe(2)
    expect(streak(['2026-10-10', '2026-10-13', '2026-10-14'], NOW)).toBe(2)
    expect(streak(['2026-10-10'], NOW)).toBe(0)
    expect(streak(['2026-09-30', '2026-10-01'], day(10, 1))).toBe(2) // across a month boundary
    expect(streak([], NOW)).toBe(0)
  })

  it('remembers the best streak even after it is broken', () => {
    let s = DEFAULT_STATS
    for (const d of [1, 2, 3, 4, 5]) s = recordVisit(s, day(10, d))
    s = recordVisit(s, day(10, 9)) // a gap
    expect(s.bestStreak).toBe(5)
    expect(streak(s.days, day(10, 9))).toBe(1)
  })
})

describe('buddy: pokes are counted at most once a day-quota', () => {
  it('counts up to the daily cap and then stops, handing back the same object', () => {
    expect(DAILY_POKE_CAP).toBe(200) // the cat's "200 pokes today" line says so
    let s = DEFAULT_STATS
    for (let i = 0; i < DAILY_POKE_CAP; i++) s = recordPet(s, day(10, 14))
    expect(s.pets).toBe(DAILY_POKE_CAP)
    expect(petsLeftToday(s, day(10, 14, 20))).toBe(0)
    expect(recordPet(s, day(10, 14, 21))).toBe(s)
    const next = recordPet(s, day(10, 15))
    expect(next.pets).toBe(DAILY_POKE_CAP + 1) // a new day, a new quota
    expect(petsLeftToday(next, day(10, 15))).toBe(DAILY_POKE_CAP - 1)
  })

  it('the big thresholds take real days: 1,000 pokes need at least five', () => {
    let s = DEFAULT_STATS
    let days = 0
    for (let d = 1; !isUnlocked(itemById('stretch')!, s, NOW); d++) {
      days++
      for (let i = 0; i < 1000; i++) s = recordPet(s, new Date(2026, 5, d)) // hammering far beyond the cap
    }
    expect(days).toBe(5)
    expect(s.pets).toBe(1000)
  })

  it('wakes, reminders and imports just count', () => {
    expect(recordWake(DEFAULT_STATS).wakes).toBe(1)
    expect(recordReminderDone(DEFAULT_STATS).remindersDone).toBe(1)
    expect(recordImport(DEFAULT_STATS).imports).toBe(1)
  })

  it('a perfect day counts once per day', () => {
    let s = recordPerfect(DEFAULT_STATS, day(10, 14, 9))
    expect(recordPerfect(s, day(10, 14, 18))).toBe(s)
    s = recordPerfect(s, day(10, 15))
    expect(s.perfectDays).toBe(2)
  })
})

describe('buddy: what unlocks when', () => {
  it('uses the raised poke thresholds', () => {
    expect(isUnlocked(itemById('stretch')!, at({ pets: 999 }), NOW)).toBe(false)
    expect(isUnlocked(itemById('stretch')!, at({ pets: 1000 }), NOW)).toBe(true)
    expect(isUnlocked(itemById('scarf')!, at({ pets: 1499 }), NOW)).toBe(false)
    expect(isUnlocked(itemById('scarf')!, at({ pets: 1500 }), NOW)).toBe(true)
    expect(isUnlocked(itemById('tail')!, at({ pets: 2500 }), NOW)).toBe(true)
    expect(isUnlocked(itemById('tuxedo')!, at({ pets: 2999 }), NOW)).toBe(false)
    expect(isUnlocked(itemById('crown')!, at({ pets: 5000 }), NOW)).toBe(true)
  })

  it('unlocks the other things at their thresholds', () => {
    expect(isUnlocked(itemById('hardhat')!, at({ imports: 1 }), NOW)).toBe(true)
    expect(isUnlocked(itemById('glasses')!, at({ remindersDone: 3 }), NOW)).toBe(true)
    expect(isUnlocked(itemById('grey')!, at({ remindersDone: 10 }), NOW)).toBe(true)
    expect(isUnlocked(itemById('cap')!, withDays('2026-10-12', '2026-10-13', '2026-10-14'), NOW)).toBe(true)
    expect(isUnlocked(itemById('cap')!, withDays('2026-10-10', '2026-10-12', '2026-10-14'), NOW)).toBe(false) // not consecutive
    expect(isUnlocked(itemById('orange')!, at({ totalDays: 7 }), NOW)).toBe(true)
    expect(isUnlocked(itemById('roll')!, at({ totalDays: 3 }), NOW)).toBe(true)
    expect(isUnlocked(itemById('black')!, at({ bestStreak: 13 }), NOW)).toBe(false)
    expect(isUnlocked(itemById('black')!, at({ bestStreak: 14 }), NOW)).toBe(true)
    expect(isUnlocked(itemById('songkran')!, at({ seasons: ['songkran'] }), NOW)).toBe(true)
    expect(isUnlocked(itemById('party')!, at({ seasons: ['songkran'] }), NOW)).toBe(false)
  })

  it('unlocks the hard items at their thresholds', () => {
    const cases: [string, Partial<BuddyStats>, Partial<BuddyStats>][] = [
      ['vest', { remindersDone: 99 }, { remindersDone: 100 }],
      ['nightcap', { nightVisits: 9 }, { nightVisits: 10 }],
      ['tie', { imports: 29 }, { imports: 30 }],
      ['ninja', { perfectDays: 13 }, { perfectDays: 14 }],
      ['medal', { pets: 9999 }, { pets: 10000 }],
      ['groom', { wakes: 249 }, { wakes: 250 }],
      ['zoom', { nightVisits: 4 }, { nightVisits: 5 }],
      ['stand', { bestStreak: 29 }, { bestStreak: 30 }],
    ]
    for (const [id, below, enough] of cases) {
      expect(isUnlocked(itemById(id)!, at(below), NOW), `${id} just below`).toBe(false)
      expect(isUnlocked(itemById(id)!, at(enough), NOW), `${id} at the threshold`).toBe(true)
    }
  })

  it('the Halloween and Christmas outfits need a poke on the day, not just opening the app', () => {
    const open = recordVisit(DEFAULT_STATS, day(10, 31))
    expect(open.seasons).toEqual([])
    const poked = recordPet(open, day(10, 31, 15))
    expect(poked.seasons).toEqual(['halloween'])
    expect(isUnlocked(itemById('halloween')!, poked, day(11, 20)), 'kept for good').toBe(true)
    expect(recordPet(DEFAULT_STATS, day(10, 30)).seasons).toEqual([])
    expect(recordPet(recordVisit(DEFAULT_STATS, day(12, 24)), day(12, 24)).seasons).toEqual(['christmas'])
    expect(recordPet(recordPet(DEFAULT_STATS, day(12, 25)), day(12, 25)).seasons).toEqual(['christmas']) // once
    expect(itemById('halloween')!.seasonal && itemById('christmas')!.seasonal).toBe(true)
    // the all-day festivals still come just from opening the app
    expect(recordVisit(DEFAULT_STATS, day(4, 14)).seasons).toEqual(['songkran'])
  })

  it('has the planned number of items', () => {
    const n = (k: string) => ITEMS.filter((i) => i.kind === k).length
    expect([n('skin'), n('outfit'), n('move'), n('toy')]).toEqual([6, 28, 6, 14]) // 13 toys + "no toy"
  })

  it('unlocks the easy items on first use', () => {
    const cases: [string, Partial<BuddyStats>, Partial<BuddyStats>][] = [
      ['catnip', { remindersDone: 0 }, { remindersDone: 1 }],
      ['treat', { exports: 0 }, { exports: 1 }],
      ['pencil', { filterUses: 9 }, { filterUses: 10 }],
      ['bell', { assigned: 19 }, { assigned: 20 }],
      ['bowtie', { backupDays: 0 }, { backupDays: 1 }],
      ['headphones', { nightVisits: 0 }, { nightVisits: 1 }],
      ['starclip', { perfectDays: 0 }, { perfectDays: 1 }],
      ['eartag', { exports: 2 }, { exports: 3 }],
      ['earplaster', { edits: 19 }, { edits: 20 }],
      ['earflower', { totalDays: 11 }, { totalDays: 12 }],
      ['earmuffs', { bestStreak: 6 }, { bestStreak: 7 }],
      ['hairclip', { remindersDone: 14 }, { remindersDone: 15 }],
      ['hoop', { edits: 59 }, { edits: 60 }],
      ['earribbon', { assigned: 49 }, { assigned: 50 }],
      ['earcuff', { filterUses: 39 }, { filterUses: 40 }],
    ]
    for (const [id, below, enough] of cases) {
      expect(isUnlocked(itemById(id)!, at(below), NOW), `${id} before`).toBe(false)
      expect(isUnlocked(itemById(id)!, at(enough), NOW), `${id} after`).toBe(true)
    }
  })

  it('unlocks the data toys at their thresholds', () => {
    const cases: [string, Partial<BuddyStats>, Partial<BuddyStats>][] = [
      ['mackerel', { rowsImported: 7999 }, { rowsImported: 8000 }],
      ['mouse', { maxCustomers: 29 }, { maxCustomers: 30 }],
      ['pompom', { maxDayRows: 79 }, { maxDayRows: 80 }],
      ['feather', { exports: 14 }, { exports: 15 }],
      ['can', { backupDays: 4 }, { backupDays: 5 }],
      ['key', { assigned: 149 }, { assigned: 150 }],
      ['receipt', { maxSOs: 499 }, { maxSOs: 500 }],
      ['yarn', { edits: 199 }, { edits: 200 }],
      ['fishbone', { maxMonths: 3 }, { maxMonths: 4 }],
      ['magnifier', { filterUses: 149 }, { filterUses: 150 }],
    ]
    for (const [id, below, enough] of cases) {
      expect(itemById(id)!.kind).toBe('toy')
      expect(isUnlocked(itemById(id)!, at(below), NOW), `${id} just below`).toBe(false)
      expect(isUnlocked(itemById(id)!, at(enough), NOW), `${id} at the threshold`).toBe(true)
    }
    expect(isUnlocked(itemById('notoy')!, DEFAULT_STATS, NOW)).toBe(true)
  })

  it('the gold cat needs every other item except the ones tied to a date', () => {
    const gold = itemById('gold')!
    const rest = ITEMS.filter((i) => i.id !== 'gold' && !i.seasonal)
    expect(gold.progress(DEFAULT_STATS, NOW).total).toBe(rest.length)
    const all = withEarned(at({ earned: rest.map((i) => i.id).filter((id) => id !== 'crown') }), NOW)
    expect(isUnlocked(gold, all, NOW)).toBe(false)
    const done = withEarned(at({ earned: rest.map((i) => i.id) }), NOW)
    expect(isUnlocked(gold, done, NOW)).toBe(true)
    expect(done.earned).toContain('gold')
    // the festival outfits are not needed
    expect(done.earned).not.toContain('songkran')
  })

  it('reports exactly what a change unlocked', () => {
    let s = DEFAULT_STATS
    const got: string[] = []
    for (const patch of [{ imports: 1 }, { remindersDone: 3 }, { remindersDone: 4 }, { totalDays: 3 }]) {
      const next = { ...s, ...patch }
      got.push(...newlyUnlocked(s, next, NOW).map((x) => x.id))
      s = next
    }
    expect(got).toEqual(['hardhat', 'glasses', 'catnip', 'roll']) // the 3rd reminder also passes the 1-reminder catnip; then the days patch
  })

  it('every item has a unique id, a name, a hint and a sane progress', () => {
    expect(new Set(ITEMS.map((i) => i.id)).size).toBe(ITEMS.length)
    for (const i of ITEMS) {
      expect(i.name.length).toBeGreaterThan(1)
      expect(i.hint.length).toBeGreaterThan(3)
      const p = i.progress(DEFAULT_STATS, NOW)
      expect(p.total).toBeGreaterThanOrEqual(1)
      expect(p.done).toBeLessThanOrEqual(p.total)
    }
  })

  it('falls back to the default look when the saved one is unknown or not unlocked', () => {
    expect(safeLook('tuxedo', 'crown', 'notoy', DEFAULT_STATS, NOW)).toEqual({ skin: 'calico', outfit: 'none', toy: 'notoy' })
    expect(safeLook('nonsense', 'nonsense', 'nonsense', DEFAULT_STATS, NOW)).toEqual({ skin: 'calico', outfit: 'none', toy: 'notoy' })
    expect(safeLook('tuxedo', 'crown', 'notoy', at({ pets: 5000 }), NOW)).toEqual({ skin: 'tuxedo', outfit: 'crown', toy: 'notoy' })
  })
})

describe('buddy: counters fed by the app\'s data', () => {
  it('imports add only rows that were new', () => {
    expect(recordImport(DEFAULT_STATS, 120)).toMatchObject({ imports: 1, rowsImported: 120 })
    expect(recordImport(recordImport(DEFAULT_STATS, 120), 0)).toMatchObject({ imports: 2, rowsImported: 120 })
    expect(recordImport(DEFAULT_STATS)).toMatchObject({ imports: 1, rowsImported: 0 })
  })

  it('data facts keep the highest value ever seen and hand back the same object when nothing grew', () => {
    const a = recordData(DEFAULT_STATS, { customers: 10, sos: 200, maxDayRows: 40, months: 2 })
    expect(a).toMatchObject({ maxCustomers: 10, maxSOs: 200, maxDayRows: 40, maxMonths: 2 })
    expect(recordData(a, { customers: 5, sos: 100, maxDayRows: 10, months: 1 })).toBe(a) // the data shrank
    expect(recordData(a, { customers: 12, sos: 100, maxDayRows: 10, months: 1 })).toMatchObject({ maxCustomers: 12, maxSOs: 200 })
  })

  it('exports count every file, backups count once per day', () => {
    let s = recordExport(DEFAULT_STATS, 'xlsx', day(10, 14))
    expect(s).toMatchObject({ exports: 1, backupDays: 0 })
    s = recordExport(s, 'json', day(10, 14, 9))
    s = recordExport(s, 'json', day(10, 14, 18))
    expect(s).toMatchObject({ exports: 3, backupDays: 1, lastBackup: '2026-10-14' })
    expect(recordExport(s, 'json', day(10, 15)).backupDays).toBe(2)
  })

  it('edits count the rows and how many got a driver or truck; an empty edit changes nothing', () => {
    expect(recordEdit(DEFAULT_STATS, 5, 3)).toMatchObject({ edits: 5, assigned: 3 })
    expect(recordEdit(DEFAULT_STATS, 0, 0)).toBe(DEFAULT_STATS)
    expect(recordEdit(DEFAULT_STATS, 2, -4).assigned).toBe(0)
  })

  it('filter uses stop counting at the daily cap and start again the next day', () => {
    let s = DEFAULT_STATS
    for (let i = 0; i < 100; i++) s = recordFilterUse(s, day(10, 14))
    expect(s.filterUses).toBe(DAILY_FILTER_CAP)
    expect(recordFilterUse(s, day(10, 14, 20))).toBe(s)
    expect(recordFilterUse(s, day(10, 15)).filterUses).toBe(DAILY_FILTER_CAP + 1)
  })

  it('every toy has its picture, so it is announced, flagged as new and wearable', () => {
    for (const t of ITEMS.filter((i) => i.kind === 'toy')) expect(isShown(t), t.id).toBe(true)
    const s = withEarned(at({ rowsImported: 8000 }), NOW)
    expect(s.earned).toContain('mackerel')
    expect(unseenCount(s)).toBe(s.earned.length) // nothing seen yet, the toy counts as new
    expect(safeLook('calico', 'none', 'mackerel', s, NOW).toy).toBe('mackerel')
    expect(safeLook('calico', 'none', 'mackerel', DEFAULT_STATS, NOW).toy).toBe('notoy') // not unlocked
  })

  it('an item whose picture is missing is kept but never announced, flagged as new or worn', () => {
    const ghost = { ...itemById('mackerel')!, id: 'ghost-toy' }
    expect(isShown(ghost)).toBe(false)
    expect(safeLook('calico', 'none', 'ghost-toy', withEarned(at({ rowsImported: 8000 }), NOW), NOW).toy).toBe('notoy')
  })
})

describe('buddy: earned items stay earned', () => {
  it('keeps an item once unlocked, even if the progress later reads lower', () => {
    const s = withEarned(at({ pets: 1000 }), NOW)
    expect(s.earned).toContain('stretch')
    const lower = { ...s, pets: 0 }
    expect(isUnlocked(itemById('stretch')!, lower, NOW)).toBe(true)
    expect(newlyUnlocked(s, lower, NOW)).toEqual([])
  })

  it('upgrading keeps what the old, lower poke thresholds had already given out', () => {
    // old rules: stretch 5, scarf 10, tail 25, tuxedo 50, crown 100
    const g = grandfather(at({ pets: 60, imports: 1 }), NOW)
    expect(g.earned).toEqual(expect.arrayContaining(['stretch', 'scarf', 'tail', 'tuxedo', 'hardhat']))
    expect(g.earned).not.toContain('crown')
    expect(unseenCount(g)).toBe(0) // nothing is "new" right after the upgrade
  })

  it('tracks what the wardrobe has not shown yet and clears it when opened', () => {
    const s = withEarned(at({ imports: 1 }), NOW)
    expect(unseenCount(s)).toBe(s.earned.length) // nothing seen yet
    const seen = markSeen(s)
    expect(unseenCount(seen)).toBe(0)
    expect(markSeen(seen)).toBe(seen) // nothing to change
    expect(unseenCount(withEarned({ ...seen, remindersDone: 3 }, NOW))).toBe(2) // glasses and the catnip
  })
})

describe('buddy: stored progress', () => {
  afterEach(() => vi.unstubAllGlobals())
  const stub = (store: Record<string, string>) =>
    vi.stubGlobal('localStorage', { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => void (store[k] = v) })

  it('round-trips a full record', async () => {
    const store: Record<string, string> = {}
    stub(store)
    const { loadBuddyStats, saveBuddyStats } = await import('./db')
    expect(loadBuddyStats(NOW)).toMatchObject({ pets: 0, earned: expect.arrayContaining(['calico', 'none']) })
    const full: BuddyStats = {
      pets: 70,
      petsToday: { day: '2026-10-14', n: 12 },
      days: ['2026-10-13', '2026-10-14'],
      totalDays: 40,
      bestStreak: 9,
      remindersDone: 2,
      imports: 1,
      nightOwl: true,
      nightVisits: 3,
      lastNight: '2026-10-13',
      perfectDays: 4,
      lastPerfect: '2026-10-14',
      wakes: 8,
      rowsImported: 4000,
      maxCustomers: 31,
      maxSOs: 520,
      maxDayRows: 90,
      maxMonths: 5,
      exports: 6,
      backupDays: 2,
      lastBackup: '2026-10-12',
      assigned: 40,
      edits: 75,
      filterUses: 12,
      filterToday: { day: '2026-10-14', n: 3 },
      seasons: ['krathong'],
      earned: ['calico', 'none', 'hardhat'],
      seen: ['calico', 'none'],
    }
    saveBuddyStats(full)
    expect(loadBuddyStats(NOW)).toEqual(full)
  })

  it('upgrades a record from the first release: keeps its items, starts the new counters from its days', async () => {
    const store: Record<string, string> = { 'reminder.buddy.v1': JSON.stringify({ pets: 60, days: ['2026-10-12', '2026-10-13', '2026-10-14'], remindersDone: 1, imports: 1, nightOwl: false, seasons: [] }) }
    stub(store)
    const { loadBuddyStats } = await import('./db')
    const s = loadBuddyStats(NOW)
    expect(s).toMatchObject({ pets: 60, totalDays: 3, bestStreak: 3, perfectDays: 0, wakes: 0 })
    expect(s.earned).toEqual(expect.arrayContaining(['stretch', 'scarf', 'tail', 'tuxedo', 'hardhat', 'cap', 'roll']))
    expect(s.earned).not.toContain('crown')
    expect(unseenCount(s)).toBe(0) // nothing "new" the first time
  })

  it('drops damaged fields and unknown item ids', async () => {
    const store: Record<string, string> = {
      'reminder.buddy.v1': JSON.stringify({ pets: 'lots', days: ['x', '2026-10-01', 3], imports: -4, seasons: ['songkran', 'bogus'], nightOwl: 'yes', petsToday: 5, earned: ['hardhat', 'unicorn', 7], seen: 'no' }),
    }
    stub(store)
    const { loadBuddyStats } = await import('./db')
    const s = loadBuddyStats(NOW)
    expect(s).toMatchObject({ pets: 0, days: ['2026-10-01'], imports: 0, seasons: ['songkran'], nightOwl: false, petsToday: { day: '', n: 0 }, seen: [] })
    expect(s.earned).toContain('hardhat')
    expect(s.earned).not.toContain('unicorn')
  })
})
