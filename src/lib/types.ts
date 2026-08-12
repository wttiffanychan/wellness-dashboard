// ============================================================
// Data contract — mirrors supabase/schema.sql exactly.
// UI code imports ONLY from src/lib/data.ts (the adapter).
// ============================================================

export type SupplementSlot = "afternoon" | "night" | "flexible";

export interface Supplement {
  id: number;
  name: string;
  dose_label: string | null;
  brand: string | null;
  slot: SupplementSlot;
  scheduled_time: string | null; // "12:00"
  counts_toward_target: boolean;
  is_active: boolean;
  sort_order: number;
}

export interface SupplementLog {
  log_date: string; // YYYY-MM-DD
  supplement_id: number;
  taken: boolean;
  taken_at: string | null;
}

export interface DailyEntry {
  entry_date: string; // YYYY-MM-DD — natural key
  mood: number | null; // 1–5
  energy: number | null; // 1–5
  weight_lb: number | null;
  meditation_done: boolean;
  meditation_minutes: number | null;
  meditation_session: string | null;
  sleep_hours: number | null;
  sleep_quality: number | null; // 1–5
  bedtime: string | null;
  wake_time: string | null;
  workout_done: boolean;
  workout_type: string | null;
  workout_minutes: number | null;
  workout_intensity: "light" | "moderate" | "hard" | null;
  walk_done: boolean;
  walk_minutes: number | null;
  walk_steps: number | null;
  protein_g: number | null;
  water_oz: number | null;
  day_note: string | null;
}

export type QuoteTheme =
  | "security"
  | "confidence"
  | "courage"
  | "calm"
  | "self-trust"
  | "discipline"
  | "gratitude";

export interface Quote {
  id: string;
  body: string;
  author: string | null;
  source: string | null;
  theme: QuoteTheme;
  is_favorite: boolean;
  times_shown: number;
  last_shown_on: string | null; // YYYY-MM-DD
  is_archived: boolean;
}

export interface QuoteOfDay {
  qod_date: string;
  quote_id: string;
}

export interface QuoteReflection {
  id: string;
  quote_id: string;
  reflection_date: string;
  body: string;
}

export interface Plan {
  id: string;
  title: string;
  subtitle: string | null;
  cadence: "daily" | "weekly";
  pillar: "body" | "mind" | "fuel" | "rest" | "craft";
  accent_color: string | null;
  icon: string | null;
  is_active: boolean;
  sort_order: number;
}

export interface PlanItem {
  id: string;
  plan_id: string;
  label: string;
  time_of_day: "morning" | "midday" | "evening" | "anytime";
  target_value: number | null;
  unit: string | null;
  days_of_week: number[] | null; // 1=Mon…7=Sun
  linked_metric: string | null; // e.g. 'walk_done', 'supplements_afternoon'
  sort_order: number;
}

export interface PlanItemLog {
  log_date: string;
  plan_item_id: string;
  done: boolean;
}

export interface Book {
  id: string;
  title: string;
  author: string | null;
  total_pages: number | null;
  current_page: number;
  status: "reading" | "finished" | "want" | "abandoned";
  started_on: string | null;
  finished_on: string | null;
  rating: number | null;
  spine_color: string | null;
  notes: string | null;
}

export interface ReadingSession {
  id: string;
  session_date: string;
  book_id: string | null;
  minutes: number | null;
  pages: number | null;
  notes: string | null;
}

export type ChessKind = "lesson" | "puzzles" | "game" | "study" | "review";

export interface ChessSession {
  id: string;
  session_date: string;
  kind: ChessKind;
  minutes: number | null;
  platform: string | null;
  topic: string | null;
  puzzles_solved: number | null;
  games_played: number | null;
  result: "win" | "loss" | "draw" | "mixed" | null;
  rating_after: number | null;
  notes: string | null;
}

export interface Settings {
  display_name: string;
  sleep_target_hours: number;
  sleep_target_min: number;
  sleep_target_max: number;
  protein_target_g: number;
  water_target_oz: number;
  meditation_target_min: number;
  walk_target_min: number;
  workout_target_days_per_week: number;
  supplement_target_doses: number;
  reading_target_min: number;
  chess_target_min: number;
  week_starts_on: number; // 1=Mon
  theme: "system" | "light" | "dark";
}

export interface Milestone {
  id: string;
  kind: "streak" | "total" | "first";
  metric_key: string;
  threshold: number;
  achieved_on: string;
  seen: boolean;
}

// --- the ten tracked metrics (SPEC §4) ---
export const METRICS = [
  { key: "meditation", label: "Meditation", unit: "min", color: "var(--m-mind)", ring: true },
  { key: "sleep", label: "Sleep", unit: "h", color: "var(--m-sleep)", ring: true },
  { key: "workout", label: "Workout", unit: "", color: "var(--m-move)", ring: true },
  { key: "walk", label: "Walking", unit: "min", color: "var(--m-walk)", ring: true },
  { key: "protein", label: "Protein", unit: "g", color: "var(--m-fuel)", ring: true },
  { key: "water", label: "Water", unit: "oz", color: "var(--m-water)", ring: true },
  { key: "supplements", label: "Supplements", unit: "", color: "var(--m-supp)", ring: true },
  { key: "reading", label: "Reading", unit: "min", color: "var(--m-read)", ring: true },
  { key: "chess", label: "Chess", unit: "min", color: "var(--m-chess)", ring: false },
  { key: "mood", label: "Mood", unit: "", color: "var(--m-mood)", ring: false },
] as const;
