import type { ModalTrack } from "@/components/track/ModalTrackList";

import { apiFetch } from "./http";


export interface SharedPlaylist {
  playlist: {
    id: string;
    name: string;
    description: string | null;
    owner_name: string | null;
    created_at: string | null;
  };
  tracks: ModalTrack[];
}


/** 공개 페이지용 — 무인증 조회. 없는 토큰이면 apiFetch가 throw. */
export async function getShared(shareId: string): Promise<SharedPlaylist> {
  const r = await apiFetch(`/api/shared/${shareId}`, {}, "shared");
  return (await r.json()) as SharedPlaylist;
}


/** 공유 토글 (소유자). enabled=true면 share_id 발급, false면 null. */
export async function togglePlaylistShare(
  playlistId: string,
  enabled: boolean,
): Promise<{ share_id: string | null; share_url: string | null }> {
  const r = await apiFetch(
    `/api/user/playlists/${playlistId}/share`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    },
    "share",
  );
  return r.json();
}
