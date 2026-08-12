-- ============================================================
-- Wellness Dashboard — Supabase schema
-- Source of truth: SPEC.md §3 (Wellness Journal/Dashboard)
-- Run this in the Supabase SQL editor AFTER enabling Cloud/DB.
-- ============================================================

-- ---------- 3.1 daily_entries — one row per calendar date ----------
create table if not exists public.daily_entries (
  id uuid primary key default gen_random_uuid(),
  entry_date date not null unique,
  mood int null check (mood between 1 and 5),
  energy int null check (energy between 1 and 5),
  weight_lb numeric(5,1) null,
  meditation_done boolean not null default false,
  meditation_minutes int null,
  meditation_session text null,
  sleep_hours numeric(3,1) null,
  sleep_quality int null check (sleep_quality between 1 and 5),
  bedtime time null,
  wake_time time null,
  workout_done boolean not null default false,
  workout_type text null,
  workout_minutes int null,
  workout_intensity text null check (workout_intensity in ('light','moderate','hard')),
  walk_done boolean not null default false,
  walk_minutes int null,
  walk_steps int null,
  protein_g int null,
  water_oz int null,
  day_note text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- 3.2 supplements — the registry (mirrors Supplements_Registry.md) ----------
create table if not exists public.supplements (
  id serial primary key,
  name text not null,
  dose_label text null,
  brand text null,
  slot text not null check (slot in ('afternoon','night','flexible')),
  scheduled_time time null,
  counts_toward_target boolean not null default true,
  is_active boolean not null default true,
  sort_order int not null default 0,
  notes text null
);

-- ---------- 3.3 supplement_logs ----------
create table if not exists public.supplement_logs (
  id uuid primary key default gen_random_uuid(),
  log_date date not null,
  supplement_id int not null references public.supplements(id),
  taken boolean not null default false,
  taken_at timestamptz null,
  notes text null,
  unique (log_date, supplement_id)
);

-- ---------- 3.4 quotes ----------
create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  body text not null,
  author text null,
  source text null,
  theme text not null check (theme in ('security','confidence','courage','calm','self-trust','discipline','gratitude')),
  is_favorite boolean not null default false,
  times_shown int not null default 0,
  last_shown_on date null,
  is_archived boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------- 3.5 quote_of_day — makes the quote stable across devices ----------
create table if not exists public.quote_of_day (
  qod_date date primary key,
  quote_id uuid not null references public.quotes(id)
);

-- ---------- 3.6 quote_reflections ----------
create table if not exists public.quote_reflections (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id),
  reflection_date date not null default current_date,
  body text not null
);

-- ---------- 3.7 plans + plan_items + plan_item_logs ----------
create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subtitle text null,
  cadence text not null check (cadence in ('daily','weekly')),
  pillar text not null check (pillar in ('body','mind','fuel','rest','craft')),
  accent_color text null,
  icon text null,
  is_active boolean not null default true,
  sort_order int not null default 0
);

create table if not exists public.plan_items (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  label text not null,
  time_of_day text not null default 'anytime' check (time_of_day in ('morning','midday','evening','anytime')),
  target_value numeric null,
  unit text null,
  days_of_week int[] null,
  linked_metric text null,
  sort_order int not null default 0
);

create table if not exists public.plan_item_logs (
  id uuid primary key default gen_random_uuid(),
  log_date date not null,
  plan_item_id uuid not null references public.plan_items(id) on delete cascade,
  done boolean not null default false,
  unique (log_date, plan_item_id)
);

-- ---------- 3.8 books ----------
create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  author text null,
  total_pages int null,
  current_page int not null default 0,
  status text not null default 'want' check (status in ('reading','finished','want','abandoned')),
  started_on date null,
  finished_on date null,
  rating int null check (rating between 1 and 5),
  spine_color text null,
  notes text null
);

-- ---------- 3.9 reading_sessions ----------
create table if not exists public.reading_sessions (
  id uuid primary key default gen_random_uuid(),
  session_date date not null default current_date,
  book_id uuid null references public.books(id),
  minutes int null,
  pages int null,
  notes text null
);

-- ---------- 3.10 chess_sessions ----------
create table if not exists public.chess_sessions (
  id uuid primary key default gen_random_uuid(),
  session_date date not null default current_date,
  kind text not null check (kind in ('lesson','puzzles','game','study','review')),
  minutes int null,
  platform text null,
  topic text null,
  puzzles_solved int null,
  games_played int null,
  result text null check (result in ('win','loss','draw','mixed')),
  rating_after int null,
  notes text null
);

-- ---------- 3.11 settings — single row, id = 1 ----------
create table if not exists public.settings (
  id int primary key default 1 check (id = 1),
  display_name text not null default 'Tiffany',
  sleep_target_hours numeric(3,1) not null default 7.5,
  sleep_target_min numeric(3,1) not null default 7.0,
  sleep_target_max numeric(3,1) not null default 8.0,
  protein_target_g int not null default 120,
  water_target_oz int not null default 80,
  meditation_target_min int not null default 10,
  walk_target_min int not null default 30,
  workout_target_days_per_week int not null default 7,
  supplement_target_doses int not null default 5,
  reading_target_min int not null default 20,
  chess_target_min int not null default 15,
  week_starts_on int not null default 1,
  theme text not null default 'system'
);

-- ---------- 3.12 milestones ----------
create table if not exists public.milestones (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('streak','total','first')),
  metric_key text not null,
  threshold int not null,
  achieved_on date not null default current_date,
  seen boolean not null default false
);

-- ============================================================
-- Row Level Security — single-user app, one authenticated user
-- ============================================================
alter table public.daily_entries      enable row level security;
alter table public.supplements        enable row level security;
alter table public.supplement_logs    enable row level security;
alter table public.quotes             enable row level security;
alter table public.quote_of_day       enable row level security;
alter table public.quote_reflections  enable row level security;
alter table public.plans              enable row level security;
alter table public.plan_items         enable row level security;
alter table public.plan_item_logs     enable row level security;
alter table public.books              enable row level security;
alter table public.reading_sessions   enable row level security;
alter table public.chess_sessions     enable row level security;
alter table public.settings           enable row level security;
alter table public.milestones         enable row level security;

create policy "single user full access" on public.daily_entries
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "single user full access" on public.supplements
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "single user full access" on public.supplement_logs
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "single user full access" on public.quotes
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "single user full access" on public.quote_of_day
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "single user full access" on public.quote_reflections
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "single user full access" on public.plans
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "single user full access" on public.plan_items
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "single user full access" on public.plan_item_logs
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "single user full access" on public.books
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "single user full access" on public.reading_sessions
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "single user full access" on public.chess_sessions
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "single user full access" on public.settings
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "single user full access" on public.milestones
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
