import type { SituationResponse } from "@/lib/types";

import { apiFetch } from "./http";

export async function fetchSituation(text: string): Promise<SituationResponse> {
  const r = await apiFetch(
    "/api/situation/recommendations",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    },
    "situation",
  );
  return (await r.json()) as SituationResponse;
}
