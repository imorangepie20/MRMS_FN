"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { AuthCard } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function LoginContent() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      });
      if (r.status === 401) {
        setError("이메일 또는 비밀번호가 올바르지 않습니다.");
        return;
      }
      if (!r.ok) {
        setError("로그인에 실패했습니다. 잠시 후 다시 시도해주세요.");
        return;
      }
      // 플랫폼 미연결이면 서버 게이트가 /connect로 보냄.
      router.push("/");
      router.refresh();
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthCard
      title="로그인"
      description="이메일과 비밀번호로 로그인하세요"
      footer={
        <span className="text-muted-foreground">
          계정이 없으신가요?{" "}
          <Link href="/register" className="text-foreground underline-offset-4 hover:underline font-medium">
            회원가입
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
          <Label htmlFor="email">이메일</Label>
          <Input id="email" type="email" autoComplete="email" required
                 value={email} onChange={(e) => setEmail(e.target.value)} placeholder="m@example.com" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">비밀번호</Label>
          <Input id="password" type="password" autoComplete="current-password" required
                 value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <Button type="submit" className="w-full mt-1" disabled={busy}>
          {busy ? "로그인 중..." : "로그인"}
        </Button>
      </form>
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
