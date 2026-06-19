"use client";

import { Play } from "lucide-react";

import { duotoneStyle, coverInitial } from "@/lib/cover-art";
import { useVideoPlayer } from "@/store/video-player";

export function VideoCard({
  videoId,
  title,
  coverUrl,
  widthPx,
}: {
  videoId: string;
  title: string;
  coverUrl: string | null;
  /** 캐러셀용 고정 px. 생략하면 부모(그리드 셀) 폭에 맞춤. */
  widthPx?: number;
}) {
  const open = useVideoPlayer((s) => s.open);
  return (
    <button
      onClick={() => open(videoId, title)}
      style={widthPx ? { width: `${widthPx}px`, containerType: "inline-size" } : { containerType: "inline-size" }}
      className={`group text-left bg-transparent border-0 p-0 cursor-pointer ${widthPx ? "shrink-0 snap-start" : "w-full"}`}
    >
      <div className="relative w-full aspect-video overflow-hidden bg-(--mrms-rule)">
        {coverUrl ? (
          <img
            src={coverUrl}
            alt=""
            loading="lazy"
            className="absolute inset-0 size-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center" style={duotoneStyle(title)}>
            <span className="font-serif font-bold text-(--mrms-paper)" style={{ fontSize: "30cqw", textShadow: "0 2px 10px rgba(31,26,22,.32)" }}>
              {coverInitial(title)}
            </span>
          </div>
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-(--mrms-ink)/35 opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="size-10 rounded-full bg-(--mrms-paper) flex items-center justify-center">
            <Play className="size-4 text-(--mrms-ink) fill-current" />
          </span>
        </span>
      </div>
      <div className="mt-1.5 font-display font-medium text-[12px] leading-snug text-(--mrms-ink) truncate group-hover:text-(--mrms-rust) transition-colors">
        {title}
      </div>
    </button>
  );
}
