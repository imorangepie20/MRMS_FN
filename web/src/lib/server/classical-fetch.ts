// 서버(page·opengraph-image)에서 클래식 공연실황 섹션을 무인증 조회.
// shared-fetch.ts 미러 — next.config rewrites와 동일 소스(NEXT_PUBLIC_MRMS_API_URL).
import type { EmpSection } from "@/lib/types";

export interface ClassicalVideo {
  videoId: string;
  title: string;
  cover: string | null;
}

const CLASSICAL_SECTION_KEY = "video:classical-live";

function apiBase(): string {
  return process.env.NEXT_PUBLIC_MRMS_API_URL ?? "http://127.0.0.1:8000";
}

/**
 * 섹션 배열에서 클래식 공연실황 영상만 추출 (순수 함수 — 테스트 대상).
 * video:classical-live 섹션의 youtube_video item 중 videoId(item_id)가 있는 것만,
 * display_order 오름차순.
 */
export function pickClassicalVideos(sections: EmpSection[]): ClassicalVideo[] {
  const section = sections.find((s) => s.section_key === CLASSICAL_SECTION_KEY);
  if (!section) return [];
  return section.items
    .filter((it) => it.item_type === "youtube_video" && !!it.item_id)
    .slice()
    .sort((a, b) => a.display_order - b.display_order)
    .map((it) => ({
      videoId: it.item_id,
      title: it.title ?? "클래식 공연 실황",
      cover: it.cover_url,
    }));
}

/** /api/videos/sections(공개) 서버 fetch → 클래식 공연실황 영상 목록. 실패 시 빈 배열. */
export async function fetchClassicalVideos(): Promise<ClassicalVideo[]> {
  try {
    const r = await fetch(`${apiBase()}/api/videos/sections`, { cache: "no-store" });
    if (!r.ok) return [];
    const data = (await r.json()) as { sections?: EmpSection[] };
    return pickClassicalVideos(data.sections ?? []);
  } catch {
    return [];
  }
}
