"use client";

import { useState } from "react";

import { search } from "@/lib/api/search";
import type { SearchResponse } from "@/lib/types";
import { SearchResults } from "@/components/search/SearchResults";

export default function SearchPage() {
  const [q, setQ] = useState("");
  const [data, setData] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = q.trim();
    if (!query) return;
    setLoading(true);
    setError(null);
    try {
      setData(await search(query));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="px-6 md:px-14 py-8">
      <form onSubmit={onSubmit} className="mb-6">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="트랙 · 앨범 · 플레이리스트 검색"
          className="w-full max-w-xl border-b border-[var(--mrms-ink)] bg-transparent py-2 font-display text-[18px] outline-none placeholder:text-[var(--mrms-ink-mute)]"
        />
      </form>
      {loading && <div className="font-mono text-[11px] text-[var(--mrms-ink-mute)]">검색 중…</div>}
      {error && <div className="font-mono text-[11px] text-[var(--mrms-rust)]">{error}</div>}
      {data && <SearchResults data={data} />}
    </div>
  );
}
