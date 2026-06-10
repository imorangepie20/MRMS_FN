import type { EmpStats, EmpSettings, IngestionRun } from "@/lib/types";

export async function fetchEmpStats(): Promise<EmpStats> {
  const r = await fetch("/api/admin/emp/stats", { credentials: "include" });
  if (!r.ok) throw new Error(`stats failed: ${r.status}`);
  return r.json();
}

export async function fetchEmpRuns(limit = 50): Promise<IngestionRun[]> {
  const r = await fetch(`/api/admin/emp/runs?limit=${limit}`, { credentials: "include" });
  if (!r.ok) throw new Error(`runs failed: ${r.status}`);
  return (await r.json()).runs as IngestionRun[];
}

export async function fetchEmpSettings(): Promise<EmpSettings> {
  const r = await fetch("/api/admin/emp/settings", { credentials: "include" });
  if (!r.ok) throw new Error(`settings failed: ${r.status}`);
  return r.json();
}

export async function saveEmpSetting(key: string, value: string | null): Promise<void> {
  const r = await fetch("/api/admin/emp/settings", {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, value }),
  });
  if (!r.ok) throw new Error(`save failed: ${r.status}`);
}

export async function triggerEmpImport(platform: string = "all"): Promise<void> {
  const r = await fetch("/api/admin/emp/trigger", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ platform }),
  });
  if (!r.ok) throw new Error(`trigger failed: ${r.status}`);
}
