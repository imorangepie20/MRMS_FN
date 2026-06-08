import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import type { MrtLatestResponse, UserInfo } from "@/lib/types";


const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000/api";


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
