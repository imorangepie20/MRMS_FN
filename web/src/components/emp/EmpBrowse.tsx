"use client";

import { useEffect, useState } from "react";

import { fetchEmpSections } from "@/lib/api/emp";
import type { EmpSection, EmpSectionItem } from "@/lib/types";

import { SectionRow } from "./SectionRow";
import { ItemTracksModal } from "./ItemTracksModal";


export function EmpBrowse() {
  const [sections, setSections] = useState<EmpSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openItem, setOpenItem] = useState<EmpSectionItem | null>(null);

  useEffect(() => {
    let mounted = true;
    fetchEmpSections()
      .then((sec) => mounted && setSections(sec))
      .catch((e) => mounted && setError((e as Error).message))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="px-5 pt-6 pb-48 md:px-10 md:pt-10">
      <div className="flex justify-between items-baseline border-b border-(--mrms-rule) pb-2 mb-6 font-mono text-[10px] tracking-editorial uppercase text-(--mrms-ink-mute)">
        <span>Section § 02 · EMP</span>
        <span>{sections.length} sections</span>
      </div>

      <h1 className="font-display font-bold text-[32px] md:text-[40px] leading-tight text-(--mrms-ink) mb-4">
        External pool
      </h1>

      <div className="text-center my-8 md:my-12">
        <p className="font-display italic text-[24px] md:text-[36px] text-(--mrms-ink) leading-tight">
          Tidal is Good
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 border border-(--mrms-rust) text-(--mrms-rust) font-mono text-[11px]">
          {error}
        </div>
      )}

      {loading && (
        <div className="py-12 text-center font-mono text-[11px] tracking-editorial uppercase text-(--mrms-ink-mute)">
          — loading —
        </div>
      )}

      {!loading && sections.length === 0 && !error && (
        <div className="py-12 text-center font-mono text-[11px] tracking-editorial uppercase text-(--mrms-ink-mute)">
          — no sections yet, trigger import in /admin/emp —
        </div>
      )}

      {sections.map((sec) => (
        <SectionRow
          key={sec.id}
          section={sec}
          onItemClick={(it) => setOpenItem(it)}
        />
      ))}

      {openItem && (
        <ItemTracksModal item={openItem} onClose={() => setOpenItem(null)} />
      )}
    </div>
  );
}
