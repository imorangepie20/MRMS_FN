"use client";

import { useEffect } from "react";

export interface ModalVideo {
  videoId: string;
  title: string;
}

/**
 * 자족적 풀스크린 YouTube 플레이어 — 앱 video-player 스토어와 무관.
 * Esc / 백드롭 클릭으로 닫기. 닫으면 IFrame 언마운트(재생 정지).
 * 스타일(.lum-modal*)은 ClassicalShowcase의 <style>에 정의 — .lumiere 하위로 렌더돼
 * --accent 등 CSS 변수를 상속받는다.
 */
export function ClassicalVideoModal({
  video,
  onClose,
}: {
  video: ModalVideo | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!video) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [video, onClose]);

  if (!video) return null;

  return (
    <div
      className="lum-modal"
      role="dialog"
      aria-modal="true"
      aria-label={video.title}
      onClick={onClose}
    >
      <button className="lum-modal-close" aria-label="닫기" onClick={onClose}>
        ✕<span>ESC</span>
      </button>
      <div className="lum-modal-stage" onClick={(e) => e.stopPropagation()}>
        <div className="lum-modal-kicker">NOW PROJECTING · 24fps</div>
        <div className="lum-modal-frame">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${video.videoId}?autoplay=1&rel=0&modestbranding=1`}
            title={video.title}
            allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
            allowFullScreen
          />
        </div>
        <p className="lum-modal-title">{video.title}</p>
      </div>
    </div>
  );
}
