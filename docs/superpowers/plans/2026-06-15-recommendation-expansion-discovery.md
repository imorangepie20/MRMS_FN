# 추천 EMP-밖 discovery (sub-project ①) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** MRT(`/mrt`) 추천 트랙의 ~50%를 우리 EMP 밖에서 Gemini(연관곡 제안)+ytmusicapi(해석·환각필터)로 확장하고, 적재된 곡을 `youtube_misses`가 임베딩하도록 그 게이트를 1줄 확장(Task 7)해 EMP가 성장하는 플라이휠을 만든다.

**Architecture:** `recsys/discover.py`(전부 SYNC)가 취향 시드→Gemini→ytmusicapi 해석→보유곡 제외→`EMPSource(source_type='discovery', source_id='discovery:{user_id}')` 적재를 `generate_user_mrt` 배치 끝에서 best-effort로 수행. 요청 시 `mrt_latest`가 그 캐시를 읽어 taste(EMP) 50% + discovery 50% 교차 블렌드. 새 테이블·마이그레이션 없음(EMPSource 재사용).

**Tech Stack:** FastAPI + raw psycopg, Google Gemini(`google-genai`, 재사용), ytmusicapi(sync 직접 호출), pytest(fake Gemini client + `_ytmusic` patch + cleanup fixture).

**참고 — 절대 경로:** 루트 `/Volumes/MacExtend 1/MRMS_FN`. 러너 `.venv/bin/pytest`(asyncio_mode=auto), 린트 `.venv/bin/ruff`(line-length=100, select E/F/I/W/B). 모든 명령은 루트에서.

**⚠️ DB 격리:** dev DB 격리 안 됨. **전체 `pytest tests/` 금지** — 대상 파일/노드만. 내부 commit하는 헬퍼는 `cleanup` fixture로 잔여물 정리.

**그라운딩 LOCKED (전 태스크 공통):**
- `generate_user_mrt`·discovery 전부 **SYNC**. `generate_user_mrt`는 커밋 안 함(호출자 책임) — 단 discovery 내부 `upsert_track_and_emp_source`/DELETE는 **자체 commit**(전체 트랜잭션 flush).
- discovery는 **EMPSource에만** 적재(PlaylistHistory 미사용 → prune/stale 충돌 없음).
- discovery 곡 metadata는 persona `meta`에 없음 → `read_discovery`가 full metadata(youtube_track_id 포함) 제공, 블렌드가 통합 lookup.
- EMPSource 타임스탬프 = `"importedAt"`(camelCase). `addedAt`/`createdAt` 없음.

---

### Task 1: `blend_recsys` (순수 함수) + `recsys/discover.py` 생성

**Files:**
- Create: `src/mrms/recsys/discover.py`
- Test: `tests/recsys/test_discover.py`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/recsys/test_discover.py` 신규:

```python
"""EMP-밖 discovery — blend/seed/read/gemini/resolve/generate."""
from __future__ import annotations

from mrms.recsys.discover import blend_recsys


def test_blend_interleaves_taste_and_discovery_5050():
    out = blend_recsys(["t1", "t2", "t3"], ["d1", "d2", "d3"], 6)
    assert out == ["t1", "d1", "t2", "d2", "t3", "d3"]


def test_blend_dedups_by_track_id_keeping_first():
    out = blend_recsys(["t1", "t2"], ["t1", "d1"], 4)
    # t1 from taste first; discovery t1 skipped as dup
    assert out == ["t1", "d1", "t2"]


def test_blend_drains_remaining_when_one_side_short():
    out = blend_recsys(["t1", "t2", "t3"], ["d1"], 10)
    assert out == ["t1", "d1", "t2", "t3"]


def test_blend_empty_discovery_returns_taste_only_capped():
    assert blend_recsys(["t1", "t2", "t3"], [], 2) == ["t1", "t2"]


def test_blend_empty_taste_returns_discovery_only():
    assert blend_recsys([], ["d1", "d2"], 5) == ["d1", "d2"]
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `.venv/bin/pytest tests/recsys/test_discover.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'mrms.recsys.discover'`.

- [ ] **Step 3: 구현**

`src/mrms/recsys/discover.py` 신규 (이 태스크는 `blend_recsys`만 — 나머지 함수는 이후 태스크에서 추가):

```python
"""EMP-밖 추천 discovery — 취향 시드 → Gemini 제안 → ytmusicapi 해석 → EMPSource 적재.

전부 SYNC (generate_user_mrt 배치 컨벤션). discovery는 EMPSource(source_type='discovery',
source_id='discovery:{user_id}')에만 적재하고, 요청 시 read_discovery로 읽어 50/50 블렌드.
"""
from __future__ import annotations

import logging

log = logging.getLogger(__name__)


def blend_recsys(
    taste_ids: list[str], discovery_ids: list[str], n: int
) -> list[str]:
    """taste(EMP) / discovery(EMP 밖) track_id를 50/50 교차로 합쳐 최대 n개.

    taste 먼저 시작, 한 쪽이 비면 나머지를 채운다. track_id 정확 매칭으로 dedup."""
    out: list[str] = []
    seen: set[str] = set()
    ti = di = 0
    turn = 0  # 짝수=taste, 홀수=discovery
    while len(out) < n and (ti < len(taste_ids) or di < len(discovery_ids)):
        use_taste = turn % 2 == 0
        if use_taste and ti >= len(taste_ids):
            use_taste = False
        elif not use_taste and di >= len(discovery_ids):
            use_taste = True
        if use_taste and ti < len(taste_ids):
            tid = taste_ids[ti]
            ti += 1
            if tid not in seen:
                seen.add(tid)
                out.append(tid)
        elif not use_taste and di < len(discovery_ids):
            tid = discovery_ids[di]
            di += 1
            if tid not in seen:
                seen.add(tid)
                out.append(tid)
        turn += 1
    return out
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `.venv/bin/pytest tests/recsys/test_discover.py -v`
Expected: PASS (5개).

- [ ] **Step 5: lint**

Run: `.venv/bin/ruff check src/mrms/recsys/discover.py tests/recsys/test_discover.py`
Expected: `All checks passed!`

- [ ] **Step 6: Commit**

```bash
git add src/mrms/recsys/discover.py tests/recsys/test_discover.py
git commit -m "feat(discovery): blend_recsys 50/50 교차 블렌드 (순수 함수)"
```

---

### Task 2: `delete_emp_sources_by_source_id` + `read_discovery` + `taste_seed`

**Files:**
- Modify: `src/mrms/db/emp.py`
- Modify: `src/mrms/recsys/discover.py`
- Test: `tests/recsys/test_discover.py`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/recsys/test_discover.py` 맨 끝에 추가 (DB — Track/Artist/UserTrack/EMPSource 직접 INSERT + cleanup):

```python
import uuid as _uuid

import psycopg
import pytest

from mrms.db.emp import delete_emp_sources_by_source_id
from mrms.db.user_track import get_or_create_user
from mrms.recsys.discover import read_discovery, taste_seed


def _mk_artist(conn, name, genre=None):
    aid = "ar_" + _uuid.uuid4().hex[:12]
    with conn.cursor() as cur:
        cur.execute(
            'INSERT INTO "Artist" (id, name, "nameNormalized", "mainGenre") VALUES (%s,%s,%s,%s)',
            (aid, name, name.lower(), genre),
        )
    return aid


def _mk_track(conn, artist_id, title):
    # 실제 Track NOT NULL 컬럼 전부 채운다 (test_user_mrt.py 셋업과 동일):
    # isrc(UNIQUE NOT NULL), titleNormalized·durationMs(NOT NULL).
    tid = "tr_" + _uuid.uuid4().hex[:12]
    with conn.cursor() as cur:
        cur.execute(
            'INSERT INTO "Track" (id, isrc, title, "titleNormalized", "durationMs", "artistId") '
            'VALUES (%s,%s,%s,%s,%s,%s)',
            (tid, "TST" + tid[-9:], title, title.lower(), 0, artist_id),
        )
    return tid


def _add_usertrack(conn, user_id, track_id):
    # UserTrack NOT NULL 컬럼: isCore, platform.
    with conn.cursor() as cur:
        cur.execute(
            'INSERT INTO "UserTrack" (id, "userId", "trackId", "isCore", source, platform) '
            'VALUES (%s,%s,%s,FALSE,%s,%s) ON CONFLICT DO NOTHING',
            ("ut_" + _uuid.uuid4().hex[:12], user_id, track_id, "liked", "youtube"),
        )


def test_taste_seed_top_artists_and_genres(db_conn: psycopg.Connection, cleanup):
    user_id = get_or_create_user(db_conn, f"seed-{_uuid.uuid4().hex[:8]}@test.com")
    a1 = _mk_artist(db_conn, "Diana Krall", "jazz")
    a2 = _mk_artist(db_conn, "IU", "kpop")
    # cleanup은 reversed 실행 → 자식(UserTrack→Track→Artist)이 먼저 지워지도록 부모부터 등록.
    # (Track.artistId→Artist는 RESTRICT라 Artist를 먼저 지우면 FK 실패.)
    cleanup('DELETE FROM "Artist" WHERE id = ANY(%s)', ([a1, a2],))
    cleanup('DELETE FROM "Track" WHERE "artistId" = ANY(%s)', ([a1, a2],))
    cleanup('DELETE FROM "UserTrack" WHERE "userId" = %s', (user_id,))
    # Diana Krall 2곡, IU 1곡 → Diana 먼저
    for t in ["The Look of Love", "Peel Me a Grape"]:
        _add_usertrack(db_conn, user_id, _mk_track(db_conn, a1, t))
    _add_usertrack(db_conn, user_id, _mk_track(db_conn, a2, "Through the Night"))
    db_conn.commit()

    seed = taste_seed(db_conn, user_id, n_artists=5, n_genres=5)
    assert seed["artists"][0] == "Diana Krall"
    assert "IU" in seed["artists"]
    assert set(seed["genres"]) == {"jazz", "kpop"}


def test_read_discovery_returns_metadata_for_source_id(db_conn: psycopg.Connection, cleanup):
    from mrms.emp.base import upsert_track_and_emp_source

    user_id = get_or_create_user(db_conn, f"read-{_uuid.uuid4().hex[:8]}@test.com")
    src = f"discovery:{user_id}"
    cleanup('DELETE FROM "EMPSource" WHERE source_id = %s', (src,))
    r = upsert_track_and_emp_source(
        db_conn, isrc=None, title="Discovery Song", artist="New Artist",
        album_title="Disc Album", duration_ms=200000, platform="youtube",
        platform_track_id="YTREAD1", source_type="discovery", source_id=src,
        source_name="Discovery", cover_url="http://c",
    )
    tid = r["track_id"]
    cleanup('DELETE FROM "TrackPlatform" WHERE "trackId" = %s', (tid,))
    cleanup('DELETE FROM "Track" WHERE id = %s', (tid,))

    rows = read_discovery(db_conn, user_id, limit=10)
    assert len(rows) == 1
    row = rows[0]
    assert row["track_id"] == tid
    assert row["title"] == "Discovery Song"
    assert row["youtube_track_id"] == "YTREAD1"
    assert row["album_cover"] == "http://c"


def test_delete_emp_sources_by_source_id(db_conn: psycopg.Connection, cleanup):
    from mrms.emp.base import upsert_track_and_emp_source

    user_id = get_or_create_user(db_conn, f"del-{_uuid.uuid4().hex[:8]}@test.com")
    src = f"discovery:{user_id}"
    r = upsert_track_and_emp_source(
        db_conn, isrc=None, title="ToDelete", artist="X", album_title=None,
        duration_ms=None, platform="youtube", platform_track_id="YTDEL1",
        source_type="discovery", source_id=src, source_name="Discovery",
    )
    cleanup('DELETE FROM "TrackPlatform" WHERE "trackId" = %s', (r["track_id"],))
    cleanup('DELETE FROM "Track" WHERE id = %s', (r["track_id"],))

    deleted = delete_emp_sources_by_source_id(db_conn, src)
    assert deleted >= 1
    assert read_discovery(db_conn, user_id, limit=10) == []
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `.venv/bin/pytest tests/recsys/test_discover.py::test_taste_seed_top_artists_and_genres -v`
Expected: FAIL — `ImportError: cannot import name 'taste_seed'` (또는 `read_discovery`/`delete_emp_sources_by_source_id`).

- [ ] **Step 3: `db/emp.py`에 DELETE 헬퍼 추가**

`src/mrms/db/emp.py` 맨 끝에 추가:

```python
def delete_emp_sources_by_source_id(conn: psycopg.Connection, source_id: str) -> int:
    """source_id의 EMPSource 행 전부 삭제 + commit. 삭제 수 반환.

    discovery 재생성 시 replace 용. AFTER DELETE 트리거가 Track.inEmp 재계산."""
    with conn.cursor() as cur:
        cur.execute('DELETE FROM "EMPSource" WHERE source_id = %s', (source_id,))
        n = cur.rowcount
    conn.commit()
    return n
```

(파일 상단에 `import psycopg`가 이미 있는지 확인 — 없으면 추가. db/emp.py는 commit-per-call 스타일이라 일관됨.)

- [ ] **Step 4: `recsys/discover.py`에 `taste_seed`·`read_discovery` 추가**

`src/mrms/recsys/discover.py`의 import 블록을 확장하고 두 함수 추가:

```python
from __future__ import annotations

import logging

import psycopg

log = logging.getLogger(__name__)
```

`blend_recsys` 아래에 추가:

```python
def taste_seed(
    conn: psycopg.Connection, user_id: str, *, n_artists: int = 12, n_genres: int = 5
) -> dict:
    """유저 라이브러리(UserTrack)에서 top 아티스트명 + top mainGenre(Artist.mainGenre).

    UserEmbedding/UserPersona의 topGenres는 채워지지 않으므로 쿼리 시 직접 도출.
    반환 {"artists": [name,...], "genres": [genre,...]}."""
    with conn.cursor() as cur:
        cur.execute(
            '''SELECT ar.name, count(*) AS c
               FROM "UserTrack" ut
               JOIN "Track" t   ON t.id = ut."trackId"
               JOIN "Artist" ar ON ar.id = t."artistId"
               WHERE ut."userId" = %(uid)s
               GROUP BY ar.id, ar.name
               ORDER BY c DESC
               LIMIT %(n)s''',
            {"uid": user_id, "n": n_artists},
        )
        artists = [r[0] for r in cur.fetchall()]
        cur.execute(
            '''SELECT ar."mainGenre", count(*) AS c
               FROM "UserTrack" ut
               JOIN "Track" t   ON t.id = ut."trackId"
               JOIN "Artist" ar ON ar.id = t."artistId"
               WHERE ut."userId" = %(uid)s AND ar."mainGenre" IS NOT NULL
               GROUP BY ar."mainGenre"
               ORDER BY c DESC
               LIMIT %(m)s''',
            {"uid": user_id, "m": n_genres},
        )
        genres = [r[0] for r in cur.fetchall()]
    return {"artists": artists, "genres": genres}


def read_discovery(
    conn: psycopg.Connection, user_id: str, *, limit: int = 50
) -> list[dict]:
    """discovery:{user_id} EMPSource의 트랙 + 메타(youtube_track_id 포함). importedAt 순."""
    with conn.cursor() as cur:
        cur.execute(
            '''SELECT t.id, t.title, ar.name, t."albumId", alb.title,
                      t."durationMs",
                      tp_tidal."platformTrackId"   AS tidal_id,
                      tp_spotify."platformTrackId" AS spotify_id,
                      es.cover_url                 AS album_cover,
                      tp_youtube."platformTrackId" AS youtube_id
               FROM "EMPSource" es
               JOIN "Track" t   ON t.id = es."trackId"
               JOIN "Artist" ar ON ar.id = t."artistId"
               LEFT JOIN "Album" alb ON alb.id = t."albumId"
               LEFT JOIN "TrackPlatform" tp_tidal
                 ON tp_tidal."trackId" = t.id AND tp_tidal.platform = 'tidal'
               LEFT JOIN "TrackPlatform" tp_spotify
                 ON tp_spotify."trackId" = t.id AND tp_spotify.platform = 'spotify'
               LEFT JOIN "TrackPlatform" tp_youtube
                 ON tp_youtube."trackId" = t.id AND tp_youtube.platform = 'youtube'
                 AND tp_youtube."platformTrackId" NOT LIKE 'yt\\_%%' ESCAPE '\\'
               WHERE es.source_id = %s
               ORDER BY es."importedAt"
               LIMIT %s''',
            (f"discovery:{user_id}", limit),
        )
        rows = cur.fetchall()
    return [
        {
            "track_id": r[0], "title": r[1], "artist": r[2], "album_id": r[3],
            "album_title": r[4], "duration_ms": r[5], "tidal_track_id": r[6],
            "spotify_track_id": r[7], "album_cover": r[8], "youtube_track_id": r[9],
        }
        for r in rows
    ]
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `.venv/bin/pytest tests/recsys/test_discover.py -v`
Expected: PASS (Task 1의 5개 + 신규 3개). Postgres(:5433) 필요.

- [ ] **Step 6: lint + Commit**

Run: `.venv/bin/ruff check src/mrms/db/emp.py src/mrms/recsys/discover.py tests/recsys/test_discover.py`
Expected: `All checks passed!` (정렬 경고면 `--fix`).

```bash
git add src/mrms/db/emp.py src/mrms/recsys/discover.py tests/recsys/test_discover.py
git commit -m "feat(discovery): taste_seed + read_discovery + EMPSource delete 헬퍼"
```

---

### Task 3: Gemini 레이어 — `gemini_related_tracks`

**Files:**
- Modify: `src/mrms/recsys/discover.py`
- Test: `tests/recsys/test_discover.py`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/recsys/test_discover.py` 맨 끝에 추가 (fake client — DB·네트워크 불필요):

```python
from mrms.recsys.discover import (
    DiscoveryLLMError,
    TrackSuggestion,
    TrackSuggestions,
    gemini_related_tracks,
)


class _FakeModels:
    def __init__(self, result):
        self._result = result

    def generate_content(self, **kwargs):
        if isinstance(self._result, Exception):
            raise self._result
        return self._result


class _FakeResp:
    def __init__(self, parsed):
        self.parsed = parsed


class _FakeClient:
    def __init__(self, result):
        self.models = _FakeModels(result)


def test_gemini_related_tracks_returns_items():
    parsed = TrackSuggestions(items=[
        TrackSuggestion(artist="Stacey Kent", title="The Boy Next Door"),
        TrackSuggestion(artist="Melody Gardot", title="Baby I'm a Fool"),
    ])
    client = _FakeClient(_FakeResp(parsed))
    out = gemini_related_tracks({"artists": ["Diana Krall"], "genres": ["jazz"]}, 2, client=client)
    assert [s.artist for s in out] == ["Stacey Kent", "Melody Gardot"]


def test_gemini_related_tracks_raises_on_none_parsed():
    client = _FakeClient(_FakeResp(None))
    with pytest.raises(DiscoveryLLMError):
        gemini_related_tracks({"artists": ["X"], "genres": []}, 5, client=client)


def test_gemini_related_tracks_wraps_exception():
    client = _FakeClient(RuntimeError("boom"))
    with pytest.raises(DiscoveryLLMError):
        gemini_related_tracks({"artists": ["X"], "genres": []}, 5, client=client)
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `.venv/bin/pytest tests/recsys/test_discover.py::test_gemini_related_tracks_returns_items -v`
Expected: FAIL — `ImportError: cannot import name 'gemini_related_tracks'`.

- [ ] **Step 3: 구현**

`src/mrms/recsys/discover.py` import 블록 확장 + Gemini 레이어 추가:

```python
from __future__ import annotations

import logging

import psycopg
from google import genai
from google.genai import types
from pydantic import BaseModel

from mrms.config import settings

log = logging.getLogger(__name__)
```

(기존 `import logging`/`import psycopg`/`log =` 줄과 합쳐 중복 없게. ruff --fix가 정렬.)

`read_discovery` 아래에 추가:

```python
class DiscoveryLLMError(RuntimeError):
    """Gemini 호출/파싱 실패 — discovery는 best-effort라 호출부가 삼킨다."""


class TrackSuggestion(BaseModel):
    artist: str
    title: str


class TrackSuggestions(BaseModel):
    items: list[TrackSuggestion]


_DISCOVERY_PROMPT = (
    "너는 음악 큐레이터다. 주어진 사용자의 취향 아티스트와 장르를 보고, 그 취향의 사용자가 "
    "좋아할 만한 '연관 아티스트'의 실재하는 곡을 추천한다.\n"
    "- 시드 아티스트 '본인'의 곡은 피하고, 비슷하지만 다른 아티스트 위주로.\n"
    "- 실제로 존재하는 곡만(가공/허구 금지). artist·title은 정확한 표기로.\n"
    "- 다양성: 같은 아티스트만 반복하지 말 것."
)


def _client() -> genai.Client:
    return genai.Client(api_key=settings.gemini_api_key)


def gemini_related_tracks(
    seed: dict, n: int, *, client: genai.Client | None = None
) -> list[TrackSuggestion]:
    """취향 시드 → Gemini → 연관 곡 {artist,title} n개. 실패 시 DiscoveryLLMError."""
    client = client or _client()
    prompt = (
        f"취향 아티스트: {', '.join(seed.get('artists') or []) or '없음'}\n"
        f"취향 장르: {', '.join(seed.get('genres') or []) or '없음'}\n"
        f"이들과 연관된 다른 아티스트의 곡 {n}개를 추천해줘."
    )
    try:
        resp = client.models.generate_content(
            model=settings.gemini_model,
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=_DISCOVERY_PROMPT,
                response_mime_type="application/json",
                response_schema=TrackSuggestions,
                max_output_tokens=4096,
                thinking_config=types.ThinkingConfig(thinking_budget=0),
            ),
        )
    except Exception as e:
        raise DiscoveryLLMError(str(e)) from e
    if resp.parsed is None:
        raise DiscoveryLLMError("Gemini가 파싱 가능한 출력을 주지 않음")
    return resp.parsed.items
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `.venv/bin/pytest tests/recsys/test_discover.py -k gemini -v`
Expected: PASS (3개).

- [ ] **Step 5: lint + Commit**

Run: `.venv/bin/ruff check src/mrms/recsys/discover.py tests/recsys/test_discover.py`
Expected: `All checks passed!`

```bash
git add src/mrms/recsys/discover.py tests/recsys/test_discover.py
git commit -m "feat(discovery): gemini_related_tracks (취향 시드→연관곡 제안, 구조화 출력)"
```

---

### Task 4: `resolve_via_ytmusic` + `generate_user_discovery` (오케스트레이션)

**Files:**
- Modify: `src/mrms/recsys/discover.py`
- Test: `tests/recsys/test_discover.py`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/recsys/test_discover.py` 맨 끝에 추가 (Gemini fake + `_ytmusic` patch + DB):

```python
from unittest.mock import patch

from mrms.search import youtube as _yt_mod


class _StubYT:
    def __init__(self, by_query):
        self._by_query = by_query

    def search(self, q):
        return self._by_query.get(q, [])


def _song_item(vid, title, artist):
    return {
        "resultType": "song", "videoId": vid, "title": title,
        "artists": [{"name": artist}], "album": {"name": "A"},
        "duration_seconds": 180, "thumbnails": [{"url": "c", "width": 300}],
    }


def test_generate_user_discovery_persists_and_excludes_owned(db_conn, cleanup):
    user_id = get_or_create_user(db_conn, f"disc-{_uuid.uuid4().hex[:8]}@test.com")
    # 라이브러리: Diana Krall 1곡 (시드 + 보유곡 제외 검증)
    a = _mk_artist(db_conn, "Diana Krall", "jazz")
    owned_tid = _mk_track(db_conn, a, "The Look of Love")
    _add_usertrack(db_conn, user_id, owned_tid)
    db_conn.commit()
    src = f"discovery:{user_id}"
    # cleanup은 reversed 실행 → 자식(UserTrack/Track) 먼저, 부모(Artist) 나중.
    # 부모(Artist)를 먼저 등록(=나중 실행). Stacey Kent는 discovery upsert가 새로 만드는
    # 아티스트라 nameNormalized로 별도 정리. TrackPlatform/EMPSource는 Track 삭제 시 CASCADE.
    cleanup('DELETE FROM "Artist" WHERE id = %s', (a,))
    cleanup('DELETE FROM "Artist" WHERE "nameNormalized" = %s', ("stacey kent",))
    cleanup('DELETE FROM "Track" WHERE "artistId" = %s', (a,))
    cleanup('DELETE FROM "EMPSource" WHERE source_id = %s', (src,))

    # Gemini: 신곡 1개(Stacey Kent) + 보유곡과 같은 노래 1개(제외돼야)
    parsed = TrackSuggestions(items=[
        TrackSuggestion(artist="Stacey Kent", title="The Boy Next Door"),
        TrackSuggestion(artist="Diana Krall", title="The Look of Love"),
    ])
    client = _FakeClient(_FakeResp(parsed))
    stub = _StubYT({
        "Stacey Kent The Boy Next Door": [_song_item("YTNEW1", "The Boy Next Door", "Stacey Kent")],
        "Diana Krall The Look of Love": [_song_item("YTOWN", "The Look of Love", "Diana Krall")],
    })
    with patch.object(_yt_mod, "_ytmusic", return_value=stub):
        from mrms.recsys.discover import generate_user_discovery
        count = generate_user_discovery(db_conn, user_id, client=client, n=5)

    assert count == 1  # 보유곡(The Look of Love)은 _song_key로 제외
    rows = read_discovery(db_conn, user_id, limit=10)
    assert [r["youtube_track_id"] for r in rows] == ["YTNEW1"]
    # discovery Track 등록(나중) → reversed로 먼저 삭제(부모 Artist보다 앞). TrackPlatform/EMPSource는 CASCADE.
    for r in rows:
        cleanup('DELETE FROM "Track" WHERE id = %s', (r["track_id"],))
    cleanup('DELETE FROM "UserTrack" WHERE "userId" = %s', (user_id,))  # 마지막 등록 → reversed 첫 실행


def test_generate_user_discovery_no_seed_returns_zero(db_conn, cleanup):
    user_id = get_or_create_user(db_conn, f"noseed-{_uuid.uuid4().hex[:8]}@test.com")
    client = _FakeClient(_FakeResp(TrackSuggestions(items=[])))
    count = generate_user_discovery(db_conn, user_id, client=client, n=5)
    assert count == 0  # UserTrack 없음 → seed 빈약 → skip
```

(`generate_user_discovery` import는 첫 테스트 내부에서 했지만, 파일 상단 import로 올려도 무방.)

- [ ] **Step 2: 테스트 실패 확인**

Run: `.venv/bin/pytest tests/recsys/test_discover.py::test_generate_user_discovery_no_seed_returns_zero -v`
Expected: FAIL — `NameError`/`ImportError: cannot import name 'generate_user_discovery'`.

- [ ] **Step 3: 구현**

`src/mrms/recsys/discover.py` import 블록에 추가:

```python
from mrms.db.emp import delete_emp_sources_by_source_id
from mrms.db.settings import get_setting
from mrms.emp.base import upsert_track_and_emp_source
from mrms.search.normalize import normalize_ytmusic_track
from mrms.search.youtube import AUTH_SETTING_KEY, _ytmusic
```

> ⚠️ **순환 import 회피 (C1):** `mrms.recsys.taste_mood`는 모듈 로드 시 `from mrms.recsys.mrt import MODEL_VERSION`을 한다. Task 5에서 `mrt.py`가 `discover`를 import하므로, `discover.py`가 `taste_mood`를 **모듈-레벨**로 import하면 `mrt→discover→taste_mood→mrt` 순환이 돼 collection 단계에서 크래시한다. 따라서 `_song_key`는 **모듈-레벨로 import하지 말고**, 아래 `_owned_song_keys`와 `generate_user_discovery` 안에서 **함수-로컬**로 import한다.

`gemini_related_tracks` 아래에 추가:

```python
def resolve_via_ytmusic(
    conn: psycopg.Connection, suggestions: list[TrackSuggestion]
) -> list[dict]:
    """각 {artist,title} 제안 → ytmusicapi 검색 → 첫 유효 트랙(videoId)으로 해석.

    해석 실패(존재하지 않음=환각)는 버린다. normalize_ytmusic_track shape 반환."""
    auth_raw = get_setting(conn, AUTH_SETTING_KEY)
    yt = _ytmusic(auth_raw)
    out: list[dict] = []
    for s in suggestions:
        try:
            raw = yt.search(f"{s.artist} {s.title}")
        except Exception as e:  # noqa: BLE001 — ytmusicapi 비공식, graceful
            log.warning("discovery ytmusic search failed (%s): %r", s.title, e)
            continue
        for item in raw or []:
            nt = normalize_ytmusic_track(item)
            if nt:
                out.append(nt)
                break
    return out


def _owned_song_keys(conn: psycopg.Connection, user_id: str) -> set[str]:
    """유저 라이브러리 곡의 _song_key 집합 (discovery에서 보유곡 제외용)."""
    from mrms.recsys.taste_mood import _song_key  # 함수-로컬: mrt↔discover 순환 import 회피
    with conn.cursor() as cur:
        cur.execute(
            '''SELECT ar.name, t.title
               FROM "UserTrack" ut
               JOIN "Track" t   ON t.id = ut."trackId"
               JOIN "Artist" ar ON ar.id = t."artistId"
               WHERE ut."userId" = %s''',
            (user_id,),
        )
        return {_song_key(r[0], r[1]) for r in cur.fetchall()}


def generate_user_discovery(
    conn: psycopg.Connection, user_id: str, *,
    client: genai.Client | None = None, n: int = 20,
) -> int:
    """취향 시드 → Gemini → ytmusicapi 해석 → 보유곡 제외 → discovery EMPSource 재적재.

    best-effort: 어떤 실패도 0 반환(예외 전파/rollback 금지 — 호출자 트랜잭션 보존).
    내부 upsert/delete는 자체 commit. 반환=적재 트랙 수."""
    from mrms.recsys.taste_mood import _song_key  # 함수-로컬: 순환 import 회피
    try:
        # prod 안전망: Gemini 키 없으면 조용히 skip (무회귀). 단 client가 명시 주입되면
        # 테스트 fake client를 쓰는 것이므로 키가 없어도 진행한다.
        if client is None and not settings.gemini_api_key:
            return 0
        seed = taste_seed(conn, user_id)
        if not seed["artists"]:
            return 0
        suggestions = gemini_related_tracks(seed, n, client=client)
        resolved = resolve_via_ytmusic(conn, suggestions)
        if not resolved:
            return 0
        owned = _owned_song_keys(conn, user_id)
        fresh = [t for t in resolved if _song_key(t["artist"], t["title"]) not in owned]
        if not fresh:
            return 0
    except DiscoveryLLMError as e:
        log.warning("discovery LLM failed for %s: %r", user_id, e)
        return 0
    except Exception as e:  # noqa: BLE001 — best-effort, MRT 생성 막지 않음
        log.warning("discovery seed/resolve failed for %s: %r", user_id, e)
        return 0

    # 여기서부터 DB 쓰기 (내부 commit). 실패는 per-track rollback + continue.
    src = f"discovery:{user_id}"
    delete_emp_sources_by_source_id(conn, src)  # 자체 commit (replace)
    count = 0
    for t in fresh:
        try:
            upsert_track_and_emp_source(
                conn, isrc=None, title=t["title"], artist=t["artist"],
                album_title=t.get("album_title"), duration_ms=t.get("duration_ms"),
                platform="youtube", platform_track_id=t["platform_track_id"],
                source_type="discovery", source_id=src, source_name="Discovery",
                cover_url=t.get("album_cover"),
            )
            count += 1
        except Exception as e:  # noqa: BLE001 — 한 곡 실패가 나머지를 막지 않음
            conn.rollback()
            log.warning("discovery persist failed (%s): %r", t.get("title"), e)
    return count
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `.venv/bin/pytest tests/recsys/test_discover.py -v`
Expected: PASS (전부 — blend 5 + db 3 + gemini 3 + orchestration 2).

- [ ] **Step 5: lint + Commit**

Run: `.venv/bin/ruff check src/mrms/recsys/discover.py tests/recsys/test_discover.py`
Expected: `All checks passed!` (`_song_key`·`_ytmusic` underscore import는 의도적 재사용 — F401 없게 실제 사용됨).

```bash
git add src/mrms/recsys/discover.py tests/recsys/test_discover.py
git commit -m "feat(discovery): resolve_via_ytmusic + generate_user_discovery (보유곡 제외·재적재)"
```

---

### Task 5: `generate_user_mrt` 배치 훅 (best-effort)

**Files:**
- Modify: `src/mrms/recsys/mrt.py`
- Test: `tests/recsys/test_user_mrt.py`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/recsys/test_user_mrt.py` 맨 끝에 추가 — discovery가 best-effort로 호출되고, 실패해도 MRT 생성이 깨지지 않음을 검증 (discover 함수는 monkeypatch):

**먼저** — 기존 테스트가 라이브 Gemini/ytmusicapi를 호출하지 않도록 **autouse no-op 픽스처**를 이 파일 상단(import 뒤)에 추가한다. (이 repo `.env`에 실제 `GEMINI_API_KEY`가 있고 conftest가 `load_dotenv()`하므로 discover.py의 key-guard만으로는 기존 테스트의 네트워크 호출·잔여물을 못 막는다 — C5.)

```python
from unittest.mock import patch

import pytest

import mrms.recsys.mrt as _mrt_mod


@pytest.fixture(autouse=True)
def _stub_discovery():
    """이 파일 모든 테스트에서 generate_user_mrt 내부 discovery를 no-op으로 — 실제 Gemini/
    ytmusicapi 호출·discovery 잔여물 방지. best-effort 테스트는 자체 with patch로 override."""
    with patch.object(_mrt_mod, "generate_user_discovery", lambda *a, **k: 0):
        yield


def test_generate_user_mrt_calls_discovery_best_effort(db_conn, cleanup):
    """discovery가 호출되고, discovery가 터져도 generate_user_mrt는 정상 반환."""
    # 이 파일의 기존 통과 테스트(예: test_generate_user_mrt_creates_personas_and_history)와
    # 동일한 seed·commit·cleanup 패턴을 그대로 따른다. 실제 헬퍼 `_seed_user_with_tracks(conn, n)`가
    # TrackEmbedding(inEmp=TRUE)+UserTrack을 심는다. n=6 (>= DEFAULT_K=3).
    user_id = _seed_user_with_tracks(db_conn, 6)
    # 기존 통과 테스트의 teardown 4줄을 그대로 복사 (자식→부모 순서 보장).
    cleanup('DELETE FROM "PlaylistHistory" WHERE "userId" = %s', (user_id,))
    cleanup('DELETE FROM "UserPersona" WHERE "userId" = %s', (user_id,))
    cleanup('DELETE FROM "UserEmbedding" WHERE "userId" = %s', (user_id,))
    cleanup('DELETE FROM "UserTrack" WHERE "userId" = %s', (user_id,))

    calls = {}

    def _boom(conn, uid, **kw):
        calls["called"] = uid
        raise RuntimeError("discovery exploded")

    # autouse 픽스처의 no-op을 이 블록에서만 _boom으로 override
    with patch.object(_mrt_mod, "generate_user_discovery", _boom):
        n = _mrt_mod.generate_user_mrt(db_conn, user_id, k=3)
    db_conn.commit()  # generate_user_mrt는 커밋 안 함(호출자 책임) — 기존 테스트와 동일

    assert n is not None and n > 0          # discovery 폭발에도 MRT 생성 성공
    assert calls.get("called") == user_id   # discovery가 실제로 호출됨
```

> **구현자 주의:** `_seed_user_with_tracks`는 이 파일에 **이미 존재**하는 헬퍼(시그니처 `(conn, n_tracks) -> user_id`). seed·`db_conn.commit()`·teardown은 이 파일 기존 통과 테스트에서 그대로 복사할 것(새 헬퍼 만들지 말 것). autouse `_stub_discovery`가 **기존 테스트 전부**를 라이브 호출에서 보호하므로 기존 테스트 본문은 건드리지 않는다.

- [ ] **Step 2: 테스트 실패 확인**

Run: `.venv/bin/pytest tests/recsys/test_user_mrt.py::test_generate_user_mrt_calls_discovery_best_effort -v`
Expected: FAIL — `AttributeError: ... has no attribute 'generate_user_discovery'`(아직 import·호출 안 함) 또는 호출 안 돼 `calls` 비어 단언 실패.

- [ ] **Step 3: 구현 — mrt.py에 best-effort 훅**

**(i) 모듈 로거 무조건 추가 (I1):** `mrt.py`에는 `log`가 없다(hook의 `log.warning`이 NameError 나면 best-effort 보장이 깨짐). import 블록에 `import logging`을 추가하고, import들 **뒤·`MODEL_VERSION = ...`(line 19) 앞**에 `log = logging.getLogger(__name__)`를 추가한다. (`settings`는 이미 import됨.)

**(ii) discover import 위치 (C1·C2):** `from mrms.recsys.discover import generate_user_discovery`를 **top import 블록이 아니라 `MODEL_VERSION = "+persona-K3"` 줄(line 19) 바로 다음**에 둔다. (이유: `discover→taste_mood→mrt.MODEL_VERSION` 경로가 mrt 로드 중에 `MODEL_VERSION`을 필요로 하므로, 그 정의 이후에 discover를 import해야 순환이 풀린다. 모듈-레벨 바인딩은 유지 — Task 5 테스트가 `patch.object(mrt, "generate_user_discovery", ...)`로 패치하려면 모듈 속성이어야 한다.)

```python
# mrt.py 상단, import들 뒤:
import logging
...  # 기존 import들
log = logging.getLogger(__name__)

MODEL_VERSION = "+persona-K3"   # 기존
from mrms.recsys.discover import generate_user_discovery   # ← MODEL_VERSION 정의 다음 줄
```

**(iii) 훅 삽입 (M1):** `generate_user_mrt` 본문 **맨 끝의 `    return len(track_ids)` 줄 바로 위**에 아래 try/except를 넣는다(이 줄을 앵커로). 변경 전:

```python
        insert_playlist_history(
            conn, user_id, [r["track_id"] for r in recs], MODEL_VERSION,
            context={"personaIdx": idx, "kind": "persona",
                     "scores": [r["similarity"] for r in recs]},
        )
    return len(track_ids)
```

변경 후:

```python
        insert_playlist_history(
            conn, user_id, [r["track_id"] for r in recs], MODEL_VERSION,
            context={"personaIdx": idx, "kind": "persona",
                     "scores": [r["similarity"] for r in recs]},
        )

    # EMP-밖 discovery (best-effort) — 실패해도 MRT 생성/커밋을 막지 않는다.
    # rollback 금지(위 persona 쓰기를 같은 트랜잭션에서 잃음). discovery는 EMPSource에만 적재.
    try:
        generate_user_discovery(conn, user_id)
    except Exception as e:  # noqa: BLE001 — best-effort
        log.warning("discovery skipped for %s: %r", user_id, e)

    return len(track_ids)
```

> `generate_user_discovery` 자체가 best-effort(예외 안 던지고 0 반환)이지만, 방어적으로 hook을 try/except로 한 번 더 감싼다. **rollback 금지**(위 persona 쓰기를 같은 트랜잭션에서 잃음). (i)의 `log`가 반드시 있어야 except의 `log.warning`이 NameError 안 난다.

- [ ] **Step 4: 테스트 통과 확인**

Run: `.venv/bin/pytest tests/recsys/test_user_mrt.py -v`
Expected: PASS (기존 + 신규). 기존 케이스가 깨지지 않아야 함(discovery는 Gemini 키 없으면 0 반환).

> ⚠️ 기존 `test_user_mrt.py`가 Gemini 키 없이 도는 경우, 실제 `generate_user_discovery`가 `taste_seed`→`gemini_related_tracks`→`_client()`에서 키 없이 `genai.Client(api_key="")`를 만들고 네트워크 호출을 시도할 수 있다. **이를 막기 위해** 기존 통과 케이스에 영향이 가면, Step 3에서 `generate_user_discovery` 호출 전에 `if not settings.gemini_api_key: return ...` 가드를 `generate_user_discovery` 내부 `taste_seed` 직후에 두는 대신, **discover.py의 `generate_user_discovery` 맨 앞에 `from mrms.config import settings; if not settings.gemini_api_key: return 0` 가드를 추가**한다(키 없으면 조용히 skip — 무회귀). 이 가드는 Task 4 코드에 넣어도 되며, 넣었다면 Task 4의 `test_generate_user_discovery_no_seed_returns_zero`는 seed가 비어 먼저 0을 반환하므로 영향 없음. **권장: Task 4의 generate_user_discovery 맨 앞(try 진입 직후)에 키 가드 추가.**

- [ ] **Step 5: lint + Commit**

Run: `.venv/bin/ruff check src/mrms/recsys/mrt.py tests/recsys/test_user_mrt.py`
Expected: `All checks passed!`

```bash
git add src/mrms/recsys/mrt.py tests/recsys/test_user_mrt.py
git commit -m "feat(discovery): generate_user_mrt 끝에 best-effort discovery 훅"
```

---

### Task 6: `RecommendedTrack.youtube_track_id` + `mrt_latest` 50/50 블렌드

**Files:**
- Modify: `src/mrms/api/schemas.py`
- Modify: `src/mrms/api/main.py`
- Test: `tests/api/test_mrt.py` (없으면 생성)

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/api/test_mrt.py`에 추가(파일 없으면 생성). discovery EMPSource를 직접 심고, `/api/mrt/latest`가 그 트랙을 `recommended_tracks`에 youtube_track_id와 함께 포함하는지 검증. persona가 있어야 early-return을 피하므로, 최소 persona는 기존 셋업(또는 generate_user_mrt) 사용:

```python
import uuid as _uuid
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from mrms.api.main import app
from mrms.emp.base import upsert_track_and_emp_source

client = TestClient(app)


def test_mrt_latest_blends_discovery_tracks(db_conn, login, cleanup):
    user_id, session_id = login()
    # persona 1개 직접 적재 (early-return 회피). 트랙은 EMP에 있는 임의 Track 사용.
    with db_conn.cursor() as cur:
        cur.execute('SELECT id FROM "Track" LIMIT 2')
        base = [r[0] for r in cur.fetchall()]
    if len(base) < 1:
        import pytest
        pytest.skip("Track 데이터 부족")
    from mrms.db.user_embedding import insert_playlist_history
    insert_playlist_history(
        db_conn, user_id, base, "+persona-K3",
        context={"personaIdx": 0, "kind": "persona", "scores": [1.0] * len(base)},
    )
    db_conn.commit()
    cleanup('DELETE FROM "PlaylistHistory" WHERE "userId" = %s', (user_id,))

    src = f"discovery:{user_id}"
    r = upsert_track_and_emp_source(
        db_conn, isrc=None, title="Disc Track", artist="Disc Artist",
        album_title=None, duration_ms=190000, platform="youtube",
        platform_track_id="YTBLEND1", source_type="discovery", source_id=src,
        source_name="Discovery",
    )
    dtid = r["track_id"]
    cleanup('DELETE FROM "EMPSource" WHERE source_id = %s', (src,))
    cleanup('DELETE FROM "TrackPlatform" WHERE "trackId" = %s', (dtid,))
    cleanup('DELETE FROM "Track" WHERE id = %s', (dtid,))

    client.cookies.set("mrms_session", session_id)
    resp = client.get("/api/mrt/latest")
    client.cookies.clear()
    assert resp.status_code == 200, resp.text
    rows = resp.json()["recommended_tracks"]
    disc = [t for t in rows if t["track_id"] == dtid]
    assert len(disc) == 1
    assert disc[0]["youtube_track_id"] == "YTBLEND1"
    assert disc[0]["title"] == "Disc Track"
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `.venv/bin/pytest tests/api/test_mrt.py::test_mrt_latest_blends_discovery_tracks -v`
Expected: FAIL — discovery 트랙이 `recommended_tracks`에 없음(블렌드 미구현) → `assert len(disc) == 1` 실패.

- [ ] **Step 3: `schemas.py` — RecommendedTrack에 youtube_track_id**

`src/mrms/api/schemas.py`의 `RecommendedTrack`에서 `spotify_track_id`와 `liked` 사이에 한 줄 추가:

```python
class RecommendedTrack(BaseModel):
    track_id: str
    title: str
    artist: str
    album_id: str | None = None
    album_title: str | None = None
    duration_ms: int | None = None
    score: float
    persona_idx: int | None = None
    tidal_track_id: str | None = None
    spotify_track_id: str | None = None
    youtube_track_id: str | None = None
    liked: bool = False
    pct: bool = False
```

- [ ] **Step 4: `main.py` — 블렌드 통합**

`src/mrms/api/main.py` import 블록에 추가:

```python
from mrms.recsys.discover import blend_recsys, read_discovery
```

`mrt_latest` 안에서, 기존 owned/blocked(`hidden`) 계산과 `recommended_tracks` 구성 사이를 아래로 교체한다.

(a) `meta = _fetch_track_metadata(...)`(main.py:208) 다음 줄에 discovery 읽기 + union hidden 추가. 변경 전:

```python
    all_track_ids = list({tid for p in playlists_sorted for tid in p["trackIds"]})
    meta = _fetch_track_metadata(conn, all_track_ids, primary_platform=primary_platform)

    # MRT→PGT '이동': ...
    owned: set[str] = set()
    if all_track_ids:
        with conn.cursor() as cur:
            cur.execute(
                'SELECT "trackId" FROM "UserTrack" WHERE "userId"=%s AND "trackId"=ANY(%s)',
                (user_id, all_track_ids),
            )
            owned = {r[0] for r in cur.fetchall()}

    from mrms.db.user_blocked import blocked_track_ids
    blocked = blocked_track_ids(conn, user_id, ["disliked", "dismissed"]) if all_track_ids else set()
    hidden = owned | blocked
```

변경 후 — discovery 트랙을 union에 포함하고 hidden을 union으로 계산:

```python
    all_track_ids = list({tid for p in playlists_sorted for tid in p["trackIds"]})
    meta = _fetch_track_metadata(conn, all_track_ids, primary_platform=primary_platform)

    # EMP-밖 discovery 캐시 읽기 (배치에서 적재됨). 메타는 여기가 제공(persona meta엔 없음).
    discovery_rows = read_discovery(conn, user_id, limit=top_tracks_n)
    disc_meta = {d["track_id"]: d for d in discovery_rows}

    # hidden(owned|blocked)을 persona + discovery union으로 계산
    union_ids = list(set(all_track_ids) | set(disc_meta))
    owned: set[str] = set()
    if union_ids:
        with conn.cursor() as cur:
            cur.execute(
                'SELECT "trackId" FROM "UserTrack" WHERE "userId"=%s AND "trackId"=ANY(%s)',
                (user_id, union_ids),
            )
            owned = {r[0] for r in cur.fetchall()}

    from mrms.db.user_blocked import blocked_track_ids
    blocked = blocked_track_ids(conn, user_id, ["disliked", "dismissed"]) if union_ids else set()
    hidden = owned | blocked
```

(b) `recommended_tracks` 구성(main.py:262-302)을 블렌드로 교체. 변경 전(요지):

```python
    playlists_with_scores = [ ... ]
    rec_tracks_raw = derive_recommended_tracks(playlists_with_scores, top_n=top_tracks_n)

    rec_track_ids = [r["track_id"] for r in rec_tracks_raw if r["track_id"] in meta]
    user_track_state: dict[str, tuple[bool, bool]] = {}
    if rec_track_ids:
        with conn.cursor() as cur:
            cur.execute( ... UserTrack source/isCore over rec_track_ids ... )
            for row in cur.fetchall():
                user_track_state[row[0]] = (row[1] == "liked", bool(row[2]))

    recommended_tracks = [
        RecommendedTrack( ... meta[r["track_id"]] ... )
        for r in rec_tracks_raw
        if r["track_id"] in meta and r["track_id"] not in hidden
    ]
```

변경 후:

```python
    playlists_with_scores = [
        {
            "context": p.get("context") or {},
            "trackIds": p["trackIds"],
            "scores": (p.get("context") or {}).get("scores", []),
        }
        for p in playlists_sorted
    ]
    rec_tracks_raw = derive_recommended_tracks(playlists_with_scores, top_n=top_tracks_n)
    taste_score = {r["track_id"]: (float(r["score"]), r.get("persona_idx")) for r in rec_tracks_raw}

    # 50/50 교차 블렌드 (track_id dedup) — taste(EMP) + discovery(EMP 밖)
    blended_ids = blend_recsys(
        [r["track_id"] for r in rec_tracks_raw],
        [d["track_id"] for d in discovery_rows],
        top_tracks_n,
    )

    # 통합 메타: persona meta(youtube 없음) 또는 discovery meta(youtube 있음)
    def _unified(tid: str) -> dict | None:
        if tid in disc_meta:
            d = disc_meta[tid]
            return {
                "title": d["title"], "artist": d["artist"], "album_id": d["album_id"],
                "album_title": d["album_title"], "duration_ms": d["duration_ms"],
                "tidal_track_id": d["tidal_track_id"], "spotify_track_id": d["spotify_track_id"],
                "youtube_track_id": d["youtube_track_id"],
            }
        if tid in meta:
            m = meta[tid]
            return {**m, "youtube_track_id": None}
        return None

    # liked/pct 상태 — 블렌드된 트랙 전체에 대해 한 번에
    user_track_state: dict[str, tuple[bool, bool]] = {}
    if blended_ids:
        with conn.cursor() as cur:
            cur.execute(
                '''SELECT "trackId", source, "isCore" FROM "UserTrack"
                   WHERE "userId" = %s AND "trackId" = ANY(%s)''',
                (user_id, blended_ids),
            )
            for row in cur.fetchall():
                user_track_state[row[0]] = (row[1] == "liked", bool(row[2]))

    recommended_tracks = []
    for tid in blended_ids:
        if tid in hidden:
            continue
        u = _unified(tid)
        if u is None:
            continue
        score, persona_idx = taste_score.get(tid, (0.0, None))
        liked, pct = user_track_state.get(tid, (False, False))
        recommended_tracks.append(RecommendedTrack(
            track_id=tid,
            title=u["title"], artist=u["artist"], album_id=u["album_id"],
            album_title=u["album_title"], duration_ms=u["duration_ms"],
            score=score, persona_idx=persona_idx,
            tidal_track_id=u["tidal_track_id"], spotify_track_id=u["spotify_track_id"],
            youtube_track_id=u["youtube_track_id"],
            liked=liked, pct=pct,
        ))
```

> 기존 `recommended_albums`/`recommended_playlists`/`personas` 구성은 그대로 둔다(블렌드는 tracks만). `derive_recommended_albums`는 변경 없음.

- [ ] **Step 5: 테스트 통과 확인**

Run: `.venv/bin/pytest tests/api/test_mrt.py -v`
Expected: PASS. (기존 MRT 테스트가 있으면 같이 통과해야 함 — discovery 없으면 `discovery_rows=[]`라 100% taste, 무회귀.)

- [ ] **Step 6: lint + Commit**

Run: `.venv/bin/ruff check src/mrms/api/main.py src/mrms/api/schemas.py tests/api/test_mrt.py`
Expected: `All checks passed!` (B008 Depends·기존 E501 등 사전존재분 제외, 신규 위반 없게).

```bash
git add src/mrms/api/schemas.py src/mrms/api/main.py tests/api/test_mrt.py
git commit -m "feat(discovery): RecommendedTrack.youtube_track_id + mrt_latest 50/50 블렌드"
```

---

### Task 7: 플라이휠 — `youtube_misses` 게이트에 discovery 곡 포함

**Files:**
- Modify: `scripts/13_embed_youtube_misses.py`
- Test: `tests/scripts/test_embed_youtube_misses.py` (없으면 생성)

> **왜:** discovery 곡은 `Track` + `TrackPlatform(youtube)` + `EMPSource(source_type='discovery')`에만 적재되고 **UserTrack에는 안 들어간다**(의도 — 유저 라이브러리·취향 시드 오염 방지). 그런데 `scripts/13`의 `MISS_SQL`은 `EXISTS (UserTrack)`인 곡만 다운로드 대상으로 잡아 → discovery 곡은 **영영 임베딩 안 됨 = 플라이휠 정지**. 게이트에 "discovery EMPSource가 있으면"을 OR로 추가해 실 videoId discovery 곡도 임베딩 대상이 되게 한다. (`fetch_youtube_misses`는 `MISS_SQL`을 그대로 실행하므로 그 함수로 검증 가능.)

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/scripts/test_embed_youtube_misses.py` 신규 (없으면 `tests/scripts/__init__.py`도 생성). discovery 곡(videoId 보유·UserTrack 없음·임베딩 없음)이 misses로 잡히는지 검증:

```python
"""scripts/13 MISS_SQL — discovery 곡(UserTrack 없음)도 임베딩 대상에 포함되는지."""
import importlib.util
import uuid as _uuid
from pathlib import Path

_spec = importlib.util.spec_from_file_location(
    "embed_youtube_misses",
    str(Path(__file__).resolve().parents[2] / "scripts" / "13_embed_youtube_misses.py"),
)
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)
fetch_youtube_misses = _mod.fetch_youtube_misses


def test_discovery_track_without_usertrack_is_a_miss(db_conn, cleanup):
    from mrms.db.user_track import get_or_create_user
    from mrms.emp.base import upsert_track_and_emp_source

    user_id = get_or_create_user(db_conn, f"fly-{_uuid.uuid4().hex[:8]}@test.com")
    src = f"discovery:{user_id}"
    cleanup('DELETE FROM "EMPSource" WHERE source_id = %s', (src,))
    r = upsert_track_and_emp_source(
        db_conn, isrc=None, title="Fly Song", artist="Fly Artist",
        album_title=None, duration_ms=None, platform="youtube",
        platform_track_id="YTFLY1", source_type="discovery", source_id=src,
        source_name="Discovery",
    )
    tid = r["track_id"]
    cleanup('DELETE FROM "Artist" WHERE "nameNormalized" = %s', ("fly artist",))
    cleanup('DELETE FROM "Track" WHERE id = %s', (tid,))

    misses = fetch_youtube_misses(db_conn, 1000)
    assert any(m["track_id"] == tid and m["video_id"] == "YTFLY1" for m in misses)
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `.venv/bin/pytest tests/scripts/test_embed_youtube_misses.py -v`
Expected: FAIL — 현재 MISS_SQL은 `EXISTS UserTrack`만 잡아 discovery 곡(UserTrack 없음)이 미포함 → `assert any(...)` 실패.

- [ ] **Step 3: 구현 — MISS_SQL 게이트 확장**

`scripts/13_embed_youtube_misses.py`의 `MISS_SQL`에서 `AND EXISTS (SELECT 1 FROM "UserTrack" ...)` 한 줄을 OR로 확장. 변경 전:

```python
    WHERE tp."platformTrackId" NOT LIKE 'yt\\_%%'
      AND EXISTS (SELECT 1 FROM "UserTrack" ut WHERE ut."trackId" = t.id)
      AND NOT EXISTS (SELECT 1 FROM "TrackEmbedding" e WHERE e."trackId" = t.id)
```

변경 후:

```python
    WHERE tp."platformTrackId" NOT LIKE 'yt\\_%%'
      AND (EXISTS (SELECT 1 FROM "UserTrack" ut WHERE ut."trackId" = t.id)
           OR EXISTS (SELECT 1 FROM "EMPSource" es
                      WHERE es."trackId" = t.id AND es.source_type = 'discovery'))
      AND NOT EXISTS (SELECT 1 FROM "TrackEmbedding" e WHERE e."trackId" = t.id)
```

(UserTrack 보유 곡 + discovery 곡 둘 다 대상. 이미 임베딩된 곡은 여전히 제외.)

- [ ] **Step 4: 테스트 통과 확인**

Run: `.venv/bin/pytest tests/scripts/test_embed_youtube_misses.py -v`
Expected: PASS.

- [ ] **Step 5: lint + Commit**

Run: `.venv/bin/ruff check scripts/13_embed_youtube_misses.py tests/scripts/test_embed_youtube_misses.py`
Expected: `All checks passed!`

```bash
git add scripts/13_embed_youtube_misses.py tests/scripts/test_embed_youtube_misses.py
git commit -m "feat(discovery): youtube_misses 게이트에 discovery 곡 포함 (플라이휠)"
```

---

## 프론트

`/mrt`의 `recommended_tracks`는 이미 `RecommendedTrack`(youtube_track_id optional 보유, types.ts:41)을 렌더·재생(`toQueueTrack`)하므로 **discovery 트랙 자동 표시·재생**(연결 플랫폼으로 resolve 교차). 프론트 코드 변경 없음. (선택) discovery 뱃지 = 후속.

## 구현 중 수정 사항 (실제 코드 = 소스 오브 트루스)

구현·리뷰 단계에서 implementer/리뷰어가 잡아 고친, 위 계획 코드와의 차이 (머지된 코드가 정답):

1. **`blend_recsys` (Task 1):** 위 계획은 `turn += 1`을 루프 끝에서 **무조건** 증가시키는데, 이는 dedup 케이스에서 잘못된 순서(`["t1","t2","d1"]`)를 낸다. 실제 구현은 `turn += 1`을 **각 emit 성공 시(if tid not in seen 블록 안)** 증가시켜 `["t1","d1","t2"]`를 낸다. (테스트가 계약.)
2. **Task 4 테스트 `_ytmusic` 패치 타깃:** discover.py가 `from mrms.search.youtube import _ytmusic`로 **자기 네임스페이스에 바인딩**하므로, 테스트는 `mrms.search.youtube._ytmusic`가 아니라 **`mrms.recsys.discover._ytmusic`**를 패치해야 `resolve_via_ytmusic`에 반영된다(아니면 실제 네트워크 호출).
3. **`generate_user_discovery`의 delete 가드 (Task 4):** `delete_emp_sources_by_source_id`가 try 밖이면 예외가 전파돼 best-effort 계약이 깨진다 → delete도 try/except로 감싸 0 반환(commit `11be74d`).
4. **Task 4 테스트 cleanup:** discovery가 만드는 아티스트(예: 'Stacey Kent')가 dev DB에 이미 있으면 공유 아티스트라 삭제하면 안 됨 → 그 아티스트 cleanup 제거, discovery Track만 id로 정리.
5. **온보딩 테스트도 discovery 스텁 필요 (Task 5 보강, 최종 리뷰 적발):** `tests/onboarding/test_pipeline.py`도 `run_onboarding→generate_user_mrt→discovery 훅`을 타므로 autouse `_stub_discovery` no-op 픽스처를 추가해 라이브 Gemini 호출·잔여물 차단(commit `871630d`).

## 수동 검증 (전체 완료 후, dev/prod)

1. 취향 있는 유저로 MRT 재생성(또는 regenerate_mrt 사이클) → `discovery:{user_id}` EMPSource 적재 확인(`SELECT count(*) FROM "EMPSource" WHERE source_id='discovery:{uid}'`).
2. `/api/mrt/latest` → `recommended_tracks`에 youtube_track_id 채워진 항목이 섞여 나오는지.
3. 다음 파이프라인 사이클 후 그 youtube 트랙들이 `youtube_misses`로 임베딩돼 EMP에 편입되는지(플라이휠).

---

## Self-Review (작성자 체크 결과)

**Spec coverage:** discovery 엔진(Gemini Task3·resolve Task4)·캐시(EMPSource Task2/4)·배치 타이밍(Task5 훅)·50/50 블렌드(Task1·6)·**플라이휠(youtube 적재=Task4 + youtube_misses 게이트 확장=Task7)**·무회귀(discovery 빈 경우 taste 100%=blend_recsys/Task6) 전부 매핑. spec의 모듈/SQL/에러/타이밍 항목 커버.

**Placeholder scan:** 모든 코드 스텝에 실제 코드·명령·기대출력. Task5는 **실존 헬퍼 `_seed_user_with_tracks`**(시그니처 명시)와 기존 통과 테스트의 seed/cleanup을 복사하라 지시 — 가공 헬퍼명 없음. 그 외 placeholder 없음.

**적대적 리뷰 fix 반영(C1~C6, I1~I3):** C1 순환 import(mrt는 MODEL_VERSION 뒤 모듈-레벨 import / discover는 `_song_key` 함수-로컬) / C3 실헬퍼 `_seed_user_with_tracks` / C4 NOT NULL 컬럼(isrc·titleNormalized·durationMs·isCore·platform) / C5 autouse `_stub_discovery`로 기존 테스트 라이브호출 차단 / C6 Task7 게이트 확장 / I1 mrt.py 무조건 logger / I2 key-guard를 Task4 코드 안에(client 주입 시 우회) / I3 cleanup 자식→부모 순서 + discovery Artist 정리.

**Type consistency:** `taste_seed→{"artists","genres"}`(Task2)가 `gemini_related_tracks(seed)`(Task3)·`generate_user_discovery`(Task4) 사용과 일치. `read_discovery`가 반환하는 키(track_id/.../youtube_track_id/album_cover)가 Task6 `disc_meta`·`_unified`·테스트 단언과 일치. `blend_recsys(list,list,int)->list[str]`(Task1)가 Task6 호출과 일치. `generate_user_discovery(conn,user_id,*,client,n)`(Task4)가 Task5 훅 호출(`generate_user_discovery(conn, user_id)`)과 일치(전부 default). `RecommendedTrack.youtube_track_id`(Task6 schemas) ↔ 프론트 types.ts optional 일치. `delete_emp_sources_by_source_id`/`AUTH_SETTING_KEY`/`_ytmusic`/`normalize_ytmusic_track`/`_song_key`/`upsert_track_and_emp_source`/`get_setting` 전부 실재 시그니처(그라운딩 확인).

**LOCKED 반영:** SYNC 전구간 / discovery EMPSource-only(PlaylistHistory 미사용) / 커밋=내부(upsert·delete) + 훅 rollback 금지 / importedAt 정렬 / youtube `yt\_` 필터 / Gemini 컨테이너 모델+thinking_budget=0+max_output_tokens=4096 / 키 없으면 skip(무회귀) / hidden union 재계산.
