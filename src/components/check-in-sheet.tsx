"use client";

// ============================================================
// Check-in sheet — SPEC §5.2
//
// A bottom drawer, not a page. Sections run in the journal
// playbook's pillar order so the two systems feel like one:
//   supplements → movement → fuel → rest → mind → craft → reflection
//
// Rules baked in:
//   · Every field optional. Blank is NOT zero — each numeric field
//     has a Clear affordance that returns it to null.
//   · Autosave on change with a debounce + a "Saved" fade.
//     There is deliberately no Save button to forget to press.
//   · Sleep is labelled "Last night's sleep" (attribution rule).
// ============================================================

import * as React from "react";
import {
  Check,
  Dumbbell,
  GlassWater,
  Moon,
  NotebookPen,
  Pill,
  Plus,
  Sparkles,
  Swords,
  UtensilsCrossed,
  X,
} from "lucide-react";

import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  addChessSession,
  addReadingSession,
  getEntries,
  getEntry,
  getSupplementLogs,
  getSupplements,
  setSupplementTaken,
  upsertEntry,
} from "@/lib/data";
import type {
  ChessKind,
  DailyEntry,
  Supplement,
  SupplementLog,
} from "@/lib/types";

// ---------- shared helpers (also used by the Today page) ----------

export function emptyEntry(date: string): DailyEntry {
  return {
    entry_date: date,
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
}

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

/** "Wednesday, August 12" — parsed as local, never UTC-shifted. */
export function formatLongDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

const AUTOSAVE_MS = 600;

// ---------- small building blocks ----------

function SectionHead({
  icon: Icon,
  title,
  meta,
}: {
  icon: React.ElementType;
  title: string;
  meta?: string;
}) {
  return (
    <div className="mb-4 flex items-center gap-2.5">
      <Icon size={15} className="text-[var(--ink-mute)]" aria-hidden />
      <h3 className="text-[11px] font-medium tracking-[0.08em] text-[var(--ink-mute)] uppercase">
        {title}
      </h3>
      {meta ? (
        <span className="tabular ml-auto text-xs text-[var(--ink-mute)]">{meta}</span>
      ) : null}
    </div>
  );
}

function Section({
  children,
  ...head
}: React.ComponentProps<typeof SectionHead> & { children: React.ReactNode }) {
  return (
    <section className="border-t border-[var(--hairline)] px-5 py-6 first:border-t-0">
      <SectionHead {...head} />
      {children}
    </section>
  );
}

function StepButton({
  label,
  onPress,
  children,
  disabled,
}: {
  label: string;
  onPress: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onPress}
      className={cn(
        "grid size-11 shrink-0 place-items-center rounded-full",
        "border border-[var(--hairline)] bg-[var(--surface-sunk)]",
        "text-[var(--ink-soft)] transition-colors duration-200 ease-[var(--ease-house)]",
        "hover:text-[var(--ink)] disabled:opacity-35",
      )}
    >
      {children}
    </button>
  );
}

/**
 * A numeric field where blank is genuinely blank. `null` renders
 * as an em dash, and Clear puts it back to null.
 */
function NumberField({
  label,
  value,
  onChange,
  step,
  min = 0,
  max,
  unit,
  seed,
  decimals = 0,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  step: number;
  min?: number;
  max?: number;
  unit?: string;
  /** what a first tap on "+" should land on */
  seed?: number;
  decimals?: number;
}) {
  const bump = (dir: 1 | -1) => {
    if (value === null) {
      onChange(dir === 1 ? (seed ?? step) : min);
      return;
    }
    const next = value + dir * step;
    const clamped = Math.min(max ?? Infinity, Math.max(min, next));
    onChange(Number(clamped.toFixed(decimals)));
  };

  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-sm text-[var(--ink-soft)]">{label}</span>
      <div className="flex items-center gap-2">
        {value !== null ? (
          <button
            type="button"
            aria-label={`Clear ${label}`}
            onClick={() => onChange(null)}
            className="grid size-11 place-items-center rounded-full text-[var(--ink-mute)] transition-colors hover:text-[var(--ink-soft)]"
          >
            <X size={14} aria-hidden />
          </button>
        ) : null}
        <StepButton label={`Decrease ${label}`} onPress={() => bump(-1)} disabled={value === null}>
          <span className="text-lg leading-none">−</span>
        </StepButton>
        <span className="tabular w-16 text-center text-base font-medium text-[var(--ink)]">
          {value === null ? (
            <span className="text-[var(--ink-mute)]">—</span>
          ) : (
            <>
              {value.toFixed(decimals)}
              {unit ? (
                <span className="ml-0.5 text-xs text-[var(--ink-mute)]">{unit}</span>
              ) : null}
            </>
          )}
        </span>
        <StepButton label={`Increase ${label}`} onPress={() => bump(1)}>
          <Plus size={15} aria-hidden />
        </StepButton>
      </div>
    </div>
  );
}

/** 1–5 soft circles. Tapping the selected value clears it back to null. */
function Scale5({
  label,
  value,
  onChange,
  tint = "var(--accent)",
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  tint?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-sm text-[var(--ink-soft)]">{label}</span>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => {
          const on = value !== null && n <= value;
          return (
            <button
              key={n}
              type="button"
              aria-label={`${label} ${n} of 5`}
              aria-pressed={value === n}
              onClick={() => onChange(value === n ? null : n)}
              className="grid size-11 place-items-center"
            >
              <span
                className="block size-6 rounded-full border transition-all duration-200 ease-[var(--ease-house)]"
                style={{
                  background: on ? tint : "var(--surface-sunk)",
                  borderColor: on ? "transparent" : "var(--hairline)",
                  boxShadow: on ? `0 0 10px color-mix(in srgb, ${tint} 35%, transparent)` : undefined,
                }}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly T[];
  value: T | null;
  onChange: (v: T | null) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-sm text-[var(--ink-soft)]">{label}</span>
      <div className="flex gap-1 rounded-full border border-[var(--hairline)] bg-[var(--surface-sunk)] p-1">
        {options.map((o) => {
          const on = value === o;
          return (
            <button
              key={o}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? null : o)}
              className={cn(
                "min-h-9 rounded-full px-3.5 text-xs font-medium capitalize",
                "transition-colors duration-200 ease-[var(--ease-house)]",
                on
                  ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                  : "text-[var(--ink-mute)] hover:text-[var(--ink-soft)]",
              )}
            >
              {o}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TextRow({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  listId,
}: {
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
  placeholder?: string;
  type?: string;
  listId?: string;
}) {
  return (
    <label className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-sm text-[var(--ink-soft)]">{label}</span>
      <Input
        type={type}
        list={listId}
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}
        className="h-11 max-w-[58%] rounded-xl border-[var(--hairline)] bg-[var(--surface-sunk)] text-sm"
      />
    </label>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex min-h-11 items-center justify-between gap-3 py-1.5">
      <span className="text-sm font-medium text-[var(--ink)]">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

// ---------- the sheet ----------

export interface CheckInSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** YYYY-MM-DD — the date being edited. */
  date: string;
  /** Fired after anything persists, so the Today page can refresh. */
  onChanged?: () => void;
}

export function CheckInSheet({
  open,
  onOpenChange,
  date,
  onChanged,
}: CheckInSheetProps) {
  const [entry, setEntry] = React.useState<DailyEntry>(() => emptyEntry(date));
  const [supplements, setSupplements] = React.useState<Supplement[]>([]);
  const [logs, setLogs] = React.useState<SupplementLog[]>([]);
  const [sessionNames, setSessionNames] = React.useState<string[]>([]);
  const [saved, setSaved] = React.useState(false);

  // craft quick-add scratch state (not part of daily_entries)
  const [readMin, setReadMin] = React.useState<number | null>(null);
  const [readPages, setReadPages] = React.useState<number | null>(null);
  const [chessMin, setChessMin] = React.useState<number | null>(null);
  const [chessKind, setChessKind] = React.useState<ChessKind>("puzzles");

  const dirty = React.useRef(false);
  const savedTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const onChangedRef = React.useRef(onChanged);
  /** the date whose data is currently in state — gates autosave so a
   *  freshly loaded entry never writes itself straight back */
  const loadedFor = React.useRef<string | null>(null);

  React.useEffect(() => {
    onChangedRef.current = onChanged;
  }, [onChanged]);

  // --- load whenever the sheet opens or the date changes ---
  React.useEffect(() => {
    if (!open) return;
    let alive = true;
    dirty.current = false;
    loadedFor.current = null;

    (async () => {
      const [e, sups, ls, history] = await Promise.all([
        getEntry(date),
        getSupplements(),
        getSupplementLogs(date),
        getEntries("0000-01-01"),
      ]);
      if (!alive) return;
      setEntry(e ?? emptyEntry(date));
      setSupplements(sups);
      setLogs(ls);
      setSessionNames(
        Array.from(
          new Set(
            history
              .map((h) => h.meditation_session)
              .filter((s): s is string => Boolean(s)),
          ),
        ),
      );
      loadedFor.current = date;
    })();

    return () => {
      alive = false;
    };
  }, [open, date]);

  // --- debounced autosave, with a "Saved" fade ---
  React.useEffect(() => {
    if (!open || loadedFor.current !== date || !dirty.current) return;
    const t = setTimeout(async () => {
      await upsertEntry(entry);
      onChangedRef.current?.();
      setSaved(true);
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSaved(false), 1600);
    }, AUTOSAVE_MS);
    return () => clearTimeout(t);
  }, [entry, open, date]);

  React.useEffect(
    () => () => {
      if (savedTimer.current) clearTimeout(savedTimer.current);
    },
    [],
  );

  const patch = React.useCallback((p: Partial<DailyEntry>) => {
    dirty.current = true;
    setEntry((prev) => ({ ...prev, ...p }));
  }, []);

  const flashSaved = React.useCallback(() => {
    setSaved(true);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(false), 1600);
  }, []);

  // supplements persist immediately — they're discrete actions
  const toggleSupplement = async (id: number, taken: boolean) => {
    setLogs((prev) => {
      const i = prev.findIndex((l) => l.supplement_id === id);
      const next: SupplementLog = {
        log_date: date,
        supplement_id: id,
        taken,
        taken_at: taken ? new Date().toISOString() : null,
      };
      if (i >= 0) {
        const copy = [...prev];
        copy[i] = next;
        return copy;
      }
      return [...prev, next];
    });
    await setSupplementTaken(date, id, taken);
    onChangedRef.current?.();
    flashSaved();
  };

  const isTaken = (id: number) =>
    logs.some((l) => l.supplement_id === id && l.taken);

  const scheduled = supplements.filter((s) => s.counts_toward_target);
  const afternoon = scheduled.filter((s) => s.slot === "afternoon");
  const night = scheduled.filter((s) => s.slot === "night");
  const flexible = supplements.filter((s) => s.slot === "flexible");
  const takenCount = scheduled.filter((s) => isTaken(s.id)).length;

  const logReading = async () => {
    if (readMin === null && readPages === null) return;
    await addReadingSession({
      session_date: date,
      book_id: null,
      minutes: readMin,
      pages: readPages,
      notes: null,
    });
    setReadMin(null);
    setReadPages(null);
    onChangedRef.current?.();
    flashSaved();
  };

  const logChess = async () => {
    if (chessMin === null) return;
    await addChessSession({
      session_date: date,
      kind: chessKind,
      minutes: chessMin,
      platform: null,
      topic: null,
      puzzles_solved: null,
      games_played: null,
      result: null,
      rating_after: null,
      notes: null,
    });
    setChessMin(null);
    onChangedRef.current?.();
    flashSaved();
  };

  const waterCups = entry.water_oz === null ? null : Math.round(entry.water_oz / 8);

  return (
    <Drawer open={open} onOpenChange={onOpenChange} showSwipeHandle>
      <DrawerContent className="[--drawer-height:88dvh] rounded-t-[28px] border-[var(--hairline)] bg-[var(--surface)]">
        {/* header */}
        <div className="shrink-0 px-5 pt-2 pb-4">
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <DrawerTitle className="font-display text-[22px] leading-tight font-normal text-[var(--ink)]">
                Check in
              </DrawerTitle>
              <p className="mt-0.5 text-[13px] tracking-[0.04em] text-[var(--ink-soft)]">
                {formatLongDate(date)}
              </p>
            </div>
            <span
              aria-live="polite"
              className={cn(
                "text-xs text-[var(--ink-mute)] transition-opacity duration-500 ease-[var(--ease-house)]",
                saved ? "opacity-100" : "opacity-0",
              )}
            >
              Saved
            </span>
          </div>
          <DrawerDescription className="sr-only">
            Log today&rsquo;s supplements, movement, fuel, rest, mind, craft and
            reflection. Every field is optional and saves automatically.
          </DrawerDescription>
        </div>

        {/* body */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">
          {/* 1 — SUPPLEMENTS */}
          <Section
            icon={Pill}
            title="Supplements"
            meta={`${takenCount} of ${scheduled.length}`}
          >
            {[
              { rows: afternoon, name: "Afternoon", time: "12:00 PM" },
              { rows: night, name: "Night", time: "10:00 PM" },
            ].map((slot) => (
              <div key={slot.name} className="mb-4 last:mb-0">
                <div className="mb-1.5 flex items-baseline gap-2">
                  <span className="text-[13px] font-medium text-[var(--ink)]">
                    {slot.name}
                  </span>
                  <span className="tabular text-[11px] text-[var(--ink-mute)]">
                    {slot.time}
                  </span>
                </div>
                <ul>
                  {slot.rows.map((s) => {
                    const on = isTaken(s.id);
                    return (
                      <li key={s.id}>
                        <button
                          type="button"
                          aria-pressed={on}
                          onClick={() => toggleSupplement(s.id, !on)}
                          className="flex min-h-11 w-full items-center gap-3 border-b border-[var(--hairline)] py-2 text-left last:border-b-0"
                        >
                          <span
                            className={cn(
                              "grid size-[22px] shrink-0 place-items-center rounded-[7px] border transition-all duration-200 ease-[var(--ease-house)]",
                              on
                                ? "border-transparent bg-[var(--m-supp)] text-[var(--canvas)]"
                                : "border-[var(--hairline)] text-transparent",
                            )}
                          >
                            <Check size={13} strokeWidth={3} aria-hidden />
                          </span>
                          <span
                            className={cn(
                              "text-sm",
                              on ? "text-[var(--ink-soft)]" : "text-[var(--ink)]",
                            )}
                          >
                            {s.name}
                          </span>
                          <span className="tabular ml-auto text-xs text-[var(--ink-mute)]">
                            {s.brand ?? s.dose_label}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}

            <div className="mt-4 flex flex-wrap gap-2">
              {flexible.map((s) => {
                const on = isTaken(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleSupplement(s.id, !on)}
                    className={cn(
                      "inline-flex min-h-11 items-center gap-2 rounded-full border px-3.5 text-[13px]",
                      "transition-colors duration-200 ease-[var(--ease-house)]",
                      on
                        ? "border-[var(--m-supp)]/40 bg-[var(--surface-sunk)] text-[var(--ink)]"
                        : "border-[var(--hairline)] bg-[var(--surface-sunk)] text-[var(--ink-soft)]",
                    )}
                  >
                    <span
                      className="block size-1.5 rounded-full"
                      style={{ background: on ? "var(--m-supp)" : "var(--ink-mute)" }}
                    />
                    {s.name}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-[11px] text-[var(--ink-mute)]">
              Flexible — not counted in your 5.
            </p>
          </Section>

          {/* 2 — MOVEMENT */}
          <Section icon={Dumbbell} title="Movement">
            <ToggleRow
              label="Workout"
              checked={entry.workout_done}
              onChange={(v) => patch({ workout_done: v })}
            />
            <TextRow
              label="Type"
              value={entry.workout_type}
              placeholder="Solid Core"
              onChange={(v) => patch({ workout_type: v })}
            />
            <NumberField
              label="Workout minutes"
              value={entry.workout_minutes}
              onChange={(v) => patch({ workout_minutes: v })}
              step={5}
              max={300}
              seed={45}
              unit="m"
            />
            <Segmented
              label="Intensity"
              options={["light", "moderate", "hard"] as const}
              value={entry.workout_intensity}
              onChange={(v) => patch({ workout_intensity: v })}
            />

            <div className="my-3 h-px bg-[var(--hairline)]" />

            <ToggleRow
              label="Walk"
              checked={entry.walk_done}
              onChange={(v) => patch({ walk_done: v })}
            />
            <NumberField
              label="Walk minutes"
              value={entry.walk_minutes}
              onChange={(v) => patch({ walk_minutes: v })}
              step={5}
              max={300}
              seed={30}
              unit="m"
            />
            <NumberField
              label="Steps"
              value={entry.walk_steps}
              onChange={(v) => patch({ walk_steps: v })}
              step={500}
              max={60000}
              seed={4000}
            />
          </Section>

          {/* 3 — FUEL */}
          <Section icon={UtensilsCrossed} title="Fuel">
            <NumberField
              label="Protein"
              value={entry.protein_g}
              onChange={(v) => patch({ protein_g: v })}
              step={5}
              max={200}
              seed={100}
              unit="g"
            />

            <div className="pt-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm text-[var(--ink-soft)]">Water</span>
                <div className="flex items-center gap-2">
                  <span className="tabular text-sm font-medium text-[var(--ink)]">
                    {entry.water_oz === null ? (
                      <span className="text-[var(--ink-mute)]">—</span>
                    ) : (
                      <>
                        {entry.water_oz}
                        <span className="ml-0.5 text-xs text-[var(--ink-mute)]">oz</span>
                      </>
                    )}
                  </span>
                  {entry.water_oz !== null ? (
                    <button
                      type="button"
                      aria-label="Clear water"
                      onClick={() => patch({ water_oz: null })}
                      className="grid size-11 place-items-center rounded-full text-[var(--ink-mute)] hover:text-[var(--ink-soft)]"
                    >
                      <X size={14} aria-hidden />
                    </button>
                  ) : null}
                </div>
              </div>
              {/* ten fillable glasses, 8 oz each */}
              <div className="flex flex-wrap gap-1">
                {Array.from({ length: 10 }, (_, i) => {
                  const filled = waterCups !== null && i < waterCups;
                  return (
                    <button
                      key={i}
                      type="button"
                      aria-label={`${(i + 1) * 8} ounces`}
                      aria-pressed={filled}
                      onClick={() =>
                        patch({ water_oz: waterCups === i + 1 ? i * 8 : (i + 1) * 8 })
                      }
                      className="grid size-11 place-items-center"
                    >
                      <GlassWater
                        size={22}
                        strokeWidth={1.6}
                        fill={filled ? "var(--m-water)" : "none"}
                        fillOpacity={filled ? 0.45 : 0}
                        className={
                          filled ? "text-[var(--m-water)]" : "text-[var(--hairline)]"
                        }
                        aria-hidden
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          </Section>

          {/* 4 — REST */}
          <Section icon={Moon} title="Rest">
            <NumberField
              label="Last night's sleep"
              value={entry.sleep_hours}
              onChange={(v) => patch({ sleep_hours: v })}
              step={0.25}
              max={12}
              seed={7.5}
              decimals={2}
              unit="h"
            />
            <Scale5
              label="Sleep quality"
              value={entry.sleep_quality}
              onChange={(v) => patch({ sleep_quality: v })}
              tint="var(--m-sleep)"
            />
            <TextRow
              label="Bedtime"
              type="time"
              value={entry.bedtime}
              onChange={(v) => patch({ bedtime: v })}
            />
            <TextRow
              label="Wake time"
              type="time"
              value={entry.wake_time}
              onChange={(v) => patch({ wake_time: v })}
            />
          </Section>

          {/* 5 — MIND */}
          <Section icon={Sparkles} title="Mind">
            <ToggleRow
              label="Meditation"
              checked={entry.meditation_done}
              onChange={(v) => patch({ meditation_done: v })}
            />
            <NumberField
              label="Minutes"
              value={entry.meditation_minutes}
              onChange={(v) => patch({ meditation_minutes: v })}
              step={1}
              max={180}
              seed={10}
              unit="m"
            />
            <TextRow
              label="Session"
              value={entry.meditation_session}
              placeholder="Basics 3"
              listId="headspace-sessions"
              onChange={(v) => patch({ meditation_session: v })}
            />
            <datalist id="headspace-sessions">
              {sessionNames.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </Section>

          {/* 6 — CRAFT */}
          <Section icon={Swords} title="Craft">
            <p className="mb-2 text-[11px] text-[var(--ink-mute)]">
              Quick-add a session. More than one a day is fine.
            </p>
            <NumberField
              label="Reading minutes"
              value={readMin}
              onChange={setReadMin}
              step={5}
              max={600}
              seed={20}
              unit="m"
            />
            <NumberField
              label="Pages"
              value={readPages}
              onChange={setReadPages}
              step={5}
              max={2000}
              seed={20}
            />
            <button
              type="button"
              onClick={logReading}
              disabled={readMin === null && readPages === null}
              className={cn(
                "mt-1 inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-[13px] font-medium",
                "border border-[var(--hairline)] bg-[var(--surface-sunk)] text-[var(--ink-soft)]",
                "transition-colors duration-200 ease-[var(--ease-house)]",
                "hover:text-[var(--ink)] disabled:opacity-35",
              )}
            >
              <Plus size={14} aria-hidden /> Add reading session
            </button>

            <div className="my-4 h-px bg-[var(--hairline)]" />

            <Segmented
              label="Chess"
              options={["lesson", "puzzles", "game", "study", "review"] as const}
              value={chessKind}
              onChange={(v) => setChessKind(v ?? "puzzles")}
            />
            <NumberField
              label="Chess minutes"
              value={chessMin}
              onChange={setChessMin}
              step={5}
              max={600}
              seed={15}
              unit="m"
            />
            <button
              type="button"
              onClick={logChess}
              disabled={chessMin === null}
              className={cn(
                "mt-1 inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-[13px] font-medium",
                "border border-[var(--hairline)] bg-[var(--surface-sunk)] text-[var(--ink-soft)]",
                "transition-colors duration-200 ease-[var(--ease-house)]",
                "hover:text-[var(--ink)] disabled:opacity-35",
              )}
            >
              <Plus size={14} aria-hidden /> Add chess session
            </button>
          </Section>

          {/* 7 — REFLECTION */}
          <Section icon={NotebookPen} title="Reflection">
            <Scale5
              label="Mood"
              value={entry.mood}
              onChange={(v) => patch({ mood: v })}
            />
            <Scale5
              label="Energy"
              value={entry.energy}
              onChange={(v) => patch({ energy: v })}
              tint="var(--m-move)"
            />
            <label className="mt-3 block">
              <span className="mb-2 block text-sm text-[var(--ink-soft)]">
                Anything worth remembering?
              </span>
              <textarea
                rows={3}
                value={entry.day_note ?? ""}
                placeholder="In your words."
                onChange={(e) =>
                  patch({ day_note: e.target.value === "" ? null : e.target.value })
                }
                className={cn(
                  "w-full resize-none rounded-xl border border-[var(--hairline)] bg-[var(--surface-sunk)]",
                  "px-3 py-2.5 text-sm text-[var(--ink)] outline-none",
                  "placeholder:text-[var(--ink-mute)] focus-visible:border-[var(--accent)]",
                )}
              />
            </label>
          </Section>

          <div className="px-5 pt-2 pb-8">
            <p className="text-center text-[11px] text-[var(--ink-mute)]">
              Everything here is optional, and saves as you go.
            </p>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

export default CheckInSheet;
