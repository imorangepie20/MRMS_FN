"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import type { EmpSection, EmpSectionItem } from "@/lib/types";


export function SectionRow({
  section,
  onItemClick,
}: {
  section: EmpSection;
  onItemClick: (it: EmpSectionItem) => void;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);
  const [cols, setCols] = useState(8);
  const [itemPx, setItemPx] = useState(150);

  const updateArrows = () => {
    const el = scrollerRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 2);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  };

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    const compute = () => {
      const vw = window.innerWidth;
      // viewport - sidebar - page padding 으로 사용 가능 폭 계산
      // sidebar 240px (md+), 0 (mobile). EmpBrowse padding px-5(40)/md:px-10(80)
      const isDesktop = vw >= 768;
      const sidebar = isDesktop ? 240 : 0;
      const padding = isDesktop ? 80 : 40;
      const available = vw - sidebar - padding;

      // cols: 정확히 N개 보이도록
      let c = 8;
      if (vw < 640) c = 2;
      else if (vw < 768) c = 3;
      else if (vw < 1024) c = 4;
      else if (vw < 1280) c = 6;

      setCols(c);
      // wrapper 너비 = available / cols (padding 포함)
      const wrapper = Math.floor(available / c);
      // image = wrapper - left/right px-1.5 (12px 총)
      const px = Math.max(wrapper - 12, 80);
      setItemPx(px);
      updateArrows();
    };

    compute();
    el.addEventListener("scroll", updateArrows, { passive: true });
    const ro = new ResizeObserver(updateArrows);
    ro.observe(el);
    window.addEventListener("resize", compute);
    return () => {
      el.removeEventListener("scroll", updateArrows);
      ro.disconnect();
      window.removeEventListener("resize", compute);
    };
  }, [section.items.length]);

  const scrollByPage = (dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    // 8개 단위 슬라이딩 (wrapper width = itemPx + 12)
    el.scrollBy({ left: dir * (itemPx + 12) * cols, behavior: "smooth" });
  };

  return (
    <section ref={sectionRef}>
      <div className="flex items-baseline justify-between mb-3 pb-2 border-b border-(--mrms-ink)">
        <div className="flex items-baseline gap-3 min-w-0">
          <h2 className="font-display font-bold text-[20px] text-(--mrms-ink) truncate">
            {section.display_title ?? section.section_key}
          </h2>
          <span className="font-mono text-[10px] tracking-editorial uppercase text-(--mrms-ink-mute)">
            {section.items.length} items
          </span>
        </div>

        <div className="flex gap-1 shrink-0">
          <button
            onClick={() => scrollByPage(-1)}
            disabled={!canLeft}
            aria-label="previous"
            className="size-7 flex items-center justify-center bg-transparent border border-(--mrms-rule) text-(--mrms-ink-soft) cursor-pointer disabled:opacity-30 disabled:cursor-default hover:bg-(--mrms-bg)"
          >
            <ChevronLeft className="size-3.5" />
          </button>
          <button
            onClick={() => scrollByPage(1)}
            disabled={!canRight}
            aria-label="next"
            className="size-7 flex items-center justify-center bg-transparent border border-(--mrms-rule) text-(--mrms-ink-soft) cursor-pointer disabled:opacity-30 disabled:cursor-default hover:bg-(--mrms-bg)"
          >
            <ChevronRight className="size-3.5" />
          </button>
        </div>
      </div>

      <div
        ref={scrollerRef}
        className="flex w-full overflow-x-auto pb-2 -mx-1.5 scroll-smooth snap-x snap-mandatory [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {section.items.map((it) => (
          <div
            key={it.id}
            className="shrink-0 snap-start px-1.5"
            style={{ width: `${itemPx + 12}px` }}
          >
            <button
              onClick={() => onItemClick(it)}
              className="w-full text-left bg-transparent border-0 p-0 cursor-pointer"
            >
              {it.cover_url ? (
                <img
                  src={it.cover_url}
                  alt={it.title ?? ""}
                  loading="lazy"
                  style={{ width: `${itemPx}px`, height: `${itemPx}px` }}
                  className="object-cover bg-(--mrms-rule)"
                />
              ) : (
                <div
                  style={{ width: `${itemPx}px`, height: `${itemPx}px` }}
                  className="bg-(--mrms-rule) flex items-center justify-center font-mono text-[10px] text-(--mrms-ink-mute) uppercase"
                >
                  {it.item_type}
                </div>
              )}
              <div className="mt-1 font-mono text-[9px] tracking-editorial uppercase text-(--mrms-ink-mute)">
                {it.item_type}
              </div>
              <div
                className="font-display text-[12px] text-(--mrms-ink) truncate"
                title={it.title ?? it.item_id}
              >
                {it.title ?? it.item_id}
              </div>
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
