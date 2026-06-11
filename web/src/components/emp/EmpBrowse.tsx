"use client";

import { useEffect, useMemo, useState } from "react";

import { fetchEmpSections } from "@/lib/api/emp";
import type { EmpSection, EmpSectionItem } from "@/lib/types";

import { SectionRow } from "./SectionRow";
import { TrackSectionRow } from "./TrackSectionRow";
import { ItemTracksModal } from "./ItemTracksModal";


/** 섹션이 트랙 모음(chart)이면 트랙을 직접 펼친다 — 컨테이너 카드가 아니라.
 *  현재는 단일 'chart' 아이템 섹션(Melon/Apple)이 해당. */
function isTrackSection(sec: EmpSection): boolean {
  return sec.items.length > 0 && sec.items.every((it) => it.item_type === "chart");
}


const PLATFORM_ORDER = ["tidal", "spotify", "flo", "melon", "vibe", "apple"];
const PLATFORM_DIVIDER: Record<string, string> = {
  tidal: "Tidal is Good",
  spotify: "Spotify is Coming",
  flo: "FLO is Everything",
  melon: "Melon is Sweet",
  vibe: "VIBE is Gentle",
  apple: "Apple is Smart",
};


function StatCell({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-(--mrms-bg) px-3 py-2.5">
      <div className="font-mono text-[9px] tracking-editorial uppercase text-(--mrms-ink-mute)">
        {label}
      </div>
      <div className="font-display font-medium text-[18px] md:text-[22px] leading-none mt-1 text-(--mrms-ink)">
        {value}
      </div>
    </div>
  );
}


export function EmpBrowse() {
  const [sections, setSections] = useState<EmpSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openItem, setOpenItem] = useState<EmpSectionItem | null>(null);

  useEffect(() => {
    let mounted = true;
    fetchEmpSections()
      .then((sec) => mounted && setSections(sec))
      .catch((e) => mounted && setError((e as Error).message))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  const stats = useMemo(() => {
    const items = sections.flatMap((s) => s.items);
    const byType = { playlist: 0, album: 0, mix: 0 } as Record<string, number>;
    for (const it of items) byType[it.item_type] = (byType[it.item_type] ?? 0) + 1;
    const lastSynced = sections
      .map((s) => s.last_synced_at)
      .filter(Boolean)
      .sort()
      .at(-1);
    return { total: items.length, byType, lastSynced };
  }, [sections]);

  const platformGroups = useMemo(() => {
    const known = PLATFORM_ORDER.filter((p) => sections.some((s) => s.platform === p));
    const extra = [...new Set(sections.map((s) => s.platform))].filter(
      (p) => !PLATFORM_ORDER.includes(p),
    );
    return [...known, ...extra].map((platform) => {
      const groupSections = sections.filter((s) => s.platform === platform);
      const itemCount = groupSections.reduce((n, s) => n + s.items.length, 0);
      return { platform, sections: groupSections, itemCount };
    });
  }, [sections]);

  const today = new Date();
  const dateStr = today.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const syncedLabel = stats.lastSynced
    ? new Date(stats.lastSynced).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : "—";

  return (
    <div className="px-5 pt-6 pb-48 md:px-10 md:pt-10">
      {/* === DATELINE === */}
      <div className="flex justify-between items-baseline border-b border-(--mrms-rule) pb-2 mb-6 font-mono text-[10px] tracking-editorial uppercase text-(--mrms-ink-mute) gap-3">
        <span className="truncate">{dateStr} · External Music Pool</span>
        <span className="shrink-0 hidden sm:inline">Synced {syncedLabel}</span>
      </div>

      {/* === HERO — data forward === */}
      <div className="flex flex-col gap-6 mb-6 lg:grid lg:grid-cols-[1fr_320px] lg:gap-10 lg:items-start">
        <div>
          <div className="font-mono text-[10px] tracking-editorial uppercase text-(--mrms-ink-mute) mb-2">
            Section 02 / EMP — External Music Pool
          </div>
          <h1 className="font-display font-bold text-[32px] md:text-[44px] leading-[1.05] tracking-[-0.015em] text-(--mrms-ink) mb-3">
            External pool
          </h1>
          <p className="text-[14px] font-normal text-(--mrms-ink-soft) leading-relaxed max-w-[560px] border-l-2 border-(--mrms-rust) pl-3.5">
            Editorial picks pulled from streaming platforms, refreshed nightly.
            {" "}{sections.length} sections, {stats.total} items —
            {" "}{stats.byType.playlist} playlists, {stats.byType.album} albums,
            {" "}{stats.byType.mix} mixes. Click any cover to see its tracks.
          </p>
        </div>

        <div className="grid grid-cols-4 lg:grid-cols-2 gap-px bg-(--mrms-rule) border border-(--mrms-rule)">
          <StatCell label="Sections" value={sections.length} />
          <StatCell label="Items" value={stats.total} />
          <StatCell label="Playlists" value={stats.byType.playlist} />
          <StatCell label="Albums · Mixes" value={stats.byType.album + stats.byType.mix} />
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 border border-(--mrms-rust) text-(--mrms-rust) font-mono text-[11px]">
          {error}
        </div>
      )}

      {loading && (
        <div className="py-12 text-center font-mono text-[11px] tracking-editorial uppercase text-(--mrms-ink-mute)">
          — loading —
        </div>
      )}

      {!loading && sections.length === 0 && !error && (
        <div className="py-12 text-center font-mono text-[11px] tracking-editorial uppercase text-(--mrms-ink-mute)">
          — no sections yet, trigger import in /admin/emp —
        </div>
      )}

      {platformGroups.map((group) => (
        <div key={group.platform} className="mb-12">
          {/* === EDITORIAL DIVIDER === */}
          <div className="flex items-center gap-4 mb-6">
            <span className="h-px flex-1 bg-(--mrms-rule)" />
            <div className="flex items-baseline gap-2.5 shrink-0">
              <span className="font-mono text-[10px] tracking-editorial uppercase text-(--mrms-ink-mute) tabular-nums">
                {group.platform}
              </span>
              <p className="font-display italic text-[22px] md:text-[30px] text-(--mrms-ink) leading-tight">
                {PLATFORM_DIVIDER[group.platform] ?? `${group.platform} is Good`}
              </p>
              <span className="font-mono text-[10px] tracking-editorial uppercase text-(--mrms-ink-mute) tabular-nums">
                {group.sections.length}·{group.itemCount}
              </span>
            </div>
            <span className="h-px flex-1 bg-(--mrms-rule)" />
          </div>

          <div className="space-y-7">
            {group.sections.map((sec, i) =>
              isTrackSection(sec) ? (
                <TrackSectionRow key={sec.id} section={sec} index={i} />
              ) : (
                <SectionRow
                  key={sec.id}
                  section={sec}
                  index={i}
                  onItemClick={(it) => setOpenItem(it)}
                />
              ),
            )}
          </div>
        </div>
      ))}

      {openItem && (
        <ItemTracksModal item={openItem} onClose={() => setOpenItem(null)} />
      )}
    </div>
  );
}
