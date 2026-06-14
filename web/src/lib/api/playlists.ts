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
