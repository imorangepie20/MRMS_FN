"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Heart, Play, Sparkles } from "lucide-react";

import { AlbumArt } from "@/components/mrms/AlbumArt";
import { SharePlaylistButton } from "@/components/playlist/SharePlaylistButton";
import { loadAndPlay } from "@/lib/player";
import { usePlayerStore } from "@/store/player";
import {
  getPgtSections,
  getPgtLiked,
  getPgtPct,
  getPgtAlbums,
  getPgtAlbumTracks,
  getPgtArtists,
  getPgtArtistTracks,
  getPgtImportedTracks,
  getPlaylistTracks,
} from "@/lib/api";
import type {
  PgtSections,
  PgtTrack,
  PgtAlbumGroup,
  PgtArtistGroup,
  PgtImportedPlaylist,
  UserPlaylistSummary,
} from "@/lib/types";


// ── helpers ─────────────────────────────────────────────────────────────────

function toQueueTrack(t: PgtTrack) {
  return {
    track_id: t.track_id,
    title: t.title,
    artist: t.artist,
    album_title: t.album_title,
    album_cover: t.album_cover,
    tidal_track_id: t.tidal_track_id,
    spotify_track_id: t.spotify_track_id,
    // PgtTrack has no youtube_track_id field — null is fine; player falls through
    youtube_track_id: null as string | null,
  };
}

function durStr(ms: number | null): string {
  if (ms == null) return "—";
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

type Tab = "liked" | "playlists" | "albums" | "artists" | "pct";

const TABS: { id: Tab; label: string }[] = [
  { id: "liked", label: "Liked" },
  { id: "playlists", label: "Playlists" },
  { id: "albums", label: "Albums" },
  { id: "artists", label: "Artists" },
  { id: "pct", label: "PCT" },
];


// ── PgtTrackRow — mirrors MrtDashboard's TrackRow exactly ───────────────────

function PgtTrackRow({ track }: { track: PgtTrack }) {
  const [liked, setLiked] = useState(track.liked);
  const [pct, setPct] = useState(track.pct);

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

  const playOne = async () => {
    const q = [toQueueTrack(track)];
    usePlayerStore.setState({ queue: q, currentIdx: 0, position: 0 });
    try {
      await loadAndPlay(q[0]);
    } catch (e) {
      usePlayerStore.setState({ errorMsg: (e as Error).message });
    }
  };

  return (
    <div className="group grid grid-cols-[48px_1fr_60px] md:grid-cols-[56px_1fr_60px_80px] gap-2 md:gap-3 py-2.5 border-b border-[var(--mrms-rule)] items-center hover:bg-[var(--mrms-paper)] transition-colors">
      <button
        onClick={playOne}
        aria-label="play track"
        className="relative size-14 bg-transparent border-0 p-0 cursor-pointer overflow-hidden block"
      >
        <AlbumArt
          artist={track.artist}
          album={track.album_title}
          initialUrl={track.album_cover}
          className="size-14"
        />
        <span className="absolute inset-0 bg-[var(--mrms-ink)]/55 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
          <Play className="size-5 fill-[var(--mrms-paper)]" stroke="none" />
        </span>
      </button>
      <div className="min-w-0">
        <div
          className="font-display font-semibold text-[15px] leading-tight truncate"
          title={track.title}
        >
          {track.title}
        </div>
        <div
          className="text-xs text-[var(--mrms-ink-soft)] mt-0.5 truncate"
          title={`${track.artist}${track.album_title ? ` — ${track.album_title}` : ""}`}
        >
          {track.artist}
          {track.album_title && (
            <>
              {" — "}
              <cite className="font-display italic">{track.album_title}</cite>
            </>
          )}
        </div>
      </div>
      <span className="hidden md:inline font-mono text-[11px] text-[var(--mrms-ink-mute)] text-right">
        {durStr(track.duration_ms)}
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
      </div>
    </div>
  );
}


// ── Empty state ──────────────────────────────────────────────────────────────

function Empty() {
  return (
    <div className="py-12 text-center font-mono text-[11px] tracking-editorial uppercase text-[var(--mrms-ink-mute)]">
      — no tracks —
    </div>
  );
}


// ── TrackList ────────────────────────────────────────────────────────────────

function TrackList({ tracks, loading }: { tracks: PgtTrack[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="py-12 text-center font-mono text-[11px] tracking-editorial uppercase text-[var(--mrms-ink-mute)]">
        loading…
      </div>
    );
  }
  if (!tracks.length) return <Empty />;
  return (
    <>
      <div className="hidden md:grid grid-cols-[56px_1fr_60px_80px] gap-3 px-0 py-1.5 border-b border-[var(--mrms-ink)] font-mono text-[9px] tracking-editorial uppercase text-[var(--mrms-ink-mute)]">
        <span />
        <span>Title</span>
        <span className="text-right">Time</span>
        <span />
      </div>
      <div className="md:hidden border-b border-[var(--mrms-ink)] py-1.5 font-mono text-[9px] tracking-editorial uppercase text-[var(--mrms-ink-mute)]">
        Tracks
      </div>
      {tracks.map((t) => (
        <PgtTrackRow key={t.track_id} track={t} />
      ))}
    </>
  );
}


// ── SectionHeader — mirrors MrtDashboard ────────────────────────────────────

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
        <span className="font-display font-bold text-[20px]">{title}</span>
      </div>
      {meta && (
        <span className="font-mono text-[11px] text-[var(--mrms-ink-soft)]">{meta}</span>
      )}
    </div>
  );
}


// ── Liked tab ────────────────────────────────────────────────────────────────

function LikedTab({ count }: { count: number }) {
  const [tracks, setTracks] = useState<PgtTrack[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPgtLiked()
      .then((r) => setTracks(r.tracks))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <SectionHeader num="L1" title="Liked tracks" meta={`${count} tracks`} />
      <TrackList tracks={tracks} loading={loading} />
    </div>
  );
}


// ── PCT tab ──────────────────────────────────────────────────────────────────

function PctTab({ count }: { count: number }) {
  const [tracks, setTracks] = useState<PgtTrack[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPgtPct()
      .then((r) => setTracks(r.tracks))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <SectionHeader num="L5" title="PCT — 취향저격" meta={`${count} tracks`} />
      <TrackList tracks={tracks} loading={loading} />
    </div>
  );
}


// ── Albums tab ───────────────────────────────────────────────────────────────

function AlbumsTab({ count }: { count: number }) {
  const [albums, setAlbums] = useState<PgtAlbumGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<PgtAlbumGroup | null>(null);
  const [tracks, setTracks] = useState<PgtTrack[]>([]);
  const [tracksLoading, setTracksLoading] = useState(false);

  useEffect(() => {
    getPgtAlbums()
      .then((r) => setAlbums(r.albums))
      .finally(() => setLoading(false));
  }, []);

  const selectAlbum = async (album: PgtAlbumGroup) => {
    setSelected(album);
    setTracksLoading(true);
    try {
      const r = await getPgtAlbumTracks(album.album_id);
      setTracks(r.tracks);
    } finally {
      setTracksLoading(false);
    }
  };

  return (
    <div>
      <SectionHeader num="L3" title="Albums" meta={`${count} albums`} />
      {loading ? (
        <div className="py-12 text-center font-mono text-[11px] tracking-editorial uppercase text-[var(--mrms-ink-mute)]">
          loading…
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-3 gap-y-4 md:gap-x-3.5 md:gap-y-5 mb-8">
          {albums.map((a) => (
            <button
              key={a.album_id}
              onClick={() => selectAlbum(a)}
              className={`cursor-pointer text-left bg-transparent border-0 p-0 ${
                selected?.album_id === a.album_id ? "opacity-100" : "opacity-80 hover:opacity-100"
              }`}
            >
              <AlbumArt
                artist={a.artist}
                album={a.title}
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
                {a.artist}
              </div>
              <div className="font-mono text-[10px] text-[var(--mrms-ink-mute)] mt-0.5">
                {a.track_count} tracks
              </div>
            </button>
          ))}
          {albums.length === 0 && <Empty />}
        </div>
      )}
      {selected && (
        <div>
          <div className="flex items-baseline gap-3 pb-2 mb-4 border-b border-[var(--mrms-ink)]">
            <button
              onClick={() => { setSelected(null); setTracks([]); }}
              className="bg-transparent border-0 p-0 cursor-pointer font-mono text-[10px] tracking-editorial uppercase text-[var(--mrms-ink-mute)] hover:text-[var(--mrms-rust)]"
            >
              ← back
            </button>
            <span className="font-display font-semibold text-[18px] leading-tight truncate">
              {selected.title}
            </span>
            <span className="font-mono text-[11px] text-[var(--mrms-ink-soft)]">
              {selected.artist}
            </span>
          </div>
          <TrackList tracks={tracks} loading={tracksLoading} />
        </div>
      )}
    </div>
  );
}


// ── Artists tab ───────────────────────────────────────────────────────────────

function ArtistsTab({ count }: { count: number }) {
  const [artists, setArtists] = useState<PgtArtistGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<PgtArtistGroup | null>(null);
  const [tracks, setTracks] = useState<PgtTrack[]>([]);
  const [tracksLoading, setTracksLoading] = useState(false);

  useEffect(() => {
    getPgtArtists()
      .then((r) => setArtists(r.artists))
      .finally(() => setLoading(false));
  }, []);

  const selectArtist = async (artist: PgtArtistGroup) => {
    setSelected(artist);
    setTracksLoading(true);
    try {
      const r = await getPgtArtistTracks(artist.artist_id);
      setTracks(r.tracks);
    } finally {
      setTracksLoading(false);
    }
  };

  return (
    <div>
      <SectionHeader num="L4" title="Artists" meta={`${count} artists`} />
      {loading ? (
        <div className="py-12 text-center font-mono text-[11px] tracking-editorial uppercase text-[var(--mrms-ink-mute)]">
          loading…
        </div>
      ) : (
        <div className="border-y border-[var(--mrms-rule)] mb-8">
          {artists.map((a) => (
            <button
              key={a.artist_id}
              onClick={() => selectArtist(a)}
              className={`w-full text-left bg-transparent border-0 border-b border-[var(--mrms-rule)] last:border-b-0 px-0 py-3 cursor-pointer flex justify-between items-baseline transition-colors hover:bg-[var(--mrms-paper)] ${
                selected?.artist_id === a.artist_id ? "bg-[var(--mrms-paper)]" : ""
              }`}
            >
              <span className="font-display font-semibold text-[15px] text-[var(--mrms-ink)]">
                {a.name}
              </span>
              <span className="font-mono text-[11px] text-[var(--mrms-ink-mute)] shrink-0 ml-3">
                {a.track_count} tracks
              </span>
            </button>
          ))}
          {artists.length === 0 && <Empty />}
        </div>
      )}
      {selected && (
        <div>
          <div className="flex items-baseline gap-3 pb-2 mb-4 border-b border-[var(--mrms-ink)]">
            <button
              onClick={() => { setSelected(null); setTracks([]); }}
              className="bg-transparent border-0 p-0 cursor-pointer font-mono text-[10px] tracking-editorial uppercase text-[var(--mrms-ink-mute)] hover:text-[var(--mrms-rust)]"
            >
              ← back
            </button>
            <span className="font-display font-semibold text-[18px] leading-tight">
              {selected.name}
            </span>
          </div>
          <TrackList tracks={tracks} loading={tracksLoading} />
        </div>
      )}
    </div>
  );
}


// ── Playlists tab ────────────────────────────────────────────────────────────

type PlaylistSelection =
  | { kind: "user"; pl: UserPlaylistSummary }
  | { kind: "imported"; pl: PgtImportedPlaylist };

function PlaylistsTab({
  userPlaylists,
  importedPlaylists,
}: {
  userPlaylists: UserPlaylistSummary[];
  importedPlaylists: PgtImportedPlaylist[];
}) {
  const [selected, setSelected] = useState<PlaylistSelection | null>(null);
  const [tracks, setTracks] = useState<PgtTrack[]>([]);
  const [tracksLoading, setTracksLoading] = useState(false);

  const selectUserPlaylist = async (pl: UserPlaylistSummary) => {
    setSelected({ kind: "user", pl });
    setTracksLoading(true);
    try {
      const r = await getPlaylistTracks(pl.id);
      setTracks(r.tracks);
    } finally {
      setTracksLoading(false);
    }
  };

  const selectImportedPlaylist = async (pl: PgtImportedPlaylist) => {
    setSelected({ kind: "imported", pl });
    setTracksLoading(true);
    try {
      const r = await getPgtImportedTracks(pl.source);
      setTracks(r.tracks);
    } finally {
      setTracksLoading(false);
    }
  };

  return (
    <div>
      <SectionHeader
        num="L2"
        title="Playlists"
        meta={`${userPlaylists.length + importedPlaylists.length} playlists`}
      />

      {/* User-created playlists */}
      {userPlaylists.length > 0 && (
        <div className="mb-8">
          <div className="font-mono text-[10px] tracking-editorial uppercase text-[var(--mrms-ink-mute)] mb-3">
            My playlists · {userPlaylists.length}
          </div>
          <div className="border-y border-[var(--mrms-rule)]">
            {userPlaylists.map((pl) => (
              <button
                key={pl.id}
                onClick={() => selectUserPlaylist(pl)}
                className={`w-full text-left bg-transparent border-0 border-b border-[var(--mrms-rule)] last:border-b-0 px-0 py-3 cursor-pointer flex justify-between items-baseline transition-colors hover:bg-[var(--mrms-paper)] ${
                  selected?.kind === "user" && selected.pl.id === pl.id
                    ? "bg-[var(--mrms-paper)]"
                    : ""
                }`}
              >
                <div className="min-w-0">
                  <div className="font-display font-semibold text-[15px] text-[var(--mrms-ink)] truncate">
                    {pl.name}
                  </div>
                  {pl.description && (
                    <div className="font-mono text-[10px] text-[var(--mrms-ink-mute)] mt-0.5 truncate">
                      {pl.description}
                    </div>
                  )}
                </div>
                <span className="font-mono text-[11px] text-[var(--mrms-ink-mute)] shrink-0 ml-3">
                  {pl.track_count} tracks
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Imported playlists */}
      {importedPlaylists.length > 0 && (
        <div className="mb-8">
          <div className="font-mono text-[10px] tracking-editorial uppercase text-[var(--mrms-ink-mute)] mb-3">
            Imported · {importedPlaylists.length}
          </div>
          <div className="border-y border-[var(--mrms-rule)]">
            {importedPlaylists.map((pl) => (
              <button
                key={pl.source}
                onClick={() => selectImportedPlaylist(pl)}
                className={`w-full text-left bg-transparent border-0 border-b border-[var(--mrms-rule)] last:border-b-0 px-0 py-3 cursor-pointer flex justify-between items-baseline transition-colors hover:bg-[var(--mrms-paper)] ${
                  selected?.kind === "imported" && selected.pl.source === pl.source
                    ? "bg-[var(--mrms-paper)]"
                    : ""
                }`}
              >
                <div className="min-w-0">
                  <div className="font-display font-semibold text-[15px] text-[var(--mrms-ink)] truncate">
                    {pl.name}
                  </div>
                  <div className="font-mono text-[10px] text-[var(--mrms-ink-mute)] mt-0.5">
                    {pl.source}
                  </div>
                </div>
                <span className="font-mono text-[11px] text-[var(--mrms-ink-mute)] shrink-0 ml-3">
                  {pl.track_count} tracks
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {userPlaylists.length === 0 && importedPlaylists.length === 0 && (
        <div className="py-12 text-center font-mono text-[11px] tracking-editorial uppercase text-[var(--mrms-ink-mute)]">
          — no playlists —
        </div>
      )}

      {/* Expanded track list */}
      {selected && (
        <div>
          <div className="flex items-baseline gap-3 pb-2 mb-4 border-b border-[var(--mrms-ink)]">
            <button
              onClick={() => { setSelected(null); setTracks([]); }}
              className="bg-transparent border-0 p-0 cursor-pointer font-mono text-[10px] tracking-editorial uppercase text-[var(--mrms-ink-mute)] hover:text-[var(--mrms-rust)]"
            >
              ← back
            </button>
            <span className="font-display font-semibold text-[18px] leading-tight truncate">
              {selected.pl.name}
            </span>
          </div>
          {selected.kind === "user" && (
            <div className="mb-4">
              <SharePlaylistButton
                key={selected.pl.id}
                playlistId={selected.pl.id}
                initialShareId={selected.pl.share_id ?? null}
              />
            </div>
          )}
          <TrackList tracks={tracks} loading={tracksLoading} />
        </div>
      )}
    </div>
  );
}


// ── StatCell — mirrors MrtDashboard ─────────────────────────────────────────

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


// ── Main PgtLibrary component ────────────────────────────────────────────────

export function PgtLibrary() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const [sections, setSections] = useState<PgtSections | null>(null);
  const [sectionsLoading, setSectionsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>(
    TABS.some((t) => t.id === tabParam) ? (tabParam as Tab) : "liked",
  );

  useEffect(() => {
    getPgtSections()
      .then(setSections)
      .finally(() => setSectionsLoading(false));
  }, []);

  // 사이드바 서브메뉴(/pgt?tab=...) 클릭 시 탭 동기화
  useEffect(() => {
    if (TABS.some((t) => t.id === tabParam)) setActiveTab(tabParam as Tab);
  }, [tabParam]);

  const today = new Date();
  const dateStr = today.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="px-5 pt-6 pb-48 md:px-10 md:pt-10">
      {/* === DATELINE === */}
      <div className="flex justify-between items-baseline border-b border-[var(--mrms-rule)] pb-2 mb-6 font-mono text-[10px] tracking-editorial uppercase text-[var(--mrms-ink-mute)] gap-3">
        <span className="truncate">{dateStr} · Library</span>
        <span className="shrink-0 hidden sm:inline">PGT · Personal Generated Tracks</span>
      </div>

      {/* === HERO === */}
      <div className="flex flex-col gap-6 mb-8 lg:grid lg:grid-cols-[1fr_320px] lg:gap-10 lg:items-start">
        <div>
          <div className="font-mono text-[10px] tracking-editorial uppercase text-[var(--mrms-ink-mute)] mb-2">
            Section 05 / PGT — Personal Generated Tracks
          </div>
          <h1 className="font-display font-bold text-[32px] md:text-[44px] leading-[1.05] tracking-[-0.015em] text-[var(--mrms-ink)] mb-3">
            Your library
          </h1>
          <p className="text-[14px] font-normal text-[var(--mrms-ink-soft)] leading-relaxed max-w-[560px] border-l-2 border-[var(--mrms-rust)] pl-3.5">
            Liked tracks, playlists, albums, and artists from your personal
            collection. Toggle likes and PCT signals directly from each row.
          </p>
        </div>

        {!sectionsLoading && sections && (
          <div className="grid grid-cols-4 lg:grid-cols-2 gap-px bg-[var(--mrms-rule)] border border-[var(--mrms-rule)]">
            <StatCell label="Liked" value={sections.liked} />
            <StatCell label="PCT" value={sections.pct} />
            <StatCell label="Albums" value={sections.albums} />
            <StatCell label="Artists" value={sections.artists} />
          </div>
        )}
      </div>

      {/* === TABS === */}
      <div className="flex gap-0 border-b border-[var(--mrms-ink)] mb-8">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`bg-transparent border-0 border-b-2 px-4 py-2 font-mono text-[11px] tracking-editorial uppercase cursor-pointer transition-colors ${
              activeTab === tab.id
                ? "border-[var(--mrms-rust)] text-[var(--mrms-ink)] -mb-px"
                : "border-transparent text-[var(--mrms-ink-mute)] hover:text-[var(--mrms-ink-soft)]"
            }`}
          >
            {tab.label}
            {sections && tab.id === "liked" && (
              <span className="ml-1.5 text-[var(--mrms-ink-mute)]">{sections.liked}</span>
            )}
            {sections && tab.id === "pct" && (
              <span className="ml-1.5 text-[var(--mrms-ink-mute)]">{sections.pct}</span>
            )}
            {sections && tab.id === "albums" && (
              <span className="ml-1.5 text-[var(--mrms-ink-mute)]">{sections.albums}</span>
            )}
            {sections && tab.id === "artists" && (
              <span className="ml-1.5 text-[var(--mrms-ink-mute)]">{sections.artists}</span>
            )}
            {sections && tab.id === "playlists" && (
              <span className="ml-1.5 text-[var(--mrms-ink-mute)]">
                {(sections.user_playlists?.length ?? 0) +
                  (sections.imported_playlists?.length ?? 0)}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* === TAB PANELS === */}
      {activeTab === "liked" && (
        <LikedTab count={sections?.liked ?? 0} />
      )}
      {activeTab === "pct" && (
        <PctTab count={sections?.pct ?? 0} />
      )}
      {activeTab === "albums" && (
        <AlbumsTab count={sections?.albums ?? 0} />
      )}
      {activeTab === "artists" && (
        <ArtistsTab count={sections?.artists ?? 0} />
      )}
      {activeTab === "playlists" && sections && (
        <PlaylistsTab
          userPlaylists={sections.user_playlists ?? []}
          importedPlaylists={sections.imported_playlists ?? []}
        />
      )}
      {activeTab === "playlists" && !sections && (
        <div className="py-12 text-center font-mono text-[11px] tracking-editorial uppercase text-[var(--mrms-ink-mute)]">
          loading…
        </div>
      )}
    </div>
  );
}
