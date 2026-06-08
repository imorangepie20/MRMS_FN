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
};

let player: SpotifyPlayer | null = null;
let deviceId: string | null = null;
let cachedToken: { value: string; expiresAt: number } | null = null;
let sdkLoaded = false;


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
  sdkLoaded = true;
  if (!document.querySelector("script[src*='spotify-player.js']")) {
    const s = document.createElement("script");
    s.src = "https://sdk.scdn.co/spotify-player.js";
    document.body.appendChild(s);
  }
  await new Promise<void>((resolve) => {
    const w = window as unknown as {
      Spotify?: unknown;
      onSpotifyWebPlaybackSDKReady?: () => void;
    };
    if (w.Spotify) return resolve();
    w.onSpotifyWebPlaybackSDKReady = () => resolve();
  });
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
      void getToken().then(cb);
    },
    volume: 0.8,
  });

  player.addListener("ready", (state: unknown) => {
    const s = state as { device_id: string };
    deviceId = s.device_id;
    usePlayerStore.setState({ sdkReady: true });
  });
  player.addListener("not_ready", () => {
    usePlayerStore.setState({ sdkReady: false });
  });
  player.addListener("player_state_changed", (state: unknown) => {
    if (!state) return;
    const s = state as { paused: boolean; position: number; duration: number };
    usePlayerStore.setState({
      isPlaying: !s.paused,
      position: s.duration > 0 ? s.position / s.duration : 0,
      durationSec: s.duration / 1000,
    });
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

  await player.connect();
}


export async function loadAndPlay(spotifyTrackId: string): Promise<void> {
  if (!deviceId) {
    throw new Error("Spotify device 미준비 — SDK init 대기 중");
  }
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
