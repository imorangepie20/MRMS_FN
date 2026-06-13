"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navGroups } from "@/lib/nav";
import { useUser } from "@/lib/hooks/use-user";


export function AppSidebar() {
  const pathname = usePathname();
  const { user } = useUser();
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, ".").slice(2);

  return (
    <aside className="flex h-screen w-60 flex-col border-r border-[var(--mrms-ink)] bg-[var(--mrms-bg)] sticky top-0">
      {/* Brand head */}
      <div className="px-6 pt-7 pb-5 border-b border-[var(--mrms-rule)]">
        <Link href="/mrt" className="block">
          <div className="font-display font-bold text-[20px] leading-none text-[var(--mrms-ink)] mb-1.5">
            MRMS
          </div>
          <div className="font-mono text-[9px] tracking-editorial-wide uppercase text-[var(--mrms-ink-mute)]">
            Music Rec · {today}
          </div>
        </Link>
      </div>

      {/* Scrollable nav */}
      <nav className="flex-1 overflow-y-auto px-6 py-4 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-[var(--mrms-rule)]">
        {navGroups.map((group) => (
          <div key={group.label} className="mb-5 last:mb-0">
            <div className="flex justify-between items-baseline pb-1.5 mb-1.5 border-b border-[var(--mrms-rule)]">
              <span className="font-mono text-[9px] tracking-editorial-wide uppercase text-[var(--mrms-ink-mute)]">
                {group.label}
              </span>
              <span className="font-mono text-[9px] text-[var(--mrms-rust)]">
                {group.items.length}
              </span>
            </div>
            {group.items.map((item) => {
              const active = pathname === item.href;
              return (
                <div key={item.href}>
                  <Link
                    href={item.href}
                    className="relative grid grid-cols-[32px_1fr_auto] gap-1 items-baseline py-1.5 border-b border-[var(--mrms-rule)]/50 last:border-b-0 transition-[padding] hover:pl-1"
                  >
                    {active && (
                      <span
                        aria-hidden
                        className="absolute -left-6 top-1/2 w-3.5 h-px bg-[var(--mrms-rust)]"
                      />
                    )}
                    <span
                      className={`font-mono text-[10px] tracking-editorial ${active ? "text-[var(--mrms-rust)]" : "text-[var(--mrms-ink-mute)]"}`}
                    >
                      {item.num}
                    </span>
                    <span className="min-w-0">
                      <span
                        className={`font-display text-[14px] leading-tight ${active ? "text-[var(--mrms-ink)] font-semibold" : "text-[var(--mrms-ink-soft)] font-medium"}`}
                      >
                        {item.title}
                      </span>
                      {item.full && (
                        <span className="block font-mono text-[8px] tracking-editorial uppercase leading-tight truncate text-[var(--mrms-ink-mute)]">
                          {item.full}
                        </span>
                      )}
                    </span>
                    {item.badge && (
                      <span className="font-mono text-[9px] text-[var(--mrms-ink-mute)]">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                  {item.children && (
                    <div className="pl-8 mt-0.5 mb-1 flex flex-col">
                      {item.children.map((sub) => (
                        <Link
                          key={sub.href}
                          href={sub.href}
                          className="py-0.5 font-mono text-[10px] tracking-editorial text-[var(--mrms-ink-mute)] no-underline hover:text-[var(--mrms-rust)]"
                        >
                          {sub.title}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Sidebar foot */}
      <div className="px-6 py-4 border-t border-[var(--mrms-rule)]">
        <div className="flex gap-1.5 mb-2.5">
          <span className="font-mono text-[8px] tracking-editorial uppercase border border-[var(--mrms-ink)] bg-[var(--mrms-ink)] text-[var(--mrms-paper)] px-1.5 py-0.5">
            Tidal HiFi
          </span>
          <span className="font-mono text-[8px] tracking-editorial uppercase border border-[var(--mrms-ink)] bg-[var(--mrms-ink)] text-[var(--mrms-paper)] px-1.5 py-0.5">
            Spotify
          </span>
        </div>
        <div
          className="font-display font-semibold text-[15px] text-[var(--mrms-ink)] leading-tight truncate"
          title={user?.displayName || ""}
        >
          {user?.displayName || "—"}
        </div>
        <div
          className="font-mono text-[9px] text-[var(--mrms-ink-mute)] tracking-[0.05em] mt-0.5 truncate"
          title={user?.email || ""}
        >
          {user?.email || ""}
        </div>
        <div className="flex gap-3 mt-2 font-mono text-[10px]">
          <Link href="/profile" className="text-[var(--mrms-ink-soft)] hover:text-[var(--mrms-rust)] no-underline">
            profile
          </Link>
          <button
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
              window.location.href = "/login";
            }}
            className="text-[var(--mrms-ink-soft)] hover:text-[var(--mrms-rust)] bg-transparent border-0 p-0 cursor-pointer font-mono text-[10px]"
          >
            logout
          </button>
        </div>
      </div>
    </aside>
  );
}
