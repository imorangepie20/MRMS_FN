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
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);
  const [cols, setCols] = useState(8);

  const updateArrows = () => {
    const el = scrollerRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 2);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  };

  useEffect(() => {
    updateArrows();
    const el = scrollerRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateArrows, { passive: true });
    const ro = new ResizeObserver(updateArrows);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateArrows);
      ro.disconnect();
    };
  }, [section.items.length]);

  useEffect(() => {
    const compute = () => {
      const w = window.innerWidth;
      if (w >= 1280) setCols(8);
      else if (w >= 1024) setCols(7);
      else if (w >= 768) setCols(5);
      else if (w >= 640) setCols(4);
      else setCols(2);
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);

  const scrollByPage = (dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth, behavior: "smooth" });
  };

  return (
    <section className="mb-10">
      <div className="flex items-baseline justify-between mb-3 pb-2 border-b border-(--mrms-ink)">
        <div className="flex items-baseline gap-3 min-w-0">
          <h2 className="font-display font-bold text-[20px] text-(--mrms-ink) truncate">
            {section.display_title ?? section.section_key}
          </h2>
          <span className="font-mono text-[10px] tracking-editorial uppercase text-(--mrms-ink-mute)">
            {section.items.length} items
          </span>
        </div>

        <div className="flex gap-1 flex-shrink-0">
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
        className="flex overflow-x-auto pb-2 -mx-1.5 scroll-smooth snap-x snap-mandatory [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {section.items.map((it) => (
          <div
            key={it.id}
            className="shrink-0 snap-start px-1.5"
            style={{ width: `${100 / cols}%` }}
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
                  className="aspect-square w-full object-cover bg-(--mrms-rule)"
                />
              ) : (
                <div className="aspect-square w-full bg-(--mrms-rule) flex items-center justify-center font-mono text-[10px] text-(--mrms-ink-mute) uppercase">
                  {it.item_type}
                </div>
              )}
              <div className="mt-1 font-mono text-[9px] tracking-editorial uppercase text-(--mrms-ink-mute)">
                {it.item_type}
              </div>
              <div className="font-display text-[12px] text-(--mrms-ink) line-clamp-2">
                {it.title ?? it.item_id}
              </div>
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
