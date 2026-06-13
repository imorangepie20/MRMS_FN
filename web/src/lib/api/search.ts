import type { SearchResponse } from "@/lib/types";

import { apiFetch } from "./http";

export async function search(q: string): Promise<SearchResponse> {
  const r = await apiFetch(
    `/api/search?q=${encodeURIComponent(q)}&types=track,album,playlist`,
    {},
    "search",
  );
  return (await r.json()) as SearchResponse;
}

export async function expandContainer(
  platform: string,
  itemType: "album" | "playlist",
  itemId: string,
): Promise<{ source_id: string; count: number }> {
  const r = await apiFetch(
    "/api/search/expand",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platform, item_type: itemType, item_id: itemId }),
    },
    "expand",
  );
  return (await r.json()) as { source_id: string; count: number };
}
