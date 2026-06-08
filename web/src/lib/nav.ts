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
