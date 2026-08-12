"use client";

// ============================================================
// TODAY — the home screen (SPEC §5.1)
//
// Top to bottom: ambient time-of-day header · quote of the day ·
// eight habit rings · progress bar · supplement slot cards ·
// this-week strip · pursuits row · mood & energy (after 4 PM).
//
// Design rules honoured here:
//   · Nulls are not zeros. An unlogged metric reads "—", never 0.
//   · Nothing is ever red. Untouched rings are hairline grey.
//   · Every colour comes from a token; no literals.
// ============================================================

import * as React from "react";
import Link from "next/link";
import {
  Beef,
  BookOpen,
  Check,
  ChevronRight,
  Crown,
  Droplet,
  Dumbbell,
  Flame,
  Footprints,
  Heart,
  Moon,
  PenLine,
  Pill,
  Plus,
  Settings as SettingsIcon,
  Sparkles,
  X,
  type LucideIcon,
} from "lucide-react";

import { AppShell } from "@/components/tab-bar";
import {
  CheckInSheet,
  emptyEntry,
  formatLongDate,
  toISODate,
  todayISO,
} from "@/components/check-in-sheet";
import { cn } from "@/lib/utils";
import {
  addReadingSession,
  addReflection,
  assignQuoteOfDay,
  ensureSeeded,
  getBooks,
  getChessSessions,
  getEntries,
  getEntry,
  getQuoteOfDay,
  getReadingSessions,
  getSettings,
  getSupplementLogs,
  getSupplements,
  setQuoteFavorite,
  setSupplementTaken,
  upsertEntry,
} from "@/lib/data";
import type {
  Book,
  ChessSession,
  DailyEntry,
  Quote,
  QuoteTheme,
  ReadingSession,
  Settings,
  Supplement,
  SupplementLog,
} from "@/lib/types";

// ============================================================
// time of day
// ============================================================

type Phase = "dawn" | "day" | "dusk" | "night";

function phaseForHour(h: number): Phase {
  if (h >= 5 && h < 10) return "dawn";
  if (h >= 10 && h < 16) return "day";
  if (h >= 16 && h < 20) return "dusk";
  return "night";
}

function greetingForHour(h: number): string {
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

/**
 * The current local hour, re-read every minute. Subscribed rather
 * than held in state so the server pass has no clock at all (-1)
 * and hydration can't mismatch.
 */
function subscribeToMinute(onChange: () => void) {
  const t = setInterval(onChange, 60_000);
  return () => clearInterval(t);
}

function useLocalHour(): number {
  return React.useSyncExternalStore(
    subscribeToMinute,
    () => new Date().getHours(),
    () => -1,
  );
}

/** Gradient meshes built from palette tokens — dawn peach/rose,
 *  clear ivory-blue, amber dusk, deep violet-indigo. */
const AMBIENT: Record<Phase, string> = {
  dawn: [
    "radial-gradient(90% 80% at 12% -5%, color-mix(in srgb, var(--accent) 46%, transparent), transparent 62%)",
    "radial-gradient(80% 75% at 88% 8%, color-mix(in srgb, var(--m-supp) 38%, transparent), transparent 64%)",
    "radial-gradient(120% 90% at 50% 0%, color-mix(in srgb, var(--m-fuel) 14%, transparent), transparent 70%)",
  ].join(","),
  day: [
    "radial-gradient(90% 80% at 18% -8%, color-mix(in srgb, var(--m-fuel) 20%, transparent), transparent 62%)",
    "radial-gradient(85% 75% at 86% 6%, color-mix(in srgb, var(--m-water) 32%, transparent), transparent 64%)",
    "radial-gradient(120% 90% at 50% 0%, color-mix(in srgb, var(--accent) 10%, transparent), transparent 72%)",
  ].join(","),
  dusk: [
    "radial-gradient(95% 85% at 20% -6%, color-mix(in srgb, var(--accent) 50%, transparent), transparent 62%)",
    "radial-gradient(80% 70% at 90% 10%, color-mix(in srgb, var(--m-supp) 34%, transparent), transparent 64%)",
    "radial-gradient(120% 90% at 55% 0%, color-mix(in srgb, var(--m-chess) 20%, transparent), transparent 74%)",
  ].join(","),
  night: [
    "radial-gradient(95% 85% at 16% -8%, color-mix(in srgb, var(--m-sleep) 36%, transparent), transparent 62%)",
    "radial-gradient(85% 75% at 88% 4%, color-mix(in srgb, var(--m-mind) 34%, transparent), transparent 64%)",
    "radial-gradient(130% 95% at 50% 0%, color-mix(in srgb, var(--m-sleep) 16%, transparent), transparent 74%)",
  ].join(","),
};

/** Theme wash for the quote card (SPEC §5.1.2) — token-derived. */
const QUOTE_TINT: Record<QuoteTheme, string> = {
  security: "var(--m-fuel)", // warm sand
  confidence: "var(--accent)", // apricot
  courage: "var(--m-supp)",
  calm: "var(--m-walk)", // sage
  "self-trust": "var(--m-mind)",
  discipline: "var(--m-sleep)",
  gratitude: "var(--m-read)",
};

// ============================================================
// date helpers
// ============================================================

function shiftDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return toISODate(dt);
}

function weekDatesFor(iso: string, weekStartsOn: number): string[] {
  const [y, m, d] = iso.split("-").map(Number);
  const base = new Date(y, m - 1, d);
  const isoDay = base.getDay() === 0 ? 7 : base.getDay(); // 1=Mon…7=Sun
  const back = (isoDay - weekStartsOn + 7) % 7;
  const start = shiftDays(iso, -back);
  return Array.from({ length: 7 }, (_, i) => shiftDays(start, i));
}

function weekdayLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "short" });
}

function sumMinutes(rows: { minutes: number | null }[]): number | null {
  const vals = rows.map((r) => r.minutes).filter((v): v is number => v !== null);
  return vals.length ? vals.reduce((a, b) => a + b, 0) : null;
}

/** Did anything at all get logged on this day? Used for the streak. */
function entryHasData(e: DailyEntry | null | undefined): boolean {
  if (!e) return false;
  return (
    e.meditation_done ||
    e.workout_done ||
    e.walk_done ||
    e.mood !== null ||
    e.energy !== null ||
    e.sleep_hours !== null ||
    e.protein_g !== null ||
    e.water_oz !== null ||
    e.meditation_minutes !== null ||
    e.walk_minutes !== null ||
    e.workout_minutes !== null ||
    e.day_note !== null
  );
}

// ============================================================
// metric derivation
// ============================================================

interface RingSpec {
  key: string;
  label: string;
  icon: LucideIcon;
  color: string;
  done: boolean;
  progress: number; // 0–1
  value: string; // "7.5 h" · "3 of 5" · "—"
  /** boolean tiles toggle on tap; numeric tiles open the stepper */
  kind: "bool" | "numeric" | "supplements" | "reading";
}

function pct(v: number | null, target: number): number {
  if (v === null || target <= 0) return 0;
  return Math.max(0, Math.min(1, v / target));
}

function buildRings(
  entry: DailyEntry,
  settings: Settings,
  suppCounted: number,
  readingMinutes: number | null,
  readingLoggedToday: boolean,
): RingSpec[] {
  const medDone =
    entry.meditation_done ||
    (entry.meditation_minutes !== null &&
      entry.meditation_minutes >= settings.meditation_target_min);

  const sleepDone =
    entry.sleep_hours !== null &&
    entry.sleep_hours >= settings.sleep_target_min &&
    entry.sleep_hours <= settings.sleep_target_max;

  const proteinDone =
    entry.protein_g !== null && entry.protein_g >= settings.protein_target_g;
  const waterDone =
    entry.water_oz !== null && entry.water_oz >= settings.water_target_oz;
  const suppDone = suppCounted >= settings.supplement_target_doses;

  // a session logged without minutes still counts — nulls are not zeros
  const readDone =
    (readingMinutes !== null && readingMinutes >= settings.reading_target_min) ||
    (readingLoggedToday && readingMinutes === null);

  return [
    {
      key: "meditation",
      label: "Meditation",
      icon: Sparkles,
      color: "var(--m-mind)",
      done: medDone,
      progress: medDone ? 1 : pct(entry.meditation_minutes, settings.meditation_target_min),
      value:
        entry.meditation_minutes !== null
          ? `${entry.meditation_minutes} min${entry.meditation_session ? ` · ${entry.meditation_session}` : ""}`
          : medDone
            ? "Done"
            : "—",
      kind: "bool",
    },
    {
      key: "sleep",
      label: "Sleep",
      icon: Moon,
      color: "var(--m-sleep)",
      done: sleepDone,
      progress: pct(entry.sleep_hours, settings.sleep_target_hours),
      value:
        entry.sleep_hours !== null
          ? `${entry.sleep_hours} h${sleepDone ? " · in band" : ""}`
          : "—",
      kind: "numeric",
    },
    {
      key: "workout",
      label: "Workout",
      icon: Dumbbell,
      color: "var(--m-move)",
      done: entry.workout_done,
      progress: entry.workout_done ? 1 : 0,
      value:
        entry.workout_minutes !== null
          ? `${entry.workout_minutes} min${entry.workout_type ? ` · ${entry.workout_type}` : ""}`
          : entry.workout_done
            ? (entry.workout_type ?? "Done")
            : "—",
      kind: "bool",
    },
    {
      key: "walk",
      label: "Walk",
      icon: Footprints,
      color: "var(--m-walk)",
      done: entry.walk_done,
      progress: entry.walk_done ? 1 : pct(entry.walk_minutes, settings.walk_target_min),
      value:
        entry.walk_minutes !== null
          ? `${entry.walk_minutes} min${entry.walk_steps !== null ? ` · ${entry.walk_steps.toLocaleString()} steps` : ""}`
          : entry.walk_done
            ? "Done"
            : "—",
      kind: "bool",
    },
    {
      key: "protein",
      label: "Protein",
      icon: Beef,
      color: "var(--m-fuel)",
      done: proteinDone,
      progress: pct(entry.protein_g, settings.protein_target_g),
      value:
        entry.protein_g !== null
          ? `${entry.protein_g} of ${settings.protein_target_g} g`
          : "—",
      kind: "numeric",
    },
    {
      key: "water",
      label: "Water",
      icon: Droplet,
      color: "var(--m-water)",
      done: waterDone,
      progress: pct(entry.water_oz, settings.water_target_oz),
      value:
        entry.water_oz !== null
          ? `${entry.water_oz} of ${settings.water_target_oz} oz`
          : "—",
      kind: "numeric",
    },
    {
      key: "supplements",
      label: "Supplements",
      icon: Pill,
      color: "var(--m-supp)",
      done: suppDone,
      progress: pct(suppCounted, settings.supplement_target_doses),
      value: `${suppCounted} of ${settings.supplement_target_doses} doses`,
      kind: "supplements",
    },
    {
      key: "reading",
      label: "Reading",
      icon: BookOpen,
      color: "var(--m-read)",
      done: readDone,
      progress: readDone ? 1 : pct(readingMinutes, settings.reading_target_min),
      value:
        readingMinutes !== null
          ? `${readingMinutes} min`
          : readingLoggedToday
            ? "Logged"
            : "—",
      kind: "reading",
    },
  ];
}

// ============================================================
// primitives
// ============================================================

/**
 * A progress ring drawn as an arc path starting at 12 o'clock.
 * Deliberately not rotated with a CSS transform — reduced-motion
 * forces `transform: none`, which would spin the ring's origin.
 */
function Ring({
  size,
  stroke,
  progress,
  color,
  glow,
  children,
}: {
  size: number;
  stroke: number;
  progress: number;
  color: string;
  glow?: boolean;
  children?: React.ReactNode;
}) {
  const c = size / 2;
  const r = c - stroke / 2 - 0.5;
  const circumference = 2 * Math.PI * r;
  const d = `M ${c} ${c - r} A ${r} ${r} 0 1 1 ${c - 0.001} ${c - r}`;
  const clamped = Math.max(0, Math.min(1, progress));

  return (
    <span
      className="relative grid shrink-0 place-items-center"
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="absolute inset-0"
        aria-hidden
      >
        <path
          d={d}
          fill="none"
          stroke="var(--hairline)"
          strokeWidth={stroke - 0.5}
          strokeLinecap="round"
        />
        <path
          d={d}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped)}
          style={{
            transition: "stroke-dashoffset 380ms var(--ease-house)",
            filter: glow
              ? `drop-shadow(0 0 5px color-mix(in srgb, ${color} 55%, transparent))`
              : undefined,
          }}
        />
      </svg>
      <span className="relative">{children}</span>
    </span>
  );
}

function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        "text-[11px] leading-[1.4] font-medium tracking-[0.08em] text-[var(--ink-mute)] uppercase",
        className,
      )}
    >
      {children}
    </p>
  );
}

function Panel({
  children,
  className,
  ...rest
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "rounded-[20px] border border-[var(--hairline)] bg-[var(--surface)]",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

// ============================================================
// ring tile + inline stepper
// ============================================================

const LONG_PRESS_MS = 450;

function buzz() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(12);
    } catch {
      /* unsupported — silently fine */
    }
  }
}

function MetricTile({
  spec,
  index,
  active,
  onToggle,
  onOpenStepper,
}: {
  spec: RingSpec;
  index: number;
  active: boolean;
  onToggle: () => void;
  onOpenStepper: () => void;
}) {
  const [popped, setPopped] = React.useState(false);
  const [drift, setDrift] = React.useState(0);
  const longPressed = React.useRef(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasDone = React.useRef(spec.done);

  React.useEffect(() => {
    const justClosed = spec.done && !wasDone.current;
    wasDone.current = spec.done;
    if (!justClosed) return;
    setPopped(true);
    setDrift((n) => n + 1);
    const t = setTimeout(() => setPopped(false), 420);
    return () => clearTimeout(t);
  }, [spec.done]);

  const clearTimer = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };

  const handleDown = () => {
    longPressed.current = false;
    clearTimer();
    timer.current = setTimeout(() => {
      longPressed.current = true;
      onOpenStepper();
    }, LONG_PRESS_MS);
  };

  const handleUp = () => clearTimer();

  const handleClick = () => {
    clearTimer();
    if (longPressed.current) {
      longPressed.current = false;
      return;
    }
    if (spec.kind === "bool") {
      buzz();
      onToggle();
    } else {
      onOpenStepper();
    }
  };

  const Icon = spec.icon;

  return (
    <div
      className={cn(
        "wd-rise relative flex flex-col rounded-[18px] border",
        "transition-colors duration-300 ease-[var(--ease-house)]",
        active && "z-10",
      )}
      style={{
        animationDelay: `${index * 40}ms`,
        borderColor: spec.done
          ? `color-mix(in srgb, ${spec.color} 24%, var(--hairline))`
          : "var(--hairline)",
        background: spec.done
          ? `linear-gradient(180deg, color-mix(in srgb, ${spec.color} 8%, transparent), transparent 70%), var(--surface)`
          : "var(--surface)",
      }}
    >
      <button
        type="button"
        aria-pressed={spec.kind === "bool" ? spec.done : undefined}
        aria-label={
          spec.kind === "bool"
            ? `${spec.label}, ${spec.done ? "done" : "not yet"}. Tap to toggle, hold to enter detail.`
            : `${spec.label}, ${spec.value}. Tap to adjust.`
        }
        onPointerDown={handleDown}
        onPointerUp={handleUp}
        onPointerLeave={handleUp}
        onPointerCancel={handleUp}
        onContextMenu={(e) => e.preventDefault()}
        onClick={handleClick}
        className="flex min-h-[104px] flex-col items-center gap-2.5 px-3 pt-4 pb-1 select-none"
      >
        <span className="relative">
          <Ring
            size={56}
            stroke={3.5}
            progress={spec.progress}
            color={spec.color}
            glow={spec.done}
          >
            <Icon
              size={21}
              strokeWidth={1.6}
              className={popped ? "wd-pop" : undefined}
              style={{
                color: spec.done ? spec.color : "var(--ink)",
                opacity: spec.done ? 1 : 0.4,
              }}
              aria-hidden
            />
          </Ring>
          {/* three-particle soft upward drift on completion */}
          {drift > 0 && spec.done ? (
            <span
              key={drift}
              aria-hidden
              className="pointer-events-none absolute inset-0"
            >
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="wd-drift absolute block size-1 rounded-full"
                  style={{
                    background: spec.color,
                    left: `${18 + i * 12}px`,
                    top: "34px",
                    animationDelay: `${i * 70}ms`,
                  }}
                />
              ))}
            </span>
          ) : null}
        </span>
        <span className="text-[13px] leading-[1.45] font-medium text-[var(--ink)]">
          {spec.label}
        </span>
      </button>

      <button
        type="button"
        aria-label={`Adjust ${spec.label}`}
        onClick={onOpenStepper}
        className={cn(
          "tabular w-full px-2 pb-3 text-center text-[12px] leading-[1.45]",
          "transition-colors duration-200 ease-[var(--ease-house)]",
          spec.done ? "text-[var(--ink-soft)]" : "text-[var(--ink-mute)]",
        )}
      >
        <span className="line-clamp-1">{spec.value}</span>
      </button>
    </div>
  );
}

/** The inline stepper — slides into the grid directly beneath its
 *  tile, so it can never be clipped on a 390px screen. */
function StepperPanel({
  spec,
  value,
  step,
  unit,
  seed,
  decimals = 0,
  min = 0,
  max,
  targetMet,
  onChange,
  onClose,
  primaryLabel,
  onPrimary,
}: {
  spec: RingSpec;
  value: number | null;
  step: number;
  unit: string;
  seed: number;
  decimals?: number;
  min?: number;
  max: number;
  targetMet: boolean;
  onChange: (v: number | null) => void;
  onClose: () => void;
  primaryLabel?: string;
  onPrimary?: () => void;
}) {
  const bump = (dir: 1 | -1) => {
    if (value === null) {
      onChange(dir === 1 ? seed : min);
      return;
    }
    const next = Math.min(max, Math.max(min, value + dir * step));
    onChange(Number(next.toFixed(decimals)));
  };

  return (
    <div
      className="wd-expand col-span-full rounded-[18px] border p-4"
      style={{
        borderColor: `color-mix(in srgb, ${spec.color} 30%, var(--hairline))`,
        background: `linear-gradient(180deg, color-mix(in srgb, ${spec.color} 7%, transparent), transparent), var(--surface)`,
      }}
    >
      <div className="mb-3 flex items-center justify-between">
        <Eyebrow>{spec.label}</Eyebrow>
        <div className="flex items-center gap-1">
          {targetMet ? (
            <span
              className="inline-flex items-center gap-1 text-[11px] font-medium"
              style={{ color: spec.color }}
            >
              <Check size={12} strokeWidth={3} aria-hidden /> target met
            </span>
          ) : null}
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="grid size-11 place-items-center rounded-full text-[var(--ink-mute)] hover:text-[var(--ink-soft)]"
          >
            <X size={15} aria-hidden />
          </button>
        </div>
      </div>

      <div className="flex items-center justify-center gap-4">
        <button
          type="button"
          aria-label={`Decrease ${spec.label}`}
          onClick={() => bump(-1)}
          disabled={value === null}
          className="grid size-12 place-items-center rounded-full border border-[var(--hairline)] bg-[var(--surface-sunk)] text-[var(--ink-soft)] transition-colors hover:text-[var(--ink)] disabled:opacity-35"
        >
          <span className="text-xl leading-none">−</span>
        </button>

        <span className="tabular min-w-24 text-center">
          <span className="font-display text-[28px] leading-none text-[var(--ink)]">
            {value === null ? (
              <span className="text-[var(--ink-mute)]">—</span>
            ) : (
              value.toFixed(decimals)
            )}
          </span>
          <span className="ml-1 text-sm text-[var(--ink-mute)]">{unit}</span>
        </span>

        <button
          type="button"
          aria-label={`Increase ${spec.label}`}
          onClick={() => bump(1)}
          className="grid size-12 place-items-center rounded-full border border-[var(--hairline)] bg-[var(--surface-sunk)] text-[var(--ink-soft)] transition-colors hover:text-[var(--ink)]"
        >
          <Plus size={18} aria-hidden />
        </button>
      </div>

      <div className="mt-3 flex items-center justify-center gap-2">
        {value !== null ? (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="min-h-11 rounded-full px-4 text-xs text-[var(--ink-mute)] transition-colors hover:text-[var(--ink-soft)]"
          >
            Clear
          </button>
        ) : null}
        {primaryLabel && onPrimary ? (
          <button
            type="button"
            onClick={onPrimary}
            disabled={value === null}
            className="min-h-11 rounded-full bg-[var(--accent)] px-5 text-[13px] font-medium text-[var(--canvas)] transition-opacity disabled:opacity-35"
          >
            {primaryLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}

// ============================================================
// supplement slot card
// ============================================================

function SlotCard({
  name,
  time,
  rows,
  isTaken,
  onToggle,
  live,
}: {
  name: string;
  time: string;
  rows: Supplement[];
  isTaken: (id: number) => boolean;
  onToggle: (id: number, next: boolean) => void;
  live: boolean;
}) {
  const taken = rows.filter((s) => isTaken(s.id)).length;
  const complete = rows.length > 0 && taken === rows.length;

  return (
    <Panel
      className={cn(
        "px-[18px] pt-[18px] pb-3.5 transition-all duration-300 ease-[var(--ease-house)]",
        live && "order-first",
      )}
      style={{
        borderColor: live
          ? "color-mix(in srgb, var(--accent) 42%, var(--hairline))"
          : complete
            ? "color-mix(in srgb, var(--m-supp) 34%, var(--hairline))"
            : "var(--hairline)",
        background: live
          ? "linear-gradient(180deg, color-mix(in srgb, var(--accent) 6%, transparent), transparent 60%), var(--surface)"
          : "var(--surface)",
      }}
    >
      <div className="flex items-center justify-between gap-2.5 border-b border-[var(--hairline)] pb-3">
        <div className="flex items-center gap-2.5">
          <span className="text-sm font-semibold text-[var(--ink)]">{name}</span>
          <span className="tabular text-xs text-[var(--ink-mute)]">{time}</span>
          {live ? (
            <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-semibold tracking-[0.08em] text-[var(--accent)] uppercase">
              Now
            </span>
          ) : null}
        </div>
        <span
          className={cn(
            "tabular inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[12.5px] font-semibold",
            "transition-colors duration-300 ease-[var(--ease-house)]",
          )}
          style={
            complete
              ? { background: "var(--m-supp)", color: "var(--canvas)" }
              : { background: "var(--surface-sunk)", color: "var(--ink-mute)" }
          }
        >
          {complete ? <Check size={11} strokeWidth={3.5} aria-hidden /> : null}
          {taken}/{rows.length}
        </span>
      </div>

      <ul>
        {rows.map((s) => {
          const on = isTaken(s.id);
          return (
            <li key={s.id}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => {
                  buzz();
                  onToggle(s.id, !on);
                }}
                className="flex min-h-11 w-full items-center gap-3 border-b border-[var(--hairline)] py-2.5 text-left last:border-b-0"
              >
                <span
                  className={cn(
                    "grid size-[21px] shrink-0 place-items-center rounded-[7px] border",
                    "transition-all duration-200 ease-[var(--ease-house)]",
                  )}
                  style={
                    on
                      ? {
                          background: "var(--m-supp)",
                          borderColor: "var(--m-supp)",
                          color: "var(--canvas)",
                          boxShadow:
                            "0 0 10px color-mix(in srgb, var(--m-supp) 30%, transparent)",
                        }
                      : { borderColor: "var(--hairline)", color: "transparent" }
                  }
                >
                  <Check size={12} strokeWidth={3.2} aria-hidden />
                </span>
                <span
                  className={cn(
                    "text-sm font-medium",
                    on ? "text-[var(--ink-soft)]" : "text-[var(--ink)]",
                  )}
                >
                  {s.name}
                </span>
                <span className="tabular ml-auto text-right text-xs text-[var(--ink-mute)]">
                  {s.brand ?? s.dose_label}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

// ============================================================
// the page
// ============================================================

interface TodayData {
  date: string;
  entry: DailyEntry;
  settings: Settings;
  supplements: Supplement[];
  logs: SupplementLog[];
  quote: Quote | null;
  books: Book[];
  reading: ReadingSession[];
  chess: ChessSession[];
  weekClosed: (number | null)[];
  weekDates: string[];
  streak: number;
}

export default function TodayPage() {
  const [data, setData] = React.useState<TodayData | null>(null);
  const [openStepper, setOpenStepper] = React.useState<string | null>(null);
  const [checkInDate, setCheckInDate] = React.useState<string | null>(null);
  const [reflecting, setReflecting] = React.useState(false);
  const [reflection, setReflection] = React.useState("");
  const [moodDismissed, setMoodDismissed] = React.useState(false);
  const [bloom, setBloom] = React.useState(false);
  const prevClosed = React.useRef<number | null>(null);
  const localHour = useLocalHour();

  const load = React.useCallback(async (): Promise<TodayData> => {
    ensureSeeded();
    const date = todayISO();

    const [entry, settings, supplements, logs, books, reading, chess] =
      await Promise.all([
        getEntry(date),
        getSettings(),
        getSupplements(),
        getSupplementLogs(date),
        getBooks(),
        getReadingSessions(),
        getChessSessions(),
      ]);

    const quote = (await getQuoteOfDay(date)) ?? (await assignQuoteOfDay(date));

    // --- this-week strip ---
    const wDates = weekDatesFor(date, settings.week_starts_on);
    const history = await getEntries(shiftDays(date, -400));
    const byDate = new Map(history.map((e) => [e.entry_date, e]));

    const weekClosed = await Promise.all(
      wDates.map(async (d) => {
        if (d > date) return null; // the future is not a gap
        const dLogs = d === date ? logs : await getSupplementLogs(d);
        const counted = supplements.filter(
          (s) => s.counts_toward_target && dLogs.some((l) => l.supplement_id === s.id && l.taken),
        ).length;
        const dReading = reading.filter((r) => r.session_date === d);
        const rings = buildRings(
          byDate.get(d) ?? emptyEntry(d),
          settings,
          counted,
          sumMinutes(dReading),
          dReading.length > 0,
        );
        return rings.filter((r) => r.done).length;
      }),
    );

    // --- logging streak: walk back until a truly empty day ---
    let streak = 0;
    let cursor = date;
    const dayLogged = async (d: string) => {
      if (entryHasData(byDate.get(d))) return true;
      if (reading.some((r) => r.session_date === d)) return true;
      if (chess.some((c) => c.session_date === d)) return true;
      const dLogs = d === date ? logs : await getSupplementLogs(d);
      return dLogs.some((l) => l.taken);
    };
    // a quiet morning shouldn't zero the chip — start at yesterday instead
    if (!(await dayLogged(cursor))) cursor = shiftDays(cursor, -1);
    while (streak < 400 && (await dayLogged(cursor))) {
      streak += 1;
      cursor = shiftDays(cursor, -1);
    }

    return {
      date,
      entry: entry ?? emptyEntry(date),
      settings,
      supplements,
      logs,
      quote,
      books,
      reading,
      chess,
      weekClosed,
      weekDates: wDates,
      streak,
    };
  }, []);

  React.useEffect(() => {
    let alive = true;
    load().then((next) => {
      if (alive) setData(next);
    });
    return () => {
      alive = false;
    };
  }, [load]);

  /** Re-read everything after a write elsewhere (e.g. the sheet). */
  const refresh = React.useCallback(() => {
    load().then(setData);
  }, [load]);

  // ---------- derived ----------

  const derived = React.useMemo(() => {
    if (!data) return null;
    const scheduled = data.supplements.filter((s) => s.counts_toward_target);
    const counted = scheduled.filter((s) =>
      data.logs.some((l) => l.supplement_id === s.id && l.taken),
    ).length;
    const todayReading = data.reading.filter((r) => r.session_date === data.date);
    const rings = buildRings(
      data.entry,
      data.settings,
      counted,
      sumMinutes(todayReading),
      todayReading.length > 0,
    );
    return {
      rings,
      closed: rings.filter((r) => r.done).length,
      counted,
      scheduled,
      readingMinutes: sumMinutes(todayReading),
    };
  }, [data]);

  // perfect-day bloom (SPEC §7) — fires when the eighth ring closes
  React.useEffect(() => {
    if (!derived) return;
    const was = prevClosed.current;
    prevClosed.current = derived.closed;
    if (was !== null && was < 8 && derived.closed === 8) {
      setBloom(true);
      const t = setTimeout(() => setBloom(false), 3400);
      return () => clearTimeout(t);
    }
  }, [derived]);

  // ---------- mutations ----------

  const patchEntry = async (p: Partial<DailyEntry>) => {
    if (!data) return;
    const next = { ...data.entry, ...p };
    setData({ ...data, entry: next });
    await upsertEntry(next);
  };

  const toggleSupplement = async (id: number, next: boolean) => {
    if (!data) return;
    const logs = [...data.logs];
    const i = logs.findIndex((l) => l.supplement_id === id);
    const row: SupplementLog = {
      log_date: data.date,
      supplement_id: id,
      taken: next,
      taken_at: next ? new Date().toISOString() : null,
    };
    if (i >= 0) logs[i] = row;
    else logs.push(row);
    setData({ ...data, logs });
    await setSupplementTaken(data.date, id, next);
  };

  const toggleRing = async (spec: RingSpec) => {
    if (!data) return;
    switch (spec.key) {
      case "meditation":
        return patchEntry({ meditation_done: !data.entry.meditation_done });
      case "workout":
        return patchEntry({ workout_done: !data.entry.workout_done });
      case "walk":
        return patchEntry({ walk_done: !data.entry.walk_done });
      default:
        return;
    }
  };

  // -1 on the server pass; the page renders its skeleton there anyway
  const hour = localHour < 0 ? 8 : localHour;
  const phase = phaseForHour(hour);
  const afternoonLive = hour >= 11 && hour < 16;
  const nightLive = hour >= 20 || hour < 2;

  // ---------- loading ----------

  if (!data || !derived) {
    return (
      <AppShell>
        <div className="mx-auto w-full max-w-[1120px] px-5 py-16 lg:px-12">
          <div className="h-6 w-40 animate-pulse rounded-full bg-[var(--surface-sunk)]" />
          <div className="mt-4 h-40 animate-pulse rounded-[20px] bg-[var(--surface-sunk)]" />
        </div>
      </AppShell>
    );
  }

  const { rings, closed, counted, scheduled } = derived;
  const name = data.settings.display_name;
  const flexible = data.supplements.filter((s) => s.slot === "flexible");
  const isTaken = (id: number) =>
    data.logs.some((l) => l.supplement_id === id && l.taken);

  const currentBook = data.books.find((b) => b.status === "reading") ?? null;
  const weekChess = data.chess.filter((c) => data.weekDates.includes(c.session_date));
  const weekChessMin = sumMinutes(weekChess);

  const closedColors = rings.filter((r) => r.done).map((r) => r.color);
  const progressGradient =
    closedColors.length === 0
      ? "var(--hairline)"
      : closedColors.length === 1
        ? closedColors[0]
        : `linear-gradient(90deg, ${closedColors.join(", ")})`;

  const showMood = hour >= 16 && !moodDismissed;

  // --- the stepper config per metric ---
  const stepperFor = (spec: RingSpec) => {
    switch (spec.key) {
      case "sleep":
        return {
          value: data.entry.sleep_hours,
          step: 0.5,
          unit: "h",
          seed: 7.5,
          decimals: 1,
          max: 12,
          onChange: (v: number | null) => patchEntry({ sleep_hours: v }),
        };
      case "protein":
        return {
          value: data.entry.protein_g,
          step: 10,
          unit: "g",
          seed: 100,
          max: 300,
          onChange: (v: number | null) => patchEntry({ protein_g: v }),
        };
      case "water":
        return {
          value: data.entry.water_oz,
          step: 8,
          unit: "oz",
          seed: 40,
          max: 200,
          onChange: (v: number | null) => patchEntry({ water_oz: v }),
        };
      case "meditation":
        return {
          value: data.entry.meditation_minutes,
          step: 5,
          unit: "min",
          seed: 10,
          max: 180,
          onChange: (v: number | null) =>
            patchEntry({
              meditation_minutes: v,
              meditation_done: v !== null ? true : data.entry.meditation_done,
            }),
        };
      case "walk":
        return {
          value: data.entry.walk_minutes,
          step: 5,
          unit: "min",
          seed: 30,
          max: 300,
          onChange: (v: number | null) =>
            patchEntry({
              walk_minutes: v,
              walk_done: v !== null ? true : data.entry.walk_done,
            }),
        };
      case "workout":
        return {
          value: data.entry.workout_minutes,
          step: 5,
          unit: "min",
          seed: 45,
          max: 300,
          onChange: (v: number | null) =>
            patchEntry({
              workout_minutes: v,
              workout_done: v !== null ? true : data.entry.workout_done,
            }),
        };
      default:
        return null;
    }
  };

  return (
    <AppShell greeting={greetingForHour(hour)} subline={formatLongDate(data.date)}>
      <StyleBlock />

      {/* ── 1 · ambient header ─────────────────────────────── */}
      <header className="relative">
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-[196px]"
          style={{
            background: AMBIENT[phase],
            maskImage:
              "linear-gradient(180deg, #000 0%, #000 58%, transparent 100%)",
            WebkitMaskImage:
              "linear-gradient(180deg, #000 0%, #000 58%, transparent 100%)",
            transition: "background 600ms var(--ease-house)",
          }}
        />
        <div className="relative mx-auto w-full max-w-[1120px] px-5 pt-7 lg:px-12">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="font-display text-[32px] leading-[1.2] font-normal tracking-[-0.015em] text-[var(--ink)]">
                {greetingForHour(hour)}, {name}
              </h1>
              <p className="mt-1.5 text-sm tracking-[0.04em] text-[var(--ink-soft)]">
                {formatLongDate(data.date)}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2.5">
              <Link
                href="/settings"
                aria-label="Settings"
                className="grid size-11 place-items-center rounded-full text-[var(--ink-soft)] transition-colors hover:text-[var(--ink)]"
              >
                <SettingsIcon size={19} strokeWidth={1.6} aria-hidden />
              </Link>
              {data.streak > 0 ? (
                <span
                  className="tabular inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium whitespace-nowrap text-[var(--ink)] backdrop-blur-md"
                  style={{
                    background: "color-mix(in srgb, var(--ink) 7%, transparent)",
                    borderColor: "color-mix(in srgb, var(--ink) 9%, transparent)",
                  }}
                >
                  <Flame
                    size={14}
                    className="text-[var(--accent)] drop-shadow-[0_0_6px_var(--accent)]"
                    fill="currentColor"
                    fillOpacity={0.5}
                    aria-hidden
                  />
                  <b className="font-semibold">{data.streak}</b> day streak
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1120px] px-5 pt-8 lg:px-12">
        <div className="lg:grid lg:grid-cols-[3fr_2fr] lg:items-start lg:gap-8">
          {/* ── left column ─────────────────────────────────── */}
          <div className="flex flex-col gap-8">
            {/* 2 · quote of the day */}
            {data.quote ? (
              <QuoteCard
                quote={data.quote}
                reflecting={reflecting}
                reflection={reflection}
                onReflectionChange={setReflection}
                onToggleReflect={() => setReflecting((r) => !r)}
                onSaveReflection={async () => {
                  if (!data.quote || !reflection.trim()) return;
                  await addReflection(data.quote.id, reflection.trim());
                  setReflection("");
                  setReflecting(false);
                }}
                onFavorite={async () => {
                  if (!data.quote) return;
                  const next = !data.quote.is_favorite;
                  setData({ ...data, quote: { ...data.quote, is_favorite: next } });
                  await setQuoteFavorite(data.quote.id, next);
                }}
              />
            ) : null}

            {/* 3 · ring grid */}
            <section aria-label="Today's habits">
              <Eyebrow className="mb-3">Today</Eyebrow>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {rings.map((spec, i) => {
                  const cfg = stepperFor(spec);
                  const isOpen = openStepper === spec.key;
                  return (
                    <React.Fragment key={spec.key}>
                      <MetricTile
                        spec={spec}
                        index={i}
                        active={isOpen}
                        onToggle={() => void toggleRing(spec)}
                        onOpenStepper={() => {
                          if (spec.kind === "supplements") {
                            document
                              .getElementById("supplements")
                              ?.scrollIntoView({ behavior: "smooth", block: "center" });
                            return;
                          }
                          setOpenStepper(isOpen ? null : spec.key);
                        }}
                      />
                      {isOpen && spec.kind === "reading" ? (
                        <ReadingStepper
                          spec={spec}
                          target={data.settings.reading_target_min}
                          onClose={() => setOpenStepper(null)}
                          onLog={async (minutes) => {
                            await addReadingSession({
                              session_date: data.date,
                              book_id: currentBook?.id ?? null,
                              minutes,
                              pages: null,
                              notes: null,
                            });
                            setOpenStepper(null);
                            refresh();
                          }}
                        />
                      ) : null}
                      {isOpen && cfg ? (
                        <StepperPanel
                          spec={spec}
                          value={cfg.value}
                          step={cfg.step}
                          unit={cfg.unit}
                          seed={cfg.seed}
                          decimals={cfg.decimals}
                          max={cfg.max}
                          targetMet={spec.done}
                          onChange={cfg.onChange}
                          onClose={() => setOpenStepper(null)}
                        />
                      ) : null}
                    </React.Fragment>
                  );
                })}
              </div>

              {/* 4 · progress bar */}
              <div className="mt-5 mb-2.5 flex items-baseline justify-between">
                <p className="tabular text-sm text-[var(--ink-soft)]">
                  <b className="font-semibold text-[var(--ink)]">{closed}</b> of 8
                  closed today
                </p>
                <p className="text-xs text-[var(--ink-mute)]">
                  {closed === 8 ? "That's a perfect day." : `${8 - closed} to go`}
                </p>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-[var(--surface-sunk)]">
                <div
                  className="h-full rounded-full transition-[width] duration-[380ms] ease-[var(--ease-house)]"
                  style={{
                    width: `${(closed / 8) * 100}%`,
                    background: progressGradient,
                    boxShadow:
                      closed > 0
                        ? "0 0 14px color-mix(in srgb, var(--accent) 28%, transparent)"
                        : undefined,
                  }}
                />
              </div>

              {/* chess + mood — tracked, but they don't gate a perfect day */}
              <div className="mt-4 flex flex-wrap items-center gap-2.5">
                <ChessChip
                  minutes={sumMinutes(
                    data.chess.filter((c) => c.session_date === data.date),
                  )}
                  target={data.settings.chess_target_min}
                />
                <MoodChip mood={data.entry.mood} energy={data.entry.energy} />
              </div>
            </section>
          </div>

          {/* ── right column ────────────────────────────────── */}
          <div className="mt-8 flex flex-col gap-8 lg:mt-0">
            {/* 5 · supplement slots */}
            <section id="supplements" aria-label="Supplements" className="scroll-mt-8">
              <Eyebrow className="mb-3">
                Supplements · {counted} of {data.settings.supplement_target_doses} doses
              </Eyebrow>
              <div className="flex flex-col gap-3">
                <SlotCard
                  name="Afternoon"
                  time="12:00 PM"
                  rows={scheduled.filter((s) => s.slot === "afternoon")}
                  isTaken={isTaken}
                  onToggle={(id, next) => void toggleSupplement(id, next)}
                  live={afternoonLive}
                />
                <SlotCard
                  name="Night"
                  time="10:00 PM"
                  rows={scheduled.filter((s) => s.slot === "night")}
                  isTaken={isTaken}
                  onToggle={(id, next) => void toggleSupplement(id, next)}
                  live={nightLive}
                />
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {flexible.map((s) => {
                  const on = isTaken(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => void toggleSupplement(s.id, !on)}
                      className={cn(
                        "inline-flex min-h-11 items-center gap-2 rounded-full border px-3.5 text-[12.5px]",
                        "border-[var(--hairline)] bg-[var(--surface-sunk)]",
                        "transition-colors duration-200 ease-[var(--ease-house)]",
                        on ? "text-[var(--ink)]" : "text-[var(--ink-soft)]",
                      )}
                    >
                      <span
                        className="block size-1.5 rounded-full"
                        style={{
                          background: on ? "var(--m-supp)" : "var(--ink-mute)",
                          boxShadow: on
                            ? "0 0 7px color-mix(in srgb, var(--m-supp) 60%, transparent)"
                            : undefined,
                        }}
                      />
                      {s.name}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2.5 text-[11.5px] text-[var(--ink-mute)]">
                Flexible — not counted in your 5.
              </p>
            </section>

            {/* 6 · this week */}
            <section aria-label="This week">
              <Eyebrow className="mb-3">This week</Eyebrow>
              <Panel className="flex items-start justify-between px-1.5 pt-4 pb-1">
                {data.weekDates.map((d, i) => {
                  const isToday = d === data.date;
                  const count = data.weekClosed[i];
                  const future = d > data.date;
                  return (
                    <button
                      key={d}
                      type="button"
                      disabled={future}
                      onClick={() => setCheckInDate(d)}
                      aria-label={`${formatLongDate(d)}${count !== null ? `, ${count} of 8 closed` : ""}`}
                      className="flex min-h-11 flex-1 flex-col items-center gap-1.5 disabled:opacity-45"
                    >
                      <span
                        className={cn(
                          "text-[10.5px] font-medium tracking-[0.06em] uppercase",
                          isToday ? "text-[var(--accent)]" : "text-[var(--ink-mute)]",
                        )}
                      >
                        {weekdayLabel(d)}
                      </span>
                      <span
                        className={cn("grid place-items-center rounded-full p-[3px]")}
                        style={
                          isToday
                            ? {
                                boxShadow:
                                  "0 0 0 1px color-mix(in srgb, var(--accent) 55%, transparent)",
                              }
                            : undefined
                        }
                      >
                        <Ring
                          size={26}
                          stroke={3}
                          progress={(count ?? 0) / 8}
                          color="var(--accent)"
                        />
                      </span>
                      <span className="tabular text-[10.5px] text-[var(--ink-mute)]">
                        {count === null ? "—" : `${count}/8`}
                      </span>
                    </button>
                  );
                })}
              </Panel>
            </section>

            {/* 7 · pursuits */}
            <section aria-label="Pursuits">
              <Eyebrow className="mb-3">Pursuits</Eyebrow>
              <div className="grid grid-cols-2 gap-3">
                <Link href="/pursuits" className="block">
                  <Panel className="h-full rounded-[18px] p-4 transition-colors hover:border-[var(--ink-mute)]/40">
                    <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium tracking-[0.08em] text-[var(--m-read)] uppercase">
                      <BookOpen size={12} strokeWidth={2} aria-hidden /> Reading
                    </p>
                    {currentBook ? (
                      <>
                        <p className="font-display line-clamp-2 text-[15.5px] leading-[1.3] text-[var(--ink)]">
                          {currentBook.title}
                        </p>
                        <p className="mt-0.5 text-[11.5px] text-[var(--ink-mute)]">
                          {currentBook.author ?? "—"}
                        </p>
                        <div className="my-3 h-[3px] overflow-hidden rounded-full bg-[var(--surface-sunk)]">
                          <div
                            className="h-full rounded-full bg-[var(--m-read)]"
                            style={{
                              width: `${
                                currentBook.total_pages
                                  ? Math.min(
                                      100,
                                      (currentBook.current_page / currentBook.total_pages) * 100,
                                    )
                                  : 0
                              }%`,
                            }}
                          />
                        </div>
                        <p className="tabular flex justify-between text-[11.5px] text-[var(--ink-mute)]">
                          <span>
                            p. {currentBook.current_page}
                            {currentBook.total_pages ? ` of ${currentBook.total_pages}` : ""}
                          </span>
                          {currentBook.total_pages ? (
                            <span>
                              {Math.round(
                                (currentBook.current_page / currentBook.total_pages) * 100,
                              )}
                              %
                            </span>
                          ) : null}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="font-display text-[15.5px] leading-[1.3] text-[var(--ink)]">
                          No book open right now.
                        </p>
                        <p className="mt-2 inline-flex items-center gap-1 text-[11.5px] text-[var(--accent)]">
                          Start a book <ChevronRight size={12} aria-hidden />
                        </p>
                      </>
                    )}
                  </Panel>
                </Link>

                <Link href="/pursuits" className="block">
                  <Panel className="h-full rounded-[18px] p-4 transition-colors hover:border-[var(--ink-mute)]/40">
                    <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium tracking-[0.08em] text-[var(--m-chess)] uppercase">
                      <Crown size={12} strokeWidth={2} aria-hidden /> Chess
                    </p>
                    {weekChess.length > 0 ? (
                      <>
                        <p className="font-display text-[15.5px] leading-[1.3] text-[var(--ink)]">
                          {weekChess.length} session{weekChess.length === 1 ? "" : "s"} this
                          week
                        </p>
                        <p className="mt-0.5 text-[11.5px] text-[var(--ink-mute)]">
                          {weekChess[weekChess.length - 1]?.topic ?? "Keep going."}
                        </p>
                        <p className="tabular mt-3 text-[11.5px] text-[var(--ink-mute)]">
                          {weekChessMin === null ? "—" : `${weekChessMin} min`}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="font-display text-[15.5px] leading-[1.3] text-[var(--ink)]">
                          No games yet this week.
                        </p>
                        <p className="mt-2 inline-flex items-center gap-1 text-[11.5px] text-[var(--accent)]">
                          Log a session <ChevronRight size={12} aria-hidden />
                        </p>
                      </>
                    )}
                  </Panel>
                </Link>
              </div>
            </section>

            {/* 8 · how was today? (after 4 PM only) */}
            {showMood ? (
              <section aria-label="How was today?">
                <Panel className="p-5">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <h2 className="font-display text-[19px] leading-[1.35] text-[var(--ink)]">
                      How was today?
                    </h2>
                    <button
                      type="button"
                      aria-label="Dismiss"
                      onClick={() => setMoodDismissed(true)}
                      className="grid size-11 shrink-0 place-items-center rounded-full text-[var(--ink-mute)] transition-colors hover:text-[var(--ink-soft)]"
                    >
                      <X size={15} aria-hidden />
                    </button>
                  </div>
                  <ScaleRow
                    label="Mood"
                    value={data.entry.mood}
                    onChange={(v) => void patchEntry({ mood: v })}
                  />
                  <ScaleRow
                    label="Energy"
                    value={data.entry.energy}
                    onChange={(v) => void patchEntry({ energy: v })}
                  />
                </Panel>
              </section>
            ) : null}
          </div>
        </div>
      </main>

      {/* check-in FAB — thumb zone, above the tab bar */}
      <button
        type="button"
        onClick={() => setCheckInDate(data.date)}
        className={cn(
          "fixed right-5 z-30 inline-flex min-h-11 items-center gap-2 rounded-full px-5 py-3",
          "bg-[var(--accent)] text-sm font-semibold text-[var(--canvas)]",
          "bottom-[calc(3.5rem+env(safe-area-inset-bottom)+1rem)] lg:bottom-8",
          "shadow-[0_8px_26px_color-mix(in_srgb,var(--accent)_30%,transparent)]",
          "transition-transform duration-200 ease-[var(--ease-house)] active:scale-[0.97]",
        )}
      >
        <Plus size={16} strokeWidth={2.4} aria-hidden />
        Check in
      </button>

      <CheckInSheet
        open={checkInDate !== null}
        date={checkInDate ?? data.date}
        onOpenChange={(o) => {
          if (!o) setCheckInDate(null);
        }}
        onChanged={refresh}
      />

      {/* perfect-day bloom (SPEC §7) */}
      {bloom ? (
        <div
          className="wd-bloom pointer-events-none fixed inset-0 z-50 grid place-items-center"
          aria-live="polite"
        >
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(60% 45% at 50% 50%, color-mix(in srgb, var(--accent) 30%, transparent), transparent 70%)",
            }}
          />
          <p className="font-display relative text-[26px] text-[var(--ink)]">
            That&rsquo;s a perfect day.
          </p>
        </div>
      ) : null}
    </AppShell>
  );
}

// ============================================================
// smaller pieces
// ============================================================

function QuoteCard({
  quote,
  reflecting,
  reflection,
  onReflectionChange,
  onToggleReflect,
  onSaveReflection,
  onFavorite,
}: {
  quote: Quote;
  reflecting: boolean;
  reflection: string;
  onReflectionChange: (v: string) => void;
  onToggleReflect: () => void;
  onSaveReflection: () => void;
  onFavorite: () => void;
}) {
  const tint = QUOTE_TINT[quote.theme];
  return (
    <section aria-label="Quote of the day">
      <Panel
        className="wd-rise relative overflow-hidden px-6 pt-[26px] pb-[18px]"
        style={{
          background: `linear-gradient(155deg, color-mix(in srgb, ${tint} 11%, transparent), transparent 55%), var(--surface)`,
        }}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute -top-14 -right-12 size-48 rounded-full"
          style={{
            background: `radial-gradient(circle, color-mix(in srgb, ${tint} 16%, transparent), transparent 68%)`,
          }}
        />
        <div className="relative mb-3.5 inline-flex items-center gap-2">
          <span
            className="block size-[7px] rounded-full"
            style={{
              background: tint,
              boxShadow: `0 0 8px color-mix(in srgb, ${tint} 60%, transparent)`,
            }}
          />
          <Eyebrow>{quote.theme.replace("-", " ")}</Eyebrow>
        </div>

        <blockquote className="font-display relative max-w-[19em] text-[21px] leading-[1.55] tracking-[-0.005em] text-[var(--ink)]">
          {quote.body}
        </blockquote>

        <div className="relative mt-4 flex items-center justify-between gap-3">
          <cite className="text-[13px] leading-[1.45] font-medium tracking-[0.09em] text-[var(--ink-mute)] not-italic uppercase">
            {quote.author ?? "Unknown"}
          </cite>
          <div className="flex gap-1">
            <button
              type="button"
              aria-label={quote.is_favorite ? "Remove favorite" : "Favorite this quote"}
              aria-pressed={quote.is_favorite}
              onClick={onFavorite}
              className="grid size-11 place-items-center rounded-full text-[var(--ink-mute)] transition-colors hover:text-[var(--ink-soft)]"
            >
              <Heart
                size={17}
                strokeWidth={1.6}
                fill={quote.is_favorite ? "currentColor" : "none"}
                className={quote.is_favorite ? "text-[var(--accent)]" : undefined}
                aria-hidden
              />
            </button>
            <button
              type="button"
              aria-label="Add a reflection"
              aria-expanded={reflecting}
              onClick={onToggleReflect}
              className="grid size-11 place-items-center rounded-full text-[var(--ink-mute)] transition-colors hover:text-[var(--ink-soft)]"
            >
              <PenLine size={17} strokeWidth={1.6} aria-hidden />
            </button>
          </div>
        </div>

        {reflecting ? (
          <div className="wd-expand relative mt-3 border-t border-[var(--hairline)] pt-3">
            <textarea
              rows={2}
              autoFocus
              value={reflection}
              placeholder="What does this bring up today?"
              onChange={(e) => onReflectionChange(e.target.value)}
              className={cn(
                "w-full resize-none rounded-xl border border-[var(--hairline)] bg-[var(--surface-sunk)]",
                "px-3 py-2.5 text-sm text-[var(--ink)] outline-none",
                "placeholder:text-[var(--ink-mute)] focus-visible:border-[var(--accent)]",
              )}
            />
            <button
              type="button"
              onClick={onSaveReflection}
              disabled={!reflection.trim()}
              className="mt-2 min-h-11 rounded-full bg-[var(--accent)] px-4 text-[13px] font-medium text-[var(--canvas)] transition-opacity disabled:opacity-35"
            >
              Save reflection
            </button>
          </div>
        ) : null}
      </Panel>
    </section>
  );
}

function ChessChip({ minutes, target }: { minutes: number | null; target: number }) {
  return (
    <Link
      href="/pursuits"
      className="inline-flex min-h-11 items-center gap-2.5 rounded-full border border-[var(--hairline)] bg-[var(--surface)] py-2 pr-4 pl-2"
    >
      <Ring
        size={28}
        stroke={2.5}
        progress={minutes === null ? 0 : Math.min(1, minutes / target)}
        color="var(--m-chess)"
      >
        <Crown size={13} strokeWidth={1.7} className="text-[var(--m-chess)]" aria-hidden />
      </Ring>
      <span className="flex flex-col leading-[1.25]">
        <span className="text-[12.5px] font-medium text-[var(--ink)]">Chess</span>
        <span className="tabular text-[11.5px] text-[var(--ink-mute)]">
          {minutes === null ? "—" : minutes} of {target} min
        </span>
      </span>
    </Link>
  );
}

function MoodChip({ mood, energy }: { mood: number | null; energy: number | null }) {
  return (
    <div className="inline-flex min-h-11 items-center gap-2.5 rounded-full border border-[var(--hairline)] bg-[var(--surface)] px-4 py-2">
      <span className="flex items-center gap-1" aria-hidden>
        {[1, 2, 3, 4, 5].map((n) => (
          <span
            key={n}
            className="block size-[9px] rounded-full"
            style={{
              background:
                mood !== null && n <= mood
                  ? "linear-gradient(135deg, var(--m-sleep), var(--m-move))"
                  : "var(--hairline)",
            }}
          />
        ))}
      </span>
      <span className="flex flex-col leading-[1.25]">
        <span className="tabular text-[12.5px] font-medium text-[var(--ink)]">
          Mood {mood ?? "—"} · Energy {energy ?? "—"}
        </span>
        <span className="text-[11.5px] text-[var(--ink-mute)]">
          no target — just a reading
        </span>
      </span>
    </div>
  );
}

function ScaleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="w-14 text-[13px] text-[var(--ink-soft)]">{label}</span>
      <div className="flex items-center gap-1.5">
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
                className="block size-[26px] rounded-full border transition-all duration-200 ease-[var(--ease-house)]"
                style={{
                  background: on
                    ? "linear-gradient(135deg, var(--m-sleep), var(--m-move))"
                    : "var(--surface-sunk)",
                  borderColor: on ? "transparent" : "var(--hairline)",
                  boxShadow: on
                    ? "0 0 12px color-mix(in srgb, var(--accent) 25%, transparent)"
                    : undefined,
                }}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Reading logs a session rather than a column, so its stepper
 *  commits explicitly. Multiple sessions a day are allowed. */
function ReadingStepper({
  spec,
  target,
  onClose,
  onLog,
}: {
  spec: RingSpec;
  target: number;
  onClose: () => void;
  onLog: (minutes: number) => void | Promise<void>;
}) {
  const [minutes, setMinutes] = React.useState<number | null>(target);
  return (
    <StepperPanel
      spec={spec}
      value={minutes}
      step={5}
      unit="min"
      seed={target}
      max={600}
      targetMet={spec.done}
      onChange={setMinutes}
      onClose={onClose}
      primaryLabel="Log session"
      onPrimary={() => {
        if (minutes !== null) void onLog(minutes);
      }}
    />
  );
}

/** Component-scoped keyframes. Everything motion-bearing sits
 *  behind `no-preference`; the reduce branch is an opacity fade,
 *  matching the global collapse in globals.css. */
function StyleBlock() {
  return (
    <style>{`
      @keyframes wd-rise { from { opacity: 0; translate: 0 8px } to { opacity: 1; translate: 0 0 } }
      @keyframes wd-fade { from { opacity: 0 } to { opacity: 1 } }
      @keyframes wd-pop  { 0% { scale: 1 } 45% { scale: 1.12 } 100% { scale: 1 } }
      @keyframes wd-drift { from { opacity: .8; translate: 0 0 } to { opacity: 0; translate: 0 -22px } }
      @keyframes wd-expand { from { opacity: 0; translate: 0 -6px } to { opacity: 1; translate: 0 0 } }
      @keyframes wd-bloom-in { 0% { opacity: 0 } 18% { opacity: 1 } 76% { opacity: 1 } 100% { opacity: 0 } }

      @media (prefers-reduced-motion: no-preference) {
        .wd-rise   { animation: wd-rise 320ms var(--ease-house) both }
        .wd-pop    { animation: wd-pop 380ms var(--ease-house) }
        .wd-drift  { animation: wd-drift 900ms var(--ease-house) forwards }
        .wd-expand { animation: wd-expand 220ms var(--ease-house) both }
      }
      @media (prefers-reduced-motion: reduce) {
        .wd-rise, .wd-expand { animation: wd-fade 120ms both }
        .wd-drift { display: none }
      }
      .wd-bloom { animation: wd-bloom-in 3400ms var(--ease-house) forwards }
    `}</style>
  );
}
