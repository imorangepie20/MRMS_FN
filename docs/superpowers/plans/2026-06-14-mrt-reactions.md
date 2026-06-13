# MRT 4종 반응 (좋아요/취향저격/싫어요/관심없어요) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** MRT 추천 아이템(트랙·앨범)에 싫어요(영구 차단)·관심없어요(일시 숨김) 반응 + 풍선 툴팁을 더해, 반응하면 MRT에서 즉시 사라지고 추천에서 제외/숨김되게 한다. (좋아요·취향저격은 기존 like/pct 재사용.)

**Architecture:** `UserBlocked`(미사용 모델) 재사용 — `reason`('disliked'|'dismissed') 컬럼 추가 + `targetType='album'`. 부정 반응 = UserBlocked 1행. 제외 3지점: `mrt_latest`(disliked+dismissed display 제외) · `search_for_persona`(disliked 영구 제외) · `_run_regenerate_mrt`(dismissed 클리어). 이력(PlaylistHistory) 불변.

**Tech Stack:** Python·psycopg(raw SQL)·FastAPI; Next.js·lucide-react; 기존 `mrt_latest` owned 필터 + `user_tracks` like/pct 패턴.

**근거:** [ADR-003](../../decisions/ADR-003-mrt-reactions.md) · [spec](../specs/2026-06-14-mrt-reactions-design.md).

---

## File Structure

| 파일 | 책임 | 변경 |
|---|---|---|
| `prisma/migrations/20260614100000_add_userblocked_reason/migration.sql` | UserBlocked reason 컬럼 + unique | 신규 |
| `src/mrms/db/user_blocked.py` | block_target / clear_dismissed / blocked_track_ids | 신규 |
| `src/mrms/api/user_tracks.py` | dislike/dismiss × 트랙/앨범 엔드포인트 | 수정 |
| `src/mrms/api/main.py` | `mrt_latest`에 blocked 제외 | 수정 |
| `src/mrms/recsys/mrt.py` | `search_for_persona`에 disliked 제외 | 수정 |
| `src/mrms/emp/runner.py` | `_run_regenerate_mrt`에서 clear_dismissed | 수정 |
| `web/src/components/mrms/MrtDashboard.tsx`, `web/src/lib/api.ts` | 4 아이콘 + 툴팁 | 수정 |
| `tests/api/test_user_blocked.py`, `tests/api/test_reactions.py`, `tests/recsys/test_search_exclude.py` | 테스트 | 신규 |

**기존 사실:** `UserBlocked(id, userId, targetId, targetType, createdAt)` — `@@index([userId])`, unique 없음. `mrt_latest`는 `owned`(UserTrack) 집합으로 3지점 제외(main.py:201-291). `search_for_persona`는 `NOT IN (UserTrack)`만 제외.

---

## Task 1: UserBlocked 마이그레이션 + `db/user_blocked.py`

**Files:** Create `prisma/migrations/20260614100000_add_userblocked_reason/migration.sql`, `src/mrms/db/user_blocked.py`; Test `tests/api/test_user_blocked.py`.

- [ ] **Step 1: 마이그레이션 작성** — `prisma/migrations/20260614100000_add_userblocked_reason/migration.sql`:

```sql
ALTER TABLE "UserBlocked" ADD COLUMN IF NOT EXISTS reason TEXT NOT NULL DEFAULT 'disliked';
CREATE UNIQUE INDEX IF NOT EXISTS uniq_userblocked_target
  ON "UserBlocked"("userId", "targetId", "targetType");
```

- [ ] **Step 2: dev DB에 적용** (테스트가 dev DB 사용):

Run: `psql "$DATABASE_URL" -f prisma/migrations/20260614100000_add_userblocked_reason/migration.sql`
(`DATABASE_URL` 미설정 시 `export DATABASE_URL=postgresql://mrms:mrms@localhost:5433/mrms`.)
Expected: `ALTER TABLE` + `CREATE INDEX` (이미 있으면 NOTICE, 에러 없음).

- [ ] **Step 3: 실패 테스트 작성** — `tests/api/test_user_blocked.py`:

```python
"""UserBlocked DB ops — 부정 반응(disliked/dismissed) 저장/조회/클리어."""
from mrms.db.ids import stable_id as _id


def _seed_album_track(conn):
    """Artist + Album + 1 Track. (album_id, track_id) 반환."""
    aid = _id("test|ub|artist"); alid = _id("test|ub|album"); tid = _id("test|ub|track")
    with conn.cursor() as cur:
        cur.execute('INSERT INTO "Artist"(id,name,"nameNormalized") VALUES(%s,%s,%s) ON CONFLICT(id) DO NOTHING', (aid, "UB Artist", "ub artist"))
        cur.execute('INSERT INTO "Album"(id,title,"albumType","artistId") VALUES(%s,%s,%s,%s) ON CONFLICT(id) DO NOTHING', (alid, "UB Album", "album", aid))
        cur.execute('''INSERT INTO "Track"(id,isrc,title,"titleNormalized","durationMs","artistId","albumId")
                       VALUES(%s,%s,%s,%s,%s,%s,%s) ON CONFLICT(id) DO NOTHING''',
                    (tid, "UBISRC00000001", "ubtrk", "ubtrk", 1000, aid, alid))
    conn.commit()
    return alid, tid


def test_block_and_query(db_conn, cleanup):
    from mrms.db.user_blocked import block_target, blocked_track_ids, clear_dismissed
    uid = _id("test|ubuser")
    with db_conn.cursor() as cur:
        cur.execute('INSERT INTO "User"(id,email) VALUES(%s,%s) ON CONFLICT(id) DO NOTHING', (uid, "ub@auto.local"))
    db_conn.commit()
    album_id, track_id = _seed_album_track(db_conn)
    cleanup('DELETE FROM "UserBlocked" WHERE "userId"=%s', (uid,))

    # 트랙 dislike → blocked_track_ids(disliked)에 포함
    block_target(db_conn, uid, track_id, "track", "disliked")
    assert track_id in blocked_track_ids(db_conn, uid, ["disliked"])
    assert track_id in blocked_track_ids(db_conn, uid, ["disliked", "dismissed"])

    # 앨범 dismiss → 그 앨범 트랙이 dismissed 확장으로 잡힘
    block_target(db_conn, uid, album_id, "album", "dismissed")
    assert track_id in blocked_track_ids(db_conn, uid, ["dismissed"])  # album→track 확장

    # clear_dismissed → dismissed만 삭제, disliked 유지
    n = clear_dismissed(db_conn, uid)
    assert n == 1
    assert track_id in blocked_track_ids(db_conn, uid, ["disliked"])      # disliked 남음
    # 앨범 dismiss 사라짐 → dismissed-only 조회는 비어야(트랙 직접 disliked는 dismissed 아님)
    assert blocked_track_ids(db_conn, uid, ["dismissed"]) == set()


def test_block_target_upsert(db_conn, cleanup):
    from mrms.db.user_blocked import block_target, blocked_track_ids
    uid = _id("test|ubuser2")
    with db_conn.cursor() as cur:
        cur.execute('INSERT INTO "User"(id,email) VALUES(%s,%s) ON CONFLICT(id) DO NOTHING', (uid, "ub2@auto.local"))
    db_conn.commit()
    _, track_id = _seed_album_track(db_conn)
    cleanup('DELETE FROM "UserBlocked" WHERE "userId"=%s', (uid,))
    # dismiss 후 dislike로 바꾸면 같은 (userId,targetId,targetType) 행 reason 갱신(중복 X)
    block_target(db_conn, uid, track_id, "track", "dismissed")
    block_target(db_conn, uid, track_id, "track", "disliked")
    with db_conn.cursor() as cur:
        cur.execute('SELECT count(*), max(reason) FROM "UserBlocked" WHERE "userId"=%s AND "targetId"=%s', (uid, track_id))
        cnt, reason = cur.fetchone()
    assert cnt == 1 and reason == "disliked"
```

- [ ] **Step 4: 실패 확인** — `pytest tests/api/test_user_blocked.py -v` → FAIL (ImportError / no reason column이면 Step 2 적용 확인).

- [ ] **Step 5: 구현** — `src/mrms/db/user_blocked.py`:

```python
"""UserBlocked — 부정 반응(싫어요=disliked, 관심없어요=dismissed) DB ops."""
from __future__ import annotations

import psycopg

from mrms.db.ids import stable_id as _id


def block_target(
    conn: psycopg.Connection,
    user_id: str,
    target_id: str,
    target_type: str,   # 'track' | 'album'
    reason: str,        # 'disliked' | 'dismissed'
) -> None:
    """부정 반응 1행 upsert. (userId,targetId,targetType) 충돌 시 reason 갱신."""
    row_id = _id(f"blocked|{user_id}|{target_type}|{target_id}")
    with conn.cursor() as cur:
        cur.execute(
            '''INSERT INTO "UserBlocked" (id, "userId", "targetId", "targetType", reason)
               VALUES (%s, %s, %s, %s, %s)
               ON CONFLICT ("userId", "targetId", "targetType")
                 DO UPDATE SET reason = EXCLUDED.reason''',
            (row_id, user_id, target_id, target_type, reason),
        )
    conn.commit()


def clear_dismissed(conn: psycopg.Connection, user_id: str) -> int:
    """일시 숨김(dismissed) 행 전부 삭제. 삭제 수 반환. (재생성 후 호출)"""
    with conn.cursor() as cur:
        cur.execute(
            'DELETE FROM "UserBlocked" WHERE "userId" = %s AND reason = %s',
            (user_id, "dismissed"),
        )
        n = cur.rowcount
    conn.commit()
    return n


def blocked_track_ids(
    conn: psycopg.Connection, user_id: str, reasons: list[str]
) -> set[str]:
    """차단/숨김된 trackId 집합 — 트랙 직접 차단 ∪ 차단 앨범의 트랙."""
    with conn.cursor() as cur:
        cur.execute(
            '''SELECT "targetId" FROM "UserBlocked"
                 WHERE "userId" = %s AND "targetType" = 'track' AND reason = ANY(%s)
               UNION
               SELECT t.id FROM "Track" t
                 JOIN "UserBlocked" ub
                   ON ub."targetId" = t."albumId" AND ub."targetType" = 'album'
                 WHERE ub."userId" = %s AND ub.reason = ANY(%s)''',
            (user_id, reasons, user_id, reasons),
        )
        return {r[0] for r in cur.fetchall()}
```

- [ ] **Step 6: 통과 확인** — `pytest tests/api/test_user_blocked.py -v` → PASS (2 passed).

- [ ] **Step 7: 커밋** — `git add prisma/migrations/20260614100000_add_userblocked_reason src/mrms/db/user_blocked.py tests/api/test_user_blocked.py && git commit -m "feat(reactions): UserBlocked reason 컬럼 + db ops"` (body 끝 `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`).

---

## Task 2: 반응 엔드포인트 (dislike/dismiss × 트랙/앨범)

**Files:** Modify `src/mrms/api/user_tracks.py`; Test `tests/api/test_reactions.py`.

- [ ] **Step 1: 실패 테스트** — `tests/api/test_reactions.py` (auth fixture는 `tests/api/conftest.py`의 `login` 사용, `tests/api/test_pgt_move.py`의 `set_session_cookie`/`_seed_catalog_track` 패턴 참고):

```python
import uuid
from fastapi.testclient import TestClient
import pytest
from mrms.api.main import app
from mrms.db.ids import stable_id as _id

client = TestClient(app)


@pytest.fixture
def set_session_cookie(login):
    def _make(email):
        user_id, session_id = login(email)
        client.cookies.set("mrms_session", session_id)
        return user_id
    return _make


def _seed_track(conn):
    tag = uuid.uuid4().hex[:8]
    aid = _id(f"rx|a|{tag}"); alid = _id(f"rx|al|{tag}"); tid = _id(f"rx|t|{tag}")
    with conn.cursor() as cur:
        cur.execute('INSERT INTO "Artist"(id,name,"nameNormalized") VALUES(%s,%s,%s) ON CONFLICT(id) DO NOTHING', (aid, f"RX{tag}", f"rx{tag}"))
        cur.execute('INSERT INTO "Album"(id,title,"albumType","artistId") VALUES(%s,%s,%s,%s) ON CONFLICT(id) DO NOTHING', (alid, f"RXAL{tag}", "album", aid))
        cur.execute('''INSERT INTO "Track"(id,isrc,title,"titleNormalized","durationMs","artistId","albumId")
                       VALUES(%s,%s,%s,%s,%s,%s,%s) ON CONFLICT(id) DO NOTHING''',
                    (tid, f"RXISRC{tag.upper()}", "rxt", "rxt", 1000, aid, alid))
    conn.commit()
    return alid, tid


def test_track_dislike_dismiss(db_conn, set_session_cookie, cleanup):
    user_id = set_session_cookie(f"rx-{uuid.uuid4().hex[:6]}@test.com")
    album_id, track_id = _seed_track(db_conn)
    cleanup('DELETE FROM "UserBlocked" WHERE "userId"=%s', (user_id,))
    assert client.post(f"/api/user/tracks/{track_id}/dislike").json() == {"disliked": True}
    assert client.post(f"/api/user/tracks/{track_id}/dismiss").json() == {"dismissed": True}  # reason 갱신
    assert client.post(f"/api/user/tracks/album/{album_id}/dislike").json() == {"disliked": True}
    assert client.post(f"/api/user/tracks/album/{album_id}/dismiss").json() == {"dismissed": True}
    with db_conn.cursor() as cur:
        cur.execute('SELECT "targetType", reason FROM "UserBlocked" WHERE "userId"=%s ORDER BY "targetType"', (user_id,))
        rows = cur.fetchall()
    assert ("album", "dismissed") in rows and ("track", "dismissed") in rows
    client.cookies.clear()
```

- [ ] **Step 2: 실패 확인** — `pytest tests/api/test_reactions.py -v` → FAIL (404).

- [ ] **Step 3: 구현** — `src/mrms/api/user_tracks.py`에 추가 (상단에 `from mrms.db.user_blocked import block_target`):

```python
@router.post("/{track_id}/dislike")
def dislike_track(track_id: str, user_id: str = Depends(get_current_user_id), conn=Depends(db_conn)):
    """싫어요 — 트랙 영구 제외."""
    block_target(conn, user_id, track_id, "track", "disliked")
    return {"disliked": True}


@router.post("/{track_id}/dismiss")
def dismiss_track(track_id: str, user_id: str = Depends(get_current_user_id), conn=Depends(db_conn)):
    """관심없어요 — 트랙 일시 숨김."""
    block_target(conn, user_id, track_id, "track", "dismissed")
    return {"dismissed": True}


@router.post("/album/{album_id}/dislike")
def dislike_album(album_id: str, user_id: str = Depends(get_current_user_id), conn=Depends(db_conn)):
    """싫어요 — 앨범 영구 제외."""
    block_target(conn, user_id, album_id, "album", "disliked")
    return {"disliked": True}


@router.post("/album/{album_id}/dismiss")
def dismiss_album(album_id: str, user_id: str = Depends(get_current_user_id), conn=Depends(db_conn)):
    """관심없어요 — 앨범 일시 숨김."""
    block_target(conn, user_id, album_id, "album", "dismissed")
    return {"dismissed": True}
```

> 라우트 충돌 주의: 기존 `/album/{album_id}/collect`가 있으므로 `/album/{album_id}/dislike|dismiss`는 자연 공존. `/{track_id}/...`도 기존 like/pct와 동일 패턴.

- [ ] **Step 4: 통과 확인** — `pytest tests/api/test_reactions.py -v` → PASS.

- [ ] **Step 5: 커밋** — `git add src/mrms/api/user_tracks.py tests/api/test_reactions.py && git commit -m "feat(reactions): dislike/dismiss 엔드포인트 (트랙/앨범)"`.

---

## Task 3: `mrt_latest` blocked 제외 (표시)

**Files:** Modify `src/mrms/api/main.py`; Test `tests/api/test_reactions.py`.

- [ ] **Step 1: 실패 테스트** — `tests/api/test_reactions.py`에 추가. seed: 카탈로그 트랙(tidal TrackPlatform) + PlaylistHistory persona0 → `mrt/latest`에 노출 → dislike → 사라짐.

```python
from mrms.db.user_embedding import insert_playlist_history


def _seed_catalog_track_with_tp(conn):
    """tidal TrackPlatform 포함 — _fetch_track_metadata 통과용. (album_id, track_id)."""
    tag = uuid.uuid4().hex[:8]
    aid = _id(f"rxm|a|{tag}"); alid = _id(f"rxm|al|{tag}"); tid = _id(f"rxm|t|{tag}")
    with conn.cursor() as cur:
        cur.execute('INSERT INTO "Artist"(id,name,"nameNormalized") VALUES(%s,%s,%s) ON CONFLICT(id) DO NOTHING', (aid, f"RXM{tag}", f"rxm{tag}"))
        cur.execute('INSERT INTO "Album"(id,title,"albumType","artistId") VALUES(%s,%s,%s,%s) ON CONFLICT(id) DO NOTHING', (alid, f"RXMAL{tag}", "album", aid))
        cur.execute('''INSERT INTO "Track"(id,isrc,title,"titleNormalized","durationMs","artistId","albumId")
                       VALUES(%s,%s,%s,%s,%s,%s,%s) ON CONFLICT(id) DO NOTHING''',
                    (tid, f"RXMISRC{tag.upper()}", "rxmt", "rxmt", 210000, aid, alid))
        cur.execute('''INSERT INTO "TrackPlatform"(id,"trackId",platform,"platformTrackId")
                       VALUES(%s,%s,'tidal',%s) ON CONFLICT("trackId",platform) DO NOTHING''',
                    (_id(f"rxm|tp|{tag}"), tid, f"tidal-{tag}"))
    conn.commit()
    return alid, tid


def test_disliked_track_excluded_from_mrt(db_conn, set_session_cookie, cleanup):
    user_id = set_session_cookie(f"rxm-{uuid.uuid4().hex[:6]}@test.com")
    album_id, track_id = _seed_catalog_track_with_tp(db_conn)
    cleanup('DELETE FROM "UserBlocked" WHERE "userId"=%s', (user_id,))
    cleanup('DELETE FROM "PlaylistHistory" WHERE "userId"=%s', (user_id,))
    insert_playlist_history(db_conn, user_id, [track_id], "our-v1.0+persona-K3",
                            context={"personaIdx": 0, "kind": "persona", "scores": [0.9]})
    db_conn.commit()
    assert track_id in [t["track_id"] for t in client.get("/api/mrt/latest").json()["recommended_tracks"]]
    client.post(f"/api/user/tracks/{track_id}/dislike")
    body = client.get("/api/mrt/latest").json()
    assert track_id not in [t["track_id"] for t in body["recommended_tracks"]]
    assert album_id not in [a["album_id"] for a in body["recommended_albums"]]
    client.cookies.clear()
```

- [ ] **Step 2: 실패 확인** — `pytest tests/api/test_reactions.py::test_disliked_track_excluded_from_mrt -v` → FAIL (여전히 노출).

- [ ] **Step 3: 구현** — `src/mrms/api/main.py` `mrt_latest`: `owned` 계산 블록(201-209) 직후에 blocked 합산:

```python
    # 싫어요(disliked)/관심없어요(dismissed) 반응한 트랙·앨범도 표시에서 제외
    from mrms.db.user_blocked import blocked_track_ids
    blocked = blocked_track_ids(conn, user_id, ["disliked", "dismissed"]) if all_track_ids else set()
    hidden = owned | blocked
```
그리고 기존 `owned` 제외 3지점을 `hidden`으로 교체:
- 226행 `if tid in owned:` → `if tid in hidden:`
- 287행 `... and r["track_id"] not in owned` → `... and r["track_id"] not in hidden`
- 291행 `... if tid not in owned}` → `... if tid not in hidden}`

(`owned` 자체는 그대로 두고 `hidden = owned | blocked`를 만들어 3지점만 hidden 참조.)

- [ ] **Step 4: 통과 확인** — `pytest tests/api/test_reactions.py tests/api/test_pgt_move.py tests/api/test_onboarding.py -v` → 전부 PASS(기존 이동/MRT 회귀 없음).

- [ ] **Step 5: 커밋** — `git add src/mrms/api/main.py tests/api/test_reactions.py && git commit -m "feat(reactions): mrt_latest에서 차단/숨김 트랙·앨범 제외"`.

---

## Task 4: `search_for_persona` disliked 영구 제외

**Files:** Modify `src/mrms/recsys/mrt.py`; Test `tests/recsys/test_search_exclude.py`.

- [ ] **Step 1: 실패 테스트** — `tests/recsys/test_search_exclude.py`: 임베딩 보유 카탈로그 트랙 2개 seed → 하나를 `block_target(disliked)` → `search_for_persona`가 disliked 트랙은 결과에서 제외, dismissed는 제외 안 함.

```python
import numpy as np
from pgvector.psycopg import register_vector
from mrms.db.ids import stable_id as _id
from mrms.config import EMBEDDING_MODEL_VERSION

CATALOG = EMBEDDING_MODEL_VERSION


def _seed_emb_track(conn, i):
    """inEmp + TrackEmbedding 보유 카탈로그 트랙. track_id 반환."""
    register_vector(conn)
    aid = _id("test|se|artist")
    with conn.cursor() as cur:
        cur.execute('INSERT INTO "Artist"(id,name,"nameNormalized") VALUES(%s,%s,%s) ON CONFLICT(id) DO NOTHING', (aid, "SE", "se"))
        tid = _id(f"test|se|track|{i}")
        cur.execute('''INSERT INTO "Track"(id,isrc,title,"titleNormalized","durationMs","artistId","inEmp")
                       VALUES(%s,%s,%s,%s,%s,%s,TRUE) ON CONFLICT(id) DO NOTHING''',
                    (tid, f"SEISRC{i:08d}", f"se{i}", f"se{i}", 1000, aid))
        vec = np.zeros(256, dtype=np.float32); vec[i % 256] = 1.0
        cur.execute('''INSERT INTO "TrackEmbedding"(id,"trackId","modelVersion",embedding,pooling,"audioSource")
                       VALUES(%s,%s,%s,%s,%s,%s) ON CONFLICT("trackId","modelVersion") DO NOTHING''',
                    (_id(f"se|te|{tid}"), tid, CATALOG, vec, "attention", "mp3_30s"))
    conn.commit()
    return tid, vec


def test_search_excludes_disliked(db_conn, cleanup):
    from mrms.recsys.mrt import search_for_persona
    from mrms.db.user_blocked import block_target
    uid = _id("test|seuser")
    with db_conn.cursor() as cur:
        cur.execute('INSERT INTO "User"(id,email) VALUES(%s,%s) ON CONFLICT(id) DO NOTHING', (uid, "se@auto.local"))
    db_conn.commit()
    t0, v0 = _seed_emb_track(db_conn, 0)
    t1, _ = _seed_emb_track(db_conn, 1)
    cleanup('DELETE FROM "UserBlocked" WHERE "userId"=%s', (uid,))
    # v0 centroid로 검색하면 t0가 최상위 — 그런데 t0를 disliked하면 결과에서 빠짐
    block_target(db_conn, uid, t0, "track", "disliked")
    res = search_for_persona(db_conn, uid, v0, catalog_model_version=CATALOG, candidate_pool=50, top_n=50)
    ids = [r["track_id"] for r in res]
    assert t0 not in ids        # disliked → 영구 제외
    # dismissed는 search에서 제외 안 됨 (다음 generation 재추천 가능)
    block_target(db_conn, uid, t1, "track", "dismissed")
    res2 = search_for_persona(db_conn, uid, v0, catalog_model_version=CATALOG, candidate_pool=50, top_n=50)
    assert t1 in [r["track_id"] for r in res2]   # dismissed는 search 통과
    cleanup('DELETE FROM "UserBlocked" WHERE "userId"=%s', (uid,))
```

- [ ] **Step 2: 실패 확인** — `pytest tests/recsys/test_search_exclude.py -v` → FAIL (t0 still in results).

- [ ] **Step 3: 구현** — `src/mrms/recsys/mrt.py` `search_for_persona`의 SQL에서 기존 `AND t.id NOT IN (SELECT "trackId" FROM "UserTrack" WHERE "userId" = %s)` 바로 다음에 disliked 제외 추가:

```python
                 AND t.id NOT IN (
                   SELECT "trackId" FROM "UserTrack" WHERE "userId" = %s
                 )
                 AND t.id NOT IN (
                   SELECT "targetId" FROM "UserBlocked"
                     WHERE "userId" = %s AND "targetType" = 'track' AND reason = 'disliked'
                   UNION
                   SELECT tt.id FROM "Track" tt
                     JOIN "UserBlocked" ub
                       ON ub."targetId" = tt."albumId" AND ub."targetType" = 'album'
                     WHERE ub."userId" = %s AND ub.reason = 'disliked'
                 )
```
그리고 `cur.execute(sql, (...))`의 파라미터 튜플에 user_id 2개 추가 — 기존 `(centroid_np, catalog_model_version, user_id, centroid_np, candidate_pool)`을 **`(centroid_np, catalog_model_version, user_id, user_id, user_id, centroid_np, candidate_pool)`**로 (새 subquery의 %s 2개가 기존 user_id %s 다음, ORDER BY 앞에 위치).

- [ ] **Step 4: 통과 확인** — `pytest tests/recsys/test_search_exclude.py tests/recsys/test_user_mrt.py -v` → PASS(기존 MRT 생성 회귀 없음).

- [ ] **Step 5: 커밋** — `git add src/mrms/recsys/mrt.py tests/recsys/test_search_exclude.py && git commit -m "feat(reactions): search_for_persona에서 disliked 영구 제외"`.

---

## Task 5: `_run_regenerate_mrt`에서 `clear_dismissed`

**Files:** Modify `src/mrms/emp/runner.py`; Test `tests/emp/test_runner.py`.

- [ ] **Step 1: 실패 테스트** — `tests/emp/test_runner.py`에 추가 (monkeypatch 패턴은 기존 `test_regenerate_calls_prune` 참고):

```python
def test_regenerate_clears_dismissed(db_conn, monkeypatch):
    import mrms.recsys.mrt as mrt
    import mrms.db.user_embedding as ue
    import mrms.db.user_blocked as ub
    monkeypatch.setattr(mrt, "select_stale_mrt_users", lambda conn, **k: ["u1"])
    monkeypatch.setattr(mrt, "generate_user_mrt", lambda conn, uid, **k: 5)
    monkeypatch.setattr(ue, "prune_playlist_history", lambda conn, uid, **k: 0)
    cleared = []
    monkeypatch.setattr(ub, "clear_dismissed", lambda conn, uid: cleared.append(uid) or 0)
    from mrms.emp.runner import _run_regenerate_mrt
    _run_regenerate_mrt(db_conn)
    assert cleared == ["u1"]
```

- [ ] **Step 2: 실패 확인** — `pytest tests/emp/test_runner.py::test_regenerate_clears_dismissed -v` → FAIL.

- [ ] **Step 3: 구현** — `src/mrms/emp/runner.py` `_run_regenerate_mrt`: 기존 local import에 `clear_dismissed` 추가, 재생성 성공 + prune 직후 호출:

```python
    from mrms.db.user_blocked import clear_dismissed
    from mrms.db.user_embedding import prune_playlist_history
    from mrms.recsys.mrt import generate_user_mrt, select_stale_mrt_users
    # ...
    for uid in users:
        try:
            if generate_user_mrt(conn, uid) is not None:
                conn.commit()
                prune_playlist_history(conn, uid)
                clear_dismissed(conn, uid)   # 일시 숨김 리셋 → 다음 generation 재추천 가능
                regenerated += 1
        except Exception:
            safe_rollback(conn)
            failed += 1
```

- [ ] **Step 4: 통과 확인** — `pytest tests/emp/test_runner.py -v` → PASS(기존 runner 테스트 회귀 없음).

- [ ] **Step 5: 커밋** — `git add src/mrms/emp/runner.py tests/emp/test_runner.py && git commit -m "feat(reactions): regenerate_mrt에서 dismissed 클리어"`.

---

## Task 6: 프론트 — MRT 4 아이콘 + 풍선 툴팁

**Files:** Modify `web/src/components/mrms/MrtDashboard.tsx`, `web/src/lib/api.ts`.

> **패턴:** PGT Task 6에서 추가한 `collectAlbum` + 앨범 버튼, 그리고 기존 `TrackRow`의 Heart(like)/Sparkles(pct) 토글을 그대로 미러. 새 아이콘은 lucide-react `ThumbsDown`(싫어요)/`EyeOff`(관심없어요). 새 디자인 만들지 말고 기존 아이콘 버튼 스타일 재사용.

- [ ] **Step 1: api.ts** — POST 헬퍼 4개 추가 (기존 like/pct/`collectAlbum` 패턴, `fetchJson` method POST):
```ts
export const dislikeTrack = (id: string) => fetchJson(`/user/tracks/${id}/dislike`, { method: "POST" });
export const dismissTrack = (id: string) => fetchJson(`/user/tracks/${id}/dismiss`, { method: "POST" });
export const dislikeAlbum = (id: string) => fetchJson(`/user/tracks/album/${id}/dislike`, { method: "POST" });
export const dismissAlbum = (id: string) => fetchJson(`/user/tracks/album/${id}/dismiss`, { method: "POST" });
```
(경로 prefix는 기존 like/pct 호출과 동일하게 맞출 것 — `fetchJson`이 `/api`를 붙이는지 확인.)

- [ ] **Step 2: MrtDashboard 트랙 행** — `TrackRow`의 Heart/Sparkles 버튼 옆에 `ThumbsDown`(싫어요)·`EyeOff`(관심없어요) 추가. 클릭 → 해당 endpoint → MRT 재fetch(아이템 사라짐; PGT Task 6에서 like 후 `window.location.reload()` 또는 재fetch한 방식과 동일하게). 각 버튼에 **`title` 풍선 툴팁**:
  - Heart `title="좋아요 · 라이브러리에 담기"`, Sparkles `title="취향저격 · 핵심 취향(PCT)에 추가"`, ThumbsDown `title="싫어요 · 추천에서 영구 제외"`, EyeOff `title="관심없어요 · 이번 추천에서 숨기기"`.

- [ ] **Step 3: MrtDashboard 앨범 행** — 기존 담기 버튼 옆에 싫어요/관심없어요(앨범) 버튼 + 동일 툴팁(앨범 문구), 클릭 → `dislikeAlbum`/`dismissAlbum` → 재fetch.

- [ ] **Step 4: 빌드 확인** — `cd web && npx tsc --noEmit` → 0 errors (필요시 `npm run build`).

- [ ] **Step 5: 커밋** — `git add web/src/components/mrms/MrtDashboard.tsx web/src/lib/api.ts && git commit -m "feat(reactions): MRT 4 아이콘(좋아요/취향저격/싫어요/관심없어요) + 풍선 툴팁"`.

---

## Task 7: 전체 회귀 + 문서

- [ ] **Step 1: 회귀** — `pytest tests/api/test_user_blocked.py tests/api/test_reactions.py tests/recsys/test_search_exclude.py tests/recsys/test_user_mrt.py tests/emp/test_runner.py tests/api/test_pgt_move.py tests/api/test_onboarding.py -q` → 전부 PASS. + `cd web && npx tsc --noEmit` → 0.
- [ ] **Step 2: ADR-003 상태 갱신** — `## 상태`를 `승인 — 구현 완료 (2026-06-14). UserBlocked reason + 반응 엔드포인트 + 제외 3지점 + 프론트 4 아이콘.`
- [ ] **Step 3: 커밋** — `git add docs/decisions/ADR-003-mrt-reactions.md && git commit -m "docs: ADR-003 구현 완료"`.

---

## Self-Review

**1. Spec coverage** ([spec](../specs/2026-06-14-mrt-reactions-design.md)):
- §3.1 UserBlocked reason + unique + targetType=album → Task 1 ✓
- §3.2 제외 3지점: mrt_latest(둘 다)=Task 3 ✓, search(disliked)=Task 4 ✓, regenerate(clear dismissed)=Task 5 ✓
- §3.3 반응 엔드포인트(dislike/dismiss × 트랙/앨범) → Task 2 ✓
- §3.4 프론트 4 아이콘 + 툴팁 → Task 6 ✓
- §6 테스트(blocked ops·이동/제외·일시숨김 사이클·API) → Task 1·2·3·4·5 ✓

**2. Placeholder scan:** 백엔드 step 전부 완전 코드 + 정확 명령. 프론트(Task 6)는 PGT Task 6/기존 TrackRow 패턴 참조 + 정확한 endpoint/툴팁 문구 명시(템플릿 UI 재사용이라 전량 코드 대신 구조).

**3. Type consistency:** `block_target(conn, user_id, target_id, target_type, reason)` / `clear_dismissed(conn, user_id)->int` / `blocked_track_ids(conn, user_id, reasons)->set[str]` 시그니처가 Task 1↔3↔4↔5 일관. mrt_latest의 `hidden = owned | blocked` 3지점 일관. search_for_persona 파라미터 튜플 user_id 2개 추가 위치 명시.

**열린 항목(spec §4):** 부정신호 ML반영·차단관리 UI·아티스트 차단 = 후속(범위 밖).
