"use client";

import { useEffect, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ModalTrackList } from "@/components/track/ModalTrackList";
import { TrackModalMasthead } from "@/components/track/TrackModalMasthead";
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
      <DialogContent className="bg-(--mrms-paper) border-(--mrms-ink) sm:max-w-[720px] max-h-[82vh] overflow-hidden flex flex-col">
        <DialogHeader className="pr-8">
          <TrackModalMasthead
            kicker="Playlist"
            title={playlist?.name ?? "—"}
            titleSlot={
              <DialogTitle
                className="font-display font-bold text-(--mrms-ink) text-[22px] md:text-[26px] leading-[1.1] mt-1 truncate"
                title={playlist?.name ?? undefined}
              >
                {playlist?.name ?? "—"}
              </DialogTitle>
            }
            coverFallback={
              <div className="size-full bg-(--mrms-ink) flex items-center justify-center">
                <span className="font-display font-bold text-(--mrms-paper) text-[14px]">
                  MRMS
                </span>
              </div>
            }
            description={playlist?.description}
            tracks={tracks}
          />
        </DialogHeader>
        <div className="overflow-y-auto -mx-6 px-6">
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
