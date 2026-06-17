"use client";

import Link from "next/link";

import { usePlaylistStore } from "@/store/playlist";
import { useNewPlaylistDialog } from "@/store/new-playlist-dialog";

const ROW =
  "px-1 py-1 text-[12px] truncate border-b border-[var(--mrms-rule)]/50 last:border-b-0 transition-[padding] hover:pl-2";

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
      <button
        onClick={() => openNew([])}
        className={`${ROW} w-full text-left bg-transparent border-0 cursor-pointer`}
      >
        <span className="font-mono text-[11px] tracking-editorial uppercase text-[var(--mrms-rust)]">
          ＋ 새 플레이리스트
        </span>
      </button>
      {playlists.map((p) => (
        <Link
          key={p.id}
          href={`/pgt?tab=playlists&pl=${p.id}`}
          className={`${ROW} block text-[var(--mrms-ink)] no-underline`}
        >
          {p.name}
        </Link>
      ))}
    </div>
  );
}
