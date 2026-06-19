"use client";

import { useEffect, useState } from "react";

import { fetchVideoSections } from "@/lib/api/videos";
import type { EmpSection } from "@/lib/types";
import { SectionMasthead } from "@/components/visual/SectionMasthead";

import { VideoCard } from "./VideoCard";

export function VideosBrowse() {
  const [sections, setSections] = useState<EmpSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let on = true;
    fetchVideoSections()
      .then((s) => on && setSections(s))
      .catch((e) => on && setError((e as Error).message))
      .finally(() => on && setLoading(false));
    return () => {
      on = false;
    };
  }, []);

  return (
    <div className="px-5 pt-6 pb-48 md:px-10 md:pt-10">
      <SectionMasthead
        className="mb-6"
        kicker="§ 04 · Tidal Videos"
        title="Music Videos"
        meta="전체화면으로 보면서 듣는 뮤직비디오"
        imageKey="Music Videos"
      />
      {loading && (
        <div className="py-12 text-center font-mono text-[11px] tracking-editorial uppercase text-(--mrms-ink-mute)">— loading —</div>
      )}
      {error && (
        <div className="mb-4 p-3 border border-(--mrms-rust) text-(--mrms-rust) font-mono text-[11px]">{error}</div>
      )}
      {!loading && sections.length === 0 && !error && (
        <div className="py-12 text-center font-mono text-[11px] tracking-editorial uppercase text-(--mrms-ink-mute)">— no videos yet —</div>
      )}
      {sections.map((sec) => (
        <div key={sec.id} className="mb-10">
          <div className="mb-3 flex items-end justify-between gap-4 border-b border-(--mrms-ink) pb-1">
            <h2 className="font-display font-bold text-(--mrms-ink) leading-[1.05] tracking-[-0.015em] text-[20px] md:text-[26px]">
              {sec.display_title}
            </h2>
            <span className="font-mono text-[10px] tracking-editorial uppercase text-(--mrms-ink-mute) tabular-nums shrink-0 pb-1">
              {sec.items.length} videos
            </span>
          </div>
          <div className="flex gap-3 overflow-x-auto snap-x pb-2">
            {sec.items.map((it) => (
              <VideoCard
                key={it.id}
                videoId={it.item_id}
                title={it.title ?? ""}
                coverUrl={it.cover_url}
                widthPx={260}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
