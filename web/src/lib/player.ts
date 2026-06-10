"use client";

import type { QueueTrack } from "@/store/player";
import { usePlayerStore } from "@/store/player";

import * as spotifyPlayer from "./spotify-player";
import * as tidalPlayer from "./tidal-player";


export type Platform = "tidal" | "spotify";

// 사용자 선호 (primary) — initPlayer가 세팅
let primary: Platform | null = null;
// 현재 실제로 소리를 내는 플랫폼 — loadAndPlay가 세팅. 컨트롤 라우팅 기준.
let active: Platform | null = null;

const initialized: Record<Platform, boolean> = { tidal: false, spotify: false };


export async function initPlayer(
  primaryPlatform: Platform,
): Promise<void> {
  primary = primaryPlatform;
  // 트랙 종료 시 facade가 큐를 진행 (교차 플랫폼 포함) — injection으로 순환 import 회피
  tidalPlayer.setOnTrackEnd(() => void advanceToNext());
  spotifyPlayer.setOnTrackEnd(() => void advanceToNext());
  await ensureInit(primaryPlatform);
}


/** secondary 플랫폼 lazy init 포함 — 실패 시 명확한 메시지로 throw. */
async function ensureInit(platform: Platform): Promise<void> {
  if (initialized[platform]) return;
  if (platform === "tidal") {
    await tidalPlayer.initTidalSdk();
  } else {
    try {
      await spotifyPlayer.initSpotifySdk();
    } catch (e) {
      throw new Error(
        `Spotify 플레이어 초기화 실패 — Spotify 계정 연동을 확인하세요 (${(e as Error).message})`,
      );
    }
  }
  initialized[platform] = true;
}


/** 이 트랙이 재생될 플랫폼. primary 우선, 없으면 타 플랫폼 fallback, 둘 다 없으면 null. */
export function getPlatformForTrack(track: QueueTrack): Platform | null {
  const pref: Platform = primary ?? "tidal";
  const other: Platform = pref === "tidal" ? "spotify" : "tidal";
  const idOf = (p: Platform) =>
    p === "tidal" ? track.tidal_track_id : track.spotify_track_id;
  if (idOf(pref)) return pref;
  if (idOf(other)) return other;
  return null;
}


function pick(track: QueueTrack): Platform {
  const platform = getPlatformForTrack(track);
  if (!platform) {
    throw new Error("이 트랙은 Tidal/Spotify 어느 쪽에도 재생 ID가 없습니다");
  }
  return platform;
}


// in-flight 세대 토큰 — lazy init 등 await 구간 동안 새 loadAndPlay가 들어오면
// 이전 호출은 자기 차례가 아님을 감지하고 중단 (race 시 이중 재생 방지)
let playGeneration = 0;

export async function loadAndPlay(track: QueueTrack): Promise<void> {
  const platform = pick(track);
  const generation = ++playGeneration;
  const switching = active !== null && active !== platform;

  // 플랫폼 전환 — 이전 active 플랫폼 먼저 정지 (이중 재생 방지)
  if (switching && active) {
    try {
      if (active === "tidal") await tidalPlayer.pausePlayback();
      else await spotifyPlayer.pausePlayback();
    } catch {
      // 정지 실패해도 전환은 계속 진행
    }
    usePlayerStore.setState({ isPlaying: false });
  }

  // secondary 첫 사용 시 lazy init (수 초 걸릴 수 있음 — 이후 세대 체크 필수)
  await ensureInit(platform);
  if (platform === "spotify") {
    // initSpotifySdk는 connect()까지만 보장 — deviceId 준비 대기
    await spotifyPlayer.waitForDevice(10_000);
  }

  // await 동안 더 새로운 재생 요청이 들어왔으면 이 호출은 silently 중단
  if (generation !== playGeneration) return;

  // await 사이 resume 등으로 타 플랫폼이 다시 소리낼 수 있음 — 재생 직전 한 번 더 정지
  const other: Platform = platform === "tidal" ? "spotify" : "tidal";
  if (initialized[other]) {
    try {
      if (other === "tidal") await tidalPlayer.pausePlayback();
      else await spotifyPlayer.pausePlayback();
    } catch {
      // best effort
    }
  }

  active = platform;
  tidalPlayer.setTidalActive(platform === "tidal");
  spotifyPlayer.setSpotifyActive(platform === "spotify");

  if (platform === "tidal") {
    await tidalPlayer.loadAndPlay(track.tidal_track_id!);
  } else {
    await spotifyPlayer.loadAndPlay(track.spotify_track_id!);
  }

  if (generation !== playGeneration) {
    // 재생 시작 직후 더 새로운 요청이 끼어든 경우 — 이쪽을 정지
    try {
      if (platform === "tidal") await tidalPlayer.pausePlayback();
      else await spotifyPlayer.pausePlayback();
    } catch {
      // best effort
    }
    return;
  }

  // 플랫폼 전환 후에도 store의 현재 볼륨 유지
  try {
    const v = usePlayerStore.getState().volume;
    if (platform === "tidal") await tidalPlayer.setSdkVolume(v);
    else await spotifyPlayer.setSdkVolume(v);
  } catch {
    // 볼륨 적용 실패는 재생을 막지 않음
  }
}


/** 트랙 자연 종료/에러 시 큐 진행 — 교차 플랫폼 포함. 끝이면 정지. */
export async function advanceToNext(): Promise<void> {
  const s = usePlayerStore.getState();
  const nextIdx = s.currentIdx + 1;
  if (nextIdx >= s.queue.length) {
    usePlayerStore.setState({ isPlaying: false, position: 0 });
    return;
  }
  usePlayerStore.setState({ currentIdx: nextIdx, position: 0 });
  try {
    await loadAndPlay(s.queue[nextIdx]);
  } catch (e) {
    usePlayerStore.setState({
      errorMsg: (e as Error).message,
      isPlaying: false,
    });
  }
}


// 컨트롤 라우팅 — 재생 중인(active) 플랫폼 기준, 없으면 primary
function routed(): Platform {
  return active ?? primary ?? "spotify";
}


export async function pausePlayback(): Promise<void> {
  if (routed() === "tidal") return tidalPlayer.pausePlayback();
  return spotifyPlayer.pausePlayback();
}


export async function resumePlayback(): Promise<void> {
  if (routed() === "tidal") return tidalPlayer.resumePlayback();
  return spotifyPlayer.resumePlayback();
}


export async function seekTo(ratio: number): Promise<void> {
  if (routed() === "tidal") return tidalPlayer.seekTo(ratio);
  return spotifyPlayer.seekTo(ratio);
}


export async function setSdkVolume(v: number): Promise<void> {
  if (routed() === "tidal") return tidalPlayer.setSdkVolume(v);
  return spotifyPlayer.setSdkVolume(v);
}


export function getActivePlatform(): Platform | null {
  return active;
}


export function getPrimaryPlatform(): Platform | null {
  return primary;
}
