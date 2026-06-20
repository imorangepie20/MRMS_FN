import { create } from "zustand";

/** tidal=HLS(playbackinfo) 재생, youtube=IFrame 임베드 재생. */
export type VideoSource = "tidal" | "youtube";

interface VideoPlayerState {
  videoId: string | null;
  title: string | null;
  source: VideoSource;
  /** true=코너 미니플레이어(PiP), false=중앙 극장. 같은 미디어 인스턴스 유지. */
  pip: boolean;
  open: (videoId: string, title: string, source?: VideoSource) => void;
  setPip: (pip: boolean) => void;
  close: () => void;
}

export const useVideoPlayer = create<VideoPlayerState>((set) => ({
  videoId: null,
  title: null,
  source: "tidal",
  pip: false,
  open: (videoId, title, source = "tidal") => set({ videoId, title, source, pip: false }),
  setPip: (pip) => set({ pip }),
  close: () => set({ videoId: null, title: null, source: "tidal", pip: false }),
}));
