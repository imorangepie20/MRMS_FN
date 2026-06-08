"use client";

import { usePlayerStore } from "@/store/player";


export function NowPlaying({ className = "" }: { className?: string }) {
  const queue = usePlayerStore((s) => s.queue);
  const currentIdx = usePlayerStore((s) => s.currentIdx);
  const isPreview = usePlayerStore((s) => s.isPreview);
  const track = queue[currentIdx];

  if (!track) {
    return (
      <div className={`${className} text-sm text-muted-foreground truncate`}>
        재생 중인 곡 없음
      </div>
    );
  }

  return (
    <div className={`${className} flex flex-col justify-center min-w-0 gap-0.5`}>
      <div className="flex items-center gap-2 min-w-0">
        <div className="truncate font-medium text-sm">{track.title}</div>
        {isPreview && (
          <span className="shrink-0 text-[10px] uppercase font-semibold rounded px-1.5 py-0.5 bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 tracking-wide">
            Preview
          </span>
        )}
      </div>
      <div className="truncate text-xs text-muted-foreground">{track.artist}</div>
    </div>
  );
}
