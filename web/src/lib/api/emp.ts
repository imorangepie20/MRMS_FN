import type { EmpSection, EmpItemTrack, EmpItemType } from "@/lib/types";

import { apiFetch } from "./http";

export async function fetchEmpSections(platform?: string): Promise<EmpSection[]> {
  const qs = platform ? `?platform=${encodeURIComponent(platform)}` : "";
  const r = await apiFetch(`/api/emp/sections${qs}`, {}, "sections");
  return (await r.json()).sections as EmpSection[];
}

export async function fetchEmpItemTracks(
  itemType: EmpItemType,
  itemId: string,
  limit = 100,
): Promise<EmpItemTrack[]> {
  const r = await apiFetch(
    `/api/emp/items/${itemType}/${encodeURIComponent(itemId)}/tracks?limit=${limit}`,
    {},
    "item tracks",
  );
  return (await r.json()).tracks as EmpItemTrack[];
}
