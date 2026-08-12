"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CalendarDays, Flame, TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { ChessSession, DailyEntry, ReadingSession, Settings, Supplement, SupplementLog } from "@/lib/types";
import { METRICS } from "@/lib/types";
import { getChessSessions, getEntries, getReadingSessions, getSettings, getSupplementLogs, getSupplements } from "@/lib/data";
import { cn } from "@/lib/utils";

type Range = "7d" | "30d" | "6mo";
const RANGES: Range[] = ["7d", "30d", "6mo"];
const RANGE_KEY = "wd.analytics_range";

function dateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function subDays(d: Date, n: number): Date {
  return addDays(d, -n);
}

function dayDiff(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}

function formatNum(n: number, decimals = 1): string {
  return n.toFixed(decimals);
}

function formatPct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function shortDay(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "short" }).slice(0, 3);
}

function shortMonth(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short" });
}

function weekNumber(d: Date): number {
  const startOfYear = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7);
}

interface MetricMeta {
  key: string;
  label: string;
  unit: string;
  color: string;
  hasTarget: boolean;
}

const METRICS_META: MetricMeta[] = METRICS.map((m) => ({
  key: m.key,
  label: m.label,
  unit: m.unit,
  color: m.color,
  hasTarget: m.key !== "mood" && m.key !== "chess",
}));

const M = new Map(METRICS_META.map((m) => [m.key, m]));

function isRingMetric(key: string): boolean {
  return METRICS.find((m) => m.key === key)?.ring ?? false;
}

const RING_KEYS = METRICS.filter((m) => m.ring).map((m) => m.key);

function avg(nums: (number | null)[]): number | null {
  const valid = nums.filter((n): n is number => n !== null);
  return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
}

function sum(nums: (number | null)[]): number | null {
  const valid = nums.filter((n): n is number => n !== null);
  return valid.length ? valid.reduce((a, b) => a + b, 0) : null;
}

function nthDay(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function getRangeDates(range: Range): { start: Date; end: Date; prevStart: Date; prevEnd: Date } {
  const end = new Date();
  let start: Date;
  let prevLen: number;
  if (range === "7d") {
    start = nthDay(6);
    prevLen = 7;
  } else if (range === "30d") {
    start = nthDay(29);
    prevLen = 30;
  } else {
    start = new Date(end);
    start.setMonth(start.getMonth() - 5);
    start.setDate(1);
    prevLen = dayDiff(end, start);
  }
  const prevEnd = new Date(start.getTime() - 86400000);
  const prevStart = new Date(prevEnd.getTime() - prevLen * 86400000 + 86400000);
  return { start, end, prevStart, prevEnd };
}

function generateDateRange(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  let d = new Date(start);
  while (d <= end) {
    days.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

function getMetricVal(entry: DailyEntry, key: string): number | null {
  switch (key) {
    case "meditation":
      return entry.meditation_done ? (entry.meditation_minutes ?? 1) : null;
    case "sleep":
      return entry.sleep_hours ?? null;
    case "workout":
      return entry.workout_done ? (entry.workout_minutes ?? 1) : null;
    case "walk":
      return entry.walk_done ? (entry.walk_minutes ?? 1) : null;
    case "protein":
      return entry.protein_g ?? null;
    case "water":
      return entry.water_oz ?? null;
    case "mood":
      return entry.mood ?? null;
    default:
      return null;
  }
}

function metricMetTarget(entry: DailyEntry, key: string, settings: Settings, readingMins: number | null, chessMins: number | null, suppPct: number | null): boolean {
  switch (key) {
    case "meditation":
      return entry.meditation_done && (entry.meditation_minutes ?? 0) >= settings.meditation_target_min;
    case "sleep":
      return (entry.sleep_hours ?? 0) >= settings.sleep_target_min;
    case "workout":
      return entry.workout_done;
    case "walk":
      return entry.walk_done && (entry.walk_minutes ?? 0) >= settings.walk_target_min;
    case "protein":
      return (entry.protein_g ?? 0) >= settings.protein_target_g;
    case "water":
      return (entry.water_oz ?? 0) >= settings.water_target_oz;
    case "supplements":
      return (suppPct ?? 0) >= 1;
    case "reading":
      return (readingMins ?? 0) >= settings.reading_target_min;
    case "chess":
      return (chessMins ?? 0) >= settings.chess_target_min;
    case "mood":
      return (entry.mood ?? 0) >= 4;
    default:
      return false;
  }
}

function getTargetVal(key: string, settings: Settings): number | null {
  switch (key) {
    case "meditation": return settings.meditation_target_min;
    case "sleep": return settings.sleep_target_hours;
    case "workout": return settings.workout_target_days_per_week;
    case "walk": return settings.walk_target_min;
    case "protein": return settings.protein_target_g;
    case "water": return settings.water_target_oz;
    case "supplements": return settings.supplement_target_doses;
    case "reading": return settings.reading_target_min;
    case "chess": return settings.chess_target_min;
    default: return null;
  }
}

function computeStreak(dates: string[]): number {
  if (!dates.length) return 0;
  const sorted = [...dates].sort().reverse();
  let streak = 1;
  const today = new Date().toISOString().slice(0, 10);
  if (sorted[0] !== today && sorted[0] !== nthDay(1).toISOString().slice(0, 10)) return 0;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1]);
    const cur = new Date(sorted[i]);
    const diff = (prev.getTime() - cur.getTime()) / 86400000;
    if (Math.round(diff) === 1) streak++;
    else break;
  }
  return streak;
}

function computeLongestStreak(dates: string[]): number {
  if (!dates.length) return 0;
  const sorted = [...dates].sort();
  let longest = 1;
  let current = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1]);
    const cur = new Date(sorted[i]);
    const diff = (cur.getTime() - prev.getTime()) / 86400000;
    if (Math.round(diff) === 1) {
      current++;
      if (current > longest) longest = current;
    } else {
      current = 1;
    }
  }
  return longest;
}

function deltaPct(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) return null;
  return (current - previous) / previous;
}

function renderDelta(d: number | null): { icon: React.ReactNode; text: string; cls: string } {
  if (d === null) return { icon: null, text: "—", cls: "text-ink-mute" };
  const arrow = d >= 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />;
  const text = `${d >= 0 ? "↑" : "↓"} ${formatPct(Math.abs(d))}`;
  return { icon: arrow, text, cls: d >= 0 ? "text-ink-soft" : "text-ink-soft" };
}

function ringsClosed(entry: DailyEntry, settings: Settings, readingMins: number | null, chessMins: number | null, suppPct: number | null): number {
  let count = 0;
  for (const key of RING_KEYS) {
    if (metricMetTarget(entry, key, settings, readingMins, chessMins, suppPct)) count++;
  }
  return count;
}

function isPerfectDay(entry: DailyEntry, settings: Settings, readingMins: number | null, chessMins: number | null, suppPct: number | null): boolean {
  return ringsClosed(entry, settings, readingMins, chessMins, suppPct) >= RING_KEYS.length;
}

function weekBounds(ref: Date, startDay: number): { start: Date; end: Date } {
  const d = new Date(ref);
  const day = d.getDay();
  const diff = (day - startDay + 7) % 7;
  d.setDate(d.getDate() - diff);
  const start = new Date(d);
  d.setDate(d.getDate() + 6);
  return { start, end: d };
}

function getWeekIndex(date: Date, start: Date): number {
  return Math.floor(dayDiff(date, start) / 7);
}

function getMonday(d: Date): Date {
  const r = new Date(d);
  const day = r.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  r.setDate(r.getDate() + diff);
  return r;
}

function weeksBetween(a: Date, b: Date): number {
  return Math.ceil(dayDiff(b, a) / 7);
}

function formatDuration(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const days = Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
  return `${days} days`;
}

// ---------- Sparkline SVG ----------
function Sparkline({ data, color, target }: { data: number[]; color: string; target?: number | null }) {
  if (!data.length) return null;
  const w = 120;
  const h = 40;
  const max = Math.max(...data, target ?? 0) || 1;
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1 || 1)) * w},${h - ((v - min) / range) * (h - 4) - 2}`).join(" ");
  return (
    <svg width={w} height={h} className="shrink-0" aria-hidden>
      {target !== null && target !== undefined && (
        <line x1={0} y1={h - ((target - min) / range) * (h - 4) - 2} x2={w} y2={h - ((target - min) / range) * (h - 4) - 2} stroke={color} strokeWidth={1} strokeDasharray="3 2" opacity={0.5} />
      )}
      <polyline fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" points={pts} />
    </svg>
  );
}

// ---------- Sparkline 2: simple bar version ----------
function MiniBar({ data, color }: { data: { value: number; met: boolean }[]; color: string }) {
  if (!data.length) return null;
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex items-end gap-[2px] h-10">
      {data.map((d, i) => (
        <div key={i} className="w-[6px] rounded-t-sm transition-all" style={{ height: `${(d.value / max) * 100}%`, backgroundColor: color, opacity: d.met ? 1 : 0.45 }} />
      ))}
    </div>
  );
}

// ============================================================
// METRIC CARD
// ============================================================
function MetricCard({
  metric,
  dailyValues,
  entries,
  settings,
  supplementPctByDate,
  readingMinsByDate,
  chessMinsByDate,
  range,
  onExpand,
}: {
  metric: MetricMeta;
  dailyValues: (number | null)[];
  entries: DailyEntry[];
  settings: Settings;
  supplementPctByDate: Map<string, number>;
  readingMinsByDate: Map<string, number>;
  chessMinsByDate: Map<string, number>;
  range: Range;
  onExpand: () => void;
}) {
  const validVals = dailyValues.filter((v): v is number => v !== null);
  const len = validVals.length;
  if (!len) {
    return (
      <Card className="cursor-pointer" onClick={onExpand}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm" style={{ color: metric.color }}>
            <span className="size-2 rounded-full" style={{ backgroundColor: metric.color }} />
            {metric.label}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-ink-mute text-xs">No data</p>
        </CardContent>
      </Card>
    );
  }

  const isAvg = ["sleep", "protein", "water", "meditation", "walk", "reading", "chess"].includes(metric.key);
  const isTotal = ["workout", "walk"].includes(metric.key) && false;
  const bigNum = isAvg ? avg(validVals) : metric.key === "workout" ? validVals.length : sum(validVals);
  const target = getTargetVal(metric.key, settings);
  const daysMet = entries.filter((e) => {
    const dateStr = e.entry_date;
    const suppPct = supplementPctByDate.get(dateStr) ?? null;
    const readMins = readingMinsByDate.get(dateStr) ?? null;
    const chessMins = chessMinsByDate.get(dateStr) ?? null;
    return metricMetTarget(e, metric.key, settings, readMins, chessMins, suppPct);
  }).length;

  const sparkData = dailyValues.map((v, i) => ({
    value: v ?? 0,
    met: v !== null && target !== null && v >= target,
  }));

  return (
    <Card className="cursor-pointer" onClick={onExpand}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm" style={{ color: metric.color }}>
          <span className="size-2 rounded-full" style={{ backgroundColor: metric.color }} />
          {metric.label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-end justify-between">
          <div>
            <span className="tabular text-3xl font-semibold">
              {bigNum !== null ? formatNum(bigNum) : "—"}
            </span>
            {metric.unit && <span className="text-ink-mute text-sm ml-1">{metric.unit}</span>}
          </div>
        </div>
        <div className="mt-3">
          <Sparkline data={validVals.slice(-30)} color={metric.color} target={target} />
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-ink-mute text-xs">
            Met target {daysMet} of {entries.length} days
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// 7D BAR CHART
// ============================================================
function Chart7d({
  metricKey,
  dailyValues,
  dates,
  settings,
}: {
  metricKey: string;
  dailyValues: (number | null)[];
  dates: Date[];
  settings: Settings;
}) {
  const target = getTargetVal(metricKey, settings);
  const meta = M.get(metricKey);
  if (!meta) return null;

  const data = dates.map((d, i) => ({
    label: shortDay(d),
    value: dailyValues[i] ?? 0,
    hasVal: dailyValues[i] !== null,
  }));

  const isSleep = metricKey === "sleep";

  return (
    <div className="w-full overflow-x-auto">
      <div className="min-w-[320px]">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data} margin={{ top: 20, right: 8, left: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--hairline)" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 12, fill: "var(--ink-mute)" }} axisLine={{ stroke: "var(--hairline)" }} tickLine={false} />
            <YAxis hide domain={[0, "auto"]} />
            <RechartsTooltip
              contentStyle={{ background: "var(--surface)", border: "1px solid var(--hairline)", borderRadius: 8, fontSize: 13 }}
              formatter={(val: any) => [`${val}${meta.unit}`, meta.label]}
            />
            {isSleep && target && (
              <Bar dataKey="value" shape={(props: any) => {
                const { x, y, width, height, payload } = props;
                const isBelow = payload.hasVal && payload.value < (target ?? 0);
                return (
                  <rect x={x} y={y} width={width} height={height} fill={meta.color} opacity={isBelow ? 0.45 : 0.9} rx={3} />
                );
              }} />
            )}
            {!isSleep && (
              <Bar dataKey="value" shape={(props: any) => {
                const { x, y, width, height, payload } = props;
                const isBelow = payload.hasVal && target !== null && payload.value < target;
                return (
                  <rect x={x} y={y} width={width} height={Math.max(height, 0)} fill={meta.color} opacity={isBelow ? 0.45 : 0.9} rx={3} />
                );
              }}>
                {data.map((d, i) => (
                  <Cell key={i} fill={meta.color} opacity={d.hasVal && target !== null && d.value < target ? 0.45 : 0.9} />
                ))}
              </Bar>
            )}
          </BarChart>
        </ResponsiveContainer>
        {target !== null && (
          <div className="flex items-center gap-2 text-ink-mute text-xs mt-1">
            <span className="w-6 h-px border-t border-dashed border-ink-mute" />
            Target: {target}{isSleep && settings.sleep_target_max ? `–${settings.sleep_target_max}h` : meta.unit && ` ${meta.unit}`}
          </div>
        )}
        {isSleep && (
          <div className="flex items-center gap-2 text-ink-mute text-xs mt-1">
            <span className="w-6 h-3 rounded-sm" style={{ backgroundColor: meta.color, opacity: 0.15 }} />
            Target range: {settings.sleep_target_min}h–{settings.sleep_target_max}h
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// 30D LINE CHART + HEATMAP
// ============================================================
function Chart30d({
  metricKey,
  dailyValues,
  dates,
  settings,
}: {
  metricKey: string;
  dailyValues: (number | null)[];
  dates: Date[];
  settings: Settings;
}) {
  const meta = M.get(metricKey);
  if (!meta) return null;

  const target = getTargetVal(metricKey, settings);
  const rollingAvg = dailyValues.map((_, i) => {
    const window = dailyValues.slice(Math.max(0, i - 6), i + 1);
    return avg(window);
  });

  const lineData = dates.map((d, i) => ({
    label: `${d.getMonth() + 1}/${d.getDate()}`,
    raw: dailyValues[i],
    avg: rollingAvg[i],
  }));

  const cellSize = 14;
  const cols = 6;
  const heatData = dates.map((d, i) => {
    const val = dailyValues[i];
    const pct = target && val !== null ? Math.min(val / target, 1) : 0;
    return { date: d, value: val, pct, idx: i };
  });

  return (
    <div>
      <div className="w-full overflow-x-auto">
        <div className="min-w-[320px]">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={lineData} margin={{ top: 8, right: 8, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--hairline)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--ink-mute)" }} interval={4} axisLine={{ stroke: "var(--hairline)" }} tickLine={false} />
              <YAxis hide domain={[0, "auto"]} />
              <RechartsTooltip
                contentStyle={{ background: "var(--surface)", border: "1px solid var(--hairline)", borderRadius: 8, fontSize: 13 }}
                formatter={(val: any, name: any) => [`${val}${meta.unit}`, name === "avg" ? "7-day avg" : meta.label]}
              />
              <Line type="monotone" dataKey="raw" stroke={meta.color} strokeWidth={1} dot={{ r: 2, fill: meta.color, opacity: 0.3 }} opacity={0.3} connectNulls />
              <Line type="monotone" dataKey="avg" stroke={meta.color} strokeWidth={2.5} dot={false} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mt-4">
        <p className="text-ink-mute text-xs mb-2">Calendar heatmap</p>
        <div className="flex flex-wrap gap-[2px] w-full max-w-[320px]">
          {heatData.map((cell, i) => {
            const opacity = cell.value !== null ? Math.min(cell.value / (target || 1), 1) : 0.08;
            return (
              <Tooltip key={i}>
                <TooltipTrigger
                  className="rounded-sm cursor-help"
                  style={{ width: cellSize, height: cellSize, backgroundColor: meta.color, opacity: Math.max(opacity, 0.08) } as React.CSSProperties}
                />
                <TooltipContent side="top" className="text-xs">
                  {cell.date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}:{" "}
                  {cell.value !== null ? `${cell.value}${meta.unit}` : "—"}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 6MO AREA CHART + MONTHLY BAR ROW
// ============================================================
function Chart6mo({
  metricKey,
  dailyValues,
  dates,
  settings,
}: {
  metricKey: string;
  dailyValues: (number | null)[];
  dates: Date[];
  settings: Settings;
}) {
  const meta = M.get(metricKey);
  if (!meta) return null;

  const weeklyMap = new Map<string, number[]>();
  for (let i = 0; i < dates.length; i++) {
    const mon = dateStr(getMonday(dates[i]));
    if (!weeklyMap.has(mon)) weeklyMap.set(mon, []);
    if (dailyValues[i] !== null) weeklyMap.get(mon)!.push(dailyValues[i]!);
  }
  const weeks = Array.from(weeklyMap.entries())
    .map(([mon, vals]) => ({ label: mon, weekAvg: avg(vals) ?? 0, vals }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const monthlyMap = new Map<string, number[]>();
  for (let i = 0; i < dates.length; i++) {
    const m = `${dates[i].getFullYear()}-${String(dates[i].getMonth() + 1).padStart(2, "0")}`;
    if (!monthlyMap.has(m)) monthlyMap.set(m, []);
    if (dailyValues[i] !== null) monthlyMap.get(m)!.push(dailyValues[i]!);
  }
  const months = Array.from(monthlyMap.entries())
    .map(([m, vals]) => ({ label: shortMonth(new Date(m + "-01")), avg: avg(vals) ?? 0 }))
    .sort((a, b) => a.label.localeCompare(b.label));
  const bestMonthAvg = Math.max(...months.map((m) => m.avg), 0);

  const areaData = weeks.map((w) => ({ label: w.label.slice(5), value: w.weekAvg }));

  return (
    <div>
      <div className="w-full overflow-x-auto">
        <div className="min-w-[320px]">
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={areaData} margin={{ top: 8, right: 8, left: 8, bottom: 4 }}>
              <defs>
                <linearGradient id={`grad-${metricKey}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={meta.color} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={meta.color} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--hairline)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--ink-mute)" }} interval={3} axisLine={{ stroke: "var(--hairline)" }} tickLine={false} />
              <YAxis hide domain={[0, "auto"]} />
              <RechartsTooltip
                contentStyle={{ background: "var(--surface)", border: "1px solid var(--hairline)", borderRadius: 8, fontSize: 13 }}
                formatter={(val: any) => [`${formatNum(val)}${meta.unit}`, "Weekly avg"]}
              />
              <Area type="monotone" dataKey="value" stroke={meta.color} strokeWidth={2} fill={`url(#grad-${metricKey})`} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mt-4 flex items-end gap-2 h-24 px-2">
        {months.map((m, i) => {
          const pct = bestMonthAvg > 0 ? m.avg / bestMonthAvg : 0;
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full rounded-t-sm transition-all"
                style={{
                  height: `${Math.max(pct * 100, 4)}%`,
                  backgroundColor: meta.color,
                  opacity: m.avg >= bestMonthAvg ? 1 : 0.55,
                }}
              />
              <span className="text-ink-mute text-[10px]">{m.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// DETAIL CHART (expanded from metric card)
// ============================================================
function DetailChart({
  metricKey,
  dailyValues,
  dates,
  settings,
  onClose,
}: {
  metricKey: string;
  dailyValues: (number | null)[];
  dates: Date[];
  settings: Settings;
  onClose: () => void;
}) {
  const meta = M.get(metricKey);
  const range = dates.length <= 7 ? "7d" : dates.length <= 30 ? "30d" : "6mo";

  return (
    <div className="fixed inset-0 z-50 bg-canvas/80 backdrop-blur-sm flex items-end sm:items-center justify-center">
      <div className="bg-surface w-full sm:max-w-lg sm:rounded-xl sm:mb-0 rounded-t-xl p-6 max-h-[80vh] overflow-y-auto animate-in fade-in slide-in-from-bottom-4 duration-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2" style={{ color: meta?.color }}>
            <span className="size-2 rounded-full" style={{ backgroundColor: meta?.color }} />
            <span className="font-display text-lg">{meta?.label} detail</span>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            ✕
          </Button>
        </div>
        {range === "7d" && <Chart7d metricKey={metricKey} dailyValues={dailyValues} dates={dates} settings={settings} />}
        {range === "30d" && <Chart30d metricKey={metricKey} dailyValues={dailyValues} dates={dates} settings={settings} />}
        {range === "6mo" && <Chart6mo metricKey={metricKey} dailyValues={dailyValues} dates={dates} settings={settings} />}
      </div>
    </div>
  );
}

// ============================================================
// STREAK BOARD
// ============================================================
function StreakBoard({ streaks }: { streaks: { key: string; current: number; best: number }[] }) {
  const sorted = [...streaks].sort((a, b) => b.current - a.current);
  return (
    <div className="space-y-1">
      {sorted.map((s) => {
        const meta = M.get(s.key);
        return (
          <div key={s.key} className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-surface-sunk/50">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full" style={{ backgroundColor: meta?.color }} />
              <span className="text-sm">{meta?.label}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 text-sm tabular" style={{ color: meta?.color }}>
                <Flame className="size-3.5" />
                {s.current}
              </span>
              <span className="text-ink-mute text-xs tabular">
                Best: {s.best}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// SUPPLEMENT ADHERENCE
// ============================================================
function SupplementBlock({
  suppLogsByDate,
  supplements,
  dates,
}: {
  suppLogsByDate: Map<string, SupplementLog[]>;
  supplements: Supplement[];
  dates: Date[];
}) {
  const activeCount = supplements.filter((s) => s.counts_toward_target).length;
  const targetPerDay = 5;
  let totalDoses = 0;
  let totalPossible = 0;
  let afternoonDoses = 0;
  let afternoonPossible = 0;
  let nightDoses = 0;
  let nightPossible = 0;
  const perSuppData = supplements.map((supp) => {
    const days: boolean[] = [];
    let takenCount = 0;
    for (const d of dates) {
      const ds = dateStr(d);
      const logs = suppLogsByDate.get(ds) ?? [];
      const taken = logs.some((l) => l.supplement_id === supp.id && l.taken);
      days.push(taken);
      if (taken) takenCount++;
    }
    return { supp, days, takenCount, total: dates.length };
  });

  for (const d of dates) {
    const ds = dateStr(d);
    const logs = suppLogsByDate.get(ds) ?? [];
    const taken = logs.filter((l) => l.taken);
    totalDoses += taken.length;
    totalPossible += activeCount;
    const afternoonLogs = taken.filter((l) => {
      const s = supplements.find((s) => s.id === l.supplement_id);
      return s?.slot === "afternoon";
    });
    const nightLogs = taken.filter((l) => {
      const s = supplements.find((s) => s.id === l.supplement_id);
      return s?.slot === "night";
    });
    afternoonDoses += afternoonLogs.length;
    afternoonPossible += supplements.filter((s) => s.slot === "afternoon" && s.counts_toward_target).length;
    nightDoses += nightLogs.length;
    nightPossible += supplements.filter((s) => s.slot === "night" && s.counts_toward_target).length;
  }

  const overallPct = totalPossible > 0 ? totalDoses / totalPossible : 0;
  const afternoonPct = afternoonPossible > 0 ? afternoonDoses / afternoonPossible : 0;
  const nightPct = nightPossible > 0 ? nightDoses / nightPossible : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-surface-sunk/50 rounded-lg p-3 text-center">
          <div className="tabular text-2xl font-semibold">{formatPct(overallPct)}</div>
          <div className="text-ink-mute text-xs mt-1">Overall</div>
        </div>
        <div className="bg-surface-sunk/50 rounded-lg p-3 text-center">
          <div className="tabular text-2xl font-semibold text-m-supp">{formatPct(afternoonPct)}</div>
          <div className="text-ink-mute text-xs mt-1">Afternoon</div>
        </div>
        <div className="bg-surface-sunk/50 rounded-lg p-3 text-center">
          <div className="tabular text-2xl font-semibold text-m-supp">{formatPct(nightPct)}</div>
          <div className="text-ink-mute text-xs mt-1">Night</div>
        </div>
      </div>
      <div className="text-ink-mute text-xs text-center">
        {totalDoses} of {totalPossible} doses ({totalPossible / Math.max(dates.length, 1)}/day)
      </div>

      <div className="space-y-2">
        {perSuppData.map(({ supp, days, takenCount, total }) => {
          const pct = total > 0 ? takenCount / total : 0;
          return (
            <div key={supp.id} className="flex items-center gap-3 py-1">
              <div className="w-24 shrink-0">
                <span className="text-sm">{supp.name}</span>
                <span className="text-ink-mute text-xs ml-1">{formatPct(pct)}</span>
              </div>
              <div className="flex gap-[2px] flex-1">
                {days.slice(-30).map((taken, i) => (
                  <div
                    key={i}
                    className="w-[6px] h-3 rounded-sm"
                    style={{
                      backgroundColor: "var(--m-supp)",
                      opacity: taken ? 0.85 : 0.08,
                    }}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// CONSISTENCY CALENDAR
// ============================================================
function ConsistencyCalendar({ dates, ringsByDate }: { dates: Date[]; ringsByDate: Map<string, number> }) {
  const cellSize = 12;
  const gap = 2;
  if (dates.length <= 30) {
    const cols = 6;
    return (
      <div className="flex flex-wrap gap-[2px]">
        {dates.map((d, i) => {
          const ds = dateStr(d);
          const rings = ringsByDate.get(ds) ?? 0;
          const opacity = rings / 8;
          return (
            <Tooltip key={i}>
              <TooltipTrigger
                className="rounded-sm cursor-help"
                style={{ width: cellSize, height: cellSize, backgroundColor: rings > 6 ? "var(--accent)" : rings > 4 ? "#E5C4A0" : rings > 2 ? "#EAD5BD" : rings > 0 ? "#F0E4D4" : "var(--hairline)" } as React.CSSProperties}
              />
              <TooltipContent side="top" className="text-xs">
                {d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}:{" "}
                {rings}/8 rings
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    );
  }

  const weeks: { date: Date; rings: number }[][] = [];
  let currentWeek: { date: Date; rings: number }[] = [];
  const startDay = 1;
  for (let i = 0; i < dates.length; i++) {
    const d = dates[i];
    const ds = dateStr(d);
    const rings = ringsByDate.get(ds) ?? 0;
    const dayOfWeek = d.getDay();
    if (i === 0) {
      for (let j = 0; j < (dayOfWeek - startDay + 7) % 7; j++) {
        currentWeek.push({ date: d, rings: -1 });
      }
    }
    currentWeek.push({ date: d, rings });
    if (dayOfWeek === 0 || i === dates.length - 1) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }
  if (currentWeek.length) weeks.push(currentWeek);

  const dayLabels = ["Mon", "", "Wed", "", "Fri", "", "Sun"];

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-1">
        <div className="flex flex-col gap-[2px] mr-1">
          {dayLabels.map((l, i) => (
            <div key={i} className="text-ink-mute text-[10px] leading-none flex items-center" style={{ height: cellSize }}>
              {l}
            </div>
          ))}
        </div>
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-[2px]">
            {Array.from({ length: 7 }).map((_, di) => {
              const cell = week[di];
              if (!cell || cell.rings < 0) return <div key={di} style={{ width: cellSize, height: cellSize }} />;
              const rings = cell.rings;
              return (
                <Tooltip key={di}>
                  <TooltipTrigger
                    className="rounded-sm cursor-help"
                    style={{ width: cellSize, height: cellSize, backgroundColor: rings > 6 ? "var(--accent)" : rings > 4 ? "#E5C4A0" : rings > 2 ? "#EAD5BD" : rings > 0 ? "#F0E4D4" : "var(--hairline)" } as React.CSSProperties}
                  />
                  <TooltipContent side="top" className="text-xs">
                    {cell.date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}:{" "}
                    {rings}/8 rings
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// GENTLE INSIGHTS
// ============================================================
function GentleInsights({
  entries,
  settings,
  supplementPctByDate,
}: {
  entries: DailyEntry[];
  settings: Settings;
  supplementPctByDate: Map<string, number>;
}) {
  if (entries.length < 14) {
    return (
      <div className="bg-surface-sunk/50 rounded-xl p-6 text-center">
        <p className="font-display text-ink-soft text-sm">
          Your analytics are waiting for two weeks of days — log today to start the story.
        </p>
      </div>
    );
  }

  const insights: string[] = [];

  const sleepData = entries
    .filter((e) => e.sleep_hours !== null)
    .map((e) => ({ date: e.entry_date, sleep: e.sleep_hours!, walked: e.walk_done }));
  const walkedDays = sleepData.filter((d) => d.walked);
  const notWalkedDays = sleepData.filter((d) => !d.walked);
  if (walkedDays.length >= 7 && notWalkedDays.length >= 7) {
    const avgSleepWalked = avg(walkedDays.map((d) => d.sleep));
    const avgSleepNotWalked = avg(notWalkedDays.map((d) => d.sleep));
    if (avgSleepWalked !== null && avgSleepNotWalked !== null) {
      const diff = avgSleepWalked - avgSleepNotWalked;
      if (Math.abs(diff) >= 0.2) {
        insights.push(`You sleep ${formatNum(Math.abs(diff))} h ${diff > 0 ? "more" : "less"} on days you walk.`);
      }
    }
  }

  const suppAfternoonRate = entries.map((e) => {
    const pct = supplementPctByDate.get(e.entry_date);
    return pct !== undefined ? pct : null;
  }).filter((p): p is number => p !== null);
  const suppAvg = avg(suppAfternoonRate);
  if (suppAvg !== null && suppAvg < 0.85) {
    const daysAbove = suppAfternoonRate.filter((p) => p >= 1).length;
    insights.push(`Night supplements: ~${formatPct(Math.min(suppAvg + 0.15, 1))}. Afternoon: ~${formatPct(suppAvg)}.`);
  }

  const workoutEntries = entries.filter((e) => e.workout_done);
  if (workoutEntries.length >= 7) {
    const workoutStreak = computeLongestStreak(workoutEntries.map((e) => e.entry_date));
    if (workoutStreak >= 3) {
      const firstDate = workoutEntries[0]?.entry_date;
      insights.push(`Your longest workout streak was ${workoutStreak} days${firstDate ? `, starting ${new Date(firstDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}.`);
    }
  }

  if (!insights.length) {
    insights.push("You sleep better on days you log. Consistent logging builds clearer patterns.");
  }

  return (
    <div className="space-y-2">
      {insights.slice(0, 3).map((text, i) => (
        <div key={i} className="bg-surface-sunk/50 rounded-lg p-3 flex items-start gap-2">
          <span className="text-accent mt-0.5">·</span>
          <p className="text-sm text-ink-soft">{text}</p>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// MAIN PAGE
// ============================================================
export default function AnalyticsPage() {
  const [range, setRange] = useState<Range>("30d");
  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [supplements, setSupplements] = useState<Supplement[]>([]);
  const [suppLogsByDate, setSuppLogsByDate] = useState<Map<string, SupplementLog[]>>(new Map());
  const [readingSessions, setReadingSessions] = useState<ReadingSession[]>([]);
  const [chessSessions, setChessSessions] = useState<ChessSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailMetric, setDetailMetric] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(RANGE_KEY);
    if (saved && (saved === "7d" || saved === "30d" || saved === "6mo")) setRange(saved);
  }, []);

  useEffect(() => {
    localStorage.setItem(RANGE_KEY, range);
  }, [range]);

  const { start, end, prevStart, prevEnd } = useMemo(() => getRangeDates(range), [range]);
  const allDates = useMemo(() => generateDateRange(start, end), [start, end]);
  const prevDates = useMemo(() => generateDateRange(prevStart, prevEnd), [prevStart, prevEnd]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const since = dateStr(subDays(start, dayDiff(end, start) + 1));
      const [rawEntries, rawSettings, rawSupplements, rawReading, rawChess] = await Promise.all([
        getEntries(since),
        getSettings(),
        getSupplements(),
        getReadingSessions(),
        getChessSessions(),
      ]);
      if (cancelled) return;

      const sorted = rawEntries.sort((a, b) => a.entry_date.localeCompare(b.entry_date));
      setEntries(sorted);
      setSettings(rawSettings);
      setSupplements(rawSupplements);

      const suppMap = new Map<string, SupplementLog[]>();
      const allDatesStr = [...allDates, ...prevDates].map((d) => dateStr(d));
      const uniqueDates = [...new Set(allDatesStr)];
      const suppLogs = await Promise.all(uniqueDates.map((d) => getSupplementLogs(d)));
      for (let i = 0; i < uniqueDates.length; i++) {
        suppMap.set(uniqueDates[i], suppLogs[i]);
      }
      setSuppLogsByDate(suppMap);
      setReadingSessions(rawReading);
      setChessSessions(rawChess);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [start, end, prevStart, prevEnd, allDates]);

  const entriesByDate = useMemo(() => {
    const map = new Map<string, DailyEntry>();
    for (const e of entries) map.set(e.entry_date, e);
    return map;
  }, [entries]);

  const readingMinsByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of readingSessions) {
      const cur = map.get(s.session_date) ?? 0;
      map.set(s.session_date, cur + (s.minutes ?? 0));
    }
    return map;
  }, [readingSessions]);

  const chessMinsByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of chessSessions) {
      const cur = map.get(s.session_date) ?? 0;
      map.set(s.session_date, cur + (s.minutes ?? 0));
    }
    return map;
  }, [chessSessions]);

  const supplementPctByDate = useMemo(() => {
    const map = new Map<string, number>();
    const activeCount = supplements.filter((s) => s.counts_toward_target).length;
    for (const [d, logs] of suppLogsByDate) {
      const taken = logs.filter((l) => l.taken).length;
      map.set(d, activeCount > 0 ? taken / activeCount : 0);
    }
    return map;
  }, [suppLogsByDate, supplements]);

  const ringsByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of entries) {
      const suppPct = supplementPctByDate.get(e.entry_date) ?? null;
      const readMins = readingMinsByDate.get(e.entry_date) ?? null;
      const chessMins = chessMinsByDate.get(e.entry_date) ?? null;
      if (settings) {
        map.set(e.entry_date, ringsClosed(e, settings, readMins, chessMins, suppPct));
      }
    }
    return map;
  }, [entries, supplementPctByDate, readingMinsByDate, chessMinsByDate, settings]);

  const headlineStats = useMemo(() => {
    if (!settings) return null;
    const rangeEntries = entries.filter((e) => e.entry_date >= dateStr(start) && e.entry_date <= dateStr(end));
    const prevEntries = entries.filter((e) => e.entry_date >= dateStr(prevStart) && e.entry_date <= dateStr(prevEnd));

    const perfectDays = rangeEntries.filter((e) => {
      const suppPct = supplementPctByDate.get(e.entry_date) ?? null;
      const readMins = readingMinsByDate.get(e.entry_date) ?? null;
      const chessMins = chessMinsByDate.get(e.entry_date) ?? null;
      return isPerfectDay(e, settings, readMins, chessMins, suppPct);
    }).length;
    const prevPerfectDays = prevEntries.filter((e) => {
      const suppPct = supplementPctByDate.get(e.entry_date) ?? null;
      const readMins = readingMinsByDate.get(e.entry_date) ?? null;
      const chessMins = chessMinsByDate.get(e.entry_date) ?? null;
      return isPerfectDay(e, settings, readMins, chessMins, suppPct);
    }).length;

    const entryDates = rangeEntries.map((e) => e.entry_date);
    const loggingStreak = computeStreak(entryDates);
    const longestStreak = computeLongestStreak(entryDates);

    const totalRings = rangeEntries.reduce((sum, e) => {
      const suppPct = supplementPctByDate.get(e.entry_date) ?? null;
      const readMins = readingMinsByDate.get(e.entry_date) ?? null;
      const chessMins = chessMinsByDate.get(e.entry_date) ?? null;
      return sum + ringsClosed(e, settings, readMins, chessMins, suppPct);
    }, 0);
    const overallPct = rangeEntries.length > 0 ? totalRings / (rangeEntries.length * RING_KEYS.length) : 0;

    const prevTotalRings = prevEntries.reduce((sum, e) => {
      const suppPct = supplementPctByDate.get(e.entry_date) ?? null;
      const readMins = readingMinsByDate.get(e.entry_date) ?? null;
      const chessMins = chessMinsByDate.get(e.entry_date) ?? null;
      return sum + ringsClosed(e, settings, readMins, chessMins, suppPct);
    }, 0);
    const prevOverallPct = prevEntries.length > 0 ? prevTotalRings / (prevEntries.length * RING_KEYS.length) : 0;

    return {
      perfectDays,
      prevPerfectDays,
      loggingStreak,
      longestStreak,
      overallPct,
      prevOverallPct,
    };
  }, [entries, start, end, prevStart, prevEnd, settings, supplementPctByDate, readingMinsByDate, chessMinsByDate]);

  const metricValues = useMemo(() => {
    const map = new Map<string, { current: (number | null)[]; previous: (number | null)[] }>();
    for (const meta of METRICS_META) {
      const cur: (number | null)[] = [];
      const prev: (number | null)[] = [];
      for (const d of allDates) {
        const ds = dateStr(d);
        const entry = entriesByDate.get(ds);
        if (meta.key === "reading") {
          cur.push(readingMinsByDate.get(ds) ?? null);
        } else if (meta.key === "chess") {
          cur.push(chessMinsByDate.get(ds) ?? null);
        } else if (meta.key === "supplements") {
          cur.push(supplementPctByDate.get(ds) ?? null);
        } else {
          cur.push(entry ? getMetricVal(entry, meta.key) : null);
        }
      }
      for (const d of prevDates) {
        const ds = dateStr(d);
        const entry = entriesByDate.get(ds);
        if (meta.key === "reading") {
          prev.push(readingMinsByDate.get(ds) ?? null);
        } else if (meta.key === "chess") {
          prev.push(chessMinsByDate.get(ds) ?? null);
        } else if (meta.key === "supplements") {
          prev.push(supplementPctByDate.get(ds) ?? null);
        } else {
          prev.push(entry ? getMetricVal(entry, meta.key) : null);
        }
      }
      map.set(meta.key, { current: cur, previous: prev });
    }
    return map;
  }, [allDates, prevDates, entriesByDate, readingMinsByDate, chessMinsByDate, supplementPctByDate]);

  const streaks = useMemo(() => {
    return METRICS_META.map((meta) => {
      const currentDates = entries
        .filter((e) => {
          const ds = e.entry_date;
          const suppPct = supplementPctByDate.get(ds) ?? null;
          const readMins = readingMinsByDate.get(ds) ?? null;
          const chessMins = chessMinsByDate.get(ds) ?? null;
          return settings && metricMetTarget(e, meta.key, settings, readMins, chessMins, suppPct);
        })
        .map((e) => e.entry_date);
      return {
        key: meta.key,
        current: computeStreak(currentDates),
        best: computeLongestStreak(currentDates),
      };
    });
  }, [entries, settings, supplementPctByDate, readingMinsByDate, chessMinsByDate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-ink-mute text-sm animate-pulse">Loading analytics…</div>
      </div>
    );
  }

  const hasData = entries.length > 0;
  if (!hasData) {
    return (
      <main className="flex flex-col flex-1 max-w-[1120px] mx-auto w-full px-5 sm:px-12 py-8 gap-8">
        <RangeToggle range={range} onChange={setRange} />
        <div className="bg-surface-sunk/50 rounded-xl p-8 text-center max-w-md mx-auto mt-12">
          <p className="font-display text-ink-soft text-base leading-relaxed">
            Your analytics are waiting for two weeks of days — log today to start the story.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-col flex-1 max-w-[1120px] mx-auto w-full px-5 sm:px-12 py-8 gap-8">
      <RangeToggle range={range} onChange={setRange} />

      <section>
        <HeadlineRow stats={headlineStats} />
      </section>

      <section>
        <h2 className="font-display text-lg mb-4">Metrics</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {METRICS_META.map((meta) => {
            const vals = metricValues.get(meta.key);
            const curVals = vals?.current ?? [];
            const prevVals = vals?.previous ?? [];
            const curAvg = avg(curVals.filter((v) => v !== null));
            const prevAvg = avg(prevVals.filter((v) => v !== null));
            return (
              <MetricCard
                key={meta.key}
                metric={meta}
                dailyValues={curVals}
                entries={allDates.map((d) => entriesByDate.get(dateStr(d))).filter((e): e is DailyEntry => e !== undefined)}
                settings={settings!}
                supplementPctByDate={supplementPctByDate}
                readingMinsByDate={readingMinsByDate}
                chessMinsByDate={chessMinsByDate}
                range={range}
                onExpand={() => setDetailMetric(meta.key)}
              />
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="font-display text-lg mb-4">Charts</h2>
        {range === "7d" && (
          <div className="grid grid-cols-1 gap-6">
            {METRICS_META.map((meta) => {
              const vals = metricValues.get(meta.key)?.current ?? [];
              return (
                <Card key={meta.key}>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm" style={{ color: meta.color }}>
                      <span className="size-2 rounded-full" style={{ backgroundColor: meta.color }} />
                      {meta.label}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Chart7d metricKey={meta.key} dailyValues={vals} dates={allDates} settings={settings!} />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
        {range === "30d" && (
          <div className="grid grid-cols-1 gap-6">
            {METRICS_META.map((meta) => {
              const vals = metricValues.get(meta.key)?.current ?? [];
              return (
                <Card key={meta.key}>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm" style={{ color: meta.color }}>
                      <span className="size-2 rounded-full" style={{ backgroundColor: meta.color }} />
                      {meta.label}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Chart30d metricKey={meta.key} dailyValues={vals} dates={allDates} settings={settings!} />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
        {range === "6mo" && (
          <div className="grid grid-cols-1 gap-6">
            {METRICS_META.map((meta) => {
              const vals = metricValues.get(meta.key)?.current ?? [];
              return (
                <Card key={meta.key}>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm" style={{ color: meta.color }}>
                      <span className="size-2 rounded-full" style={{ backgroundColor: meta.color }} />
                      {meta.label}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Chart6mo metricKey={meta.key} dailyValues={vals} dates={allDates} settings={settings!} />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-display text-lg mb-4">Streaks</h2>
        <StreakBoard streaks={streaks} />
      </section>

      <section>
        <h2 className="font-display text-lg mb-4">Supplement adherence</h2>
        <Card>
          <CardContent className="pt-4">
            <SupplementBlock suppLogsByDate={suppLogsByDate} supplements={supplements} dates={allDates} />
          </CardContent>
        </Card>
      </section>

      <section>
        <h2 className="font-display text-lg mb-4">Consistency</h2>
        <Card>
          <CardContent className="pt-4">
            <ConsistencyCalendar dates={allDates} ringsByDate={ringsByDate} />
          </CardContent>
        </Card>
      </section>

      <section>
        <h2 className="font-display text-lg mb-4">Insights</h2>
        <GentleInsights entries={entries} settings={settings!} supplementPctByDate={supplementPctByDate} />
      </section>

      {detailMetric && (
        <DetailChart
          metricKey={detailMetric}
          dailyValues={metricValues.get(detailMetric)?.current ?? []}
          dates={allDates}
          settings={settings!}
          onClose={() => setDetailMetric(null)}
        />
      )}
    </main>
  );
}

// ============================================================
// RANGE TOGGLE
// ============================================================
function RangeToggle({ range, onChange }: { range: Range; onChange: (r: Range) => void }) {
  return (
    <div className="sticky top-0 z-40 bg-canvas/90 backdrop-blur-sm py-3 -mx-5 sm:-mx-12 px-5 sm:px-12">
      <div className="inline-flex items-center gap-1 bg-surface-sunk rounded-lg p-1">
        {RANGES.map((r) => (
          <button
            key={r}
            onClick={() => onChange(r)}
            className={cn(
              "px-3 py-1.5 text-sm rounded-md transition-all tabular",
              range === r
                ? "bg-surface text-ink shadow-sm font-medium"
                : "text-ink-mute hover:text-ink"
            )}
          >
            {r === "7d" ? "7 days" : r === "30d" ? "30 days" : "6 months"}
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// HEADLINE ROW
// ============================================================
function HeadlineRow({ stats }: { stats: {
  perfectDays: number;
  prevPerfectDays: number;
  loggingStreak: number;
  longestStreak: number;
  overallPct: number;
  prevOverallPct: number;
} | null }) {
  if (!stats) return null;

  const perfectDelta = deltaPct(stats.perfectDays, stats.prevPerfectDays);
  const streakDelta = deltaPct(stats.loggingStreak, stats.longestStreak);
  const longestDelta = deltaPct(stats.longestStreak, stats.loggingStreak);
  const overallDelta = deltaPct(stats.overallPct, stats.prevOverallPct);

  const tiles = [
    { label: "Perfect days", value: `${stats.perfectDays}`, delta: perfectDelta },
    { label: "Logging streak", value: `${stats.loggingStreak}`, delta: streakDelta },
    { label: "Longest streak", value: `${stats.longestStreak}`, delta: longestDelta },
    { label: "Overall completion", value: formatPct(stats.overallPct), delta: overallDelta },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {tiles.map((tile) => {
        const d = renderDelta(tile.delta);
        return (
          <div key={tile.label} className="bg-surface rounded-xl p-4 ring-1 ring-hairline">
            <div className="text-ink-mute text-xs mb-1">{tile.label}</div>
            <div className="tabular text-2xl font-semibold">{tile.value}</div>
            <div className={cn("flex items-center gap-1 text-xs mt-1", d.cls)}>
              {d.icon}
              <span>{d.text}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
