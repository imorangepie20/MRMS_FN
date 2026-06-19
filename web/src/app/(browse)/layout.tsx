import { DashboardShell } from "@/components/layout/DashboardShell";

/** 비회원도 접근 가능한 브라우즈 영역(EMP 등).
 *  (dashboard) 레이아웃과 달리 로그인/플랫폼 연결을 강제하지 않는다 —
 *  셸·사이드바·플레이어는 게스트(useUser=null)를 견디고, 액션은 로그인을 유도한다. */
export default function BrowseLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>;
}
