export type NavSubItem = {
  title: string;
  href: string;         // /pgt?tab=liked 처럼 쿼리로 섹션 지정
};

export type NavItem = {
  title: string;
  href: string;
  num: string;          // "§ 01", "L1" 등 editorial 번호 라벨
  full?: string;        // 약자(title)의 원래 메뉴명 — 사이드바에 부제로 표시
  badge?: string;       // 우측 카운트/상태
  children?: NavSubItem[];  // 사이드바 서브메뉴
  minRole?: "admin" | "superadmin";  // 이 역할 이상만 사이드바 노출
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export const navGroups: NavGroup[] = [
  {
    label: "Sections",
    items: [
      { title: "EMP", href: "/emp", num: "§ 01", full: "External Music Pool", badge: "2.4k" },
      { title: "MRT", href: "/mrt", num: "§ 02", full: "Model Recommendation Tracks", badge: "50" },
      {
        title: "PGT", href: "/pgt", num: "§ 03", full: "Personal Generated Tracks", badge: "42",
        children: [
          { title: "Liked", href: "/pgt?tab=liked" },
          { title: "Playlists", href: "/pgt?tab=playlists" },
          { title: "Albums", href: "/pgt?tab=albums" },
          { title: "Artists", href: "/pgt?tab=artists" },
          { title: "PCT", href: "/pgt?tab=pct" },
        ],
      },
      { title: "Videos", href: "/videos", num: "§ 04", full: "Tidal Music Videos", badge: "MV" },
    ],
  },
  {
    label: "Discover",
    items: [
      { title: "Situation", href: "/situation", num: "D1", full: "situation desk", badge: "·" },
      { title: "Wellness", href: "/wellness", num: "D2", full: "chicken soup clinic", badge: "·" },
      { title: "Search", href: "/search", num: "D3", badge: "⌘K" },
      { title: "Import", href: "/import", num: "D4", full: "Eat The Shared", badge: "·" },
    ],
  },
  {
    label: "Settings",
    items: [
      { title: "Connections", href: "/settings/connections", num: "S1", badge: "2/2" },
      { title: "Preferences", href: "/settings/preferences", num: "S2", badge: "·" },
      { title: "EMP admin", href: "/admin/emp", num: "S3", badge: "·", minRole: "admin" },
      { title: "회원 관리", href: "/admin/users", num: "S4", badge: "·", minRole: "superadmin" },
      { title: "About", href: "/about", num: "S5", badge: "v0.7" },
    ],
  },
];

// e2e/smoke.spec.ts가 의존 — 모든 nav route iterate용
export const allNavItems: NavItem[] = navGroups.flatMap((g) => g.items);
