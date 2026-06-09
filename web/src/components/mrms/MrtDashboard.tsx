"use client";

import { useMemo, useState } from "react";
import { Heart, Play, Sparkles } from "lucide-react";

import type { MrtLatestResponse, UserInfo } from "@/lib/types";


interface Props {
  user: UserInfo;
  mrt: MrtLatestResponse;
}


export function MrtDashboard({ user, mrt }: Props) {
  const [personaFilter, setPersonaFilter] = useState<number | null>(null);
  const [selectedTracks, setSelectedTracks] = useState<Set<string>>(new Set());

  const generatedDate = mrt.generated_at ? new Date(mrt.generated_at) : null;
  const generatedLabel = generatedDate
    ? generatedDate.toLocaleDateString("en-US", { month: "long", day: "numeric" })
    : "Not yet generated";

  const filteredTracks = useMemo(
    () =>
      personaFilter === null
        ? mrt.recommended_tracks
        : mrt.recommended_tracks.filter((t) => t.persona_idx === personaFilter),
    [mrt.recommended_tracks, personaFilter],
  );

  const filteredAlbums = useMemo(
    () =>
      personaFilter === null
        ? mrt.recommended_albums
        : mrt.recommended_albums.filter((a) => a.persona_idx === personaFilter),
    [mrt.recommended_albums, personaFilter],
  );

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
    <div className="px-10 pt-10 pb-48">
      {/* === DATELINE === */}
      <div className="flex justify-between items-baseline border-b border-[var(--mrms-rule)] pb-2 mb-6 font-mono text-[10px] tracking-editorial uppercase text-[var(--mrms-ink-mute)]">
        <span>{dateStr} · Edition 06</span>
        <span>Curated by MRMS · v0.7</span>
      </div>

      {/* === HERO — data forward === */}
      <div className="grid grid-cols-[1fr_320px] gap-10 mb-8 items-start">
        <div>
          <div className="font-mono text-[10px] tracking-editorial uppercase text-[var(--mrms-ink-mute)] mb-2">
            Section 01 / MRT — Model Recommendation Tracks
          </div>
          <h1 className="font-display font-bold text-[44px] leading-[1.05] tracking-[-0.015em] text-[var(--mrms-ink)] mb-3">
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

        <div className="grid grid-cols-2 gap-px bg-[var(--mrms-rule)] border border-[var(--mrms-rule)]">
          <StatCell label="Personas" value={user.personas_count} />
          <StatCell label="UserTracks" value={user.user_tracks_count} />
          <StatCell label="Tracks" value={mrt.recommended_tracks.length} />
          <StatCell label="Albums" value={mrt.recommended_albums.length} />
        </div>
      </div>

      {/* === PERSONAS === */}
      <SectionHeader
        num="PT 01"
        title="Three sides of you"
        meta={personaFilter !== null ? "Filtered ↓" : "Tap to filter ↓"}
      />
      <div className="grid grid-cols-3 gap-px bg-[var(--mrms-rule)] border-y border-[var(--mrms-rule)] mb-10">
        {mrt.personas.map((p) => {
          const active = personaFilter === p.persona_idx;
          return (
            <button
              key={p.persona_idx}
              onClick={() =>
                setPersonaFilter(active ? null : p.persona_idx)
              }
              className={`text-left p-5 pb-4 transition-colors cursor-pointer border-0 ${
                active
                  ? "bg-[var(--mrms-ink)] text-[var(--mrms-paper)]"
                  : "bg-[var(--mrms-bg)] hover:bg-[var(--mrms-paper)] text-[var(--mrms-ink)]"
              }`}
            >
              <div
                className={`font-mono text-[10px] tracking-editorial mb-2 ${active ? "text-[var(--mrms-paper)]/70" : "text-[var(--mrms-ink-mute)]"}`}
              >
                P–{String(p.persona_idx + 1).padStart(2, "0")} ·{" "}
                {p.track_count} tracks
              </div>
              <div className="font-display font-semibold text-[18px] leading-[1.2] mb-2.5">
                {p.label ?? `Persona ${p.persona_idx + 1}`}
              </div>
              <div
                className={`font-mono text-[9px] tracking-editorial uppercase flex justify-between ${active ? "text-[var(--mrms-paper)]/70" : "text-[var(--mrms-ink-soft)]"}`}
              >
                <span>{p.track_count} tracks</span>
                <span className={active ? "text-[var(--mrms-rust)]" : ""}>
                  {active ? "selected" : "—"}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* === TRACKS === */}
      <SectionHeader
        num="PT 02"
        title="For your ears, this week"
        meta={`${filteredTracks.length} tracks`}
      />
      <div className="flex justify-between items-baseline font-mono text-[11px] text-[var(--mrms-ink-soft)] mb-1.5">
        <span>
          Multi · select to make a playlist&nbsp;&nbsp;
          {selectedTracks.size > 0 && (
            <span className="text-[var(--mrms-rust)]">
              + {selectedTracks.size} selected
            </span>
          )}
        </span>
        <button
          disabled={selectedTracks.size === 0}
          className="bg-[var(--mrms-rust)] text-[var(--mrms-paper)] border-0 px-3.5 py-1.5 font-mono text-[10px] tracking-editorial uppercase cursor-pointer disabled:bg-[var(--mrms-ink-mute)] disabled:cursor-default"
        >
          + playlist
        </button>
      </div>
      <div className="grid grid-cols-[18px_56px_1fr_64px_80px_60px_120px] gap-3 px-0 py-1.5 border-b border-[var(--mrms-ink)] font-mono text-[9px] tracking-editorial uppercase text-[var(--mrms-ink-mute)]">
        <span />
        <span />
        <span>Title</span>
        <span>P</span>
        <span>Match</span>
        <span className="text-right">Time</span>
        <span />
      </div>

      {filteredTracks.map((t) => (
        <TrackRow
          key={t.track_id}
          track={t}
          checked={selectedTracks.has(t.track_id)}
          onToggle={() => toggle(t.track_id)}
        />
      ))}

      {filteredTracks.length === 0 && (
        <div className="py-12 text-center font-mono text-[11px] tracking-editorial uppercase text-[var(--mrms-ink-mute)]">
          — no tracks —
        </div>
      )}

      {/* === ALBUMS + PLAYLISTS === */}
      <div className="grid grid-cols-2 gap-10 mt-10">
        <div>
          <h3 className="font-display font-bold text-[20px] mb-3 pb-2 border-b border-[var(--mrms-ink)] flex justify-between items-baseline">
            Albums
            <span className="font-mono text-[10px] not-italic tracking-editorial uppercase text-[var(--mrms-ink-mute)]">
              PT 03 / {filteredAlbums.length}
            </span>
          </h3>
          <div className="grid grid-cols-4 gap-x-3.5 gap-y-5">
            {filteredAlbums.map((a) => (
              <div key={a.album_id} className="cursor-pointer">
                <div className="aspect-square bg-[var(--mrms-rule)] mb-2.5 relative">
                  {a.cover_url && (
                    <img
                      src={a.cover_url}
                      alt=""
                      className="size-full object-cover"
                    />
                  )}
                </div>
                <div className="font-display text-[14px] font-semibold leading-tight">
                  {a.title}
                </div>
                <div className="font-mono text-[11px] text-[var(--mrms-ink-soft)] mt-0.5">
                  {a.artist}
                </div>
              </div>
            ))}
          </div>
          {filteredAlbums.length === 0 && (
            <div className="py-8 text-center font-mono text-[11px] tracking-editorial uppercase text-[var(--mrms-ink-mute)]">
              — no albums —
            </div>
          )}
        </div>

        <div>
          <h3 className="font-display font-bold text-[20px] mb-3 pb-2 border-b border-[var(--mrms-ink)] flex justify-between items-baseline">
            Playlists
            <span className="font-mono text-[10px] not-italic tracking-editorial uppercase text-[var(--mrms-ink-mute)]">
              PT 04
            </span>
          </h3>
          <div className="grid grid-cols-4 gap-x-3.5 gap-y-5">
            {/* Recommended playlists are added in Task 6 backend; render placeholder for now */}
            {mrt.personas.map((p, i) => (
              <div key={p.persona_idx} className="cursor-pointer">
                <div className="aspect-square bg-[var(--mrms-ink)] text-[var(--mrms-paper)] p-3 flex flex-col justify-between mb-2">
                  <span className="font-mono text-[10px] tracking-editorial opacity-65">
                    P {String(p.persona_idx + 1).padStart(2, "0")}
                  </span>
                  <span className="font-display font-semibold text-[16px] leading-[1.15]">
                    {p.label ?? `Mix ${i + 1}`}
                  </span>
                </div>
                <div className="font-display text-[14px] font-semibold leading-tight">
                  {p.label ? `${p.label} mix` : `Persona ${p.persona_idx + 1}`}
                </div>
                <div className="font-mono text-[11px] text-[var(--mrms-ink-soft)] mt-0.5">
                  {p.track_count} tracks
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
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
  checked,
  onToggle,
}: {
  track: import("@/lib/types").RecommendedTrack;
  checked: boolean;
  onToggle: () => void;
}) {
  const [liked, setLiked] = useState(false);
  const [pct, setPct] = useState(false);

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

  const dur = track.duration_sec
    ? `${Math.floor(track.duration_sec / 60)}:${String(Math.floor(track.duration_sec % 60)).padStart(2, "0")}`
    : "—";

  return (
    <div className="grid grid-cols-[18px_56px_1fr_64px_80px_60px_120px] gap-3 py-2.5 border-b border-[var(--mrms-rule)] items-center hover:bg-[var(--mrms-paper)] transition-colors">
      <button
        onClick={onToggle}
        className={`size-3.5 border-[1.5px] border-[var(--mrms-ink)] relative cursor-pointer p-0 ${
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
      <div className="size-14 bg-[var(--mrms-rule)] relative">
        {track.album_cover && (
          <img
            src={track.album_cover}
            alt=""
            className="size-full object-cover"
          />
        )}
      </div>
      <div className="min-w-0">
        <div className="font-display font-semibold text-[15px] leading-tight truncate">
          {track.title}
        </div>
        <div className="text-xs text-[var(--mrms-ink-soft)] mt-0.5 truncate">
          {track.artist}
          {track.album_title && (
            <>
              {" — "}
              <span className="font-display">{track.album_title}</span>
            </>
          )}
        </div>
      </div>
      <span className="font-mono text-[10px] tracking-editorial uppercase text-[var(--mrms-ink-mute)]">
        P {String((track.persona_idx ?? 0) + 1).padStart(2, "0")}
      </span>
      <span className="font-mono text-[11px] text-[var(--mrms-ink-soft)]">
        {track.persona_score != null
          ? `${Math.round(track.persona_score * 100)}%`
          : track.score != null
            ? `${Math.round(track.score * 100)}%`
            : ""}
      </span>
      <span className="font-mono text-[11px] text-[var(--mrms-ink-mute)] text-right">
        {dur}
      </span>
      <div className="flex gap-2 justify-end items-center">
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
        <button
          aria-label="재생"
          className="bg-[var(--mrms-ink)] text-[var(--mrms-paper)] rounded-full size-7 inline-flex items-center justify-center border-0 cursor-pointer hover:bg-[var(--mrms-rust)] transition-colors"
        >
          <Play className="size-3 fill-current" />
        </button>
      </div>
    </div>
  );
}
