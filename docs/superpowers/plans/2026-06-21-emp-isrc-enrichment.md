# EMP 합성-ISRC enrichment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 합성 ISRC를 가진 EMP 풀 트랙을 Deezer로 real ISRC 역해결해, 카탈로그 중복은 머지(임베딩 재사용)하고 신곡만 re-key 후 임베딩 파이프라인으로 보낸다.

**Architecture:** 기존 `01_enrich_via_deezer` + `run_emp_pipeline` 패턴을 따른 별도 enrichment 스테이지. 공용 로직은 `src/mrms/emp/isrc_enrich.py`, CLI는 `scripts/14_enrich_emp_isrc.py`, 파이프라인 편입은 `mrms.emp.runner`. 임포터·02/03/10·온보딩 import 미변경.

**Tech Stack:** Python 3, raw psycopg(동기 conn), httpx(Deezer 호출), 기존 `mrms.ingest.deezer`, `mrms.db.ids.stable_id`, rich(진행 표시). 테스트는 pytest + `db_conn`/`cleanup` fixture(localhost:5433).

**Spec:** `docs/superpowers/specs/2026-06-21-emp-isrc-enrichment-design.md`

**러너:** `.venv/bin/pytest`, `.venv/bin/ruff`. **대상 파일만 테스트**(전체 pytest 금지 — dev DB 부작용). **push/머지 금지.**

---

## File Structure

| 파일 | 책임 |
|---|---|
| `src/mrms/emp/isrc_enrich.py` (신규) | fetch/resolve/match/merge/rekey/classify 전체 로직 |
| `scripts/14_enrich_emp_isrc.py` (신규) | CLI 드라이버(--dry-run/--limit/--concurrency) |
| `src/mrms/emp/runner.py` (수정) | `_run_enrich_isrc` 래퍼 + import 직후·download_audio 직전 스테이지 |
| `tests/emp/test_isrc_enrich.py` (신규) | 단위/DB 테스트 |

**스테이지 위치 근거:** enrichment는 import 단계들 *직후*, `download_audio` *직전*에 둔다 — merge로 중복을 먼저 제거해 02가 중복 오디오를 안 받게 하고, rekey된 신곡은 real ISRC를 얻은 상태로 02(ISRC 정밀 매칭)에 들어간다.

---

## Task 1: `SyntheticTrack` + `fetch_synthetic_emp_tracks`

**Files:**
- Create: `src/mrms/emp/isrc_enrich.py`
- Test: `tests/emp/test_isrc_enrich.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/emp/test_isrc_enrich.py
"""EMP 합성-ISRC enrichment."""
import uuid

import pytest

from mrms.emp.isrc_enrich import SyntheticTrack, fetch_synthetic_emp_tracks


def _artist_id(conn) -> str:
    with conn.cursor() as cur:
        cur.execute('SELECT id FROM "Artist" LIMIT 1')
        row = cur.fetchone()
    if not row:
        pytest.skip("Artist 데이터 부족")
    return row[0]


def _make_track(conn, cleanup, isrc: str, *, in_emp: bool) -> str:
    """테스트용 Track 직접 삽입. id 반환. cleanup 등록."""
    tid = f"t_isrctest_{uuid.uuid4().hex[:10]}"
    aid = _artist_id(conn)
    with conn.cursor() as cur:
        cur.execute(
            '''INSERT INTO "Track"
                 (id, isrc, title, "titleNormalized", "durationMs", "artistId", "inEmp")
               VALUES (%s, %s, %s, %s, %s, %s, %s)''',
            (tid, isrc, "Test Title", "test title", 0, aid, in_emp),
        )
    conn.commit()
    cleanup('DELETE FROM "Track" WHERE id = %s', (tid,))
    return tid


def test_fetch_synthetic_picks_only_synthetic_unembedded_inemp(db_conn, cleanup):
    """합성 ISRC(언더스코어 포함) + inEmp + 미임베딩만 골라낸다."""
    sfx = uuid.uuid4().hex[:8]
    synth = _make_track(db_conn, cleanup, f"emp_apple_{sfx}", in_emp=True)
    real = _make_track(db_conn, cleanup, f"USRC1{sfx}", in_emp=True)   # real ISRC → 제외
    not_emp = _make_track(db_conn, cleanup, f"emp_vibe_{sfx}", in_emp=False)  # inEmp=False → 제외

    ids = {t.track_id for t in fetch_synthetic_emp_tracks(db_conn)}
    assert synth in ids
    assert real not in ids
    assert not_emp not in ids
    # 반환 타입 확인
    one = next(t for t in fetch_synthetic_emp_tracks(db_conn) if t.track_id == synth)
    assert isinstance(one, SyntheticTrack)
    assert one.isrc == f"emp_apple_{sfx}"
    assert one.title == "Test Title"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/bin/pytest tests/emp/test_isrc_enrich.py::test_fetch_synthetic_picks_only_synthetic_unembedded_inemp -v`
Expected: FAIL with `ModuleNotFoundError` / `ImportError: cannot import name 'fetch_synthetic_emp_tracks'`.

- [ ] **Step 3: Write minimal implementation**

```python
# src/mrms/emp/isrc_enrich.py
"""EMP 합성-ISRC 트랙을 Deezer로 real ISRC 역해결 → 카탈로그 머지 / re-key.

합성 ISRC(`emp_*`, `{platform}_*` 등 언더스코어 포함)는 임포터가 real ISRC를
못 받아 생긴 placeholder. 같은 곡이 카탈로그에 real-ISRC로 이미 있으면 머지하고,
신곡이면 isrc를 real로 갱신해 02(ISRC 정밀)→03→10 임베딩 파이프라인에 태운다.
"""
from __future__ import annotations

from dataclasses import dataclass

import psycopg


@dataclass(slots=True)
class SyntheticTrack:
    track_id: str
    isrc: str
    title: str
    artist: str


def fetch_synthetic_emp_tracks(
    conn: psycopg.Connection, limit: int = 0
) -> list[SyntheticTrack]:
    """inEmp=TRUE & 합성 ISRC(언더스코어 포함) & 미임베딩 트랙. createdAt DESC."""
    sql = '''
        SELECT t.id, t.isrc, t.title, ar.name
        FROM "Track" t
        JOIN "Artist" ar ON ar.id = t."artistId"
        WHERE t."inEmp" = TRUE
          AND t.isrc LIKE %s ESCAPE '!'
          AND NOT EXISTS (
            SELECT 1 FROM "TrackEmbedding" te WHERE te."trackId" = t.id
          )
        ORDER BY t."createdAt" DESC
    '''
    params: list = ['%!_%']  # '!' escape → 리터럴 언더스코어 매칭
    if limit:
        sql += " LIMIT %s"
        params.append(limit)
    with conn.cursor() as cur:
        cur.execute(sql, params)
        return [
            SyntheticTrack(track_id=r[0], isrc=r[1], title=r[2] or "", artist=r[3] or "")
            for r in cur.fetchall()
        ]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/bin/pytest tests/emp/test_isrc_enrich.py::test_fetch_synthetic_picks_only_synthetic_unembedded_inemp -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/mrms/emp/isrc_enrich.py tests/emp/test_isrc_enrich.py
git commit -m "feat(emp): fetch_synthetic_emp_tracks — 합성-ISRC EMP 트랙 조회"
```

---

## Task 2: `_norm` + `is_confident_match`

**Files:**
- Modify: `src/mrms/emp/isrc_enrich.py`
- Test: `tests/emp/test_isrc_enrich.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/emp/test_isrc_enrich.py 에 추가
from mrms.emp.isrc_enrich import is_confident_match


def test_is_confident_match_artist_gate_and_title_variants():
    # artist 일치 + title 정확/버전 변형 → True
    assert is_confident_match("Watermelon Sugar", "Harry Styles",
                              "Watermelon Sugar", "Harry Styles") is True
    assert is_confident_match('The Power (7" Version)', "Snap!",
                              "The Power", "SNAP!") is True
    # 괄호 피처/한글 아티스트 정규화
    assert is_confident_match("친구로 지내다 보면 (Feat. 김민석 of 멜로망스)", "BIG Naughty (서동현)",
                              "친구로 지내다 보면", "BIG Naughty") is True
    # artist 불일치 → False (오매칭 차단)
    assert is_confident_match("Watermelon Sugar", "Harry Styles",
                              "Watermelon Sugar", "Andrew Foy") is False
    # 빈 값 → False
    assert is_confident_match("", "X", "", "X") is False
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/bin/pytest tests/emp/test_isrc_enrich.py::test_is_confident_match_artist_gate_and_title_variants -v`
Expected: FAIL with `ImportError: cannot import name 'is_confident_match'`.

- [ ] **Step 3: Write minimal implementation**

```python
# src/mrms/emp/isrc_enrich.py — 상단 import에 추가
import re

# ... SyntheticTrack / fetch_synthetic_emp_tracks 아래에 추가 ...

_PAREN = re.compile(r"\([^)]*\)|\[[^\]]*\]")
_KEEP = re.compile(r"[^a-z0-9가-힣]+")


def _norm(s: str) -> str:
    """소문자 + 괄호내용 제거 + 영숫자/한글만 + 공백정규화."""
    s = (s or "").lower()
    s = _PAREN.sub(" ", s)
    s = _KEEP.sub(" ", s)
    return " ".join(s.split())


def _first_artist(a: str) -> str:
    """대표 아티스트 1명 — 콤마/&/feat 앞부분."""
    a = (a or "").lower()
    for sep in (",", "&", " feat", " ft", " with "):
        a = a.split(sep)[0]
    return a


def is_confident_match(
    orig_title: str, orig_artist: str, cand_title: str, cand_artist: str
) -> bool:
    """오매칭 차단 게이트: artist 정규화 일치(필수) + title 정규화 포함관계."""
    if _norm(_first_artist(orig_artist)) != _norm(_first_artist(cand_artist)):
        return False
    ot, ct = _norm(orig_title), _norm(cand_title)
    if not ot or not ct:
        return False
    return ot == ct or ot in ct or ct in ot
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/bin/pytest tests/emp/test_isrc_enrich.py::test_is_confident_match_artist_gate_and_title_variants -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/mrms/emp/isrc_enrich.py tests/emp/test_isrc_enrich.py
git commit -m "feat(emp): is_confident_match — artist 게이트 + title 정규화 매칭"
```

---

## Task 3: `resolve_real_isrc` (Deezer)

**Files:**
- Modify: `src/mrms/emp/isrc_enrich.py`
- Test: `tests/emp/test_isrc_enrich.py`

**그라운딩:** `mrms.ingest.deezer.search_by_text(client, title, artist)` 는 `DeezerTrack`(TypedDict) 또는 None 반환. 필드: `isrc`, `title`, `artist`, `preview_url`.

- [ ] **Step 1: Write the failing test**

```python
# tests/emp/test_isrc_enrich.py 에 추가
from unittest.mock import AsyncMock, patch

from mrms.emp.isrc_enrich import resolve_real_isrc


@pytest.mark.asyncio
async def test_resolve_real_isrc_confident_returns_isrc():
    dz = {"isrc": "GBUM71903920", "title": "Watermelon Sugar", "artist": "Harry Styles",
          "preview_url": "http://x"}
    with patch("mrms.emp.isrc_enrich.deezer.search_by_text",
               new=AsyncMock(return_value=dz)):
        got = await resolve_real_isrc(None, "Watermelon Sugar", "Harry Styles")
    assert got == "GBUM71903920"


@pytest.mark.asyncio
async def test_resolve_real_isrc_rejects_low_confidence_and_empty():
    # artist 불일치 → None
    dz_bad = {"isrc": "X", "title": "Watermelon Sugar", "artist": "Andrew Foy"}
    with patch("mrms.emp.isrc_enrich.deezer.search_by_text",
               new=AsyncMock(return_value=dz_bad)):
        assert await resolve_real_isrc(None, "Watermelon Sugar", "Harry Styles") is None
    # Deezer 미스 → None
    with patch("mrms.emp.isrc_enrich.deezer.search_by_text",
               new=AsyncMock(return_value=None)):
        assert await resolve_real_isrc(None, "X", "Y") is None
    # isrc 없는 결과 → None
    with patch("mrms.emp.isrc_enrich.deezer.search_by_text",
               new=AsyncMock(return_value={"title": "X", "artist": "Y"})):
        assert await resolve_real_isrc(None, "X", "Y") is None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/bin/pytest tests/emp/test_isrc_enrich.py -k resolve_real_isrc -v`
Expected: FAIL with `ImportError: cannot import name 'resolve_real_isrc'`.

- [ ] **Step 3: Write minimal implementation**

```python
# src/mrms/emp/isrc_enrich.py — 상단 import에 추가
import httpx

from mrms.ingest import deezer

# ... is_confident_match 아래에 추가 ...

async def resolve_real_isrc(
    client: httpx.AsyncClient | None, title: str, artist: str
) -> str | None:
    """Deezer 텍스트 검색 → confident하면 real ISRC, 아니면 None.

    Deezer 응답은 isrc+preview를 함께 담음(deezer.py). iTunes는 ISRC를 안 줘서 미사용.
    """
    dz = await deezer.search_by_text(client, title, artist)
    if not dz:
        return None
    real = dz.get("isrc")
    if not real:
        return None
    if not is_confident_match(title, artist, dz.get("title") or "", dz.get("artist") or ""):
        return None
    return real
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/bin/pytest tests/emp/test_isrc_enrich.py -k resolve_real_isrc -v`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/mrms/emp/isrc_enrich.py tests/emp/test_isrc_enrich.py
git commit -m "feat(emp): resolve_real_isrc — Deezer 텍스트→real ISRC (confidence 게이트)"
```

---

## Task 4: `find_canonical` + `_repoint_or_drop` + `merge_track`

**Files:**
- Modify: `src/mrms/emp/isrc_enrich.py`
- Test: `tests/emp/test_isrc_enrich.py`

**그라운딩(unique 제약, 스펙 §5):** TrackPlatform(trackId,platform), EMPSource(trackId,platform,source_id), UserTrack(userId,trackId), PlaylistTrack PK(playlistId,trackId), TrackAudioFeatures(trackId,modelVersion), TrackEmbedding(trackId,modelVersion). FK 전부 onDelete=CASCADE → **삭제 전 repoint 필수.**

- [ ] **Step 1: Write the failing test**

```python
# tests/emp/test_isrc_enrich.py 에 추가
from mrms.emp.isrc_enrich import find_canonical, merge_track


def test_merge_track_repoints_fks_and_deletes_synth(db_conn, cleanup):
    """합성 트랙의 TrackPlatform/EMPSource를 canonical로 옮기고 합성 Track 삭제."""
    sfx = uuid.uuid4().hex[:8]
    synth = _make_track(db_conn, cleanup, f"emp_apple_{sfx}", in_emp=True)
    canon = _make_track(db_conn, cleanup, f"USRC2{sfx}", in_emp=True)

    # 합성에 TrackPlatform(apple) + EMPSource 부착
    with db_conn.cursor() as cur:
        cur.execute(
            '''INSERT INTO "TrackPlatform" (id,"trackId",platform,"platformTrackId")
               VALUES (%s,%s,'apple',%s)''',
            (f"tp_{sfx}", synth, f"applepid_{sfx}"),
        )
        cur.execute(
            '''INSERT INTO "EMPSource" (id,"trackId",platform,source_type,source_id)
               VALUES (%s,%s,'apple','editorial_playlist',%s)''',
            (f"es_{sfx}", synth, f"src_{sfx}"),
        )
    db_conn.commit()
    # canonical 쪽으로 옮겨질 행들 cleanup 등록
    cleanup('DELETE FROM "TrackPlatform" WHERE "platformTrackId" = %s', (f"applepid_{sfx}",))
    cleanup('DELETE FROM "EMPSource" WHERE source_id = %s', (f"src_{sfx}",))

    assert find_canonical(db_conn, f"USRC2{sfx}", synth) == canon

    merge_track(db_conn, synth, canon)

    with db_conn.cursor() as cur:
        # 합성 Track 삭제됨
        cur.execute('SELECT 1 FROM "Track" WHERE id = %s', (synth,))
        assert cur.fetchone() is None
        # TrackPlatform이 canonical로 이동
        cur.execute('SELECT "trackId" FROM "TrackPlatform" WHERE "platformTrackId" = %s',
                    (f"applepid_{sfx}",))
        assert cur.fetchone()[0] == canon
        # EMPSource가 canonical로 이동
        cur.execute('SELECT "trackId" FROM "EMPSource" WHERE source_id = %s', (f"src_{sfx}",))
        assert cur.fetchone()[0] == canon
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/bin/pytest tests/emp/test_isrc_enrich.py::test_merge_track_repoints_fks_and_deletes_synth -v`
Expected: FAIL with `ImportError: cannot import name 'find_canonical'`.

- [ ] **Step 3: Write minimal implementation**

```python
# src/mrms/emp/isrc_enrich.py — resolve_real_isrc 아래에 추가

def find_canonical(
    conn: psycopg.Connection, real_isrc: str, exclude_id: str
) -> str | None:
    """real_isrc를 가진 다른 Track(자기 자신 제외) id. 없으면 None."""
    with conn.cursor() as cur:
        cur.execute(
            'SELECT id FROM "Track" WHERE isrc = %s AND id <> %s LIMIT 1',
            (real_isrc, exclude_id),
        )
        row = cur.fetchone()
    return row[0] if row else None


# (table, [trackId 외 unique 컬럼]) — 충돌 판정용. 스펙 §5에서 DB 확인됨.
_MERGE_TABLES: list[tuple[str, list[str]]] = [
    ("TrackPlatform", ["platform"]),
    ("EMPSource", ["platform", "source_id"]),
    ("UserTrack", ["userId"]),
    ("PlaylistTrack", ["playlistId"]),
    ("TrackAudioFeatures", ["modelVersion"]),
    ("TrackEmbedding", ["modelVersion"]),
]


def _repoint_or_drop(
    conn: psycopg.Connection, table: str, other_cols: list[str],
    synth_id: str, canonical_id: str,
) -> None:
    """synth의 행을 canonical로 이동. canonical이 같은 unique 키를 이미 가지면 drop."""
    not_exists = " AND ".join(f'c."{col}" = s."{col}"' for col in other_cols)
    with conn.cursor() as cur:
        cur.execute(
            f'''UPDATE "{table}" s SET "trackId" = %(canon)s
                WHERE s."trackId" = %(synth)s
                  AND NOT EXISTS (
                    SELECT 1 FROM "{table}" c
                    WHERE c."trackId" = %(canon)s AND {not_exists}
                  )''',
            {"canon": canonical_id, "synth": synth_id},
        )
        cur.execute(f'DELETE FROM "{table}" WHERE "trackId" = %s', (synth_id,))


def merge_track(
    conn: psycopg.Connection, synth_id: str, canonical_id: str
) -> None:
    """합성 Track의 모든 참조를 canonical로 옮기고 합성 Track 삭제 (트랜잭션 1건).

    FK가 전부 CASCADE라 삭제 전 repoint 필수. canonical의 임베딩은 그대로 유지돼
    합성 트랙이 추천에서 canonical로 흡수된다.
    """
    for table, other_cols in _MERGE_TABLES:
        _repoint_or_drop(conn, table, other_cols, synth_id, canonical_id)
    with conn.cursor() as cur:
        # PlaylistHistory.trackIds (배열, 비-FK): dangling 방지
        cur.execute(
            '''UPDATE "PlaylistHistory"
               SET "trackIds" = array_replace("trackIds", %s, %s)
               WHERE %s = ANY("trackIds")''',
            (synth_id, canonical_id, synth_id),
        )
        cur.execute('DELETE FROM "Track" WHERE id = %s', (synth_id,))
    conn.commit()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/bin/pytest tests/emp/test_isrc_enrich.py::test_merge_track_repoints_fks_and_deletes_synth -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/mrms/emp/isrc_enrich.py tests/emp/test_isrc_enrich.py
git commit -m "feat(emp): merge_track — 6 FK repoint(충돌 drop) + 합성 Track 삭제"
```

---

## Task 5: `rekey_track`

**Files:**
- Modify: `src/mrms/emp/isrc_enrich.py`
- Test: `tests/emp/test_isrc_enrich.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/emp/test_isrc_enrich.py 에 추가
from mrms.emp.isrc_enrich import rekey_track


def test_rekey_track_updates_isrc(db_conn, cleanup):
    """카탈로그에 없는 real ISRC → 합성 트랙 isrc를 real로 갱신."""
    sfx = uuid.uuid4().hex[:8]
    synth = _make_track(db_conn, cleanup, f"emp_vibe_{sfx}", in_emp=True)
    real = f"KRB3{sfx}"
    cleanup('DELETE FROM "Track" WHERE isrc = %s', (real,))  # 갱신 후 키로도 정리

    rekey_track(db_conn, synth, real)

    with db_conn.cursor() as cur:
        cur.execute('SELECT isrc FROM "Track" WHERE id = %s', (synth,))
        assert cur.fetchone()[0] == real
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/bin/pytest tests/emp/test_isrc_enrich.py::test_rekey_track_updates_isrc -v`
Expected: FAIL with `ImportError: cannot import name 'rekey_track'`.

- [ ] **Step 3: Write minimal implementation**

```python
# src/mrms/emp/isrc_enrich.py — merge_track 아래에 추가

def rekey_track(
    conn: psycopg.Connection, synth_id: str, real_isrc: str
) -> None:
    """합성 트랙의 isrc를 real로 갱신. 호출 전 find_canonical이 None(충돌 없음)임을 보장."""
    with conn.cursor() as cur:
        cur.execute(
            'UPDATE "Track" SET isrc = %s, "updatedAt" = now() WHERE id = %s',
            (real_isrc, synth_id),
        )
    conn.commit()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/bin/pytest tests/emp/test_isrc_enrich.py::test_rekey_track_updates_isrc -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/mrms/emp/isrc_enrich.py tests/emp/test_isrc_enrich.py
git commit -m "feat(emp): rekey_track — 신곡 합성→real ISRC 갱신"
```

---

## Task 6: `classify_one` + `apply_one` + `enrich_one`

**Files:**
- Modify: `src/mrms/emp/isrc_enrich.py`
- Test: `tests/emp/test_isrc_enrich.py`

**설계:** `classify_one`은 변형 없이 `(action, real_isrc, canonical_id)`만 결정(dry-run용). `apply_one`이 실제 머지/rekey 수행. `enrich_one`은 둘을 합친 편의 함수(live).

- [ ] **Step 1: Write the failing test**

```python
# tests/emp/test_isrc_enrich.py 에 추가
from mrms.emp.isrc_enrich import classify_one


@pytest.mark.asyncio
async def test_classify_one_branches(db_conn, cleanup):
    """resolve 결과 × 카탈로그 존재 여부로 merge/rekey/skip 분기."""
    sfx = uuid.uuid4().hex[:8]
    canon = _make_track(db_conn, cleanup, f"USRC3{sfx}", in_emp=True)
    synth = SyntheticTrack(track_id=f"x_{sfx}", isrc=f"emp_apple_{sfx}",
                           title="Test Title", artist="Test Artist")

    # real ISRC가 카탈로그에 있음 → merge
    with patch("mrms.emp.isrc_enrich.resolve_real_isrc",
               new=AsyncMock(return_value=f"USRC3{sfx}")):
        assert await classify_one(db_conn, None, synth) == ("merge", f"USRC3{sfx}", canon)
    # real ISRC가 신규 → rekey
    with patch("mrms.emp.isrc_enrich.resolve_real_isrc",
               new=AsyncMock(return_value=f"NEW9{sfx}")):
        assert await classify_one(db_conn, None, synth) == ("rekey", f"NEW9{sfx}", None)
    # 해결 실패 → skip
    with patch("mrms.emp.isrc_enrich.resolve_real_isrc", new=AsyncMock(return_value=None)):
        assert await classify_one(db_conn, None, synth) == ("skip", None, None)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/bin/pytest tests/emp/test_isrc_enrich.py::test_classify_one_branches -v`
Expected: FAIL with `ImportError: cannot import name 'classify_one'`.

- [ ] **Step 3: Write minimal implementation**

```python
# src/mrms/emp/isrc_enrich.py — rekey_track 아래에 추가

async def classify_one(
    conn: psycopg.Connection, client: httpx.AsyncClient | None, track: SyntheticTrack
) -> tuple[str, str | None, str | None]:
    """변형 없이 (action, real_isrc, canonical_id) 결정. action ∈ {merge, rekey, skip}."""
    real = await resolve_real_isrc(client, track.title, track.artist)
    if not real:
        return ("skip", None, None)
    canonical = find_canonical(conn, real, track.track_id)
    if canonical:
        return ("merge", real, canonical)
    return ("rekey", real, None)


def apply_one(
    conn: psycopg.Connection, track: SyntheticTrack,
    action: str, real_isrc: str | None, canonical_id: str | None,
) -> None:
    """classify_one 결과를 실제 적용."""
    if action == "merge":
        merge_track(conn, track.track_id, canonical_id)
    elif action == "rekey":
        rekey_track(conn, track.track_id, real_isrc)


async def enrich_one(
    conn: psycopg.Connection, client: httpx.AsyncClient | None, track: SyntheticTrack
) -> str:
    """classify + apply (live). 수행한 action 반환."""
    action, real_isrc, canonical_id = await classify_one(conn, client, track)
    apply_one(conn, track, action, real_isrc, canonical_id)
    return action
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/bin/pytest tests/emp/test_isrc_enrich.py::test_classify_one_branches -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/mrms/emp/isrc_enrich.py tests/emp/test_isrc_enrich.py
git commit -m "feat(emp): classify_one/apply_one/enrich_one — merge/rekey/skip 분기"
```

---

## Task 7: CLI 드라이버 `scripts/14_enrich_emp_isrc.py`

**Files:**
- Create: `scripts/14_enrich_emp_isrc.py`

**그라운딩:** `scripts/01_enrich_via_deezer.py`(argparse + httpx.AsyncClient + rich) / `scripts/02_download_audio.py`(`--concurrency`, sem) 패턴. DB는 `os.environ["DATABASE_URL"]`. 드라이버는 단위테스트 없음(로직은 Task 1–6에서 검증). `--dry-run`은 `classify_one`만, live는 `classify_one`+`apply_one`.

- [ ] **Step 1: Implement the driver**

```python
# scripts/14_enrich_emp_isrc.py
"""EMP 합성-ISRC 트랙 enrichment — Deezer real ISRC 역해결 → 머지/re-key.

합성 ISRC(언더스코어 포함) EMP 트랙을 Deezer 텍스트로 real ISRC 해결한 뒤:
  - real ISRC가 카탈로그에 있으면 머지(중복 제거, 임베딩 재사용)
  - 신곡이면 isrc 갱신 → 02(ISRC)→03→10 임베딩

Usage:
    python scripts/14_enrich_emp_isrc.py --dry-run --limit 50
    python scripts/14_enrich_emp_isrc.py --limit 5000
    python scripts/14_enrich_emp_isrc.py --concurrency 20
"""
from __future__ import annotations

import argparse
import asyncio
import os
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

import httpx
import psycopg
from rich.console import Console

from mrms.emp.isrc_enrich import apply_one, classify_one, fetch_synthetic_emp_tracks

console = Console()


async def run(conn: psycopg.Connection, limit: int, dry_run: bool, concurrency: int) -> None:
    tracks = fetch_synthetic_emp_tracks(conn, limit=limit)
    console.print(f"합성-ISRC EMP 트랙: [bold]{len(tracks):,}[/bold] "
                  f"({'DRY-RUN' if dry_run else 'LIVE'})")
    if not tracks:
        console.print("[green]대상 없음.[/green]")
        return

    sem = asyncio.Semaphore(concurrency)
    counts: Counter = Counter()
    samples: list[str] = []

    async with httpx.AsyncClient(
        timeout=15.0, headers={"User-Agent": "MRMS/0.1 (+research)"}
    ) as client:
        # classify는 동시 실행(네트워크), apply(DB 쓰기)는 순차 — 같은 conn 보호
        async def classify(t):
            async with sem:
                return t, await classify_one(conn, client, t)

        results = await asyncio.gather(*[classify(t) for t in tracks])

    for t, (action, real_isrc, canonical_id) in results:
        counts[action] += 1
        if len(samples) < 15:
            samples.append(f"  {action:5} {t.isrc} → {real_isrc or '-'}  | {t.artist} — {t.title}")
        if not dry_run:
            apply_one(conn, t, action, real_isrc, canonical_id)

    console.print("\n".join(samples))
    verb = "would" if dry_run else "did"
    console.print(f"\n[bold]{verb}[/bold]: merge {counts['merge']:,} / "
                  f"rekey {counts['rekey']:,} / skip {counts['skip']:,}")


def main() -> None:
    ap = argparse.ArgumentParser(description="EMP 합성-ISRC enrichment")
    ap.add_argument("--limit", type=int, default=0, help="0 = 전체")
    ap.add_argument("--dry-run", action="store_true", help="변형 없이 분류만")
    ap.add_argument("--concurrency", type=int, default=10)
    args = ap.parse_args()

    conn = psycopg.connect(os.environ["DATABASE_URL"])
    try:
        asyncio.run(run(conn, args.limit, args.dry_run, args.concurrency))
    finally:
        conn.close()


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Smoke test (dry-run, 로컬)**

Run: `DATABASE_URL=postgresql://mrms:mrms@localhost:5433/mrms .venv/bin/python scripts/14_enrich_emp_isrc.py --dry-run --limit 5`
Expected: 에러 없이 실행, `would: merge N / rekey M / skip K` 출력. (로컬엔 합성-ISRC EMP가 거의 없어 "대상 없음" 또는 소수일 수 있음 — 정상.)

- [ ] **Step 3: ruff**

Run: `.venv/bin/ruff check scripts/14_enrich_emp_isrc.py src/mrms/emp/isrc_enrich.py`
Expected: `All checks passed!`

- [ ] **Step 4: Commit**

```bash
git add scripts/14_enrich_emp_isrc.py
git commit -m "feat(emp): scripts/14_enrich_emp_isrc.py — CLI 드라이버(--dry-run/--limit/--concurrency)"
```

---

## Task 8: `run_emp_pipeline` 스테이지 편입

**Files:**
- Modify: `src/mrms/emp/runner.py`
- Test: `tests/emp/test_isrc_enrich.py`

**그라운딩:** [runner.py](../../../src/mrms/emp/runner.py) `run_pipeline`은 import 스테이지 루프(232–241) 후 `download_audio`(245)·`extract_embeddings`·`load_to_db` 순으로 `_run_*` 래퍼를 호출하고 `append_stage(conn, run_id, {"stage": name, **s})`로 기록. 래퍼는 `{"status": "success"|...}` dict 반환. enrichment는 **import 루프 직후·`download_audio` 직전**에 삽입.

- [ ] **Step 1: Write the failing test**

```python
# tests/emp/test_isrc_enrich.py 에 추가
from mrms.emp import runner


def test_run_enrich_isrc_wrapper_returns_status_dict(monkeypatch):
    """_run_enrich_isrc는 14 스크립트를 실행하고 status dict 반환."""
    captured = {}

    def fake_run_script(cmd):
        captured["cmd"] = cmd
        return {"status": "success", "stdout": "merge 3 / rekey 2 / skip 1"}

    monkeypatch.setattr(runner, "_run_script", fake_run_script)
    s = runner._run_enrich_isrc()
    assert s["status"] == "success"
    assert any("14_enrich_emp_isrc.py" in str(c) for c in captured["cmd"])
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/bin/pytest tests/emp/test_isrc_enrich.py::test_run_enrich_isrc_wrapper_returns_status_dict -v`
Expected: FAIL with `AttributeError: module 'mrms.emp.runner' has no attribute '_run_enrich_isrc'`.

- [ ] **Step 3: Write minimal implementation**

In `src/mrms/emp/runner.py`, add the wrapper next to `_run_extract_embeddings` (near line 118):

```python
def _run_enrich_isrc() -> dict:
    """합성-ISRC EMP 트랙을 real ISRC로 역해결 → 머지/re-key (02 download 전)."""
    return _run_script([sys.executable, _script_path("14_enrich_emp_isrc.py")])
```

Then in `run_pipeline`, insert the stage immediately after the import loop (after line 241 `... return run_id`-guarded import loop, before the `# audio download` block at line 245):

```python
        # 합성-ISRC enrichment — 중복 머지/신곡 re-key (download_audio 전에)
        s = _run_enrich_isrc()
        append_stage(conn, run_id, {"stage": "enrich_isrc", **s})
        if s["status"] != "success":
            overall_ok = False

        # audio download
        s = _run_audio_download()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/bin/pytest tests/emp/test_isrc_enrich.py::test_run_enrich_isrc_wrapper_returns_status_dict -v`
Expected: PASS

- [ ] **Step 5: Full module test + ruff**

Run: `.venv/bin/pytest tests/emp/test_isrc_enrich.py -v && .venv/bin/ruff check src/mrms/emp/isrc_enrich.py src/mrms/emp/runner.py scripts/14_enrich_emp_isrc.py`
Expected: 모든 테스트 PASS, `All checks passed!`

- [ ] **Step 6: Commit**

```bash
git add src/mrms/emp/runner.py tests/emp/test_isrc_enrich.py
git commit -m "feat(emp): run_emp_pipeline에 enrich_isrc 스테이지 편입(02 download 전)"
```

---

## Self-Review

**1. Spec coverage:**
- §4 컴포넌트: `fetch_synthetic_emp_tracks`(T1), `resolve_real_isrc`(T3), `is_confident_match`(T2), `merge_track`(T4), `rekey_track`(T5), `enrich_one`(T6), 스크립트(T7), 파이프라인 편입(T8). ✓
- §5 MERGE 6 FK + array_replace + 삭제: T4 `_MERGE_TABLES` + `merge_track`. ✓ unique 컬럼 일치(TrackPlatform=platform, EMPSource=platform+source_id, UserTrack=userId, PlaylistTrack=playlistId, Track{AudioFeatures,Embedding}=modelVersion). ✓
- §6 Confidence(artist 필수+title): T2. ✓
- §7 dry-run/멱등/무회귀: T7 `--dry-run`(classify만), 멱등(fetch가 real-ISRC 제외), 임포터·02/03/10 미변경. ✓
- §8 테스트: 각 Task에 단위/DB 테스트. ✓
- §2 비목표(real-ISRC 백로그/임포터 교체/온보딩) 미포함. ✓

**2. Placeholder scan:** TBD/TODO/"적절히 처리" 없음. 모든 코드 스텝에 완전한 코드. ✓

**3. Type consistency:** `SyntheticTrack(track_id,isrc,title,artist)` T1 정의 → T6 생성/T7 사용 일치. `classify_one → (action,real_isrc,canonical_id)` T6 정의 → T7 unpack 일치. `resolve_real_isrc(client,title,artist)` T3 → classify_one 호출 일치. `merge_track(conn,synth,canonical)`/`rekey_track(conn,synth,real)` T4/T5 → apply_one 일치. `_run_enrich_isrc`/`_run_script`/`_script_path` runner 기존 심볼 일치. ✓
