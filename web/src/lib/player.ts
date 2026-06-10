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

// 세션 동안 사용할 수 없는 플랫폼 (미연동/SDK 실패) — 첫 실패 시 마킹.
// "연결된 플랫폼에서 검색되느냐"가 재생 가능 판단 기준이므로,
// 연동 안 된 플랫폼은 fallback/resolve 시도 자체를 건너뜀 (반복 timeout 방지).
const unavailable: Record<Platform, boolean> = { tidal: false, spotify: false };


export async function initPlayer(
  primaryPlatform: Platform,
): Promise<void> {
  primary = primaryPlatform;
  // 트랙 종료 시 facade가 큐를 진행 (교차 플랫폼 포함) — injection으로 순환 import 회피
  tidalPlayer.setOnTrackEnd(() => void advanceToNext());
  spotifyPlayer.setOnTrackEnd(() => void advanceToNext());
  // 재생 시작 후 스트림 실패 (예: 404) → 타 플랫폼 재시도
  tidalPlayer.setOnTrackError(() => void handleTrackError());
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


function otherOf(p: Platform): Platform {
  return p === "tidal" ? "spotify" : "tidal";
}


function idOf(track: QueueTrack, p: Platform): string | null {
  return p === "tidal" ? track.tidal_track_id : track.spotify_track_id;
}


/** 이 트랙이 재생될 플랫폼. primary 우선, 없으면 타 플랫폼 fallback, 둘 다 없으면 null. */
export function getPlatformForTrack(track: QueueTrack): Platform | null {
  const pref: Platform = primary ?? "tidal";
  const other = otherOf(pref);
  if (idOf(track, pref)) return pref;
  if (idOf(track, other)) return other;
  return null;
}


// in-flight 세대 토큰 — lazy init/resolve 등 await 구간 동안 새 재생 요청이 들어오면
// 이전 호출은 자기 차례가 아님을 감지하고 중단 (race 시 이중 재생 방지)
let playGeneration = 0;

// 비동기 스트림 에러 재시도 마커 — track_id당 1회만 타 플랫폼 재시도
let retriedTrackId: string | null = null;


/** 재생 시점 lazy 해결 — 해당 플랫폼 카탈로그 검색 (백엔드가 TrackPlatform upsert). */
async function resolveTrackId(
  platform: Platform,
  track: QueueTrack,
): Promise<string | null> {
  try {
    const r = await fetch(
      `/api/playback/resolve/${track.track_id}?platform=${platform}`,
      { credentials: "include" },
    );
    if (!r.ok) return null;
    return (await r.json()).platform_track_id ?? null;
  } catch {
    return null; // 네트워크 실패 = 해결 실패로 취급
  }
}


/** resolve 결과를 store queue에 불변 반영 — 이후 재생/표시에 즉시 반영. patched 트랙 반환. */
function patchTrackId(
  track: QueueTrack,
  platform: Platform,
  platformTrackId: string,
): QueueTrack {
  const key = platform === "tidal" ? "tidal_track_id" : "spotify_track_id";
  usePlayerStore.setState((s) => ({
    queue: s.queue.map((t) =>
      t.track_id === track.track_id ? { ...t, [key]: platformTrackId } : t,
    ),
  }));
  return { ...track, [key]: platformTrackId };
}


/** 특정 플랫폼으로 실제 재생 — 트랙에 해당 플랫폼 ID가 있어야 함. */
async function playOn(
  platform: Platform,
  track: QueueTrack,
  generation: number,
): Promise<void> {
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
  try {
    await ensureInit(platform);
    if (platform === "spotify") {
      // initSpotifySdk는 connect()까지만 보장 — deviceId 준비 대기
      await spotifyPlayer.waitForDevice(10_000);
    }
  } catch (e) {
    // init/연동 수준 실패 — 트랙 문제가 아니라 플랫폼 문제. 세션 동안 스킵.
    unavailable[platform] = true;
    throw e;
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


/**
 * 트랙 재생 — primary 우선, 실패/ID 부재 시 타 플랫폼 fallback.
 * ID가 비어 있으면 재생 시점에 resolve API로 lazy 해결 (성공 시 queue에 patch).
 */
export async function loadAndPlay(track: QueueTrack): Promise<void> {
  const generation = ++playGeneration;
  retriedTrackId = null; // 명시적 재생 — 비동기 에러 재시도 마커 리셋

  const pref: Platform = primary ?? "tidal";
  const other = otherOf(pref);
  let lastError: Error | null = null;

  // 1) primary ID 있으면 우선 시도
  if (idOf(track, pref)) {
    try {
      await playOn(pref, track, generation);
      return;
    } catch (e) {
      if (generation !== playGeneration) return; // 더 새로운 요청이 인계
      lastError = e as Error;
    }
  }

  // 2) 타 플랫폼 — ID 있으면 직행, 없으면 resolve로 lazy 해결 (연동 안 된 플랫폼은 스킵)
  let target = track;
  if (!unavailable[other]) {
    if (!idOf(target, other)) {
      const resolved = await resolveTrackId(other, track);
      if (generation !== playGeneration) return;
      if (resolved) target = patchTrackId(track, other, resolved);
    }
    if (idOf(target, other)) {
      try {
        await playOn(other, target, generation);
        return;
      } catch (e) {
        if (generation !== playGeneration) return;
        lastError = e as Error;
      }
    }
  }

  // 3) primary ID도 없었으면 primary 쪽 resolve도 시도
  if (!idOf(track, pref)) {
    const resolved = await resolveTrackId(pref, track);
    if (generation !== playGeneration) return;
    if (resolved) {
      target = patchTrackId(target, pref, resolved);
      await playOn(pref, target, generation);
      return;
    }
  }

  throw (
    lastError ??
    new Error("이 트랙은 Tidal/Spotify 어느 쪽에서도 재생할 수 없습니다")
  );
}


/**
 * 재생 시작 후 비동기 스트림 에러 (예: tidal 404) → 타 플랫폼 재시도.
 * track_id당 1회 — 이미 재시도한 트랙이면 동기 경로에 맡기고 종료.
 */
async function handleTrackError(): Promise<void> {
  const s = usePlayerStore.getState();
  const track = s.queue[s.currentIdx];
  if (!track) return;
  if (retriedTrackId === track.track_id) return; // 재시도 1회 소진
  retriedTrackId = track.track_id;

  const failed: Platform = active ?? primary ?? "tidal";
  const other = otherOf(failed);
  // 같은 실패에 대해 동시 진행 중인 동기 경로를 무효화하고 이 재시도가 인계
  const generation = ++playGeneration;

  try {
    if (!unavailable[other]) {
      let target = track;
      if (!idOf(target, other)) {
        const resolved = await resolveTrackId(other, track);
        if (generation !== playGeneration) return;
        if (resolved) target = patchTrackId(track, other, resolved);
      }
      if (idOf(target, other)) {
        await playOn(other, target, generation);
        if (generation === playGeneration) {
          usePlayerStore.setState({ errorMsg: null });
        }
        return;
      }
    }
  } catch {
    // 타 플랫폼 재시도 실패 — 아래에서 다음 곡으로
  }
  if (generation !== playGeneration) return;
  await advanceToNext();
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
