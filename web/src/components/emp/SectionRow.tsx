"use client";

import type { EmpSection, EmpSectionItem } from "@/lib/types";


export function SectionRow({
  section,
  onItemClick,
}: {
  section: EmpSection;
  onItemClick: (it: EmpSectionItem) => void;
}) {
  return (
    <section className="mb-10">
      <div className="flex items-baseline justify-between mb-3 pb-2 border-b border-(--mrms-ink)">
        <h2 className="font-display font-bold text-[20px] text-(--mrms-ink)">
          {section.display_title ?? section.section_key}
        </h2>
        <span className="font-mono text-[10px] tracking-editorial uppercase text-(--mrms-ink-mute)">
          {section.items.length} items · {section.platform}
        </span>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 -mx-2 px-2">
        {section.items.map((it) => (
          <button
            key={it.id}
            onClick={() => onItemClick(it)}
            className="flex-shrink-0 w-[140px] md:w-[160px] text-left bg-transparent border-0 p-0 cursor-pointer"
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
        ))}
      </div>
    </section>
  );
}
