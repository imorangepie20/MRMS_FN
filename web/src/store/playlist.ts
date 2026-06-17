import { toast } from "sonner";
import { create } from "zustand";

import {
  addTracksToPlaylist,
  createPlaylist,
  deletePlaylist,
  listPlaylists,
  updatePlaylist,
  type PlaylistMeta,
} from "@/lib/api/playlists";

interface PlaylistState {
  playlists: PlaylistMeta[];
  loaded: boolean;
  load: () => Promise<void>;
  create: (name: string, trackIds?: string[]) => Promise<PlaylistMeta | null>;
  addTrack: (playlistId: string, trackId: string) => Promise<void>;
  rename: (id: string, name: string, description?: string | null) => Promise<void>;
  remove: (id: string) => Promise<void>;
  bumpCount: (id: string, delta: number) => void;
}

export const usePlaylistStore = create<PlaylistState>((set, get) => ({
  playlists: [],
  loaded: false,

  load: async () => {
    try {
      const playlists = await listPlaylists();
      set({ playlists, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },

  create: async (name, trackIds = []) => {
    try {
      const pl = await createPlaylist(name, null, trackIds);
      set((s) => ({
        playlists: [{ ...pl, track_count: trackIds.length }, ...s.playlists],
      }));
      toast.success(`'${name}' 만들었어요`);
      return pl;
    } catch (e) {
      toast.error((e as Error).message);
      return null;
    }
  },

  addTrack: async (playlistId, trackId) => {
    const pl = get().playlists.find((p) => p.id === playlistId);
    const label = pl?.name ?? "플레이리스트";
    try {
      const { added, skipped } = await addTracksToPlaylist(playlistId, [trackId]);
      if (added > 0) {
        get().bumpCount(playlistId, added);
        toast.success(`'${label}'에 추가`);
      } else if (skipped > 0) {
        toast(`이미 '${label}'에 있어요`);
      }
    } catch (e) {
      toast.error((e as Error).message);
    }
  },

  rename: async (id, name, description) => {
    const prev = get().playlists;
    set((s) => ({
      playlists: s.playlists.map((p) =>
        p.id === id ? { ...p, name, description: description ?? p.description } : p,
      ),
    }));
    try {
      await updatePlaylist(id, {
        name,
        ...(description !== undefined ? { description } : {}),
      });
    } catch (e) {
      set({ playlists: prev });
      toast.error((e as Error).message);
    }
  },

  remove: async (id) => {
    const prev = get().playlists;
    set((s) => ({ playlists: s.playlists.filter((p) => p.id !== id) }));
    try {
      await deletePlaylist(id);
      toast.success("삭제됨");
    } catch (e) {
      set({ playlists: prev });
      toast.error((e as Error).message);
    }
  },

  bumpCount: (id, delta) =>
    set((s) => ({
      playlists: s.playlists.map((p) =>
        p.id === id ? { ...p, track_count: (p.track_count ?? 0) + delta } : p,
      ),
    })),
}));
