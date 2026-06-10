"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

import { ModalTrackList } from "@/components/track/ModalTrackList";
import { TrackModalMasthead } from "@/components/track/TrackModalMasthead";
import { fetchEmpItemTracks } from "@/lib/api/emp";
import type { EmpItemTrack, EmpSectionItem } from "@/lib/types";


export function ItemTracksModal({
  item,
  onClose,
}: {
  item: EmpSectionItem;
  onClose: () => void;
}) {
  const [tracks, setTracks] = useState<EmpItemTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetchEmpItemTracks(item.item_type, item.item_id, 100)
      .then((tr) => mounted && setTracks(tr))
      .catch((e) => mounted && setError((e as Error).message))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [item.item_type, item.item_id]);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-(--mrms-ink)/70 z-50 flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-(--mrms-paper) max-w-3xl w-full max-h-[82vh] overflow-y-auto p-6 border border-(--mrms-rule)"
      >
        <TrackModalMasthead
          kicker={item.item_type}
          title={item.title ?? item.item_id}
          cover={item.cover_url}
          tracks={tracks}
          trailing={
            <button
              onClick={onClose}
              aria-label="close"
              className="bg-transparent border border-(--mrms-rule) cursor-pointer text-(--mrms-ink-soft) size-7 flex items-center justify-center hover:bg-(--mrms-bg)"
            >
              <X className="size-3.5" />
            </button>
          }
        />

        {loading && (
          <div className="py-8 text-center font-mono text-[11px] uppercase text-(--mrms-ink-mute)">
            — loading —
          </div>
        )}

        {error && (
          <div className="mt-3 p-3 border border-(--mrms-rust) text-(--mrms-rust) font-mono text-[11px]">
            {error}
          </div>
        )}

        {!loading && tracks.length === 0 && !error && (
          <div className="py-8 text-center font-mono text-[11px] uppercase text-(--mrms-ink-mute)">
            — no tracks ingested for this item —
          </div>
        )}

        {!loading && <ModalTrackList tracks={tracks} />}
      </div>
    </div>
  );
}
