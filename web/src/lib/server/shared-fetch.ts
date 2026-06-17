// 서버(generateMetadata·opengraph-image)에서 공유 플레이리스트를 무인증 조회.
// next.config rewrites와 동일 소스(NEXT_PUBLIC_MRMS_API_URL)로 백엔드 직접 호출.
export interface SharedMetaTrack {
  album_cover: string | null;
  artist: string;
  album_title: string | null;
}

export interface SharedMeta {
  playlist: { name: string; description: string | null; owner_name: string | null };
  tracks: SharedMetaTrack[];
}

function apiBase(): string {
  return process.env.NEXT_PUBLIC_MRMS_API_URL ?? "http://127.0.0.1:8000";
}

export async function fetchSharedMeta(shareId: string): Promise<SharedMeta | null> {
  try {
    const r = await fetch(`${apiBase()}/api/shared/${encodeURIComponent(shareId)}`, {
      cache: "no-store",
    });
    if (!r.ok) return null;
    return (await r.json()) as SharedMeta;
  } catch {
    return null;
  }
}

// OG 이미지용 — 트랙 커버 URL을 limit개까지 모은다. album_cover(EMPSource)가 없으면
// 백엔드 /api/artwork(iTunes proxy + 캐시)로 resolve한다. OG는 서버 렌더라 클라이언트
// AlbumArt의 iTunes 폴백이 안 도는 탓에, EMPSource 밖 실 ISRC 곡이면 커버가 비어 ♪로
// 떨어지던 문제 해소. 앞쪽 트랙만 스캔(limit*2 또는 8), 실패는 graceful null.
async function resolveCover(base: string, t: SharedMetaTrack): Promise<string | null> {
  if (t.album_cover) return t.album_cover;
  if (!t.artist || !t.album_title) return null;
  try {
    const q = new URLSearchParams({ artist: t.artist, album: t.album_title });
    const r = await fetch(`${base}/api/artwork?${q.toString()}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) return null;
    const d = (await r.json()) as { url?: string | null };
    return d.url ?? null;
  } catch {
    return null;
  }
}

export async function resolveCoverGrid(
  tracks: SharedMetaTrack[],
  limit = 4,
): Promise<string[]> {
  const base = apiBase();
  const scan = tracks.slice(0, Math.max(limit * 2, 8));
  const resolved = await Promise.all(scan.map((t) => resolveCover(base, t)));
  return resolved.filter((c): c is string => !!c).slice(0, limit);
}
