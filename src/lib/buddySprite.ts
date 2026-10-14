// "เปี๊ยก" the app cat: original pixel art built in code, so there is no image file to ship.
// A pose is painted from a few rectangles onto a small grid, then a one-pixel outline is traced around it.

export type Pose = 'sit' | 'blink' | 'walkA' | 'walkB' | 'sleep' | 'yawn' | 'happy' | 'playA' | 'playB' | 'stretch' | 'roll' | 'tailA' | 'tailB' | 'shout'

/** what the cat wears; drawn on top of the fur before the outline is traced */
export type Outfit = 'none' | 'scarf' | 'cap' | 'hardhat' | 'glasses' | 'crown' | 'party' | 'songkran' | 'krathong'
/** fur colours */
export type Skin = 'calico' | 'orange' | 'tuxedo' | 'grey'

/** one letter per colour in the grid; '' is transparent */
export const PALETTE: Record<string, string> = {
  O: '#2b2433', // outline
  W: '#f7f4fb', // fur
  S: '#d8d2e6', // shaded fur
  B: '#ffb05f', // orange patch (the calico default)
  P: '#f4a3b8', // nose, cheeks, inner ear
  E: '#2b2433', // eyes
  T: '#e8647a', // tongue
  M: '#4a2b38', // mouth
  U: '#7ec8f0', // tears
  R: '#d64550', // scarf
  C: '#3a63c8', // driver's cap
  D: '#26418c', // cap brim
  Y: '#f2c230', // hard hat, gold, flower
  K: '#1d1a24', // sunglasses
  F: '#3fa7a0', // Songkran shirt
  L: '#4aa361', // krathong leaf
  V: '#8e5bd6', // party hat
}

/** colour overrides per skin (fur W/S, patch B, eyes E) */
export const SKINS: Record<Skin, Record<string, string>> = {
  calico: {},
  orange: { W: '#ffb05f', S: '#e9924a', B: '#d9772b' }, // fur is the same orange as the calico's patch
  tuxedo: { W: '#4a4458', S: '#352f40', B: '#f7f4fb', E: '#f6e27a' },
  grey: { W: '#b9bdc9', S: '#9096a6', B: '#7b8194' },
}

export type Sprite = { w: number; h: number; cells: string[][] }

/** where the head and neck are differs per layout, so outfits are drawn per layout */
type Kind = 'front' | 'side' | 'loaf' | 'stretch' | 'roll'
type Raw = { w: number; h: number; cells: string[][]; kind: Kind }

const blank = (w: number, h: number): string[][] => Array.from({ length: h }, () => Array<string>(w).fill(''))
function rect(g: string[][], x: number, y: number, w: number, h: number, c: string) {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (g[j]?.[i] !== undefined) g[j][i] = c
}
const dot = (g: string[][], pts: [number, number][], c: string) => pts.forEach(([x, y]) => rect(g, x, y, 1, 1, c))

/** trace a 1px outline around everything painted (4-neighbour, so corners stay crisp) */
function outline(g: string[][]): string[][] {
  const h = g.length
  const w = g[0].length
  const out = g.map((row) => [...row])
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (g[y][x]) continue
      if ([g[y - 1]?.[x], g[y + 1]?.[x], g[y]?.[x - 1], g[y]?.[x + 1]].some((c) => c)) out[y][x] = 'O'
    }
  return out
}

type FrontOpts = {
  eyes: 'open' | 'blink' | 'happy' | 'closed'
  mouth: 'closed' | 'open' | 'smile' | 'shout'
  tail: 'a' | 'b' | 'chaseL' | 'chaseR'
  paw?: 'L' | 'R'
  /** pupils shifted left / right (chasing the tail) */
  look?: -1 | 0 | 1
  tears?: boolean
}

/** the cat sitting, seen from the front */
function front(o: FrontOpts): Raw {
  const w = 22
  const h = 22
  const g = blank(w, h)
  // tail curls up on the right
  if (o.tail === 'chaseL') {
    rect(g, 2, 17, 3, 3, 'W')
    rect(g, 1, 12, 2, 6, 'W')
    rect(g, 2, 11, 2, 2, 'W')
  } else if (o.tail === 'chaseR') {
    rect(g, 17, 17, 3, 3, 'W')
    rect(g, 19, 12, 2, 6, 'W')
    rect(g, 18, 11, 2, 2, 'W')
  } else if (o.tail === 'a') {
    rect(g, 16, 18, 4, 2, 'W')
    rect(g, 19, 13, 2, 6, 'W')
    rect(g, 18, 12, 2, 2, 'W')
  } else {
    rect(g, 16, 18, 4, 2, 'W')
    rect(g, 19, 15, 2, 4, 'W')
    rect(g, 20, 12, 1, 4, 'W')
  }
  // body, belly shade, feet, patch
  rect(g, 5, 12, 12, 8, 'W')
  rect(g, 5, 18, 12, 2, 'S')
  rect(g, 10, 15, 2, 5, 'S')
  rect(g, 6, 20, 4, 1, 'W')
  rect(g, 12, 20, 4, 1, 'W')
  rect(g, 12, 13, 4, 4, 'B')
  // raised paw while playing
  if (o.paw === 'L') rect(g, 2, 9, 3, 5, 'W')
  if (o.paw === 'R') rect(g, 17, 9, 3, 5, 'W')
  // ears (the left one is brown)
  rect(g, 4, 2, 2, 1, 'B')
  rect(g, 4, 3, 3, 1, 'B')
  rect(g, 16, 2, 2, 1, 'W')
  rect(g, 15, 3, 3, 1, 'W')
  dot(g, [[16, 3]], 'P')
  // head
  rect(g, 4, 4, 14, 1, 'W')
  rect(g, 3, 5, 16, 6, 'W')
  rect(g, 4, 11, 14, 1, 'W')
  rect(g, 3, 4, 4, 4, 'B')
  rect(g, 4, 11, 14, 1, 'S')
  // eyes
  if (o.eyes === 'open') {
    const l = o.look ?? 0
    rect(g, 7 + l, 7, 2, 2, 'E')
    rect(g, 13 + l, 7, 2, 2, 'E')
    dot(g, [[7 + l, 7], [13 + l, 7]], 'W') // a little shine
  } else if (o.eyes === 'happy') {
    dot(g, [[6, 8], [7, 7], [8, 7], [9, 8], [12, 8], [13, 7], [14, 7], [15, 8]], 'E')
    rect(g, 5, 9, 2, 1, 'P')
    rect(g, 15, 9, 2, 1, 'P')
  } else {
    rect(g, 7, 8, 2, 1, 'E')
    rect(g, 13, 8, 2, 1, 'E')
  }
  if (o.tears) dot(g, [[6, 9], [6, 10], [15, 9], [15, 10]], 'U')
  // nose and mouth
  if (o.mouth === 'shout') {
    rect(g, 10, 8, 2, 1, 'P')
    rect(g, 8, 9, 6, 3, 'M')
    rect(g, 9, 11, 4, 1, 'T')
  } else if (o.mouth === 'open') {
    rect(g, 10, 8, 2, 1, 'P')
    rect(g, 9, 9, 4, 3, 'M')
    rect(g, 10, 11, 2, 1, 'T')
  } else if (o.mouth === 'smile') {
    rect(g, 10, 9, 2, 1, 'P')
    rect(g, 9, 10, 4, 1, 'M')
    rect(g, 10, 11, 2, 1, 'T')
  } else {
    rect(g, 10, 9, 2, 1, 'P')
    dot(g, [[9, 10], [10, 11], [11, 11], [12, 10]], 'M')
  }
  return { w, h, cells: g, kind: 'front' }
}

/** walking, seen from the side, facing right (the view flips it for the other direction) */
function side(legs: 'A' | 'B'): Raw {
  const w = 28
  const h = 20
  const g = blank(w, h)
  // tail up
  rect(g, 3, 2, 2, 7, 'W')
  rect(g, 4, 1, 2, 2, 'W')
  // body with a brown patch on the back
  rect(g, 5, 8, 15, 6, 'W')
  rect(g, 6, 7, 13, 1, 'W')
  rect(g, 8, 7, 6, 4, 'B')
  rect(g, 6, 13, 13, 1, 'S')
  // head
  rect(g, 19, 5, 8, 7, 'W')
  rect(g, 20, 4, 6, 1, 'W')
  rect(g, 19, 2, 2, 3, 'W')
  rect(g, 24, 2, 2, 3, 'W')
  dot(g, [[20, 3], [25, 3]], 'P')
  rect(g, 24, 7, 1, 2, 'E')
  dot(g, [[26, 9]], 'P')
  // legs: the two frames swap which paws are lifted
  // paws come in pairs side by side (a 1px gap between legs would fill up with outline and look striped)
  if (legs === 'A') {
    rect(g, 16, 14, 2, 5, 'W')
    rect(g, 14, 14, 2, 4, 'S')
    rect(g, 7, 14, 2, 5, 'W')
    rect(g, 9, 14, 2, 4, 'S')
  } else {
    rect(g, 14, 14, 2, 5, 'W')
    rect(g, 16, 14, 2, 4, 'S')
    rect(g, 9, 14, 2, 5, 'W')
    rect(g, 7, 14, 2, 4, 'S')
  }
  return { w, h, cells: g, kind: 'side' }
}

/** curled up asleep */
function loaf(): Raw {
  const w = 28
  const h = 16
  const g = blank(w, h)
  rect(g, 2, 9, 4, 3, 'W') // tail
  rect(g, 4, 5, 18, 8, 'W')
  rect(g, 6, 4, 14, 1, 'W')
  rect(g, 8, 4, 7, 4, 'B')
  rect(g, 5, 12, 17, 1, 'S')
  rect(g, 17, 6, 9, 7, 'W') // head
  rect(g, 18, 3, 2, 3, 'W')
  rect(g, 23, 3, 2, 3, 'W')
  dot(g, [[19, 4], [24, 4]], 'P')
  rect(g, 19, 9, 2, 1, 'E')
  rect(g, 23, 9, 2, 1, 'E')
  rect(g, 21, 10, 2, 1, 'P')
  return { w, h, cells: g, kind: 'loaf' }
}

/** play-bow: front paws stretched out, bottom in the air */
function stretch(): Raw {
  const w = 28
  const h = 20
  const g = blank(w, h)
  rect(g, 3, 2, 2, 6, 'W') // tail up
  rect(g, 4, 1, 2, 2, 'W')
  rect(g, 5, 6, 8, 8, 'W') // raised hind end
  rect(g, 6, 6, 5, 3, 'B')
  rect(g, 12, 9, 8, 6, 'W') // lowered front body
  rect(g, 5, 14, 2, 5, 'W') // hind legs, side by side
  rect(g, 7, 14, 2, 4, 'S')
  rect(g, 17, 15, 8, 2, 'W') // paws reaching forward
  rect(g, 20, 10, 7, 6, 'W') // head resting low
  rect(g, 20, 8, 2, 3, 'W')
  rect(g, 25, 8, 2, 3, 'W')
  dot(g, [[21, 9], [26, 9]], 'P')
  rect(g, 23, 12, 2, 1, 'E') // eyes closed in bliss
  dot(g, [[26, 13]], 'P')
  return { w, h, cells: g, kind: 'stretch' }
}

/** belly up, paws in the air */
function roll(): Raw {
  const w = 28
  const h = 18
  const g = blank(w, h)
  rect(g, 21, 11, 5, 2, 'W') // tail
  rect(g, 7, 6, 14, 9, 'W') // body
  rect(g, 9, 8, 10, 5, 'S') // belly
  rect(g, 14, 6, 5, 3, 'B')
  rect(g, 11, 2, 2, 5, 'W') // paws up
  rect(g, 16, 2, 2, 5, 'W')
  dot(g, [[11, 2], [12, 2], [16, 2], [17, 2]], 'P')
  rect(g, 2, 8, 7, 7, 'W') // head, upside down on the left
  rect(g, 2, 6, 2, 3, 'W')
  rect(g, 7, 6, 2, 3, 'W')
  dot(g, [[3, 7], [8, 7]], 'P')
  dot(g, [[3, 11], [4, 10], [5, 10], [6, 11]], 'E') // happy eye
  dot(g, [[2, 13]], 'P')
  return { w, h, cells: g, kind: 'roll' }
}

const BUILDERS: Record<Pose, () => Raw> = {
  sit: () => front({ eyes: 'open', mouth: 'closed', tail: 'a' }),
  blink: () => front({ eyes: 'blink', mouth: 'closed', tail: 'a' }),
  walkA: () => side('A'),
  walkB: () => side('B'),
  sleep: loaf,
  yawn: () => front({ eyes: 'closed', mouth: 'open', tail: 'a' }),
  happy: () => front({ eyes: 'happy', mouth: 'smile', tail: 'b' }),
  playA: () => front({ eyes: 'open', mouth: 'smile', tail: 'a', paw: 'L' }),
  playB: () => front({ eyes: 'open', mouth: 'smile', tail: 'b', paw: 'R' }),
  stretch,
  roll,
  tailA: () => front({ eyes: 'open', mouth: 'closed', tail: 'chaseL', look: -1 }),
  tailB: () => front({ eyes: 'open', mouth: 'closed', tail: 'chaseR', look: 1 }),
  shout: () => front({ eyes: 'closed', mouth: 'shout', tail: 'b', tears: true }),
}

type Paint = [number, number, number, number, string] | [number, number, string] // rect or single pixel

/** outfit pieces per layout, as rectangles [x, y, w, h, colour] or single pixels [x, y, colour] */
const OUTFITS: Record<Exclude<Outfit, 'none'>, Record<Kind, Paint[]>> = {
  scarf: {
    front: [[5, 12, 12, 2, 'R'], [14, 14, 2, 3, 'R']],
    side: [[17, 9, 4, 5, 'R']],
    loaf: [[15, 9, 3, 4, 'R']],
    stretch: [[17, 9, 3, 4, 'R']],
    roll: [[8, 9, 2, 6, 'R']],
  },
  cap: {
    front: [[7, 2, 8, 3, 'C'], [6, 5, 10, 1, 'D']],
    side: [[20, 3, 5, 2, 'C'], [24, 5, 3, 1, 'D']],
    loaf: [[19, 4, 5, 2, 'C'], [23, 6, 3, 1, 'D']],
    stretch: [[21, 7, 5, 2, 'C'], [25, 9, 2, 1, 'D']],
    roll: [[3, 5, 4, 2, 'C'], [2, 7, 2, 1, 'D']],
  },
  hardhat: {
    front: [[6, 1, 10, 4, 'Y'], [5, 5, 12, 1, 'Y'], [10, 1, 2, 3, 'W']],
    side: [[19, 2, 8, 3, 'Y'], [19, 5, 8, 1, 'Y'], [22, 2, 1, 3, 'W']],
    loaf: [[17, 3, 9, 3, 'Y'], [17, 6, 10, 1, 'Y'], [21, 3, 1, 3, 'W']],
    stretch: [[20, 6, 7, 3, 'Y'], [20, 9, 7, 1, 'Y'], [23, 6, 1, 3, 'W']],
    roll: [[2, 5, 7, 3, 'Y'], [2, 8, 8, 1, 'Y'], [5, 5, 1, 3, 'W']],
  },
  glasses: {
    front: [[6, 7, 4, 3, 'K'], [12, 7, 4, 3, 'K'], [10, 7, 2, 1, 'K'], [7, 7, 'W'], [13, 7, 'W']],
    side: [[22, 6, 4, 3, 'K']],
    loaf: [[19, 8, 3, 2, 'K'], [22, 8, 3, 2, 'K']],
    stretch: [[22, 11, 4, 2, 'K']],
    roll: [[3, 10, 2, 2, 'K'], [5, 10, 2, 2, 'K']],
  },
  crown: {
    front: [[7, 2, 8, 3, 'Y'], [8, 1, 'Y'], [11, 1, 'Y'], [14, 1, 'Y'], [11, 3, 'R']],
    side: [[20, 2, 6, 2, 'Y'], [20, 1, 'Y'], [22, 1, 'Y'], [24, 1, 'Y']],
    loaf: [[18, 3, 7, 2, 'Y'], [18, 2, 'Y'], [21, 2, 'Y'], [24, 2, 'Y']],
    stretch: [[21, 6, 5, 2, 'Y'], [21, 5, 'Y'], [23, 5, 'Y'], [25, 5, 'Y']],
    roll: [[3, 5, 4, 2, 'Y'], [3, 4, 'Y'], [5, 4, 'Y']],
  },
  party: {
    front: [[10, 1, 2, 1, 'V'], [9, 2, 4, 1, 'V'], [8, 3, 6, 2, 'V'], [11, 3, 'Y'], [10, 4, 'Y'], [12, 4, 'Y']],
    side: [[22, 1, 2, 1, 'V'], [21, 2, 4, 2, 'V'], [22, 3, 'Y']],
    loaf: [[20, 1, 2, 1, 'V'], [19, 2, 4, 1, 'V'], [18, 3, 6, 2, 'V'], [20, 3, 'Y']],
    stretch: [[22, 4, 2, 1, 'V'], [21, 5, 4, 3, 'V'], [22, 6, 'Y']],
    roll: [[4, 2, 2, 1, 'V'], [3, 3, 4, 3, 'V'], [4, 4, 'Y']],
  },
  songkran: {
    front: [[5, 13, 12, 5, 'F'], [7, 14, 'Y'], [10, 16, 'P'], [13, 14, 'Y'], [8, 17, 'P'], [14, 17, 'Y']],
    side: [[6, 8, 12, 5, 'F'], [8, 9, 'Y'], [11, 11, 'P'], [14, 9, 'Y'], [16, 12, 'P']],
    loaf: [[7, 6, 10, 5, 'F'], [9, 7, 'Y'], [12, 9, 'P'], [15, 7, 'Y']],
    stretch: [[13, 10, 6, 4, 'F'], [14, 11, 'Y'], [17, 12, 'P']],
    roll: [[9, 8, 10, 6, 'F'], [11, 9, 'Y'], [14, 11, 'P'], [17, 9, 'Y']],
  },
  krathong: {
    front: [[6, 3, 10, 2, 'L'], [9, 2, 4, 1, 'P'], [10, 1, 2, 1, 'P'], [11, 2, 'Y']],
    side: [[20, 2, 6, 2, 'L'], [22, 1, 2, 1, 'P']],
    loaf: [[18, 4, 7, 2, 'L'], [20, 3, 3, 1, 'P']],
    stretch: [[21, 6, 5, 2, 'L'], [22, 5, 3, 1, 'P']],
    roll: [[3, 5, 5, 2, 'L'], [4, 4, 3, 1, 'P']],
  },
}

function dress(raw: Raw, outfit: Outfit): void {
  if (outfit === 'none') return
  for (const piece of OUTFITS[outfit][raw.kind]) {
    if (piece.length === 5) rect(raw.cells, piece[0], piece[1], piece[2], piece[3], piece[4])
    else rect(raw.cells, piece[0], piece[1], 1, 1, piece[2])
  }
}

const cache = new Map<string, Sprite>()
export function buildSprite(pose: Pose, outfit: Outfit = 'none'): Sprite {
  const key = `${pose}|${outfit}`
  let sp = cache.get(key)
  if (!sp) {
    const raw = BUILDERS[pose]()
    dress(raw, outfit)
    sp = { w: raw.w, h: raw.h, cells: outline(raw.cells) }
    cache.set(key, sp)
  }
  return sp
}

/** SVG path data per colour (runs of pixels in a row are merged), ready to render as <path fill=…> */
export function spritePaths(s: Sprite, skin: Skin = 'calico'): { color: string; d: string }[] {
  const palette = { ...PALETTE, ...SKINS[skin] }
  const byColor = new Map<string, string>()
  s.cells.forEach((row, y) => {
    let x = 0
    while (x < row.length) {
      const c = row[x]
      if (!c) {
        x++
        continue
      }
      let run = 1
      while (row[x + run] === c) run++
      byColor.set(c, `${byColor.get(c) ?? ''}M${x} ${y}h${run}v1h-${run}z`)
      x += run
    }
  })
  return [...byColor].map(([c, d]) => ({ color: palette[c], d }))
}
