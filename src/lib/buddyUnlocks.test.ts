import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_STATS, ITEMS, isUnlocked, itemById, newlyUnlocked, recordImport, recordPet, recordReminderDone, recordVisit, safeLook, streak, unlockedIds, type BuddyStats } from './buddyUnlocks'

const day = (m: number, d: number, h = 12) => new Date(2026, m - 1, d, h)
const withDays = (...days: string[]): BuddyStats => ({ ...DEFAULT_STATS, days })

describe('buddy: progress and unlocks', () => {
  it('starts with only the default look and no moves', () => {
    expect(unlockedIds('skin', DEFAULT_STATS, day(10, 14))).toEqual(['calico'])
    expect(unlockedIds('outfit', DEFAULT_STATS, day(10, 14))).toEqual(['none'])
    expect(unlockedIds('move', DEFAULT_STATS, day(10, 14))).toEqual([])
  })

  it('counts a visit once per day, notes night visits and festivals', () => {
    let s = recordVisit(DEFAULT_STATS, day(10, 14, 9))
    s = recordVisit(s, day(10, 14, 15))
    expect(s.days).toEqual(['2026-10-14'])
    expect(s.nightOwl).toBe(false)
    expect(recordVisit(s, day(10, 15, 2)).nightOwl).toBe(true)
    expect(recordVisit(DEFAULT_STATS, day(4, 14)).seasons).toEqual(['songkran'])
    expect(recordVisit(DEFAULT_STATS, day(11, 3)).seasons).toEqual(['krathong'])
    expect(recordVisit(DEFAULT_STATS, day(10, 14)).seasons).toEqual([])
  })

  it('keeps only the last 120 days', () => {
    let s = DEFAULT_STATS
    for (let i = 0; i < 150; i++) s = recordVisit(s, new Date(2026, 0, 1 + i))
    expect(s.days).toHaveLength(120)
    expect(s.days.at(-1)).toBe('2026-05-30')
  })

  it('streaks count consecutive days back from today, or from yesterday if today is not recorded yet', () => {
    expect(streak(withDays('2026-10-12', '2026-10-13', '2026-10-14').days, day(10, 14))).toBe(3)
    expect(streak(['2026-10-12', '2026-10-13'], day(10, 14))).toBe(2)
    expect(streak(['2026-10-10', '2026-10-13', '2026-10-14'], day(10, 14))).toBe(2)
    expect(streak(['2026-10-10'], day(10, 14))).toBe(0)
    expect(streak(['2026-09-30', '2026-10-01'], day(10, 1))).toBe(2) // across a month boundary
    expect(streak([], day(10, 14))).toBe(0)
  })

  it('unlocks things at their thresholds', () => {
    const now = day(10, 14)
    const at = (patch: Partial<BuddyStats>) => ({ ...DEFAULT_STATS, ...patch })
    expect(isUnlocked(itemById('stretch')!, at({ pets: 4 }), now)).toBe(false)
    expect(isUnlocked(itemById('stretch')!, at({ pets: 5 }), now)).toBe(true)
    expect(isUnlocked(itemById('scarf')!, at({ pets: 10 }), now)).toBe(true)
    expect(isUnlocked(itemById('crown')!, at({ pets: 99 }), now)).toBe(false)
    expect(isUnlocked(itemById('hardhat')!, at({ imports: 1 }), now)).toBe(true)
    expect(isUnlocked(itemById('glasses')!, at({ remindersDone: 3 }), now)).toBe(true)
    expect(isUnlocked(itemById('cap')!, withDays('2026-10-12', '2026-10-13', '2026-10-14'), now)).toBe(true)
    expect(isUnlocked(itemById('cap')!, withDays('2026-10-10', '2026-10-12', '2026-10-14'), now)).toBe(false) // not consecutive
    expect(isUnlocked(itemById('orange')!, withDays(...Array.from({ length: 7 }, (_, i) => `2026-09-0${i + 1}`)), now)).toBe(true)
    expect(isUnlocked(itemById('songkran')!, at({ seasons: ['songkran'] }), now)).toBe(true)
    expect(isUnlocked(itemById('party')!, at({ seasons: ['songkran'] }), now)).toBe(false)
  })

  it('reports exactly what a change unlocked', () => {
    const now = day(10, 14)
    let s = DEFAULT_STATS
    const got: string[] = []
    for (let i = 0; i < 12; i++) {
      const next = recordPet(s)
      got.push(...newlyUnlocked(s, next, now).map((x) => x.id))
      s = next
    }
    expect(got).toEqual(['stretch', 'scarf']) // 5th and 10th poke
    expect(newlyUnlocked(s, recordImport(s), now).map((x) => x.id)).toEqual(['hardhat'])
    expect(newlyUnlocked(s, recordReminderDone(s), now)).toEqual([])
  })

  it('every item has a unique id, a name, a hint and a sane progress', () => {
    expect(new Set(ITEMS.map((i) => i.id)).size).toBe(ITEMS.length)
    for (const i of ITEMS) {
      expect(i.name.length).toBeGreaterThan(1)
      expect(i.hint.length).toBeGreaterThan(3)
      const p = i.progress(DEFAULT_STATS, day(10, 14))
      expect(p.total).toBeGreaterThanOrEqual(1)
      expect(p.done).toBeLessThanOrEqual(p.total)
    }
  })

  it('falls back to the default look when the saved one is unknown or not unlocked', () => {
    const now = day(10, 14)
    expect(safeLook('tuxedo', 'crown', DEFAULT_STATS, now)).toEqual({ skin: 'calico', outfit: 'none' })
    expect(safeLook('nonsense', 'nonsense', DEFAULT_STATS, now)).toEqual({ skin: 'calico', outfit: 'none' })
    expect(safeLook('tuxedo', 'crown', { ...DEFAULT_STATS, pets: 100 }, now)).toEqual({ skin: 'tuxedo', outfit: 'crown' })
  })
})

describe('buddy: stored progress', () => {
  afterEach(() => vi.unstubAllGlobals())
  const stub = (store: Record<string, string>) =>
    vi.stubGlobal('localStorage', { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => void (store[k] = v) })

  it('round-trips, upgrades the old pets-only record, and drops damaged fields', async () => {
    const store: Record<string, string> = {}
    stub(store)
    const { loadBuddyStats, saveBuddyStats } = await import('./db')
    expect(loadBuddyStats()).toEqual(DEFAULT_STATS)
    const full: BuddyStats = { pets: 7, days: ['2026-10-13', '2026-10-14'], remindersDone: 2, imports: 1, nightOwl: true, seasons: ['krathong'] }
    saveBuddyStats(full)
    expect(loadBuddyStats()).toEqual(full)
    store['reminder.buddy.v1'] = JSON.stringify({ pets: 5 }) // what the first version stored
    expect(loadBuddyStats()).toEqual({ ...DEFAULT_STATS, pets: 5 })
    store['reminder.buddy.v1'] = JSON.stringify({ pets: 'lots', days: ['x', '2026-10-01', 3], imports: -4, seasons: ['songkran', 'bogus'], nightOwl: 'yes' })
    expect(loadBuddyStats()).toEqual({ ...DEFAULT_STATS, days: ['2026-10-01'], seasons: ['songkran'] })
  })
})
