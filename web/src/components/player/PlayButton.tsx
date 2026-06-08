"use client";

import { Play } from "lucide-react";

import { loadAndPlay } from "@/lib/player";
import { usePlayerStore } from "@/store/player";
import type { QueueTrack } from "@/store/player";
import type { PersonaTrack, RecommendedTrack } from "@/lib/types";


type TrackLike = PersonaTrack | RecommendedTrack;


interface Props {
  tracks: TrackLike[];
  trackIdx: number;
  size?: "sm" | "md";
}


export function PlayButton({ tracks, trackIdx, size = "md" }: Props) {
  const setQueue = usePlayerStore((s) => s.setQueue);
  const sdkReady = usePlayerStore((s) => s.sdkReady);
  const premium = usePlayerStore((s) => s.premium);

  const target = tracks[trackIdx];
  const disabled =
    (!target?.tidal_track_id && !target?.spotify_track_id) ||
    !sdkReady ||
    premium === false;

  // 모바일 44x44 터치 영역 (Apple HIG)
  const sizeClasses = size === "sm"
    ? "h-9 w-9 md:h-8 md:w-8"
    : "h-11 w-11 md:h-9 md:w-9";

  const onClick = async () => {
    if (disabled) return;
    // Tidal 또는 Spotify 가용한 트랙만 큐로 (둘 다 null인 거 제외)
    const queueable: QueueTrack[] = tracks
      .filter((t) => t.tidal_track_id || t.spotify_track_id)
      .map((t) => ({
        track_id: t.track_id,
        tidal_track_id: t.tidal_track_id,
        spotify_track_id: t.spotify_track_id,
        title: t.title,
        artist: t.artist,
        album_title: "album_title" in t ? (t.album_title ?? null) : null,
      }));
    const actualIdx = queueable.findIndex((q) => q.track_id === target.track_id);
    if (actualIdx < 0) return;
    setQueue(queueable, actualIdx);
    try {
      await loadAndPlay(queueable[actualIdx]);
    } catch (e) {
      usePlayerStore.setState({ errorMsg: (e as Error).message });
    }
  };

  return (
    <button
      aria-label={`Play ${target?.title ?? ""}`}
      onClick={onClick}
      disabled={disabled}
      className={`${sizeClasses} inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed touch-manipulation`}
    >
      <Play className="h-4 w-4" />
    </button>
  );
}
