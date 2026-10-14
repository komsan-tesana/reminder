import { afterEach, describe, expect, it, vi } from 'vitest'
import { clickReply, durationMs, EMPTY_CTX, isFlurry, nextState, occasionLines, periodOf, pickLine, seasonOf, workLines, type BuddyState, type Period } from './buddy'
import { buildSprite, spritePaths, PALETTE, SKINS, type Outfit, type Pose, type Skin } from './buddySprite'

/** small seeded generator so "random" tests are repeatable */
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const at = (h: number) => new Date(2026, 9, 14, h, 0, 0)
const STATES: BuddyState[] = ['sit', 'walk', 'yawn', 'sleep', 'play', 'happy', 'stretch', 'roll', 'tail', 'shout']
const PERIODS: Period[] = ['latenight', 'morning', 'noon', 'afternoon', 'evening', 'night']

describe('buddy: time of day', () => {
  it('splits the day into periods', () => {
    expect([0, 4, 5, 10, 11, 13, 14, 17, 18, 21, 22, 23].map((h) => periodOf(at(h)))).toEqual([
      'latenight', 'latenight', 'morning', 'morning', 'noon', 'noon', 'afternoon', 'afternoon', 'evening', 'evening', 'night', 'night',
    ])
  })
})

describe('buddy: what the cat does next', () => {
  it('never repeats an activity (a long sleep may continue) and never picks a zero-weight one', () => {
    const rnd = seeded(7)
    for (const p of PERIODS)
      for (const cur of STATES)
        for (let i = 0; i < 300; i++) {
          const n = nextState(cur, p, rnd)
          expect(STATES).toContain(n)
          if (cur !== 'sleep') expect(n).not.toBe(cur)
          expect(n).not.toBe('happy') // happy only comes from being poked
        }
  })

  it('sleeps more at night than in the morning, and walks more in the morning than at night', () => {
    const rnd = seeded(3)
    const count = (p: Period, s: BuddyState) => {
      let n = 0
      let cur: BuddyState = 'sit'
      for (let i = 0; i < 4000; i++) {
        cur = nextState(cur === s ? 'sit' : cur, p, rnd)
        if (cur === s) n++
      }
      return n
    }
    expect(count('night', 'sleep')).toBeGreaterThan(count('morning', 'sleep') * 3)
    expect(count('morning', 'walk')).toBeGreaterThan(count('night', 'walk') * 2)
  })

  it('a yawn in a sleepy hour usually becomes a nap, but not in the morning', () => {
    const rnd = seeded(11)
    const naps = (p: Period) => Array.from({ length: 500 }, () => nextState('yawn', p, rnd)).filter((s) => s === 'sleep').length
    expect(naps('night')).toBeGreaterThan(300)
    expect(naps('morning')).toBeLessThan(60)
  })

  it('waking from a nap often starts with a yawn', () => {
    const rnd = seeded(5)
    const yawns = Array.from({ length: 500 }, () => nextState('sleep', 'morning', rnd)).filter((s) => s === 'yawn').length
    expect(yawns).toBeGreaterThan(150)
  })

  it('durations stay in sensible ranges', () => {
    const rnd = seeded(1)
    for (const s of STATES) for (let i = 0; i < 50; i++) expect(durationMs(s, rnd)).toBeGreaterThanOrEqual(2000)
    expect(durationMs('sleep', () => 0)).toBeGreaterThan(durationMs('sit', () => 0))
  })
})

describe('buddy: what the cat says', () => {
  it('has jokes for every period and never repeats the last one', () => {
    const rnd = seeded(2)
    for (const p of PERIODS) {
      let last: string | null = null
      for (let i = 0; i < 100; i++) {
        const line = pickLine(p, EMPTY_CTX, last, rnd)
        expect(line.length).toBeGreaterThan(5)
        expect(line).not.toBe(last)
        last = line
      }
    }
  })

  it('mentions the real numbers when there is work to joke about', () => {
    expect(workLines({ today: 12, unassigned: 3, tomorrow: 0, pending: 0 }).join('\n')).toContain('3 รายการ')
    expect(workLines({ today: 12, unassigned: 0, tomorrow: 4, pending: 2 }).join('\n')).toMatch(/12 รายการ[\s\S]*4 รายการ[\s\S]*2 รายการ/)
    expect(workLines(EMPTY_CTX)).toEqual(['วันนี้ไม่มีงานส่งเลย เปี๊ยกขอนอนยาวนะ'])
  })

  it('a poke makes the cat happy, a poke on a sleeping cat wakes it grumpily, and milestones get their own line', () => {
    const rnd = seeded(4)
    expect(clickReply('walk', 'noon', EMPTY_CTX, 3, rnd).next).toBe('happy')
    const woken = clickReply('sleep', 'night', EMPTY_CTX, 3, rnd)
    expect(woken.next).toBe('yawn')
    expect(woken.line.length).toBeGreaterThan(5)
    expect(clickReply('sleep', 'night', EMPTY_CTX, 10, rnd)).toMatchObject({ next: 'happy', line: expect.stringContaining('10 ครั้ง') })
  })
})

describe('buddy: sprites', () => {
  const POSES: Pose[] = ['sit', 'blink', 'walkA', 'walkB', 'sleep', 'yawn', 'happy', 'playA', 'playB', 'stretch', 'roll', 'tailA', 'tailB', 'shout']
  it('every pose is a rectangular grid with an outline and only known colours', () => {
    for (const p of POSES) {
      const s = buildSprite(p)
      expect(s.cells).toHaveLength(s.h)
      for (const row of s.cells) {
        expect(row).toHaveLength(s.w)
        for (const c of row) if (c) expect(PALETTE).toHaveProperty(c)
      }
      expect(s.cells.flat().filter((c) => c === 'O').length).toBeGreaterThan(20)
      // the painting never touches the border, so the outline is never cut off
      const edges = [s.cells[0], s.cells[s.h - 1], s.cells.map((r) => r[0]), s.cells.map((r) => r[s.w - 1])]
      for (const e of edges) expect(e.every((c) => !c || c === 'O')).toBe(true)
      expect(spritePaths(s).length).toBeGreaterThan(3)
    }
  })

  const OUTFITS: Outfit[] = ['scarf', 'cap', 'hardhat', 'glasses', 'crown', 'party', 'songkran', 'krathong']
  it('every outfit changes every pose and keeps the outline inside the grid', () => {
    for (const p of POSES)
      for (const o of OUTFITS) {
        const bare = buildSprite(p)
        const dressed = buildSprite(p, o)
        expect(dressed.cells.flat().join('')).not.toBe(bare.cells.flat().join(''))
        for (const e of [dressed.cells[0], dressed.cells[dressed.h - 1], dressed.cells.map((r) => r[0]), dressed.cells.map((r) => r[dressed.w - 1])])
          expect(e.every((c) => !c || c === 'O')).toBe(true)
        for (const c of dressed.cells.flat()) if (c) expect(PALETTE).toHaveProperty(c)
      }
  })

  it('skins recolour the fur only: same shapes, different colours', () => {
    const skins = Object.keys(SKINS) as Skin[]
    const sit = buildSprite('sit')
    const colours = skins.map((k) => JSON.stringify(spritePaths(sit, k).map((x) => x.color)))
    expect(new Set(colours).size).toBe(skins.length)
    for (const k of skins) expect(spritePaths(sit, k).map((x) => x.d).sort()).toEqual(spritePaths(sit).map((x) => x.d).sort())
  })

  it('poses differ from each other where they should', () => {
    const flat = (p: Pose) => buildSprite(p).cells.flat().join('')
    expect(flat('walkA')).not.toBe(flat('walkB'))
    expect(flat('sit')).not.toBe(flat('blink'))
    expect(flat('yawn')).not.toBe(flat('sit'))
    expect(flat('playA')).not.toBe(flat('playB'))
  })
})

describe('buddy: saved settings', () => {
  afterEach(() => vi.unstubAllGlobals())
  const stub = (store: Record<string, string>) =>
    vi.stubGlobal('localStorage', { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => void (store[k] = v) })

  it('settings saved before the cat existed get the default look (shown, silent, calico, no outfit), and partial ones are completed', async () => {
    const store: Record<string, string> = { 'reminder.settings.v1': JSON.stringify({ era: 'CE' }) }
    stub(store)
    const { loadSettings } = await import('./db')
    expect(loadSettings().buddy).toEqual({ visible: true, sound: false, skin: 'calico', outfit: 'none' })
    store['reminder.settings.v1'] = JSON.stringify({ buddy: { sound: true } })
    expect(loadSettings().buddy).toEqual({ visible: true, sound: true, skin: 'calico', outfit: 'none' })
  })
})

describe('buddy: unlockable moves, festivals and the scared flurry', () => {
  it('a locked move is never chosen, an unlocked one can be', () => {
    const rnd = seeded(9)
    const seen = (allowed: BuddyState[]) => {
      const s = new Set<BuddyState>()
      for (let i = 0; i < 2000; i++) s.add(nextState('sit', 'evening', rnd, allowed))
      return s
    }
    for (const m of ['stretch', 'roll', 'tail'] as const) expect(seen([]).has(m)).toBe(false)
    expect(seen(['stretch', 'roll', 'tail']).has('stretch')).toBe(true)
    expect(seen(['stretch']).has('roll')).toBe(false)
  })

  it('finds the festivals', () => {
    expect(seasonOf(new Date(2026, 3, 14))).toBe('songkran')
    expect(seasonOf(new Date(2026, 3, 16))).toBeNull()
    expect(seasonOf(new Date(2026, 11, 31))).toBe('newyear')
    expect(seasonOf(new Date(2027, 0, 2))).toBe('newyear')
    expect(seasonOf(new Date(2027, 0, 3))).toBeNull()
    expect(seasonOf(new Date(2026, 10, 24))).toBe('krathong')
  })

  it('has festival and weekday lines, and uses them in jokes on those days', () => {
    expect(occasionLines(new Date(2026, 3, 14)).join()).toContain('สงกรานต์') // Songkran, a Tuesday
    expect(occasionLines(new Date(2026, 9, 16)).join()).toContain('ศุกร์') // a Friday
    expect(occasionLines(new Date(2026, 9, 14))).toEqual([]) // an ordinary Wednesday
    const rnd = seeded(12)
    const lines = new Set(Array.from({ length: 300 }, () => pickLine('noon', EMPTY_CTX, null, rnd, new Date(2026, 3, 14))))
    expect([...lines].some((l) => l.includes('สงกรานต์'))).toBe(true)
  })

  it('five pokes within three seconds is a flurry, slower ones are not', () => {
    expect(isFlurry([1000, 1500, 2000, 2400, 2900], 3000)).toBe(true)
    expect(isFlurry([1000, 2500, 4000, 5500, 7000], 7000)).toBe(false)
    expect(isFlurry([1000, 1500, 2000, 2400], 3000)).toBe(false)
    expect(clickReply('sit', 'noon', EMPTY_CTX, 3, seeded(1), true).next).toBe('shout')
  })
})
