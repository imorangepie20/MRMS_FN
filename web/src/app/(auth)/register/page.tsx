"use client";

import { useState } from "react";
import Link from "next/link";

import { AuthCard } from "@/components/auth/auth-card";
import { PlatformConnect } from "@/components/auth/PlatformConnect";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function RegisterPage() {
  const [step, setStep] = useState<1 | 2>(1);
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("비밀번호는 8자 이상이어야 합니다.");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname, email, password }),
        credentials: "include",
      });
      if (r.status === 409) {
        const d = await r.json();
        setError(d.detail === "nickname_taken" ? "이미 사용 중인 닉네임입니다." : "이미 가입된 이메일입니다.");
        return;
      }
      if (r.status === 422) {
        setError("입력값을 확인해주세요(닉네임 2–20자, 올바른 이메일, 비밀번호 8자 이상).");
        return;
      }
      if (!r.ok) {
        setError("가입에 실패했습니다. 잠시 후 다시 시도해주세요.");
        return;
      }
      setStep(2); // 세션 발급됨 → 플랫폼 연결 단계
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  }

  if (step === 2) {
    return (
      <AuthCard
        title="음악 플랫폼 연결"
        description="추천과 재생을 위해 스트리밍 플랫폼을 1개 이상 연결하세요."
      >
        <PlatformConnect next="/onboarding" />
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="회원가입"
      footer={
        <span className="text-muted-foreground">
          이미 계정이 있으신가요?{" "}
          <Link href="/login" className="text-foreground underline-offset-4 hover:underline font-medium">
            로그인
          </Link>
        </span>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && (
          <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="nickname">닉네임</Label>
          <Input id="nickname" type="text" autoComplete="nickname" required minLength={2} maxLength={20}
                 value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="2–20자" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">이메일</Label>
          <Input id="email" type="email" autoComplete="email" required
                 value={email} onChange={(e) => setEmail(e.target.value)} placeholder="m@example.com" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">비밀번호</Label>
          <Input id="password" type="password" autoComplete="new-password" required minLength={8}
                 value={password} onChange={(e) => setPassword(e.target.value)} placeholder="8자 이상" />
        </div>
        <div className="flex items-start gap-2">
          <Checkbox id="terms" checked={agreed}
                    onCheckedChange={(c) => setAgreed(!!c)} className="mt-0.5" />
          <Label htmlFor="terms" className="font-normal cursor-pointer leading-snug">
            <Link href="#" className="underline underline-offset-4 hover:text-foreground">이용약관</Link>
            {" 및 "}
            <Link href="#" className="underline underline-offset-4 hover:text-foreground">개인정보처리방침</Link>
            에 동의합니다
          </Label>
        </div>
        <Button type="submit" className="w-full mt-1" disabled={busy || !agreed}>
          {busy ? "처리 중..." : "다음 — 플랫폼 연결"}
        </Button>
      </form>
    </AuthCard>
  );
}
