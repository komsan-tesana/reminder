# Add or change items, stats, special days

One item = one entry in `ITEMS` (`src/lib/buddyUnlocks.ts`). The wardrobe tile, the progress bar, the unlock toast, the paw dot and the saved-look safety net all come from that entry. Everything else below is only the art or the counter behind it.

```ts
{ id, kind: 'skin'|'outfit'|'move', name /*Thai*/, hint /*Thai: how to get it*/,
  progress: (s, now) => count(s.someStat, N) /* or flag(bool) */, seasonal?: true }
```
Helpers in that file: `count(done,total)`, `flag(bool)`, `fmt(n)` (thousands commas), `cap` (the text "(นับวันละไม่เกิน 200 ครั้ง)" for poke items), `streak(days, now)`.

## A. New skin (fur colour)

1. `buddySprite.ts`: add the id to `type Skin`; add `SKINS[id] = { W, S, B, ... }` (fur, shaded fur, patch). Dark fur also needs `E` (light eyes, e.g. `'#f6e27a'`) and `O` (darker outline) - copy `black`/`tuxedo`. Only palette letters change; the shapes are shared.
2. `buddyUnlocks.ts`: add the `ITEMS` entry (`kind: 'skin'`, id = the Skin id) in the "fur colours" group.
3. Tests: `buddyUnlocks.test.ts` → `has the planned number of items` (`[skins, outfits, moves]`) and, for a hard condition, a row in `unlocks the hard items at their thresholds`. The skin test in `buddy.test.ts` iterates `Object.keys(SKINS)` and demands distinct colours.
4. The gold cat's requirement grows by itself (it counts every non-seasonal item except itself).

## B. New outfit

1. `buddySprite.ts`: add the id to `type Outfit`. New colours = new **single-letter keys** in `PALETTE` (taken: `O W S B P E T M U R C D Y K F L V A Z N I H X`; free e.g. `G J Q`).
2. `OUTFITS[id]` needs the five layouts `front side loaf stretch roll`, optional `stand`:
   - a piece is `[x, y, w, h, 'C']` (rect) or `[x, y, 'C']` (one pixel); the list is painted in order, after the body.
   - head gear: give the five layouts; the standing cat falls back to `front` (same head). Body pieces (scarf, vest, tie, medal, shirt): also give `stand`.
   - anchors for every layout are in `add-animation.md` §Anchors. Keep every pixel off the grid border and head gear at `y >= 1` (row 0 is the outline).
3. `ITEMS` entry (`kind: 'outfit'`, id = the Outfit id; `seasonal: true` if tied to a date).
4. Tests: add the id to the `OUTFITS` array in `buddy.test.ts` (the sprite test then checks all 19 poses × the outfit change the sprite and stay inside the grid), the item count, a threshold row.
5. Look at it: `verify.md` gallery (sit, walkA, sleep, stand are the quick four).

## B2. New mouth toy (its own slot, worn together with an outfit)

Toys are carried in the mouth. They are a separate slot (`settings.buddy.toy`, `ItemKind 'toy'`, wardrobe section "ของเล่นในปาก"), so a toy and an outfit can be worn together.

1. `buddySprite.ts`: add the id to `type Toy`, then **one small picture** in `TOY_ICONS[id]`: an array of equal-length strings, `'.'` = empty, letters = `PALETTE` colours, fill only (about 5–9 px wide, 3–7 tall). The code adds a 1px dark outline around the icon (so it separates from the fur), places it per layout with `toyAnchor` (front/stand: centred under the nose; side: at the mouth, hanging down; loaf: tucked against the chest so the closed eyes stay visible; stretch: on the ground between the paws; roll: on the belly) and clamps it inside the grid. You never write per-layout coordinates. Painted after the outfit, so it is in front of a scarf.
   - Pick colours that stand out from white fur (a plain white toy disappears; the receipt is pink for that reason, the fishbone silver).
   - A toy id **without** an entry in `TOY_ICONS` is "not drawn yet": it still unlocks and counts, but `hasToyArt` is false, so it is not announced, not flagged on the paw button, and the wardrobe says "กำลังวาดภาพ" and refuses to equip it (`isShown` in `buddyUnlocks.ts`). Useful for adding an item before its picture exists.
2. `ITEMS` entry `kind: 'toy'`, id = the Toy id, condition reading a stat (§E; the ten existing toys read data counters).
3. Tests: add the id to the `TOYS` list in `buddy.test.ts` (the invariant test: changes every pose and fits the grid **iff** `hasToyArt`), the item count in `buddyUnlocks.test.ts` (`[6, 18, 6, 14]` = skins, outfits, moves, toys incl. "no toy") and a threshold row.
4. The gold cat counts toys too (everything non-seasonal), so adding a toy makes it harder to get.
5. Look at it with the gallery in `verify.md` (loop `poses = ['sit','walkA','sleep','stretch','roll','stand']`, scale 5 for the readable view).

## C. New move (behaviour the cat does by itself)

It needs a pose and a state first: see `add-animation.md`. Then the `ITEMS` entry is `kind: 'move'` and its **id must equal the `BuddyState` name**; add the id to `MOVE_POSE` in `BuddyModal.tsx` for its thumbnail.

## D. Change a threshold or hint

Edit the number in `count(s.x, N)` and the text in `hint` (poke items use `fmt(N)` and `cap`). Nothing else: earned items stay earned, progress bars follow. Update the matching test row. For poke items remember the daily cap: N pokes take at least `ceil(N/200)` days.

## E. New stat (a counter that an unlock reads)

1. `BuddyStats` + `DEFAULT_STATS` in `buddyUnlocks.ts`.
2. `db.ts` → `loadBuddyStats`: add the field with the local helpers (`count(raw.x)` for numbers, `day(raw.x)` for a yyyy-mm-dd string, `ids(...)` for item ids). A missing field must load as the default, never throw.
3. A pure `recordX(stats[, now])` in `buddyUnlocks.ts` that returns **the same object** when nothing changes (`bump()` in App compares with `===` to skip saving and toasts). Counters that must outlive `days` (kept to 120) are separate numbers, like `totalDays`.
4. Call it from the event: in `App.tsx` search `bump(` and add `bump(recordX)` where it happens (a click handler or an effect keyed on the data). **Counters read from the app's data**: put the pure computation in `buddyData.ts` (return numbers only, never names or SO numbers), keep a "highest seen" counter (`recordData`) so deleting data never lowers progress, and guard against farming (count only rows that were new, count a backup once per day, cap per-day counters like `filterToday`).
5. Tests: `round-trips a full record` in `buddyUnlocks.test.ts` must contain the new field (TypeScript fails otherwise), plus a test of `recordX`.

## F. New special day (festival item)

1. `buddy.ts`: add to `type Season`, add a branch to `seasonOf` (windows must not overlap), add `SEASON_LINES[season]` (the Record requires it).
2. `db.ts` → `loadBuddyStats`: add it to the `seasons` whitelist array or it is dropped on load.
3. Only opening the app counts by default (`recordVisit`). If the user must also poke the cat that day (harder), add it to `POKE_SEASONS` in `buddyUnlocks.ts`.
4. Outfit item with `seasonal: true` and `progress: (s) => flag(s.seasons.includes('x'))`.
5. Tests: `seasonOf` cases in `buddy.test.ts` (day inside, day before/after), `recordVisit`/`recordPet` case in `buddyUnlocks.test.ts`.
6. Do not guess dates of lunar festivals (Loy Krathong, Chinese New Year change yearly); use a month window or a table you can cite.

## Difficulty

Choose a tier (ง่าย / ปานกลาง / ยาก / ยากมาก) first, then the number, using the tables and rules in `difficulty.md`; that file also holds the registry of every item's tier, which you update with each change.
