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
  className = "mt-8 mb-5",
}: {
  kicker?: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  action?: ReactNode;
  imageKey?: string;
  /** 바깥 여백 등 오버라이드(기본 mt-8 mb-5). 페이지 최상단에선 "mb-6"처럼 상단 여백 제거. */
  className?: string;
}) {
  const src = pickVisual(hashIndex(imageKey ?? String(title)));
  const [failed, setFailed] = useState(false);
  return (
    <div className={`relative overflow-hidden border border-(--mrms-ink) ${className} min-h-[132px] flex items-end px-5 py-4`}>
      {!failed && (
        <img
          src={src}
          alt=""
          aria-hidden
          onError={() => setFailed(true)}
          decoding="async"
          className="absolute inset-0 w-full h-full object-cover"
          style={{ objectPosition: "center 45%", filter: "saturate(1.6) contrast(1.12) brightness(1.0)" }}
        />
      )}
      <div aria-hidden className="absolute inset-0" style={{ background: "rgba(214,138,66,0.16)", mixBlendMode: "soft-light" }} />
      {/* 사진을 살리되 좌측 제목 영역만 은은히 받쳐줌(우측 ~50%는 사진 그대로 노출) */}
      <div aria-hidden className="absolute inset-0" style={{ background: "linear-gradient(100deg, rgba(243,230,216,.92) 1%, rgba(243,230,216,.42) 28%, rgba(243,230,216,.04) 55%, rgba(243,230,216,0) 78%)" }} />
      <div className="relative flex-1 min-w-0" style={{ textShadow: "0 1px 10px rgba(243,230,216,.55)" }}>
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
