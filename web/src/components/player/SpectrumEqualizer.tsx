"use client";

import { useEffect, useRef } from "react";

import { BAR_COUNT, binsToBarHeights } from "@/lib/spectrum";
import { getTidalAnalyser } from "@/lib/tidal-player";
import { usePlayerStore } from "@/store/player";

const MIN_VISIBLE_PCT = 2;

export function SpectrumEqualizer() {
  const activePlatform = usePlayerStore((s) => s.activePlatform);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const show = activePlatform === "tidal" && isPlaying;

  const barRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const heightsRef = useRef<number[]>(
    Array.from({ length: BAR_COUNT }, () => 0),
  );

  useEffect(() => {
    if (!show) return;
    const analyser = getTidalAnalyser();
    if (!analyser) return;

    const bins = new Uint8Array(analyser.frequencyBinCount);
    let frameId = 0;
    let stopped = false;

    const tick = () => {
      if (stopped) return;
      analyser.getByteFrequencyData(bins);
      const heights = binsToBarHeights(bins, heightsRef.current);
      heightsRef.current = heights;
      for (let i = 0; i < BAR_COUNT; i++) {
        const el = barRefs.current[i];
        if (el) {
          el.style.height = `${Math.max(MIN_VISIBLE_PCT, heights[i] * 100)}%`;
        }
      }
      frameId = requestAnimationFrame(tick);
    };

    // 백그라운드 탭이면 정지, 복귀하면 재가동(cancel 만이 아니라 re-arm).
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        cancelAnimationFrame(frameId);
      } else if (!stopped) {
        frameId = requestAnimationFrame(tick);
      }
    };

    frameId = requestAnimationFrame(tick);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stopped = true;
      cancelAnimationFrame(frameId);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [show]);

  if (!show) return null;

  return (
    <div
      aria-hidden
      className="absolute bottom-full left-0 right-0 h-10 flex items-end justify-center gap-[2px] px-4 md:px-14 pointer-events-none"
    >
      {Array.from({ length: BAR_COUNT }, (_, i) => (
        <span
          key={i}
          ref={(node) => {
            barRefs.current[i] = node;
          }}
          className="block flex-1 max-w-[10px] rounded-t-[1px] bg-[var(--mrms-rust)]"
          style={{ height: `${MIN_VISIBLE_PCT}%` }}
        />
      ))}
    </div>
  );
}
