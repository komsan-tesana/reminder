# Difficulty tiers for unlocks (ง่าย · ปานกลาง · ยาก · ยากมาก)

**Every new item gets exactly one tier before any code is written. Pick it here, set the condition from the tables, state it to the user as a numbered list, then add the item to the registry at the bottom.** The tier is a design label (it is not a field in the code); the numbers in `ITEMS` must land inside the tier's time window.

## 1. The four tiers

| Tier | Thai | Time to unlock (normal use, see §2) | What it asks of the user | Reward weight | Must be protected against |
|---|---|---|---|---|---|
| 1 | **ง่าย** | the first week (a few minutes to ~7 days) | do the app's basic jobs once or a few times | small accessory, basic move | nothing (one-off actions) |
| 2 | **ปานกลาง** | 1–4 weeks | use the app regularly, or reach a moderately sized dataset | fur colour, common toy/outfit | counting the same thing twice |
| 3 | **ยาก** | 1–3 months | keep a habit, or a large amount of real work | standout outfit, signature move | repeating one action to farm it → add a daily cap or distinct-day counting |
| 4 | **ยากมาก** | 3+ months, or once-a-year, or "everything else" | long-term loyalty, a rare date, or completionism | top rewards (crown, medal, gold cat, festival hats) | everything above, plus it must still be reachable by normal use |

Rule of thumb for the *reward*: the harder the tier, the rarer-looking the item (more colours, a particle, a whole-body change). Do not hide a plain item behind ยากมาก.

## 2. Baseline used to turn a threshold into a time (change it only if the user tells you their real usage)

Opens the app ~5 days a week · pokes the cat ~20 times a day · ~5 reminders ticked a week · 1 ERP import a week · ~3 exports a week · ~30 rows edited a week · ~10 filter uses a day (cap 30) · works at night ~2 times a week · real data spans about a month with 20–100 customers and ~90 rows on a busy day · the cat is asleep ~20% of the time (so ~5 wake-ups a day).

Time ≈ threshold ÷ rate. **A streak needs consecutive calendar days, weekends included**, so streaks count as harder than their length suggests.

## 3. Landing zone per stat (thresholds that fit each tier)

| Stat (what it counts) | ง่าย | ปานกลาง | ยาก | ยากมาก |
|---|---|---|---|---|
| pokes (`pets`, cap 200/day) | – (**never below 1,000**: the user wants thousands) | – | 1,000 – 1,500 | 2,500 – 10,000 |
| days opened, any days (`totalDays`) | 3 | 7 – 20 | 40 – 60 | 100+ |
| consecutive days (`bestStreak`, measured over the 120 kept days) | 3 | 7 | 14 | 30+ |
| reminders ticked (`remindersDone`) | 3 | 10 – 20 | 40 – 60 | 100+ |
| ERP imports (`imports`) | 1 | 4 – 8 | 15 – 20 | 30+ |
| new rows imported (`rowsImported`) | 500 | 2,000 | 8,000 | 20,000+ |
| distinct customers / SO / rows in a day / months seen (`maxCustomers` …) | – | above the demo data (≥ 30 / 500 / 80 / 4) | 2× that | 4× that |
| exports (`exports`) | 1 – 3 | 10 – 20 | 40 – 60 | 100+ |
| backup days (`backupDays`) | 1 | 3 – 5 | 10 | 20+ |
| rows given a truck (`assigned`) | 20 | 50 | 150 | 500+ |
| rows edited (`edits`) | 20 | 60 | 200 | 600+ |
| filter uses (`filterUses`, ≤ 30/day) | 10 | 40 – 150 | 300 | 600+ |
| night visits (`nightVisits`) | 1 – 2 | 5 | 10 – 20 | 40+ |
| perfect days (`perfectDays`) | 1 – 3 | 7 | 14 – 30 | 60+ |
| sleeping cat woken (`wakes`) | 10 | 50 | 250 | 1,000+ |

If a new stat is needed, add a row here when you add the stat.

## 4. Rules

1. **Pick the tier, then the number.** Never choose a number first and call it a tier afterwards.
2. **Poke conditions are always ≥ 1,000** and always counted with the daily cap (`DAILY_POKE_CAP`). Minimum days = `ceil(N / 200)`; typical days = `N / 20`. Use that typical time to choose the tier (1,000 → ยาก, 2,500+ → ยากมาก).
3. **Data-size conditions must exceed the demo data** (24 rows, 4 customers, 24 SO, 3 rows in a day, 1 month) so loading the sample never unlocks anything. They are "highest ever seen" counters; never lowered by deleting data.
4. **Calendar-gated items are tiered by their window**: a whole month (open the app) → ปานกลาง · a 3–4 day window → ยาก · one exact day **and** a poke that day → ยากมาก. Lunar festivals (Loy Krathong, Chinese New Year) are never given exact dates.
5. **Completionist items** (everything else unlocked) are ยากมาก and exclude calendar-gated items; do not make an item depend on one that can only be earned once a year.
6. **ยาก and ยากมาก need a farm guard**: a daily cap (pokes, filter uses), distinct-day counting (backups), or counting only new things (imported rows, rows assigned). ง่าย and ปานกลาง may skip it only for one-off or explicit actions.
7. **Explicit-action conditions** (export, backup, import) are tiered by the number of *separate occasions* the user must choose to do it, not by the number of clicks it could be done in.
8. **Hints state the exact condition in Thai**, with the number and any cap ("ทักเปี๊ยก 1,000 ครั้ง (นับวันละไม่เกิน 200 ครั้ง)"). Do not write the tier name in the hint.
9. **Keep the mix healthy**: at least ~40% of all items should be ง่าย or ปานกลาง, so early rewards never dry up, and ยากมาก no more than ~30%. When adding a ยากมาก item, check the registry counts; if it tips the balance add a ง่าย item in the same change.
10. **Never tighten an existing item** (earned items are permanent, but players' progress bars would jump backwards). Loosening is fine. Changes go through the tier table and the registry.

## 5. Registry (update it in the same change as `ITEMS`)

Defaults that start unlocked (`calico`, `none`, `notoy`) are not tiered. Items counted here: 51.

| Tier | Items (condition) |
|---|---|
| **ง่าย** (13) | `cap` 3-day streak · `hardhat` first import · `glasses` 3 reminders · `roll` 3 days opened · `bowtie` first backup (.json) · `bell` 20 rows assigned · `catnip` first reminder ticked · `treat` first export · `pencil` 10 filter uses · `headphones` first night visit · `starclip` first perfect day · `eartag` 3 exports · `earplaster` 20 rows edited |
| **ปานกลาง** (17) | `orange` 7 days opened · `grey` 10 reminders · `zoom` 5 night visits · `krathong` open the app in November · `mouse` 30 customers · `pompom` 80 rows in a day · `feather` 15 exports · `receipt` 500 SO · `can` 5 backup days · `magnifier` 150 filter uses · `fishbone` 4 months of data · `earflower` 12 days opened · `earmuffs` 7-day streak · `hairclip` 15 reminders · `hoop` 60 rows edited · `earribbon` 50 rows assigned · `earcuff` 40 filter uses |
| **ยาก** (11) | `black` 14-day streak · `scarf` 1,500 pokes · `stretch` 1,000 pokes · `groom` 250 wakes · `nightcap` 10 night visits · `ninja` 14 perfect days · `party` open 30 Dec–2 Jan · `songkran` open 13–15 Apr · `mackerel` 8,000 new rows · `key` 150 rows assigned · `yarn` 200 rows edited |
| **ยากมาก** (10) | `tail` 2,500 pokes · `tuxedo` 3,000 pokes · `crown` 5,000 pokes · `medal` 10,000 pokes · `vest` 100 reminders · `tie` 30 imports · `stand` 30-day streak · `halloween` 31 Oct + poke · `christmas` 24–25 Dec + poke · `gold` everything else |

Balance now: 13 / 17 / 11 / 10 (ง่าย+ปานกลาง = 59%, ยากมาก = 20%). The ear set (outfits on the ears, generated from `EARS` in `buddySprite.ts`) is headphones, starclip, eartag, earplaster, earflower, earmuffs, hairclip, hoop, earribbon, earcuff. The easy tier covers the basic actions (import, export, backup, reminder, assign a truck, filter, open the app); free easy ideas left: a sleep mask (10 wake-ups).

Known soft spots (thresholds depend on the user's data, not on time): `mouse`, `pompom`, `receipt`, `fishbone`, `mackerel` can unlock in the first minutes for someone who imports a big real ERP file; that is accepted, the demo data cannot unlock them.

## 6. Procedure for a new or changed item

1. Choose the tier (§1) and the stat/number (§3); compute minimum days and typical days (§4.2 for pokes).
2. Show the user the numbered list: item · condition · tier · expected time. Wait for approval before drawing art.
3. `ITEMS` entry (see `add-item.md`), tests (threshold row, item count).
4. Update this registry and the balance line in §5.
