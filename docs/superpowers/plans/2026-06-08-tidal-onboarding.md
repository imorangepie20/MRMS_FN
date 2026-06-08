# Tidal Onboarding (A1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 단일 사용자(개발자 본인) CLI로 Tidal OAuth → 좋아요/플레이리스트 import → `UserTrack` 테이블 적재. 재실행 안전.

**Architecture:** OAuth client(PKCE) + 단발 콜백 서버 + JSON:API 파서 + 임포터로 책임 분리. CLI는 얇은 오케스트레이터. 테스트는 httpx monkeypatch + 로컬 PG 트랜잭션 롤백.

**Tech Stack:** Python 3.10+, httpx, tenacity, psycopg, pytest, pytest-asyncio. 외부 SDK 없음.

**Spec:** [docs/superpowers/specs/2026-06-08-tidal-onboarding-design.md](../specs/2026-06-08-tidal-onboarding-design.md)

---

## 파일 구조 (locked-in)

```
src/mrms/auth/
├── __init__.py
├── callback_server.py    # 단발 HTTP listener
└── tidal.py              # OAuth client + PKCE + 토큰 관리

src/mrms/sync/
├── __init__.py
├── jsonapi.py            # JSON:API 평탄화 헬퍼
└── tidal_importer.py     # Tidal API → DB import

src/mrms/db/
└── user_track.py         # User / UserOAuth / UserTrack / Track DB ops

prisma/init/
└── 03_user_track.sql     # UserTrack DDL

scripts/
└── 08_onboard_tidal.py   # CLI orchestrator

tests/
├── __init__.py
├── conftest.py           # 공통 fixture (DB 트랜잭션, mock client)
├── auth/
│   ├── __init__.py
│   ├── test_callback_server.py
│   └── test_tidal_oauth.py
├── sync/
│   ├── __init__.py
│   ├── test_jsonapi.py
│   └── test_tidal_importer.py
└── db/
    ├── __init__.py
    └── test_user_track.py
```

의존성 순서:
```
DDL → DB ops → JSON:API → Callback server → OAuth client → Importer → CLI
```

---

## Task 0: 테스트 인프라 셋업

**Files:**
- Create: `tests/__init__.py`
- Create: `tests/conftest.py`
- Create: `tests/auth/__init__.py`
- Create: `tests/sync/__init__.py`
- Create: `tests/db/__init__.py`
- Modify: `pyproject.toml`

- [ ] **Step 1: pyproject.toml에 respx 추가**

`pyproject.toml`의 `[project.optional-dependencies]` dev 섹션에 추가:

```toml
"respx>=0.20",
```

- [ ] **Step 2: 의존성 설치**

```bash
cd "/Volumes/MacExtend 1/MRMS_FN"
source .venv/bin/activate
pip install -e ".[dev]"
pip list | grep respx
```

Expected: `respx 0.20.x` 보임

- [ ] **Step 3: 빈 __init__.py 파일 생성**

```bash
mkdir -p tests/auth tests/sync tests/db
touch tests/__init__.py tests/auth/__init__.py tests/sync/__init__.py tests/db/__init__.py
```

- [ ] **Step 4: conftest.py 작성**

`tests/conftest.py`:

```python
"""공통 pytest fixture."""
from __future__ import annotations

import os

import psycopg
import pytest
from dotenv import load_dotenv

load_dotenv()


@pytest.fixture
def db_conn():
    """로컬 PG 연결 + 트랜잭션 자동 롤백.

    각 테스트가 변경한 데이터는 RELEASE 안 됨.
    Track 등 기존 데이터 SELECT만 가능, INSERT/UPDATE는 함수 종료시 사라짐.
    """
    dsn = os.environ.get("DATABASE_URL", "postgresql://mrms:mrms@localhost:5433/mrms")
    with psycopg.connect(dsn, autocommit=False) as conn:
        yield conn
        conn.rollback()
```

- [ ] **Step 5: 동작 확인**

```bash
pytest tests/ -v
```

Expected: `no tests ran in 0.0Xs` (테스트 파일은 없지만 collection 자체는 성공)

- [ ] **Step 6: Commit**

```bash
git add tests/ pyproject.toml
git commit -m "test: bootstrap pytest infrastructure with DB transaction fixture"
```

---

## Task 1: UserTrack 테이블 DDL

**Files:**
- Create: `prisma/init/03_user_track.sql`
- Test: 수동 검증 (psql)

- [ ] **Step 1: DDL 파일 작성**

`prisma/init/03_user_track.sql`:

```sql
CREATE TABLE IF NOT EXISTS "UserTrack" (
    id        TEXT PRIMARY KEY,
    "userId"  TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
    "trackId" TEXT NOT NULL REFERENCES "Track"(id) ON DELETE CASCADE,
    "isCore"  BOOLEAN NOT NULL,
    source    TEXT NOT NULL,
    platform  TEXT NOT NULL,
    "addedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE ("userId", "trackId")
);

CREATE INDEX IF NOT EXISTS idx_usertrack_user_core
  ON "UserTrack"("userId", "isCore");

CREATE INDEX IF NOT EXISTS idx_usertrack_user_platform
  ON "UserTrack"("userId", platform);
```

- [ ] **Step 2: DB에 적용**

```bash
docker compose exec -T pg psql -U mrms -d mrms < prisma/init/03_user_track.sql
```

Expected: `CREATE TABLE`, `CREATE INDEX` × 2 (또는 NOTICE if already exists)

- [ ] **Step 3: 테이블 존재 확인**

```bash
docker compose exec pg psql -U mrms -d mrms -c '\d "UserTrack"'
```

Expected: id, userId, trackId, isCore, source, platform, addedAt 컬럼 표시 + UNIQUE 제약 + 2개 인덱스

- [ ] **Step 4: Commit**

```bash
git add prisma/init/03_user_track.sql
git commit -m "feat: UserTrack table DDL (PGT/PCT membership)"
```

---

## Task 2: JSON:API 헬퍼

**Files:**
- Create: `src/mrms/sync/__init__.py`
- Create: `src/mrms/sync/jsonapi.py`
- Test: `tests/sync/test_jsonapi.py`

- [ ] **Step 1: 실패 테스트 작성**

`src/mrms/sync/__init__.py`:

```python
```

`tests/sync/test_jsonapi.py`:

```python
"""JSON:API 헬퍼 테스트."""
from mrms.sync.jsonapi import flatten_jsonapi, get_next_cursor


def test_flatten_data_only():
    response = {
        "data": [
            {"id": "1", "type": "tracks", "attributes": {"isrc": "AAA", "title": "T1"}},
            {"id": "2", "type": "tracks", "attributes": {"isrc": "BBB", "title": "T2"}},
        ]
    }
    result = flatten_jsonapi(response)
    assert len(result) == 2
    assert result[0] == {"id": "1", "type": "tracks", "isrc": "AAA", "title": "T1"}


def test_flatten_dedupes_data_and_included():
    """Tidal collection 패턴: data에 relationship 레코드, included에 실제 attributes."""
    response = {
        "data": [
            {"id": "1", "type": "tracks", "attributes": {}},  # relationship only
        ],
        "included": [
            {"id": "1", "type": "tracks", "attributes": {"isrc": "AAA", "title": "T1"}},
        ],
    }
    result = flatten_jsonapi(response)
    assert len(result) == 1
    assert result[0]["isrc"] == "AAA"  # included의 attributes가 우선


def test_flatten_filter_by_type():
    response = {
        "data": [
            {"id": "1", "type": "tracks", "attributes": {"isrc": "AAA"}},
            {"id": "p1", "type": "playlists", "attributes": {"title": "PL1"}},
        ]
    }
    result = flatten_jsonapi(response, focus_type="tracks")
    assert len(result) == 1
    assert result[0]["type"] == "tracks"


def test_flatten_empty():
    assert flatten_jsonapi({}) == []
    assert flatten_jsonapi({"data": [], "included": []}) == []


def test_get_next_cursor_present():
    response = {
        "links": {"next": "https://api.tidal.com/v2/x?page%5Bcursor%5D=abc123&other=1"}
    }
    assert get_next_cursor(response) == "abc123"


def test_get_next_cursor_absent():
    assert get_next_cursor({}) is None
    assert get_next_cursor({"links": {}}) is None
    assert get_next_cursor({"links": {"next": None}}) is None
```

- [ ] **Step 2: 테스트가 실패함을 확인**

```bash
pytest tests/sync/test_jsonapi.py -v
```

Expected: `ImportError` 또는 `ModuleNotFoundError: No module named 'mrms.sync.jsonapi'`

- [ ] **Step 3: 구현**

`src/mrms/sync/jsonapi.py`:

```python
"""JSON:API (jsonapi.org) 응답 평탄화 헬퍼.

Tidal v2 API가 사용. data + included + relationships 구조를 우리가 쓰기 좋은 평탄 dict 리스트로 변환.
"""
from __future__ import annotations

from urllib.parse import parse_qs, urlparse


def flatten_jsonapi(
    response: dict,
    focus_type: str | None = None,
) -> list[dict]:
    """JSON:API 응답을 [{ id, type, ...attributes }] 리스트로 변환.

    data + included 통합 후 ID 기준 dedup. included가 더 풍부한 attributes를 가지면 우선.
    focus_type 지정시 해당 type만 반환.
    """
    items: dict[str, dict] = {}
    sources = (response.get("data") or []) + (response.get("included") or [])
    for entry in sources:
        if not entry:
            continue
        if focus_type and entry.get("type") != focus_type:
            continue
        eid = entry.get("id")
        if eid is None:
            continue
        attrs = entry.get("attributes") or {}
        merged = items.get(eid, {})
        items[eid] = {
            "id": eid,
            "type": entry["type"],
            **merged,
            **attrs,
        }
    return list(items.values())


def get_next_cursor(response: dict) -> str | None:
    """JSON:API 응답의 links.next에서 page[cursor] 값 추출."""
    next_link = (response.get("links") or {}).get("next")
    if not next_link:
        return None
    qs = parse_qs(urlparse(next_link).query)
    return qs.get("page[cursor]", [None])[0]
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
pytest tests/sync/test_jsonapi.py -v
```

Expected: 6 passed

- [ ] **Step 5: Commit**

```bash
git add src/mrms/sync/__init__.py src/mrms/sync/jsonapi.py tests/sync/test_jsonapi.py
git commit -m "feat: JSON:API flatten + cursor helper (Tidal v2 prep)"
```

---

## Task 3: User/UserOAuth/UserTrack DB Layer

**Files:**
- Create: `src/mrms/db/__init__.py` (이미 있으면 skip)
- Create: `src/mrms/db/user_track.py`
- Test: `tests/db/test_user_track.py`

- [ ] **Step 1: 실패 테스트 작성**

`tests/db/test_user_track.py`:

```python
"""User / UserOAuth / UserTrack / Track 매칭 DB ops 테스트.

전제: 로컬 PG (port 5433)에 V1 적재 완료된 상태 (Track row 166k 존재).
각 테스트는 트랜잭션 롤백되어 영구 변경 없음.
"""
from datetime import datetime, timedelta, timezone

import psycopg
import pytest

from mrms.db.user_track import (
    get_or_create_user,
    upsert_oauth,
    get_oauth,
    find_track_id_by_isrc,
    upsert_user_track,
)


def test_create_user(db_conn):
    user_id = get_or_create_user(db_conn, email="test_a@example.com")
    assert user_id.startswith("c")  # cuid prefix
    # 같은 email 다시 → 같은 id
    user_id2 = get_or_create_user(db_conn, email="test_a@example.com")
    assert user_id == user_id2


def test_upsert_and_get_oauth(db_conn):
    user_id = get_or_create_user(db_conn, email="test_b@example.com")
    expires = datetime.now(timezone.utc) + timedelta(hours=1)
    upsert_oauth(
        db_conn,
        user_id=user_id,
        platform="tidal",
        access_token="ACCESS_AAA",
        refresh_token="REFRESH_BBB",
        expires_at=expires,
        scopes=["user.read", "collection.read"],
    )
    row = get_oauth(db_conn, user_id=user_id, platform="tidal")
    assert row is not None
    assert row["accessToken"] == "ACCESS_AAA"
    assert row["refreshToken"] == "REFRESH_BBB"
    assert "user.read" in row["scope"]


def test_upsert_oauth_replaces(db_conn):
    user_id = get_or_create_user(db_conn, email="test_c@example.com")
    expires = datetime.now(timezone.utc) + timedelta(hours=1)
    upsert_oauth(db_conn, user_id, "tidal", "T1", "R1", expires, ["user.read"])
    upsert_oauth(db_conn, user_id, "tidal", "T2", "R2", expires, ["user.read"])
    row = get_oauth(db_conn, user_id, "tidal")
    assert row["accessToken"] == "T2"


def test_find_track_id_by_isrc_hit(db_conn):
    """V1 적재된 실제 ISRC 하나 골라 검색."""
    with db_conn.cursor() as cur:
        cur.execute('SELECT isrc FROM "Track" LIMIT 1')
        row = cur.fetchone()
    if row is None:
        pytest.skip("Track 테이블 비어 있음 - V1 적재 선행 필요")
    isrc = row[0]
    track_id = find_track_id_by_isrc(db_conn, isrc)
    assert track_id is not None


def test_find_track_id_by_isrc_miss(db_conn):
    assert find_track_id_by_isrc(db_conn, "ZZZZ99999999") is None


def test_upsert_user_track_insert(db_conn):
    user_id = get_or_create_user(db_conn, email="test_d@example.com")
    with db_conn.cursor() as cur:
        cur.execute('SELECT id FROM "Track" LIMIT 1')
        row = cur.fetchone()
    if row is None:
        pytest.skip("Track 비어 있음")
    track_id = row[0]
    upsert_user_track(db_conn, user_id, track_id, is_core=True, source="liked", platform="tidal")
    with db_conn.cursor() as cur:
        cur.execute(
            'SELECT "isCore", source, platform FROM "UserTrack" WHERE "userId"=%s AND "trackId"=%s',
            (user_id, track_id),
        )
        ut = cur.fetchone()
    assert ut == (True, "liked", "tidal")


def test_upsert_user_track_conflict_liked_beats_playlist(db_conn):
    """playlist로 먼저 들어온 트랙이 liked로 재import되면 source='liked'로 승격."""
    user_id = get_or_create_user(db_conn, email="test_e@example.com")
    with db_conn.cursor() as cur:
        cur.execute('SELECT id FROM "Track" LIMIT 1')
        row = cur.fetchone()
    if row is None:
        pytest.skip("Track 비어 있음")
    track_id = row[0]
    upsert_user_track(db_conn, user_id, track_id, is_core=False, source="playlist:foo", platform="tidal")
    upsert_user_track(db_conn, user_id, track_id, is_core=True, source="liked", platform="tidal")
    with db_conn.cursor() as cur:
        cur.execute(
            'SELECT "isCore", source FROM "UserTrack" WHERE "userId"=%s AND "trackId"=%s',
            (user_id, track_id),
        )
        ut = cur.fetchone()
    assert ut == (True, "liked")


def test_upsert_user_track_conflict_playlist_does_not_demote(db_conn):
    """liked로 들어온 트랙은 playlist 재import로 source 'playlist:...'으로 안 바뀜."""
    user_id = get_or_create_user(db_conn, email="test_f@example.com")
    with db_conn.cursor() as cur:
        cur.execute('SELECT id FROM "Track" LIMIT 1')
        row = cur.fetchone()
    if row is None:
        pytest.skip("Track 비어 있음")
    track_id = row[0]
    upsert_user_track(db_conn, user_id, track_id, is_core=True, source="liked", platform="tidal")
    upsert_user_track(db_conn, user_id, track_id, is_core=False, source="playlist:bar", platform="tidal")
    with db_conn.cursor() as cur:
        cur.execute(
            'SELECT "isCore", source FROM "UserTrack" WHERE "userId"=%s AND "trackId"=%s',
            (user_id, track_id),
        )
        ut = cur.fetchone()
    # isCore=true 유지, source='liked' 유지
    assert ut == (True, "liked")
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
pytest tests/db/test_user_track.py -v
```

Expected: `ImportError: No module named 'mrms.db.user_track'`

- [ ] **Step 3: 구현 작성**

`src/mrms/db/__init__.py` (없으면 생성):

```python
```

`src/mrms/db/user_track.py`:

```python
"""User / UserOAuth / UserTrack / Track 매칭 DB ops.

cuid 대신 sha1 기반 결정론적 ID 사용 (재실행 멱등성).
"""
from __future__ import annotations

import hashlib
from datetime import datetime

import psycopg


def _id(value: str) -> str:
    h = hashlib.sha1(value.encode()).hexdigest()[:24]
    return f"c{h}"


def get_or_create_user(conn: psycopg.Connection, email: str) -> str:
    """email 기준 사용자 조회 또는 생성. 사용자 id 반환."""
    user_id = _id(f"user|{email}")
    with conn.cursor() as cur:
        cur.execute(
            '''INSERT INTO "User" (id, email, "createdAt")
               VALUES (%s, %s, NOW())
               ON CONFLICT (email) DO NOTHING''',
            (user_id, email),
        )
        cur.execute('SELECT id FROM "User" WHERE email = %s', (email,))
        row = cur.fetchone()
    if row is None:
        raise RuntimeError(f"User row not found after upsert: {email}")
    return row[0]


def upsert_oauth(
    conn: psycopg.Connection,
    user_id: str,
    platform: str,
    access_token: str,
    refresh_token: str,
    expires_at: datetime,
    scopes: list[str],
) -> None:
    """UserOAuth UPSERT (userId+platform unique)."""
    row_id = _id(f"oauth|{user_id}|{platform}")
    with conn.cursor() as cur:
        cur.execute(
            '''INSERT INTO "UserOAuth"
                 (id, "userId", platform, "accessToken", "refreshToken", "expiresAt", scope)
               VALUES (%s, %s, %s, %s, %s, %s, %s)
               ON CONFLICT ("userId", platform) DO UPDATE SET
                 "accessToken" = EXCLUDED."accessToken",
                 "refreshToken" = EXCLUDED."refreshToken",
                 "expiresAt" = EXCLUDED."expiresAt",
                 scope = EXCLUDED.scope''',
            (row_id, user_id, platform, access_token, refresh_token, expires_at, scopes),
        )


def get_oauth(
    conn: psycopg.Connection, user_id: str, platform: str
) -> dict | None:
    """UserOAuth row 반환 (없으면 None)."""
    with conn.cursor() as cur:
        cur.execute(
            '''SELECT "accessToken", "refreshToken", "expiresAt", scope
               FROM "UserOAuth"
               WHERE "userId" = %s AND platform = %s''',
            (user_id, platform),
        )
        row = cur.fetchone()
    if row is None:
        return None
    return {
        "accessToken": row[0],
        "refreshToken": row[1],
        "expiresAt": row[2],
        "scope": list(row[3]) if row[3] else [],
    }


def find_track_id_by_isrc(conn: psycopg.Connection, isrc: str) -> str | None:
    """Track id 반환 (없으면 None)."""
    with conn.cursor() as cur:
        cur.execute('SELECT id FROM "Track" WHERE isrc = %s', (isrc,))
        row = cur.fetchone()
    return row[0] if row else None


def upsert_user_track(
    conn: psycopg.Connection,
    user_id: str,
    track_id: str,
    is_core: bool,
    source: str,
    platform: str,
) -> None:
    """UserTrack UPSERT — conflict 시 liked가 playlist 이김."""
    row_id = _id(f"ut|{user_id}|{track_id}")
    with conn.cursor() as cur:
        cur.execute(
            '''INSERT INTO "UserTrack"
                 (id, "userId", "trackId", "isCore", source, platform)
               VALUES (%s, %s, %s, %s, %s, %s)
               ON CONFLICT ("userId", "trackId") DO UPDATE SET
                 "isCore" = "UserTrack"."isCore" OR EXCLUDED."isCore",
                 source = CASE
                   WHEN EXCLUDED.source = 'liked' THEN 'liked'
                   ELSE "UserTrack".source
                 END''',
            (row_id, user_id, track_id, is_core, source, platform),
        )
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
pytest tests/db/test_user_track.py -v
```

Expected: 8 passed (Track 비어 있으면 일부 skip)

- [ ] **Step 5: Commit**

```bash
git add src/mrms/db/ tests/db/
git commit -m "feat: DB ops for User/UserOAuth/UserTrack with conflict rules"
```

---

## Task 4: Callback HTTP Server

**Files:**
- Create: `src/mrms/auth/__init__.py`
- Create: `src/mrms/auth/callback_server.py`
- Test: `tests/auth/test_callback_server.py`

- [ ] **Step 1: 실패 테스트 작성**

`src/mrms/auth/__init__.py`:

```python
```

`tests/auth/test_callback_server.py`:

```python
"""단발 HTTP 콜백 서버 테스트."""
import threading
import time
from urllib.request import urlopen

import pytest

from mrms.auth.callback_server import CallbackServer


def test_receive_callback_with_code_and_state():
    """서버 시작 → GET 요청 → code/state 수신 → 자체 종료."""
    server = CallbackServer(host="127.0.0.1", port=18801, path="/callback/tidal")
    result = {}

    def worker():
        code, state = server.wait_for_callback(timeout=5)
        result["code"] = code
        result["state"] = state

    t = threading.Thread(target=worker, daemon=True)
    t.start()
    time.sleep(0.2)

    # 요청 보내기 (실제 OAuth provider 흉내)
    with urlopen("http://127.0.0.1:18801/callback/tidal?code=XYZ&state=ABC") as resp:
        body = resp.read().decode()
    assert "인증 완료" in body or "성공" in body or "complete" in body.lower()

    t.join(timeout=2)
    assert result["code"] == "XYZ"
    assert result["state"] == "ABC"


def test_timeout_raises():
    """timeout 안에 콜백 안 오면 TimeoutError."""
    server = CallbackServer(host="127.0.0.1", port=18802, path="/callback/tidal")
    with pytest.raises(TimeoutError):
        server.wait_for_callback(timeout=0.5)


def test_ignores_other_paths():
    """등록 안 한 path 요청은 무시 (404), wait는 계속 대기."""
    server = CallbackServer(host="127.0.0.1", port=18803, path="/callback/tidal")
    result = {}

    def worker():
        try:
            code, state = server.wait_for_callback(timeout=2)
            result["code"] = code
        except TimeoutError:
            result["code"] = None

    t = threading.Thread(target=worker, daemon=True)
    t.start()
    time.sleep(0.2)

    # 잘못된 path
    try:
        urlopen("http://127.0.0.1:18803/something_else")
    except Exception:
        pass

    # 그 다음 올바른 path
    urlopen("http://127.0.0.1:18803/callback/tidal?code=OK&state=S")

    t.join(timeout=3)
    assert result["code"] == "OK"
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
pytest tests/auth/test_callback_server.py -v
```

Expected: ImportError

- [ ] **Step 3: 구현 작성**

`src/mrms/auth/callback_server.py`:

```python
"""단발 OAuth 콜백 HTTP 서버.

브라우저가 redirect_uri로 GET 요청 보낼 때 code/state 수신해서
호출자에게 반환한 뒤 자체 종료. 다른 path는 404.
"""
from __future__ import annotations

import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs, urlparse


_SUCCESS_HTML = b"""<!doctype html>
<html><head><meta charset="utf-8"><title>Auth</title></head>
<body style="font-family:sans-serif;text-align:center;padding:40px">
<h1>인증 완료</h1>
<p>이 창을 닫고 터미널로 돌아가세요.</p>
</body></html>
"""


class CallbackServer:
    def __init__(
        self,
        host: str = "127.0.0.1",
        port: int = 8080,
        path: str = "/callback/tidal",
    ):
        self.host = host
        self.port = port
        self.path = path
        self._result: tuple[str, str] | None = None
        self._event = threading.Event()
        self._httpd: HTTPServer | None = None

    def wait_for_callback(self, timeout: float = 300.0) -> tuple[str, str]:
        """서버 시작 + 단발 콜백 수신. (code, state) 반환."""
        parent = self

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, fmt, *args):
                pass  # silence

            def do_GET(self):
                parsed = urlparse(self.path)
                if parsed.path != parent.path:
                    self.send_response(404)
                    self.end_headers()
                    return
                qs = parse_qs(parsed.query)
                code = qs.get("code", [None])[0]
                state = qs.get("state", [None])[0]
                if code is None:
                    self.send_response(400)
                    self.end_headers()
                    self.wfile.write(b"missing code")
                    return
                parent._result = (code, state or "")
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.end_headers()
                self.wfile.write(_SUCCESS_HTML)
                parent._event.set()

        self._httpd = HTTPServer((self.host, self.port), Handler)

        def serve():
            while not self._event.is_set():
                self._httpd.handle_request()

        t = threading.Thread(target=serve, daemon=True)
        t.start()

        try:
            if not self._event.wait(timeout=timeout):
                raise TimeoutError(f"콜백 {timeout}초 안에 안 옴")
            assert self._result is not None
            return self._result
        finally:
            try:
                self._httpd.server_close()
            except Exception:
                pass
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
pytest tests/auth/test_callback_server.py -v
```

Expected: 3 passed

- [ ] **Step 5: Commit**

```bash
git add src/mrms/auth/__init__.py src/mrms/auth/callback_server.py tests/auth/test_callback_server.py
git commit -m "feat: single-shot OAuth callback HTTP server"
```

---

## Task 5: Tidal OAuth Client (PKCE)

**Files:**
- Create: `src/mrms/auth/tidal.py`
- Test: `tests/auth/test_tidal_oauth.py`

- [ ] **Step 1: 실패 테스트 작성**

`tests/auth/test_tidal_oauth.py`:

```python
"""Tidal OAuth client 테스트."""
import base64
import hashlib

import pytest
import respx
from httpx import Response

from mrms.auth.tidal import TidalOAuthClient


@pytest.fixture
def client():
    return TidalOAuthClient(
        client_id="cid_test",
        client_secret="cs_test",
        redirect_uri="https://mrms.approid.team/callback/tidal",
        scopes=["user.read", "collection.read", "playlists.read"],
    )


def test_pkce_pair_is_valid(client):
    """code_challenge = base64url(sha256(verifier))."""
    verifier, challenge = client.generate_pkce_pair()
    assert 43 <= len(verifier) <= 128
    expected = base64.urlsafe_b64encode(
        hashlib.sha256(verifier.encode()).digest()
    ).rstrip(b"=").decode()
    assert challenge == expected


def test_pkce_pair_random(client):
    """매번 다른 verifier 생성."""
    v1, _ = client.generate_pkce_pair()
    v2, _ = client.generate_pkce_pair()
    assert v1 != v2


def test_build_authorize_url(client):
    url = client.build_authorize_url(
        code_challenge="CHALLENGE",
        state="STATE",
    )
    assert url.startswith("https://login.tidal.com/authorize?")
    assert "client_id=cid_test" in url
    assert "code_challenge=CHALLENGE" in url
    assert "code_challenge_method=S256" in url
    assert "state=STATE" in url
    assert "response_type=code" in url
    assert "scope=user.read+collection.read+playlists.read" in url \
        or "scope=user.read%20collection.read%20playlists.read" in url


@respx.mock
@pytest.mark.asyncio
async def test_exchange_code_success(client):
    respx.post("https://auth.tidal.com/v1/oauth2/token").mock(
        return_value=Response(
            200,
            json={
                "access_token": "AT_NEW",
                "refresh_token": "RT_NEW",
                "expires_in": 86400,
                "scope": "user.read collection.read playlists.read",
                "token_type": "Bearer",
            },
        )
    )
    tokens = await client.exchange_code(code="CODE", verifier="VERIFIER")
    assert tokens["access_token"] == "AT_NEW"
    assert tokens["refresh_token"] == "RT_NEW"
    assert tokens["expires_in"] == 86400
    assert "user.read" in tokens["scope"]


@respx.mock
@pytest.mark.asyncio
async def test_refresh_token_success(client):
    respx.post("https://auth.tidal.com/v1/oauth2/token").mock(
        return_value=Response(
            200,
            json={
                "access_token": "AT_REFRESHED",
                "refresh_token": "RT_KEPT",
                "expires_in": 86400,
                "scope": "user.read",
                "token_type": "Bearer",
            },
        )
    )
    tokens = await client.refresh_access_token(refresh_token="RT_OLD")
    assert tokens["access_token"] == "AT_REFRESHED"


@respx.mock
@pytest.mark.asyncio
async def test_exchange_code_failure_raises(client):
    respx.post("https://auth.tidal.com/v1/oauth2/token").mock(
        return_value=Response(400, json={"error": "invalid_grant"})
    )
    with pytest.raises(Exception, match="invalid_grant|400"):
        await client.exchange_code(code="BAD", verifier="VERIFIER")
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
pytest tests/auth/test_tidal_oauth.py -v
```

Expected: ImportError

- [ ] **Step 3: 구현 작성**

`src/mrms/auth/tidal.py`:

```python
"""Tidal OAuth (Authorization Code Flow with PKCE).

엔드포인트:
  AUTHORIZE: https://login.tidal.com/authorize
  TOKEN:     https://auth.tidal.com/v1/oauth2/token
"""
from __future__ import annotations

import base64
import hashlib
import secrets
from urllib.parse import urlencode

import httpx


AUTHORIZE_URL = "https://login.tidal.com/authorize"
TOKEN_URL = "https://auth.tidal.com/v1/oauth2/token"


class TidalOAuthError(Exception):
    pass


class TidalOAuthClient:
    def __init__(
        self,
        client_id: str,
        client_secret: str,
        redirect_uri: str,
        scopes: list[str],
    ):
        self.client_id = client_id
        self.client_secret = client_secret
        self.redirect_uri = redirect_uri
        self.scopes = scopes

    def generate_pkce_pair(self) -> tuple[str, str]:
        """(code_verifier, code_challenge) 반환.

        verifier: 랜덤 64자 url-safe
        challenge: base64url(sha256(verifier)), padding 제거
        """
        verifier = secrets.token_urlsafe(64)[:64]
        digest = hashlib.sha256(verifier.encode()).digest()
        challenge = base64.urlsafe_b64encode(digest).rstrip(b"=").decode()
        return verifier, challenge

    def build_authorize_url(self, code_challenge: str, state: str) -> str:
        params = {
            "response_type": "code",
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "scope": " ".join(self.scopes),
            "code_challenge": code_challenge,
            "code_challenge_method": "S256",
            "state": state,
        }
        return f"{AUTHORIZE_URL}?{urlencode(params)}"

    async def exchange_code(self, code: str, verifier: str) -> dict:
        """authorization_code grant — code + verifier → tokens."""
        async with httpx.AsyncClient(timeout=15.0) as http:
            r = await http.post(
                TOKEN_URL,
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.redirect_uri,
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "code_verifier": verifier,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
        if r.status_code != 200:
            raise TidalOAuthError(
                f"token exchange failed: {r.status_code} {r.text[:300]}"
            )
        return r.json()

    async def refresh_access_token(self, refresh_token: str) -> dict:
        """refresh_token grant — 새 access_token (+ 보통 refresh_token도 갱신)."""
        async with httpx.AsyncClient(timeout=15.0) as http:
            r = await http.post(
                TOKEN_URL,
                data={
                    "grant_type": "refresh_token",
                    "refresh_token": refresh_token,
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
        if r.status_code != 200:
            raise TidalOAuthError(
                f"refresh failed: {r.status_code} {r.text[:300]}"
            )
        return r.json()
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
pytest tests/auth/test_tidal_oauth.py -v
```

Expected: 6 passed

- [ ] **Step 5: Commit**

```bash
git add src/mrms/auth/tidal.py tests/auth/test_tidal_oauth.py
git commit -m "feat: Tidal OAuth client with PKCE + token refresh"
```

---

## Task 6: Tidal Importer (fetch + match + UPSERT)

**Files:**
- Create: `src/mrms/sync/tidal_importer.py`
- Test: `tests/sync/test_tidal_importer.py`

이 task는 spec section 14 (구현 시 검증 필요)에 따라 실제 Tidal API 응답 구조를 먼저 확인하고 spec의 엔드포인트 경로를 보정해야 함. 그러나 임시로 spec 가정 그대로 구현하고, 실제 호출에서 다르면 코드 조정.

- [ ] **Step 1: 실패 테스트 작성**

`tests/sync/test_tidal_importer.py`:

```python
"""Tidal Importer 테스트 — mock 응답 기반."""
from unittest.mock import AsyncMock

import pytest

from mrms.sync.tidal_importer import ImportStats, TidalImporter


def _make_importer(http_mock):
    return TidalImporter(
        http=http_mock,
        access_token="ACCESS_TEST",
        country_code="KR",
    )


@pytest.mark.asyncio
async def test_fetch_user_info_parses_jsonapi():
    http = AsyncMock()
    http.get = AsyncMock(return_value=_resp({
        "data": {
            "id": "u_123",
            "type": "users",
            "attributes": {"country": "KR", "email": "me@x.com", "displayName": "Me"},
        }
    }))
    importer = _make_importer(http)
    info = await importer.fetch_user_info()
    assert info["id"] == "u_123"
    assert info["country"] == "KR"
    assert info["email"] == "me@x.com"


@pytest.mark.asyncio
async def test_fetch_liked_tracks_paginates_and_extracts_isrc():
    http = AsyncMock()
    page1 = {
        "data": [{"id": "t1", "type": "tracks", "attributes": {}}],
        "included": [
            {"id": "t1", "type": "tracks", "attributes": {"isrc": "AAA111111111", "title": "T1"}}
        ],
        "links": {"next": "https://x?page%5Bcursor%5D=PAGE2"},
    }
    page2 = {
        "data": [{"id": "t2", "type": "tracks", "attributes": {}}],
        "included": [
            {"id": "t2", "type": "tracks", "attributes": {"isrc": "BBB222222222", "title": "T2"}}
        ],
        "links": {},
    }
    http.get = AsyncMock(side_effect=[_resp(page1), _resp(page2)])
    importer = _make_importer(http)
    tracks = await importer.fetch_liked_tracks(user_id="u_123")
    isrcs = sorted(t["isrc"] for t in tracks if t.get("isrc"))
    assert isrcs == ["AAA111111111", "BBB222222222"]


@pytest.mark.asyncio
async def test_fetch_playlists_returns_owner_only():
    http = AsyncMock()
    http.get = AsyncMock(return_value=_resp({
        "data": [
            {"id": "p1", "type": "playlists", "attributes": {"title": "Mine"}},
        ],
        "links": {},
    }))
    importer = _make_importer(http)
    pls = await importer.fetch_my_playlists(user_id="u_123")
    assert len(pls) == 1
    assert pls[0]["title"] == "Mine"


@pytest.mark.asyncio
async def test_import_stats_default_zero():
    stats = ImportStats()
    assert stats.liked_matched == 0
    assert stats.user_tracks_upserted == 0


def _resp(body: dict, status: int = 200):
    """httpx.Response 흉내 (mock helper)."""
    class _R:
        status_code = status
        def json(self):
            return body
        def raise_for_status(self):
            if not (200 <= status < 300):
                raise Exception(f"HTTP {status}")
    return _R()
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
pytest tests/sync/test_tidal_importer.py -v
```

Expected: ImportError

- [ ] **Step 3: 구현 작성**

`src/mrms/sync/tidal_importer.py`:

```python
"""Tidal v2 API → DB import.

엔드포인트는 spec 작성 시점 추정. 실제 호출에서 다르면 코드 조정 필요
(spec section 14 참고).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

import httpx

from mrms.sync.jsonapi import flatten_jsonapi, get_next_cursor


BASE_URL = "https://openapi.tidal.com/v2"


@dataclass
class ImportStats:
    liked_fetched: int = 0
    liked_matched: int = 0
    liked_no_isrc: int = 0
    liked_not_in_catalog: int = 0
    playlists_fetched: int = 0
    playlist_tracks_fetched: int = 0
    playlist_tracks_matched: int = 0
    playlist_tracks_no_isrc: int = 0
    playlist_tracks_not_in_catalog: int = 0
    user_tracks_upserted: int = 0
    user_tracks_is_core: int = 0

    def summary_lines(self) -> list[str]:
        return [
            f"좋아요 트랙 fetch: {self.liked_fetched} (매칭 {self.liked_matched}, "
            f"ISRC 없음 {self.liked_no_isrc}, 미존재 {self.liked_not_in_catalog})",
            f"플레이리스트 {self.playlists_fetched}개 → 트랙 {self.playlist_tracks_fetched}개 "
            f"(매칭 {self.playlist_tracks_matched})",
            f"UserTrack 적재: {self.user_tracks_upserted} (isCore=true: {self.user_tracks_is_core})",
        ]


class TidalImporter:
    def __init__(self, http: httpx.AsyncClient, access_token: str, country_code: str):
        self.http = http
        self.token = access_token
        self.country = country_code

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.token}",
            "Accept": "application/vnd.api+json",
        }

    async def _get(self, path: str, params: dict | None = None) -> dict:
        url = path if path.startswith("http") else f"{BASE_URL}{path}"
        full_params = {"countryCode": self.country, **(params or {})}
        r = await self.http.get(url, params=full_params, headers=self._headers())
        r.raise_for_status()
        return r.json()

    async def fetch_user_info(self) -> dict:
        body = await self._get("/users/me")
        flat = flatten_jsonapi(body, focus_type="users")
        if not flat:
            data = body.get("data") or {}
            attrs = data.get("attributes") or {}
            return {"id": data.get("id"), **attrs}
        return flat[0]

    async def fetch_liked_tracks(self, user_id: str) -> list[dict]:
        items: list[dict] = []
        path = f"/userCollections/{user_id}/relationships/tracks"
        cursor: str | None = None
        while True:
            params = {"include": "tracks", "locale": "en-US"}
            if cursor:
                params["page[cursor]"] = cursor
            body = await self._get(path, params=params)
            items.extend(flatten_jsonapi(body, focus_type="tracks"))
            cursor = get_next_cursor(body)
            if not cursor:
                break
        return items

    async def fetch_my_playlists(self, user_id: str) -> list[dict]:
        items: list[dict] = []
        cursor: str | None = None
        while True:
            params = {"filter[r.owners.id]": user_id}
            if cursor:
                params["page[cursor]"] = cursor
            body = await self._get("/playlists", params=params)
            items.extend(flatten_jsonapi(body, focus_type="playlists"))
            cursor = get_next_cursor(body)
            if not cursor:
                break
        return items

    async def fetch_playlist_tracks(self, playlist_id: str) -> list[dict]:
        items: list[dict] = []
        cursor: str | None = None
        while True:
            params = {"include": "items"}
            if cursor:
                params["page[cursor]"] = cursor
            body = await self._get(f"/playlists/{playlist_id}/relationships/items", params=params)
            items.extend(flatten_jsonapi(body, focus_type="tracks"))
            cursor = get_next_cursor(body)
            if not cursor:
                break
        return items
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
pytest tests/sync/test_tidal_importer.py -v
```

Expected: 4 passed

- [ ] **Step 5: Commit**

```bash
git add src/mrms/sync/tidal_importer.py tests/sync/test_tidal_importer.py
git commit -m "feat: Tidal v2 API fetch (user/likes/playlists) with pagination"
```

---

## Task 7: Import Orchestration Function

**Files:**
- Modify: `src/mrms/sync/tidal_importer.py` (add `import_all` function)
- Modify: `tests/sync/test_tidal_importer.py` (add orchestration tests)

- [ ] **Step 1: 추가 테스트 작성**

`tests/sync/test_tidal_importer.py` 끝에 추가:

```python
@pytest.mark.asyncio
async def test_import_all_matches_and_skips_appropriately(db_conn):
    """카탈로그에 있는 ISRC + 없는 ISRC + null ISRC 섞어서 정확한 통계."""
    from unittest.mock import AsyncMock
    from mrms.db.user_track import get_or_create_user, find_track_id_by_isrc
    from mrms.sync.tidal_importer import import_all

    user_id = get_or_create_user(db_conn, email="test_import@example.com")

    # 카탈로그에 있는 ISRC 하나 골라옴
    with db_conn.cursor() as cur:
        cur.execute('SELECT isrc FROM "Track" LIMIT 1')
        row = cur.fetchone()
    if row is None:
        pytest.skip("Track 비어 있음")
    real_isrc = row[0]

    http = AsyncMock()
    # 1) user info
    # 2) liked tracks (3개: 1 카탈로그 매칭, 1 미존재, 1 null isrc)
    # 3) playlists (1개)
    # 4) playlist tracks (1개, 카탈로그 매칭)
    http.get = AsyncMock(side_effect=[
        _resp({"data": {"id": "u_123", "type": "users", "attributes": {"country": "KR"}}}),
        _resp({
            "data": [
                {"id": "1", "type": "tracks", "attributes": {}},
                {"id": "2", "type": "tracks", "attributes": {}},
                {"id": "3", "type": "tracks", "attributes": {}},
            ],
            "included": [
                {"id": "1", "type": "tracks", "attributes": {"isrc": real_isrc}},
                {"id": "2", "type": "tracks", "attributes": {"isrc": "ZZZ999999999"}},
                {"id": "3", "type": "tracks", "attributes": {}},  # no isrc
            ],
            "links": {},
        }),
        _resp({
            "data": [{"id": "p1", "type": "playlists", "attributes": {"title": "Mine"}}],
            "links": {},
        }),
        _resp({
            "data": [{"id": "1", "type": "tracks", "attributes": {}}],
            "included": [{"id": "1", "type": "tracks", "attributes": {"isrc": real_isrc}}],
            "links": {},
        }),
    ])
    importer = _make_importer(http)
    stats = await import_all(db_conn, user_id, importer)

    assert stats.liked_fetched == 3
    assert stats.liked_matched == 1
    assert stats.liked_no_isrc == 1
    assert stats.liked_not_in_catalog == 1
    assert stats.playlists_fetched == 1
    assert stats.playlist_tracks_fetched == 1
    assert stats.playlist_tracks_matched == 1
    # 같은 트랙이 liked + playlist 양쪽 → UserTrack 1개, isCore=true, source='liked'
    assert stats.user_tracks_upserted == 1
    assert stats.user_tracks_is_core == 1
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
pytest tests/sync/test_tidal_importer.py::test_import_all_matches_and_skips_appropriately -v
```

Expected: `ImportError: cannot import name 'import_all'`

- [ ] **Step 3: 구현 추가**

`src/mrms/sync/tidal_importer.py` 끝에 추가:

```python
async def import_all(
    conn,
    user_id: str,
    importer: TidalImporter,
) -> ImportStats:
    """전체 import 흐름 — 좋아요 + 플레이리스트 → DB 적재.

    UserTrack은 이미 있어도 UPSERT 규칙대로 머지 (liked > playlist).
    같은 트랙이 양쪽에 있으면 stats.user_tracks_upserted는 1로 카운트.
    """
    from mrms.db.user_track import find_track_id_by_isrc, upsert_user_track

    stats = ImportStats()
    upserted_tracks: set[str] = set()

    # 사용자 정보
    user_info = await importer.fetch_user_info()
    tidal_uid = user_info.get("id")

    # 좋아요 트랙
    liked = await importer.fetch_liked_tracks(user_id=tidal_uid)
    stats.liked_fetched = len(liked)
    for t in liked:
        isrc = t.get("isrc")
        if not isrc:
            stats.liked_no_isrc += 1
            continue
        track_id = find_track_id_by_isrc(conn, isrc)
        if not track_id:
            stats.liked_not_in_catalog += 1
            continue
        upsert_user_track(
            conn, user_id, track_id,
            is_core=True, source="liked", platform="tidal",
        )
        stats.liked_matched += 1
        if track_id not in upserted_tracks:
            upserted_tracks.add(track_id)
            stats.user_tracks_upserted += 1
            stats.user_tracks_is_core += 1

    # 플레이리스트
    playlists = await importer.fetch_my_playlists(user_id=tidal_uid)
    stats.playlists_fetched = len(playlists)
    for pl in playlists:
        title = pl.get("title", "untitled")
        tracks = await importer.fetch_playlist_tracks(playlist_id=pl["id"])
        for t in tracks:
            stats.playlist_tracks_fetched += 1
            isrc = t.get("isrc")
            if not isrc:
                stats.playlist_tracks_no_isrc += 1
                continue
            track_id = find_track_id_by_isrc(conn, isrc)
            if not track_id:
                stats.playlist_tracks_not_in_catalog += 1
                continue
            upsert_user_track(
                conn, user_id, track_id,
                is_core=False, source=f"playlist:{title}", platform="tidal",
            )
            stats.playlist_tracks_matched += 1
            if track_id not in upserted_tracks:
                upserted_tracks.add(track_id)
                stats.user_tracks_upserted += 1
                # isCore는 liked로 안 들어왔으면 false 유지 — is_core 카운트 X

    return stats
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
pytest tests/sync/test_tidal_importer.py -v
```

Expected: 5 passed (또는 Track 비어있으면 1 skipped)

- [ ] **Step 5: Commit**

```bash
git add src/mrms/sync/tidal_importer.py tests/sync/test_tidal_importer.py
git commit -m "feat: orchestrate Tidal import (likes + playlists → UserTrack)"
```

---

## Task 8: CLI Orchestrator

**Files:**
- Create: `scripts/08_onboard_tidal.py`

- [ ] **Step 1: CLI 스크립트 작성**

`scripts/08_onboard_tidal.py`:

```python
"""Tidal 온보딩 CLI.

본인 Tidal 계정 OAuth + 좋아요/플레이리스트 import → UserTrack 적재.

사전 조건:
    - .env에 TIDAL_CLIENT_ID/SECRET/REDIRECT_URI/SCOPES 설정
    - Cloudflare Tunnel mrms.approid.team → localhost:8080 동작 중
    - PostgreSQL (port 5433) 실행 중 + V1 적재 완료
    - prisma/init/03_user_track.sql 적용됨

사용:
    python3 scripts/08_onboard_tidal.py --email me@example.com
"""
from __future__ import annotations

import argparse
import asyncio
import os
import secrets
import sys
import webbrowser
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

import httpx
import psycopg
from dotenv import load_dotenv
from rich.console import Console

from mrms.auth.callback_server import CallbackServer
from mrms.auth.tidal import TidalOAuthClient
from mrms.db.user_track import (
    get_or_create_user,
    get_oauth,
    upsert_oauth,
)
from mrms.sync.tidal_importer import TidalImporter, import_all

load_dotenv()
console = Console()


async def ensure_token(conn, user_id: str) -> tuple[str, str]:
    """유효한 access_token 보장. 필요시 refresh 또는 fresh OAuth.

    반환: (access_token, refresh_token)
    """
    client_id = os.environ["TIDAL_CLIENT_ID"]
    client_secret = os.environ["TIDAL_CLIENT_SECRET"]
    redirect_uri = os.environ["TIDAL_REDIRECT_URI"]
    scopes_str = os.environ.get("TIDAL_SCOPES", "user.read collection.read playlists.read")
    # A1 필수 scope만
    scopes = ["user.read", "collection.read", "playlists.read"]

    client = TidalOAuthClient(
        client_id=client_id,
        client_secret=client_secret,
        redirect_uri=redirect_uri,
        scopes=scopes,
    )

    existing = get_oauth(conn, user_id, "tidal")
    if existing and existing["expiresAt"] > datetime.now(timezone.utc) + timedelta(seconds=60):
        console.print("[green]기존 토큰 유효 — refresh 안 함[/green]")
        return existing["accessToken"], existing["refreshToken"]

    if existing:
        console.print("[yellow]토큰 만료 임박 — refresh 시도[/yellow]")
        try:
            tokens = await client.refresh_access_token(existing["refreshToken"])
        except Exception as e:
            console.print(f"[red]refresh 실패: {e}[/red] — fresh OAuth로 진행")
            tokens = None
        else:
            _persist(conn, user_id, tokens, scopes)
            return tokens["access_token"], tokens.get("refresh_token", existing["refreshToken"])

    # Fresh OAuth
    console.print("[bold]Fresh OAuth flow 시작[/bold]")
    verifier, challenge = client.generate_pkce_pair()
    state = secrets.token_urlsafe(16)
    server = CallbackServer(host="127.0.0.1", port=8080, path="/callback/tidal")
    auth_url = client.build_authorize_url(challenge, state)
    console.print(f"브라우저 열림: {auth_url[:80]}...")
    webbrowser.open(auth_url)

    # 별도 스레드에서 콜백 대기 (block)
    import threading
    received = {}
    def wait():
        try:
            received["pair"] = server.wait_for_callback(timeout=300)
        except TimeoutError:
            received["pair"] = None

    t = threading.Thread(target=wait, daemon=True)
    t.start()
    t.join()

    if not received.get("pair"):
        raise RuntimeError("OAuth 콜백 안 옴 (300초 timeout)")
    code, received_state = received["pair"]
    if received_state != state:
        raise RuntimeError(f"state 불일치: {received_state} != {state}")

    tokens = await client.exchange_code(code, verifier)
    _persist(conn, user_id, tokens, scopes)
    return tokens["access_token"], tokens["refresh_token"]


def _persist(conn, user_id: str, tokens: dict, requested_scopes: list[str]) -> None:
    expires = datetime.now(timezone.utc) + timedelta(seconds=tokens["expires_in"])
    scope_resp = tokens.get("scope", "")
    granted = scope_resp.split() if isinstance(scope_resp, str) else list(scope_resp)
    if not granted:
        granted = requested_scopes
    upsert_oauth(
        conn,
        user_id=user_id,
        platform="tidal",
        access_token=tokens["access_token"],
        refresh_token=tokens.get("refresh_token", ""),
        expires_at=expires,
        scopes=granted,
    )
    conn.commit()


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--email", required=True)
    args = parser.parse_args()

    dsn = os.environ.get("DATABASE_URL", "postgresql://mrms:mrms@localhost:5433/mrms")
    with psycopg.connect(dsn, autocommit=False) as conn:
        # 1) User
        console.print(f"[1/3] User 조회/생성: [cyan]{args.email}[/cyan]")
        user_id = get_or_create_user(conn, args.email)
        conn.commit()
        console.print(f"      user_id = {user_id}")

        # 2) OAuth
        console.print("[2/3] OAuth")
        access_token, _ = await ensure_token(conn, user_id)

        # 3) Import
        console.print("[3/3] Import 시작")
        async with httpx.AsyncClient(timeout=30.0) as http:
            importer = TidalImporter(http, access_token=access_token, country_code="KR")
            user_info = await importer.fetch_user_info()
            country = user_info.get("country", "KR")
            importer.country = country
            console.print(f"      country = {country}")
            stats = await import_all(conn, user_id, importer)
            conn.commit()

        # 요약
        console.print()
        for line in stats.summary_lines():
            console.print(f"  {line}")
        console.print("[green]✓ 완료[/green]")


if __name__ == "__main__":
    asyncio.run(main())
```

- [ ] **Step 2: import만 검증 (모든 모듈 정상 로드)**

```bash
cd "/Volumes/MacExtend 1/MRMS_FN"
source .venv/bin/activate
python3 -c "
import sys; sys.path.insert(0, 'src')
import importlib.util
spec = importlib.util.spec_from_file_location('m', 'scripts/08_onboard_tidal.py')
m = importlib.util.module_from_spec(spec)
# main 실행 안 함, import만 성공하면 OK
spec.loader.exec_module(m)
print('OK')
"
```

Expected: `OK` (또는 ImportError 시 누락 모듈 해결)

- [ ] **Step 3: Commit**

```bash
git add scripts/08_onboard_tidal.py
git commit -m "feat: Tidal onboarding CLI orchestrator"
```

---

## Task 9: 실제 Tidal 통합 검증

**Files:**
- (코드 변경 없음, 수동 실행 + Tidal API 응답 구조 검증)

이 task는 spec section 14에 명시한 "구현 시 검증 필요 사항"을 실제로 확인하는 단계.

- [ ] **Step 1: 사전 확인 — Cloudflare Tunnel 동작 중**

```bash
curl -I https://mrms.approid.team
```

Expected: `HTTP/2 200` + `server: cloudflare`

안 되면: `cloudflared tunnel run mrms` (docs/cloudflare-tunnel-setup.md 참고)

- [ ] **Step 2: 사전 확인 — Track 테이블 비어있지 않음**

```bash
docker compose exec pg psql -U mrms -d mrms -c 'SELECT COUNT(*) FROM "Track";'
```

Expected: 100k+ (V1 적재 완료 상태)

- [ ] **Step 3: 첫 실행 — 본인 이메일로**

```bash
python3 scripts/08_onboard_tidal.py --email YOUR_EMAIL_HERE
```

브라우저가 열림 → Tidal 로그인 → 권한 동의 → 콜백 → 자동 진행.

가능한 시나리오:

**시나리오 A: 잘 동작**
- 통계 출력됨, UserTrack 행 적재됨

**시나리오 B: Tidal API 엔드포인트 다름**
- `404 Not Found` 또는 빈 응답 발생
- `src/mrms/sync/tidal_importer.py`의 경로 (`/userCollections/...` 등) 조정 필요
- curl로 실제 응답 확인 후 코드 수정:
  ```bash
  curl -H "Authorization: Bearer $TOKEN" \
       "https://openapi.tidal.com/v2/users/me?countryCode=KR" | jq
  ```

**시나리오 C: 권한 부족**
- 401/403 — 요청 scope 부족 또는 Tidal dev portal 설정 확인

- [ ] **Step 4: DB 검증**

```bash
docker compose exec pg psql -U mrms -d mrms -c '
  SELECT t.title, a.name, ut."isCore", ut.source
  FROM "UserTrack" ut
  JOIN "Track" t ON t.id = ut."trackId"
  JOIN "Artist" a ON a.id = t."artistId"
  WHERE ut."userId" = (SELECT id FROM "User" WHERE email = $$YOUR_EMAIL$$)
  LIMIT 20;
'
```

Expected: 본인이 좋아요한 트랙들이 보임

- [ ] **Step 5: 멱등성 검증 — 다시 실행**

```bash
python3 scripts/08_onboard_tidal.py --email YOUR_EMAIL_HERE
```

```bash
docker compose exec pg psql -U mrms -d mrms -c '
  SELECT COUNT(*) FROM "UserTrack"
  WHERE "userId" = (SELECT id FROM "User" WHERE email = $$YOUR_EMAIL$$)
'
```

두 번 실행 후 카운트 동일하면 idempotent 정상.

- [ ] **Step 6: 발견된 차이점 spec에 반영 (필요시)**

엔드포인트/응답 구조 다른 점 있으면 `docs/superpowers/specs/2026-06-08-tidal-onboarding-design.md` section 14 업데이트.

- [ ] **Step 7: Commit (코드 수정이 있었다면)**

```bash
git add -A
git commit -m "fix: align Tidal API endpoints with actual v2 responses"
```

---

## Self-Review 결과

**Spec coverage**:
- ✅ Section 4 (Data Model UserTrack) → Task 1, 3
- ✅ Section 5 (Conflict rules) → Task 3 (test_upsert_user_track_conflict_*)
- ✅ Section 6 (OAuth Flow PKCE) → Task 4 (callback), 5 (PKCE client)
- ✅ Section 7 (Import Pipeline) → Task 6, 7
- ✅ Section 8 (Error Handling 토큰 refresh) → Task 8 (`ensure_token`)
- ✅ Section 9 (Testing) → 모든 task TDD
- ✅ Section 10 (Out of Scope) — 의도적 제외
- ✅ Section 11 (파일 변경) → 모든 task에 정확한 경로
- ✅ Section 14 (구현 시 검증 필요) → Task 9

**남은 위험**:
- Tidal v2 API 엔드포인트 정확성 (Task 9에서 확인)
- 429 rate limit 처리 (현재 코드에서 tenacity 미사용 — Task 9에서 실제 부딪히면 추가)

**Placeholders**: 없음 (모든 코드 완전)

**Type consistency**: 함수 시그니처 task 간 일관 (예: `upsert_user_track(conn, user_id, track_id, is_core, source, platform)` — Task 3 정의, Task 7에서 호출 동일)
