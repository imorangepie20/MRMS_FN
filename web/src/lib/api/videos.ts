import type { EmpSection } from "@/lib/types";

import { apiFetch } from "./http";

export async function fetchVideoSections(): Promise<EmpSection[]> {
  const r = await apiFetch(`/api/videos/sections`, {}, "video sections");
  return (await r.json()).sections as EmpSection[];
}

export interface VideoItem {
  video_id: string;
  title: string;
  artist: string;
  cover_url: string | null;
}

/** 비디오 플레이리스트(uuid)의 영상들 — 카드 클릭 시 라이브 fetch. */
export async function fetchVideoPlaylistVideos(uuid: string): Promise<VideoItem[]> {
  const r = await apiFetch(
    `/api/videos/playlists/${encodeURIComponent(uuid)}`,
    {},
    "playlist videos",
  );
  return (await r.json()).videos as VideoItem[];
}

export interface VideoPlayback {
  url: string;
  preview: boolean;
}

export async function getVideoPlaybackUrl(videoId: string): Promise<VideoPlayback> {
  const r = await apiFetch(
    `/api/playback/tidal/video/${encodeURIComponent(videoId)}`,
    {},
    "video playback",
  );
  return (await r.json()) as VideoPlayback;
}
