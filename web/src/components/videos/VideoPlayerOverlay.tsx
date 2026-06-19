"use client";

import { useEffect, useRef, useState } from "react";

import { X, Maximize2 } from "lucide-react";

import { getVideoPlaybackUrl } from "@/lib/api/videos";
import { pausePlayback } from "@/lib/player";
import { useVideoPlayer } from "@/store/video-player";

export function VideoPlayerOverlay() {
  const videoId = useVideoPlayer((s) => s.videoId);
  const title = useVideoPlayer((s) => s.title);
  const close = useVideoPlayer((s) => s.close);
  const videoRef = useRef<HTMLVideoElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 열릴 때: 오디오 큐 일시정지 + Esc 닫기
  useEffect(() => {
    if (!videoId) return;
    void pausePlayback().catch(() => {});
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [videoId, close]);

  // m3u8 로드 + hls.js attach
  useEffect(() => {
    if (!videoId) return;
    const el = videoRef.current;
    if (!el) return;
    let hls: { destroy: () => void } | null = null;
    let cancelled = false;
    setError(null);

    // 네이티브 <video> 재생 실패(Safari HLS·폴백 src) → 에러 표시(오버레이 유지).
    const onNativeError = () => {
      if (!cancelled) setError("재생할 수 없는 영상입니다.");
    };
    el.addEventListener("error", onNativeError);

    void (async () => {
      try {
        const { url, preview: pv } = await getVideoPlaybackUrl(videoId);
        if (cancelled) return;
        setPreview(pv);
        if (el.canPlayType("application/vnd.apple.mpegurl")) {
          el.src = url; // Safari/iOS 네이티브 HLS
        } else {
          const Hls = (await import("hls.js")).default;
          if (cancelled) return;
          if (Hls.isSupported()) {
            const inst = new Hls();
            // hls.js 치명 에러(매니페스트/네트워크/미디어) → 에러 표시(오버레이 유지).
            inst.on(Hls.Events.ERROR, (_evt, data) => {
              if (data.fatal && !cancelled) setError("재생할 수 없는 영상입니다.");
            });
            inst.loadSource(url);
            inst.attachMedia(el);
            hls = inst;
          } else {
            el.src = url; // 최후 폴백
          }
        }
        // autoplay 정책으로 막히면 사용자가 컨트롤로 재생 — 에러 아님(swallow).
        await el.play().catch(() => {});
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();

    return () => {
      cancelled = true;
      el.removeEventListener("error", onNativeError);
      if (hls) hls.destroy();
      el.removeAttribute("src");
      el.load();
    };
  }, [videoId]);

  if (!videoId) return null;

  const toggleFullscreen = () => {
    const box = boxRef.current;
    if (!box) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void box.requestFullscreen?.();
  };

  return (
    <div
      onClick={close}
      className="fixed inset-0 z-[70] bg-black/80 flex items-center justify-center p-4"
    >
      <div
        ref={boxRef}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[960px] aspect-video bg-black"
      >
        <video ref={videoRef} controls autoPlay playsInline className="size-full bg-black" />
        {/* 상단 우측 컨트롤 */}
        <div className="absolute top-2 right-2 flex gap-2">
          <button
            onClick={toggleFullscreen}
            aria-label="fullscreen"
            className="size-8 flex items-center justify-center bg-(--mrms-ink)/70 text-(--mrms-paper) border-0 cursor-pointer hover:bg-(--mrms-ink)"
          >
            <Maximize2 className="size-4" />
          </button>
          <button
            onClick={close}
            aria-label="close"
            className="size-8 flex items-center justify-center bg-(--mrms-ink)/70 text-(--mrms-paper) border-0 cursor-pointer hover:bg-(--mrms-ink)"
          >
            <X className="size-4" />
          </button>
        </div>
        {title && (
          <div className="absolute top-2 left-3 right-24 font-display text-[13px] text-(--mrms-paper) truncate drop-shadow">
            {title}
          </div>
        )}
        {preview && (
          <div className="absolute bottom-2 left-0 right-0 flex justify-center">
            <a
              href="/register"
              className="font-mono text-[10px] tracking-editorial uppercase bg-(--mrms-rust) text-(--mrms-paper) px-3 py-1.5 no-underline"
            >
              가입하면 풀영상 →
            </a>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center text-(--mrms-paper) font-mono text-[12px] text-center px-6">
            재생할 수 없는 영상입니다.
          </div>
        )}
      </div>
    </div>
  );
}
