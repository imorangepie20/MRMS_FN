"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Play } from "lucide-react";

import {
  fetchEmpRuns,
  fetchEmpSettings,
  fetchEmpStats,
  triggerEmpImport,
} from "@/lib/api/admin-emp";
import { fetchEmpSections } from "@/lib/api/emp";
import type { EmpSection, EmpSettings, EmpStats, IngestionRun } from "@/lib/types";

import { RunRow } from "./emp/RunRow";
import { SectionsTree } from "./emp/SectionsTree";
import { SettingsCard } from "./emp/SettingsCard";
import { StatCell } from "./emp/StatCell";


export function EmpDashboard() {
  const [stats, setStats] = useState<EmpStats | null>(null);
  const [runs, setRuns] = useState<IngestionRun[]>([]);
  const [settings, setSettings] = useState<EmpSettings["settings"] | null>(null);
  const [sections, setSections] = useState<EmpSection[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, r, st, sec] = await Promise.all([
        fetchEmpStats(),
        fetchEmpRuns(50),
        fetchEmpSettings(),
        fetchEmpSections().catch(() => [] as EmpSection[]),
      ]);
      setStats(s);
      setRuns(r);
      setSettings(st.settings);
      setSections(sec);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const onTrigger = async () => {
    if (!confirm("Trigger EMP import now?")) return;
    try {
      await triggerEmpImport("all");
      alert("Triggered. Refresh in 1~2 min to see new run.");
    } catch (e) {
      alert(`Failed: ${(e as Error).message}`);
    }
  };

  return (
    <div className="px-5 pt-6 pb-48 md:px-10 md:pt-10">
      <div className="flex justify-between items-baseline border-b border-(--mrms-rule) pb-2 mb-6 font-mono text-[10px] tracking-editorial uppercase text-(--mrms-ink-mute)">
        <span>Section S · EMP admin</span>
        <button
          onClick={refresh}
          disabled={loading}
          className="text-(--mrms-rust) bg-transparent border-0 cursor-pointer font-mono text-[10px] tracking-editorial uppercase inline-flex items-center gap-1"
        >
          <RefreshCw className="size-3" />
          Refresh
        </button>
      </div>

      <h1 className="font-display font-bold text-[32px] md:text-[40px] leading-tight text-(--mrms-ink) mb-6">
        EMP control
      </h1>

      {error && (
        <div className="mb-4 p-3 border border-(--mrms-rust) text-(--mrms-rust) font-mono text-[11px]">
          {error}
        </div>
      )}

      <section className="mb-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-(--mrms-rule) border border-(--mrms-rule) mb-4">
          <StatCell label="Total tracks" value={stats?.total_tracks ?? "—"} />
          <StatCell label="In EMP" value={stats?.in_emp ?? "—"} />
          <StatCell label="With embedding" value={stats?.with_embedding ?? "—"} />
          <StatCell
            label="Platforms"
            value={
              stats
                ? Object.entries(stats.by_platform)
                    .map(([p, n]) => `${p} ${n}`)
                    .join(" · ") || "—"
                : "—"
            }
          />
        </div>
        <button
          onClick={onTrigger}
          className="bg-(--mrms-rust) text-(--mrms-paper) border-0 px-4 py-2 font-mono text-[10px] tracking-editorial uppercase cursor-pointer inline-flex items-center gap-1.5"
        >
          <Play className="size-3 fill-current" />
          Trigger import
        </button>
      </section>

      <SettingsCard settings={settings} onSaved={refresh} />

      {sections && sections.length > 0 && (
        <SectionsTree sections={sections} />
      )}

      <section>
        <h2 className="font-display font-bold text-[20px] mb-3 pb-2 border-b border-(--mrms-ink)">
          Recent runs
        </h2>
        {runs.length === 0 && (
          <div className="py-8 text-center font-mono text-[11px] tracking-editorial uppercase text-(--mrms-ink-mute)">
            — no runs —
          </div>
        )}
        {runs.map((r) => (
          <RunRow key={r.id} run={r} />
        ))}
      </section>
    </div>
  );
}
