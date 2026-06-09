# Sub-project I: MRT 화면 + 공통 트랙 인터랙션 + Player 확장 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** MRT 페이지를 dashboard 레이아웃으로 리팩토링하고, 트랙 리스트 인터랙션(♥/✨/▶/multi-select→playlist)을 공통 컴포넌트화하며, Player에 셔플/반복/좋아요/취향저격/앨범사진/음질을 추가한다.

**Architecture:** 백엔드: Playlist 신규 테이블 + 토글성 like/pct + playlist CRUD 엔드포인트. 프론트: 공통 TrackListRow + 모달들. Player: store state + 신규 컴포넌트 분리.

**Tech Stack:** FastAPI + psycopg + raw SQL, Next.js 16 + React 19 + Zustand + shadcn/ui + lucide-react + Tailwind v4.

**Spec:** [docs/superpowers/specs/2026-06-09-mrt-screen-design.md](../specs/2026-06-09-mrt-screen-design.md)

---

## 파일 구조

```
[Backend]
prisma/migrations/20260609xxxxxx_add_playlist/migration.sql   # NEW
src/mrms/db/playlist.py                                       # NEW — Playlist DB 헬퍼
src/mrms/api/user_tracks.py                                   # NEW — like/pct toggle + state
src/mrms/api/playlists.py                                     # NEW — playlist CRUD
src/mrms/api/albums.py                                        # NEW — get tracks
src/mrms/api/main.py                                          # MODIFY — 새 라우터 + mrt_latest 확장
src/mrms/recsys/mrt.py                                        # MODIFY — recommended_playlists 생성

[Frontend types + API helpers]
web/src/lib/types.ts                                          # MODIFY — PlaylistInfo, TrackState
web/src/lib/api/user-tracks.ts                                # NEW
web/src/lib/api/playlists.ts                                  # NEW

[Frontend shared components]
web/src/components/track-list/TrackListRow.tsx                # NEW
web/src/components/track-list/TrackListActions.tsx            # NEW
web/src/components/playlist/CreatePlaylistModal.tsx           # NEW
web/src/components/album/AlbumDetailModal.tsx                 # NEW
web/src/components/playlist/PlaylistDetailModal.tsx           # NEW

[Frontend MRT page]
web/src/components/mrms/PersonaCard.tsx                       # MODIFY — 클릭 + active
web/src/app/(dashboard)/mrt/page.tsx                          # MODIFY — dashboard 레이아웃

[Player]
web/src/store/player.ts                                       # MODIFY — shuffle/repeat/like/pct/quality
web/src/components/player/NowPlaying.tsx                      # MODIFY — 앨범사진 + 음질배지
web/src/components/player/PlayerControls.tsx                  # MODIFY — 셔플 + 반복
web/src/components/player/PlayerActions.tsx                   # NEW — ♥ + ✨ for 현재 트랙
web/src/components/player/PlayerBar.tsx                       # MODIFY — layout 재배치

[Tests]
tests/api/test_user_tracks.py                                 # NEW
tests/api/test_playlists.py                                   # NEW
tests/api/test_albums.py                                      # NEW
```

의존성 순서:
```
Task 1 (DB) → Task 2 (DB helper) → Task 3-6 (API endpoints)
  → Task 7 (types/helpers) → Task 8-12 (frontend components)
  → Task 13 (MRT page) → Task 14-18 (player) → Task 19 (deploy + verify)
```

---

## Task 1: DB Migration — Playlist + PlaylistTrack

**Files:**
- Create: `prisma/migrations/20260609100000_add_playlist/migration.sql`

- [ ] **Step 1: 디렉토리 + migration.sql 작성**

```sql
-- prisma/migrations/20260609100000_add_playlist/migration.sql
CREATE TABLE IF NOT EXISTS "Playlist" (
  id          TEXT PRIMARY KEY,
  "userId"    TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_playlist_user ON "Playlist"("userId");

CREATE TABLE IF NOT EXISTS "PlaylistTrack" (
  "playlistId" TEXT NOT NULL REFERENCES "Playlist"(id) ON DELETE CASCADE,
  "trackId"    TEXT NOT NULL REFERENCES "Track"(id) ON DELETE CASCADE,
  position     INTEGER NOT NULL,
  "addedAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("playlistId", "trackId")
);
CREATE INDEX IF NOT EXISTS idx_playlisttrack_position ON "PlaylistTrack"("playlistId", position);
```

- [ ] **Step 2: dev DB에 적용 + 검증**

```bash
cd "/Volumes/MacExtend 1/MRMS_FN"
mkdir -p prisma/migrations/20260609100000_add_playlist
# (위 SQL을 migration.sql로 저장)

source scripts/lib/migrations.sh
apply_pending_migrations prisma/migrations
```

Expected: `applying 20260609100000_add_playlist`

검증:
```bash
docker compose exec -T pg psql -U mrms -d mrms -c '\d "Playlist"'
docker compose exec -T pg psql -U mrms -d mrms -c '\d "PlaylistTrack"'
```

테이블 구조 출력되면 OK.

- [ ] **Step 3: Commit**

```bash
git add prisma/migrations/20260609100000_add_playlist
git commit -m "feat(db): Playlist + PlaylistTrack tables"
```

---

## Task 2: DB Helper — playlist.py

**Files:**
- Create: `src/mrms/db/playlist.py`
- Test: `tests/db/test_playlist.py`

- [ ] **Step 1: Failing test**

```python
# tests/db/test_playlist.py
"""Playlist DB helpers."""
import psycopg

from mrms.db.playlist import (
    create_playlist,
    get_playlist_tracks,
    list_user_playlists,
)
from mrms.db.user_track import get_or_create_user


def test_create_playlist_inserts_rows(db_conn: psycopg.Connection):
    """create_playlist는 Playlist + PlaylistTrack 행 생성."""
    user_id = get_or_create_user(db_conn, "playlist@test.com")
    db_conn.commit()

    with db_conn.cursor() as cur:
        cur.execute('SELECT id FROM "Track" LIMIT 3')
        track_ids = [r[0] for r in cur.fetchall()]
    if len(track_ids) < 3:
        import pytest
        pytest.skip("Track 데이터 부족")

    pid = create_playlist(
        db_conn,
        user_id=user_id,
        name="Test PL",
        description="desc",
        track_ids=track_ids,
    )
    assert pid

    with db_conn.cursor() as cur:
        cur.execute('SELECT name, description FROM "Playlist" WHERE id = %s', (pid,))
        row = cur.fetchone()
    assert row == ("Test PL", "desc")

    tracks = get_playlist_tracks(db_conn, pid)
    assert [t["track_id"] for t in tracks] == track_ids


def test_list_user_playlists(db_conn: psycopg.Connection):
    """list_user_playlists는 그 user의 playlist만 반환."""
    user_id = get_or_create_user(db_conn, "list@test.com")
    db_conn.commit()

    with db_conn.cursor() as cur:
        cur.execute('SELECT id FROM "Track" LIMIT 1')
        track_ids = [r[0] for r in cur.fetchall()]
    if not track_ids:
        import pytest
        pytest.skip("Track 데이터 부족")

    create_playlist(db_conn, user_id=user_id, name="A", description=None, track_ids=track_ids)
    create_playlist(db_conn, user_id=user_id, name="B", description=None, track_ids=track_ids)

    playlists = list_user_playlists(db_conn, user_id)
    names = {p["name"] for p in playlists}
    assert {"A", "B"}.issubset(names)
```

- [ ] **Step 2: Run — fail expected**

```bash
source .venv/bin/activate && pytest tests/db/test_playlist.py -v
```

Expected: ImportError — `mrms.db.playlist` 없음.

- [ ] **Step 3: Implementation**

```python
# src/mrms/db/playlist.py
"""Playlist + PlaylistTrack DB 헬퍼."""
from __future__ import annotations

import hashlib
from datetime import datetime, timezone

import psycopg


def _id(value: str) -> str:
    h = hashlib.sha1(value.encode()).hexdigest()[:24]
    return f"c{h}"


def create_playlist(
    conn: psycopg.Connection,
    user_id: str,
    name: str,
    description: str | None,
    track_ids: list[str],
) -> str:
    """새 Playlist + PlaylistTrack 생성. playlist_id 반환."""
    ts = datetime.now(timezone.utc).isoformat()
    playlist_id = _id(f"playlist|{user_id}|{name}|{ts}")
    with conn.cursor() as cur:
        cur.execute(
            '''INSERT INTO "Playlist" (id, "userId", name, description)
               VALUES (%s, %s, %s, %s)''',
            (playlist_id, user_id, name, description),
        )
        for pos, track_id in enumerate(track_ids):
            cur.execute(
                '''INSERT INTO "PlaylistTrack" ("playlistId", "trackId", position)
                   VALUES (%s, %s, %s)
                   ON CONFLICT ("playlistId", "trackId") DO NOTHING''',
                (playlist_id, track_id, pos),
            )
    conn.commit()
    return playlist_id


def list_user_playlists(
    conn: psycopg.Connection, user_id: str
) -> list[dict]:
    """User의 playlists 목록 (트랙 카운트 포함)."""
    with conn.cursor() as cur:
        cur.execute(
            '''SELECT p.id, p.name, p.description, p."createdAt",
                      COUNT(pt."trackId") AS track_count
               FROM "Playlist" p
               LEFT JOIN "PlaylistTrack" pt ON pt."playlistId" = p.id
               WHERE p."userId" = %s
               GROUP BY p.id
               ORDER BY p."createdAt" DESC''',
            (user_id,),
        )
        rows = cur.fetchall()
    return [
        {
            "id": r[0],
            "name": r[1],
            "description": r[2],
            "created_at": r[3].isoformat() if r[3] else None,
            "track_count": r[4],
        }
        for r in rows
    ]


def get_playlist_tracks(
    conn: psycopg.Connection, playlist_id: str
) -> list[dict]:
    """Playlist 안 트랙 (position 순)."""
    with conn.cursor() as cur:
        cur.execute(
            '''SELECT t.id, t.title, a.name AS artist,
                      al.id AS album_id, al.title AS album_title,
                      al."coverUrl" AS album_cover,
                      tp_tidal."platformTrackId" AS tidal_track_id,
                      tp_spotify."platformTrackId" AS spotify_track_id,
                      pt.position
               FROM "PlaylistTrack" pt
               JOIN "Track" t ON t.id = pt."trackId"
               JOIN "Artist" a ON a.id = t."artistId"
               LEFT JOIN "Album" al ON al.id = t."albumId"
               LEFT JOIN "TrackPlatform" tp_tidal
                 ON tp_tidal."trackId" = t.id AND tp_tidal.platform = 'tidal'
               LEFT JOIN "TrackPlatform" tp_spotify
                 ON tp_spotify."trackId" = t.id AND tp_spotify.platform = 'spotify'
               WHERE pt."playlistId" = %s
               ORDER BY pt.position''',
            (playlist_id,),
        )
        rows = cur.fetchall()
    return [
        {
            "track_id": r[0],
            "title": r[1],
            "artist": r[2],
            "album_id": r[3],
            "album_title": r[4],
            "album_cover": r[5],
            "tidal_track_id": r[6],
            "spotify_track_id": r[7],
        }
        for r in rows
    ]


def get_playlist(
    conn: psycopg.Connection, playlist_id: str
) -> dict | None:
    """Playlist 메타."""
    with conn.cursor() as cur:
        cur.execute(
            '''SELECT id, "userId", name, description, "createdAt"
               FROM "Playlist" WHERE id = %s''',
            (playlist_id,),
        )
        row = cur.fetchone()
    if not row:
        return None
    return {
        "id": row[0],
        "user_id": row[1],
        "name": row[2],
        "description": row[3],
        "created_at": row[4].isoformat() if row[4] else None,
    }
```

- [ ] **Step 4: Check Album.coverUrl column exists**

```bash
docker compose exec -T pg psql -U mrms -d mrms -c '\d "Album"' | grep -i cover
```

`coverUrl` 컬럼 없으면 위 query에서 `al."coverUrl"` 부분 제거하고 `album_cover: r[5]` → `None` 또는 stub. 또는 columnar query 조정.

만약 컬럼 다른 이름이면 위 쿼리에서 그 이름으로 수정.

- [ ] **Step 5: Run tests**

```bash
pytest tests/db/test_playlist.py -v
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/mrms/db/playlist.py tests/db/test_playlist.py
git commit -m "feat(db): playlist + tracks helpers"
```

---

## Task 3: API — user_tracks (like/pct toggle + state)

**Files:**
- Create: `src/mrms/api/user_tracks.py`
- Test: `tests/api/test_user_tracks.py`
- Modify: `src/mrms/api/main.py` (라우터 등록)

- [ ] **Step 1: Failing tests**

```python
# tests/api/test_user_tracks.py
"""user_tracks API — like/pct toggle + state."""
from fastapi.testclient import TestClient

from mrms.api.main import app
from tests.api.conftest import login_user  # 기존 helper 활용


client = TestClient(app)


def test_like_toggle_adds_then_removes(db_conn):
    """첫 호출 → liked=true, 두 번째 → liked=false."""
    user_id, cookies = login_user(db_conn, "like-toggle@test.com")
    client.cookies.update(cookies)

    with db_conn.cursor() as cur:
        cur.execute('SELECT id FROM "Track" LIMIT 1')
        row = cur.fetchone()
    if not row:
        import pytest
        pytest.skip("Track 데이터 부족")
    track_id = row[0]

    r1 = client.post(f"/api/user/tracks/{track_id}/like")
    assert r1.status_code == 200
    assert r1.json() == {"liked": True}

    r2 = client.post(f"/api/user/tracks/{track_id}/like")
    assert r2.status_code == 200
    assert r2.json() == {"liked": False}

    client.cookies.clear()


def test_pct_toggle(db_conn):
    """PCT 토글 → is_core 변경."""
    user_id, cookies = login_user(db_conn, "pct-toggle@test.com")
    client.cookies.update(cookies)

    with db_conn.cursor() as cur:
        cur.execute('SELECT id FROM "Track" LIMIT 1')
        row = cur.fetchone()
    if not row:
        import pytest
        pytest.skip("Track 데이터 부족")
    track_id = row[0]

    r1 = client.post(f"/api/user/tracks/{track_id}/pct")
    assert r1.status_code == 200
    assert r1.json() == {"pct": True}

    r2 = client.post(f"/api/user/tracks/{track_id}/pct")
    assert r2.status_code == 200
    assert r2.json() == {"pct": False}

    client.cookies.clear()


def test_track_state_returns_current(db_conn):
    """state 엔드포인트 — 현재 liked/pct 상태."""
    user_id, cookies = login_user(db_conn, "state@test.com")
    client.cookies.update(cookies)

    with db_conn.cursor() as cur:
        cur.execute('SELECT id FROM "Track" LIMIT 1')
        row = cur.fetchone()
    if not row:
        import pytest
        pytest.skip("Track 데이터 부족")
    track_id = row[0]

    r0 = client.get(f"/api/user/tracks/{track_id}/state")
    assert r0.status_code == 200
    assert r0.json() == {"liked": False, "pct": False}

    client.post(f"/api/user/tracks/{track_id}/like")
    r1 = client.get(f"/api/user/tracks/{track_id}/state")
    assert r1.json() == {"liked": True, "pct": False}

    client.cookies.clear()
```

**conftest helper** — 만약 `login_user` 없으면 신규 추가 (tests/api/conftest.py에):
```python
def login_user(db_conn, email: str):
    from mrms.db.user_track import get_or_create_user
    from mrms.api.auth_session import _create_session
    user_id = get_or_create_user(db_conn, email)
    db_conn.commit()
    session_id = _create_session(db_conn, user_id)
    return user_id, {"mrms_session": session_id}
```

(이미 다른 테스트에서 비슷한 패턴이 있으면 그걸로 import. 없으면 conftest에 추가 — 이건 별도 step으로 진행)

- [ ] **Step 2: Run — fail expected**

```bash
pytest tests/api/test_user_tracks.py -v
```

Expected: 404 (라우트 없음) 또는 ImportError.

- [ ] **Step 3: Implementation**

```python
# src/mrms/api/user_tracks.py
"""User tracks API — like/pct toggle + state."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from mrms.api.deps import get_db, get_current_user_id


router = APIRouter(prefix="/api/user/tracks", tags=["user_tracks"])


@router.post("/{track_id}/like")
def toggle_like(
    track_id: str,
    user_id: str = Depends(get_current_user_id),
    conn=Depends(get_db),
):
    """좋아요 토글. UserTrack source='liked' 추가/제거."""
    with conn.cursor() as cur:
        cur.execute(
            '''SELECT source, "isCore" FROM "UserTrack"
               WHERE "userId" = %s AND "trackId" = %s''',
            (user_id, track_id),
        )
        row = cur.fetchone()
        if row is None:
            # 신규 — liked 추가
            cur.execute(
                '''INSERT INTO "UserTrack"
                     ("userId", "trackId", source, "isCore", platform)
                   VALUES (%s, %s, 'liked', false, 'mrms')''',
                (user_id, track_id),
            )
            conn.commit()
            return {"liked": True}

        source, is_core = row
        if source == "liked":
            # 이미 liked → 제거 (단 PCT면 행 자체는 유지하고 source만 바꿈)
            if is_core:
                cur.execute(
                    '''UPDATE "UserTrack" SET source = 'playlist'
                       WHERE "userId" = %s AND "trackId" = %s''',
                    (user_id, track_id),
                )
            else:
                cur.execute(
                    '''DELETE FROM "UserTrack"
                       WHERE "userId" = %s AND "trackId" = %s''',
                    (user_id, track_id),
                )
            conn.commit()
            return {"liked": False}
        else:
            # 다른 source → liked로 변경
            cur.execute(
                '''UPDATE "UserTrack" SET source = 'liked'
                   WHERE "userId" = %s AND "trackId" = %s''',
                (user_id, track_id),
            )
            conn.commit()
            return {"liked": True}


@router.post("/{track_id}/pct")
def toggle_pct(
    track_id: str,
    user_id: str = Depends(get_current_user_id),
    conn=Depends(get_db),
):
    """PCT (isCore) 토글."""
    with conn.cursor() as cur:
        cur.execute(
            '''SELECT "isCore" FROM "UserTrack"
               WHERE "userId" = %s AND "trackId" = %s''',
            (user_id, track_id),
        )
        row = cur.fetchone()
        if row is None:
            cur.execute(
                '''INSERT INTO "UserTrack"
                     ("userId", "trackId", source, "isCore", platform)
                   VALUES (%s, %s, 'liked', true, 'mrms')''',
                (user_id, track_id),
            )
            conn.commit()
            return {"pct": True}

        is_core = row[0]
        new_value = not is_core
        cur.execute(
            '''UPDATE "UserTrack" SET "isCore" = %s
               WHERE "userId" = %s AND "trackId" = %s''',
            (new_value, user_id, track_id),
        )
        conn.commit()
        return {"pct": new_value}


@router.get("/{track_id}/state")
def get_track_state(
    track_id: str,
    user_id: str = Depends(get_current_user_id),
    conn=Depends(get_db),
):
    """현재 트랙 liked + pct 상태."""
    with conn.cursor() as cur:
        cur.execute(
            '''SELECT source, "isCore" FROM "UserTrack"
               WHERE "userId" = %s AND "trackId" = %s''',
            (user_id, track_id),
        )
        row = cur.fetchone()
    if row is None:
        return {"liked": False, "pct": False}
    source, is_core = row
    return {"liked": source == "liked", "pct": bool(is_core)}
```

> 주의: 위 코드는 UserTrack 컬럼명을 `isCore` (camelCase)로 가정. 실제 schema 확인 후 (snake_case일 수 있음) 맞춰서 수정.

```bash
docker compose exec -T pg psql -U mrms -d mrms -c '\d "UserTrack"'
```

`isCore` 또는 `is_core` 어느 쪽인지 확인 후 일관되게.

- [ ] **Step 4: Register router**

`src/mrms/api/main.py`:
```python
from mrms.api.user_tracks import router as user_tracks_router
# ...
app.include_router(user_tracks_router)
```

- [ ] **Step 5: Run tests**

```bash
pytest tests/api/test_user_tracks.py -v
```

Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add src/mrms/api/user_tracks.py tests/api/test_user_tracks.py src/mrms/api/main.py
git commit -m "feat(api): user_tracks like/pct toggle + state endpoints"
```

---

## Task 4: API — playlists (create + get tracks + list)

**Files:**
- Create: `src/mrms/api/playlists.py`
- Test: `tests/api/test_playlists.py`
- Modify: `src/mrms/api/main.py`

- [ ] **Step 1: Failing tests**

```python
# tests/api/test_playlists.py
"""Playlists API — create + get tracks + list."""
from fastapi.testclient import TestClient

from mrms.api.main import app
from tests.api.conftest import login_user


client = TestClient(app)


def test_create_playlist_returns_playlist_id(db_conn):
    """POST /api/user/playlists → 새 playlist 생성."""
    user_id, cookies = login_user(db_conn, "create-pl@test.com")
    client.cookies.update(cookies)

    with db_conn.cursor() as cur:
        cur.execute('SELECT id FROM "Track" LIMIT 3')
        track_ids = [r[0] for r in cur.fetchall()]
    if len(track_ids) < 3:
        import pytest
        pytest.skip("Track 데이터 부족")

    r = client.post(
        "/api/user/playlists",
        json={"name": "My PL", "description": "test", "track_ids": track_ids},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["playlist"]["name"] == "My PL"
    assert data["playlist"]["description"] == "test"
    assert "id" in data["playlist"]

    client.cookies.clear()


def test_list_user_playlists(db_conn):
    """GET /api/user/playlists → 본인 playlist 목록."""
    user_id, cookies = login_user(db_conn, "list-pl@test.com")
    client.cookies.update(cookies)

    with db_conn.cursor() as cur:
        cur.execute('SELECT id FROM "Track" LIMIT 1')
        track_ids = [r[0] for r in cur.fetchall()]
    if not track_ids:
        import pytest
        pytest.skip("Track 데이터 부족")

    client.post("/api/user/playlists", json={"name": "X", "track_ids": track_ids})
    client.post("/api/user/playlists", json={"name": "Y", "track_ids": track_ids})

    r = client.get("/api/user/playlists")
    assert r.status_code == 200
    names = {p["name"] for p in r.json()["playlists"]}
    assert {"X", "Y"}.issubset(names)

    client.cookies.clear()


def test_get_playlist_tracks(db_conn):
    """GET /api/playlists/{id}/tracks → 안 트랙들."""
    user_id, cookies = login_user(db_conn, "get-pl@test.com")
    client.cookies.update(cookies)

    with db_conn.cursor() as cur:
        cur.execute('SELECT id FROM "Track" LIMIT 2')
        track_ids = [r[0] for r in cur.fetchall()]
    if len(track_ids) < 2:
        import pytest
        pytest.skip("Track 데이터 부족")

    create_r = client.post(
        "/api/user/playlists",
        json={"name": "Z", "track_ids": track_ids},
    )
    pid = create_r.json()["playlist"]["id"]

    r = client.get(f"/api/playlists/{pid}/tracks")
    assert r.status_code == 200
    tracks = r.json()["tracks"]
    assert [t["track_id"] for t in tracks] == track_ids
    assert r.json()["playlist"]["name"] == "Z"

    client.cookies.clear()
```

- [ ] **Step 2: Run — fail expected**

```bash
pytest tests/api/test_playlists.py -v
```

- [ ] **Step 3: Implementation**

```python
# src/mrms/api/playlists.py
"""Playlists API."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from mrms.api.deps import get_current_user_id, get_db
from mrms.db.playlist import (
    create_playlist,
    get_playlist,
    get_playlist_tracks,
    list_user_playlists,
)


router = APIRouter(tags=["playlists"])


class CreatePlaylistRequest(BaseModel):
    name: str
    description: str | None = None
    track_ids: list[str] = []


@router.post("/api/user/playlists")
def create_playlist_endpoint(
    body: CreatePlaylistRequest,
    user_id: str = Depends(get_current_user_id),
    conn=Depends(get_db),
):
    """새 playlist 생성."""
    if not body.name.strip():
        raise HTTPException(400, "name required")
    playlist_id = create_playlist(
        conn,
        user_id=user_id,
        name=body.name.strip(),
        description=(body.description or None),
        track_ids=body.track_ids,
    )
    playlist = get_playlist(conn, playlist_id)
    return {"playlist": playlist}


@router.get("/api/user/playlists")
def list_my_playlists(
    user_id: str = Depends(get_current_user_id),
    conn=Depends(get_db),
):
    return {"playlists": list_user_playlists(conn, user_id)}


@router.get("/api/playlists/{playlist_id}/tracks")
def playlist_tracks_endpoint(
    playlist_id: str,
    user_id: str = Depends(get_current_user_id),
    conn=Depends(get_db),
):
    pl = get_playlist(conn, playlist_id)
    if not pl:
        raise HTTPException(404, "playlist not found")
    # 권한: 본인만
    if pl["user_id"] != user_id:
        raise HTTPException(403, "forbidden")
    tracks = get_playlist_tracks(conn, playlist_id)
    return {"playlist": pl, "tracks": tracks}
```

- [ ] **Step 4: Register router**

`src/mrms/api/main.py`:
```python
from mrms.api.playlists import router as playlists_router
# ...
app.include_router(playlists_router)
```

- [ ] **Step 5: Run tests**

```bash
pytest tests/api/test_playlists.py -v
```

Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add src/mrms/api/playlists.py tests/api/test_playlists.py src/mrms/api/main.py
git commit -m "feat(api): playlists CRUD endpoints"
```

---

## Task 5: API — albums (get tracks)

**Files:**
- Create: `src/mrms/api/albums.py`
- Test: `tests/api/test_albums.py`
- Modify: `src/mrms/api/main.py`

- [ ] **Step 1: Failing test**

```python
# tests/api/test_albums.py
"""Albums API — get tracks."""
from fastapi.testclient import TestClient

from mrms.api.main import app
from tests.api.conftest import login_user


client = TestClient(app)


def test_get_album_tracks(db_conn):
    """GET /api/albums/{id}/tracks → 그 앨범 트랙들."""
    user_id, cookies = login_user(db_conn, "album@test.com")
    client.cookies.update(cookies)

    with db_conn.cursor() as cur:
        cur.execute(
            '''SELECT "albumId", id, title FROM "Track"
               WHERE "albumId" IS NOT NULL
               LIMIT 1'''
        )
        row = cur.fetchone()
    if not row:
        import pytest
        pytest.skip("Album 데이터 부족")
    album_id = row[0]

    r = client.get(f"/api/albums/{album_id}/tracks")
    assert r.status_code == 200
    data = r.json()
    assert "album" in data
    assert "tracks" in data
    assert len(data["tracks"]) >= 1
    # 모든 트랙이 같은 album에 속함
    with db_conn.cursor() as cur:
        cur.execute(
            'SELECT id FROM "Track" WHERE "albumId" = %s ORDER BY id',
            (album_id,),
        )
        expected_ids = sorted(r[0] for r in cur.fetchall())
    returned_ids = sorted(t["track_id"] for t in data["tracks"])
    assert returned_ids == expected_ids

    client.cookies.clear()
```

- [ ] **Step 2: Run — fail expected**

- [ ] **Step 3: Implementation**

```python
# src/mrms/api/albums.py
"""Albums API."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from mrms.api.deps import get_current_user_id, get_db


router = APIRouter(tags=["albums"])


@router.get("/api/albums/{album_id}/tracks")
def album_tracks_endpoint(
    album_id: str,
    _user_id: str = Depends(get_current_user_id),
    conn=Depends(get_db),
):
    """앨범의 트랙들."""
    with conn.cursor() as cur:
        cur.execute(
            '''SELECT id, title, "coverUrl" FROM "Album" WHERE id = %s''',
            (album_id,),
        )
        a = cur.fetchone()
        if not a:
            raise HTTPException(404, "album not found")
        album = {"id": a[0], "title": a[1], "cover_url": a[2]}

        cur.execute(
            '''SELECT t.id, t.title, ar.name AS artist,
                      al.id AS album_id, al.title AS album_title,
                      al."coverUrl" AS album_cover,
                      tp_tidal."platformTrackId" AS tidal_track_id,
                      tp_spotify."platformTrackId" AS spotify_track_id
               FROM "Track" t
               JOIN "Artist" ar ON ar.id = t."artistId"
               LEFT JOIN "Album" al ON al.id = t."albumId"
               LEFT JOIN "TrackPlatform" tp_tidal
                 ON tp_tidal."trackId" = t.id AND tp_tidal.platform = 'tidal'
               LEFT JOIN "TrackPlatform" tp_spotify
                 ON tp_spotify."trackId" = t.id AND tp_spotify.platform = 'spotify'
               WHERE t."albumId" = %s
               ORDER BY t.id''',
            (album_id,),
        )
        rows = cur.fetchall()

    tracks = [
        {
            "track_id": r[0],
            "title": r[1],
            "artist": r[2],
            "album_id": r[3],
            "album_title": r[4],
            "album_cover": r[5],
            "tidal_track_id": r[6],
            "spotify_track_id": r[7],
        }
        for r in rows
    ]
    return {"album": album, "tracks": tracks}
```

> Album.coverUrl 컬럼 없으면 schema 보고 맞춰서 수정 (예: cover_url, image_url 등). 없으면 None으로 fallback.

- [ ] **Step 4: Register + tests + commit**

```python
# main.py
from mrms.api.albums import router as albums_router
app.include_router(albums_router)
```

```bash
pytest tests/api/test_albums.py -v
git add src/mrms/api/albums.py tests/api/test_albums.py src/mrms/api/main.py
git commit -m "feat(api): albums tracks endpoint"
```

---

## Task 6: API — mrt_latest 확장 (recommended_playlists)

**Files:**
- Modify: `src/mrms/api/main.py` (mrt_latest 응답)
- Modify: `src/mrms/recsys/mrt.py`
- Test: `tests/api/test_main.py` (기존 test_mrt_latest_returns_playlists 추가)

- [ ] **Step 1: Check 현재 mrt_latest 구조**

```bash
grep -n "mrt_latest\|recommended_playlists" src/mrms/api/main.py src/mrms/recsys/mrt.py | head -20
```

- [ ] **Step 2: Add failing test**

`tests/api/test_main.py`에 추가:
```python
def test_mrt_latest_includes_recommended_playlists(db_conn):
    """mrt_latest 응답에 recommended_playlists 필드 (빈 list라도 키 존재)."""
    user_id, cookies = login_user(db_conn, "mrt-pl@test.com")
    client.cookies.update(cookies)

    # 단순히 응답 키 존재만 검증 — persona 없으면 빈 list
    r = client.get("/api/mrt/latest")
    if r.status_code == 200:
        assert "recommended_playlists" in r.json()
    client.cookies.clear()
```

- [ ] **Step 3: Implementation — recsys/mrt.py에 playlists 생성 로직**

기존 mrt_latest 함수에서 `recommended_playlists` 만들기. 가장 간단한 첫 버전: 각 persona에서 top N 트랙들을 임시 playlist로 묶음.

```python
# src/mrms/recsys/mrt.py 안 build_mrt_response (또는 등가 함수) 에서

def build_recommended_playlists(personas: list[dict], tracks: list[dict]) -> list[dict]:
    """각 persona별로 임시 playlist (top N) 구성."""
    result = []
    for p in personas:
        pidx = p["persona_idx"]
        ptracks = [t for t in tracks if t.get("persona_idx") == pidx][:25]
        if not ptracks:
            continue
        # cover url: 첫 트랙의 album cover
        cover = ptracks[0].get("album_cover")
        result.append({
            "id": f"mrt_persona_{pidx}",
            "name": p.get("label") or f"페르소나 {pidx+1}",
            "cover_url": cover,
            "track_count": len(ptracks),
            "persona_idx": pidx,
            "persona_score": p.get("score"),
            "tracks": ptracks,  # 또는 track_id list만
        })
    return result
```

`mrt_latest` 응답에 `"recommended_playlists": build_recommended_playlists(...)` 추가.

> 노트: persona/track 구조는 기존 코드에 따라 다름. 위는 의도 코드 — 실제 함수 내부 데이터에 맞춰서 적용.

- [ ] **Step 4: Test + commit**

```bash
pytest tests/api/test_main.py::test_mrt_latest_includes_recommended_playlists -v
git add src/mrms/api/main.py src/mrms/recsys/mrt.py tests/api/test_main.py
git commit -m "feat(api): mrt_latest now returns recommended_playlists"
```

---

## Task 7: Frontend types + API helpers

**Files:**
- Modify: `web/src/lib/types.ts`
- Create: `web/src/lib/api/user-tracks.ts`
- Create: `web/src/lib/api/playlists.ts`

- [ ] **Step 1: types 추가**

`web/src/lib/types.ts` 끝에:
```typescript
export interface TrackState {
  liked: boolean;
  pct: boolean;
}

export interface PlaylistInfo {
  id: string;
  name: string;
  description: string | null;
  cover_url: string | null;
  track_count: number;
  persona_idx?: number;
  persona_score?: number;
  created_at?: string;
}

export interface AlbumInfo {
  id: string;
  title: string;
  cover_url: string | null;
}

export interface TrackInfo {
  track_id: string;
  title: string;
  artist: string;
  album_id: string | null;
  album_title: string | null;
  album_cover: string | null;
  tidal_track_id: string | null;
  spotify_track_id: string | null;
  persona_idx?: number;
  persona_score?: number;
  duration_sec?: number;
}
```

`MrtLatestResponse`에 `recommended_playlists: PlaylistInfo[]` 추가.

- [ ] **Step 2: API helpers**

`web/src/lib/api/user-tracks.ts`:
```typescript
import type { TrackState } from "@/lib/types";

export async function toggleLike(trackId: string): Promise<boolean> {
  const r = await fetch(`/api/user/tracks/${trackId}/like`, {
    method: "POST",
    credentials: "include",
  });
  if (!r.ok) throw new Error(`toggleLike failed: ${r.status}`);
  return (await r.json()).liked as boolean;
}

export async function togglePct(trackId: string): Promise<boolean> {
  const r = await fetch(`/api/user/tracks/${trackId}/pct`, {
    method: "POST",
    credentials: "include",
  });
  if (!r.ok) throw new Error(`togglePct failed: ${r.status}`);
  return (await r.json()).pct as boolean;
}

export async function fetchTrackState(trackId: string): Promise<TrackState> {
  const r = await fetch(`/api/user/tracks/${trackId}/state`, {
    credentials: "include",
  });
  if (!r.ok) throw new Error(`fetchTrackState failed: ${r.status}`);
  return (await r.json()) as TrackState;
}
```

`web/src/lib/api/playlists.ts`:
```typescript
import type { PlaylistInfo, TrackInfo } from "@/lib/types";

export async function createPlaylist(
  name: string,
  description: string | null,
  trackIds: string[]
): Promise<PlaylistInfo> {
  const r = await fetch("/api/user/playlists", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      description,
      track_ids: trackIds,
    }),
  });
  if (!r.ok) throw new Error(`createPlaylist failed: ${r.status}`);
  return (await r.json()).playlist as PlaylistInfo;
}

export async function fetchPlaylistTracks(
  playlistId: string
): Promise<{ playlist: PlaylistInfo; tracks: TrackInfo[] }> {
  const r = await fetch(`/api/playlists/${playlistId}/tracks`, {
    credentials: "include",
  });
  if (!r.ok) throw new Error(`fetchPlaylistTracks failed: ${r.status}`);
  return r.json();
}

export async function fetchAlbumTracks(
  albumId: string
): Promise<{ album: { id: string; title: string; cover_url: string | null }; tracks: TrackInfo[] }> {
  const r = await fetch(`/api/albums/${albumId}/tracks`, {
    credentials: "include",
  });
  if (!r.ok) throw new Error(`fetchAlbumTracks failed: ${r.status}`);
  return r.json();
}
```

- [ ] **Step 3: Commit**

```bash
cd "/Volumes/MacExtend 1/MRMS_FN"
mkdir -p web/src/lib/api
# (위 파일들 작성)
git add web/src/lib/types.ts web/src/lib/api/
git commit -m "feat(web): types + api helpers for user-tracks/playlists"
```

---

## Task 8: TrackListRow 공통 컴포넌트

**Files:**
- Create: `web/src/components/track-list/TrackListRow.tsx`

- [ ] **Step 1: 구현**

```typescript
"use client";

import { useState } from "react";
import { Heart, Sparkles, Play } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { loadAndPlay } from "@/lib/player";
import { toggleLike, togglePct } from "@/lib/api/user-tracks";
import { usePlayerStore } from "@/store/player";
import type { TrackInfo } from "@/lib/types";


interface Props {
  track: TrackInfo;
  initialLiked?: boolean;
  initialPct?: boolean;
  showCheckbox?: boolean;
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  showPersonaScore?: boolean;
}


export function TrackListRow({
  track,
  initialLiked = false,
  initialPct = false,
  showCheckbox = true,
  checked = false,
  onCheckedChange,
  showPersonaScore = false,
}: Props) {
  const [liked, setLiked] = useState(initialLiked);
  const [pct, setPct] = useState(initialPct);

  const onToggleLike = async () => {
    const prev = liked;
    setLiked(!prev);
    try {
      const result = await toggleLike(track.track_id);
      setLiked(result);
    } catch {
      setLiked(prev);
      usePlayerStore.setState({ errorMsg: "좋아요 실패" });
    }
  };

  const onTogglePct = async () => {
    const prev = pct;
    setPct(!prev);
    try {
      const result = await togglePct(track.track_id);
      setPct(result);
    } catch {
      setPct(prev);
      usePlayerStore.setState({ errorMsg: "취향저격 실패" });
    }
  };

  const onPlay = async () => {
    const queueTrack = {
      track_id: track.track_id,
      title: track.title,
      artist: track.artist,
      tidal_track_id: track.tidal_track_id,
      spotify_track_id: track.spotify_track_id,
      album_cover: track.album_cover ?? null,
    };
    usePlayerStore.setState({
      queue: [queueTrack],
      currentIdx: 0,
      position: 0,
    });
    try {
      await loadAndPlay(queueTrack);
    } catch (e) {
      usePlayerStore.setState({ errorMsg: (e as Error).message });
    }
  };

  const fmtDuration = (sec?: number) => {
    if (!sec) return "";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  return (
    <div className="grid grid-cols-[24px_40px_1fr_80px_60px_110px] gap-2 px-3 py-2 items-center border-b border-border/50 hover:bg-muted/40">
      {showCheckbox ? (
        <Checkbox
          checked={checked}
          onCheckedChange={(v) => onCheckedChange?.(Boolean(v))}
        />
      ) : (
        <span />
      )}
      <div className="size-10 rounded bg-muted overflow-hidden">
        {track.album_cover && (
          <img src={track.album_cover} alt="" className="size-full object-cover" />
        )}
      </div>
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{track.title}</div>
        <div className="truncate text-xs text-muted-foreground">
          {track.artist}
          {track.album_title ? ` · ${track.album_title}` : ""}
        </div>
      </div>
      <div className="text-xs text-muted-foreground">
        {showPersonaScore && track.persona_idx !== undefined
          ? `P${track.persona_idx + 1}${
              track.persona_score
                ? ` (${Math.round(track.persona_score * 100)}%)`
                : ""
            }`
          : ""}
      </div>
      <div className="text-xs text-muted-foreground tabular-nums">
        {fmtDuration(track.duration_sec)}
      </div>
      <div className="flex gap-1 justify-end items-center">
        <Button
          size="icon"
          variant="ghost"
          className="size-8"
          aria-label="좋아요"
          onClick={onToggleLike}
        >
          <Heart
            className={`size-4 ${liked ? "fill-rose-500 text-rose-500" : "text-muted-foreground"}`}
          />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="size-8"
          aria-label="취향저격"
          onClick={onTogglePct}
        >
          <Sparkles
            className={`size-4 ${pct ? "fill-amber-500 text-amber-500" : "text-muted-foreground"}`}
          />
        </Button>
        <Button
          size="icon"
          className="size-8 rounded-full"
          aria-label="재생"
          onClick={onPlay}
        >
          <Play className="size-3 fill-current" />
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 빌드 검증**

```bash
cd "/Volumes/MacExtend 1/MRMS_FN/web"
mkdir -p src/components/track-list
# (위 파일 작성)
pnpm tsc --noEmit 2>&1 | grep -E "TrackListRow|track-list" | head
```

Expected: 에러 없음

- [ ] **Step 3: Commit**

```bash
cd "/Volumes/MacExtend 1/MRMS_FN"
git add web/src/components/track-list/TrackListRow.tsx
git commit -m "feat(web): TrackListRow shared component (♥/✨/▶/checkbox)"
```

---

## Task 9: TrackListActions (multi-select 툴바)

**Files:**
- Create: `web/src/components/track-list/TrackListActions.tsx`

- [ ] **Step 1: 구현**

```typescript
"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";


interface Props {
  totalCount: number;
  selectedCount: number;
  onCreatePlaylist: () => void;
}


export function TrackListActions({
  totalCount,
  selectedCount,
  onCreatePlaylist,
}: Props) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="px-2 py-0.5 rounded bg-muted text-muted-foreground">
        전체 {totalCount}곡
      </span>
      {selectedCount > 0 && (
        <span className="px-2 py-0.5 rounded bg-primary/10 text-primary">
          + 선택 {selectedCount}곡
        </span>
      )}
      <Button
        size="sm"
        disabled={selectedCount === 0}
        onClick={onCreatePlaylist}
        className="h-7 px-3"
      >
        <Plus className="size-3.5 mr-1" />
        Playlist 만들기
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/components/track-list/TrackListActions.tsx
git commit -m "feat(web): TrackListActions multi-select toolbar"
```

---

## Task 10: CreatePlaylistModal

**Files:**
- Create: `web/src/components/playlist/CreatePlaylistModal.tsx`

- [ ] **Step 1: 구현**

```typescript
"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createPlaylist } from "@/lib/api/playlists";


interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trackIds: string[];
  onCreated?: (playlistId: string) => void;
}


export function CreatePlaylistModal({
  open,
  onOpenChange,
  trackIds,
  onCreated,
}: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    if (!name.trim()) {
      setError("이름을 입력하세요");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const pl = await createPlaylist(
        name.trim(),
        description.trim() || null,
        trackIds,
      );
      onOpenChange(false);
      setName("");
      setDescription("");
      onCreated?.(pl.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>새 플레이리스트</DialogTitle>
          <DialogDescription>
            {trackIds.length}곡 추가됨
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <Input
            placeholder="플레이리스트 이름"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <Textarea
            placeholder="설명 (선택)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            취소
          </Button>
          <Button onClick={onSubmit} disabled={submitting}>
            {submitting ? "만드는 중..." : "만들기"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: shadcn Textarea 컴포넌트 있는지 확인**

```bash
ls web/src/components/ui/textarea.tsx 2>&1
```

없으면:
```bash
cd web && pnpm dlx shadcn@latest add textarea
```

- [ ] **Step 3: Commit**

```bash
git add web/src/components/playlist/CreatePlaylistModal.tsx web/src/components/ui/textarea.tsx 2>/dev/null
git commit -m "feat(web): CreatePlaylistModal"
```

---

## Task 11: Album + Playlist DetailModal

**Files:**
- Create: `web/src/components/album/AlbumDetailModal.tsx`
- Create: `web/src/components/playlist/PlaylistDetailModal.tsx`

- [ ] **Step 1: AlbumDetailModal**

```typescript
// web/src/components/album/AlbumDetailModal.tsx
"use client";

import { useEffect, useState } from "react";
import { Play } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TrackListRow } from "@/components/track-list/TrackListRow";
import { fetchAlbumTracks } from "@/lib/api/playlists";
import { loadAndPlay } from "@/lib/player";
import { usePlayerStore } from "@/store/player";
import type { TrackInfo } from "@/lib/types";


interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  albumId: string | null;
}


export function AlbumDetailModal({ open, onOpenChange, albumId }: Props) {
  const [album, setAlbum] = useState<{ id: string; title: string; cover_url: string | null } | null>(null);
  const [tracks, setTracks] = useState<TrackInfo[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !albumId) return;
    setLoading(true);
    fetchAlbumTracks(albumId)
      .then((d) => {
        setAlbum(d.album);
        setTracks(d.tracks);
      })
      .finally(() => setLoading(false));
  }, [open, albumId]);

  const playAll = async () => {
    if (!tracks.length) return;
    usePlayerStore.setState({
      queue: tracks.map((t) => ({
        track_id: t.track_id,
        title: t.title,
        artist: t.artist,
        tidal_track_id: t.tidal_track_id,
        spotify_track_id: t.spotify_track_id,
        album_cover: t.album_cover ?? null,
      })),
      currentIdx: 0,
      position: 0,
    });
    try {
      await loadAndPlay(usePlayerStore.getState().queue[0]);
    } catch (e) {
      usePlayerStore.setState({ errorMsg: (e as Error).message });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{album?.title ?? "Album"}</DialogTitle>
        </DialogHeader>
        <div className="flex gap-4">
          <div className="size-32 rounded bg-muted overflow-hidden shrink-0">
            {album?.cover_url && (
              <img src={album.cover_url} alt="" className="size-full object-cover" />
            )}
          </div>
          <div className="flex-1">
            <p className="text-sm text-muted-foreground mb-2">{tracks.length}곡</p>
            <Button onClick={playAll} disabled={!tracks.length}>
              <Play className="size-3 mr-1 fill-current" />
              전체 재생
            </Button>
          </div>
        </div>
        <div className="max-h-96 overflow-y-auto border rounded">
          {loading && <p className="p-4 text-sm text-muted-foreground">로딩 중...</p>}
          {!loading && tracks.map((t) => (
            <TrackListRow
              key={t.track_id}
              track={t}
              showCheckbox={false}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: PlaylistDetailModal**

`web/src/components/playlist/PlaylistDetailModal.tsx`:
```typescript
"use client";

import { useEffect, useState } from "react";
import { Play } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TrackListRow } from "@/components/track-list/TrackListRow";
import { fetchPlaylistTracks } from "@/lib/api/playlists";
import { loadAndPlay } from "@/lib/player";
import { usePlayerStore } from "@/store/player";
import type { PlaylistInfo, TrackInfo } from "@/lib/types";


interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  playlistId: string | null;
}


export function PlaylistDetailModal({ open, onOpenChange, playlistId }: Props) {
  const [playlist, setPlaylist] = useState<PlaylistInfo | null>(null);
  const [tracks, setTracks] = useState<TrackInfo[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !playlistId) return;
    setLoading(true);
    fetchPlaylistTracks(playlistId)
      .then((d) => {
        setPlaylist(d.playlist);
        setTracks(d.tracks);
      })
      .finally(() => setLoading(false));
  }, [open, playlistId]);

  const playAll = async () => {
    if (!tracks.length) return;
    usePlayerStore.setState({
      queue: tracks.map((t) => ({
        track_id: t.track_id,
        title: t.title,
        artist: t.artist,
        tidal_track_id: t.tidal_track_id,
        spotify_track_id: t.spotify_track_id,
        album_cover: t.album_cover ?? null,
      })),
      currentIdx: 0,
      position: 0,
    });
    try {
      await loadAndPlay(usePlayerStore.getState().queue[0]);
    } catch (e) {
      usePlayerStore.setState({ errorMsg: (e as Error).message });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{playlist?.name ?? "Playlist"}</DialogTitle>
        </DialogHeader>
        <div className="flex gap-4">
          <div className="size-32 rounded bg-gradient-to-br from-indigo-400 to-violet-500 shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-muted-foreground mb-2">
              {tracks.length}곡 {playlist?.description && `· ${playlist.description}`}
            </p>
            <Button onClick={playAll} disabled={!tracks.length}>
              <Play className="size-3 mr-1 fill-current" />
              전체 재생
            </Button>
          </div>
        </div>
        <div className="max-h-96 overflow-y-auto border rounded">
          {loading && <p className="p-4 text-sm text-muted-foreground">로딩 중...</p>}
          {!loading && tracks.map((t) => (
            <TrackListRow
              key={t.track_id}
              track={t}
              showCheckbox={false}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add web/src/components/album/AlbumDetailModal.tsx \
        web/src/components/playlist/PlaylistDetailModal.tsx
git commit -m "feat(web): Album + Playlist DetailModal"
```

---

## Task 12: PersonaCard refactor (클릭 + active)

**Files:**
- Modify: `web/src/components/mrms/PersonaCard.tsx`

- [ ] **Step 1: 구현 — 클릭 props + active ring**

```typescript
"use client";

import type { Persona } from "@/lib/types";


interface Props {
  persona: Persona;
  active?: boolean;
  onClick?: () => void;
}


const GRADIENTS = [
  "from-indigo-400 to-violet-500",
  "from-amber-400 to-rose-500",
  "from-emerald-400 to-cyan-500",
];


export function PersonaCard({ persona, active = false, onClick }: Props) {
  const gradient = GRADIENTS[persona.persona_idx % GRADIENTS.length];
  return (
    <div
      onClick={onClick}
      className={`p-3 rounded-lg bg-gradient-to-br ${gradient} text-white cursor-pointer transition-all ${
        active ? "ring-2 ring-offset-2 ring-primary" : "hover:opacity-90"
      }`}
    >
      <div className="font-semibold text-sm">
        P{persona.persona_idx + 1} {persona.label ? `· ${persona.label}` : ""}
      </div>
      <div className="text-xs opacity-85 mt-1">
        {persona.track_count}곡
      </div>
    </div>
  );
}
```

> `Persona`에 `label` 필드 없으면 types.ts에 추가 또는 stub로 사용.

- [ ] **Step 2: Commit**

```bash
git add web/src/components/mrms/PersonaCard.tsx
git commit -m "refactor(web): PersonaCard now clickable with active state"
```

---

## Task 13: MRT 페이지 dashboard 리팩토링

**Files:**
- Modify: `web/src/app/(dashboard)/mrt/page.tsx`

- [ ] **Step 1: server 페이지가 client 페이지로 — useState 필요**

```typescript
// web/src/app/(dashboard)/mrt/page.tsx
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import { MrtDashboard } from "@/components/mrms/MrtDashboard";
import { getServerSideMrt, getServerSideUser } from "@/lib/server/auth";


export default async function MrtPage() {
  const [user, mrt] = await Promise.all([
    getServerSideUser(),
    getServerSideMrt(),
  ]);
  return <MrtDashboard user={user} mrt={mrt} />;
}
```

- [ ] **Step 2: MrtDashboard 컴포넌트 (client)**

```typescript
// web/src/components/mrms/MrtDashboard.tsx
"use client";

import { useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PersonaCard } from "@/components/mrms/PersonaCard";
import { TrackListRow } from "@/components/track-list/TrackListRow";
import { TrackListActions } from "@/components/track-list/TrackListActions";
import { CreatePlaylistModal } from "@/components/playlist/CreatePlaylistModal";
import { AlbumDetailModal } from "@/components/album/AlbumDetailModal";
import { PlaylistDetailModal } from "@/components/playlist/PlaylistDetailModal";
import type { MrtLatestResponse, UserInfo } from "@/lib/types";


interface Props {
  user: UserInfo;
  mrt: MrtLatestResponse;
}


export function MrtDashboard({ user, mrt }: Props) {
  const [personaFilter, setPersonaFilter] = useState<number | null>(null);
  const [selectedTrackIds, setSelectedTrackIds] = useState<Set<string>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);
  const [albumModal, setAlbumModal] = useState<string | null>(null);
  const [playlistModal, setPlaylistModal] = useState<string | null>(null);

  const filteredTracks = useMemo(
    () =>
      personaFilter === null
        ? mrt.recommended_tracks
        : mrt.recommended_tracks.filter((t) => t.persona_idx === personaFilter),
    [mrt.recommended_tracks, personaFilter],
  );

  const filteredAlbums = useMemo(
    () =>
      personaFilter === null
        ? mrt.recommended_albums
        : mrt.recommended_albums.filter((a) => a.persona_idx === personaFilter),
    [mrt.recommended_albums, personaFilter],
  );

  const filteredPlaylists = useMemo(
    () =>
      personaFilter === null
        ? (mrt.recommended_playlists ?? [])
        : (mrt.recommended_playlists ?? []).filter(
            (p) => p.persona_idx === personaFilter,
          ),
    [mrt.recommended_playlists, personaFilter],
  );

  const toggleSelect = (trackId: string, checked: boolean) => {
    setSelectedTrackIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(trackId);
      else next.delete(trackId);
      return next;
    });
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto pb-32">
      <header className="flex justify-between items-center border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold">MRT — 당신을 위한 추천</h1>
          <p className="text-sm text-muted-foreground">
            {user.email} · 페르소나 {user.personas_count} · UserTrack{" "}
            {user.user_tracks_count}곡
          </p>
        </div>
        <Button variant="outline" size="sm">
          <RefreshCw className="size-3 mr-1" />
          새로고침
        </Button>
      </header>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">페르소나</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {mrt.personas.map((p) => (
            <PersonaCard
              key={p.persona_idx}
              persona={p}
              active={personaFilter === p.persona_idx}
              onClick={() =>
                setPersonaFilter(
                  personaFilter === p.persona_idx ? null : p.persona_idx,
                )
              }
            />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold">추천 트랙</h2>
          <TrackListActions
            totalCount={filteredTracks.length}
            selectedCount={selectedTrackIds.size}
            onCreatePlaylist={() => setCreateOpen(true)}
          />
        </div>
        <div className="bg-card rounded-md border">
          {filteredTracks.map((t) => (
            <TrackListRow
              key={t.track_id}
              track={t}
              showPersonaScore
              checked={selectedTrackIds.has(t.track_id)}
              onCheckedChange={(v) => toggleSelect(t.track_id, v)}
            />
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">추천 앨범</h2>
          <div className="grid grid-cols-3 gap-3">
            {filteredAlbums.map((a) => (
              <div
                key={a.album_id}
                onClick={() => setAlbumModal(a.album_id)}
                className="cursor-pointer space-y-1"
              >
                <div className="aspect-square rounded bg-muted overflow-hidden">
                  {a.cover_url && (
                    <img src={a.cover_url} alt="" className="size-full object-cover" />
                  )}
                </div>
                <div className="text-xs font-medium truncate">{a.title}</div>
                <div className="text-xs text-muted-foreground truncate">{a.artist}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">추천 플레이리스트</h2>
          <div className="grid grid-cols-3 gap-3">
            {filteredPlaylists.map((p) => (
              <div
                key={p.id}
                onClick={() => setPlaylistModal(p.id)}
                className="cursor-pointer space-y-1"
              >
                <div className="aspect-square rounded bg-gradient-to-br from-indigo-400 to-violet-500" />
                <div className="text-xs font-medium truncate">{p.name}</div>
                <div className="text-xs text-muted-foreground">
                  {p.track_count}곡
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <CreatePlaylistModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        trackIds={Array.from(selectedTrackIds)}
        onCreated={() => {
          setSelectedTrackIds(new Set());
          // 페이지 새로고침해서 새 playlist 반영 (또는 client fetch)
          window.location.reload();
        }}
      />

      <AlbumDetailModal
        open={albumModal !== null}
        onOpenChange={(v) => !v && setAlbumModal(null)}
        albumId={albumModal}
      />

      <PlaylistDetailModal
        open={playlistModal !== null}
        onOpenChange={(v) => !v && setPlaylistModal(null)}
        playlistId={playlistModal}
      />
    </div>
  );
}
```

- [ ] **Step 3: 빌드 + 로컬 dev 확인**

```bash
cd "/Volumes/MacExtend 1/MRMS_FN/web"
pnpm tsc --noEmit 2>&1 | head -30
pnpm build 2>&1 | tail -5
```

Expected: 빌드 성공

- [ ] **Step 4: Commit**

```bash
cd "/Volumes/MacExtend 1/MRMS_FN"
git add web/src/app/\(dashboard\)/mrt/page.tsx \
        web/src/components/mrms/MrtDashboard.tsx
git commit -m "feat(web): MRT dashboard refactor — persona filter, multi-select, modals"
```

---

## Task 14: Player store — shuffle/repeat/like/pct/quality state

**Files:**
- Modify: `web/src/store/player.ts`

- [ ] **Step 1: state 추가**

기존 `PlayerState` 인터페이스에:
```typescript
interface PlayerState {
  // ... 기존 필드들
  shuffleMode: boolean;
  repeatMode: "off" | "all" | "one";
  currentTrackLiked: boolean;
  currentTrackPCT: boolean;
  audioQuality: string | null;
}
```

기본값에:
```typescript
shuffleMode: false,
repeatMode: "off",
currentTrackLiked: false,
currentTrackPCT: false,
audioQuality: null,
```

- [ ] **Step 2: Commit**

```bash
git add web/src/store/player.ts
git commit -m "feat(player): store state for shuffle/repeat/like/pct/quality"
```

---

## Task 15: NowPlaying — 앨범사진 + 음질배지

**Files:**
- Modify: `web/src/components/player/NowPlaying.tsx`

- [ ] **Step 1: 구현**

```typescript
"use client";

import { usePlayerStore } from "@/store/player";


export function NowPlaying({ className = "" }: { className?: string }) {
  const queue = usePlayerStore((s) => s.queue);
  const currentIdx = usePlayerStore((s) => s.currentIdx);
  const isPreview = usePlayerStore((s) => s.isPreview);
  const audioQuality = usePlayerStore((s) => s.audioQuality);
  const track = queue[currentIdx];

  if (!track) {
    return (
      <div className={`${className} text-sm text-muted-foreground truncate`}>
        재생 중인 곡 없음
      </div>
    );
  }

  return (
    <div className={`${className} flex items-center gap-3 min-w-0`}>
      <div className="size-12 rounded bg-muted overflow-hidden shrink-0">
        {track.album_cover && (
          <img src={track.album_cover} alt="" className="size-full object-cover" />
        )}
      </div>
      <div className="flex flex-col justify-center min-w-0 gap-0.5">
        <div className="flex items-center gap-2 min-w-0">
          <div className="truncate font-medium text-sm">{track.title}</div>
          {isPreview && (
            <span className="shrink-0 text-[10px] uppercase font-semibold rounded px-1.5 py-0.5 bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 tracking-wide">
              Preview
            </span>
          )}
          {audioQuality && !isPreview && (
            <span className="shrink-0 text-[10px] uppercase font-semibold rounded px-1.5 py-0.5 bg-primary/15 text-primary tracking-wide">
              {audioQuality}
            </span>
          )}
        </div>
        <div className="truncate text-xs text-muted-foreground">{track.artist}</div>
      </div>
    </div>
  );
}
```

> `track.album_cover` 필드가 QueueTrack 타입에 없으면 player store의 QueueTrack 타입에도 추가:
```typescript
// store/player.ts QueueTrack에
album_cover?: string | null;
```

- [ ] **Step 2: Commit**

```bash
git add web/src/components/player/NowPlaying.tsx web/src/store/player.ts
git commit -m "feat(player): NowPlaying with album art + quality badge"
```

---

## Task 16: PlayerControls — 셔플 + 반복

**Files:**
- Modify: `web/src/components/player/PlayerControls.tsx`

- [ ] **Step 1: 셔플 + 반복 버튼 추가**

기존 컨트롤 좌측에 셔플, 우측 끝에 반복 추가:
```typescript
import { Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward } from "lucide-react";

// 컴포넌트 내부에 추가:
const shuffleMode = usePlayerStore((s) => s.shuffleMode);
const repeatMode = usePlayerStore((s) => s.repeatMode);

const toggleShuffle = () => {
  usePlayerStore.setState({ shuffleMode: !shuffleMode });
};

const cycleRepeat = () => {
  const next = repeatMode === "off" ? "all" : repeatMode === "all" ? "one" : "off";
  usePlayerStore.setState({ repeatMode: next });
};

// JSX — prev 버튼 앞에:
<button
  aria-label="Shuffle"
  onClick={toggleShuffle}
  className={`inline-flex items-center justify-center h-8 w-8 rounded hover:bg-muted ${
    shuffleMode ? "text-primary" : "text-muted-foreground"
  }`}
>
  <Shuffle className="h-4 w-4" />
</button>

// next 버튼 다음에:
<button
  aria-label="Repeat"
  onClick={cycleRepeat}
  className={`inline-flex items-center justify-center h-8 w-8 rounded hover:bg-muted ${
    repeatMode !== "off" ? "text-primary" : "text-muted-foreground"
  }`}
>
  {repeatMode === "one" ? <Repeat1 className="h-4 w-4" /> : <Repeat className="h-4 w-4" />}
</button>
```

- [ ] **Step 2: Commit**

```bash
git add web/src/components/player/PlayerControls.tsx
git commit -m "feat(player): shuffle + repeat controls"
```

---

## Task 17: PlayerActions — 현재 트랙 ♥ + ✨

**Files:**
- Create: `web/src/components/player/PlayerActions.tsx`

- [ ] **Step 1: 구현**

```typescript
"use client";

import { useEffect } from "react";
import { Heart, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { fetchTrackState, toggleLike, togglePct } from "@/lib/api/user-tracks";
import { usePlayerStore } from "@/store/player";


export function PlayerActions() {
  const queue = usePlayerStore((s) => s.queue);
  const currentIdx = usePlayerStore((s) => s.currentIdx);
  const liked = usePlayerStore((s) => s.currentTrackLiked);
  const pct = usePlayerStore((s) => s.currentTrackPCT);
  const track = queue[currentIdx];

  // 트랙 변경 시 state fetch
  useEffect(() => {
    if (!track) return;
    fetchTrackState(track.track_id)
      .then((s) => {
        usePlayerStore.setState({
          currentTrackLiked: s.liked,
          currentTrackPCT: s.pct,
        });
      })
      .catch(() => {});
  }, [track?.track_id]);

  if (!track) return null;

  const onLike = async () => {
    const prev = liked;
    usePlayerStore.setState({ currentTrackLiked: !prev });
    try {
      const result = await toggleLike(track.track_id);
      usePlayerStore.setState({ currentTrackLiked: result });
    } catch {
      usePlayerStore.setState({ currentTrackLiked: prev, errorMsg: "좋아요 실패" });
    }
  };

  const onPct = async () => {
    const prev = pct;
    usePlayerStore.setState({ currentTrackPCT: !prev });
    try {
      const result = await togglePct(track.track_id);
      usePlayerStore.setState({ currentTrackPCT: result });
    } catch {
      usePlayerStore.setState({ currentTrackPCT: prev, errorMsg: "취향저격 실패" });
    }
  };

  return (
    <div className="flex items-center gap-1">
      <Button size="icon" variant="ghost" className="size-8" aria-label="좋아요" onClick={onLike}>
        <Heart className={`size-4 ${liked ? "fill-rose-500 text-rose-500" : "text-muted-foreground"}`} />
      </Button>
      <Button size="icon" variant="ghost" className="size-8" aria-label="취향저격" onClick={onPct}>
        <Sparkles className={`size-4 ${pct ? "fill-amber-500 text-amber-500" : "text-muted-foreground"}`} />
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/components/player/PlayerActions.tsx
git commit -m "feat(player): PlayerActions ♥/✨ for current track"
```

---

## Task 18: PlayerBar 레이아웃 통합

**Files:**
- Modify: `web/src/components/player/PlayerBar.tsx`

- [ ] **Step 1: PlayerActions 통합 + layout 조정**

```typescript
// PlayerBar 내부 JSX 수정:

<div className="flex items-center h-full px-2 md:px-4 gap-2 md:gap-4">
  <NowPlaying className="flex-1 min-w-0 max-w-[35%] md:max-w-[28%]" />
  <PlayerControls compact={true} />
  <div className="hidden md:flex items-center gap-2 shrink-0">
    <PlayerActions />
    <VolumeSlider />
    <QueueDrawer />
  </div>
</div>
```

import에 `PlayerActions` 추가.

- [ ] **Step 2: 빌드 + commit**

```bash
cd "/Volumes/MacExtend 1/MRMS_FN/web"
pnpm tsc --noEmit 2>&1 | head -20
pnpm build 2>&1 | tail -5
cd ..
git add web/src/components/player/PlayerBar.tsx
git commit -m "feat(player): integrate PlayerActions into PlayerBar layout"
```

---

## Task 19: Prod deploy + e2e verify

- [ ] **Step 1: laptop 전체 test**

```bash
cd "/Volumes/MacExtend 1/MRMS_FN"
source .venv/bin/activate
pytest --tb=short 2>&1 | tail -5
```

Expected: 모두 PASS

- [ ] **Step 2: laptop 빌드 검증**

```bash
cd web && pnpm tsc --noEmit && pnpm build 2>&1 | tail -5 && cd ..
```

- [ ] **Step 3: Push + prod deploy**

```bash
git push origin main
ssh jo@192.168.219.150 'sudo /opt/mrms/scripts/deploy.sh'
```

Expected: `✓ deployed`

- [ ] **Step 4: 본인 prod 브라우저로 e2e**

시크릿 창 → https://mrms.approid.team/mrt

체크리스트:
- [ ] Dashboard 레이아웃 (헤더 + 페르소나 + 추천 트랙 + 앨범 + 플레이리스트)
- [ ] 트랙 행에 ♥ ✨ ▶ 체크박스
- [ ] ♥ 토글 — 한 번 클릭 → 빨강. 다시 → 회색
- [ ] ✨ 토글 — 한 번 → 주황. 다시 → 회색
- [ ] ▶ — 플레이어에서 즉시 재생
- [ ] 체크박스 다중 선택 → "+ Playlist 만들기" 활성 → Modal → 이름 입력 → 만들기 → 추천 플레이리스트 섹션에 등장 (또는 새로고침 후)
- [ ] 앨범 클릭 → AlbumDetailModal → 안 트랙들 + "전체 재생"
- [ ] 플레이리스트 클릭 → PlaylistDetailModal → 동일
- [ ] 페르소나 카드 클릭 → 그 persona만 필터 (active ring)
- [ ] Player bar에 앨범 사진 표시
- [ ] 셔플 / 반복 버튼 토글 가능
- [ ] Player의 ♥ ✨ 토글 시 트랙 리스트에도 동기화 (Player 다음 트랙 재생 시)
- [ ] 음질 배지 표시 (Tidal Premium 시 HiFi 등)

- [ ] **Step 5: 본인 confirm**

이상 없으면 sub-project I 종료.

---

## Self-Review

**Spec coverage:**
- ✅ Section 3 Architecture → 전체 Task 들
- ✅ Section 4 Layout (lucide 아이콘, 행 레이아웃) → Task 8
- ✅ Section 5 Interactions (♥/✨/▶/multi-select/persona filter/album&playlist modal) → Task 8-13
- ✅ Section 6 Player 확장 → Task 14-18
- ✅ Section 7 Backend endpoints → Task 3-6
- ✅ Section 8 DB changes → Task 1, 2
- ✅ Section 9 File changes → 모든 task에 정확한 경로
- ✅ Section 10 Migration path → Task 1, 19
- ✅ Section 11 Testing → 각 task별 unit + Task 19 e2e

**Placeholder check:**
- "Album.coverUrl 컬럼 없으면..." 류 fallback 노트 있음 — 명시적 의도
- `Persona`에 `label` 필드 없으면 stub 처리 — 명시적

**Type consistency:**
- TrackInfo 정의 (Task 7) → TrackListRow (Task 8), AlbumDetailModal/PlaylistDetailModal (Task 11), MrtDashboard (Task 13)에서 동일 사용 ✓
- PlaylistInfo / AlbumInfo 동일 ✓
- TrackState (liked, pct) — fetchTrackState (Task 7) + PlayerActions (Task 17) 동일 사용 ✓
- QueueTrack에 `album_cover` 추가 — Task 15에서 명시

**Risks:**
- DB column 이름 (coverUrl vs cover_url, isCore vs is_core) 실제 schema 확인 후 일관성. Task 2, 3에서 명시.
- recsys/mrt.py의 정확한 함수 구조는 본인 코드 확인 후 통합 (Task 6)
- Player의 shuffle/repeat 실제 동작 (next 트랙 선택 로직)은 별도 — 일단 state만 추가, 동작은 follow-up
