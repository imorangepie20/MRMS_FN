"use client";

import { useState } from "react";

import { TidalConnectModal } from "@/components/auth/TidalConnectModal";
import { Button } from "@/components/ui/button";

interface Props {
  /** Spotify/YouTube 연결 후 돌아올 사이트 내부 경로. 기본 /onboarding. */
  next?: string;
}

export function PlatformConnect({ next = "/onboarding" }: Props) {
  const [tidalOpen, setTidalOpen] = useState(false);
  const q = `?next=${encodeURIComponent(next)}`;

  return (
    <div className="space-y-3">
      <Button onClick={() => setTidalOpen(true)} className="w-full" size="lg">
        Tidal 연결하기
      </Button>
      <Button
        onClick={() => (window.location.href = `/api/auth/spotify/authorize${q}`)}
        variant="outline"
        className="w-full"
        size="lg"
        disabled
        title="Spotify 연결은 준비 중입니다"
      >
        Spotify 연결하기 (준비 중)
      </Button>
      <Button
        onClick={() => (window.location.href = `/api/auth/youtube/authorize${q}`)}
        variant="outline"
        className="w-full"
        size="lg"
      >
        YouTube 연결하기
      </Button>
      <TidalConnectModal open={tidalOpen} onOpenChange={setTidalOpen} />
    </div>
  );
}
