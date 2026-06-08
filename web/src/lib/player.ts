"use client";

import type { QueueTrack } from "@/store/player";

import * as spotifyPlayer from "./spotify-player";
import * as tidalPlayer from "./tidal-player";


let primary: "tidal" | "spotify" | null = null;


export async function initPlayer(
  primaryPlatform: "tidal" | "spotify",
): Promise<void> {
  primary = primaryPlatform;
  if (primary === "tidal") {
    await tidalPlayer.initTidalSdk();
  } else {
    await spotifyPlayer.initSpotifySdk();
  }
}


export async function loadAndPlay(track: QueueTrack): Promise<void> {
  if (primary === "tidal") {
    if (!track.tidal_track_id) {
      throw new Error("이 트랙은 Tidal에서 재생할 수 없습니다");
    }
    return tidalPlayer.loadAndPlay(track.tidal_track_id);
  }
  if (!track.spotify_track_id) {
    throw new Error("이 트랙은 Spotify에서 재생할 수 없습니다");
  }
  return spotifyPlayer.loadAndPlay(track.spotify_track_id);
}


export async function pausePlayback(): Promise<void> {
  if (primary === "tidal") return tidalPlayer.pausePlayback();
  return spotifyPlayer.pausePlayback();
}


export async function resumePlayback(): Promise<void> {
  if (primary === "tidal") return tidalPlayer.resumePlayback();
  return spotifyPlayer.resumePlayback();
}


export async function seekTo(ratio: number): Promise<void> {
  if (primary === "tidal") return tidalPlayer.seekTo(ratio);
  return spotifyPlayer.seekTo(ratio);
}


export async function setSdkVolume(v: number): Promise<void> {
  if (primary === "tidal") return tidalPlayer.setSdkVolume(v);
  return spotifyPlayer.setSdkVolume(v);
}


export function getPrimaryPlatform(): "tidal" | "spotify" | null {
  return primary;
}
