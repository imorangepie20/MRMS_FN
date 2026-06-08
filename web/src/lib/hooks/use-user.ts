"use client";

import useSWR from "swr";

import type { UserInfo } from "@/lib/types";


const fetcher = async (url: string): Promise<UserInfo> => {
  const r = await fetch(url, { credentials: "include" });
  if (r.status === 401) throw new Error("Unauthorized");
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
};


export function useUser() {
  const { data, error, isLoading, mutate } = useSWR<UserInfo>(
    "/api/auth/me",
    fetcher,
    { revalidateOnFocus: true, shouldRetryOnError: false },
  );
  return {
    user: data,
    isLoading,
    isAuthenticated: !!data,
    error,
    refresh: mutate,
  };
}
