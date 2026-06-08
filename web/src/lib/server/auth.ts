import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import type { UserInfo } from "@/lib/types";


const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000/api";


export async function getServerSideUser(): Promise<UserInfo> {
  const cookieStore = await cookies();
  const session = cookieStore.get("mrms_session");
  if (!session) redirect("/login");

  const res = await fetch(`${API_BASE}/auth/me`, {
    headers: { Cookie: `mrms_session=${session.value}` },
    cache: "no-store",
  });
  if (res.status === 401) redirect("/login");
  if (!res.ok) throw new Error(`/api/auth/me failed: ${res.status}`);
  return (await res.json()) as UserInfo;
}
