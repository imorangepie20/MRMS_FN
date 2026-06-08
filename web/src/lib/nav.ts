import type { LucideIcon } from "lucide-react";
import { Sparkles } from "lucide-react";

export type NavItem = { title: string; href: string; icon?: LucideIcon };
export type NavGroup = { label: string; items: NavItem[] };

export const navGroups: NavGroup[] = [
  {
    label: "Recommendations",
    items: [
      { title: "MRT", href: "/mrt", icon: Sparkles },
    ],
  },
];

// e2e/smoke.spec.ts가 의존 — 모든 nav route iterate용
export const allNavItems: NavItem[] = navGroups.flatMap((g) => g.items);
