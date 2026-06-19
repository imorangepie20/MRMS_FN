"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

import { fetchVideoPlaylistVideos, type VideoItem } from "@/lib/api/videos";
import { useVideoPlaylist } from "@/store/video-playlist";

import { VideoCard } from "./VideoCard";

/** 비디오 플레이리스트 모달 — 그 플레이리스트 영상들을 그리드로. 영상 클릭 → 풀스크린 플레이어. */
export function VideoPlaylistModal() {
  const uuid = useVideoPlaylist((s) => s.uuid);
  const title = useVideoPlaylist((s) => s.title);
  const close = useVideoPlaylist((s) => s.close);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uuid) return;
    let on = true;
    setLoading(true);
    setError(null);
    setVideos([]);
    fetchVideoPlaylistVideos(uuid)
      .then((v) => on && setVideos(v))
      .catch((e) => on && setError((e as Error).message))
      .finally(() => on && setLoading(false));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      on = false;
      window.removeEventListener("keydown", onKey);
    };
  }, [uuid, close]);

  if (!uuid) return null;

  return (
    <div
      onClick={close}
      className="fixed inset-0 z-[60] bg-(--mrms-ink)/70 flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-(--mrms-paper) max-w-4xl w-full max-h-[85vh] overflow-y-auto p-6 border border-(--mrms-rule)"
      >
        <div className="flex items-center gap-3 pb-3 mb-4 border-b border-(--mrms-ink)">
          <div className="min-w-0 flex-1">
            <div className="font-mono text-[10px] tracking-editorial uppercase text-(--mrms-rust)">
              Video playlist
            </div>
            <div className="font-display font-bold text-[18px] leading-tight truncate text-(--mrms-ink)">
              {title}
            </div>
          </div>
          <button
            onClick={close}
            aria-label="close"
            className="bg-transparent border border-(--mrms-rule) cursor-pointer text-(--mrms-ink-soft) size-7 flex items-center justify-center hover:bg-(--mrms-bg) shrink-0"
          >
            <X className="size-3.5" />
          </button>
        </div>

        {loading && (
          <div className="py-8 text-center font-mono text-[11px] uppercase text-(--mrms-ink-mute)">
            — loading —
          </div>
        )}
        {error && (
          <div className="mt-3 p-3 border border-(--mrms-rust) text-(--mrms-rust) font-mono text-[11px]">
            {error}
          </div>
        )}
        {!loading && !error && videos.length === 0 && (
          <div className="py-8 text-center font-mono text-[11px] uppercase text-(--mrms-ink-mute)">
            — no videos —
          </div>
        )}
        {!loading && !error && videos.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {videos.map((v) => (
              <VideoCard
                key={v.video_id}
                videoId={v.video_id}
                title={v.title}
                coverUrl={v.cover_url}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
