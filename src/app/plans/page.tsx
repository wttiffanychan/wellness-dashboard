"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { Check, Circle } from "lucide-react";
import { getEntry, getPlanItemLogs, getPlanItems, getPlans, setPlanItemDone, upsertEntry } from "@/lib/data";
import type { DailyEntry, Plan, PlanItem, PlanItemLog } from "@/lib/types";

// SPEC §5.4 — Daily Ritual timeline + Weekly Rhythm grid.
// Items with linked_metric sync with Today's rings via upsertEntry.

const BANDS: { key: "morning" | "midday" | "evening"; label: string }[] = [
  { key: "morning", label: "Morning" },
  { key: "midday", label: "Midday" },
  { key: "evening", label: "Evening" },
];

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function emptyEntry(date: string): DailyEntry {
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

function dateOfWeek(dateStr: string, dow: number): string {
  // date of the current week's day (1=Mon..7=Sun)
  const d = new Date(dateStr + "T12:00:00");
  const day = d.getDay(); // 0=Sun
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const target = new Date(d);
  target.setDate(d.getDate() + mondayOffset + (dow - 1));
  return target.toISOString().slice(0, 10);
}

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [items, setItems] = useState<PlanItem[]>([]);
  const [logs, setLogs] = useState<Record<string, boolean>>({});
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<"daily" | "weekly">("daily");

  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    (async () => {
      const p = await getPlans();
      setPlans(p);
      const daily = p.find((x) => x.cadence === "daily");
      const weekly = p.find((x) => x.cadence === "weekly");
      const [di, wi, weekLogs] = await Promise.all([
        daily ? getPlanItems(daily.id) : Promise.resolve([]),
        weekly ? getPlanItems(weekly.id) : Promise.resolve([]),
        getPlanItemLogs(new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)),
      ]);
      setItems([...di, ...wi]);
      const map: Record<string, boolean> = {};
      for (const l of weekLogs) {
        map[`${l.plan_item_id}@${l.log_date}`] = l.done;
      }
      setLogs(map);
      setReady(true);
    })();
  }, []);

  const daily = plans.find((p) => p.cadence === "daily");
  const weekly = plans.find((p) => p.cadence === "weekly");

  const dailyItems = useMemo(
    () => items.filter((i) => i.plan_id === daily?.id).sort((a, b) => a.sort_order - b.sort_order),
    [items, daily],
  );
  const weeklyItems = useMemo(
    () => items.filter((i) => i.plan_id === weekly?.id).sort((a, b) => a.sort_order - b.sort_order),
    [items, weekly],
  );

  const dailyDoneKey = (item: PlanItem) => `${item.id}@${today}`;

  async function toggleDaily(item: PlanItem) {
    const key = dailyDoneKey(item);
    const next = !logs[key];
    setLogs((prev) => ({ ...prev, [key]: next }));
    await setPlanItemDone(today, item.id, next);
    if (next && item.linked_metric) {
      const existing = (await getEntry(today)) ?? emptyEntry(today);
      const entry: DailyEntry = { ...existing };
      if (item.linked_metric === "walk_done") entry.walk_done = true;
      else if (item.linked_metric === "workout_done") entry.workout_done = true;
      else if (item.linked_metric === "meditation_minutes") entry.meditation_done = true;
      else if (item.linked_metric === "protein_g") entry.protein_g = Math.max(item.target_value ?? 1, 1);
      else if (item.linked_metric === "water_oz") entry.water_oz = Math.max(item.target_value ?? 1, 1);
      await upsertEntry(entry);
    }
  }

  function bandCount(band: string) {
    const inBand = dailyItems.filter((i) => i.time_of_day === band);
    const done = inBand.filter((i) => logs[dailyDoneKey(i)]).length;
    return { done, total: inBand.length };
  }

  if (!ready) return null;

  return (
    <div className="mx-auto w-full max-w-[1120px] px-5 pb-32 pt-8 md:px-12">
      <header className="mb-8">
        <h1 className="font-display text-[32px] leading-[1.2]">Plans</h1>
        <p className="mt-1 text-sm text-ink-soft">The loop that closes every day — and the week that holds it.</p>
        <div className="mt-4 inline-flex rounded-full bg-surface-sunk p-1">
          {(["daily", "weekly"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-full px-5 py-2 text-sm capitalize transition-colors ${
                tab === t ? "bg-surface text-ink shadow-sm" : "text-ink-soft"
              }`}
            >
              {t === "daily" ? "Daily Ritual" : "Weekly Rhythm"}
            </button>
          ))}
        </div>
      </header>

      {tab === "daily" && (
        <div className="space-y-8">
          {BANDS.map((band) => {
            const { done, total } = bandCount(band.key);
            return (
              <section key={band.key}>
                <div className="mb-4 flex items-baseline justify-between">
                  <h2 className="font-display text-[24px] leading-[1.3]">{band.label}</h2>
                  <span className="tabular text-sm text-ink-soft">{done}/{total}</span>
                </div>
                <div className="relative space-y-3 pl-8">
                  <div className="absolute bottom-3 left-[7px] top-3 w-px bg-hairline" />
                  {dailyItems
                    .filter((i) => i.time_of_day === band.key)
                    .map((item) => (
                      <button
                        key={item.id}
                        onClick={() => toggleDaily(item)}
                        className="relative flex w-full items-center gap-3 rounded-[20px] border border-hairline bg-surface p-4 text-left transition-transform active:scale-[0.97]"
                      >
                        <span
                          className={`absolute -left-8 top-1/2 flex h-4 w-4 -translate-y-1/2 items-center justify-center rounded-full border ${
                            logs[dailyDoneKey(item)] ? "border-success bg-success text-white" : "border-hairline bg-surface"
                          }`}
                        >
                          {logs[dailyDoneKey(item)] && <Check className="h-3 w-3" strokeWidth={3} />}
                        </span>
                        <span className={`text-sm ${logs[dailyDoneKey(item)] ? "text-ink-mute line-through" : "text-ink"}`}>
                          {item.label}
                        </span>
                        {item.target_value != null && (
                          <span className="tabular ml-auto text-xs text-ink-mute">
                            {item.target_value}
                            {item.unit}
                          </span>
                        )}
                      </button>
                    ))}
                  {dailyItems.filter((i) => i.time_of_day === band.key).length === 0 && (
                    <p className="text-sm text-ink-mute">Nothing scheduled here.</p>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {tab === "weekly" && (
        <div className="overflow-x-auto">
          <div className="min-w-[640px]">
            <div className="grid grid-cols-[1fr_repeat(7,minmax(56px,1fr))] gap-2">
              <div />
              {DAYS.map((d) => (
                <div key={d} className="text-center text-xs font-medium text-ink-soft">{d}</div>
              ))}
              {weeklyItems.map((item) => {
                const keys = DAYS.map((_, idx) => {
                  const dow = idx + 1;
                  const active = !item.days_of_week || item.days_of_week.includes(dow);
                  return { dow, active, key: `${item.id}@${dateOfWeek(today, dow)}` };
                });
                const doneCount = keys.filter((k) => k.active && logs[k.key]).length;
                const target = item.days_of_week?.length ?? 7;
                return (
                  <Fragment key={item.id}>
                    <div className="flex items-center gap-2 py-1">
                      <span className="text-sm">{item.label}</span>
                      <span className="tabular ml-auto text-xs text-ink-mute">{doneCount} of {target}</span>
                    </div>
                    {keys.map(({ active, key }) =>
                      active ? (
                        <button
                          key={key}
                          onClick={async () => {
                            const next = !logs[key];
                            setLogs((prev) => ({ ...prev, [key]: next }));
                            await setPlanItemDone(key.slice(key.indexOf("@") + 1), item.id, next);
                          }}
                          className={`flex h-9 items-center justify-center rounded-lg border transition-colors ${
                            logs[key] ? "border-success bg-success/15 text-success" : "border-hairline bg-surface text-ink-mute"
                          }`}
                        >
                          {logs[key] ? <Check className="h-4 w-4" /> : <Circle className="h-3 w-3 opacity-40" />}
                        </button>
                      ) : (
                        <div key={key} className="h-9" />
                      ),
                    )}
                  </Fragment>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
