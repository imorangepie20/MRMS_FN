"use client";

import { useState, type ReactNode } from "react";

import { pickVisual, hashIndex } from "@/lib/visuals";

/** 분리된 사진 제목 블록. 사진은 imageKey(없으면 title) 해시로 일관 배정, 좌→우 피치 그라데로 제목 가독성.
 *  imageKey: 카운트 등 가변값이 섞인 title(예: "Tracks — 8")에서 안정 키를 따로 넘겨 이미지 흔들림 방지. */
export function SectionMasthead({
  kicker,
  title,
  meta,
  action,
  imageKey,
}: {
  kicker?: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  action?: ReactNode;
  imageKey?: string;
}) {
  const src = pickVisual(hashIndex(imageKey ?? String(title)));
  const [failed, setFailed] = useState(false);
  return (
    <div className="relative overflow-hidden border border-(--mrms-ink) mt-8 mb-5 min-h-[132px] flex items-end px-5 py-4">
      {!failed && (
        <img
          src={src}
          alt=""
          aria-hidden
          onError={() => setFailed(true)}
          decoding="async"
          className="absolute inset-0 w-full h-full object-cover"
          style={{ objectPosition: "center 42%", filter: "saturate(1.5) contrast(1.07) brightness(1.02)" }}
        />
      )}
      <div aria-hidden className="absolute inset-0" style={{ background: "rgba(214,138,66,0.18)", mixBlendMode: "soft-light" }} />
      <div aria-hidden className="absolute inset-0" style={{ background: "linear-gradient(105deg, rgba(243,230,216,.93) 24%, rgba(243,230,216,.5) 50%, rgba(243,230,216,.05) 82%)" }} />
      <div className="relative flex-1 min-w-0">
        {kicker && (
          <div className="font-mono text-[10px] tracking-editorial uppercase text-(--mrms-rust)">{kicker}</div>
        )}
        <div className="font-serif font-bold text-[clamp(24px,3.4vw,38px)] leading-[1.04] text-(--mrms-ink) truncate">
          {title}
        </div>
        {meta && <div className="font-mono text-[11px] text-(--mrms-ink-soft) mt-1">{meta}</div>}
      </div>
      {action && <div className="relative shrink-0 self-center ml-3">{action}</div>}
    </div>
  );
}
