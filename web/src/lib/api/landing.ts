import { apiFetch } from "./http";

export interface PreviewTrack {
  track_id: string;
  title: string;
  artist: string;
  album_cover: string | null;
  preview_url: string;
}

export async function fetchPreviewTracks(n = 5): Promise<PreviewTrack[]> {
  const r = await apiFetch(`/api/landing/preview-tracks?n=${n}`, {}, "preview tracks");
  return ((await r.json()) as { tracks: PreviewTrack[] }).tracks;
}
