// ============================================================
// Data adapter — LOCAL (localStorage) implementation.
// UI imports ONLY from here (and types.ts). Every function is
// async so the Supabase adapter can replace this file 1:1.
// ============================================================
import type {
  Book,
  ChessSession,
  DailyEntry,
  Plan,
  PlanItem,
  PlanItemLog,
  Quote,
  QuoteOfDay,
  QuoteReflection,
  ReadingSession,
  Settings,
  Supplement,
  SupplementLog,
} from "./types";

const K = {
  entries: "wd.daily_entries",
  supplements: "wd.supplements",
  supplementLogs: "wd.supplement_logs",
  quotes: "wd.quotes",
  qod: "wd.quote_of_day",
  reflections: "wd.quote_reflections",
  plans: "wd.plans",
  planItems: "wd.plan_items",
  planItemLogs: "wd.plan_item_logs",
  books: "wd.books",
  readingSessions: "wd.reading_sessions",
  chessSessions: "wd.chess_sessions",
  settings: "wd.settings",
} as const;

function load<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function save<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

const today = () => new Date().toISOString().slice(0, 10);

// ---------- seed data (mirrors supabase/seed.sql) ----------
const SEED_SUPPLEMENTS: Supplement[] = [
  { id: 1, name: "Creatine", dose_label: "5 g", brand: null, slot: "afternoon", scheduled_time: "12:00", counts_toward_target: true, is_active: true, sort_order: 1 },
  { id: 2, name: "Krill Oil", dose_label: "per label", brand: "Sports Research", slot: "afternoon", scheduled_time: "12:00", counts_toward_target: true, is_active: true, sort_order: 2 },
  { id: 3, name: "TMG", dose_label: "2 capsules", brand: null, slot: "afternoon", scheduled_time: "12:00", counts_toward_target: true, is_active: true, sort_order: 3 },
  { id: 4, name: "Creatine", dose_label: "5 g", brand: null, slot: "night", scheduled_time: "22:00", counts_toward_target: true, is_active: true, sort_order: 4 },
  { id: 5, name: "Collagen", dose_label: "20 mg", brand: null, slot: "night", scheduled_time: "22:00", counts_toward_target: true, is_active: true, sort_order: 5 },
  { id: 6, name: "B12 Complex", dose_label: "per label", brand: null, slot: "flexible", scheduled_time: null, counts_toward_target: false, is_active: true, sort_order: 6 },
  { id: 7, name: "Vitamin D", dose_label: "per label", brand: null, slot: "flexible", scheduled_time: null, counts_toward_target: false, is_active: true, sort_order: 7 },
];

const SEED_QUOTES: Quote[] = [
  { id: "q01", body: "No one can make you feel inferior without your consent.", author: "Eleanor Roosevelt", source: null, theme: "security", is_favorite: false, times_shown: 0, last_shown_on: null, is_archived: false },
  { id: "q02", body: "You yourself, as much as anybody in the entire universe, deserve your love and affection.", author: "Buddha", source: null, theme: "security", is_favorite: false, times_shown: 0, last_shown_on: null, is_archived: false },
  { id: "q03", body: "I am not what happened to me, I am what I choose to become.", author: "Carl Jung", source: null, theme: "security", is_favorite: false, times_shown: 0, last_shown_on: null, is_archived: false },
  { id: "q04", body: "You are allowed to take up space in rooms you earned your way into.", author: null, source: null, theme: "security", is_favorite: false, times_shown: 0, last_shown_on: null, is_archived: false },
  { id: "q05", body: "You do not have to earn rest. You were never on trial for existing.", author: null, source: null, theme: "security", is_favorite: false, times_shown: 0, last_shown_on: null, is_archived: false },
  { id: "q06", body: "I can be changed by what happens to me. But I refuse to be reduced by it.", author: "Maya Angelou", source: "Letter to My Daughter", theme: "confidence", is_favorite: false, times_shown: 0, last_shown_on: null, is_archived: false },
  { id: "q07", body: "Courage is the most important of all the virtues because without courage, you can't practice any other virtue consistently.", author: "Maya Angelou", source: null, theme: "courage", is_favorite: false, times_shown: 0, last_shown_on: null, is_archived: false },
  { id: "q08", body: "It is not the critic who counts; the credit belongs to the man who is actually in the arena.", author: "Theodore Roosevelt", source: "Citizenship in a Republic", theme: "courage", is_favorite: false, times_shown: 0, last_shown_on: null, is_archived: false },
  { id: "q09", body: "You gain strength, courage and confidence by every experience in which you really stop to look fear in the face.", author: "Eleanor Roosevelt", source: null, theme: "confidence", is_favorite: false, times_shown: 0, last_shown_on: null, is_archived: false },
  { id: "q10", body: "Trust yourself. You know more than you think you do.", author: "Benjamin Spock", source: null, theme: "self-trust", is_favorite: false, times_shown: 0, last_shown_on: null, is_archived: false },
  { id: "q11", body: "The question isn't who is going to let me; it's who is going to stop me.", author: "Ayn Rand", source: null, theme: "confidence", is_favorite: false, times_shown: 0, last_shown_on: null, is_archived: false },
  { id: "q12", body: "Confidence is not 'they will like me'; confidence is 'I will be fine if they don't'.", author: "Christina Grimmie", source: null, theme: "confidence", is_favorite: false, times_shown: 0, last_shown_on: null, is_archived: false },
  { id: "q13", body: "You have been assigned this mountain to show others it can be moved.", author: null, source: null, theme: "confidence", is_favorite: false, times_shown: 0, last_shown_on: null, is_archived: false },
  { id: "q14", body: "The best way to find yourself is to lose yourself in the service of others.", author: "Mahatma Gandhi", source: null, theme: "security", is_favorite: false, times_shown: 0, last_shown_on: null, is_archived: false },
  { id: "q15", body: "Courage is not the absence of fear, but the triumph over it.", author: "Nelson Mandela", source: null, theme: "courage", is_favorite: false, times_shown: 0, last_shown_on: null, is_archived: false },
  { id: "q16", body: "Life shrinks or expands in proportion to one's courage.", author: "Anaïs Nin", source: null, theme: "courage", is_favorite: false, times_shown: 0, last_shown_on: null, is_archived: false },
  { id: "q17", body: "Whatever you are, be a good one.", author: "Abraham Lincoln", source: null, theme: "confidence", is_favorite: false, times_shown: 0, last_shown_on: null, is_archived: false },
  { id: "q18", body: "Do not wait for the perfect moment; take the moment and make it perfect.", author: null, source: null, theme: "confidence", is_favorite: false, times_shown: 0, last_shown_on: null, is_archived: false },
  { id: "q19", body: "What lies behind us and what lies before us are tiny matters compared to what lies within us.", author: "Ralph Waldo Emerson", source: null, theme: "security", is_favorite: false, times_shown: 0, last_shown_on: null, is_archived: false },
  { id: "q20", body: "The strongest people are not those who show strength in front of us, but those who win battles we know nothing about.", author: null, source: null, theme: "security", is_favorite: false, times_shown: 0, last_shown_on: null, is_archived: false },
  { id: "q21", body: "Your presence is not a problem to be solved. You are not too much, and you are not too little.", author: null, source: null, theme: "security", is_favorite: false, times_shown: 0, last_shown_on: null, is_archived: false },
  { id: "q22", body: "Your voice is not too loud. Your ideas are not too big. Say them anyway.", author: null, source: null, theme: "confidence", is_favorite: false, times_shown: 0, last_shown_on: null, is_archived: false },
  { id: "q23", body: "You can, you should, and if you're brave enough to start, you will.", author: "Stephen King", source: "On Writing", theme: "courage", is_favorite: false, times_shown: 0, last_shown_on: null, is_archived: false },
  { id: "q24", body: "Almost everything will work again if you unplug it for a few minutes, including you.", author: "Anne Lamott", source: null, theme: "calm", is_favorite: false, times_shown: 0, last_shown_on: null, is_archived: false },
  { id: "q25", body: "Quiet the mind, and the soul will speak.", author: "Ma Jaya Sati Bhagavati", source: null, theme: "calm", is_favorite: false, times_shown: 0, last_shown_on: null, is_archived: false },
  { id: "q26", body: "Breath is the bridge which connects life to consciousness.", author: "Thich Nhat Hanh", source: null, theme: "calm", is_favorite: false, times_shown: 0, last_shown_on: null, is_archived: false },
  { id: "q27", body: "Nothing in nature lives its life best by rushing. Neither do you.", author: null, source: null, theme: "calm", is_favorite: false, times_shown: 0, last_shown_on: null, is_archived: false },
  { id: "q28", body: "You do not need to be busy to be worthy. Stillness is not empty time; it is where you return to yourself.", author: null, source: null, theme: "calm", is_favorite: false, times_shown: 0, last_shown_on: null, is_archived: false },
  { id: "q29", body: "The moment you doubt whether you can fly, you cease forever to be able to do it.", author: "J.M. Barrie", source: "Peter Pan", theme: "self-trust", is_favorite: false, times_shown: 0, last_shown_on: null, is_archived: false },
  { id: "q30", body: "When you recover or discover something that nourishes your soul and brings joy, care enough about yourself to make room for it in your life.", author: "Jean Shinoda Bolen", source: null, theme: "self-trust", is_favorite: false, times_shown: 0, last_shown_on: null, is_archived: false },
  { id: "q31", body: "Your intuition is a quiet knowing that never argues. Learn to listen before it stops speaking.", author: null, source: null, theme: "self-trust", is_favorite: false, times_shown: 0, last_shown_on: null, is_archived: false },
  { id: "q32", body: "You have survived every single day you thought you couldn't. That is not luck. That is you.", author: null, source: null, theme: "self-trust", is_favorite: false, times_shown: 0, last_shown_on: null, is_archived: false },
  { id: "q33", body: "Self-trust is built in small promises kept to yourself, one at a time.", author: null, source: null, theme: "self-trust", is_favorite: false, times_shown: 0, last_shown_on: null, is_archived: false },
  { id: "q34", body: "Bravery is not the absence of fear. It is showing up with the fear still in the room.", author: null, source: null, theme: "courage", is_favorite: false, times_shown: 0, last_shown_on: null, is_archived: false },
  { id: "q35", body: "The world has already seen the version of you that hesitates. Show them the one that doesn't.", author: null, source: null, theme: "confidence", is_favorite: false, times_shown: 0, last_shown_on: null, is_archived: false },
  { id: "q36", body: "You don't need permission to begin. The seat at the table was always yours.", author: null, source: null, theme: "confidence", is_favorite: false, times_shown: 0, last_shown_on: null, is_archived: false },
  { id: "q37", body: "What if you stopped negotiating with yourself and just walked in?", author: null, source: null, theme: "confidence", is_favorite: false, times_shown: 0, last_shown_on: null, is_archived: false },
  { id: "q38", body: "Being safe in your own body begins with being honest about what you need.", author: null, source: null, theme: "security", is_favorite: false, times_shown: 0, last_shown_on: null, is_archived: false },
  { id: "q39", body: "You are the only person who gets to decide what your 'enough' looks like.", author: null, source: null, theme: "security", is_favorite: false, times_shown: 0, last_shown_on: null, is_archived: false },
  { id: "q40", body: "Softness is not weakness. It is a quiet form of power that knows it does not need to prove anything.", author: null, source: null, theme: "security", is_favorite: false, times_shown: 0, last_shown_on: null, is_archived: false },
];

const SEED_SETTINGS: Settings = {
  display_name: "Tiffany",
  sleep_target_hours: 7.5,
  sleep_target_min: 7.0,
  sleep_target_max: 8.0,
  protein_target_g: 120,
  water_target_oz: 80,
  meditation_target_min: 10,
  walk_target_min: 30,
  workout_target_days_per_week: 7,
  supplement_target_doses: 5,
  reading_target_min: 20,
  chess_target_min: 15,
  week_starts_on: 1,
  theme: "system",
};

// ---------- seeding on first load ----------
export function ensureSeeded() {
  if (typeof window === "undefined") return;
  if (!localStorage.getItem(K.supplements)) save(K.supplements, SEED_SUPPLEMENTS);
  if (!localStorage.getItem(K.quotes)) save(K.quotes, SEED_QUOTES);
  if (!localStorage.getItem(K.settings)) save(K.settings, SEED_SETTINGS);
  if (!localStorage.getItem(K.entries)) save(K.entries, [] as DailyEntry[]);
  if (!localStorage.getItem(K.supplementLogs)) save(K.supplementLogs, [] as SupplementLog[]);
  if (!localStorage.getItem(K.qod)) save(K.qod, [] as QuoteOfDay[]);
  if (!localStorage.getItem(K.reflections)) save(K.reflections, [] as QuoteReflection[]);
  if (!localStorage.getItem(K.plans)) save(K.plans, [] as Plan[]);
  if (!localStorage.getItem(K.planItems)) save(K.planItems, [] as PlanItem[]);
  if (!localStorage.getItem(K.planItemLogs)) save(K.planItemLogs, [] as PlanItemLog[]);
  if (!localStorage.getItem(K.books)) save(K.books, [] as Book[]);
  if (!localStorage.getItem(K.readingSessions)) save(K.readingSessions, [] as ReadingSession[]);
  if (!localStorage.getItem(K.chessSessions)) save(K.chessSessions, [] as ChessSession[]);
}

// ---------- daily entries ----------
export async function getEntry(date: string): Promise<DailyEntry | null> {
  const entries = load<DailyEntry[]>(K.entries, []);
  return entries.find((e) => e.entry_date === date) ?? null;
}

export async function upsertEntry(entry: DailyEntry): Promise<void> {
  const entries = load<DailyEntry[]>(K.entries, []);
  const i = entries.findIndex((e) => e.entry_date === entry.entry_date);
  if (i >= 0) entries[i] = entry;
  else entries.push(entry);
  save(K.entries, entries);
}

export async function getEntries(since: string): Promise<DailyEntry[]> {
  const entries = load<DailyEntry[]>(K.entries, []);
  return entries.filter((e) => e.entry_date >= since).sort((a, b) => a.entry_date.localeCompare(b.entry_date));
}

// ---------- supplements ----------
export async function getSupplements(): Promise<Supplement[]> {
  return load<Supplement[]>(K.supplements, []).filter((s) => s.is_active);
}

export async function getSupplementLogs(date: string): Promise<SupplementLog[]> {
  return load<SupplementLog[]>(K.supplementLogs, []).filter((l) => l.log_date === date);
}

export async function setSupplementTaken(date: string, supplementId: number, taken: boolean): Promise<void> {
  const logs = load<SupplementLog[]>(K.supplementLogs, []);
  const i = logs.findIndex((l) => l.log_date === date && l.supplement_id === supplementId);
  const entry: SupplementLog = {
    log_date: date,
    supplement_id: supplementId,
    taken,
    taken_at: taken ? new Date().toISOString() : null,
  };
  if (i >= 0) logs[i] = entry;
  else logs.push(entry);
  save(K.supplementLogs, logs);
}

// ---------- quotes ----------
export async function getQuotes(): Promise<Quote[]> {
  return load<Quote[]>(K.quotes, []).filter((q) => !q.is_archived);
}

export async function getQuoteOfDay(date: string): Promise<Quote | null> {
  const qod = load<QuoteOfDay[]>(K.qod, []);
  const pick = qod.find((q) => q.qod_date === date);
  if (pick) {
    const quotes = load<Quote[]>(K.quotes, []);
    return quotes.find((q) => q.id === pick.quote_id) ?? null;
  }
  return null;
}

export async function assignQuoteOfDay(date: string): Promise<Quote | null> {
  const quotes = load<Quote[]>(K.quotes, []).filter((q) => !q.is_archived);
  if (quotes.length === 0) return null;
  // rotation: exclude last-30-days shown, weight favorites 2x, oldest last_shown first
  const cutoff = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const eligible = quotes.filter((q) => !q.last_shown_on || q.last_shown_on < cutoff);
  const pool = eligible.length >= 3 ? eligible : quotes.filter((q) => !q.last_shown_on || q.last_shown_on < new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10));
  const candidates = (pool.length >= 3 ? pool : quotes).sort((a, b) => {
    const aFav = a.is_favorite ? -1 : 0;
    const bFav = b.is_favorite ? -1 : 0;
    const aDate = a.last_shown_on ?? "0000";
    const bDate = b.last_shown_on ?? "0000";
    return aFav - bFav || aDate.localeCompare(bDate);
  });
  const pick = candidates[Math.floor(Math.random() * Math.min(candidates.length, 5))];
  pick.times_shown += 1;
  pick.last_shown_on = date;
  save(K.quotes, quotes.map((q) => (q.id === pick.id ? pick : q)));
  const qod = load<QuoteOfDay[]>(K.qod, []);
  qod.push({ qod_date: date, quote_id: pick.id });
  save(K.qod, qod);
  return pick;
}

export async function setQuoteFavorite(id: string, favorite: boolean): Promise<void> {
  const quotes = load<Quote[]>(K.quotes, []);
  save(K.quotes, quotes.map((q) => (q.id === id ? { ...q, is_favorite: favorite } : q)));
}

export async function addQuote(quote: Omit<Quote, "id" | "times_shown" | "last_shown_on" | "is_archived">): Promise<void> {
  const quotes = load<Quote[]>(K.quotes, []);
  quotes.push({ ...quote, id: `q${Date.now()}`, times_shown: 0, last_shown_on: null, is_archived: false });
  save(K.quotes, quotes);
}

export async function getReflections(quoteId: string): Promise<QuoteReflection[]> {
  return load<QuoteReflection[]>(K.reflections, []).filter((r) => r.quote_id === quoteId);
}

export async function addReflection(quoteId: string, body: string): Promise<void> {
  const reflections = load<QuoteReflection[]>(K.reflections, []);
  reflections.push({ id: `r${Date.now()}`, quote_id: quoteId, reflection_date: today(), body });
  save(K.reflections, reflections);
}

// ---------- settings ----------
export async function getSettings(): Promise<Settings> {
  return load<Settings>(K.settings, SEED_SETTINGS);
}

export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  const current = await getSettings();
  const next = { ...current, ...patch };
  save(K.settings, next);
  return next;
}

// ---------- plans ----------
export async function getPlans(): Promise<Plan[]> {
  return load<Plan[]>(K.plans, []).filter((p) => p.is_active);
}

export async function getPlanItems(planId: string): Promise<PlanItem[]> {
  return load<PlanItem[]>(K.planItems, []).filter((i) => i.plan_id === planId).sort((a, b) => a.sort_order - b.sort_order);
}

export async function setPlanItemDone(date: string, planItemId: string, done: boolean): Promise<void> {
  const logs = load<PlanItemLog[]>(K.planItemLogs, []);
  const i = logs.findIndex((l) => l.log_date === date && l.plan_item_id === planItemId);
  if (i >= 0) logs[i] = { ...logs[i], done };
  else logs.push({ log_date: date, plan_item_id: planItemId, done });
  save(K.planItemLogs, logs);
}

// ---------- books & reading ----------
export async function getBooks(): Promise<Book[]> {
  return load<Book[]>(K.books, []);
}

export async function addReadingSession(session: Omit<ReadingSession, "id">): Promise<void> {
  const sessions = load<ReadingSession[]>(K.readingSessions, []);
  sessions.push({ ...session, id: `rs${Date.now()}` });
  save(K.readingSessions, sessions);
}

export async function getReadingSessions(): Promise<ReadingSession[]> {
  return load<ReadingSession[]>(K.readingSessions, []);
}

// ---------- chess ----------
export async function addChessSession(session: Omit<ChessSession, "id">): Promise<void> {
  const sessions = load<ChessSession[]>(K.chessSessions, []);
  sessions.push({ ...session, id: `cs${Date.now()}` });
  save(K.chessSessions, sessions);
}

export async function getChessSessions(): Promise<ChessSession[]> {
  return load<ChessSession[]>(K.chessSessions, []);
}

// ---------- today's aggregate for the Today page ----------
export async function getTodayState() {
  const d = today();
  const entry = (await getEntry(d)) ?? {
    entry_date: d,
    mood: null,
    energy: null,
    weight_lb: null,
    meditation_done: false,
    meditation_minutes: null,
    meditation_session: null,
    sleep_hours: null,
    sleep_quality: null,
    bedtime: null,
    wake_time: null,
    workout_done: false,
    workout_type: null,
    workout_minutes: null,
    workout_intensity: null,
    walk_done: false,
    walk_minutes: null,
    walk_steps: null,
    protein_g: null,
    water_oz: null,
    day_note: null,
  };
  const supplements = await getSupplements();
  const logs = await getSupplementLogs(d);
  const supplementsDone = logs.filter((l) => l.taken).length;
  const supplementsTarget = (await getSettings()).supplement_target_doses;
  const quote = (await getQuoteOfDay(d)) ?? (await assignQuoteOfDay(d));
  return { date: d, entry, supplements, supplementLogs: logs, supplementsDone, supplementsTarget, quote };
}
