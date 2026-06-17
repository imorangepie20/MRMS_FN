"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Square, SkipForward } from "lucide-react";

import { AlbumArt } from "@/components/mrms/AlbumArt";
import { fetchPreviewTracks, type PreviewTrack } from "@/lib/api/landing";
import { PreviewSpectrum } from "./PreviewSpectrum";

export function LandingHero() {
  const [tracks, setTracks] = useState<PreviewTrack[]>([]);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    fetchPreviewTracks(5).then(setTracks).catch(() => setTracks([]));
  }, []);

  const current = tracks[idx];

  const play = (t: PreviewTrack) => {
    const el = audioRef.current;
    if (!el) return;
    el.src = t.preview_url;
    el.play().then(() => setPlaying(true)).catch(() => {});
  };

  const allowPlay = () => {
    if (current) play(current);
  };
  const next = () => {
    if (tracks.length < 2) return;
    setIdx((i) => (i + 1) % tracks.length);
  };
  const stop = () => {
    const el = audioRef.current;
    if (el) {
      el.pause();
      el.currentTime = 0;
    }
    setPlaying(false);
  };

  // 곡 전환(재생 중일 때만 자동 이어 재생)
  useEffect(() => {
    if (playing && current) play(current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  return (
    <section className="relative h-[clamp(300px,46vh,460px)] overflow-hidden border-b border-(--mrms-ink) bg-(--mrms-ink)">
      {current && (
        <div className="absolute inset-0 opacity-60">
          <AlbumArt
            artist={current.artist}
            album={null}
            initialUrl={current.album_cover}
            className="w-full h-full object-cover scale-110 blur-md"
          />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-(--mrms-ink) via-(--mrms-ink)/55 to-(--mrms-ink)/20" />

      {/* 스펙트럼(하단) */}
      <div className="absolute left-0 right-0 bottom-0 h-24 px-6 md:px-14 opacity-90">
        <PreviewSpectrum audioRef={audioRef} active={playing} />
      </div>

      {/* 메타 + 컨트롤 */}
      <div className="absolute left-6 md:left-14 bottom-8 right-6 text-(--mrms-paper)">
        <div className="font-mono text-[10px] tracking-editorial uppercase opacity-80">
          Featured today
        </div>
        <div className="font-display font-bold text-[clamp(28px,5vw,48px)] leading-[1.02] mt-1 truncate">
          {current?.title ?? "MRMS"}
        </div>
        <div className="font-mono text-[12px] opacity-85 mt-1 truncate">
          {current?.artist ?? "music recommendation, reimagined"}
        </div>
        <div className="mt-4 flex items-center gap-3">
          {!playing ? (
            <button
              onClick={allowPlay}
              disabled={!current}
              className="inline-flex items-center gap-2 bg-(--mrms-rust) text-(--mrms-paper) px-4 py-2 font-mono text-[11px] tracking-editorial uppercase border-0 cursor-pointer disabled:opacity-40"
            >
              <Play className="size-3.5 fill-current" /> 플레이 허용
            </button>
          ) : (
            <>
              <button
                onClick={stop}
                aria-label="정지"
                className="inline-flex items-center gap-2 bg-(--mrms-paper)/15 text-(--mrms-paper) px-4 py-2 font-mono text-[11px] tracking-editorial uppercase border border-(--mrms-paper)/30 cursor-pointer hover:bg-(--mrms-paper)/25"
              >
                <Square className="size-3.5 fill-current" /> 정지
              </button>
              <button
                onClick={next}
                className="inline-flex items-center gap-2 bg-(--mrms-paper)/15 text-(--mrms-paper) px-4 py-2 font-mono text-[11px] tracking-editorial uppercase border border-(--mrms-paper)/30 cursor-pointer hover:bg-(--mrms-paper)/25"
              >
                <SkipForward className="size-3.5" /> 다음 곡
              </button>
            </>
          )}
        </div>
      </div>

      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={audioRef} onEnded={next} preload="none" crossOrigin="anonymous" />
    </section>
  );
}
