"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

import { AuthCard } from "@/components/auth/auth-card";
import { TidalConnectModal } from "@/components/auth/TidalConnectModal";
import { Button } from "@/components/ui/button";


const ERROR_MESSAGES: Record<string, string> = {
  spotify_denied: "Spotify 동의를 거부했습니다.",
  spotify_failed: "Spotify 인증에 실패했습니다.",
  spotify_me_failed: "Spotify 계정 정보를 가져오지 못했습니다.",
};


export default function LoginPage() {
  const params = useSearchParams();
  const errorKey = params.get("error") ?? "";
  const errorMsg = ERROR_MESSAGES[errorKey];
  const [tidalOpen, setTidalOpen] = useState(false);

  return (
    <AuthCard
      title="MRMS — 개인 맞춤 추천"
      description="Tidal 또는 Spotify 계정으로 시작하세요"
    >
      <div className="space-y-3">
        {errorMsg && (
          <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {errorMsg}
          </div>
        )}
        <Button
          onClick={() => setTidalOpen(true)}
          className="w-full"
          size="lg"
        >
          Tidal로 시작하기
        </Button>
        <Button
          onClick={() => (window.location.href = "/api/auth/spotify/authorize")}
          variant="outline"
          className="w-full"
          size="lg"
        >
          Spotify로 시작하기
        </Button>
      </div>
      <TidalConnectModal open={tidalOpen} onOpenChange={setTidalOpen} />
    </AuthCard>
  );
}
