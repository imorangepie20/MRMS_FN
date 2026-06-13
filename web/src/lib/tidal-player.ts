"use client";

import { usePlayerStore } from "@/store/player";


// 단일 audio element (페이지 lifetime 동안 재사용)
let audioEl: HTMLAudioElement | null = null;

// facade(player.ts)가 주입하는 트랙 종료 콜백 — 순환 import 회피.
// auto-next 판단(큐 진행, 교차 플랫폼 포함)은 전적으로 facade 책임.
let onTrackEnd: (() => void) | null = null;

// 재생 에러 콜백 — facade가 타 플랫폼 재시도/스킵 판단.
// 실패한 tidal track id를 전달해 facade가 stale 이벤트 (이전 트랙 에러) 를 걸러냄.
let onTrackError: ((failedTidalId: string | null) => void) | null = null;

// 마지막으로 load한 tidal track id — error 이벤트 발생 시 어떤 트랙 실패인지 식별
let loadedTidalId: string | null = null;

// ── Web Audio 캡처 (비주얼 이퀄라이저용) ──────────────────
// audioEl 을 1회만 그래프로 라우팅한다(createMediaElementSource 는 element당 1회).
let audioCtx: AudioContext | null = null;
let analyserNode: AnalyserNode | null = null;

// loadAndPlay / resumePlayback (유저 제스처 경로) 첫머리에서 매번 호출.
// 그래프가 한번 생기면 audioEl 의 모든 출력이 영구히 그래프 경유 →
// destination 연결 필수(안 하면 무음). 실패해도 재생은 막지 않는다(EQ만 생략).
function ensureAnalyser(): void {
  try {
    const el = ensureAudio();
    if (!audioCtx) {
      type WindowWithWebkit = Window & {
        webkitAudioContext?: typeof AudioContext;
      };
      const Ctx =
        window.AudioContext ?? (window as WindowWithWebkit).webkitAudioContext;
      if (!Ctx) return; // Web Audio 미지원 → EQ만 생략
      audioCtx = new Ctx();
      const srcNode = audioCtx.createMediaElementSource(el); // element당 1회
      analyserNode = audioCtx.createAnalyser();
      analyserNode.fftSize = 256; // frequencyBinCount = 128
      analyserNode.smoothingTimeConstant = 0; // 스무딩은 컴포넌트가 직접
      srcNode.connect(analyserNode);
      analyserNode.connect(audioCtx.destination); // 필수
    }
    if (audioCtx.state === "suspended") void audioCtx.resume();
  } catch {
    audioCtx = null;
    analyserNode = null;
  }
}

export function getTidalAnalyser(): AnalyserNode | null {
  return analyserNode;
}

// 교차 재생 시 비활성 플랫폼의 이벤트가 store를 덮어쓰지 않도록 facade가 제어
let active = true;


export function setOnTrackEnd(cb: (() => void) | null): void {
  onTrackEnd = cb;
}


export function setOnTrackError(
  cb: ((failedTidalId: string | null) => void) | null,
): void {
  onTrackError = cb;
}


export function setTidalActive(b: boolean): void {
  active = b;
}


function ensureAudio(): HTMLAudioElement {
  if (audioEl) return audioEl;
  const el = new Audio();
  el.preload = "auto";
  el.crossOrigin = "use-credentials";

  el.addEventListener("playing", () => {
    if (!active) return;
    usePlayerStore.setState({ isPlaying: true });
  });
  el.addEventListener("pause", () => {
    if (!active) return;
    usePlayerStore.setState({ isPlaying: false });
  });
  el.addEventListener("ended", () => {
    if (!active) return;
    if (onTrackEnd) {
      onTrackEnd();
    } else {
      usePlayerStore.setState({ isPlaying: false, position: 0 });
    }
  });
  el.addEventListener("timeupdate", () => {
    if (!active) return;
    if (el.duration > 0) {
      usePlayerStore.setState({
        position: el.currentTime / el.duration,
        durationSec: el.duration,
      });
    }
  });
  el.addEventListener("loadedmetadata", () => {
    if (!active) return;
    if (Number.isFinite(el.duration) && el.duration > 0) {
      usePlayerStore.setState({ durationSec: el.duration });
    }
  });
  el.addEventListener("error", () => {
    if (!active) return;
    const err = el.error;
    const msg = err
      ? `audio error code=${err.code} ${err.message ?? ""}`
      : "audio error";
    usePlayerStore.setState({ errorMsg: msg, isPlaying: false });
    // 재생 에러 → facade가 타 플랫폼 재시도/스킵 판단 (즉시 호출)
    if (onTrackError) {
      onTrackError(loadedTidalId);
      return;
    }
    // onTrackError 미등록 시 기존 동작: auto-next on error
    if (onTrackEnd) {
      const cb = onTrackEnd;
      setTimeout(() => {
        if (active) cb();
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
  ensureAnalyser();
  loadedTidalId = tidalTrackId;
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
  ensureAnalyser();
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
