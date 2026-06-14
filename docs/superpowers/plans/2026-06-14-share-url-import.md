# 공유 URL 가져오기 (Eat The Shared) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tidal/Spotify 공유 링크(track·playlist·album)를 붙여넣으면 트랙을 가져와 EMP에 적재하고 `/import` 페이지에서 바로 듣는 기능.

**Architecture:** 기존 Search→EMP(ADR-005) 인프라 재사용. 신규 = URL 파서 + 단일트랙 fetch 2개 + 얇은 라우트 + 프론트 페이지. 흐름: parse → 유저 토큰 → fetch(정규화) → `persist_container_tracks`(EMP) → `merge_tracks`(flat) → `ModalTrackList`.

**Tech Stack:** Python/FastAPI, httpx, psycopg, Next.js/React/TS, respx(테스트).

---

## ⚠️ 실행 전 필수 주의

- **전체 `pytest tests/` 금지** — dev DB 오염. 항상 **해당 파일만** `.venv/bin/pytest <path> -v`.
- `cd "/Volumes/MacExtend 1/MRMS_FN"`, 파이썬은 `.venv/bin/python`/`.venv/bin/pytest`.
- 커밋 메시지 마지막 줄 `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- pyproject `asyncio_mode = "auto"` — async 테스트에 `@pytest.mark.asyncio` 불필요.

## File Structure

| 파일 | 책임 | 작업 |
|---|---|---|
| `src/mrms/search/share_url.py` | 공유 URL 파싱 | 생성: `parse_share_url` |
| `src/mrms/search/expand.py` | 트랙 fetch | 수정: `_spotify_track`/`_tidal_track`/`fetch_track`/`_container_title` 추가 |
| `src/mrms/api/import_url.py` | API | 생성: `POST /api/import/url` |
| `src/mrms/api/main.py` | 라우터 등록 | 수정: import 라우터 include |
| `web/src/lib/types.ts` | 타입 | 수정: `ImportResult` |
| `web/src/lib/api/import.ts` | API 클라 | 생성: `importUrl` |
| `web/src/app/(dashboard)/import/page.tsx` | 페이지 | 생성 |
| `web/src/lib/nav.ts` | 내비 | 수정: Discover에 Import 항목 |
| `tests/search/test_share_url.py` | 테스트 | 생성 |
| `tests/search/test_expand_track.py` | 테스트 | 생성 |
| `tests/api/test_import_url.py` | 테스트 | 생성 |

재사용(무수정): `search/expand.py`의 `fetch_container_tracks`/`persist_container_tracks`, `search/normalize.py`의 `normalize_*_track`/`merge_tracks`, `api/search.py`의 `_spotify_tok`/`_tidal_tok`, `components/track/ModalTrackList`.

---

### Task 1: 공유 URL 파서

**Files:**
- Create: `src/mrms/search/share_url.py`
- Test: `tests/search/test_share_url.py`

- [ ] **Step 1: Write the failing test**

Create `tests/search/test_share_url.py`:

```python
from __future__ import annotations

from mrms.search.share_url import parse_share_url


def test_spotify_track_with_query():
    assert parse_share_url("https://open.spotify.com/track/7yED4n2U8RR5LKZVmisiev?si=abc") \
        == ("spotify", "track", "7yED4n2U8RR5LKZVmisiev")


def test_spotify_playlist_algorithmic():
    assert parse_share_url("https://open.spotify.com/playlist/37i9dQZF1E35KmzZ4Jlvh3?si=x") \
        == ("spotify", "playlist", "37i9dQZF1E35KmzZ4Jlvh3")


def test_spotify_album():
    assert parse_share_url("https://open.spotify.com/album/1A2B3C") == ("spotify", "album", "1A2B3C")


def test_tidal_playlist_uuid():
    assert parse_share_url("https://tidal.com/playlist/edf3b7d2-cb42-41d7-93c0-afa2a395521b") \
        == ("tidal", "playlist", "edf3b7d2-cb42-41d7-93c0-afa2a395521b")


def test_tidal_browse_album_and_www():
    assert parse_share_url("https://tidal.com/browse/album/12345") == ("tidal", "album", "12345")
    assert parse_share_url("https://www.tidal.com/track/999") == ("tidal", "track", "999")


def test_rejects_unsupported():
    assert parse_share_url("https://youtube.com/watch?v=x") is None          # 미지원 호스트
    assert parse_share_url("https://open.spotify.com/artist/1abc") is None    # 미지원 타입
    assert parse_share_url("https://open.spotify.com/track") is None          # id 없음
    assert parse_share_url("not a url") is None
    assert parse_share_url("") is None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/bin/pytest tests/search/test_share_url.py -v`
Expected: FAIL (`ModuleNotFoundError: No module named 'mrms.search.share_url'`)

- [ ] **Step 3: Implement**

Create `src/mrms/search/share_url.py`:

```python
"""Tidal/Spotify 공유 URL → (platform, item_type, item_id). 쿼리/프래그먼트·browse 무시."""
from __future__ import annotations

from urllib.parse import urlparse

_HOSTS = {
    "open.spotify.com": "spotify",
    "spotify.com": "spotify",
    "tidal.com": "tidal",
    "www.tidal.com": "tidal",
    "listen.tidal.com": "tidal",
}
_TYPES = {"track", "playlist", "album"}


def parse_share_url(url: str) -> tuple[str, str, str] | None:
    """예: open.spotify.com/track/<id>?si=… → ('spotify','track',<id>). 미지원/깨진 URL → None."""
    try:
        u = urlparse((url or "").strip())
    except ValueError:
        return None
    host = (u.netloc or "").lower().split(":")[0]
    platform = _HOSTS.get(host)
    if not platform:
        return None
    segs = [s for s in (u.path or "").split("/") if s]
    for i, seg in enumerate(segs):
        if seg.lower() in _TYPES and i + 1 < len(segs):
            return (platform, seg.lower(), segs[i + 1])
    return None
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/bin/pytest tests/search/test_share_url.py -v`
Expected: PASS (6 passed)

- [ ] **Step 5: Commit**

```bash
git add src/mrms/search/share_url.py tests/search/test_share_url.py
git commit -m "feat(import): 공유 URL 파서 parse_share_url (track/playlist/album × tidal/spotify)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: 단일 트랙 fetch + 컨테이너 제목

**Files:**
- Modify: `src/mrms/search/expand.py` (append)
- Test: `tests/search/test_expand_track.py`

`expand.py`에는 이미 `SPOTIFY`/`TIDAL` 상수, `normalize_spotify_track`/`normalize_tidal_track` import가 있다. 그 뒤에 단일트랙 fetch와 컨테이너 제목(best-effort)을 추가한다.

- [ ] **Step 1: Write the failing test**

Create `tests/search/test_expand_track.py`:

```python
from __future__ import annotations

import httpx
import respx

from mrms.search.expand import _spotify_track, _tidal_track, fetch_track


@respx.mock
async def test_spotify_track_200_normalizes():
    respx.get("https://api.spotify.com/v1/tracks/abc").mock(return_value=httpx.Response(200, json={
        "id": "abc", "name": "Song", "artists": [{"name": "A"}],
        "album": {"name": "Alb", "images": [{"url": "u"}]},
        "duration_ms": 200000, "external_ids": {"isrc": "USABC1234567"}}))
    async with httpx.AsyncClient() as h:
        t = await _spotify_track(h, "tok", "abc")
    assert t["platform"] == "spotify" and t["platform_track_id"] == "abc" and t["title"] == "Song"


@respx.mock
async def test_spotify_track_404_none():
    respx.get("https://api.spotify.com/v1/tracks/x").mock(return_value=httpx.Response(404))
    async with httpx.AsyncClient() as h:
        assert await _spotify_track(h, "tok", "x") is None


@respx.mock
async def test_tidal_track_200_and_fetch_track_dispatch():
    respx.get(url__startswith="https://api.tidal.com/v1/tracks/999").mock(
        return_value=httpx.Response(200, json={
            "id": 999, "title": "T", "artists": [{"name": "B"}],
            "album": {"title": "Alb", "cover": "x-y-z"}, "duration": 200, "isrc": "USXYZ9876543"}))
    async with httpx.AsyncClient() as h:
        t = await _tidal_track(h, "tok", "999", "US")
        t2 = await fetch_track(h, "tidal", "999", "tok", "US")
    assert t["platform"] == "tidal" and t["platform_track_id"] == "999"
    assert t2 is not None and t2["platform_track_id"] == "999"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/bin/pytest tests/search/test_expand_track.py -v`
Expected: FAIL (`ImportError: cannot import name '_spotify_track'`)

- [ ] **Step 3: Implement — append to `src/mrms/search/expand.py`**

```python
async def _spotify_track(http, token, track_id):
    r = await http.get(f"{SPOTIFY}/tracks/{track_id}",
                       headers={"Authorization": f"Bearer {token}"})
    return normalize_spotify_track(r.json()) if r.status_code == 200 else None


async def _tidal_track(http, token, track_id, country):
    r = await http.get(f"{TIDAL}/tracks/{track_id}",
                       params={"countryCode": country},
                       headers={"Authorization": f"Bearer {token}"})
    return normalize_tidal_track(r.json()) if r.status_code == 200 else None


async def fetch_track(http, platform, track_id, token, country):
    """단일 트랙 → 정규화 트랙 1개 또는 None."""
    if platform == "spotify":
        return await _spotify_track(http, token, track_id)
    return await _tidal_track(http, token, track_id, country)


async def _container_title(http, platform, item_type, item_id, token, country):
    """플레이리스트/앨범 이름(best-effort). 실패/미응답 시 None."""
    try:
        if platform == "spotify":
            params = {"fields": "name"} if item_type == "playlist" else None
            r = await http.get(f"{SPOTIFY}/{item_type}s/{item_id}", params=params,
                               headers={"Authorization": f"Bearer {token}"})
            return r.json().get("name") if r.status_code == 200 else None
        r = await http.get(f"{TIDAL}/{item_type}s/{item_id}",
                           params={"countryCode": country},
                           headers={"Authorization": f"Bearer {token}"})
        return r.json().get("title") if r.status_code == 200 else None
    except Exception:
        return None
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/bin/pytest tests/search/test_expand_track.py -v`
Expected: PASS (3 passed)

- [ ] **Step 5: Commit**

```bash
git add src/mrms/search/expand.py tests/search/test_expand_track.py
git commit -m "feat(import): 단일 트랙 fetch(_spotify_track/_tidal_track/fetch_track) + 컨테이너 제목

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: API 라우트 + 등록

**Files:**
- Create: `src/mrms/api/import_url.py`
- Modify: `src/mrms/api/main.py`
- Test: `tests/api/test_import_url.py`

- [ ] **Step 1: Write the failing test**

Create `tests/api/test_import_url.py`:

```python
from __future__ import annotations

import mrms.api.import_url as iu
from fastapi.testclient import TestClient

from mrms.api.main import app

client = TestClient(app)


def _ntrack(platform="spotify", pid="abc"):
    return {"platform": platform, "platform_track_id": pid, "title": "Song", "artist": "Artist",
            "album_title": "Alb", "album_cover": None, "duration_ms": 200000, "isrc": "USABC1234567"}


async def _tok(user_id, conn):
    return "tok"


def test_import_requires_auth():
    client.cookies.clear()
    r = client.post("/api/import/url", json={"url": "https://open.spotify.com/track/abc"})
    assert r.status_code in (401, 403)


def test_import_bad_url_400(login):
    _, sid = login()
    client.cookies.set("mrms_session", sid)
    r = client.post("/api/import/url", json={"url": "https://youtube.com/x"})
    assert r.status_code == 400
    client.cookies.clear()


def test_import_token_unavailable_401(login, monkeypatch):
    _, sid = login()
    client.cookies.set("mrms_session", sid)

    async def boom(user_id, conn):
        raise RuntimeError("no token")

    monkeypatch.setattr(iu, "_spotify_tok", boom)
    r = client.post("/api/import/url", json={"url": "https://open.spotify.com/track/abc"})
    assert r.status_code == 401
    client.cookies.clear()


def test_import_track_happy(login, monkeypatch):
    _, sid = login()
    client.cookies.set("mrms_session", sid)
    monkeypatch.setattr(iu, "_spotify_tok", _tok)

    async def fake_track(http, platform, item_id, tok, country):
        return _ntrack("spotify", item_id)

    monkeypatch.setattr(iu, "fetch_track", fake_track)
    monkeypatch.setattr(iu, "persist_container_tracks", lambda *a, **k: "track:abc")
    r = client.post("/api/import/url", json={"url": "https://open.spotify.com/track/abc?si=z"})
    assert r.status_code == 200
    data = r.json()
    assert data["item_type"] == "track"
    assert data["title"] == "Artist — Song"
    assert len(data["tracks"]) == 1 and data["tracks"][0]["spotify_track_id"] == "abc"
    client.cookies.clear()


def test_import_playlist_happy(login, monkeypatch):
    _, sid = login()
    client.cookies.set("mrms_session", sid)
    monkeypatch.setattr(iu, "_spotify_tok", _tok)

    async def fake_container(http, platform, item_type, item_id, tok, country):
        return [_ntrack("spotify", "p1"), _ntrack("spotify", "p2")]

    async def fake_title(http, platform, item_type, item_id, tok, country):
        return "My Playlist"

    monkeypatch.setattr(iu, "fetch_container_tracks", fake_container)
    monkeypatch.setattr(iu, "_container_title", fake_title)
    monkeypatch.setattr(iu, "persist_container_tracks", lambda *a, **k: "playlist:pl")
    r = client.post("/api/import/url", json={"url": "https://open.spotify.com/playlist/pl?si=z"})
    assert r.status_code == 200
    data = r.json()
    assert data["item_type"] == "playlist" and data["title"] == "My Playlist"
    assert len(data["tracks"]) == 2
    client.cookies.clear()


def test_import_empty_404(login, monkeypatch):
    _, sid = login()
    client.cookies.set("mrms_session", sid)
    monkeypatch.setattr(iu, "_spotify_tok", _tok)

    async def empty(http, platform, item_id, tok, country):
        return None

    monkeypatch.setattr(iu, "fetch_track", empty)
    r = client.post("/api/import/url", json={"url": "https://open.spotify.com/track/x"})
    assert r.status_code == 404
    client.cookies.clear()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/bin/pytest tests/api/test_import_url.py -v`
Expected: FAIL (`ModuleNotFoundError: No module named 'mrms.api.import_url'`)

- [ ] **Step 3: Create `src/mrms/api/import_url.py`**

```python
"""공유 URL → 트랙 fetch → EMP 적재 → 표시. search expand 패턴 재사용."""
from __future__ import annotations

import httpx
import psycopg
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from mrms.api.deps import db_conn, get_current_user_id
from mrms.api.search import _spotify_tok, _tidal_tok
from mrms.search.expand import (
    _container_title,
    fetch_container_tracks,
    fetch_track,
    persist_container_tracks,
)
from mrms.search.normalize import merge_tracks
from mrms.search.share_url import parse_share_url

router = APIRouter(prefix="/api/import", tags=["import"])


class ImportReq(BaseModel):
    url: str


@router.post("/url")
async def import_url(
    req: ImportReq,
    user_id: str = Depends(get_current_user_id),
    conn: psycopg.Connection = Depends(db_conn),
):
    parsed = parse_share_url(req.url)
    if not parsed:
        raise HTTPException(400, "지원하지 않는 URL입니다 (Tidal/Spotify track·playlist·album)")
    platform, item_type, item_id = parsed

    with conn.cursor() as cur:
        cur.execute('SELECT country FROM "User" WHERE id = %s', (user_id,))
        u = cur.fetchone()
    country = u[0] if u and u[0] else "US"

    try:
        tok = await (_spotify_tok if platform == "spotify" else _tidal_tok)(user_id, conn)
    except Exception:
        raise HTTPException(401, f"{platform} 연결이 필요합니다")

    title = None
    async with httpx.AsyncClient(timeout=15.0) as http:
        if item_type == "track":
            one = await fetch_track(http, platform, item_id, tok, country)
            normalized = [one] if one else []
        else:
            normalized = await fetch_container_tracks(
                http, platform, item_type, item_id, tok, country)
            title = await _container_title(http, platform, item_type, item_id, tok, country)

    if not normalized:
        raise HTTPException(404, "트랙을 가져올 수 없습니다 (비공개·삭제·미지원 링크)")

    persist_container_tracks(conn, normalized, item_type, item_id)
    tracks = merge_tracks(normalized)
    if item_type == "track" and tracks:
        title = f"{tracks[0]['artist']} — {tracks[0]['title']}"
    return {"platform": platform, "item_type": item_type, "title": title, "tracks": tracks}
```

- [ ] **Step 4: Register in `src/mrms/api/main.py`**

Add the import next to `from mrms.api.search import router as search_router`:

```python
from mrms.api.import_url import router as import_url_router
```

Add the include next to `app.include_router(search_router)`:

```python
app.include_router(import_url_router)
```

- [ ] **Step 5: Run test to verify it passes**

Run: `.venv/bin/pytest tests/api/test_import_url.py -v`
Expected: PASS (6 passed)

- [ ] **Step 6: Commit**

```bash
git add src/mrms/api/import_url.py src/mrms/api/main.py tests/api/test_import_url.py
git commit -m "feat(import): POST /api/import/url + main 등록 (파싱·유저토큰·400/401/404·EMP적재)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: 프론트 타입 + API 클라이언트

**Files:**
- Modify: `web/src/lib/types.ts`
- Create: `web/src/lib/api/import.ts`

`SearchTrack`(이미 존재, flat 트랙 형태 = `ModalTrack` 호환)을 재사용한다.

- [ ] **Step 1: Append to `web/src/lib/types.ts`**

```typescript
export interface ImportResult {
  platform: string;
  item_type: string;
  title: string | null;
  tracks: SearchTrack[];
}
```

- [ ] **Step 2: Create `web/src/lib/api/import.ts`**

```typescript
import type { ImportResult } from "@/lib/types";

import { apiFetch } from "./http";

export async function importUrl(url: string): Promise<ImportResult> {
  const r = await apiFetch(
    "/api/import/url",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    },
    "import",
  );
  return (await r.json()) as ImportResult;
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm -C web exec tsc --noEmit`
Expected: exit 0, no errors.

- [ ] **Step 4: Commit**

```bash
git add web/src/lib/types.ts web/src/lib/api/import.ts
git commit -m "feat(import): 프론트 ImportResult 타입 + importUrl 클라이언트

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: 프론트 페이지 + 내비

**Files:**
- Create: `web/src/app/(dashboard)/import/page.tsx`
- Modify: `web/src/lib/nav.ts`

- [ ] **Step 1: Create `web/src/app/(dashboard)/import/page.tsx`**

```tsx
"use client";

import { useState } from "react";

import { importUrl } from "@/lib/api/import";
import type { ImportResult } from "@/lib/types";
import { ModalTrackList, PlayAllButton } from "@/components/track/ModalTrackList";

export default function ImportPage() {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const u = url.trim();
    if (!u) return;
    setLoading(true);
    setError(null);
    try {
      setResult(await importUrl(u));
    } catch (e) {
      setError((e as Error).message);
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const tracks = result?.tracks ?? [];

  return (
    <div className="px-6 py-8 md:px-14">
      <header className="mb-6 border-b border-(--mrms-rule) pb-4">
        <div className="font-display text-[28px] font-bold leading-none text-(--mrms-ink)">
          Eat The Shared
        </div>
        <div className="mt-1.5 font-mono text-[10px] uppercase tracking-editorial-wide text-(--mrms-ink-mute)">
          공유 링크 붙여넣고 바로 듣기 — Tidal · Spotify (track · playlist · album)
        </div>
      </header>

      <div className="mb-8 flex gap-2">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder="https://open.spotify.com/playlist/…  또는  https://tidal.com/playlist/…"
          className="min-w-0 flex-1 border border-(--mrms-rule) bg-transparent px-4 py-3 font-mono text-[13px] text-(--mrms-ink) placeholder:text-(--mrms-ink-mute) focus:border-(--mrms-rust) focus:outline-none"
        />
        <button
          type="button"
          onClick={submit}
          disabled={loading || !url.trim()}
          className="shrink-0 cursor-pointer border-0 bg-(--mrms-rust) px-4 py-2 font-mono text-[10px] uppercase tracking-editorial text-(--mrms-paper) disabled:cursor-default disabled:opacity-40"
        >
          {loading ? "가져오는 중…" : "가져오기"}
        </button>
      </div>

      {error && <div className="font-mono text-[11px] text-(--mrms-rust)">{error}</div>}

      {result && !loading && (
        tracks.length > 0 ? (
          <>
            <div className="mb-3 flex items-center justify-between gap-3 border-b border-(--mrms-rule) pb-2">
              <span className="min-w-0 truncate font-display text-[15px] font-semibold text-(--mrms-ink)">
                {result.title ?? `${tracks.length} tracks`}
              </span>
              <PlayAllButton tracks={tracks} />
            </div>
            <ModalTrackList tracks={tracks} />
          </>
        ) : (
          <div className="font-mono text-[11px] text-(--mrms-ink-mute)">트랙 없음</div>
        )
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add the nav item**

In `web/src/lib/nav.ts`, inside the `"Discover"` group's `items` array, add at the end of that array:

```typescript
      { title: "Import", href: "/import", num: "D6", full: "Eat The Shared", badge: "·" },
```

(`num`은 Discover 그룹의 기존 항목과 겹치지 않게 — 현재 마지막 다음 번호. 겹치면 표시상 문제 없으나 `D6`이 비어있는지 확인 후 조정.)

- [ ] **Step 3: Build**

Run: `pnpm -C web build`
Expected: 성공, `/import` 라우트 컴파일, 타입 에러 없음. (`SearchTrack[]` → `ModalTrackList`/`PlayAllButton`의 `ModalTrack[]`는 구조적 호환이라 통과. 만약 TS가 막으면 STOP & 리포트.)

- [ ] **Step 4: Commit**

```bash
git add "web/src/app/(dashboard)/import/page.tsx" web/src/lib/nav.ts
git commit -m "feat(import): /import 페이지(URL 입력 + ModalTrackList) + nav 항목

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## 최종 검증 (모든 태스크 후)

- [ ] 백엔드 타깃 테스트:
  `.venv/bin/pytest tests/search/test_share_url.py tests/search/test_expand_track.py tests/api/test_import_url.py -v` → 전부 PASS.
- [ ] 프론트 `pnpm -C web build` → 성공.
- [ ] (배포 후) prod에서 **연동 계정**으로 실제 공유 URL 동작 확인 — Tidal playlist, Spotify track/playlist, 그리고 `37i9…` 알고리즘 플레이리스트(접근 불가면 "가져올 수 없는 링크" 404로 graceful).

## 배포 노트

- 신규 의존성 없음 → deploy = rebuild + restart. push to main 시 자동 배포.
- 동작에 유저 Spotify/Tidal 연동 필요(미연동 → 401 "연결이 필요합니다"). dev DB엔 토큰 없음(dev/prod 분리) — 로컬은 mock 테스트, 라이브 검증은 prod 연동 계정.
