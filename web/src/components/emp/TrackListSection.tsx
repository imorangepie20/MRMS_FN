"use client";

import { useEffect, useState } from "react";
import { Play } from "lucide-react";

import { ArtistLink } from "@/components/artist/ArtistLink";
import { fetchEmpItemTracks } from "@/lib/api/emp";
import type { EmpItemTrack, EmpSection } from "@/lib/types";
import {
  PlayAllButton,
  formatDuration,
  isPlayable,
  playTracks,
} from "@/components/track/ModalTrackList";


/** 단일 플레이리스트 섹션(스포티파이 Top 50 등)을 세로 트랙 나열형으로.
 *  카드 하나 대신 순위가 매겨진 곡 목록을 직접 펼친다. */
export function TrackListSection({
  section,
  index,
}: {
  section: EmpSection;
  index?: number;
}) {
  const COLLAPSED = 10;
  const item = section.items[0];
  const [tracks, setTracks] = useState<EmpItemTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? tracks : tracks.slice(0, COLLAPSED);

  useEffect(() => {
    if (!item) return;
    let mounted = true;
    setLoading(true);
    fetchEmpItemTracks(item.item_type, item.item_id, 100)
      .then((t) => mounted && setTracks(t))
      .catch(() => mounted && setTracks([]))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [item?.item_type, item?.item_id]);

  return (
    <section>
      {/* === 헤더 (SectionRow 톤과 일치) === */}
      <div className="flex items-baseline justify-between gap-3 mb-2 pb-2 border-b border-(--mrms-ink)">
        <div className="flex items-baseline gap-2.5 min-w-0">
          {index !== undefined && (
            <span className="font-mono text-[11px] text-(--mrms-rust) tabular-nums shrink-0">
              {String(index + 1).padStart(2, "0")}
            </span>
          )}
          <h2 className="font-display font-bold text-[20px] text-(--mrms-ink) truncate">
            {section.display_title ?? section.section_key}
          </h2>
          <span className="font-mono text-[10px] tracking-editorial uppercase text-(--mrms-ink-mute) shrink-0">
            {tracks.length || section.items.length}
          </span>
        </div>
        {tracks.length > 0 && <PlayAllButton tracks={tracks} />}
      </div>

      {loading ? (
        <div className="py-6 font-mono text-[10px] tracking-editorial uppercase text-(--mrms-ink-mute)">
          — loading tracks —
        </div>
      ) : tracks.length === 0 ? (
        <div className="py-6 font-mono text-[10px] tracking-editorial uppercase text-(--mrms-ink-mute)">
          — no tracks —
        </div>
      ) : (
        <ol>
          {visible.map((t, i) => {
            const playable = isPlayable(t);
            const rank = i + 1;
            return (
              <li key={t.track_id} data-track-id={t.track_id}>
                <button
                  onClick={() => playTracks(tracks, i)}
                  disabled={!playable}
                  className="group w-full text-left grid grid-cols-[26px_36px_1fr_auto] gap-3 items-center py-1.5 border-b border-(--mrms-rule) last:border-b-0 bg-transparent border-x-0 border-t-0 cursor-pointer disabled:cursor-default disabled:opacity-45 hover:bg-(--mrms-paper)"
                >
                  {/* 순위 / hover ▶ — 1~3위는 러스트 강조 */}
                  <span className="relative size-5 flex items-center justify-end">
                    <span
                      className={`font-mono text-[12px] tabular-nums group-hover:opacity-0 transition-opacity ${
                        rank <= 3
                          ? "text-(--mrms-rust) font-bold"
                          : "text-(--mrms-ink-mute)"
                      }`}
                    >
                      {rank}
                    </span>
                    {playable && (
                      <span className="absolute inset-0 opacity-0 group-hover:opacity-100 flex items-center justify-end transition-opacity">
                        <Play className="size-3.5 fill-(--mrms-rust) text-(--mrms-rust)" />
                      </span>
                    )}
                  </span>

                  {/* 커버 */}
                  <div className="size-9 relative overflow-hidden bg-(--mrms-rule)">
                    {t.album_cover ? (
                      <img
                        src={t.album_cover}
                        alt=""
                        loading="lazy"
                        className="absolute inset-0 size-full object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-(--mrms-ink-mute) font-display font-bold text-[13px]">
                        {t.title.trim().charAt(0).toUpperCase() || "·"}
                      </div>
                    )}
                  </div>

                  {/* 제목 / 아티스트 */}
                  <div className="min-w-0">
                    <div
                      className="font-display font-medium text-[14px] leading-tight truncate text-(--mrms-ink) group-hover:text-(--mrms-rust) transition-colors"
                      title={t.title}
                    >
                      {t.title}
                    </div>
                    <div
                      className="font-mono text-[11px] text-(--mrms-ink-soft) truncate mt-0.5"
                      title={t.artist}
                    >
                      <ArtistLink name={t.artist} as="span" />
                    </div>
                  </div>

                  {/* 길이 */}
                  <span className="font-mono text-[11px] text-(--mrms-ink-mute) tabular-nums shrink-0">
                    {t.duration_ms != null ? formatDuration(t.duration_ms) : ""}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}

      {!loading && tracks.length > COLLAPSED && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 font-mono text-[10px] tracking-editorial uppercase text-(--mrms-rust) bg-transparent border-0 cursor-pointer hover:underline"
        >
          {expanded ? "− 접기" : `+ 더보기 (${tracks.length - COLLAPSED})`}
        </button>
      )}
    </section>
  );
}
