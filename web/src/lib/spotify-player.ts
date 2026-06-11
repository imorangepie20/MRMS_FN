"use client";

import { usePlayerStore } from "@/store/player";


type SpotifyPlayer = {
  connect: () => Promise<boolean>;
  disconnect: () => void;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  seek: (positionMs: number) => Promise<void>;
  setVolume: (v: number) => Promise<void>;
  addListener: (event: string, cb: (state: unknown) => void) => boolean;
  getCurrentState: () => Promise<unknown>;
};

type SpotifyState = { paused: boolean; position: number; duration: number };

let player: SpotifyPlayer | null = null;
let deviceId: string | null = null;
let cachedToken: { value: string; expiresAt: number } | null = null;
let sdkLoaded = false;

// facade(player.ts)가 주입하는 트랙 종료 콜백 — 순환 import 회피
let onTrackEnd: (() => void) | null = null;

// 교차 재생 시 비활성 플랫폼의 이벤트가 store를 덮어쓰지 않도록 facade가 제어
let active = true;

// 자연 종료 감지용 직전 상태 스냅샷 + 중복 발화 가드 (한 트랙당 1회)
let prevPaused = true;
let prevPositionMs = 0;
let endedFired = false;

// SDK는 player_state_changed를 드물게만 발화 — 1초 폴링으로 보완.
// (자연 종료 감지의 prevPositionMs를 신선하게 유지 + 진행바 갱신)
let pollTimer: ReturnType<typeof setInterval> | null = null;


function processState(s: SpotifyState): void {
  // 자연 종료: 재생 중 → paused && position 0 전환 + 직전 위치가 끝 근처
  // (95% 또는 끝에서 2.5초 이내 — 짧은 트랙 대비)
  const nearEnd =
    s.duration > 0 &&
    (prevPositionMs >= s.duration * 0.95 ||
      prevPositionMs >= s.duration - 2_500);
  const naturallyEnded = !prevPaused && s.paused && s.position === 0 && nearEnd;

  if (!s.paused) endedFired = false; // 재생 (재)시작 → 가드 리셋
  prevPaused = s.paused;
  prevPositionMs = s.position;

  if (!active) return;

  usePlayerStore.setState({
    isPlaying: !s.paused,
    position: s.duration > 0 ? s.position / s.duration : 0,
    durationSec: s.duration / 1000,
  });

  if (naturallyEnded && !endedFired) {
    endedFired = true; // 한 트랙당 1회만 발화
    onTrackEnd?.();
  }
}


function startPolling(): void {
  if (pollTimer) return;
  pollTimer = setInterval(() => {
    if (!player || !active) return;
    player
      .getCurrentState()
      .then((st) => {
        if (st) processState(st as SpotifyState);
      })
      .catch(() => {
        // SDK 일시 오류 — 다음 tick에 재시도
      });
  }, 1_000);
}


export function setOnTrackEnd(cb: (() => void) | null): void {
  onTrackEnd = cb;
}


export function setSpotifyActive(b: boolean): void {
  active = b;
}


/** 'ready' 이벤트로 deviceId가 세팅될 때까지 대기. 초과 시 throw. */
export async function waitForDevice(timeoutMs = 10_000): Promise<void> {
  if (deviceId) return;
  const start = Date.now();
  while (!deviceId) {
    if (Date.now() - start >= timeoutMs) {
      throw new Error(
        `Spotify 디바이스 준비 시간 초과 (${Math.round(timeoutMs / 1000)}초) — Spotify 연동/Premium 상태를 확인하세요`,
      );
    }
    await new Promise((r) => setTimeout(r, 200));
  }
}


async function getToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.value;
  }
  const r = await fetch("/api/auth/spotify/token", { credentials: "include" });
  if (!r.ok) throw new Error(`Spotify token fetch failed: ${r.status}`);
  const data = await r.json();
  const expMs = data.expires_at
    ? new Date(data.expires_at).getTime()
    : Date.now() + 3600 * 1000;
  cachedToken = { value: data.access_token, expiresAt: expMs };
  return data.access_token;
}


async function loadSpotifyScript(): Promise<void> {
  if (sdkLoaded) return;
  let scriptEl: HTMLScriptElement | null = null;
  if (!document.querySelector("script[src*='spotify-player.js']")) {
    scriptEl = document.createElement("script");
    scriptEl.src = "https://sdk.scdn.co/spotify-player.js";
    document.body.appendChild(scriptEl);
  }
  await new Promise<void>((resolve, reject) => {
    const w = window as unknown as {
      Spotify?: unknown;
      onSpotifyWebPlaybackSDKReady?: () => void;
    };
    if (w.Spotify) return resolve();
    w.onSpotifyWebPlaybackSDKReady = () => resolve();
    // 로드 실패 (오프라인/차단) 시 무한 대기 방지
    scriptEl?.addEventListener("error", () => {
      scriptEl?.remove();
      reject(new Error("Spotify SDK 스크립트 로드 실패 (네트워크/차단 확인)"));
    });
    setTimeout(
      () => reject(new Error("Spotify SDK 로드 타임아웃 (15초)")),
      15_000,
    );
  });
  // 로드가 실제로 성공했을 때만 캐시 — 실패 후 재시도 가능
  sdkLoaded = true;
}


export async function initSpotifySdk(): Promise<void> {
  if (player) return;
  await loadSpotifyScript();
  const w = window as unknown as {
    Spotify: { Player: new (opts: unknown) => SpotifyPlayer };
  };
  player = new w.Spotify.Player({
    name: "MRMS",
    getOAuthToken: (cb: (t: string) => void) => {
      getToken()
        .then(cb)
        .catch((e: Error) => {
          usePlayerStore.setState({
            errorMsg: `Spotify 토큰 발급 실패 — Spotify 계정 연동이 필요합니다 (${e.message})`,
          });
        });
    },
    volume: 0.8,
  });

  player.addListener("ready", (state: unknown) => {
    const s = state as { device_id: string };
    deviceId = s.device_id;
    usePlayerStore.setState({ sdkReady: true });
  });
  player.addListener("not_ready", () => {
    if (!active) return;
    usePlayerStore.setState({ sdkReady: false });
  });
  player.addListener("player_state_changed", (state: unknown) => {
    if (!state) return;
    processState(state as SpotifyState);
  });
  player.addListener("initialization_error", (state: unknown) => {
    const s = state as { message: string };
    usePlayerStore.setState({
      errorMsg: `Spotify SDK 초기화 실패: ${s.message}`,
    });
  });
  player.addListener("account_error", () => {
    usePlayerStore.setState({
      errorMsg: "Spotify Premium 구독이 필요합니다",
    });
  });
  player.addListener("authentication_error", (state: unknown) => {
    const s = state as { message: string };
    usePlayerStore.setState({
      errorMsg: `Spotify 인증 실패: ${s.message}`,
    });
  });

  const connected = await player.connect();
  if (!connected) {
    player = null; // 다음 시도에서 재초기화 가능하도록
    throw new Error("Spotify 플레이어 연결 실패 — Spotify 계정 연동을 확인하세요");
  }

  startPolling();
}


export async function loadAndPlay(spotifyTrackId: string): Promise<void> {
  if (!deviceId) {
    throw new Error("Spotify device 미준비 — SDK init 대기 중");
  }
  endedFired = false;
  prevPaused = true;
  prevPositionMs = 0;
  usePlayerStore.setState({ position: 0, durationSec: 0, isPreview: false });
  const token = await getToken();
  const r = await fetch(
    `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ uris: [`spotify:track:${spotifyTrackId}`] }),
    },
  );
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`Spotify play failed ${r.status}: ${text.slice(0, 200)}`);
  }
}


export async function pausePlayback(): Promise<void> {
  if (player) await player.pause();
}


export async function resumePlayback(): Promise<void> {
  if (player) await player.resume();
}


export async function seekTo(ratio: number): Promise<void> {
  const s = usePlayerStore.getState();
  if (player && s.durationSec > 0) {
    await player.seek(Math.floor(ratio * s.durationSec * 1000));
  }
}


export async function setSdkVolume(v: number): Promise<void> {
  if (player) await player.setVolume(Math.max(0, Math.min(1, v)));
}
