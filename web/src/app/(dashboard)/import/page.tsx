"use client";

import { useState } from "react";

import { importUrl } from "@/lib/api/import";
import type { ImportResult } from "@/lib/types";
import { ModalTrackList, PlayAllButton } from "@/components/track/ModalTrackList";
import { TrackListPlaylistMenu } from "@/components/playlist/TrackListPlaylistMenu";
import { SectionMasthead } from "@/components/visual/SectionMasthead";

export default function ImportPage() {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const u = url.trim();
    if (!u) return;
    setLoading(true);
    setError(null);
    try {
      setResult(await importUrl(u));
    } catch (e) {
      setError((e as Error).message);
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const tracks = result?.tracks ?? [];

  return (
    <div className="px-6 py-8 md:px-14">
      <SectionMasthead
        className="mb-6"
        kicker="D6 · Import"
        title="Eat The Shared"
        meta="공유 링크 붙여넣고 바로 듣기 — Tidal · Spotify (track · playlist · album)"
        imageKey="Eat The Shared"
      />

      <div className="mb-8 flex gap-2">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder="https://open.spotify.com/playlist/…  또는  https://tidal.com/playlist/…"
          className="min-w-0 flex-1 border border-(--mrms-rule) bg-transparent px-4 py-3 font-mono text-[13px] text-(--mrms-ink) placeholder:text-(--mrms-ink-mute) focus:border-(--mrms-rust) focus:outline-none"
        />
        <button
          type="button"
          onClick={submit}
          disabled={loading || !url.trim()}
          className="shrink-0 cursor-pointer border-0 bg-(--mrms-rust) px-4 py-2 font-mono text-[10px] uppercase tracking-editorial text-(--mrms-paper) disabled:cursor-default disabled:opacity-40"
        >
          {loading ? "가져오는 중…" : "가져오기"}
        </button>
      </div>

      {error && <div className="font-mono text-[11px] text-(--mrms-rust)">{error}</div>}

      {result && !loading && (
        tracks.length > 0 ? (
          <>
            <div className="mb-3 flex items-center justify-between gap-3 border-b border-(--mrms-rule) pb-2">
              <span className="min-w-0 truncate font-display text-[15px] font-semibold text-(--mrms-ink)">
                {result.title ?? `${tracks.length} tracks`}
              </span>
              <div className="flex shrink-0 items-center gap-2">
                <PlayAllButton tracks={tracks} />
                <TrackListPlaylistMenu trackIds={tracks.map((t) => t.track_id)} />
              </div>
            </div>
            <ModalTrackList tracks={tracks} />
          </>
        ) : (
          <div className="font-mono text-[11px] text-(--mrms-ink-mute)">트랙 없음</div>
        )
      )}
    </div>
  );
}
