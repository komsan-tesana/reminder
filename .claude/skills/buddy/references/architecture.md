# Buddy architecture (map, not a tutorial)

## Files

| File | Role | Size |
|---|---|---|
| `src/lib/buddySprite.ts` | Pixel art: `Pose`/`Outfit`/`Toy`/`Skin` types, `PALETTE`, `SKINS`, pose builders, `OUTFITS`, `TOY_ICONS` + `toyAnchor`, `buildSprite(pose, outfit, toy)`, `spritePaths(sprite, skin)` | ~600 |
| `src/lib/buddy.ts` | Behaviour + words: `BuddyState`, `periodOf`, `WEIGHTS`, `nextState`, `durationMs`, `LINES`/`SEASON_LINES`/`WEEKDAY_LINES`, `seasonOf`, `pickLine`, `clickReply`, `isFlurry`, `WorkCtx` | ~210 |
| `src/lib/buddyUnlocks.ts` | Stats + catalogue: `BuddyStats`, `record*` functions, `ITEMS`, `isUnlocked`, `withEarned`, `grandfather`, `safeLook`, `unlockedIds`, `unseenCount`, `DAILY_POKE_CAP` | ~230 |
| `src/lib/buddyData.ts` | Pure facts read from the app's data for unlocks: `dataFacts` (distinct customers / SO / busiest day / months), `countAssigned`, `filterUseKind`; only numbers leave it | ~50 |
| `src/lib/db.ts` | `BuddySettings` + `DEFAULT_SETTINGS.buddy`, `loadSettings` merge, `loadBuddyStats` (validates every field) / `saveBuddyStats` | (part) |
| `src/lib/sound.ts` | `playMeow()` (Web Audio synth) | (part) |
| `src/components/Buddy.tsx` | The cat on screen: timers, walking, frame ticker, bubble, poke handler | ~190 |
| `src/components/PixelCat.tsx` | One pose as SVG (`pose`, `outfit`, `skin`, `scale`); shared by `Buddy` and the wardrobe | 21 |
| `src/components/BuddyModal.tsx` | The cat's dialog: show/sound switches + wardrobe tiles (generated from `ITEMS`) | ~130 |
| `src/components/PawIcon.tsx` | SVG paw icon of the top-bar button | 12 |
| `src/App.tsx` | Wiring (search for `bump`, `buddyCtx`, `look`, `moves`, `unseen`) | (part) |
| `src/styles.css` | `.buddy*` classes and keyframes (search `buddy-`) | (part) |
| tests | `src/lib/buddy.test.ts` (behaviour, lines, sprites, settings), `src/lib/buddyUnlocks.test.ts` (stats, items, storage) | |

## Data flow

```
App.tsx
  stats (BuddyStats, state+ref) ──bump(fn)──> withEarned(fn(prev)) → save to localStorage 'reminder.buddy.v1'
                                               └─ newlyUnlocked(prev,next) → toast "🎉 เปี๊ยกปลดล็อก: …"
  settings.buddy {visible, sound, skin, outfit, toy}  (localStorage 'reminder.settings.v1')
  look  = safeLook(skin, outfit, toy, stats)  (falls back to calico/none/notoy if not unlocked; a toy without art is never worn)
  moves = unlockedIds('move', stats)          (passed to nextState as the allowed list)
  buddyCtx = {today, unassigned, tomorrow, pending}   (computed from shipments/reminders; for jokes only)
  unseen = unseenCount(stats)                 (dot on the paw button)
        │
        ▼
<Buddy sound ctx pets capped skin outfit toy moves onPet onHide />
  state machine: go(want) → setState + one setTimeout → go(nextState(...))
  render: <PixelCat pose={poseOf(state, frame)} outfit skin scale=3 />
```

Events that call `bump` in `App.tsx`: data facts after load and whenever the shipments change (`recordData`, highest-ever counters), edit dialog saved (`recordEdit(rows, assigned)`), file exported (`recordExport`, a .json export is a backup, once per day), filter bar used (`recordFilterUse`: a dropdown pick at once, a search of ≥2 characters after 1 s without typing, ≤30 a day), import finished (`recordImport(added)`, `added` = rows not in the app before), visit (on mount and when the tab becomes visible), poke (`recordPet`, plus `recordWake` if it was asleep; a scared flurry is not counted), reminder ticked done, import done, "perfect day" effect (`recordPerfect` when today has work and `unassigned === 0`), wardrobe opened (`markSeen`).

## Behaviour (buddy.ts)

- `BuddyState`: `sit walk yawn sleep play happy` (always available), `stretch roll tail groom zoom stand` (= `LOCKABLE_MOVES`, only chosen when passed in `allowed`), `shout` (easter egg: 5 pokes in 3 s, never chosen randomly).
- `WEIGHTS[period][state]`: relative chance of the next state; `nextState` zeroes the current state (except a sleep can continue, weaker), zeroes locked moves, a yawn in a sleepy period becomes a nap 70% of the time, waking from sleep favours a yawn.
- Periods (`periodOf`): `latenight` <5, `morning` <11, `noon` <14, `afternoon` <18, `evening` <22, `night`.
- `durationMs(state)`: how long each lasts (walk/zoom are really timed by distance in `Buddy.tsx`: `SPEED` 46 px/s, `ZOOM_SPEED` 170).
- `Buddy.tsx` extras: frame ticker only for `walk(240ms) play(380) tail(300) groom(360) zoom(130)`; `walk`/`zoom` flip the sprite when heading left; reduced-motion turns walk/play/tail/groom/zoom into `sit`; timers pause while the tab is hidden; idle bubble every 90–200 s, never while a `[role=dialog]` is open; bubble auto-hides after 6.5 s; the ✕ on the bubble hides the cat.

## Messages (buddy.ts)

- `LINES[period]` jokes by hour; `workLines(ctx)` jokes with real numbers; `occasionLines(date)` = `SEASON_LINES` + `WEEKDAY_LINES`; `pickLine(period, ctx, last, rnd, now?)` never repeats `last`.
- Poke replies: `POKED`, `WOKEN` (sleeping), `SHOUTS` (flurry), `CAPPED` (daily quota used up; the text says 200, keep it equal to `DAILY_POKE_CAP`), `MILESTONES` keyed by counted pokes (1,000 / 5,000 / 10,000; only for counted pokes).
- All text is Thai, short, playful. Add lines to the arrays; the tests only require non-empty and no immediate repeat.

## Stats and items (buddyUnlocks.ts)

- `BuddyStats` fields: `pets, petsToday{day,n}, days[last 120], totalDays, bestStreak, remindersDone, imports, nightOwl, nightVisits, lastNight, perfectDays, lastPerfect, wakes, rowsImported, maxCustomers, maxSOs, maxDayRows, maxMonths, exports, backupDays, lastBackup, assigned, edits, filterUses, filterToday{day,n}, seasons[], earned[], seen[]`. `DEFAULT_STATS` and the loader in `db.ts` must list every field.
- Pokes count at most `DAILY_POKE_CAP` (200) a day, so "N thousand pokes" means days of use.
- `Item = {id, kind:'skin'|'outfit'|'toy'|'move', name, hint, progress(stats, now) → {done,total}, seasonal?}`. Unlocked = in `earned` or progress complete. `seasonal` items (festival outfits) do not count toward the gold cat's requirement.
- Ids are shared names: a skin id is a `Skin`, an outfit id is an `Outfit`, a toy id is a `Toy` (the default is `notoy`, not `none`, so ids stay unique), a move id is a `BuddyState` (`stretch roll tail groom zoom stand`) - except `none`/`calico` defaults.
- Festivals (`seasonOf` in buddy.ts): songkran 13–15 Apr, newyear 30 Dec–2 Jan, krathong all November (open the app), halloween 31 Oct and christmas 24–25 Dec (**must also poke the cat that day**; see `POKE_SEASONS`).

## Storage

- `reminder.settings.v1` → `settings.buddy` (`loadSettings` fills missing keys, so adding a key to `BuddySettings` needs a default in `DEFAULT_SETTINGS.buddy` and nothing else).
- `reminder.buddy.v1` → `BuddyStats`. A record without an `earned` array is an older save: `grandfather()` keeps what the old thresholds gave (`LEGACY_POKES`). Unknown item ids are dropped on load.

## UI facts

- Wrapper `.buddy` is `position: fixed`, `pointer-events: none`, 84×60 px box (`BOX = 28*SCALE`); the sprite is centred in it, taller sprites grow upward. `.buddy-btn` and `.buddy-bubble` take clicks. State class `buddy-<state>` lets CSS animate (`buddy-sit/yawn/sleep` breathe, `buddy-stand` sways, `buddy-shout` shakes); `z`/heart effects are `.buddy-fx` spans for `sleep` and `happy|roll`.
- The cat is not rendered while the phone bottom sheet is open (`!sheetOpen` in `App.tsx`).
- The wardrobe tiles come straight from `ITEMS`; moves need an entry in `MOVE_POSE` (BuddyModal.tsx) for their thumbnail. Radix `Dialog`/`Checkbox` components are the app's own (`Modal`, `Checkbox`).
- Top-bar button: `PawIcon` + dot while `unseen > 0`; it replaced the settings-dialog section.
