# Verify (cheap and repeatable)

## Commands
```bash
npx tsc -b                       # types: catches missing Record keys (Pose/Outfit/State/Season) fast
npx vitest run src/lib/buddy     # the two buddy test files, <1 s
npx vitest run                   # everything, before telling the user it is done
```
The dev server is `.claude/launch.json` → `dev` on :5173 (start it with the preview tool; do not run `npm run dev` in Bash). After installing a package, stop the server, `rm -rf node_modules/.vite`, start again, or the page goes blank with "Invalid hook call".

## Look at the art (Browser pane tool, javascript_exec)

Paste, change the lists, take a screenshot/zoom, then remove the div. Works because Vite serves the modules.

```js
const m = await import('/src/lib/buddySprite.ts');
const wrap = document.createElement('div'); wrap.id = 'gallery';
wrap.style.cssText = 'position:fixed;inset:0;z-index:9999;background:#cfe9d4;display:flex;flex-wrap:wrap;gap:8px;padding:8px;align-content:flex-start;font:10px sans-serif';
const add = (pose, outfit = 'none', skin = 'calico', label = pose, scale = 4) => {
  const s = m.buildSprite(pose, outfit); const d = document.createElement('div');
  d.innerHTML = `<svg width="${s.w*scale}" height="${s.h*scale}" viewBox="0 0 ${s.w} ${s.h}" shape-rendering="crispEdges">${m.spritePaths(s, skin).map(x => `<path d="${x.d}" fill="${x.color}"/>`).join('')}</svg><div>${label}</div>`;
  wrap.appendChild(d);
};
for (const p of ['sit','walkA','sleep','stand']) add(p, 'ninja', 'orange', p + '+ninja');   // edit me; add(pose, outfit, skin, label, scale). For toys pass the toy as the 3rd arg of buildSprite(pose, outfit, toy) in `add` and scale 5
document.body.appendChild(wrap);
// later: document.getElementById('gallery').remove()
```
Zoom with `computer{action:'zoom', region:[0,0,800,230]}` for detail. Check: shape reads as a cat, nothing clipped, no striped gaps, dark skins keep visible eyes.

ASCII alternative with no browser (write a throwaway `src/lib/_x.test.ts`, delete after): print `buildSprite(pose).cells.map(r => r.map(c => c || '.').join('')).join('\n')` to a file under the scratchpad directory with `writeFileSync` and read that file (`console.log` from a test did not show up in this environment).

## Simulate progress

State lives in `localStorage` (the keys are `reminder.buddy.v1` and `reminder.settings.v1`). Set it, reload, open the paw button (top bar).

```js
localStorage.setItem('reminder.buddy.v1', JSON.stringify({
  pets: 12000, days: [], totalDays: 40, bestStreak: 31, remindersDone: 120, imports: 35, nightOwl: true,
  nightVisits: 12, perfectDays: 15, wakes: 300, seasons: ['songkran','newyear','krathong','halloween','christmas'],
  earned: [], seen: ['calico','none'] }));
location.reload();
```
- `earned: []` (an array) skips the "old save" migration, so the app computes unlocks from the numbers and toasts/dots appear. Omit `earned` entirely to test the upgrade path (`grandfather`).
- Equip something: `s = JSON.parse(localStorage['reminder.settings.v1']); s.buddy = {visible:true, sound:false, skin:'black', outfit:'ninja'}`. It falls back to calico/none if not unlocked.

## Force behaviour

- Make unlocked states likely quickly: `Math.random = () => 0.86 + 0.139 * orig()` biases `nextState` toward the **last** entries of the weight list (groom, zoom, stand). Sample with `setInterval(() => seen.add(document.querySelector('.buddy-btn').className.replace('buddy-btn buddy-','')), 200)`. A javascript_exec call times out at 45 s; start the sampler in one call and read the set in the next.
- Scared easter egg: click `.buddy-btn` 5 times within 3 s (`el.click()` is fine for the cat's own button).
- Daily cap and thresholds are covered by unit tests; do not click 200 times.

## Gotchas when testing in the Browser pane

- FullCalendar's `dateClick` ignores synthetic `.click()`; use a real click (computer tool) to open a day. The cat's own buttons accept `.click()`.
- Radix `Select` items ignore a first instant click; click twice or use the keyboard.
- Phone layout: `resize_window` 390×800, reload, test, then `preset: 'desktop'`. The cat hides while the bottom sheet is open.
- Real audio cannot be checked; `await (await import('/src/lib/sound.ts')).playMeow(0.0001)` returning `true` only proves it did not throw.

## Cleanup (always)

```js
document.getElementById('gallery')?.remove();
localStorage.removeItem('reminder.buddy.v1');
const s = JSON.parse(localStorage.getItem('reminder.settings.v1')); s.buddy = {visible:true, sound:false, skin:'calico', outfit:'none'};
localStorage.setItem('reminder.settings.v1', JSON.stringify(s));
```
Reset `Math.random` by reloading the page. Then `git status` should list only intended files.

## When done

Update the "Buddy" bullet in `CLAUDE.md` if behaviour, files or rules changed (keep it one bullet). Release only when asked: `npm run deploy` (patch) / `npm run deploy:minor` after a commit.
