"use client";

import type { QueueTrack } from "@/store/player";
import { usePlayerStore } from "@/store/player";

import * as spotifyPlayer from "./spotify-player";
import * as tidalPlayer from "./tidal-player";
import * as youtubePlayer from "./youtube-player";


export type Platform = "tidal" | "spotify" | "youtube";

// primary는 현재 연결된 최선 플랫폼 (tidal > spotify > youtube).
// youtube는 무료 baseline이라 primary로도 올 수 있다 (유료 구독 없는 유저).
// 단, tidal/spotify가 primary일 때는 youtube가 여전히 광고 때문에 마지막 fallback.
export type PrimaryPlatform = Platform;

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

// 사용자 선호 (primary) — initPlayer가 세팅. 현재 연결된 최선 플랫폼
// (tidal > spotify > youtube). 무료 유저는 youtube가 primary일 수 있다.
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
  primaryPlatform: PrimaryPlatform | null,
): Promise<void> {
  primary = primaryPlatform;
  // 미연결 유저(primary=null): 연결된 플랫폼이 없으므로 어떤 SDK도 초기화하지
  // 않는다. playOrderFor(null)=[]이라 재생 시도도 안 함 (재생 불가, 기존과 동일).
  // 콜백/SDK는 구독 연결 후 재마운트 때 다시 init된다.
  if (primaryPlatform === null) return;
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


/**
 * primary 기준 전체 재생 시도 순서.
 * - primary가 youtube(무료 유저): [youtube, tidal, spotify] — youtube로 먼저 재생.
 * - primary가 tidal/spotify: [primary, 나머지 non-youtube, youtube] — youtube는
 *   광고 때문에 항상 맨 마지막 fallback.
 * primary가 null이면 연결된 플랫폼 없음 → 빈 배열 (재생 불가, 기존과 동일).
 */
function playOrderFor(pref: Platform | null): Platform[] {
  if (pref === null) return [];
  if (pref === "youtube") return ["youtube", "tidal", "spotify"];
  // tidal/spotify primary: primary 먼저, 나머지 non-youtube, youtube 맨 마지막
  return [pref, ...FALLBACK_ORDER.filter((p) => p !== pref && p !== "youtube"), "youtube"];
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
  for (const p of playOrderFor(primary)) {
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
  usePlayerStore.setState({ activePlatform: platform });
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
 * 트랙 재생 — playOrderFor(primary) 순서대로 시도.
 * 각 플랫폼: ID 있으면 직행, 없으면 재생 시점 resolve API로 lazy 해결 (성공 시 queue에 patch).
 * - tidal/spotify primary: primary → 나머지 non-youtube → youtube(광고 때문에 맨 마지막).
 * - youtube primary(무료 유저): youtube 먼저 시도 (ID 없으면 resolve(youtube)로 해결).
 * 모든 await 뒤 generation 체크로 race 시 이중 재생 방지.
 */
export async function loadAndPlay(track: QueueTrack): Promise<void> {
  const generation = ++playGeneration;
  retriedTrackId = null; // 명시적 재생 — 비동기 에러 재시도 마커 리셋

  let target = track;
  let lastError: Error | null = null;

  for (const p of playOrderFor(primary)) {
    if (unavailable[p]) continue;
    // ID 없으면 resolve로 lazy 해결 (연동 카탈로그 검색)
    if (!idOf(target, p)) {
      const resolved = await resolveTrackId(p, target);
      if (generation !== playGeneration) return; // 더 새로운 요청이 인계
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


// ─── 셔플/반복 — 다음 인덱스 선택 ───────────────────────
// 셔플은 store가 아닌 모듈 수준에서 "이번 사이클에 재생한 인덱스"를 추적해
// 한 사이클 안에서 같은 곡이 반복되지 않게 한다 (큐 길이가 바뀌면 사이클 리셋).
let shufflePlayed = new Set<number>();
let shuffleQueueLen = -1;

/** 셔플 사이클 초기화 — 셔플 토글/큐 교체 시 호출. */
export function resetShuffle(): void {
  shufflePlayed = new Set();
  shuffleQueueLen = -1;
}

function pickShuffleNext(
  len: number,
  currentIdx: number,
  repeatAll: boolean,
): number | null {
  if (len !== shuffleQueueLen) {
    shuffleQueueLen = len;
    shufflePlayed = new Set();
  }
  shufflePlayed.add(currentIdx);
  const remaining: number[] = [];
  for (let i = 0; i < len; i++) {
    if (i !== currentIdx && !shufflePlayed.has(i)) remaining.push(i);
  }
  if (remaining.length === 0) {
    if (!repeatAll) return null; // 다 돌았고 전체반복 아님 → 정지
    // 사이클 리셋 후 현재 곡 제외 무작위
    shufflePlayed = new Set([currentIdx]);
    const all: number[] = [];
    for (let i = 0; i < len; i++) if (i !== currentIdx) all.push(i);
    if (all.length === 0) return currentIdx;
    return all[Math.floor(Math.random() * all.length)];
  }
  return remaining[Math.floor(Math.random() * remaining.length)];
}

/** 다음 인덱스 — 셔플/반복 반영. auto=자연종료(한곡반복 적용), false=수동 skip. */
function pickNextIndex(auto: boolean): number | null {
  const s = usePlayerStore.getState();
  const len = s.queue.length;
  if (len === 0) return null;
  if (auto && s.repeatMode === "one") return s.currentIdx; // 한곡반복은 자동진행만
  const repeatAll = s.repeatMode === "all";
  if (s.shuffleMode) return pickShuffleNext(len, s.currentIdx, repeatAll);
  const next = s.currentIdx + 1;
  if (next < len) return next;
  return repeatAll ? 0 : null; // 끝: 전체반복이면 처음으로, 아니면 정지
}

async function goToIndex(idx: number): Promise<void> {
  const s = usePlayerStore.getState();
  const track = s.queue[idx];
  if (!track) return;
  usePlayerStore.setState({ currentIdx: idx, position: 0 });
  try {
    await loadAndPlay(track);
  } catch (e) {
    usePlayerStore.setState({ errorMsg: (e as Error).message, isPlaying: false });
  }
}

/** 트랙 자연 종료/에러 시 큐 진행 — 셔플/반복 반영. 끝이면 정지. */
export async function advanceToNext(): Promise<void> {
  const idx = pickNextIndex(true);
  if (idx === null) {
    usePlayerStore.setState({ isPlaying: false, position: 0 });
    return;
  }
  await goToIndex(idx);
}

/** 수동 다음 곡 — 셔플/전체반복 반영 (한곡반복은 무시하고 진행). */
export async function playNext(): Promise<void> {
  const idx = pickNextIndex(false);
  if (idx === null) return;
  await goToIndex(idx);
}

/** 수동 이전 곡 — 순차(-1). 맨 앞이면 무시. */
export async function playPrev(): Promise<void> {
  const s = usePlayerStore.getState();
  if (s.currentIdx > 0) await goToIndex(s.currentIdx - 1);
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
