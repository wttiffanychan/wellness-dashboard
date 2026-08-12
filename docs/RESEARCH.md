# Lovable Research — Wellness Dashboard

> Researched 2026-08-12 for Tiffany Chan. Purpose: decide whether to remix an existing Lovable
> template or start a clean custom build for a personal wellness dashboard.

---

## TL;DR recommendation

**Start a clean custom build on Lovable Cloud — but hand Lovable the Continuum habit tracker as an explicit design/behaviour reference.**

There is exactly one template in Lovable's gallery that is genuinely close (Continuum — Daily Habit Tracker). It nails ~35% of what you need (streaks, heatmaps, milestone celebrations) but its data model is boolean habits only, and six of your ten metrics are *numeric with targets* (sleep hours, protein grams, water, minutes meditated, pages read, chess minutes). Retrofitting numeric metrics + a quotes library + plans + chess + reading onto a habit-boolean schema is more prompting work than starting fresh — and you'd spend most of it fighting someone else's design tokens, which is the opposite of what you want given the aesthetic bar.

**The custom build wins on:** exact schema fit, bespoke aesthetic from line one, no dead template code to delete.
**What you'd give up:** a couple of hours of scaffolding Continuum would have handed you free. That's recoverable by naming its patterns in the prompt (LOVABLE_PROMPT.md does this).

---

## What's actually in Lovable's template gallery

Checked `lovable.dev/templates`, `/templates/apps`, and the services/websites categories.

### The one real candidate

| Template | Continuum — Daily Habit Tracker |
|---|---|
| **URL** | https://lovable.dev/templates/apps/saas/continuum-daily-habit-tracker-template |
| **Pitch** | "Streak counters and calendar heatmaps" — a calm, focused, ad-free habit tracker |
| **Stack** | React + TypeScript + Tailwind + shadcn/ui |
| **Features** | Streak tracking with milestone celebrations at 7 / 14 / 21 / 30 / 50 / 100 / 200 / 365 days; 30-day calendar heatmap; flexible scheduling (daily / specific weekdays / weekly targets); drag-and-drop habit reordering; custom habit colours; insights page; cloud sync; dark mode; optional reminder times |
| **Pages** | Dashboard (daily check-off) · Insights · Settings · Onboarding |
| **Aesthetic** | Minimalist, calm, distraction-free |
| **Cost** | Free to remix; one-click deploy |

**Why it's tempting:** the milestone ladder, heatmap, and "calm and focused" positioning are exactly the emotional register you asked for. Its streak-celebration design is worth copying outright.

**Why it isn't the base:**

1. **Boolean-only habits.** Continuum answers "did you?" Your dashboard has to answer "how much?" — 7.5 hours slept, 140 g protein, 80 oz water, 22 minutes meditated, 31 pages read. Targets, partial credit, and averages are all foreign to its schema.
2. **No second-order objects.** Quotes library, wellness plans, books, and chess sessions are four entities Continuum has no concept of. They'd all be additive anyway.
3. **Supplements aren't habits.** Your five scheduled doses live in two time-slotted groups (12 PM ×3, 10 PM ×2) plus two flexible dailies. Modelling that as seven independent habits loses the slot structure and makes your 5-dose adherence math awkward.
4. **No charting.** Continuum ships heatmaps and counters, not trend lines. Your 6-month view needs real charts (Recharts) regardless.
5. **Design lock-in.** Remixing means inheriting its token set and then overriding it everywhere. Starting clean means the palette and type scale in SPEC.md are the app's actual foundation, not a patch on top.

### Everything else in the gallery — and why each is out

| Template | Verdict |
|---|---|
| Wellness Studio Website ([link](https://lovable.dev/templates/websites/services/thrive-wellness-movement-studio-template)) | Marketing site for a studio business. Practitioner directory, not personal tracking. Out. |
| Yoga / Holistic Wellness Platform ([link](https://lovable.dev/templates/websites/services/vitalpath-holistic-wellness-yoga-platform-template)) | Same — editorial marketing site with coach profiles. Out. |
| Beauty & Wellness Booking ([link](https://lovable.dev/templates/websites/services/velvet-beauty-wellness-booking-platform-template)) | Appointment booking with guest checkout. Wrong problem entirely. Out. |
| OKR Tracker | Goal/check-in structure is loosely analogous but the framing (objectives, key results, quarterly reporting) is corporate and would feel like work. Out. |
| Budget / Finance / Cash Flow / RevOps / Customer Health dashboards | **Worth borrowing from, not remixing.** These are the gallery's best *analytics layout* references — KPI tile rows, period-over-period deltas, cohort trends. Steal the information architecture for your Analytics page; ignore the finance domain. |
| Lovable Insights | Self-serve dashboard patterns; same note as above. |
| Team Docs / Spreadsheet Editor / Kanban | Collaboration tools. Out. |

**There is no mood-journal or personal-health-dashboard template in the gallery.** That gap is the main reason this is a custom build.

---

## Platform notes that shape the build

### Data persistence — use Lovable Cloud

Lovable Cloud is the built-in backend: database, auth, storage, edge functions, and AI, with no infrastructure setup. It's built on Supabase's open-source foundation but you don't provision or connect Supabase yourself — enable Cloud on the project and prompt for tables in plain language.

Practical implications:

- **Enable Cloud in the very first prompt.** Retrofitting persistence later means Lovable rewrites your components from local state to async queries — a messy diff.
- **Region is permanent.** You cannot change region after enabling Cloud on a project. Pick US.
- There's a **Database tool** in the Lovable UI for viewing tables, editing records directly, and restoring backups — useful for seeding your 7 supplements and first batch of quotes by hand if the AI's seed data is off.
- Usage is **credit-based**, with a monthly grant on Free/Pro/Business. A single-user app with ~10 tables and a few writes a day is negligible against any tier; your credits go to *building*, not running.

### Auth — the single-user question

Lovable Cloud includes authentication; email/password can be added in one prompt and gates pages behind login. For your case:

**Recommendation: turn auth on, with email/password only, and no signup route.** Reasoning:

- Your Lovable app deploys to a public URL. Without auth, anyone with the link reads your sleep, mood, and weight.
- "No complex auth" ≠ no auth. One email/password login, one account (yours), sessions that persist so you're not typing a password every morning on your phone — that's roughly ten words of prompt and zero ongoing friction.
- Disabling public signup means the app has exactly one user forever, which lets you skip per-user data scoping complexity in the UI (though row-level security should still be on).

The prompt in LOVABLE_PROMPT.md specifies exactly this.

### Charting

Lovable's stack is React + Tailwind + **shadcn/ui**, and shadcn's chart component wraps **Recharts** — so Recharts is the path of least resistance and what Lovable will reach for by default. It handles everything you need: line, area, bar, and the composed chart with a target reference line. Calendar heatmaps aren't a Recharts primitive; those are a hand-rolled CSS grid (Continuum does the same). Both are specified in SPEC.md.

One thing to be deliberate about: **assign each metric a fixed colour once and reuse it everywhere** — sleep is always the same blue on the Today ring, the 7-day bar, and the 6-month line. Dashboards that recolour a metric per chart feel cheap. The palette in SPEC.md does this.

### GitHub

Your Lovable account is already connected to GitHub (`wttiffanychan`). Connect the project to a repo early — it gives you version history independent of Lovable's own, and it means this dashboard can live next to the markdown journal it grew out of.

---

## How the dashboard relates to the existing markdown journal

The journal at `~/Claude/Projects/Wellness Journal/` stays the source of truth for *narrative* — your words, the agent's daily summaries, weekly reviews. The dashboard is the source of truth for *numbers* and the daily ritual.

The overlap is deliberate and worth keeping consistent:

| Journal concept | Dashboard equivalent |
|---|---|
| `Supplements_Registry.md` — 7 items across 3 slots | `supplements` table, seeded with the exact same 7 rows |
| "Daily target = 5 doses (3 afternoon + 2 night)" | `settings.supplement_target_doses = 5`; flexible B12/D tracked but excluded from the 5 |
| Mood / Energy (1–5) in the log header | `daily_entries.mood`, `.energy` — same 1–5 scale |
| Sleep quality (1–5), hours | `daily_entries.sleep_quality`, `.sleep_hours` |
| 7-day rollups in `Journal_Index.md` | Analytics → 7-day view (same metrics, same definitions) |
| Streak = consecutive days with a log | `logging_streak` (plus a stricter `perfect_day_streak`) |
| "Skip gracefully — mark `—`" | Nullable columns everywhere; a missing metric is null, never zero |

That last row matters more than it looks. **A skipped metric must be null, not zero** — otherwise a day you forgot to log water drags your 30-day water average down and the chart lies to you. This is called out explicitly in the spec and the prompt.

---

## Two other paths, briefly

**Remix Continuum anyway.** Defensible if you want something usable tonight and are willing to let quotes/plans/chess/reading arrive in a second wave. You'd get the streak and heatmap machinery free. The cost is that every numeric metric becomes a workaround, and the eventual cleanup is larger than the head start.

**Build it yourself outside Lovable** (Next.js + Supabase, or even a local SvelteKit app). More control, no credit usage, but it's a weekend of scaffolding before you see a single chart — and the whole point of Lovable here is that you get the polished thing fast and iterate on feel rather than plumbing.

Neither beats the custom Lovable build for what you described.

---

## Sources

- [Lovable Templates gallery](https://lovable.dev/templates)
- [Continuum — Daily Habit Tracker Template](https://lovable.dev/templates/apps/saas/continuum-daily-habit-tracker-template)
- [Lovable — How to Build a Habit Tracker App](https://lovable.dev/guides/how-to-build-a-habit-tracker-app)
- [Lovable Cloud documentation](https://docs.lovable.dev/features/cloud)
- [Lovable Cloud integration docs](https://docs.lovable.dev/integrations/cloud)
- [Introducing Lovable Cloud and AI](https://lovable.dev/blog/lovable-cloud)
- [Lovable — Fitness & Workout Dashboards use case](https://lovable.dev/solutions/use-case/fitness-workout-dashboards)
- [Recharts](https://recharts.github.io/)
