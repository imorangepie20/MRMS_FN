# YouTube Music 검색 (쿼터 밸런스) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 검색에 YouTube Music을 Tidal/Spotify 동급 제3 소스로 추가하되, ytmusicapi(쿼터 0)를 주력으로 쓰고 Data API 폴백은 일일 예산 가드로 상한을 둬 Data API v3 한도에 걸리지 않게 한다.

**Architecture:** ytmusicapi로 YT Music 카탈로그를 검색(쿼터 0)해 우리 포맷으로 정규화 → `merge_tracks`(YT는 ISRC 없어 별 행, `youtube_track_id`) → EMP 적재(videoId 보유 → 재생 resolve 쿼터 절약). ytmusicapi가 0건이면 일일 예산 안에서만 Data API v3 `search.list` 폴백. YT 검색은 유저가 YouTube를 연결한 경우에만 호출(Tidal/Spotify가 토큰 있을 때만 도는 것과 동형). v1은 트랙만(앨범/플리 후속).

**Tech Stack:** FastAPI + raw psycopg, `ytmusicapi`(비공식, 동기 → `asyncio.to_thread`), httpx(Data API 폴백), pytest(+respx, asyncio.run), `Setting` 키-값(예산 카운터).

**참고 — 절대 경로:** 저장소 루트 `/Volumes/MacExtend 1/MRMS_FN`. 모든 명령은 루트에서. 테스트 러너는 `.venv/bin/pytest`, ruff는 `.venv/bin/ruff`.

**⚠️ DB 격리:** dev DB는 격리 안 됨. **전체 `pytest tests/` 금지** — 대상 파일/노드만. 헬퍼가 내부 commit하면 `cleanup` fixture로 잔여물 정리.

---

### Task 1: `normalize.py` — `normalize_ytmusic_track` + `youtube_track_id`

**Files:**
- Modify: `src/mrms/search/normalize.py`
- Test: `tests/search/test_normalize.py`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/search/test_normalize.py` 맨 끝에 추가:

```python
from mrms.search.normalize import normalize_ytmusic_track, merge_tracks


def test_normalize_ytmusic_track_song():
    item = {
        "resultType": "song",
        "videoId": "ZrOKjDZOtkA",
        "title": "Man I Need",
        "artists": [{"name": "Olivia Dean", "id": "x"}],
        "album": {"name": "Man I Need", "id": "y"},
        "duration": "3:04",
        "duration_seconds": 184,
        "thumbnails": [{"url": "small", "width": 60}, {"url": "big", "width": 544}],
    }
    n = normalize_ytmusic_track(item)
    assert n == {
        "platform": "youtube",
        "platform_track_id": "ZrOKjDZOtkA",
        "title": "Man I Need",
        "artist": "Olivia Dean",
        "album_title": "Man I Need",
        "album_cover": "big",
        "duration_ms": 184000,
        "isrc": None,
    }


def test_normalize_ytmusic_video_no_album_uses_duration_string():
    item = {
        "resultType": "video",
        "videoId": "vU05Eksc_iM",
        "title": "Some Live",
        "artists": [{"name": "Band"}],
        "duration": "4:38",
        "thumbnails": [{"url": "t", "width": 120}],
    }
    n = normalize_ytmusic_track(item)
    assert n["platform_track_id"] == "vU05Eksc_iM"
    assert n["album_title"] is None
    assert n["duration_ms"] == 278000  # 4:38 → duration_seconds 없으면 'duration' 파싱
    assert n["isrc"] is None


def test_normalize_ytmusic_skips_non_track_and_missing_videoid():
    assert normalize_ytmusic_track({"resultType": "album", "browseId": "b"}) is None
    assert normalize_ytmusic_track({"resultType": "song", "title": "x"}) is None  # videoId 없음
    assert normalize_ytmusic_track("nope") is None


def test_merge_tracks_youtube_separate_row_with_youtube_id():
    yt = {
        "platform": "youtube", "platform_track_id": "VID1",
        "title": "T", "artist": "A", "album_title": None,
        "album_cover": None, "duration_ms": None, "isrc": None,
    }
    out = merge_tracks([yt])
    assert len(out) == 1
    assert out[0]["youtube_track_id"] == "VID1"
    assert out[0]["tidal_track_id"] is None
    assert out[0]["spotify_track_id"] is None
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `.venv/bin/pytest tests/search/test_normalize.py::test_normalize_ytmusic_track_song tests/search/test_normalize.py::test_merge_tracks_youtube_separate_row_with_youtube_id -v`
Expected: FAIL — `ImportError: cannot import name 'normalize_ytmusic_track'`.

- [ ] **Step 3: 구현**

`src/mrms/search/normalize.py`에서 `_first_image` 아래에 헬퍼 2개 추가:

```python
def _yt_thumbnail(thumbnails) -> str | None:
    """ytmusicapi thumbnails → 가장 큰 width url. 없으면 None."""
    if not isinstance(thumbnails, list):
        return None
    best_url, best_w = None, -1
    for t in thumbnails:
        if not isinstance(t, dict):
            continue
        url, w = t.get("url"), t.get("width") or 0
        if isinstance(url, str) and url and w > best_w:
            best_url, best_w = url, w
    return best_url


def _yt_duration_ms(item) -> int | None:
    """duration_seconds(int) 우선, 없으면 'M:SS'/'H:MM:SS' 파싱. 실패 None."""
    ds = item.get("duration_seconds")
    if isinstance(ds, int):
        return ds * 1000
    d = item.get("duration")
    if not isinstance(d, str):
        return None
    parts = d.strip().split(":")
    if not parts or len(parts) > 3:
        return None
    try:
        nums = [int(p) for p in parts]
    except ValueError:
        return None
    sec = 0
    for n in nums:
        sec = sec * 60 + n
    return sec * 1000


def normalize_ytmusic_track(item) -> dict | None:
    """ytmusicapi search 항목(song/video) → 우리 포맷. videoId 없으면 None."""
    if not isinstance(item, dict):
        return None
    if item.get("resultType") not in ("song", "video"):
        return None
    vid = item.get("videoId")
    if not vid:
        return None  # 합성 ID 금지 — IFrame 재생 불가
    artists = [a.get("name") for a in (item.get("artists") or []) if isinstance(a, dict)]
    album = item.get("album")
    return {
        "platform": "youtube",
        "platform_track_id": str(vid),
        "title": item.get("title"),
        "artist": ", ".join(n for n in artists if n) or "",
        "album_title": album.get("name") if isinstance(album, dict) else None,
        "album_cover": _yt_thumbnail(item.get("thumbnails")),
        "duration_ms": _yt_duration_ms(item),
        "isrc": None,
    }
```

같은 파일 `_to_flat` 함수에 `youtube_track_id` 한 줄 추가:

```python
def _to_flat(t: dict) -> dict:
    """단일 플랫폼 트랙 → flat 응답 트랙(track_id는 persist 후 채움)."""
    return {
        "track_id": t.get("track_id"),
        "title": t["title"],
        "artist": t["artist"],
        "album_title": t.get("album_title"),
        "album_cover": t.get("album_cover"),
        "duration_ms": t.get("duration_ms"),
        "isrc": t.get("isrc"),
        "tidal_track_id": t["platform_track_id"] if t["platform"] == "tidal" else None,
        "spotify_track_id": t["platform_track_id"] if t["platform"] == "spotify" else None,
        "youtube_track_id": t["platform_track_id"] if t["platform"] == "youtube" else None,
    }
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `.venv/bin/pytest tests/search/test_normalize.py -v`
Expected: PASS (기존 + 신규 4개).

- [ ] **Step 5: lint**

Run: `.venv/bin/ruff check src/mrms/search/normalize.py tests/search/test_normalize.py`
Expected: `All checks passed!` (import 정렬 경고면 `--fix` 후 재확인).

- [ ] **Step 6: Commit**

```bash
git add src/mrms/search/normalize.py tests/search/test_normalize.py
git commit -m "feat(yt-search): normalize_ytmusic_track + merge_tracks youtube_track_id"
```

---

### Task 2: `search/youtube.py` — ytmusicapi 검색 + 예산 가드 + Data API 폴백

**Files:**
- Create: `src/mrms/search/youtube.py`
- Test: `tests/search/test_youtube.py`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/search/test_youtube.py` 신규:

```python
"""YouTube Music 검색 — ytmusicapi 주력 + 예산가드 Data API 폴백."""
from __future__ import annotations

import asyncio
from unittest.mock import patch

import httpx
import respx
from httpx import Response

from mrms.db.settings import set_setting
from mrms.search import youtube as yt


class _StubYT:
    def __init__(self, results):
        self._results = results

    def search(self, q):  # ytmusicapi 동기 시그니처
        return self._results


def _run(coro):
    return asyncio.run(coro)


def test_search_youtube_uses_ytmusicapi_no_fallback(db_conn):
    """ytmusicapi가 결과를 주면 폴백 없이 정규화 트랙 반환."""
    items = [{
        "resultType": "song", "videoId": "VID1", "title": "Man I Need",
        "artists": [{"name": "Olivia Dean"}], "album": {"name": "Man I Need"},
        "duration_seconds": 184, "thumbnails": [{"url": "big", "width": 500}],
    }]
    with patch.object(yt, "_ytmusic", return_value=_StubYT(items)):
        async def go():
            async with httpx.AsyncClient() as http:
                return await yt.search_youtube(db_conn, "man i need", http=http)
        res = _run(go())
    assert res["albums"] == [] and res["playlists"] == []
    assert len(res["tracks"]) == 1
    assert res["tracks"][0]["platform_track_id"] == "VID1"


@respx.mock
def test_search_youtube_falls_back_to_data_api_when_empty(db_conn, cleanup, monkeypatch):
    """ytmusicapi 0건 + 예산 남음 + API 키 → Data API 폴백 + 카운터 증가."""
    monkeypatch.setenv("YOUTUBE_DATA_API_KEY", "KEY123")
    cleanup('DELETE FROM "Setting" WHERE key LIKE %s', ("yt_search_fallback_count_%",))
    respx.get("https://www.googleapis.com/youtube/v3/search").mock(
        return_value=Response(200, json={"items": [
            {"id": {"videoId": "FBVID"}, "snippet": {"title": "Fallback Song", "channelTitle": "Chan"}}
        ]}))
    with patch.object(yt, "_ytmusic", return_value=_StubYT([])):
        async def go():
            async with httpx.AsyncClient() as http:
                return await yt.search_youtube(db_conn, "obscure", http=http)
        res = _run(go())
    assert len(res["tracks"]) == 1
    assert res["tracks"][0]["platform_track_id"] == "FBVID"
    assert res["tracks"][0]["artist"] == "Chan"
    assert yt._today_count(db_conn) == 1


def test_search_youtube_skips_fallback_when_budget_exhausted(db_conn, cleanup, monkeypatch):
    """예산 소진이면 0건이어도 Data API 폴백 안 함."""
    monkeypatch.setenv("YOUTUBE_DATA_API_KEY", "KEY123")
    cleanup('DELETE FROM "Setting" WHERE key LIKE %s', ("yt_search_fallback_count_%",))
    cleanup('DELETE FROM "Setting" WHERE key = %s', ("yt_search_fallback_cap",))
    set_setting(db_conn, "yt_search_fallback_cap", "0")  # 예산 0
    with patch.object(yt, "_ytmusic", return_value=_StubYT([])):
        async def go():
            async with httpx.AsyncClient() as http:
                return await yt.search_youtube(db_conn, "obscure", http=http)
        res = _run(go())
    assert res["tracks"] == []  # 폴백 호출 안 됨 (respx 미설정이라 호출 시 에러날 것)
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `.venv/bin/pytest tests/search/test_youtube.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'mrms.search.youtube'`.

- [ ] **Step 3: 구현**

`src/mrms/search/youtube.py` 신규:

```python
"""YouTube Music 검색 — ytmusicapi 주력(쿼터 0) + 예산가드 Data API 폴백.

ytmusicapi(비공식)는 'songs' 검색이 간헐적으로 0이 될 수 있어, 0건일 때만
일일 예산 안에서 Data API v3 search.list로 폴백한다. ytmusicapi 결과는 videoId를
바로 주므로 EMP 적재 시 재생 resolve 쿼터를 절약한다.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
from datetime import datetime, timezone

import httpx
import psycopg

from mrms.db.settings import get_setting, set_setting
from mrms.search.normalize import normalize_ytmusic_track

log = logging.getLogger(__name__)

AUTH_SETTING_KEY = "youtube_auth_json"
FALLBACK_CAP_KEY = "yt_search_fallback_cap"
DEFAULT_FALLBACK_CAP = 30
YOUTUBE_SEARCH_URL = "https://www.googleapis.com/youtube/v3/search"
YT_FALLBACK_LIMIT = 12

# auth_raw 문자열 키 캐시 (Setting 교체 시 새 인스턴스). 무인증은 "" 키.
_yt_cache: dict[str, object] = {}


def _ytmusic(auth_raw: str | None):
    """YTMusic 인스턴스 (캐시). import lazy — ytmusicapi 없는 환경 순수테스트 보호."""
    cache_key = auth_raw or ""
    inst = _yt_cache.get(cache_key)
    if inst is None:
        from ytmusicapi import YTMusic

        auth = None
        if auth_raw:
            try:
                auth = json.loads(auth_raw)
            except ValueError:
                auth = None
        inst = YTMusic(auth) if auth else YTMusic()
        _yt_cache[cache_key] = inst
    return inst


def _today_key() -> str:
    return "yt_search_fallback_count_" + datetime.now(timezone.utc).strftime("%Y%m%d")


def _today_count(conn: psycopg.Connection) -> int:
    raw = get_setting(conn, _today_key())
    try:
        return int(raw) if raw else 0
    except ValueError:
        return 0


def _fallback_cap(conn: psycopg.Connection) -> int:
    raw = get_setting(conn, FALLBACK_CAP_KEY)
    try:
        return int(raw) if raw is not None else DEFAULT_FALLBACK_CAP
    except ValueError:
        return DEFAULT_FALLBACK_CAP


def _bump_fallback(conn: psycopg.Connection) -> None:
    set_setting(conn, _today_key(), str(_today_count(conn) + 1))


async def _ytmusic_search(conn: psycopg.Connection, q: str) -> list[dict]:
    """ytmusicapi 검색 → song/video 정규화 트랙. Data API 쿼터 0."""
    auth_raw = get_setting(conn, AUTH_SETTING_KEY)
    yt = _ytmusic(auth_raw)
    raw = await asyncio.to_thread(yt.search, q)
    out: list[dict] = []
    for item in raw or []:
        nt = normalize_ytmusic_track(item)
        if nt:
            out.append(nt)
    return out


async def _data_api_fallback(http: httpx.AsyncClient, q: str) -> list[dict]:
    """Data API v3 search.list(videoEmbeddable) → 트랙. 100유닛. 키 없으면 []."""
    key = os.environ.get("YOUTUBE_DATA_API_KEY")
    if not key:
        return []
    r = await http.get(
        YOUTUBE_SEARCH_URL,
        params={
            "part": "snippet", "type": "video", "videoEmbeddable": "true",
            "maxResults": YT_FALLBACK_LIMIT, "q": q, "key": key,
        },
        headers={"Accept": "application/json"},
    )
    if r.status_code != 200:
        log.warning("yt data api fallback %s: %s", r.status_code, r.text[:200])
        return []
    out: list[dict] = []
    for it in r.json().get("items", []):
        vid = (it.get("id") or {}).get("videoId")
        if not vid:
            continue
        sn = it.get("snippet") or {}
        out.append({
            "platform": "youtube",
            "platform_track_id": str(vid),
            "title": sn.get("title") or "",
            "artist": sn.get("channelTitle") or "",
            "album_title": None,
            "album_cover": None,
            "duration_ms": None,
            "isrc": None,
        })
    return out


async def search_youtube(
    conn: psycopg.Connection, q: str, *, http: httpx.AsyncClient
) -> dict:
    """ytmusicapi 주력 → 0건 + 예산 통과 시 Data API 폴백. v1 tracks만."""
    tracks = await _ytmusic_search(conn, q)
    if not tracks and _today_count(conn) < _fallback_cap(conn):
        fb = await _data_api_fallback(http, q)
        if fb:
            _bump_fallback(conn)
            tracks = fb
    return {"tracks": tracks, "albums": [], "playlists": []}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `.venv/bin/pytest tests/search/test_youtube.py -v`
Expected: PASS (3개).

- [ ] **Step 5: lint**

Run: `.venv/bin/ruff check src/mrms/search/youtube.py tests/search/test_youtube.py`
Expected: `All checks passed!` (import 정렬 경고면 `--fix` 후 재확인).

- [ ] **Step 6: Commit**

```bash
git add src/mrms/search/youtube.py tests/search/test_youtube.py
git commit -m "feat(yt-search): search_youtube (ytmusicapi 주력 + 예산가드 Data API 폴백)"
```

---

### Task 3: `persist.py` youtube 적재 + `api/search.py` YT 소스 fan-out (연결 게이트)

**Files:**
- Modify: `src/mrms/search/persist.py`
- Modify: `src/mrms/api/search.py`
- Test: `tests/api/test_search.py`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/api/test_search.py` 맨 끝에 추가:

```python
from unittest.mock import patch

from mrms.search import youtube as _yt_mod


class _StubYTSearch:
    def __init__(self, results):
        self._results = results

    def search(self, q):
        return self._results


def test_search_includes_youtube_for_connected_user(login, db_conn, cleanup):
    """YouTube 연결 유저 → ytmusicapi 결과가 tracks에 포함 + EMP 적재."""
    user_id, session_id = login()
    client.cookies.set("mrms_session", session_id)
    expires = datetime.now(timezone.utc) + timedelta(hours=1)
    upsert_oauth(db_conn, user_id, "youtube", access_token="YT", refresh_token="R",
                 expires_at=expires, scopes=[])
    db_conn.commit()
    cleanup('DELETE FROM "UserOAuth" WHERE "userId" = %s', (user_id,))
    cleanup('DELETE FROM "TrackPlatform" WHERE "platformTrackId" = %s', ("YTVID1",))

    items = [{
        "resultType": "song", "videoId": "YTVID1", "title": "YT Song",
        "artists": [{"name": "YT Artist"}], "album": {"name": "YT Album"},
        "duration_seconds": 200, "thumbnails": [{"url": "c", "width": 500}],
    }]
    with patch.object(_yt_mod, "_ytmusic", return_value=_StubYTSearch(items)):
        r = client.get("/api/search", params={"q": "yt song", "types": "track"})
    assert r.status_code == 200, r.text
    data = r.json()
    yt_rows = [t for t in data["tracks"] if t.get("youtube_track_id") == "YTVID1"]
    assert len(yt_rows) == 1
    tid = yt_rows[0]["track_id"]
    assert tid  # EMP 적재되어 track_id 채워짐
    client.cookies.clear()
    cleanup('DELETE FROM "EMPSource" WHERE "trackId" = %s', (tid,))
    cleanup('DELETE FROM "TrackPlatform" WHERE "trackId" = %s', (tid,))
    cleanup('DELETE FROM "Track" WHERE id = %s', (tid,))


def test_search_excludes_youtube_for_unconnected_user(login, db_conn):
    """YouTube 미연결 유저 → YT 검색 자체 안 함(트랙 없음)."""
    _, session_id = login()
    client.cookies.set("mrms_session", session_id)
    # ytmusicapi가 혹시 불려도 결과 못 내게 — 불리면 안 됨을 검증
    with patch.object(_yt_mod, "_ytmusic", return_value=_StubYTSearch([
        {"resultType": "song", "videoId": "SHOULDNOT", "title": "x",
         "artists": [{"name": "y"}], "duration_seconds": 1, "thumbnails": []}])):
        r = client.get("/api/search", params={"q": "anything", "types": "track"})
    assert r.status_code == 200
    data = r.json()
    assert not any(t.get("youtube_track_id") == "SHOULDNOT" for t in data["tracks"])
    client.cookies.clear()
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `.venv/bin/pytest tests/api/test_search.py::test_search_includes_youtube_for_connected_user -v`
Expected: FAIL — YT 소스가 라우트에 없어 `yt_rows` 0개 → 단언 실패.

- [ ] **Step 3: persist.py에 youtube 추가**

`src/mrms/search/persist.py`의 persist 루프 한 줄 변경 — `for platform, key in (...)`에 youtube 추가:

```python
        for platform, key in (
            ("tidal", "tidal_track_id"),
            ("spotify", "spotify_track_id"),
            ("youtube", "youtube_track_id"),
        ):
```

(나머지는 그대로 — `upsert_track_and_emp_source`는 `isrc=t.get("isrc")`가 None이어도 `(platform, platform_track_id)`로 dedup하므로 youtube 적재 정상 동작.)

- [ ] **Step 4: api/search.py에 YT 소스 fan-out 추가**

`src/mrms/api/search.py` import 블록에 두 줄 추가:

```python
from mrms.db.user_track import get_oauth
from mrms.search.youtube import search_youtube
```

`search` 함수의 fan-out 루프(spotify/tidal) 바로 다음, `async with httpx.AsyncClient(...) as http:` 블록 **안쪽**에 YT 소스 추가. 기존:

```python
            agg["tracks"].extend(res["tracks"])
            agg["albums"].extend(res["albums"])
            agg["playlists"].extend(res["playlists"])

    tracks = merge_tracks(agg["tracks"])
```

변경 후 (루프 종료 후, 같은 `async with` 블록 내에 YT 추가):

```python
            agg["tracks"].extend(res["tracks"])
            agg["albums"].extend(res["albums"])
            agg["playlists"].extend(res["playlists"])

        # YouTube Music — 연결한 유저만. ytmusicapi(쿼터 0) 주력 + 예산가드 폴백.
        if get_oauth(conn, user_id, "youtube"):
            try:
                yt_res = await search_youtube(conn, q, http=http)
                agg["tracks"].extend(yt_res["tracks"])
            except Exception as e:
                log.warning("search: youtube search failed: %r", e)
                skipped.append("youtube")

    tracks = merge_tracks(agg["tracks"])
```

(YT 블록의 들여쓰기는 `for platform...` 루프와 같은 레벨 = `async with http` 블록 바로 안. 루프 **밖**, `with` **안**.)

- [ ] **Step 5: 테스트 통과 확인**

Run: `.venv/bin/pytest tests/api/test_search.py -v`
Expected: PASS (기존 + 신규 2개).

- [ ] **Step 6: lint**

Run: `.venv/bin/ruff check src/mrms/search/persist.py src/mrms/api/search.py tests/api/test_search.py`
Expected: `All checks passed!` (B008 Depends는 레포 전역 accepted; import 정렬 경고면 `--fix` 후 재확인).

- [ ] **Step 7: Commit**

```bash
git add src/mrms/search/persist.py src/mrms/api/search.py tests/api/test_search.py
git commit -m "feat(yt-search): YT 소스 검색 fan-out(연결 게이트) + youtube EMP 적재"
```

---

## Self-Review (작성자 체크 결과)

**Spec coverage:** ytmusicapi 주력 엔진(Task 2), 예산가드 폴백(Task 2 `_fallback_cap`/`_today_count`/`_bump_fallback`), 정규화+youtube_track_id(Task 1), persist youtube(Task 3), 연결 게이트 fan-out(Task 3), videoId 적재로 resolve 쿼터 절약(Task 3 persist=TrackPlatform youtube). v1 트랙만(Task 2 `albums/playlists=[]`). spec의 엔진/쿼터/트리거/정규화/persist/에러 항목 모두 매핑. 프론트는 spec대로 무변경(ModalTrackList가 youtube_track_id 기지원).

**Placeholder scan:** 모든 코드 스텝에 실제 코드·명령·기대 출력. TBD/TODO 없음.

**Type consistency:** `normalize_ytmusic_track(item)->dict|None`(Task 1)이 Task 2 `_ytmusic_search`에서 사용; `_to_flat` youtube_track_id(Task 1)가 Task 3 테스트(`t["youtube_track_id"]`)·persist 루프 키와 일치; `search_youtube(conn, q, *, http)->{tracks,albums,playlists}`(Task 2)가 Task 3 라우트 호출과 일치; `get_oauth(conn, user_id, "youtube")`(Task 3) 시그니처 일치; Setting 키(`yt_search_fallback_cap`/`yt_search_fallback_count_*`)가 Task 2 코드·테스트에서 동일.
