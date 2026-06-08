"use client";

import { useEffect, useRef, useState } from "react";

type TokenResp = {
  access_token: string;
  refresh_token: string;
  expires_at: string | null;
  scope: string[];
};

type LogLine = { ts: string; msg: string };

const NEXT_PUBLIC_TIDAL_CLIENT_ID = process.env.NEXT_PUBLIC_TIDAL_CLIENT_ID ?? "";

export default function TidalTestPage() {
  const [token, setToken] = useState<TokenResp | null>(null);
  const [status, setStatus] = useState<string>("init");
  const [trackId, setTrackId] = useState<string>("");
  const [logs, setLogs] = useState<LogLine[]>([]);
  const bootedRef = useRef(false);

  const log = (msg: string) => {
    const line = { ts: new Date().toISOString().slice(11, 23), msg };
    setLogs((prev) => [...prev, line]);
    console.log("[tidal-test]", msg);
  };

  useEffect(() => {
    fetch("/api/auth/tidal/token")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d: TokenResp) => {
        setToken(d);
        setStatus("token loaded");
      })
      .catch((e) => {
        setStatus("token fetch fail: " + e.message);
      });
  }, []);

  const test = async () => {
    if (!token || !trackId) return;
    if (!NEXT_PUBLIC_TIDAL_CLIENT_ID) {
      setStatus("NEXT_PUBLIC_TIDAL_CLIENT_ID env missing");
      return;
    }

    setStatus("loading SDK...");
    try {
      const [authMod, playerMod] = await Promise.all([
        import("@tidal-music/auth"),
        import("@tidal-music/player"),
      ]);
      const auth = authMod;
      const Player = playerMod;
      log("SDK modules loaded");

      if (!bootedRef.current) {
        setStatus("auth.init...");
        const scopes = ["r_usr", "w_usr"];
        await auth.init({
          clientId: NEXT_PUBLIC_TIDAL_CLIENT_ID,
          credentialsStorageKey: "mrms-tidal-test",
          scopes,
        });
        log("auth.init done");

        setStatus("auth.setCredentials...");
        const expiresMs = token.expires_at
          ? new Date(token.expires_at).getTime()
          : Date.now() + 60 * 60 * 1000;
        await auth.setCredentials({
          accessToken: {
            clientId: NEXT_PUBLIC_TIDAL_CLIENT_ID,
            expires: expiresMs,
            grantedScopes: scopes,
            requestedScopes: scopes,
            token: token.access_token,
          },
          refreshToken: token.refresh_token,
        });
        log("auth.setCredentials done");

        Player.setCredentialsProvider(auth.credentialsProvider);
        log("Player.setCredentialsProvider done");

        // Event sender: noop is fine for smoke test. load() throws without one.
        Player.setEventSender({
          sendEvent() {
            /* noop for smoke test */
          },
        });
        log("Player.setEventSender(noop) done");

        // Subscribe to events BEFORE load/play so we see everything.
        Player.events.addEventListener("playback-state-change", (e) => {
          const detail = (e as CustomEvent).detail;
          log(`event: playback-state-change ${JSON.stringify(detail)}`);
        });
        Player.events.addEventListener("media-product-transition", (e) => {
          const detail = (e as CustomEvent).detail;
          log(`event: media-product-transition ${JSON.stringify(detail)}`);
        });
        Player.events.addEventListener("ended", (e) => {
          const detail = (e as CustomEvent).detail;
          log(`event: ended ${JSON.stringify(detail)}`);
        });
        Player.events.addEventListener("playback-quality-changed", (e) => {
          const detail = (e as CustomEvent).detail;
          log(`event: playback-quality-changed ${JSON.stringify(detail)}`);
        });
        Player.events.addEventListener("streaming-privileges-revoked", () => {
          log(`event: streaming-privileges-revoked`);
        });
        Player.events.addEventListener("error", (e) => {
          const detail = (e as CustomEvent).detail;
          log(`event: error ${JSON.stringify(detail)}`);
        });
        log("event listeners attached");

        bootedRef.current = true;
      } else {
        log("already booted; reusing Player");
      }

      setStatus(`load(${trackId})...`);
      await Player.load(
        {
          productId: trackId,
          productType: "track",
          sourceId: trackId,
          sourceType: "TRACK",
        },
        0,
        false,
      );
      log("load done");

      setStatus("play()...");
      await Player.play();
      log("play resolved");
      setStatus("playing!");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[tidal-test] error", e);
      log(`exception: ${msg}`);
      setStatus("error: " + msg);
    }
  };

  const pause = async () => {
    try {
      const Player = await import("@tidal-music/player");
      await Player.pause();
      log("pause resolved");
      setStatus("paused");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatus("pause error: " + msg);
    }
  };

  return (
    <div className="p-8 space-y-4 max-w-2xl">
      <h1 className="text-2xl font-semibold">Tidal SDK Smoke Test</h1>
      <p>
        Status: <strong>{status}</strong>
      </p>
      <p className="text-sm">
        Token: {token ? "loaded" : "not loaded"}
        {token?.expires_at ? ` (expires ${token.expires_at})` : ""}
      </p>
      <p className="text-sm">
        Client ID: {NEXT_PUBLIC_TIDAL_CLIENT_ID || "(missing — set NEXT_PUBLIC_TIDAL_CLIENT_ID)"}
      </p>
      <input
        type="text"
        placeholder="Tidal track ID (e.g. 12345678)"
        value={trackId}
        onChange={(e) => setTrackId(e.target.value.trim())}
        className="border px-2 py-1 rounded w-full"
      />
      <div className="flex gap-2">
        <button
          onClick={test}
          disabled={!token || !trackId || !NEXT_PUBLIC_TIDAL_CLIENT_ID}
          className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
        >
          Load + Play
        </button>
        <button
          onClick={pause}
          className="px-4 py-2 bg-gray-500 text-white rounded"
        >
          Pause
        </button>
      </div>
      <p className="text-xs text-gray-500">
        Tidal 즐겨찾기에서 track URL의 숫자 ID를 복사해서 위에 넣으세요. 예:
        <code className="ml-1">https://tidal.com/browse/track/<b>12345678</b></code>
      </p>
      <div className="border rounded p-3 bg-slate-50 max-h-96 overflow-auto text-xs font-mono space-y-1">
        {logs.length === 0 ? (
          <div className="text-gray-400">no logs yet</div>
        ) : (
          logs.map((l, i) => (
            <div key={i}>
              <span className="text-gray-500">{l.ts}</span> {l.msg}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
