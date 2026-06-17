"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";

import { usePlaylistStore } from "@/store/playlist";
import { useNewPlaylistDialog } from "@/store/new-playlist-dialog";

/** ＋버튼 드롭다운과 우클릭 컨텍스트 메뉴가 공유하는 2단계 메뉴 콘텐츠.
 *  root: 플레이리스트 만들기 / 플레이리스트에 추가▸  ·  add: 목록 → 선택 시 추가. */
export function PlaylistMenuContent({
  trackId,
  onClose,
}: {
  trackId: string;
  onClose: () => void;
}) {
  const playlists = usePlaylistStore((s) => s.playlists);
  const addTrack = usePlaylistStore((s) => s.addTrack);
  const openNew = useNewPlaylistDialog((s) => s.openDialog);
  const [mode, setMode] = useState<"root" | "add">("root");

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
                addTrack(p.id, trackId);
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
          openNew([trackId]);
          onClose();
        }}
        className="w-full text-left px-3 py-2 font-mono text-[11px] tracking-editorial uppercase text-(--mrms-rust) border-0 border-b border-(--mrms-rule) bg-transparent cursor-pointer hover:bg-(--mrms-bg) flex items-center gap-1.5"
      >
        <Plus className="size-3" /> 플레이리스트 만들기
      </button>
      <button
        onClick={() => setMode("add")}
        className="w-full text-left px-3 py-2 text-[12px] text-(--mrms-ink) border-0 bg-transparent cursor-pointer hover:bg-(--mrms-bg) flex items-center justify-between"
      >
        플레이리스트에 추가
        <ChevronRight className="size-3.5 text-(--mrms-ink-mute)" />
      </button>
    </div>
  );
}
