# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A static, browser-only React app (Vite + TypeScript) that imports Thai ERP transport-planning Excel files and shows them on a calendar (FullCalendar), with in-app editing, export, reminders and an installable PWA shell. There is no backend: it is hosted on GitHub Pages and all data stays in the user's browser. UI text is Thai; dates must support both Buddhist (พ.ศ.) and Gregorian (ค.ศ.) years.

## Commands

```bash
npm run dev            # Vite dev server (.claude/launch.json uses port 5173)
npm test               # vitest run (all tests)
npx vitest run src/lib/features.test.ts          # one file
npx vitest run -t "round-trips through the importer"   # one test by name
npx tsc -b             # typecheck (build runs this first)
npm run build          # tsc -b && vite build -> docs/  (NOT dist/)
npm run deploy         # release; see below
npm run deploy:minor / deploy:major
```

No linter is configured. To check a build without touching tracked files, pass `--outDir` to `npx vite build` (the default output dir `docs/` is committed). Tests are plain-node vitest (no DOM): keep logic that needs testing in pure `src/lib` modules, and `await import()` inside tests for modules that touch browser globals.

## Release / deploy flow (important)

- Work happens on `develop`. `scripts/deploy.sh` **must be run from `develop`** and refuses otherwise, or with uncommitted changes, or if `develop` is behind/diverged from `origin/develop` (being ahead is fine; it pushes).
- The script: `npm ci` → `npm test` → bump version (`npm version`, patch by default) → build → commit `chore: release vX.Y.Z` + tag → merge `develop` into `main` (`--no-ff`) → push `develop`, `main`, tag → return to `develop`.
- GitHub Pages serves **`main` branch, `/docs` folder** ("Deploy from a branch"; there is no Actions workflow). So `docs/` is committed build output: never edit it by hand, and don't commit a build made outside the deploy script.
- Version and build date are injected at build time from `package.json` via `define` in `vite.config.ts` (`__APP_VERSION__`, `__BUILD_DATE__`, declared in `src/env.d.ts`) and shown in the top bar.
- `vite.config.ts` sets `base: './'` so the build works under the GitHub Pages sub-path.

## Architecture

Data flow: **xlsx/csv → worker parse → column mapping → `Shipment[]` → IndexedDB → filters → grouping → calendar / detail panel**. `App.tsx` owns all state (shipments, reminders, settings, filters, selection, panel size) and passes it down; rarely used dialogs (import, data, reminders, edit, settings) are `React.lazy`-loaded, and `xlsx` is dynamically imported for export to keep the main bundle small.

### Data and import
- `src/types.ts`: `Shipment` is one spreadsheet row (not one calendar event). `FIELDS` defines the mappable columns and the header regexes used by auto-mapping. Dates are always stored as Gregorian ISO `yyyy-mm-dd`; era only matters on parse and display.
- Import (`readWorkbook.ts` → `parse.worker.ts` → `mapping.ts` → `dateParse.ts`): SheetJS runs in a Web Worker (files are ~4k rows). CSVs are decoded manually as UTF-8 (fallback Windows-874) because SheetJS would read them as Latin-1 and garble Thai. `autoMap` guesses columns from header names (saved per header-signature in localStorage); `buildShipments` produces items + row errors. The effective date is `confirmedDate ?? requestedDate`. Row ids are a hash of date|SO|item|description|qty plus an occurrence counter, so re-importing the same file is idempotent.
- `dateParse.ts` handles Excel serial numbers, `dd/mm/yyyy` (day first) and ISO text, and Buddhist years (auto-detected when year > 2400, or forced). Years outside 1900–2200 are rejected, so choosing the wrong era surfaces as import errors rather than bad dates.
- Storage (`db.ts`): shipments and reminders live in IndexedDB via Dexie (4k rows exceed the localStorage quota). localStorage holds only small things: `Settings` (era, groupBy, theme, notify, display), saved column mappings, panel size, last-digest date. Dexie schema is versioned (`version(2)` added reminders): add a new `version(n)` rather than editing old ones. `loadSettings` merges saved values over defaults and migrates old shapes (e.g. `notify.tomorrow` → `daysAhead`); do the same when changing `Settings`.
- Edited rows: `editShipments` sets `editedAt` and, when the date moves, `confirmedDate`. `commitImport` in merge mode skips rows whose existing copy has `editedAt`, so ERP re-imports never overwrite local edits (ids stay stable because they derive from the original date). Replace mode and backup restore are the only ways to overwrite them.

### Display
- Calendar (`group.ts`, `CalendarView.tsx`): rows are grouped per day by customer / SO / truck into one chip each (a day can have ~90 rows). Customer chips use `shortName` (drops บริษัท/จำกัด etc.), full name in the tooltip. FullCalendar's Thai locale would force Buddhist years, so titles use a custom `titleFormat` driven by the era setting. FullCalendar sits in a `.fc-host` wrapper with a `ResizeObserver` calling `updateSize()` so it follows panel-resize drags (`CalendarApi` has no `el`).
- Hidden columns (`available.ts`): a field with no data in any row (not mapped on import, or empty everywhere) disappears from the detail table, the filters, the group-by options and the colour tones that depend on it; it reappears as soon as any row has data. The edit dialog intentionally still offers every field so a plan can be filled in from scratch.
- Status colours (`tones.ts`, `SettingsModal.tsx`): chip colour comes from the group's tone (assigned / pending when status contains "ค้าง" / unassigned). Users can switch tones off or recolour them; hidden tones render as a neutral `tone-none` chip. Defaults must keep ≥ 4.5:1 contrast with the white chip text (tested); `migrateToneColor` upgrades saved colours that still equal an old default (settings are saved whole, so old defaults stick otherwise). Colours reach CSS as `--assigned/--pending/--unassigned` inline on `.app`.
- Theme (`theme.ts`): `system | light | dark`. `main.tsx` applies it to `<html data-theme>` before first render (no flash); `system` removes the attribute so the stylesheet's `prefers-color-scheme` rule applies. The dark palette is written twice in `styles.css` (pinned and OS-driven) and must be edited in both places. Use `--accent-fill` (not `--accent`) for backgrounds carrying white text and `--warn` for warning text so both themes stay readable.
- Detail panel layout: `ResizeHandle.tsx` is a splitter between calendar and panel (width on desktop, height when stacked below 820px). Size is stored as px and applied through `--panel-w` / `--panel-h` on `<main>`, capped in CSS with the same constants (`EDGE_W`, `MAX_VH`) the drag clamp uses, so a saved size cannot swallow a smaller window. Stacked mode scrolls the page, so its ceiling is viewport-based, not `<main>`-height-based.
- `FilterBar.tsx` uses `SearchSelect` (type-to-search combobox); on narrow screens the dropdowns fold behind a toggle. With no data, `App.tsx` shows an empty state that can load `sample.ts` demo rows.

### Export, reminders, PWA
- Export (`exporters.ts`): xlsx/CSV reuse the original ERP header names so exports re-import via `autoMap`; ICS emits one all-day event per group with alarms (plus pending reminders as timed events); JSON backup is validated field-by-field in `parseBackup` (unknown fields dropped).
- Reminders (`reminders.ts`, `useReminderEngine.ts`, `sound.ts`): pure date/digest logic is separate from the 30-second `setInterval` engine, which only runs while the tab is open. `dailyDigest` summarises today plus `daysAhead` days, one line per day (the on-open banner uses the same setting). One chime per tick (Web Audio, armed on first user gesture), only for digests and reminders, never for ordinary toasts.
- PWA (`public/manifest.webmanifest`, `public/sw.js`, registered in `main.tsx` for production builds only so dev is never cached): installable, works offline (network-first cache). iOS only delivers web notifications to an app added to the Home Screen; `platform.ts` detects that and the reminders dialog explains it. Notifications use `registration.showNotification` when a service worker is active (required on Android Chrome / iOS PWA), else `new Notification`. Bump `CACHE` in `sw.js` only if cache layout changes.
- Locked-screen alerts: with no server there is no Web Push, and iOS suspends the page when the screen locks, so timers cannot fire. The supported route is the `.ics`, which the phone's own Calendar alerts from. `calendarSync.ts` hands it over in one tap: the Web Share sheet on phones (the user confirms once; browsers cannot write to a calendar directly), a plain download on desktop. Events carry stable UIDs plus a growing `SEQUENCE`, so re-syncing updates existing events, but deletions are not propagated. True auto-sync would need Google Calendar OAuth (a client ID the owner must create) or a backend; neither exists.

## Gotchas

- `xlsx` is installed from `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`, deliberately: the npm registry copy (0.18.5) has known vulnerabilities. Don't "fix" it back to a registry version.
- `@fullcalendar/*` packages must stay on the same major (6.x); `@fullcalendar/react` 7 doesn't match core 6.
- The source ERP file uses a non-standard `x:` XML namespace; SheetJS reads it fine, but hand-rolled XML parsing needs the prefix.
- Don't commit user data files (e.g. the sample ERP `.xlsx` from Downloads); use synthetic data (`sample.ts`, or a CSV built in the page) for tests and browser checks.
- Verifying the service worker needs a production build: `npx vite build --outDir <scratch>` then `vite preview --outDir <scratch>` (add a temporary entry to `.claude/launch.json` and revert it). The dev server never registers the worker.
- In the in-app browser pane, `resize_window` colour-scheme emulation is re-synced to the app theme whenever the theme changes, so a "system" theme can look wrong right after a toggle; set the emulation again before judging it.
