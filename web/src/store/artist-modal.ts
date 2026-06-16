import { create } from "zustand";

interface ArtistModalState {
  name: string | null;
  open: (name: string) => void;
  close: () => void;
}

export const useArtistModal = create<ArtistModalState>((set) => ({
  name: null,
  open: (name) => set({ name }),
  close: () => set({ name: null }),
}));
