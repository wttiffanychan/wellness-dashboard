"use client";

import { useEffect, useState } from "react";
import { Download, Moon, Sun, Monitor } from "lucide-react";
import { getSettings, getSupplements, getEntries, getChessSessions, getReadingSessions, updateSettings } from "@/lib/data";
import type { Settings, Supplement } from "@/lib/types";

// SPEC §5.7 — Settings: identity, targets, supplement registry,
// data export (JSON + CSV per table), theme, about.

const TARGET_FIELDS: { key: keyof Settings; label: string; unit: string; step: number }[] = [
  { key: "sleep_target_hours", label: "Sleep target", unit: "h", step: 0.5 },
  { key: "sleep_target_min", label: "Sleep band — low", unit: "h", step: 0.5 },
  { key: "sleep_target_max", label: "Sleep band — high", unit: "h", step: 0.5 },
  { key: "protein_target_g", label: "Protein", unit: "g", step: 5 },
  { key: "water_target_oz", label: "Water", unit: "oz", step: 8 },
  { key: "meditation_target_min", label: "Meditation", unit: "min", step: 5 },
  { key: "walk_target_min", label: "Walking", unit: "min", step: 5 },
  { key: "reading_target_min", label: "Reading", unit: "min", step: 5 },
  { key: "chess_target_min", label: "Chess", unit: "min", step: 5 },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [supplements, setSupplements] = useState<Supplement[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      const [s, sups] = await Promise.all([getSettings(), getSupplements()]);
      setSettings(s);
      setSupplements(sups);
    })();
  }, []);

  if (!settings) return null;

  async function patch(p: Partial<Settings>) {
    const next = await updateSettings(p);
    setSettings(next);
    flash();
  }

  function flash() {
    setSaved(true);
    setTimeout(() => setSaved(false), 1200);
  }

  async function exportData() {
    const [entries, chess, reading] = await Promise.all([
      getEntries("0000-01-01"),
      getChessSessions(),
      getReadingSessions(),
    ]);
    const payload = {
      exported_at: new Date().toISOString(),
      settings,
      supplements,
      daily_entries: entries,
      chess_sessions: chess,
      reading_sessions: reading,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `wellness-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);

    // CSV per table
    for (const [name, rows] of Object.entries({
      daily_entries: entries,
      chess_sessions: chess,
      reading_sessions: reading,
    })) {
      if (rows.length === 0) continue;
      const headers = Object.keys(rows[0]);
      const csv = [headers.join(","), ...rows.map((r: any) => headers.map((h) => JSON.stringify(r[h] ?? "")).join(","))].join("\n");
      const cblob = new Blob([csv], { type: "text/csv" });
      const curl = URL.createObjectURL(cblob);
      const ca = document.createElement("a");
      ca.href = curl;
      ca.download = `wellness-${name}-${new Date().toISOString().slice(0, 10)}.csv`;
      ca.click();
      URL.revokeObjectURL(curl);
    }
  }

  const themeOptions = [
    { value: "system", label: "System", icon: Monitor },
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
  ] as const;

  return (
    <div className="mx-auto w-full max-w-[1120px] px-5 pb-32 pt-8 md:px-12">
      <header className="mb-8">
        <h1 className="font-display text-[32px] leading-[1.2]">Settings</h1>
        <p className="mt-1 text-sm text-ink-soft">Who you are, what you&apos;re aiming for, and your data.</p>
        {saved && <span className="mt-2 inline-block text-sm text-success">Saved</span>}
      </header>

      <div className="grid gap-8 md:grid-cols-2">
        {/* Identity */}
        <section className="rounded-[20px] border border-hairline bg-surface p-6">
          <h2 className="font-display text-[19px] leading-[1.35]">Identity</h2>
          <label className="mt-4 block text-sm text-ink-soft">Display name</label>
          <input
            value={settings.display_name}
            onChange={(e) => patch({ display_name: e.target.value })}
            className="mt-1 w-full rounded-[12px] border border-hairline bg-canvas px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <label className="mt-4 block text-sm text-ink-soft">Theme</label>
          <div className="mt-1 flex gap-2">
            {themeOptions.map((t) => (
              <button
                key={t.value}
                onClick={() => patch({ theme: t.value })}
                className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors ${
                  settings.theme === t.value ? "border-accent bg-accent-soft text-ink" : "border-hairline text-ink-soft"
                }`}
              >
                <t.icon className="h-4 w-4" />
                {t.label}
              </button>
            ))}
          </div>
          <label className="mt-4 block text-sm text-ink-soft">Week starts on</label>
          <select
            value={settings.week_starts_on}
            onChange={(e) => patch({ week_starts_on: Number(e.target.value) })}
            className="mt-1 w-full rounded-[12px] border border-hairline bg-canvas px-3 py-2 text-sm outline-none focus:border-accent"
          >
            <option value={1}>Monday</option>
            <option value={0}>Sunday</option>
          </select>
        </section>

        {/* Targets */}
        <section className="rounded-[20px] border border-hairline bg-surface p-6">
          <h2 className="font-display text-[19px] leading-[1.35]">Targets</h2>
          <p className="mt-1 text-xs text-ink-mute">Sleep, workout, and supplements are set. The rest are starting points — tune them.</p>
          <div className="mt-4 space-y-3">
            {TARGET_FIELDS.map((f) => (
              <div key={f.key} className="flex items-center justify-between gap-3">
                <span className="text-sm">{f.label}</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => patch({ [f.key]: Math.max((settings[f.key] as number) - f.step, 0) } as any)}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-hairline text-ink-soft hover:border-accent"
                  >
                    −
                  </button>
                  <span className="tabular w-16 text-right text-sm">{settings[f.key]}{f.unit}</span>
                  <button
                    onClick={() => patch({ [f.key]: (settings[f.key] as number) + f.step } as any)}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-hairline text-ink-soft hover:border-accent"
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm">Workout days / week</span>
              <span className="tabular text-sm">{settings.workout_target_days_per_week}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm">Supplement doses / day</span>
              <span className="tabular text-sm">{settings.supplement_target_doses} (locked)</span>
            </div>
          </div>
        </section>

        {/* Supplement registry */}
        <section className="rounded-[20px] border border-hairline bg-surface p-6">
          <h2 className="font-display text-[19px] leading-[1.35]">Supplement registry</h2>
          <p className="mt-1 text-xs text-ink-mute">Mirrors Supplements_Registry.md. Deactivating keeps history.</p>
          <ul className="mt-4 divide-y divide-hairline">
            {supplements.map((s) => (
              <li key={s.id} className="flex items-center justify-between py-2 text-sm">
                <span>
                  {s.name} <span className="text-ink-mute">· {s.dose_label ?? ""}{s.brand ? ` · ${s.brand}` : ""}</span>
                </span>
                <span className={`rounded-full px-2 py-0.5 text-xs ${
                  s.slot === "afternoon" ? "bg-accent-soft text-accent" : s.slot === "night" ? "bg-m-mind/15 text-m-mind" : "bg-surface-sunk text-ink-mute"
                }`}>
                  {s.slot}{s.scheduled_time ? ` ${s.scheduled_time}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* Data */}
        <section className="rounded-[20px] border border-hairline bg-surface p-6">
          <h2 className="font-display text-[19px] leading-[1.35]">Data</h2>
          <p className="mt-1 text-xs text-ink-mute">Six months of personal data deserves an exit door. Export everything, any time.</p>
          <button
            onClick={exportData}
            className="mt-4 flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-white transition-transform active:scale-[0.97]"
          >
            <Download className="h-4 w-4" />
            Export JSON + CSV
          </button>
        </section>

        {/* About */}
        <section className="rounded-[20px] border border-hairline bg-surface p-6 md:col-span-2">
          <h2 className="font-display text-[19px] leading-[1.35]">About</h2>
          <p className="mt-2 text-sm text-ink-soft">
            Wellness Dashboard v1.0 — a calm place to close the loop on ten daily commitments. Companion to the markdown journal at
            ~/Claude/Projects/Wellness Journal/. Data lives in your browser (and soon, your own Supabase).
          </p>
        </section>
      </div>
    </div>
  );
}
