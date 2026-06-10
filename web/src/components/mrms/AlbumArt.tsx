"use client";

import { useEffect, useState } from "react";

import { getAlbumArtwork } from "@/lib/itunes-artwork";


interface Props {
  artist: string;
  album?: string | null;
  initialUrl?: string | null;
  className?: string;
}


function initial(s: string): string {
  const trimmed = s.trim();
  if (!trimmed) return "?";
  // First non-whitespace character (handles Korean too)
  return [...trimmed][0]?.toUpperCase() ?? "?";
}


/** 아트워크 표시 — initialUrl 우선, 없으면 iTunes Search. 실패 시 첫 글자 fallback. */
export function AlbumArt({ artist, album, initialUrl, className = "" }: Props) {
  const [url, setUrl] = useState<string | null>(initialUrl ?? null);
  const [resolved, setResolved] = useState<boolean>(!!initialUrl);

  useEffect(() => {
    if (url || !album) {
      if (!album) setResolved(true);
      return;
    }
    let cancelled = false;
    getAlbumArtwork(artist, album).then((u) => {
      if (cancelled) return;
      setUrl(u);
      setResolved(true);
    });
    return () => {
      cancelled = true;
    };
  }, [artist, album, url]);

  const showFallback = resolved && !url;
  const letter = initial(album ?? artist ?? "");

  return (
    <div
      className={`bg-[var(--mrms-paper)] border border-[var(--mrms-rule)] relative overflow-hidden flex items-center justify-center ${className}`}
    >
      {url && (
        <img
          src={url}
          alt=""
          className="size-full object-cover"
          loading="lazy"
        />
      )}
      {showFallback && (
        <span
          className="font-display font-bold text-[var(--mrms-ink-mute)] leading-none select-none"
          style={{ fontSize: "55%" }}
        >
          {letter}
        </span>
      )}
    </div>
  );
}
