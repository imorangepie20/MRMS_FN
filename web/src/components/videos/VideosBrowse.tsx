"use client";

import { useEffect, useState } from "react";

import { fetchVideoSections } from "@/lib/api/videos";
import type { EmpSection } from "@/lib/types";
import { SectionMasthead } from "@/components/visual/SectionMasthead";

import { SectionCarousel } from "./SectionCarousel";
import { VideoCard } from "./VideoCard";
import { VideoPlaylistCard } from "./VideoPlaylistCard";
import { VideoPlaylistModal } from "./VideoPlaylistModal";

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
      {sections.map((sec) => {
        const isPlaylist = sec.items[0]?.item_type === "video_playlist";
        // 플레이리스트=정사각(작게), 비디오=16:9(넓게). 슬라이드 고정폭.
        const slideW = isPlaylist
          ? "w-[140px] sm:w-[150px] md:w-[160px]"
          : "w-[200px] sm:w-[220px] md:w-[240px]";
        return (
          <SectionCarousel
            key={sec.id}
            title={sec.display_title ?? ""}
            countLabel={`${sec.items.length} ${isPlaylist ? "playlists" : "videos"}`}
          >
            {/* video_playlist=플레이리스트 카드(→영상 모달), video=개별 영상 카드(→풀스크린). */}
            {sec.items.map((it) => (
              <div key={it.id} className={`shrink-0 snap-start ${slideW}`}>
                {it.item_type === "video_playlist" ? (
                  <VideoPlaylistCard
                    uuid={it.item_id}
                    title={it.title ?? ""}
                    coverUrl={it.cover_url}
                  />
                ) : (
                  <VideoCard
                    videoId={it.item_id}
                    title={it.title ?? ""}
                    coverUrl={it.cover_url}
                  />
                )}
              </div>
            ))}
          </SectionCarousel>
        );
      })}

      <VideoPlaylistModal />
    </div>
  );
}
