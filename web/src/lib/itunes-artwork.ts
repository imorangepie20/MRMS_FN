/**
 * iTunes Search API로 앨범 아트워크 조회 (free, no auth, CORS OK).
 * In-memory cache: 같은 (artist, album) 조합은 한 번만 fetch.
 */

const cache = new Map<string, Promise<string | null>>();


async function _fetch(artist: string, album: string): Promise<string | null> {
  const term = encodeURIComponent(`${artist} ${album}`.trim());
  try {
    const r = await fetch(
      `https://itunes.apple.com/search?term=${term}&entity=album&limit=1`,
    );
    if (!r.ok) return null;
    const data = await r.json();
    const first = data.results?.[0];
    if (!first?.artworkUrl100) return null;
    // 100x100 → 600x600 (URL 패턴 교체)
    return (first.artworkUrl100 as string).replace("100x100", "600x600");
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
