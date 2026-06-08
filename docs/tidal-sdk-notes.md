# Tidal Playback Notes (E.5 implementation)

> Documentation of MRMS_FN's Tidal playback approach. Updated after E.5 ship.

## Approach: Backend proxy, NOT SDK

We do **NOT** use `@tidal-music/player` SDK. We use a legacy REST endpoint that returns plain audio file URLs (no DRM).

### Why not SDK?

Our dev Tidal app's access tier doesn't support FULL DRM streaming. Trying `Player.load()` results in:
- DASH manifest received OK
- CDN segment downloads fail (Widevine challenges fail)
- Only PREVIEW (30s) achievable

### How proxy works

```
Browser <audio>  ←  /api/playback/tidal/stream/{track_id}  (FastAPI)  ←  Tidal CDN
```

1. Frontend `<audio src="/api/playback/tidal/stream/12345">` (HTML5 standard)
2. FastAPI endpoint calls `GET https://api.tidal.com/v1/tracks/{id}/playbackinfo` with user's access_token
3. Response contains base64-encoded `manifest` JSON with `urls[0]` (direct audio file URL)
4. FastAPI fetches from Tidal CDN with `Authorization: Bearer <token>` and streams response to browser
5. Browser plays audio natively

### Credentials

We use python-tidal library's public credentials:
- `TIDAL_CLIENT_ID=fX2JxdmntZWK0ixT`
- `TIDAL_CLIENT_SECRET=1Nn9AfDAjxrgJFJbKNWLeAyKGVGmINuXPPLHVXAvxAg=`
- Scopes: `r_usr w_usr w_sub`
- These are NOT our dev app — they're publicly known credentials used by python-tidal and similar libraries

### OAuth: Device Authorization Code (not Auth Code + PKCE)

The python-tidal client doesn't support Auth Code + PKCE redirect URI. Use Device Authorization Code flow instead:

```bash
.venv/bin/python3 scripts/08c_tidal_device_code.py --email <user>
```

CLI prints a URL like `link.tidal.com/XXXXX`. User visits it, approves. CLI polls token endpoint until granted.

### Reference: my-forever-music

User's other project `~/music-space/my-forever-music` uses the same approach with a Spring Boot backend instead of FastAPI. Key files for reference:
- `services/api/src/main/java/.../TidalDeviceAuthorizationService.java`
- `apps/web/src/lib/tidalStreamPlayback.ts`

### Key files in MRMS_FN

- `src/mrms/api/auth_tidal.py` — `/api/auth/tidal/{token,refresh}` + `/api/playback/tidal/stream/{id}`
- `web/src/lib/tidal-player.ts` — HTMLAudioElement singleton + event wiring
- `web/src/store/player.ts` — Zustand state (queue, currentIdx, position, ...)
- `scripts/08c_tidal_device_code.py` — Device Code OAuth CLI

### Historical: original SDK research

(Earlier version of this doc had SDK research. Preserved in git history at commit `c48fe5b`. Not relevant to current implementation.)
