"use client";

import { useEffect, useState } from "react";
import { Play } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { fetchPlaylistTracks, type PlaylistMeta } from "@/lib/api/playlists";
import { loadAndPlay } from "@/lib/player";
import { usePlayerStore } from "@/store/player";
import type { TrackInfo } from "@/lib/types";


interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  playlistId: string | null;
}


function trackToQueue(t: TrackInfo) {
  return {
    track_id: t.track_id,
    title: t.title,
    artist: t.artist,
    album_title: t.album_title ?? null,
    album_cover: t.album_cover ?? null,
    tidal_track_id: t.tidal_track_id,
    spotify_track_id: t.spotify_track_id,
  };
}


export function PlaylistDetailModal({ open, onOpenChange, playlistId }: Props) {
  const [playlist, setPlaylist] = useState<PlaylistMeta | null>(null);
  const [tracks, setTracks] = useState<TrackInfo[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !playlistId) return;
    setLoading(true);
    fetchPlaylistTracks(playlistId)
      .then((d) => {
        setPlaylist(d.playlist);
        setTracks(d.tracks);
      })
      .finally(() => setLoading(false));
  }, [open, playlistId]);

  const playAll = async () => {
    if (!tracks.length) return;
    const queue = tracks.map(trackToQueue);
    usePlayerStore.setState({ queue, currentIdx: 0, position: 0 });
    try {
      await loadAndPlay(queue[0]);
    } catch (e) {
      usePlayerStore.setState({ errorMsg: (e as Error).message });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[var(--mrms-paper)] border-[var(--mrms-ink)] sm:max-w-[640px] max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="font-mono text-[10px] tracking-editorial uppercase text-[var(--mrms-ink-mute)]">
            Playlist
          </div>
          <DialogTitle className="font-display font-bold text-[var(--mrms-ink)] text-[22px] leading-tight">
            {playlist?.name ?? "—"}
          </DialogTitle>
        </DialogHeader>
        <div className="flex gap-4">
          <div className="size-24 bg-[var(--mrms-ink)] flex items-center justify-center shrink-0">
            <span className="font-display font-bold text-[var(--mrms-paper)] text-[14px]">
              MRMS
            </span>
          </div>
          <div className="flex flex-col justify-between min-w-0">
            <div className="min-w-0">
              {playlist?.description && (
                <div className="font-display text-[12px] text-[var(--mrms-ink-soft)] line-clamp-2 mb-1">
                  {playlist.description}
                </div>
              )}
              <div className="font-mono text-[11px] text-[var(--mrms-ink-mute)]">
                {tracks.length} tracks
              </div>
            </div>
            <button
              onClick={playAll}
              disabled={!tracks.length}
              className="px-3 py-1.5 font-mono text-[10px] tracking-editorial uppercase border-0 bg-[var(--mrms-rust)] text-[var(--mrms-paper)] inline-flex items-center gap-1 cursor-pointer disabled:opacity-40 self-start"
            >
              <Play className="size-3 fill-current" />
              Play all
            </button>
          </div>
        </div>
        <div className="overflow-y-auto border-t border-[var(--mrms-rule)] -mx-6 px-6">
          {loading && (
            <div className="py-8 text-center font-mono text-[11px] tracking-editorial uppercase text-[var(--mrms-ink-mute)]">
              Loading…
            </div>
          )}
          {!loading && tracks.map((t, i) => (
            <div
              key={t.track_id}
              className="grid grid-cols-[24px_1fr_60px] gap-3 py-2 border-b border-[var(--mrms-rule)] items-center"
            >
              <span className="font-mono text-[11px] text-[var(--mrms-ink-mute)] text-right">
                {i + 1}
              </span>
              <div className="min-w-0">
                <div className="font-display font-semibold text-[14px] truncate">
                  {t.title}
                </div>
                <div className="text-[11px] text-[var(--mrms-ink-soft)] truncate">
                  {t.artist}
                </div>
              </div>
              <span className="font-mono text-[11px] text-[var(--mrms-ink-mute)] text-right">
                {t.duration_ms ? `${Math.floor(t.duration_ms / 60000)}:${String(Math.floor((t.duration_ms % 60000) / 1000)).padStart(2, "0")}` : "—"}
              </span>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
