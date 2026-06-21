"use client";

import { useState } from "react";

import { TidalConnectModal } from "@/components/auth/TidalConnectModal";
import { Button } from "@/components/ui/button";


/** 미연결 방문자에게 재생을 위한 플랫폼 연결을 유도 (= 우리 OAuth = 사이트 세션). */
export function ConnectToPlay() {
  const [tidalOpen, setTidalOpen] = useState(false);

  // 인증 후 이 공유 페이지로 복귀시킨다 (신규·기존 회원 모두).
  const connectSpotify = () => {
    const next = window.location.pathname + window.location.search;
    window.location.href = `/api/auth/spotify/authorize?next=${encodeURIComponent(next)}`;
  };

  const connectYoutube = () => {
    const next = window.location.pathname + window.location.search;
    window.location.href = `/api/auth/youtube/authorize?next=${encodeURIComponent(next)}`;
  };

  return (
    <div className="border border-(--mrms-ink) bg-(--mrms-paper) p-4">
      <div className="font-mono text-[11px] tracking-editorial uppercase text-(--mrms-ink-mute)">
        재생하려면 연결하세요
      </div>
      <p className="mt-1 text-(--mrms-ink-soft) text-sm">
        Tidal 또는 YouTube로 MRMS에서 바로 들으세요.
      </p>
      <div className="mt-3 flex gap-2">
        <Button onClick={() => setTidalOpen(true)} size="sm">
          Tidal로 연결
        </Button>
        <Button onClick={connectYoutube} variant="outline" size="sm">
          YouTube로 연결
        </Button>
        <Button
          onClick={connectSpotify}
          variant="outline"
          size="sm"
          disabled
          title="Spotify 연결은 준비 중입니다"
        >
          Spotify로 연결 (준비 중)
        </Button>
      </div>
      <TidalConnectModal open={tidalOpen} onOpenChange={setTidalOpen} stayOnPage />
    </div>
  );
}
