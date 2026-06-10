"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

import { ModalTrackList, PlayAllButton } from "@/components/track/ModalTrackList";
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
        className="bg-(--mrms-paper) max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6 border border-(--mrms-rule)"
      >
        <div className="flex justify-between items-start mb-4 pb-2 border-b border-(--mrms-ink) gap-3">
          <div className="min-w-0">
            <div className="font-mono text-[10px] tracking-editorial uppercase text-(--mrms-ink-mute)">
              {item.item_type}
            </div>
            <h3 className="font-display font-bold text-[20px] text-(--mrms-ink)">
              {item.title ?? item.item_id}
            </h3>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <PlayAllButton tracks={tracks} />
            <button
              onClick={onClose}
              className="bg-transparent border-0 cursor-pointer text-(--mrms-ink-soft)"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {loading && (
          <div className="py-8 text-center font-mono text-[11px] uppercase text-(--mrms-ink-mute)">
            — loading —
          </div>
        )}

        {error && (
          <div className="p-3 border border-(--mrms-rust) text-(--mrms-rust) font-mono text-[11px]">
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
