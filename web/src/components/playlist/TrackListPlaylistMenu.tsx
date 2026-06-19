"use client";

import { useEffect, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";

import { useRequireAuth } from "@/lib/hooks/use-require-auth";

import { usePlaylistActionsEnabled } from "./playlist-actions-context";
import { PlaylistMenuContent } from "./PlaylistMenuContent";

/** 트랙 목록 헤더용 "⋯" 케밥 — 목록 전체(trackIds)를 새 플레이리스트로 만들거나 추가. */
export function TrackListPlaylistMenu({ trackIds }: { trackIds: string[] }) {
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
        aria-label="목록을 플레이리스트로"
        disabled={trackIds.length === 0}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="bg-transparent border-0 cursor-pointer p-1 disabled:opacity-30 disabled:cursor-default"
      >
        <MoreHorizontal className="size-4" stroke="var(--mrms-ink-mute)" strokeWidth={1.6} />
      </button>
      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="fixed inset-x-2 bottom-2 z-50 sm:absolute sm:inset-auto sm:right-0 sm:top-8 sm:bottom-auto sm:w-48 border border-(--mrms-ink) bg-(--mrms-paper) shadow-xl max-h-[50vh] overflow-y-auto"
        >
          <PlaylistMenuContent trackIds={trackIds} onClose={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}
