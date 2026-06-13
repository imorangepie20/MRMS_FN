# 검색 → EMP 확장 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/search` 페이지에서 Tidal+Spotify를 라이브 검색해 우리 포맷으로 보여주면서, 결과 트랙을 동시에 EMP에 적재한다(사용자 주도 EMP import).

**Architecture:** 백엔드-퍼스트 2단계. Phase 1 = `src/mrms/search/`(플랫폼 어댑터 + normalize + ISRC 병합 + persist) + `api/search.py`(GET search, POST expand), 응답 스키마 동결. Phase 2 = `/search` 프론트 페이지(기존 ModalTrackList/EmpItemCard/ItemTracksModal 재사용). 검색 클라이언트·토큰·매칭은 `playback_resolve.py`, 적재는 `emp/base.py`에서 재사용.

**Tech Stack:** Python FastAPI + psycopg + httpx(respx 모킹), Next.js 16/React 19, pytest. 플랫폼 검색 API는 테스트에서 전부 모킹.

**근거 문서:** [spec](2026-06-14-search-emp-expansion-design.md) · [ADR-005](../../decisions/ADR-005-search-emp-expansion.md)

**⚠️ 테스트 DB 주의:** 통합 테스트는 dev DB에 cleanup fixture로 돈다. **전체 `pytest tests/` 금지**(tidal_x_token 삭제 이슈) — 작성한 파일만 지정 실행: `pytest tests/api/test_search.py -v` 등.

---

## File Structure

| 파일 | 책임 |
|---|---|
| `src/mrms/search/__init__.py` (신규) | 패키지 |
| `src/mrms/search/normalize.py` (신규) | 플랫폼 raw → 우리 포맷(트랙/앨범/플레이리스트) + ISRC 병합. 순수 함수 |
| `src/mrms/search/spotify.py` (신규) | Spotify `/v1/search?type=track,album,playlist` 어댑터(async httpx) |
| `src/mrms/search/tidal.py` (신규) | Tidal per-type 검색 어댑터(async httpx, 앨범/플레이리스트 degrade-capable) |
| `src/mrms/search/persist.py` (신규) | 트랙 결과 EMP 적재(`upsert_track_and_emp_source`) |
| `src/mrms/search/expand.py` (신규) | 컨테이너 구성 트랙 fetch+적재(Tidal/Spotify) |
| `src/mrms/api/search.py` (신규) | `GET /api/search`, `POST /api/search/expand` |
| `src/mrms/api/main.py` (수정) | search 라우터 등록 |
| `tests/search/test_normalize.py` (신규) | normalize + 병합 단위 |
| `tests/search/test_persist.py` (신규) | persist 적재 |
| `tests/api/test_search.py` (신규) | GET/POST 통합(respx + auth_user) |
| `web/src/lib/api/search.ts` (신규) | 검색 API 헬퍼 |
| `web/src/lib/types.ts` (수정) | 검색 응답 타입 |
| `web/src/app/(dashboard)/search/page.tsx` (신규) | /search 페이지 |
| `web/src/components/search/SearchResults.tsx` (신규) | 그룹 결과(Tracks/Albums/Playlists) |

**응답 트랙 형태(동결):** 프론트 `ModalTrack` 재사용을 위해 **flat** 형태로 내보낸다(내부 병합은 platforms로 추적하되 API는 평탄화):
`{track_id, title, artist, album_title, album_cover, duration_ms, isrc, tidal_track_id, spotify_track_id}` (없는 플랫폼은 null).

---

## Phase 1 — 백엔드

### Task 1: Tidal 앨범/플레이리스트 검색 spike (degrade 안전망)

**목적:** Tidal per-type 검색 가용성 확인. 코드는 degrade-capable로 짜고(안 되면 빈 리스트), 이 spike는 어느 엔드포인트가 사는지 기록.

**Files:**
- Create: `docs/superpowers/notes/2026-06-14-tidal-search-spike.md`

- [ ] **Step 1: 실API 호출로 확인** (유저 Tidal 토큰 필요 — 로컬에서 본인 토큰으로)

dev에서 본인 Tidal access token을 구해(예: DB `UserOAuth`의 spotify/tidal row, 또는 앱 로그인 후) 아래를 실행:
```bash
TOKEN="<tidal user access token>"
for T in albums playlists; do
  echo "=== /v1/search/$T ==="
  curl -s -o /dev/null -w "%{http_code}\n" \
    -H "Authorization: Bearer $TOKEN" \
    "https://api.tidal.com/v1/search/$T?query=newjeans&limit=3&countryCode=KR"
done
```
Expected: `200`이면 per-type 사용 가능. `404`면 `/v1/search?types=ALBUMS,PLAYLISTS` 시도. 둘 다 실패면 degrade(앨범/플레이리스트는 Spotify only).

- [ ] **Step 2: 결과 기록**

`docs/superpowers/notes/2026-06-14-tidal-search-spike.md`에 작성:
```markdown
# Tidal 검색 spike 결과 (2026-06-14)
- /v1/search/albums: <HTTP code>
- /v1/search/playlists: <HTTP code>
- 결론: per-type 사용 가능 / types= 파라미터 / degrade(Spotify only)
- 앨범 응답 샘플 키: <...> (track_count=totalNumberOfTracks? 등)
```
docs/README.md 운영 섹션에 한 줄 등록.

- [ ] **Step 3: Commit**
```bash
git add docs/superpowers/notes/2026-06-14-tidal-search-spike.md docs/README.md
git commit -m "docs(search): Tidal album/playlist search spike 결과"
```

> 이후 Task 4의 `tidal.py`는 spike 결과와 무관하게 **degrade-capable**(앨범/플레이리스트 검색 실패 시 `[]` 반환)로 구현하므로, 이 spike가 막혀도 전체 진행은 가능. spike는 "Tidal 컨테이너가 채워지는지" 확정용.

---

### Task 2: `search/normalize.py` — 플랫폼 raw → 포맷 (순수, TDD)

**Files:**
- Create: `src/mrms/search/__init__.py` (빈 파일)
- Create: `src/mrms/search/normalize.py`
- Test: `tests/search/test_normalize.py`

- [ ] **Step 1: 실패 테스트 작성** — `tests/search/test_normalize.py`:
```python
from __future__ import annotations

from mrms.search.normalize import (
    normalize_spotify_track,
    normalize_spotify_album,
    normalize_spotify_playlist,
    normalize_tidal_track,
)


def test_normalize_spotify_track_full():
    raw = {
        "id": "sp1",
        "name": "Ditto",
        "artists": [{"name": "NewJeans"}],
        "album": {"name": "OMG", "images": [{"url": "https://c/omg.jpg"}]},
        "duration_ms": 185000,
        "external_ids": {"isrc": "KRA401900001"},
    }
    t = normalize_spotify_track(raw)
    assert t == {
        "platform": "spotify",
        "platform_track_id": "sp1",
        "title": "Ditto",
        "artist": "NewJeans",
        "album_title": "OMG",
        "album_cover": "https://c/omg.jpg",
        "duration_ms": 185000,
        "isrc": "KRA401900001",
    }


def test_normalize_spotify_track_missing_fields_returns_none_on_no_id():
    assert normalize_spotify_track({"name": "x"}) is None
    # 아티스트/앨범/isrc 없어도 id+name 있으면 통과
    t = normalize_spotify_track({"id": "sp2", "name": "x"})
    assert t["artist"] == "" and t["album_title"] is None and t["isrc"] is None


def test_normalize_spotify_album():
    raw = {
        "id": "al1", "name": "OMG",
        "artists": [{"name": "NewJeans"}],
        "images": [{"url": "https://c/omg.jpg"}],
        "total_tracks": 2,
    }
    assert normalize_spotify_album(raw) == {
        "type": "album", "platform": "spotify", "platform_id": "al1",
        "title": "OMG", "subtitle": "NewJeans",
        "cover_url": "https://c/omg.jpg", "track_count": 2,
    }


def test_normalize_spotify_playlist_nullguard():
    assert normalize_spotify_playlist(None) is None
    raw = {
        "id": "pl1", "name": "K-pop Hits",
        "owner": {"display_name": "Spotify"},
        "images": [{"url": "https://c/pl.jpg"}],
        "tracks": {"total": 50},
    }
    assert normalize_spotify_playlist(raw) == {
        "type": "playlist", "platform": "spotify", "platform_id": "pl1",
        "title": "K-pop Hits", "subtitle": "Spotify",
        "cover_url": "https://c/pl.jpg", "track_count": 50,
    }


def test_normalize_tidal_track():
    raw = {
        "id": 123, "title": "Hype Boy",
        "artists": [{"name": "NewJeans"}],
        "album": {"title": "New Jeans", "cover": "abc-cover-uuid"},
        "duration": 179, "isrc": "KRA401900002",
    }
    t = normalize_tidal_track(raw)
    assert t["platform"] == "tidal"
    assert t["platform_track_id"] == "123"
    assert t["title"] == "Hype Boy"
    assert t["artist"] == "NewJeans"
    assert t["duration_ms"] == 179000
    assert t["isrc"] == "KRA401900002"
```

- [ ] **Step 2: 실패 확인** — `pytest tests/search/test_normalize.py -v`
Expected: FAIL — `ModuleNotFoundError: mrms.search.normalize`.

- [ ] **Step 3: 구현** — `src/mrms/search/normalize.py`:
```python
"""플랫폼 검색 raw 응답 → 우리 포맷. 순수 함수 (HTTP/DB 의존 없음).

emp/spotify.py(embed 스크래퍼)는 shape가 달라 미사용 — Web-API /v1/search 및
api.tidal.com/v1/search 응답 shape를 직접 다룬다. 트랙 파싱은
playback_resolve._spotify_candidate / _resolve_tidal 패턴과 동형."""
from __future__ import annotations


def _first_image(images) -> str | None:
    if isinstance(images, list) and images and isinstance(images[0], dict):
        return images[0].get("url")
    return None


def normalize_spotify_track(item) -> dict | None:
    if not isinstance(item, dict) or item.get("id") is None:
        return None
    artists = [a.get("name") for a in item.get("artists") or [] if isinstance(a, dict)]
    album = item.get("album") or {}
    return {
        "platform": "spotify",
        "platform_track_id": str(item["id"]),
        "title": item.get("name"),
        "artist": ", ".join(n for n in artists if n) or "",
        "album_title": album.get("name"),
        "album_cover": _first_image(album.get("images")),
        "duration_ms": item.get("duration_ms"),
        "isrc": (item.get("external_ids") or {}).get("isrc"),
    }


def normalize_spotify_album(item) -> dict | None:
    if not isinstance(item, dict) or item.get("id") is None:
        return None
    artists = [a.get("name") for a in item.get("artists") or [] if isinstance(a, dict)]
    return {
        "type": "album",
        "platform": "spotify",
        "platform_id": str(item["id"]),
        "title": item.get("name"),
        "subtitle": ", ".join(n for n in artists if n) or "",
        "cover_url": _first_image(item.get("images")),
        "track_count": item.get("total_tracks"),
    }


def normalize_spotify_playlist(item) -> dict | None:
    if not isinstance(item, dict) or item.get("id") is None:
        return None
    return {
        "type": "playlist",
        "platform": "spotify",
        "platform_id": str(item["id"]),
        "title": item.get("name"),
        "subtitle": (item.get("owner") or {}).get("display_name") or "",
        "cover_url": _first_image(item.get("images")),
        "track_count": (item.get("tracks") or {}).get("total"),
    }


def _tidal_cover_url(album: dict) -> str | None:
    # Tidal cover는 uuid → 이미지 URL 변환(1280 사이즈). 없으면 None.
    cover = album.get("cover") if isinstance(album, dict) else None
    if not cover:
        return None
    path = str(cover).replace("-", "/")
    return f"https://resources.tidal.com/images/{path}/1280x1280.jpg"


def normalize_tidal_track(item) -> dict | None:
    if not isinstance(item, dict) or item.get("id") is None:
        return None
    artists = [a.get("name") for a in item.get("artists") or [] if isinstance(a, dict)]
    album = item.get("album") or {}
    dur = item.get("duration")
    return {
        "platform": "tidal",
        "platform_track_id": str(item["id"]),
        "title": item.get("title"),
        "artist": ", ".join(n for n in artists if n) or "",
        "album_title": album.get("title"),
        "album_cover": _tidal_cover_url(album),
        "duration_ms": int(dur) * 1000 if dur else None,
        "isrc": item.get("isrc"),
    }


def normalize_tidal_album(item) -> dict | None:
    if not isinstance(item, dict) or item.get("id") is None:
        return None
    artists = [a.get("name") for a in item.get("artists") or [] if isinstance(a, dict)]
    return {
        "type": "album",
        "platform": "tidal",
        "platform_id": str(item["id"]),
        "title": item.get("title"),
        "subtitle": ", ".join(n for n in artists if n) or "",
        "cover_url": _tidal_cover_url(item),
        "track_count": item.get("numberOfTracks"),
    }


def normalize_tidal_playlist(item) -> dict | None:
    if not isinstance(item, dict):
        return None
    pid = item.get("uuid") or item.get("id")
    if pid is None:
        return None
    return {
        "type": "playlist",
        "platform": "tidal",
        "platform_id": str(pid),
        "title": item.get("title"),
        "subtitle": (item.get("creator") or {}).get("name") or "",
        "cover_url": _tidal_cover_url(item) if item.get("squareImage") is None else None,
        "track_count": item.get("numberOfTracks"),
    }
```

- [ ] **Step 4: 통과 확인** — `pytest tests/search/test_normalize.py -v` → Expected: PASS (5 tests).

- [ ] **Step 5: Commit**
```bash
git add src/mrms/search/__init__.py src/mrms/search/normalize.py tests/search/test_normalize.py
git commit -m "feat(search): normalize platform search responses to our format"
```

---

### Task 3: ISRC 병합 (`merge_tracks`, TDD)

**Files:**
- Modify: `src/mrms/search/normalize.py`
- Test: `tests/search/test_normalize.py`

- [ ] **Step 1: 실패 테스트 추가** — `tests/search/test_normalize.py` 끝에:
```python
from mrms.search.normalize import merge_tracks


def test_merge_same_isrc_combines_platforms():
    sp = {"platform": "spotify", "platform_track_id": "sp1", "title": "Ditto",
          "artist": "NewJeans", "album_title": "OMG", "album_cover": "c1",
          "duration_ms": 185000, "isrc": "KRA401900001"}
    td = {"platform": "tidal", "platform_track_id": "999", "title": "Ditto",
          "artist": "NewJeans", "album_title": "OMG", "album_cover": "c2",
          "duration_ms": 185000, "isrc": "KRA401900001"}
    merged = merge_tracks([sp, td])
    assert len(merged) == 1
    m = merged[0]
    assert m["isrc"] == "KRA401900001"
    assert m["spotify_track_id"] == "sp1"
    assert m["tidal_track_id"] == "999"
    assert m["title"] == "Ditto"


def test_merge_no_isrc_kept_separate():
    a = {"platform": "spotify", "platform_track_id": "sp1", "title": "x",
         "artist": "y", "album_title": None, "album_cover": None,
         "duration_ms": None, "isrc": None}
    b = {"platform": "tidal", "platform_track_id": "td1", "title": "x",
         "artist": "y", "album_title": None, "album_cover": None,
         "duration_ms": None, "isrc": None}
    merged = merge_tracks([a, b])
    assert len(merged) == 2
    assert merged[0]["spotify_track_id"] == "sp1" and merged[0]["tidal_track_id"] is None
    assert merged[1]["tidal_track_id"] == "td1" and merged[1]["spotify_track_id"] is None
```

- [ ] **Step 2: 실패 확인** — `pytest tests/search/test_normalize.py -k merge -v` → FAIL (`merge_tracks` 없음).

- [ ] **Step 3: 구현** — `src/mrms/search/normalize.py` 끝에 추가:
```python
def _usable_isrc(isrc) -> bool:
    return bool(isrc) and len(str(isrc)) == 12 and str(isrc).isalnum()


def _to_flat(t: dict) -> dict:
    """단일 플랫폼 트랙 → flat 응답 트랙(track_id는 persist 후 채움)."""
    return {
        "track_id": None,
        "title": t["title"],
        "artist": t["artist"],
        "album_title": t.get("album_title"),
        "album_cover": t.get("album_cover"),
        "duration_ms": t.get("duration_ms"),
        "isrc": t.get("isrc"),
        "tidal_track_id": t["platform_track_id"] if t["platform"] == "tidal" else None,
        "spotify_track_id": t["platform_track_id"] if t["platform"] == "spotify" else None,
    }


def merge_tracks(tracks: list[dict]) -> list[dict]:
    """플랫폼별 normalize 트랙 리스트 → flat 응답 트랙. 같은 ISRC면 1행(두 플랫폼 ID).
    ISRC 없으면 개별. 입력 순서 보존."""
    by_isrc: dict[str, dict] = {}
    out: list[dict] = []
    for t in tracks:
        isrc = t.get("isrc")
        if _usable_isrc(isrc):
            key = str(isrc).upper()
            if key in by_isrc:
                flat = by_isrc[key]
                if t["platform"] == "tidal":
                    flat["tidal_track_id"] = t["platform_track_id"]
                else:
                    flat["spotify_track_id"] = t["platform_track_id"]
                # 빈 필드 보강
                flat["album_cover"] = flat["album_cover"] or t.get("album_cover")
                flat["album_title"] = flat["album_title"] or t.get("album_title")
                continue
            flat = _to_flat(t)
            by_isrc[key] = flat
            out.append(flat)
        else:
            out.append(_to_flat(t))
    return out
```

- [ ] **Step 4: 통과 확인** — `pytest tests/search/test_normalize.py -v` → PASS (7 tests).

- [ ] **Step 5: Commit**
```bash
git add src/mrms/search/normalize.py tests/search/test_normalize.py
git commit -m "feat(search): ISRC merge across platforms (flat track shape)"
```

---

### Task 4: 플랫폼 검색 어댑터 (`spotify.py` / `tidal.py`, respx TDD)

**Files:**
- Create: `src/mrms/search/spotify.py`, `src/mrms/search/tidal.py`
- Test: `tests/search/test_adapters.py`

- [ ] **Step 1: 실패 테스트** — `tests/search/test_adapters.py`:
```python
from __future__ import annotations

import httpx
import pytest
import respx
from httpx import Response

from mrms.search.spotify import search_spotify
from mrms.search.tidal import search_tidal


@pytest.mark.asyncio
@respx.mock
async def test_search_spotify_groups():
    respx.get("https://api.spotify.com/v1/search").mock(return_value=Response(200, json={
        "tracks": {"items": [{"id": "sp1", "name": "Ditto",
                              "artists": [{"name": "NewJeans"}],
                              "album": {"name": "OMG", "images": [{"url": "c"}]},
                              "duration_ms": 185000,
                              "external_ids": {"isrc": "KRA401900001"}}]},
        "albums": {"items": [{"id": "al1", "name": "OMG",
                              "artists": [{"name": "NewJeans"}],
                              "images": [{"url": "c"}], "total_tracks": 2}]},
        "playlists": {"items": [None, {"id": "pl1", "name": "Hits",
                                       "owner": {"display_name": "Spotify"},
                                       "images": [{"url": "c"}],
                                       "tracks": {"total": 9}}]},
    }))
    async with httpx.AsyncClient() as http:
        r = await search_spotify(http, "TOKEN", "ditto", ["track", "album", "playlist"])
    assert len(r["tracks"]) == 1 and r["tracks"][0]["platform_track_id"] == "sp1"
    assert len(r["albums"]) == 1 and r["albums"][0]["platform_id"] == "al1"
    assert len(r["playlists"]) == 1  # None 항목 제거


@pytest.mark.asyncio
@respx.mock
async def test_search_tidal_albums_degrade_on_404():
    respx.get("https://api.tidal.com/v1/search/tracks").mock(return_value=Response(200, json={
        "items": [{"id": 1, "title": "Hype Boy", "artists": [{"name": "NewJeans"}],
                   "album": {"title": "NJ", "cover": "x"}, "duration": 179,
                   "isrc": "KRA401900002"}]}))
    respx.get("https://api.tidal.com/v1/search/albums").mock(return_value=Response(404))
    respx.get("https://api.tidal.com/v1/search/playlists").mock(return_value=Response(404))
    async with httpx.AsyncClient() as http:
        r = await search_tidal(http, "TOKEN", "newjeans", ["track", "album", "playlist"], "KR")
    assert len(r["tracks"]) == 1 and r["tracks"][0]["platform_track_id"] == "1"
    assert r["albums"] == [] and r["playlists"] == []  # degrade
```
(이 프로젝트는 `pytest-asyncio` strict 모드 — 각 async 테스트에 `@pytest.mark.asyncio` 필요. anyio conftest 불필요.)

- [ ] **Step 2: 실패 확인** — `.venv/bin/pytest tests/search/test_adapters.py -v` → FAIL (모듈 없음).

- [ ] **Step 3: 구현 spotify.py** — `src/mrms/search/spotify.py`:
```python
"""Spotify /v1/search 멀티타입 어댑터. 토큰은 호출자가 주입(auth_spotify.get_token)."""
from __future__ import annotations

import httpx

from mrms.search.normalize import (
    normalize_spotify_album,
    normalize_spotify_playlist,
    normalize_spotify_track,
)

SPOTIFY_SEARCH_URL = "https://api.spotify.com/v1/search"
LIMIT = 20


async def search_spotify(
    http: httpx.AsyncClient, token: str, q: str, types: list[str]
) -> dict:
    r = await http.get(
        SPOTIFY_SEARCH_URL,
        params={"q": q, "type": ",".join(types), "limit": LIMIT},
        headers={"Authorization": f"Bearer {token}"},
    )
    body = r.json() if r.status_code == 200 else {}
    tracks = [n for n in (normalize_spotify_track(i)
              for i in (body.get("tracks") or {}).get("items") or []) if n]
    albums = [n for n in (normalize_spotify_album(i)
              for i in (body.get("albums") or {}).get("items") or []) if n]
    playlists = [n for n in (normalize_spotify_playlist(i)
                 for i in (body.get("playlists") or {}).get("items") or []) if n]
    return {"tracks": tracks, "albums": albums, "playlists": playlists}
```

- [ ] **Step 4: 구현 tidal.py** — `src/mrms/search/tidal.py`:
```python
"""Tidal per-type 검색 어댑터(api.tidal.com/v1, 유저 Bearer). 앨범/플레이리스트는
degrade-capable — 엔드포인트가 404/에러면 빈 리스트(spike: tidal-search-spike.md)."""
from __future__ import annotations

import httpx

from mrms.search.normalize import (
    normalize_tidal_album,
    normalize_tidal_playlist,
    normalize_tidal_track,
)

TIDAL_SEARCH_BASE = "https://api.tidal.com/v1/search"
LIMIT = 20


async def _get_items(http, path, token, q, country):
    try:
        r = await http.get(
            f"{TIDAL_SEARCH_BASE}/{path}",
            params={"query": q, "limit": LIMIT, "countryCode": country},
            headers={"Authorization": f"Bearer {token}"},
        )
        if r.status_code != 200:
            return []
        return r.json().get("items") or []
    except httpx.HTTPError:
        return []


async def search_tidal(
    http: httpx.AsyncClient, token: str, q: str, types: list[str], country: str
) -> dict:
    out = {"tracks": [], "albums": [], "playlists": []}
    if "track" in types:
        items = await _get_items(http, "tracks", token, q, country)
        out["tracks"] = [n for n in (normalize_tidal_track(i) for i in items) if n]
    if "album" in types:
        items = await _get_items(http, "albums", token, q, country)
        out["albums"] = [n for n in (normalize_tidal_album(i) for i in items) if n]
    if "playlist" in types:
        items = await _get_items(http, "playlists", token, q, country)
        out["playlists"] = [n for n in (normalize_tidal_playlist(i) for i in items) if n]
    return out
```

- [ ] **Step 5: 통과 확인** — `pytest tests/search/test_adapters.py -v` → PASS (2 tests).

- [ ] **Step 6: Commit**
```bash
git add src/mrms/search/spotify.py src/mrms/search/tidal.py tests/search/test_adapters.py tests/search/conftest.py
git commit -m "feat(search): Tidal+Spotify search adapters (Tidal containers degrade-capable)"
```

---

### Task 5: `search/persist.py` — 트랙 EMP 적재 (TDD, DB)

**Files:**
- Create: `src/mrms/search/persist.py`
- Test: `tests/search/test_persist.py`

- [ ] **Step 1: 실패 테스트** — `tests/search/test_persist.py`:
```python
from __future__ import annotations

from mrms.search.persist import persist_search_tracks


def test_persist_assigns_track_id_and_inEmp(db_conn, cleanup):
    flat = [{
        "track_id": None, "title": "Persist Song", "artist": "PT Artist",
        "album_title": "PT Album", "album_cover": None, "duration_ms": 123000,
        "isrc": "PTSEARCH0001",
        "tidal_track_id": "td_p1", "spotify_track_id": "sp_p1",
    }]
    cleanup('DELETE FROM "Track" WHERE isrc = %s', ("PTSEARCH0001",))
    persist_search_tracks(db_conn, flat, q="persist song")
    assert flat[0]["track_id"] is not None
    with db_conn.cursor() as cur:
        cur.execute('SELECT "inEmp" FROM "Track" WHERE id = %s', (flat[0]["track_id"],))
        assert cur.fetchone()[0] is True
        cur.execute(
            'SELECT COUNT(*) FROM "TrackPlatform" WHERE "trackId" = %s', (flat[0]["track_id"],))
        assert cur.fetchone()[0] == 2  # tidal + spotify
        cur.execute(
            '''SELECT COUNT(*) FROM "EMPSource"
               WHERE "trackId" = %s AND source_type = 'search' ''', (flat[0]["track_id"],))
        assert cur.fetchone()[0] >= 1
    cleanup('DELETE FROM "EMPSource" WHERE "trackId" = %s', (flat[0]["track_id"],))
    cleanup('DELETE FROM "TrackPlatform" WHERE "trackId" = %s', (flat[0]["track_id"],))
    cleanup('DELETE FROM "Track" WHERE id = %s', (flat[0]["track_id"],))
```

- [ ] **Step 2: 실패 확인** — `pytest tests/search/test_persist.py -v` → FAIL (모듈 없음).

- [ ] **Step 3: 구현** — `src/mrms/search/persist.py`:
```python
"""검색 결과 flat 트랙을 EMP에 적재(best-effort). 적재 후 track_id를 flat에 채운다.

같은 ISRC의 두 플랫폼 ID는 base.upsert_track_and_emp_source가 한 Track으로 병합
(ISRC dedup) + TrackPlatform 2행. source_type='search'."""
from __future__ import annotations

import logging

import psycopg

from mrms.emp.base import upsert_track_and_emp_source

log = logging.getLogger(__name__)


def persist_search_tracks(
    conn: psycopg.Connection, flat_tracks: list[dict], q: str
) -> None:
    source_id = f"search:{q}"
    for t in flat_tracks:
        track_id = None
        for platform, key in (("tidal", "tidal_track_id"), ("spotify", "spotify_track_id")):
            ptid = t.get(key)
            if not ptid:
                continue
            try:
                r = upsert_track_and_emp_source(
                    conn,
                    isrc=t.get("isrc"),
                    title=t["title"] or "",
                    artist=t["artist"] or "",
                    album_title=t.get("album_title"),
                    duration_ms=t.get("duration_ms"),
                    platform=platform,
                    platform_track_id=str(ptid),
                    source_type="search",
                    source_id=source_id,
                    source_name=q,
                    cover_url=t.get("album_cover"),
                )
                track_id = r["track_id"]
            except Exception as e:  # best-effort — 표시를 막지 않음
                conn.rollback()
                log.warning("persist search track failed (%s/%s): %s", platform, ptid, e)
        t["track_id"] = track_id
```

- [ ] **Step 4: 통과 확인** — `pytest tests/search/test_persist.py -v` → PASS.

- [ ] **Step 5: Commit**
```bash
git add src/mrms/search/persist.py tests/search/test_persist.py
git commit -m "feat(search): persist search result tracks to EMP (source_type=search)"
```

---

### Task 6: `GET /api/search` 라우트 (통합, respx TDD)

**Files:**
- Create: `src/mrms/api/search.py`
- Modify: `src/mrms/api/main.py`
- Test: `tests/api/test_search.py`

- [ ] **Step 1: 실패 테스트** — `tests/api/test_search.py`:
```python
from __future__ import annotations

import respx
from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient
from httpx import Response

from mrms.api.main import app
from mrms.db.user_track import upsert_oauth

client = TestClient(app)


def _spotify_body():
    return {
        "tracks": {"items": [{"id": "sp1", "name": "Ditto",
            "artists": [{"name": "NewJeans"}],
            "album": {"name": "OMG", "images": [{"url": "c"}]},
            "duration_ms": 185000, "external_ids": {"isrc": "KRSRCH00001"}}]},
        "albums": {"items": []}, "playlists": {"items": []},
    }


@respx.mock
def test_search_returns_groups_and_persists(login, db_conn, cleanup):
    user_id, session_id = login()
    client.cookies.set("mrms_session", session_id)
    expires = datetime.now(timezone.utc) + timedelta(hours=1)
    upsert_oauth(db_conn, user_id, "spotify", access_token="SP", refresh_token="R",
                 expires_at=expires, scopes=[])
    db_conn.commit()
    cleanup('DELETE FROM "UserOAuth" WHERE "userId" = %s', (user_id,))
    cleanup('DELETE FROM "Track" WHERE isrc = %s', ("KRSRCH00001",))
    respx.get("https://api.spotify.com/v1/search").mock(return_value=Response(200, json=_spotify_body()))

    r = client.get("/api/search", params={"q": "ditto", "types": "track,album,playlist"})
    assert r.status_code == 200
    data = r.json()
    assert len(data["tracks"]) == 1
    t = data["tracks"][0]
    assert t["spotify_track_id"] == "sp1" and t["track_id"]  # persist 후 track_id
    assert "tidal" in data["skipped_platforms"]  # 미연동
    client.cookies.clear()
    cleanup('DELETE FROM "EMPSource" WHERE "trackId" = %s', (t["track_id"],))
    cleanup('DELETE FROM "TrackPlatform" WHERE "trackId" = %s', (t["track_id"],))
    cleanup('DELETE FROM "Track" WHERE id = %s', (t["track_id"],))
```

- [ ] **Step 2: 실패 확인** — `pytest tests/api/test_search.py -v` → FAIL (404 — 라우트 없음).

- [ ] **Step 3: 구현 라우트** — `src/mrms/api/search.py`:
```python
"""검색 → 표시 + EMP 적재. Tidal+Spotify 라이브, 미연동 플랫폼은 skip(부분 결과)."""
from __future__ import annotations

import httpx
import psycopg
from fastapi import APIRouter, Depends, HTTPException

from mrms.api.auth_spotify import get_token as _spotify_token
from mrms.api.auth_tidal import _get_access_token as _tidal_token
from mrms.api.deps import db_conn, get_current_user_id
from mrms.search.normalize import merge_tracks
from mrms.search.persist import persist_search_tracks
from mrms.search.spotify import search_spotify
from mrms.search.tidal import search_tidal

router = APIRouter(prefix="/api/search", tags=["search"])

MAX_Q = 120


async def _spotify_tok(user_id, conn):
    return (await _spotify_token(user_id=user_id, conn=conn))["access_token"]


async def _tidal_tok(user_id, conn):
    return await _tidal_token(user_id, conn)


@router.get("")
async def search(
    q: str,
    types: str = "track,album,playlist",
    user_id: str = Depends(get_current_user_id),
    conn: psycopg.Connection = Depends(db_conn),
):
    q = (q or "").strip()[:MAX_Q]
    if not q:
        raise HTTPException(400, "q required")
    type_list = [t for t in types.split(",") if t in ("track", "album", "playlist")]

    with conn.cursor() as cur:
        cur.execute('SELECT country FROM "User" WHERE id = %s', (user_id,))
        u = cur.fetchone()
    country = u[0] if u and u[0] else "US"

    skipped: list[str] = []
    agg = {"tracks": [], "albums": [], "playlists": []}
    async with httpx.AsyncClient(timeout=10.0) as http:
        # 미연동/refresh 실패는 HTTPException 또는 raw 예외 → skip
        for platform, get_tok, run in (
            ("spotify", _spotify_tok, lambda tok: search_spotify(http, tok, q, type_list)),
            ("tidal", _tidal_tok, lambda tok: search_tidal(http, tok, q, type_list, country)),
        ):
            try:
                tok = await get_tok(user_id, conn)
            except (HTTPException, Exception):
                skipped.append(platform)
                continue
            try:
                res = await run(tok)
            except Exception:
                skipped.append(platform)
                continue
            agg["tracks"].extend(res["tracks"])
            agg["albums"].extend(res["albums"])
            agg["playlists"].extend(res["playlists"])

    tracks = merge_tracks(agg["tracks"])
    persist_search_tracks(conn, tracks, q)
    return {
        "tracks": tracks,
        "albums": agg["albums"],
        "playlists": agg["playlists"],
        "skipped_platforms": skipped,
    }
```

- [ ] **Step 4: 라우터 등록** — `src/mrms/api/main.py`. import 블록(다른 router import 옆)에 추가하고, `app.include_router(pgt_router)` 다음 줄에 등록:
```python
from mrms.api.search import router as search_router
...
app.include_router(pgt_router)
app.include_router(search_router)
```
(정확한 import 위치는 기존 `from mrms.api.pgt import router as pgt_router` 패턴을 따른다.)

- [ ] **Step 5: 통과 확인** — `pytest tests/api/test_search.py -v` → PASS.

- [ ] **Step 6: Commit**
```bash
git add src/mrms/api/search.py src/mrms/api/main.py tests/api/test_search.py
git commit -m "feat(search): GET /api/search — live search + persist + skip unconnected"
```

---

### Task 7: `POST /api/search/expand` — 컨테이너 lazy 적재 (TDD)

**Files:**
- Create: `src/mrms/search/expand.py`
- Modify: `src/mrms/api/search.py`
- Test: `tests/api/test_search.py`

- [ ] **Step 1: 실패 테스트 추가** — `tests/api/test_search.py` 끝에:
```python
@respx.mock
def test_expand_spotify_album_persists_tracks(login, db_conn, cleanup):
    user_id, session_id = login()
    client.cookies.set("mrms_session", session_id)
    expires = datetime.now(timezone.utc) + timedelta(hours=1)
    upsert_oauth(db_conn, user_id, "spotify", access_token="SP", refresh_token="R",
                 expires_at=expires, scopes=[])
    db_conn.commit()
    cleanup('DELETE FROM "UserOAuth" WHERE "userId" = %s', (user_id,))
    cleanup('DELETE FROM "Track" WHERE isrc = %s', ("EXPAND00001",))
    respx.get("https://api.spotify.com/v1/albums/al1/tracks").mock(return_value=Response(200, json={
        "items": [{"id": "spx1", "name": "T1", "artists": [{"name": "A"}],
                   "duration_ms": 100000, "external_ids": {"isrc": "EXPAND00001"}}]}))

    r = client.post("/api/search/expand",
                    json={"platform": "spotify", "item_type": "album", "item_id": "al1"})
    assert r.status_code == 200
    assert r.json()["source_id"] == "album:al1"
    with db_conn.cursor() as cur:
        cur.execute(
            '''SELECT COUNT(*) FROM "EMPSource" WHERE source_id='album:al1' AND source_type='search' ''')
        assert cur.fetchone()[0] >= 1
    client.cookies.clear()
    cleanup('DELETE FROM "EMPSource" WHERE source_id = %s', ("album:al1",))
    cleanup('DELETE FROM "Track" WHERE isrc = %s', ("EXPAND00001",))
```

- [ ] **Step 2: 실패 확인** — `pytest tests/api/test_search.py -k expand -v` → FAIL.

- [ ] **Step 3: 구현 expand.py** — `src/mrms/search/expand.py`:
```python
"""컨테이너(앨범/플레이리스트) 구성 트랙 fetch + EMP 적재. source_id='{type}:{id}'.

Spotify: /v1/albums/{id}/tracks, /v1/playlists/{id}/tracks.
Tidal:   api.tidal.com/v1/albums/{id}/tracks, /v1/playlists/{uuid}/items (유저 Bearer)."""
from __future__ import annotations

import logging

import httpx
import psycopg

from mrms.emp.base import upsert_track_and_emp_source
from mrms.search.normalize import normalize_spotify_track, normalize_tidal_track

log = logging.getLogger(__name__)

SPOTIFY = "https://api.spotify.com/v1"
TIDAL = "https://api.tidal.com/v1"


async def _spotify_album_tracks(http, token, album_id):
    r = await http.get(f"{SPOTIFY}/albums/{album_id}/tracks",
                       params={"limit": 50}, headers={"Authorization": f"Bearer {token}"})
    items = (r.json().get("items") or []) if r.status_code == 200 else []
    return [n for n in (normalize_spotify_track(i) for i in items) if n]


async def _spotify_playlist_tracks(http, token, pid):
    r = await http.get(f"{SPOTIFY}/playlists/{pid}/tracks",
                       params={"limit": 100}, headers={"Authorization": f"Bearer {token}"})
    rows = (r.json().get("items") or []) if r.status_code == 200 else []
    return [n for n in (normalize_spotify_track((row or {}).get("track")) for row in rows) if n]


async def _tidal_album_tracks(http, token, album_id, country):
    r = await http.get(f"{TIDAL}/albums/{album_id}/tracks",
                       params={"countryCode": country, "limit": 100},
                       headers={"Authorization": f"Bearer {token}"})
    items = (r.json().get("items") or []) if r.status_code == 200 else []
    return [n for n in (normalize_tidal_track(i.get("item") or i) for i in items) if n]


async def _tidal_playlist_tracks(http, token, uuid, country):
    r = await http.get(f"{TIDAL}/playlists/{uuid}/items",
                       params={"countryCode": country, "limit": 100},
                       headers={"Authorization": f"Bearer {token}"})
    items = (r.json().get("items") or []) if r.status_code == 200 else []
    out = []
    for i in items:
        track = i.get("item") or i
        if track.get("type") and track["type"] != "track":
            continue
        n = normalize_tidal_track(track)
        if n:
            out.append(n)
    return out


async def fetch_container_tracks(http, platform, item_type, item_id, token, country):
    if platform == "spotify":
        return await (_spotify_album_tracks(http, token, item_id) if item_type == "album"
                      else _spotify_playlist_tracks(http, token, item_id))
    return await (_tidal_album_tracks(http, token, item_id, country) if item_type == "album"
                  else _tidal_playlist_tracks(http, token, item_id, country))


def persist_container_tracks(conn, tracks, item_type, item_id):
    source_id = f"{item_type}:{item_id}"
    for t in tracks:
        try:
            upsert_track_and_emp_source(
                conn, isrc=t.get("isrc"), title=t["title"] or "", artist=t["artist"] or "",
                album_title=t.get("album_title"), duration_ms=t.get("duration_ms"),
                platform=t["platform"], platform_track_id=t["platform_track_id"],
                source_type="search", source_id=source_id, source_name=None,
                cover_url=t.get("album_cover"))
        except Exception as e:
            conn.rollback()
            log.warning("expand persist failed (%s): %s", t.get("platform_track_id"), e)
    return source_id
```

- [ ] **Step 4: expand 엔드포인트** — `src/mrms/api/search.py`에 추가 (import + 핸들러):
```python
from pydantic import BaseModel
from mrms.search.expand import fetch_container_tracks, persist_container_tracks


class ExpandReq(BaseModel):
    platform: str
    item_type: str  # 'album' | 'playlist'
    item_id: str


@router.post("/expand")
async def expand(
    req: ExpandReq,
    user_id: str = Depends(get_current_user_id),
    conn: psycopg.Connection = Depends(db_conn),
):
    if req.item_type not in ("album", "playlist") or req.platform not in ("tidal", "spotify"):
        raise HTTPException(400, "bad platform/item_type")
    with conn.cursor() as cur:
        cur.execute('SELECT country FROM "User" WHERE id = %s', (user_id,))
        u = cur.fetchone()
    country = u[0] if u and u[0] else "US"
    try:
        tok = await (_spotify_tok if req.platform == "spotify" else _tidal_tok)(user_id, conn)
    except (HTTPException, Exception):
        raise HTTPException(401, f"{req.platform} auth unavailable")
    async with httpx.AsyncClient(timeout=15.0) as http:
        tracks = await fetch_container_tracks(
            http, req.platform, req.item_type, req.item_id, tok, country)
    source_id = persist_container_tracks(conn, tracks, req.item_type, req.item_id)
    return {"source_id": source_id, "count": len(tracks)}
```

- [ ] **Step 5: 통과 확인** — `pytest tests/api/test_search.py -v` → PASS (2 tests).

- [ ] **Step 6: Commit**
```bash
git add src/mrms/search/expand.py src/mrms/api/search.py tests/api/test_search.py
git commit -m "feat(search): POST /api/search/expand — lazy container track import"
```

---

## Phase 2 — 프론트 (Phase 1 응답 스키마 동결 후)

### Task 8: 검색 API 헬퍼 + 타입

**Files:**
- Modify: `web/src/lib/types.ts`
- Create: `web/src/lib/api/search.ts`

- [ ] **Step 1: 타입 추가** — `web/src/lib/types.ts` 끝에:
```typescript
export interface SearchTrack {
  track_id: string;
  title: string;
  artist: string;
  album_title: string | null;
  album_cover: string | null;
  duration_ms: number | null;
  isrc: string | null;
  tidal_track_id: string | null;
  spotify_track_id: string | null;
}
export interface SearchContainer {
  type: "album" | "playlist";
  platform: "tidal" | "spotify";
  platform_id: string;
  title: string | null;
  subtitle: string;
  cover_url: string | null;
  track_count: number | null;
}
export interface SearchResponse {
  tracks: SearchTrack[];
  albums: SearchContainer[];
  playlists: SearchContainer[];
  skipped_platforms: string[];
}
```

- [ ] **Step 2: API 헬퍼** — `web/src/lib/api/search.ts`:
```typescript
import type { SearchResponse } from "@/lib/types";

import { apiFetch } from "./http";

export async function search(q: string): Promise<SearchResponse> {
  const r = await apiFetch(
    `/api/search?q=${encodeURIComponent(q)}&types=track,album,playlist`,
    {},
    "search",
  );
  return (await r.json()) as SearchResponse;
}

export async function expandContainer(
  platform: string,
  itemType: "album" | "playlist",
  itemId: string,
): Promise<{ source_id: string; count: number }> {
  const r = await apiFetch(
    "/api/search/expand",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platform, item_type: itemType, item_id: itemId }),
    },
    "expand",
  );
  return (await r.json()) as { source_id: string; count: number };
}
```
(`apiFetch`의 실제 시그니처는 `web/src/lib/api/http.ts`를 확인해 호출 형태를 맞춘다 — POST body/headers 지원 여부.)

- [ ] **Step 3: 빌드 확인** — `cd web && pnpm build` → 타입 통과.

- [ ] **Step 4: Commit**
```bash
git add web/src/lib/types.ts web/src/lib/api/search.ts
git commit -m "feat(search): web search API client + types"
```

---

### Task 9: `/search` 페이지 + 결과 그룹 (재사용)

**Files:**
- Create: `web/src/app/(dashboard)/search/page.tsx`
- Create: `web/src/components/search/SearchResults.tsx`

- [ ] **Step 1: 결과 컴포넌트** — `web/src/components/search/SearchResults.tsx`:
  - props: `{ data: SearchResponse }`.
  - **Tracks** → `ModalTrackList`(from `@/components/track/ModalTrackList`)에 `SearchTrack[]`를 그대로 전달(필드가 `ModalTrack`과 호환 — `track_id/title/artist/album_title/album_cover/duration_ms/tidal_track_id/spotify_track_id`). `youtube_track_id`는 없으니 생략(옵셔널).
  - **Albums / Playlists** → 각 컨테이너를 `EmpItemCard`(from `@/components/emp/EmpItemCard`)로 렌더. `EmpItemCard`가 기대하는 `item`(`item_type/item_id/title/cover`)에 맞춰 `{item_type: c.type, item_id: c.platform_id, title: c.title, cover_url: c.cover_url}`로 매핑. `onClick` → `expandContainer(c.platform, c.type, c.platform_id)` 호출 후 성공하면 `ItemTracksModal`을 `{item_type: c.type, item_id: c.platform_id}`로 오픈(기존 `EmpBrowse.tsx`의 카드→모달 와이어링 패턴 그대로).
  - `skipped_platforms` 있으면 상단에 "Spotify만 검색됨(Tidal 미연동)" 류 안내.
  - **정확한 props 형태는 `web/src/components/emp/EmpBrowse.tsx`(EmpItemCard→ItemTracksModal 와이어링)와 `ItemTracksModal.tsx`를 읽어 그대로 맞춘다.**

- [ ] **Step 2: 페이지** — `web/src/app/(dashboard)/search/page.tsx`:
```tsx
"use client";

import { useState } from "react";

import { search } from "@/lib/api/search";
import type { SearchResponse } from "@/lib/types";
import { SearchResults } from "@/components/search/SearchResults";

export default function SearchPage() {
  const [q, setQ] = useState("");
  const [data, setData] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = q.trim();
    if (!query) return;
    setLoading(true);
    setError(null);
    try {
      setData(await search(query));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="px-6 md:px-14 py-8">
      <form onSubmit={onSubmit} className="mb-6">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="트랙 · 앨범 · 플레이리스트 검색"
          className="w-full max-w-xl border-b border-[var(--mrms-ink)] bg-transparent py-2 font-display text-[18px] outline-none placeholder:text-[var(--mrms-ink-mute)]"
        />
      </form>
      {loading && <div className="font-mono text-[11px] text-[var(--mrms-ink-mute)]">검색 중…</div>}
      {error && <div className="font-mono text-[11px] text-[var(--mrms-rust)]">{error}</div>}
      {data && <SearchResults data={data} />}
    </div>
  );
}
```
(에디토리얼 톤·클래스는 기존 페이지(`emp/page.tsx`)를 참고해 일관 유지.)

- [ ] **Step 3: 빌드 확인** — `cd web && pnpm build` → 통과. nav는 이미 `/search` 가리킴(`nav.ts`).

- [ ] **Step 4: Commit**
```bash
git add web/src/app/\(dashboard\)/search/page.tsx web/src/components/search/SearchResults.tsx
git commit -m "feat(search): /search page with grouped results (reuse ModalTrackList/EmpItemCard)"
```

---

### Task 10: 수동 verify

**Files:** 없음.

- [ ] **Step 1:** `make api` + `make web`(또는 `pnpm dev`), 로그인(Tidal+Spotify 연동).
- [ ] **Step 2:** `/search`에서 "newjeans" 검색 → Tracks/Albums/Playlists 그룹 표시. 트랙 재생/담기 동작.
- [ ] **Step 3:** 앨범/플레이리스트 카드 클릭 → 트랙 모달 표시(expand). DB에서 `SELECT COUNT(*) FROM "Track" WHERE "inEmp"=TRUE` 증가 확인.
- [ ] **Step 4:** 한 플랫폼만 연동 해제 → `skipped_platforms` 안내 + 부분 결과.
- [ ] **Step 5:** Tidal 앨범/플레이리스트가 비면 spike 결과(degrade) 확인 — Spotify 컨테이너만 표시되는지.

---

## Self-Review

**Spec coverage:**
- §1 플랫폼/인증/타입/적재A/lazy/페이지/제출트리거 → Task 4(어댑터)/6(인증skip)/5·7(적재)/9(페이지) ✅
- §4.1 normalize/merge/persist → Task 2/3/5 ✅
- §4.2 GET search(스키마 동결)/POST expand → Task 6/7 ✅
- §5 프론트 재사용(ModalTrackList/EmpItemCard/ItemTracksModal) → Task 9 ✅
- §7 Tidal spike + degrade → Task 1 + tidal.py degrade-capable(Task 4) ✅
- §8 테스트(normalize/병합/persist/통합/모킹) → Task 2/3/5/6/7 ✅
- §9 백엔드-퍼스트 2단계 → Phase 1(1-7)/Phase 2(8-10) ✅

**Placeholder scan:** 모든 step에 실코드/명령/기대값. Task 9 Step 1은 컴포넌트 와이어링을 기존 `EmpBrowse.tsx` 패턴 참조로 지시(props가 그쪽에 정의됨) — 구현자가 그 파일을 읽어 맞춤. apiFetch 호출 형태는 `lib/api/http.ts` 확인 지시.

**Type consistency:** `upsert_track_and_emp_source`(11필수+cover_url) Task 5/7 동일. 반환 `{track_id,new}` Task 5 사용. flat 트랙 shape(merge_tracks 출력 = SearchTrack = ModalTrack 호환) Task 3→6→8→9 일관. `source_type='search'`, source_id(`search:{q}` 트랙 / `{type}:{id}` 컨테이너) Task 5/7 일관. 어댑터 반환 `{tracks,albums,playlists}` Task 4→6 일관.

## 관련 문서
- [spec](2026-06-14-search-emp-expansion-design.md) · [ADR-005](../../decisions/ADR-005-search-emp-expansion.md)
