"use client"

import { useState } from "react"

import { AuthCard } from "@/components/auth/auth-card"
import { TidalConnectModal } from "@/components/auth/TidalConnectModal"
import { Button } from "@/components/ui/button"

export default function LoginPage() {
  const [open, setOpen] = useState(false)

  return (
    <AuthCard
      title="MRMS — 개인 맞춤 추천"
      description="Tidal 계정으로 시작하세요. 좋아요 누른 곡을 기반으로 추천을 만들어 드립니다."
    >
      <div className="flex flex-col gap-4">
        <Button
          onClick={() => setOpen(true)}
          className="w-full"
          size="lg"
        >
          Tidal로 시작하기
        </Button>
      </div>
      <TidalConnectModal open={open} onOpenChange={setOpen} />
    </AuthCard>
  )
}
