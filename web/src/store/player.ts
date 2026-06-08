import { create } from "zustand";


export type QueueTrack = {
  track_id: string;
  tidal_track_id: string;
  title: string;
  artist: string;
  album_title: string | null;
};


export type PlayerState = {
  // 상태
  queue: QueueTrack[];
  currentIdx: number;
  isPlaying: boolean;
  position: number;       // 0~1 진행률
  durationSec: number;
  volume: number;          // 0~1
  premium: boolean | null;
  sdkReady: boolean;
  errorMsg: string | null;
  isPreview: boolean;       // PREVIEW 재생 중인지 (FULL access 없을 때)

  // 액션 (setter 위주, async 로직은 SDK wrapper에서)
  setQueue: (tracks: QueueTrack[], startIdx: number) => void;
  setIsPlaying: (b: boolean) => void;
  setPosition: (p: number) => void;
  setDuration: (s: number) => void;
  setVolume: (v: number) => void;
  setPremium: (p: boolean | null) => void;
  setSdkReady: (r: boolean) => void;
  setError: (msg: string | null) => void;
  setIsPreview: (b: boolean) => void;
  jumpTo: (idx: number) => void;
  reset: () => void;
};


export const usePlayerStore = create<PlayerState>((set) => ({
  queue: [],
  currentIdx: 0,
  isPlaying: false,
  position: 0,
  durationSec: 0,
  volume: 0.8,
  premium: null,
  sdkReady: false,
  errorMsg: null,
  isPreview: false,

  setQueue: (tracks, startIdx) =>
    set({
      queue: tracks,
      currentIdx: Math.max(0, Math.min(startIdx, tracks.length - 1)),
      position: 0,
    }),
  setIsPlaying: (b) => set({ isPlaying: b }),
  setPosition: (p) => set({ position: Math.max(0, Math.min(1, p)) }),
  setDuration: (s) => set({ durationSec: s }),
  setVolume: (v) => set({ volume: Math.max(0, Math.min(1, v)) }),
  setPremium: (p) => set({ premium: p }),
  setSdkReady: (r) => set({ sdkReady: r }),
  setError: (msg) => set({ errorMsg: msg }),
  setIsPreview: (b) => set({ isPreview: b }),
  jumpTo: (idx) =>
    set((s) => ({
      currentIdx: Math.max(0, Math.min(idx, s.queue.length - 1)),
      position: 0,
    })),
  reset: () =>
    set({
      queue: [],
      currentIdx: 0,
      isPlaying: false,
      position: 0,
      durationSec: 0,
    }),
}));
