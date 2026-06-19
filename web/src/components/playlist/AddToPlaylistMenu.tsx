"use client";

import { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";

import { usePlaylistActionsEnabled } from "./playlist-actions-context";
import { PlaylistMenuContent } from "./PlaylistMenuContent";
import { useRequireAuth } from "@/lib/hooks/use-require-auth";

export function AddToPlaylistMenu({ trackId }: { trackId: string }) {
  const enabled = usePlaylistActionsEnabled();
  const { isGuest } = useRequireAuth();
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

  if (!enabled || isGuest) return null; // 비회원: 플레이리스트 저장 숨김

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
          <PlaylistMenuContent trackIds={[trackId]} onClose={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}
