"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

import { AuthCard } from "@/components/auth/auth-card";
import { TidalConnectModal } from "@/components/auth/TidalConnectModal";
import { YouTubeImportButton } from "@/components/auth/YouTubeImportButton";
import { Button } from "@/components/ui/button";


const ERROR_MESSAGES: Record<string, string> = {
  spotify_denied: "Spotify 동의를 거부했습니다.",
  spotify_failed: "Spotify 인증에 실패했습니다.",
  spotify_me_failed: "Spotify 계정 정보를 가져오지 못했습니다.",
  youtube_denied: "YouTube 동의를 거부했습니다.",
  youtube_failed: "YouTube 인증에 실패했습니다.",
  youtube_me_failed: "YouTube 계정 정보를 가져오지 못했습니다.",
};


function LoginContent() {
  const params = useSearchParams();
  const errorKey = params.get("error") ?? "";
  const errorMsg = ERROR_MESSAGES[errorKey];
  const [tidalOpen, setTidalOpen] = useState(false);

  return (
    <AuthCard
      title="MRMS — 개인 맞춤 추천"
      description="Tidal · Spotify · YouTube 계정으로 시작하세요"
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
        <Button
          onClick={() => (window.location.href = "/api/auth/youtube/authorize")}
          variant="outline"
          className="w-full"
          size="lg"
        >
          YouTube로 시작하기
        </Button>
        <YouTubeImportButton />
      </div>
      <TidalConnectModal open={tidalOpen} onOpenChange={setTidalOpen} />
    </AuthCard>
  );
}


export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}
