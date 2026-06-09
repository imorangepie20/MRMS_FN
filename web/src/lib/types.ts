export interface UserInfo {
  user_id: string;
  email: string;
  displayName: string | null;
  country: string | null;
  personas_count: number;
  user_tracks_count: number;
  primary_platform: "tidal" | "spotify";
}

export interface PersonaTrack {
  track_id: string;
  title: string;
  artist: string;
  album_id: string | null;
  album_title: string | null;
  similarity: number;
  tidal_track_id: string | null;
  spotify_track_id: string | null;
}

export interface Persona {
  persona_idx: number;
  track_count: number;
  playlist: PersonaTrack[];
}

export interface RecommendedTrack {
  track_id: string;
  title: string;
  artist: string;
  album_id: string | null;
  score: number;
  persona_idx: number | null;
  tidal_track_id: string | null;
  spotify_track_id: string | null;
}

export interface RecommendedAlbum {
  album_id: string;
  title: string;
  artist: string;
  track_count: number;
}

export interface MrtLatestResponse {
  generated_at: string | null;
  model_version: string | null;
  personas: Persona[];
  recommended_tracks: RecommendedTrack[];
  recommended_albums: RecommendedAlbum[];
}

export interface TidalTokenResponse {
  access_token: string;
  expires_at: string | null;
  premium: boolean | null;
}

export interface DeviceCodeInit {
  user_code: string;
  device_code: string;
  verification_uri_complete: string;
  expires_in: number;
  interval: number;
}

export type DeviceCodePollStatus =
  | { status: "pending" }
  | { status: "expired" }
  | { status: "error"; detail?: string }
  | { status: "success"; has_mrt: boolean };

export type OnboardingStep =
  | "idle"
  | "fetching_favorites"
  | "matching_tracks"
  | "computing_embedding"
  | "clustering"
  | "generating_mrt"
  | "done"
  | "error";

export interface OnboardingStatus {
  step: OnboardingStep;
  progress: number;
  message: string | null;
  error: string | null;
}
