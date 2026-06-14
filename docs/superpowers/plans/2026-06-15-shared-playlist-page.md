# 공유 플레이리스트 페이지 (Share & Play) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 내 MRMS 플레이리스트를 공개 링크 `/p/{token}`로 공유하고, 방문자가 MRMS 페이지 안에서 본인 Spotify/Tidal 구독으로 재생하게 한다(미연결 시 우리 OAuth 연결 유도 = 홍보 퍼널).

**Architecture:** `Playlist`에 무작위 `shareId` 토큰 컬럼을 추가하고, 소유자만 토글하는 `POST /api/user/playlists/{id}/share`와 무인증 공개 조회 `GET /api/shared/{token}`을 더한다. 프론트는 `(dashboard)` 밖의 공개 페이지 `/p/[shareId]`(브랜딩 헤더 + `PlayerBar` + 트랙 리스트 + 연결 CTA)를 새로 만들고, 내 플레이리스트 상세 모달에 "공유" 버튼을 붙인다. 멀티플랫폼 player(`lib/player.ts`)·OAuth 연결(login 메커니즘)·플레이리스트 조회(`db/playlist.py`)는 그대로 재사용한다.

**Tech Stack:** FastAPI + raw psycopg (백엔드), raw SQL 마이그레이션(`prisma/migrations/`), Next.js 16 / React 19 + Zustand + SWR (프론트), pytest(+TestClient) / vitest·eslint·tsc (테스트).

**참고 — 절대 경로:** 이 저장소 루트는 `/Volumes/MacExtend 1/MRMS_FN`. 모든 명령은 이 루트에서 실행한다고 가정한다. 프론트는 `web/` 하위.

**⚠️ DB 격리:** MRMS dev DB는 격리되어 있지 않다. **전체 `pytest tests/` 금지** — 반드시 대상 테스트 파일/노드만 실행한다. 테스트 DSN은 `DATABASE_URL`(기본 `postgresql://mrms:mrms@localhost:5433/mrms`).

---

### Task 1: 마이그레이션 — `Playlist.shareId` 컬럼

**Files:**
- Create: `prisma/migrations/20260615100000_add_playlist_share/migration.sql`

- [ ] **Step 1: 마이그레이션 SQL 작성**

`prisma/migrations/20260615100000_add_playlist_share/migration.sql`:

```sql
ALTER TABLE "Playlist" ADD COLUMN IF NOT EXISTS "shareId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_playlist_share ON "Playlist"("shareId");
```

- [ ] **Step 2: 로컬/테스트 DB에 적용**

Run:
```bash
psql "${DATABASE_URL:-postgresql://mrms:mrms@localhost:5433/mrms}" -f prisma/migrations/20260615100000_add_playlist_share/migration.sql
```
Expected: `ALTER TABLE` + `CREATE INDEX` (또는 이미 있으면 `NOTICE ... already exists, skipping`). 에러 없이 종료.

> `psql`이 PATH에 없으면 docs/deployment.md 패턴 사용:
> `docker compose exec -T pg psql -U mrms -d mrms < prisma/migrations/20260615100000_add_playlist_share/migration.sql`

- [ ] **Step 3: 컬럼 생성 확인**

Run:
```bash
psql "${DATABASE_URL:-postgresql://mrms:mrms@localhost:5433/mrms}" -c '\d "Playlist"' | grep shareId
```
Expected: `shareId | text` 행이 출력됨.

- [ ] **Step 4: Commit**

```bash
git add prisma/migrations/20260615100000_add_playlist_share/migration.sql
git commit -m "feat(share): Playlist.shareId 컬럼 마이그레이션 (공유 토큰)"
```

---

### Task 2: `db/playlist.py` — share 헬퍼 + `get_playlist`에 share_id

**Files:**
- Modify: `src/mrms/db/playlist.py`
- Test: `tests/db/test_playlist.py`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/db/test_playlist.py` 상단 import 블록을 다음으로 교체(헬퍼 2개 추가):

```python
from mrms.db.playlist import (
    create_playlist,
    get_playlist,
    get_playlist_by_share_id,
    get_playlist_tracks,
    list_user_playlists,
    set_playlist_share,
)
from mrms.db.user_track import get_or_create_user
```

같은 파일 맨 끝에 추가:

```python
def test_set_playlist_share_creates_and_clears_token(db_conn: psycopg.Connection):
    """on=True → 토큰 생성(재호출 시 유지), on=False → None. get_playlist에 반영."""
    user_id = get_or_create_user(db_conn, "share-db@test.com")
    db_conn.commit()
    with db_conn.cursor() as cur:
        cur.execute('SELECT id FROM "Track" LIMIT 1')
        track_ids = [r[0] for r in cur.fetchall()]
    if not track_ids:
        pytest.skip("Track 데이터 부족")

    pid = create_playlist(
        db_conn, user_id=user_id, name="ShareDB", description=None, track_ids=track_ids
    )

    token = set_playlist_share(db_conn, pid, True)
    assert token
    # idempotent — 재호출 시 기존 토큰 유지
    assert set_playlist_share(db_conn, pid, True) == token
    # get_playlist에 share_id 반영
    assert get_playlist(db_conn, pid)["share_id"] == token
    # 해제 → None
    assert set_playlist_share(db_conn, pid, False) is None
    assert get_playlist(db_conn, pid)["share_id"] is None


def test_get_playlist_by_share_id(db_conn: psycopg.Connection):
    """공유 토큰으로 메타(+owner_name) 조회. 없는 토큰은 None."""
    user_id = get_or_create_user(db_conn, "share-lookup@test.com")
    db_conn.commit()
    with db_conn.cursor() as cur:
        cur.execute('SELECT id FROM "Track" LIMIT 1')
        track_ids = [r[0] for r in cur.fetchall()]
    if not track_ids:
        pytest.skip("Track 데이터 부족")

    pid = create_playlist(
        db_conn, user_id=user_id, name="Lookup", description="d", track_ids=track_ids
    )
    token = set_playlist_share(db_conn, pid, True)

    found = get_playlist_by_share_id(db_conn, token)
    assert found["id"] == pid
    assert found["name"] == "Lookup"
    assert "owner_name" in found  # displayName 미설정이면 None 허용
    assert get_playlist_by_share_id(db_conn, "nonexistent-token") is None
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pytest tests/db/test_playlist.py::test_set_playlist_share_creates_and_clears_token tests/db/test_playlist.py::test_get_playlist_by_share_id -v`
Expected: FAIL — `ImportError: cannot import name 'set_playlist_share'` (또는 `get_playlist_by_share_id`).

- [ ] **Step 3: 헬퍼 구현**

`src/mrms/db/playlist.py` 최상단 import에 `secrets` 추가:

```python
"""Playlist + PlaylistTrack DB 헬퍼."""
from __future__ import annotations

import secrets
from datetime import datetime, timezone

import psycopg

from mrms.db.ids import stable_id as _id
```

기존 `get_playlist` 함수를 아래로 교체(share_id 컬럼 추가):

```python
def get_playlist(
    conn: psycopg.Connection, playlist_id: str
) -> dict | None:
    """Playlist 메타 (share_id 포함)."""
    with conn.cursor() as cur:
        cur.execute(
            '''SELECT id, "userId", name, description, "createdAt", "shareId"
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
        "share_id": row[5],
    }
```

파일 맨 끝에 두 헬퍼 추가:

```python
def set_playlist_share(
    conn: psycopg.Connection, playlist_id: str, on: bool
) -> str | None:
    """공유 토글. on이면 shareId 생성(없을 때만)·반환, off면 NULL로 비우고 None 반환."""
    with conn.cursor() as cur:
        if not on:
            cur.execute(
                'UPDATE "Playlist" SET "shareId" = NULL WHERE id = %s', (playlist_id,)
            )
            conn.commit()
            return None
        cur.execute('SELECT "shareId" FROM "Playlist" WHERE id = %s', (playlist_id,))
        row = cur.fetchone()
        existing = row[0] if row else None
        if existing:
            return existing  # idempotent — 기존 토큰 유지
        share_id = secrets.token_urlsafe(9)
        cur.execute(
            'UPDATE "Playlist" SET "shareId" = %s WHERE id = %s',
            (share_id, playlist_id),
        )
    conn.commit()
    return share_id


def get_playlist_by_share_id(
    conn: psycopg.Connection, share_id: str
) -> dict | None:
    """공유 토큰으로 플레이리스트 메타(+owner displayName). 없으면 None."""
    with conn.cursor() as cur:
        cur.execute(
            '''SELECT p.id, p.name, p.description, p."createdAt", u."displayName"
               FROM "Playlist" p
               JOIN "User" u ON u.id = p."userId"
               WHERE p."shareId" = %s''',
            (share_id,),
        )
        row = cur.fetchone()
    if not row:
        return None
    return {
        "id": row[0],
        "name": row[1],
        "description": row[2],
        "created_at": row[3].isoformat() if row[3] else None,
        "owner_name": row[4],
    }
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pytest tests/db/test_playlist.py -v`
Expected: PASS (신규 2개 포함 전부). Track 데이터 없으면 skip.

- [ ] **Step 5: lint**

Run: `ruff check src/mrms/db/playlist.py tests/db/test_playlist.py`
Expected: `All checks passed!` (또는 import 정렬 자동수정 후 통과 — `ruff check --fix` 적용).

- [ ] **Step 6: Commit**

```bash
git add src/mrms/db/playlist.py tests/db/test_playlist.py
git commit -m "feat(share): set_playlist_share/get_playlist_by_share_id + get_playlist에 share_id"
```

---

### Task 3: `api/playlists.py` — share 토글 엔드포인트

**Files:**
- Modify: `src/mrms/api/playlists.py`
- Test: `tests/api/test_playlists.py`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/api/test_playlists.py` 맨 끝에 추가:

```python
def test_toggle_playlist_share(db_conn, login):
    """POST .../share enabled=true → share_id + share_url, false → null."""
    _, session_id = login("share-toggle@test.com")
    track_ids = _pick_track_ids(db_conn, 1)
    if not track_ids:
        pytest.skip("Track 데이터 부족")
    client.cookies.set("mrms_session", session_id)
    pid = client.post(
        "/api/user/playlists", json={"name": "S", "track_ids": track_ids}
    ).json()["playlist"]["id"]

    on = client.post(f"/api/user/playlists/{pid}/share", json={"enabled": True})
    assert on.status_code == 200, on.text
    share_id = on.json()["share_id"]
    assert share_id
    assert on.json()["share_url"] == f"/p/{share_id}"

    off = client.post(f"/api/user/playlists/{pid}/share", json={"enabled": False})
    assert off.status_code == 200
    assert off.json()["share_id"] is None
    assert off.json()["share_url"] is None
    client.cookies.clear()


def test_share_other_user_forbidden(db_conn, login):
    """다른 사용자 playlist 공유 토글 → 403."""
    _, session_a = login("share-owner@test.com")
    track_ids = _pick_track_ids(db_conn, 1)
    if not track_ids:
        pytest.skip("Track 데이터 부족")
    client.cookies.set("mrms_session", session_a)
    pid = client.post(
        "/api/user/playlists", json={"name": "P", "track_ids": track_ids}
    ).json()["playlist"]["id"]

    _, session_b = login("share-stranger@test.com")
    client.cookies.set("mrms_session", session_b)
    r = client.post(f"/api/user/playlists/{pid}/share", json={"enabled": True})
    assert r.status_code == 403
    client.cookies.clear()


def test_share_requires_auth(db_conn):
    """미인증 → 401."""
    client.cookies.clear()
    r = client.post("/api/user/playlists/whatever/share", json={"enabled": True})
    assert r.status_code == 401
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pytest tests/api/test_playlists.py::test_toggle_playlist_share -v`
Expected: FAIL — 404 (라우트 없음) 이라 `assert on.status_code == 200` 실패.

- [ ] **Step 3: 엔드포인트 구현**

`src/mrms/api/playlists.py` import 블록의 `from mrms.db.playlist import (...)`에 `set_playlist_share` 추가:

```python
from mrms.db.playlist import (
    create_playlist,
    get_playlist,
    get_playlist_tracks,
    list_user_playlists,
    set_playlist_share,
)
```

`CreatePlaylistRequest` 아래에 요청 모델 추가:

```python
class ShareRequest(BaseModel):
    enabled: bool
```

파일 맨 끝(마지막 라우트 뒤)에 추가:

```python
@router.post("/api/user/playlists/{playlist_id}/share")
def toggle_playlist_share(
    playlist_id: str,
    body: ShareRequest,
    user_id: str = Depends(get_current_user_id),
    conn=Depends(db_conn),
):
    """공유 토글 (소유자만). enabled=true면 공개 링크 생성, false면 해제."""
    pl = get_playlist(conn, playlist_id)
    if not pl:
        raise HTTPException(404, "playlist not found")
    if pl["user_id"] != user_id:
        raise HTTPException(403, "forbidden")
    share_id = set_playlist_share(conn, playlist_id, body.enabled)
    return {
        "share_id": share_id,
        "share_url": f"/p/{share_id}" if share_id else None,
    }
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `pytest tests/api/test_playlists.py -v`
Expected: PASS (신규 3개 포함 전부).

- [ ] **Step 5: lint**

Run: `ruff check src/mrms/api/playlists.py tests/api/test_playlists.py`
Expected: `All checks passed!` (B008 Depends-in-default은 레포 전역 패턴 — 신규 위반 없으면 통과).

- [ ] **Step 6: Commit**

```bash
git add src/mrms/api/playlists.py tests/api/test_playlists.py
git commit -m "feat(share): POST /api/user/playlists/{id}/share 토글 (owner 인증·403)"
```

---

### Task 4: `api/shared.py` — 무인증 공개 조회 + main 등록

**Files:**
- Create: `src/mrms/api/shared.py`
- Modify: `src/mrms/api/main.py`
- Test: `tests/api/test_shared.py`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/api/test_shared.py` 신규:

```python
"""공유 플레이리스트 공개 조회 — 무인증."""
import pytest
from fastapi.testclient import TestClient

from mrms.api.main import app


client = TestClient(app)


def _pick_track_ids(db_conn, n: int) -> list[str]:
    with db_conn.cursor() as cur:
        cur.execute('SELECT id FROM "Track" LIMIT %s', (n,))
        return [r[0] for r in cur.fetchall()]


def test_shared_playlist_public_no_auth(db_conn, login):
    """공유한 플레이리스트는 무인증 방문자도 조회 가능."""
    _, session_id = login("shared-pub@test.com")
    track_ids = _pick_track_ids(db_conn, 2)
    if len(track_ids) < 2:
        pytest.skip("Track 데이터 부족")
    client.cookies.set("mrms_session", session_id)
    pid = client.post(
        "/api/user/playlists", json={"name": "Pub", "track_ids": track_ids}
    ).json()["playlist"]["id"]
    share_id = client.post(
        f"/api/user/playlists/{pid}/share", json={"enabled": True}
    ).json()["share_id"]
    client.cookies.clear()  # 무인증 방문자

    r = client.get(f"/api/shared/{share_id}")
    assert r.status_code == 200, r.text
    assert r.json()["playlist"]["name"] == "Pub"
    assert [t["track_id"] for t in r.json()["tracks"]] == track_ids


def test_shared_unknown_token_404(db_conn):
    """없는/해제된 토큰 → 404."""
    client.cookies.clear()
    r = client.get("/api/shared/does-not-exist")
    assert r.status_code == 404
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `pytest tests/api/test_shared.py -v`
Expected: FAIL — `/api/shared/...` 404 항상이라 `test_shared_playlist_public_no_auth`의 200 단언 실패(라우트 미존재).

- [ ] **Step 3: 라우트 구현**

`src/mrms/api/shared.py` 신규:

```python
"""공유 플레이리스트 공개 조회 — 무인증. 토큰으로 메타 + 트랙."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from mrms.api.deps import db_conn
from mrms.db.playlist import get_playlist_by_share_id, get_playlist_tracks


router = APIRouter(tags=["shared"])


@router.get("/api/shared/{share_id}")
def get_shared_playlist(share_id: str, conn=Depends(db_conn)):
    """공개 페이지용 — 인증 불필요. 없거나 해제된 토큰은 404."""
    pl = get_playlist_by_share_id(conn, share_id)
    if not pl:
        raise HTTPException(404, "공유가 없거나 해제된 링크입니다")
    tracks = get_playlist_tracks(conn, pl["id"])
    return {"playlist": pl, "tracks": tracks}
```

- [ ] **Step 4: main.py에 라우터 등록**

`src/mrms/api/main.py`에서, `from mrms.api.playlists import router as playlists_router` 다음 줄에 import 추가:

```python
from mrms.api.shared import router as shared_router
```

`app.include_router(playlists_router)` 다음 줄에 등록 추가:

```python
app.include_router(shared_router)
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `pytest tests/api/test_shared.py -v`
Expected: PASS (2개).

- [ ] **Step 6: lint**

Run: `ruff check src/mrms/api/shared.py src/mrms/api/main.py tests/api/test_shared.py`
Expected: `All checks passed!`

- [ ] **Step 7: Commit**

```bash
git add src/mrms/api/shared.py src/mrms/api/main.py tests/api/test_shared.py
git commit -m "feat(share): GET /api/shared/{token} 무인증 공개 조회 + main 등록"
```

---

### Task 5: 프론트 — `lib/api/shared.ts` 클라이언트 + `PlaylistMeta.share_id`

**Files:**
- Create: `web/src/lib/api/shared.ts`
- Modify: `web/src/lib/api/playlists.ts`

- [ ] **Step 1: `PlaylistMeta`에 share_id 필드 추가**

`web/src/lib/api/playlists.ts`의 `PlaylistMeta` 인터페이스에 `share_id` 추가:

```typescript
export interface PlaylistMeta {
  id: string;
  user_id?: string;
  name: string;
  description: string | null;
  created_at?: string | null;
  track_count?: number;
  share_id?: string | null;
}
```

- [ ] **Step 2: shared 클라이언트 작성**

`web/src/lib/api/shared.ts` 신규:

```typescript
import type { ModalTrack } from "@/components/track/ModalTrackList";

import { apiFetch } from "./http";


export interface SharedPlaylist {
  playlist: {
    id: string;
    name: string;
    description: string | null;
    owner_name: string | null;
    created_at: string | null;
  };
  tracks: ModalTrack[];
}


/** 공개 페이지용 — 무인증 조회. 없는 토큰이면 apiFetch가 throw. */
export async function getShared(shareId: string): Promise<SharedPlaylist> {
  const r = await apiFetch(`/api/shared/${shareId}`, {}, "shared");
  return (await r.json()) as SharedPlaylist;
}


/** 공유 토글 (소유자). enabled=true면 share_id 발급, false면 null. */
export async function togglePlaylistShare(
  playlistId: string,
  enabled: boolean,
): Promise<{ share_id: string | null; share_url: string | null }> {
  const r = await apiFetch(
    `/api/user/playlists/${playlistId}/share`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    },
    "share",
  );
  return r.json();
}
```

- [ ] **Step 3: 타입체크 + lint**

Run: `cd web && npx tsc --noEmit && pnpm lint`
Expected: 에러 없음. (tsc 스크립트가 없으면 `npx tsc --noEmit -p tsconfig.json` 사용. 그래도 안 되면 `pnpm build`로 대체 — TS 에러는 build에서 잡힘.)

- [ ] **Step 4: Commit**

```bash
git add web/src/lib/api/shared.ts web/src/lib/api/playlists.ts
git commit -m "feat(share): 프론트 shared 클라(getShared/togglePlaylistShare) + PlaylistMeta.share_id"
```

---

### Task 6: 프론트 — "공유" 버튼 + 플레이리스트 상세 모달 연결

**Files:**
- Create: `web/src/components/playlist/SharePlaylistButton.tsx`
- Modify: `web/src/components/playlist/PlaylistDetailModal.tsx`

- [ ] **Step 1: SharePlaylistButton 작성**

`web/src/components/playlist/SharePlaylistButton.tsx` 신규:

```typescript
"use client";

import { useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { togglePlaylistShare } from "@/lib/api/shared";


interface Props {
  playlistId: string;
  initialShareId: string | null;
}


export function SharePlaylistButton({ playlistId, initialShareId }: Props) {
  const [shareId, setShareId] = useState<string | null>(initialShareId);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareUrl = shareId
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/p/${shareId}`
    : null;

  const enable = async () => {
    setBusy(true);
    try {
      const { share_id } = await togglePlaylistShare(playlistId, true);
      setShareId(share_id);
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      await togglePlaylistShare(playlistId, false);
      setShareId(null);
      setCopied(false);
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (!shareId) {
    return (
      <Button onClick={enable} disabled={busy} variant="outline" size="sm">
        <Share2 className="h-4 w-4 mr-1" /> 공유
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        readOnly
        value={shareUrl ?? ""}
        onFocus={(e) => e.currentTarget.select()}
        className="flex-1 min-w-0 bg-(--mrms-paper) border border-(--mrms-ink) px-2 py-1 font-mono text-[11px] text-(--mrms-ink)"
      />
      <Button onClick={copy} variant="outline" size="sm" aria-label="링크 복사">
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </Button>
      <Button onClick={disable} disabled={busy} variant="ghost" size="sm">
        공유 해제
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: 상세 모달에 버튼 연결**

`web/src/components/playlist/PlaylistDetailModal.tsx`의 import에 추가:

```typescript
import { SharePlaylistButton } from "@/components/playlist/SharePlaylistButton";
```

`</DialogHeader>` 다음 줄, `<div className="overflow-y-auto ...">` 앞에 공유 영역 삽입:

```tsx
        </DialogHeader>
        {playlist && (
          <div className="px-1 pb-3">
            <SharePlaylistButton
              playlistId={playlist.id}
              initialShareId={playlist.share_id ?? null}
            />
          </div>
        )}
        <div className="overflow-y-auto -mx-6 px-6">
```

- [ ] **Step 3: 타입체크 + lint**

Run: `cd web && npx tsc --noEmit && pnpm lint`
Expected: 에러 없음.

- [ ] **Step 4: Commit**

```bash
git add web/src/components/playlist/SharePlaylistButton.tsx web/src/components/playlist/PlaylistDetailModal.tsx
git commit -m "feat(share): 플레이리스트 상세 모달 '공유' 버튼 (링크 생성·복사·해제)"
```

---

### Task 7: 프론트 — 공개 페이지 `/p/[shareId]` + 레이아웃 + 연결 CTA

**Files:**
- Create: `web/src/components/player/ConnectToPlay.tsx`
- Create: `web/src/app/p/layout.tsx`
- Create: `web/src/app/p/[shareId]/page.tsx`

- [ ] **Step 1: 연결 CTA 컴포넌트 작성**

`web/src/components/player/ConnectToPlay.tsx` 신규 (login 페이지의 OAuth 연결 메커니즘 재사용):

```typescript
"use client";

import { useState } from "react";

import { TidalConnectModal } from "@/components/auth/TidalConnectModal";
import { Button } from "@/components/ui/button";


/** 미연결 방문자에게 재생을 위한 플랫폼 연결을 유도 (= 우리 OAuth = 사이트 세션). */
export function ConnectToPlay() {
  const [tidalOpen, setTidalOpen] = useState(false);
  return (
    <div className="border border-(--mrms-ink) bg-(--mrms-paper) p-4">
      <div className="font-mono text-[11px] tracking-editorial uppercase text-(--mrms-ink-mute)">
        재생하려면 연결하세요
      </div>
      <p className="mt-1 text-(--mrms-ink-soft) text-sm">
        본인 Spotify 또는 Tidal 계정으로 MRMS에서 바로 들으세요.
      </p>
      <div className="mt-3 flex gap-2">
        <Button onClick={() => setTidalOpen(true)} size="sm">
          Tidal로 연결
        </Button>
        <Button
          onClick={() => (window.location.href = "/api/auth/spotify/authorize")}
          variant="outline"
          size="sm"
        >
          Spotify로 연결
        </Button>
      </div>
      <TidalConnectModal open={tidalOpen} onOpenChange={setTidalOpen} />
    </div>
  );
}
```

- [ ] **Step 2: 공개 레이아웃 작성**

`web/src/app/p/layout.tsx` 신규 (`(dashboard)` 밖 — 사이드바·게이트 없음, MRMS 브랜딩 + 플레이어):

```typescript
import Link from "next/link";

import { PlayerBar } from "@/components/player/PlayerBar";


export default function PublicShareLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-(--mrms-bg) flex flex-col">
      <header className="border-b border-(--mrms-ink) px-4 md:px-14 py-3 flex items-center justify-between">
        <Link
          href="/"
          className="font-display font-bold text-(--mrms-ink) text-[18px]"
        >
          MRMS
        </Link>
        <span className="font-mono text-[10px] tracking-editorial uppercase text-(--mrms-ink-mute)">
          Listening on MRMS
        </span>
      </header>
      <main className="flex-1 pb-32 md:pb-36">{children}</main>
      <PlayerBar />
    </div>
  );
}
```

- [ ] **Step 3: 공개 페이지 작성**

`web/src/app/p/[shareId]/page.tsx` 신규:

```typescript
"use client";

import { use, useEffect, useState } from "react";

import { ConnectToPlay } from "@/components/player/ConnectToPlay";
import { ModalTrackList, PlayAllButton } from "@/components/track/ModalTrackList";
import { useUser } from "@/lib/hooks/use-user";
import { getShared, type SharedPlaylist } from "@/lib/api/shared";


function CenteredNote({ text }: { text: string }) {
  return (
    <div className="py-20 text-center font-mono text-[11px] tracking-editorial uppercase text-(--mrms-ink-mute)">
      {text}
    </div>
  );
}


export default function SharedPlaylistPage({
  params,
}: {
  params: Promise<{ shareId: string }>;
}) {
  const { shareId } = use(params);
  const { user } = useUser();
  const [data, setData] = useState<SharedPlaylist | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getShared(shareId)
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [shareId]);

  const connected = !!user?.primary_platform;

  if (loading) return <CenteredNote text="Loading…" />;
  if (error || !data) return <CenteredNote text="공유가 없거나 해제된 링크입니다" />;

  return (
    <div className="mx-auto max-w-[760px] px-4 md:px-0 py-8">
      <div className="font-mono text-[11px] tracking-editorial uppercase text-(--mrms-ink-mute)">
        Shared Playlist
        {data.playlist.owner_name ? ` · ${data.playlist.owner_name}` : ""}
      </div>
      <h1 className="font-display font-bold text-(--mrms-ink) text-[28px] md:text-[34px] leading-[1.1] mt-1">
        {data.playlist.name}
      </h1>
      {data.playlist.description && (
        <p className="mt-2 text-(--mrms-ink-soft) text-sm">
          {data.playlist.description}
        </p>
      )}

      <div className="mt-4">
        {connected ? <PlayAllButton tracks={data.tracks} /> : <ConnectToPlay />}
      </div>

      <div className="mt-6">
        <ModalTrackList tracks={data.tracks} />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 타입체크 + lint**

Run: `cd web && npx tsc --noEmit && pnpm lint`
Expected: 에러 없음.

- [ ] **Step 5: 빌드로 라우트 생성 확인**

Run: `cd web && pnpm build 2>&1 | grep -E "/p/\[shareId\]|Compiled|error"`
Expected: `/p/[shareId]` 라우트가 빌드 출력에 나타나고 컴파일 에러 없음.

- [ ] **Step 6: Commit**

```bash
git add web/src/components/player/ConnectToPlay.tsx web/src/app/p/layout.tsx "web/src/app/p/[shareId]/page.tsx"
git commit -m "feat(share): 공개 페이지 /p/[shareId] (브랜딩+player+리스트) + 연결 CTA"
```

---

## 수동 검증 (전체 완료 후)

자동 테스트로 못 잡는 종단 흐름 — 구현 완료 후 dev에서 1회 확인(또는 배포 후 prod):

1. 로그인 → 내 플레이리스트 상세 모달 → "공유" → 링크 생성·복사.
2. 시크릿 창(미인증)에서 `/p/{token}` 열기 → 리스트 보임 + "재생하려면 연결" CTA.
3. 같은 창에서 Spotify/Tidal 연결 → 돌아와 재생 동작(본인 구독).
4. "공유 해제" 후 `/p/{token}` 재방문 → "공유가 없거나 해제된 링크".

---

## Self-Review (작성자 체크 결과)

**Spec coverage:** shareId 토큰(Task 1·2), set/get 헬퍼(Task 2), 소유자 토글 엔드포인트+403(Task 3), 무인증 공개 조회+404(Task 4), 프론트 클라(Task 5), 공유 버튼(Task 6), 공개 페이지+레이아웃+연결 CTA(Task 7) — spec의 백엔드/프론트/인증/에러 항목 모두 태스크에 매핑됨. 좋아요/담기·PGT/MRT·조회수는 spec에서 명시적 후속(YAGNI) — 계획 제외 일치.

**Placeholder scan:** 모든 코드 스텝에 실제 코드·명령·기대 출력 포함. TBD/TODO 없음.

**Type consistency:** `set_playlist_share(conn, id, on)→str|None`, `get_playlist_by_share_id(conn, share_id)→dict|None`(키: id/name/description/created_at/owner_name), `get_playlist`에 `share_id` 추가 — Task 2 정의와 Task 3·4·5·6 사용처 일치. 프론트 `share_id`(snake)·`togglePlaylistShare`·`getShared`·`SharedPlaylist`·`ModalTrack`·`PlayAllButton`·`useUser().user.primary_platform` 모두 기존 export와 정합.
