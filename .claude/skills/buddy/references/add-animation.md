# Add or change animations, poses, states, art

## 1. Anchors and sizes (use these instead of re-reading the sprite file)

Grids are `w × h` pixels, painted on, then outlined (1px, 4-neighbour). On screen 1 pixel = 3 px (`SCALE`).

| Kind | Used by poses | Size | Head | Body / other anchors |
|---|---|---|---|---|
| `front` | sit blink yawn happy playA/B tailA/B shout groomA/B | 22×22 | x3–18, y4–11; ears y2–3 (left x4–6, right x15–17); eyes y7–8 at x7–8 and x13–14; nose y9 x10–11; mouth y10–11 | body x5–16 y12–19; feet y20; tail right x16–20 |
| `stand` | stand | 22×34 | **same head as front** (`drawHead`) | torso x6–15 y12–22; arms x4–5 and x16–17 y13–22; legs x7–9 and x12–14 y23–30; feet y31 |
| `side` (faces right) | walkA/B zoomA/B | 28×20 | x19–26 y2–11; ears x19–20 and x24–25 y2–4; eye (24,7–8); nose (26,9) | body x5–19 y7–13; tail x3–5 y1–8; legs from y14 |
| `loaf` | sleep | 28×16 | x17–25 y6–12; ears y3–5 | body x4–21 y4–12 |
| `stretch` | stretch | 28×20 | x20–26 y10–15; ears y8–10 | hind x5–12 y6–13; front x12–19 y9–14; paws x17–24 y15–16 |
| `roll` | roll | 28×18 | x2–8 y8–14 (upside down); ears y6–8 | body x7–20 y6–14; paws up y2–6 |

Palette letters (`PALETTE`): `O` outline · `W` fur · `S` shaded fur · `B` patch · `P` pink · `E` eyes · `T` tongue · `M` mouth · `U` tears · `R` red · `C`/`D` cap/brim · `Y` gold · `K` shades · `F` teal shirt · `L` leaf · `V` violet · `A` vest green · `Z` silver · `N` night-cap blue · `I` tie navy · `H` ninja navy · `X` witch purple. `W S B E O` are overridden per skin (`SKINS`), so use them for fur/eyes/outline, other letters for clothes.

## 2. Rules that cost time when forgotten

- **Never paint on the border cells** (x=0, y=0, last column/row): the outline needs that ring. Tests fail with "expected false to be true" on the edge check; the offender is the pose/outfit named in the loop.
- **A 1-pixel gap between two parts fills with outline** (striped legs). Leave ≥2px or make parts adjacent.
- Later `rect` overwrites earlier ones: body → tail → arms/legs → head → face → accessories.
- Head gear is limited to rows y ≥ 1 above the head (front ears start y2). Taller hats need a taller grid, which shifts every outfit for that kind.
- Make shapes readable at 3× (a 22 px cat is 66 px wide). Prefer 2-wide limbs, 2×2 eyes (`E`) with a `W` shine, pink nose.
- Original art only; never copy an existing meme sprite.

## 3. New pose in an existing layout

1. `buddySprite.ts`: add to `type Pose`; add to `BUILDERS` a function returning `Raw` (`{w,h,cells,kind}`):
   - `front({eyes:'open'|'blink'|'happy'|'closed', mouth:'closed'|'open'|'smile'|'shout', tail:'a'|'b'|'chaseL'|'chaseR', paw?, look?, tears?, lick?})` covers most front poses; for something new add an option and draw it in `front()`/`drawHead()`.
   - `side('A'|'B'|'zoomA'|'zoomB')` for legs, `loaf()`, `stretch()`, `roll()`, `stand()`.
2. Two-frame animations are pose pairs `xxxA`/`xxxB`; the ticker in `Buddy.tsx` flips between them.
3. Outfits need nothing for an existing kind - they are drawn by `dress()` for that kind automatically.
4. `buddy.test.ts`: add the pose to `POSES` (the sprite tests run every pose × every outfit) and a "differs" assertion if it is a pair.

## 4. New layout (Kind)

Add to `type Kind`; the builder returns `kind: 'newkind'`; add the new kind to `Pieces` and to **every** entry of `OUTFITS`. Shortcut used for `stand`: make the kind optional in `Pieces` and fall back to `front` in `dress()` when the head is the same.

## 5. New behaviour state (what it does on screen)

1. `buddy.ts`: add to `type BuddyState`; if it is unlockable add to `LOCKABLE_MOVES`; add it to **all six** periods in `WEIGHTS` (the Record demands it; `0` = never, higher = more often, compare with neighbours) and to the exhaustive `switch` in `durationMs`.
2. `Buddy.tsx`: `poseOf(state, frame)` (frame pair or single pose), the interval table `{walk:240, tail:300, groom:360, zoom:130, play:380}` and the `if (state !== …) return` guard above it if it is a 2-frame animation, the list of states that move (`next === 'walk' || next === 'zoom'`) if it travels, the reduced-motion list in `go()` (states that need motion become `sit`), the flip rule in the JSX (`state === 'walk' || state === 'zoom'`), and the `.buddy-fx` spans if it has particles.
3. `BuddyModal.tsx`: `MOVE_POSE[id]` for the wardrobe thumbnail.
4. `styles.css`: `.buddy-<state> svg { … }` plus a `@keyframes` for a CSS-only effect (breathe/sway/shake exist). The `prefers-reduced-motion` block already disables every `.buddy *` animation.
5. `ITEMS` entry with `kind: 'move'` and `id === state name` (see `add-item.md` §C).
6. `buddy.test.ts`: add to `STATES`, add to the locked-move test (`expect(seen([]).has(m)).toBe(false)` loop) and a weight test when the state is time-of-day specific (see `does the zoomies mostly at night`).

## 6. Other quick changes

- **Speed / timing**: `SPEED`, `ZOOM_SPEED` (px/s) and the `durationMs` ranges.
- **Scale**: `SCALE` and `BOX` in `Buddy.tsx` (BOX = widest sprite × SCALE).
- **Sound**: `playMeow()` in `sound.ts`; the poke handler calls it only when `settings.buddy.sound`.
- **Particles** (z, heart): `.buddy-fx`, `.buddy-z`, `.buddy-heart` in `styles.css` and the two conditional spans in `Buddy.tsx`.
