import { create } from "zustand";

/** 비디오 플레이리스트 카드 클릭 시 영상 모달 open/close 전역 상태. */
interface VideoPlaylistState {
  uuid: string | null;
  title: string | null;
  open: (uuid: string, title: string) => void;
  close: () => void;
}

export const useVideoPlaylist = create<VideoPlaylistState>((set) => ({
  uuid: null,
  title: null,
  open: (uuid, title) => set({ uuid, title }),
  close: () => set({ uuid: null, title: null }),
}));
