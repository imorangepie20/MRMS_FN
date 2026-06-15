// 서버(generateMetadata·opengraph-image)에서 공유 플레이리스트를 무인증 조회.
// next.config rewrites와 동일 소스(NEXT_PUBLIC_MRMS_API_URL)로 백엔드 직접 호출.
export interface SharedMeta {
  playlist: { name: string; description: string | null; owner_name: string | null };
  tracks: { album_cover: string | null }[];
}

export async function fetchSharedMeta(shareId: string): Promise<SharedMeta | null> {
  const base = process.env.NEXT_PUBLIC_MRMS_API_URL ?? "http://127.0.0.1:8000";
  try {
    const r = await fetch(`${base}/api/shared/${encodeURIComponent(shareId)}`, {
      cache: "no-store",
    });
    if (!r.ok) return null;
    return (await r.json()) as SharedMeta;
  } catch {
    return null;
  }
}
