"use client";

import type { QueueTrack } from "@/store/player";
import { usePlayerStore } from "@/store/player";

import * as spotifyPlayer from "./spotify-player";
import * as tidalPlayer from "./tidal-player";
import * as youtubePlayer from "./youtube-player";


export type Platform = "tidal" | "spotify" | "youtube";

// youtube는 광고가 있어 항상 마지막 fallback 전용 — primary 불가
export type PrimaryPlatform = Exclude<Platform, "youtube">;

// fallback 우선순위 — tidal → spotify → youtube (youtube는 광고 때문에 항상 마지막)
const FALLBACK_ORDER: Platform[] = ["tidal", "spotify", "youtube"];

// 어댑터 레지스트리 — 공통 인터페이스로 디스패치 (플랫폼별 if/else 제거)
type PlayerAdapter = {
  loadAndPlay: (platformTrackId: string) => Promise<void>;
  pausePlayback: () => Promise<void>;
  resumePlayback: () => Promise<void>;
  seekTo: (ratio: number) => Promise<void>;
  setSdkVolume: (v: number) => Promise<void>;
  setActive: (b: boolean) => void;
};

const PLAYERS: Record<Platform, PlayerAdapter> = {
  tidal: {
    loadAndPlay: tidalPlayer.loadAndPlay,
    pausePlayback: tidalPlayer.pausePlayback,
    resumePlayback: tidalPlayer.resumePlayback,
    seekTo: tidalPlayer.seekTo,
    setSdkVolume: tidalPlayer.setSdkVolume,
    setActive: tidalPlayer.setTidalActive,
  },
  spotify: {
    loadAndPlay: spotifyPlayer.loadAndPlay,
    pausePlayback: spotifyPlayer.pausePlayback,
    resumePlayback: spotifyPlayer.resumePlayback,
    seekTo: spotifyPlayer.seekTo,
    setSdkVolume: spotifyPlayer.setSdkVolume,
    setActive: spotifyPlayer.setSpotifyActive,
  },
  youtube: {
    loadAndPlay: youtubePlayer.loadAndPlay,
    pausePlayback: youtubePlayer.pausePlayback,
    resumePlayback: youtubePlayer.resumePlayback,
    seekTo: youtubePlayer.seekTo,
    setSdkVolume: youtubePlayer.setSdkVolume,
    setActive: youtubePlayer.setYoutubeActive,
  },
};

// 사용자 선호 (primary) — initPlayer가 세팅. youtube는 primary 불가 (광고).
let primary: PrimaryPlatform | null = null;
// 현재 실제로 소리를 내는 플랫폼 — loadAndPlay가 세팅. 컨트롤 라우팅 기준.
let active: Platform | null = null;

const initialized: Record<Platform, boolean> = {
  tidal: false,
  spotify: false,
  youtube: false,
};

// 세션 동안 사용할 수 없는 플랫폼 (미연동/SDK 실패) — 첫 실패 시 마킹.
// "연결된 플랫폼에서 검색되느냐"가 재생 가능 판단 기준이므로,
// 연동 안 된 플랫폼은 fallback/resolve 시도 자체를 건너뜀 (반복 timeout 방지).
const unavailable: Record<Platform, boolean> = {
  tidal: false,
  spotify: false,
  youtube: false,
};


export async function initPlayer(
  primaryPlatform: PrimaryPlatform,
): Promise<void> {
  primary = primaryPlatform;
  // 트랙 종료 시 facade가 큐를 진행 (교차 플랫폼 포함) — injection으로 순환 import 회피
  tidalPlayer.setOnTrackEnd(() => void advanceToNext());
  spotifyPlayer.setOnTrackEnd(() => void advanceToNext());
  youtubePlayer.setOnTrackEnd(() => void advanceToNext());
  // 재생 시작 후 스트림 실패 (예: tidal 404, youtube 임베드 불가) → 타 플랫폼 재시도
  tidalPlayer.setOnTrackError(
    (failedId) => void handleTrackError("tidal", failedId),
  );
  youtubePlayer.setOnTrackError(
    (failedId) => void handleTrackError("youtube", failedId),
  );
  await ensureInit(primaryPlatform);
}


/** secondary 플랫폼 lazy init 포함 — 실패 시 명확한 메시지로 throw. */
async function ensureInit(platform: Platform): Promise<void> {
  if (initialized[platform]) return;
  if (platform === "tidal") {
    await tidalPlayer.initTidalSdk();
  } else if (platform === "spotify") {
    try {
      await spotifyPlayer.initSpotifySdk();
    } catch (e) {
      throw new Error(
        `Spotify 플레이어 초기화 실패 — Spotify 계정 연동을 확인하세요 (${(e as Error).message})`,
      );
    }
  } else {
    await youtubePlayer.initYoutubeSdk();
  }
  initialized[platform] = true;
}


/** pref 제외 fallback 순서 — tidal → spotify → youtube. youtube는 광고 때문에 항상 마지막. */
function fallbacksFor(pref: Platform): Platform[] {
  return FALLBACK_ORDER.filter((p) => p !== pref);
}


/** 합성 youtube ID ('yt_' + hash) 방어 — IFrame에 넘기면 invalid video. null 취급. */
export function realYoutubeId(id: string | null | undefined): string | null {
  if (!id || id.startsWith("yt_")) return null;
  return id;
}


function idOf(track: QueueTrack, p: Platform): string | null {
  if (p === "tidal") return track.tidal_track_id;
  if (p === "spotify") return track.spotify_track_id;
  return realYoutubeId(track.youtube_track_id);
}


/** 이 트랙이 재생될 플랫폼. primary 우선, 없으면 fallback 순서대로, 전부 없으면 null. */
export function getPlatformForTrack(track: QueueTrack): Platform | null {
  const pref: Platform = primary ?? "tidal";
  if (idOf(track, pref)) return pref;
  for (const p of fallbacksFor(pref)) {
    if (idOf(track, p)) return p;
  }
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
    const base = process.env.NEXT_PUBLIC_API_BASE ?? "/api";
    const r = await fetch(
      `${base}/playback/resolve/${track.track_id}?platform=${platform}`,
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
  const key =
    platform === "tidal"
      ? "tidal_track_id"
      : platform === "spotify"
        ? "spotify_track_id"
        : "youtube_track_id";
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
      await PLAYERS[active].pausePlayback();
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
  for (const p of FALLBACK_ORDER) {
    if (p === platform || !initialized[p]) continue;
    try {
      await PLAYERS[p].pausePlayback();
    } catch {
      // best effort
    }
  }

  // pause await 동안에도 새 요청이 끼어들 수 있음 — active 덮어쓰기 방지
  if (generation !== playGeneration) return;

  active = platform;
  for (const p of FALLBACK_ORDER) PLAYERS[p].setActive(p === platform);

  await PLAYERS[platform].loadAndPlay(idOf(track, platform)!);

  if (generation !== playGeneration) {
    // 재생 시작 직후 더 새로운 요청이 끼어든 경우 — 이쪽을 정지
    try {
      await PLAYERS[platform].pausePlayback();
    } catch {
      // best effort
    }
    return;
  }

  // 플랫폼 전환 후에도 store의 현재 볼륨 유지
  try {
    const v = usePlayerStore.getState().volume;
    await PLAYERS[platform].setSdkVolume(v);
  } catch {
    // 볼륨 적용 실패는 재생을 막지 않음
  }
}


/**
 * 트랙 재생 — primary 우선, 실패/ID 부재 시 fallback 순서대로.
 * ID가 비어 있으면 재생 시점에 resolve API로 lazy 해결 (성공 시 queue에 patch).
 * youtube는 광고가 있어 항상 마지막 — primary 쪽 resolve까지 전부 실패한 뒤에만 시도.
 */
export async function loadAndPlay(track: QueueTrack): Promise<void> {
  const generation = ++playGeneration;
  retriedTrackId = null; // 명시적 재생 — 비동기 에러 재시도 마커 리셋

  const pref: Platform = primary ?? "tidal";
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

  // 2) non-youtube fallback 순회 — ID 있으면 직행, 없으면 resolve로 lazy 해결
  //    (연동 안 된 플랫폼은 스킵. youtube는 primary resolve보다도 뒤 — step 4)
  let target = track;
  for (const p of fallbacksFor(pref)) {
    if (p === "youtube" || unavailable[p]) continue;
    if (!idOf(target, p)) {
      const resolved = await resolveTrackId(p, target);
      if (generation !== playGeneration) return;
      if (resolved) target = patchTrackId(target, p, resolved);
    }
    if (!idOf(target, p)) continue;
    try {
      await playOn(p, target, generation);
      return;
    } catch (e) {
      if (generation !== playGeneration) return;
      lastError = e as Error;
    }
  }

  // 3) primary ID도 없었으면 primary 쪽 resolve도 시도
  if (!idOf(target, pref)) {
    const resolved = await resolveTrackId(pref, target);
    if (generation !== playGeneration) return;
    if (resolved) {
      target = patchTrackId(target, pref, resolved);
      try {
        await playOn(pref, target, generation);
        return;
      } catch (e) {
        if (generation !== playGeneration) return;
        lastError = e as Error;
      }
    }
  }

  // 4) youtube — 광고 때문에 항상 마지막 fallback (직행 ID → resolve)
  if (!unavailable.youtube) {
    if (!idOf(target, "youtube")) {
      const resolved = await resolveTrackId("youtube", target);
      if (generation !== playGeneration) return;
      if (resolved) target = patchTrackId(target, "youtube", resolved);
    }
    if (idOf(target, "youtube")) {
      try {
        await playOn("youtube", target, generation);
        return;
      } catch (e) {
        if (generation !== playGeneration) return;
        lastError = e as Error;
      }
    }
  }

  throw (
    lastError ??
    new Error("이 트랙은 Tidal/Spotify/YouTube 어느 쪽에서도 재생할 수 없습니다")
  );
}


/**
 * 재생 시작 후 비동기 스트림 에러 (예: tidal 404, youtube 임베드 불가)
 * → 실패한 플랫폼 제외 fallback 순서대로 재시도.
 * track_id당 1회 — 이미 재시도한 트랙이면 동기 경로에 맡기고 종료.
 */
async function handleTrackError(
  failedPlatform: Platform,
  failedId?: string | null,
): Promise<void> {
  const s = usePlayerStore.getState();
  const track = s.queue[s.currentIdx];
  if (!track) return;
  // 이전 트랙의 늦은 에러 이벤트 (사용자가 이미 다른 곡 시작) — 무시
  if (failedId && idOf(track, failedPlatform) !== failedId) return;
  if (retriedTrackId === track.track_id) return; // 재시도 1회 소진
  retriedTrackId = track.track_id;

  // 같은 실패에 대해 동시 진행 중인 동기 경로를 무효화하고 이 재시도가 인계
  const generation = ++playGeneration;

  let target = track;
  for (const p of fallbacksFor(failedPlatform)) {
    if (unavailable[p]) continue;
    if (!idOf(target, p)) {
      const resolved = await resolveTrackId(p, target);
      if (generation !== playGeneration) return;
      if (resolved) target = patchTrackId(target, p, resolved);
    }
    if (!idOf(target, p)) continue;
    try {
      await playOn(p, target, generation);
      if (generation === playGeneration) {
        usePlayerStore.setState({ errorMsg: null });
      }
      return;
    } catch {
      // 이 플랫폼 재시도 실패 — 다음 fallback으로
      if (generation !== playGeneration) return;
    }
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
  return PLAYERS[routed()].pausePlayback();
}


export async function resumePlayback(): Promise<void> {
  return PLAYERS[routed()].resumePlayback();
}


export async function seekTo(ratio: number): Promise<void> {
  return PLAYERS[routed()].seekTo(ratio);
}


export async function setSdkVolume(v: number): Promise<void> {
  return PLAYERS[routed()].setSdkVolume(v);
}


export function getActivePlatform(): Platform | null {
  return active;
}


export function getPrimaryPlatform(): Platform | null {
  return primary;
}
