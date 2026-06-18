"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";

import { usePlaylistStore } from "@/store/playlist";
import { useNewPlaylistDialog } from "@/store/new-playlist-dialog";

/** ＋버튼·우클릭·목록 케밥이 공유하는 2단계 메뉴. trackIds 1개=단일, N개=목록단위. */
export function PlaylistMenuContent({
  trackIds,
  onClose,
}: {
  trackIds: string[];
  onClose: () => void;
}) {
  const playlists = usePlaylistStore((s) => s.playlists);
  const addTracks = usePlaylistStore((s) => s.addTracks);
  const openNew = useNewPlaylistDialog((s) => s.openDialog);
  const [mode, setMode] = useState<"root" | "add">("root");
  const n = trackIds.length;
  const suffix = n > 1 ? ` (${n}곡)` : "";

  if (mode === "add") {
    return (
      <div>
        <button
          onClick={() => setMode("root")}
          className="w-full text-left px-3 py-2 font-mono text-[10px] tracking-editorial uppercase text-(--mrms-ink-mute) border-0 border-b border-(--mrms-rule) bg-transparent cursor-pointer hover:bg-(--mrms-bg) flex items-center gap-1"
        >
          <ChevronLeft className="size-3" /> 뒤로
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
                addTracks(p.id, trackIds);
                onClose();
              }}
              className="w-full text-left px-3 py-2 text-[12px] text-(--mrms-ink) border-0 border-b border-(--mrms-rule) last:border-b-0 bg-transparent cursor-pointer hover:bg-(--mrms-bg) truncate"
            >
              {p.name}
            </button>
          ))
        )}
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => {
          openNew(trackIds);
          onClose();
        }}
        className="w-full text-left px-3 py-2 font-mono text-[11px] tracking-editorial uppercase text-(--mrms-rust) border-0 border-b border-(--mrms-rule) bg-transparent cursor-pointer hover:bg-(--mrms-bg) flex items-center gap-1.5"
      >
        <Plus className="size-3" /> 플레이리스트 만들기{suffix}
      </button>
      <button
        onClick={() => setMode("add")}
        className="w-full text-left px-3 py-2 text-[12px] text-(--mrms-ink) border-0 bg-transparent cursor-pointer hover:bg-(--mrms-bg) flex items-center justify-between"
      >
        플레이리스트에 추가{suffix}
        <ChevronRight className="size-3.5 text-(--mrms-ink-mute)" />
      </button>
    </div>
  );
}
