/**
 * 앨범 아트워크 조회 — `/api/artwork` 백엔드 경유 (서버측 캐시 + iTunes proxy).
 * In-memory cache: 같은 (artist, album) 조합은 한 번만 fetch.
 */

const cache = new Map<string, Promise<string | null>>();


async function _fetch(artist: string, album: string): Promise<string | null> {
  try {
    const q = new URLSearchParams({ artist, album });
    const r = await fetch(`/api/artwork?${q.toString()}`, {
      credentials: "include",
    });
    if (!r.ok) return null;
    const data = await r.json();
    return data.url ?? null;
  } catch {
    return null;
  }
}


export function getAlbumArtwork(
  artist: string,
  album: string,
): Promise<string | null> {
  const key = `${artist}|${album}`.toLowerCase();
  const cached = cache.get(key);
  if (cached) return cached;
  const promise = _fetch(artist, album);
  cache.set(key, promise);
  return promise;
}
