import type { MrtLatestResponse, UserInfo } from "./types";


const BASE = process.env.NEXT_PUBLIC_API_BASE ?? "/api";


async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  // Server Component 환경에선 절대 URL 필요할 수 있음
  // 같은 origin에서 routing되므로 base는 / 시작 path
  const url = path.startsWith("http") ? path : `${BASE}${path}`;
  const r = await fetch(url, { cache: "no-store", ...init });
  if (!r.ok) {
    throw new Error(`API ${url}: ${r.status}`);
  }
  return r.json() as Promise<T>;
}


export function getUser(): Promise<UserInfo> {
  return fetchJson<UserInfo>("/user");
}


export function getMrtLatest(): Promise<MrtLatestResponse> {
  return fetchJson<MrtLatestResponse>("/mrt/latest");
}
