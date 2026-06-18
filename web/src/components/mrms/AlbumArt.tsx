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


/** 커버 없을 때의 "Warm Duotone Glow" 폴백 배경 — artist|album 해시로 따뜻한 톤 결정적 배정.
 *  hue는 14–80° 따뜻 영역에만 머물러 어떤 입력도 칙칙/차갑게 빠지지 않는다. */
function duotone(artist: string, album?: string | null): { background: string; boxShadow: string } {
  const key = `${artist}|${album ?? ""}`;
  let h = 5381;
  for (let i = 0; i < key.length; i++) h = ((h << 5) + h + key.charCodeAt(i)) >>> 0;
  const hue1 = 14 + (h % 36); // 14–49° terracotta→clay→mustard
  const hue2 = hue1 + 18 + ((h >>> 8) % 14); // +18–31° toward amber/gold
  const sat = 58 + ((h >>> 16) % 14); // 58–71% (고급, 네온 X)
  const light = 46 + ((h >>> 20) % 10); // 46–55%
  const linear = `linear-gradient(135deg, hsl(${hue1} ${sat}% ${light}%) 0%, hsl(${hue2} ${sat + 6}% ${light + 8}%) 100%)`;
  const glow = `radial-gradient(120% 120% at 18% 14%, hsl(${hue2} ${sat + 10}% ${light + 14}% / .55), transparent 60%)`;
  return { background: `${glow}, ${linear}`, boxShadow: "inset 0 0 0 1.5px rgba(250,242,233,.22)" };
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
      style={{ containerType: "size", ...(showFallback ? duotone(artist, album) : null) }}
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
          className="font-serif font-bold text-[var(--mrms-paper)] leading-none select-none"
          style={{ fontSize: "58cqw", textShadow: "0 2px 10px rgba(31,26,22,.32)" }}
        >
          {letter}
        </span>
      )}
    </div>
  );
}
