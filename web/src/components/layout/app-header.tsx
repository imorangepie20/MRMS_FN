"use client";

import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { allNavItems } from "@/lib/nav";


function findNavItem(pathname: string) {
  return allNavItems.find((item) => item.href === pathname);
}


export function AppHeader({
  onMenuClick,
  menuOpen,
}: {
  onMenuClick?: () => void;
  menuOpen?: boolean;
} = {}) {
  const pathname = usePathname();
  const current = findNavItem(pathname);
  const now = new Date();
  const updated = now.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return (
    <header className="sticky top-0 z-30 bg-[var(--mrms-bg)] border-b border-[var(--mrms-ink)] px-5 md:px-14">
      <div className="border-t-2 border-[var(--mrms-ink)] py-2.5 flex justify-between items-baseline font-mono text-[10px] tracking-editorial uppercase text-[var(--mrms-ink-soft)] gap-3">
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            aria-label="menu"
            className="md:hidden inline-flex items-center bg-transparent border-0 p-0 cursor-pointer text-[var(--mrms-ink)] shrink-0"
          >
            {menuOpen ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        )}
        <span className="text-[var(--mrms-ink)]">
          {current ? (
            <>
              {current.num.replace("§ ", "Section ")}
              <span className="text-[var(--mrms-rust)] mx-1.5 normal-case tracking-normal">/</span>
              <span className="font-display font-semibold normal-case tracking-normal text-[13px] text-[var(--mrms-ink)]">
                {current.title}
              </span>
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
