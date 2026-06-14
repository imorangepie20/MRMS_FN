"use client";

import { useState } from "react";

import { fetchSituation } from "@/lib/api/situation";
import type { SituationResponse } from "@/lib/types";
import { ModalTrackList, PlayAllButton } from "@/components/track/ModalTrackList";

export default function SituationPage() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<SituationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const t = text.trim();
    if (!t) return;
    setLoading(true);
    setError(null);
    try {
      setResult(await fetchSituation(t));
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
      <header className="mb-6 border-b border-(--mrms-rule) pb-4">
        <div className="font-display text-[28px] font-bold leading-none text-(--mrms-ink)">
          situation desk
        </div>
        <div className="mt-1.5 font-mono text-[10px] uppercase tracking-editorial-wide text-(--mrms-ink-mute)">
          상황을 적으면 그 장면에 맞는 곡을 — LLM이 읽고 해석
        </div>
      </header>

      <div className="mb-8">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={400}
          rows={3}
          placeholder="예: 비 오는 일요일 아침, 혼자 커피 마시며 책 읽기"
          className="w-full resize-none border border-(--mrms-rule) bg-transparent px-4 py-3 font-display text-[15px] text-(--mrms-ink) placeholder:text-(--mrms-ink-mute) focus:border-(--mrms-rust) focus:outline-none"
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="font-mono text-[9px] uppercase tracking-editorial text-(--mrms-ink-mute)">
            {text.length}/400
          </span>
          <button
            type="button"
            onClick={submit}
            disabled={loading || !text.trim()}
            className="cursor-pointer border-0 bg-(--mrms-rust) px-4 py-2 font-mono text-[10px] uppercase tracking-editorial text-(--mrms-paper) disabled:cursor-default disabled:opacity-40"
          >
            {loading ? "해석 중…" : "추천받기"}
          </button>
        </div>
      </div>

      {error && <div className="font-mono text-[11px] text-(--mrms-rust)">{error}</div>}

      {result && !loading && (
        <>
          <div className="mb-4 border-b border-(--mrms-rule) pb-3">
            <div className="font-display text-[18px] font-semibold text-(--mrms-ink)">
              {result.mood_label}
            </div>
            <div className="mt-1 font-display text-[14px] italic text-(--mrms-ink-soft)">
              {result.interpretation}
            </div>
          </div>
          {tracks.length > 0 ? (
            <>
              <div className="mb-3 flex items-center justify-between border-b border-(--mrms-rule) pb-2">
                <span className="font-mono text-[11px] uppercase tracking-editorial text-(--mrms-ink-mute)">
                  {tracks.length} tracks
                </span>
                <PlayAllButton tracks={tracks} />
              </div>
              <ModalTrackList tracks={tracks} />
            </>
          ) : (
            <div className="font-mono text-[11px] text-(--mrms-ink-mute)">추천 결과 없음</div>
          )}
        </>
      )}
    </div>
  );
}
