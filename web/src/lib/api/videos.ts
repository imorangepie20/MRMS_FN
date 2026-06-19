import type { EmpSection } from "@/lib/types";

import { apiFetch } from "./http";

export async function fetchVideoSections(): Promise<EmpSection[]> {
  const r = await apiFetch(`/api/videos/sections`, {}, "video sections");
  return (await r.json()).sections as EmpSection[];
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
