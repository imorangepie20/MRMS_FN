import type { EmpStats, EmpSettings, IngestionRun } from "@/lib/types";

import { apiFetch } from "./http";

export async function fetchEmpStats(): Promise<EmpStats> {
  const r = await apiFetch("/api/admin/emp/stats", {}, "stats");
  return r.json();
}

export interface EmpRunsPage {
  runs: IngestionRun[];
  total: number;
  limit: number;
  offset: number;
}

export async function fetchEmpRuns(limit = 20, offset = 0): Promise<EmpRunsPage> {
  const r = await apiFetch(
    `/api/admin/emp/runs?limit=${limit}&offset=${offset}`,
    {},
    "runs",
  );
  return r.json();
}

export async function deleteEmpRun(runId: string): Promise<void> {
  await apiFetch(`/api/admin/emp/runs/${runId}`, { method: "DELETE" }, "delete run");
}

export async function pruneEmpRuns(keep: number): Promise<number> {
  const r = await apiFetch(
    "/api/admin/emp/runs/prune",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keep }),
    },
    "prune runs",
  );
  return (await r.json()).deleted as number;
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

export interface RunMrtResult {
  mode: "user" | "all";
  regenerated?: boolean;
  tracks_used?: number;
  discovery_count?: number;
  reason?: string;
  queued?: number;
}

export async function runMrt(
  target: "all" | "user",
  email?: string,
): Promise<RunMrtResult> {
  const r = await apiFetch(
    "/api/admin/emp/run-mrt",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target, email }),
    },
    "run mrt",
  );
  return r.json();
}
