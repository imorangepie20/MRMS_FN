"use client";

import Link from "next/link";
import { useDroppable } from "@dnd-kit/core";

import { usePlaylistStore } from "@/store/playlist";
import { useNewPlaylistDialog } from "@/store/new-playlist-dialog";

function DropRow({
  id,
  children,
  onClick,
}: {
  id: string;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      onClick={onClick}
      className={`px-1 py-1 text-[12px] truncate border-b border-[var(--mrms-rule)]/50 last:border-b-0 cursor-pointer transition-colors ${
        isOver
          ? "bg-[var(--mrms-rust)]/15 outline-dashed outline-1 outline-[var(--mrms-rust)] text-[var(--mrms-rust)]"
          : "text-[var(--mrms-ink)] hover:pl-2"
      }`}
    >
      {children}
    </div>
  );
}

export function PlaylistNavSection() {
  const playlists = usePlaylistStore((s) => s.playlists);
  const openNew = useNewPlaylistDialog((s) => s.openDialog);

  return (
    <div className="mb-5">
      <div className="flex justify-between items-baseline pb-1.5 mb-1.5 border-b border-[var(--mrms-rule)]">
        <span className="font-mono text-[9px] tracking-editorial-wide uppercase text-[var(--mrms-ink-mute)]">
          My Playlists
        </span>
        <span className="font-mono text-[9px] text-[var(--mrms-rust)]">{playlists.length}</span>
      </div>
      <DropRow id="playlist-new" onClick={() => openNew([])}>
        <span className="font-mono text-[11px] tracking-editorial uppercase text-[var(--mrms-rust)]">
          ＋ 새 플레이리스트
        </span>
      </DropRow>
      {playlists.map((p) => (
        <DropRow key={p.id} id={`playlist:${p.id}`}>
          <Link href="/pgt?tab=playlists" className="block truncate text-inherit no-underline">
            {p.name}
          </Link>
        </DropRow>
      ))}
    </div>
  );
}
