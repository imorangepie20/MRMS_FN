"use client";

import { useEffect } from "react";

import { getTidalToken } from "@/lib/api";
import { initTidalSdk } from "@/lib/tidal-player";
import { usePlayerStore } from "@/store/player";

import { NowPlaying } from "./NowPlaying";
import { PlayerControls } from "./PlayerControls";


export function PlayerBar() {
  const errorMsg = usePlayerStore((s) => s.errorMsg);
  const premium = usePlayerStore((s) => s.premium);
  const sdkReady = usePlayerStore((s) => s.sdkReady);
  const isPreview = usePlayerStore((s) => s.isPreview);

  useEffect(() => {
    (async () => {
      try {
        const t = await getTidalToken();
        usePlayerStore.setState({ premium: t.premium });
        if (t.premium === false) {
          usePlayerStore.setState({
            errorMsg: "Tidal Premium 구독이 필요합니다",
          });
          return;
        }
        await initTidalSdk({
          access_token: t.access_token,
          expires_at: t.expires_at,
        });
      } catch (e) {
        const err = e as Error;
        if (err.message.includes("404")) {
          usePlayerStore.setState({
            errorMsg:
              "Tidal 연동이 필요합니다 — scripts/08_onboard_tidal.py 실행",
          });
        } else {
          usePlayerStore.setState({ errorMsg: err.message });
        }
      }
    })();
  }, []);

  return (
    <div className="fixed bottom-0 left-0 right-0 h-16 md:h-20 bg-background border-t z-50">
      {/* 알림 영역 — PlayerBar 위에 */}
      {errorMsg && (
        <div className="absolute bottom-full left-0 right-0 px-4 py-2 bg-destructive text-destructive-foreground text-xs flex items-center gap-2">
          <span className="flex-1">{errorMsg}</span>
          <button
            onClick={() => usePlayerStore.setState({ errorMsg: null })}
            className="underline shrink-0"
          >
            닫기
          </button>
        </div>
      )}
      {!sdkReady && !errorMsg && premium !== false && (
        <div className="absolute bottom-full left-0 right-0 px-4 py-1 bg-muted text-muted-foreground text-xs">
          플레이어 초기화 중…
        </div>
      )}

      <div className="flex items-center h-full px-2 md:px-4 gap-2 md:gap-4">
        <NowPlaying className="flex-1 min-w-0 max-w-[40%] md:max-w-[30%]" />
        <PlayerControls compact={true} />
        <div className="hidden md:flex items-center gap-2 shrink-0">
          {/* Volume + QueueButton — Task 8에서 추가 */}
        </div>
      </div>
    </div>
  );
}
