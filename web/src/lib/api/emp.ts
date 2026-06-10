import type { EmpSection, EmpItemTrack } from "@/lib/types";

export async function fetchEmpSections(platform = "tidal"): Promise<EmpSection[]> {
  const r = await fetch(`/api/emp/sections?platform=${platform}`, { credentials: "include" });
  if (!r.ok) throw new Error(`sections failed: ${r.status}`);
  return (await r.json()).sections as EmpSection[];
}

export async function fetchEmpItemTracks(
  itemType: "playlist" | "album" | "mix",
  itemId: string,
  limit = 100,
): Promise<EmpItemTrack[]> {
  const r = await fetch(
    `/api/emp/items/${itemType}/${encodeURIComponent(itemId)}/tracks?limit=${limit}`,
    { credentials: "include" },
  );
  if (!r.ok) throw new Error(`item tracks failed: ${r.status}`);
  return (await r.json()).tracks as EmpItemTrack[];
}
