import type { ModalTrack } from "@/components/track/ModalTrackList";

import { apiFetch } from "./http";

export interface ArtistIntro {
  name: string;
  image: string | null;
  genres: string[];
  bio: string | null;
  tracks: ModalTrack[];
}

export async function fetchArtistIntro(name: string): Promise<ArtistIntro> {
  const r = await apiFetch(
    `/api/artist/intro?name=${encodeURIComponent(name)}`,
    {},
    "artist intro",
  );
  return (await r.json()) as ArtistIntro;
}
