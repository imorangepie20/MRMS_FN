"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  DeviceCodeInit,
  DeviceCodePollStatus,
} from "@/lib/types";


interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}


export function TidalConnectModal({ open, onOpenChange }: Props) {
  const router = useRouter();
  const [init, setInit] = useState<DeviceCodeInit | null>(null);
  const [status, setStatus] = useState<string>("init");
  const [error, setError] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);

  // 모달 open 시 device-code/init 호출
  useEffect(() => {
    if (!open) {
      setInit(null);
      setError(null);
      return;
    }
    setError(null);
    setStatus("초기화 중...");
    (async () => {
      try {
        const r = await fetch("/api/auth/tidal/device-code/init", {
          method: "POST",
          credentials: "include",
        });
        if (!r.ok) throw new Error(`init failed: ${r.status}`);
        const data: DeviceCodeInit = await r.json();
        setInit(data);
        setStatus("Tidal에서 동의해주세요");
        // 새 탭 자동 오픈 (브라우저 popup blocker가 모달 useEffect 내부 호출은 차단할 수 있음 — onClick에서 호출하는 게 더 안전하지만 우선 시도)
        window.open(data.verification_uri_complete, "_blank");
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, [open]);

  const poll = useCallback(async () => {
    if (!init || polling) return;
    setPolling(true);
    try {
      const r = await fetch("/api/auth/tidal/device-code/poll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ device_code: init.device_code }),
        credentials: "include",
      });
      const result: DeviceCodePollStatus = await r.json();
      if (result.status === "success") {
        const target = result.has_mrt ? "/mrt" : "/onboarding";
        onOpenChange(false);
        router.push(target);
        router.refresh();
      } else if (result.status === "expired") {
        setError("코드 만료 — 재시도 해주세요");
        setInit(null);
      } else if (result.status === "error") {
        setError(result.detail ?? "Tidal 인증 에러");
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPolling(false);
    }
  }, [init, polling, onOpenChange, router]);

  // visibilitychange — 탭 재활성화 시 1회 poll
  useEffect(() => {
    if (!open || !init) return;
    const handler = () => {
      if (document.visibilityState === "visible") {
        void poll();
      }
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [open, init, poll]);

  // 30초 fallback poll
  useEffect(() => {
    if (!open || !init) return;
    const interval = setInterval(() => void poll(), 30_000);
    return () => clearInterval(interval);
  }, [open, init, poll]);

  const handleRetry = () => {
    setInit(null);
    setError(null);
    setStatus("초기화 중...");
    // useEffect가 다시 init 호출하도록 — modal close+open trick
    onOpenChange(false);
    setTimeout(() => onOpenChange(true), 50);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Tidal 계정 연결</DialogTitle>
        </DialogHeader>
        {error ? (
          <div className="space-y-4">
            <p className="text-red-500">{error}</p>
            <Button onClick={handleRetry} className="w-full">
              다시 시도
            </Button>
          </div>
        ) : init ? (
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">코드</p>
              <div className="text-4xl font-mono font-bold tracking-wider">
                {init.user_code}
              </div>
            </div>
            <p className="text-sm">{status}</p>
            <a
              href={init.verification_uri_complete}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <Button variant="outline" className="w-full">
                Tidal 다시 열기 →
              </Button>
            </a>
            <Button onClick={poll} className="w-full" disabled={polling}>
              {polling ? "확인 중..." : "동의 완료 — 확인"}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              동의 후 이 탭으로 돌아오면 자동으로 진행됩니다
            </p>
          </div>
        ) : (
          <p>{status}</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
