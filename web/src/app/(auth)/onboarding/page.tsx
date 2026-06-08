"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"

import { AuthCard } from "@/components/auth/auth-card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import type { OnboardingStatus, OnboardingStep } from "@/lib/types"

const STEP_LABELS: Record<OnboardingStep, string> = {
  idle: "준비 중...",
  fetching_favorites: "Tidal 즐겨찾기 가져오는 중...",
  matching_tracks: "트랙 매칭 중...",
  computing_embedding: "음악 취향 분석 중...",
  clustering: "페르소나 추출 중...",
  generating_mrt: "추천 생성 중...",
  done: "완료!",
  error: "오류",
}

export default function OnboardingPage() {
  const router = useRouter()
  const [status, setStatus] = useState<OnboardingStatus | null>(null)
  const startedRef = useRef(false)

  // 첫 진입 시 start 호출 (idempotent — 백엔드가 처리)
  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    void (async () => {
      try {
        await fetch("/api/onboarding/start", {
          method: "POST",
          credentials: "include",
        })
      } catch (e) {
        console.error("onboarding start failed", e)
      }
    })()
  }, [])

  // 1초마다 status 폴링 + done 시 /mrt redirect
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const r = await fetch("/api/onboarding/status", {
          credentials: "include",
        })
        if (r.status === 401) {
          router.push("/login")
          return
        }
        const data: OnboardingStatus = await r.json()
        setStatus(data)
        if (data.step === "done") {
          clearInterval(interval)
          setTimeout(() => router.push("/mrt"), 800)
        }
      } catch (e) {
        console.error("onboarding status polling failed", e)
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [router])

  async function handleRetry() {
    try {
      await fetch("/api/onboarding/start", {
        method: "POST",
        credentials: "include",
      })
    } catch (e) {
      console.error("onboarding retry failed", e)
    }
    setStatus(null)
  }

  const isError = status?.step === "error"
  const currentStep: OnboardingStep = status?.step ?? "idle"
  const progressValue = status?.progress ?? 0

  return (
    <AuthCard
      title={isError ? "준비 실패" : "추천 만드는 중"}
      description={isError ? undefined : "잠시만 기다려 주세요."}
    >
      {isError ? (
        <div className="flex flex-col gap-4">
          <p className="text-center text-sm text-destructive">
            {status?.error ?? "알 수 없는 오류가 발생했습니다."}
          </p>
          <Button onClick={handleRetry} className="w-full">
            다시 시도
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <p className="text-center text-base font-medium">
            {STEP_LABELS[currentStep]}
          </p>
          <Progress value={progressValue} className="w-full" />
          <p className="text-center text-sm text-muted-foreground">
            {status?.message ?? "시작 중..."}
          </p>
        </div>
      )}
    </AuthCard>
  )
}
