import { apiFetch } from "./http";

import type { TrackInfo } from "@/lib/types";


export interface PlaylistMeta {
  id: string;
  user_id?: string;
  name: string;
  description: string | null;
  created_at?: string | null;
  track_count?: number;
  share_id?: string | null;
}


export async function createPlaylist(
  name: string,
  description: string | null,
  trackIds: string[],
): Promise<PlaylistMeta> {
  const r = await fetch("/api/user/playlists", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, description, track_ids: trackIds }),
  });
  if (!r.ok) throw new Error(`createPlaylist failed: ${r.status}`);
  return (await r.json()).playlist as PlaylistMeta;
}


export async function fetchPlaylistTracks(
  playlistId: string,
): Promise<{ playlist: PlaylistMeta; tracks: TrackInfo[] }> {
  const r = await fetch(`/api/playlists/${playlistId}/tracks`, {
    credentials: "include",
  });
  if (!r.ok) throw new Error(`fetchPlaylistTracks failed: ${r.status}`);
  return r.json();
}


export async function fetchAlbumTracks(
  albumId: string,
): Promise<{
  album: { id: string; title: string; cover_url: string | null };
  tracks: TrackInfo[];
}> {
  const r = await fetch(`/api/albums/${albumId}/tracks`, {
    credentials: "include",
  });
  if (!r.ok) throw new Error(`fetchAlbumTracks failed: ${r.status}`);
  return r.json();
}


export async function listPlaylists(): Promise<PlaylistMeta[]> {
  const r = await apiFetch("/api/user/playlists", {}, "list playlists");
  return ((await r.json()) as { playlists: PlaylistMeta[] }).playlists;
}

export async function addTracksToPlaylist(
  playlistId: string,
  trackIds: string[],
): Promise<{ added: number; skipped: number }> {
  const r = await apiFetch(
    `/api/playlists/${playlistId}/tracks`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ track_ids: trackIds }),
    },
    "add to playlist",
  );
  return (await r.json()) as { added: number; skipped: number };
}

export async function removeTrackFromPlaylist(
  playlistId: string,
  trackId: string,
): Promise<void> {
  await apiFetch(
    `/api/playlists/${playlistId}/tracks/${trackId}`,
    { method: "DELETE" },
    "remove track",
  );
}

export async function reorderPlaylistTracks(
  playlistId: string,
  trackIds: string[],
): Promise<void> {
  await apiFetch(
    `/api/playlists/${playlistId}/tracks/order`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ track_ids: trackIds }),
    },
    "reorder",
  );
}

export async function updatePlaylist(
  playlistId: string,
  patch: { name?: string; description?: string | null },
): Promise<PlaylistMeta> {
  const r = await apiFetch(
    `/api/playlists/${playlistId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    },
    "update playlist",
  );
  return ((await r.json()) as { playlist: PlaylistMeta }).playlist;
}

export async function deletePlaylist(playlistId: string): Promise<void> {
  await apiFetch(`/api/playlists/${playlistId}`, { method: "DELETE" }, "delete playlist");
}
