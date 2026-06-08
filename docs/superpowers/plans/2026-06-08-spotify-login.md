# Sub-project G: Spotify Alternative Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Spotify Authorization Code OAuth로 가입/로그인 alternative path 추가. 기존 F (Tidal) 패턴 미러링하되 Spotify 특성 (real email, redirect callback, Web Playback SDK) 반영.

**Architecture:** 백엔드는 SpotifyOAuthClient + 3개 endpoint (authorize/callback/token) 추가. User에 primaryPlatform 컬럼 추가. Onboarding pipeline은 UserOAuth 존재 여부로 platform 분기. 프론트는 player.ts facade로 Tidal/Spotify 통합 — PlayerBar는 user.primary_platform에 따라 SDK 선택.

**Tech Stack:** Python 3.10+, FastAPI, psycopg, httpx, Next.js 16, React 19, Spotify Web Playback SDK (browser), SWR.

**Spec:** [docs/superpowers/specs/2026-06-08-spotify-login-design.md](../specs/2026-06-08-spotify-login-design.md)

---

## 파일 구조

```
prisma/
├── schema.prisma                                    # User.primaryPlatform 문서 추가
└── migrations/<ts>_add_primary_platform/
    └── migration.sql                                # ALTER TABLE raw SQL

src/mrms/
├── auth/
│   └── spotify.py                                   # NEW — SpotifyOAuthClient
├── api/
│   ├── auth_spotify.py                              # NEW — 3 endpoints
│   ├── main.py                                      # router include + /api/user에 primary_platform
│   ├── auth_session.py                              # /me에 primary_platform
│   ├── schemas.py                                   # UserInfo.primary_platform
│   └── auth_tidal.py                                # spotify_track_id 추가 (_fetch_track_metadata)
└── onboarding/
    ├── spotify_collection.py                        # NEW — 3 fetchers
    └── pipeline.py                                  # platform 분기

tests/
├── api/test_auth_spotify.py                         # NEW
├── onboarding/test_spotify_collection.py            # NEW
└── onboarding/test_pipeline.py                      # platform 분기 테스트 추가

web/src/
├── lib/
│   ├── spotify-player.ts                            # NEW — Spotify SDK wrapper
│   ├── player.ts                                    # NEW — Tidal/Spotify facade
│   ├── types.ts                                     # UserInfo.primary_platform, QueueTrack.spotify_track_id
│   └── server/auth.ts                               # getServerSideUser 응답 타입
├── store/
│   └── player.ts                                    # QueueTrack 확장
├── app/(auth)/login/page.tsx                        # Spotify 버튼 + error toast
└── components/
    └── player/
        ├── PlayerBar.tsx                            # facade init + primary_platform 기반
        └── PlayButton.tsx                           # extended QueueTrack 처리
```

의존성 순서:
```
Task 1 (DB migration) → Task 2 (SpotifyOAuthClient) → Task 3 (auth_spotify endpoints)
  → Task 4 (existing endpoints: /me, /user 응답에 primary_platform)
  → Task 5 (/mrt/latest 응답에 spotify_track_id)
  → Task 6 (spotify_collection fetchers) → Task 7 (pipeline platform 분기)
  → Task 8 (Frontend types) → Task 9 (/login 페이지) → Task 10 (spotify-player SDK wrapper)
  → Task 11 (player facade) → Task 12 (PlayerBar + PlayButton 확장)
  → Task 13 (manual e2e + cleanup)
```

---

## Task 1: User.primaryPlatform 컬럼 추가

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_primary_platform/migration.sql`

- [ ] **Step 1: schema.prisma의 User 모델에 필드 추가 (documentation)**

`prisma/schema.prisma`의 User 모델 안에 다른 string 필드 옆에 추가:

```prisma
  primaryPlatform String   @default("tidal")  // 'tidal' | 'spotify'
```

- [ ] **Step 2: raw SQL 마이그레이션 작성**

```bash
cd "/Volumes/MacExtend 1/MRMS_FN"
TIMESTAMP=$(date -u +%Y%m%d%H%M%S)
mkdir -p "prisma/migrations/${TIMESTAMP}_add_primary_platform"
cat > "prisma/migrations/${TIMESTAMP}_add_primary_platform/migration.sql" <<'EOF'
ALTER TABLE "User" ADD COLUMN "primaryPlatform" TEXT NOT NULL DEFAULT 'tidal';
EOF
```

- [ ] **Step 3: DB에 직접 적용**

```bash
docker compose exec -T pg psql -U mrms -d mrms <<'EOF'
ALTER TABLE "User" ADD COLUMN "primaryPlatform" TEXT NOT NULL DEFAULT 'tidal';
EOF
```

검증:

```bash
docker compose exec pg psql -U mrms -d mrms -c "\d \"User\"" | grep primaryPlatform
```

Expected: `primaryPlatform | text | not null | 'tidal'::text`

- [ ] **Step 4: 회귀 확인**

```bash
source .venv/bin/activate
pytest tests/ 2>&1 | tail -3
```

Expected: 모든 기존 테스트 통과 (74 passing)

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(db): User.primaryPlatform column (default 'tidal')"
```

---

## Task 2: SpotifyOAuthClient

**Files:**
- Create: `src/mrms/auth/spotify.py`
- Create: `tests/auth/test_spotify_oauth.py`

- [ ] **Step 1: 디렉토리 + __init__.py 확인/생성**

```bash
cd "/Volumes/MacExtend 1/MRMS_FN"
ls src/mrms/auth/__init__.py
mkdir -p tests/auth
touch tests/auth/__init__.py
```

- [ ] **Step 2: 실패 테스트 작성**

Create `tests/auth/test_spotify_oauth.py`:

```python
"""SpotifyOAuthClient 테스트."""
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from mrms.auth.spotify import SpotifyOAuthClient, SpotifyOAuthError


def _client() -> SpotifyOAuthClient:
    return SpotifyOAuthClient(
        client_id="cid",
        client_secret="csecret",
        redirect_uri="http://localhost:8000/callback",
        scopes=["user-read-email", "user-library-read"],
    )


def test_build_authorize_url_contains_required_params():
    c = _client()
    url = c.build_authorize_url(state="STATE_XYZ")
    assert url.startswith("https://accounts.spotify.com/authorize")
    assert "client_id=cid" in url
    assert "response_type=code" in url
    assert "state=STATE_XYZ" in url
    assert "redirect_uri=http%3A%2F%2Flocalhost%3A8000%2Fcallback" in url
    assert "scope=user-read-email+user-library-read" in url or \
           "scope=user-read-email%20user-library-read" in url


@pytest.mark.asyncio
async def test_exchange_code_returns_tokens():
    fake = MagicMock()
    fake.status_code = 200
    fake.json = MagicMock(return_value={
        "access_token": "AT_xyz",
        "refresh_token": "RT_xyz",
        "expires_in": 3600,
        "scope": "user-read-email user-library-read",
        "token_type": "Bearer",
    })
    fake_client = MagicMock()
    fake_client.__aenter__ = AsyncMock(return_value=fake_client)
    fake_client.__aexit__ = AsyncMock(return_value=None)
    fake_client.post = AsyncMock(return_value=fake)

    with patch("httpx.AsyncClient", return_value=fake_client):
        tokens = await _client().exchange_code("CODE_xyz")
    assert tokens["access_token"] == "AT_xyz"
    assert tokens["refresh_token"] == "RT_xyz"
    assert tokens["expires_in"] == 3600


@pytest.mark.asyncio
async def test_exchange_code_raises_on_4xx():
    fake = MagicMock()
    fake.status_code = 400
    fake.text = '{"error":"invalid_grant"}'
    fake.json = MagicMock(return_value={"error": "invalid_grant"})
    fake_client = MagicMock()
    fake_client.__aenter__ = AsyncMock(return_value=fake_client)
    fake_client.__aexit__ = AsyncMock(return_value=None)
    fake_client.post = AsyncMock(return_value=fake)

    with patch("httpx.AsyncClient", return_value=fake_client):
        with pytest.raises(SpotifyOAuthError):
            await _client().exchange_code("BAD_CODE")


@pytest.mark.asyncio
async def test_refresh_returns_new_access_token():
    fake = MagicMock()
    fake.status_code = 200
    fake.json = MagicMock(return_value={
        "access_token": "NEW_AT",
        "expires_in": 3600,
        "scope": "user-read-email",
        "token_type": "Bearer",
    })
    fake_client = MagicMock()
    fake_client.__aenter__ = AsyncMock(return_value=fake_client)
    fake_client.__aexit__ = AsyncMock(return_value=None)
    fake_client.post = AsyncMock(return_value=fake)

    with patch("httpx.AsyncClient", return_value=fake_client):
        tokens = await _client().refresh_access_token("OLD_RT")
    assert tokens["access_token"] == "NEW_AT"
```

- [ ] **Step 3: 실패 확인**

```bash
source .venv/bin/activate
pytest tests/auth/test_spotify_oauth.py -v
```

Expected: ImportError

- [ ] **Step 4: src/mrms/auth/spotify.py 작성**

Create `src/mrms/auth/spotify.py`:

```python
"""Spotify OAuth Authorization Code client."""
from __future__ import annotations

import base64
from urllib.parse import urlencode

import httpx


SPOTIFY_AUTHORIZE_URL = "https://accounts.spotify.com/authorize"
SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token"


class SpotifyOAuthError(Exception):
    pass


class SpotifyOAuthClient:
    def __init__(
        self,
        client_id: str,
        client_secret: str,
        redirect_uri: str,
        scopes: list[str],
    ) -> None:
        self.client_id = client_id
        self.client_secret = client_secret
        self.redirect_uri = redirect_uri
        self.scopes = scopes

    def build_authorize_url(self, state: str) -> str:
        params = {
            "client_id": self.client_id,
            "response_type": "code",
            "redirect_uri": self.redirect_uri,
            "state": state,
            "scope": " ".join(self.scopes),
            "show_dialog": "false",
        }
        return f"{SPOTIFY_AUTHORIZE_URL}?{urlencode(params)}"

    def _basic_auth_header(self) -> str:
        creds = f"{self.client_id}:{self.client_secret}".encode()
        return f"Basic {base64.b64encode(creds).decode()}"

    async def exchange_code(self, code: str) -> dict:
        async with httpx.AsyncClient(timeout=10.0) as http:
            r = await http.post(
                SPOTIFY_TOKEN_URL,
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.redirect_uri,
                },
                headers={
                    "Authorization": self._basic_auth_header(),
                    "Content-Type": "application/x-www-form-urlencoded",
                },
            )
        if r.status_code != 200:
            raise SpotifyOAuthError(f"token exchange failed {r.status_code}: {r.text[:200]}")
        return r.json()

    async def refresh_access_token(self, refresh_token: str) -> dict:
        async with httpx.AsyncClient(timeout=10.0) as http:
            r = await http.post(
                SPOTIFY_TOKEN_URL,
                data={
                    "grant_type": "refresh_token",
                    "refresh_token": refresh_token,
                },
                headers={
                    "Authorization": self._basic_auth_header(),
                    "Content-Type": "application/x-www-form-urlencoded",
                },
            )
        if r.status_code != 200:
            raise SpotifyOAuthError(f"token refresh failed {r.status_code}: {r.text[:200]}")
        return r.json()
```

- [ ] **Step 5: 테스트 통과 확인**

```bash
pytest tests/auth/test_spotify_oauth.py -v
```

Expected: 4 passed

- [ ] **Step 6: Commit**

```bash
git add src/mrms/auth/spotify.py tests/auth/test_spotify_oauth.py tests/auth/__init__.py
git commit -m "feat(auth): SpotifyOAuthClient (authorize URL + code exchange + refresh)"
```

---

## Task 3: Spotify auth endpoints (authorize + callback + token)

**Files:**
- Create: `src/mrms/api/auth_spotify.py`
- Modify: `src/mrms/api/main.py` (router include)
- Create: `tests/api/test_auth_spotify.py`

- [ ] **Step 1: 실패 테스트 작성**

Create `tests/api/test_auth_spotify.py`:

```python
"""Spotify auth endpoints 테스트."""
import json
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi.testclient import TestClient

from mrms.api.main import app


client = TestClient(app)


def test_authorize_returns_302_with_state_cookie(db_conn):
    """GET /authorize → 302 to spotify + state cookie set."""
    r = client.get("/api/auth/spotify/authorize", follow_redirects=False)
    assert r.status_code == 307 or r.status_code == 302
    location = r.headers.get("location", "")
    assert "accounts.spotify.com/authorize" in location
    assert "state=" in location
    assert "client_id=" in location
    # state cookie 설정됨
    assert "mrms_oauth_state" in r.cookies


def test_callback_state_mismatch_returns_400(db_conn):
    """state cookie와 query param 불일치 → 400."""
    client.cookies.set("mrms_oauth_state", "EXPECTED_STATE")
    r = client.get(
        "/api/auth/spotify/callback?code=CODE_XYZ&state=DIFFERENT_STATE",
        follow_redirects=False,
    )
    client.cookies.clear()
    assert r.status_code == 400


def test_callback_denied_redirects_to_login_with_error(db_conn):
    """error=access_denied → 302 to /login?error=spotify_denied."""
    client.cookies.set("mrms_oauth_state", "S1")
    r = client.get(
        "/api/auth/spotify/callback?error=access_denied&state=S1",
        follow_redirects=False,
    )
    client.cookies.clear()
    assert r.status_code in (302, 307)
    assert "/login" in r.headers.get("location", "")
    assert "spotify_denied" in r.headers.get("location", "")


def test_callback_success_creates_session_and_redirects(db_conn):
    """code 교환 + /me → User+UserOAuth+AuthSession + 302 to /onboarding."""
    token_response = MagicMock()
    token_response.status_code = 200
    token_response.json = MagicMock(return_value={
        "access_token": "AT_xyz",
        "refresh_token": "RT_xyz",
        "expires_in": 3600,
        "scope": "user-read-email user-library-read",
        "token_type": "Bearer",
    })
    me_response = MagicMock()
    me_response.status_code = 200
    me_response.json = MagicMock(return_value={
        "id": "sp_user_12345",
        "email": "alice@example.com",
        "display_name": "Alice",
        "country": "KR",
        "product": "premium",
    })

    fake_client = MagicMock()
    fake_client.__aenter__ = AsyncMock(return_value=fake_client)
    fake_client.__aexit__ = AsyncMock(return_value=None)
    fake_client.post = AsyncMock(return_value=token_response)
    fake_client.get = AsyncMock(return_value=me_response)

    client.cookies.set("mrms_oauth_state", "S2")
    with patch("httpx.AsyncClient", return_value=fake_client):
        r = client.get(
            "/api/auth/spotify/callback?code=CODE_XYZ&state=S2",
            follow_redirects=False,
        )
    client.cookies.clear()
    assert r.status_code in (302, 307)
    assert r.headers["location"] in ("/onboarding", "/mrt")
    assert "mrms_session" in r.cookies

    # DB 검증
    with db_conn.cursor() as cur:
        cur.execute('SELECT id, "primaryPlatform" FROM "User" WHERE email = %s', ("alice@example.com",))
        user_row = cur.fetchone()
        assert user_row is not None
        user_id, primary = user_row
        assert primary == "spotify"
        cur.execute('SELECT COUNT(*) FROM "UserOAuth" WHERE "userId" = %s AND platform = %s', (user_id, "spotify"))
        assert cur.fetchone()[0] == 1
        cur.execute('SELECT COUNT(*) FROM "AuthSession" WHERE "userId" = %s', (user_id,))
        assert cur.fetchone()[0] >= 1


def test_spotify_token_returns_access_token_with_valid_session(db_conn):
    """/token → 유효 cookie + spotify UserOAuth → access_token 반환."""
    from mrms.db.user_track import get_or_create_user, upsert_oauth
    import uuid as _u

    user_id = get_or_create_user(db_conn, "alice_token@example.com")
    expires = datetime.now(timezone.utc) + timedelta(hours=1)
    upsert_oauth(
        db_conn, user_id=user_id, platform="spotify",
        access_token="VALID_SPOTIFY_AT",
        refresh_token="VALID_SPOTIFY_RT",
        expires_at=expires,
        scopes=["user-read-email"],
    )
    session_id = _u.uuid4().hex
    session_expires = datetime.now(timezone.utc) + timedelta(days=30)
    with db_conn.cursor() as cur:
        cur.execute(
            'INSERT INTO "AuthSession" (id, "userId", "expiresAt") VALUES (%s, %s, %s)',
            (session_id, user_id, session_expires),
        )
    db_conn.commit()

    client.cookies.set("mrms_session", session_id)
    r = client.get("/api/auth/spotify/token")
    client.cookies.clear()
    assert r.status_code == 200
    body = r.json()
    assert body["access_token"] == "VALID_SPOTIFY_AT"
    assert "expires_at" in body
```

- [ ] **Step 2: 실패 확인**

```bash
pytest tests/api/test_auth_spotify.py -v
```

Expected: 404 (endpoints 없음)

- [ ] **Step 3: auth_spotify.py 작성**

Create `src/mrms/api/auth_spotify.py`:

```python
"""Spotify Authorization Code OAuth endpoints."""
from __future__ import annotations

import os
import uuid
from datetime import datetime, timedelta, timezone

import httpx
import psycopg
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import RedirectResponse

from mrms.api.deps import db_conn, get_current_user_id
from mrms.auth.spotify import SpotifyOAuthClient, SpotifyOAuthError
from mrms.db.user_track import get_oauth, get_or_create_user, upsert_oauth


router = APIRouter(prefix="/api/auth/spotify", tags=["auth"])


SPOTIFY_SCOPES = [
    "user-read-email",
    "user-read-private",
    "user-library-read",
    "playlist-read-private",
    "streaming",
    "user-read-playback-state",
    "user-modify-playback-state",
]

SESSION_COOKIE_NAME = "mrms_session"
SESSION_MAX_AGE = 30 * 24 * 60 * 60  # 30 days
OAUTH_STATE_COOKIE = "mrms_oauth_state"
OAUTH_STATE_MAX_AGE = 600  # 10 min

SPOTIFY_API_BASE = "https://api.spotify.com/v1"


def _client() -> SpotifyOAuthClient:
    return SpotifyOAuthClient(
        client_id=os.environ["SPOTIFY_CLIENT_ID"],
        client_secret=os.environ["SPOTIFY_CLIENT_SECRET"],
        redirect_uri=os.environ.get(
            "SPOTIFY_REDIRECT_URI",
            "http://localhost:8000/api/auth/spotify/callback",
        ),
        scopes=SPOTIFY_SCOPES,
    )


@router.get("/authorize")
def authorize(response: Response) -> RedirectResponse:
    """state 생성 + Spotify authorize URL로 302 redirect."""
    state = uuid.uuid4().hex
    url = _client().build_authorize_url(state)
    resp = RedirectResponse(url=url, status_code=307)
    resp.set_cookie(
        key=OAUTH_STATE_COOKIE,
        value=state,
        httponly=True,
        samesite="lax",
        max_age=OAUTH_STATE_MAX_AGE,
        secure=False,
    )
    return resp


@router.get("/callback")
async def callback(
    request: Request,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    conn: psycopg.Connection = Depends(db_conn),
) -> RedirectResponse:
    """Spotify가 redirect한 콜백 처리."""
    # error 분기 (사용자 거부 등)
    if error:
        resp = RedirectResponse(url=f"/login?error=spotify_{error}", status_code=307)
        resp.delete_cookie(OAUTH_STATE_COOKIE)
        return resp

    if not code or not state:
        raise HTTPException(400, "code/state required")

    expected_state = request.cookies.get(OAUTH_STATE_COOKIE)
    if not expected_state or expected_state != state:
        raise HTTPException(400, "state mismatch (CSRF protection)")

    # code → tokens
    try:
        tokens = await _client().exchange_code(code)
    except SpotifyOAuthError as e:
        resp = RedirectResponse(url="/login?error=spotify_failed", status_code=307)
        resp.delete_cookie(OAUTH_STATE_COOKIE)
        return resp

    access_token = tokens["access_token"]
    refresh_token = tokens.get("refresh_token", "")
    expires_in = tokens.get("expires_in", 3600)
    scope_str = tokens.get("scope", "")
    granted = scope_str.split() if scope_str else SPOTIFY_SCOPES

    # Spotify /me 호출 — email 받기
    async with httpx.AsyncClient(timeout=10.0) as http:
        me_r = await http.get(
            f"{SPOTIFY_API_BASE}/me",
            headers={"Authorization": f"Bearer {access_token}"},
        )
    if me_r.status_code != 200:
        resp = RedirectResponse(url="/login?error=spotify_me_failed", status_code=307)
        resp.delete_cookie(OAUTH_STATE_COOKIE)
        return resp
    me = me_r.json()
    email = me.get("email") or f"spotify-{me.get('id')}@auto.local"
    display_name = me.get("display_name")
    country = me.get("country")

    # User upsert (primaryPlatform='spotify')
    user_id = get_or_create_user(conn, email)
    with conn.cursor() as cur:
        cur.execute(
            'UPDATE "User" SET "displayName" = COALESCE("displayName", %s), country = COALESCE(country, %s), "primaryPlatform" = CASE WHEN "primaryPlatform" = \'tidal\' AND NOT EXISTS (SELECT 1 FROM "UserOAuth" WHERE "userId" = %s AND platform = \'tidal\') THEN %s ELSE "primaryPlatform" END WHERE id = %s',
            (display_name, country, user_id, "spotify", user_id),
        )
    conn.commit()

    # UserOAuth upsert
    token_expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
    upsert_oauth(
        conn, user_id=user_id, platform="spotify",
        access_token=access_token, refresh_token=refresh_token,
        expires_at=token_expires_at, scopes=granted,
    )

    # AuthSession 생성
    session_id = uuid.uuid4().hex
    session_expires = datetime.now(timezone.utc) + timedelta(seconds=SESSION_MAX_AGE)
    with conn.cursor() as cur:
        cur.execute(
            'DELETE FROM "AuthSession" WHERE "userId" = %s',
            (user_id,),
        )
        cur.execute(
            'INSERT INTO "AuthSession" (id, "userId", "expiresAt", "userAgent") VALUES (%s, %s, %s, %s)',
            (session_id, user_id, session_expires, request.headers.get("user-agent")),
        )

    # has_mrt 체크
    with conn.cursor() as cur:
        cur.execute('SELECT COUNT(*) FROM "PlaylistHistory" WHERE "userId" = %s', (user_id,))
        has_mrt = cur.fetchone()[0] > 0
    conn.commit()

    target = "/mrt" if has_mrt else "/onboarding"
    resp = RedirectResponse(url=target, status_code=307)
    resp.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=session_id,
        httponly=True,
        samesite="lax",
        max_age=SESSION_MAX_AGE,
        secure=False,
    )
    resp.delete_cookie(OAUTH_STATE_COOKIE)
    return resp


@router.get("/token")
async def get_token(
    user_id: str = Depends(get_current_user_id),
    conn: psycopg.Connection = Depends(db_conn),
) -> dict:
    """현재 user의 Spotify access_token 반환 (만료 임박 시 refresh)."""
    oauth = get_oauth(conn, user_id, "spotify")
    if not oauth:
        raise HTTPException(404, "Spotify OAuth not configured. Sign in with Spotify")

    access_token = oauth["accessToken"]
    expires_at = oauth["expiresAt"]

    if expires_at and expires_at - timedelta(seconds=60) < datetime.now(timezone.utc):
        try:
            tokens = await _client().refresh_access_token(oauth["refreshToken"])
        except SpotifyOAuthError as e:
            raise HTTPException(401, f"Spotify refresh failed: {e}")
        access_token = tokens["access_token"]
        new_refresh = tokens.get("refresh_token", oauth["refreshToken"])
        new_expires = datetime.now(timezone.utc) + timedelta(seconds=tokens["expires_in"])
        scope_str = tokens.get("scope", "")
        granted = scope_str.split() if scope_str else list(oauth.get("scope", []))
        upsert_oauth(
            conn, user_id=user_id, platform="spotify",
            access_token=access_token, refresh_token=new_refresh,
            expires_at=new_expires, scopes=granted,
        )
        conn.commit()
        expires_at = new_expires

    return {
        "access_token": access_token,
        "expires_at": expires_at.isoformat() if expires_at else None,
    }
```

- [ ] **Step 4: main.py에 router include**

`src/mrms/api/main.py`의 imports 영역에 추가:

```python
from mrms.api.auth_spotify import router as auth_spotify_router
```

`app.include_router(...)` 영역에 추가:

```python
app.include_router(auth_spotify_router)
```

- [ ] **Step 5: 테스트 통과 확인**

```bash
pytest tests/api/test_auth_spotify.py -v
```

Expected: 5 passed

회귀:
```bash
pytest tests/ 2>&1 | tail -3
```

Expected: 모두 통과

- [ ] **Step 6: Commit**

```bash
git add src/mrms/api/auth_spotify.py src/mrms/api/main.py tests/api/test_auth_spotify.py
git commit -m "feat(api): Spotify OAuth endpoints (authorize + callback + token)"
```

---

## Task 4: /api/auth/me + /api/user에 primary_platform 추가

**Files:**
- Modify: `src/mrms/api/schemas.py`
- Modify: `src/mrms/api/main.py` (/api/user)
- Modify: `src/mrms/api/auth_session.py` (/me)
- Modify: `tests/api/test_main.py`, `tests/api/test_auth_session.py`

- [ ] **Step 1: UserInfo 스키마에 primary_platform 추가**

`src/mrms/api/schemas.py`의 UserInfo 클래스:

```python
class UserInfo(BaseModel):
    user_id: str
    email: str
    displayName: str | None = None
    country: str | None = None
    personas_count: int
    user_tracks_count: int
    primary_platform: str
```

- [ ] **Step 2: 실패 테스트 추가**

`tests/api/test_auth_session.py`에 추가:

```python
def test_me_response_includes_primary_platform(db_conn):
    """/me 응답에 primary_platform 필드 포함."""
    from mrms.db.user_track import get_or_create_user
    import uuid as _u

    user_id = get_or_create_user(db_conn, "primary_test@example.com")
    # primaryPlatform를 spotify로 설정
    with db_conn.cursor() as cur:
        cur.execute(
            'UPDATE "User" SET "primaryPlatform" = %s WHERE id = %s',
            ("spotify", user_id),
        )
    session_id = _u.uuid4().hex
    expires = datetime.now(timezone.utc) + timedelta(days=30)
    with db_conn.cursor() as cur:
        cur.execute(
            'INSERT INTO "AuthSession" (id, "userId", "expiresAt") VALUES (%s, %s, %s)',
            (session_id, user_id, expires),
        )
    db_conn.commit()

    client.cookies.set("mrms_session", session_id)
    r = client.get("/api/auth/me")
    client.cookies.clear()
    assert r.status_code == 200
    body = r.json()
    assert body["primary_platform"] == "spotify"
```

`tests/api/test_main.py`에 추가:

```python
def test_user_endpoint_includes_primary_platform(db_conn):
    """/api/user 응답에 primary_platform 필드 포함."""
    user_id = _set_session_cookie(db_conn, "primary_main@example.com")
    with db_conn.cursor() as cur:
        cur.execute(
            'UPDATE "User" SET "primaryPlatform" = %s WHERE id = %s',
            ("tidal", user_id),
        )
    db_conn.commit()
    r = client.get("/api/user")
    client.cookies.clear()
    assert r.status_code == 200
    assert r.json()["primary_platform"] == "tidal"
```

- [ ] **Step 3: 실패 확인**

```bash
pytest tests/api/test_auth_session.py::test_me_response_includes_primary_platform tests/api/test_main.py::test_user_endpoint_includes_primary_platform -v
```

Expected: KeyError 또는 ValidationError (primary_platform 없음)

- [ ] **Step 4: /me + /user 응답에 primary_platform 추가**

`src/mrms/api/auth_session.py`의 `me` 함수에서 SQL 쿼리 + return dict 수정:

```python
@router.get("/me")
def me(
    user_id: str = Depends(get_current_user_id),
    conn: psycopg.Connection = Depends(db_conn),
) -> dict:
    with conn.cursor() as cur:
        cur.execute('SELECT email, "displayName", country, "primaryPlatform" FROM "User" WHERE id = %s', (user_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "User not found")
        email, display_name, country, primary_platform = row
        cur.execute('SELECT COUNT(*) FROM "UserPersona" WHERE "userId" = %s', (user_id,))
        personas_count = cur.fetchone()[0]
        cur.execute('SELECT COUNT(*) FROM "UserTrack" WHERE "userId" = %s', (user_id,))
        tracks_count = cur.fetchone()[0]
    return {
        "user_id": user_id,
        "email": email,
        "displayName": display_name,
        "country": country,
        "personas_count": personas_count,
        "user_tracks_count": tracks_count,
        "primary_platform": primary_platform,
    }
```

`src/mrms/api/main.py`의 `user` 함수에서 SQL + UserInfo 생성 수정:

```python
@app.get("/api/user", response_model=UserInfo)
def user(
    user_id: str = Depends(get_current_user_id),
    conn: psycopg.Connection = Depends(db_conn),
) -> UserInfo:
    with conn.cursor() as cur:
        cur.execute('SELECT email, "displayName", country, "primaryPlatform" FROM "User" WHERE id = %s', (user_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "User not found")
        email, display_name, country, primary_platform = row

        cur.execute('SELECT COUNT(*) FROM "UserPersona" WHERE "userId" = %s', (user_id,))
        personas_count = cur.fetchone()[0]
        cur.execute('SELECT COUNT(*) FROM "UserTrack" WHERE "userId" = %s', (user_id,))
        tracks_count = cur.fetchone()[0]

    return UserInfo(
        user_id=user_id,
        email=email,
        displayName=display_name,
        country=country,
        personas_count=personas_count,
        user_tracks_count=tracks_count,
        primary_platform=primary_platform,
    )
```

- [ ] **Step 5: 테스트 통과 확인**

```bash
pytest tests/api/ -v 2>&1 | tail -10
```

Expected: 신규 2 + 기존 모두 통과

- [ ] **Step 6: Commit**

```bash
git add src/mrms/api/schemas.py src/mrms/api/main.py src/mrms/api/auth_session.py \
        tests/api/test_main.py tests/api/test_auth_session.py
git commit -m "feat(api): /api/user + /api/auth/me에 primary_platform 추가"
```

---

## Task 5: /api/mrt/latest 응답에 spotify_track_id 추가

**Files:**
- Modify: `src/mrms/api/schemas.py` (PersonaTrack, RecommendedTrack)
- Modify: `src/mrms/api/main.py` (_fetch_track_metadata + mrt_latest)
- Modify: `tests/api/test_main.py`

- [ ] **Step 1: schemas.py에 spotify_track_id 추가**

`src/mrms/api/schemas.py`의 PersonaTrack과 RecommendedTrack에:

```python
class PersonaTrack(BaseModel):
    track_id: str
    title: str
    artist: str
    album_id: str | None = None
    album_title: str | None = None
    similarity: float
    tidal_track_id: str | None = None
    spotify_track_id: str | None = None


class RecommendedTrack(BaseModel):
    track_id: str
    title: str
    artist: str
    album_id: str | None = None
    score: float
    persona_idx: int | None = None
    tidal_track_id: str | None = None
    spotify_track_id: str | None = None
```

- [ ] **Step 2: 실패 테스트 추가**

`tests/api/test_main.py`에 추가:

```python
def test_mrt_latest_includes_spotify_track_id(db_conn):
    """/api/mrt/latest 응답 트랙들이 spotify_track_id 필드 포함."""
    import numpy as np
    from mrms.db.user_track import get_or_create_user
    from mrms.db import user_embedding as ue

    user_id = _set_session_cookie(db_conn, "spotify_track_test@example.com")

    rng = np.random.default_rng(789)
    for idx in range(3):
        v = rng.standard_normal(256).astype(np.float32)
        v /= np.linalg.norm(v)
        ue.upsert_user_persona(db_conn, user_id, idx, v, track_count=50)

    # Tidal + Spotify 둘 다 있는 트랙
    with db_conn.cursor() as cur:
        cur.execute('''
            SELECT t.id, tp_t."platformTrackId", tp_s."platformTrackId"
            FROM "Track" t
            JOIN "TrackPlatform" tp_t ON tp_t."trackId" = t.id AND tp_t.platform = 'tidal'
            JOIN "TrackPlatform" tp_s ON tp_s."trackId" = t.id AND tp_s.platform = 'spotify'
            LIMIT 5
        ''')
        rows = cur.fetchall()
    if len(rows) < 3:
        import pytest
        pytest.skip("필요한 Tidal+Spotify 동시 트랙 데이터 부족")

    track_ids = [r[0] for r in rows]
    for idx in range(3):
        ue.insert_playlist_history(
            db_conn, user_id, track_ids[:3], "our-v1.0+persona-K3",
            context={"personaIdx": idx, "kind": "persona", "scores": [0.9, 0.8, 0.7]},
        )
    db_conn.commit()

    r = client.get("/api/mrt/latest")
    client.cookies.clear()
    assert r.status_code == 200
    body = r.json()
    persona_0 = body["personas"][0]
    assert any(t.get("spotify_track_id") for t in persona_0["playlist"])
```

- [ ] **Step 3: 실패 확인**

```bash
pytest tests/api/test_main.py::test_mrt_latest_includes_spotify_track_id -v
```

Expected: KeyError 또는 ValidationError

- [ ] **Step 4: _fetch_track_metadata 수정 — spotify LEFT JOIN**

`src/mrms/api/main.py`의 `_fetch_track_metadata`:

```python
def _fetch_track_metadata(conn, track_ids: list[str]) -> dict[str, dict]:
    """Tidal 가용 트랙의 메타 + tidal/spotify ID 반환."""
    if not track_ids:
        return {}
    with conn.cursor() as cur:
        cur.execute(
            '''SELECT t.id, t.title, a.name, t."albumId", alb.title,
                      tp_t."platformTrackId", tp_s."platformTrackId"
               FROM "Track" t
               JOIN "Artist" a ON a.id = t."artistId"
               LEFT JOIN "Album" alb ON alb.id = t."albumId"
               INNER JOIN "TrackPlatform" tp_t
                  ON tp_t."trackId" = t.id AND tp_t.platform = 'tidal'
               LEFT JOIN "TrackPlatform" tp_s
                  ON tp_s."trackId" = t.id AND tp_s.platform = 'spotify'
               WHERE t.id = ANY(%s)''',
            (track_ids,),
        )
        rows = cur.fetchall()
    return {
        r[0]: {
            "title": r[1],
            "artist": r[2],
            "album_id": r[3],
            "album_title": r[4],
            "tidal_track_id": r[5],
            "spotify_track_id": r[6],
        }
        for r in rows
    }
```

`mrt_latest`의 PersonaTrack 생성 부분에 spotify_track_id 전달:

```python
            playlist.append(PersonaTrack(
                track_id=tid,
                title=m["title"],
                artist=m["artist"],
                album_id=m["album_id"],
                album_title=m["album_title"],
                similarity=float(sc),
                tidal_track_id=m["tidal_track_id"],
                spotify_track_id=m["spotify_track_id"],
            ))
```

RecommendedTrack 생성 부분:

```python
    recommended_tracks = [
        RecommendedTrack(
            track_id=r["track_id"],
            title=meta[r["track_id"]]["title"],
            artist=meta[r["track_id"]]["artist"],
            album_id=meta[r["track_id"]]["album_id"],
            score=float(r["score"]),
            persona_idx=r.get("persona_idx"),
            tidal_track_id=meta[r["track_id"]]["tidal_track_id"],
            spotify_track_id=meta[r["track_id"]]["spotify_track_id"],
        )
        for r in rec_tracks_raw
        if r["track_id"] in meta
    ]
```

- [ ] **Step 5: 테스트 통과 확인**

```bash
pytest tests/api/test_main.py -v 2>&1 | tail -10
```

Expected: 신규 1 + 기존 5 = 6 passed

- [ ] **Step 6: Commit**

```bash
git add src/mrms/api/schemas.py src/mrms/api/main.py tests/api/test_main.py
git commit -m "feat(api): /api/mrt/latest 응답에 spotify_track_id 추가"
```

---

## Task 6: Spotify favorites + playlists fetchers

**Files:**
- Create: `src/mrms/onboarding/spotify_collection.py`
- Create: `tests/onboarding/test_spotify_collection.py`

- [ ] **Step 1: 실패 테스트 작성**

Create `tests/onboarding/test_spotify_collection.py`:

```python
"""Spotify favorites + playlists fetch 테스트."""
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from mrms.onboarding.spotify_collection import (
    fetch_spotify_favorite_tracks,
    fetch_spotify_playlist_tracks,
    fetch_spotify_user_playlists,
)


@pytest.mark.asyncio
async def test_fetch_favorites_returns_track_ids():
    """GET /me/tracks 응답에서 track.id 추출."""
    fake = MagicMock()
    fake.status_code = 200
    fake.json = MagicMock(return_value={
        "items": [
            {"track": {"id": "TR_A", "name": "T1"}},
            {"track": {"id": "TR_B", "name": "T2"}},
        ],
        "total": 2,
        "next": None,
    })
    fake_client = MagicMock()
    fake_client.__aenter__ = AsyncMock(return_value=fake_client)
    fake_client.__aexit__ = AsyncMock(return_value=None)
    fake_client.get = AsyncMock(return_value=fake)

    with patch("httpx.AsyncClient", return_value=fake_client):
        ids = await fetch_spotify_favorite_tracks(access_token="fake")
    assert ids == ["TR_A", "TR_B"]


@pytest.mark.asyncio
async def test_fetch_user_playlists_returns_ids():
    """GET /me/playlists 응답에서 playlist.id 추출."""
    fake = MagicMock()
    fake.status_code = 200
    fake.json = MagicMock(return_value={
        "items": [
            {"id": "PL_A", "name": "P1"},
            {"id": "PL_B", "name": "P2"},
        ],
        "total": 2,
        "next": None,
    })
    fake_client = MagicMock()
    fake_client.__aenter__ = AsyncMock(return_value=fake_client)
    fake_client.__aexit__ = AsyncMock(return_value=None)
    fake_client.get = AsyncMock(return_value=fake)

    with patch("httpx.AsyncClient", return_value=fake_client):
        ids = await fetch_spotify_user_playlists(access_token="fake")
    assert ids == ["PL_A", "PL_B"]


@pytest.mark.asyncio
async def test_fetch_playlist_tracks_skips_local_and_episodes():
    """플레이리스트 items에서 트랙만 (local/episode 제외)."""
    fake = MagicMock()
    fake.status_code = 200
    fake.json = MagicMock(return_value={
        "items": [
            {"track": {"id": "TR_X", "type": "track", "is_local": False}},
            {"track": {"id": "EP_Y", "type": "episode", "is_local": False}},
            {"track": {"id": "LOC_Z", "type": "track", "is_local": True}},
            {"track": {"id": "TR_W", "type": "track", "is_local": False}},
            {"track": None},  # 삭제된 트랙
        ],
        "total": 5,
        "next": None,
    })
    fake_client = MagicMock()
    fake_client.__aenter__ = AsyncMock(return_value=fake_client)
    fake_client.__aexit__ = AsyncMock(return_value=None)
    fake_client.get = AsyncMock(return_value=fake)

    with patch("httpx.AsyncClient", return_value=fake_client):
        ids = await fetch_spotify_playlist_tracks(access_token="fake", playlist_id="PL_X")
    assert ids == ["TR_X", "TR_W"]
```

- [ ] **Step 2: 실패 확인**

```bash
pytest tests/onboarding/test_spotify_collection.py -v
```

Expected: ImportError

- [ ] **Step 3: spotify_collection.py 작성**

Create `src/mrms/onboarding/spotify_collection.py`:

```python
"""Spotify 사용자의 favorites + playlists fetch."""
from __future__ import annotations

import httpx


SPOTIFY_API_BASE = "https://api.spotify.com/v1"


async def fetch_spotify_favorite_tracks(
    access_token: str,
    page_size: int = 50,
) -> list[str]:
    """GET /me/tracks — 좋아요 누른 트랙 (페이지네이션)."""
    headers = {"Authorization": f"Bearer {access_token}"}
    track_ids: list[str] = []
    url = f"{SPOTIFY_API_BASE}/me/tracks?limit={page_size}&offset=0"

    async with httpx.AsyncClient(timeout=15.0) as http:
        while url:
            r = await http.get(url, headers=headers)
            if r.status_code != 200:
                raise RuntimeError(f"Spotify favorites failed: {r.status_code} {r.text[:200]}")
            data = r.json()
            for item in data.get("items", []):
                track = item.get("track") or {}
                tid = track.get("id")
                if tid:
                    track_ids.append(tid)
            url = data.get("next")  # Spotify는 next URL을 직접 줌

    return track_ids


async def fetch_spotify_user_playlists(
    access_token: str,
    page_size: int = 50,
) -> list[str]:
    """GET /me/playlists — 사용자 플레이리스트 ID 목록."""
    headers = {"Authorization": f"Bearer {access_token}"}
    playlist_ids: list[str] = []
    url = f"{SPOTIFY_API_BASE}/me/playlists?limit={page_size}&offset=0"

    async with httpx.AsyncClient(timeout=15.0) as http:
        while url:
            r = await http.get(url, headers=headers)
            if r.status_code != 200:
                raise RuntimeError(f"Spotify playlists failed: {r.status_code} {r.text[:200]}")
            data = r.json()
            for item in data.get("items", []):
                pid = item.get("id")
                if pid:
                    playlist_ids.append(pid)
            url = data.get("next")

    return playlist_ids


async def fetch_spotify_playlist_tracks(
    access_token: str,
    playlist_id: str,
    page_size: int = 100,
) -> list[str]:
    """GET /playlists/{id}/tracks — 트랙만 (local + episode 제외)."""
    headers = {"Authorization": f"Bearer {access_token}"}
    track_ids: list[str] = []
    url = f"{SPOTIFY_API_BASE}/playlists/{playlist_id}/tracks?limit={page_size}&offset=0"

    async with httpx.AsyncClient(timeout=15.0) as http:
        while url:
            r = await http.get(url, headers=headers)
            if r.status_code != 200:
                raise RuntimeError(f"Spotify playlist items failed: {r.status_code} {r.text[:200]}")
            data = r.json()
            for item in data.get("items", []):
                track = item.get("track")
                if not track:
                    continue
                if track.get("is_local"):
                    continue
                if track.get("type") and track["type"] != "track":
                    continue
                tid = track.get("id")
                if tid:
                    track_ids.append(tid)
            url = data.get("next")

    return track_ids
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
pytest tests/onboarding/test_spotify_collection.py -v
```

Expected: 3 passed

- [ ] **Step 5: Commit**

```bash
git add src/mrms/onboarding/spotify_collection.py tests/onboarding/test_spotify_collection.py
git commit -m "feat(onboarding): Spotify favorites + playlists fetchers"
```

---

## Task 7: Pipeline platform 분기

**Files:**
- Modify: `src/mrms/onboarding/pipeline.py`
- Modify: `tests/onboarding/test_pipeline.py`

- [ ] **Step 1: 실패 테스트 추가**

`tests/onboarding/test_pipeline.py`에 추가:

```python
@pytest.mark.asyncio
async def test_pipeline_dispatches_to_spotify_when_only_spotify_oauth(db_conn):
    """Spotify oauth만 있으면 Spotify fetcher 사용."""
    from mrms.db.user_track import get_or_create_user, upsert_oauth
    from datetime import datetime, timedelta, timezone

    user_id = get_or_create_user(db_conn, "spotify_pipeline@example.com")
    expires = datetime.now(timezone.utc) + timedelta(hours=1)
    upsert_oauth(
        db_conn, user_id=user_id, platform="spotify",
        access_token="fake_spotify_token", refresh_token="fake_refresh",
        expires_at=expires, scopes=["user-read-email"],
    )
    db_conn.commit()

    # Spotify-가용 트랙 sample (with embedding)
    with db_conn.cursor() as cur:
        cur.execute(
            '''SELECT tp."platformTrackId"
               FROM "TrackPlatform" tp
               JOIN "TrackEmbedding" te ON te."trackId" = tp."trackId"
               WHERE tp.platform = 'spotify' AND te."modelVersion" = 'our-v1.0'
               LIMIT 30'''
        )
        spotify_track_ids = [r[0] for r in cur.fetchall()]
    if len(spotify_track_ids) < 10:
        pytest.skip("Spotify + TrackEmbedding 데이터 부족")

    status = OnboardingStatus()
    with patch(
        "mrms.onboarding.pipeline.fetch_spotify_favorite_tracks",
        new=AsyncMock(return_value=spotify_track_ids),
    ), patch(
        "mrms.onboarding.pipeline.fetch_spotify_user_playlists",
        new=AsyncMock(return_value=[]),
    ):
        await run_onboarding(user_id=user_id, status=status, conn=db_conn)

    assert status.step == "done", f"step={status.step} error={status.error}"
    with db_conn.cursor() as cur:
        cur.execute(
            'SELECT COUNT(*) FROM "UserTrack" WHERE "userId" = %s AND platform = %s',
            (user_id, "spotify"),
        )
        assert cur.fetchone()[0] >= 10
```

- [ ] **Step 2: 실패 확인**

```bash
pytest tests/onboarding/test_pipeline.py::test_pipeline_dispatches_to_spotify_when_only_spotify_oauth -v
```

Expected: ImportError 또는 ModuleAttributeError

- [ ] **Step 3: pipeline.py에 platform 분기 추가**

`src/mrms/onboarding/pipeline.py`의 imports에 추가:

```python
from mrms.onboarding.spotify_collection import (
    fetch_spotify_favorite_tracks,
    fetch_spotify_playlist_tracks,
    fetch_spotify_user_playlists,
)
```

기존 `run_onboarding` 함수 안의 Tidal 전용 fetch 블록을 platform 분기로 wrap. 핵심 변경 (Step 1 oauth 가져오는 부분 + Step 2 fetch 부분):

```python
async def run_onboarding(
    user_id: str,
    status: OnboardingStatus,
    conn: psycopg.Connection,
    k: int = DEFAULT_K,
    persona_top_n: int = DEFAULT_TOP_N,
    candidate_pool: int = DEFAULT_CANDIDATE_POOL,
) -> None:
    try:
        # 1. UserOAuth 조회 — Tidal/Spotify 둘 중 어느 하나
        oauth_tidal = get_oauth(conn, user_id, "tidal")
        oauth_spotify = get_oauth(conn, user_id, "spotify")

        if oauth_spotify and not oauth_tidal:
            await _run_spotify_collection(user_id, status, conn, oauth_spotify)
        elif oauth_tidal:
            await _run_tidal_collection(user_id, status, conn, oauth_tidal)
        else:
            status.fail("Tidal 또는 Spotify 연결이 필요합니다")
            return

        # 4. UserTrack 데이터를 기반으로 embedding + cluster + MRT (platform 무관)
        status.set("computing_embedding", 50, "음악 취향 분석 중...")
        register_vector(conn)
        track_ids, X = _fetch_user_track_matrix(conn, user_id)
        if len(track_ids) < k:
            status.fail(f"트랙 임베딩이 부족합니다 ({len(track_ids)}곡 < K={k})")
            return

        status.set("clustering", 75, f"페르소나 {k}개 추출 중...")
        try:
            result = cluster_user_tracks(X, k=k)
        except NotEnoughTracksError as e:
            status.fail(f"클러스터링 실패: {e}")
            return

        user_vec = aggregate_user_vector(result.centroids, result.weights)
        upsert_user_embedding(conn, user_id, MODEL_VERSION, user_vec, computed_from=len(track_ids))
        for idx in range(k):
            upsert_user_persona(
                conn, user_id, persona_idx=idx,
                embedding=result.centroids[idx],
                track_count=int(result.weights[idx]),
            )

        status.set("generating_mrt", 90, "추천 생성 중...")
        for idx in range(k):
            recs = search_for_persona(
                conn, user_id, result.centroids[idx],
                catalog_model_version=CATALOG_MODEL_VERSION,
                candidate_pool=candidate_pool,
                top_n=persona_top_n,
            )
            track_id_list = [r["track_id"] for r in recs]
            score_list = [r["similarity"] for r in recs]
            insert_playlist_history(
                conn, user_id, track_id_list, MODEL_VERSION,
                context={"personaIdx": idx, "kind": "persona", "scores": score_list},
            )
        conn.commit()

        status.set("done", 100, "완료")
    except Exception as e:
        status.fail(f"예외: {e!s}")
        conn.rollback()


async def _run_tidal_collection(
    user_id: str,
    status: OnboardingStatus,
    conn: psycopg.Connection,
    oauth: dict,
) -> None:
    """Tidal 사용자: favorites + 플레이리스트 트랙 fetch + UserTrack 저장."""
    access_token = oauth["accessToken"]
    tidal_uid = _extract_tidal_uid(access_token)

    status.set("fetching_favorites", 5, "Tidal 즐겨찾기 가져오는 중...")
    favorite_track_ids = await fetch_tidal_favorite_tracks(
        access_token=access_token, tidal_user_id=tidal_uid, country="KR"
    )

    status.set("fetching_favorites", 10, "Tidal 플레이리스트 목록 가져오는 중...")
    playlist_uuids = await fetch_tidal_user_playlists(
        access_token=access_token, tidal_user_id=tidal_uid, country="KR"
    )

    playlist_track_ids_set: set[str] = set()
    for i, pl_uuid in enumerate(playlist_uuids):
        status.set(
            "fetching_favorites",
            10 + int(10 * (i + 1) / max(len(playlist_uuids), 1)),
            f"Tidal 플레이리스트 트랙 가져오는 중... ({i + 1}/{len(playlist_uuids)})",
        )
        try:
            tracks = await fetch_tidal_playlist_tracks(
                access_token=access_token, playlist_uuid=pl_uuid, country="KR"
            )
            playlist_track_ids_set.update(tracks)
        except Exception:
            continue

    favorite_set = set(favorite_track_ids)
    all_tidal_ids = list(favorite_set | playlist_track_ids_set)

    if not all_tidal_ids:
        raise RuntimeError("Tidal 즐겨찾기와 플레이리스트에 트랙이 없습니다.")

    status.set("matching_tracks", 25, f"트랙 매칭 중... (Tidal {len(all_tidal_ids)}곡)")
    internal_track_ids = _match_tidal_to_internal(conn, all_tidal_ids)
    if len(internal_track_ids) < 10:
        raise RuntimeError(
            f"매칭된 트랙이 부족합니다 (Tidal {len(all_tidal_ids)}곡 중 {len(internal_track_ids)}곡만 매칭). 최소 10곡 필요"
        )

    with conn.cursor() as cur:
        cur.execute(
            '''SELECT "trackId", "platformTrackId" FROM "TrackPlatform"
               WHERE platform = 'tidal' AND "platformTrackId" = ANY(%s)''',
            (all_tidal_ids,),
        )
        rows = cur.fetchall()
    internal_to_tidal = {r[0]: r[1] for r in rows}

    for internal_id in internal_track_ids:
        tidal_id = internal_to_tidal.get(internal_id)
        if tidal_id and tidal_id in favorite_set:
            upsert_user_track(
                conn, user_id=user_id, track_id=internal_id,
                is_core=True, source="liked", platform="tidal",
            )
        else:
            upsert_user_track(
                conn, user_id=user_id, track_id=internal_id,
                is_core=False, source="playlist", platform="tidal",
            )
    conn.commit()


async def _run_spotify_collection(
    user_id: str,
    status: OnboardingStatus,
    conn: psycopg.Connection,
    oauth: dict,
) -> None:
    """Spotify 사용자: favorites + 플레이리스트 트랙 fetch + UserTrack 저장."""
    access_token = oauth["accessToken"]

    status.set("fetching_favorites", 5, "Spotify 좋아요 트랙 가져오는 중...")
    favorite_track_ids = await fetch_spotify_favorite_tracks(access_token=access_token)

    status.set("fetching_favorites", 10, "Spotify 플레이리스트 목록 가져오는 중...")
    playlist_ids = await fetch_spotify_user_playlists(access_token=access_token)

    playlist_track_ids_set: set[str] = set()
    for i, pl_id in enumerate(playlist_ids):
        status.set(
            "fetching_favorites",
            10 + int(10 * (i + 1) / max(len(playlist_ids), 1)),
            f"Spotify 플레이리스트 트랙 가져오는 중... ({i + 1}/{len(playlist_ids)})",
        )
        try:
            tracks = await fetch_spotify_playlist_tracks(
                access_token=access_token, playlist_id=pl_id
            )
            playlist_track_ids_set.update(tracks)
        except Exception:
            continue

    favorite_set = set(favorite_track_ids)
    all_spotify_ids = list(favorite_set | playlist_track_ids_set)

    if not all_spotify_ids:
        raise RuntimeError("Spotify 좋아요와 플레이리스트에 트랙이 없습니다.")

    status.set("matching_tracks", 25, f"트랙 매칭 중... (Spotify {len(all_spotify_ids)}곡)")
    with conn.cursor() as cur:
        cur.execute(
            '''SELECT "trackId", "platformTrackId" FROM "TrackPlatform"
               WHERE platform = 'spotify' AND "platformTrackId" = ANY(%s)''',
            (all_spotify_ids,),
        )
        rows = cur.fetchall()
    internal_to_spotify = {r[0]: r[1] for r in rows}
    internal_track_ids = list(internal_to_spotify.keys())
    if len(internal_track_ids) < 10:
        raise RuntimeError(
            f"매칭된 트랙이 부족합니다 (Spotify {len(all_spotify_ids)}곡 중 {len(internal_track_ids)}곡만 매칭). 최소 10곡 필요"
        )

    for internal_id in internal_track_ids:
        spotify_id = internal_to_spotify.get(internal_id)
        if spotify_id and spotify_id in favorite_set:
            upsert_user_track(
                conn, user_id=user_id, track_id=internal_id,
                is_core=True, source="liked", platform="spotify",
            )
        else:
            upsert_user_track(
                conn, user_id=user_id, track_id=internal_id,
                is_core=False, source="playlist", platform="spotify",
            )
    conn.commit()
```

이전 인라인 fetch 코드는 모두 `_run_tidal_collection` + `_run_spotify_collection` 으로 옮겨감. `try/except` 의 RuntimeError로 fail 처리.

`run_onboarding` 의 except 블록은 RuntimeError를 status.fail로 변환:

```python
    except RuntimeError as e:
        status.fail(str(e))
        conn.rollback()
    except Exception as e:
        status.fail(f"예외: {e!s}")
        conn.rollback()
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
pytest tests/onboarding/ -v 2>&1 | tail -10
```

Expected: 모든 onboarding tests pass (favorites 2 + collection 3 + pipeline 3)

전체 회귀:
```bash
pytest tests/ 2>&1 | tail -3
```

- [ ] **Step 5: Commit**

```bash
git add src/mrms/onboarding/pipeline.py tests/onboarding/test_pipeline.py
git commit -m "feat(onboarding): pipeline platform 분기 (Tidal/Spotify)"
```

---

## Task 8: Frontend types — primary_platform + spotify_track_id

**Files:**
- Modify: `web/src/lib/types.ts`
- Modify: `web/src/store/player.ts`

- [ ] **Step 1: types.ts 업데이트**

`web/src/lib/types.ts`의 UserInfo, PersonaTrack, RecommendedTrack에 필드 추가:

```typescript
export interface UserInfo {
  user_id: string;
  email: string;
  displayName: string | null;
  country: string | null;
  personas_count: number;
  user_tracks_count: number;
  primary_platform: "tidal" | "spotify";
}

export interface PersonaTrack {
  track_id: string;
  title: string;
  artist: string;
  album_id: string | null;
  album_title: string | null;
  similarity: number;
  tidal_track_id: string | null;
  spotify_track_id: string | null;
}

export interface RecommendedTrack {
  track_id: string;
  title: string;
  artist: string;
  album_id: string | null;
  score: number;
  persona_idx: number | null;
  tidal_track_id: string | null;
  spotify_track_id: string | null;
}
```

- [ ] **Step 2: player store QueueTrack 확장**

`web/src/store/player.ts`의 QueueTrack:

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

- [ ] **Step 3: TypeScript 컴파일**

```bash
cd "/Volumes/MacExtend 1/MRMS_FN/web"
pnpm tsc --noEmit 2>&1 | grep -v node_modules | head -10
```

Expected: 우리 변경 파일 관련 에러 없음. PlayButton 또는 PlayerBar에서 QueueTrack.tidal_track_id를 `string` 으로 받던 곳이 있으면 nullable로 변경 필요 — Task 12에서 fix. 일단 type 정의만.

- [ ] **Step 4: Commit**

```bash
cd "/Volumes/MacExtend 1/MRMS_FN"
git add web/src/lib/types.ts web/src/store/player.ts
git commit -m "feat(web): types — primary_platform + spotify_track_id"
```

---

## Task 9: /login 페이지 Spotify 버튼 + error toast

**Files:**
- Modify: `web/src/app/(auth)/login/page.tsx`

- [ ] **Step 1: 기존 login 페이지 확인**

```bash
cd "/Volumes/MacExtend 1/MRMS_FN/web"
cat "src/app/(auth)/login/page.tsx"
```

현재는 Tidal 버튼만 있고 AuthCard 사용 중.

- [ ] **Step 2: Spotify 버튼 + error param 처리 추가**

`web/src/app/(auth)/login/page.tsx`를 다음과 같이 교체 (기존 AuthCard 패턴 유지):

```tsx
"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

import { AuthCard } from "@/components/auth/auth-card";
import { TidalConnectModal } from "@/components/auth/TidalConnectModal";
import { Button } from "@/components/ui/button";


const ERROR_MESSAGES: Record<string, string> = {
  spotify_denied: "Spotify 동의를 거부했습니다.",
  spotify_failed: "Spotify 인증에 실패했습니다.",
  spotify_me_failed: "Spotify 계정 정보를 가져오지 못했습니다.",
};


export default function LoginPage() {
  const params = useSearchParams();
  const errorKey = params.get("error") ?? "";
  const errorMsg = ERROR_MESSAGES[errorKey];
  const [tidalOpen, setTidalOpen] = useState(false);

  return (
    <AuthCard
      title="MRMS — 개인 맞춤 추천"
      description="Tidal 또는 Spotify 계정으로 시작하세요"
    >
      <div className="space-y-3">
        {errorMsg && (
          <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {errorMsg}
          </div>
        )}
        <Button
          onClick={() => setTidalOpen(true)}
          className="w-full"
          size="lg"
        >
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
      </div>
      <TidalConnectModal open={tidalOpen} onOpenChange={setTidalOpen} />
    </AuthCard>
  );
}
```

- [ ] **Step 3: TypeScript 컴파일 + 페이지 렌더링 확인**

```bash
cd "/Volumes/MacExtend 1/MRMS_FN/web"
pnpm tsc --noEmit 2>&1 | grep -v node_modules | head -5
```

Expected: 에러 없음

- [ ] **Step 4: Commit**

```bash
cd "/Volumes/MacExtend 1/MRMS_FN"
git add web/src/app/\(auth\)/login/page.tsx
git commit -m "feat(web): /login에 Spotify 버튼 + error toast"
```

---

## Task 10: Spotify Web Playback SDK wrapper

**Files:**
- Create: `web/src/lib/spotify-player.ts`

- [ ] **Step 1: spotify-player.ts 작성**

Create `web/src/lib/spotify-player.ts`:

```typescript
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
    const w = window as unknown as { Spotify?: unknown; onSpotifyWebPlaybackSDKReady?: () => void };
    if (w.Spotify) return resolve();
    w.onSpotifyWebPlaybackSDKReady = () => resolve();
  });
}


export async function initSpotifySdk(): Promise<void> {
  if (player) return;
  await loadSpotifyScript();
  const w = window as unknown as { Spotify: { Player: new (opts: unknown) => SpotifyPlayer } };
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
    usePlayerStore.setState({ errorMsg: `Spotify SDK 초기화 실패: ${s.message}` });
  });
  player.addListener("account_error", () => {
    usePlayerStore.setState({
      errorMsg: "Spotify Premium 구독이 필요합니다",
    });
  });
  player.addListener("authentication_error", (state: unknown) => {
    const s = state as { message: string };
    usePlayerStore.setState({ errorMsg: `Spotify 인증 실패: ${s.message}` });
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
```

- [ ] **Step 2: TypeScript 컴파일**

```bash
cd "/Volumes/MacExtend 1/MRMS_FN/web"
pnpm tsc --noEmit 2>&1 | grep -v node_modules | head -5
```

Expected: 에러 없음

- [ ] **Step 3: Commit**

```bash
cd "/Volumes/MacExtend 1/MRMS_FN"
git add web/src/lib/spotify-player.ts
git commit -m "feat(web): Spotify Web Playback SDK wrapper"
```

---

## Task 11: Player facade (Tidal/Spotify 통합)

**Files:**
- Create: `web/src/lib/player.ts`

- [ ] **Step 1: player.ts facade 작성**

Create `web/src/lib/player.ts`:

```typescript
"use client";

import type { QueueTrack } from "@/store/player";

import * as spotifyPlayer from "./spotify-player";
import * as tidalPlayer from "./tidal-player";


let primary: "tidal" | "spotify" | null = null;


export async function initPlayer(primaryPlatform: "tidal" | "spotify"): Promise<void> {
  primary = primaryPlatform;
  if (primary === "tidal") {
    await tidalPlayer.initTidalSdk();
  } else {
    await spotifyPlayer.initSpotifySdk();
  }
}


export async function loadAndPlay(track: QueueTrack): Promise<void> {
  if (primary === "tidal") {
    if (!track.tidal_track_id) {
      throw new Error("이 트랙은 Tidal에서 재생할 수 없습니다");
    }
    return tidalPlayer.loadAndPlay(track.tidal_track_id);
  }
  if (!track.spotify_track_id) {
    throw new Error("이 트랙은 Spotify에서 재생할 수 없습니다");
  }
  return spotifyPlayer.loadAndPlay(track.spotify_track_id);
}


export async function pausePlayback(): Promise<void> {
  if (primary === "tidal") return tidalPlayer.pausePlayback();
  return spotifyPlayer.pausePlayback();
}


export async function resumePlayback(): Promise<void> {
  if (primary === "tidal") return tidalPlayer.resumePlayback();
  return spotifyPlayer.resumePlayback();
}


export async function seekTo(ratio: number): Promise<void> {
  if (primary === "tidal") return tidalPlayer.seekTo(ratio);
  return spotifyPlayer.seekTo(ratio);
}


export async function setSdkVolume(v: number): Promise<void> {
  if (primary === "tidal") return tidalPlayer.setSdkVolume(v);
  return spotifyPlayer.setSdkVolume(v);
}


export function getPrimaryPlatform(): "tidal" | "spotify" | null {
  return primary;
}
```

- [ ] **Step 2: TypeScript 컴파일**

```bash
cd "/Volumes/MacExtend 1/MRMS_FN/web"
pnpm tsc --noEmit 2>&1 | grep -v node_modules | head -5
```

Expected: 에러 없음

- [ ] **Step 3: Commit**

```bash
cd "/Volumes/MacExtend 1/MRMS_FN"
git add web/src/lib/player.ts
git commit -m "feat(web): player facade (Tidal/Spotify dispatch)"
```

---

## Task 12: PlayerBar + PlayButton + QueueDrawer를 facade로 전환

**Files:**
- Modify: `web/src/components/player/PlayerBar.tsx`
- Modify: `web/src/components/player/PlayButton.tsx`
- Modify: `web/src/components/player/PlayerControls.tsx`
- Modify: `web/src/components/player/QueueDrawer.tsx`

- [ ] **Step 1: PlayerBar.tsx — facade init + primary_platform 기반**

`web/src/components/player/PlayerBar.tsx`의 useEffect 부분 + import 교체:

기존 `import { initTidalSdk } from "@/lib/tidal-player";` 를 제거하고 추가:

```typescript
import { initPlayer } from "@/lib/player";
import { useUser } from "@/lib/hooks/use-user";
```

useEffect를 다음으로 교체:

```typescript
  const { user } = useUser();

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        await initPlayer(user.primary_platform);
      } catch (e) {
        usePlayerStore.setState({ errorMsg: (e as Error).message });
      }
    })();
  }, [user]);
```

기존 setSdkVolume도 facade 사용으로 변경 (volume slider):

`import { setSdkVolume } from "@/lib/tidal-player";` → `import { setSdkVolume } from "@/lib/player";`

- [ ] **Step 2: PlayButton.tsx — facade + QueueTrack 확장**

`web/src/components/player/PlayButton.tsx`:

`import { loadAndPlay } from "@/lib/tidal-player";` → `import { loadAndPlay } from "@/lib/player";`

`onClick` 함수 안의 queueable filter 변경 — Tidal OR Spotify 둘 중 하나라도 있으면 OK:

```typescript
  const onClick = async () => {
    if (disabled) return;
    const queueable: QueueTrack[] = tracks
      .filter((t) => t.tidal_track_id || t.spotify_track_id)
      .map((t) => ({
        track_id: t.track_id,
        tidal_track_id: t.tidal_track_id,
        spotify_track_id: t.spotify_track_id,
        title: t.title,
        artist: t.artist,
        album_title: "album_title" in t ? (t.album_title ?? null) : null,
      }));
    const actualIdx = queueable.findIndex((q) => q.track_id === target.track_id);
    if (actualIdx < 0) return;
    setQueue(queueable, actualIdx);
    try {
      await loadAndPlay(queueable[actualIdx]);
    } catch (e) {
      usePlayerStore.setState({ errorMsg: (e as Error).message });
    }
  };
```

disabled 조건 변경:

```typescript
  const disabled =
    (!target?.tidal_track_id && !target?.spotify_track_id) ||
    !sdkReady ||
    premium === false;
```

`import type { QueueTrack } from "@/store/player";` 추가 필요.

- [ ] **Step 3: PlayerControls.tsx — next/prev에서 facade 사용**

`web/src/components/player/PlayerControls.tsx`:

`import { loadAndPlay, pausePlayback, resumePlayback, seekTo } from "@/lib/tidal-player";` → 

```typescript
import { loadAndPlay, pausePlayback, resumePlayback, seekTo } from "@/lib/player";
```

`next` 함수의 `await loadAndPlay(nextTrack.tidal_track_id);` 를:

```typescript
        await loadAndPlay(nextTrack);
```

`prev` 함수도 같은 패턴:

```typescript
        await loadAndPlay(prevTrack);
```

- [ ] **Step 4: QueueDrawer.tsx — jumpTo에서 facade**

`web/src/components/player/QueueDrawer.tsx`:

`import { loadAndPlay } from "@/lib/tidal-player";` → `import { loadAndPlay } from "@/lib/player";`

`onJump` 함수 안:

```typescript
      await loadAndPlay(queue[idx]);
```

(기존 `queue[idx].tidal_track_id` 대신 QueueTrack 전체 전달)

- [ ] **Step 5: TypeScript 컴파일 + 회귀 확인**

```bash
cd "/Volumes/MacExtend 1/MRMS_FN/web"
pnpm tsc --noEmit 2>&1 | grep -v node_modules | head -10
```

Expected: 에러 없음

전체 backend 회귀:
```bash
cd "/Volumes/MacExtend 1/MRMS_FN"
source .venv/bin/activate
pytest tests/ 2>&1 | tail -3
```

Expected: 모두 통과

- [ ] **Step 6: Commit**

```bash
git add web/src/components/player/
git commit -m "feat(web): player 컴포넌트들을 player facade로 통합 (Tidal/Spotify dispatch)"
```

---

## Task 13: 수동 e2e 검증 + Spotify Dashboard 설정 가이드

**Files:**
- 수동 검증 (코드 변경 없음 — 단, Spotify Dashboard 등록 + .env 확인 필요)

- [ ] **Step 1: Spotify Developer Dashboard 등록 확인**

본인의 Spotify Developer App (dashboard.spotify.com)에서:

1. 등록된 Redirect URI에 다음 두 개가 있는지 확인:
   - `http://localhost:8000/api/auth/spotify/callback` (dev)
   - `https://mrms.approid.team/api/auth/spotify/callback` (prod, tunnel 경유 시)
2. .env에 다음이 모두 설정되어 있는지:
   - `SPOTIFY_CLIENT_ID=...`
   - `SPOTIFY_CLIENT_SECRET=...`
   - `SPOTIFY_REDIRECT_URI=http://localhost:8000/api/auth/spotify/callback` (또는 위 URL 중 하나)

```bash
cd "/Volumes/MacExtend 1/MRMS_FN"
grep -E "^SPOTIFY_(CLIENT_ID|CLIENT_SECRET|REDIRECT_URI)" .env | sed 's/=.*/=***/'
```

Expected:
```
SPOTIFY_CLIENT_ID=***
SPOTIFY_CLIENT_SECRET=***
SPOTIFY_REDIRECT_URI=***
```

- [ ] **Step 2: 서비스 시작 — 다중 사용자 환경에서 테스트**

```bash
cd "/Volumes/MacExtend 1/MRMS_FN"
lsof -ti:8000 | xargs kill 2>/dev/null
.venv/bin/uvicorn mrms.api.main:app --port 8000 &

# 다른 터미널
pkill -f "next dev" 2>/dev/null
sleep 2
make web
```

- [ ] **Step 3: 브라우저 검증 — 새 시크릿 창에서**

`http://localhost:3500/login` 접속 (기존 cookie 없는 상태).

체크리스트:

- [ ] /login에 두 버튼 보임 ("Tidal로 시작하기" + "Spotify로 시작하기")
- [ ] **Spotify 클릭** → spotify.com 페이지로 redirect
- [ ] Spotify에서 로그인 + 동의 → 자동으로 /onboarding으로 돌아옴 (또는 /mrt — 이미 user 있으면)
- [ ] /onboarding에서 진행: "Spotify 좋아요 트랙 가져오는 중..." → "Spotify 플레이리스트 목록..." → ... → "완료"
- [ ] 자동 /mrt로 이동
- [ ] /mrt 페이지: 페르소나 + 추천 트랙 표시
- [ ] 우상단 Avatar 이니셜이 본인 Spotify 이메일 기반
- [ ] **Spotify Premium 있으면**: ▶ 클릭 → 풀 곡 재생
- [ ] **Spotify Free면**: ▶ 클릭 → "Spotify Premium 구독이 필요합니다" 에러
- [ ] 로그아웃 → /login으로 돌아옴
- [ ] 동일 시크릿 창에서 Tidal로 다시 시작 → 정상 동작 (Tidal user 따로 생성됨)
- [ ] 두 user 모두 DB에 존재 + 각자 own data

- [ ] **Step 4: 회귀 — 기존 Tidal 사용자 cookie**

기존 jacinto68 (Tidal) 사용자의 cookie로 /mrt 접속 (또는 정상 회원가입 flow 재진행). 변경된 게 없어야 함:
- /mrt 정상 표시
- PlayerBar의 ▶가 Tidal proxy로 풀 재생
- /api/user 응답에 `primary_platform: "tidal"` 포함

- [ ] **Step 5: 회귀 — 전체 백엔드 테스트**

```bash
cd "/Volumes/MacExtend 1/MRMS_FN"
source .venv/bin/activate
pytest tests/ -v 2>&1 | tail -10
```

Expected: 모두 통과 (test_auth_spotify 5 + test_spotify_collection 3 + test_pipeline 신규 + 기존)

- [ ] **Step 6: 모든 게 OK면 최종 commit (불필요한 변경 없음 확인)**

```bash
git status
git log --oneline main..HEAD | head -15
```

위가 깔끔하면 머지 준비 완료.

---

## Self-Review

**Spec coverage**:
- ✅ Section 3 (Architecture) → Task 1-12 전체
- ✅ Section 4.1 (primaryPlatform) → Task 1
- ✅ Section 4.2 (3 endpoints) → Task 3
- ✅ Section 4.3 (existing endpoints update) → Task 4, 5
- ✅ Section 4.4 (Spotify scopes) → Task 3 (auth_spotify.py SPOTIFY_SCOPES 상수)
- ✅ Section 4.5 (pipeline 분기) → Task 7
- ✅ Section 4.6 (spotify_collection module + SpotifyOAuthClient) → Task 2, 6
- ✅ Section 5.1 (/login 2 버튼 + error) → Task 9
- ✅ Section 5.3 (player facade) → Task 11
- ✅ Section 5.4 (spotify-player.ts SDK wrapper) → Task 10
- ✅ Section 5.5 (QueueTrack 확장) → Task 8
- ✅ Section 5.6 (PlayerBar uses facade) → Task 12
- ✅ Section 5.7 (PlayButton uses QueueTrack 확장) → Task 12
- ✅ Section 6 (Error handling) → 각 task에 분산
- ✅ Section 7 (Testing) → Task 별 테스트 + Task 13 manual
- ✅ Section 10 (File Changes) → 모든 파일 path 명시

**Placeholders check**:
- 모든 코드 블록 완전한 작성 가능 형태
- Spotify Dashboard 등록은 본인 수동 작업 (Task 13 Step 1) — 외부 행위라 명시만 가능

**Type consistency**:
- `UserInfo.primary_platform`: Python schema (`str`) ↔ TypeScript (`"tidal" | "spotify"`) — narrower literal but compatible
- `OnboardingStep`: 변경 없음 (favorites/playlists 메시지만 다름)
- `QueueTrack`: TypeScript에서 nullable로 두 ID 모두. PlayButton/PlayerControls/QueueDrawer 모두 QueueTrack 전체 전달
- `loadAndPlay` 시그니처: tidal-player.ts는 `(tidalId: string)`, spotify-player.ts는 `(spotifyId: string)`, **facade는 `(track: QueueTrack)`** — 분기 + 적절한 ID 추출

**Risks**:
- Task 3 OAuth callback에서 User upsert의 primaryPlatform 분기 로직이 복잡 — SQL UPDATE 절을 잘 짜야 함. 본 plan에 정확한 SQL 명시.
- Task 12 PlayerControls의 nextTrack/prevTrack 변경 시 store 의 QueueTrack 타입 변경이 모든 consumer에 영향 — facade 도입으로 컴포넌트는 단일 진입점.
- Spotify SDK는 Premium 필수 — 테스트 시 본인 계정 상태 확인 필요.
- email conflict (Tidal과 같은 email로 Spotify로도 가입 시): 명시 SQL로 primaryPlatform 덮어쓰기 안 하도록 처리 (Task 3 SQL UPDATE).
