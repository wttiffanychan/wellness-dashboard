# Wellness Dashboard — Product & Design Spec

> Personal single-user wellness dashboard for Tiffany Chan. Built on Lovable (React + TypeScript +
> Tailwind + shadcn/ui) with Lovable Cloud for persistence. Companion to the markdown journal at
> `~/Claude/Projects/Wellness Journal/`.
>
> Version 1.0 — 2026-08-12

---

## 1. What this app is

A calm, beautiful place to close the loop on ten daily commitments in under sixty seconds, see a
quote that steadies you, and — over months — watch a line go up.

**Design north star:** she opens it before 8 AM on her phone, half awake, and it makes her feel
*capable*. Everything else is downstream of that.

**Three non-negotiables:**

1. **One-tap check-in.** Marking the day's core habits done takes taps, not typing. Numeric detail is optional and always one layer deeper.
2. **Never punish a gap.** Missing days are neutral grey, never red. Streaks break quietly. Copy is warm, never scolding — this mirrors the journal playbook's tone rule ("treat gaps as data, not failure").
3. **Nulls are not zeros.** An unlogged metric is absent from averages, not counted as 0.

---

## 2. Information architecture

```
┌─ Today (home)          ← lands here always
│   └─ Check-in sheet    ← bottom sheet, not a page
├─ Quotes
├─ Plans
├─ Pursuits             ← tabs: Reading | Chess
├─ Analytics            ← range toggle: 7d | 30d | 6mo
└─ Settings             ← gear in header, not in nav
```

Five nav items. On mobile: fixed bottom tab bar, 56px tall, safe-area padded, icon + 10px label,
active item gets a filled icon and the accent colour. On desktop (≥1024px): left sidebar 240px,
same five items, plus the greeting block at top.

---

## 3. Data model

Postgres via Lovable Cloud. Ten tables. Table and column names are snake_case.

### Design decision: wide daily table + normalized satellites

`daily_entries` is intentionally **wide** (one row per date, one column per metric) rather than a
tall `(date, metric_key, value)` table. Rationale: single-user app, ~12 metrics that change rarely,
and charting a wide row is dramatically simpler for both Recharts and Lovable's AI. The satellites
(supplements, chess, reading, plans) are normalized because they're genuinely one-to-many per day.

---

### 3.1 `daily_entries` — one row per calendar date

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `entry_date` | date **UNIQUE NOT NULL** | The natural key. Upsert on this. |
| `mood` | int null | 1–5. Matches journal scale. |
| `energy` | int null | 1–5. Matches journal scale. |
| `weight_lb` | numeric(5,1) null | Optional, rarely filled. |
| `meditation_done` | bool default false | |
| `meditation_minutes` | int null | |
| `meditation_session` | text null | Headspace session name, e.g. "Basics 3" |
| `sleep_hours` | numeric(3,1) null | e.g. 7.5 |
| `sleep_quality` | int null | 1–5 |
| `bedtime` | time null | |
| `wake_time` | time null | |
| `workout_done` | bool default false | |
| `workout_type` | text null | e.g. "Solid Core", "Title Boxing" |
| `workout_minutes` | int null | |
| `workout_intensity` | text null | `light` \| `moderate` \| `hard` |
| `walk_done` | bool default false | |
| `walk_minutes` | int null | |
| `walk_steps` | int null | |
| `protein_g` | int null | grams |
| `water_oz` | int null | US fluid ounces |
| `day_note` | text null | Free text, her words |
| `created_at` / `updated_at` | timestamptz | |

**Computed, never stored:** `rings_closed` (0–8), `is_perfect_day`, all streaks, all averages.
Compute in the client from the last 190 days of rows, which is a trivially small payload.

> **Sleep attribution rule** (inherited from the journal playbook): sleep logged on the morning of
> day D describes the night *ending* on D. Store it on D's row. The check-in sheet labels this
> field "Last night's sleep" so there's no ambiguity.

### 3.2 `supplements` — the registry

Mirrors `Supplements_Registry.md` exactly. Seed these seven rows and no others.

| id | name | dose_label | brand | slot | scheduled_time | counts_toward_target | sort_order |
|---|---|---|---|---|---|---|---|
| 1 | Creatine | 5 g | — | `afternoon` | 12:00 | true | 1 |
| 2 | Krill Oil | per label | Sports Research | `afternoon` | 12:00 | true | 2 |
| 3 | TMG | 2 capsules | — | `afternoon` | 12:00 | true | 3 |
| 4 | Creatine | 5 g | — | `night` | 22:00 | true | 4 |
| 5 | Collagen | 20 mg | — | `night` | 22:00 | true | 5 |
| 6 | B12 Complex | per label | — | `flexible` | null | false | 6 |
| 7 | Vitamin D | per label | — | `flexible` | null | false | 7 |

Columns: `id`, `name`, `dose_label`, `brand`, `slot` (`afternoon`\|`night`\|`flexible`),
`scheduled_time` (time null), `counts_toward_target` (bool), `is_active` (bool default true),
`sort_order` (int), `notes` (text null).

**Critical:** the two Creatine rows are **separate doses** and count separately. Noon creatine and
10 PM creatine are two of the five. Do not deduplicate by name.

**Daily target = 5 scheduled doses** (3 afternoon + 2 night). B12 and Vitamin D are tracked and
shown but excluded from the 5-dose adherence math — they're bonus, displayed as two small
secondary chips.

### 3.3 `supplement_logs`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `log_date` | date NOT NULL | |
| `supplement_id` | int FK → supplements | |
| `taken` | bool NOT NULL | |
| `taken_at` | timestamptz null | Auto-stamped when toggled on |
| `notes` | text null | |

Unique on `(log_date, supplement_id)`. Absence of a row = not yet logged (≠ skipped).

### 3.4 `quotes`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `body` | text NOT NULL | The quote itself |
| `author` | text null | null renders as "— Unknown" |
| `source` | text null | Book, talk, etc. |
| `theme` | text NOT NULL | `security` \| `confidence` \| `courage` \| `calm` \| `self-trust` \| `discipline` \| `gratitude` |
| `is_favorite` | bool default false | |
| `times_shown` | int default 0 | |
| `last_shown_on` | date null | Drives rotation fairness |
| `is_archived` | bool default false | Hide without deleting |
| `created_at` | timestamptz | |

**Themes are weighted toward the brief:** `security` and `confidence` are the two primary themes and
should make up the bulk of the seed set. See §8 for the seed library.

### 3.5 `quote_of_day`

| Column | Type |
|---|---|
| `qod_date` | date PK |
| `quote_id` | uuid FK → quotes |

Written once per day on first app open. **This table is what makes the quote stable** — without it,
the quote would reshuffle on every page load and across her laptop and phone, which destroys the
"today's message for me" feeling.

**Rotation algorithm:** pick from non-archived quotes, excluding any shown in the last 30 days;
weight favorites 2×; among eligible, pick the one with the oldest `last_shown_on` (nulls first),
tie-broken randomly. If fewer than 30 quotes exist, just exclude the last 7 days.

### 3.6 `quote_reflections`

| `id` uuid PK · `quote_id` FK · `reflection_date` date · `body` text |

Optional one-line response to a quote. Shows beneath the quote on Today, and as a small stack on
the quote's detail card. This is where the "security and confidence" work actually happens — the
quote is the prompt, her sentence is the practice.

### 3.7 `plans` and `plan_items`

**`plans`:** `id`, `title`, `subtitle`, `cadence` (`daily`\|`weekly`), `pillar`
(`body`\|`mind`\|`fuel`\|`rest`\|`craft`), `accent_color`, `icon`, `is_active`, `sort_order`.

**`plan_items`:** `id`, `plan_id` FK, `label`, `time_of_day` (`morning`\|`midday`\|`evening`\|`anytime`),
`target_value` numeric null, `unit` text null, `days_of_week` int[] null (1=Mon…7=Sun; null = every day),
`linked_metric` text null, `sort_order`.

**`plan_item_logs`:** `id`, `log_date`, `plan_item_id` FK, `done` bool. Unique on `(log_date, plan_item_id)`.

**`linked_metric` is the clever bit.** When a plan item sets `linked_metric = 'walk_done'`, checking
it off on the Plans page writes to `daily_entries.walk_done` and the Today ring closes too. One
action, both surfaces update. Valid values: any boolean or numeric column on `daily_entries`, or the
literal `supplements_afternoon` / `supplements_night`. Items with `linked_metric = null` are
free-standing and log to `plan_item_logs` only.

### 3.8 `books`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `title` / `author` | text | |
| `total_pages` | int null | |
| `current_page` | int default 0 | |
| `status` | text | `reading` \| `finished` \| `want` \| `abandoned` |
| `started_on` / `finished_on` | date null | |
| `rating` | int null | 1–5, on finish |
| `spine_color` | text null | Hex, for the shelf visual |
| `notes` | text null | |

### 3.9 `reading_sessions`

`id`, `session_date`, `book_id` FK null, `minutes` int null, `pages` int null, `notes` text null.

Multiple sessions per day allowed. `daily_entries` has no reading columns — reading rolls up from
this table (sum of minutes/pages for the date). The Today ring for reading is "any session today."

### 3.10 `chess_sessions`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `session_date` | date | |
| `kind` | text | `lesson` \| `puzzles` \| `game` \| `study` \| `review` |
| `minutes` | int null | |
| `platform` | text null | e.g. Chess.com, Lichess, book, coach |
| `topic` | text null | e.g. "Pins & skewers", "Italian Game" |
| `puzzles_solved` | int null | |
| `games_played` | int null | |
| `result` | text null | `win` \| `loss` \| `draw` \| `mixed` \| null |
| `rating_after` | int null | Drives the rating trend line |
| `notes` | text null | |

### 3.11 `settings` — single row, id = 1

| Column | Default | Notes |
|---|---|---|
| `display_name` | 'Tiffany' | Used in greeting |
| `sleep_target_hours` | 7.5 | Band is 7–8; 7.5 is the midpoint for charts |
| `sleep_target_min` / `sleep_target_max` | 7.0 / 8.0 | Renders as a shaded band on charts, not a single line |
| `protein_target_g` | 120 | **Placeholder — confirm before launch** |
| `water_target_oz` | 80 | **Placeholder — confirm before launch** |
| `meditation_target_min` | 10 | **Placeholder — confirm before launch** |
| `walk_target_min` | 30 | **Placeholder — confirm before launch** |
| `workout_target_days_per_week` | 7 | Every day, per brief |
| `supplement_target_doses` | 5 | Locked to registry math |
| `reading_target_min` | 20 | **Placeholder — confirm before launch** |
| `chess_target_min` | 15 | **Placeholder — confirm before launch** |
| `week_starts_on` | 1 (Mon) | Matches journal's Mon–Sun weeks |
| `theme` | 'system' | |

> ⚠️ **Six targets are placeholders.** The brief specified sleep (7–8 h), workout (daily), walking
> (daily), and supplements (5 doses) precisely, but gave protein and water as "grams/day" and
> "target/day" without numbers. The values above are reasonable defaults, all editable in Settings.
> Set them on day one so the analytics mean something.

### 3.12 `milestones`

`id`, `kind` (`streak`\|`total`\|`first`), `metric_key`, `threshold` int, `achieved_on` date,
`seen` bool default false.

Written when a threshold is first crossed. Drives the celebration overlay (§7). `seen` ensures each
milestone celebrates exactly once, ever.

---

## 4. The ten tracked metrics

The canonical list. Every metric gets a fixed colour, icon, unit, and target that never vary
between the Today rings, the check-in sheet, and any chart.

| # | Metric | Type | Unit | Target | Colour token | Ring? |
|---|---|---|---|---|---|---|
| 1 | Meditation | bool + numeric | minutes | ≥10 min | `--m-mind` lavender | ✔ |
| 2 | Sleep | numeric | hours | 7.0–8.0 band | `--m-sleep` indigo | ✔ |
| 3 | Workout | bool + numeric | minutes | every day | `--m-move` apricot | ✔ |
| 4 | Walking | bool + numeric | minutes | every day | `--m-walk` sage | ✔ |
| 5 | Protein | numeric | grams | ≥120 g | `--m-fuel` amber | ✔ |
| 6 | Water | numeric | fl oz | ≥80 oz | `--m-water` sky | ✔ |
| 7 | Supplements | count | doses | 5 / 5 | `--m-supp` rose | ✔ |
| 8 | Reading | bool + numeric | minutes / pages | ≥20 min | `--m-read` teal | ✔ |
| 9 | Chess | bool + numeric | minutes | ≥15 min | `--m-chess` plum | ○ |
| 10 | Mood & Energy | ordinal | 1–5 | — (no target) | `--m-mood` gradient | ○ |

**Eight rings** close a "perfect day" (#1–8). Chess and Mood are tracked and charted but don't gate
the perfect-day badge — chess is a craft she's building, not a health obligation, and mood is a
reading, not an achievement. Making mood a "target" would be actively harmful.

---

## 5. Pages

### 5.1 Today — the home screen

The screen she sees 300+ times over six months. Every element earns its place.

**Layout, top to bottom (mobile):**

1. **Ambient header** — a soft gradient mesh that shifts with the hour: dawn peach/rose (5–10 AM),
   clear warm ivory-blue (10 AM–4 PM), amber dusk (4–8 PM), deep violet-indigo (8 PM–5 AM). Height
   ~180px, bleeding behind the greeting. This is the single highest-leverage "excited to open it"
   detail — the app visibly knows what time of day it is.
   - Greeting: "Good morning, Tiffany" in the display serif, 32px.
   - Date line: "Wednesday, August 12" — 14px, muted, letter-spaced.
   - Streak chip, right-aligned: 🔥 `12 day streak` — pill, translucent, subtle.

2. **Quote of the day card** — the emotional anchor, placed *above* the habit grid on purpose. She
   should read something steadying before she's asked to do anything.
   - Body in display serif, 20–22px, generous 1.55 line-height, max ~34 chars/line.
   - Attribution 13px, muted, small-caps tracking.
   - Two ghost icon buttons bottom-right: heart (favorite) and pen (add reflection).
   - Tapping the card opens the quote detail sheet.
   - Card has a faint theme-tinted wash (security = warm sand, confidence = apricot, calm = sage…).

3. **Ring grid** — 8 tiles, 2 columns on mobile / 4 on tablet / 4 on desktop.
   Each tile: circular progress ring (56px) with the metric icon centred, metric name 13px below,
   value line 12px muted ("7.5 h" / "3 of 5" / "—").
   - **One tap on a boolean tile toggles it done.** Ring fills with a 380ms spring, icon does a
     small scale-pop, tile background warms to a 6% tint of the metric colour.
   - **Long-press (or tap the value line) opens the numeric stepper inline** — no navigation.
   - Numeric-only tiles (sleep, protein, water) tap straight to a compact stepper popover with
     ±increments (sleep ±0.5 h, protein ±10 g, water ±8 oz) and a "target met" checkmark.
   - Untouched tiles: 1px hairline ring in `--hairline`, icon at 40% opacity. Never red, never a
     warning colour.

4. **Progress bar** — "5 of 8 closed today", thin 4px bar, gradient across the closed metrics'
   colours. At 8/8 it blooms (§7).

5. **Supplement slot cards** — two cards side by side (stacked on narrow phones), because supplements
   are time-anchored in a way the other metrics aren't.
   - **Afternoon · 12:00 PM** — Creatine 5 g · Krill Oil · TMG 2 caps
   - **Night · 10:00 PM** — Creatine 5 g · Collagen 20 mg
   - Each row is a checkbox with name + dose. Header shows `2/3`.
   - **Time-aware emphasis:** the card for the current slot window (11 AM–4 PM → afternoon;
     8 PM–2 AM → night) gets a subtle accent border and lifts to the top. Outside those windows both
     are calm.
   - Below both: two small chips for B12 Complex and Vitamin D, visually secondary, labelled
     "flexible — not counted in your 5".

6. **This week strip** — 7 dots, Mon→Sun, today outlined. Each dot filled proportionally to that
   day's rings closed (a mini donut). Tap a dot to jump to that day's check-in. Quiet, ~48px tall,
   but it's the thing that creates the "don't break the chain" pull.

7. **Pursuits row** — two compact cards: current book (title, thin progress bar, "p. 142 of 320")
   and chess ("3 sessions this week · 45 min"). Tap → Pursuits page.

8. **"How was today?"** — mood and energy, two rows of 5 soft circles each. Only appears after 4 PM
   (asking at 7 AM is meaningless). Optional, dismissible.

**Desktop layout:** two columns — left (60%) has quote + rings + progress; right (40%) has
supplements, week strip, pursuits, mood. Header spans full width.

### 5.2 Check-in sheet

A bottom sheet (Vaul/shadcn Drawer), not a page — it should feel like a drawer she pulls up, fills,
and pushes down. Opens from a persistent "Check in" FAB on Today, or by tapping any week-strip dot
(then it's editing that date, with the date shown prominently in the header).

Sections in order — **matching the journal playbook's pillar order** so the two systems feel like
one system: **supplements → fitness → food → sleep**, then the additions.

1. Supplements — the two slot lists + flexible chips
2. Movement — workout (toggle, type text, minutes, intensity segmented control), walking (toggle, minutes, steps)
3. Fuel — protein slider/stepper (0–200 g, step 5), water (stepper in 8 oz cups, shown as a row of 10 fillable glass icons — far more satisfying than a number field)
4. Rest — last night's sleep: hours (0–12, step 0.25), quality 1–5, optional bedtime/wake time
5. Mind — meditation toggle, minutes, Headspace session name (free text with autocomplete from past entries)
6. Craft — quick-add a reading session and/or chess session inline
7. Reflection — mood 1–5, energy 1–5, free-text day note

Every field optional. **Blank ≠ 0.** A "Clear" affordance on each numeric field returns it to null.
Autosave on change with a debounce; a subtle "Saved" fade in the sheet header. No Save button to
forget to press.

### 5.3 Quotes

**Hero:** today's quote, large, the full-bleed treatment — display serif at 28px, theme wash
background, centred, generous vertical padding. Beneath it: her reflection if she wrote one, or a
soft prompt ("What does this bring up today?").

**Controls row:** search input · theme filter chips (All · Security · Confidence · Courage · Calm ·
Self-trust · Discipline · Gratitude) · Favorites toggle · Shuffle button ("Show me another" — draws
a random quote into a peek card *without* changing the day's official quote).

**Library:** masonry-ish card grid (1 col mobile / 2 tablet / 3 desktop). Each card: quote body
(clamped to 4 lines), author, theme dot, heart. Cards have varied subtle background tints by theme
so the grid reads as a mosaic rather than a spreadsheet. Hover/press lifts 2px.

**Add quote:** FAB → sheet with body / author / source / theme. Also a "paste multiple" mode that
splits on blank lines for bulk-adding from a note.

**Quote detail sheet:** full quote, author, source, theme, favorite toggle, times shown, "last seen
on", her reflections listed by date with an add field, archive action.

### 5.4 Plans

Two tabs: **Daily Ritual** and **Weekly Rhythm**.

**Daily Ritual** — a vertical timeline, not a checklist. Three time bands (Morning / Midday /
Evening) each rendered as a soft-edged section with a connecting line down the left. Items sit on
the line as small circles that fill when checked. Time band headers show `3/4`.

Seed content (editable — this is a starting scaffold, not a prescription):

| Band | Items |
|---|---|
| **Morning** | Read today's quote · Headspace session · Water: first 16 oz · Walk |
| **Midday** | 12 PM supplements (Creatine · Krill Oil · TMG) · Protein check-in · Workout |
| **Evening** | Reading (20 min) · Chess (15 min) · 10 PM supplements (Creatine · Collagen) · Wind-down by 10:30 · Log the day |

Items linked to metrics (§3.7) sync both ways with Today's rings.

**Weekly Rhythm** — a 7-column grid, Mon→Sun, with rows for weekly-cadence commitments (e.g.
"Strength × 3", "Long walk × 1", "Weekly review — Sunday"). Cells fill as completed; the row header
shows `2 of 3`. Sunday's cell for "Weekly review" links out to the markdown journal's review flow
as a reminder.

**Plan editing:** add/rename/reorder items, set time band, set target + unit, choose days of week,
optionally bind to a metric. Drag to reorder. Deleting an item keeps its history.

### 5.5 Pursuits

Tabbed: **Reading** | **Chess**.

**Reading tab:**
- *Currently reading* — up to 3 book cards: spine-coloured accent bar, title, author, progress bar
  with `p. 142 / 320` and `44%`, "+ log session" button. Updating current page recomputes progress.
- *Log session* — inline: minutes, pages, optional note. Multiple per day fine.
- *This month* — three stat tiles: minutes read, pages read, days with reading.
- *Finished shelf* — a literal horizontal shelf of coloured spines with titles rotated vertically,
  scrollable. Tapping a spine shows title/author/dates/rating. This is a small delight worth
  building properly; a finished-books grid of cards is forgettable, a shelf is not.
- *Trend* — pages/week area chart over the selected range.

**Chess tab:**
- *Streak + this week* — sessions this week, total minutes, current chess streak.
- *Log session* — kind (segmented: Lesson / Puzzles / Game / Study / Review), minutes, platform,
  topic, puzzles solved, games played, result, rating after, notes.
- *Rating trend* — line chart of `rating_after` over time, points only where recorded, connected
  with a smooth line. Annotate the all-time high with a small marker.
- *Practice mix* — a horizontal stacked bar showing the proportion of minutes by kind over the
  range. (One stacked bar, not a pie — it reads faster and stacks fine on mobile.)
- *Topics* — chips of recent topics with session counts, so she can see what she's neglected.

### 5.6 Analytics

**Range toggle** pinned at top: `7 days` · `30 days` · `6 months`. One control governs the whole
page. Selection persists across visits.

**A. Headline row** — 4 stat tiles: Perfect days · Logging streak · Longest streak · Overall
completion %. Each with the period-over-period delta (`↑ 8%` vs previous equal period) in muted
text. Never colour a delta red; use a neutral down-arrow.

**B. Metric cards** — one card per metric (10 cards, 1 col mobile / 2 tablet / 3 desktop). Each:
- Metric name + icon in the metric's colour
- Big number: the period average or total (average for sleep/protein/water/minutes; total for
  workouts/walks; % for supplements)
- Delta vs previous period
- **Sparkline** — 40px tall, metric-coloured, with a dashed target line where a target exists
- "Met target 22 of 30 days" caption
- Tap → expands to a full detail chart

**C. Per-range chart treatment** — this is where most dashboards get lazy. Each range gets a
genuinely different visualization because the questions are different:

| Range | Question | Chart |
|---|---|---|
| **7 days** | "How was my week?" | Vertical bars, one per day, day-of-week labels, target as a horizontal dashed line (or shaded band for sleep). Bars below target are the metric colour at 45% opacity — dimmed, not red. Value labels on top since there are only 7. |
| **30 days** | "Am I trending?" | Line with the raw daily value as faint dots + a **7-day rolling average** as the bold line. The rolling average is what makes a 30-day view readable — raw daily data is noise. Plus a 30-day calendar heatmap (5 cols × 6 rows or a proper month grid) where cell opacity = rings closed / 8. |
| **6 months** | "Did I actually change?" | **Weekly aggregation** — 26 points, area chart with a soft gradient fill, monthly gridlines and month labels. Below it: a monthly-average bar row (6 bars) with the best month subtly marked. Never plot 180 raw daily points on a phone. |

**D. Streak board** — every metric's current streak and best streak, as a sorted list with small
flame icons. Current streak in the metric's colour, best streak muted beside it.

**E. Supplement adherence** — dedicated block:
- Overall %: doses taken / (5 × days in range)
- Split by slot: afternoon % vs night % (this reveals which slot she actually misses)
- Per-supplement rows with a mini 30-cell strip each

**F. Consistency calendar** (30d and 6mo only) — the GitHub-contribution-style grid, but warm:
empty = `--hairline`, then four steps of increasing warmth from sand → apricot. 6-month view shows
26 week-columns × 7 day-rows. Hovering/tapping a cell shows that day's summary in a popover.

**G. Gentle insights** — 2–3 auto-generated observations, phrased as observations, never advice:
- "You sleep 0.6 h more on days you walk."
- "Your longest protein streak started on a Monday — 11 days."
- "Night supplements: 94%. Afternoon: 71%."

Rules: only surface an insight with ≥14 days of data for both variables; phrase as correlation,
never causation; **never** include a recommendation, warning, or anything resembling medical advice
(the journal playbook's rule 7 applies here too).

### 5.7 Settings

- Display name, week starts on, theme (System / Light / Dark)
- **Targets** — every value from §3.11, each with unit and a short label. Grouped by pillar.
- **Supplement registry editor** — add/edit/deactivate, set slot, set scheduled time, toggle
  "counts toward daily target". Deactivating preserves history (mirrors the journal's "don't delete
  history" rule).
- **Plans editor** shortcut
- **Data** — export everything as JSON and as CSV (one CSV per table). Non-negotiable for six months
  of personal data on someone else's platform.
- **About** — version, link to the markdown journal repo

---

## 6. Design system

### 6.1 Palette

Warm, low-saturation, high-comfort. The whole thing lives in a narrow value range so nothing
shouts — accent comes from *placement*, not intensity.

**Light (default)**

```css
--canvas:        #FBF7F2;  /* warm ivory page background */
--surface:       #FFFFFF;  /* cards */
--surface-sunk:  #F4EEE6;  /* wells, inactive tracks */
--hairline:      #EAE1D6;  /* 1px borders, empty rings */
--ink:           #2A2521;  /* primary text — warm near-black, never #000 */
--ink-soft:      #6B6259;  /* secondary */
--ink-mute:      #9C9188;  /* captions, disabled */
--accent:        #D98E63;  /* apricot — primary action, streak flame */
--accent-soft:   #F6E3D5;  /* accent wash */
--success:       #7E9B74;  /* sage — completion */
```

**Dark**

```css
--canvas:        #16130F;
--surface:       #1F1B16;
--surface-sunk:  #14110D;
--hairline:      #322C25;
--ink:           #F2EBE2;
--ink-soft:      #B5AAA0;
--ink-mute:      #837A71;
--accent:        #E5A47C;
--accent-soft:   #3A2C21;
--success:       #93AE88;
```

**Metric colours** (fixed, used identically in rings, sparklines, and charts):

| Token | Metric | Light | Dark |
|---|---|---|---|
| `--m-mind` | Meditation | `#9B8FC7` lavender | `#B0A5D6` |
| `--m-sleep` | Sleep | `#6E86B8` indigo | `#8A9FCC` |
| `--m-move` | Workout | `#D98E63` apricot | `#E5A47C` |
| `--m-walk` | Walking | `#7E9B74` sage | `#93AE88` |
| `--m-fuel` | Protein | `#C9A24C` amber | `#DCB863` |
| `--m-water` | Water | `#6FA3B5` sky | `#87B8C9` |
| `--m-supp` | Supplements | `#C47F86` rose | `#D6959B` |
| `--m-read` | Reading | `#6BA396` teal | `#84B8AB` |
| `--m-chess` | Chess | `#9E7FA8` plum | `#B394BC` |
| `--m-mood` | Mood | gradient `--m-sleep` → `--m-move` | same |

All metric colours sit in a similar lightness band (L≈62 light / L≈72 dark) so no single metric
visually dominates a multi-series chart. They're distinguishable by hue at a glance and remain
distinguishable in greyscale by their fixed icon pairing.

### 6.2 Typography

- **Display / headings / quotes:** `Fraunces` — a soft optical serif with warmth at large sizes.
  Weights 400 and 600, optical size axis set high (`font-variation-settings: "SOFT" 40, "WONK" 1`)
  for headings. Fallback: `Instrument Serif`, then `Georgia, serif`.
- **UI / body / data:** `Inter` — weights 400/500/600, with `font-feature-settings: "cv11", "ss01"`.
  Fallback: system UI stack.
- **All numerals in data positions use `font-variant-numeric: tabular-nums`.** Non-negotiable —
  proportional digits make a column of numbers jitter and it reads as amateur.

**Scale:** display 40/1.1 · h1 32/1.2 · h2 24/1.3 · h3 19/1.35 · body 16/1.6 · small 14/1.5 ·
caption 13/1.45 · micro 11/1.4 (uppercase, `letter-spacing: 0.08em`, used for section eyebrows).

### 6.3 Space, shape, depth

- **Spacing scale:** 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64. Nothing off-scale.
- **Generous whitespace is a requirement, not a preference.** Card padding 24px mobile / 32px
  desktop. 32px between major sections. Page gutters 20px mobile / 48px desktop. Max content width
  1120px.
- **Radii:** cards 20px · sheets 28px (top corners) · buttons/pills 999px · inputs 12px · tiles 18px.
- **Shadows** — warm-tinted and layered, never grey/black:
  ```css
  --shadow-sm: 0 1px 2px rgba(66,48,34,.04), 0 2px 6px rgba(66,48,34,.04);
  --shadow-md: 0 2px 4px rgba(66,48,34,.04), 0 8px 20px rgba(66,48,34,.06);
  --shadow-lg: 0 4px 8px rgba(66,48,34,.05), 0 20px 48px rgba(66,48,34,.10);
  ```
  In dark mode, drop shadows to near-nothing and separate with `--hairline` borders instead.
- **Texture:** a 2.5% opacity SVG fractal-noise overlay fixed over the canvas. It's the difference
  between "flat web app" and "printed on nice paper." Very subtle — if you can see grain, it's
  too strong.
- **Borders:** 1px `--hairline`, used sparingly. Prefer background-value separation over lines.

### 6.4 Motion

Everything is soft-eased and short. `cubic-bezier(0.32, 0.72, 0, 1)` is the house curve.

| Interaction | Motion |
|---|---|
| Ring fills on tap | 380ms spring, stroke-dashoffset animates, icon scale 1 → 1.12 → 1 |
| Tile press | scale 0.97, 120ms |
| Card enter (page load) | fade + 8px rise, 320ms, **40ms stagger** between cards |
| Sheet open | slide up 380ms, backdrop blur fades in |
| Number change | count-up tween over 500ms (only for big stat numbers, not inputs) |
| Chart draw | line/area path draws left→right over 700ms on first paint only |
| Tab change | 200ms crossfade + 4px slide |
| Quote change | fade out 180ms → fade in 260ms |

**`prefers-reduced-motion: reduce` must collapse all of this to opacity-only fades ≤120ms.** No
transforms, no draw animations, no count-ups. Build this in from the start.

### 6.5 Mobile-first specifics

- Design at 390px first; scale up.
- Minimum touch target 44×44px. Ring tiles are 88px+ tall — comfortably thumb-sized.
- Bottom nav is fixed with `padding-bottom: env(safe-area-inset-bottom)`.
- Primary actions live in the lower two-thirds of the screen (thumb zone). The check-in FAB sits
  bottom-right above the nav.
- Charts: horizontal scroll containers where a chart can't compress (the 6-month heatmap), never a
  page-level horizontal scroll.
- `<meta name="theme-color">` set per light/dark so the browser chrome matches.
- Add PWA manifest + apple-touch-icon so she can add it to her home screen. **This matters** — a
  home-screen icon converts "a website I sometimes check" into "an app I open," which is the whole
  behavioural bet.

---

## 7. Celebration & micro-moments

Calm celebration. Think a slow bloom of soft light, not a confetti cannon. The aesthetic constraint
is: *would this feel good at 6:45 AM?*

| Trigger | Moment |
|---|---|
| Single habit checked | Ring spring-fills, tile tints, a 3-particle soft upward drift, 60ms haptic (`navigator.vibrate(12)` where supported) |
| Slot complete (3/3 afternoon) | Slot card border warms and a small checkmark draws in |
| **Perfect day (8/8)** | Full-card bloom: a radial warm gradient expands from centre over 900ms, the progress bar becomes a gradient, and a single line of display serif appears — "That's a perfect day." Auto-dismisses; no button required. |
| Streak milestone (7/14/21/30/50/75/100/150/200/365) | Full-screen soft overlay: the number huge in display serif, a warm radial wash, one sentence ("Thirty days. That's a season of showing up."), and a favorite quote beneath. Dismiss by tapping anywhere. Written to `milestones` so it fires **once, ever**. |
| First book finished | The spine slides onto the shelf with a settle animation |
| New chess rating high | The rating chart's peak marker pulses once |
| Monthly total crossed (e.g. 500 min meditated) | Small toast, not an overlay |

**Copy rules for these moments:** warm, specific, never generic hype. "Thirty days" beats
"Amazing job!!" Never exclamation-stacked. Never compare her to other users (there are none) or to
her past self negatively.

**Anti-patterns — explicitly do not build:** red missed-day indicators, guilt copy ("You broke your
streak"), streak-freeze upsells, notification nags, a "score" that goes down, or leaderboards.

---

## 8. Seed content

### Quotes — seed 40, weighted to security and confidence

Ship the app with a real starting library so day one doesn't feel empty. Suggested distribution:
security 12 · confidence 12 · self-trust 6 · courage 5 · calm 5. Sources should skew toward
durable, non-cheesy voices — Rilke, Maya Angelou, Brené Brown, Marcus Aurelius, Toni Morrison, Mary
Oliver, Audre Lorde, James Baldwin, Thich Nhat Hanh, Pema Chödrön — plus unattributed affirmations
written in second person ("You are allowed to take up space in rooms you earned your way into.").

Rules for the seed set: no hustle-culture grind quotes, nothing that frames rest as weakness, and
a mix of ~70% attributed / 30% unattributed affirmations. Every quote gets a theme.

### Plans — seed the daily ritual and weekly rhythm from §5.4.

### Supplements — seed exactly the seven rows in §3.2. No others.

### Books / chess — start empty with a warm empty state, not a spinner.

**Empty states matter here.** Every list gets a hand-written empty state: an illustration-free soft
card, one sentence in the display serif, and a single action button. e.g. Reading: "No book open
right now." / `+ Start a book`.

---

## 9. Out of scope for v1

Named so they don't creep in: multi-user accounts or sharing · Apple Health / Headspace / Chess.com
API sync (manual entry only) · push notifications · AI-generated insights beyond the rule-based ones
in §5.6G · importing the historical markdown logs (7 files; type them in if wanted) · offline mode ·
photo attachments.

---

## 10. Build order

1. Cloud enabled + all tables + seed data + auth (single account, no public signup)
2. Today page with rings, one-tap toggles, and supplement slots
3. Check-in sheet with autosave
4. Quotes (library + quote-of-day rotation + favorites + reflections)
5. Analytics 7-day and 30-day
6. Plans
7. Pursuits (reading + chess)
8. Analytics 6-month + heatmap + streak board + insights
9. Celebrations, motion polish, PWA manifest, export

Ship 1–3 first and start using it the same day. Real data makes every later decision easier — and
the analytics pages are meaningless until there are two weeks of rows behind them.
