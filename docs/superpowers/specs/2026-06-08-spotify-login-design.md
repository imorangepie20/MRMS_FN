# Sub-project G: Spotify Alternative Login (Design)

**날짜**: 2026-06-08
**상태**: 디자인 (사용자 승인 완료)
**범위**: Tidal 외에 Spotify로도 가입/로그인 가능하게 만든다. F (Tidal) 패턴 미러링하되 Spotify의 OAuth flow + Web Playback SDK 특성에 맞춰 구현.

## 1. Goal + 사용자 의도

F sub-project가 Tidal-only 가입을 만들었다. 이제 **Spotify로도** 동일 경험(가입 → 첫 추천 → 풀 재생)이 가능하게 확장. 추가 연결(같은 사용자가 두 플랫폼 모두) 은 out-of-scope — alternative path만.

Tidal 사용자, Spotify 사용자 둘 다 동등한 추천 + 재생 경험.

## 2. Success Criteria

- [ ] /login에 "Tidal로 시작하기" + "Spotify로 시작하기" 두 버튼
- [ ] Spotify 버튼 클릭 → Spotify authorize → 콜백 → /onboarding → /mrt
- [ ] Spotify 사용자도 favorites + playlists 기반 첫 MRT 생성
- [ ] /mrt에서 Spotify Web Playback SDK로 풀 곡 재생 (Premium 필요)
- [ ] Premium 아닌 Spotify 사용자: 명확한 에러 메시지
- [ ] 기존 Tidal 사용자/세션 무영향 (회귀 없음)

## 3. Architecture

```
[1. /login]
   "Tidal로 시작하기" + "Spotify로 시작하기" 두 버튼
   ↓ Spotify 클릭
[2. Spotify OAuth Redirect]
   window.location → GET /api/auth/spotify/authorize
   → 백엔드: state 생성 (UUID), mrms_oauth_state cookie set (10분)
   → Spotify authorize URL로 302 redirect
[3. Spotify에서 동의]
   사용자가 Spotify 페이지에서 scope 동의
   → Spotify가 /api/auth/spotify/callback?code=...&state=... 으로 redirect
[4. Backend Callback Handler]
   GET /api/auth/spotify/callback
   → state cookie 검증
   → POST Spotify /api/token으로 code → access_token 교환
   → GET Spotify /me로 email 받음 (user-read-email scope 활용)
   → User upsert (email, primaryPlatform='spotify')
   → UserOAuth upsert (spotify)
   → AuthSession 생성 + mrms_session cookie set
   → has_mrt 체크 → 302 to /onboarding (no MRT) or /mrt (has MRT)
[5. /onboarding]
   백그라운드 pipeline: Spotify favorites + playlists → 임베딩 → MRT
   (run_onboarding에 platform 분기 추가)
[6. /mrt]
   user.primaryPlatform === 'spotify' → Spotify Web Playback SDK 사용
   (기존 Tidal proxy <audio>와 분기 — player facade)
   ▶ 클릭 → Spotify SDK가 풀 곡 재생
```

## 4. Data Model + API

### 4.1 User.primaryPlatform 컬럼 추가

raw SQL 마이그레이션 (`prisma/migrations/<timestamp>_add_primary_platform/migration.sql`):

```sql
ALTER TABLE "User" ADD COLUMN "primaryPlatform" text NOT NULL DEFAULT 'tidal';
```

기존 8명 사용자 + jacinto68 → 'tidal' default 적용. 무영향.

`prisma/schema.prisma`의 User 모델에도 documentation 차원에서 동일 필드 추가:

```prisma
model User {
  // 기존 필드 유지
  primaryPlatform String @default("tidal")
}
```

### 4.2 신규 endpoints (3개)

| Endpoint | 역할 |
|---|---|
| `GET /api/auth/spotify/authorize` | state UUID 생성 + `mrms_oauth_state` cookie set (HttpOnly, SameSite=Lax, Max-Age=600) + Spotify authorize URL 생성 후 302 redirect. URL params: `client_id`, `response_type=code`, `redirect_uri`, `state`, `scope`(공백 구분). |
| `GET /api/auth/spotify/callback?code=...&state=...` | state cookie와 query param 비교 (mismatch면 400). Spotify /api/token으로 grant_type=authorization_code 교환. Spotify /me로 email 받음. User upsert (email, primaryPlatform='spotify'). UserOAuth upsert (spotify). AuthSession 생성 + mrms_session cookie set. has_mrt 체크 → 302 to `/onboarding` or `/mrt`. error=access_denied → 302 to `/login?error=spotify_denied`. |
| `GET /api/auth/spotify/token` | get_current_user_id 의존성. UserOAuth(spotify) 조회 → 만료 임박 시 refresh → access_token 반환. Tidal /api/auth/tidal/token과 1:1 대응. |

### 4.3 기존 endpoints 영향

- `GET /api/auth/me`: response에 `primary_platform: str` 필드 추가 (프론트 SDK 선택)
- `GET /api/user`: response에 `primary_platform: str` 필드 추가
- `GET /api/mrt/latest`: `_fetch_track_metadata`에 LEFT JOIN TrackPlatform spotify 추가, 응답 트랙에 `spotify_track_id: str | None` 필드 추가
- Tidal 관련 endpoints(/api/auth/tidal/*, /api/playback/tidal/stream)는 그대로

### 4.4 Spotify OAuth scopes

요청 scope:
- `user-read-email` — email 받기 (식별용)
- `user-read-private` — Premium 여부 확인용
- `user-library-read` — favorites fetch
- `playlist-read-private` — user playlists fetch
- `streaming` — Web Playback SDK (Premium 필요)
- `user-read-playback-state` + `user-modify-playback-state` — 플레이어 컨트롤

### 4.5 Onboarding pipeline 확장

`src/mrms/onboarding/pipeline.py`의 `run_onboarding`에 platform 분기:

```python
async def run_onboarding(user_id, status, conn):
    oauth_tidal = get_oauth(conn, user_id, "tidal")
    oauth_spotify = get_oauth(conn, user_id, "spotify")
    
    if oauth_spotify and not oauth_tidal:
        platform_track_ids = await _fetch_spotify_all(oauth_spotify)
        internal_ids = _match_spotify_to_internal(conn, platform_track_ids)
        source_platform = "spotify"
    elif oauth_tidal:
        # 기존 로직
        ...
        source_platform = "tidal"
    else:
        status.fail("연동된 플랫폼이 없습니다")
        return
    
    # 이후 embedding + cluster + MRT는 platform 무관 (Track embedding만 쓰니까)
    # UserTrack 저장 시 platform=source_platform 사용
```

### 4.6 신규 모듈

- `src/mrms/onboarding/spotify_collection.py`: `fetch_spotify_favorite_tracks`, `fetch_spotify_user_playlists`, `fetch_spotify_playlist_tracks` (F의 tidal_favorites.py와 동일 패턴, 다른 API)
  - Spotify API:
    - `GET /v1/me/tracks?limit=50&offset=0` — saved (liked) tracks
    - `GET /v1/me/playlists?limit=50&offset=0` — user playlists
    - `GET /v1/playlists/{id}/tracks?limit=100&offset=0` — playlist tracks
- `src/mrms/auth/spotify.py`: SpotifyOAuthClient (token exchange + refresh, similar to auth/tidal.py)
- `src/mrms/api/auth_spotify.py`: 3 endpoints

## 5. Frontend

### 5.1 /login 페이지 — 버튼 2개

```tsx
"use client";

import { useState } from "react";
import { TidalConnectModal } from "@/components/auth/TidalConnectModal";
import { AuthCard } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const [tidalOpen, setTidalOpen] = useState(false);
  const params = useSearchParams();
  const error = params.get("error");

  return (
    <AuthCard title="MRMS — 개인 맞춤 추천" description="Tidal 또는 Spotify로 시작하세요">
      {error === "spotify_denied" && <Alert>Spotify 동의를 거부했습니다.</Alert>}
      <Button onClick={() => setTidalOpen(true)} className="w-full" size="lg">
        Tidal로 시작하기
      </Button>
      <Button
        onClick={() => (window.location.href = "/api/auth/spotify/authorize")}
        variant="outline"
        className="w-full"
        size="lg"
      >
        Spotify로 시작하기
      </Button>
      <TidalConnectModal open={tidalOpen} onOpenChange={setTidalOpen} />
    </AuthCard>
  );
}
```

### 5.2 Spotify 콜백 처리 — 별도 페이지 불필요

`GET /api/auth/spotify/callback`이 직접 cookie set + 302 redirect. 프론트엔드 콜백 페이지 작성 X.

### 5.3 Player facade

신규 `web/src/lib/player.ts`:

```typescript
import * as tidalPlayer from "./tidal-player";
import * as spotifyPlayer from "./spotify-player";

let primary: "tidal" | "spotify" | null = null;

export async function initPlayer(primaryPlatform: "tidal" | "spotify") {
  primary = primaryPlatform;
  if (primary === "tidal") await tidalPlayer.initTidalSdk();
  else await spotifyPlayer.initSpotifySdk();
}

export async function loadAndPlay(track: QueueTrack) {
  if (primary === "tidal") {
    if (!track.tidal_track_id) throw new Error("Tidal ID 없음");
    return tidalPlayer.loadAndPlay(track.tidal_track_id);
  }
  if (!track.spotify_track_id) throw new Error("Spotify ID 없음");
  return spotifyPlayer.loadAndPlay(track.spotify_track_id);
}

export async function pausePlayback() { ... }
export async function resumePlayback() { ... }
export async function seekTo(ratio: number) { ... }
export async function setSdkVolume(v: number) { ... }
```

PlayerBar, PlayButton, QueueDrawer 등 컴포넌트는 facade만 import. Tidal/Spotify 신경 X.

### 5.4 Spotify SDK wrapper

신규 `web/src/lib/spotify-player.ts`:

```typescript
"use client";

import { usePlayerStore } from "@/store/player";

let player: any = null;  // Spotify.Player
let deviceId: string | null = null;
let cachedToken: { value: string; expiresAt: number } | null = null;


async function getToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.value;
  }
  const r = await fetch("/api/auth/spotify/token", { credentials: "include" });
  if (!r.ok) throw new Error("Spotify token fetch failed");
  const data = await r.json();
  const expMs = data.expires_at ? new Date(data.expires_at).getTime() : Date.now() + 3600_000;
  cachedToken = { value: data.access_token, expiresAt: expMs };
  return data.access_token;
}


export async function initSpotifySdk(): Promise<void> {
  // SDK script 동적 로드
  if (!document.querySelector("script[src*='spotify-player.js']")) {
    const s = document.createElement("script");
    s.src = "https://sdk.scdn.co/spotify-player.js";
    document.body.appendChild(s);
  }
  await new Promise<void>((resolve) => {
    if ((window as any).Spotify) return resolve();
    (window as any).onSpotifyWebPlaybackSDKReady = () => resolve();
  });
  
  const Spotify = (window as any).Spotify;
  player = new Spotify.Player({
    name: "MRMS",
    getOAuthToken: (cb: (t: string) => void) => { void getToken().then(cb); },
    volume: 0.8,
  });
  
  player.addListener("ready", ({ device_id }: any) => {
    deviceId = device_id;
    usePlayerStore.setState({ sdkReady: true });
  });
  player.addListener("not_ready", () => {
    usePlayerStore.setState({ sdkReady: false });
  });
  player.addListener("player_state_changed", (state: any) => {
    if (!state) return;
    usePlayerStore.setState({
      isPlaying: !state.paused,
      position: state.duration > 0 ? state.position / state.duration : 0,
      durationSec: state.duration / 1000,
    });
  });
  player.addListener("initialization_error", ({ message }: any) => {
    usePlayerStore.setState({ errorMsg: `SDK init 실패: ${message}` });
  });
  player.addListener("account_error", () => {
    usePlayerStore.setState({ errorMsg: "Spotify Premium 구독이 필요합니다" });
  });
  
  await player.connect();
}


export async function loadAndPlay(spotifyTrackId: string): Promise<void> {
  if (!deviceId) throw new Error("Spotify device 미준비");
  const token = await getToken();
  const r = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ uris: [`spotify:track:${spotifyTrackId}`] }),
  });
  if (!r.ok) throw new Error(`Spotify play failed: ${r.status}`);
}


export async function pausePlayback() { if (player) await player.pause(); }
export async function resumePlayback() { if (player) await player.resume(); }
export async function seekTo(ratio: number) {
  const s = usePlayerStore.getState();
  if (player && s.durationSec > 0) await player.seek(ratio * s.durationSec * 1000);
}
export async function setSdkVolume(v: number) {
  if (player) await player.setVolume(Math.max(0, Math.min(1, v)));
}
```

### 5.5 QueueTrack 타입 확장

`web/src/store/player.ts`:

```typescript
export type QueueTrack = {
  track_id: string;
  tidal_track_id: string | null;
  spotify_track_id: string | null;
  title: string;
  artist: string;
  album_title: string | null;
};
```

### 5.6 PlayerBar 변경

```typescript
import { useUser } from "@/lib/hooks/use-user";
import { initPlayer } from "@/lib/player";

export function PlayerBar() {
  const { user } = useUser();
  useEffect(() => {
    if (!user) return;
    void initPlayer(user.primary_platform);
  }, [user]);
  ...
}
```

### 5.7 PlayButton 변경

이전: `tracks[trackIdx].tidal_track_id`로 disabled 판단.
변경: facade 사용 + 두 platform 모두 지원하도록 큐 구성:

```typescript
const queueable = tracks.filter((t) => t.tidal_track_id || t.spotify_track_id);
```

## 6. Error handling

| 상황 | 처리 |
|---|---|
| Spotify 동의 거부 | callback → 302 to /login?error=spotify_denied → toast |
| state mismatch (CSRF) | 400 + 에러 페이지 |
| code 교환 실패 | callback 500 → /login?error=spotify_failed |
| /me 실패 | "Spotify 계정 정보 가져오기 실패" + 재시도 |
| **Premium 아님** | onboarding은 정상. SDK init 시 account_error → "Spotify Premium 필요" 메시지 + 업그레이드 링크 |
| favorites + playlists 0개 | F와 동일 |
| 매칭 트랙 부족 (<10) | F와 동일 |
| email 충돌 (같은 email로 Tidal 가입) | User upsert로 자연 병합 — UserOAuth만 spotify 추가. primaryPlatform 그대로 유지 |

## 7. Testing

### 7.1 백엔드 (pytest)

- `test_auth_spotify.py`:
  - `test_authorize_redirects_to_spotify_with_state`: GET /authorize → 302 + state cookie + URL params 검증
  - `test_callback_success_creates_session`: state 일치 + Spotify mock 응답 → User+UserOAuth+AuthSession 생성 + 302
  - `test_callback_state_mismatch_returns_400`
  - `test_callback_denied_redirects_to_login_with_error`: error=access_denied
  - `test_token_endpoint_returns_access_token`: valid session → token 반환
- `tests/onboarding/test_spotify_collection.py`:
  - `test_fetch_favorites_returns_track_ids`
  - `test_fetch_user_playlists_returns_uuids`
  - `test_fetch_playlist_tracks_skips_non_tracks`
- `tests/onboarding/test_pipeline.py`:
  - 기존 + `test_pipeline_dispatches_by_platform`: Spotify oauth만 있으면 Spotify fetcher 호출, Tidal oauth만 있으면 Tidal fetcher 호출

### 7.2 프론트엔드 (수동 검증)

- /login에 두 버튼 보임
- Spotify 클릭 → spotify.com 리다이렉트 → 동의 → /onboarding 자동 이동
- /mrt에서 SDK init + 풀 곡 재생 (Premium 시)
- Premium 아니면 명확한 메시지

## 8. Out of Scope

- 추가 연결 (Tidal 사용자가 Spotify도 연결, 또는 반대)
- 자동 계정 병합 시나리오 외 — UI에서 수동 병합
- Spotify free 사용자용 30s preview fallback (track.preview_url) — 추후
- Spotify SDK transferPlayback (다른 디바이스)
- Spotify Playlist 생성/수정
- 본인 라이브러리 다운로드 (F에서도 OOS)

## 9. Migration 경로

- 기존 8명 + jacinto68 사용자: primaryPlatform='tidal' default → 무영향
- Tidal 세션 그대로 — cookie 유효
- 신규 Spotify 사용자: real email로 User 생성, primaryPlatform='spotify'
- email 충돌: User upsert 시 기존 row 사용 — UserOAuth만 추가 (Tidal 사용자가 Spotify로도 로그인 가능해짐, 단 primaryPlatform 변경 안 함). **이건 alternative 원칙에 약간 위배되지만 데이터 일관성 우선** — 명시적 추가 연결은 OOS, 사용자가 우연히 같은 email을 쓰면 그 결과를 받아들임.

## 10. File Changes

| File | 변경 |
|---|---|
| `prisma/schema.prisma` | User에 primaryPlatform 필드 (documentation) |
| `prisma/migrations/<ts>_add_primary_platform/migration.sql` | raw SQL ALTER TABLE |
| `src/mrms/auth/spotify.py` (신규) | SpotifyOAuthClient |
| `src/mrms/api/auth_spotify.py` (신규) | 3 endpoints |
| `src/mrms/api/main.py` | router include, /api/user 응답에 primary_platform |
| `src/mrms/api/auth_session.py` | /me 응답에 primary_platform |
| `src/mrms/api/schemas.py` | UserInfo에 primary_platform |
| `src/mrms/onboarding/spotify_collection.py` (신규) | 3 fetcher |
| `src/mrms/onboarding/pipeline.py` | platform 분기 |
| `src/mrms/db/user_track.py` | Track 메타 SQL에 spotify JOIN 추가 (또는 main.py에서) |
| tests/api/test_auth_spotify.py (신규) | 5 tests |
| tests/onboarding/test_spotify_collection.py (신규) | 3 tests |
| tests/onboarding/test_pipeline.py | platform 분기 test 추가 |
| web/src/lib/spotify-player.ts (신규) | SDK wrapper |
| web/src/lib/player.ts (신규) | facade |
| web/src/lib/types.ts | UserInfo.primary_platform, QueueTrack.spotify_track_id |
| web/src/store/player.ts | QueueTrack 타입 확장 |
| web/src/components/player/PlayerBar.tsx | facade 사용 |
| web/src/components/player/PlayButton.tsx | QueueTrack 변경에 맞춤 |
| web/src/app/(auth)/login/page.tsx | Spotify 버튼 + error toast |

## 11. Follow-up

- 추가 연결 (정식 — Tidal 사용자가 Spotify도, 그 반대도)
- 통합 추천 (두 카탈로그 모두 활용)
- Track preview fallback (Premium 아닌 사용자용 30s)
- Cross-platform queue (Tidal 트랙과 Spotify 트랙 섞인 큐)
