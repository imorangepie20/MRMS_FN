"use client";

import { Pause, Play, SkipBack, SkipForward } from "lucide-react";

import {
  loadAndPlay,
  pausePlayback,
  resumePlayback,
  seekTo,
} from "@/lib/tidal-player";
import { usePlayerStore } from "@/store/player";


interface Props {
  compact?: boolean;
}


export function PlayerControls({ compact = false }: Props) {
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const position = usePlayerStore((s) => s.position);
  const durationSec = usePlayerStore((s) => s.durationSec);
  const queue = usePlayerStore((s) => s.queue);
  const currentIdx = usePlayerStore((s) => s.currentIdx);

  const hasTrack = queue.length > 0 && currentIdx < queue.length;

  const togglePlay = async () => {
    if (!hasTrack) return;
    try {
      if (isPlaying) await pausePlayback();
      else await resumePlayback();
    } catch (e) {
      usePlayerStore.setState({ errorMsg: (e as Error).message });
    }
  };

  const next = async () => {
    const s = usePlayerStore.getState();
    if (s.currentIdx + 1 < s.queue.length) {
      const nextIdx = s.currentIdx + 1;
      usePlayerStore.setState({ currentIdx: nextIdx, position: 0 });
      const nextTrack = s.queue[nextIdx];
      try {
        await loadAndPlay(nextTrack.tidal_track_id);
      } catch (e) {
        usePlayerStore.setState({ errorMsg: (e as Error).message });
      }
    }
  };

  const prev = async () => {
    const s = usePlayerStore.getState();
    if (s.currentIdx > 0) {
      const prevIdx = s.currentIdx - 1;
      usePlayerStore.setState({ currentIdx: prevIdx, position: 0 });
      const prevTrack = s.queue[prevIdx];
      try {
        await loadAndPlay(prevTrack.tidal_track_id);
      } catch (e) {
        usePlayerStore.setState({ errorMsg: (e as Error).message });
      }
    }
  };

  const onSeekChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const r = Number(e.target.value) / 1000;
    usePlayerStore.setState({ position: r });
    await seekTo(r);
  };

  const fmtTime = (s: number) => {
    if (!Number.isFinite(s) || s < 0) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

  // 모바일 — 큰 ⏯ 한 개. 데스크탑 — ⏮ ⏯ ⏭ + 진행바
  const playPauseSize = compact ? "h-11 w-11 md:h-9 md:w-9" : "h-9 w-9";

  return (
    <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
      <button
        aria-label="Previous"
        onClick={prev}
        disabled={!hasTrack || currentIdx === 0}
        className={`${compact ? "hidden md:inline-flex" : "inline-flex"} items-center justify-center h-9 w-9 rounded hover:bg-muted disabled:opacity-40 touch-manipulation`}
      >
        <SkipBack className="h-4 w-4" />
      </button>
      <button
        aria-label={isPlaying ? "Pause" : "Play"}
        onClick={togglePlay}
        disabled={!hasTrack}
        className={`shrink-0 inline-flex items-center justify-center ${playPauseSize} rounded-full bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40 touch-manipulation`}
      >
        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </button>
      <button
        aria-label="Next"
        onClick={next}
        disabled={!hasTrack || currentIdx >= queue.length - 1}
        className="inline-flex items-center justify-center h-9 w-9 rounded hover:bg-muted disabled:opacity-40 touch-manipulation"
      >
        <SkipForward className="h-4 w-4" />
      </button>

      {/* 진행 바 + 시간 — 데스크탑에서만 */}
      {!compact && hasTrack && (
        <div className="hidden md:flex items-center gap-2 flex-1 min-w-0">
          <span className="text-xs tabular-nums w-10 text-right text-muted-foreground">
            {fmtTime(position * durationSec)}
          </span>
          <input
            type="range"
            min={0}
            max={1000}
            value={Math.round(position * 1000)}
            onChange={onSeekChange}
            className="flex-1 h-1 accent-primary"
            aria-label="Seek"
          />
          <span className="text-xs tabular-nums w-10 text-muted-foreground">
            {fmtTime(durationSec)}
          </span>
        </div>
      )}
    </div>
  );
}
