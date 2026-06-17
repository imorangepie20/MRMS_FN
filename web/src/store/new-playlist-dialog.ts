import { create } from "zustand";

interface NewPlaylistDialogState {
  open: boolean;
  initialTrackIds: string[];
  openDialog: (trackIds?: string[]) => void;
  close: () => void;
}

export const useNewPlaylistDialog = create<NewPlaylistDialogState>((set) => ({
  open: false,
  initialTrackIds: [],
  openDialog: (trackIds = []) => set({ open: true, initialTrackIds: trackIds }),
  close: () => set({ open: false, initialTrackIds: [] }),
}));
