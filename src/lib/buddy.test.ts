import { afterEach, describe, expect, it, vi } from 'vitest'
import { clickReply, durationMs, EMPTY_CTX, isFlurry, nextState, occasionLines, periodOf, pickLine, seasonOf, workLines, type BuddyState, type Period } from './buddy'
import { buildSprite, hasToyArt, spritePaths, PALETTE, SKINS, type Outfit, type Pose, type Skin, type Toy } from './buddySprite'

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
const STATES: BuddyState[] = ['sit', 'walk', 'yawn', 'sleep', 'play', 'happy', 'stretch', 'roll', 'tail', 'groom', 'zoom', 'stand', 'shout']
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

  it('does the zoomies mostly at night, not in the morning', () => {
    const rnd = seeded(21)
    const zooms = (p: Period) => Array.from({ length: 3000 }, () => nextState('sit', p, rnd, ['zoom'])).filter((s) => s === 'zoom').length
    expect(zooms('latenight')).toBeGreaterThan(zooms('morning') * 4)
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
    expect(clickReply('sleep', 'night', EMPTY_CTX, 1000, rnd)).toMatchObject({ next: 'happy', line: expect.stringContaining('1,000 ครั้ง') })
    // a poke that was not counted (cap used up) never repeats a milestone line
    expect(clickReply('sit', 'noon', EMPTY_CTX, 1000, rnd, false, false).line).not.toContain('1,000')
    // with today's quota used up it sometimes says so
    const lines = new Set(Array.from({ length: 200 }, () => clickReply('sit', 'noon', EMPTY_CTX, 40, seeded(Math.random() * 1e9), false, false, true).line))
    expect([...lines].some((l) => l.includes('200 ครั้ง'))).toBe(true)
  })
})

describe('buddy: sprites', () => {
  const POSES: Pose[] = ['sit', 'blink', 'walkA', 'walkB', 'sleep', 'yawn', 'happy', 'playA', 'playB', 'stretch', 'roll', 'tailA', 'tailB', 'shout', 'groomA', 'groomB', 'zoomA', 'zoomB', 'stand']
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

  const OUTFITS: Outfit[] = ['scarf', 'cap', 'hardhat', 'glasses', 'crown', 'party', 'songkran', 'krathong', 'vest', 'nightcap', 'tie', 'medal', 'ninja', 'halloween', 'christmas', 'bell', 'bowtie', 'headphones', 'starclip', 'eartag', 'earplaster', 'earflower', 'earmuffs', 'hairclip', 'hoop', 'earribbon', 'earcuff']
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

  const TOYS: Exclude<Toy, 'notoy'>[] = ['mackerel', 'mouse', 'pompom', 'feather', 'can', 'key', 'receipt', 'yarn', 'fishbone', 'magnifier', 'catnip', 'treat', 'pencil']
  it('a toy either has art that changes every pose and fits the grid, or none and changes nothing', () => {
    for (const toy of TOYS)
      for (const p of POSES) {
        const bare = buildSprite(p)
        const withToy = buildSprite(p, 'none', toy)
        const changed = withToy.cells.flat().join('') !== bare.cells.flat().join('')
        expect(changed, `${toy} on ${p}`).toBe(hasToyArt(toy))
        for (const e of [withToy.cells[0], withToy.cells[withToy.h - 1], withToy.cells.map((r) => r[0]), withToy.cells.map((r) => r[withToy.w - 1])])
          expect(e.every((c) => !c || c === 'O')).toBe(true)
      }
    expect(buildSprite('sit', 'none', 'notoy')).toBe(buildSprite('sit'))
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
    expect(flat('groomA')).not.toBe(flat('groomB'))
    expect(flat('zoomA')).not.toBe(flat('zoomB'))
    expect(flat('stand')).not.toBe(flat('sit'))
    expect(buildSprite('stand').h).toBeGreaterThan(buildSprite('sit').h) // it is taller standing up
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
    expect(loadSettings().buddy).toEqual({ visible: true, sound: false, skin: 'calico', outfit: 'none', toy: 'notoy' })
    store['reminder.settings.v1'] = JSON.stringify({ buddy: { sound: true } })
    expect(loadSettings().buddy).toEqual({ visible: true, sound: true, skin: 'calico', outfit: 'none', toy: 'notoy' })
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
    for (const m of ['stretch', 'roll', 'tail', 'groom', 'zoom', 'stand'] as const) expect(seen([]).has(m)).toBe(false)
    expect(seen(['stretch', 'roll', 'tail']).has('stretch')).toBe(true)
    expect(seen(['groom']).has('zoom')).toBe(false)
    expect(seen(['stretch']).has('roll')).toBe(false)
  })

  it('finds the festivals', () => {
    expect(seasonOf(new Date(2026, 3, 14))).toBe('songkran')
    expect(seasonOf(new Date(2026, 3, 16))).toBeNull()
    expect(seasonOf(new Date(2026, 11, 31))).toBe('newyear')
    expect(seasonOf(new Date(2027, 0, 2))).toBe('newyear')
    expect(seasonOf(new Date(2027, 0, 3))).toBeNull()
    expect(seasonOf(new Date(2026, 10, 24))).toBe('krathong')
    expect(seasonOf(new Date(2026, 9, 31))).toBe('halloween')
    expect(seasonOf(new Date(2026, 9, 30))).toBeNull()
    expect(seasonOf(new Date(2026, 11, 24))).toBe('christmas')
    expect(seasonOf(new Date(2026, 11, 25))).toBe('christmas')
    expect(seasonOf(new Date(2026, 11, 26))).toBeNull()
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
