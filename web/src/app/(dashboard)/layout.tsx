import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppHeader } from "@/components/layout/app-header";
import { PlayerBar } from "@/components/player/PlayerBar";


export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[240px_1fr] min-h-screen bg-[var(--mrms-bg)]">
      <AppSidebar />
      <div className="flex flex-col min-h-screen">
        <AppHeader />
        <main className="flex-1 pb-32">{children}</main>
      </div>
      <PlayerBar />
    </div>
  );
}
