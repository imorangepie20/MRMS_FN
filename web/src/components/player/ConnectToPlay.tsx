"use client";

import { useState } from "react";

import { TidalConnectModal } from "@/components/auth/TidalConnectModal";
import { Button } from "@/components/ui/button";


/** 미연결 방문자에게 재생을 위한 플랫폼 연결을 유도 (= 우리 OAuth = 사이트 세션). */
export function ConnectToPlay() {
  const [tidalOpen, setTidalOpen] = useState(false);
  return (
    <div className="border border-(--mrms-ink) bg-(--mrms-paper) p-4">
      <div className="font-mono text-[11px] tracking-editorial uppercase text-(--mrms-ink-mute)">
        재생하려면 연결하세요
      </div>
      <p className="mt-1 text-(--mrms-ink-soft) text-sm">
        본인 Spotify 또는 Tidal 계정으로 MRMS에서 바로 들으세요.
      </p>
      <div className="mt-3 flex gap-2">
        <Button onClick={() => setTidalOpen(true)} size="sm">
          Tidal로 연결
        </Button>
        <Button
          onClick={() => (window.location.href = "/api/auth/spotify/authorize")}
          variant="outline"
          size="sm"
        >
          Spotify로 연결
        </Button>
      </div>
      <TidalConnectModal open={tidalOpen} onOpenChange={setTidalOpen} />
    </div>
  );
}
