import type {
  MrtLatestResponse,
  PgtAlbumGroup,
  PgtArtistGroup,
  PgtSections,
  PgtTrack,
  TidalTokenResponse,
  UserInfo,
  UserPlaylistSummary,
} from "./types";


const BASE = process.env.NEXT_PUBLIC_API_BASE ?? "/api";


async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  // Server Component 환경에선 절대 URL 필요할 수 있음
  // 같은 origin에서 routing되므로 base는 / 시작 path
  const url = path.startsWith("http") ? path : `${BASE}${path}`;
  const r = await fetch(url, { cache: "no-store", ...init });
  if (!r.ok) {
    throw new Error(`API ${url}: ${r.status}`);
  }
  return r.json() as Promise<T>;
}


export function getUser(): Promise<UserInfo> {
  return fetchJson<UserInfo>("/user");
}


export function getMrtLatest(): Promise<MrtLatestResponse> {
  return fetchJson<MrtLatestResponse>("/mrt/latest");
}


export function getTidalToken(): Promise<TidalTokenResponse> {
  return fetchJson<TidalTokenResponse>("/auth/tidal/token");
}


export function refreshTidalToken(): Promise<TidalTokenResponse> {
  return fetchJson<TidalTokenResponse>("/auth/tidal/refresh", { method: "POST" });
}


// ── PGT (Personal Generated Tracks) ────────────────────────────────────────

export function getPgtSections(): Promise<PgtSections> {
  return fetchJson<PgtSections>("/pgt/sections");
}

export function getPgtLiked(): Promise<{ tracks: PgtTrack[] }> {
  return fetchJson<{ tracks: PgtTrack[] }>("/pgt/liked");
}

export function getPgtPct(): Promise<{ tracks: PgtTrack[] }> {
  return fetchJson<{ tracks: PgtTrack[] }>("/pgt/pct");
}

export function getPgtAlbums(): Promise<{ albums: PgtAlbumGroup[] }> {
  return fetchJson<{ albums: PgtAlbumGroup[] }>("/pgt/albums");
}

export function getPgtAlbumTracks(albumId: string): Promise<{ tracks: PgtTrack[] }> {
  return fetchJson<{ tracks: PgtTrack[] }>(`/pgt/albums/${albumId}`);
}

export function getPgtArtists(): Promise<{ artists: PgtArtistGroup[] }> {
  return fetchJson<{ artists: PgtArtistGroup[] }>("/pgt/artists");
}

export function getPgtArtistTracks(artistId: string): Promise<{ tracks: PgtTrack[] }> {
  return fetchJson<{ tracks: PgtTrack[] }>(`/pgt/artists/${artistId}`);
}

export function getUserPlaylists(): Promise<{ playlists: UserPlaylistSummary[] }> {
  return fetchJson<{ playlists: UserPlaylistSummary[] }>("/user/playlists");
}

export function getPlaylistTracks(id: string): Promise<{ tracks: PgtTrack[] }> {
  return fetchJson<{ tracks: PgtTrack[] }>(`/playlists/${id}/tracks`);
}


// ── MRT actions ────────────────────────────────────────────────────────────────

export function collectAlbum(albumId: string): Promise<{ collected: number }> {
  return fetchJson<{ collected: number }>(`/user/tracks/album/${albumId}/collect`, {
    method: "POST",
  });
}

export const dislikeTrack = (trackId: string): Promise<{ disliked: boolean }> =>
  fetchJson<{ disliked: boolean }>(`/user/tracks/${trackId}/dislike`, { method: "POST" });

export const dismissTrack = (trackId: string): Promise<{ dismissed: boolean }> =>
  fetchJson<{ dismissed: boolean }>(`/user/tracks/${trackId}/dismiss`, { method: "POST" });

export const dislikeAlbum = (albumId: string): Promise<{ disliked: boolean }> =>
  fetchJson<{ disliked: boolean }>(`/user/tracks/album/${albumId}/dislike`, { method: "POST" });

export const dismissAlbum = (albumId: string): Promise<{ dismissed: boolean }> =>
  fetchJson<{ dismissed: boolean }>(`/user/tracks/album/${albumId}/dismiss`, { method: "POST" });
