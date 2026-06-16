# 아티스트 소개 팝업 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 아티스트명이 노출되는 모든 페이지에서 이름 클릭 시 소개 팝업(Spotify 이미지/장르 + Gemini 소개 + 우리 풀의 그 아티스트 곡 재생)을 띄운다.

**Architecture:** 백엔드 `GET /api/artist/intro?name=` — `ArtistProfile`(nameNormalized) 캐시 우선, MISS면 Spotify app-token 아티스트 조회 + Gemini 자유텍스트 bio 생성 후 캐시; 곡은 `_fetch_track_metadata` 패턴(커버 LATERAL)으로 라이브 조회. auth-optional(공유 페이지서도 동작). 프론트는 신규 zustand `useArtistModal` store + 단일 `ArtistIntroModal`(레이아웃 마운트) + 공용 `ArtistLink`로 렌더처 교체. 곡은 `ModalTrack` shape로 맞춰 `ModalTrackList`/`PlayAllButton` 재사용(재생 공짜).

**Tech Stack:** FastAPI + raw psycopg, google-genai(Gemini), httpx+respx(Spotify), Next.js 16 app router, zustand, base-ui Dialog, pytest.

**참고 — 절대 경로:** 루트 `/Volumes/MacExtend 1/MRMS_FN`. 러너 `.venv/bin/pytest`, 린트 `.venv/bin/ruff`(line-length 100). 프론트 `web/`(`pnpm lint`, `npx tsc --noEmit`, `pnpm build`).

**⚠️ DB 격리 안 됨:** 전체 `pytest tests/` 금지 — 대상 파일만. **라이브 Gemini/Spotify 차단**: Gemini는 함수 monkeypatch, Spotify는 respx mock. Task 1에서 만든 `ArtistProfile` 테이블을 dev DB에 먼저 적용해야 이후 테스트가 돈다(아래 명시).

---

### Task 1: ArtistProfile 마이그레이션 + `db/artist_profile.py`

**Files:**
- Create: `prisma/migrations/20260616100000_add_artist_profile/migration.sql`
- Modify: `prisma/schema.prisma` (model 추가)
- Create: `src/mrms/db/artist_profile.py`
- Test: `tests/db/test_artist_profile.py`

- [ ] **Step 1: 마이그레이션 SQL 작성**

`prisma/migrations/20260616100000_add_artist_profile/migration.sql`:
```sql
-- 아티스트 소개 팝업 캐시: Gemini bio + Spotify 이미지/장르 (nameNormalized 키)
CREATE TABLE IF NOT EXISTS "ArtistProfile" (
    "nameNormalized" TEXT PRIMARY KEY,
    name             TEXT NOT NULL,
    bio              TEXT,
    "imageUrl"       TEXT,
    genres           TEXT[] NOT NULL DEFAULT '{}',
    "fetchedAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

- [ ] **Step 2: schema.prisma 모델 추가** (prisma migrate dev가 SQL과 모델을 함께 관리하는 레포 컨벤션)

`prisma/schema.prisma`의 `model Artist { ... }` 블록 바로 아래에 추가:
```prisma
model ArtistProfile {
  nameNormalized String   @id
  name           String
  bio            String?
  imageUrl       String?
  genres         String[] @default([])
  fetchedAt      DateTime @default(now())
}
```

- [ ] **Step 3: dev DB에 테이블 적용** (테스트가 돌려면 필요 — DB 격리 안 됨)

Run:
```bash
psql "${DATABASE_URL:-postgresql://mrms:mrms@localhost:5433/mrms}" -f "prisma/migrations/20260616100000_add_artist_profile/migration.sql"
```
Expected: `CREATE TABLE`.

- [ ] **Step 4: 실패하는 테스트 작성**

`tests/db/test_artist_profile.py`:
```python
"""ArtistProfile 캐시 — upsert/get."""
from mrms.db.artist_profile import get_artist_profile, upsert_artist_profile


def test_upsert_then_get_roundtrip(db_conn, cleanup):
    norm = "test artist xyz"
    cleanup('DELETE FROM "ArtistProfile" WHERE "nameNormalized" = %s', (norm,))
    upsert_artist_profile(
        db_conn, norm, "Test Artist XYZ", "두 문장 소개.",
        "https://img/x.jpg", ["jazz", "swing"],
    )
    p = get_artist_profile(db_conn, norm)
    assert p is not None
    assert p["name"] == "Test Artist XYZ"
    assert p["bio"] == "두 문장 소개."
    assert p["image_url"] == "https://img/x.jpg"
    assert p["genres"] == ["jazz", "swing"]


def test_get_missing_returns_none(db_conn):
    assert get_artist_profile(db_conn, "definitely-not-cached-zzz") is None
```

- [ ] **Step 5: 테스트 실패 확인**

Run: `.venv/bin/pytest tests/db/test_artist_profile.py -v`
Expected: FAIL — `mrms.db.artist_profile` 없음 (ImportError).

- [ ] **Step 6: `db/artist_profile.py` 구현**

`src/mrms/db/artist_profile.py`:
```python
"""ArtistProfile 캐시 DB ops — 아티스트 소개 팝업(bio/이미지/장르)."""
from __future__ import annotations

import psycopg


def get_artist_profile(conn: psycopg.Connection, name_normalized: str) -> dict | None:
    """nameNormalized로 캐시된 프로필. 없으면 None."""
    with conn.cursor() as cur:
        cur.execute(
            'SELECT "nameNormalized", name, bio, "imageUrl", genres '
            'FROM "ArtistProfile" WHERE "nameNormalized" = %s',
            (name_normalized,),
        )
        r = cur.fetchone()
    if not r:
        return None
    return {
        "name_normalized": r[0], "name": r[1], "bio": r[2],
        "image_url": r[3], "genres": list(r[4] or []),
    }


def upsert_artist_profile(
    conn: psycopg.Connection, name_normalized: str, name: str,
    bio: str | None, image_url: str | None, genres: list[str],
) -> None:
    """프로필 캐시 저장(replace). 자체 commit."""
    with conn.cursor() as cur:
        cur.execute(
            '''INSERT INTO "ArtistProfile"
                 ("nameNormalized", name, bio, "imageUrl", genres, "fetchedAt")
               VALUES (%s, %s, %s, %s, %s, NOW())
               ON CONFLICT ("nameNormalized") DO UPDATE SET
                 name = EXCLUDED.name, bio = EXCLUDED.bio,
                 "imageUrl" = EXCLUDED."imageUrl", genres = EXCLUDED.genres,
                 "fetchedAt" = NOW()''',
            (name_normalized, name, bio, image_url, genres),
        )
    conn.commit()
```

- [ ] **Step 7: 테스트 통과 확인 + lint**

Run: `.venv/bin/pytest tests/db/test_artist_profile.py -v` → PASS (2개).
Run: `.venv/bin/ruff check src/mrms/db/artist_profile.py tests/db/test_artist_profile.py` → 신규 위반 없음.

- [ ] **Step 8: Commit**
```bash
git add prisma/migrations/20260616100000_add_artist_profile/migration.sql prisma/schema.prisma src/mrms/db/artist_profile.py tests/db/test_artist_profile.py
git commit -m "feat(artist): ArtistProfile 캐시 테이블 + db 헬퍼"
```

---

### Task 2: 아티스트 곡 쿼리 + Gemini bio + Spotify 조회 헬퍼

**Files:**
- Create: `src/mrms/db/artist.py` (아티스트 곡 쿼리)
- Create: `src/mrms/recsys/artist_bio.py` (Gemini 자유텍스트 bio)
- Create: `src/mrms/search/spotify_artist.py` (Spotify app-token 아티스트 조회)
- Test: `tests/db/test_artist_tracks.py`, `tests/search/test_spotify_artist.py`

- [ ] **Step 1: 실패 테스트 — 아티스트 곡 쿼리**

`tests/db/test_artist_tracks.py`:
```python
"""아티스트 곡 조회 — ModalTrack shape + 커버/플랫폼."""
import uuid as _uuid

from mrms.db.artist import artist_tracks_by_name
from mrms.db.user_track import get_or_create_user
from mrms.emp.base import upsert_track_and_emp_source


def test_artist_tracks_by_name_shape(db_conn, cleanup):
    artist = f"Cov Artist {_uuid.uuid4().hex[:6]}"
    r = upsert_track_and_emp_source(
        db_conn, isrc=None, title="A Song", artist=artist,
        album_title="Alb", duration_ms=180000, platform="youtube",
        platform_track_id="YTART1", source_type="station",
        source_id="station:art", source_name="S",
        cover_url="https://c/x.jpg",
    )
    tid = r["track_id"]
    db_conn.commit()
    cleanup('DELETE FROM "EMPSource" WHERE source_id = %s', ("station:art",))
    cleanup('DELETE FROM "TrackPlatform" WHERE "trackId" = %s', (tid,))
    cleanup('DELETE FROM "Track" WHERE id = %s', (tid,))
    cleanup('DELETE FROM "Artist" WHERE "nameNormalized" = %s', (artist.lower().strip(),))

    out = artist_tracks_by_name(db_conn, artist.lower().strip())
    rows = [t for t in out if t["track_id"] == tid]
    assert len(rows) == 1
    t = rows[0]
    assert t["artist"] == artist and t["title"] == "A Song"
    assert t["youtube_track_id"] == "YTART1"
    assert t["album_cover"] == "https://c/x.jpg"
    # ModalTrack 필수 키
    for k in ("tidal_track_id", "spotify_track_id", "duration_ms"):
        assert k in t


def test_artist_tracks_liked_pct_when_user(db_conn, cleanup):
    artist = f"Liked Artist {_uuid.uuid4().hex[:6]}"
    uid = get_or_create_user(db_conn, f"al-{_uuid.uuid4().hex[:8]}@t.com")
    r = upsert_track_and_emp_source(
        db_conn, isrc=None, title="Liked Song", artist=artist,
        album_title=None, duration_ms=1, platform="youtube",
        platform_track_id="YTLIKED", source_type="station",
        source_id="station:liked", source_name="S",
    )
    tid = r["track_id"]
    with db_conn.cursor() as cur:
        cur.execute(
            'INSERT INTO "UserTrack" (id,"userId","trackId","isCore",source,platform) '
            'VALUES (%s,%s,%s,TRUE,%s,%s) ON CONFLICT DO NOTHING',
            ("ut_" + _uuid.uuid4().hex[:12], uid, tid, "liked", "youtube"),
        )
    db_conn.commit()
    cleanup('DELETE FROM "EMPSource" WHERE source_id = %s', ("station:liked",))
    cleanup('DELETE FROM "TrackPlatform" WHERE "trackId" = %s', (tid,))
    cleanup('DELETE FROM "UserTrack" WHERE "userId" = %s', (uid,))
    cleanup('DELETE FROM "Track" WHERE id = %s', (tid,))
    cleanup('DELETE FROM "Artist" WHERE "nameNormalized" = %s', (artist.lower().strip(),))

    out = artist_tracks_by_name(db_conn, artist.lower().strip(), user_id=uid)
    t = next(x for x in out if x["track_id"] == tid)
    assert t["liked"] is True and t["pct"] is True
```

- [ ] **Step 2: 실패 확인**

Run: `.venv/bin/pytest tests/db/test_artist_tracks.py -v` → FAIL (`mrms.db.artist` 없음).

- [ ] **Step 3: `db/artist.py` 구현** (`_fetch_track_metadata` 패턴 + nameNormalized 필터)

`src/mrms/db/artist.py`:
```python
"""아티스트 단위 곡 조회 — 소개 팝업의 '그 아티스트 곡(재생 가능)'."""
from __future__ import annotations

import psycopg


def artist_tracks_by_name(
    conn: psycopg.Connection, name_normalized: str, *,
    user_id: str | None = None, limit: int = 30,
) -> list[dict]:
    """nameNormalized 아티스트의 곡 — ModalTrack shape(커버/플랫폼ID/duration).

    같은 곡(_song_key) dedup. user_id 있으면 liked/pct 부여."""
    from mrms.recsys.taste_mood import _song_key  # 함수-로컬: 순환 import 회피

    with conn.cursor() as cur:
        cur.execute(
            '''SELECT t.id, t.title, ar.name, t."albumId", alb.title,
                      tp_t."platformTrackId", tp_s."platformTrackId",
                      tp_y."platformTrackId", t."durationMs", ec.cover_url
               FROM "Track" t
               JOIN "Artist" ar ON ar.id = t."artistId"
               LEFT JOIN "Album" alb ON alb.id = t."albumId"
               LEFT JOIN "TrackPlatform" tp_t
                 ON tp_t."trackId" = t.id AND tp_t.platform = 'tidal'
               LEFT JOIN "TrackPlatform" tp_s
                 ON tp_s."trackId" = t.id AND tp_s.platform = 'spotify'
               LEFT JOIN "TrackPlatform" tp_y
                 ON tp_y."trackId" = t.id AND tp_y.platform = 'youtube'
                 AND tp_y."platformTrackId" NOT LIKE 'yt\\_%%' ESCAPE '\\'
               LEFT JOIN LATERAL (
                 SELECT cover_url FROM "EMPSource"
                 WHERE "trackId" = t.id AND cover_url IS NOT NULL LIMIT 1
               ) ec ON TRUE
               WHERE ar."nameNormalized" = %s
               ORDER BY t.title
               LIMIT %s''',
            (name_normalized, limit),
        )
        rows = cur.fetchall()

    out: list[dict] = []
    seen: set[str] = set()
    track_ids: list[str] = []
    for r in rows:
        sk = _song_key(r[2], r[1])
        if sk in seen:
            continue
        seen.add(sk)
        track_ids.append(r[0])
        out.append({
            "track_id": r[0], "title": r[1], "artist": r[2], "album_id": r[3],
            "album_title": r[4], "tidal_track_id": r[5], "spotify_track_id": r[6],
            "youtube_track_id": r[7], "duration_ms": r[8], "album_cover": r[9],
            "liked": False, "pct": False,
        })

    if user_id and track_ids:
        with conn.cursor() as cur:
            cur.execute(
                '''SELECT "trackId", source, "isCore" FROM "UserTrack"
                   WHERE "userId" = %s AND "trackId" = ANY(%s)''',
                (user_id, track_ids),
            )
            state = {row[0]: (row[1] == "liked", bool(row[2])) for row in cur.fetchall()}
        for t in out:
            liked, pct = state.get(t["track_id"], (False, False))
            t["liked"], t["pct"] = liked, pct
    return out
```

- [ ] **Step 4: 통과 확인**

Run: `.venv/bin/pytest tests/db/test_artist_tracks.py -v` → PASS (2개).

- [ ] **Step 5: 실패 테스트 — Spotify 아티스트 조회**

`tests/search/test_spotify_artist.py`:
```python
from __future__ import annotations

import httpx
import respx

from mrms.search.spotify_artist import fetch_spotify_artist


@respx.mock
async def test_fetch_spotify_artist_200():
    respx.post("https://accounts.spotify.com/api/token").mock(
        return_value=httpx.Response(200, json={"access_token": "T"}))
    respx.get(url__startswith="https://api.spotify.com/v1/search").mock(
        return_value=httpx.Response(200, json={"artists": {"items": [
            {"name": "Frank Sinatra", "genres": ["jazz", "swing"],
             "images": [{"url": "https://img/fs.jpg"}]}]}}))
    async with httpx.AsyncClient() as h:
        image, genres = await fetch_spotify_artist(h, "Frank Sinatra")
    assert image == "https://img/fs.jpg" and genres == ["jazz", "swing"]


@respx.mock
async def test_fetch_spotify_artist_no_match():
    respx.post("https://accounts.spotify.com/api/token").mock(
        return_value=httpx.Response(200, json={"access_token": "T"}))
    respx.get(url__startswith="https://api.spotify.com/v1/search").mock(
        return_value=httpx.Response(200, json={"artists": {"items": []}}))
    async with httpx.AsyncClient() as h:
        image, genres = await fetch_spotify_artist(h, "Nobody")
    assert image is None and genres == []
```

- [ ] **Step 6: 실패 확인 → 구현 — `search/spotify_artist.py`**

Run: `.venv/bin/pytest tests/search/test_spotify_artist.py -v` → FAIL (모듈 없음).

`src/mrms/search/spotify_artist.py`:
```python
"""Spotify 아티스트 조회 — app 토큰(client_credentials)으로 이미지/장르. best-effort."""
from __future__ import annotations

import logging

import httpx

from mrms.search.app_token import get_app_token

log = logging.getLogger(__name__)

SPOTIFY_SEARCH_URL = "https://api.spotify.com/v1/search"


async def fetch_spotify_artist(
    http: httpx.AsyncClient, name: str
) -> tuple[str | None, list[str]]:
    """이름으로 Spotify 아티스트 검색 → (image_url, genres). 실패/무매칭 → (None, [])."""
    try:
        tok = await get_app_token(http, "spotify")
        r = await http.get(
            SPOTIFY_SEARCH_URL,
            params={"q": name, "type": "artist", "limit": 1},
            headers={"Authorization": f"Bearer {tok}"},
        )
        if r.status_code != 200:
            log.warning("spotify artist %s: %s", name, r.status_code)
            return None, []
        items = ((r.json().get("artists") or {}).get("items")) or []
        if not items:
            return None, []
        a = items[0]
        imgs = a.get("images") or []
        image = imgs[0].get("url") if imgs else None
        return image, list(a.get("genres") or [])
    except Exception as e:  # noqa: BLE001 — best-effort
        log.warning("spotify artist fetch failed for %s: %r", name, e)
        return None, []
```

- [ ] **Step 7: 통과 확인**

Run: `.venv/bin/pytest tests/search/test_spotify_artist.py -v` → PASS (2개).

- [ ] **Step 8: `recsys/artist_bio.py` 구현** (Gemini 자유텍스트 — discover `_client` 패턴, schema 없음)

(단위테스트는 fake client 주입으로 — 아래 코드에 `client` 파라미터 둠. 별도 테스트 파일 없이 Task 3 엔드포인트 테스트에서 monkeypatch로 커버.)

`src/mrms/recsys/artist_bio.py`:
```python
"""아티스트 소개 텍스트 생성 — Gemini 자유텍스트(스키마 없음). best-effort."""
from __future__ import annotations

import logging

from google import genai
from google.genai import types

from mrms.config import settings

log = logging.getLogger(__name__)

_ARTIST_BIO_PROMPT = (
    "너는 음악 칼럼니스트다. 주어진 아티스트를 한국어로 2-3문장 소개한다. "
    "장르·활동·대표적 특징 중심으로 간결하게. 모르면 장르 기반으로 일반적이되 사실만. "
    "과장·허구·확인 안 된 디테일 금지. 인삿말/메타설명 없이 소개 본문만."
)


def _client() -> genai.Client:
    return genai.Client(api_key=settings.gemini_api_key)


def gemini_artist_bio(
    name: str, genres: list[str], *, client: genai.Client | None = None
) -> str | None:
    """아티스트명+장르 → 2-3문장 소개. 키 없음/실패 → None(호출부 삼킴)."""
    if client is None and not settings.gemini_api_key:
        return None
    client = client or _client()
    prompt = (
        f"아티스트: {name}\n"
        f"장르: {', '.join(genres) or '미상'}\n"
        "이 아티스트를 2-3문장으로 소개해줘."
    )
    try:
        resp = client.models.generate_content(
            model=settings.gemini_model,
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=_ARTIST_BIO_PROMPT,
                max_output_tokens=512,
                thinking_config=types.ThinkingConfig(thinking_budget=0),
            ),
        )
    except Exception as e:  # noqa: BLE001 — best-effort
        log.warning("artist bio gemini failed for %s: %r", name, e)
        return None
    txt = (resp.text or "").strip()
    return txt or None
```

- [ ] **Step 9: lint + Commit**

Run: `.venv/bin/ruff check src/mrms/db/artist.py src/mrms/search/spotify_artist.py src/mrms/recsys/artist_bio.py tests/db/test_artist_tracks.py tests/search/test_spotify_artist.py` → 신규 위반 없음.
```bash
git add src/mrms/db/artist.py src/mrms/search/spotify_artist.py src/mrms/recsys/artist_bio.py tests/db/test_artist_tracks.py tests/search/test_spotify_artist.py
git commit -m "feat(artist): 아티스트 곡 쿼리 + Spotify 아티스트 조회 + Gemini bio 헬퍼"
```

---

### Task 3: `get_current_user_id_optional` + `GET /api/artist/intro` + 라우터 등록

**Files:**
- Modify: `src/mrms/api/deps.py` (optional 인증 헬퍼)
- Create: `src/mrms/api/artist.py` (라우터 + 엔드포인트)
- Modify: `src/mrms/api/main.py` (라우터 등록 2줄)
- Test: `tests/api/test_artist_intro.py`

- [ ] **Step 1: `deps.get_current_user_id_optional` 추가** (`get_current_user_id` 복제하되 raise 대신 None)

`src/mrms/api/deps.py`의 `get_current_user_id` 정의 바로 아래에 추가:
```python
def get_current_user_id_optional(
    request: Request,
    conn: psycopg.Connection = Depends(db_conn),
) -> str | None:
    """세션 있으면 user_id, 없거나 무효/만료면 None (raise 안 함). 공개+개인화 겸용."""
    session_id = request.cookies.get("mrms_session")
    if not session_id:
        return None
    with conn.cursor() as cur:
        cur.execute(
            'SELECT "userId", "expiresAt" FROM "AuthSession" WHERE id = %s',
            (session_id,),
        )
        row = cur.fetchone()
    if not row:
        return None
    user_id, expires_at = row
    if expires_at is not None:
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at < datetime.now(timezone.utc):
            return None
    return user_id
```
(파일 상단에 `datetime`/`timezone`/`Request`가 이미 import됨 — `get_current_user_id`가 쓰므로 확인만.)

- [ ] **Step 2: 실패하는 엔드포인트 테스트 작성**

`tests/api/test_artist_intro.py`:
```python
"""아티스트 소개 팝업 엔드포인트 — 캐시/외부조회/곡/auth-optional."""
import uuid as _uuid

import httpx
import respx
from fastapi.testclient import TestClient

import mrms.api.artist as _artist_mod
from mrms.api.main import app
from mrms.db.artist_profile import upsert_artist_profile

client = TestClient(app)


def test_intro_cache_hit_no_external(db_conn, cleanup, monkeypatch):
    """캐시된 프로필이면 Spotify/Gemini 호출 없이 반환."""
    name = f"Cached Artist {_uuid.uuid4().hex[:6]}"
    norm = name.lower().strip()
    cleanup('DELETE FROM "ArtistProfile" WHERE "nameNormalized" = %s', (norm,))
    upsert_artist_profile(db_conn, norm, name, "캐시된 소개.", "https://c/a.jpg", ["pop"])
    db_conn.commit()
    # 외부 호출되면 실패하도록: gemini 함수가 불리면 예외
    monkeypatch.setattr(_artist_mod, "gemini_artist_bio",
                        lambda *a, **k: (_ for _ in ()).throw(AssertionError("called")))
    r = client.get(f"/api/artist/intro?name={name}")
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["bio"] == "캐시된 소개." and d["image"] == "https://c/a.jpg"
    assert d["genres"] == ["pop"] and "tracks" in d


@respx.mock
def test_intro_miss_fetches_and_caches(db_conn, cleanup, monkeypatch):
    name = f"Fresh Artist {_uuid.uuid4().hex[:6]}"
    norm = name.lower().strip()
    cleanup('DELETE FROM "ArtistProfile" WHERE "nameNormalized" = %s', (norm,))
    respx.post("https://accounts.spotify.com/api/token").mock(
        return_value=httpx.Response(200, json={"access_token": "T"}))
    respx.get(url__startswith="https://api.spotify.com/v1/search").mock(
        return_value=httpx.Response(200, json={"artists": {"items": [
            {"name": name, "genres": ["rock"], "images": [{"url": "https://i/r.jpg"}]}]}}))
    monkeypatch.setattr(_artist_mod, "gemini_artist_bio", lambda n, g, **k: "생성된 소개.")
    r = client.get(f"/api/artist/intro?name={name}")
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["bio"] == "생성된 소개." and d["image"] == "https://i/r.jpg"
    assert d["genres"] == ["rock"]
    # 캐시 저장 확인
    with db_conn.cursor() as cur:
        cur.execute('SELECT bio FROM "ArtistProfile" WHERE "nameNormalized"=%s', (norm,))
        assert cur.fetchone()[0] == "생성된 소개."


def test_intro_empty_name_400():
    r = client.get("/api/artist/intro?name=")
    assert r.status_code == 400


def test_intro_works_without_auth(db_conn, cleanup, monkeypatch):
    """무인증(쿠키 없음)에서도 200 — 공유 페이지 지원."""
    name = f"Public Artist {_uuid.uuid4().hex[:6]}"
    norm = name.lower().strip()
    cleanup('DELETE FROM "ArtistProfile" WHERE "nameNormalized" = %s', (norm,))
    upsert_artist_profile(db_conn, norm, name, "공개 소개.", None, [])
    db_conn.commit()
    monkeypatch.setattr(_artist_mod, "gemini_artist_bio", lambda *a, **k: None)
    client.cookies.clear()
    r = client.get(f"/api/artist/intro?name={name}")
    assert r.status_code == 200, r.text
    assert r.json()["bio"] == "공개 소개."
```

- [ ] **Step 3: 실패 확인**

Run: `.venv/bin/pytest tests/api/test_artist_intro.py -v` → FAIL (`mrms.api.artist` 없음 / 라우트 404).

- [ ] **Step 4: `api/artist.py` 구현**

`src/mrms/api/artist.py`:
```python
"""아티스트 소개 팝업 API — 캐시 우선, MISS 시 Spotify+Gemini, 곡은 라이브."""
from __future__ import annotations

import httpx
import psycopg
from fastapi import APIRouter, Depends, HTTPException

from mrms.api.deps import db_conn, get_current_user_id_optional
from mrms.db.artist import artist_tracks_by_name
from mrms.db.artist_profile import get_artist_profile, upsert_artist_profile
from mrms.recsys.artist_bio import gemini_artist_bio
from mrms.search.spotify_artist import fetch_spotify_artist

router = APIRouter(prefix="/api/artist", tags=["artist"])


@router.get("/intro")
async def artist_intro(
    name: str,
    user_id: str | None = Depends(get_current_user_id_optional),
    conn: psycopg.Connection = Depends(db_conn),
):
    """아티스트 소개(이미지/장르/bio) + 우리 풀의 그 아티스트 곡. auth-optional."""
    norm = (name or "").strip().lower()
    if not norm:
        raise HTTPException(400, "name required")

    prof = get_artist_profile(conn, norm)
    if prof is None:
        async with httpx.AsyncClient(timeout=10.0) as http:
            image, genres = await fetch_spotify_artist(http, name)
        bio = gemini_artist_bio(name, genres)
        if bio is not None or image is not None:
            upsert_artist_profile(conn, norm, name, bio, image, genres)
        prof = {"name": name, "bio": bio, "image_url": image, "genres": genres}

    tracks = artist_tracks_by_name(conn, norm, user_id=user_id)
    return {
        "name": prof["name"], "image": prof.get("image_url"),
        "genres": prof.get("genres") or [], "bio": prof.get("bio"),
        "tracks": tracks,
    }
```

- [ ] **Step 5: `main.py` 라우터 등록** (2줄 — import + include, alias 필수)

`src/mrms/api/main.py`의 import 블록(알파벳상 `artwork`/`albums` 부근)에 추가:
```python
from mrms.api.artist import router as artist_router
```
include 블록(다른 `app.include_router(...)` 옆)에 추가:
```python
app.include_router(artist_router)
```

- [ ] **Step 6: 통과 확인 + lint**

Run: `.venv/bin/pytest tests/api/test_artist_intro.py -v` → PASS (4개).
Run: `.venv/bin/ruff check src/mrms/api/artist.py src/mrms/api/deps.py tests/api/test_artist_intro.py` → 신규 위반 없음(엔드포인트 Depends-in-default B008은 파일 전반 사전존재 패턴과 동일이면 OK).

- [ ] **Step 7: Commit**
```bash
git add src/mrms/api/deps.py src/mrms/api/artist.py src/mrms/api/main.py tests/api/test_artist_intro.py
git commit -m "feat(artist): GET /api/artist/intro (캐시+Spotify+Gemini+곡, auth-optional) + 라우터"
```

---

### Task 4: 프론트 — store + ArtistIntroModal + ArtistLink + api 클라 + 마운트

**Files:**
- Create: `web/src/store/artist-modal.ts`
- Create: `web/src/lib/api/artists.ts`
- Create: `web/src/components/artist/ArtistLink.tsx`
- Create: `web/src/components/artist/ArtistIntroModal.tsx`
- Modify: `web/src/app/(dashboard)/layout.tsx` (모달 마운트)

- [ ] **Step 1: zustand store** `web/src/store/artist-modal.ts` (player.ts 시그니처 본뜸)
```ts
import { create } from "zustand";

interface ArtistModalState {
  name: string | null;
  open: (name: string) => void;
  close: () => void;
}

export const useArtistModal = create<ArtistModalState>((set) => ({
  name: null,
  open: (name) => set({ name }),
  close: () => set({ name: null }),
}));
```

- [ ] **Step 2: api 클라** `web/src/lib/api/artists.ts`
```ts
import type { ModalTrack } from "@/components/track/ModalTrackList";

import { apiFetch } from "./http";

export interface ArtistIntro {
  name: string;
  image: string | null;
  genres: string[];
  bio: string | null;
  tracks: ModalTrack[];
}

export async function fetchArtistIntro(name: string): Promise<ArtistIntro> {
  const r = await apiFetch(
    `/api/artist/intro?name=${encodeURIComponent(name)}`,
    {},
    "artist intro",
  );
  return (await r.json()) as ArtistIntro;
}
```

- [ ] **Step 3: ArtistLink** `web/src/components/artist/ArtistLink.tsx`
```tsx
"use client";

import { useArtistModal } from "@/store/artist-modal";

export function ArtistLink({
  name,
  className = "",
}: {
  name: string;
  className?: string;
}) {
  const open = useArtistModal((s) => s.open);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        open(name);
      }}
      className={`bg-transparent border-0 p-0 text-inherit text-left cursor-pointer hover:text-(--mrms-rust) hover:underline ${className}`}
    >
      {name}
    </button>
  );
}
```
(`e.stopPropagation()` — 클릭 가능한 행/카드 안에서 아티스트 클릭이 행의 재생/오픈을 트리거하지 않게.)

- [ ] **Step 4: ArtistIntroModal** `web/src/components/artist/ArtistIntroModal.tsx` (AlbumDetailModal 톤)
```tsx
"use client";

import { useEffect, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ModalTrackList, PlayAllButton } from "@/components/track/ModalTrackList";
import { fetchArtistIntro, type ArtistIntro } from "@/lib/api/artists";
import { useArtistModal } from "@/store/artist-modal";


export function ArtistIntroModal() {
  const name = useArtistModal((s) => s.name);
  const close = useArtistModal((s) => s.close);
  const [data, setData] = useState<ArtistIntro | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!name) {
      setData(null);
      return;
    }
    let mounted = true;
    setLoading(true);
    fetchArtistIntro(name)
      .then((d) => mounted && setData(d))
      .catch(() => mounted && setData(null))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [name]);

  const empty =
    !loading && data && !data.bio && !data.image && (data.tracks?.length ?? 0) === 0;

  return (
    <Dialog open={!!name} onOpenChange={(o) => !o && close()}>
      <DialogContent className="bg-(--mrms-paper) border-(--mrms-ink) sm:max-w-[720px] max-h-[82vh] overflow-hidden flex flex-col">
        <DialogHeader className="pr-8">
          <div className="flex gap-4 items-start">
            {data?.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={data.image}
                alt=""
                className="size-20 object-cover border border-(--mrms-rule) shrink-0"
              />
            )}
            <div className="min-w-0">
              <div className="font-mono text-[10px] tracking-editorial uppercase text-(--mrms-ink-mute)">
                Artist
              </div>
              <DialogTitle className="font-display font-bold text-(--mrms-ink) text-[22px] md:text-[26px] leading-[1.1] mt-1 truncate">
                {name ?? "—"}
              </DialogTitle>
              {data?.genres?.length ? (
                <div className="mt-1 font-mono text-[10px] tracking-editorial uppercase text-(--mrms-ink-soft) truncate">
                  {data.genres.slice(0, 4).join(" · ")}
                </div>
              ) : null}
            </div>
          </div>
        </DialogHeader>
        <div className="overflow-y-auto -mx-6 px-6">
          {loading && (
            <div className="py-8 text-center font-mono text-[11px] tracking-editorial uppercase text-(--mrms-ink-mute)">
              Loading…
            </div>
          )}
          {!loading && data?.bio && (
            <p className="text-[14px] text-(--mrms-ink-soft) leading-relaxed mb-4">
              {data.bio}
            </p>
          )}
          {!loading && (data?.tracks?.length ?? 0) > 0 && (
            <>
              <div className="flex items-center justify-between mb-2 pb-2 border-b border-(--mrms-ink)">
                <span className="font-mono text-[10px] tracking-editorial uppercase text-(--mrms-ink-mute)">
                  Tracks — {data!.tracks.length}
                </span>
                <PlayAllButton tracks={data!.tracks} />
              </div>
              <ModalTrackList tracks={data!.tracks} />
            </>
          )}
          {empty && (
            <div className="py-8 text-center font-mono text-[11px] tracking-editorial uppercase text-(--mrms-ink-mute)">
              이 아티스트 정보가 아직 없어요
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 5: 대시보드 레이아웃에 단일 모달 마운트** `web/src/app/(dashboard)/layout.tsx`

import 추가:
```tsx
import { ArtistIntroModal } from "@/components/artist/ArtistIntroModal";
```
`<PlayerBar />` 바로 아래(또는 옆)에 한 줄 추가:
```tsx
      <PlayerBar />
      <ArtistIntroModal />
```

- [ ] **Step 6: 타입체크 + 빌드**

```bash
cd "/Volumes/MacExtend 1/MRMS_FN/web" && npx tsc --noEmit -p tsconfig.json
```
Expected: 에러 없음.
```bash
cd "/Volumes/MacExtend 1/MRMS_FN/web" && pnpm lint 2>&1 | grep -E "ArtistLink|ArtistIntroModal|artist-modal|api/artists" | grep -iv canonical || echo "NO NON-CANONICAL FINDINGS"
```
Expected: `NO NON-CANONICAL FINDINGS`(또는 사전존재 canonical 경고만).
```bash
cd "/Volumes/MacExtend 1/MRMS_FN/web" && pnpm build 2>&1 | grep -E "Compiled successfully|Failed|Error:" | head -1
```
Expected: `Compiled successfully`.

- [ ] **Step 7: Commit**
```bash
cd "/Volumes/MacExtend 1/MRMS_FN"
git add web/src/store/artist-modal.ts web/src/lib/api/artists.ts web/src/components/artist/ArtistLink.tsx web/src/components/artist/ArtistIntroModal.tsx "web/src/app/(dashboard)/layout.tsx"
git commit -m "feat(artist): ArtistLink + ArtistIntroModal + useArtistModal store + 레이아웃 마운트"
```

---

### Task 5: 아티스트명 렌더처를 `<ArtistLink>`로 교체 (모든 페이지)

**Files (모두 Modify):**
- `web/src/components/track/ModalTrackList.tsx` (공용 — 검색/모달/공유 다수 커버)
- `web/src/components/mrms/MrtDashboard.tsx` (로컬 TrackRow)
- `web/src/components/mrms/PgtLibrary.tsx` (로컬 TrackList)
- `web/src/components/emp/TrackSectionRow.tsx`, `web/src/components/emp/TrackListSection.tsx`

각 파일 상단에 `import { ArtistLink } from "@/components/artist/ArtistLink";` 추가 후 아래 교체.

- [ ] **Step 1: ModalTrackList — 모바일 + 데스크탑 아티스트 출력 (공용, 가장 넓은 커버리지)**

모바일 블록(L202-208 부근) `{track.artist}` → `<ArtistLink name={track.artist} />`:
```tsx
        <div
          className="sm:hidden text-[11px] text-(--mrms-ink-soft) truncate mt-0.5"
          title={`${track.artist}${track.album_title ? ` — ${track.album_title}` : ""}`}
        >
          <ArtistLink name={track.artist} />
          {track.album_title ? ` — ${track.album_title}` : ""}
        </div>
```
데스크탑 블록(L210-215 부근):
```tsx
      <div
        className="hidden sm:block min-w-0 text-[12px] text-(--mrms-ink-soft) truncate"
        title={track.artist}
      >
        <ArtistLink name={track.artist} />
      </div>
```

- [ ] **Step 2: MrtDashboard TrackRow (L549-553 부근)**
```tsx
        <div
          className="text-xs text-[var(--mrms-ink-soft)] mt-0.5 truncate"
          title={`${track.artist}${track.album_title ? ` — ${track.album_title}` : ""}`}
        >
          <ArtistLink name={track.artist} />
```
(이어지는 `{track.album_title && ...}` 부분은 그대로 둔다.)

- [ ] **Step 3: PgtLibrary TrackList (L133-144 부근)**
```tsx
        <div
          className="text-xs text-[var(--mrms-ink-soft)] mt-0.5 truncate"
          title={`${track.artist}${track.album_title ? ` — ${track.album_title}` : ""}`}
        >
          <ArtistLink name={track.artist} />
          {track.album_title && (
            <>
              {" — "}
              <cite className="font-display italic">{track.album_title}</cite>
            </>
          )}
        </div>
```

- [ ] **Step 4: EMP TrackSectionRow (L234-239 부근)**
```tsx
      <div className="font-mono text-[10px] text-(--mrms-ink-mute) truncate" title={track.artist}>
        <ArtistLink name={track.artist} />
        {track.duration_ms != null && (
          <span className="text-(--mrms-ink-mute)"> · {formatDuration(track.duration_ms)}</span>
        )}
      </div>
```

- [ ] **Step 5: EMP TrackListSection (L127-132 부근)**
```tsx
                    <div
                      className="font-mono text-[11px] text-(--mrms-ink-soft) truncate mt-0.5"
                      title={t.artist}
                    >
                      <ArtistLink name={t.artist} />
                    </div>
```

- [ ] **Step 6: 타입체크 + lint + 빌드**

```bash
cd "/Volumes/MacExtend 1/MRMS_FN/web" && npx tsc --noEmit -p tsconfig.json
```
Expected: 에러 없음.
```bash
cd "/Volumes/MacExtend 1/MRMS_FN/web" && pnpm build 2>&1 | grep -E "Compiled successfully|Failed|Error:" | head -1
```
Expected: `Compiled successfully`.

> 수동 검증(빌드 후): MRT/검색/PGT/EMP에서 아티스트명 클릭 → 모달에 이미지/장르/소개 + 그 아티스트 곡 + Play All 동작. 행 안에서 아티스트 클릭 시 행 재생이 트리거되지 않음(stopPropagation).

- [ ] **Step 7: Commit**
```bash
cd "/Volumes/MacExtend 1/MRMS_FN"
git add web/src/components/track/ModalTrackList.tsx web/src/components/mrms/MrtDashboard.tsx web/src/components/mrms/PgtLibrary.tsx web/src/components/emp/TrackSectionRow.tsx web/src/components/emp/TrackListSection.tsx
git commit -m "feat(artist): 아티스트명 렌더처를 ArtistLink로 교체 (MRT/검색/PGT/EMP)"
```

---

## 수동 검증 (전체 완료 후, dev/prod)

1. MRT 추천 리스트에서 아티스트명 클릭 → 모달: Spotify 이미지·장르 + Gemini 소개 + 그 아티스트 곡(재생 가능, Play All).
2. 검색/공유(ModalTrackList) 트랙의 아티스트명 클릭 → 동일 모달.
3. 미연결/무인증(공유 페이지)에서도 소개·곡 뜸(liked/pct만 없음).
4. 캐시: 같은 아티스트 두 번째 오픈은 즉시(Spotify/Gemini 재호출 없음 — `ArtistProfile`).
5. 무명/무매칭 아티스트: 이미지·소개 없으면 곡만, 곡도 없으면 "정보 없어요".

---

## Self-Review (작성자 체크 결과)

**Spec coverage:** 하이브리드 소스(Gemini bio + Spotify 이미지/장르, Task 2·3) / 모든 페이지 트리거(ArtistLink, Task 5) / 소개+곡 재생(ModalTrackList, Task 4) / ArtistProfile 캐시(Task 1) / auth-optional 공유페이지(Task 3) / 곡 LATERAL 커버(Task 2) 전부 매핑.

**Placeholder scan:** 모든 스텝 실제 코드·명령·기대출력. 마이그레이션 prod 적용은 deploy.sh `apply_pending_migrations` 자동(디렉토리 커밋만) — 별도 액션 없음. 그 외 placeholder 없음.

**Type consistency:** 백엔드 곡 dict 키(track_id/title/artist/album_id/album_title/album_cover/tidal_track_id/spotify_track_id/youtube_track_id/duration_ms/liked/pct) ↔ 프론트 `ModalTrack` 필수 필드(track_id/title/artist/tidal_track_id/spotify_track_id, 나머지 optional) 일치 → 캐스팅 없이 `ModalTrackList`에 흘러감. 엔드포인트 응답 `{name,image,genres,bio,tracks}` ↔ `ArtistIntro` ↔ 테스트 단언 일치. `get_artist_profile` 반환 `image_url`/`genres` ↔ 엔드포인트 `prof.get("image_url")` 일치. `gemini_artist_bio(name, genres)` 시그니처 ↔ 엔드포인트 호출·테스트 monkeypatch(`lambda n, g, **k`) 일치. `fetch_spotify_artist(http, name) -> (image, genres)` ↔ 엔드포인트 언패킹 일치.
