"use client";

import { useEffect, useState } from "react";

import { getAlbumArtwork } from "@/lib/itunes-artwork";


interface Props {
  artist: string;
  album?: string | null;
  initialUrl?: string | null;
  className?: string;
}


/** 아트워크 표시 — initialUrl 우선, 없으면 iTunes Search로 가져옴. */
export function AlbumArt({ artist, album, initialUrl, className = "" }: Props) {
  const [url, setUrl] = useState<string | null>(initialUrl ?? null);

  useEffect(() => {
    if (url || !album) return;
    let cancelled = false;
    getAlbumArtwork(artist, album).then((u) => {
      if (!cancelled && u) setUrl(u);
    });
    return () => {
      cancelled = true;
    };
  }, [artist, album, url]);

  return (
    <div className={`bg-[var(--mrms-rule)] relative overflow-hidden ${className}`}>
      {url && (
        <img
          src={url}
          alt=""
          className="size-full object-cover"
          loading="lazy"
        />
      )}
    </div>
  );
}
