export type NavItem = {
  title: string;
  href: string;
  num: string;          // "§ 01", "L1" 등 editorial 번호 라벨
  badge?: string;       // 우측 카운트/상태
  italic?: boolean;     // serif italic 강조
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export const navGroups: NavGroup[] = [
  {
    label: "Sections",
    items: [
      { title: "MRT", href: "/mrt", num: "§ 01", italic: true, badge: "50" },
      { title: "EMP", href: "/emp", num: "§ 02", badge: "2.4k" },
      { title: "PGT", href: "/pgt", num: "§ 03", italic: true, badge: "42" },
      { title: "PCT", href: "/pct", num: "§ 04", badge: "9" },
    ],
  },
  {
    label: "Library",
    items: [
      { title: "Liked", href: "/library/liked", num: "L1", badge: "35" },
      { title: "Playlists", href: "/library/playlists", num: "L2", italic: true, badge: "6" },
      { title: "Albums", href: "/library/albums", num: "L3", badge: "12" },
      { title: "Artists", href: "/library/artists", num: "L4", badge: "28" },
      { title: "Recent", href: "/library/recent", num: "L5", badge: "∞" },
    ],
  },
  {
    label: "Discover",
    items: [
      { title: "Search", href: "/search", num: "D1", italic: true, badge: "⌘K" },
      { title: "Charts", href: "/charts", num: "D2", badge: "—" },
      { title: "Editor's picks", href: "/picks", num: "D3", badge: "·" },
    ],
  },
  {
    label: "Settings",
    items: [
      { title: "Connections", href: "/settings/connections", num: "S1", badge: "2/2" },
      { title: "Preferences", href: "/settings/preferences", num: "S2", badge: "·" },
      { title: "About", href: "/about", num: "S3", badge: "v0.7" },
    ],
  },
];

// e2e/smoke.spec.ts가 의존 — 모든 nav route iterate용
export const allNavItems: NavItem[] = navGroups.flatMap((g) => g.items);
