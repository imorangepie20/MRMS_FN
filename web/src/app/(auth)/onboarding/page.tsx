"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"

import { AuthCard } from "@/components/auth/auth-card"
import { YouTubePlaylistPicker } from "@/components/auth/YouTubePlaylistPicker"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Spinner } from "@/components/ui/spinner"
import type {
  OnboardingAction,
  OnboardingPrecheck,
  OnboardingStatus,
  OnboardingStep,
} from "@/lib/types"

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

// 화면 단계: precheck 결과를 받기 전 / import picker / 진행(start+폴링) / connect 안내
type Phase = "precheck" | "import" | "running" | "connect"

export default function OnboardingPage() {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>("precheck")
  const [status, setStatus] = useState<OnboardingStatus | null>(null)
  const startedRef = useRef(false)

  // start 호출 (idempotent — 백엔드가 처리). running phase 진입 시 사용.
  const startOnboarding = useCallback(async () => {
    try {
      await fetch("/api/onboarding/start", {
        method: "POST",
        credentials: "include",
      })
    } catch (e) {
      console.error("onboarding start failed", e)
    }
  }, [])

  // precheck → 흐름 분기. 첫 진입과 에러 후 재분기 양쪽에서 재사용한다.
  // 에러 후 호출되면 분석 가능한 트랙이 없는 YouTube 사용자는 "import"로
  // 라우팅돼 picker로 돌아갈 수 있다 (영구 루프 탈출, blocker #1).
  const routeByPrecheck = useCallback(async () => {
    try {
      const r = await fetch("/api/onboarding/precheck", {
        credentials: "include",
      })
      if (r.status === 401) {
        router.push("/login")
        return
      }
      const data: OnboardingPrecheck = await r.json()
      const action: OnboardingAction = data.action
      switch (action) {
        case "ready":
          router.push("/mrt")
          return
        case "import":
          setStatus(null)
          setPhase("import")
          return
        case "connect":
          setStatus(null)
          setPhase("connect")
          return
        case "run":
        default:
          setStatus(null)
          setPhase("running")
          void startOnboarding()
          return
      }
    } catch (e) {
      // precheck 실패 시 기존 동작 유지 — start + 폴링으로 진행.
      console.error("onboarding precheck failed", e)
      setPhase("running")
      void startOnboarding()
    }
  }, [router, startOnboarding])

  // 첫 진입 시 precheck로 흐름 분기 (1회)
  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    void routeByPrecheck()
  }, [routeByPrecheck])

  // running phase에서만 status 폴링 + done 시 /mrt redirect
  useEffect(() => {
    if (phase !== "running") return
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
  }, [phase, router])

  // 에러 후 재시도 — 단순 start 재호출이 아니라 precheck로 재분기한다.
  // 분석 가능한 트랙이 없으면(YouTube all-miss / K 미만) "import"로 가 picker를
  // 다시 보여줘 영구 루프를 끊는다 (blocker #1).
  async function handleRetry() {
    setStatus(null)
    await routeByPrecheck()
  }

  // 에러 화면에서 곧장 플레이리스트 가져오기로 (트랙 부족 시 탈출구).
  function handleBackToImport() {
    setStatus(null)
    setPhase("import")
  }

  // import 완료 → 추천 생성으로 전환
  const handleImported = useCallback(() => {
    setPhase("running")
    void startOnboarding()
  }, [startOnboarding])

  // ─── connect: 음악 플랫폼 연결 안내 ───────────────────────────────
  if (phase === "connect") {
    return (
      <AuthCard
        title="음악 플랫폼을 먼저 연결하세요"
        description="추천을 만들려면 음악 플랫폼 연결 또는 플레이리스트 import가 필요합니다."
      >
        <Button onClick={() => router.push("/login")} className="w-full">
          음악 플랫폼 연결하기
        </Button>
      </AuthCard>
    )
  }

  // ─── import: YouTube 플레이리스트 picker ──────────────────────────
  if (phase === "import") {
    return (
      <AuthCard
        title="플레이리스트 가져오기"
        description="추천을 만들 음악 플레이리스트를 선택하세요."
      >
        <YouTubePlaylistPicker
          onImported={handleImported}
          onUnauthorized={() => setPhase("connect")}
        />
      </AuthCard>
    )
  }

  // ─── precheck: 분기 결정 대기 ─────────────────────────────────────
  if (phase === "precheck") {
    return (
      <AuthCard title="추천 만드는 중" description="잠시만 기다려 주세요.">
        <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
          <Spinner />
          준비 중...
        </div>
      </AuthCard>
    )
  }

  // ─── running: 기존 start + 폴링 UI (보존) ─────────────────────────
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
          {/* 트랙 부족으로 실패한 경우의 탈출구 — picker로 돌아가 다시 가져오기.
              handleRetry(precheck 재분기)가 보통 "import"로 보내지만, 사용자가
              직접 picker로 갈 수 있는 명시적 경로도 남겨 영구 루프를 막는다. */}
          <Button
            onClick={handleBackToImport}
            variant="outline"
            className="w-full"
          >
            플레이리스트 다시 가져오기
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
