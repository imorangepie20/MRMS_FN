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
  // 이미지 로드 실패(만료/404) → 글자 placeholder.
  const [failed, setFailed] = useState(false);

  // 곡이 바뀌면(artist/album/initialUrl 변경) 내부 상태를 새 곡 기준으로 리셋한다.
  // 플레이어처럼 컴포넌트가 remount 안 되고 유지되는 자리에서도 이미지가 갱신되도록
  // (React '이전 렌더 정보 저장' 패턴 — effect 아닌 렌더 중 setState). 그 뒤 아래
  // effect가 url=null이고 album이 있으면 새 곡 커버를 fetch한다.
  const trackKey = `${artist}|${album ?? ""}|${initialUrl ?? ""}`;
  const [prevKey, setPrevKey] = useState(trackKey);
  if (trackKey !== prevKey) {
    setPrevKey(trackKey);
    setUrl(initialUrl ?? null);
    setResolved(!!initialUrl);
    setFailed(false);
  }

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

  const showFallback = (resolved && !url) || failed;
  const letter = initial(album ?? artist ?? "");

  return (
    <div
      className={`bg-[var(--mrms-paper)] border border-[var(--mrms-rule)] relative overflow-hidden flex items-center justify-center ${className}`}
      style={{ containerType: "size" }}
    >
      {url && !failed && (
        <img
          src={url}
          alt=""
          className="size-full object-cover"
          loading="lazy"
          onError={() => setFailed(true)}
        />
      )}
      {showFallback && (
        <span
          className="font-display font-bold text-[var(--mrms-ink-mute)] leading-none select-none"
          style={{ fontSize: "60cqw" }}
        >
          {letter}
        </span>
      )}
    </div>
  );
}
