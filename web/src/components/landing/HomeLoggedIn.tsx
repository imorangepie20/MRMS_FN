// web/src/components/landing/HomeLoggedIn.tsx (Task 3 stub — Task 4에서 구현)
import type { UserInfo } from "@/lib/server/auth";
import { LandingHero } from "./LandingHero";
export function HomeLoggedIn({ user }: { user: UserInfo }) {
  return (
    <div>
      <LandingHero />
      <div className="px-6 md:px-14 py-8 font-mono text-[11px] tracking-editorial uppercase text-(--mrms-ink-mute)">
        Welcome, {user.displayName ?? user.email}
      </div>
    </div>
  );
}
