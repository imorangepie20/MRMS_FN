"use client";

import { useState } from "react";

import { fetchWellness } from "@/lib/api/wellness";
import type { WellnessTrack } from "@/lib/types";
import { ModalTrackList, PlayAllButton } from "@/components/track/ModalTrackList";
import { TrackListPlaylistMenu } from "@/components/playlist/TrackListPlaylistMenu";
import { SectionMasthead } from "@/components/visual/SectionMasthead";

const MOODS: { key: string; label: string; sub: string }[] = [
  { key: "calm", label: "이완", sub: "Calm" },
  { key: "energize", label: "활력", sub: "Energize" },
  { key: "focus", label: "집중", sub: "Focus" },
  { key: "sleep", label: "수면 보조", sub: "Sleep" },
];

export default function WellnessPage() {
  const [active, setActive] = useState<string | null>(null);
  const [tracks, setTracks] = useState<WellnessTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async (mood: string) => {
    setActive(mood);
    setLoading(true);
    setError(null);
    try {
      setTracks((await fetchWellness(mood)).tracks);
    } catch (e) {
      setError((e as Error).message);
      setTracks([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="px-6 py-8 md:px-14">
      <SectionMasthead
        className="mb-6"
        kicker="D4 · Wellness"
        title="chicken soup clinic"
        meta="무드를 고르면 그 정서에 맞는 곡을 취향 순으로 — 기분 전환 · 이완 · 집중"
        imageKey="chicken soup clinic"
      />

      <div className="mb-8 flex flex-wrap gap-2">
        {MOODS.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => pick(m.key)}
            className={`cursor-pointer border px-4 py-2 font-display text-[15px] transition-colors ${
              active === m.key
                ? "border-(--mrms-rust) text-(--mrms-rust)"
                : "border-(--mrms-rule) text-(--mrms-ink-soft) hover:border-(--mrms-rust) hover:text-(--mrms-rust)"
            }`}
          >
            {m.label}
            <span className="ml-2 font-mono text-[9px] uppercase tracking-editorial text-(--mrms-ink-mute)">
              {m.sub}
            </span>
          </button>
        ))}
      </div>

      {loading && (
        <div className="font-mono text-[11px] text-(--mrms-ink-mute)">추천 곡 불러오는 중…</div>
      )}
      {error && <div className="font-mono text-[11px] text-(--mrms-rust)">{error}</div>}
      {!loading && !error && active && tracks.length === 0 && (
        <div className="font-mono text-[11px] text-(--mrms-ink-mute)">추천 결과 없음</div>
      )}
      {!loading && !error && tracks.length > 0 && (
        <>
          <div className="mb-3 flex items-center justify-between border-b border-(--mrms-rule) pb-2">
            <span className="font-mono text-[11px] uppercase tracking-editorial text-(--mrms-ink-mute)">
              {tracks.length} tracks
            </span>
            <div className="flex items-center gap-2">
              <PlayAllButton tracks={tracks} />
              <TrackListPlaylistMenu trackIds={tracks.map((t) => t.track_id)} />
            </div>
          </div>
          <ModalTrackList tracks={tracks} />
        </>
      )}
    </div>
  );
}
