"use client";

import { useState } from "react";
import { Search, X } from "lucide-react";

import { search } from "@/lib/api/search";
import type { SearchResponse } from "@/lib/types";
import { SearchResults } from "@/components/search/SearchResults";
import {
  SearchEmptyState,
  SearchIdle,
  SearchSkeleton,
} from "@/components/search/SearchStates";

export default function SearchPage() {
  const [q, setQ] = useState("");
  const [submitted, setSubmitted] = useState(""); // data를 만든 쿼리(echo용)
  const [data, setData] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (term: string) => {
    const query = term.trim();
    if (!query) return;
    setQ(query);
    setSubmitted(query);
    setLoading(true);
    setError(null);
    try {
      setData(await search(query));
    } catch (err) {
      setError((err as Error).message);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void run(q);
  };

  const total = data
    ? data.tracks.length + data.albums.length + data.playlists.length
    : 0;

  return (
    <div className="px-6 py-8 md:px-14">
      {/* masthead */}
      <header className="mb-6 border-b border-(--mrms-rule) pb-4">
        <div className="font-display text-[28px] font-bold leading-none text-(--mrms-ink)">
          SEARCH
        </div>
        <div className="mt-1.5 font-mono text-[10px] uppercase tracking-editorial-wide text-(--mrms-ink-mute)">
          Tidal · Spotify 라이브 검색 → EMP 확장
        </div>
      </header>

      {/* input */}
      <form onSubmit={onSubmit} className="mb-8">
        <div className="relative max-w-xl border-b border-(--mrms-ink) transition-colors focus-within:border-(--mrms-rust)">
          <Search
            className="pointer-events-none absolute left-0 top-1/2 size-4 -translate-y-1/2 text-(--mrms-ink-mute)"
            strokeWidth={1.6}
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="트랙 · 앨범 · 플레이리스트 검색"
            autoFocus
            className="w-full bg-transparent py-2.5 pl-7 pr-16 font-display text-[18px] outline-none placeholder:text-(--mrms-ink-mute)"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ("")}
              aria-label="지우기"
              className="absolute right-9 top-1/2 -translate-y-1/2 cursor-pointer border-0 bg-transparent p-0 text-(--mrms-ink-mute) hover:text-(--mrms-rust)"
            >
              <X className="size-3.5" />
            </button>
          )}
          <span className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 font-mono text-[9px] uppercase tracking-editorial text-(--mrms-ink-mute)">
            Enter
          </span>
        </div>
      </form>

      {/* states */}
      {loading && <SearchSkeleton />}

      {!loading && error && (
        <div className="font-mono text-[11px] text-(--mrms-rust)">{error}</div>
      )}

      {!loading && !error && data === null && <SearchIdle onPick={run} />}

      {!loading && !error && data && total === 0 && (
        <SearchEmptyState query={submitted} skipped={data.skipped_platforms} />
      )}

      {!loading && !error && data && total > 0 && (
        <>
          <div className="mb-6 font-mono text-[11px] text-(--mrms-ink-mute)">
            <span className="text-(--mrms-ink)">&ldquo;{submitted}&rdquo;</span> —{" "}
            {data.tracks.length} tracks · {data.albums.length} albums ·{" "}
            {data.playlists.length} playlists
            {data.skipped_platforms.length > 0 && (
              <>
                {" · "}
                <span className="text-(--mrms-rust)">
                  {data.skipped_platforms.join(", ")} 미연동
                </span>
              </>
            )}
          </div>
          <SearchResults data={data} />
        </>
      )}
    </div>
  );
}
