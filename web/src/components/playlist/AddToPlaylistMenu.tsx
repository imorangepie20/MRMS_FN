"use client";

import { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";

import { usePlaylistActionsEnabled } from "./playlist-actions-context";
import { usePlaylistStore } from "@/store/playlist";
import { useNewPlaylistDialog } from "@/store/new-playlist-dialog";

export function AddToPlaylistMenu({ trackId }: { trackId: string }) {
  const enabled = usePlaylistActionsEnabled();
  const playlists = usePlaylistStore((s) => s.playlists);
  const addTrack = usePlaylistStore((s) => s.addTrack);
  const openNew = useNewPlaylistDialog((s) => s.openDialog);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  if (!enabled) return null;

  return (
    <div ref={ref} className="relative">
      <button
        aria-label="플레이리스트에 추가"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="bg-transparent border-0 cursor-pointer p-1"
      >
        <Plus className="size-3.5" stroke="var(--mrms-ink-mute)" strokeWidth={1.6} />
      </button>
      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="fixed inset-x-2 bottom-2 z-50 sm:absolute sm:inset-auto sm:right-0 sm:top-7 sm:bottom-auto sm:w-44 border border-(--mrms-ink) bg-(--mrms-paper) shadow-xl max-h-[50vh] overflow-y-auto"
        >
          <button
            onClick={() => {
              openNew([trackId]);
              setOpen(false);
            }}
            className="w-full text-left px-3 py-2 font-mono text-[11px] tracking-editorial uppercase text-(--mrms-rust) border-0 border-b border-(--mrms-rule) bg-transparent cursor-pointer hover:bg-(--mrms-bg)"
          >
            ＋ 새 플레이리스트
          </button>
          {playlists.length === 0 ? (
            <div className="px-3 py-2 font-mono text-[10px] text-(--mrms-ink-mute)">
              플레이리스트 없음
            </div>
          ) : (
            playlists.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  addTrack(p.id, trackId);
                  setOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-[12px] text-(--mrms-ink) border-0 border-b border-(--mrms-rule) last:border-b-0 bg-transparent cursor-pointer hover:bg-(--mrms-bg) truncate"
              >
                {p.name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
