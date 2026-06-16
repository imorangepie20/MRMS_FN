"use client";

import { useMemo, useState } from "react";
import { EyeOff, Heart, Play, Sparkles, ThumbsDown } from "lucide-react";

import { collectAlbum, dislikeAlbum, dislikeTrack, dismissAlbum, dismissTrack } from "@/lib/api";

import { AlbumDetailModal } from "@/components/album/AlbumDetailModal";
import { ArtistLink } from "@/components/artist/ArtistLink";
import { AlbumArt } from "@/components/mrms/AlbumArt";
import { CreatePlaylistModal } from "@/components/playlist/CreatePlaylistModal";
import { PlaylistDetailModal } from "@/components/playlist/PlaylistDetailModal";
import { loadAndPlay, realYoutubeId } from "@/lib/player";
import { usePlayerStore } from "@/store/player";
import type { MrtLatestResponse, RecommendedTrack, UserInfo } from "@/lib/types";


function toQueueTrack(t: RecommendedTrack) {
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


interface Props {
  user: UserInfo;
  mrt: MrtLatestResponse;
}


export function MrtDashboard({ user, mrt }: Props) {
  const [selectedTracks, setSelectedTracks] = useState<Set<string>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);
  const [albumModal, setAlbumModal] = useState<string | null>(null);
  const [playlistModal, setPlaylistModal] = useState<string | null>(null);
  const [collectingAlbum, setCollectingAlbum] = useState<string | null>(null);
  const [dislikingAlbum, setDislikingAlbum] = useState<string | null>(null);
  const [dismissingAlbum, setDismissingAlbum] = useState<string | null>(null);
  const [removedAlbums, setRemovedAlbums] = useState<Record<string, "collected" | "disliked" | "dismissed">>({});

  const generatedDate = mrt.generated_at ? new Date(mrt.generated_at) : null;
  const generatedLabel = generatedDate
    ? generatedDate.toLocaleDateString("en-US", { month: "long", day: "numeric" })
    : "Not yet generated";

  // 페르소나는 정보 표시 전용 — 필터 X. persona_idx로 트랙 행에서 표시.
  const personaLabelByIdx = useMemo(() => {
    const map = new Map<number, string>();
    mrt.personas.forEach((p) => {
      map.set(p.persona_idx, p.label ?? `Persona ${p.persona_idx + 1}`);
    });
    return map;
  }, [mrt.personas]);

  const toggle = (trackId: string) => {
    setSelectedTracks((prev) => {
      const next = new Set(prev);
      if (next.has(trackId)) next.delete(trackId);
      else next.add(trackId);
      return next;
    });
  };

  const today = new Date();
  const dateStr = today.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  return (
    <div className="px-5 pt-6 pb-48 md:px-10 md:pt-10">
      {/* === DATELINE === */}
      <div className="flex justify-between items-baseline border-b border-[var(--mrms-rule)] pb-2 mb-6 font-mono text-[10px] tracking-editorial uppercase text-[var(--mrms-ink-mute)] gap-3">
        <span className="truncate">{dateStr} · Edition 06</span>
        <span className="shrink-0 hidden sm:inline">Curated by MRMS · v0.7</span>
      </div>

      {/* === HERO — data forward === */}
      <div className="flex flex-col gap-6 mb-8 lg:grid lg:grid-cols-[1fr_320px] lg:gap-10 lg:items-start">
        <div>
          <div className="font-mono text-[10px] tracking-editorial uppercase text-[var(--mrms-ink-mute)] mb-2">
            Section 01 / MRT — Model Recommendation Tracks
          </div>
          <h1 className="font-display font-bold text-[32px] md:text-[44px] leading-[1.05] tracking-[-0.015em] text-[var(--mrms-ink)] mb-3">
            {generatedLabel} curation
          </h1>
          <p className="text-[14px] font-normal text-[var(--mrms-ink-soft)] leading-relaxed max-w-[560px] border-l-2 border-[var(--mrms-rust)] pl-3.5">
            {mrt.personas.length} personas, learned at signup and refined over time,
            inform this week's picks: {mrt.recommended_tracks.length} tracks,
            {" "}{mrt.recommended_albums.length} albums,
            {" "}{mrt.recommended_playlists?.length ?? mrt.personas.length} playlists.
            Tap a persona below to filter. Multi-select tracks to save them as a
            new playlist.
          </p>
        </div>

        <div className="grid grid-cols-4 lg:grid-cols-2 gap-px bg-[var(--mrms-rule)] border border-[var(--mrms-rule)]">
          <StatCell label="Personas" value={user.personas_count} />
          <StatCell label="UserTracks" value={user.user_tracks_count} />
          <StatCell label="Tracks" value={mrt.recommended_tracks.length} />
          <StatCell label="Albums" value={mrt.recommended_albums.length} />
        </div>
      </div>

      {/* === PERSONAS === */}
      <SectionHeader
        num="PT 01"
        title="Your personas"
        meta={`${mrt.personas.length} clusters`}
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-[var(--mrms-rule)] border-y border-[var(--mrms-rule)] mb-10">
        {mrt.personas.map((p) => (
          <div
            key={p.persona_idx}
            className="bg-[var(--mrms-bg)] p-4 sm:p-5 pb-4 text-[var(--mrms-ink)]"
          >
            <div className="font-mono text-[10px] tracking-editorial mb-2 text-[var(--mrms-ink-mute)]">
              P–{String(p.persona_idx + 1).padStart(2, "0")} · {p.track_count} tracks
            </div>
            <div className="font-display font-semibold text-[18px] leading-[1.2]">
              {p.label ?? `Persona ${p.persona_idx + 1}`}
            </div>
          </div>
        ))}
      </div>

      {/* === TRACKS === */}
      <SectionHeader
        num="PT 02"
        title="For your ears, this week"
        meta={`${mrt.recommended_tracks.length} tracks`}
      />
      <div className="flex justify-between items-baseline font-mono text-[11px] text-[var(--mrms-ink-soft)] mb-1.5 gap-2 flex-wrap">
        <span>
          Multi · select to make a playlist&nbsp;&nbsp;
          {selectedTracks.size > 0 && (
            <span className="text-[var(--mrms-rust)]">
              + {selectedTracks.size} selected
            </span>
          )}
        </span>
        <div className="flex gap-2">
          <button
            disabled={mrt.recommended_tracks.length === 0}
            onClick={async () => {
              if (!mrt.recommended_tracks.length) return;
              const queue = mrt.recommended_tracks.map(toQueueTrack);
              usePlayerStore.setState({ queue, currentIdx: 0, position: 0 });
              try {
                await loadAndPlay(queue[0]);
              } catch (e) {
                usePlayerStore.setState({ errorMsg: (e as Error).message });
              }
            }}
            className="bg-[var(--mrms-ink)] text-[var(--mrms-paper)] border-0 px-3.5 py-1.5 font-mono text-[10px] tracking-editorial uppercase cursor-pointer disabled:bg-[var(--mrms-ink-mute)] disabled:cursor-default inline-flex items-center gap-1.5"
          >
            <Play className="size-3 fill-current" />
            Play all
          </button>
          <button
            disabled={selectedTracks.size === 0}
            onClick={() => setCreateOpen(true)}
            className="bg-[var(--mrms-rust)] text-[var(--mrms-paper)] border-0 px-3.5 py-1.5 font-mono text-[10px] tracking-editorial uppercase cursor-pointer disabled:bg-[var(--mrms-ink-mute)] disabled:cursor-default"
          >
            + playlist
          </button>
        </div>
      </div>
      <div className="hidden md:grid grid-cols-[18px_56px_1fr_140px_80px_60px_120px] gap-3 px-0 py-1.5 border-b border-[var(--mrms-ink)] font-mono text-[9px] tracking-editorial uppercase text-[var(--mrms-ink-mute)]">
        <span />
        <span />
        <span>Title</span>
        <span>Persona</span>
        <span>Match</span>
        <span className="text-right">Time</span>
        <span />
      </div>
      <div className="md:hidden border-b border-[var(--mrms-ink)] py-1.5 font-mono text-[9px] tracking-editorial uppercase text-[var(--mrms-ink-mute)]">
        Tracks
      </div>

      {mrt.recommended_tracks.map((t) => (
        <TrackRow
          key={t.track_id}
          track={t}
          personaLabel={
            t.persona_idx != null
              ? personaLabelByIdx.get(t.persona_idx) ?? null
              : null
          }
          checked={selectedTracks.has(t.track_id)}
          onToggle={() => toggle(t.track_id)}
        />
      ))}

      {mrt.recommended_tracks.length === 0 && (
        <div className="py-12 text-center font-mono text-[11px] tracking-editorial uppercase text-[var(--mrms-ink-mute)]">
          — no tracks —
        </div>
      )}

      {/* === ALBUMS === */}
      <div className="mt-10">
        <div>
          <h3 className="font-display font-bold text-[20px] mb-3 pb-2 border-b border-[var(--mrms-ink)] flex justify-between items-baseline">
            Albums
            <span className="font-mono text-[10px] tracking-editorial uppercase text-[var(--mrms-ink-mute)]">
              PT 03 / {mrt.recommended_albums.length}
            </span>
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-3 gap-y-4 md:gap-x-3.5 md:gap-y-5">
            {mrt.recommended_albums.map((a) => (
              <div key={a.album_id} className={`text-left ${removedAlbums[a.album_id] ? "opacity-45 pointer-events-none" : ""}`}>
                <button
                  onClick={() => setAlbumModal(a.album_id)}
                  className="cursor-pointer text-left bg-transparent border-0 p-0 w-full"
                >
                  <AlbumArt
                    artist={a.artist}
                    album={a.title}
                    initialUrl={a.cover_url ?? null}
                    className="aspect-square mb-2.5"
                  />
                  <div
                    className="font-display text-[14px] font-semibold leading-tight truncate"
                    title={a.title}
                  >
                    {a.title}
                  </div>
                  <div
                    className="font-mono text-[11px] text-[var(--mrms-ink-soft)] mt-0.5 truncate"
                    title={a.artist}
                  >
                    <ArtistLink name={a.artist} as="span" />
                  </div>
                </button>
                {removedAlbums[a.album_id] ? (
                  <div className="mt-1.5 font-mono text-[9px] tracking-editorial uppercase text-(--mrms-ink-mute)">
                    {removedAlbums[a.album_id] === "collected"
                      ? "담음"
                      : removedAlbums[a.album_id] === "disliked"
                        ? "싫어요 · 제외"
                        : "관심없어요 · 숨김"}
                  </div>
                ) : (
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <button
                      disabled={collectingAlbum === a.album_id}
                      onClick={async () => {
                        setCollectingAlbum(a.album_id);
                        try {
                          await collectAlbum(a.album_id);
                          setRemovedAlbums((m) => ({ ...m, [a.album_id]: "collected" }));
                          setCollectingAlbum(null);
                        } catch {
                          setCollectingAlbum(null);
                        }
                      }}
                      title="담기 · 앨범을 라이브러리에 담기"
                      className="bg-transparent border border-[var(--mrms-ink-mute)] px-2 py-0.5 font-mono text-[9px] tracking-editorial uppercase text-[var(--mrms-ink-soft)] cursor-pointer disabled:opacity-40 disabled:cursor-default hover:border-[var(--mrms-ink)] hover:text-[var(--mrms-ink)] transition-colors"
                    >
                      {collectingAlbum === a.album_id ? "…" : "담기"}
                    </button>
                    <button
                      disabled={dislikingAlbum === a.album_id}
                      onClick={async () => {
                        setDislikingAlbum(a.album_id);
                        try {
                          await dislikeAlbum(a.album_id);
                          setRemovedAlbums((m) => ({ ...m, [a.album_id]: "disliked" }));
                          setDislikingAlbum(null);
                        } catch {
                          setDislikingAlbum(null);
                        }
                      }}
                      aria-label="싫어요"
                      title="싫어요 · 앨범 추천에서 영구 제외"
                      className="bg-transparent border-0 cursor-pointer p-1 disabled:opacity-40 disabled:cursor-default"
                    >
                      <ThumbsDown
                        className="size-3.5"
                        strokeWidth={1.6}
                        stroke="var(--mrms-ink-mute)"
                      />
                    </button>
                    <button
                      disabled={dismissingAlbum === a.album_id}
                      onClick={async () => {
                        setDismissingAlbum(a.album_id);
                        try {
                          await dismissAlbum(a.album_id);
                          setRemovedAlbums((m) => ({ ...m, [a.album_id]: "dismissed" }));
                          setDismissingAlbum(null);
                        } catch {
                          setDismissingAlbum(null);
                        }
                      }}
                      aria-label="관심없어요"
                      title="관심없어요 · 이번 추천에서 숨기기"
                      className="bg-transparent border-0 cursor-pointer p-1 disabled:opacity-40 disabled:cursor-default"
                    >
                      <EyeOff
                        className="size-3.5"
                        strokeWidth={1.6}
                        stroke="var(--mrms-ink-mute)"
                      />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
          {mrt.recommended_albums.length === 0 && (
            <div className="py-8 text-center font-mono text-[11px] tracking-editorial uppercase text-[var(--mrms-ink-mute)]">
              — no albums —
            </div>
          )}
        </div>

      </div>

      {/* === NEW RELEASES (취향 맞춤 신보) === */}
      <div className="mt-10">
        <SectionHeader
          num="PT 04"
          title="New releases, for you"
          meta={`${mrt.recommended_new_releases?.length ?? 0} tracks`}
        />
        <div className="hidden md:grid grid-cols-[18px_56px_1fr_140px_80px_60px_120px] gap-3 px-0 py-1.5 border-b border-[var(--mrms-ink)] font-mono text-[9px] tracking-editorial uppercase text-[var(--mrms-ink-mute)]">
          <span />
          <span />
          <span>Title</span>
          <span>Persona</span>
          <span>Match</span>
          <span className="text-right">Time</span>
          <span />
        </div>
        <div className="md:hidden border-b border-[var(--mrms-ink)] py-1.5 font-mono text-[9px] tracking-editorial uppercase text-[var(--mrms-ink-mute)]">
          New
        </div>

        {(mrt.recommended_new_releases ?? []).map((t) => (
          <TrackRow
            key={t.track_id}
            track={t}
            personaLabel={
              t.persona_idx != null
                ? personaLabelByIdx.get(t.persona_idx) ?? null
                : null
            }
            checked={selectedTracks.has(t.track_id)}
            onToggle={() => toggle(t.track_id)}
          />
        ))}

        {(mrt.recommended_new_releases?.length ?? 0) === 0 && (
          <div className="py-12 text-center font-mono text-[11px] tracking-editorial uppercase text-[var(--mrms-ink-mute)]">
            — no new releases —
          </div>
        )}
      </div>

      <CreatePlaylistModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        trackIds={Array.from(selectedTracks)}
        onCreated={() => {
          setSelectedTracks(new Set());
          window.location.reload();
        }}
      />
      <AlbumDetailModal
        open={albumModal !== null}
        onOpenChange={(v) => !v && setAlbumModal(null)}
        albumId={albumModal}
      />
      <PlaylistDetailModal
        open={playlistModal !== null}
        onOpenChange={(v) => !v && setPlaylistModal(null)}
        playlistId={playlistModal}
      />
    </div>
  );
}


function StatCell({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-[var(--mrms-bg)] px-3 py-2.5">
      <div className="font-mono text-[8.5px] tracking-editorial uppercase text-[var(--mrms-ink-mute)]">
        {label}
      </div>
      <div className="font-display font-medium text-[28px] leading-none mt-1 text-[var(--mrms-ink)]">
        {value}
      </div>
    </div>
  );
}


function SectionHeader({
  num,
  title,
  meta,
}: {
  num: string;
  title: string;
  meta?: string;
}) {
  return (
    <div className="flex justify-between items-baseline pb-2.5 border-b border-[var(--mrms-ink)] mb-6">
      <div>
        <span className="font-mono text-[10px] tracking-editorial uppercase text-[var(--mrms-ink-mute)]">
          {num}
        </span>
        &nbsp;&nbsp;
        <span className="font-display font-bold text-[20px]">
          {title}
        </span>
      </div>
      {meta && (
        <span className="font-mono text-[11px] text-[var(--mrms-ink-soft)]">
          {meta}
        </span>
      )}
    </div>
  );
}


function TrackRow({
  track,
  personaLabel,
  checked,
  onToggle,
}: {
  track: import("@/lib/types").RecommendedTrack;
  personaLabel: string | null;
  checked: boolean;
  onToggle: () => void;
}) {
  const [liked, setLiked] = useState(track.liked ?? false);
  const [pct, setPct] = useState(track.pct ?? false);
  const [removed, setRemoved] = useState<null | "disliked" | "dismissed">(null);

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

  const durMs = (track as { duration_ms?: number | null }).duration_ms ?? null;
  const durSec = durMs != null ? Math.floor(durMs / 1000) : null;
  const dur = durSec != null
    ? `${Math.floor(durSec / 60)}:${String(durSec % 60).padStart(2, "0")}`
    : "—";

  const playOne = async () => {
    const queue = [
      {
        track_id: track.track_id,
        title: track.title,
        artist: track.artist,
        album_title: track.album_title ?? null,
        album_cover: track.album_cover ?? null,
        tidal_track_id: track.tidal_track_id,
        spotify_track_id: track.spotify_track_id,
        youtube_track_id: realYoutubeId(track.youtube_track_id),
      },
    ];
    usePlayerStore.setState({ queue, currentIdx: 0, position: 0 });
    try {
      await loadAndPlay(queue[0]);
    } catch (e) {
      usePlayerStore.setState({ errorMsg: (e as Error).message });
    }
  };

  return (
    <div className={`group grid grid-cols-[18px_48px_1fr_auto] md:grid-cols-[18px_56px_1fr_140px_80px_60px_120px] gap-2 md:gap-3 py-2.5 border-b border-[var(--mrms-rule)] items-center transition-colors ${removed ? "opacity-45" : "hover:bg-[var(--mrms-paper)]"}`}>
      <button
        onClick={onToggle}
        disabled={!!removed}
        className={`size-3.5 border-[1.5px] border-[var(--mrms-ink)] relative cursor-pointer p-0 disabled:cursor-default ${
          checked ? "bg-[var(--mrms-ink)]" : "bg-[var(--mrms-bg)]"
        }`}
        aria-label="select"
      >
        {checked && (
          <span className="absolute inset-0 text-[var(--mrms-bg)] text-[11px] flex items-center justify-center font-display">
            ✓
          </span>
        )}
      </button>
      <button
        onClick={playOne}
        disabled={!!removed}
        aria-label="play track"
        className="relative size-14 bg-transparent border-0 p-0 cursor-pointer disabled:cursor-default overflow-hidden block"
      >
        <AlbumArt
          artist={track.artist}
          album={track.album_title ?? null}
          initialUrl={track.album_cover ?? null}
          className="size-14"
        />
        {!removed && (
          <span className="absolute inset-0 bg-[var(--mrms-ink)]/55 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
            <Play
              className="size-5 fill-[var(--mrms-paper)]"
              stroke="none"
            />
          </span>
        )}
      </button>
      <div className="min-w-0">
        <div
          className={`font-display font-semibold text-[15px] leading-tight truncate ${removed ? "line-through text-(--mrms-ink-mute)" : ""}`}
          title={track.title}
        >
          {track.title}
        </div>
        <div
          className="text-xs text-[var(--mrms-ink-soft)] mt-0.5 truncate"
          title={`${track.artist}${track.album_title ? ` — ${track.album_title}` : ""}`}
        >
          <ArtistLink name={track.artist} />
          {track.album_title && (
            <>
              {" — "}
              <cite className="font-display italic">{track.album_title}</cite>
            </>
          )}
          {personaLabel && (
            <span className="md:hidden text-[var(--mrms-ink-mute)] ml-1.5 font-mono text-[10px] tracking-editorial">
              · {personaLabel}
            </span>
          )}
        </div>
      </div>
      <div className="hidden md:block min-w-0">
        <div className="font-mono text-[9px] tracking-editorial uppercase text-[var(--mrms-ink-mute)] leading-none">
          P {String((track.persona_idx ?? 0) + 1).padStart(2, "0")}
        </div>
        {personaLabel && (
          <div className="font-display text-[12px] font-medium text-[var(--mrms-ink-soft)] truncate mt-0.5">
            {personaLabel}
          </div>
        )}
      </div>
      <span className="hidden md:inline font-mono text-[11px] text-[var(--mrms-ink-soft)]">
        {track.persona_score != null
          ? `${Math.round(track.persona_score * 100)}%`
          : track.score != null
            ? `${Math.round(track.score * 100)}%`
            : ""}
      </span>
      <span className="hidden md:inline font-mono text-[11px] text-[var(--mrms-ink-mute)] text-right">
        {dur}
      </span>
      {removed ? (
        <div className="flex justify-end items-center font-mono text-[10px] tracking-editorial uppercase text-(--mrms-ink-mute)">
          {removed === "disliked" ? "싫어요 · 제외" : "관심없어요 · 숨김"}
        </div>
      ) : (
        <div className="flex gap-2 justify-end items-center">
          <button
            onClick={onLike}
            aria-label="좋아요"
            title="좋아요 · 라이브러리에 담기"
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
            title="취향저격 · 핵심 취향(PCT)에 추가"
            className="bg-transparent border-0 cursor-pointer p-1"
          >
            <Sparkles
              className="size-3.5"
              strokeWidth={1.6}
              fill={pct ? "var(--mrms-rust)" : "none"}
              stroke={pct ? "var(--mrms-rust)" : "var(--mrms-ink-mute)"}
            />
          </button>
          <button
            onClick={async () => {
              try {
                await dislikeTrack(track.track_id);
                setRemoved("disliked");
              } catch {
                // silent — row stays visible on error
              }
            }}
            aria-label="싫어요"
            title="싫어요 · 추천에서 영구 제외"
            className="bg-transparent border-0 cursor-pointer p-1"
          >
            <ThumbsDown
              className="size-3.5"
              strokeWidth={1.6}
              stroke="var(--mrms-ink-mute)"
            />
          </button>
          <button
            onClick={async () => {
              try {
                await dismissTrack(track.track_id);
                setRemoved("dismissed");
              } catch {
                // silent — row stays visible on error
              }
            }}
            aria-label="관심없어요"
            title="관심없어요 · 이번 추천에서 숨기기"
            className="bg-transparent border-0 cursor-pointer p-1"
          >
            <EyeOff
              className="size-3.5"
              strokeWidth={1.6}
              stroke="var(--mrms-ink-mute)"
            />
          </button>
        </div>
      )}
    </div>
  );
}
