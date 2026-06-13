# PGT 라이브러리 + MRT 큐레이션 (A 범위) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사용자가 MRT 추천을 PGT(내 라이브러리)로 이동하고, PGT를 Liked·Playlists·Albums·Artists·PCT 5섹션으로 탐색하며, MRT는 이동·prune으로 누적을 막는다. (A 범위 — import/스키마 변경 0, 기존 인프라 재사용.)

**Architecture:** 백엔드 `pgt.py` 신규(UserTrack 파생 섹션 + 기존 Playlist 테이블 재사용); `mrt_latest`에 UserTrack 제외 필터(이동); 앨범 collect + `prune_playlist_history`. 프론트 `/library` 화면. 기존 `user_tracks`(like/pct)·`db.playlist`·`get_user_track_states`·`_fetch_track_metadata` 재사용.

**Tech Stack:** Python·psycopg(raw SQL)·FastAPI; Next.js(App Router)·기존 MrtDashboard 패턴.

**근거:** [ADR-002](../../decisions/ADR-002-pgt-library-mrt-curation.md) · [spec](../specs/2026-06-13-pgt-library-mrt-curation-design.md). 범위 결정: **A**(import/스키마 변경 0; 임포트 플리 1급 모델링은 후속 **B**).

---

## File Structure

| 파일 | 책임 | 변경 |
|---|---|---|
| `src/mrms/db/pgt.py` | PGT 섹션 파생 쿼리(liked/pct/albums/artists/imported-playlists) | 신규 |
| `src/mrms/api/pgt.py` | PGT 섹션 API 라우터 | 신규 |
| `src/mrms/api/main.py` | pgt 라우터 등록 + `mrt_latest` 이동 필터 | 수정 |
| `src/mrms/api/user_tracks.py` | 앨범 collect 엔드포인트 추가 | 수정 |
| `src/mrms/db/user_embedding.py` | `prune_playlist_history` | 수정(추가) |
| `src/mrms/emp/runner.py` | `regenerate_mrt`에서 prune 호출 | 수정 |
| `web/src/app/(dashboard)/library/page.tsx`, `web/src/components/.../PgtLibrary.tsx` | PGT 5섹션 화면 | 신규 |
| `web/src/lib/api.ts`, `types.ts` | PGT API 클라이언트 + 타입 | 수정 |
| `tests/api/test_pgt.py`, `tests/api/test_pgt_move.py`, `tests/recsys/test_prune.py` | 테스트 | 신규 |

**재사용 헬퍼:** `db.playlist.list_user_playlists/get_playlist_tracks`(사용자생성 플리), `db.user_track.get_user_track_states`(liked/pct 벌크), `db.user_embedding.fetch_latest_playlists`.

**UserTrack 컬럼:** id, userId, trackId, isCore, source, platform, addedAt. `UNIQUE(userId, trackId)`.

---

## PART 1 — PGT 섹션 API + 화면

### Task 1: PGT 파생 섹션 쿼리 (`db/pgt.py`)

**Files:** Create `src/mrms/db/pgt.py`; Test `tests/api/test_pgt.py`.

공통 트랙-행 SELECT는 `db.playlist.get_playlist_tracks`와 동일 컬럼(track_id/title/artist/album_id/album_title/tidal_track_id/spotify_track_id/duration_ms)을 따른다.

- [ ] **Step 1: 실패 테스트** — `tests/api/test_pgt.py` (DB fixture seed):

```python
"""PGT 파생 섹션 쿼리."""
from mrms.db.ids import stable_id as _id


def _seed(conn):
    """User + Artist + Album + 3 Track + UserTrack(liked/pct/playlist) 시드."""
    uid = _id("test|pgtuser")
    aid = _id("test|pgtartist"); alid = _id("test|pgtalbum")
    with conn.cursor() as cur:
        cur.execute('INSERT INTO "User"(id,email) VALUES(%s,%s) ON CONFLICT(id) DO NOTHING', (uid, "pgt@auto.local"))
        cur.execute('INSERT INTO "Artist"(id,name,"nameNormalized") VALUES(%s,%s,%s) ON CONFLICT(id) DO NOTHING', (aid, "PGT Artist", "pgt artist"))
        cur.execute('INSERT INTO "Album"(id,title,"albumType","artistId") VALUES(%s,%s,%s,%s) ON CONFLICT(id) DO NOTHING', (alid, "PGT Album", "album", aid))
        for i, (src, core) in enumerate([("liked", False), ("liked", True), ("playlist:My Mix", False)]):
            tid = _id(f"test|pgttrack|{i}")
            cur.execute('''INSERT INTO "Track"(id,isrc,title,"titleNormalized","durationMs","artistId","albumId")
                           VALUES(%s,%s,%s,%s,%s,%s,%s) ON CONFLICT(id) DO NOTHING''',
                        (tid, f"PGTISRC{i:08d}", f"trk{i}", f"trk{i}", 1000, aid, alid))
            cur.execute('''INSERT INTO "UserTrack"(id,"userId","trackId","isCore",source,platform)
                           VALUES(%s,%s,%s,%s,%s,'mrms') ON CONFLICT("userId","trackId") DO NOTHING''',
                        (_id(f"ut|{uid}|{tid}"), uid, tid, core, src))
    conn.commit()
    return uid


def test_pgt_sections(db_conn, cleanup):
    from mrms.db.pgt import (section_liked, section_pct, section_albums,
                             section_artists, section_imported_playlists)
    uid = _seed(db_conn)
    assert len(section_liked(db_conn, uid)) == 2            # 2 liked
    assert len(section_pct(db_conn, uid)) == 1              # 1 isCore
    albums = section_albums(db_conn, uid)
    assert len(albums) == 1 and albums[0]["track_count"] == 3
    artists = section_artists(db_conn, uid)
    assert len(artists) == 1 and artists[0]["track_count"] == 3
    groups = section_imported_playlists(db_conn, uid)
    assert any(g["name"] == "My Mix" and g["track_count"] == 1 for g in groups)
    cleanup('DELETE FROM "UserTrack" WHERE "userId"=%s', (uid,))
```

- [ ] **Step 2: 실패 확인** — `pytest tests/api/test_pgt.py -v` → FAIL (ImportError).

- [ ] **Step 3: 구현** — `src/mrms/db/pgt.py`:

```python
"""PGT 섹션 파생 쿼리 — UserTrack 위의 필터/그룹핑."""
from __future__ import annotations

import psycopg

_TRACK_COLS = '''t.id, t.title, a.name AS artist, al.id, al.title,
                 tp_t."platformTrackId", tp_s."platformTrackId", t."durationMs"'''
_TRACK_JOINS = '''FROM "UserTrack" ut
                  JOIN "Track" t ON t.id = ut."trackId"
                  JOIN "Artist" a ON a.id = t."artistId"
                  LEFT JOIN "Album" al ON al.id = t."albumId"
                  LEFT JOIN "TrackPlatform" tp_t ON tp_t."trackId"=t.id AND tp_t.platform='tidal'
                  LEFT JOIN "TrackPlatform" tp_s ON tp_s."trackId"=t.id AND tp_s.platform='spotify' '''


def _rows_to_tracks(rows) -> list[dict]:
    return [{"track_id": r[0], "title": r[1], "artist": r[2], "album_id": r[3],
             "album_title": r[4], "tidal_track_id": r[5], "spotify_track_id": r[6],
             "duration_ms": r[7]} for r in rows]


def _track_section(conn, user_id, where_extra, params) -> list[dict]:
    with conn.cursor() as cur:
        cur.execute(f'SELECT {_TRACK_COLS} {_TRACK_JOINS} WHERE ut."userId"=%s {where_extra} ORDER BY ut."addedAt" DESC',
                    (user_id, *params))
        return _rows_to_tracks(cur.fetchall())


def section_liked(conn: psycopg.Connection, user_id: str) -> list[dict]:
    return _track_section(conn, user_id, "AND ut.source='liked'", ())


def section_pct(conn: psycopg.Connection, user_id: str) -> list[dict]:
    return _track_section(conn, user_id, 'AND ut."isCore"=TRUE', ())


def section_albums(conn: psycopg.Connection, user_id: str) -> list[dict]:
    with conn.cursor() as cur:
        cur.execute('''SELECT al.id, al.title, a.name AS artist, COUNT(*) AS track_count
                       FROM "UserTrack" ut
                       JOIN "Track" t ON t.id=ut."trackId"
                       JOIN "Album" al ON al.id=t."albumId"
                       JOIN "Artist" a ON a.id=al."artistId"
                       WHERE ut."userId"=%s GROUP BY al.id, al.title, a.name
                       ORDER BY track_count DESC''', (user_id,))
        return [{"album_id": r[0], "title": r[1], "artist": r[2], "track_count": r[3]}
                for r in cur.fetchall()]


def section_artists(conn: psycopg.Connection, user_id: str) -> list[dict]:
    with conn.cursor() as cur:
        cur.execute('''SELECT a.id, a.name, COUNT(*) AS track_count
                       FROM "UserTrack" ut
                       JOIN "Track" t ON t.id=ut."trackId"
                       JOIN "Artist" a ON a.id=t."artistId"
                       WHERE ut."userId"=%s GROUP BY a.id, a.name
                       ORDER BY track_count DESC''', (user_id,))
        return [{"artist_id": r[0], "name": r[1], "track_count": r[2]} for r in cur.fetchall()]


def section_imported_playlists(conn: psycopg.Connection, user_id: str) -> list[dict]:
    """source LIKE 'playlist%' 그룹. 'playlist:이름'→이름, 'playlist'→'Imported'."""
    with conn.cursor() as cur:
        cur.execute('''SELECT ut.source, COUNT(*) FROM "UserTrack" ut
                       WHERE ut."userId"=%s AND ut.source LIKE 'playlist%%'
                       GROUP BY ut.source ORDER BY 2 DESC''', (user_id,))
        out = []
        for source, cnt in cur.fetchall():
            name = source.split(":", 1)[1] if ":" in source else "Imported"
            out.append({"source": source, "name": name, "track_count": cnt})
        return out


def album_tracks(conn: psycopg.Connection, user_id: str, album_id: str) -> list[dict]:
    return _track_section(conn, user_id, 'AND t."albumId"=%s', (album_id,))


def artist_tracks(conn: psycopg.Connection, user_id: str, artist_id: str) -> list[dict]:
    return _track_section(conn, user_id, 'AND t."artistId"=%s', (artist_id,))


def imported_playlist_tracks(conn: psycopg.Connection, user_id: str, source: str) -> list[dict]:
    return _track_section(conn, user_id, "AND ut.source=%s", (source,))
```

- [ ] **Step 4: 통과 확인** — `pytest tests/api/test_pgt.py -v` → PASS.

- [ ] **Step 5: 커밋** — `git add src/mrms/db/pgt.py tests/api/test_pgt.py && git commit -m "feat(pgt): UserTrack 파생 섹션 쿼리"` (commit body 끝 `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`).

### Task 2: PGT API 라우터 (`api/pgt.py`)

**Files:** Create `src/mrms/api/pgt.py`; Modify `src/mrms/api/main.py`; Test `tests/api/test_pgt_api.py`.

- [ ] **Step 1: 실패 테스트** — `tests/api/test_pgt_api.py` (기존 `tests/api/conftest.py`의 `client`/`set_session_cookie`/`login_user` 패턴 사용 — `tests/api/test_auth_tidal.py` 참고). 핵심 assert: `GET /api/pgt/sections`가 5섹션 카운트, `GET /api/pgt/liked`가 리스트 반환.

```python
def test_pgt_sections_endpoint(db_conn, client, login_user):
    user_id, cookies = login_user(db_conn, "pgt-api@test.com")
    r = client.get("/api/pgt/sections", cookies=cookies)
    assert r.status_code == 200
    body = r.json()
    for key in ("liked", "pct", "albums", "artists", "imported_playlists", "user_playlists"):
        assert key in body
```

- [ ] **Step 2: 실패 확인** — `pytest tests/api/test_pgt_api.py -v` → FAIL (404).

- [ ] **Step 3: 구현** — `src/mrms/api/pgt.py`:

```python
"""PGT 라이브러리 섹션 API — 파생 섹션 + 사용자 플레이리스트 재사용."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from mrms.api.deps import db_conn, get_current_user_id
from mrms.db import pgt as pgt_db
from mrms.db.playlist import list_user_playlists, get_playlist, get_playlist_tracks
from mrms.db.user_track import get_user_track_states

router = APIRouter(prefix="/api/pgt", tags=["pgt"])


def _with_states(conn, user_id, tracks):
    states = get_user_track_states(conn, user_id, [t["track_id"] for t in tracks])
    for t in tracks:
        t["liked"], t["pct"] = states.get(t["track_id"], (False, False))
    return tracks


@router.get("/sections")
def sections(user_id: str = Depends(get_current_user_id), conn=Depends(db_conn)):
    return {
        "liked": len(pgt_db.section_liked(conn, user_id)),
        "pct": len(pgt_db.section_pct(conn, user_id)),
        "albums": len(pgt_db.section_albums(conn, user_id)),
        "artists": len(pgt_db.section_artists(conn, user_id)),
        "imported_playlists": pgt_db.section_imported_playlists(conn, user_id),
        "user_playlists": list_user_playlists(conn, user_id),
    }


@router.get("/liked")
def liked(user_id: str = Depends(get_current_user_id), conn=Depends(db_conn)):
    return {"tracks": _with_states(conn, user_id, pgt_db.section_liked(conn, user_id))}


@router.get("/pct")
def pct(user_id: str = Depends(get_current_user_id), conn=Depends(db_conn)):
    return {"tracks": _with_states(conn, user_id, pgt_db.section_pct(conn, user_id))}


@router.get("/albums")
def albums(user_id: str = Depends(get_current_user_id), conn=Depends(db_conn)):
    return {"albums": pgt_db.section_albums(conn, user_id)}


@router.get("/albums/{album_id}")
def album_tracks(album_id: str, user_id: str = Depends(get_current_user_id), conn=Depends(db_conn)):
    return {"tracks": _with_states(conn, user_id, pgt_db.album_tracks(conn, user_id, album_id))}


@router.get("/artists")
def artists(user_id: str = Depends(get_current_user_id), conn=Depends(db_conn)):
    return {"artists": pgt_db.section_artists(conn, user_id)}


@router.get("/artists/{artist_id}")
def artist_tracks(artist_id: str, user_id: str = Depends(get_current_user_id), conn=Depends(db_conn)):
    return {"tracks": _with_states(conn, user_id, pgt_db.artist_tracks(conn, user_id, artist_id))}


@router.get("/imported-playlists")
def imported_playlists(user_id: str = Depends(get_current_user_id), conn=Depends(db_conn)):
    return {"playlists": pgt_db.section_imported_playlists(conn, user_id)}


@router.get("/imported-playlists/tracks")
def imported_playlist_tracks(source: str, user_id: str = Depends(get_current_user_id), conn=Depends(db_conn)):
    return {"tracks": _with_states(conn, user_id, pgt_db.imported_playlist_tracks(conn, user_id, source))}
```

`src/mrms/api/main.py`에 등록 (다른 `app.include_router(...)` 옆):
```python
from mrms.api.pgt import router as pgt_router
# ...
app.include_router(pgt_router)
```

- [ ] **Step 4: 통과 확인** — `pytest tests/api/test_pgt_api.py -v` → PASS.

- [ ] **Step 5: 커밋** — `git add src/mrms/api/pgt.py src/mrms/api/main.py tests/api/test_pgt_api.py && git commit -m "feat(pgt): 섹션 API 라우터 + 등록"`.

### Task 3: `/library` 프론트 화면

**Files:** Create `web/src/app/(dashboard)/library/page.tsx`, `web/src/components/mrms/PgtLibrary.tsx`; Modify `web/src/lib/api.ts`, `web/src/lib/types.ts`.

> **패턴:** 기존 `web/src/components/mrms/MrtDashboard.tsx`(섹션·트랙행·like/pct 토글 호출)와 `web/src/app/(dashboard)/mrt/page.tsx`를 그대로 미러. 새 시각 컴포넌트 만들지 말고 기존 트랙-행/토글/탭 스타일 재사용.

- [ ] **Step 1: API 클라이언트 + 타입** — `web/src/lib/api.ts`에 `getPgtSections()`, `getPgtLiked()`, `getPgtPct()`, `getPgtAlbums()`, `getPgtAlbumTracks(id)`, `getPgtArtists()`, `getPgtArtistTracks(id)`, `getPgtImportedPlaylists()`, `getPgtImportedTracks(source)` 추가 (기존 `getMrtLatest` 패턴: `fetchJson("/api/pgt/...")`). `types.ts`에 `PgtSections`/`PgtTrack`/`PgtAlbumGroup`/`PgtArtistGroup`/`PgtPlaylistGroup` 타입 추가(백엔드 응답 형태 그대로).

- [ ] **Step 2: `PgtLibrary.tsx`** — 5섹션 탭(Liked·Playlists·Albums·Artists·PCT). 마운트 시 `getPgtSections()`로 카운트 표시. 탭 선택 시 해당 목록 fetch:
  - **Liked/PCT:** 트랙 목록 → MrtDashboard의 트랙-행 컴포넌트(제목/아티스트/like·pct 토글, `POST /api/user/tracks/{id}/like|pct` 재사용) 렌더.
  - **Playlists:** `sections.user_playlists`(사용자 생성) + `sections.imported_playlists`(임포트) 두 그룹 리스트. 사용자생성 클릭 → `GET /api/playlists/{id}/tracks`(기존), 임포트 클릭 → `GET /api/pgt/imported-playlists/tracks?source=...`.
  - **Albums/Artists:** 그룹 리스트(앨범/아티스트 + track_count) → 클릭 시 `/albums/{id}` `/artists/{id}` 트랙.
  대표 스켈레톤(축약 아님, MrtDashboard 구조 차용):

```tsx
"use client";
import { useEffect, useState } from "react";
import { getPgtSections, getPgtLiked /* …나머지 */ } from "@/lib/api";

const TABS = ["liked", "playlists", "albums", "artists", "pct"] as const;
type Tab = (typeof TABS)[number];

export function PgtLibrary() {
  const [tab, setTab] = useState<Tab>("liked");
  const [sections, setSections] = useState<Awaited<ReturnType<typeof getPgtSections>> | null>(null);
  useEffect(() => { getPgtSections().then(setSections).catch(() => {}); }, []);
  return (
    <section>
      <nav>{TABS.map((t) => (
        <button key={t} onClick={() => setTab(t)} aria-current={tab === t}>{t}</button>
      ))}</nav>
      {/* tab별 패널: 위 매핑대로 해당 fetch + MrtDashboard 트랙-행/그룹 렌더 */}
    </section>
  );
}
```

- [ ] **Step 3: 라우트** — `web/src/app/(dashboard)/library/page.tsx`:
```tsx
import { PgtLibrary } from "@/components/mrms/PgtLibrary";
export default function LibraryPage() { return <PgtLibrary />; }
```
대시보드 사이드바/네비에 `/library` 링크 추가(기존 `/mrt` 링크 옆, 동일 패턴).

- [ ] **Step 4: 빌드 확인** — `cd web && npm run build` (또는 `npm run lint && npx tsc --noEmit`) → 에러 0.

- [ ] **Step 5: 커밋** — `git add web/src/app/\(dashboard\)/library web/src/components/mrms/PgtLibrary.tsx web/src/lib/api.ts web/src/lib/types.ts && git commit -m "feat(pgt): /library 5섹션 화면"`.

---

## PART 2 — MRT → PGT 이동

### Task 4: `mrt_latest` UserTrack 제외 필터 (이동)

**Files:** Modify `src/mrms/api/main.py`(mrt_latest); Test `tests/api/test_pgt_move.py`.

- [ ] **Step 1: 실패 테스트** — `tests/api/test_pgt_move.py`: 유저 MRT(PlaylistHistory) seed → `GET /api/mrt/latest`가 추천 N개 → 그 중 한 트랙 `POST /api/user/tracks/{id}/like` → 다시 `GET /api/mrt/latest`에서 그 트랙이 personas/recommended_tracks에서 **빠짐**.

```python
def test_moved_track_excluded_from_mrt(db_conn, client, login_user, seed_user_mrt):
    user_id, cookies = login_user(db_conn, "move@test.com")
    track_id = seed_user_mrt(db_conn, user_id)  # MRT에 추천 트랙 1개 보장
    before = client.get("/api/mrt/latest", cookies=cookies).json()
    assert any(t["track_id"] == track_id for t in before["recommended_tracks"])
    client.post(f"/api/user/tracks/{track_id}/like", cookies=cookies)
    after = client.get("/api/mrt/latest", cookies=cookies).json()
    assert all(t["track_id"] != track_id for t in after["recommended_tracks"])
```
(`seed_user_mrt` 헬퍼: TrackEmbedding 보유 카탈로그 트랙을 PlaylistHistory persona 0의 trackIds에 넣고 메타 가용하게 — `tests/api/test_onboarding.py`의 MRT seed 패턴 참고.)

- [ ] **Step 2: 실패 확인** — `pytest tests/api/test_pgt_move.py -v` → FAIL (트랙이 여전히 노출).

- [ ] **Step 3: 구현** — `src/mrms/api/main.py` `mrt_latest`: `all_track_ids` 계산 직후, 이 유저의 UserTrack 보유 trackId를 조회해 `owned`로 만들고, personas 빌드(213행 루프)·recommended_tracks(257행)·recommended_albums에서 제외.

`meta = _fetch_track_metadata(...)` 다음에 추가:
```python
    # MRT→PGT '이동': 이미 PGT(UserTrack)에 담은 트랙은 추천에서 제외(이력 보존, display 필터)
    owned: set[str] = set()
    if all_track_ids:
        with conn.cursor() as cur:
            cur.execute(
                'SELECT "trackId" FROM "UserTrack" WHERE "userId"=%s AND "trackId"=ANY(%s)',
                (user_id, all_track_ids),
            )
            owned = {r[0] for r in cur.fetchall()}
```
persona playlist 빌드 루프(213행 `for tid, sc in zip(...)`) 첫 줄에 `if tid in owned: continue` 추가. recommended_tracks comprehension의 `if r["track_id"] in meta` 조건을 `if r["track_id"] in meta and r["track_id"] not in owned`로 변경. `track_to_album`/recommended_albums는 owned 제외된 meta 기준으로 derive하도록, derive 입력 트랙에서 owned를 빼거나 album에 남은 추천 트랙 0개면 제외.

- [ ] **Step 4: 통과 확인** — `pytest tests/api/test_pgt_move.py tests/api/test_onboarding.py -v` → PASS(기존 MRT 테스트 회귀 없음).

- [ ] **Step 5: 커밋** — `git add src/mrms/api/main.py tests/api/test_pgt_move.py && git commit -m "feat(pgt): MRT→PGT 이동 — mrt_latest에서 UserTrack 보유 트랙 제외"`.

### Task 5: 앨범 collect 엔드포인트

**Files:** Modify `src/mrms/api/user_tracks.py`; Test `tests/api/test_pgt_move.py`.

- [ ] **Step 1: 실패 테스트** — `tests/api/test_pgt_move.py`에 추가: 앨범의 카탈로그 트랙 N개 → `POST /api/user/tracks/album/{album_id}/collect` → 그 앨범 트랙 전부 UserTrack(source='liked') 생성 + 응답 `{"collected": N}`.

```python
def test_album_collect(db_conn, client, login_user, seed_album):
    user_id, cookies = login_user(db_conn, "albumcollect@test.com")
    album_id, track_ids = seed_album(db_conn, n=3)
    r = client.post(f"/api/user/tracks/album/{album_id}/collect", cookies=cookies)
    assert r.status_code == 200 and r.json()["collected"] == 3
    with db_conn.cursor() as cur:
        cur.execute('''SELECT count(*) FROM "UserTrack" WHERE "userId"=%s AND "trackId"=ANY(%s) AND source='liked' ''',
                    (user_id, track_ids))
        assert cur.fetchone()[0] == 3
```

- [ ] **Step 2: 실패 확인** — `pytest tests/api/test_pgt_move.py::test_album_collect -v` → FAIL (404).

- [ ] **Step 3: 구현** — `src/mrms/api/user_tracks.py`에 추가:

```python
@router.post("/album/{album_id}/collect")
def collect_album(
    album_id: str,
    user_id: str = Depends(get_current_user_id),
    conn=Depends(db_conn),
):
    """앨범의 카탈로그 트랙 전부를 PGT로 담기 (source='liked'). collected 수 반환."""
    with conn.cursor() as cur:
        cur.execute('SELECT id FROM "Track" WHERE "albumId" = %s', (album_id,))
        track_ids = [r[0] for r in cur.fetchall()]
        for tid in track_ids:
            cur.execute(
                '''INSERT INTO "UserTrack" (id, "userId", "trackId", source, "isCore", platform)
                   VALUES (%s, %s, %s, 'liked', false, 'mrms')
                   ON CONFLICT ("userId", "trackId") DO NOTHING''',
                (_id(f"usertrack|{user_id}|{tid}"), user_id, tid),
            )
    conn.commit()
    return {"collected": len(track_ids)}
```

- [ ] **Step 4: 통과 확인** — `pytest tests/api/test_pgt_move.py -v` → PASS.

- [ ] **Step 5: 커밋** — `git add src/mrms/api/user_tracks.py tests/api/test_pgt_move.py && git commit -m "feat(pgt): 앨범 collect — 앨범 트랙 일괄 PGT 담기"`.

### Task 6: MRT 화면 앨범 collect 버튼

**Files:** Modify `web/src/components/mrms/MrtDashboard.tsx`, `web/src/lib/api.ts`.

- [ ] **Step 1:** `api.ts`에 `collectAlbum(albumId)` (`POST /api/user/tracks/album/{albumId}/collect`).
- [ ] **Step 2:** MrtDashboard의 recommended_albums 행에 "담기" 버튼 → `collectAlbum` 호출 후 `getMrtLatest` 재fetch(이동으로 사라짐). 트랙 단위 이동은 기존 like 토글이 이미 수행(재fetch 시 빠짐) — like 토글 후 목록 갱신만 확인.
- [ ] **Step 3: 빌드 확인** — `cd web && npm run build` → 에러 0.
- [ ] **Step 4: 커밋** — `git add web/src/components/mrms/MrtDashboard.tsx web/src/lib/api.ts && git commit -m "feat(pgt): MRT 화면 앨범 담기 버튼 + 이동 후 갱신"`.

---

## PART 3 — MRT 누적 prune

### Task 7: `prune_playlist_history`

**Files:** Modify `src/mrms/db/user_embedding.py`; Test `tests/recsys/test_prune.py`.

- [ ] **Step 1: 실패 테스트** — `tests/recsys/test_prune.py`: 한 유저에 3 generation(각 3 페르소나 행, generatedAt 다름) seed → `prune_playlist_history(conn, user_id, keep_generations=2)` → 최신 2 generation 행만 남고 오래된 1 generation 삭제.

```python
def test_prune_keeps_latest_generations(db_conn, cleanup):
    from mrms.db.user_embedding import prune_playlist_history, insert_playlist_history
    from mrms.db.ids import stable_id as _id
    uid = _id("test|pruneuser")
    with db_conn.cursor() as cur:
        cur.execute('INSERT INTO "User"(id,email) VALUES(%s,%s) ON CONFLICT(id) DO NOTHING', (uid, "prune@auto.local"))
    db_conn.commit()
    # 3 generation × 3 페르소나 = 9행 (insert_playlist_history는 clock_timestamp로 서로 다른 시각)
    for _gen in range(3):
        for idx in range(3):
            insert_playlist_history(db_conn, uid, [], "mv", {"personaIdx": idx})
        db_conn.commit()
    deleted = prune_playlist_history(db_conn, uid, keep_generations=2)
    with db_conn.cursor() as cur:
        cur.execute('SELECT count(*) FROM "PlaylistHistory" WHERE "userId"=%s', (uid,))
        assert cur.fetchone()[0] == 6   # 2 generation × 3
    assert deleted == 3
    cleanup('DELETE FROM "PlaylistHistory" WHERE "userId"=%s', (uid,))
```

- [ ] **Step 2: 실패 확인** — `pytest tests/recsys/test_prune.py -v` → FAIL (ImportError).

- [ ] **Step 3: 구현** — `src/mrms/db/user_embedding.py`에 추가. generation 경계 = 같은 generation이 동시 insert되므로 generatedAt 내림차순으로 distinct generation을 세고, keep_generations번째 generation의 최소 시각보다 오래된 행 삭제. 페르소나 수에 무관하게 동작하도록 generatedAt DISTINCT 기준:

```python
def prune_playlist_history(
    conn: psycopg.Connection,
    user_id: str,
    keep_generations: int = 2,
) -> int:
    """유저의 PlaylistHistory를 최신 keep_generations generation만 남기고 삭제.

    generation 경계는 한 번의 MRT 생성이 페르소나별 행을 거의 동시(clock_timestamp)에
    넣는 점을 이용해 1초 버킷으로 묶는다. 삭제된 행 수 반환."""
    with conn.cursor() as cur:
        # 최신 generation들의 시각 버킷 (1초 truncate) 중 keep_generations개를 보존
        cur.execute(
            '''WITH gens AS (
                 SELECT DISTINCT date_trunc('second', "generatedAt") AS g
                 FROM "PlaylistHistory" WHERE "userId" = %s
                 ORDER BY g DESC LIMIT %s
               )
               DELETE FROM "PlaylistHistory"
               WHERE "userId" = %s
                 AND date_trunc('second', "generatedAt") NOT IN (SELECT g FROM gens)''',
            (user_id, keep_generations, user_id),
        )
        deleted = cur.rowcount
    conn.commit()
    return deleted
```

- [ ] **Step 4: 통과 확인** — `pytest tests/recsys/test_prune.py -v` → PASS.

- [ ] **Step 5: 커밋** — `git add src/mrms/db/user_embedding.py tests/recsys/test_prune.py && git commit -m "feat(pgt): prune_playlist_history — 최신 N generation 유지"`.

### Task 8: `regenerate_mrt` 스테이지에서 prune 호출

**Files:** Modify `src/mrms/emp/runner.py`(`_run_regenerate_mrt`); Test `tests/emp/test_runner.py`.

- [ ] **Step 1: 실패 테스트** — `tests/emp/test_runner.py`에 단위 테스트: `_run_regenerate_mrt`가 재생성한 유저마다 `prune_playlist_history`를 호출하는지 (monkeypatch로 `generate_user_mrt`·`select_stale_mrt_users`·`prune_playlist_history`를 patch, 재생성된 uid에 prune 호출 검증).

```python
def test_regenerate_calls_prune(db_conn, monkeypatch):
    import mrms.recsys.mrt as mrt
    import mrms.db.user_embedding as ue
    monkeypatch.setattr(mrt, "select_stale_mrt_users", lambda conn, **k: ["u1"])
    monkeypatch.setattr(mrt, "generate_user_mrt", lambda conn, uid, **k: 5)
    pruned = []
    monkeypatch.setattr(ue, "prune_playlist_history", lambda conn, uid, **k: pruned.append(uid) or 0)
    from mrms.emp.runner import _run_regenerate_mrt
    _run_regenerate_mrt(db_conn)
    assert pruned == ["u1"]
```

- [ ] **Step 2: 실패 확인** — `pytest tests/emp/test_runner.py::test_regenerate_calls_prune -v` → FAIL.

- [ ] **Step 3: 구현** — `src/mrms/emp/runner.py` `_run_regenerate_mrt`의 import에 `prune_playlist_history` 추가, 유저 재생성 성공 직후(commit 후) prune 호출:

```python
    from mrms.db.user_embedding import prune_playlist_history
    from mrms.recsys.mrt import generate_user_mrt, select_stale_mrt_users
    # ...
    for uid in users:
        try:
            if generate_user_mrt(conn, uid) is not None:
                conn.commit()
                prune_playlist_history(conn, uid)   # 최신 N generation만 유지
                regenerated += 1
        except Exception:
            safe_rollback(conn)
            failed += 1
```

- [ ] **Step 4: 통과 확인** — `pytest tests/emp/test_runner.py -v` → PASS.

- [ ] **Step 5: 커밋** — `git add src/mrms/emp/runner.py tests/emp/test_runner.py && git commit -m "feat(pgt): regenerate_mrt에서 prune_playlist_history 호출"`.

---

## Task 9: 전체 회귀 + 문서

- [ ] **Step 1: 회귀** — `pytest tests/api/test_pgt.py tests/api/test_pgt_api.py tests/api/test_pgt_move.py tests/recsys/test_prune.py tests/emp/test_runner.py tests/api/test_onboarding.py -q` → 전부 PASS.
- [ ] **Step 2: ADR-002 상태 갱신** — `## 상태`를 `승인 — A 구현 완료 (날짜). 임포트 플리 1급 모델링은 B 보류.`
- [ ] **Step 3: 커밋** — `git add docs/decisions/ADR-002-pgt-library-mrt-curation.md && git commit -m "docs: ADR-002 A 구현 완료"`.

---

## Self-Review

**1. Spec coverage:** §3.1 PGT 섹션 API → Task 1·2 ✓ (Playlists = 사용자생성 재사용 + imported source 그룹 ✓). §3.2 이동 → Task 4(필터)·5(앨범 collect) ✓. §3.3 prune → Task 7·8 ✓. /library 화면 → Task 3 ✓. §8 A 범위(import 변경 0) — Task에 import 수정 없음 ✓.

**2. Placeholder scan:** 백엔드 step은 완전 코드. 프론트(Task 3·6)는 MrtDashboard 패턴 참조 + 대표 스켈레톤 + API 계약 명시(템플릿 UI 재사용이라 전량 코드 대신 구조). `seed_user_mrt`/`seed_album`/`login_user` 헬퍼는 기존 `tests/api/conftest.py`·`test_onboarding.py` 패턴 차용 — 구현자가 그 패턴으로 작성.

**3. Type consistency:** `db.pgt` 함수명(section_liked/pct/albums/artists/imported_playlists, album_tracks/artist_tracks/imported_playlist_tracks)이 Task 1↔2 일관. 트랙 dict 키(track_id/title/artist/album_id/album_title/tidal_track_id/spotify_track_id/duration_ms)가 `get_playlist_tracks`와 동일. `prune_playlist_history(conn, user_id, keep_generations=2)` 시그니처 Task 7↔8 일관.

**열린 항목(spec §6):** prune keep_generations 기본값(2), 앨범 담기 source='liked'(확정). 임포트 플리 1급 모델링 = B(별도).
