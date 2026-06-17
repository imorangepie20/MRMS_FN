"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { getUserPlaylists } from "@/lib/api";

export function HomeStats({
  personas,
  likedTracks,
}: {
  personas: number;
  likedTracks: number;
}) {
  const [playlists, setPlaylists] = useState<number | null>(null);
  useEffect(() => {
    getUserPlaylists()
      .then((r) => setPlaylists(r.playlists.length))
      .catch(() => setPlaylists(null));
  }, []);

  const Cell = ({ label, value, href }: { label: string; value: string; href?: string }) => {
    const body = (
      <div className="bg-(--mrms-bg) px-4 py-3">
        <div className="font-mono text-[9px] tracking-editorial uppercase text-(--mrms-ink-mute)">{label}</div>
        <div className="font-display font-bold text-[20px] text-(--mrms-ink) mt-0.5">{value}</div>
      </div>
    );
    return href ? <Link href={href} className="no-underline block hover:bg-(--mrms-paper)">{body}</Link> : body;
  };

  return (
    <div className="grid grid-cols-4 gap-px bg-(--mrms-rule) border border-(--mrms-rule)">
      <Cell label="personas" value={String(personas)} />
      <Cell label="liked" value={String(likedTracks)} />
      <Cell label="playlists" value={playlists == null ? "—" : String(playlists)} href="/pgt" />
      <Cell label="mood" value="→" href="/situation" />
    </div>
  );
}
