"use client";

import { useEffect, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ModalTrackList, PlayAllButton } from "@/components/track/ModalTrackList";
import { fetchPlaylistTracks, type PlaylistMeta } from "@/lib/api/playlists";
import type { TrackInfo } from "@/lib/types";


interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  playlistId: string | null;
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-(--mrms-paper) border-(--mrms-ink) sm:max-w-[640px] max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex justify-between items-start gap-3 pr-8">
            <div className="min-w-0">
              <div className="font-mono text-[10px] tracking-editorial uppercase text-(--mrms-ink-mute)">
                Playlist
              </div>
              <DialogTitle className="font-display font-bold text-(--mrms-ink) text-[22px] leading-tight">
                {playlist?.name ?? "—"}
              </DialogTitle>
            </div>
            <PlayAllButton tracks={tracks} />
          </div>
        </DialogHeader>
        <div className="flex gap-4">
          <div className="size-24 bg-(--mrms-ink) flex items-center justify-center shrink-0">
            <span className="font-display font-bold text-(--mrms-paper) text-[14px]">
              MRMS
            </span>
          </div>
          <div className="min-w-0">
            {playlist?.description && (
              <div className="font-display text-[12px] text-(--mrms-ink-soft) line-clamp-2 mb-1">
                {playlist.description}
              </div>
            )}
            <div className="font-mono text-[11px] text-(--mrms-ink-mute)">
              {tracks.length} tracks
            </div>
          </div>
        </div>
        <div className="overflow-y-auto border-t border-(--mrms-rule) -mx-6 px-6">
          {loading && (
            <div className="py-8 text-center font-mono text-[11px] tracking-editorial uppercase text-(--mrms-ink-mute)">
              Loading…
            </div>
          )}
          {!loading && <ModalTrackList tracks={tracks} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}
