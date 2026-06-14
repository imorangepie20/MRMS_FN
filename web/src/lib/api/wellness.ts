import type { WellnessResponse } from "@/lib/types";

import { apiFetch } from "./http";

export async function fetchWellness(mood: string): Promise<WellnessResponse> {
  const r = await apiFetch(
    `/api/wellness/recommendations?mood=${encodeURIComponent(mood)}`,
    {},
    "wellness",
  );
  return (await r.json()) as WellnessResponse;
}
