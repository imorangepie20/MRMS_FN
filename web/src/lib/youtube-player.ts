"use client";

import { usePlayerStore } from "@/store/player";


// YT IFrame API 최소 타입 (전역 @types 의존 없이 좁게 정의)
type YTPlayer = {
  loadVideoById: (videoId: string) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  setVolume: (v: number) => void; // 0~100
  getCurrentTime: () => number;
  getDuration: () => number;
};

let player: YTPlayer | null = null;
let apiLoaded = false;

// facade(player.ts)가 주입하는 트랙 종료 콜백 — 순환 import 회피
let onTrackEnd: (() => void) | null = null;

// 재생 에러 콜백 — facade가 타 플랫폼 재시도/스킵 판단.
// 실패한 videoId를 전달해 facade가 stale 이벤트 (이전 트랙 에러) 를 걸러냄.
let onTrackError: ((failedVideoId: string | null) => void) | null = null;

// 마지막으로 load한 videoId — error 이벤트 발생 시 어떤 트랙 실패인지 식별
let loadedVideoId: string | null = null;

// 교차 재생 시 비활성 플랫폼의 이벤트가 store를 덮어쓰지 않도록 facade가 제어
let active = true;

// 자연 종료(ENDED) 중복 발화 가드 — 한 트랙당 1회
let endedFired = false;

// IFrame API는 진행률 이벤트가 없음 — 1초 폴링으로 position/duration 갱신
// (spotify-player.ts startPolling 패턴)
let pollTimer: ReturnType<typeof setInterval> | null = null;


export function setOnTrackEnd(cb: (() => void) | null): void {
  onTrackEnd = cb;
}


export function setOnTrackError(
  cb: ((failedVideoId: string | null) => void) | null,
): void {
  onTrackError = cb;
}


export function setYoutubeActive(b: boolean): void {
  active = b;
}


// YT.PlayerState: ENDED=0, PLAYING=1, PAUSED=2
function handleStateChange(state: number): void {
  if (state === 1) endedFired = false; // 재생 (재)시작 → 가드 리셋
  if (!active) return;
  if (state === 1) {
    usePlayerStore.setState({ isPlaying: true });
  } else if (state === 2) {
    usePlayerStore.setState({ isPlaying: false });
  } else if (state === 0) {
    if (endedFired) return;
    endedFired = true; // 한 트랙당 1회만 발화
    onTrackEnd?.();
  }
}


// YT 에러 코드: 2(잘못된 파라미터) / 5(HTML5 플레이어 오류) /
// 100(영상 없음·비공개) / 101·150(임베드 재생 불가) — 전부 트랙 실패로 취급,
// facade가 타 플랫폼 재시도/스킵 판단 (tidal-player.ts onTrackError 패턴)
function handleError(code: number): void {
  if (!active) return;
  usePlayerStore.setState({
    errorMsg: `YouTube 재생 오류 (code=${code})`,
    isPlaying: false,
  });
  onTrackError?.(loadedVideoId);
}


function startPolling(): void {
  if (pollTimer) return;
  pollTimer = setInterval(() => {
    if (!player || !active) return;
    try {
      const dur = player.getDuration();
      const cur = player.getCurrentTime();
      if (dur > 0) {
        usePlayerStore.setState({
          position: Math.max(0, Math.min(1, cur / dur)),
          durationSec: dur,
        });
      }
    } catch {
      // 플레이어 일시 오류 — 다음 tick에 재시도
    }
  }, 1_000);
}


async function loadYoutubeScript(): Promise<void> {
  if (apiLoaded) return;
  let scriptEl: HTMLScriptElement | null = null;
  if (!document.querySelector("script[src*='youtube.com/iframe_api']")) {
    scriptEl = document.createElement("script");
    scriptEl.src = "https://www.youtube.com/iframe_api";
    document.body.appendChild(scriptEl);
  }
  await new Promise<void>((resolve, reject) => {
    const w = window as unknown as {
      YT?: { Player?: unknown };
      onYouTubeIframeAPIReady?: () => void;
    };
    if (w.YT?.Player) return resolve();
    w.onYouTubeIframeAPIReady = () => resolve();
    // 로드 실패 (오프라인/차단) 시 무한 대기 방지
    scriptEl?.addEventListener("error", () => {
      scriptEl?.remove();
      reject(
        new Error("YouTube IFrame API 스크립트 로드 실패 (네트워크/차단 확인)"),
      );
    });
    setTimeout(
      () => reject(new Error("YouTube IFrame API 로드 타임아웃 (15초)")),
      15_000,
    );
  });
  // 로드가 실제로 성공했을 때만 캐시 — 실패 후 재시도 가능
  apiLoaded = true;
}


export async function initYoutubeSdk(): Promise<void> {
  if (player) return;
  await loadYoutubeScript();

  // 숨김 컨테이너 — display:none이면 일부 환경에서 재생이 차단될 수 있어
  // 1px + opacity 0.01로 "렌더되지만 안 보이는" 상태 유지.
  // YT.Player가 mount div를 iframe으로 치환하므로 스타일은 wrapper에 적용.
  const wrapper = document.createElement("div");
  wrapper.style.position = "fixed";
  wrapper.style.width = "1px";
  wrapper.style.height = "1px";
  wrapper.style.opacity = "0.01";
  wrapper.style.pointerEvents = "none";
  wrapper.style.left = "0";
  wrapper.style.bottom = "0";
  const mount = document.createElement("div");
  wrapper.appendChild(mount);
  document.body.appendChild(wrapper);

  const w = window as unknown as {
    YT: { Player: new (el: HTMLElement, opts: unknown) => YTPlayer };
  };

  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("YouTube 플레이어 준비 타임아웃 (15초)")),
        15_000,
      );
      player = new w.YT.Player(mount, {
        width: "1",
        height: "1",
        playerVars: {
          origin: window.location.origin,
          playsinline: 1,
        },
        events: {
          onReady: () => {
            clearTimeout(timer);
            // 숨겨진 플레이어 iframe이 포커스를 가져가면 다음 페이지 클릭이
            // "포커스 되찾기"에 한 번 먹혀 첫 클릭이 씹힌다 — 비포커스 처리.
            try {
              const f = (
                player as { getIframe?: () => HTMLIFrameElement } | null
              )?.getIframe?.();
              if (f) {
                f.tabIndex = -1;
                f.setAttribute("aria-hidden", "true");
                f.blur();
              }
            } catch {
              /* getIframe 미지원 시 무시 */
            }
            // tidal/spotify와 동일 — SDK 준비 완료를 store에 알려야
            // PlayerBar의 "initializing" 배너가 사라지고 PlayButton이 활성화된다.
            // (youtube가 primary인 무료 유저가 재생 가능해지는 지점)
            usePlayerStore.setState({ sdkReady: true });
            resolve();
          },
          onStateChange: (e: { data: number }) => handleStateChange(e.data),
          onError: (e: { data: number }) => handleError(e.data),
        },
      });
    });
  } catch (e) {
    player = null; // 다음 시도에서 재초기화 가능하도록
    wrapper.remove();
    throw e;
  }

  startPolling();
}


export async function loadAndPlay(videoId: string): Promise<void> {
  if (!player) {
    throw new Error("YouTube 플레이어 미준비 — SDK init 대기 중");
  }
  endedFired = false;
  loadedVideoId = videoId;
  usePlayerStore.setState({ position: 0, durationSec: 0, isPreview: false });
  player.loadVideoById(videoId); // loadVideoById는 자동 재생
}


export async function pausePlayback(): Promise<void> {
  if (player) player.pauseVideo();
}


export async function resumePlayback(): Promise<void> {
  if (player) player.playVideo();
}


export async function seekTo(ratio: number): Promise<void> {
  const s = usePlayerStore.getState();
  if (player && s.durationSec > 0) {
    player.seekTo(ratio * s.durationSec, true);
  }
}


export async function setSdkVolume(v: number): Promise<void> {
  if (player) {
    player.setVolume(Math.round(Math.max(0, Math.min(1, v)) * 100));
  }
}
