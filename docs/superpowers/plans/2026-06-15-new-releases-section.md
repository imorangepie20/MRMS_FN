# 취향 맞춤 신보(신곡) 섹션 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사용자 취향 연관 **최근 발매곡(신보)** 을 Gemini + Google Search grounding으로 찾아 `/mrt`에 별도 "PT 04" 섹션으로 노출하고, 적재한 신곡을 기존 임베딩 플라이휠에 태운다.

**Architecture:** discover.py 파이프라인을 본뜬 신규 `recsys/newrelease.py`(2단계 Gemini: grounded 웹검색 → structured 추출 → ytmusic 해석 → EMPSource 적재). per-user 생성은 `generate_user_mrt`에 best-effort 훅. 서빙은 `MrtLatestResponse.recommended_new_releases` 신규 필드(`mrt_latest`가 `read_newrelease`로 채움, 기존 hidden/dismiss 필터 재사용). 프론트는 PT 02 트랙 섹션을 본뜬 PT 04 섹션. 플라이휠은 `scripts/13` MISS_SQL OR-clause에 `'new_release'` 추가로 닫는다.

**Tech Stack:** Python(raw psycopg, google-genai 2.8.0 `types.Tool(google_search=types.GoogleSearch())`, pydantic), FastAPI, Next.js/React, pytest(TestClient + fake-client 주입), ruff(line-length 100), tsc/lint/build.

**참고 — 절대 경로:** 루트 `/Volumes/MacExtend 1/MRMS_FN`. 러너 `.venv/bin/pytest`, 린트 `.venv/bin/ruff`. 프론트 `web/`(`pnpm lint`, `npx tsc --noEmit`, `pnpm build`).

**⚠️ DB 격리:** dev DB 격리 안 됨(localhost:5433). **전체 `pytest tests/` 금지** — 대상 파일만. EMPSource/Track 적재는 `upsert_track_and_emp_source`가 내부 commit → db_conn 롤백으로 안 지워짐 → **반드시 `cleanup` 픽스처 등록(역순)**. 라이브 Gemini 차단: 테스트는 `client=` 로 fake 주입(절대 실호출 금지). ytmusic은 `patch.object(_disc_mod, "_ytmusic", ...)` 로 패치(신곡은 `discover.resolve_via_ytmusic` 재사용이라 패치 타깃이 discover).

**설계 정정(중요):** `recommended_discovery` 필드/섹션은 **존재하지 않는다**. discovery는 `blend_recsys`로 `recommended_tracks`에 섞여 들어간다. 신곡은 **신규 응답 필드 + PT 02 트랙 섹션을 본뜬 신규 섹션**이다.

---

### Task 1: `recsys/newrelease.py` — `gemini_new_releases` (2단계 grounded→structured)

**Files:**
- Create: `src/mrms/recsys/newrelease.py`
- Test: `tests/recsys/test_newrelease.py`

discover.py의 `TrackSuggestion`/`TrackSuggestions`/`DiscoveryLLMError`/`resolve_via_ytmusic`/`taste_seed`/`_owned_song_keys`/`read_discovery`를 **재사용(import)** 한다. google-genai grounding은 `tools=[types.Tool(google_search=types.GoogleSearch())]`(2.8.0 확인). grounding+response_schema는 서버가 동시 거부할 수 있어 **2-call**: Call 1(grounded, schema 없음, 웹검색 자유텍스트) → Call 2(schema, tools 없음, `{artist,title}` 추출).

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/recsys/test_newrelease.py` 신규:

```python
"""취향 맞춤 신보(신곡) — 2단계 Gemini(grounded→structured) + 적재/제외."""
from __future__ import annotations

import uuid as _uuid
from unittest.mock import patch

import pytest

import mrms.recsys.discover as _disc_mod
import mrms.recsys.newrelease as _nr_mod
from mrms.db.user_track import get_or_create_user
from mrms.emp.base import upsert_track_and_emp_source
from mrms.recsys.discover import TrackSuggestion, TrackSuggestions
from mrms.recsys.newrelease import gemini_new_releases, read_newrelease


# ── 2-call fake Gemini (Call1=grounded text, Call2=structured parsed) ──
class _FakeModels2:
    def __init__(self, results):
        self._results = list(results)
        self.calls = []

    def generate_content(self, **kwargs):
        self.calls.append(kwargs)
        r = self._results[len(self.calls) - 1]
        if isinstance(r, Exception):
            raise r
        return r


class _FakeTextResp:
    def __init__(self, text):
        self.text = text


class _FakeParsedResp:
    def __init__(self, parsed):
        self.parsed = parsed


class _FakeClient2:
    def __init__(self, results):
        self.models = _FakeModels2(results)


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


def _grounded(text):
    return _FakeTextResp(text)


def _structured(items):
    return _FakeParsedResp(TrackSuggestions(items=items))


def test_gemini_new_releases_two_step_order():
    """Call1=grounded(tools=google_search), Call2=structured(response_schema)."""
    client = _FakeClient2([
        _grounded("NewArtist - Fresh Song (2026 발매)"),
        _structured([TrackSuggestion(artist="NewArtist", title="Fresh Song")]),
    ])
    out = gemini_new_releases({"artists": ["X"], "genres": ["pop"]}, 5, client=client)
    assert [s.title for s in out] == ["Fresh Song"]
    assert len(client.models.calls) == 2
    # Call1 grounded(tools 있음, schema 없음), Call2 structured(schema 있음, tools 없음)
    c0, c1 = client.models.calls[0]["config"], client.models.calls[1]["config"]
    assert c0.tools is not None and c0.response_schema is None
    assert c1.tools is None and c1.response_schema is not None


def test_gemini_new_releases_empty_grounded_raises():
    from mrms.recsys.discover import DiscoveryLLMError
    client = _FakeClient2([_grounded(""), _structured([])])
    with pytest.raises(DiscoveryLLMError):
        gemini_new_releases({"artists": ["X"], "genres": []}, 5, client=client)


def test_gemini_new_releases_none_parsed_raises():
    from mrms.recsys.discover import DiscoveryLLMError
    client = _FakeClient2([_grounded("some text"), _FakeParsedResp(None)])
    with pytest.raises(DiscoveryLLMError):
        gemini_new_releases({"artists": ["X"], "genres": []}, 5, client=client)


def test_gemini_new_releases_wraps_exception():
    from mrms.recsys.discover import DiscoveryLLMError
    client = _FakeClient2([RuntimeError("boom")])
    with pytest.raises(DiscoveryLLMError):
        gemini_new_releases({"artists": ["X"], "genres": []}, 5, client=client)
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `.venv/bin/pytest tests/recsys/test_newrelease.py -v`
Expected: FAIL — `mrms.recsys.newrelease` 모듈/`gemini_new_releases`/`read_newrelease` 없음(ImportError/ModuleNotFoundError).

- [ ] **Step 3: 모듈 작성 — `src/mrms/recsys/newrelease.py`**

```python
"""취향 맞춤 신보(신곡) — 취향 시드 → Gemini(웹검색 grounded → 구조화 추출) →
ytmusicapi 해석 → 보유곡/discovery 제외 → EMPSource(source_type='new_release',
source_id='new_release:{user_id}') 적재.

discover.py 파이프라인을 본뜬다. 전부 SYNC(generate_user_mrt 배치 컨벤션), best-effort
(어떤 실패도 0 반환, 예외 전파/rollback 금지 — 호출자 트랜잭션 보존). Gemini는 2-call:
Call1=grounded 웹검색(최신 발매 사실 수집, schema 없음), Call2=구조화 추출(tools 없음).
요청 시 read_newrelease로 읽어 별도 섹션으로 노출.
"""
from __future__ import annotations

import logging

import psycopg
from google import genai
from google.genai import types

from mrms.config import settings
from mrms.db.emp import delete_emp_sources_by_source_id
from mrms.emp.base import upsert_track_and_emp_source
from mrms.recsys.discover import (
    DiscoveryLLMError,
    TrackSuggestion,
    TrackSuggestions,
    _owned_song_keys,
    read_discovery,
    resolve_via_ytmusic,
    taste_seed,
)

log = logging.getLogger(__name__)


_GROUNDED_PROMPT = (
    "너는 음악 큐레이터다. 주어진 사용자의 취향 아티스트와 장르를 보고, 웹 검색을 활용해 "
    "'최근 약 6개월 이내에 새로 발매된' 곡 중 그 취향의 사용자가 좋아할 만한 곡을 찾는다.\n"
    "- 최신 발매(신보/신곡) 위주. 오래된 곡은 금지.\n"
    "- 시드 아티스트 본인의 신곡뿐 아니라 비슷한 연관 아티스트의 신곡도 포함.\n"
    "- 실제로 존재하고 검색으로 확인된 곡만. artist·title·발매 시기를 함께 적어라.\n"
    "- 다양성: 같은 아티스트만 반복하지 말 것."
)

_EXTRACT_PROMPT = (
    "아래 텍스트에서 추천된 곡들의 artist와 title만 정확히 추출해 정리한다. "
    "텍스트에 없는 곡을 새로 지어내지 말 것. artist·title은 정확한 표기로."
)


def _client() -> genai.Client:
    return genai.Client(api_key=settings.gemini_api_key)


def gemini_new_releases(
    seed: dict, n: int, *, client: genai.Client | None = None
) -> list[TrackSuggestion]:
    """취향 시드 → Gemini 2단계(grounded 웹검색 → 구조화 추출) → 신곡 {artist,title} n개.

    Call1: tools=[google_search], schema 없음 → resp.text(자유텍스트).
    Call2: response_schema=TrackSuggestions, tools 없음 → resp.parsed.items.
    실패 시 DiscoveryLLMError(discover.py 재사용 — best-effort 신호)."""
    client = client or _client()
    seed_line = (
        f"취향 아티스트: {', '.join(seed.get('artists') or []) or '없음'}\n"
        f"취향 장르: {', '.join(seed.get('genres') or []) or '없음'}\n"
        f"이 취향에 맞는 최근 발매 신곡 {n}개를 웹 검색으로 찾아줘."
    )
    try:
        grounded = client.models.generate_content(
            model=settings.gemini_model,
            contents=seed_line,
            config=types.GenerateContentConfig(
                system_instruction=_GROUNDED_PROMPT,
                tools=[types.Tool(google_search=types.GoogleSearch())],
                max_output_tokens=4096,
            ),
        )
        text = grounded.text
        if not text:
            raise DiscoveryLLMError("grounded 신곡 검색이 빈 텍스트를 반환")
        resp = client.models.generate_content(
            model=settings.gemini_model,
            contents=f"{_EXTRACT_PROMPT}\n\n---\n{text}",
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=TrackSuggestions,
                max_output_tokens=4096,
                thinking_config=types.ThinkingConfig(thinking_budget=0),
            ),
        )
    except DiscoveryLLMError:
        raise
    except Exception as e:
        raise DiscoveryLLMError(str(e)) from e
    if resp.parsed is None:
        raise DiscoveryLLMError("Gemini가 파싱 가능한 신곡 목록을 주지 않음")
    return resp.parsed.items


def read_newrelease(
    conn: psycopg.Connection, user_id: str, *, limit: int = 50
) -> list[dict]:
    """new_release:{user_id} EMPSource의 트랙 + 메타(youtube_track_id 포함). importedAt 순.

    read_discovery와 동형 — source_id 규칙만 다르다. dict 키는 read_discovery와 동일하게
    유지해야 main.py의 _unified가 그대로 읽는다."""
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
            (f"new_release:{user_id}", limit),
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


def generate_user_newrelease(
    conn: psycopg.Connection, user_id: str, *,
    client: genai.Client | None = None, n: int = 20,
) -> int:
    """취향 시드 → Gemini(2단계) → ytmusic 해석 → 보유곡+discovery 제외 → new_release 재적재.

    best-effort: 어떤 실패도 0 반환(예외 전파/rollback 금지 — 호출자 트랜잭션 보존).
    내부 upsert/delete는 자체 commit. 반환=적재 트랙 수."""
    from mrms.recsys.taste_mood import _song_key  # 함수-로컬: 순환 import 회피

    try:
        # prod 안전망: Gemini 키 없으면 조용히 skip (무회귀). client 명시 주입(테스트)이면 진행.
        if client is None and not settings.gemini_api_key:
            return 0
        seed = taste_seed(conn, user_id)
        if not seed["artists"]:
            return 0
        suggestions = gemini_new_releases(seed, n, client=client)
        resolved = resolve_via_ytmusic(conn, suggestions)
        if not resolved:
            return 0
        # 보유곡 + 이미 discovery로 노출 중인 곡 제외 (두 섹션 교차중복 방지)
        owned = _owned_song_keys(conn, user_id)
        disc_keys = {_song_key(d["artist"], d["title"]) for d in read_discovery(conn, user_id)}
        exclude = owned | disc_keys
        fresh = [t for t in resolved if _song_key(t["artist"], t["title"]) not in exclude]
        if not fresh:
            return 0
    except DiscoveryLLMError as e:
        log.warning("new_release LLM failed for %s: %r", user_id, e)
        return 0
    except Exception as e:  # noqa: BLE001 — best-effort, MRT 생성 막지 않음
        log.warning("new_release seed/resolve failed for %s: %r", user_id, e)
        return 0

    # 여기서부터 DB 쓰기 (내부 commit). 실패는 per-track rollback + continue.
    src = f"new_release:{user_id}"
    try:
        delete_emp_sources_by_source_id(conn, src)  # 자체 commit (replace)
    except Exception as e:  # noqa: BLE001 — best-effort: 예외 전파 금지(호출자 트랜잭션 보존)
        log.warning("new_release delete failed for %s: %r", user_id, e)
        return 0
    count = 0
    for t in fresh:
        try:
            upsert_track_and_emp_source(
                conn, isrc=None, title=t["title"], artist=t["artist"],
                album_title=t.get("album_title"), duration_ms=t.get("duration_ms"),
                platform="youtube", platform_track_id=t["platform_track_id"],
                source_type="new_release", source_id=src, source_name="New Releases",
                cover_url=t.get("album_cover"),
            )
            count += 1
        except Exception as e:  # noqa: BLE001 — 한 곡 실패가 나머지를 막지 않음
            conn.rollback()
            log.warning("new_release persist failed (%s): %r", t.get("title"), e)
    return count
```

> ⚠️ `read_discovery`의 youtube LEFT JOIN `NOT LIKE 'yt\_%%' ESCAPE '\'` 조건을 `read_newrelease`에도 그대로 복제했다(합성 placeholder 배제). `_owned_song_keys`는 discover의 module-internal 헬퍼지만 같은 패키지라 import 가능. `_song_key`는 `taste_mood`에서 함수-로컬 import(순환 회피, discover와 동일).

- [ ] **Step 4: Task 1 단위 테스트 통과 확인**

Run: `.venv/bin/pytest tests/recsys/test_newrelease.py -v -k gemini_new_releases`
Expected: PASS (4개 — two_step_order, empty_grounded_raises, none_parsed_raises, wraps_exception).

- [ ] **Step 5: lint + Commit**

Run: `.venv/bin/ruff check src/mrms/recsys/newrelease.py tests/recsys/test_newrelease.py`
Expected: 신규 위반 없음(`_owned_song_keys` import의 `F401`/private-import 경고 없으면 OK; `# noqa: BLE001` 유지).

```bash
git add src/mrms/recsys/newrelease.py tests/recsys/test_newrelease.py
git commit -m "feat(newrelease): recsys/newrelease.py — gemini_new_releases 2단계 grounded→structured + read_newrelease"
```

---

### Task 2: `generate_user_newrelease` 적재 + 보유곡/discovery 제외 (통합 테스트)

**Files:**
- Modify: `tests/recsys/test_newrelease.py` (테스트 추가)
- (구현은 Task 1 Step 3에서 `generate_user_newrelease` 이미 작성됨 — 이 태스크는 통합 테스트로 검증)

- [ ] **Step 1: 실패하는 통합 테스트 추가**

`tests/recsys/test_newrelease.py` 끝에 추가. DB 시드 헬퍼는 test_discover.py에서 복제:

```python
# ── DB 시드 헬퍼 (test_discover.py 복제) ──
def _mk_artist(conn, name, genre=None):
    aid = "ar_" + _uuid.uuid4().hex[:12]
    with conn.cursor() as cur:
        cur.execute(
            'INSERT INTO "Artist" (id, name, "nameNormalized", "mainGenre") VALUES (%s,%s,%s,%s)',
            (aid, name, name.lower(), genre),
        )
    return aid


def _mk_track(conn, artist_id, title):
    tid = "tr_" + _uuid.uuid4().hex[:12]
    with conn.cursor() as cur:
        cur.execute(
            'INSERT INTO "Track" (id, isrc, title, "titleNormalized", "durationMs", "artistId") '
            'VALUES (%s,%s,%s,%s,%s,%s)',
            (tid, "TST" + tid[-9:], title, title.lower(), 0, artist_id),
        )
    return tid


def _add_usertrack(conn, user_id, track_id):
    with conn.cursor() as cur:
        cur.execute(
            'INSERT INTO "UserTrack" (id, "userId", "trackId", "isCore", source, platform) '
            'VALUES (%s,%s,%s,FALSE,%s,%s) ON CONFLICT DO NOTHING',
            ("ut_" + _uuid.uuid4().hex[:12], user_id, track_id, "liked", "youtube"),
        )


def test_generate_user_newrelease_persists_and_excludes(db_conn, cleanup):
    """신곡 적재 + 보유곡 + discovery 곡 둘 다 제외."""
    user_id = get_or_create_user(db_conn, f"nr-{_uuid.uuid4().hex[:8]}@test.com")
    # 라이브러리(시드 + 보유곡 제외): Diana Krall 1곡
    a = _mk_artist(db_conn, "Diana Krall", "jazz")
    owned_tid = _mk_track(db_conn, a, "The Look of Love")
    _add_usertrack(db_conn, user_id, owned_tid)
    # 이미 discovery로 노출 중인 곡 1개 (제외돼야)
    disc = upsert_track_and_emp_source(
        db_conn, isrc=None, title="Disc Song", artist="Disc Artist",
        album_title=None, duration_ms=180000, platform="youtube",
        platform_track_id="YTDISC", source_type="discovery",
        source_id=f"discovery:{user_id}", source_name="Discovery",
    )
    db_conn.commit()
    cleanup('DELETE FROM "EMPSource" WHERE source_id = %s', (f"discovery:{user_id}",))
    cleanup('DELETE FROM "EMPSource" WHERE source_id = %s', (f"new_release:{user_id}",))

    # Gemini fake(2-call): [신곡, 보유곡, discovery곡] 제안 → 신곡만 남아야
    client = _FakeClient2([
        _grounded("text"),
        _structured([
            TrackSuggestion(artist="Stacey Kent", title="New Hit"),
            TrackSuggestion(artist="Diana Krall", title="The Look of Love"),
            TrackSuggestion(artist="Disc Artist", title="Disc Song"),
        ]),
    ])
    stub = _StubYT({
        "Stacey Kent New Hit": [_song_item("YTNR1", "New Hit", "Stacey Kent")],
        "Diana Krall The Look of Love": [_song_item("YTOWN", "The Look of Love", "Diana Krall")],
        "Disc Artist Disc Song": [_song_item("YTDISC2", "Disc Song", "Disc Artist")],
    })
    with patch.object(_disc_mod, "_ytmusic", return_value=stub):
        count = _nr_mod.generate_user_newrelease(db_conn, user_id, client=client, n=5)

    assert count == 1  # 보유곡·discovery곡 제외 → 신곡 1개만
    rows = read_newrelease(db_conn, user_id, limit=10)
    assert [r["youtube_track_id"] for r in rows] == ["YTNR1"]

    # cleanup 등록 역순(=실행 순): Artist → owned Track → 적재 Track들 → discovery Track → UserTrack
    cleanup('DELETE FROM "Artist" WHERE id = %s', (a,))
    cleanup('DELETE FROM "Track" WHERE "artistId" = %s', (a,))
    for r in rows:
        cleanup('DELETE FROM "Track" WHERE id = %s', (r["track_id"],))
    cleanup('DELETE FROM "Track" WHERE id = %s', (disc["track_id"],))
    cleanup('DELETE FROM "UserTrack" WHERE "userId" = %s', (user_id,))


def test_generate_user_newrelease_no_seed_returns_zero(db_conn):
    """UserTrack 없음 → seed 빈약 → Gemini 호출 전에 0."""
    user_id = get_or_create_user(db_conn, f"nrns-{_uuid.uuid4().hex[:8]}@test.com")
    client = _FakeClient2([_grounded("t"), _structured([])])
    count = _nr_mod.generate_user_newrelease(db_conn, user_id, client=client, n=5)
    assert count == 0
    assert client.models.calls == []  # seed 비면 Gemini 미호출


def test_generate_user_newrelease_no_key_skips(db_conn, monkeypatch):
    """client=None + 키 없음 → 조용히 skip(0)."""
    user_id = get_or_create_user(db_conn, f"nrnk-{_uuid.uuid4().hex[:8]}@test.com")
    monkeypatch.setattr(_nr_mod.settings, "gemini_api_key", "")
    count = _nr_mod.generate_user_newrelease(db_conn, user_id, client=None, n=5)
    assert count == 0
```

- [ ] **Step 2: 테스트 실행 — 통과 확인**

Run: `.venv/bin/pytest tests/recsys/test_newrelease.py -v`
Expected: PASS (7개 — Task 1 단위 4 + 통합 3). `generate_user_newrelease`는 Task 1에서 구현됐으므로 바로 통과해야 함.

> 만약 `test_generate_user_newrelease_persists_and_excludes`가 실패하면 `_owned_song_keys`/`read_discovery`/`_song_key` 제외 로직 또는 `resolve_via_ytmusic` 패치 타깃(`_disc_mod._ytmusic`)을 확인.

- [ ] **Step 3: lint + Commit**

Run: `.venv/bin/ruff check tests/recsys/test_newrelease.py`
Expected: 신규 위반 없음.

```bash
git add tests/recsys/test_newrelease.py
git commit -m "test(newrelease): generate_user_newrelease 적재+보유곡/discovery 제외+skip 통합 테스트"
```

---

### Task 3: `generate_user_mrt` best-effort 훅 (per-user 생성)

**Files:**
- Modify: `src/mrms/recsys/mrt.py`

discovery 훅(mrt.py)을 본떠 신곡 훅을 추가한다. import는 MODEL_VERSION 아래 discover import 옆(circular-import guard), 호출은 discovery best-effort 블록 다음·`return len(track_ids)` 앞.

- [ ] **Step 1: 모듈 import 추가**

`src/mrms/recsys/mrt.py`의 MODEL_VERSION 직후, 기존 discover import 옆(현재 23-25줄)에 newrelease import를 추가한다. 현재:

```python
MODEL_VERSION = f"{EMBEDDING_MODEL_VERSION}+persona-K3"
from mrms.recsys.discover import (  # noqa: E402,I001 — after MODEL_VERSION (circular-import guard)
    generate_user_discovery,
)
```

다음으로 변경:

```python
MODEL_VERSION = f"{EMBEDDING_MODEL_VERSION}+persona-K3"
from mrms.recsys.discover import (  # noqa: E402,I001 — after MODEL_VERSION (circular-import guard)
    generate_user_discovery,
)
from mrms.recsys.newrelease import (  # noqa: E402,I001 — after MODEL_VERSION (circular-import guard)
    generate_user_newrelease,
)
```

- [ ] **Step 2: 훅 호출 추가**

`generate_user_mrt` 본문의 discovery best-effort try/except 블록(현재) 바로 다음, `return len(track_ids)` 바로 앞에 신곡 훅을 같은 패턴으로 추가한다. 현재:

```python
    # EMP-밖 discovery (best-effort) — 실패해도 MRT 생성/커밋을 막지 않는다.
    # rollback 금지(위 persona 쓰기를 같은 트랜잭션에서 잃음). discovery는 EMPSource에만 적재.
    try:
        generate_user_discovery(conn, user_id)
    except Exception as e:  # noqa: BLE001 — best-effort
        log.warning("discovery skipped for %s: %r", user_id, e)

    return len(track_ids)
```

다음으로 변경(신곡 훅 블록을 discovery 블록과 `return` 사이에 삽입):

```python
    # EMP-밖 discovery (best-effort) — 실패해도 MRT 생성/커밋을 막지 않는다.
    # rollback 금지(위 persona 쓰기를 같은 트랜잭션에서 잃음). discovery는 EMPSource에만 적재.
    try:
        generate_user_discovery(conn, user_id)
    except Exception as e:  # noqa: BLE001 — best-effort
        log.warning("discovery skipped for %s: %r", user_id, e)

    # 취향 맞춤 신보 (best-effort) — discovery와 동일 규약. EMPSource(new_release)에만 적재.
    try:
        generate_user_newrelease(conn, user_id)
    except Exception as e:  # noqa: BLE001 — best-effort
        log.warning("new_release skipped for %s: %r", user_id, e)

    return len(track_ids)
```

- [ ] **Step 3: import 안전성 검증(순환 import 가드 확인)**

Run:
```bash
cd "/Volumes/MacExtend 1/MRMS_FN" && .venv/bin/python -c "import mrms.recsys.mrt; import mrms.recsys.newrelease; import mrms.api.main; print('IMPORTS OK')"
```
Expected: `IMPORTS OK` (순환 import / import 에러 없음). 이 import 스모크가 이 태스크의 핵심 검증 — 훅은 검증된 discovery 패턴의 4줄 미러라 별도 단위테스트 없이 import-안전성으로 게이트한다(generate_user_mrt 전체 실행은 임베딩 ≥k 필요로 무겁고 DB 격리 안 됨).

- [ ] **Step 4: lint + Commit**

Run: `.venv/bin/ruff check src/mrms/recsys/mrt.py`
Expected: 신규 위반 없음(추가한 import의 `# noqa: E402,I001`, 훅의 `# noqa: BLE001` 유지).

```bash
git add src/mrms/recsys/mrt.py
git commit -m "feat(mrt): generate_user_mrt에 new_release best-effort 훅 (discovery 옆)"
```

---

### Task 4: 서빙 — `MrtLatestResponse.recommended_new_releases` + `mrt_latest`

**Files:**
- Modify: `src/mrms/api/schemas.py`
- Modify: `src/mrms/api/main.py`
- Test: `tests/api/test_mrt.py` (테스트 추가)

- [ ] **Step 1: 실패하는 API 테스트 추가**

`tests/api/test_mrt.py` 끝에 추가(`test_mrt_latest_blends_discovery_tracks` 패턴 미러):

```python
def test_mrt_latest_includes_new_releases(db_conn, login, cleanup):
    user_id, session_id = login()
    # persona 1개 적재(early-return 회피)
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

    src = f"new_release:{user_id}"
    r = upsert_track_and_emp_source(
        db_conn, isrc=None, title="NR Track", artist="NR Artist",
        album_title=None, duration_ms=200000, platform="youtube",
        platform_track_id="YTNRSERVE", source_type="new_release", source_id=src,
        source_name="New Releases",
    )
    ntid = r["track_id"]
    cleanup('DELETE FROM "EMPSource" WHERE source_id = %s', (src,))
    cleanup('DELETE FROM "TrackPlatform" WHERE "trackId" = %s', (ntid,))
    cleanup('DELETE FROM "Track" WHERE id = %s', (ntid,))

    client.cookies.set("mrms_session", session_id)
    resp = client.get("/api/mrt/latest")
    client.cookies.clear()
    assert resp.status_code == 200, resp.text
    nr = [t for t in resp.json()["recommended_new_releases"] if t["track_id"] == ntid]
    assert len(nr) == 1
    assert nr[0]["youtube_track_id"] == "YTNRSERVE"
    assert nr[0]["title"] == "NR Track"
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `.venv/bin/pytest tests/api/test_mrt.py::test_mrt_latest_includes_new_releases -v`
Expected: FAIL — 응답에 `recommended_new_releases` 키 없음(KeyError) 또는 빈 리스트.

- [ ] **Step 3: schemas.py — 필드 추가**

`src/mrms/api/schemas.py`의 `MrtLatestResponse`(현재):

```python
class MrtLatestResponse(BaseModel):
    generated_at: datetime | None = None
    model_version: str | None = None
    personas: list[Persona]
    recommended_tracks: list[RecommendedTrack]
    recommended_albums: list[RecommendedAlbum]
    recommended_playlists: list[RecommendedPlaylist] = []
```

맨 아래 한 줄 추가:

```python
class MrtLatestResponse(BaseModel):
    generated_at: datetime | None = None
    model_version: str | None = None
    personas: list[Persona]
    recommended_tracks: list[RecommendedTrack]
    recommended_albums: list[RecommendedAlbum]
    recommended_playlists: list[RecommendedPlaylist] = []
    recommended_new_releases: list[RecommendedTrack] = []
```

- [ ] **Step 4: main.py — import 추가**

`src/mrms/api/main.py`의 discover import(현재 `from mrms.recsys.discover import blend_recsys, read_discovery`) 다음 줄에 newrelease import 추가:

```python
from mrms.recsys.discover import blend_recsys, read_discovery
from mrms.recsys.newrelease import read_newrelease
from mrms.recsys.mrt import derive_recommended_albums, derive_recommended_tracks
```

- [ ] **Step 5: main.py — read_newrelease 읽기 + nr_meta + union 보강**

`mrt_latest`의 discovery 읽기 블록(현재):

```python
    # EMP-밖 discovery 캐시 읽기 (배치에서 적재됨). 메타는 여기가 제공(persona meta엔 없음).
    discovery_rows = read_discovery(conn, user_id, limit=top_tracks_n)
    disc_meta = {d["track_id"]: d for d in discovery_rows}

    # hidden(owned|blocked)을 persona + discovery union으로 계산
    union_ids = list(set(all_track_ids) | set(disc_meta))
```

다음으로 변경(신곡 읽기 추가 + union에 포함):

```python
    # EMP-밖 discovery 캐시 읽기 (배치에서 적재됨). 메타는 여기가 제공(persona meta엔 없음).
    discovery_rows = read_discovery(conn, user_id, limit=top_tracks_n)
    disc_meta = {d["track_id"]: d for d in discovery_rows}

    # 취향 맞춤 신보 캐시 읽기 (별도 섹션용 — 메인 블렌드엔 안 섞음).
    newrelease_rows = read_newrelease(conn, user_id, limit=top_tracks_n)
    nr_meta = {d["track_id"]: d for d in newrelease_rows}

    # hidden(owned|blocked)을 persona + discovery + 신보 union으로 계산
    union_ids = list(set(all_track_ids) | set(disc_meta) | set(nr_meta))
```

- [ ] **Step 6: main.py — `_unified`에 nr_meta 분기 추가**

`_unified` 헬퍼(현재):

```python
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
```

`disc_meta` 분기 다음에 `nr_meta` 분기(동형)를 추가:

```python
    # 통합 메타: persona meta(youtube 없음) / discovery / 신보 meta(youtube 있음)
    def _unified(tid: str) -> dict | None:
        if tid in disc_meta:
            d = disc_meta[tid]
            return {
                "title": d["title"], "artist": d["artist"], "album_id": d["album_id"],
                "album_title": d["album_title"], "duration_ms": d["duration_ms"],
                "tidal_track_id": d["tidal_track_id"], "spotify_track_id": d["spotify_track_id"],
                "youtube_track_id": d["youtube_track_id"],
            }
        if tid in nr_meta:
            d = nr_meta[tid]
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
```

- [ ] **Step 7: main.py — recommended_new_releases 빌드 루프 추가**

`recommended_tracks` 빌드 for-루프(현재 `for tid in blended_ids:` … RecommendedTrack append로 끝나는 블록) **바로 다음**에 신곡 빌드 루프를 추가한다. (신곡은 `read_newrelease`가 importedAt 순으로 이미 정렬해 반환하므로 blend 불필요. 신곡은 미보유라 score/persona/liked/pct는 기본값.)

`recommended_tracks` 루프 끝(마지막 `))` 다음 줄)에 추가:

```python
    # 취향 맞춤 신보 — 별도 섹션(blend 안 함, importedAt 순). 미보유라 score/liked/pct 기본값.
    newrelease_ids = [d["track_id"] for d in newrelease_rows]
    recommended_new_releases = []
    for tid in newrelease_ids:
        if tid in hidden:
            continue
        u = _unified(tid)
        if u is None:
            continue
        recommended_new_releases.append(RecommendedTrack(
            track_id=tid,
            title=u["title"], artist=u["artist"], album_id=u["album_id"],
            album_title=u["album_title"], duration_ms=u["duration_ms"],
            score=0.0, persona_idx=None,
            tidal_track_id=u["tidal_track_id"], spotify_track_id=u["spotify_track_id"],
            youtube_track_id=u["youtube_track_id"],
            liked=False, pct=False,
        ))
```

- [ ] **Step 8: main.py — 최종 응답에 필드 추가**

`mrt_latest`의 최종 `return MrtLatestResponse(...)`(현재):

```python
    return MrtLatestResponse(
        generated_at=playlists_sorted[0].get("generatedAt"),
        model_version=playlists_sorted[0].get("modelVersion"),
        personas=personas,
        recommended_tracks=recommended_tracks,
        recommended_albums=recommended_albums,
        recommended_playlists=recommended_playlists,
    )
```

`recommended_playlists` 다음에 한 줄 추가:

```python
    return MrtLatestResponse(
        generated_at=playlists_sorted[0].get("generatedAt"),
        model_version=playlists_sorted[0].get("modelVersion"),
        personas=personas,
        recommended_tracks=recommended_tracks,
        recommended_albums=recommended_albums,
        recommended_playlists=recommended_playlists,
        recommended_new_releases=recommended_new_releases,
    )
```

> early-return(`if not playlists:`)은 새 필드 기본값 `[]`로 자동 커버되므로 수정 불필요.

- [ ] **Step 9: 테스트 통과 확인 + lint**

Run: `.venv/bin/pytest tests/api/test_mrt.py -v`
Expected: PASS (기존 discovery 블렌드 테스트 + 신규 new_releases 테스트 모두).

Run: `.venv/bin/ruff check src/mrms/api/schemas.py src/mrms/api/main.py`
Expected: 신규 위반 없음.

- [ ] **Step 10: Commit**

```bash
git add src/mrms/api/schemas.py src/mrms/api/main.py tests/api/test_mrt.py
git commit -m "feat(mrt): MrtLatestResponse.recommended_new_releases + mrt_latest 신보 채움"
```

---

### Task 5: 플라이휠 게이트 — `scripts/13` MISS_SQL에 `'new_release'` 추가

**Files:**
- Modify: `scripts/13_embed_youtube_misses.py`

신곡(UserTrack 없는 youtube 트랙)도 오디오 다운로드 → MERT 임베딩 대상이 되도록 MISS_SQL의 EMPSource EXISTS 분기에 `'new_release'`를 추가한다. `=` → `IN`(괄호 변동 없음, diff 1줄).

- [ ] **Step 1: MISS_SQL 수정**

`scripts/13_embed_youtube_misses.py`의 MISS_SQL EMPSource EXISTS 절(현재):

```python
           OR EXISTS (SELECT 1 FROM "EMPSource" es
                      WHERE es."trackId" = t.id AND es.source_type = 'discovery'))
```

다음으로 변경:

```python
           OR EXISTS (SELECT 1 FROM "EMPSource" es
                      WHERE es."trackId" = t.id
                        AND es.source_type IN ('discovery', 'new_release')))
```

> 닫는 괄호 `))`(EXISTS 서브쿼리 + 바깥 OR 그룹) 개수 유지. UserTrack 분기가 아니라 EMPSource 분기에만 추가.

- [ ] **Step 2: 변경 검증**

Run:
```bash
cd "/Volumes/MacExtend 1/MRMS_FN" && grep -n "source_type IN ('discovery', 'new_release')" scripts/13_embed_youtube_misses.py && .venv/bin/python -c "import ast; ast.parse(open('scripts/13_embed_youtube_misses.py').read()); print('SYNTAX OK')"
```
Expected: grep 1건 매치 + `SYNTAX OK`. (스크립트는 파일명이 숫자로 시작해 import 불가 — `ast.parse`로 구문만 검증. SQL 자체는 Task 2/4에서 적재된 new_release EMPSource가 운영 시 이 게이트를 통과.)

- [ ] **Step 3: lint + Commit**

Run: `.venv/bin/ruff check scripts/13_embed_youtube_misses.py`
Expected: 신규 위반 없음.

```bash
git add scripts/13_embed_youtube_misses.py
git commit -m "feat(flywheel): scripts/13 MISS_SQL에 new_release source_type 추가(신곡 임베딩)"
```

---

### Task 6: 프론트 — `types.ts` 필드 + `MrtDashboard` PT 04 섹션

**Files:**
- Modify: `web/src/lib/types.ts`
- Modify: `web/src/components/mrms/MrtDashboard.tsx`

PT 02 트랙 섹션을 본떠 PT 04 신보 섹션을 추가(앨범 PT 03 뒤). `TrackRow`/`SectionHeader` 재사용. 멀티셀렉트는 PT 02와 동일 `selectedTracks`/`toggle` 공유(추가 상태 불필요). Play all/+playlist 툴바는 생략(최소 구성).

- [ ] **Step 1: types.ts 필드 추가**

`web/src/lib/types.ts`의 `MrtLatestResponse`(현재):

```typescript
export interface MrtLatestResponse {
  generated_at: string | null;
  model_version: string | null;
  personas: Persona[];
  recommended_tracks: RecommendedTrack[];
  recommended_albums: RecommendedAlbum[];
  recommended_playlists?: RecommendedPlaylist[];
}
```

`recommended_playlists` 다음에 한 줄 추가:

```typescript
export interface MrtLatestResponse {
  generated_at: string | null;
  model_version: string | null;
  personas: Persona[];
  recommended_tracks: RecommendedTrack[];
  recommended_albums: RecommendedAlbum[];
  recommended_playlists?: RecommendedPlaylist[];
  recommended_new_releases?: RecommendedTrack[];
}
```

- [ ] **Step 2: MrtDashboard.tsx — PT 04 섹션 추가**

`web/src/components/mrms/MrtDashboard.tsx`의 ALBUMS 섹션(PT 03, `{/* === ALBUMS === */}` 블록) **닫는 `</div>` 다음**, 컴포넌트 return의 다른 섹션들과 같은 레벨에 신보 섹션을 추가한다. ALBUMS 섹션이 끝나는 지점을 찾아 그 뒤에 삽입(들여쓰기는 형제 섹션과 동일):

```tsx
      {/* === NEW RELEASES (취향 맞춤 신보) === */}
      <div className="mt-10">
        <SectionHeader
          num="PT 04"
          title="New releases, for you"
          meta={`${mrt.recommended_new_releases?.length ?? 0} tracks`}
        />
        <div className="hidden md:grid grid-cols-[18px_56px_1fr_140px_80px_60px_80px] gap-3 px-0 py-1.5 border-b border-[var(--mrms-ink)] font-mono text-[9px] tracking-editorial uppercase text-[var(--mrms-ink-mute)]">
          <span />
          <span />
          <span>Title</span>
          <span>Persona</span>
          <span>Match</span>
          <span className="text-right">Time</span>
          <span />
        </div>
        <div className="md:hidden border-b border-[var(--mrms-ink)] py-1.5 font-mono text-[9px] tracking-editorial uppercase text-[var(--mrms-ink-mute)]">
          New
        </div>

        {(mrt.recommended_new_releases ?? []).map((t) => (
          <TrackRow
            key={t.track_id}
            track={t}
            personaLabel={
              t.persona_idx != null
                ? personaLabelByIdx.get(t.persona_idx) ?? null
                : null
            }
            checked={selectedTracks.has(t.track_id)}
            onToggle={() => toggle(t.track_id)}
          />
        ))}

        {(mrt.recommended_new_releases?.length ?? 0) === 0 && (
          <div className="py-12 text-center font-mono text-[11px] tracking-editorial uppercase text-[var(--mrms-ink-mute)]">
            — no new releases —
          </div>
        )}
      </div>
```

> `SectionHeader`/`TrackRow`/`selectedTracks`/`toggle`/`personaLabelByIdx`는 컴포넌트 스코프에 이미 정의·존재(PT 02에서 사용 중). 신보는 PT 02와 동일 멀티셀렉트 집합을 공유하므로 선택 시 PT 02 "+ N selected"에 합산된다(의도된 동작 — 신곡도 플레이리스트로 묶을 수 있음).

- [ ] **Step 3: 타입체크 + lint + 빌드**

Run:
```bash
cd "/Volumes/MacExtend 1/MRMS_FN/web" && npx tsc --noEmit -p tsconfig.json
```
Expected: 에러 없음.

```bash
cd "/Volumes/MacExtend 1/MRMS_FN/web" && pnpm lint 2>&1 | grep -E "MrtDashboard|types\.ts" || echo "NO FINDINGS IN CHANGED FILES"
```
Expected: `NO FINDINGS IN CHANGED FILES`(또는 pre-existing 경고만).

```bash
cd "/Volumes/MacExtend 1/MRMS_FN/web" && pnpm build 2>&1 | grep -E "Compiled successfully|Failed|Error:|/mrt" | head
```
Expected: `Compiled successfully`, `/mrt` 라우트 존재, 컴파일 에러 없음.

- [ ] **Step 4: Commit**

```bash
git add web/src/lib/types.ts web/src/components/mrms/MrtDashboard.tsx
git commit -m "feat(mrt): /mrt에 취향 맞춤 신보 PT 04 섹션 (types + MrtDashboard)"
```

---

## 수동 검증 (전체 완료 후, dev/prod)

1. ADMIN_EMAIL 계정 `/admin/emp` → "추천 실행" → 본인 email(특정) 실행 → MRT 재생성과 함께 신곡도 생성됨.
2. `/mrt` → "PT 04 · New releases, for you" 섹션에 신곡이 뜨고 재생 가능(youtube videoId resolve).
3. 운영: `scripts/13` 다음 실행 시 new_release 트랙 오디오 다운로드 → `scripts/10` 임베딩 → 이후 MRT 후보로 진입(EMP 풀 성장).
4. discovery에 이미 있는 곡은 신곡 섹션에 중복 노출 안 됨(교차 제외).

---

## Self-Review (작성자 체크 결과)

**Spec coverage:** (1) `gemini_new_releases` 2단계 grounded→structured = Task 1, (2) `read_newrelease`/`generate_user_newrelease`(보유곡+discovery 제외, source_type='new_release') = Task 1+2, (3) `generate_user_mrt` 훅 = Task 3, (4) `MrtLatestResponse.recommended_new_releases` + `mrt_latest` = Task 4, (5) `scripts/13` MISS_SQL = Task 5, (6) 프론트 types+PT04 섹션 = Task 6. 스펙의 모든 후속작업 항목 매핑됨.

**Placeholder scan:** 모든 코드 스텝에 실제 verbatim 코드. Task 3는 import-스모크가 검증(이유 명시: 훅 reach엔 임베딩≥k 필요, DB 격리 안 됨 — 검증된 4줄 미러). Task 5는 ast.parse+grep(숫자 파일명 import 불가 — 명시). 그 외 placeholder 없음.

**Type consistency:** `RecommendedTrack`(schemas.py / types.ts) 동일 필드. `recommended_new_releases`(schemas.py `list[RecommendedTrack]=[]` ↔ main.py 빌드 ↔ types.ts `RecommendedTrack[]?` ↔ test `recommended_new_releases` 키) 일치. `read_newrelease` 반환 dict 키 = `read_discovery`와 동형(`_unified` 재사용). `generate_user_newrelease(conn, user_id, *, client=None, n=20)` ↔ mrt 훅 `generate_user_newrelease(conn, user_id)` ↔ 테스트 호출 일치. `source_type='new_release'`/`source_id=f"new_release:{user_id}"` = read_newrelease WHERE = scripts/13 IN-clause 전부 일치. fake 2-call(`_FakeClient2`)이 `gemini_new_releases`의 2회 `generate_content` 호출과 일치.
