"use client";

import { useState } from "react";

import { EmpItemCard } from "@/components/emp/EmpItemCard";
import type { EmpSection } from "@/lib/types";


export function SectionsTree({ sections }: { sections: EmpSection[] }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <section className="mb-10">
      <h2 className="font-display font-bold text-[20px] mb-3 pb-2 border-b border-(--mrms-ink)">
        Sections ({sections.length})
      </h2>
      {sections.map((sec, idx) => {
        const open = openIdx === idx;
        return (
          <div key={sec.id} className="border-b border-(--mrms-rule)">
            <button
              onClick={() => setOpenIdx(open ? null : idx)}
              className="w-full text-left grid grid-cols-[140px_1fr_60px_80px] gap-3 py-2.5 items-baseline bg-transparent border-0 cursor-pointer font-mono text-[11px]"
            >
              <span className="text-(--mrms-ink) font-medium truncate">{sec.section_key}</span>
              <span className="text-(--mrms-ink-soft) truncate">{sec.display_title}</span>
              <span className="text-(--mrms-ink-mute)">{sec.items.length} items</span>
              <span className="text-(--mrms-ink-mute)">{open ? "−" : "+"}</span>
            </button>
            {open && (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 pb-4">
                {sec.items.map((item) => (
                  <EmpItemCard
                    key={item.id}
                    item={item}
                    coverClassName="aspect-square w-full"
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
