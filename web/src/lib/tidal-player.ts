"use client";

import { usePlayerStore } from "@/store/player";


// 단일 audio element (페이지 lifetime 동안 재사용)
let audioEl: HTMLAudioElement | null = null;


function ensureAudio(): HTMLAudioElement {
  if (audioEl) return audioEl;
  const el = new Audio();
  el.preload = "auto";
  el.crossOrigin = "use-credentials";

  el.addEventListener("playing", () => {
    usePlayerStore.setState({ isPlaying: true });
  });
  el.addEventListener("pause", () => {
    usePlayerStore.setState({ isPlaying: false });
  });
  el.addEventListener("ended", () => {
    // auto-next
    const s = usePlayerStore.getState();
    if (s.currentIdx + 1 < s.queue.length) {
      const nextIdx = s.currentIdx + 1;
      usePlayerStore.setState({ currentIdx: nextIdx, position: 0 });
      const next = s.queue[nextIdx];
      if (next.tidal_track_id) void loadAndPlay(next.tidal_track_id);
    } else {
      usePlayerStore.setState({ isPlaying: false, position: 0 });
    }
  });
  el.addEventListener("timeupdate", () => {
    if (el.duration > 0) {
      usePlayerStore.setState({
        position: el.currentTime / el.duration,
        durationSec: el.duration,
      });
    }
  });
  el.addEventListener("loadedmetadata", () => {
    if (Number.isFinite(el.duration) && el.duration > 0) {
      usePlayerStore.setState({ durationSec: el.duration });
    }
  });
  el.addEventListener("error", () => {
    const err = el.error;
    const msg = err
      ? `audio error code=${err.code} ${err.message ?? ""}`
      : "audio error";
    usePlayerStore.setState({ errorMsg: msg, isPlaying: false });
    // auto-next on error
    const s = usePlayerStore.getState();
    if (s.currentIdx + 1 < s.queue.length) {
      setTimeout(() => {
        const nextIdx = s.currentIdx + 1;
        usePlayerStore.setState({ currentIdx: nextIdx, position: 0 });
        const next = s.queue[nextIdx];
        if (next.tidal_track_id) void loadAndPlay(next.tidal_track_id);
      }, 1000);
    }
  });

  audioEl = el;
  return el;
}


function streamUrl(tidalTrackId: string): string {
  // proxy endpoint
  const base = process.env.NEXT_PUBLIC_API_BASE ?? "/api";
  return `${base}/playback/tidal/stream/${tidalTrackId}`;
}


// SDK init은 더 이상 필요 없음 — store.sdkReady = true 만 세팅
export async function initTidalSdk(_token?: unknown): Promise<void> {
  ensureAudio();
  usePlayerStore.setState({ sdkReady: true });
}


export async function loadAndPlay(tidalTrackId: string): Promise<void> {
  const el = ensureAudio();
  usePlayerStore.setState({ position: 0, durationSec: 0, isPreview: false });
  el.src = streamUrl(tidalTrackId);
  el.load();
  await el.play();
}


export async function pausePlayback(): Promise<void> {
  const el = ensureAudio();
  el.pause();
}


export async function resumePlayback(): Promise<void> {
  const el = ensureAudio();
  await el.play();
}


export async function seekTo(ratio: number): Promise<void> {
  const el = ensureAudio();
  if (el.duration > 0) {
    el.currentTime = ratio * el.duration;
  }
}


export async function setSdkVolume(v: number): Promise<void> {
  const el = ensureAudio();
  el.volume = Math.max(0, Math.min(1, v));
}
