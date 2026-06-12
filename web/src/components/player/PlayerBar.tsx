"use client";

import { useEffect } from "react";
import {
  Heart,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Sparkles,
  Volume2,
} from "lucide-react";

import { AlbumArt } from "@/components/mrms/AlbumArt";
import { useUser } from "@/lib/hooks/use-user";
import {
  getPlatformForTrack,
  initPlayer,
  pausePlayback,
  playNext,
  playPrev,
  resetShuffle,
  resumePlayback,
  seekTo,
  setSdkVolume,
} from "@/lib/player";
import { usePlayerStore } from "@/store/player";

import { QueueDrawer } from "./QueueDrawer";


function NowPlaying() {
  const queue = usePlayerStore((s) => s.queue);
  const currentIdx = usePlayerStore((s) => s.currentIdx);
  const isPreview = usePlayerStore((s) => s.isPreview);
  const track = queue[currentIdx];
  const platform = track ? getPlatformForTrack(track) : null;

  if (!track) {
    return (
      <div className="flex gap-3 items-center min-w-0">
        <div className="size-11 bg-[var(--mrms-ink-soft)]" />
        <div className="font-mono text-[10px] tracking-editorial uppercase text-[var(--mrms-paper)]/55">
          — nothing playing —
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 items-center min-w-0">
      <AlbumArt
        artist={track.artist}
        album={track.album_title ?? null}
        initialUrl={track.album_cover ?? null}
        className="size-11 shrink-0"
      />
      <div className="min-w-0 flex flex-col justify-center">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-display text-[14px] truncate">
            {track.title}
          </span>
          {isPreview && (
            <span className="shrink-0 font-mono text-[9px] tracking-editorial uppercase bg-[var(--mrms-rust)] text-[var(--mrms-paper)] px-1.5 py-0.5">
              Preview
            </span>
          )}
          {!isPreview && (
            <span className="shrink-0 font-mono text-[9px] tracking-editorial uppercase bg-[var(--mrms-rust)] text-[var(--mrms-paper)] px-1.5 py-0.5">
              HiFi
            </span>
          )}
          {platform && (
            <span className="shrink-0 font-mono text-[9px] tracking-editorial uppercase border border-[var(--mrms-paper)]/30 text-[var(--mrms-paper)]/60 px-1.5 py-0.5">
              {platform}
            </span>
          )}
        </div>
        <div className="text-[11px] text-[var(--mrms-paper)]/55 truncate mt-0.5">
          {track.artist}
        </div>
      </div>
    </div>
  );
}


function Controls() {
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const position = usePlayerStore((s) => s.position);
  const durationSec = usePlayerStore((s) => s.durationSec);
  const queue = usePlayerStore((s) => s.queue);
  const currentIdx = usePlayerStore((s) => s.currentIdx);
  const shuffleMode = usePlayerStore((s) => s.shuffleMode);
  const repeatMode = usePlayerStore((s) => s.repeatMode);

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

  // next/prev는 facade에 위임 — 셔플/반복 로직을 한 곳에서 처리
  const next = () => void playNext();
  const prev = () => void playPrev();

  const toggleShuffle = () => {
    usePlayerStore.setState({ shuffleMode: !shuffleMode });
    resetShuffle(); // 토글 시 셔플 사이클 초기화
  };

  const cycleRepeat = () => {
    const next: "off" | "all" | "one" =
      repeatMode === "off" ? "all" : repeatMode === "all" ? "one" : "off";
    usePlayerStore.setState({ repeatMode: next });
  };

  const onSeek = async (e: React.ChangeEvent<HTMLInputElement>) => {
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

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-5 justify-center">
        <button
          onClick={toggleShuffle}
          aria-label="Shuffle"
          className={`bg-transparent border-0 cursor-pointer p-0 ${shuffleMode ? "text-[var(--mrms-rust)]" : "text-[var(--mrms-paper)]/70 hover:text-[var(--mrms-paper)]"}`}
        >
          <Shuffle className="size-4" strokeWidth={1.6} />
        </button>
        <button
          onClick={prev}
          disabled={!hasTrack || currentIdx === 0}
          aria-label="Previous"
          className="bg-transparent border-0 cursor-pointer p-0 text-[var(--mrms-paper)]/70 hover:text-[var(--mrms-paper)] disabled:opacity-40"
        >
          <SkipBack className="size-4" fill="currentColor" />
        </button>
        <button
          onClick={togglePlay}
          disabled={!hasTrack}
          aria-label={isPlaying ? "Pause" : "Play"}
          className="bg-[var(--mrms-rust)] text-[var(--mrms-paper)] rounded-full size-9 inline-flex items-center justify-center border-0 cursor-pointer disabled:opacity-40 hover:opacity-90"
        >
          {isPlaying ? (
            <Pause className="size-3.5 fill-current" />
          ) : (
            <Play className="size-3.5 fill-current" />
          )}
        </button>
        <button
          onClick={next}
          disabled={!hasTrack || currentIdx >= queue.length - 1}
          aria-label="Next"
          className="bg-transparent border-0 cursor-pointer p-0 text-[var(--mrms-paper)]/70 hover:text-[var(--mrms-paper)] disabled:opacity-40"
        >
          <SkipForward className="size-4" fill="currentColor" />
        </button>
        <button
          onClick={cycleRepeat}
          aria-label="Repeat"
          className={`bg-transparent border-0 cursor-pointer p-0 ${repeatMode !== "off" ? "text-[var(--mrms-rust)]" : "text-[var(--mrms-paper)]/70 hover:text-[var(--mrms-paper)]"}`}
        >
          {repeatMode === "one" ? (
            <Repeat1 className="size-4" strokeWidth={1.6} />
          ) : (
            <Repeat className="size-4" strokeWidth={1.6} />
          )}
        </button>
      </div>
      <div className="flex items-center gap-2.5 font-mono text-[10px] text-[var(--mrms-paper)]/55">
        <span className="w-9 text-right tabular-nums">
          {fmtTime(position * durationSec)}
        </span>
        <div className="flex-1 relative h-0.5 bg-[var(--mrms-paper)]/20">
          <div
            className="absolute left-0 -top-px h-[3px] bg-[var(--mrms-rust)]"
            style={{ width: `${position * 100}%` }}
          />
          <input
            type="range"
            min={0}
            max={1000}
            value={Math.round(position * 1000)}
            onChange={onSeek}
            className="absolute inset-0 w-full opacity-0 cursor-pointer"
            aria-label="Seek"
          />
        </div>
        <span className="w-9 tabular-nums">{fmtTime(durationSec)}</span>
      </div>
    </div>
  );
}


function PlayerActions() {
  const queue = usePlayerStore((s) => s.queue);
  const currentIdx = usePlayerStore((s) => s.currentIdx);
  const liked = usePlayerStore((s) => s.currentTrackLiked);
  const pct = usePlayerStore((s) => s.currentTrackPCT);
  const track = queue[currentIdx];

  useEffect(() => {
    if (!track) return;
    fetch(`/api/user/tracks/${track.track_id}/state`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          usePlayerStore.setState({
            currentTrackLiked: data.liked,
            currentTrackPCT: data.pct,
          });
        }
      })
      .catch(() => {});
  }, [track?.track_id]);

  if (!track) return null;

  const onLike = async () => {
    const prev = liked;
    usePlayerStore.setState({ currentTrackLiked: !prev });
    try {
      const r = await fetch(`/api/user/tracks/${track.track_id}/like`, {
        method: "POST",
        credentials: "include",
      });
      if (r.ok) {
        const data = await r.json();
        usePlayerStore.setState({ currentTrackLiked: data.liked });
      }
    } catch {
      usePlayerStore.setState({ currentTrackLiked: prev });
    }
  };

  const onPct = async () => {
    const prev = pct;
    usePlayerStore.setState({ currentTrackPCT: !prev });
    try {
      const r = await fetch(`/api/user/tracks/${track.track_id}/pct`, {
        method: "POST",
        credentials: "include",
      });
      if (r.ok) {
        const data = await r.json();
        usePlayerStore.setState({ currentTrackPCT: data.pct });
      }
    } catch {
      usePlayerStore.setState({ currentTrackPCT: prev });
    }
  };

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={onLike}
        aria-label="좋아요"
        className="bg-transparent border-0 cursor-pointer p-1"
      >
        <Heart
          className="size-3.5"
          strokeWidth={1.6}
          fill={liked ? "var(--mrms-rust)" : "none"}
          stroke={liked ? "var(--mrms-rust)" : "rgba(250,246,238,0.7)"}
        />
      </button>
      <button
        onClick={onPct}
        aria-label="취향저격"
        className="bg-transparent border-0 cursor-pointer p-1"
      >
        <Sparkles
          className="size-3.5"
          strokeWidth={1.6}
          fill={pct ? "var(--mrms-rust)" : "none"}
          stroke={pct ? "var(--mrms-rust)" : "rgba(250,246,238,0.7)"}
        />
      </button>
    </div>
  );
}


function MobilePlayPause() {
  const isPlaying = usePlayerStore((s) => s.isPlaying);
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

  return (
    <button
      onClick={togglePlay}
      disabled={!hasTrack}
      aria-label={isPlaying ? "Pause" : "Play"}
      className="md:hidden bg-[var(--mrms-rust)] text-[var(--mrms-paper)] rounded-full size-10 inline-flex items-center justify-center border-0 cursor-pointer disabled:opacity-40"
    >
      {isPlaying ? (
        <Pause className="size-4 fill-current" />
      ) : (
        <Play className="size-4 fill-current" />
      )}
    </button>
  );
}


function VolumeBlock() {
  const volume = usePlayerStore((s) => s.volume);
  return (
    <div className="flex items-center gap-2">
      <Volume2 className="size-3.5 text-[var(--mrms-paper)]/55" />
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(volume * 100)}
        onChange={async (e) => {
          const v = Number(e.target.value) / 100;
          usePlayerStore.setState({ volume: v });
          await setSdkVolume(v);
        }}
        className="w-16 h-px accent-[var(--mrms-rust)]"
        aria-label="Volume"
      />
      <span className="font-mono text-[10px] tracking-[0.05em] text-[var(--mrms-paper)]/55 tabular-nums">
        {Math.round(volume * 100)}
      </span>
    </div>
  );
}


export function PlayerBar() {
  const errorMsg = usePlayerStore((s) => s.errorMsg);
  const sdkReady = usePlayerStore((s) => s.sdkReady);
  const { user } = useUser();

  const primaryPlatform = user?.primary_platform ?? null;

  useEffect(() => {
    // 미연결 유저(primary=null): initPlayer가 no-op (어떤 SDK도 안 띄움).
    // 구독 연결 시 primary가 바뀌면 effect가 다시 돌며 해당 SDK를 init한다.
    if (!primaryPlatform) return;
    (async () => {
      try {
        await initPlayer(primaryPlatform);
      } catch (e) {
        usePlayerStore.setState({ errorMsg: (e as Error).message });
      }
    })();
  }, [primaryPlatform]);

  return (
    <div className="fixed bottom-0 left-0 md:left-60 right-0 bg-[var(--mrms-ink)] text-[var(--mrms-paper)] px-4 md:px-14 py-2.5 md:py-3 border-t border-[var(--mrms-rust)] z-40">
      {/* error / loading row */}
      {errorMsg && (
        <div className="absolute bottom-full left-0 right-0 px-14 py-2 bg-[var(--mrms-rust)] text-[var(--mrms-paper)] text-xs flex items-center gap-2">
          <span className="flex-1 font-mono tracking-editorial uppercase text-[10px]">
            {errorMsg}
          </span>
          <button
            onClick={() => usePlayerStore.setState({ errorMsg: null })}
            className="underline shrink-0 bg-transparent border-0 cursor-pointer text-[var(--mrms-paper)] font-mono text-[10px] uppercase tracking-editorial"
          >
            close
          </button>
        </div>
      )}
      {!sdkReady && !errorMsg && (
        <div className="absolute bottom-full left-0 right-0 px-14 py-1 bg-[var(--mrms-paper)] text-[var(--mrms-ink)] text-xs font-mono tracking-editorial uppercase">
          plyr · initializing
        </div>
      )}

      <div className="grid grid-cols-[1fr_auto] md:grid-cols-[280px_1fr_240px] gap-3 md:gap-7 items-center">
        <NowPlaying />
        <div className="hidden md:block">
          <Controls />
        </div>
        <div className="flex justify-end items-center gap-2 md:gap-3.5">
          <div className="hidden md:flex">
            <PlayerActions />
          </div>
          <MobilePlayPause />
          <div className="hidden md:flex">
            <VolumeBlock />
          </div>
          <span className="hidden md:flex border-l border-[var(--mrms-paper)]/20 pl-3.5">
            <QueueDrawer />
          </span>
          <span className="md:hidden">
            <QueueDrawer />
          </span>
        </div>
      </div>
    </div>
  );
}
