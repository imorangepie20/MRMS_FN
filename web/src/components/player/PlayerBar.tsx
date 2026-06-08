"use client";

import { Volume2 } from "lucide-react";
import { useEffect } from "react";

import { useUser } from "@/lib/hooks/use-user";
import { initPlayer, setSdkVolume } from "@/lib/player";
import { usePlayerStore } from "@/store/player";

import { NowPlaying } from "./NowPlaying";
import { PlayerControls } from "./PlayerControls";
import { QueueDrawer } from "./QueueDrawer";


function VolumeSlider() {
  const volume = usePlayerStore((s) => s.volume);
  return (
    <div className="flex items-center gap-2">
      <Volume2 className="h-4 w-4 text-muted-foreground" />
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(volume * 100)}
        onChange={async (e) => {
          const v = Number(e.target.value) / 100;
          usePlayerStore.setState({ volume: v });
          await setSdkVolume(v);
        }}
        className="w-20 h-1 accent-primary"
        aria-label="Volume"
      />
    </div>
  );
}


export function PlayerBar() {
  const errorMsg = usePlayerStore((s) => s.errorMsg);
  const premium = usePlayerStore((s) => s.premium);
  const sdkReady = usePlayerStore((s) => s.sdkReady);
  const { user } = useUser();

  useEffect(() => {
    if (!user) return;
    // Audio element 초기화 + sdkReady = true (백엔드 proxy 사용 — SDK init 불필요)
    (async () => {
      try {
        await initPlayer(user.primary_platform);
      } catch (e) {
        usePlayerStore.setState({ errorMsg: (e as Error).message });
      }
    })();
  }, [user]);

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
          <VolumeSlider />
          <QueueDrawer />
        </div>
      </div>
    </div>
  );
}
