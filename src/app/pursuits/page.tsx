"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  CalendarDays,
  Clock,
  Flame,
  Star,
  X,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Line,
  LineChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  addChessSession,
  addReadingSession,
  getBooks,
  getChessSessions,
  getReadingSessions,
} from "@/lib/data";
import type {
  Book,
  ChessKind,
  ChessSession,
  ReadingSession,
} from "@/lib/types";

// ---------- date helpers (UTC, mirroring the data adapter) ----------
const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const todayIso = () => isoDay(new Date());
const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
};
const startOfWeek = (d: Date) => {
  const x = new Date(d);
  const dow = (x.getUTCDay() + 6) % 7; // Monday = 0
  x.setUTCDate(x.getUTCDate() - dow);
  x.setUTCHours(0, 0, 0, 0);
  return x;
};
const fmtDate = (iso: string) =>
  new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

const numOrNull = (s: string): number | null => {
  if (s.trim() === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};
const strOrNull = (s: string): string | null =>
  s.trim() === "" ? null : s.trim();

const SPINE_FALLBACK = [
  "var(--m-read)",
  "var(--m-move)",
  "var(--m-sleep)",
  "var(--m-mind)",
  "var(--m-fuel)",
  "var(--m-water)",
  "var(--m-supp)",
  "var(--m-chess)",
];
const spineColor = (b: Book, i: number) =>
  b.spine_color ?? SPINE_FALLBACK[i % SPINE_FALLBACK.length];

const KIND_OPTIONS: { value: ChessKind; label: string }[] = [
  { value: "lesson", label: "Lesson" },
  { value: "puzzles", label: "Puzzles" },
  { value: "game", label: "Game" },
  { value: "study", label: "Study" },
  { value: "review", label: "Review" },
];
const RESULT_OPTIONS: { value: NonNullable<ChessSession["result"]>; label: string }[] = [
  { value: "win", label: "Win" },
  { value: "loss", label: "Loss" },
  { value: "draw", label: "Draw" },
  { value: "mixed", label: "Mixed" },
];

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const fn = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);
  return reduced;
}

// ---------- small shared pieces ----------
function StatTile({
  label,
  value,
  unit,
  color,
  icon,
}: {
  label: string;
  value: string | number;
  unit?: string;
  color: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg bg-card p-4 ring-1 ring-foreground/10">
      <div className="flex items-center gap-1 text-[11px] tracking-[0.08em] uppercase text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-1.5 flex items-baseline gap-1">
        <span
          className="font-display text-2xl leading-none tabular"
          style={{ color }}
        >
          {value}
        </span>
        {unit && <span className="text-[13px] text-muted-foreground">{unit}</span>}
      </div>
    </div>
  );
}

function ChartTip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: {
    dataKey?: string | number;
    name?: string | number;
    value?: string | number;
    color?: string;
    fill?: string;
    payload?: { fill?: string };
  }[];
  label?: string | number;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg bg-card px-3 py-2 text-[12px] shadow-md ring-1 ring-foreground/10">
      {label != null && (
        <div className="mb-1 text-muted-foreground">{label}</div>
      )}
      {payload.map((p) => (
        <div
          key={String(p.dataKey ?? p.name)}
          className="flex items-center gap-2 text-foreground"
        >
          <span
            className="size-2 shrink-0 rounded-full"
            style={{ background: p.color || p.fill || p.payload?.fill }}
          />
          <span className="capitalize">{p.name ?? p.dataKey}</span>
          <span className="ml-auto pl-3 tabular">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

function EmptyCard({
  icon,
  message,
  actionLabel,
  onAction,
}: {
  icon: React.ReactNode;
  message: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="rounded-lg bg-card px-6 py-8 text-center ring-1 ring-foreground/10">
      <div className="mx-auto flex size-11 items-center justify-center rounded-full bg-muted text-ink-soft">
        {icon}
      </div>
      <p className="mt-3 font-display text-[17px] italic text-ink-soft">
        {message}
      </p>
      <Button
        type="button"
        variant="default"
        className="mt-4 h-11 rounded-full px-5"
        onClick={onAction}
      >
        {actionLabel}
      </Button>
    </div>
  );
}

// ---------- reading ----------
function ReadingLogForm({
  books,
  defaultBookId,
  onSave,
  onCancel,
}: {
  books: Book[];
  defaultBookId: string | null;
  onSave: (s: Omit<ReadingSession, "id">) => Promise<void>;
  onCancel: () => void;
}) {
  const [bookId, setBookId] = useState<string | null>(defaultBookId);
  const [minutes, setMinutes] = useState("");
  const [pages, setPages] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  return (
    <form
      className="mt-4 rounded-lg bg-surface-sunk p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        await onSave({
          session_date: todayIso(),
          book_id: bookId,
          minutes: numOrNull(minutes),
          pages: numOrNull(pages),
          notes: strOrNull(note),
        });
        setSaving(false);
      }}
    >
      {books.length > 0 && (
        <div className="mb-3">
          <Label className="mb-1.5 text-[13px] text-muted-foreground">
            Book
          </Label>
          <Select value={bookId ?? undefined} onValueChange={(v) => setBookId(v ?? null)}>
            <SelectTrigger className="h-10 w-full rounded-md">
              <SelectValue placeholder="No book" />
            </SelectTrigger>
            <SelectContent>
              {books.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="mb-1.5 text-[13px] text-muted-foreground">
            Minutes
          </Label>
          <Input
            inputMode="numeric"
            placeholder="25"
            className="h-10 rounded-md tabular"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
          />
        </div>
        <div>
          <Label className="mb-1.5 text-[13px] text-muted-foreground">
            Pages
          </Label>
          <Input
            inputMode="numeric"
            placeholder="18"
            className="h-10 rounded-md tabular"
            value={pages}
            onChange={(e) => setPages(e.target.value)}
          />
        </div>
      </div>
      <div className="mt-3">
        <Label className="mb-1.5 text-[13px] text-muted-foreground">
          Note <span className="text-ink-mute">(optional)</span>
        </Label>
        <Input
          placeholder="A quiet chapter…"
          className="h-10 rounded-md"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
      <div className="mt-4 flex items-center gap-2">
        <Button type="submit" disabled={saving} className="h-11 rounded-full px-5">
          {saving ? "Saving…" : "Save session"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="h-11 rounded-full px-4"
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

function ReadingTab({
  books,
  sessions,
  onAddSession,
}: {
  books: Book[];
  sessions: ReadingSession[];
  onAddSession: (s: Omit<ReadingSession, "id">) => Promise<void>;
}) {
  const [activeLog, setActiveLog] = useState<string | "new" | null>(null);

  const readingBooks = useMemo(
    () => books.filter((b) => b.status === "reading").slice(0, 3),
    [books]
  );
  const finishedBooks = useMemo(
    () =>
      books
        .filter((b) => b.status === "finished")
        .sort((a, b) => (b.finished_on ?? "").localeCompare(a.finished_on ?? "")),
    [books]
  );
  const [selectedSpine, setSelectedSpine] = useState<Book | null>(null);

  const monthPrefix = todayIso().slice(0, 7);
  const monthStats = useMemo(() => {
    const ms = sessions.filter((s) => s.session_date.startsWith(monthPrefix));
    return {
      minutes: ms.reduce((a, s) => a + (s.minutes ?? 0), 0),
      pages: ms.reduce((a, s) => a + (s.pages ?? 0), 0),
      days: new Set(ms.map((s) => s.session_date)).size,
    };
  }, [sessions, monthPrefix]);

  const weeks = useMemo(() => {
    const today = new Date();
    const start = startOfWeek(addDays(today, -29));
    const out: { label: string; pages: number }[] = [];
    for (let w = start; w <= today; w = addDays(w, 7)) {
      const ws = isoDay(w);
      const es = isoDay(addDays(w, 7));
      const pages = sessions
        .filter((s) => s.pages && s.session_date >= ws && s.session_date < es)
        .reduce((a, s) => a + (s.pages ?? 0), 0);
      out.push({ label: `${w.getUTCMonth() + 1}/${w.getUTCDate()}`, pages });
    }
    return out;
  }, [sessions]);

  const reduced = usePrefersReducedMotion();

  return (
    <div className="space-y-8">
      {/* ----- currently reading ----- */}
      <section>
        <h2 className="font-display text-[19px] leading-[1.35]">
          Currently reading
        </h2>
        {readingBooks.length === 0 ? (
          <div className="mt-3">
            {activeLog !== "new" ? (
              <EmptyCard
                icon={<BookOpen className="size-5" />}
                message="No book open right now."
                actionLabel="+ Start a book"
                onAction={() => setActiveLog("new")}
              />
            ) : (
              <ReadingLogForm
                books={books}
                defaultBookId={
                  books.find((b) => b.status === "reading")?.id ??
                  books[0]?.id ??
                  null
                }
                onSave={onAddSession}
                onCancel={() => setActiveLog(null)}
              />
            )}
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            {readingBooks.map((book) => {
              const open = activeLog === book.id;
              const pct = book.total_pages
                ? Math.min(
                    100,
                    Math.round((book.current_page / book.total_pages) * 100)
                  )
                : null;
              return (
                <div key={book.id}>
                  <Card className="rounded-lg shadow-sm">
                    <CardContent className="p-5">
                      <div className="flex gap-3">
                        <div
                          className="w-1.5 shrink-0 rounded-full"
                          style={{ background: spineColor(book, 0) }}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <h3 className="truncate font-display text-[17px] leading-snug">
                                {book.title}
                              </h3>
                              <p className="truncate text-sm text-muted-foreground">
                                {book.author ?? "Unknown author"}
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="shrink-0 rounded-full"
                              onClick={() =>
                                setActiveLog(open ? null : book.id)
                              }
                            >
                              + log session
                            </Button>
                          </div>
                          {pct != null ? (
                            <div className="mt-4">
                              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                                <div
                                  className="h-full rounded-full bg-m-read transition-[width] duration-500"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <div className="mt-2 flex items-center justify-between text-[13px]">
                                <span className="text-muted-foreground tabular">
                                  p. {book.current_page} / {book.total_pages}
                                </span>
                                <span className="font-medium text-m-read tabular">
                                  {pct}%
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="mt-3 text-[13px] text-muted-foreground tabular">
                              p. {book.current_page}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  {open && (
                    <ReadingLogForm
                      books={[]}
                      defaultBookId={book.id}
                      onSave={onAddSession}
                      onCancel={() => setActiveLog(null)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ----- this month ----- */}
      <section>
        <h2 className="font-display text-[19px] leading-[1.35]">This month</h2>
        <div className="mt-3 grid grid-cols-3 gap-3">
          <StatTile
            label="Minutes"
            value={monthStats.minutes}
            unit="min"
            color="var(--m-read)"
            icon={<Clock className="size-3 text-m-read" />}
          />
          <StatTile
            label="Pages"
            value={monthStats.pages}
            color="var(--m-read)"
            icon={<BookOpen className="size-3 text-m-read" />}
          />
          <StatTile
            label="Days read"
            value={monthStats.days}
            unit="d"
            color="var(--m-read)"
            icon={<CalendarDays className="size-3 text-m-read" />}
          />
        </div>
      </section>

      {/* ----- pages per week ----- */}
      <section>
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-[19px] leading-[1.35]">
            Pages per week
          </h2>
          <span className="text-[13px] text-muted-foreground">30 days</span>
        </div>
        <Card className="mt-3 rounded-lg shadow-sm">
          <CardContent className="p-4">
            {sessions.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Pages will grow here as you log sessions.
              </p>
            ) : (
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={weeks} margin={{ top: 6, right: 4, bottom: 0, left: -18 }}>
                    <defs>
                      <linearGradient id="readFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--m-read)" stopOpacity={0.28} />
                        <stop offset="95%" stopColor="var(--m-read)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "var(--ink-mute)", fontSize: 11 }}
                      tickMargin={8}
                    />
                    <YAxis
                      allowDecimals={false}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "var(--ink-mute)", fontSize: 11 }}
                      width={34}
                    />
                    <Tooltip
                      content={<ChartTip />}
                      cursor={{ stroke: "var(--hairline)", strokeDasharray: "3 3" }}
                    />
                    <Area
                      type="monotone"
                      dataKey="pages"
                      name="pages"
                      stroke="var(--m-read)"
                      strokeWidth={2}
                      fill="url(#readFill)"
                      animationDuration={700}
                      isAnimationActive={!reduced}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ----- finished shelf ----- */}
      <section>
        <h2 className="font-display text-[19px] leading-[1.35]">Finished</h2>
        {finishedBooks.length === 0 ? (
          <p className="mt-3 rounded-lg bg-card px-5 py-6 text-center text-sm text-muted-foreground ring-1 ring-foreground/10">
            The shelf is waiting for its first finished book.
          </p>
        ) : (
          <div className="mt-3">
            <div className="flex gap-3 overflow-x-auto rounded-lg bg-card p-4 ring-1 ring-foreground/10">
              {finishedBooks.map((book, i) => (
                <button
                  key={book.id}
                  type="button"
                  onClick={() =>
                    setSelectedSpine(selectedSpine?.id === book.id ? null : book)
                  }
                  aria-label={`${book.title} by ${book.author ?? "unknown"}`}
                  className={cn(
                    "flex h-36 w-7 shrink-0 flex-col items-center justify-start rounded-sm pt-3 transition-transform duration-200 hover:scale-[1.04] active:scale-95",
                    selectedSpine?.id === book.id && "ring-2 ring-accent ring-offset-2 ring-offset-card"
                  )}
                  style={{ background: spineColor(book, i) }}
                >
                  <span
                    className="max-h-[120px] w-full overflow-hidden text-center text-[10px] leading-tight font-medium tracking-[0.08em] uppercase"
                    style={{
                      writingMode: "vertical-rl",
                      color: "var(--canvas)",
                    }}
                  >
                    {book.title}
                  </span>
                </button>
              ))}
            </div>
            {selectedSpine && (
              <div className="mt-3 rounded-lg bg-surface-sunk p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-display text-[17px] leading-snug">
                      {selectedSpine.title}
                    </h3>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {selectedSpine.author ?? "Unknown author"}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Close"
                    onClick={() => setSelectedSpine(null)}
                  >
                    <X />
                  </Button>
                </div>
                <p className="mt-2 text-[13px] text-muted-foreground tabular">
                  {selectedSpine.started_on
                    ? `${fmtDate(selectedSpine.started_on)} — `
                    : ""}
                  {selectedSpine.finished_on
                    ? fmtDate(selectedSpine.finished_on)
                    : "finished"}
                </p>
                {selectedSpine.rating != null && (
                  <p className="mt-1.5 flex items-center gap-1 text-[13px]">
                    <Star className="size-3.5 fill-accent text-accent" />
                    <span className="tabular">{selectedSpine.rating}/5</span>
                  </p>
                )}
                {selectedSpine.notes && (
                  <p className="mt-2 text-sm text-ink-soft italic">
                    {selectedSpine.notes}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

// ---------- chess ----------
function ChessLogForm({
  onSave,
}: {
  onSave: (s: Omit<ChessSession, "id">) => Promise<void>;
}) {
  const [kind, setKind] = useState<ChessKind>("game");
  const [minutes, setMinutes] = useState("");
  const [platform, setPlatform] = useState("");
  const [topic, setTopic] = useState("");
  const [puzzles, setPuzzles] = useState("");
  const [games, setGames] = useState("");
  const [result, setResult] = useState<ChessSession["result"]>(null);
  const [rating, setRating] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  return (
    <form
      className="rounded-lg bg-card p-5 shadow-sm ring-1 ring-foreground/10"
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        await onSave({
          session_date: todayIso(),
          kind,
          minutes: numOrNull(minutes),
          platform: strOrNull(platform),
          topic: strOrNull(topic),
          puzzles_solved: numOrNull(puzzles),
          games_played: numOrNull(games),
          result,
          rating_after: numOrNull(rating),
          notes: strOrNull(notes),
        });
        setSaving(false);
      }}
    >
      <Label className="mb-1.5 block text-[13px] text-muted-foreground">
        Kind
      </Label>
      <div className="flex w-full gap-1 rounded-md bg-muted p-1">
        {KIND_OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => setKind(o.value)}
            className={cn(
              "h-9 flex-1 rounded-[6px] text-[12px] font-medium transition-colors",
              kind === o.value
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {o.label}
          </button>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <Label className="mb-1.5 text-[13px] text-muted-foreground">
            Minutes
          </Label>
          <Input
            inputMode="numeric"
            placeholder="20"
            className="h-10 rounded-md tabular"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
          />
        </div>
        <div>
          <Label className="mb-1.5 text-[13px] text-muted-foreground">
            Platform
          </Label>
          <Input
            placeholder="chess.com"
            className="h-10 rounded-md"
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
          />
        </div>
        <div>
          <Label className="mb-1.5 text-[13px] text-muted-foreground">
            Topic
          </Label>
          <Input
            placeholder="Italian Game"
            className="h-10 rounded-md"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
          />
        </div>
        <div>
          <Label className="mb-1.5 text-[13px] text-muted-foreground">
            Puzzles solved
          </Label>
          <Input
            inputMode="numeric"
            placeholder="12"
            className="h-10 rounded-md tabular"
            value={puzzles}
            onChange={(e) => setPuzzles(e.target.value)}
          />
        </div>
        <div>
          <Label className="mb-1.5 text-[13px] text-muted-foreground">
            Games played
          </Label>
          <Input
            inputMode="numeric"
            placeholder="3"
            className="h-10 rounded-md tabular"
            value={games}
            onChange={(e) => setGames(e.target.value)}
          />
        </div>
        <div>
          <Label className="mb-1.5 text-[13px] text-muted-foreground">
            Rating after
          </Label>
          <Input
            inputMode="numeric"
            placeholder="1240"
            className="h-10 rounded-md tabular"
            value={rating}
            onChange={(e) => setRating(e.target.value)}
          />
        </div>
      </div>

      <Label className="mt-4 mb-1.5 block text-[13px] text-muted-foreground">
        Result <span className="text-ink-mute">(optional)</span>
      </Label>
      <div className="flex w-full gap-1 rounded-md bg-muted p-1">
        {RESULT_OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => setResult(result === o.value ? null : o.value)}
            className={cn(
              "h-9 flex-1 rounded-[6px] text-[12px] font-medium transition-colors",
              result === o.value
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {o.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        <Label className="mb-1.5 text-[13px] text-muted-foreground">
          Notes <span className="text-ink-mute">(optional)</span>
        </Label>
        <Input
          placeholder="Missed a tactic, loved the endgame…"
          className="h-10 rounded-md"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <div className="mt-4 flex items-center gap-2">
        <Button type="submit" disabled={saving} className="h-11 rounded-full px-5">
          {saving ? "Saving…" : "Save session"}
        </Button>
        <p className="text-[13px] text-muted-foreground">
          Multiple per day are fine.
        </p>
      </div>
    </form>
  );
}

function ChessTab({
  sessions,
  onAddSession,
}: {
  sessions: ChessSession[];
  onAddSession: (s: Omit<ChessSession, "id">) => Promise<void>;
}) {
  const reduced = usePrefersReducedMotion();

  const weekStart = isoDay(startOfWeek(new Date()));
  const weekSessions = useMemo(
    () => sessions.filter((s) => s.session_date >= weekStart),
    [sessions, weekStart]
  );
  const minutesThisWeek = weekSessions.reduce((a, s) => a + (s.minutes ?? 0), 0);

  const streak = useMemo(() => {
    const days = new Set(sessions.map((s) => s.session_date));
    let n = 0;
    let d = new Date();
    if (!days.has(isoDay(d))) d = addDays(d, -1); // don't break a live streak
    while (days.has(isoDay(d))) {
      n += 1;
      d = addDays(d, -1);
    }
    return n;
  }, [sessions]);

  const ratingPoints = useMemo(
    () =>
      sessions
        .filter((s) => s.rating_after != null)
        .sort(
          (a, b) =>
            a.session_date.localeCompare(b.session_date) ||
            a.id.localeCompare(b.id)
        )
        .map((s) => ({ date: fmtDate(s.session_date), rating: s.rating_after! })),
    [sessions]
  );
  const allTimeHigh = ratingPoints.length
    ? ratingPoints.reduce((m, p) => (p.rating > m.rating ? p : m))
    : null;

  const since30 = isoDay(addDays(new Date(), -29));
  const mix = useMemo(() => {
    const sums = {
      lesson: 0,
      puzzles: 0,
      game: 0,
      study: 0,
      review: 0,
    } as Record<ChessKind, number>;
    for (const s of sessions) {
      if (s.session_date >= since30 && s.minutes) sums[s.kind] += s.minutes;
    }
    return sums;
  }, [sessions, since30]);
  const mixTotal = Object.values(mix).reduce((a, b) => a + b, 0);
  const mixData = [{ name: "mix", ...mix }];
  const MIX_OPACITY: Record<ChessKind, number> = {
    lesson: 0.32,
    puzzles: 0.5,
    game: 0.68,
    study: 0.85,
    review: 1,
  };
  const mixOrder: ChessKind[] = ["lesson", "puzzles", "game", "study", "review"];

  const topics = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of sessions) {
      if (s.session_date >= since30 && s.topic) {
        const t = s.topic.trim();
        if (t) counts.set(t, (counts.get(t) ?? 0) + 1);
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [sessions, since30]);

  return (
    <div className="space-y-8">
      {/* ----- streak + this week ----- */}
      <section>
        <h2 className="font-display text-[19px] leading-[1.35]">
          This week
        </h2>
        <div className="mt-3 grid grid-cols-3 gap-3">
          <StatTile
            label="Sessions"
            value={weekSessions.length}
            color="var(--m-chess)"
            icon={<CalendarDays className="size-3 text-m-chess" />}
          />
          <StatTile
            label="Minutes"
            value={minutesThisWeek}
            unit="min"
            color="var(--m-chess)"
            icon={<Clock className="size-3 text-m-chess" />}
          />
          <StatTile
            label="Streak"
            value={streak}
            unit="d"
            color="var(--accent)"
            icon={<Flame className="size-3 text-accent" />}
          />
        </div>
      </section>

      {/* ----- log session ----- */}
      <section>
        <h2 className="font-display text-[19px] leading-[1.35]">
          Log a session
        </h2>
        <div className="mt-3">
          <ChessLogForm onSave={onAddSession} />
        </div>
      </section>

      {/* ----- rating trend ----- */}
      <section>
        <h2 className="font-display text-[19px] leading-[1.35]">
          Rating trend
        </h2>
        <Card className="mt-3 rounded-lg shadow-sm">
          <CardContent className="p-4">
            {ratingPoints.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Your rating line will appear once you log a rating.
              </p>
            ) : (
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={ratingPoints}
                    margin={{ top: 14, right: 8, bottom: 0, left: -14 }}
                  >
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "var(--ink-mute)", fontSize: 10 }}
                      tickMargin={8}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      domain={[
                        (dataMin: number) => dataMin - 40,
                        (dataMax: number) => dataMax + 40,
                      ]}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "var(--ink-mute)", fontSize: 11 }}
                      width={34}
                    />
                    <Tooltip
                      content={<ChartTip />}
                      cursor={{ stroke: "var(--hairline)", strokeDasharray: "3 3" }}
                    />
                    {allTimeHigh && (
                      <ReferenceDot
                        x={allTimeHigh.date}
                        y={allTimeHigh.rating}
                        r={4.5}
                        fill="var(--m-chess)"
                        stroke="var(--canvas)"
                        strokeWidth={2}
                      />
                    )}
                    <Line
                      type="monotone"
                      dataKey="rating"
                      name="rating"
                      stroke="var(--m-chess)"
                      strokeWidth={2}
                      dot={{ r: 2.5, fill: "var(--m-chess)", strokeWidth: 0 }}
                      activeDot={{ r: 4 }}
                      connectNulls
                      animationDuration={700}
                      isAnimationActive={!reduced}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            {allTimeHigh && (
              <p className="mt-2 text-right text-[12px] text-muted-foreground">
                <span className="mr-1 inline-block size-2 rounded-full bg-m-chess align-middle" />
                All-time high <span className="tabular font-medium text-m-chess">{allTimeHigh.rating}</span>
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ----- practice mix ----- */}
      <section>
        <h2 className="font-display text-[19px] leading-[1.35]">
          Practice mix
        </h2>
        <Card className="mt-3 rounded-lg shadow-sm">
          <CardContent className="p-4">
            {mixTotal === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Practice minutes will show here as you log sessions.
              </p>
            ) : (
              <>
                <div className="h-8 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={mixData}
                      layout="vertical"
                      margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
                      barSize={24}
                    >
                      <XAxis type="number" hide />
                      <YAxis type="category" dataKey="name" hide />
                      <Tooltip
                        content={<ChartTip />}
                        cursor={false}
                        wrapperStyle={{ outline: "none" }}
                      />
                      {mixOrder.map((k, i) => (
                        <Bar
                          key={k}
                          dataKey={k}
                          stackId="mix"
                          fill="var(--m-chess)"
                          fillOpacity={MIX_OPACITY[k]}
                          radius={i === mixOrder.length - 1 ? [0, 8, 8, 0] : 0}
                          isAnimationActive={!reduced}
                          animationDuration={700}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
                  {mixOrder
                    .filter((k) => mix[k] > 0)
                    .map((k) => (
                      <span
                        key={k}
                        className="flex items-center gap-1.5 text-[12px] text-muted-foreground"
                      >
                        <span
                          className="size-2 rounded-full bg-m-chess"
                          style={{ opacity: MIX_OPACITY[k] }}
                        />
                        <span className="capitalize">{k}</span>
                        <span className="tabular text-foreground">
                          {mix[k]}m
                        </span>
                      </span>
                    ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ----- topics ----- */}
      <section>
        <h2 className="font-display text-[19px] leading-[1.35]">Topics</h2>
        {topics.length === 0 ? (
          <p className="mt-3 rounded-lg bg-card px-5 py-6 text-center text-sm text-muted-foreground ring-1 ring-foreground/10">
            Topic chips will collect here as you log sessions.
          </p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {topics.map(([topic, count]) => (
              <Badge
                key={topic}
                variant="outline"
                className="h-8 rounded-full bg-m-chess/10 px-3 text-[13px] font-normal text-foreground"
              >
                {topic}
                <span className="ml-1 text-muted-foreground tabular">
                  ×{count}
                </span>
              </Badge>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ---------- page ----------
export default function PursuitsPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [readingSessions, setReadingSessions] = useState<ReadingSession[]>([]);
  const [chessSessions, setChessSessions] = useState<ChessSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    Promise.all([getBooks(), getReadingSessions(), getChessSessions()]).then(
      ([b, r, c]) => {
        if (!alive) return;
        setBooks(b);
        setReadingSessions(r);
        setChessSessions(c);
        setLoading(false);
      }
    );
    return () => {
      alive = false;
    };
  }, []);

  const handleAddReading = async (s: Omit<ReadingSession, "id">) => {
    await addReadingSession(s);
    setReadingSessions(await getReadingSessions());
  };

  const handleAddChess = async (s: Omit<ChessSession, "id">) => {
    await addChessSession(s);
    setChessSessions(await getChessSessions());
  };

  return (
    <main className="mx-auto w-full max-w-[1120px] px-5 pt-8 pb-32 md:px-12 md:pt-12">
      <header className="animate-in fade-in duration-300">
        <p className="text-[11px] tracking-[0.08em] uppercase text-muted-foreground">
          Pursuits
        </p>
        <h1 className="mt-2 font-display text-[32px] leading-[1.2]">
          Reading &amp; chess
        </h1>
        <p className="mt-2 max-w-md text-[15px] text-muted-foreground">
          The shelf and the board — logged gently, never judged.
        </p>
      </header>

      {!loading && (
        <Tabs defaultValue="reading" className="mt-6">
          <TabsList variant="line" className="h-11 w-full gap-6">
            <TabsTrigger value="reading" className="h-11 text-[15px]">
              Reading
            </TabsTrigger>
            <TabsTrigger value="chess" className="h-11 text-[15px]">
              Chess
            </TabsTrigger>
          </TabsList>
          <TabsContent
            value="reading"
            keepMounted
            className="animate-in fade-in duration-200 pt-6"
          >
            <ReadingTab
              books={books}
              sessions={readingSessions}
              onAddSession={handleAddReading}
            />
          </TabsContent>
          <TabsContent
            value="chess"
            keepMounted
            className="animate-in fade-in duration-200 pt-6"
          >
            <ChessTab sessions={chessSessions} onAddSession={handleAddChess} />
          </TabsContent>
        </Tabs>
      )}
    </main>
  );
}
