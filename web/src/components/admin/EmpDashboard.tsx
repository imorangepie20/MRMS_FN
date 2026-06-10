"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Play } from "lucide-react";

import {
  fetchEmpRuns,
  fetchEmpSettings,
  fetchEmpStats,
  saveEmpSetting,
  triggerEmpImport,
} from "@/lib/api/admin-emp";
import { fetchEmpSections } from "@/lib/api/emp";
import type { EmpSection, EmpSectionItem, EmpSettings, EmpSettingValue, EmpStats, IngestionRun } from "@/lib/types";


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
      <div className="flex justify-between items-baseline border-b border-[var(--mrms-rule)] pb-2 mb-6 font-mono text-[10px] tracking-editorial uppercase text-[var(--mrms-ink-mute)]">
        <span>Section S · EMP admin</span>
        <button
          onClick={refresh}
          disabled={loading}
          className="text-[var(--mrms-rust)] bg-transparent border-0 cursor-pointer font-mono text-[10px] tracking-editorial uppercase inline-flex items-center gap-1"
        >
          <RefreshCw className="size-3" />
          Refresh
        </button>
      </div>

      <h1 className="font-display font-bold text-[32px] md:text-[40px] leading-tight text-[var(--mrms-ink)] mb-6">
        EMP control
      </h1>

      {error && (
        <div className="mb-4 p-3 border border-[var(--mrms-rust)] text-[var(--mrms-rust)] font-mono text-[11px]">
          {error}
        </div>
      )}

      <section className="mb-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-[var(--mrms-rule)] border border-[var(--mrms-rule)] mb-4">
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
          className="bg-[var(--mrms-rust)] text-[var(--mrms-paper)] border-0 px-4 py-2 font-mono text-[10px] tracking-editorial uppercase cursor-pointer inline-flex items-center gap-1.5"
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
        <h2 className="font-display font-bold text-[20px] mb-3 pb-2 border-b border-[var(--mrms-ink)]">
          Recent runs
        </h2>
        {runs.length === 0 && (
          <div className="py-8 text-center font-mono text-[11px] tracking-editorial uppercase text-[var(--mrms-ink-mute)]">
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


function StatCell({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-[var(--mrms-bg)] px-3 py-2.5">
      <div className="font-mono text-[9px] tracking-editorial uppercase text-[var(--mrms-ink-mute)]">
        {label}
      </div>
      <div className="font-display font-medium text-[18px] md:text-[22px] leading-none mt-1 text-[var(--mrms-ink)]">
        {value}
      </div>
    </div>
  );
}


function SettingsCard({
  settings,
  onSaved,
}: {
  settings: EmpSettings["settings"] | null;
  onSaved: () => Promise<void>;
}) {
  const [tokenInput, setTokenInput] = useState("");
  const [sourcesInput, setSourcesInput] = useState("");
  const [saving, setSaving] = useState(false);

  const tokenSetting: EmpSettingValue | undefined = settings?.["tidal_x_token"];
  const sourcesSetting: EmpSettingValue | undefined = settings?.["tidal_emp_sources"];

  // Initialise sources textarea from server value whenever settings load/refresh
  useEffect(() => {
    if (sourcesSetting && "value" in sourcesSetting) {
      setSourcesInput(sourcesSetting.value ?? "");
    }
  }, [sourcesSetting]);

  const saveToken = async () => {
    if (!tokenInput.trim()) {
      alert("값을 입력하세요");
      return;
    }
    setSaving(true);
    try {
      await saveEmpSetting("tidal_x_token", tokenInput.trim());
      setTokenInput("");
      await onSaved();
      alert("저장됨");
    } catch (e) {
      alert(`저장 실패: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const clearToken = async () => {
    if (!confirm("Tidal token 삭제?")) return;
    setSaving(true);
    try {
      await saveEmpSetting("tidal_x_token", null);
      await onSaved();
    } catch (e) {
      alert(`삭제 실패: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const saveSources = async () => {
    setSaving(true);
    try {
      await saveEmpSetting("tidal_emp_sources", sourcesInput.trim() || null);
      await onSaved();
      alert("저장됨");
    } catch (e) {
      alert(`저장 실패: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mb-10">
      <h2 className="font-display font-bold text-[20px] mb-3 pb-2 border-b border-(--mrms-ink)">
        Settings
      </h2>

      {/* Token row */}
      <div className="flex flex-wrap items-center gap-3 font-mono text-[11px] py-2 border-b border-(--mrms-rule)">
        <span className="text-(--mrms-ink-mute) tracking-editorial uppercase min-w-[120px]">
          tidal_x_token
        </span>
        <span className="text-(--mrms-ink-soft) truncate flex-1 min-w-[100px]">
          {tokenSetting?.present ? `set · ${tokenSetting.preview}` : "— not set —"}
        </span>
        <input
          type="password"
          value={tokenInput}
          onChange={(e) => setTokenInput(e.target.value)}
          placeholder="paste token"
          className="border border-(--mrms-rule) bg-(--mrms-paper) px-2 py-1 font-mono text-[11px] text-(--mrms-ink) w-[180px]"
        />
        <button
          onClick={saveToken}
          disabled={saving || !tokenInput.trim()}
          className="bg-(--mrms-ink) text-(--mrms-paper) border-0 px-3 py-1 font-mono text-[10px] tracking-editorial uppercase cursor-pointer disabled:opacity-50"
        >
          Save
        </button>
        {tokenSetting?.present && (
          <button
            onClick={clearToken}
            disabled={saving}
            className="bg-transparent border border-(--mrms-rust) text-(--mrms-rust) px-3 py-1 font-mono text-[10px] tracking-editorial uppercase cursor-pointer"
          >
            Clear
          </button>
        )}
      </div>

      {/* Sources row */}
      <div className="py-2 border-b border-(--mrms-rule)">
        <div className="font-mono text-[11px] text-(--mrms-ink-mute) tracking-editorial uppercase mb-2">
          tidal_emp_sources
        </div>
        <textarea
          value={sourcesInput}
          onChange={(e) => setSourcesInput(e.target.value)}
          placeholder={`pages/explore\npages/genre_jazz\nplaylist/31885f0b-96dc-41e1-8e1b-f83372043208`}
          rows={8}
          className="w-full border border-(--mrms-rule) bg-(--mrms-paper) px-2 py-1 font-mono text-[11px] text-(--mrms-ink) resize-y"
        />
        <div className="flex gap-2 mt-2">
          <button
            onClick={saveSources}
            disabled={saving}
            className="bg-(--mrms-ink) text-(--mrms-paper) border-0 px-3 py-1 font-mono text-[10px] tracking-editorial uppercase cursor-pointer disabled:opacity-50"
          >
            Save sources
          </button>
        </div>
      </div>

      <p className="mt-2 font-mono text-[10px] text-(--mrms-ink-mute)">
        Tidal web client의 X-Tidal-Token. 값이 있으면 importer가 editorial playlists 받아옴.
        <br />
        <span className="mt-1 block">
          Sources: 한 줄에 하나씩.{" "}
          <code>pages/&lt;slug&gt;</code> = 해당 페이지에서 playlist discover.{" "}
          <code>playlist/&lt;uuid&gt;</code> = 직접 추가. 비우면 default (explore + 17개 장르).
        </span>
      </p>
    </section>
  );
}


function SectionsTree({ sections }: { sections: EmpSection[] }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <section className="mb-10">
      <h2 className="font-display font-bold text-[20px] mb-3 pb-2 border-b border-(--mrms-ink)">
        Sections ({sections.length})
      </h2>
      {sections.map((sec, idx) => {
        const open = openIdx === idx;
        return (
          <div key={sec.id} className="border-b border-(--mrms-rule)">
            <button
              onClick={() => setOpenIdx(open ? null : idx)}
              className="w-full text-left grid grid-cols-[140px_1fr_60px_80px] gap-3 py-2.5 items-baseline bg-transparent border-0 cursor-pointer font-mono text-[11px]"
            >
              <span className="text-(--mrms-ink) font-medium truncate">{sec.section_key}</span>
              <span className="text-(--mrms-ink-soft) truncate">{sec.display_title}</span>
              <span className="text-(--mrms-ink-mute)">{sec.items.length} items</span>
              <span className="text-(--mrms-ink-mute)">{open ? "−" : "+"}</span>
            </button>
            {open && (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 pb-4">
                {sec.items.map((item) => (
                  <ItemCard key={item.id} item={item} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}


function ItemCard({ item }: { item: EmpSectionItem }) {
  return (
    <div className="flex flex-col">
      {item.cover_url ? (
        <img
          src={item.cover_url}
          alt={item.title ?? ""}
          loading="lazy"
          className="aspect-square w-full object-cover bg-(--mrms-rule)"
        />
      ) : (
        <div className="aspect-square w-full bg-(--mrms-rule) flex items-center justify-center font-mono text-[10px] text-(--mrms-ink-mute) uppercase">
          {item.item_type}
        </div>
      )}
      <div className="mt-1 font-mono text-[10px] tracking-editorial uppercase text-(--mrms-ink-mute)">
        {item.item_type}
      </div>
      <div className="font-display text-[12px] text-(--mrms-ink) truncate">
        {item.title ?? item.item_id}
      </div>
    </div>
  );
}


function RunRow({ run }: { run: IngestionRun }) {
  const [open, setOpen] = useState(false);
  const time = run.started_at
    ? new Date(run.started_at).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" })
    : "—";
  const statusColor =
    run.status === "success"
      ? "text-emerald-700"
      : run.status === "failed"
        ? "text-[var(--mrms-rust)]"
        : "text-[var(--mrms-ink-soft)]";

  return (
    <div className="border-b border-[var(--mrms-rule)]">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left grid grid-cols-[100px_120px_80px_1fr] gap-3 py-2.5 items-baseline bg-transparent border-0 cursor-pointer font-mono text-[11px]"
      >
        <span className="text-[var(--mrms-ink-mute)] truncate">{run.id}</span>
        <span className="text-[var(--mrms-ink-soft)]">{time}</span>
        <span className={statusColor}>{run.status}</span>
        <span className="text-[var(--mrms-ink-soft)] truncate">
          {run.stages
            .map((s) => `${s.stage}=${s.status}`)
            .join(" · ")}
        </span>
      </button>
      {open && (
        <div className="px-3 pb-4 font-mono text-[10px] text-[var(--mrms-ink-soft)] space-y-1">
          {run.stages.map((s, i) => (
            <div key={i} className="border-l-2 border-[var(--mrms-rule)] pl-2">
              <span className="text-[var(--mrms-ink)] font-medium">{s.stage}</span>{" "}
              · {s.status}
              {s.tracks_new !== undefined && ` · +${s.tracks_new} new`}
              {s.tracks_existing !== undefined && ` · ${s.tracks_existing} existing`}
              {s.downloaded !== undefined && ` · downloaded ${s.downloaded}`}
              {s.failed !== undefined && s.failed > 0 && ` · failed ${s.failed}`}
              {s.duration_ms !== undefined && ` · ${Math.round((s.duration_ms ?? 0) / 1000)}s`}
              {s.error && (
                <div className="text-[var(--mrms-rust)] mt-0.5 break-all">
                  ⚠ {s.error}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
