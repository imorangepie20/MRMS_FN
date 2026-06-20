"use client";

import { useState } from "react";
import { Heart, Play, Sparkles } from "lucide-react";

import { ArtistLink } from "@/components/artist/ArtistLink";
import { AlbumArt } from "@/components/mrms/AlbumArt";
import { AddToPlaylistMenu } from "@/components/playlist/AddToPlaylistMenu";
import { useRequireAuth } from "@/lib/hooks/use-require-auth";
import { loadAndPlay, realYoutubeId } from "@/lib/player";
import { usePlayerStore } from "@/store/player";
import type { QueueTrack } from "@/store/player";


/** Minimal track shape shared by the three track-list modals.
 *  EmpItemTrack / TrackInfo are structurally assignable to this.
 *  `liked` / `pct` arrive from the backend (contract: boolean, default false). */
export interface ModalTrack {
  track_id: string;
  title: string;
  artist: string;
  album_title?: string | null;
  album_cover?: string | null;
  duration_ms?: number | null;
  tidal_track_id: string | null;
  spotify_track_id: string | null;
  youtube_track_id?: string | null;
  liked?: boolean;
  pct?: boolean;
}


function toQueueTrack(t: ModalTrack): QueueTrack {
  return {
    track_id: t.track_id,
    title: t.title,
    artist: t.artist,
    album_title: t.album_title ?? null,
    album_cover: t.album_cover ?? null,
    tidal_track_id: t.tidal_track_id,
    spotify_track_id: t.spotify_track_id,
    // 'yt_' 합성 ID는 재생 불가 — 방어적으로 null 취급
    youtube_track_id: realYoutubeId(t.youtube_track_id),
  };
}


export function formatDuration(ms?: number | null): string {
  if (ms == null) return "—";
  const sec = Math.floor(ms / 1000);
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}


/** 트랙 합산 재생시간 — "47 min" / "2 hr 58 min". duration 없는 트랙뿐이면 null. */
export function formatTotalDuration(tracks: ModalTrack[]): string | null {
  const ms = tracks.reduce((acc, t) => acc + (t.duration_ms ?? 0), 0);
  if (!ms) return null;
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} hr ${min % 60} min`;
}


export function isPlayable(t: ModalTrack): boolean {
  return (
    t.tidal_track_id != null ||
    t.spotify_track_id != null ||
    // 'yt_' 합성 ID는 IFrame에서 invalid video — 방어적으로 null 취급
    realYoutubeId(t.youtube_track_id) != null
  );
}


/** Queue the given tracks and start playback at `startIdx`.
 *  Exported so modal headers can wire a "Play All" button (startIdx 0). */
export async function playTracks(
  tracks: ModalTrack[],
  startIdx = 0,
): Promise<void> {
  if (!tracks.length) return;
  const queue = tracks.map(toQueueTrack);
  usePlayerStore.setState({ queue, currentIdx: startIdx, position: 0 });
  try {
    await loadAndPlay(queue[startIdx]);
  } catch (e) {
    usePlayerStore.setState({ errorMsg: (e as Error).message });
  }
}


/** "Play All" button for modal headers — queues every track, plays the first.
 *  비회원이면 재생 대신 /login으로 유도. */
export function PlayAllButton({ tracks }: { tracks: ModalTrack[] }) {
  const { guard } = useRequireAuth();
  return (
    <button
      onClick={guard(() => playTracks(tracks, 0))}
      disabled={!tracks.length}
      className="shrink-0 px-3 py-1.5 font-mono text-[10px] tracking-editorial uppercase border-0 bg-(--mrms-rust) text-(--mrms-paper) inline-flex items-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-default"
    >
      <Play className="size-3 fill-current" />
      Play All
    </button>
  );
}


/** Shared track list for ItemTracksModal / AlbumDetailModal / PlaylistDetailModal.
 *  Columns: title, artist, album, duration, like (heart), pct (sparkles).
 *  Hovering a row swaps the row number for a play button. */
export function ModalTrackList({
  tracks,
  showCover = false,
}: {
  tracks: ModalTrack[];
  /** 타이틀 옆에 앨범 커버 썸네일 표시 (공유 페이지 등에서 opt-in). */
  showCover?: boolean;
}) {
  if (!tracks.length) return null;
  return (
    <div>
      <div className="grid grid-cols-[28px_minmax(0,1fr)_44px_80px] sm:grid-cols-[28px_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_44px_80px] gap-2 sm:gap-3 py-1.5 border-b border-(--mrms-ink) font-mono text-[9px] tracking-editorial uppercase text-(--mrms-ink-mute) items-center">
        <span className="text-right">#</span>
        <span>Title</span>
        <span className="hidden sm:block">Artist</span>
        <span className="hidden sm:block">Album</span>
        <span className="text-right">Time</span>
        <span />
      </div>
      {tracks.map((t, i) => (
        <ModalTrackRow
          key={t.track_id}
          track={t}
          index={i}
          showCover={showCover}
          onPlay={() => playTracks(tracks, i)}
        />
      ))}
    </div>
  );
}


function ModalTrackRow({
  track,
  index,
  onPlay,
  showCover = false,
}: {
  track: ModalTrack;
  index: number;
  onPlay: () => void;
  showCover?: boolean;
}) {
  const [liked, setLiked] = useState(track.liked ?? false);
  const [pct, setPct] = useState(track.pct ?? false);
  const playable = isPlayable(track);
  const { isGuest, guard } = useRequireAuth();
  // 큐의 현재 재생 트랙이면 하이라이트 + 이퀄라이저 (QueueDrawer와 동일 표시).
  // 가드: 재생 곡이 실제로 있을 때만 — 큐가 비면 양쪽 undefined로 전 행이 매칭돼
  // 번호가 다 사라지는 버그 방지.
  const currentTrackId = usePlayerStore((s) => s.queue[s.currentIdx]?.track_id ?? null);
  const isCurrent = currentTrackId !== null && currentTrackId === track.track_id;
  const playing = usePlayerStore((s) => s.isPlaying);

  const onLike = async () => {
    const prev = liked;
    setLiked(!prev);
    try {
      const r = await fetch(`/api/user/tracks/${track.track_id}/like`, {
        method: "POST",
        credentials: "include",
      });
      if (r.ok) setLiked((await r.json()).liked);
    } catch {
      setLiked(prev);
    }
  };

  const onPct = async () => {
    const prev = pct;
    setPct(!prev);
    try {
      const r = await fetch(`/api/user/tracks/${track.track_id}/pct`, {
        method: "POST",
        credentials: "include",
      });
      if (r.ok) setPct((await r.json()).pct);
    } catch {
      setPct(prev);
    }
  };

  return (
    <div
      data-track-id={track.track_id}
      aria-current={isCurrent ? "true" : undefined}
      className={`group grid grid-cols-[28px_minmax(0,1fr)_44px_80px] sm:grid-cols-[28px_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_44px_80px] gap-2 sm:gap-3 py-2 border-b border-(--mrms-rule) items-center transition-colors ${
        isCurrent ? "bg-(--mrms-rust)/[0.07]" : "hover:bg-(--mrms-bg)"
      }`}
    >
      <div className="relative h-7 flex items-center justify-end">
        {isCurrent ? (
          <span
            className="flex items-end justify-end gap-[2px] h-3.5 group-hover:opacity-0"
            aria-label={playing ? "재생 중" : "일시정지"}
          >
            {[0, 1, 2].map((b) => (
              <span
                key={b}
                className={`w-[2px] bg-(--mrms-rust) ${playing ? "mrms-eq-bar" : ""}`}
                style={
                  playing
                    ? { height: "100%", animationDelay: `${b * 0.18}s` }
                    : { height: ["45%", "70%", "55%"][b] }
                }
              />
            ))}
          </span>
        ) : (
          <span className="font-mono text-[11px] text-(--mrms-ink-mute) group-hover:opacity-0">
            {index + 1}
          </span>
        )}
        <button
          onClick={playable ? guard(onPlay) : undefined}
          disabled={!playable}
          aria-label={playable ? "play track" : "재생 불가"}
          title={playable ? undefined : "재생할 수 없는 트랙"}
          className="absolute inset-0 items-center justify-end bg-transparent border-0 p-0 hidden group-hover:flex cursor-pointer disabled:cursor-default"
        >
          <Play
            className={`size-3.5 ${
              playable
                ? "fill-(--mrms-ink) text-(--mrms-ink)"
                : "fill-(--mrms-ink-mute) text-(--mrms-ink-mute) opacity-40"
            }`}
            stroke="none"
          />
        </button>
      </div>
      <div className="min-w-0 flex items-center gap-2.5">
        {showCover && (
          <AlbumArt
            artist={track.artist}
            album={track.album_title ?? null}
            initialUrl={track.album_cover ?? null}
            className="size-9 shrink-0 rounded-[2px]"
          />
        )}
        <div className="min-w-0 flex-1">
          <div
            className={`font-display font-semibold text-[14px] leading-tight truncate ${
              isCurrent ? "text-(--mrms-rust)" : ""
            }`}
            title={track.title}
          >
            {track.title}
          </div>
          <div
            className="sm:hidden text-[11px] text-(--mrms-ink-soft) truncate mt-0.5"
            title={`${track.artist}${track.album_title ? ` — ${track.album_title}` : ""}`}
          >
            <ArtistLink name={track.artist} />
            {track.album_title ? ` — ${track.album_title}` : ""}
          </div>
        </div>
      </div>
      <div
        className="hidden sm:block min-w-0 text-[12px] text-(--mrms-ink-soft) truncate"
        title={track.artist}
      >
        <ArtistLink name={track.artist} />
      </div>
      <div
        className="hidden sm:block min-w-0 font-display italic text-[12px] text-(--mrms-ink-soft) truncate"
        title={track.album_title ?? undefined}
      >
        {track.album_title ?? "—"}
      </div>
      <span className="font-mono text-[11px] text-(--mrms-ink-mute) text-right">
        {formatDuration(track.duration_ms)}
      </span>
      <div className="flex gap-1.5 justify-end items-center">
        {/* 좋아요·취향저격·저장 — 계정 필요. 비회원에겐 숨김. */}
        {!isGuest && (
          <>
            <button
              onClick={onLike}
              aria-label="좋아요"
              className="bg-transparent border-0 cursor-pointer p-1"
            >
              <Heart
                className="size-3.5"
                strokeWidth={1.6}
                fill={liked ? "var(--mrms-rust)" : "none"}
                stroke={liked ? "var(--mrms-rust)" : "var(--mrms-ink-mute)"}
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
                stroke={pct ? "var(--mrms-rust)" : "var(--mrms-ink-mute)"}
              />
            </button>
            <AddToPlaylistMenu trackId={track.track_id} />
          </>
        )}
      </div>
    </div>
  );
}
