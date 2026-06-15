"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Play, ChevronLeft, ChevronRight } from "lucide-react";

import {
  deleteEmpRun,
  fetchEmpRuns,
  fetchEmpSettings,
  fetchEmpStats,
  pruneEmpRuns,
  triggerEmpImport,
} from "@/lib/api/admin-emp";
import { fetchEmpSections } from "@/lib/api/emp";
import type { EmpSection, EmpSettings, EmpStats, IngestionRun } from "@/lib/types";

import { RunMrtCard } from "./emp/RunMrtCard";
import { RunRow } from "./emp/RunRow";
import { SectionsTree } from "./emp/SectionsTree";
import { SettingsCard } from "./emp/SettingsCard";
import { StatCell } from "./emp/StatCell";

const RUNS_PAGE_SIZE = 20;


export function EmpDashboard() {
  const [stats, setStats] = useState<EmpStats | null>(null);
  const [runs, setRuns] = useState<IngestionRun[]>([]);
  const [runsTotal, setRunsTotal] = useState(0);
  const [runsPage, setRunsPage] = useState(0);
  const [settings, setSettings] = useState<EmpSettings["settings"] | null>(null);
  const [sections, setSections] = useState<EmpSection[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRuns = useCallback(async (page: number) => {
    const r = await fetchEmpRuns(RUNS_PAGE_SIZE, page * RUNS_PAGE_SIZE);
    setRuns(r.runs);
    setRunsTotal(r.total);
    setRunsPage(page);
  }, []);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, st, sec] = await Promise.all([
        fetchEmpStats(),
        fetchEmpSettings(),
        fetchEmpSections().catch(() => [] as EmpSection[]),
      ]);
      setStats(s);
      setSettings(st.settings);
      setSections(sec);
      await loadRuns(0);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const onDeleteRun = async (runId: string) => {
    if (!confirm(`Delete run ${runId}?`)) return;
    try {
      await deleteEmpRun(runId);
      // 현재 페이지가 비면 한 페이지 앞으로
      const lastOnPage = runs.length === 1 && runsPage > 0;
      await loadRuns(lastOnPage ? runsPage - 1 : runsPage);
    } catch (e) {
      alert(`Delete failed: ${(e as Error).message}`);
    }
  };

  const onPrune = async () => {
    if (!confirm("Keep only the most recent 50 runs and delete the rest?")) return;
    try {
      const deleted = await pruneEmpRuns(50);
      alert(`Deleted ${deleted} old runs.`);
      await loadRuns(0);
    } catch (e) {
      alert(`Prune failed: ${(e as Error).message}`);
    }
  };

  const totalPages = Math.max(1, Math.ceil(runsTotal / RUNS_PAGE_SIZE));

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

      <RunMrtCard onAllQueued={() => loadRuns(0)} />

      {sections && sections.length > 0 && (
        <SectionsTree sections={sections} />
      )}

      <section>
        <div className="flex items-baseline justify-between mb-3 pb-2 border-b border-(--mrms-ink) gap-3">
          <h2 className="font-display font-bold text-[20px]">
            Recent runs
            {runsTotal > 0 && (
              <span className="ml-2 font-mono text-[10px] tracking-editorial uppercase text-(--mrms-ink-mute)">
                {runsTotal} total
              </span>
            )}
          </h2>
          {runsTotal > 50 && (
            <button
              onClick={onPrune}
              className="shrink-0 text-(--mrms-rust) bg-transparent border-0 cursor-pointer font-mono text-[10px] tracking-editorial uppercase"
            >
              Prune (keep 50)
            </button>
          )}
        </div>

        {runs.length === 0 && (
          <div className="py-8 text-center font-mono text-[11px] tracking-editorial uppercase text-(--mrms-ink-mute)">
            — no runs —
          </div>
        )}
        {runs.map((r) => (
          <RunRow key={r.id} run={r} onDelete={onDeleteRun} />
        ))}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 mt-4 font-mono text-[10px] tracking-editorial uppercase text-(--mrms-ink-soft)">
            <button
              onClick={() => loadRuns(runsPage - 1)}
              disabled={runsPage === 0}
              aria-label="previous page"
              className="bg-transparent border-0 cursor-pointer disabled:opacity-30 disabled:cursor-default inline-flex items-center gap-1"
            >
              <ChevronLeft className="size-3.5" /> Prev
            </button>
            <span className="text-(--mrms-ink-mute)">
              {runsPage + 1} / {totalPages}
            </span>
            <button
              onClick={() => loadRuns(runsPage + 1)}
              disabled={runsPage >= totalPages - 1}
              aria-label="next page"
              className="bg-transparent border-0 cursor-pointer disabled:opacity-30 disabled:cursor-default inline-flex items-center gap-1"
            >
              Next <ChevronRight className="size-3.5" />
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
