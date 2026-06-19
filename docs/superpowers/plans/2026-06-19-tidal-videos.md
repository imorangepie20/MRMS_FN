# Tidal Videos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tidal 에디토리얼 뮤직비디오를 인제스트해 별도 `/videos` 페이지에서 장르별로 둘러보고, 클릭 시 극장↔풀스크린 오버레이로 재생한다.

**Architecture:** 기존 EMP 인프라(EMPSection/EMPSectionItem, TidalEMPImporter, `(browse)` 공개 라우트) 재사용. 비디오 섹션은 `section_key='video:{uuid}'`로 저장하되 EMP browse에서 제외하고 새 `/api/videos/sections`로 노출. 재생은 Tidal `videos/{id}/playbackinfo`(회원 OAuth=FULL/게스트 x-tidal-token=PREVIEW)→HLS m3u8을 `<video>`+hls.js로.

**Tech Stack:** Python FastAPI + psycopg(백엔드), Next.js 16 + React(프론트), hls.js(HLS 재생), pytest+respx(백엔드 테스트), spec: `docs/superpowers/specs/2026-06-19-tidal-videos-design.md`.

**브랜치:** `feat/tidal-videos` (이미 체크아웃됨). **push/머지 금지** — 일푸 시 컨트롤러가 처리.

**러너:** 백엔드 `.venv/bin/pytest <대상파일만> -q` + `.venv/bin/ruff check <파일>` (전체 pytest 금지). 프론트 `cd web && npx tsc --noEmit` + `pnpm build`.

---

## File Structure

- `src/mrms/emp/tidal.py` (수정) — `_video_cover`, `_normalize_video`, `_fetch_video_playlists`, `_fetch_playlist_videos`, `_import_videos`; `import_all`에서 비디오 단계 호출.
- `src/mrms/db/emp_section.py` (수정) — `list_sections_with_items`에 `section_key_filter` 파라미터(EMP 제외 / 비디오 전용).
- `src/mrms/api/emp_browse.py` (수정) — EMP는 비디오 섹션 제외.
- `src/mrms/api/videos.py` (생성) — `GET /api/videos/sections`(공개).
- `src/mrms/api/auth_tidal.py` (수정) — `playback_router`에 `GET /api/playback/tidal/video/{id}`(공개, 회원=Bearer/게스트=x-tidal-token).
- `src/mrms/api/main.py` (수정) — `videos_router` 등록.
- `web/src/lib/types.ts` (수정) — `EmpItemType`에 `"video"` 추가(공유 타입), `VideoSection` 재사용(EmpSection 동형).
- `web/src/lib/api/videos.ts` (생성) — `fetchVideoSections`, `getVideoPlaybackUrl`.
- `web/src/lib/nav.ts` (수정) — Videos nav 항목.
- `web/src/app/(browse)/videos/page.tsx` (생성) — `<VideosBrowse/>`.
- `web/src/components/videos/VideosBrowse.tsx` (생성) — 장르 캐러셀.
- `web/src/components/videos/VideoCard.tsx` (생성) — 16:9 썸네일 카드.
- `web/src/components/videos/VideoPlayerOverlay.tsx` (생성) — `<video>`+hls.js, 극장↔풀스크린.
- `web/src/store/video-player.ts` (생성) — 현재 재생 video id 전역 상태(오버레이 open/close).
- `web/package.json` (수정) — `hls.js` 의존성.
- 테스트: `tests/emp/test_tidal_videos.py`, `tests/api/test_videos.py`, `tests/api/test_video_playback.py`.

---

## Task 0: HLS CORS 스파이크 (재생 엔드포인트 + 브라우저 직접재생 검증)

> 목적: Tidal CDN m3u8을 브라우저 hls.js가 **직접** 가져올 수 있는지(CORS) 먼저 판정. 가능하면 백엔드는 URL만 반환, 막히면 Task 3에서 HLS 프록시로 전환. 이 결과가 Task 3/5의 형태를 정한다.

**Files:**
- Modify: `src/mrms/api/auth_tidal.py` (playback_router에 video 엔드포인트)
- Modify: `src/mrms/api/main.py` (이미 tidal_playback_router 등록됨 — 변경 불필요, 확인만)

- [x] **Step 1: `auth_tidal.py` import 보강**

상단 import 영역에 추가(기존 import 블록 끝):

```python
from mrms.api.deps import get_current_user_id_optional  # 기존 get_current_user_id 옆
from mrms.db.settings import get_setting
```

(`httpx`, `base64`, `json`, `HTTPException`, `Depends`, `db_conn`, `get_current_user_id`, `_get_access_token`는 이미 있음.)

- [x] **Step 2: video 재생 엔드포인트 추가**

`auth_tidal.py`의 `stream_track` 아래(파일 끝)에 추가:

```python
@playback_router.get("/video/{video_id}")
async def video_playback(
    video_id: str,
    user_id: str | None = Depends(get_current_user_id_optional),
    conn: psycopg.Connection = Depends(db_conn),
):
    """Tidal 비디오 → HLS m3u8 URL. 회원 OAuth면 FULL 시도, 아니면 x-tidal-token PREVIEW.
    응답: {"url": <m3u8>, "preview": <bool>}. (오디오 stream_track과 동일한 manifest 디코드.)"""
    # 인증 헤더 선택: 연결 회원 Bearer 우선, 실패/게스트는 x-tidal-token.
    headers: dict[str, str] = {}
    if user_id:
        try:
            headers = {"Authorization": f"Bearer {await _get_access_token(user_id, conn)}"}
        except HTTPException:
            headers = {}
    if not headers:
        tok = get_setting(conn, "tidal_x_token") or ""
        if not tok:
            raise HTTPException(503, "tidal_x_token not configured")
        headers = {"x-tidal-token": tok}

    async with httpx.AsyncClient(timeout=10.0) as http:
        info_r = await http.get(
            f"https://api.tidal.com/v1/videos/{video_id}/playbackinfo",
            params={
                "videoquality": "HIGH",
                "playbackmode": "STREAM",
                "assetpresentation": "FULL",
            },
            headers=headers,
        )
        if info_r.status_code != 200:
            raise HTTPException(info_r.status_code, f"video playbackinfo failed: {info_r.text[:200]}")
        info = info_r.json()

    manifest_b64 = info.get("manifest")
    if not manifest_b64:
        raise HTTPException(500, f"no manifest in video playbackinfo: {list(info.keys())}")
    try:
        manifest_json = json.loads(base64.b64decode(manifest_b64).decode("utf-8"))
    except Exception as e:
        raise HTTPException(500, f"manifest decode failed: {e}")

    urls = manifest_json.get("urls") or ([manifest_json["url"]] if manifest_json.get("url") else [])
    if not urls:
        raise HTTPException(500, f"no video URL in manifest: {list(manifest_json.keys())}")

    return {"url": urls[0], "preview": info.get("assetPresentation") != "FULL"}
```

- [x] **Step 3: 백엔드 import/구문 확인**

Run: `.venv/bin/python -c "import mrms.api.auth_tidal"` 및 `.venv/bin/ruff check src/mrms/api/auth_tidal.py`
Expected: import OK, ruff 신규 에러 0.

- [x] **Step 4: 수동 CORS 스파이크 (커밋 전 1회)**

로컬에서 엔드포인트가 m3u8을 반환하는지 + 브라우저 직접재생 가능한지 판정. 백엔드 없이 직접 호출로 m3u8 URL을 얻고, 그 URL에 대해 `curl -sI -H "Origin: http://localhost:3000" <m3u8>`로 `access-control-allow-origin` 헤더 유무 확인.

```bash
# m3u8 추출(게스트 x-tidal-token 경로)
.venv/bin/python - <<'PY'
import httpx, base64, json
VID="348988463"; TOK="txNoH4kkV41MfH25"
r=httpx.get(f"https://api.tidal.com/v1/videos/{VID}/playbackinfo",
  params={"videoquality":"HIGH","playbackmode":"STREAM","assetpresentation":"FULL"},
  headers={"x-tidal-token":TOK}, timeout=15)
m=json.loads(base64.b64decode(r.json()["manifest"]))
print(m["urls"][0])
PY
# 위 출력 URL에 대해:
# curl -sI -H "Origin: http://localhost:3000" '<m3u8_url>' | grep -i access-control-allow-origin
```

판정 기록(이후 Task 3/5 분기):
- `access-control-allow-origin: *`(또는 허용) 있으면 → **직접 재생 가능**: 백엔드는 URL만 반환(현 Step 2 그대로), 프론트 hls.js가 직접 로드.
- 없으면 → **프록시 필요**: Task 3에서 `GET /api/playback/tidal/video/{id}/manifest.m3u8` 프록시(아래 Task 3 "프록시 대안")로 전환하고, 프론트는 그 프록시 URL을 hls.js src로 사용.

판정 결과를 이 파일 Task 3 상단에 한 줄로 적는다(예: `> CORS 판정: 직접재생 OK` 또는 `> CORS 판정: 프록시 필요`).

- [x] **Step 5: Commit**

```bash
git add src/mrms/api/auth_tidal.py docs/superpowers/plans/2026-06-19-tidal-videos.md
git commit -m "feat(videos): Tidal 비디오 playbackinfo→m3u8 엔드포인트 + CORS 스파이크"
```

---

## Task 1: 백엔드 인제스트 (TidalEMPImporter 비디오)

**Files:**
- Modify: `src/mrms/emp/tidal.py`
- Test: `tests/emp/test_tidal_videos.py` (생성)

- [ ] **Step 1: 실패 테스트 작성 — `_normalize_video` + `_video_cover`**

`tests/emp/test_tidal_videos.py`:

```python
"""TidalEMPImporter 비디오 인제스트."""
from mrms.emp.tidal import TidalEMPImporter, _normalize_video, _video_cover


def test_video_cover_url():
    assert _video_cover("c6420d6e-4176-4893-a062-5a25a16fef02") == (
        "https://resources.tidal.com/images/c6420d6e/4176/4893/a062/5a25a16fef02/640x360.jpg"
    )
    assert _video_cover(None) is None


def test_normalize_video():
    item = {
        "id": 529748781,
        "title": "hate that i made you love me",
        "imageId": "c6420d6e-4176-4893-a062-5a25a16fef02",
        "duration": 300,
        "artist": {"id": 4332277, "name": "Ariana Grande"},
        "artists": [{"id": 4332277, "name": "Ariana Grande"}],
    }
    v = _normalize_video(item)
    assert v == {
        "video_id": "529748781",
        "title": "hate that i made you love me",
        "artist": "Ariana Grande",
        "cover_url": "https://resources.tidal.com/images/c6420d6e/4176/4893/a062/5a25a16fef02/640x360.jpg",
    }


def test_normalize_video_missing_fields_returns_none():
    assert _normalize_video({"title": "no id"}) is None
    assert _normalize_video({"id": 1}) is None
    assert _normalize_video("not a dict") is None
```

- [ ] **Step 2: 실패 확인**

Run: `.venv/bin/pytest tests/emp/test_tidal_videos.py -q`
Expected: FAIL (`ImportError: cannot import name '_normalize_video'`).

- [ ] **Step 3: `_video_cover` + `_normalize_video` 구현**

`src/mrms/emp/tidal.py`의 `_extract_cover` 함수 바로 아래에 추가:

```python
def _video_cover(image_id: str | None) -> str | None:
    """Tidal 비디오 imageId(UUID) → 16:9 썸네일 CDN URL."""
    if not isinstance(image_id, str) or "-" not in image_id:
        return None
    return f"https://resources.tidal.com/images/{image_id.replace('-', '/')}/640x360.jpg"


def _normalize_video(item) -> dict | None:
    """비디오 item dict → {video_id, title, artist, cover_url}. 부적합하면 None."""
    if not isinstance(item, dict):
        return None
    vid = item.get("id")
    title = item.get("title")
    if not vid or not title:
        return None
    artists = item.get("artists") or []
    artist = (
        (item.get("artist") or {}).get("name")
        or (artists[0].get("name") if artists else None)
        or "Unknown"
    )
    return {
        "video_id": str(vid),
        "title": title,
        "artist": artist,
        "cover_url": _video_cover(item.get("imageId")),
    }
```

- [ ] **Step 4: 통과 확인**

Run: `.venv/bin/pytest tests/emp/test_tidal_videos.py -q`
Expected: PASS (3 passed).

- [ ] **Step 5: 실패 테스트 — `_fetch_video_playlists` + `_fetch_playlist_videos` (respx)**

`tests/emp/test_tidal_videos.py`에 추가:

```python
import respx
import httpx as _httpx
import pytest
from mrms.emp.tidal import TIDAL_BASE


@pytest.mark.asyncio
@respx.mock
async def test_fetch_video_playlists():
    page = {"rows": [{"modules": [{
        "type": "PLAYLIST_LIST",
        "showMore": None,
        "pagedList": {"items": [
            {"uuid": "pl-1", "title": "New Pop Videos", "squareImage": "ab12cd34-0000-1111-2222-333344445555"},
            {"uuid": "pl-2", "title": "New K-Pop Videos", "image": "ff00aa11-0000-1111-2222-333344445555"},
        ]},
    }]}]}
    respx.get(f"{TIDAL_BASE}/v1/pages/videos").mock(return_value=_httpx.Response(200, json=page))
    imp = TidalEMPImporter(token="tok")
    async with _httpx.AsyncClient() as http:
        pls = await imp._fetch_video_playlists(http)
    assert [(p["uuid"], p["title"]) for p in pls] == [("pl-1", "New Pop Videos"), ("pl-2", "New K-Pop Videos")]


@pytest.mark.asyncio
@respx.mock
async def test_fetch_playlist_videos():
    items = {"items": [
        {"item": {"id": 1, "title": "MV A", "imageId": "aa11bb22-0000-1111-2222-333344445555",
                  "artist": {"name": "Artist A"}}, "type": "video"},
        {"item": {"id": 2, "title": "MV B", "imageId": "cc33dd44-0000-1111-2222-333344445555",
                  "artist": {"name": "Artist B"}}, "type": "video"},
    ]}
    respx.get(f"{TIDAL_BASE}/v1/playlists/pl-1/items").mock(return_value=_httpx.Response(200, json=items))
    imp = TidalEMPImporter(token="tok")
    async with _httpx.AsyncClient() as http:
        vids = await imp._fetch_playlist_videos(http, "pl-1")
    assert [v["video_id"] for v in vids] == ["1", "2"]
    assert vids[0]["artist"] == "Artist A"
```

> 주의: `TidalEMPImporter.__init__`는 `conn`/`token` 인자를 받는다(현 코드 `self.token = token or get_setting(conn, ...)`). 테스트는 `token="tok"`만 넘겨 conn 없이 생성한다. 생성자가 conn 필수면(현 시그니처 확인) `TidalEMPImporter(conn=None, token="tok")`로 호출. **구현 전 `__init__` 시그니처 확인**.

- [ ] **Step 6: 실패 확인**

Run: `.venv/bin/pytest tests/emp/test_tidal_videos.py -q`
Expected: FAIL (no `_fetch_video_playlists`).

- [ ] **Step 7: `_fetch_video_playlists` + `_fetch_playlist_videos` 구현**

`tidal.py`의 `TidalEMPImporter` 클래스 안, `_fetch_playlist_tracks` 메서드 근처에 추가:

```python
    async def _fetch_video_playlists(
        self, http: httpx.AsyncClient
    ) -> list[dict]:
        """/v1/pages/videos → 비디오 플레이리스트 목록 [{uuid, title, cover_url}, ...].
        showMore(view-all)가 있으면 따라가 전체를 가져온다."""
        try:
            r = await http.get(
                f"{TIDAL_BASE}/v1/pages/videos",
                headers=self._headers(),
                params={**self._common_params()},
            )
            if r.status_code != 200:
                return []
            data = r.json()
        except Exception:
            return []

        module = _first_playlist_list_module(data)
        if module is None:
            return []
        items = (module.get("pagedList") or {}).get("items") or []
        # view-all로 전체 확장(있으면)
        api_path = ((module.get("showMore") or {}).get("apiPath")) or None
        if api_path:
            try:
                r2 = await http.get(
                    f"{TIDAL_BASE}/v1/{api_path}",
                    headers=self._headers(),
                    params={**self._common_params()},
                )
                if r2.status_code == 200:
                    m2 = _first_playlist_list_module(r2.json())
                    if m2:
                        items = (m2.get("pagedList") or {}).get("items") or items
            except Exception:
                pass

        out: list[dict] = []
        for it in items:
            uuid = it.get("uuid")
            title = it.get("title")
            if not uuid or not title:
                continue
            out.append({
                "uuid": uuid,
                "title": title.strip(),
                "cover_url": _extract_cover(it),
            })
        return out

    async def _fetch_playlist_videos(
        self, http: httpx.AsyncClient, playlist_uuid: str
    ) -> list[dict]:
        """/v1/playlists/{uuid}/items → 비디오들 [{video_id, title, artist, cover_url}, ...]."""
        try:
            r = await http.get(
                f"{TIDAL_BASE}/v1/playlists/{playlist_uuid}/items",
                headers=self._headers(),
                params={**self._common_params(), "limit": 50, "offset": 0},
            )
            if r.status_code != 200:
                return []
            data = r.json()
        except Exception:
            return []
        out: list[dict] = []
        for entry in data.get("items") or []:
            if entry.get("type") != "video":
                continue
            v = _normalize_video(entry.get("item"))
            if v:
                out.append(v)
        return out
```

그리고 모듈 레벨 헬퍼(파일 상단 `_video_cover` 아래)에 추가:

```python
def _first_playlist_list_module(page: dict) -> dict | None:
    """pages 응답에서 첫 PLAYLIST_LIST 모듈을 찾는다."""
    if not isinstance(page, dict):
        return None
    for row in page.get("rows") or []:
        for mod in row.get("modules") or []:
            if isinstance(mod, dict) and mod.get("type") == "PLAYLIST_LIST":
                return mod
    return None
```

- [ ] **Step 8: 통과 확인**

Run: `.venv/bin/pytest tests/emp/test_tidal_videos.py -q`
Expected: PASS (5 passed).

- [ ] **Step 9: 실패 테스트 — `_import_videos` (섹션/아이템 저장, DB)**

`tests/emp/test_tidal_videos.py`에 추가(실제 DB fixture `db_conn` 사용 — 기존 `tests/emp/test_tidal.py` 패턴):

```python
@pytest.mark.asyncio
@respx.mock
async def test_import_videos_persists_sections(db_conn):
    from mrms.db.emp_section import list_sections_with_items
    page = {"rows": [{"modules": [{"type": "PLAYLIST_LIST", "showMore": None,
        "pagedList": {"items": [{"uuid": "pl-1", "title": "New Pop Videos", "squareImage": "ab12cd34-0000-1111-2222-333344445555"}]}}]}]}
    items = {"items": [{"item": {"id": 1, "title": "MV A", "imageId": "aa11bb22-0000-1111-2222-333344445555",
        "artist": {"name": "Artist A"}}, "type": "video"}]}
    respx.get(f"{TIDAL_BASE}/v1/pages/videos").mock(return_value=_httpx.Response(200, json=page))
    respx.get(f"{TIDAL_BASE}/v1/playlists/pl-1/items").mock(return_value=_httpx.Response(200, json=items))

    imp = TidalEMPImporter(conn=db_conn, token="tok")
    async with _httpx.AsyncClient() as http:
        n = await imp._import_videos(db_conn, http, base_order=0)
    assert n >= 1
    secs = list_sections_with_items(db_conn)
    vsec = [s for s in secs if s["section_key"] == "video:pl-1"]
    assert vsec and vsec[0]["display_title"] == "New Pop Videos"
    assert vsec[0]["items"][0]["item_type"] == "video"
    assert vsec[0]["items"][0]["item_id"] == "1"
```

- [ ] **Step 10: 실패 확인 → `_import_videos` 구현**

Run: `.venv/bin/pytest tests/emp/test_tidal_videos.py::test_import_videos_persists_sections -q` → FAIL.

`tidal.py` `TidalEMPImporter`에 추가(상단에 `from mrms.db.emp_section import upsert_section, upsert_section_item, prune_stale_items` import가 import_all에서 쓰이는지 확인 — 없으면 추가):

```python
    async def _import_videos(
        self, conn: psycopg.Connection, http: httpx.AsyncClient, base_order: int
    ) -> int:
        """비디오 플레이리스트 → EMPSection(video:{uuid}) + item_type='video' 아이템. 저장 개수 반환."""
        playlists = await self._fetch_video_playlists(http)
        total = 0
        for idx, pl in enumerate(playlists):
            try:
                videos = await self._fetch_playlist_videos(http, pl["uuid"])
                if not videos:
                    continue
                section_id = upsert_section(
                    conn=conn,
                    platform="tidal",
                    section_key=f"video:{pl['uuid']}",
                    display_title=pl["title"],
                    display_order=base_order + idx,
                )
                seen: set[tuple[str, str]] = set()
                for v_idx, v in enumerate(videos):
                    upsert_section_item(
                        conn=conn,
                        section_id=section_id,
                        item_type="video",
                        item_id=v["video_id"],
                        title=v["title"],
                        cover_url=v["cover_url"],
                        display_order=v_idx,
                    )
                    seen.add(("video", v["video_id"]))
                prune_stale_items(conn, section_id, seen)
                total += len(videos)
            except Exception:
                safe_rollback(conn)
                continue
        return total
```

> `safe_rollback`은 이미 `base.py`에서 import됨(import_all에서 사용 중). 없으면 `from mrms.emp.base import safe_rollback` 확인.

- [ ] **Step 11: 통과 확인**

Run: `.venv/bin/pytest tests/emp/test_tidal_videos.py -q`
Expected: PASS (6 passed).

- [ ] **Step 12: `import_all`에서 비디오 단계 호출**

`tidal.py` `import_all`의 `async with httpx.AsyncClient(...) as http:` 블록 안, home 소스 루프와 Phase 2 트랙 upsert가 끝난 뒤(같은 http 클라이언트 내, return 직전)에 추가:

```python
            # === 비디오 인제스트 (항상 1회) ===
            try:
                video_count = await self._import_videos(conn, http, base_order=len(sources) + 10)
            except Exception as e:
                video_count = 0
                errors.append(f"videos: {fmt_exc(e, 120)}")
```

그리고 반환 summary dict에 `"videos": video_count` 키 추가(기존 `tracks_new` 등과 함께).

- [ ] **Step 13: 회귀 — 기존 tidal 테스트 + ruff**

Run: `.venv/bin/pytest tests/emp/test_tidal.py tests/emp/test_tidal_videos.py -q` → 전부 PASS.
Run: `.venv/bin/ruff check src/mrms/emp/tidal.py tests/emp/test_tidal_videos.py` → 신규 에러 0.

- [ ] **Step 14: Commit**

```bash
git add src/mrms/emp/tidal.py tests/emp/test_tidal_videos.py
git commit -m "feat(videos): Tidal 비디오 플레이리스트 인제스트(EMPSection video:{uuid})"
```

---

## Task 2: 저장/브라우즈 분리 + `/api/videos/sections`

**Files:**
- Modify: `src/mrms/db/emp_section.py`
- Modify: `src/mrms/api/emp_browse.py`
- Create: `src/mrms/api/videos.py`
- Modify: `src/mrms/api/main.py`
- Test: `tests/api/test_videos.py` (생성)

- [ ] **Step 1: 실패 테스트 — EMP 제외 / 비디오 전용 필터**

`tests/api/test_videos.py`:

```python
"""/api/videos/sections + EMP 비디오 제외."""
from mrms.db.emp_section import upsert_section, upsert_section_item, list_sections_with_items


def _seed(conn):
    a = upsert_section(conn, "tidal", "playlist:aaa", "Audio Sec", 0)
    upsert_section_item(conn, a, "playlist", "aaa", "Aud", None, 0)
    v = upsert_section(conn, "tidal", "video:bbb", "Video Sec", 1)
    upsert_section_item(conn, v, "video", "111", "MV", None, 0)


def test_emp_excludes_video_sections(db_conn):
    _seed(db_conn)
    secs = list_sections_with_items(db_conn, exclude_video=True)
    keys = {s["section_key"] for s in secs}
    assert "playlist:aaa" in keys
    assert "video:bbb" not in keys


def test_only_video_sections(db_conn):
    _seed(db_conn)
    secs = list_sections_with_items(db_conn, only_video=True)
    keys = {s["section_key"] for s in secs}
    assert keys == {"video:bbb"}
```

- [ ] **Step 2: 실패 확인**

Run: `.venv/bin/pytest tests/api/test_videos.py -q`
Expected: FAIL (`unexpected keyword argument 'exclude_video'`).

- [ ] **Step 3: `list_sections_with_items` 필터 추가**

`src/mrms/db/emp_section.py` `list_sections_with_items` 시그니처/WHERE 수정:

```python
def list_sections_with_items(
    conn: psycopg.Connection,
    platform: str | None = None,
    exclude_video: bool = False,
    only_video: bool = False,
) -> list[dict]:
    """모든 section + items (display_order 순).
    exclude_video: section_key 'video:%' 제외(EMP 페이지). only_video: 'video:%'만(/videos)."""
    clauses: list[str] = []
    params_list: list = []
    if platform:
        clauses.append("platform = %s")
        params_list.append(platform)
    if exclude_video:
        clauses.append("\"sectionKey\" NOT LIKE 'video:%'")
    if only_video:
        clauses.append("\"sectionKey\" LIKE 'video:%'")
    where = ("WHERE " + " AND ".join(clauses)) if clauses else ""
    params: tuple = tuple(params_list)

    with conn.cursor() as cur:
        cur.execute(
            f'''SELECT id, platform, "sectionKey", "displayTitle", "displayOrder", "lastSyncedAt"
                FROM "EMPSection"
                {where}
                ORDER BY "displayOrder", "sectionKey"''',
            params,
        )
        # ... (이하 기존 본문 동일 — sections 빌드/items 조인 그대로)
```

(기존 함수 본문의 sections 빌드 + items 조인 로직은 그대로 두고 WHERE/params 구성만 위로 교체.)

- [ ] **Step 4: 통과 확인**

Run: `.venv/bin/pytest tests/api/test_videos.py -q`
Expected: PASS (2 passed).

- [ ] **Step 5: EMP browse에서 비디오 제외**

`src/mrms/api/emp_browse.py` `get_sections`:

```python
    sections = list_sections_with_items(conn, platform=platform, exclude_video=True)
```

- [ ] **Step 6: `videos.py` 라우터 생성**

`src/mrms/api/videos.py`:

```python
"""Videos browse API — 비디오 섹션 목록(공개)."""
from __future__ import annotations

from fastapi import APIRouter, Depends

import psycopg

from mrms.api.deps import db_conn
from mrms.db.emp_section import list_sections_with_items


router = APIRouter(prefix="/api/videos", tags=["videos"])


@router.get("/sections")
def get_video_sections(conn: psycopg.Connection = Depends(db_conn)):
    # 공개 — 비회원 둘러보기(EMP와 동일). 비디오 섹션(video:%)만.
    sections = list_sections_with_items(conn, only_video=True)
    return {"sections": sections}
```

- [ ] **Step 7: `main.py` 라우터 등록**

`src/mrms/api/main.py` import 영역(emp_browse import 근처)에 추가 + 등록(다른 `app.include_router` 줄들 근처):

```python
from mrms.api.videos import router as videos_router
# ...
app.include_router(videos_router)
```

- [ ] **Step 8: 실패 테스트 — 엔드포인트 응답(TestClient)**

`tests/api/test_videos.py`에 추가:

```python
from fastapi.testclient import TestClient
from mrms.api.main import app


def test_videos_sections_endpoint(db_conn):
    _seed(db_conn)
    client = TestClient(app)
    r = client.get("/api/videos/sections")
    assert r.status_code == 200
    keys = {s["section_key"] for s in r.json()["sections"]}
    assert keys == {"video:bbb"}
```

> TestClient가 같은 db_conn을 쓰도록 기존 conftest의 `db_conn` override 패턴 확인(기존 `tests/api/test_auth_tidal.py` 등 참고). override 패턴이 다르면 그에 맞춤.

- [ ] **Step 9: 통과 확인 + ruff**

Run: `.venv/bin/pytest tests/api/test_videos.py -q` → PASS.
Run: `.venv/bin/ruff check src/mrms/api/videos.py src/mrms/api/emp_browse.py src/mrms/db/emp_section.py` → 신규 0.

- [ ] **Step 10: 회귀 — EMP 테스트**

Run: `.venv/bin/pytest tests/api/test_videos.py -q` (+ EMP browse 관련 테스트가 있으면 함께) → PASS.

- [ ] **Step 11: Commit**

```bash
git add src/mrms/db/emp_section.py src/mrms/api/emp_browse.py src/mrms/api/videos.py src/mrms/api/main.py tests/api/test_videos.py
git commit -m "feat(videos): /api/videos/sections + EMP에서 비디오 섹션 분리"
```

---

## Task 3: 비디오 재생 엔드포인트 테스트 (+ CORS 판정 시 프록시)

> CORS 판정: 직접재생 OK — Tidal CDN(`im-cf.manifest.tidal.com`, envoy/cloudfront)의 master/variant m3u8 모두 `access-control-allow-origin: *` (실측 2026-06-19, guest x-tidal-token). 백엔드는 URL만 반환(Step 2 그대로), 프론트 hls.js가 직접 로드. Task 3 Step 3(HLS 프록시) 스킵.

**Files:**
- Modify: `src/mrms/api/auth_tidal.py` (Task 0에서 추가한 엔드포인트의 테스트, 필요시 프록시)
- Test: `tests/api/test_video_playback.py` (생성)

- [ ] **Step 1: 실패 테스트 — playbackinfo → m3u8 (respx, 게스트 x-tidal-token 경로)**

`tests/api/test_video_playback.py`:

```python
"""GET /api/playback/tidal/video/{id}."""
import base64, json
import respx
import httpx
from fastapi.testclient import TestClient

from mrms.api.main import app
from mrms.db.settings import set_setting


def _manifest_b64():
    inner = {"mimeType": "application/vnd.apple.mpegurl", "urls": ["https://cdn.tidal.com/v.m3u8"]}
    return base64.b64encode(json.dumps(inner).encode()).decode()


@respx.mock
def test_video_playback_guest_preview(db_conn):
    set_setting(db_conn, "tidal_x_token", "txTEST")
    respx.get("https://api.tidal.com/v1/videos/123/playbackinfo").mock(
        return_value=httpx.Response(200, json={
            "assetPresentation": "PREVIEW", "manifest": _manifest_b64()}))
    client = TestClient(app)  # 세션 없음 = 게스트
    r = client.get("/api/playback/tidal/video/123")
    assert r.status_code == 200
    body = r.json()
    assert body["url"] == "https://cdn.tidal.com/v.m3u8"
    assert body["preview"] is True
```

- [ ] **Step 2: 실패/통과 확인**

Run: `.venv/bin/pytest tests/api/test_video_playback.py -q`
Expected: Task 0 구현이 이미 있으므로 **PASS** 가능(엔드포인트 존재). FAIL이면 (settings override/db_conn 주입) conftest 패턴에 맞춰 테스트 보정 후 PASS.

- [ ] **Step 3: (CORS 판정이 "프록시 필요"일 때만) HLS 프록시 추가**

Task 0이 "프록시 필요"였다면 `auth_tidal.py`에 추가(직접재생 OK였으면 이 Step 스킵):

```python
@playback_router.get("/video/{video_id}/manifest.m3u8")
async def video_manifest_proxy(
    video_id: str,
    user_id: str | None = Depends(get_current_user_id_optional),
    conn: psycopg.Connection = Depends(db_conn),
):
    """m3u8 + 세그먼트를 백엔드가 중계(CORS 회피). 마스터 m3u8을 받아 그대로 반환하고,
    상대 세그먼트 URL이 절대 URL이면 브라우저가 직접 받을 수 있어야 함 — 세그먼트도 CORS
    막히면 세그먼트 프록시까지 필요(이 경우 Step 확장)."""
    info = await _resolve_video_m3u8(video_id, user_id, conn)  # 위 video_playback 로직 추출
    m3u8_url = info["url"]
    async with httpx.AsyncClient(timeout=15.0) as http:
        r = await http.get(m3u8_url)
        if r.status_code != 200:
            raise HTTPException(r.status_code, "m3u8 fetch failed")
        return Response(content=r.text, media_type="application/vnd.apple.mpegurl")
```

> 이 경우 `video_playback`의 m3u8 해석부를 `_resolve_video_m3u8(video_id, user_id, conn)` 헬퍼로 추출해 두 엔드포인트가 공유. 세그먼트도 CORS 막히면 세그먼트 프록시(쿼리로 URL 받아 중계)까지 확장 — 단 **마스터 m3u8 직접재생이 되면 여기까지 불필요**(대부분 Tidal CDN은 `*` ACAO).

- [ ] **Step 4: ruff + 통과**

Run: `.venv/bin/pytest tests/api/test_video_playback.py -q` → PASS.
Run: `.venv/bin/ruff check src/mrms/api/auth_tidal.py tests/api/test_video_playback.py` → 신규 0.

- [ ] **Step 5: Commit**

```bash
git add src/mrms/api/auth_tidal.py tests/api/test_video_playback.py docs/superpowers/plans/2026-06-19-tidal-videos.md
git commit -m "test(videos): video playback 엔드포인트 + (필요시) HLS 프록시"
```

---

## Task 4: 프론트 데이터 + `/videos` 페이지 + 캐러셀

**Files:**
- Modify: `web/src/lib/types.ts`
- Create: `web/src/lib/api/videos.ts`
- Modify: `web/src/lib/nav.ts`
- Create: `web/src/app/(browse)/videos/page.tsx`
- Create: `web/src/components/videos/VideosBrowse.tsx`
- Create: `web/src/components/videos/VideoCard.tsx`
- Create: `web/src/store/video-player.ts`

- [ ] **Step 1: 타입 — `EmpItemType`에 `"video"` 추가**

`web/src/lib/types.ts`의 `EmpItemType` 유니온에 `| "video"` 추가:

```typescript
export type EmpItemType =
  | "playlist" | "album" | "mix" | "artist"
  | "channel" | "chart" | "station" | "video";
```

(`EmpSection`/`EmpSectionItem`는 그대로 재사용.)

- [ ] **Step 2: 비디오 플레이어 전역 store**

`web/src/store/video-player.ts`:

```typescript
import { create } from "zustand";

interface VideoPlayerState {
  videoId: string | null;
  title: string | null;
  open: (videoId: string, title: string) => void;
  close: () => void;
}

export const useVideoPlayer = create<VideoPlayerState>((set) => ({
  videoId: null,
  title: null,
  open: (videoId, title) => set({ videoId, title }),
  close: () => set({ videoId: null, title: null }),
}));
```

- [ ] **Step 3: 비디오 API 클라이언트**

`web/src/lib/api/videos.ts`:

```typescript
import type { EmpSection } from "@/lib/types";

import { apiFetch } from "./http";

export async function fetchVideoSections(): Promise<EmpSection[]> {
  const r = await apiFetch(`/api/videos/sections`, {}, "video sections");
  return (await r.json()).sections as EmpSection[];
}

export interface VideoPlayback {
  url: string;
  preview: boolean;
}

export async function getVideoPlaybackUrl(videoId: string): Promise<VideoPlayback> {
  const r = await apiFetch(
    `/api/playback/tidal/video/${encodeURIComponent(videoId)}`,
    {},
    "video playback",
  );
  return (await r.json()) as VideoPlayback;
}
```

- [ ] **Step 4: `VideoCard` 컴포넌트(16:9 썸네일)**

`web/src/components/videos/VideoCard.tsx`:

```tsx
"use client";

import { Play } from "lucide-react";

import { duotoneStyle, coverInitial } from "@/lib/cover-art";
import { useVideoPlayer } from "@/store/video-player";

export function VideoCard({
  videoId,
  title,
  coverUrl,
  widthPx,
}: {
  videoId: string;
  title: string;
  coverUrl: string | null;
  widthPx: number;
}) {
  const open = useVideoPlayer((s) => s.open);
  return (
    <button
      onClick={() => open(videoId, title)}
      style={{ width: `${widthPx}px`, containerType: "inline-size" }}
      className="group shrink-0 snap-start text-left bg-transparent border-0 p-0 cursor-pointer"
    >
      <div className="relative w-full aspect-video overflow-hidden bg-(--mrms-rule)">
        {coverUrl ? (
          <img
            src={coverUrl}
            alt=""
            loading="lazy"
            className="absolute inset-0 size-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center" style={duotoneStyle(title)}>
            <span className="font-serif font-bold text-(--mrms-paper)" style={{ fontSize: "30cqw", textShadow: "0 2px 10px rgba(31,26,22,.32)" }}>
              {coverInitial(title)}
            </span>
          </div>
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-(--mrms-ink)/35 opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="size-10 rounded-full bg-(--mrms-paper) flex items-center justify-center">
            <Play className="size-4 text-(--mrms-ink) fill-current" />
          </span>
        </span>
      </div>
      <div className="mt-1.5 font-display font-medium text-[12px] leading-snug text-(--mrms-ink) truncate group-hover:text-(--mrms-rust) transition-colors">
        {title}
      </div>
    </button>
  );
}
```

- [ ] **Step 5: `VideosBrowse` (장르 캐러셀)**

`web/src/components/videos/VideosBrowse.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";

import { fetchVideoSections } from "@/lib/api/videos";
import type { EmpSection } from "@/lib/types";
import { SectionMasthead } from "@/components/visual/SectionMasthead";

import { VideoCard } from "./VideoCard";

export function VideosBrowse() {
  const [sections, setSections] = useState<EmpSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let on = true;
    fetchVideoSections()
      .then((s) => on && setSections(s))
      .catch((e) => on && setError((e as Error).message))
      .finally(() => on && setLoading(false));
    return () => { on = false; };
  }, []);

  return (
    <div className="px-5 pt-6 pb-48 md:px-10 md:pt-10">
      <SectionMasthead
        className="mb-6"
        kicker="§ 04 · Tidal Videos"
        title="Music Videos"
        meta="전체화면으로 보면서 듣는 뮤직비디오"
        imageKey="Music Videos"
      />
      {loading && (
        <div className="py-12 text-center font-mono text-[11px] tracking-editorial uppercase text-(--mrms-ink-mute)">— loading —</div>
      )}
      {error && (
        <div className="mb-4 p-3 border border-(--mrms-rust) text-(--mrms-rust) font-mono text-[11px]">{error}</div>
      )}
      {!loading && sections.length === 0 && !error && (
        <div className="py-12 text-center font-mono text-[11px] tracking-editorial uppercase text-(--mrms-ink-mute)">— no videos yet —</div>
      )}
      {sections.map((sec) => (
        <div key={sec.id} className="mb-10">
          <div className="mb-3 flex items-end justify-between gap-4 border-b border-(--mrms-ink) pb-1">
            <h2 className="font-display font-bold text-(--mrms-ink) leading-[1.05] tracking-[-0.015em] text-[20px] md:text-[26px]">
              {sec.display_title}
            </h2>
            <span className="font-mono text-[10px] tracking-editorial uppercase text-(--mrms-ink-mute) tabular-nums shrink-0 pb-1">
              {sec.items.length} videos
            </span>
          </div>
          <div className="flex gap-3 overflow-x-auto snap-x pb-2">
            {sec.items.map((it) => (
              <VideoCard
                key={it.id}
                videoId={it.item_id}
                title={it.title ?? ""}
                coverUrl={it.cover_url}
                widthPx={260}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
```

> VideoPlayerOverlay는 Task 5에서 추가해 이 페이지(또는 (browse) 레이아웃)에 마운트. Task 4 단계에선 카드 클릭이 store만 갱신(오버레이 없음 — tsc/build만 통과).

- [ ] **Step 6: `/videos` 라우트**

`web/src/app/(browse)/videos/page.tsx`:

```tsx
import { VideosBrowse } from "@/components/videos/VideosBrowse";

export default function VideosPage() {
  return <VideosBrowse />;
}
```

- [ ] **Step 7: 사이드바 nav**

`web/src/lib/nav.ts`의 "Sections" 그룹 `items` 배열에서 EMP 다음에 추가:

```typescript
      { title: "Videos", href: "/videos", num: "§ 04", full: "Tidal Music Videos", badge: "MV" },
```

- [ ] **Step 8: tsc + build**

Run: `cd web && npx tsc --noEmit` → 에러 0(단, VideoPlayerOverlay 미마운트라 store만 갱신 — OK).
Run: `pnpm build` → `/videos` 라우트 컴파일 성공.

- [ ] **Step 9: Commit**

```bash
git add web/src/lib/types.ts web/src/lib/api/videos.ts web/src/lib/nav.ts web/src/store/video-player.ts web/src/app/\(browse\)/videos web/src/components/videos
git commit -m "feat(videos): /videos 페이지 + 장르 캐러셀 + 데이터/nav"
```

---

## Task 5: 풀스크린/극장 비디오 플레이어 (hls.js)

**Files:**
- Modify: `web/package.json` (hls.js)
- Create: `web/src/components/videos/VideoPlayerOverlay.tsx`
- Modify: `web/src/components/layout/DashboardShell.tsx` (오버레이 전역 마운트)

- [ ] **Step 1: hls.js 설치**

Run: `cd web && pnpm add hls.js`
Expected: `package.json` dependencies에 `hls.js` 추가(타입 내장).

- [ ] **Step 2: `VideoPlayerOverlay` 구현**

`web/src/components/videos/VideoPlayerOverlay.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { X, Maximize2 } from "lucide-react";

import { getVideoPlaybackUrl } from "@/lib/api/videos";
import { useVideoPlayer } from "@/store/video-player";
import { pausePlayback } from "@/lib/player";

export function VideoPlayerOverlay() {
  const videoId = useVideoPlayer((s) => s.videoId);
  const title = useVideoPlayer((s) => s.title);
  const close = useVideoPlayer((s) => s.close);
  const videoRef = useRef<HTMLVideoElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 열릴 때: 오디오 큐 일시정지 + Esc 닫기
  useEffect(() => {
    if (!videoId) return;
    void pausePlayback().catch(() => {});
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [videoId, close]);

  // m3u8 로드 + hls.js attach
  useEffect(() => {
    if (!videoId) return;
    const el = videoRef.current;
    if (!el) return;
    let hls: { destroy: () => void } | null = null;
    let cancelled = false;
    setError(null);

    (async () => {
      try {
        const { url, preview: pv } = await getVideoPlaybackUrl(videoId);
        if (cancelled) return;
        setPreview(pv);
        if (el.canPlayType("application/vnd.apple.mpegurl")) {
          el.src = url; // Safari/iOS 네이티브 HLS
        } else {
          const Hls = (await import("hls.js")).default;
          if (cancelled) return;
          if (Hls.isSupported()) {
            const inst = new Hls();
            inst.loadSource(url);
            inst.attachMedia(el);
            hls = inst;
          } else {
            el.src = url; // 최후 폴백
          }
        }
        await el.play().catch(() => {});
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();

    return () => {
      cancelled = true;
      if (hls) hls.destroy();
      el.removeAttribute("src");
      el.load();
    };
  }, [videoId]);

  if (!videoId) return null;

  const toggleFullscreen = () => {
    const box = boxRef.current;
    if (!box) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void box.requestFullscreen?.();
  };

  return (
    <div
      onClick={close}
      className="fixed inset-0 z-[70] bg-black/80 flex items-center justify-center p-4"
    >
      <div
        ref={boxRef}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[960px] aspect-video bg-black"
      >
        <video ref={videoRef} controls autoPlay playsInline className="size-full bg-black" />
        {/* 상단 우측 컨트롤 */}
        <div className="absolute top-2 right-2 flex gap-2">
          <button onClick={toggleFullscreen} aria-label="fullscreen"
            className="size-8 flex items-center justify-center bg-(--mrms-ink)/70 text-(--mrms-paper) border-0 cursor-pointer hover:bg-(--mrms-ink)">
            <Maximize2 className="size-4" />
          </button>
          <button onClick={close} aria-label="close"
            className="size-8 flex items-center justify-center bg-(--mrms-ink)/70 text-(--mrms-paper) border-0 cursor-pointer hover:bg-(--mrms-ink)">
            <X className="size-4" />
          </button>
        </div>
        {title && (
          <div className="absolute top-2 left-3 right-24 font-display text-[13px] text-(--mrms-paper) truncate drop-shadow">{title}</div>
        )}
        {preview && (
          <div className="absolute bottom-2 left-0 right-0 flex justify-center">
            <a href="/login" className="font-mono text-[10px] tracking-editorial uppercase bg-(--mrms-rust) text-(--mrms-paper) px-3 py-1.5 no-underline">
              가입하면 풀영상 →
            </a>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center text-(--mrms-paper) font-mono text-[12px] text-center px-6">
            재생할 수 없는 영상입니다.
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 전역 마운트**

`web/src/components/layout/DashboardShell.tsx` — `<PlayerBar />` 아래에 추가:

```tsx
        <PlayerBar />
        <VideoPlayerOverlay />
```

그리고 상단 import:

```tsx
import { VideoPlayerOverlay } from "@/components/videos/VideoPlayerOverlay";
```

(DashboardShell은 `(browse)` 레이아웃도 쓰므로 `/videos`에서 자동 마운트.)

- [ ] **Step 4: tsc + build**

Run: `cd web && npx tsc --noEmit` → 에러 0(미사용 import 정리).
Run: `pnpm build` → 성공, `/videos` ○/ƒ.

- [ ] **Step 5: 인라인 목업 확인(선택)**

극장 오버레이 레이아웃을 HTML 목업으로 렌더해 비율/컨트롤 위치 확인(실제 HLS 재생은 배포 후 실측). 컨트롤러가 Playwright 스크린샷으로 1회 점검.

- [ ] **Step 6: Commit**

```bash
git add web/package.json web/pnpm-lock.yaml web/src/components/videos/VideoPlayerOverlay.tsx web/src/components/layout/DashboardShell.tsx
git commit -m "feat(videos): 극장↔풀스크린 비디오 플레이어(hls.js)"
```

---

## 최종 점검 (모든 태스크 후)

- [ ] `.venv/bin/pytest tests/emp/test_tidal_videos.py tests/api/test_videos.py tests/api/test_video_playback.py tests/emp/test_tidal.py -q` → 전부 PASS.
- [ ] `cd web && npx tsc --noEmit && pnpm build` → 성공.
- [ ] `.venv/bin/ruff check src/mrms/emp/tidal.py src/mrms/api/videos.py src/mrms/api/auth_tidal.py src/mrms/db/emp_section.py` → 신규 0.
- [ ] 스펙 대비 커버리지: 인제스트(T1)·분리/노출(T2)·재생(T0,T3)·프론트 페이지/카드(T4)·극장+풀스크린 플레이어(T5)·게스트 프리뷰 CTA(T5) 모두 구현됨.
- [ ] **배포는 일푸 시 컨트롤러가** main FF-merge+push. 배포 후: ① admin EMP import 1회 트리거(비디오 섹션 채움) ② `/videos` 실측(HLS 재생·극장/풀스크린·게스트 프리뷰). ③ `ADMIN`이 `tidal_x_token` Setting 존재 확인.

---

## 리스크 / 주의 (구현자용)

- **CORS(Task 0)**: 가장 큰 불확실성. Step 4 판정에 따라 Task 3 형태 결정. 직접재생이면 가장 단순.
- **`TidalEMPImporter.__init__` 시그니처**: `(conn, token=None)` 형태 확인 후 테스트 생성자 호출 맞춤.
- **conftest db_conn/세션 override**: 기존 `tests/api/*`의 TestClient + db override 패턴을 그대로 따를 것(테스트 DB 격리).
- **artist 미저장(YAGNI)**: v1 비디오 카드는 제목+썸네일만. 아티스트 표시는 v1.1(EMPSectionItem 컬럼/패킹).
- **자동재생 정책**: 오버레이는 클릭(제스처)로 열려 autoplay OK. `el.play()` 실패는 무시(사용자가 컨트롤로 시작).
- **EMP 회귀**: 비디오 섹션이 EMP에 새어나가지 않는지(exclude_video) 양쪽 테스트로 고정.
