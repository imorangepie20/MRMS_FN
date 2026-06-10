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
import { fetchAlbumTracks } from "@/lib/api/playlists";
import type { TrackInfo } from "@/lib/types";


interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  albumId: string | null;
}


export function AlbumDetailModal({ open, onOpenChange, albumId }: Props) {
  const [album, setAlbum] = useState<{ id: string; title: string; cover_url: string | null } | null>(null);
  const [tracks, setTracks] = useState<TrackInfo[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !albumId) return;
    setLoading(true);
    fetchAlbumTracks(albumId)
      .then((d) => {
        setAlbum(d.album);
        setTracks(d.tracks);
      })
      .finally(() => setLoading(false));
  }, [open, albumId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-(--mrms-paper) border-(--mrms-ink) sm:max-w-[720px] max-h-[82vh] overflow-hidden flex flex-col">
        <DialogHeader className="pr-8">
          <TrackModalMasthead
            kicker="Album"
            title={album?.title ?? "—"}
            titleSlot={
              <DialogTitle
                className="font-display font-bold text-(--mrms-ink) text-[22px] md:text-[26px] leading-[1.1] mt-1 truncate"
                title={album?.title ?? undefined}
              >
                {album?.title ?? "—"}
              </DialogTitle>
            }
            cover={album?.cover_url}
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
