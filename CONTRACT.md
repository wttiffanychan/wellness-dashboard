# BUILD CONTRACT — Wellness Dashboard (Next.js build)

Read this FIRST, then docs/SPEC.md and docs/mockup.html. This is the agreement for how the app gets built.

## Repo state (already done — do NOT redo)

- Next.js 16.3 + React 19 + TypeScript, Tailwind v4, app router, `src/` dir
- shadcn/ui installed (Base UI, Nova preset) — components live in `src/components/ui/`
- Recharts installed
- **Design system already in `src/app/globals.css`** — SPEC §6.1 palette (light+dark), metric colours as `--m-*` tokens, SPEC §6.2 Fraunces/Inter fonts (wired in `src/app/layout.tsx`), radii, warm shadows, paper-grain overlay, house easing curve, reduced-motion collapse. USE THESE TOKENS — do not invent new colours.
- **Data layer already in `src/lib/types.ts` + `src/lib/data.ts`** — all types mirror `supabase/schema.sql`; `data.ts` is a localStorage adapter seeded with the 7 supplements, 40 quotes, and settings. Supabase will replace it later, so:
  - **UI imports ONLY from `src/lib/types.ts` and `src/lib/data.ts`.** Never import localStorage directly.
  - All data functions are async — await them.
- Supabase SQL ready in `supabase/schema.sql` + `supabase/seed.sql` (not applied yet — local adapter is the live data source for now).

## Critical Next.js 16 notes (from node_modules/next/dist/docs/ — this version has breaking changes)

- Read `node_modules/next/dist/docs/` for anything you're unsure about. Heed deprecations.
- `LayoutProps<"/">` is the correct typed layout prop in this version (see existing layout.tsx).
- Client components: use `"use client"` at the top. Server components by default.
- No `next/future` or legacy config imports.

## Pages to build (SPEC §5) — file ownership

| Route | File | Content |
|---|---|---|
| `/` | `src/app/page.tsx` | **Today** (SPEC §5.1) — ambient header w/ time-of-day gradient, greeting, date, streak chip; quote-of-day card (favorite + reflection buttons); 8 habit rings grid (one-tap toggles, numeric steppers); "X of 8 closed" progress bar; supplement slot cards (afternoon/night, time-aware emphasis, flexible chips); this-week strip; pursuits row; mood/energy (after 4PM). Mobile-first 390px. |
| — | `src/components/check-in-sheet.tsx` | **Check-in sheet** (SPEC §5.2) — bottom drawer, pillar order supplements→movement→fuel→rest→mind→craft→reflection, autosave, blank≠0. |
| `/quotes` | `src/app/quotes/page.tsx` | **Quotes** (SPEC §5.3) — hero today's quote, search/filter/favorites/shuffle, masonry card grid, add-quote sheet, quote detail sheet w/ reflections. |
| `/plans` | `src/app/plans/page.tsx` | **Plans** (SPEC §5.4) — Daily Ritual timeline (morning/midday/evening bands) + Weekly Rhythm grid. linked_metric syncs with Today. |
| `/pursuits` | `src/app/pursuits/page.tsx` | **Pursuits** (SPEC §5.5) — Reading tab (currently-reading cards, log session, month tiles, finished shelf, pages/week chart) + Chess tab (streak, log session, rating trend, practice mix, topics). |
| `/analytics` | `src/app/analytics/page.tsx` | **Analytics** (SPEC §5.6) — range toggle 7d/30d/6mo, headline row, 10 metric cards w/ sparklines, per-range charts (7d bars, 30d line+rolling avg+heatmap, 6mo weekly area+monthly bars), streak board, supplement adherence block, consistency calendar, gentle insights (≥14 days, observation phrasing only, never medical advice). |
| `/settings` | `src/app/settings/page.tsx` | **Settings** (SPEC §5.7) — display name, week start, theme, all targets, supplement registry editor, plans shortcut, JSON+CSV export, about. |

Plus:
- **Shared nav** `src/components/tab-bar.tsx` — fixed bottom tab bar (Today/Quotes/Plans/Pursuits/Analytics), 56px, safe-area padded, icon+label, active filled accent. Desktop: 240px left sidebar (same items).
- **Celebrations** (SPEC §7) — ring spring fill, slot-complete checkmark, perfect-day bloom (8/8), streak milestone overlay (once-ever via milestones), first-book spine settle, chess rating-high pulse. Calm, warm, never confetti. Copy rules: specific, no exclamation stacking.
- **PWA** — manifest + apple-touch-icon + theme-color (SPEC §6.5). `src/app/manifest.ts`.

## Anti-patterns (SPEC §7 — do NOT build)

Red missed-day indicators, guilt copy, streak-freeze upsells, notification nags, decreasing scores, leaderboards. Missing days = neutral grey. Nulls are NOT zeros (an unlogged metric is absent from averages, never 0).

## Design rules

- Follow `docs/mockup.html` as the visual reference for the Today page aesthetic (dark, calm, premium, soft glows, generous whitespace).
- Spacing scale 4/8/12/16/24/32/48/64. Cards 20px radius, sheets 28px top, pills 999px. Max content 1120px.
- Display serif (Fraunces) for headings + quotes: `font-display` class. Inter for UI/body. All data numerals `tabular-nums` (class `.tabular`).
- Motion: house curve `cubic-bezier(0.32, 0.72, 0, 1)`, ring fill 380ms spring, cards stagger 40ms, sheet slide 380ms, chart draw 700ms first paint only. Reduced-motion collapses to ≤120ms opacity fades (already global in globals.css — don't break it).
- Every metric uses its fixed `--m-*` colour everywhere (rings, charts, sparklines) — never recolour per chart.

## Verification

- `npx tsc --noEmit` must pass
- `npm run build` must pass
- `npm run dev` and view at localhost:3000 — check Today page at mobile width (390px)

## Build order

1. Today page + tab bar + check-in sheet (ship these first — usable same day)
2. Quotes
3. Plans
4. Pursuits
5. Analytics
6. Settings + PWA + celebrations polish

Commit after each page with a clear message. Report at the end: what's done, what's next, anything you deviated from the spec and why.
