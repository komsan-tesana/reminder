---
name: buddy
description: Work on เปี๊ยก (Buddy), the pixel cat in this app. Use when adding or changing anything about it - new unlockable items (skins, outfits, moves), new animations/poses/states, unlock rules and stats, special days/festivals, jokes and messages, the paw button/wardrobe dialog, or its sound. Holds a map of the code, step-by-step checklists with exact coordinates, and how to verify, so you do not have to re-read the sprite and unlock files.
---

# Buddy (เปี๊ยก) skill

The cat is a quiet pixel-art pet fixed to the bottom edge of the app. **Read this file, then only the one reference for your task. Do not read whole source files**: `buddySprite.ts` is ~500 lines; grep for the symbol you need (`grep -n "OUTFITS\|BUILDERS" src/lib/buddySprite.ts`) and read ±30 lines.

## Pick your task

| I need to… | Read | Files you will touch |
|---|---|---|
| add a **skin** (fur colour), **outfit**, **mouth toy**, or an unlock for an existing pose | `references/add-item.md` | `buddySprite.ts`, `buddyUnlocks.ts`, tests |
| add an **animation / pose / move / state** (new drawing, new behaviour) | `references/add-animation.md` | `buddySprite.ts`, `buddy.ts`, `Buddy.tsx`, `BuddyModal.tsx`, CSS, tests |
| add a **stat** (incl. one read from the app's data), change an **unlock rule**, add a **special day** | `references/add-item.md` §E, §F | `buddyUnlocks.ts`, `buddyData.ts`, `db.ts`, `App.tsx`, `buddy.ts` |
| add / change **jokes, messages, milestones** | `references/architecture.md` §Messages | `buddy.ts`, `buddy.test.ts` |
| understand how it all fits, or add a **new feature** | `references/architecture.md` | – |
| choose how **hard** an unlock is (**ง่าย / ปานกลาง / ยาก / ยากมาก**), set its threshold, check the balance | `references/difficulty.md` | `buddyUnlocks.ts` (numbers and hint) |
| check it works (gallery, simulate progress, force states) | `references/verify.md` | – |

## Ground rules (they save debugging time)

1. **Logic is pure and tested**: `src/lib/buddy.ts` (behaviour, lines), `buddyUnlocks.ts` (items, stats), `buddySprite.ts` (art). `Buddy.tsx` only drives them. Put new rules in the lib file, not in a component, and add a vitest test next to it.
2. **Every item is one entry in `ITEMS`** (`buddyUnlocks.ts`). The wardrobe, unlock toasts, the paw dot, `safeLook` and the gold cat's requirement all derive from it. Do not hand-edit those.
3. **Art is code**: a pose paints rectangles on a grid; the 1px outline is traced automatically. Tests assert every pose × outfit fits the grid and differs from the bare pose, so a bad coordinate fails loudly.
4. **Unlocked is permanent** (`stats.earned`). Raising a threshold never takes an item away; do not "fix" that.
5. **Nothing leaves the device**: stats are in `localStorage` `reminder.buddy.v1`; the cat's work jokes use numbers computed in `App.tsx` and are never sent anywhere. Keep it that way.
6. **Quiet by default**: visible, silent, rare bubbles, `pointer-events: none` wrapper, respects `prefers-reduced-motion`. New behaviour must keep that.
7. **Every item has a difficulty tier** (ง่าย / ปานกลาง / ยาก / ยากมาก) chosen *before* the number, from `references/difficulty.md`; update its registry in the same change.
8. Existing tests count items (`has the planned number of items` in `buddyUnlocks.test.ts`) and list every pose/outfit (`POSES`, `OUTFITS` in `buddy.test.ts`). Update those lists when you add something - that is the intended checklist.

## Standard loop (cheap)

1. Read the one reference above.
2. Make the edits (the references list them in order).
3. `npx tsc -b && npx vitest run src/lib/buddy` (fast, catches coordinates and missing entries).
4. Look at the art once with the gallery snippet in `references/verify.md` (needs the dev server on :5173; the Browser pane tool).
5. Full `npx vitest run`, update the Buddy bullet in `CLAUDE.md` if behaviour changed, then clean the test data you put in the browser (`verify.md` §Cleanup).
6. Commit / release only when asked: `npm run deploy` (patch) or `npm run deploy:minor` for new features; the user usually says "commit this, deploy".

## Facts about the user's preferences seen so far
- Four difficulty levels: ง่าย, ปานกลาง, ยาก, ยากมาก (see `references/difficulty.md`); poke-based unlocks are in the thousands.
- Thai UI text, short and playful; the cat's name is เปี๊ยก; unlock conditions for big rewards should be **hard** (thousands of pokes, weeks of use) but earned by normal use, with poke-counting capped per day.
- Art is original pixel art in the style of cat-meme sprites; never copy an existing meme sprite.
- They like to see a numbered list of items/conditions **before** art is drawn.
