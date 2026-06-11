"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";

import { fetchEmpItemTracks } from "@/lib/api/emp";
import type { EmpItemTrack, EmpSection } from "@/lib/types";
import { PlayAllButton, formatDuration, playTracks } from "@/components/track/ModalTrackList";


// 커버 없는 트랙용 결정적 색조 (EmpItemCard와 동일 톤)
const TINTS = [
  "from-[#2a2622] to-[#4a4038]",
  "from-[#3a2620] to-[#5b3a2c]",
  "from-[#2a2e2a] to-[#42463c]",
  "from-[#322833] to-[#4e3e4a]",
  "from-[#2c2a26] to-[#4a4640]",
];

function tintFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return TINTS[h % TINTS.length];
}


/** 트랙 모음 섹션(chart 등) — 컨테이너 카드 대신 트랙을 직접 가로 캐러셀로 노출.
 *  각 트랙 hover ▶ 개별 재생 + 헤더 Play All 전체 재생. */
export function TrackSectionRow({
  section,
  index,
}: {
  section: EmpSection;
  index?: number;
}) {
  const chartItem = section.items[0];
  const [tracks, setTracks] = useState<EmpItemTrack[]>([]);
  const [loading, setLoading] = useState(true);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);
  const [cols, setCols] = useState(8);
  const [itemPx, setItemPx] = useState(150);

  // 트랙 lazy fetch
  useEffect(() => {
    if (!chartItem) return;
    let mounted = true;
    fetchEmpItemTracks(chartItem.item_type, chartItem.item_id, 100)
      .then((t) => mounted && setTracks(t))
      .catch(() => mounted && setTracks([]))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [chartItem?.item_type, chartItem?.item_id]);

  const updateArrows = () => {
    const el = scrollerRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 2);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  };

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const compute = () => {
      const vw = window.innerWidth;
      const isDesktop = vw >= 768;
      const available = vw - (isDesktop ? 240 : 0) - (isDesktop ? 80 : 40);
      let c = 8;
      if (vw < 640) c = 2;
      else if (vw < 768) c = 3;
      else if (vw < 1024) c = 4;
      else if (vw < 1280) c = 6;
      setCols(c);
      setItemPx(Math.max(Math.floor(available / c) - 12, 80));
      updateArrows();
    };
    compute();
    el.addEventListener("scroll", updateArrows, { passive: true });
    const ro = new ResizeObserver(updateArrows);
    ro.observe(el);
    window.addEventListener("resize", compute);
    return () => {
      el.removeEventListener("scroll", updateArrows);
      ro.disconnect();
      window.removeEventListener("resize", compute);
    };
  }, [tracks.length]);

  const scrollByPage = (dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * (itemPx + 12) * cols, behavior: "smooth" });
  };

  return (
    <section>
      <div className="flex items-baseline justify-between mb-3 pb-2 border-b border-(--mrms-ink) gap-3">
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
            {tracks.length}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <PlayAllButton tracks={tracks} />
          <div className="flex gap-1">
            <button
              onClick={() => scrollByPage(-1)}
              disabled={!canLeft}
              aria-label="previous"
              className="size-7 flex items-center justify-center bg-transparent border border-(--mrms-rule) text-(--mrms-ink-soft) cursor-pointer disabled:opacity-30 disabled:cursor-default hover:bg-(--mrms-bg)"
            >
              <ChevronLeft className="size-3.5" />
            </button>
            <button
              onClick={() => scrollByPage(1)}
              disabled={!canRight}
              aria-label="next"
              className="size-7 flex items-center justify-center bg-transparent border border-(--mrms-rule) text-(--mrms-ink-soft) cursor-pointer disabled:opacity-30 disabled:cursor-default hover:bg-(--mrms-bg)"
            >
              <ChevronRight className="size-3.5" />
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-6 font-mono text-[10px] tracking-editorial uppercase text-(--mrms-ink-mute)">
          — loading tracks —
        </div>
      ) : (
        <div
          ref={scrollerRef}
          className="flex w-full overflow-x-auto pb-2 -mx-1.5 scroll-smooth snap-x snap-mandatory [&::-webkit-scrollbar]:hidden"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {tracks.map((t, i) => (
            <div
              key={t.track_id}
              className="shrink-0 snap-start px-1.5"
              style={{ width: `${itemPx + 12}px` }}
            >
              <TrackCard
                track={t}
                rank={i + 1}
                coverPx={itemPx}
                onPlay={() => playTracks(tracks, i)}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}


function TrackCard({
  track,
  rank,
  coverPx,
  onPlay,
}: {
  track: EmpItemTrack;
  rank: number;
  coverPx: number;
  onPlay: () => void;
}) {
  const playable = track.tidal_track_id != null || track.spotify_track_id != null;
  return (
    <button
      onClick={onPlay}
      disabled={!playable}
      style={{ containerType: "inline-size" }}
      className="group w-full text-left bg-transparent border-0 p-0 cursor-pointer disabled:cursor-default"
    >
      {/* 커버 */}
      <div
        style={{ width: `${coverPx}px`, height: `${coverPx}px` }}
        className="relative overflow-hidden bg-(--mrms-rule)"
      >
        {track.album_cover ? (
          <img
            src={track.album_cover}
            alt={track.title}
            loading="lazy"
            className="absolute inset-0 size-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
          />
        ) : (
          <div
            className={`absolute inset-0 flex items-center justify-center bg-linear-to-br ${tintFor(track.title)}`}
          >
            <span
              className="font-display font-bold text-(--mrms-paper)/85"
              style={{ fontSize: "40cqw" }}
            >
              {track.title.trim().charAt(0).toUpperCase() || "·"}
            </span>
          </div>
        )}

        {/* 순위 칩 */}
        <span className="absolute top-1.5 left-1.5 px-1.5 py-px bg-(--mrms-paper)/90 border border-(--mrms-ink) text-(--mrms-ink) font-mono text-[9px] tabular-nums leading-none">
          {rank}
        </span>

        {/* hover 재생 오버레이 */}
        {playable && (
          <span className="absolute inset-0 flex items-center justify-center bg-(--mrms-ink)/45 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <span className="size-8 rounded-full bg-(--mrms-rust) flex items-center justify-center">
              <Play className="size-3.5 fill-(--mrms-paper) text-(--mrms-paper) ml-0.5" />
            </span>
          </span>
        )}
      </div>

      {/* 제목 + 아티스트 */}
      <div className="mt-1.5 font-display font-medium text-[12px] leading-snug text-(--mrms-ink) truncate group-hover:text-(--mrms-rust) transition-colors" title={track.title}>
        {track.title}
      </div>
      <div className="font-mono text-[10px] text-(--mrms-ink-mute) truncate" title={track.artist}>
        {track.artist}
        {track.duration_ms != null && (
          <span className="text-(--mrms-ink-mute)"> · {formatDuration(track.duration_ms)}</span>
        )}
      </div>
    </button>
  );
}
