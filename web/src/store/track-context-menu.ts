import { create } from "zustand";

interface TrackContextMenuState {
  open: boolean;
  x: number;
  y: number;
  trackId: string | null;
  openAt: (x: number, y: number, trackId: string) => void;
  close: () => void;
}

export const useTrackContextMenu = create<TrackContextMenuState>((set) => ({
  open: false,
  x: 0,
  y: 0,
  trackId: null,
  openAt: (x, y, trackId) => set({ open: true, x, y, trackId }),
  close: () => set({ open: false, trackId: null }),
}));
