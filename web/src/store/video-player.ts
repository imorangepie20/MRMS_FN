import { create } from "zustand";

interface VideoPlayerState {
  videoId: string | null;
  title: string | null;
  open: (videoId: string, title: string) => void;
  close: () => void;
}

export const useVideoPlayer = create<VideoPlayerState>((set) => ({
  videoId: null,
  title: null,
  open: (videoId, title) => set({ videoId, title }),
  close: () => set({ videoId: null, title: null }),
}));
