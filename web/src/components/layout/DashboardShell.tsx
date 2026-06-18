"use client";

import { useEffect, useState } from "react";

import { ArtistIntroModal } from "@/components/artist/ArtistIntroModal";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppHeader } from "@/components/layout/app-header";
import { PlayerBar } from "@/components/player/PlayerBar";
import { PlaylistActionsContext } from "@/components/playlist/playlist-actions-context";
import { NewPlaylistDialog } from "@/components/playlist/NewPlaylistDialog";
import { TrackContextMenu } from "@/components/playlist/TrackContextMenu";
import { usePlaylistStore } from "@/store/playlist";

/** 앱 크롬(사이드바·헤더·플레이어 + 플레이리스트 컨텍스트/다이얼로그/우클릭메뉴).
 *  (dashboard) 레이아웃과 로그인 메인 홈이 공유한다. */
export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const loadPlaylists = usePlaylistStore((s) => s.load);
  useEffect(() => {
    loadPlaylists();
  }, [loadPlaylists]);

  return (
    <PlaylistActionsContext.Provider value={true}>
      <div className="md:grid md:grid-cols-[240px_minmax(0,1fr)] min-h-screen bg-[var(--mrms-bg)]">
        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-[var(--mrms-ink)]/30 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar — desktop static, mobile slide-over */}
        <div
          className={`fixed inset-y-0 left-0 z-50 transition-transform md:static md:translate-x-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
          }`}
        >
          <AppSidebar />
        </div>

        <div className="flex flex-col min-h-screen">
          <AppHeader onMenuClick={() => setSidebarOpen((v) => !v)} menuOpen={sidebarOpen} />
          <main className="flex-1 pb-32 md:pb-36">{children}</main>
        </div>
        <PlayerBar />
        <ArtistIntroModal />
        <NewPlaylistDialog />
        <TrackContextMenu />
      </div>
    </PlaylistActionsContext.Provider>
  );
}
