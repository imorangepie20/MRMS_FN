"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/** 섹션 한 줄 = 가로 스크롤 캐러셀. ‹ › 버튼은 한 화면 폭만큼 부드럽게 슬라이드,
 *  양 끝에선 비활성화. 자식 = 고정폭 슬라이드 카드들. */
export function SectionCarousel({
  title,
  countLabel,
  children,
}: {
  title: string;
  countLabel: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  const measure = () => {
    const el = ref.current;
    if (!el) return;
    setEdges({
      left: el.scrollLeft > 2,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 2,
    });
  };

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const slide = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: "smooth" });
  };

  const arrowCls =
    "grid place-items-center size-7 border border-(--mrms-ink) text-(--mrms-ink) transition-colors " +
    "enabled:hover:bg-(--mrms-ink) enabled:hover:text-(--mrms-paper) enabled:cursor-pointer " +
    "disabled:opacity-25 disabled:cursor-default";

  return (
    <section className="mb-10">
      <div className="mb-3 flex items-end justify-between gap-4 border-b border-(--mrms-ink) pb-1">
        <h2 className="font-display font-bold text-(--mrms-ink) leading-[1.05] tracking-[-0.015em] text-[20px] md:text-[26px]">
          {title}
        </h2>
        <div className="flex items-center gap-2 shrink-0 pb-1">
          <span className="font-mono text-[10px] tracking-editorial uppercase text-(--mrms-ink-mute) tabular-nums">
            {countLabel}
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => slide(-1)}
              disabled={!edges.left}
              aria-label="이전"
              className={arrowCls}
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => slide(1)}
              disabled={!edges.right}
              aria-label="다음"
              className={arrowCls}
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      </div>
      {/* 한 줄 가로 스크롤 — 스크롤바 숨김, 카드 단위 스냅. */}
      <div
        ref={ref}
        onScroll={measure}
        className="flex gap-3 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
    </section>
  );
}
