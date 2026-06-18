"use client";

import { useState } from "react";

import { pickVisual } from "@/lib/visuals";

export interface MosaicItem {
  title: string;
  meta?: string;
}

/** 2열(모바일 1열) 사진 카드 — 각 셀 사진(인덱스) + 하단 다크 그라데 + Fraunces 라벨. */
export function PhotoMosaic({ items }: { items: MosaicItem[] }) {
  if (!items.length) return null;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-10">
      {items.map((it, i) => (
        <Cell key={i} item={it} index={i} />
      ))}
    </div>
  );
}

function Cell({ item, index }: { item: MosaicItem; index: number }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="relative h-[150px] overflow-hidden border border-(--mrms-rule)">
      {!failed && (
        <img
          src={pickVisual(index)}
          alt=""
          aria-hidden
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ filter: "saturate(1.45) contrast(1.05)" }}
        />
      )}
      <div aria-hidden className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(31,26,22,.62), transparent 58%)" }} />
      <div className="absolute left-4 bottom-3 right-4 text-(--mrms-paper)">
        <div className="font-serif font-semibold text-[17px] leading-tight truncate">{item.title}</div>
        {item.meta && <div className="font-mono text-[9px] tracking-editorial uppercase opacity-85 mt-0.5 truncate">{item.meta}</div>}
      </div>
    </div>
  );
}
