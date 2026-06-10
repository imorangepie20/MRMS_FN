"use client";

export function StatCell({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-(--mrms-bg) px-3 py-2.5">
      <div className="font-mono text-[9px] tracking-editorial uppercase text-(--mrms-ink-mute)">
        {label}
      </div>
      <div className="font-display font-medium text-[18px] md:text-[22px] leading-none mt-1 text-(--mrms-ink)">
        {value}
      </div>
    </div>
  );
}
