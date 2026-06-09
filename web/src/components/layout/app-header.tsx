"use client";

import { usePathname } from "next/navigation";
import { allNavItems } from "@/lib/nav";


function findNavItem(pathname: string) {
  return allNavItems.find((item) => item.href === pathname);
}


export function AppHeader() {
  const pathname = usePathname();
  const current = findNavItem(pathname);
  const now = new Date();
  const updated = now.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return (
    <header className="sticky top-0 z-30 bg-[var(--mrms-bg)] border-b border-[var(--mrms-ink)] px-14">
      <div className="border-t-2 border-[var(--mrms-ink)] py-2.5 flex justify-between items-baseline font-mono text-[10px] tracking-editorial uppercase text-[var(--mrms-ink-soft)]">
        <span className="text-[var(--mrms-ink)]">
          {current ? (
            <>
              {current.num.replace("§ ", "Section ")}
              <span className="text-[var(--mrms-rust)] mx-1.5 normal-case tracking-normal">/</span>
              {current.italic ? (
                <em className="font-display not-italic text-[var(--mrms-rust)] normal-case tracking-normal text-sm">
                  {current.title}
                </em>
              ) : (
                <span className="text-[var(--mrms-ink)]">{current.title}</span>
              )}
            </>
          ) : (
            "MRMS"
          )}
        </span>
        <div className="flex gap-6 items-center">
          <span>Updated {updated} KST</span>
          <button
            onClick={() => window.location.reload()}
            className="text-[var(--mrms-rust)] hover:underline bg-transparent border-0 p-0 cursor-pointer font-mono text-[10px] tracking-editorial uppercase"
          >
            ↻ refresh
          </button>
        </div>
      </div>
    </header>
  );
}
