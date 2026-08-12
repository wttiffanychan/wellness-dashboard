"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Archive, Heart, Plus, Search, Shuffle, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  addQuote,
  addReflection,
  assignQuoteOfDay,
  getQuoteOfDay,
  getQuotes,
  getReflections,
  setQuoteFavorite,
} from "@/lib/data";
import type { Quote, QuoteReflection, QuoteTheme } from "@/lib/types";

const todayStr = () => new Date().toISOString().slice(0, 10);

const THEMES: QuoteTheme[] = [
  "security",
  "confidence",
  "courage",
  "calm",
  "self-trust",
  "discipline",
  "gratitude",
];

/**
 * Theme → token mapping. All colours derive from design tokens via
 * color-mix — no hardcoded hex. Tints are soft (≈7%) washes over the
 * surface; hero uses a slightly deeper wash over the canvas so the
 * full-bleed band melts into the page.
 */
const THEME_META: Record<
  QuoteTheme,
  { label: string; dot: string; tint: string; hero: string }
> = {
  security: {
    label: "Security",
    dot: "var(--m-fuel)",
    tint: "color-mix(in oklab, var(--surface-sunk) 60%, var(--surface))",
    hero: "color-mix(in oklab, var(--surface-sunk) 75%, var(--canvas))",
  },
  confidence: {
    label: "Confidence",
    dot: "var(--m-move)",
    tint: "color-mix(in oklab, var(--m-move) 7%, var(--surface))",
    hero: "color-mix(in oklab, var(--m-move) 9%, var(--canvas))",
  },
  courage: {
    label: "Courage",
    dot: "var(--m-supp)",
    tint: "color-mix(in oklab, var(--m-supp) 7%, var(--surface))",
    hero: "color-mix(in oklab, var(--m-supp) 9%, var(--canvas))",
  },
  calm: {
    label: "Calm",
    dot: "var(--m-walk)",
    tint: "color-mix(in oklab, var(--m-walk) 7%, var(--surface))",
    hero: "color-mix(in oklab, var(--m-walk) 9%, var(--canvas))",
  },
  "self-trust": {
    label: "Self-trust",
    dot: "var(--m-mind)",
    tint: "color-mix(in oklab, var(--m-mind) 7%, var(--surface))",
    hero: "color-mix(in oklab, var(--m-mind) 9%, var(--canvas))",
  },
  discipline: {
    label: "Discipline",
    dot: "var(--m-read)",
    tint: "color-mix(in oklab, var(--m-read) 7%, var(--surface))",
    hero: "color-mix(in oklab, var(--m-read) 9%, var(--canvas))",
  },
  gratitude: {
    label: "Gratitude",
    dot: "var(--m-fuel)",
    tint: "color-mix(in oklab, var(--m-fuel) 8%, var(--surface))",
    hero: "color-mix(in oklab, var(--m-fuel) 10%, var(--canvas))",
  },
};

const fmtDate = (d: string | null): string => {
  if (!d) return "Never";
  const dt = new Date(`${d}T00:00:00`);
  const sameYear = dt.getFullYear() === new Date().getFullYear();
  return dt.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
};

export default function QuotesPage() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [qod, setQod] = useState<Quote | null>(null);
  const [heroReflections, setHeroReflections] = useState<QuoteReflection[]>([]);

  const [search, setSearch] = useState("");
  const [themeFilter, setThemeFilter] = useState<QuoteTheme | "all">("all");
  const [favOnly, setFavOnly] = useState(false);
  const [peek, setPeek] = useState<Quote | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [detail, setDetail] = useState<Quote | null>(null);
  const [detailReflections, setDetailReflections] = useState<QuoteReflection[]>([]);
  const [reflectionDraft, setReflectionDraft] = useState("");

  // --- load: quotes + today's official quote (assign on first visit) ---
  useEffect(() => {
    let alive = true;
    (async () => {
      const [qs, q] = await Promise.all([
        getQuotes(),
        (async () => (await getQuoteOfDay(todayStr())) ?? (await assignQuoteOfDay(todayStr())))() as Promise<Quote | null>,
      ]);
      if (!alive) return;
      setQuotes(qs);
      setQod(q);
      setHeroReflections(q ? await getReflections(q.id) : []);
      setLoaded(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // --- reflections for the open detail sheet ---
  useEffect(() => {
    if (!detail) return;
    let alive = true;
    getReflections(detail.id).then((rs) => {
      if (alive) setDetailReflections(rs);
    });
    return () => {
      alive = false;
    };
  }, [detail]);

  const closeDetail = useCallback(() => {
    setDetail(null);
    setDetailReflections([]);
  }, []);

  const toggleFavorite = useCallback(async (q: Quote) => {
    const next = !q.is_favorite;
    setQuotes((prev) => prev.map((x) => (x.id === q.id ? { ...x, is_favorite: next } : x)));
    setQod((prev) => (prev && prev.id === q.id ? { ...prev, is_favorite: next } : prev));
    setDetail((prev) => (prev && prev.id === q.id ? { ...prev, is_favorite: next } : prev));
    setPeek((prev) => (prev && prev.id === q.id ? { ...prev, is_favorite: next } : prev));
    await setQuoteFavorite(q.id, next);
  }, []);

  const openDetail = useCallback((q: Quote) => setDetail(q), []);

  const handleShuffle = useCallback(() => {
    const pool = quotes.filter((q) => q.id !== qod?.id);
    if (pool.length === 0) return;
    setPeek(pool[Math.floor(Math.random() * pool.length)]);
  }, [quotes, qod]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return quotes.filter((q) => {
      if (themeFilter !== "all" && q.theme !== themeFilter) return false;
      if (favOnly && !q.is_favorite) return false;
      if (term) {
        const hay = `${q.body} ${q.author ?? ""} ${q.source ?? ""}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [quotes, search, themeFilter, favOnly]);

  const todayReflection = useMemo(
    () => heroReflections.find((r) => r.reflection_date === todayStr()) ?? null,
    [heroReflections]
  );

  const submitReflection = useCallback(async () => {
    const body = reflectionDraft.trim();
    if (!body || !detail) return;
    await addReflection(detail.id, body);
    const [rs, heroRs] = await Promise.all([
      getReflections(detail.id),
      qod && qod.id === detail.id ? getReflections(qod.id) : Promise.resolve([]),
    ]);
    setDetailReflections(rs);
    if (qod && qod.id === detail.id) setHeroReflections(heroRs);
    setReflectionDraft("");
  }, [reflectionDraft, detail, qod]);

  // NOTE: data.ts has no archive function (no setQuoteArchived). Archive is
  // therefore session-local: the quote leaves the visible library until
  // reload. Persisted archiving needs a data-layer addition (out of scope
  // for this file's ownership).
  const handleArchive = useCallback(() => {
    if (!detail) return;
    setQuotes((prev) => prev.filter((q) => q.id !== detail.id));
    closeDetail();
  }, [detail, closeDetail]);

  const heroMeta = THEME_META[qod?.theme ?? "security"];

  return (
    <main className="w-full">
      {/* ---------- Hero: today's quote ---------- */}
      <section
        className="w-full transition-colors duration-300"
        style={{ backgroundColor: heroMeta.hero }}
      >
        <div className="mx-auto flex w-full max-w-[1120px] flex-col items-center px-5 py-16 text-center sm:px-12 sm:py-24">
          <p className="text-[11px] font-medium tracking-[0.08em] text-(--ink-mute) uppercase">
            Today&rsquo;s quote
          </p>
          {qod ? (
            <>
              <blockquote
                key={qod.id}
                className="animate-in fade-in duration-200 mt-6 max-w-2xl font-display text-[28px] leading-[1.35] font-normal text-foreground [text-wrap:balance]"
              >
                &ldquo;{qod.body}&rdquo;
              </blockquote>
              <p className="mt-5 text-sm text-muted-foreground">
                {qod.author ?? "Unknown"}
                {qod.source ? ` — ${qod.source}` : ""}
              </p>
              {todayReflection ? (
                <p className="animate-in fade-in duration-200 mt-8 max-w-lg border-t border-border pt-6 text-[15px] leading-relaxed text-muted-foreground italic">
                  {todayReflection.body}
                </p>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => qod && openDetail(qod)}
                  className="mt-8 text-muted-foreground hover:bg-transparent hover:text-foreground"
                >
                  What does this bring up today?
                </Button>
              )}
            </>
          ) : (
            <p className="mt-6 font-display text-2xl text-muted-foreground">
              Your first quote is on its way.
            </p>
          )}
        </div>
      </section>

      {/* ---------- Controls ---------- */}
      <div className="mx-auto mt-6 flex w-full max-w-[1120px] flex-col gap-3 px-5 sm:px-12">
        <div className="relative">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-(--ink-mute)" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search quotes, authors, sources"
            aria-label="Search quotes"
            className="bg-card pl-8 shadow-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <ThemeChip
              label="All"
              active={themeFilter === "all"}
              dot={null}
              onClick={() => setThemeFilter("all")}
            />
            {THEMES.map((t) => (
              <ThemeChip
                key={t}
                label={THEME_META[t].label}
                active={themeFilter === t}
                dot={THEME_META[t].dot}
                onClick={() => setThemeFilter(themeFilter === t ? "all" : t)}
              />
            ))}
          </div>
          <Button
            variant={favOnly ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setFavOnly((v) => !v)}
            aria-pressed={favOnly}
            className="shrink-0 rounded-full"
          >
            <Heart className={favOnly ? "fill-current" : ""} />
            Favorites
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleShuffle}
            className="shrink-0 rounded-full"
          >
            <Shuffle />
            Show me another
          </Button>
        </div>
      </div>

      {/* ---------- Peek card (shuffle — never changes the day's quote) ---------- */}
      {peek && (
        <div className="mx-auto mt-4 w-full max-w-[1120px] px-5 sm:px-12">
          <Card
            key={peek.id}
            className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both mb-0 rounded-lg p-5 duration-300"
            style={{ backgroundColor: THEME_META[peek.theme].tint }}
          >
            <div className="flex items-center justify-between gap-2">
              <Badge variant="outline" className="rounded-full text-(--ink-mute)">
                Just for now
              </Badge>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Dismiss peek"
                onClick={() => setPeek(null)}
              >
                <X />
              </Button>
            </div>
            <p className="mt-3 font-display text-lg leading-snug text-foreground [text-wrap:balance]">
              &ldquo;{peek.body}&rdquo;
            </p>
            <div className="mt-3 flex items-center gap-2">
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: THEME_META[peek.theme].dot }}
              />
              <p className="flex-1 truncate text-sm text-muted-foreground">
                {peek.author ?? "Unknown"}
              </p>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={peek.is_favorite ? "Remove from favorites" : "Add to favorites"}
                onClick={(e) => {
                  e.stopPropagation();
                  void toggleFavorite(peek);
                }}
              >
                <Heart className={peek.is_favorite ? "fill-current text-m-supp" : ""} />
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ---------- Library ---------- */}
      <section className="mx-auto mt-8 w-full max-w-[1120px] px-5 pb-40 sm:px-12">
        {loaded && filtered.length === 0 ? (
          <EmptyLibrary
            empty={quotes.length === 0}
            onAdd={() => setAddOpen(true)}
            onClear={() => {
              setSearch("");
              setThemeFilter("all");
              setFavOnly(false);
            }}
          />
        ) : (
          <div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
            {filtered.map((q, i) => (
              <QuoteCard
                key={q.id}
                quote={q}
                index={i}
                onOpen={() => openDetail(q)}
                onToggleFav={() => void toggleFavorite(q)}
              />
            ))}
          </div>
        )}
      </section>

      {/* ---------- FAB ---------- */}
      <Button
        size="icon"
        aria-label="Add a quote"
        onClick={() => setAddOpen(true)}
        className="fixed right-5 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-40 size-14 rounded-full shadow-lg sm:right-8"
      >
        <Plus className="size-6" />
      </Button>

      {/* ---------- Add quote sheet ---------- */}
      <AddQuoteSheet
        open={addOpen}
        onOpenChange={setAddOpen}
        onAdded={async () => setQuotes(await getQuotes())}
      />

      {/* ---------- Quote detail sheet ---------- */}
      <Sheet open={detail !== null} onOpenChange={(o) => !o && closeDetail()}>
        <SheetContent
          side="bottom"
          className="mx-auto max-h-[85vh] w-full max-w-[640px] overflow-y-auto rounded-t-xl px-5 pt-6 pb-[calc(env(safe-area-inset-bottom)+24px)] sm:px-8"
        >
          <SheetHeader className="p-0">
            <SheetTitle className="sr-only">Quote detail</SheetTitle>
            <SheetDescription className="sr-only">
              Full quote, favorites, history, and reflections
            </SheetDescription>
          </SheetHeader>
          {detail && (
            <div className="flex flex-col gap-5">
              <div>
                <Badge variant="secondary" className="rounded-full">
                  <span
                    className="mr-1.5 size-1.5 rounded-full"
                    style={{ backgroundColor: THEME_META[detail.theme].dot }}
                  />
                  {THEME_META[detail.theme].label}
                </Badge>
                <p className="mt-4 font-display text-2xl leading-[1.35] text-foreground [text-wrap:balance]">
                  &ldquo;{detail.body}&rdquo;
                </p>
                <p className="mt-3 text-sm text-muted-foreground">
                  {detail.author ?? "Unknown"}
                  {detail.source ? ` — ${detail.source}` : ""}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant={detail.is_favorite ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => void toggleFavorite(detail)}
                  className="rounded-full"
                >
                  <Heart className={detail.is_favorite ? "fill-current text-m-supp" : ""} />
                  {detail.is_favorite ? "Favorited" : "Favorite"}
                </Button>
                <span className="tabular ml-auto text-[13px] text-(--ink-mute)">
                  Shown {detail.times_shown}× · last seen {fmtDate(detail.last_shown_on)}
                </span>
              </div>

              <Separator />

              <div>
                <h3 className="font-display text-lg text-foreground">Reflections</h3>
                {detailReflections.length === 0 ? (
                  <p className="mt-2 text-sm text-(--ink-mute)">
                    Nothing written yet. Reflections stay with the quote, dated as you write them.
                  </p>
                ) : (
                  <ul className="mt-3 flex flex-col gap-3">
                    {[...detailReflections]
                      .sort((a, b) => b.reflection_date.localeCompare(a.reflection_date))
                      .map((r) => (
                        <li key={r.id} className="flex gap-3">
                          <span className="tabular w-16 shrink-0 pt-0.5 text-xs text-(--ink-mute)">
                            {fmtDate(r.reflection_date)}
                          </span>
                          <p className="text-sm leading-relaxed text-muted-foreground">{r.body}</p>
                        </li>
                      ))}
                  </ul>
                )}
                <div className="mt-4 flex items-center gap-2">
                  <Input
                    value={reflectionDraft}
                    onChange={(e) => setReflectionDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void submitReflection();
                      }
                    }}
                    placeholder="What does this bring up?"
                    aria-label="Write a reflection"
                    className="bg-card"
                  />
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => void submitReflection()}
                    disabled={reflectionDraft.trim().length === 0}
                    className="rounded-full"
                  >
                    Add
                  </Button>
                </div>
              </div>

              <Separator />

              <Button
                variant="ghost"
                size="sm"
                onClick={handleArchive}
                className="w-fit self-start text-(--ink-mute) hover:text-foreground"
              >
                <Archive />
                Archive quote
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </main>
  );
}

/* ================= helpers ================= */

function ThemeChip({
  label,
  active,
  dot,
  onClick,
}: {
  label: string;
  active: boolean;
  dot: string | null;
  onClick: () => void;
}) {
  return (
    <Button
      variant={active ? "secondary" : "ghost"}
      size="sm"
      onClick={onClick}
      aria-pressed={active}
      className="shrink-0 rounded-full"
    >
      {dot && (
        <span
          className="size-1.5 rounded-full"
          style={{ backgroundColor: dot, opacity: active ? 1 : 0.45 }}
        />
      )}
      {label}
    </Button>
  );
}

function QuoteCard({
  quote,
  index,
  onOpen,
  onToggleFav,
}: {
  quote: Quote;
  index: number;
  onOpen: () => void;
  onToggleFav: () => void;
}) {
  const meta = THEME_META[quote.theme];
  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both mb-4 cursor-pointer break-inside-avoid rounded-lg p-5 duration-300 transition-transform hover:-translate-y-0.5 active:scale-[0.97]"
      style={{
        backgroundColor: meta.tint,
        animationDelay: `${Math.min(index * 40, 480)}ms`,
      }}
    >
      <p className="line-clamp-4 font-display text-[17px] leading-snug text-foreground [text-wrap:balance]">
        &ldquo;{quote.body}&rdquo;
      </p>
      <p className="mt-3 truncate text-sm text-muted-foreground">{quote.author ?? "Unknown"}</p>
      <div className="mt-3 flex items-center gap-2">
        <span className="size-2 rounded-full" style={{ backgroundColor: meta.dot }} />
        <span className="text-[11px] tracking-[0.08em] text-(--ink-mute) uppercase">
          {meta.label}
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={quote.is_favorite ? "Remove from favorites" : "Add to favorites"}
          onClick={(e) => {
            e.stopPropagation();
            onToggleFav();
          }}
          className="ml-auto"
        >
          <Heart className={quote.is_favorite ? "fill-current text-m-supp" : ""} />
        </Button>
      </div>
    </Card>
  );
}

function EmptyLibrary({ empty, onAdd, onClear }: { empty: boolean; onAdd: () => void; onClear: () => void }) {
  return (
    <Card
      className="mx-auto max-w-md rounded-lg p-8 text-center shadow-sm"
      style={{
        backgroundColor: "color-mix(in oklab, var(--surface-sunk) 55%, var(--surface))",
      }}
    >
      <p className="font-display text-xl leading-snug text-foreground [text-wrap:balance]">
        {empty
          ? "Nothing here yet — your first quote is waiting to be written."
          : "No quotes match that search. Try a different word or theme."}
      </p>
      <Button
        variant="default"
        size="sm"
        onClick={empty ? onAdd : onClear}
        className="mt-5 rounded-full"
      >
        {empty ? "Add a quote" : "Clear filters"}
      </Button>
    </Card>
  );
}

/* ================= add-quote sheet ================= */

function AddQuoteSheet({
  open,
  onOpenChange,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded: () => Promise<void>;
}) {
  const [pasteMode, setPasteMode] = useState(false);
  const [body, setBody] = useState("");
  const [author, setAuthor] = useState("");
  const [source, setSource] = useState("");
  const [theme, setTheme] = useState<QuoteTheme>("security");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setPasteMode(false);
    setBody("");
    setAuthor("");
    setSource("");
    setTheme("security");
    setError(null);
  };

  const handleSubmit = async () => {
    if (busy) return;
    const chunks = pasteMode
      ? body
          .split(/\n\s*\n/)
          .map((c) => c.trim())
          .filter(Boolean)
      : [body.trim()];
    if (chunks.length === 0) {
      setError(pasteMode ? "Paste at least one quote." : "Write or paste a quote first.");
      return;
    }
    setBusy(true);
    try {
      for (const c of chunks) {
        await addQuote({
          body: c,
          author: author.trim() || null,
          source: source.trim() || null,
          theme,
          is_favorite: false,
        });
      }
      await onAdded();
      reset();
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (o) setError(null);
        else reset();
        onOpenChange(o);
      }}
    >
      <SheetContent
        side="bottom"
        className="mx-auto max-h-[85vh] w-full max-w-[640px] overflow-y-auto rounded-t-xl px-5 pt-6 pb-[calc(env(safe-area-inset-bottom)+24px)] sm:px-8"
      >
        <SheetHeader className="p-0">
          <SheetTitle className="font-display text-xl text-foreground">Add a quote</SheetTitle>
          <SheetDescription className="text-(--ink-mute)">
            {pasteMode
              ? "Paste several quotes separated by blank lines — each block becomes its own quote."
              : "Keep one you want to remember, or collect one for the rotation."}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 flex items-center gap-2">
          <Button
            variant={pasteMode ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setPasteMode(false)}
            className="rounded-full"
          >
            Single
          </Button>
          <Button
            variant={pasteMode ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setPasteMode(true)}
            className="rounded-full"
          >
            Paste multiple
          </Button>
        </div>

        <div className="mt-4 flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] tracking-[0.08em] text-(--ink-mute) uppercase">
              {pasteMode ? "Quotes (blank line = new quote)" : "Quote"}
            </span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={pasteMode ? 7 : 3}
              placeholder={pasteMode ? "First quote…\n\nSecond quote…" : "Write or paste the quote…"}
              className="w-full resize-none rounded-lg border border-input bg-card px-3 py-2 text-sm leading-relaxed text-foreground outline-none placeholder:text-(--ink-mute) focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] tracking-[0.08em] text-(--ink-mute) uppercase">Author</span>
              <Input
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="Optional"
                className="bg-card"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] tracking-[0.08em] text-(--ink-mute) uppercase">Source</span>
              <Input
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="Book, letter, talk…"
                className="bg-card"
              />
            </label>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] tracking-[0.08em] text-(--ink-mute) uppercase">Theme</span>
            <div className="flex flex-wrap gap-1.5">
              {THEMES.map((t) => (
                <ThemeChip
                  key={t}
                  label={THEME_META[t].label}
                  active={theme === t}
                  dot={THEME_META[t].dot}
                  onClick={() => setTheme(t)}
                />
              ))}
            </div>
          </div>
          {error && <p className="text-sm text-muted-foreground">{error}</p>}
          <Button
            variant="default"
            onClick={() => void handleSubmit()}
            disabled={busy}
            className="mt-1 rounded-full"
          >
            <Plus />
            {pasteMode
              ? (() => {
                  const n = body
                    .split(/\n\s*\n/)
                    .map((c) => c.trim())
                    .filter(Boolean).length;
                  return n > 0 ? `Add ${n} quote${n > 1 ? "s" : ""}` : "Add quotes";
                })()
              : "Add quote"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
