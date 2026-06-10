"use client";

import { useEffect, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ModalTrackList, PlayAllButton } from "@/components/track/ModalTrackList";
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
      <DialogContent className="bg-(--mrms-paper) border-(--mrms-ink) sm:max-w-[640px] max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex justify-between items-start gap-3 pr-8">
            <div className="min-w-0">
              <div className="font-mono text-[10px] tracking-editorial uppercase text-(--mrms-ink-mute)">
                Album
              </div>
              <DialogTitle className="font-display font-bold text-(--mrms-ink) text-[22px] leading-tight">
                {album?.title ?? "—"}
              </DialogTitle>
            </div>
            <PlayAllButton tracks={tracks} />
          </div>
        </DialogHeader>
        <div className="flex gap-4">
          <div className="size-24 bg-(--mrms-rule) shrink-0">
            {album?.cover_url && (
              <img src={album.cover_url} alt="" className="size-full object-cover" />
            )}
          </div>
          <div className="font-mono text-[11px] text-(--mrms-ink-soft)">
            {tracks.length} tracks
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
