# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A static, browser-only React app (Vite + TypeScript) that imports Thai ERP transport-planning Excel files and shows them on a calendar (FullCalendar), with in-app editing, export, and reminders. There is no backend: it is hosted on GitHub Pages and all data stays in the user's browser. UI text is Thai; dates must support both Buddhist (พ.ศ.) and Gregorian (ค.ศ.) years.

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

No linter is configured. To check a build without touching tracked files, pass `--outDir` to `npx vite build` (the default output dir `docs/` is committed).

## Release / deploy flow (important)

- Work happens on `develop`. `scripts/deploy.sh` **must be run from `develop`** and refuses otherwise, or with uncommitted changes, or if `develop` is behind/diverged from `origin/develop`.
- The script: `npm ci` → `npm test` → bump version (`npm version`, patch by default) → build → commit `chore: release vX.Y.Z` + tag → merge `develop` into `main` (`--no-ff`) → push `develop`, `main`, tag → return to `develop`.
- GitHub Pages serves **`main` branch, `/docs` folder** ("Deploy from a branch"; there is no Actions workflow). So `docs/` is committed build output: never edit it by hand, and don't commit a build made outside the deploy script.
- Version and build date are injected at build time from `package.json` via `define` in `vite.config.ts` (`__APP_VERSION__`, `__BUILD_DATE__`, declared in `src/env.d.ts`) and shown in the top bar.
- `vite.config.ts` sets `base: './'` so the build works under the GitHub Pages sub-path.

## Architecture

Data flow: **xlsx/csv → worker parse → column mapping → `Shipment[]` → IndexedDB → filters → grouping → calendar / detail panel**.

- `src/types.ts`: `Shipment` is one spreadsheet row (not one calendar event). `FIELDS` defines the mappable columns and the header regexes used by auto-mapping. Dates are always stored as Gregorian ISO `yyyy-mm-dd`; era only matters on parse and display.
- Import (`readWorkbook.ts` → `parse.worker.ts` → `mapping.ts` → `dateParse.ts`): SheetJS runs in a Web Worker (files are ~4k rows). CSVs are decoded manually as UTF-8 (fallback Windows-874) because SheetJS would read them as Latin-1 and garble Thai. `autoMap` guesses columns from header names (saved per header-signature in localStorage); `buildShipments` produces items + row errors. The effective date is `confirmedDate ?? requestedDate`. Row ids are a hash of date|SO|item|description|qty plus an occurrence counter, so re-importing the same file is idempotent.
- `dateParse.ts` handles Excel serial numbers, `dd/mm/yyyy` (day first) and ISO text, and Buddhist years (auto-detected when year > 2400, or forced). Years outside 1900–2200 are rejected, so choosing the wrong era surfaces as import errors rather than bad dates.
- Storage (`db.ts`): shipments and reminders live in IndexedDB via Dexie (4k rows exceed the localStorage quota); localStorage holds only small settings, saved column mappings, and the last-digest date. Schema is versioned (`version(2)` added reminders); add a new `version(n)` rather than editing old ones.
- Edited rows: `editShipments` sets `editedAt` and, when the date moves, `confirmedDate`. `commitImport` in merge mode skips rows whose existing copy has `editedAt`, so ERP re-imports never overwrite local edits (ids stay stable because they derive from the original date). Replace mode and backup restore are the only ways to overwrite them.
- Calendar (`group.ts`, `CalendarView.tsx`): rows are grouped per day by customer / SO / truck into one chip each (a day can have ~90 rows); chip colour is derived from driver/truck presence and a status containing "ค้าง". FullCalendar's Thai locale would force Buddhist years, so titles use a custom `titleFormat` driven by the era setting.
- Export (`exporters.ts`): xlsx/CSV reuse the original ERP header names so exports re-import via `autoMap`; ICS emits one all-day event per group with alarms; JSON backup is validated field-by-field in `parseBackup` (unknown fields dropped).
- Reminders (`reminders.ts`, `useReminderEngine.ts`): pure date/digest logic is separate from the 30-second `setInterval` engine, which only runs while the tab is open (no server/service worker). Native `Notification` is used when permitted; in-page toasts are always shown.
- `App.tsx` owns all state (shipments, reminders, settings, filters, selection). Dialogs (import, data, reminders, edit) are `React.lazy`-loaded; `xlsx` is also dynamically imported for export to keep the main bundle small.

## Gotchas

- `xlsx` is installed from `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`, deliberately: the npm registry copy (0.18.5) has known vulnerabilities. Don't "fix" it back to a registry version.
- `@fullcalendar/*` packages must stay on the same major (6.x); `@fullcalendar/react` 7 doesn't match core 6.
- The source ERP file uses a non-standard `x:` XML namespace; SheetJS reads it fine, but hand-rolled XML parsing needs the prefix.
- Don't commit user data files (e.g. the sample ERP `.xlsx` from Downloads); use synthetic data for tests and browser checks.
