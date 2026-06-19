import { create } from "zustand";

/** tidal=HLS(playbackinfo) 재생, youtube=IFrame 임베드 재생. */
export type VideoSource = "tidal" | "youtube";

interface VideoPlayerState {
  videoId: string | null;
  title: string | null;
  source: VideoSource;
  open: (videoId: string, title: string, source?: VideoSource) => void;
  close: () => void;
}

export const useVideoPlayer = create<VideoPlayerState>((set) => ({
  videoId: null,
  title: null,
  source: "tidal",
  open: (videoId, title, source = "tidal") => set({ videoId, title, source }),
  close: () => set({ videoId: null, title: null, source: "tidal" }),
}));
