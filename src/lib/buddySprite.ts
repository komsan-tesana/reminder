// "เปี๊ยก" the app cat: original pixel art built in code, so there is no image file to ship.
// A pose is painted from a few rectangles onto a small grid, then a one-pixel outline is traced around it.

export type Pose = 'sit' | 'blink' | 'walkA' | 'walkB' | 'sleep' | 'yawn' | 'happy' | 'playA' | 'playB' | 'stretch' | 'roll' | 'tailA' | 'tailB' | 'shout' | 'groomA' | 'groomB' | 'zoomA' | 'zoomB' | 'stand'

/** what the cat wears; drawn on top of the fur before the outline is traced */
export type Outfit = 'none' | 'scarf' | 'cap' | 'hardhat' | 'glasses' | 'crown' | 'party' | 'songkran' | 'krathong' | 'vest' | 'nightcap' | 'tie' | 'medal' | 'ninja' | 'halloween' | 'christmas' | 'bell' | 'bowtie' | 'headphones' | 'starclip' | 'eartag' | 'earplaster' | 'earflower' | 'earmuffs' | 'hairclip' | 'hoop' | 'earribbon' | 'earcuff'
/** what the cat carries in its mouth (a separate slot from the outfit); `notoy` = nothing */
export type Toy = 'notoy' | 'mackerel' | 'mouse' | 'pompom' | 'feather' | 'can' | 'key' | 'receipt' | 'yarn' | 'fishbone' | 'magnifier' | 'catnip' | 'treat' | 'pencil'
/** fur colours */
export type Skin = 'calico' | 'orange' | 'tuxedo' | 'grey' | 'black' | 'gold'

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
  A: '#c9e83a', // reflective vest
  Z: '#c9ccd6', // silver: reflective stripe, headband plate
  N: '#5b6bc0', // night cap
  I: '#2f4b8f', // tie
  H: '#22314f', // ninja headband
  X: '#3a2a52', // witch hat
  G: '#e8c79a', // plaster
}

/** colour overrides per skin (fur W/S, patch B, eyes E) */
export const SKINS: Record<Skin, Record<string, string>> = {
  calico: {},
  orange: { W: '#ffb05f', S: '#e9924a', B: '#d9772b' }, // fur is the same orange as the calico's patch
  tuxedo: { W: '#4a4458', S: '#352f40', B: '#f7f4fb', E: '#f6e27a' },
  grey: { W: '#b9bdc9', S: '#9096a6', B: '#7b8194' },
  black: { W: '#2f2b38', S: '#211e29', B: '#403b4c', E: '#f6e27a', O: '#0f0d14' },
  gold: { W: '#f6cf55', S: '#dca93a', B: '#fff1b0' },
}

export type Sprite = { w: number; h: number; cells: string[][] }

/** where the head and neck are differs per layout, so outfits are drawn per layout */
type Kind = 'front' | 'side' | 'loaf' | 'stretch' | 'roll' | 'stand'
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
  /** washing its face: paw up (A) and down (B) */
  lick?: 'A' | 'B'
}

/** ears, head, eyes, nose and mouth of the front-facing cat (the head is the same whether it sits or stands) */
function drawHead(g: string[][], o: FrontOpts): void {
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
}

/** a paw held to the cheek, tongue out, for washing its face */
function lick(g: string[][], step: 'A' | 'B') {
  if (step === 'A') {
    rect(g, 4, 8, 4, 4, 'W')
    dot(g, [[9, 9]], 'T')
  } else {
    rect(g, 4, 10, 4, 4, 'W')
    dot(g, [[9, 11]], 'T')
  }
  dot(g, [[5, 12], [6, 12]], 'S') // toes
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
  drawHead(g, o)
  if (o.lick) lick(g, o.lick)
  return { w, h, cells: g, kind: 'front' }
}

/** upright on two legs with arms by its sides (the same head as the sitting cat) */
function stand(): Raw {
  const w = 22
  const h = 34
  const g = blank(w, h)
  rect(g, 16, 25, 4, 2, 'W') // tail behind, curling out to the right
  rect(g, 19, 19, 2, 7, 'W')
  rect(g, 18, 18, 2, 2, 'W')
  rect(g, 6, 12, 10, 11, 'W') // torso
  rect(g, 6, 20, 10, 3, 'S')
  rect(g, 11, 14, 4, 5, 'B')
  rect(g, 4, 13, 2, 10, 'W') // arms hanging
  rect(g, 16, 13, 2, 10, 'W')
  dot(g, [[4, 22], [5, 22], [16, 22], [17, 22]], 'S')
  rect(g, 7, 23, 3, 8, 'W') // legs and feet, with a gap between
  rect(g, 12, 23, 3, 8, 'W')
  rect(g, 6, 31, 5, 1, 'W')
  rect(g, 11, 31, 5, 1, 'W')
  drawHead(g, { eyes: 'open', mouth: 'closed', tail: 'a' })
  return { w, h, cells: g, kind: 'stand' }
}

/** walking, seen from the side, facing right (the view flips it for the other direction) */
function side(legs: 'A' | 'B' | 'zoomA' | 'zoomB'): Raw {
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
  if (legs === 'zoomA' || legs === 'zoomB') {
    // flat out: legs reaching far in both directions, then tucked under, with speed lines behind
    if (legs === 'zoomA') {
      rect(g, 19, 14, 6, 2, 'W')
      rect(g, 2, 14, 6, 2, 'W')
    } else {
      rect(g, 10, 14, 3, 3, 'W')
      rect(g, 13, 14, 3, 3, 'S')
    }
    rect(g, 1, 9, 3, 1, 'S')
    rect(g, 1, 11, 2, 1, 'S')
  } else if (legs === 'A') {
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
  groomA: () => front({ eyes: 'closed', mouth: 'closed', tail: 'a', lick: 'A' }),
  groomB: () => front({ eyes: 'closed', mouth: 'closed', tail: 'a', lick: 'B' }),
  zoomA: () => side('zoomA'),
  zoomB: () => side('zoomB'),
  stand,
}

type Paint = [number, number, number, number, string] | [number, number, string] // rect or single pixel

/** outfit pieces per layout, as rectangles [x, y, w, h, colour] or single pixels [x, y, colour] */
/** `stand` is optional: head gear sits on the standing cat exactly as on the sitting one, so it falls back to `front` */
type Pieces = Record<Exclude<Kind, 'stand'>, Paint[]> & { stand?: Paint[] }
type Box = [number, number, number, number] // x, y, w, h
/** where the two ears are in each layout; ear gear is generated from these so every layout stays consistent */
const EARS: Record<Exclude<Kind, 'stand'>, { L: Box; R: Box }> = {
  front: { L: [4, 2, 3, 2], R: [15, 2, 3, 2] },
  side: { L: [19, 2, 2, 3], R: [24, 2, 2, 3] },
  loaf: { L: [18, 3, 2, 3], R: [23, 3, 2, 3] },
  stretch: { L: [20, 8, 2, 3], R: [25, 8, 2, 3] },
  roll: { L: [2, 6, 2, 3], R: [7, 6, 2, 3] },
}
type Ears = { L: Box; R: Box }
const earGear = (f: (e: Ears) => Paint[]): Pieces => ({ front: f(EARS.front), side: f(EARS.side), loaf: f(EARS.loaf), stretch: f(EARS.stretch), roll: f(EARS.roll) })

const OUTFITS: Record<Exclude<Outfit, 'none'>, Pieces> = {
  scarf: {
    front: [[5, 12, 12, 2, 'R'], [14, 14, 2, 3, 'R']],
    side: [[17, 9, 4, 5, 'R']],
    loaf: [[15, 9, 3, 4, 'R']],
    stretch: [[17, 9, 3, 4, 'R']],
    roll: [[8, 9, 2, 6, 'R']],
    stand: [[6, 12, 10, 2, 'R'], [13, 14, 2, 4, 'R']],
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
    stand: [[6, 13, 10, 9, 'F'], [8, 14, 'Y'], [12, 16, 'P'], [9, 19, 'P'], [14, 20, 'Y'], [11, 18, 'Y']],
  },
  krathong: {
    front: [[6, 3, 10, 2, 'L'], [9, 2, 4, 1, 'P'], [10, 1, 2, 1, 'P'], [11, 2, 'Y']],
    side: [[20, 2, 6, 2, 'L'], [22, 1, 2, 1, 'P']],
    loaf: [[18, 4, 7, 2, 'L'], [20, 3, 3, 1, 'P']],
    stretch: [[21, 6, 5, 2, 'L'], [22, 5, 3, 1, 'P']],
    roll: [[3, 5, 5, 2, 'L'], [4, 4, 3, 1, 'P']],
  },
  vest: {
    front: [[5, 13, 12, 5, 'A'], [5, 15, 12, 1, 'Z']],
    side: [[7, 8, 11, 5, 'A'], [7, 10, 11, 1, 'Z']],
    loaf: [[7, 6, 10, 5, 'A'], [7, 8, 10, 1, 'Z']],
    stretch: [[12, 9, 8, 5, 'A'], [12, 11, 8, 1, 'Z']],
    roll: [[9, 8, 10, 6, 'A'], [9, 10, 10, 1, 'Z']],
    stand: [[6, 13, 10, 8, 'A'], [6, 16, 10, 1, 'Z'], [6, 19, 10, 1, 'Z']],
  },
  nightcap: {
    front: [[6, 2, 10, 2, 'N'], [7, 1, 6, 1, 'N'], [5, 4, 12, 1, 'W'], [15, 3, 3, 2, 'N'], [17, 4, 2, 2, 'N'], [18, 6, 2, 2, 'W']],
    side: [[20, 2, 6, 2, 'N'], [19, 4, 8, 1, 'W'], [17, 3, 3, 2, 'N'], [15, 4, 3, 2, 'N'], [13, 5, 2, 2, 'W']],
    loaf: [[18, 3, 8, 2, 'N'], [17, 5, 9, 1, 'W'], [15, 4, 3, 2, 'N'], [13, 5, 2, 2, 'N'], [11, 6, 2, 2, 'W']],
    stretch: [[21, 7, 5, 2, 'N'], [20, 9, 7, 1, 'W'], [18, 8, 3, 2, 'N'], [16, 9, 2, 2, 'W']],
    roll: [[3, 4, 5, 2, 'N'], [2, 6, 7, 1, 'W'], [8, 4, 3, 2, 'N'], [11, 5, 2, 2, 'W']],
  },
  tie: {
    front: [[10, 12, 2, 1, 'I'], [10, 13, 2, 5, 'I'], [10, 18, 'I']],
    side: [[17, 10, 2, 4, 'I']],
    loaf: [[15, 10, 2, 3, 'I']],
    stretch: [[18, 11, 2, 3, 'I']],
    roll: [[9, 10, 2, 3, 'I']],
    stand: [[10, 12, 2, 1, 'I'], [10, 13, 2, 7, 'I'], [10, 20, 'I']],
  },
  medal: {
    front: [[9, 12, 1, 2, 'R'], [12, 12, 1, 2, 'R'], [9, 14, 4, 3, 'Y'], [10, 15, 'W']],
    side: [[17, 11, 1, 2, 'R'], [16, 13, 3, 3, 'Y'], [17, 14, 'W']],
    loaf: [[14, 9, 1, 2, 'R'], [13, 11, 3, 2, 'Y']],
    stretch: [[17, 13, 1, 2, 'R'], [16, 15, 3, 2, 'Y']],
    roll: [[10, 8, 1, 2, 'R'], [10, 10, 3, 3, 'Y'], [11, 11, 'W']],
    stand: [[9, 12, 1, 2, 'R'], [12, 12, 1, 2, 'R'], [9, 14, 4, 3, 'Y'], [10, 15, 'W']],
  },
  ninja: {
    front: [[4, 5, 14, 2, 'H'], [9, 5, 4, 2, 'Z'], [18, 6, 2, 3, 'H'], [19, 9, 1, 2, 'H']],
    side: [[19, 4, 8, 2, 'H'], [22, 4, 2, 2, 'Z'], [16, 5, 3, 1, 'H'], [14, 6, 3, 1, 'H']],
    loaf: [[17, 6, 9, 2, 'H'], [21, 6, 2, 2, 'Z'], [14, 7, 3, 1, 'H'], [12, 8, 3, 1, 'H']],
    stretch: [[20, 10, 7, 2, 'H'], [23, 10, 2, 2, 'Z'], [17, 10, 3, 1, 'H'], [15, 11, 3, 1, 'H']],
    roll: [[2, 8, 7, 2, 'H'], [4, 8, 2, 2, 'Z'], [9, 8, 3, 1, 'H'], [11, 9, 3, 1, 'H']],
  },
  halloween: {
    // a pointed cone (tip, middle, base with a gold buckle) on a wide brim
    front: [[3, 4, 16, 1, 'X'], [11, 1, 2, 1, 'X'], [10, 2, 4, 1, 'X'], [9, 3, 6, 1, 'X'], [11, 3, 2, 1, 'Y']],
    side: [[18, 4, 9, 1, 'X'], [23, 1, 2, 1, 'X'], [22, 2, 4, 1, 'X'], [21, 3, 6, 1, 'X'], [23, 3, 2, 1, 'Y']],
    loaf: [[16, 5, 11, 1, 'X'], [21, 1, 2, 1, 'X'], [20, 2, 4, 1, 'X'], [19, 3, 6, 1, 'X'], [18, 4, 8, 1, 'X'], [21, 4, 2, 1, 'Y']],
    stretch: [[19, 9, 8, 1, 'X'], [22, 5, 2, 1, 'X'], [21, 6, 4, 1, 'X'], [20, 7, 6, 1, 'X'], [19, 8, 8, 1, 'X'], [22, 8, 2, 1, 'Y']],
    roll: [[1, 6, 9, 1, 'X'], [4, 2, 2, 1, 'X'], [3, 3, 4, 1, 'X'], [2, 4, 6, 1, 'X'], [2, 5, 6, 1, 'X'], [4, 5, 2, 1, 'Y']],
  },
  christmas: {
    front: [[6, 2, 10, 3, 'R'], [5, 4, 12, 1, 'W'], [15, 2, 3, 2, 'R'], [17, 3, 2, 3, 'R'], [18, 6, 2, 2, 'W']],
    side: [[20, 2, 6, 2, 'R'], [19, 4, 8, 1, 'W'], [17, 3, 3, 2, 'R'], [15, 4, 3, 2, 'R'], [13, 5, 2, 2, 'W']],
    loaf: [[18, 3, 8, 2, 'R'], [17, 5, 9, 1, 'W'], [15, 4, 3, 2, 'R'], [13, 5, 2, 2, 'W']],
    stretch: [[21, 7, 5, 2, 'R'], [20, 9, 7, 1, 'W'], [18, 8, 3, 2, 'R'], [16, 9, 2, 2, 'W']],
    roll: [[3, 4, 5, 2, 'R'], [2, 6, 7, 1, 'W'], [8, 4, 3, 2, 'R'], [11, 5, 2, 2, 'W']],
  },
  bell: {
    // red collar with a gold bell under the chin
    front: [[5, 12, 12, 1, 'R'], [10, 13, 2, 2, 'Y'], [10, 13, 'W']],
    side: [[18, 8, 2, 5, 'R'], [19, 13, 2, 2, 'Y'], [19, 13, 'W']],
    loaf: [[16, 8, 2, 5, 'R'], [16, 12, 2, 2, 'Y']],
    stretch: [[19, 10, 2, 5, 'R'], [19, 15, 2, 2, 'Y']],
    roll: [[8, 8, 2, 6, 'R'], [8, 14, 2, 2, 'Y']],
    stand: [[6, 12, 10, 1, 'R'], [10, 13, 2, 2, 'Y'], [10, 13, 'W']],
  },
  headphones: {
    front: [[5, 3, 12, 1, 'K'], [4, 4, 1, 2, 'K'], [17, 4, 1, 2, 'K'], [2, 6, 3, 4, 'R'], [17, 6, 3, 4, 'R']],
    side: [[21, 3, 3, 1, 'K'], [22, 4, 1, 2, 'K'], [21, 6, 3, 4, 'R']],
    loaf: [[17, 5, 9, 1, 'K'], [16, 6, 2, 4, 'R'], [25, 6, 2, 4, 'R']],
    stretch: [[19, 9, 8, 1, 'K'], [19, 10, 2, 4, 'R'], [25, 10, 2, 2, 'R']],
    roll: [[1, 5, 9, 1, 'K'], [1, 6, 1, 4, 'K'], [9, 6, 1, 4, 'K'], [1, 9, 2, 3, 'R'], [8, 9, 2, 3, 'R']],
  },
  // a gold star clip on the right ear
  starclip: earGear(({ R: [x, y, w, h] }) => [[x + w - 2, y + h - 2, 2, 2, 'Y'], [x + w - 1, y - 1, 'Y']]),
  // a green tag with a silver clasp hanging from the right ear
  eartag: earGear(({ R: [x, y, w, h] }) => [[x + w - 1, y + h - 1, 'Z'], [x + w - 2, y + h, 2, 2, 'A']]),
  // a plaster across the right ear and onto the head
  earplaster: earGear(({ R: [x, y, w, h] }) => [[x, y + h - 1, w, 2, 'G'], [x + Math.floor(w / 2), y, 1, h + 1, 'G']]),
  // a pink flower tucked behind the left ear
  earflower: earGear(({ L: [x, y, , h] }) => {
    const cx = x + 1
    const cy = y + h - 1
    return [[cx - 1, cy, 3, 1, 'T'], [cx, cy - 1, 1, 3, 'T'], [cx, cy, 'Y']]
  }),
  // fluffy blue muffs over both ears joined by a silver band
  earmuffs: earGear(({ L, R }) => [
    [L[0], L[1] - 1, L[2], L[3] + 1, 'N'],
    [R[0], R[1] - 1, R[2], R[3] + 1, 'N'],
    [L[0] + L[2], L[1] - 1, R[0] - L[0] - L[2], 1, 'Z'],
    [L[0], L[1] - 1, 'W'],
    [R[0], R[1] - 1, 'W'],
  ]),
  // a violet barrette under the left ear
  hairclip: earGear(({ L: [x, y, w, h] }) => [[x, y + h, w, 2, 'V'], [x, y + h, 'Y']]),
  // a gold ring hanging off the left ear
  hoop: earGear(({ L: [x, y, , h] }) => [[x - 1, y + h - 1, 3, 1, 'Y'], [x - 1, y + h, 1, 1, 'Y'], [x + 1, y + h, 1, 1, 'Y'], [x - 1, y + h + 1, 3, 1, 'Y']]),
  // a pink bow on the left ear
  earribbon: earGear(({ L: [x, y] }) => {
    const cx = x + 1
    const cy = y + 1
    return [[cx - 2, cy - 1, 2, 3, 'T'], [cx + 1, cy - 1, 2, 3, 'T'], [cx, cy, 'Y']]
  }),
  // a silver cuff with blue stones on the right ear
  earcuff: earGear(({ R: [x, y, w, h] }) => [[x + w - 2, y, 2, h, 'Z'], [x + w - 1, y, 'C'], [x + w - 1, y + h - 1, 'C']]),
  bowtie: {
    front: [[7, 12, 3, 3, 'I'], [12, 12, 3, 3, 'I'], [10, 13, 2, 1, 'D'], [8, 13, 'C'], [13, 13, 'C']],
    side: [[18, 9, 3, 4, 'I'], [19, 10, 1, 2, 'D'], [18, 9, 'C']],
    loaf: [[15, 8, 3, 4, 'I'], [16, 9, 1, 2, 'D'], [15, 8, 'C']],
    stretch: [[18, 10, 3, 4, 'I'], [19, 11, 1, 2, 'D'], [18, 10, 'C']],
    roll: [[8, 9, 3, 4, 'I'], [9, 10, 1, 2, 'D'], [8, 9, 'C']],
    stand: [[7, 12, 3, 3, 'I'], [12, 12, 3, 3, 'I'], [10, 13, 2, 1, 'D'], [8, 13, 'C'], [13, 13, 'C']],
  },
}

/**
 * Mouth toys. Each is one small picture (fill only: '.' is empty, letters are PALETTE colours); the dark outline
 * around it is added here so it stays readable on top of the face, and `toyAnchor` decides where it goes in each
 * layout. A toy id with no picture here is "not drawn yet": it still unlocks and counts, but `hasToyArt` is false
 * and the wardrobe will not let it be worn.
 */
const TOY_ICONS: Partial<Record<Exclude<Toy, 'notoy'>, string[]>> = {
  mackerel: ['Z..CCZ..', 'ZZCCCZEC', 'ZZCCCZCC', 'Z..CCZ..'],
  mouse: ['..Y..PP.', '.SSSSSSS', 'KSSSSSSE', '..S..S..'],
  pompom: ['.PVP.', 'PVPVP', 'VPVPV', 'PVPVP', '.PVP.'],
  feather: ['.....RYY.', 'KKKKKRRYY', '.....RYY.'],
  can: ['ZZZZK', 'CCYCC', 'CYYYC', 'CCYCC', 'ZZZZZ'],
  key: ['.YY.....', 'Y.YYYYYY', '.YY..Y.Y'],
  receipt: ['RPPPR', 'RPPPR', '.PRP.', '.PPP.', '.PRP.', '.PPP.', '.PRP.'], // pink carbon-copy form, so it shows up on white fur
  yarn: ['.RRR...', 'RRPRR..', 'RPRPR..', 'RRPRRRR', '.RRR...'],
  fishbone: ['.Z.Z.Z.Z.', 'ZZZZZZZZZ', '.Z.Z.Z.Z.'],
  magnifier: ['.ZZZ..', 'ZCCCZ.', 'ZCCCZ.', 'ZCCCZ.', '.ZZZB.', '.....B'],
  catnip: ['.L...L.', 'LLL.LLL', '.LLALL.', '..LLL..', '...K...'],
  treat: ['.PPPPPP.', 'RPYPYPPW', '.PPPPPP.'],
  pencil: ['PZYYYYYYB.', 'PZYYYYYYBK', 'PZYYYYYYB.'],
}
export const hasToyArt = (toy: string): boolean => toy in TOY_ICONS

/** the icon with its own 1px dark outline, so it separates from the fur underneath */
function outlinedIcon(rows: string[]): string[][] {
  const g = blank(rows[0].length + 2, rows.length + 2)
  rows.forEach((r, y) => [...r].forEach((c, x) => c !== '.' && (g[y + 1][x + 1] = c)))
  return outline(g)
}

/** top-left corner of a w×h icon: hanging from the mouth when facing the camera or sideways, resting beside or on the cat when it lies down */
function toyAnchor(kind: Kind, w: number, h: number): [number, number] {
  switch (kind) {
    case 'front':
    case 'stand':
      return [11 - Math.floor(w / 2), 11] // centred under the nose, over the chin and chest
    case 'side':
      return [27 - w, 9] // at the mouth, hanging down in front of the chest
    case 'loaf':
      return [17 - w, 15 - h] // tucked against the chest, so the closed eyes stay visible
    case 'stretch':
      return [20 - w, 19 - h] // on the ground between the paws
    case 'roll':
      return [9, 17 - h] // on its belly, held in its paws
  }
}

function paintToy(raw: Raw, rows: string[]): void {
  const icon = outlinedIcon(rows)
  const [h, w] = [icon.length, icon[0].length]
  let [x0, y0] = toyAnchor(raw.kind, w, h)
  // never touch the border ring of the grid (the sprite outline lives there)
  x0 = Math.min(Math.max(x0, 1), raw.w - 1 - w)
  y0 = Math.min(Math.max(y0, 1), raw.h - 1 - h)
  icon.forEach((r, y) => r.forEach((c, x) => c && (raw.cells[y0 + y][x0 + x] = c)))
}

function paint(raw: Raw, pieces: Pieces): void {
  const list = raw.kind === 'stand' ? (pieces.stand ?? pieces.front) : pieces[raw.kind]
  for (const piece of list) {
    if (piece.length === 5) rect(raw.cells, piece[0], piece[1], piece[2], piece[3], piece[4])
    else rect(raw.cells, piece[0], piece[1], 1, 1, piece[2])
  }
}

function dress(raw: Raw, outfit: Outfit, toy: Toy): void {
  if (outfit !== 'none') paint(raw, OUTFITS[outfit])
  const rows = toy === 'notoy' ? undefined : TOY_ICONS[toy]
  if (rows) paintToy(raw, rows) // after the outfit: the toy is in front of the scarf
}

const cache = new Map<string, Sprite>()
export function buildSprite(pose: Pose, outfit: Outfit = 'none', toy: Toy = 'notoy'): Sprite {
  const key = `${pose}|${outfit}|${toy}`
  let sp = cache.get(key)
  if (!sp) {
    const raw = BUILDERS[pose]()
    dress(raw, outfit, toy)
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
