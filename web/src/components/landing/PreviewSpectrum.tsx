"use client";

import { useEffect, useRef } from "react";

import { BAR_COUNT, binsToBarHeights } from "@/lib/spectrum";

const MIN_VISIBLE_PCT = 2;
const VSCALE = 1.2;

type Ctx = { ctx: AudioContext; analyser: AnalyserNode };

export function PreviewSpectrum({
  audioRef,
  active,
}: {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  active: boolean;
}) {
  const barRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const heightsRef = useRef<number[]>(Array.from({ length: BAR_COUNT }, () => 0));
  const ctxRef = useRef<Ctx | null>(null);

  useEffect(() => {
    if (!active) return;
    const el = audioRef.current;
    if (!el) return;

    if (!ctxRef.current) {
      try {
        const W = window as typeof window & { webkitAudioContext?: typeof AudioContext };
        const AC = window.AudioContext ?? W.webkitAudioContext;
        if (!AC) return;
        const ctx = new AC();
        const src = ctx.createMediaElementSource(el); // element당 1회
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = 0;
        analyser.minDecibels = -90;
        analyser.maxDecibels = -10;
        src.connect(analyser);
        analyser.connect(ctx.destination); // 필수(안 하면 무음)
        ctxRef.current = { ctx, analyser };
      } catch {
        return; // Web Audio 미지원/CORS 등 → 스펙트럼만 생략(오디오는 element가 재생)
      }
    }

    const { ctx, analyser } = ctxRef.current;
    if (ctx.state === "suspended") void ctx.resume();
    const bins = new Uint8Array(analyser.frequencyBinCount);
    let frameId = 0;
    let stopped = false;

    const tick = () => {
      if (stopped) return;
      analyser.getByteFrequencyData(bins);
      const heights = binsToBarHeights(bins, heightsRef.current);
      heightsRef.current = heights;
      for (let i = 0; i < BAR_COUNT; i++) {
        const b = barRefs.current[i];
        if (b) b.style.height = `${Math.min(100, Math.max(MIN_VISIBLE_PCT, heights[i] * 100 * VSCALE))}%`;
      }
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => {
      stopped = true;
      cancelAnimationFrame(frameId);
    };
  }, [active, audioRef]);

  return (
    <div aria-hidden className="flex items-end justify-center gap-[2px] h-full w-full pointer-events-none">
      {Array.from({ length: BAR_COUNT }, (_, i) => (
        <span
          key={i}
          ref={(n) => {
            barRefs.current[i] = n;
          }}
          className="block flex-1 max-w-[10px] rounded-t-[1px] bg-(--mrms-rust)"
          style={{ height: `${MIN_VISIBLE_PCT}%` }}
        />
      ))}
    </div>
  );
}
