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
  label?: string | null;
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
  album_title?: string | null;
  album_cover?: string | null;
  duration_ms?: number | null;
  duration_sec?: number | null;
  persona_score?: number | null;
  liked?: boolean;
  pct?: boolean;
}

export interface RecommendedAlbum {
  album_id: string;
  title: string;
  artist: string;
  track_count: number;
  cover_url?: string | null;
  persona_idx?: number | null;
}

export interface RecommendedPlaylist {
  id: string;
  name: string;
  description?: string | null;
  cover_url?: string | null;
  track_count: number;
  persona_idx?: number | null;
  persona_score?: number | null;
}

export interface TrackInfo {
  track_id: string;
  title: string;
  artist: string;
  album_id: string | null;
  album_title?: string | null;
  album_cover?: string | null;
  tidal_track_id: string | null;
  spotify_track_id: string | null;
  duration_ms?: number | null;
}


export interface MrtLatestResponse {
  generated_at: string | null;
  model_version: string | null;
  personas: Persona[];
  recommended_tracks: RecommendedTrack[];
  recommended_albums: RecommendedAlbum[];
  recommended_playlists?: RecommendedPlaylist[];
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

export interface IngestionStage {
  stage: string;
  status: string;
  tracks_new?: number;
  tracks_existing?: number;
  downloaded?: number;
  failed?: number;
  embedded?: number;
  loaded?: number;
  duration_ms?: number;
  error?: string | null;
}

export interface IngestionRun {
  id: string;
  started_at: string | null;
  finished_at: string | null;
  status: string;
  platform: string | null;
  stages: IngestionStage[];
  triggered_by: string;
}

export interface EmpStats {
  total_tracks: number;
  in_emp: number;
  with_embedding: number;
  by_platform: Record<string, number>;
  last_run?: IngestionRun | null;
}

export interface EmpSettingMasked {
  present: boolean;
  preview: string | null;
}

/** Unified shape for a single setting entry from GET /api/admin/emp/settings.
 *  Masked keys (e.g. tokens) have `preview`; plain keys have `value`. */
export interface EmpSettingValue {
  present: boolean;
  preview?: string | null;   // masked keys only
  value?: string | null;     // unmasked keys only
}

export interface EmpSettings {
  settings: Record<string, EmpSettingValue>;
}
