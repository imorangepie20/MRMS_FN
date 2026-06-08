"use client";

import { refreshTidalToken } from "@/lib/api";
import { usePlayerStore } from "@/store/player";


let bootstrapped = false;

const SCOPES = ["r_usr", "w_usr"];

let cachedClientId: string | null = null;


function clientId(): string {
  if (cachedClientId) return cachedClientId;
  const fromEnv = process.env.NEXT_PUBLIC_TIDAL_CLIENT_ID;
  if (!fromEnv) {
    throw new Error("NEXT_PUBLIC_TIDAL_CLIENT_ID env not set");
  }
  cachedClientId = fromEnv;
  return cachedClientId;
}


export async function initTidalSdk(token: {
  access_token: string;
  refresh_token?: string;
  expires_at: string | null;
}): Promise<void> {
  if (bootstrapped) {
    // 토큰 갱신: 같은 SDK 인스턴스 + 새 credentials
    await applyCredentials(token);
    return;
  }

  const [authMod, playerMod] = await Promise.all([
    import("@tidal-music/auth"),
    import("@tidal-music/player"),
  ]);
  const auth = authMod;
  const Player = playerMod;

  await auth.init({
    clientId: clientId(),
    credentialsStorageKey: "mrms-tidal-player",
    scopes: SCOPES,
  });

  await applyCredentialsViaAuth(auth, token);

  Player.setCredentialsProvider(auth.credentialsProvider);
  // SDK 타입은 event-producer 모듈 전체를 요구하지만, smoke test에서
  // { sendEvent() {} } noop이 런타임 OK임을 확인. 타입만 우회.
  (Player.setEventSender as unknown as (s: { sendEvent: () => void }) => void)({
    sendEvent() {
      // noop — telemetry is OOS for E.5
    },
  });

  // 이벤트 wiring
  Player.events.addEventListener("playback-state-change", (e) => {
    const detail = (e as CustomEvent).detail;
    if (detail?.state === "PLAYING") {
      usePlayerStore.setState({ isPlaying: true });
    } else if (detail?.state === "NOT_PLAYING") {
      usePlayerStore.setState({ isPlaying: false });
    }
  });

  Player.events.addEventListener("media-product-transition", (e) => {
    const detail = (e as CustomEvent).detail;
    const ctx = detail?.playbackContext;
    if (ctx) {
      const isPreview =
        ctx.actualAssetPresentation === "PREVIEW" || Boolean(ctx.previewReason);
      usePlayerStore.setState({
        isPreview,
        durationSec: ctx.actualDuration ?? 0,
      });
    }
  });

  Player.events.addEventListener("ended", () => {
    // 자동 다음 곡
    const s = usePlayerStore.getState();
    if (s.currentIdx + 1 < s.queue.length) {
      const nextIdx = s.currentIdx + 1;
      usePlayerStore.setState({ currentIdx: nextIdx, position: 0 });
      const next = s.queue[nextIdx];
      void loadAndPlay(next.tidal_track_id);
    } else {
      usePlayerStore.setState({ isPlaying: false });
    }
  });

  Player.events.addEventListener("playback-quality-changed", (e) => {
    const detail = (e as CustomEvent).detail;
    const ctx = detail?.playbackContext;
    if (ctx) {
      const isPreview =
        ctx.actualAssetPresentation === "PREVIEW" || Boolean(ctx.previewReason);
      usePlayerStore.setState({
        isPreview,
        durationSec: ctx.actualDuration ?? 0,
      });
    }
  });

  Player.events.addEventListener("error", async (e) => {
    const detail = (e as CustomEvent).detail;
    const msg = typeof detail === "string"
      ? detail
      : detail?.message ?? JSON.stringify(detail ?? {});

    // 401-ish → refresh + 재시도
    const looks401 = /unauthor|401|expired/i.test(String(msg));
    if (looks401) {
      try {
        const t = await refreshTidalToken();
        await applyCredentialsViaAuth(auth, {
          access_token: t.access_token,
          expires_at: t.expires_at,
        });
        const cur = usePlayerStore.getState();
        const item = cur.queue[cur.currentIdx];
        if (item) await loadAndPlay(item.tidal_track_id);
        return;
      } catch (refreshErr) {
        usePlayerStore.setState({
          errorMsg: "토큰 갱신 실패 — 재인증 필요",
        });
        return;
      }
    }

    usePlayerStore.setState({ errorMsg: msg });
    // 다음 곡 자동 전환
    const s = usePlayerStore.getState();
    if (s.currentIdx + 1 < s.queue.length) {
      const nextIdx = s.currentIdx + 1;
      usePlayerStore.setState({ currentIdx: nextIdx, position: 0 });
      const next = s.queue[nextIdx];
      await new Promise((r) => setTimeout(r, 1000));
      void loadAndPlay(next.tidal_track_id);
    }
  });

  bootstrapped = true;
  usePlayerStore.setState({ sdkReady: true });

  // position polling — SDK는 positionupdate 이벤트가 없으므로
  setInterval(async () => {
    if (!bootstrapped) return;
    const s = usePlayerStore.getState();
    if (!s.isPlaying || s.durationSec <= 0) return;
    try {
      const Player = await import("@tidal-music/player");
      const pos = (Player as unknown as { getAssetPosition?: () => number })
        .getAssetPosition?.();
      if (typeof pos === "number" && pos >= 0) {
        usePlayerStore.setState({ position: pos / s.durationSec });
      }
    } catch {
      // ignore
    }
  }, 500);
}


async function applyCredentials(token: {
  access_token: string;
  refresh_token?: string;
  expires_at: string | null;
}): Promise<void> {
  const authMod = await import("@tidal-music/auth");
  await applyCredentialsViaAuth(authMod, token);
}


// auth namespace를 받아서 credentials 적용 (재사용 방지용 분리)
async function applyCredentialsViaAuth(
  auth: typeof import("@tidal-music/auth"),
  token: {
    access_token: string;
    refresh_token?: string;
    expires_at: string | null;
  },
): Promise<void> {
  const expiresMs = token.expires_at
    ? new Date(token.expires_at).getTime()
    : Date.now() + 60 * 60 * 1000;
  await auth.setCredentials({
    accessToken: {
      clientId: clientId(),
      expires: expiresMs,
      grantedScopes: SCOPES,
      requestedScopes: SCOPES,
      token: token.access_token,
    },
    refreshToken: token.refresh_token,
  });
}


export async function loadAndPlay(tidalTrackId: string): Promise<void> {
  if (!bootstrapped) throw new Error("Tidal SDK not initialized");
  const Player = await import("@tidal-music/player");
  await Player.load(
    {
      productId: tidalTrackId,
      productType: "track",
      sourceId: tidalTrackId,
      sourceType: "TRACK",
    },
    0,
    false,
  );
  await Player.play();
}


export async function pausePlayback(): Promise<void> {
  if (!bootstrapped) return;
  const Player = await import("@tidal-music/player");
  await Player.pause();
}


export async function resumePlayback(): Promise<void> {
  if (!bootstrapped) return;
  const Player = await import("@tidal-music/player");
  await Player.play();
}


export async function seekTo(ratio: number): Promise<void> {
  if (!bootstrapped) return;
  const s = usePlayerStore.getState();
  if (s.durationSec <= 0) return;
  const Player = await import("@tidal-music/player");
  // seek SDK signature: seek(seconds)?  smoke test에선 안 썼지만 일반적
  const seekFn = (Player as unknown as { seek?: (sec: number) => Promise<void> })
    .seek;
  if (typeof seekFn === "function") {
    await seekFn(ratio * s.durationSec);
  }
}


export async function setSdkVolume(v: number): Promise<void> {
  if (!bootstrapped) return;
  const Player = await import("@tidal-music/player");
  const setVol = (Player as unknown as { setVolumeLevel?: (v: number) => Promise<void> })
    .setVolumeLevel;
  if (typeof setVol === "function") {
    await setVol(Math.max(0, Math.min(1, v)));
  }
}
