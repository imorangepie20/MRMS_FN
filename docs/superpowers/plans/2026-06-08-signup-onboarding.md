# Sub-project F: Signup → First Recommendation → Listen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tidal OAuth Device Code 회원가입 → AuthSession 기반 다중 사용자 → 자동 onboarding (favorites → embedding → MRT) → /mrt에서 풀 곡 재생까지 end-to-end flow.

**Architecture:** 백엔드는 AuthSession (Prisma) + Cookie middleware로 user_id 식별. 신규 4개 auth endpoint (device-code/init, poll, me, logout) + 2개 onboarding endpoint. 기존 5개 endpoint를 session 기반으로 전환. 온보딩 pipeline은 기존 generate_for_user() + Tidal favorites fetch를 함수로 합쳐서 BackgroundTasks로 실행. 프론트는 TidalConnectModal (visibilitychange 트리거) + /onboarding 진행 화면 + middleware 인증.

**Tech Stack:** FastAPI, psycopg, Prisma, Next.js 16 App Router, React 19, SWR, Tailwind v4, shadcn/ui Dialog/Progress.

**Spec:** [docs/superpowers/specs/2026-06-08-signup-onboarding-design.md](../specs/2026-06-08-signup-onboarding-design.md)

---

## 파일 구조

```
prisma/
├── schema.prisma                # AuthSession 모델 추가
└── migrations/<timestamp>_add_auth_session/
    └── migration.sql            # 자동 생성

src/mrms/
├── api/
│   ├── deps.py                  # + get_current_user_id
│   ├── auth_session.py          # NEW — device-code/init, poll, me, logout
│   ├── onboarding_api.py        # NEW — start, status endpoints
│   ├── main.py                  # router include + 기존 endpoint user dependency 교체
│   └── auth_tidal.py            # email→user_id 교체
└── onboarding/
    ├── __init__.py              # NEW
    ├── status.py                # NEW — OnboardingStatus + in-memory store
    ├── tidal_favorites.py       # NEW — Tidal API에서 좋아요 트랙 fetch
    └── pipeline.py              # NEW — run_onboarding (전체 단계 orchestration)

tests/api/
├── test_auth_session.py         # NEW
├── test_onboarding.py           # NEW
└── (기존 test_main.py, test_auth_tidal.py) # session 기반으로 회귀 fix

tests/onboarding/
├── __init__.py                  # NEW
└── test_pipeline.py             # NEW

web/src/
├── lib/
│   ├── hooks/use-user.ts        # NEW — SWR hook
│   └── server/auth.ts           # NEW — getServerSideUser
├── components/auth/
│   └── TidalConnectModal.tsx    # NEW
└── app/
    ├── (auth)/
    │   ├── login/page.tsx       # 기존 — Tidal 버튼 wire
    │   └── onboarding/page.tsx  # NEW — 진행 화면
    └── (dashboard)/
        └── mrt/page.tsx         # session 체크 추가

web/middleware.ts                # NEW — dashboard 경로 cookie 체크
web/e2e/signup-flow.spec.ts      # NEW
```

의존성 순서:
```
Task 1 (Prisma) → Task 2 (get_current_user_id) → Task 3 (Device Code)
  → Task 4 (/me + /logout) → Task 5 (existing endpoints migrate)
  → Task 6 (Tidal favorites fetch) → Task 7 (pipeline + status)
  → Task 8 (onboarding endpoints) → Task 9 (frontend lib)
  → Task 10 (TidalConnectModal) → Task 11 (/onboarding page)
  → Task 12 (middleware + /mrt auth) → Task 13 (manual + e2e verify)
```

---

## Task 1: AuthSession Prisma 모델 + Migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_auth_session/migration.sql` (자동 생성)

- [ ] **Step 1: schema.prisma에 AuthSession 모델 추가**

`prisma/schema.prisma`의 User 모델 안 `relations` 섹션에 다음 줄 추가 (다른 relation 옆):

```prisma
  authSessions AuthSession[]
```

그리고 파일의 적절한 위치 (User 모델 직후, UserOAuth 위)에 새 모델 추가:

```prisma
model AuthSession {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  expiresAt DateTime
  createdAt DateTime @default(now())
  userAgent String?

  @@index([userId])
}
```

- [ ] **Step 2: Migration 생성**

```bash
cd "/Volumes/MacExtend 1/MRMS_FN"
npx prisma migrate dev --name add_auth_session --schema prisma/schema.prisma
```

Expected: 새 migration 디렉토리 생성 + DB에 `AuthSession` 테이블 + 인덱스 적용.

- [ ] **Step 3: 검증**

```bash
docker compose exec pg psql -U mrms -d mrms -c "\d \"AuthSession\""
```

Expected: 테이블 + 컬럼 5개 + index on userId + FK to User.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(db): AuthSession model + migration"
```

---

## Task 2: get_current_user_id 의존성

**Files:**
- Modify: `src/mrms/api/deps.py`
- Test: `tests/api/test_auth_session.py` (Task 2에서 시작)

- [ ] **Step 1: 실패 테스트 작성**

Create `tests/api/test_auth_session.py`:

```python
"""AuthSession + get_current_user_id 테스트."""
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from mrms.api.main import app


client = TestClient(app)


def test_no_cookie_returns_401(db_conn):
    """Cookie 없으면 401."""
    r = client.get("/api/user")
    assert r.status_code == 401


def test_invalid_session_id_returns_401(db_conn):
    """존재하지 않는 session_id면 401."""
    client.cookies.set("mrms_session", "nonexistent-session-id")
    r = client.get("/api/user")
    assert r.status_code == 401
    client.cookies.clear()


def test_valid_session_returns_user(db_conn):
    """유효한 session_id면 user 데이터 반환."""
    from mrms.db.user_track import get_or_create_user
    import uuid

    user_id = get_or_create_user(db_conn, "session_user@example.com")
    session_id = uuid.uuid4().hex
    expires_at = datetime.now(timezone.utc) + timedelta(days=30)
    with db_conn.cursor() as cur:
        cur.execute(
            'INSERT INTO "AuthSession" (id, "userId", "expiresAt") VALUES (%s, %s, %s)',
            (session_id, user_id, expires_at),
        )
    db_conn.commit()

    client.cookies.set("mrms_session", session_id)
    r = client.get("/api/user")
    client.cookies.clear()
    assert r.status_code == 200
    assert r.json()["email"] == "session_user@example.com"


def test_expired_session_returns_401(db_conn):
    """만료된 session이면 401."""
    from mrms.db.user_track import get_or_create_user
    import uuid

    user_id = get_or_create_user(db_conn, "expired_user@example.com")
    session_id = uuid.uuid4().hex
    expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)  # 과거
    with db_conn.cursor() as cur:
        cur.execute(
            'INSERT INTO "AuthSession" (id, "userId", "expiresAt") VALUES (%s, %s, %s)',
            (session_id, user_id, expires_at),
        )
    db_conn.commit()

    client.cookies.set("mrms_session", session_id)
    r = client.get("/api/user")
    client.cookies.clear()
    assert r.status_code == 401
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd "/Volumes/MacExtend 1/MRMS_FN"
source .venv/bin/activate
pytest tests/api/test_auth_session.py -v
```

Expected: 4개 모두 FAIL (no_cookie는 200 — 현재 default user, 다른 건 db 없음 등)

- [ ] **Step 3: deps.py에 get_current_user_id 추가**

`src/mrms/api/deps.py` 파일 끝에 추가:

```python
from datetime import datetime, timezone

from fastapi import HTTPException, Request


def get_current_user_id(
    request: Request,
    conn: psycopg.Connection = Depends(db_conn),
) -> str:
    """Cookie 기반 session에서 user_id 추출. 미인증/만료 시 401."""
    session_id = request.cookies.get("mrms_session")
    if not session_id:
        raise HTTPException(401, "Not authenticated")

    with conn.cursor() as cur:
        cur.execute(
            'SELECT "userId", "expiresAt" FROM "AuthSession" WHERE id = %s',
            (session_id,),
        )
        row = cur.fetchone()
    if not row:
        raise HTTPException(401, "Invalid session")

    user_id, expires_at = row
    if expires_at and expires_at < datetime.now(timezone.utc):
        raise HTTPException(401, "Session expired")
    return user_id
```

기존 deps.py에 `psycopg` import 이미 있어야 함. 없으면 추가:
```python
import psycopg
from fastapi import Depends
```

- [ ] **Step 4: main.py의 /api/user를 session 기반으로 교체**

`src/mrms/api/main.py`의 `user()` 함수 시그니처와 첫 줄 수정:

```python
from mrms.api.deps import db_conn, get_current_user_id


@app.get("/api/user", response_model=UserInfo)
def user(
    user_id: str = Depends(get_current_user_id),
    conn: psycopg.Connection = Depends(db_conn),
) -> UserInfo:
    with conn.cursor() as cur:
        cur.execute('SELECT email, "displayName", country FROM "User" WHERE id = %s', (user_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "User not found")
        email, display_name, country = row

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
    )
```

`get_default_user_email` import 제거 (이 endpoint에서만 — 다른 곳은 Task 5에서).

`HTTPException` import도 추가 필요:
```python
from fastapi import Depends, FastAPI, HTTPException
```

- [ ] **Step 5: 테스트 통과 확인**

```bash
pytest tests/api/test_auth_session.py -v
```

Expected: 4 passed (모든 시나리오 OK).

회귀 확인:
```bash
pytest tests/api/test_main.py -v
```

기존 `test_user_endpoint_returns_default_user`는 FAIL할 것 (cookie 없으니 401). Task 5에서 session 기반으로 수정 예정.

- [ ] **Step 6: Commit**

```bash
git add src/mrms/api/deps.py src/mrms/api/main.py tests/api/test_auth_session.py
git commit -m "feat(api): get_current_user_id dependency + /api/user session-based"
```

---

## Task 3: Device Code 인증 endpoints (init + poll)

**Files:**
- Create: `src/mrms/api/auth_session.py`
- Modify: `src/mrms/api/main.py` (router include)
- Modify: `tests/api/test_auth_session.py` (Device Code 테스트 추가)

- [ ] **Step 1: 실패 테스트 추가**

`tests/api/test_auth_session.py` 끝에 추가:

```python
import json
import base64
from unittest.mock import AsyncMock, patch


def _make_tidal_jwt(uid: int = 99999) -> str:
    """가짜 Tidal JWT (서명 X, payload만 디코드 가능하게)."""
    header = base64.urlsafe_b64encode(b'{"alg":"none"}').decode().rstrip("=")
    payload = base64.urlsafe_b64encode(
        json.dumps({"uid": uid, "scope": "r_usr w_usr w_sub"}).encode()
    ).decode().rstrip("=")
    sig = base64.urlsafe_b64encode(b"fake").decode().rstrip("=")
    return f"{header}.{payload}.{sig}"


def test_device_code_init_returns_user_code(db_conn):
    """init endpoint → Tidal mock 응답 → user_code + verification_uri 반환."""
    fake_tidal_response = AsyncMock()
    fake_tidal_response.status_code = 200
    fake_tidal_response.json = lambda: {
        "userCode": "ABC123",
        "deviceCode": "DEVICE_XYZ",
        "verificationUri": "link.tidal.com",
        "verificationUriComplete": "https://link.tidal.com/ABC123",
        "expiresIn": 300,
        "interval": 5,
    }
    with patch("httpx.AsyncClient.post", return_value=fake_tidal_response):
        r = client.post("/api/auth/tidal/device-code/init")
    assert r.status_code == 200
    body = r.json()
    assert body["user_code"] == "ABC123"
    assert body["device_code"] == "DEVICE_XYZ"
    assert "link.tidal.com" in body["verification_uri_complete"]


def test_device_code_poll_pending_returns_pending(db_conn):
    """Tidal이 authorization_pending 400 → {status: pending}."""
    fake_response = AsyncMock()
    fake_response.status_code = 400
    fake_response.json = lambda: {"error": "authorization_pending"}
    with patch("httpx.AsyncClient.post", return_value=fake_response):
        r = client.post(
            "/api/auth/tidal/device-code/poll",
            json={"device_code": "DEVICE_XYZ"},
        )
    assert r.status_code == 200
    assert r.json()["status"] == "pending"


def test_device_code_poll_success_creates_session(db_conn):
    """성공 응답 → User+UserOAuth+AuthSession 생성 + cookie set."""
    jwt = _make_tidal_jwt(uid=12345)
    fake_response = AsyncMock()
    fake_response.status_code = 200
    fake_response.json = lambda: {
        "access_token": jwt,
        "refresh_token": "refresh_xyz",
        "expires_in": 86400,
    }
    with patch("httpx.AsyncClient.post", return_value=fake_response):
        r = client.post(
            "/api/auth/tidal/device-code/poll",
            json={"device_code": "DEVICE_XYZ"},
        )
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "success"
    assert body["has_mrt"] is False
    assert "mrms_session" in r.cookies

    # DB 검증
    with db_conn.cursor() as cur:
        cur.execute('SELECT id FROM "User" WHERE email = %s', ("tidal-12345@auto.local",))
        user_row = cur.fetchone()
        assert user_row is not None
        user_id = user_row[0]
        cur.execute('SELECT COUNT(*) FROM "AuthSession" WHERE "userId" = %s', (user_id,))
        assert cur.fetchone()[0] == 1
        cur.execute('SELECT "accessToken" FROM "UserOAuth" WHERE "userId" = %s AND platform = %s', (user_id, "tidal"))
        token_row = cur.fetchone()
        assert token_row is not None
        assert token_row[0] == jwt
    client.cookies.clear()


def test_device_code_poll_expired_returns_expired(db_conn):
    """Tidal이 expired_token → {status: expired}."""
    fake_response = AsyncMock()
    fake_response.status_code = 400
    fake_response.json = lambda: {"error": "expired_token"}
    with patch("httpx.AsyncClient.post", return_value=fake_response):
        r = client.post(
            "/api/auth/tidal/device-code/poll",
            json={"device_code": "DEVICE_XYZ"},
        )
    assert r.status_code == 200
    assert r.json()["status"] == "expired"
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
pytest tests/api/test_auth_session.py::test_device_code_init_returns_user_code -v
```

Expected: 404 (endpoint 없음)

- [ ] **Step 3: auth_session.py 생성**

Create `src/mrms/api/auth_session.py`:

```python
"""Tidal Device Code OAuth → AuthSession cookie."""
from __future__ import annotations

import base64
import json
import os
import uuid
from datetime import datetime, timedelta, timezone

import httpx
import psycopg
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from mrms.api.deps import db_conn, get_current_user_id
from mrms.db.user_track import get_or_create_user, upsert_oauth


router = APIRouter(prefix="/api/auth", tags=["auth"])

TIDAL_DEVICE_AUTH_URL = "https://auth.tidal.com/v1/oauth2/device_authorization"
TIDAL_TOKEN_URL = "https://auth.tidal.com/v1/oauth2/token"
TIDAL_SCOPES = "r_usr w_usr w_sub"
SESSION_COOKIE_NAME = "mrms_session"
SESSION_MAX_AGE = 30 * 24 * 60 * 60  # 30 days


class DeviceCodePollRequest(BaseModel):
    device_code: str


@router.post("/tidal/device-code/init")
async def device_code_init() -> dict:
    """Tidal device_authorization → user_code + verification_uri 반환."""
    client_id = os.environ["TIDAL_CLIENT_ID"]
    async with httpx.AsyncClient(timeout=10.0) as http:
        r = await http.post(
            TIDAL_DEVICE_AUTH_URL,
            data={"client_id": client_id, "scope": TIDAL_SCOPES},
        )
    if r.status_code != 200:
        raise HTTPException(r.status_code, f"Tidal device_authorization failed: {r.text[:200]}")
    data = r.json()
    verification_uri = data.get("verificationUri") or ""
    if verification_uri and not verification_uri.startswith("http"):
        verification_uri = f"https://{verification_uri}"
    verification_uri_complete = (
        data.get("verificationUriComplete")
        or f"{verification_uri}?code={data['userCode']}"
    )
    return {
        "user_code": data["userCode"],
        "device_code": data["deviceCode"],
        "verification_uri_complete": verification_uri_complete,
        "expires_in": data.get("expiresIn", 300),
        "interval": data.get("interval", 5),
    }


@router.post("/tidal/device-code/poll")
async def device_code_poll(
    body: DeviceCodePollRequest,
    request: Request,
    response: Response,
    conn: psycopg.Connection = Depends(db_conn),
) -> dict:
    """Tidal token endpoint 폴링. 성공 시 AuthSession 생성 + cookie set."""
    client_id = os.environ["TIDAL_CLIENT_ID"]
    client_secret = os.environ["TIDAL_CLIENT_SECRET"]

    async with httpx.AsyncClient(timeout=10.0) as http:
        r = await http.post(
            TIDAL_TOKEN_URL,
            data={
                "client_id": client_id,
                "client_secret": client_secret,
                "device_code": body.device_code,
                "grant_type": "urn:ietf:params:oauth:grant-type:device_code",
                "scope": TIDAL_SCOPES,
            },
        )

    if r.status_code == 400:
        err = r.json().get("error", "")
        if err in ("authorization_pending", "slow_down"):
            return {"status": "pending"}
        if err == "expired_token":
            return {"status": "expired"}
        return {"status": "error", "detail": err}

    if r.status_code != 200:
        raise HTTPException(r.status_code, f"Tidal token exchange failed: {r.text[:200]}")

    tokens = r.json()
    access_token = tokens["access_token"]
    refresh_token = tokens.get("refresh_token", "")
    expires_in = tokens.get("expires_in", 86400)

    # JWT payload에서 Tidal uid 추출
    parts = access_token.split(".")
    payload_b64 = parts[1] + "=" * (4 - len(parts[1]) % 4)
    payload = json.loads(base64.urlsafe_b64decode(payload_b64))
    tidal_uid = str(payload["uid"])
    email = f"tidal-{tidal_uid}@auto.local"

    user_id = get_or_create_user(conn, email)
    conn.commit()

    token_expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
    upsert_oauth(
        conn,
        user_id=user_id,
        platform="tidal",
        access_token=access_token,
        refresh_token=refresh_token,
        expires_at=token_expires_at,
        scopes=TIDAL_SCOPES.split(),
    )

    # AuthSession 생성
    session_id = uuid.uuid4().hex
    session_expires = datetime.now(timezone.utc) + timedelta(seconds=SESSION_MAX_AGE)
    with conn.cursor() as cur:
        cur.execute(
            'INSERT INTO "AuthSession" (id, "userId", "expiresAt", "userAgent") VALUES (%s, %s, %s, %s)',
            (session_id, user_id, session_expires, request.headers.get("user-agent")),
        )

    # has_mrt 체크 (기존 PlaylistHistory rows)
    with conn.cursor() as cur:
        cur.execute('SELECT COUNT(*) FROM "PlaylistHistory" WHERE "userId" = %s', (user_id,))
        has_mrt = cur.fetchone()[0] > 0
    conn.commit()

    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=session_id,
        httponly=True,
        samesite="lax",
        max_age=SESSION_MAX_AGE,
        secure=False,  # production은 True
    )
    return {"status": "success", "has_mrt": has_mrt}
```

- [ ] **Step 4: main.py에 router include**

`src/mrms/api/main.py`의 import 영역에 추가:

```python
from mrms.api.auth_session import router as auth_session_router
```

그리고 `app.include_router(tidal_router)` 줄 아래에:

```python
app.include_router(auth_session_router)
```

- [ ] **Step 5: 테스트 통과 확인**

```bash
pytest tests/api/test_auth_session.py -v
```

Expected: 8 passed (4 기존 + 4 신규).

- [ ] **Step 6: Commit**

```bash
git add src/mrms/api/auth_session.py src/mrms/api/main.py tests/api/test_auth_session.py
git commit -m "feat(api): Tidal Device Code OAuth → AuthSession cookie endpoints"
```

---

## Task 4: /me + /logout endpoints

**Files:**
- Modify: `src/mrms/api/auth_session.py`
- Modify: `tests/api/test_auth_session.py`

- [ ] **Step 1: 실패 테스트 추가**

`tests/api/test_auth_session.py` 끝에 추가:

```python
def test_me_returns_user_with_valid_session(db_conn):
    """/me는 session에서 user 정보 반환."""
    from mrms.db.user_track import get_or_create_user
    import uuid as _uuid

    user_id = get_or_create_user(db_conn, "me_test@example.com")
    session_id = _uuid.uuid4().hex
    expires_at = datetime.now(timezone.utc) + timedelta(days=30)
    with db_conn.cursor() as cur:
        cur.execute(
            'INSERT INTO "AuthSession" (id, "userId", "expiresAt") VALUES (%s, %s, %s)',
            (session_id, user_id, expires_at),
        )
    db_conn.commit()

    client.cookies.set("mrms_session", session_id)
    r = client.get("/api/auth/me")
    client.cookies.clear()
    assert r.status_code == 200
    assert r.json()["email"] == "me_test@example.com"


def test_me_returns_401_without_session(db_conn):
    """Cookie 없으면 401."""
    r = client.get("/api/auth/me")
    assert r.status_code == 401


def test_logout_deletes_session(db_conn):
    """/logout은 AuthSession 삭제 + cookie clear."""
    from mrms.db.user_track import get_or_create_user
    import uuid as _uuid

    user_id = get_or_create_user(db_conn, "logout_test@example.com")
    session_id = _uuid.uuid4().hex
    expires_at = datetime.now(timezone.utc) + timedelta(days=30)
    with db_conn.cursor() as cur:
        cur.execute(
            'INSERT INTO "AuthSession" (id, "userId", "expiresAt") VALUES (%s, %s, %s)',
            (session_id, user_id, expires_at),
        )
    db_conn.commit()

    client.cookies.set("mrms_session", session_id)
    r = client.post("/api/auth/logout")
    client.cookies.clear()
    assert r.status_code == 200

    # DB에서 삭제됐는지
    with db_conn.cursor() as cur:
        cur.execute('SELECT COUNT(*) FROM "AuthSession" WHERE id = %s', (session_id,))
        assert cur.fetchone()[0] == 0
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
pytest tests/api/test_auth_session.py::test_me_returns_user_with_valid_session -v
```

Expected: 404 (endpoint 없음)

- [ ] **Step 3: /me + /logout endpoints 추가**

`src/mrms/api/auth_session.py`의 router 아래쪽에 추가:

```python
@router.get("/me")
def me(
    user_id: str = Depends(get_current_user_id),
    conn: psycopg.Connection = Depends(db_conn),
) -> dict:
    """현재 user 정보 반환."""
    with conn.cursor() as cur:
        cur.execute('SELECT email, "displayName", country FROM "User" WHERE id = %s', (user_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "User not found")
        email, display_name, country = row
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
    }


@router.post("/logout")
def logout(
    request: Request,
    response: Response,
    conn: psycopg.Connection = Depends(db_conn),
) -> dict:
    """AuthSession 삭제 + cookie clear."""
    session_id = request.cookies.get(SESSION_COOKIE_NAME)
    if session_id:
        with conn.cursor() as cur:
            cur.execute('DELETE FROM "AuthSession" WHERE id = %s', (session_id,))
        conn.commit()
    response.delete_cookie(SESSION_COOKIE_NAME)
    return {"status": "ok"}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
pytest tests/api/test_auth_session.py -v
```

Expected: 11 passed (8 기존 + 3 신규).

- [ ] **Step 5: Commit**

```bash
git add src/mrms/api/auth_session.py tests/api/test_auth_session.py
git commit -m "feat(api): /api/auth/me + /api/auth/logout endpoints"
```

---

## Task 5: 기존 endpoints를 session 기반으로 전환

**Files:**
- Modify: `src/mrms/api/main.py` (/api/mrt/latest)
- Modify: `src/mrms/api/auth_tidal.py` (/token, /refresh, /playback/.../stream)
- Modify: `tests/api/test_main.py` (cookie 세팅으로 회귀 fix)
- Modify: `tests/api/test_auth_tidal.py` (cookie 세팅으로 회귀 fix)

- [ ] **Step 1: 기존 테스트 회귀 fix**

`tests/api/test_main.py`의 helper function 추가 (파일 상단 import 영역 뒤에):

```python
import uuid as _uuid_helper
from datetime import datetime, timedelta, timezone


def _set_session_cookie(db_conn, email: str) -> str:
    """테스트용 — User 생성 + AuthSession + cookie set. user_id 반환."""
    from mrms.db.user_track import get_or_create_user
    user_id = get_or_create_user(db_conn, email)
    session_id = _uuid_helper.uuid4().hex
    expires_at = datetime.now(timezone.utc) + timedelta(days=30)
    with db_conn.cursor() as cur:
        cur.execute(
            'INSERT INTO "AuthSession" (id, "userId", "expiresAt") VALUES (%s, %s, %s)',
            (session_id, user_id, expires_at),
        )
    db_conn.commit()
    client.cookies.set("mrms_session", session_id)
    return user_id
```

기존 테스트 중 `test_user_endpoint_returns_default_user` / `test_mrt_latest_returns_personas_and_derives` / `test_mrt_latest_includes_tidal_track_id_and_filters` 모두 시작 부분에 `monkeypatch.setenv("DEFAULT_USER_EMAIL", ...)` 를 `_set_session_cookie(db_conn, "...")` 로 교체. 그리고 끝에 `client.cookies.clear()`.

예시 변경 (test_user_endpoint_returns_default_user):
```python
def test_user_endpoint_returns_default_user(db_conn):
    _set_session_cookie(db_conn, "test_default@example.com")
    r = client.get("/api/user")
    client.cookies.clear()
    assert r.status_code == 200
    assert r.json()["email"] == "test_default@example.com"
```

`monkeypatch` 인자 더 이상 필요 없으면 제거. user_id 변수 필요한 곳은 `user_id = _set_session_cookie(...)` 형태로.

`tests/api/test_auth_tidal.py`도 동일 helper 추가 + 기존 테스트 fix:
- `test_tidal_token_returns_existing_valid_token`: cookie 세팅 추가
- `test_tidal_token_404_when_no_oauth`: cookie 세팅 추가

- [ ] **Step 2: 테스트 실패 확인**

```bash
pytest tests/api/test_main.py tests/api/test_auth_tidal.py -v
```

Expected: cookie 세팅 추가했지만 backend가 아직 cookie 안 읽음 → 401 또는 실패.

- [ ] **Step 3: main.py의 /api/mrt/latest 수정**

`mrt_latest` 함수 시그니처를 session 기반으로:

```python
@app.get("/api/mrt/latest", response_model=MrtLatestResponse)
def mrt_latest(
    user_id: str = Depends(get_current_user_id),
    conn: psycopg.Connection = Depends(db_conn),
    top_n: int = 20,
    top_tracks_n: int = 30,
    top_albums_n: int = 15,
) -> MrtLatestResponse:
    # 기존 함수 본문에서 다음 줄들 삭제:
    # email = get_default_user_email()
    # user_id = get_or_create_user(conn, email)
    # conn.commit()
    # 나머지는 그대로
    
    playlists = fetch_latest_playlists(conn, user_id, limit=3)
    # ... (이후 동일)
```

`get_default_user_email`, `get_or_create_user` import 제거 (이 endpoint에서만; main.py 전체에서 안 쓰면 import도 제거).

- [ ] **Step 4: auth_tidal.py의 endpoints 수정**

`src/mrms/api/auth_tidal.py`의 `get_token`, `refresh_token`, `stream_track`, `_get_access_token` 모두 session 기반으로:

`_get_access_token` 함수:
```python
async def _get_access_token(user_id: str, conn: psycopg.Connection) -> str:
    """주어진 user_id의 유효 access_token 반환. 만료 임박 시 refresh."""
    oauth = get_oauth(conn, user_id, "tidal")
    if not oauth:
        raise HTTPException(404, "Tidal OAuth not configured. Sign in via /login")

    access_token = oauth["accessToken"]
    expires_at = oauth["expiresAt"]

    if expires_at and expires_at - timedelta(seconds=60) < datetime.now(timezone.utc):
        tokens = await _client().refresh_access_token(oauth["refreshToken"])
        access_token = tokens["access_token"]
        new_refresh = tokens.get("refresh_token", oauth["refreshToken"])
        new_expires = datetime.now(timezone.utc) + timedelta(seconds=tokens["expires_in"])
        scope = tokens.get("scope", "")
        granted = scope.split() if isinstance(scope, str) else list(scope)
        if not granted:
            granted = list(oauth.get("scope", []))
        upsert_oauth(
            conn, user_id=user_id, platform="tidal",
            access_token=access_token, refresh_token=new_refresh,
            expires_at=new_expires, scopes=granted,
        )
        conn.commit()
    return access_token
```

`get_token` endpoint:
```python
@router.get("/token")
async def get_token(
    user_id: str = Depends(get_current_user_id),
    conn: psycopg.Connection = Depends(db_conn),
) -> dict:
    oauth = get_oauth(conn, user_id, "tidal")
    if not oauth:
        raise HTTPException(404, "Tidal OAuth not configured. Sign in via /login")

    access_token = await _get_access_token(user_id, conn)
    expires_at = oauth["expiresAt"]
    premium = await _check_premium(access_token)
    return {
        "access_token": access_token,
        "expires_at": expires_at.isoformat() if expires_at else None,
        "premium": premium,
    }
```

`refresh_token` endpoint:
```python
@router.post("/refresh")
async def refresh_token_endpoint(
    user_id: str = Depends(get_current_user_id),
    conn: psycopg.Connection = Depends(db_conn),
) -> dict:
    oauth = get_oauth(conn, user_id, "tidal")
    if not oauth:
        raise HTTPException(404, "Tidal OAuth not configured")

    tokens = await _client().refresh_access_token(oauth["refreshToken"])
    new_access = tokens["access_token"]
    new_refresh = tokens.get("refresh_token", oauth["refreshToken"])
    new_expires = datetime.now(timezone.utc) + timedelta(seconds=tokens["expires_in"])
    scope = tokens.get("scope", "")
    granted = scope.split() if isinstance(scope, str) else list(scope)
    if not granted:
        granted = list(oauth.get("scope", []))
    upsert_oauth(
        conn, user_id=user_id, platform="tidal",
        access_token=new_access, refresh_token=new_refresh,
        expires_at=new_expires, scopes=granted,
    )
    conn.commit()
    return {
        "access_token": new_access,
        "expires_at": new_expires.isoformat(),
    }
```

`stream_track` endpoint:
```python
@playback_router.get("/stream/{track_id}")
async def stream_track(
    track_id: str,
    user_id: str = Depends(get_current_user_id),
    conn: psycopg.Connection = Depends(db_conn),
):
    access_token = await _get_access_token(user_id, conn)
    # ... (기존 본문 그대로 — playbackinfo 호출 + manifest decode + stream)
```

`get_default_user_email`, `get_or_create_user` import 제거.

- [ ] **Step 5: 테스트 통과 확인**

```bash
pytest tests/api/ -v
```

Expected: 모두 통과 (test_auth_session 11 + test_main 4 + test_auth_tidal 2 = 17).

- [ ] **Step 6: Commit**

```bash
git add src/mrms/api/main.py src/mrms/api/auth_tidal.py \
        tests/api/test_main.py tests/api/test_auth_tidal.py
git commit -m "feat(api): existing endpoints → session-based user_id (multi-user)"
```

---

## Task 6: Tidal favorites fetcher

**Files:**
- Create: `src/mrms/onboarding/__init__.py`
- Create: `src/mrms/onboarding/tidal_favorites.py`
- Create: `tests/onboarding/__init__.py`
- Create: `tests/onboarding/test_tidal_favorites.py`

- [ ] **Step 1: 디렉토리 + __init__.py 생성**

```bash
mkdir -p src/mrms/onboarding tests/onboarding
touch src/mrms/onboarding/__init__.py tests/onboarding/__init__.py
```

- [ ] **Step 2: 실패 테스트 작성**

Create `tests/onboarding/test_tidal_favorites.py`:

```python
"""Tidal favorites fetch 테스트."""
from unittest.mock import AsyncMock, patch
import pytest

from mrms.onboarding.tidal_favorites import fetch_tidal_favorite_tracks


@pytest.mark.asyncio
async def test_fetch_returns_track_ids():
    """Tidal /favorites/tracks 응답에서 trackId 추출."""
    fake_response = AsyncMock()
    fake_response.status_code = 200
    fake_response.json = lambda: {
        "items": [
            {"item": {"id": 111, "title": "T1"}},
            {"item": {"id": 222, "title": "T2"}},
        ],
        "totalNumberOfItems": 2,
    }
    with patch("httpx.AsyncClient.get", return_value=fake_response):
        ids = await fetch_tidal_favorite_tracks(
            access_token="fake_token",
            tidal_user_id="12345",
            country="KR",
        )
    assert ids == ["111", "222"]


@pytest.mark.asyncio
async def test_fetch_paginates():
    """totalNumberOfItems > limit이면 페이지네이션."""
    page1 = AsyncMock()
    page1.status_code = 200
    page1.json = lambda: {
        "items": [{"item": {"id": i}} for i in range(50)],
        "totalNumberOfItems": 75,
    }
    page2 = AsyncMock()
    page2.status_code = 200
    page2.json = lambda: {
        "items": [{"item": {"id": i}} for i in range(50, 75)],
        "totalNumberOfItems": 75,
    }
    with patch("httpx.AsyncClient.get", side_effect=[page1, page2]):
        ids = await fetch_tidal_favorite_tracks(
            access_token="fake",
            tidal_user_id="12345",
            country="KR",
        )
    assert len(ids) == 75
```

- [ ] **Step 3: 실패 확인**

```bash
pytest tests/onboarding/test_tidal_favorites.py -v
```

Expected: ImportError

- [ ] **Step 4: tidal_favorites.py 작성**

Create `src/mrms/onboarding/tidal_favorites.py`:

```python
"""Tidal 사용자의 좋아요 트랙 목록 fetch."""
from __future__ import annotations

import httpx


TIDAL_API_BASE = "https://api.tidal.com/v1"


async def fetch_tidal_favorite_tracks(
    access_token: str,
    tidal_user_id: str,
    country: str = "KR",
    page_size: int = 50,
) -> list[str]:
    """전체 좋아요 트랙 ID 목록 반환 (페이지네이션 처리)."""
    headers = {"Authorization": f"Bearer {access_token}"}
    track_ids: list[str] = []
    offset = 0

    async with httpx.AsyncClient(timeout=15.0) as http:
        while True:
            r = await http.get(
                f"{TIDAL_API_BASE}/users/{tidal_user_id}/favorites/tracks",
                params={"countryCode": country, "limit": page_size, "offset": offset},
                headers=headers,
            )
            if r.status_code != 200:
                raise RuntimeError(f"Tidal favorites failed: {r.status_code} {r.text[:200]}")
            data = r.json()
            items = data.get("items", [])
            for item in items:
                track = item.get("item") or item
                track_id = track.get("id")
                if track_id is not None:
                    track_ids.append(str(track_id))
            total = data.get("totalNumberOfItems", len(track_ids))
            offset += len(items)
            if not items or offset >= total:
                break

    return track_ids
```

- [ ] **Step 5: pytest-asyncio 의존성 확인**

```bash
pip list | grep -i pytest-asyncio
```

없으면:
```bash
pip install pytest-asyncio
```

`pyproject.toml` 또는 `pytest.ini`에 추가:
```toml
[tool.pytest.ini_options]
asyncio_mode = "auto"
```

- [ ] **Step 6: 테스트 통과 확인**

```bash
pytest tests/onboarding/test_tidal_favorites.py -v
```

Expected: 2 passed

- [ ] **Step 7: Commit**

```bash
git add src/mrms/onboarding/ tests/onboarding/ pyproject.toml
git commit -m "feat(onboarding): Tidal favorite tracks fetcher with pagination"
```

---

## Task 7: Onboarding pipeline + status

**Files:**
- Create: `src/mrms/onboarding/status.py`
- Create: `src/mrms/onboarding/pipeline.py`
- Create: `tests/onboarding/test_pipeline.py`

- [ ] **Step 1: status.py 작성**

Create `src/mrms/onboarding/status.py`:

```python
"""Onboarding 진행 상태 — in-memory store."""
from __future__ import annotations

from threading import Lock
from typing import Literal


Step = Literal[
    "idle",
    "fetching_favorites",
    "matching_tracks",
    "computing_embedding",
    "clustering",
    "generating_mrt",
    "done",
    "error",
]


class OnboardingStatus:
    def __init__(self) -> None:
        self.step: Step = "idle"
        self.progress: int = 0
        self.message: str | None = None
        self.error: str | None = None

    def set(self, step: Step, progress: int, message: str | None = None) -> None:
        self.step = step
        self.progress = progress
        self.message = message

    def fail(self, error: str) -> None:
        self.step = "error"
        self.error = error

    def to_dict(self) -> dict:
        return {
            "step": self.step,
            "progress": self.progress,
            "message": self.message,
            "error": self.error,
        }


# In-memory store: user_id → OnboardingStatus
_store: dict[str, OnboardingStatus] = {}
_lock = Lock()


def get_or_create_status(user_id: str) -> OnboardingStatus:
    with _lock:
        if user_id not in _store:
            _store[user_id] = OnboardingStatus()
        return _store[user_id]


def reset_status(user_id: str) -> OnboardingStatus:
    with _lock:
        _store[user_id] = OnboardingStatus()
        return _store[user_id]
```

- [ ] **Step 2: 실패 테스트 작성**

Create `tests/onboarding/test_pipeline.py`:

```python
"""Onboarding pipeline 함수 테스트."""
from unittest.mock import AsyncMock, patch
import pytest

from mrms.onboarding.pipeline import run_onboarding
from mrms.onboarding.status import OnboardingStatus


@pytest.mark.asyncio
async def test_pipeline_no_favorites_sets_error(db_conn, monkeypatch):
    """Tidal 즐겨찾기 0개면 error 상태."""
    from mrms.db.user_track import get_or_create_user, upsert_oauth
    from datetime import datetime, timedelta, timezone

    user_id = get_or_create_user(db_conn, "tidal-99999@auto.local")
    expires = datetime.now(timezone.utc) + timedelta(hours=1)
    upsert_oauth(
        db_conn, user_id=user_id, platform="tidal",
        access_token="fake_token", refresh_token="fake_refresh",
        expires_at=expires, scopes=["r_usr", "w_usr"],
    )
    db_conn.commit()

    status = OnboardingStatus()
    with patch(
        "mrms.onboarding.pipeline.fetch_tidal_favorite_tracks",
        new=AsyncMock(return_value=[]),
    ):
        await run_onboarding(user_id=user_id, status=status, conn=db_conn)
    assert status.step == "error"
    assert "즐겨찾기" in (status.error or "")


@pytest.mark.asyncio
async def test_pipeline_progresses_through_steps(db_conn):
    """정상 case: 단계가 fetching → ... → done으로 진행."""
    from mrms.db.user_track import get_or_create_user, upsert_oauth
    from datetime import datetime, timedelta, timezone

    user_id = get_or_create_user(db_conn, "tidal-pipeline_ok@auto.local")
    expires = datetime.now(timezone.utc) + timedelta(hours=1)
    upsert_oauth(
        db_conn, user_id=user_id, platform="tidal",
        access_token="fake_token", refresh_token="fake_refresh",
        expires_at=expires, scopes=["r_usr"],
    )
    db_conn.commit()

    # DB에서 Tidal-available 트랙 30개 sample
    with db_conn.cursor() as cur:
        cur.execute(
            '''SELECT tp."platformTrackId"
               FROM "TrackPlatform" tp
               WHERE tp.platform = 'tidal'
               LIMIT 30'''
        )
        tidal_track_ids = [r[0] for r in cur.fetchall()]
    if len(tidal_track_ids) < 10:
        pytest.skip("필요한 Tidal 트랙 데이터 부족")

    status = OnboardingStatus()
    with patch(
        "mrms.onboarding.pipeline.fetch_tidal_favorite_tracks",
        new=AsyncMock(return_value=tidal_track_ids),
    ):
        await run_onboarding(user_id=user_id, status=status, conn=db_conn)

    assert status.step == "done", f"step={status.step} error={status.error}"
    assert status.progress == 100
    # UserTrack rows 생성됐는지
    with db_conn.cursor() as cur:
        cur.execute('SELECT COUNT(*) FROM "UserTrack" WHERE "userId" = %s', (user_id,))
        assert cur.fetchone()[0] >= 10
        # PlaylistHistory rows 생성됐는지 (MRT)
        cur.execute('SELECT COUNT(*) FROM "PlaylistHistory" WHERE "userId" = %s', (user_id,))
        assert cur.fetchone()[0] >= 1
```

- [ ] **Step 3: 실패 확인**

```bash
pytest tests/onboarding/test_pipeline.py -v
```

Expected: ImportError

- [ ] **Step 4: pipeline.py 작성**

Create `src/mrms/onboarding/pipeline.py`:

```python
"""Onboarding 전체 단계 orchestration: favorites → UserTrack → embedding → MRT."""
from __future__ import annotations

import base64
import json

import psycopg
from pgvector.psycopg import register_vector

from mrms.db.user_track import get_oauth, upsert_user_tracks
from mrms.onboarding.status import OnboardingStatus
from mrms.onboarding.tidal_favorites import fetch_tidal_favorite_tracks


def _extract_tidal_uid(access_token: str) -> str:
    parts = access_token.split(".")
    payload_b64 = parts[1] + "=" * (4 - len(parts[1]) % 4)
    payload = json.loads(base64.urlsafe_b64decode(payload_b64))
    return str(payload["uid"])


def _match_tidal_tracks_to_internal(
    conn: psycopg.Connection, tidal_track_ids: list[str]
) -> list[str]:
    """Tidal track IDs를 내부 Track.id로 매핑."""
    if not tidal_track_ids:
        return []
    with conn.cursor() as cur:
        cur.execute(
            '''SELECT "trackId" FROM "TrackPlatform"
               WHERE platform = 'tidal' AND "platformTrackId" = ANY(%s)''',
            (tidal_track_ids,),
        )
        return [r[0] for r in cur.fetchall()]


async def run_onboarding(
    user_id: str,
    status: OnboardingStatus,
    conn: psycopg.Connection,
) -> None:
    """User 한 명의 첫 onboarding pipeline 실행. 상태를 status 객체에 진행률 기록."""
    try:
        # 1. Tidal access token + uid 가져오기
        oauth = get_oauth(conn, user_id, "tidal")
        if not oauth:
            status.fail("Tidal 연결이 필요합니다")
            return
        access_token = oauth["accessToken"]
        tidal_uid = _extract_tidal_uid(access_token)

        # 2. Tidal favorites fetch
        status.set("fetching_favorites", 5, "Tidal 즐겨찾기 가져오는 중...")
        tidal_track_ids = await fetch_tidal_favorite_tracks(
            access_token=access_token, tidal_user_id=tidal_uid, country="KR"
        )
        if not tidal_track_ids:
            status.fail("Tidal 즐겨찾기에 트랙이 없습니다. Tidal 앱에서 좋아요를 누른 곡이 필요합니다")
            return

        # 3. 내부 Track ID 매핑
        status.set("matching_tracks", 25, f"트랙 매칭 중... ({len(tidal_track_ids)}곡)")
        internal_track_ids = _match_tidal_tracks_to_internal(conn, tidal_track_ids)
        if len(internal_track_ids) < 10:
            status.fail(
                f"매칭된 트랙이 부족합니다 (Tidal {len(tidal_track_ids)}곡 중 {len(internal_track_ids)}곡만 내부 catalog 매칭). 최소 10곡 필요"
            )
            return

        # 4. UserTrack 저장
        upsert_user_tracks(conn, user_id, internal_track_ids)
        conn.commit()

        # 5. Embedding + persona + MRT (기존 scripts/09 로직)
        status.set("computing_embedding", 50, "음악 취향 분석 중...")
        register_vector(conn)
        from scripts._lib_mrt_generation import generate_for_user_id  # Task에서 만들 helper
        ok = generate_for_user_id(
            conn=conn,
            user_id=user_id,
            k=3,
            persona_top_n=20,
            candidate_pool=30,
            progress_callback=lambda step, prog, msg: status.set(step, prog, msg),
        )
        if not ok:
            status.fail("MRT 생성 실패")
            return

        status.set("done", 100, "완료")
    except Exception as e:
        status.fail(f"예외: {e!s}")
```

- [ ] **Step 5: scripts/09의 generate_for_user를 함수로 분리**

`scripts/09_generate_mrt.py`의 `generate_for_user` 함수를 그대로 두고, **인접한 helper module** 만들어서 import 가능하게:

Create `scripts/_lib_mrt_generation.py`:

```python
"""scripts/09_generate_mrt.py의 핵심 로직을 함수로 export — pipeline에서 호출용."""
from __future__ import annotations

from typing import Callable

import psycopg

# scripts/09 본문에서 generate_for_user(conn, email, k, persona_top_n, candidate_pool) 가져옴
# user_id 기반 버전 추가
from mrms.recsys.persona import aggregate_user_vector, cluster_user_tracks
# 이외 필요 import는 scripts/09에서 복사


def generate_for_user_id(
    conn: psycopg.Connection,
    user_id: str,
    k: int = 3,
    persona_top_n: int = 20,
    candidate_pool: int = 30,
    progress_callback: Callable[[str, int, str], None] | None = None,
) -> bool:
    """User_id 기반 MRT 생성. scripts/09의 generate_for_user(email-기반)와 동일 로직, user_id 직접 받음."""
    # 기존 scripts/09 내용을 user_id 기반으로 wrapping. 진행 단계마다 progress_callback 호출.
    # 단계:
    #   1. user_tracks fetch
    #   2. aggregate_user_vector → UserEmbedding upsert
    #   3. cluster_user_tracks(K) → UserPersona rows
    #   4. each persona: search candidates → playlist_history upsert
    # 자세한 구현은 scripts/09를 user_id 기반으로 복사 + progress_callback 콜.
    # 본 task에서 이 파일을 작성하면서 scripts/09 코드를 fully copy + adapt.
    raise NotImplementedError("Task에서 scripts/09 본문 옮겨와 user_id 기반으로 작성")
```

scripts/09 본문을 읽어보고 `generate_for_user` 함수를 그대로 옮긴 다음 email → user_id로 바꿈 + 단계마다 `progress_callback("computing_embedding", 60, "...")` 식으로 콜. 이 task가 가장 작업량 많음.

- [ ] **Step 6: 테스트 통과 확인**

```bash
pytest tests/onboarding/ -v
```

Expected: 2 passed (TrackPlatform tidal 데이터 부족하면 skip).

- [ ] **Step 7: Commit**

```bash
git add src/mrms/onboarding/ scripts/_lib_mrt_generation.py tests/onboarding/test_pipeline.py
git commit -m "feat(onboarding): pipeline orchestration (favorites → embedding → MRT) + status tracking"
```

---

## Task 8: Onboarding API endpoints (start + status)

**Files:**
- Create: `src/mrms/api/onboarding_api.py`
- Modify: `src/mrms/api/main.py`
- Modify: `tests/api/test_onboarding.py` (new file)

- [ ] **Step 1: 실패 테스트 작성**

Create `tests/api/test_onboarding.py`:

```python
"""Onboarding API 테스트."""
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from mrms.api.main import app


client = TestClient(app)


def _setup_session(db_conn, email: str) -> str:
    from mrms.db.user_track import get_or_create_user
    import uuid as _u
    user_id = get_or_create_user(db_conn, email)
    session_id = _u.uuid4().hex
    expires = datetime.now(timezone.utc) + timedelta(days=30)
    with db_conn.cursor() as cur:
        cur.execute(
            'INSERT INTO "AuthSession" (id, "userId", "expiresAt") VALUES (%s, %s, %s)',
            (session_id, user_id, expires),
        )
    db_conn.commit()
    client.cookies.set("mrms_session", session_id)
    return user_id


def test_status_returns_idle_initially(db_conn):
    """init 전 status는 idle."""
    _setup_session(db_conn, "ob_status@example.com")
    r = client.get("/api/onboarding/status")
    client.cookies.clear()
    assert r.status_code == 200
    assert r.json()["step"] == "idle"


def test_status_returns_401_without_session(db_conn):
    """Cookie 없으면 401."""
    r = client.get("/api/onboarding/status")
    assert r.status_code == 401


def test_start_returns_ok_and_idempotent(db_conn):
    """start 호출 → ok. 두 번 불러도 idempotent (이미 진행 중이면 무시)."""
    _setup_session(db_conn, "ob_start@example.com")
    r1 = client.post("/api/onboarding/start")
    r2 = client.post("/api/onboarding/start")
    client.cookies.clear()
    assert r1.status_code == 200
    assert r2.status_code == 200
```

- [ ] **Step 2: 실패 확인**

```bash
pytest tests/api/test_onboarding.py -v
```

Expected: 404 (endpoint 없음)

- [ ] **Step 3: onboarding_api.py 작성**

Create `src/mrms/api/onboarding_api.py`:

```python
"""Onboarding API — start + status endpoints."""
from __future__ import annotations

import psycopg
from fastapi import APIRouter, BackgroundTasks, Depends

from mrms.api.deps import db_conn, get_current_user_id
from mrms.onboarding.pipeline import run_onboarding
from mrms.onboarding.status import get_or_create_status, reset_status


router = APIRouter(prefix="/api/onboarding", tags=["onboarding"])


@router.get("/status")
def status_endpoint(
    user_id: str = Depends(get_current_user_id),
) -> dict:
    """현재 user의 onboarding 진행 상태."""
    status = get_or_create_status(user_id)
    return status.to_dict()


@router.post("/start")
def start_endpoint(
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user_id),
    conn: psycopg.Connection = Depends(db_conn),
) -> dict:
    """Onboarding job 시작. 이미 진행 중이면 idempotent."""
    status = get_or_create_status(user_id)
    if status.step not in ("idle", "error", "done"):
        return {"status": "already_running", "step": status.step}

    reset_status(user_id)
    new_status = get_or_create_status(user_id)
    # 백그라운드에서 실행 — 새 conn 사용 (request conn은 task 종료 후 닫힘)
    async def _runner():
        import os
        dsn = os.environ.get("DATABASE_URL", "postgresql://mrms:mrms@localhost:5433/mrms")
        async_conn = await _open_conn(dsn)
        try:
            await run_onboarding(user_id=user_id, status=new_status, conn=async_conn)
        finally:
            async_conn.close()

    background_tasks.add_task(_runner)
    return {"status": "started"}


async def _open_conn(dsn: str) -> psycopg.Connection:
    """별도 conn 생성 — async 환경에서도 동작."""
    import asyncio
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, lambda: psycopg.connect(dsn, autocommit=False))
```

- [ ] **Step 4: main.py에 router include**

`src/mrms/api/main.py`의 import 영역에 추가:

```python
from mrms.api.onboarding_api import router as onboarding_router
```

그리고 router include:

```python
app.include_router(onboarding_router)
```

- [ ] **Step 5: 테스트 통과 확인**

```bash
pytest tests/api/test_onboarding.py -v
```

Expected: 3 passed

- [ ] **Step 6: Commit**

```bash
git add src/mrms/api/onboarding_api.py src/mrms/api/main.py tests/api/test_onboarding.py
git commit -m "feat(api): /api/onboarding/{start,status} endpoints"
```

---

## Task 9: Frontend auth helpers

**Files:**
- Create: `web/src/lib/hooks/use-user.ts`
- Create: `web/src/lib/server/auth.ts`
- Modify: `web/src/lib/types.ts` (auth/onboarding types 추가)

- [ ] **Step 1: types.ts에 타입 추가**

`web/src/lib/types.ts` 끝에 추가:

```typescript
export interface DeviceCodeInit {
  user_code: string;
  device_code: string;
  verification_uri_complete: string;
  expires_in: number;
  interval: number;
}

export type DeviceCodePollStatus =
  | { status: "pending" }
  | { status: "expired" }
  | { status: "error"; detail?: string }
  | { status: "success"; has_mrt: boolean };

export type OnboardingStep =
  | "idle"
  | "fetching_favorites"
  | "matching_tracks"
  | "computing_embedding"
  | "clustering"
  | "generating_mrt"
  | "done"
  | "error";

export interface OnboardingStatus {
  step: OnboardingStep;
  progress: number;
  message: string | null;
  error: string | null;
}
```

- [ ] **Step 2: use-user.ts 작성**

```bash
mkdir -p web/src/lib/hooks web/src/lib/server
```

Create `web/src/lib/hooks/use-user.ts`:

```typescript
"use client";

import useSWR from "swr";

import type { UserInfo } from "@/lib/types";


const fetcher = async (url: string): Promise<UserInfo> => {
  const r = await fetch(url, { credentials: "include" });
  if (r.status === 401) throw new Error("Unauthorized");
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
};


export function useUser() {
  const { data, error, isLoading, mutate } = useSWR<UserInfo>(
    "/api/auth/me",
    fetcher,
    { revalidateOnFocus: true, shouldRetryOnError: false },
  );
  return {
    user: data,
    isLoading,
    isAuthenticated: !!data,
    error,
    refresh: mutate,
  };
}
```

`web/` 디렉토리에 `swr`이 이미 설치돼 있는지 확인:
```bash
cd web
grep '"swr"' package.json
```

없으면:
```bash
pnpm add swr
```

- [ ] **Step 3: server/auth.ts 작성**

Create `web/src/lib/server/auth.ts`:

```typescript
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import type { UserInfo } from "@/lib/types";


const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000/api";


export async function getServerSideUser(): Promise<UserInfo> {
  const cookieStore = await cookies();
  const session = cookieStore.get("mrms_session");
  if (!session) redirect("/login");

  const res = await fetch(`${API_BASE}/auth/me`, {
    headers: { Cookie: `mrms_session=${session.value}` },
    cache: "no-store",
  });
  if (res.status === 401) redirect("/login");
  if (!res.ok) throw new Error(`/api/auth/me failed: ${res.status}`);
  return res.json() as Promise<UserInfo>;
}
```

- [ ] **Step 4: TypeScript 컴파일 확인**

```bash
cd "/Volumes/MacExtend 1/MRMS_FN/web"
pnpm tsc --noEmit 2>&1 | grep -v node_modules | head -5
```

Expected: 에러 없음

- [ ] **Step 5: Commit**

```bash
cd "/Volumes/MacExtend 1/MRMS_FN"
git add web/src/lib/hooks/ web/src/lib/server/ web/src/lib/types.ts web/package.json web/pnpm-lock.yaml
git commit -m "feat(web): useUser hook + getServerSideUser + auth types"
```

---

## Task 10: TidalConnectModal + /login 연결

**Files:**
- Create: `web/src/components/auth/TidalConnectModal.tsx`
- Modify: `web/src/app/(auth)/login/page.tsx`

- [ ] **Step 1: TidalConnectModal 작성**

먼저 SDTPL의 Dialog 컴포넌트 위치 확인:
```bash
ls web/src/components/ui/dialog.tsx
```

Create `web/src/components/auth/TidalConnectModal.tsx`:

```tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type {
  DeviceCodeInit,
  DeviceCodePollStatus,
} from "@/lib/types";


interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}


export function TidalConnectModal({ open, onOpenChange }: Props) {
  const router = useRouter();
  const [init, setInit] = useState<DeviceCodeInit | null>(null);
  const [status, setStatus] = useState<string>("init");
  const [error, setError] = useState<string | null>(null);

  // 모달 open 시 device-code/init 호출
  useEffect(() => {
    if (!open) return;
    setError(null);
    setStatus("초기화 중...");
    (async () => {
      try {
        const r = await fetch("/api/auth/tidal/device-code/init", {
          method: "POST",
          credentials: "include",
        });
        if (!r.ok) throw new Error(`init failed: ${r.status}`);
        const data: DeviceCodeInit = await r.json();
        setInit(data);
        setStatus("Tidal에서 동의해주세요");
        // 새 탭 자동 오픈
        window.open(data.verification_uri_complete, "_blank");
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, [open]);

  const poll = useCallback(async () => {
    if (!init) return;
    try {
      const r = await fetch("/api/auth/tidal/device-code/poll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ device_code: init.device_code }),
        credentials: "include",
      });
      const result: DeviceCodePollStatus = await r.json();
      if (result.status === "success") {
        const target = result.has_mrt ? "/mrt" : "/onboarding";
        onOpenChange(false);
        router.push(target);
      } else if (result.status === "expired") {
        setError("코드 만료 — 재시도 해주세요");
        setInit(null);
      } else if (result.status === "error") {
        setError(result.detail ?? "Tidal 인증 에러");
      }
      // pending → 그냥 무시 (다음 trigger 대기)
    } catch (e) {
      setError((e as Error).message);
    }
  }, [init, onOpenChange, router]);

  // visibilitychange — 탭 재활성화 시 1회 poll
  useEffect(() => {
    if (!open || !init) return;
    const handler = () => {
      if (document.visibilityState === "visible") {
        void poll();
      }
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [open, init, poll]);

  // 30초 fallback poll
  useEffect(() => {
    if (!open || !init) return;
    const interval = setInterval(() => void poll(), 30_000);
    return () => clearInterval(interval);
  }, [open, init, poll]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Tidal 계정 연결</DialogTitle>
        </DialogHeader>
        {error ? (
          <div className="space-y-4">
            <p className="text-red-500">{error}</p>
            <Button onClick={() => setInit(null)}>다시 시도</Button>
          </div>
        ) : init ? (
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">코드</p>
              <div className="text-4xl font-mono font-bold tracking-wider">
                {init.user_code}
              </div>
            </div>
            <p className="text-sm">{status}</p>
            <a
              href={init.verification_uri_complete}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-center"
            >
              <Button variant="outline" className="w-full">
                Tidal 다시 열기 →
              </Button>
            </a>
            <Button onClick={poll} className="w-full">
              동의 완료 — 확인
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              동의 후 이 탭으로 돌아오면 자동으로 진행됩니다
            </p>
          </div>
        ) : (
          <p>{status}</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: /login 페이지에 버튼 연결**

`web/src/app/(auth)/login/page.tsx`를 읽고 Tidal 버튼이 있으면 onClick으로 modal open. 없으면 페이지 전체 교체:

```tsx
"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TidalConnectModal } from "@/components/auth/TidalConnectModal";


export default function LoginPage() {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center">
            MRMS — 개인 맞춤 추천
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            Tidal 계정으로 시작하세요. 좋아요 누른 곡을 기반으로 추천을 만들어 드립니다.
          </p>
          <Button
            onClick={() => setOpen(true)}
            className="w-full"
            size="lg"
          >
            Tidal로 시작하기
          </Button>
        </CardContent>
      </Card>
      <TidalConnectModal open={open} onOpenChange={setOpen} />
    </div>
  );
}
```

- [ ] **Step 3: TypeScript 컴파일**

```bash
cd "/Volumes/MacExtend 1/MRMS_FN/web"
pnpm tsc --noEmit 2>&1 | grep -v node_modules | head -10
```

Expected: 에러 없음 (Dialog/Button/Card는 SDTPL에 있음)

- [ ] **Step 4: Commit**

```bash
cd "/Volumes/MacExtend 1/MRMS_FN"
git add web/src/components/auth/ web/src/app/\(auth\)/login/
git commit -m "feat(web): TidalConnectModal (visibilitychange polling) + /login wiring"
```

---

## Task 11: /onboarding 페이지

**Files:**
- Create: `web/src/app/(auth)/onboarding/page.tsx`

- [ ] **Step 1: 파일 생성**

```bash
mkdir -p "web/src/app/(auth)/onboarding"
```

Create `web/src/app/(auth)/onboarding/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import type { OnboardingStatus, OnboardingStep } from "@/lib/types";


const STEP_LABELS: Record<OnboardingStep, string> = {
  idle: "준비 중...",
  fetching_favorites: "Tidal 즐겨찾기 가져오는 중...",
  matching_tracks: "트랙 매칭 중...",
  computing_embedding: "음악 취향 분석 중...",
  clustering: "페르소나 추출 중...",
  generating_mrt: "추천 생성 중...",
  done: "완료!",
  error: "오류",
};


export default function OnboardingPage() {
  const router = useRouter();
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [started, setStarted] = useState(false);

  // 첫 진입 시 start 호출
  useEffect(() => {
    if (started) return;
    setStarted(true);
    (async () => {
      try {
        await fetch("/api/onboarding/start", {
          method: "POST",
          credentials: "include",
        });
      } catch (e) {
        console.error("start failed", e);
      }
    })();
  }, [started]);

  // 1초마다 status 폴링
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const r = await fetch("/api/onboarding/status", {
          credentials: "include",
        });
        if (r.status === 401) {
          router.push("/login");
          return;
        }
        const data: OnboardingStatus = await r.json();
        setStatus(data);
        if (data.step === "done") {
          clearInterval(interval);
          setTimeout(() => router.push("/mrt"), 800);
        }
      } catch (e) {
        console.error("status polling failed", e);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [router]);

  const handleRetry = async () => {
    await fetch("/api/onboarding/start", {
      method: "POST",
      credentials: "include",
    });
    setStatus(null);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center">
            {status?.step === "error" ? "준비 실패" : "추천 만드는 중"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {status?.step === "error" ? (
            <>
              <p className="text-red-500 text-center">{status.error}</p>
              <Button onClick={handleRetry} className="w-full">
                다시 시도
              </Button>
            </>
          ) : (
            <>
              <p className="text-center text-lg">
                {STEP_LABELS[status?.step ?? "idle"]}
              </p>
              <Progress value={status?.progress ?? 0} className="w-full" />
              <p className="text-sm text-muted-foreground text-center">
                {status?.message ?? "시작 중..."}
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Progress 컴포넌트 존재 확인**

```bash
ls "/Volumes/MacExtend 1/MRMS_FN/web/src/components/ui/progress.tsx" 2>&1
```

없으면 shadcn으로 추가:
```bash
cd web && npx shadcn@latest add progress
```

- [ ] **Step 3: TypeScript 컴파일**

```bash
cd "/Volumes/MacExtend 1/MRMS_FN/web"
pnpm tsc --noEmit 2>&1 | grep -v node_modules | head -5
```

Expected: 에러 없음

- [ ] **Step 4: Commit**

```bash
cd "/Volumes/MacExtend 1/MRMS_FN"
git add web/src/app/\(auth\)/onboarding/ web/src/components/ui/
git commit -m "feat(web): /onboarding page (status polling + progress)"
```

---

## Task 12: middleware + /mrt 인증

**Files:**
- Create: `web/middleware.ts`
- Modify: `web/src/app/(dashboard)/mrt/page.tsx`

- [ ] **Step 1: middleware.ts 작성**

Create `web/middleware.ts`:

```typescript
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";


export function middleware(request: NextRequest) {
  const session = request.cookies.get("mrms_session");
  const pathname = request.nextUrl.pathname;

  // (dashboard) 경로 (= /mrt 등) 보호
  if (pathname.startsWith("/mrt")) {
    if (!session) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  // 이미 로그인된 상태로 /login 가면 /mrt로
  if (pathname === "/login" && session) {
    return NextResponse.redirect(new URL("/mrt", request.url));
  }

  return NextResponse.next();
}


export const config = {
  matcher: ["/mrt/:path*", "/login"],
};
```

- [ ] **Step 2: /mrt 페이지에 getServerSideUser 추가**

`web/src/app/(dashboard)/mrt/page.tsx` 시작 부분에:

```typescript
import { getServerSideUser } from "@/lib/server/auth";

// 기존 imports

export default async function MrtPage() {
  await getServerSideUser();  // 미인증이면 자동 /login redirect
  // 기존 본문 그대로
  ...
}
```

기존 fetch도 `credentials: "include"` 또는 cookie 전달 필요한 경우 처리. 우선 SDK 호출은 동일.

- [ ] **Step 3: 동작 확인 (수동)**

```bash
cd "/Volumes/MacExtend 1/MRMS_FN"
lsof -ti:8000 | xargs kill 2>/dev/null
.venv/bin/uvicorn mrms.api.main:app --port 8000 &
sleep 3
make web &
sleep 10

# /mrt 직접 접속 (cookie 없음) → /login redirect 기대
curl -s -o /dev/null -w "%{http_code} → %{redirect_url}\n" http://localhost:3500/mrt
```

Expected: 307 → http://localhost:3500/login

- [ ] **Step 4: Commit**

```bash
git add web/middleware.ts web/src/app/\(dashboard\)/mrt/
git commit -m "feat(web): middleware (dashboard auth) + /mrt server-side user check"
```

---

## Task 13: e2e 검증 + cleanup

**Files:**
- 본인 brower test
- 선택: `web/e2e/signup-flow.spec.ts` Playwright

- [ ] **Step 1: 기존 UserOAuth 삭제 (clean test)**

본인이 직접 처음부터 다시 회원가입 하려면:

```bash
docker compose exec pg psql -U mrms -d mrms -c "
  DELETE FROM \"AuthSession\";
  DELETE FROM \"UserOAuth\" WHERE platform = 'tidal';
"
```

- [ ] **Step 2: 서비스 시작**

```bash
cd "/Volumes/MacExtend 1/MRMS_FN"
lsof -ti:8000 | xargs kill 2>/dev/null
.venv/bin/uvicorn mrms.api.main:app --port 8000 &

# 다른 터미널
make web
```

- [ ] **Step 3: 본인 브라우저 검증**

`http://localhost:3500/login` 접속.

체크리스트:
- [ ] Login 페이지 보임 ("Tidal로 시작하기" 버튼)
- [ ] 버튼 클릭 → Modal 열림 + user_code 6자 코드 보임 + Tidal 새 탭 자동 오픈
- [ ] Tidal 동의 후 원래 탭으로 돌아옴
- [ ] visibilitychange 발동 → 1초 안에 자동 인식 → /onboarding으로 이동
- [ ] /onboarding 페이지: "Tidal 즐겨찾기 가져오는 중..." → 각 단계 메시지 → 완료
- [ ] 자동 /mrt로 이동
- [ ] /mrt에서 페르소나 카드 + 추천 트랙 표시
- [ ] ▶ 클릭 → 풀 곡 재생

- [ ] **Step 4: 회귀 확인**

```bash
cd "/Volumes/MacExtend 1/MRMS_FN"
source .venv/bin/activate
pytest tests/ -v
```

Expected: 전체 통과 (test_auth_session 11 + test_main 4 + test_auth_tidal 2 + test_onboarding 3 + test_pipeline 2 + test_tidal_favorites 2 = 24+)

- [ ] **Step 5: e2e spec (선택)**

`web/e2e/signup-flow.spec.ts` Playwright smoke 작성 (Tidal API mock 처리는 별도 — MVP는 생략 가능. 본인 수동 검증이 우선).

- [ ] **Step 6: Final commit**

```bash
git status
git log --oneline -20
```

merge 준비 — Task 1~13의 모든 commit이 feature/signup-onboarding 브랜치에 있어야 함 (또는 main에 직접).

---

## Self-Review

**Spec coverage**:
- ✅ Section 3 (Architecture 4단계) → Task 1-12 전체
- ✅ Section 4.1 (AuthSession) → Task 1
- ✅ Section 4.2 (신규 endpoints) → Task 3-4, 8
- ✅ Section 4.3 (기존 endpoints session 전환) → Task 5
- ✅ Section 4.4 (Onboarding pipeline) → Task 6, 7
- ✅ Section 5 (Frontend) → Task 9-12
- ✅ Section 6 (Error handling) → 각 task에 분산
- ✅ Section 7 (Testing) → Task 별 테스트 + Task 13 manual
- ✅ Section 10 (File Changes) → 모든 파일 path 명시

**Placeholders check**:
- Task 7 Step 5의 scripts/09 본문을 옮기는 작업은 "본 task에서 작업" 명시 — 실제 코드는 scripts/09 읽고 user_id 기반으로 변형. 이건 implementer의 작업으로 위임 (코드 그대로 가져오는 mechanical 작업).
- 그 외 모든 코드 블록은 실제 작성 가능한 형태

**Type consistency**:
- `OnboardingStep`: Python `Step` Literal (status.py) ↔ TypeScript `OnboardingStep` (types.ts) 동일 값
- `OnboardingStatus`: 두 언어 동일 4개 필드 (step, progress, message, error)
- `DeviceCodeInit`: 백엔드 응답 ↔ 프론트 타입 동일
- `get_current_user_id`: Task 2에서 정의 → Task 3, 4, 5, 8 모두 동일 시그니처 사용
- `_set_session_cookie` helper: Task 5에서 정의 후 회귀 fix에 사용

**Risks**:
- Task 7의 generate_for_user_id 구현 — 가장 큰 작업. scripts/09를 정확히 옮겨야 함. Implementer가 scripts/09 fully 읽고 user_id 기반으로 변형 필요.
- Task 8의 BackgroundTasks 사용 — async runner가 별도 conn 만드는 부분 정확히 구현 필요.
- Tidal Device Code의 client_secret이 fX2 (python-tidal credentials)이라 — 본 task에서 .env가 이미 fX2 상태여야 함.
