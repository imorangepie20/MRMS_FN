import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import type { MrtLatestResponse, UserInfo } from "@/lib/types";

export type { UserInfo } from "@/lib/types";


// SSR 전용 — 절대 URL로 백엔드에 직접 (브라우저에 노출되지 않도록 NEXT_PUBLIC_ 안 씀)
const API_BASE = process.env.INTERNAL_API_BASE ?? "http://127.0.0.1:8001/api";


async function authHeaders(): Promise<Record<string, string>> {
  const cookieStore = await cookies();
  const session = cookieStore.get("mrms_session");
  if (!session) redirect("/login");
  return { Cookie: `mrms_session=${session.value}` };
}


export async function getServerSideUser(): Promise<UserInfo> {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/auth/me`, {
    headers,
    cache: "no-store",
  });
  if (res.status === 401) redirect("/login");
  if (!res.ok) throw new Error(`/api/auth/me failed: ${res.status}`);
  return (await res.json()) as UserInfo;
}


// 루트 랜딩 분기용 — 미인증/401이면 redirect 없이 null 반환(getServerSideUser 미러).
export async function getServerSideUserOptional(): Promise<UserInfo | null> {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get("mrms_session");
    if (!session) return null; // 세션 쿠키 없음
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { Cookie: `mrms_session=${session.value}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as UserInfo;
  } catch {
    return null;
  }
}


export async function getServerSideMrt(): Promise<MrtLatestResponse> {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/mrt/latest`, {
    headers,
    cache: "no-store",
  });
  if (res.status === 401) redirect("/login");
  if (!res.ok) throw new Error(`/api/mrt/latest failed: ${res.status}`);
  return (await res.json()) as MrtLatestResponse;
}
