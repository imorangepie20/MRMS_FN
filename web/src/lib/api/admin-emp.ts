import type { EmpStats, EmpSettings, IngestionRun } from "@/lib/types";

import { apiFetch } from "./http";

export async function fetchEmpStats(): Promise<EmpStats> {
  const r = await apiFetch("/api/admin/emp/stats", {}, "stats");
  return r.json();
}

export async function fetchEmpRuns(limit = 50): Promise<IngestionRun[]> {
  const r = await apiFetch(`/api/admin/emp/runs?limit=${limit}`, {}, "runs");
  return (await r.json()).runs as IngestionRun[];
}

export async function fetchEmpSettings(): Promise<EmpSettings> {
  const r = await apiFetch("/api/admin/emp/settings", {}, "settings");
  return r.json();
}

export async function saveEmpSetting(key: string, value: string | null): Promise<void> {
  await apiFetch(
    "/api/admin/emp/settings",
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value }),
    },
    "save",
  );
}

export async function triggerEmpImport(platform: string = "all"): Promise<void> {
  await apiFetch(
    "/api/admin/emp/trigger",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platform }),
    },
    "trigger",
  );
}
