import type { ImportResult } from "@/lib/types";

import { apiFetch } from "./http";

export async function importUrl(url: string): Promise<ImportResult> {
  const r = await apiFetch(
    "/api/import/url",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    },
    "import",
  );
  return (await r.json()) as ImportResult;
}
