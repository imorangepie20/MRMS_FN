"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";


// 백엔드(/api/auth/youtube/import) 응답 — 구현에 따라 필드명이 달라질 수 있어 넓게 받음
interface YouTubeImportResult {
  imported_count?: number;
  imported?: number;
  count?: number;
  tracks?: number;
  detail?: string;
  error?: string;
}


function pickImportedCount(r: YouTubeImportResult): number | null {
  const candidates = [r.imported_count, r.imported, r.count, r.tracks];
  for (const c of candidates) {
    if (typeof c === "number") return c;
  }
  return null;
}


export function YouTubeImportButton() {
  const [loading, setLoading] = useState(false);

  const handleImport = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const r = await fetch("/api/auth/youtube/import", {
        method: "POST",
        credentials: "include",
      });

      if (r.status === 401) {
        toast.error("먼저 YouTube 계정을 연결해주세요");
        return;
      }

      const data: YouTubeImportResult = await r.json().catch(() => ({}));

      if (!r.ok) {
        toast.error(data.detail ?? data.error ?? `가져오기 실패 (${r.status})`);
        return;
      }

      const count = pickImportedCount(data);
      toast.success(
        count != null
          ? `YouTube에서 ${count}곡을 가져왔습니다`
          : "YouTube 플레이리스트를 가져왔습니다",
      );
    } catch (e) {
      toast.error(`가져오기 실패: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={handleImport}
      variant="ghost"
      className="w-full"
      size="lg"
      disabled={loading}
    >
      {loading ? "가져오는 중..." : "내 YouTube 플레이리스트 가져오기"}
    </Button>
  );
}
