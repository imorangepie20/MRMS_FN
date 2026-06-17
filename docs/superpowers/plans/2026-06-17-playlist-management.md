# 플레이리스트 관리 (DnD) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 트랙 감상 가능한 모든 페이지에서 플레이리스트 생성/곡 추가/편집(이름·설명·순서·곡 제거)/삭제를 드래그앤드롭(데스크탑 사이드바) + ＋메뉴(모든 화면) 폴백으로 제공한다.

**Architecture:** 기존 `Playlist`+`PlaylistTrack(position)` 모델 무변경. 백엔드는 `db/playlist.py`에 5개 ops + `api/playlists.py`에 5개 엔드포인트(소유권 체크) 추가, 담기 시 curated `UserTrack` upsert(ADR-002). 프론트는 `dnd-kit`(이미 의존성) 전역 `DndContext`(대시보드 레이아웃) + 트랙 행 grip(useDraggable) → 사이드바 플레이리스트(useDroppable) 드롭, 모든 트랙 행에 `AddToPlaylistMenu`(＋), `usePlaylistStore`(zustand 낙관적) + `sonner` 토스트(이미 root 마운트), PGT 상세에서 인라인 편집(SortableContext reorder/remove/rename/delete).

**Tech Stack:** FastAPI + raw psycopg + pytest(백엔드). Next.js 16 app router + `@dnd-kit/core`+`@dnd-kit/sortable`(이미 설치) + zustand(이미) + sonner(이미, root에 `<Toaster/>`) + base-ui Dialog.

**참고 — 절대 경로:** 루트 `/Volumes/MacExtend 1/MRMS_FN`. 러너 `.venv/bin/pytest`, 린트 `.venv/bin/ruff check`(line-length 100). 프론트 `web/`(`npx tsc --noEmit -p tsconfig.json`, `pnpm build`).

**⚠️ 규칙:** 전체 `pytest tests/` 금지(DB 격리 안 됨) — 대상 파일만. 이 기능은 **외부 호출 없음**(Gemini/Spotify/Tidal 무관) → respx/monkeypatch 불필요. 테스트는 실 Track 데이터로 시드하고 `cleanup` 픽스처로 정리(기존 playlist 테스트는 정리 안 해 누수 — 신규 테스트는 정리한다). `dnd-kit`/`sonner`/`zustand`는 이미 `web/package.json`에 있음(설치 불필요).

**기존 그라운딩(정확):**
- `api/playlists.py`: `router = APIRouter(tags=["playlists"])`, 이미 `main.py`에 등록됨. 엔드포인트 시그니처 `... user_id: str = Depends(get_current_user_id), conn=Depends(db_conn)`. 소유권 패턴: `pl = get_playlist(conn, id); if not pl: 404; if pl["user_id"] != user_id: 403`.
- `db/playlist.py`: imports `from mrms.db.ids import stable_id as _id`, `from mrms.db.user_track import upsert_user_track`, `datetime`. `get_playlist` 반환 `{id,user_id,name,description,created_at,share_id}`. `PlaylistTrack` position 0-base, `ON CONFLICT ("playlistId","trackId") DO NOTHING`.
- `upsert_user_track(conn, user_id, track_id, is_core, source, platform)` — 전부 필수. curated: `is_core=False, source="curated", platform="mrms"`.
- 프론트: `ModalTrack` 인터페이스(track_id/title/artist/...), `lib/api/http.ts apiFetch(input, init, label)`, `lib/api/playlists.ts`(createPlaylist/fetchPlaylistTracks/PlaylistMeta), 사이드바 `web/src/components/layout/app-sidebar.tsx`("use client", `navGroups`, `useUser()`), 대시보드 `web/src/app/(dashboard)/layout.tsx`(AppSidebar/AppHeader/PlayerBar/ArtistIntroModal 마운트), `ui/dialog.tsx`(Dialog/DialogContent/DialogHeader/DialogTitle), `ui/sonner.tsx`(root `<Toaster richColors/>` 마운트됨 → `import { toast } from "sonner"`), `PgtLibrary.tsx`(playlists 탭 + 상세 + 로컬 `TrackList`/`PgtTrackRow`).

---

### Task 1: 백엔드 db ops (`db/playlist.py`)

**Files:**
- Modify: `src/mrms/db/playlist.py` (5개 함수 추가)
- Test: `tests/db/test_playlist.py` (테스트 추가)

- [ ] **Step 1: 실패 테스트 작성** — `tests/db/test_playlist.py` 끝에 추가

```python
# ── 플레이리스트 관리(DnD) 신규 ops ───────────────────────────────
from mrms.db.playlist import (  # noqa: E402  (파일 상단 import에 합쳐도 됨)
    add_tracks_to_playlist,
    create_playlist,
    delete_playlist,
    remove_track_from_playlist,
    reorder_playlist_tracks,
    update_playlist_meta,
)
from mrms.db.user_track import get_or_create_user  # noqa: E402


def _track_ids(db_conn, n):
    with db_conn.cursor() as cur:
        cur.execute('SELECT id FROM "Track" LIMIT %s', (n,))
        return [r[0] for r in cur.fetchall()]


def _seed_user_pl(db_conn, cleanup, name="PL", n=2):
    import uuid as _u
    uid = get_or_create_user(db_conn, f"plops-{_u.uuid4().hex[:8]}@t.com")
    tids = _track_ids(db_conn, n)
    pid = create_playlist(db_conn, user_id=uid, name=name, description=None, track_ids=tids)
    # cleanup은 역순 실행 → 자식(PlaylistTrack/UserTrack) 먼저, 부모(Playlist/User) 나중
    cleanup('DELETE FROM "User" WHERE id = %s', (uid,))
    cleanup('DELETE FROM "Playlist" WHERE "userId" = %s', (uid,))
    cleanup('DELETE FROM "UserTrack" WHERE "userId" = %s', (uid,))
    cleanup('DELETE FROM "PlaylistTrack" WHERE "playlistId" = %s', (pid,))
    return uid, pid, tids


def test_add_tracks_appends_and_skips_dupes(db_conn, cleanup):
    uid, pid, tids = _seed_user_pl(db_conn, cleanup, n=2)
    more = _track_ids(db_conn, 4)  # 처음 2개는 이미 있음(중복), 뒤 2개는 신규
    res = add_tracks_to_playlist(db_conn, pid, more, uid)
    assert res["added"] == 2 and res["skipped"] == 2
    with db_conn.cursor() as cur:
        cur.execute('SELECT COUNT(*) FROM "PlaylistTrack" WHERE "playlistId"=%s', (pid,))
        assert cur.fetchone()[0] == 4  # 2 기존 + 2 신규
        # 신규 곡이 curated UserTrack으로 편입됐는지
        cur.execute('SELECT COUNT(*) FROM "UserTrack" WHERE "userId"=%s', (uid,))
        assert cur.fetchone()[0] >= 4


def test_remove_track(db_conn, cleanup):
    uid, pid, tids = _seed_user_pl(db_conn, cleanup, n=2)
    remove_track_from_playlist(db_conn, pid, tids[0])
    with db_conn.cursor() as cur:
        cur.execute('SELECT "trackId" FROM "PlaylistTrack" WHERE "playlistId"=%s', (pid,))
        remaining = {r[0] for r in cur.fetchall()}
    assert tids[0] not in remaining and tids[1] in remaining


def test_reorder_match_and_mismatch(db_conn, cleanup):
    uid, pid, tids = _seed_user_pl(db_conn, cleanup, n=2)
    ok = reorder_playlist_tracks(db_conn, pid, [tids[1], tids[0]])  # 뒤집기
    assert ok is True
    with db_conn.cursor() as cur:
        cur.execute('SELECT "trackId" FROM "PlaylistTrack" WHERE "playlistId"=%s ORDER BY position', (pid,))
        order = [r[0] for r in cur.fetchall()]
    assert order == [tids[1], tids[0]]
    # 집합 불일치 → False, 변경 없음
    assert reorder_playlist_tracks(db_conn, pid, [tids[0]]) is False


def test_update_meta_and_delete(db_conn, cleanup):
    uid, pid, tids = _seed_user_pl(db_conn, cleanup, n=1)
    update_playlist_meta(db_conn, pid, "새이름", "새설명")
    with db_conn.cursor() as cur:
        cur.execute('SELECT name, description FROM "Playlist" WHERE id=%s', (pid,))
        assert cur.fetchone() == ("새이름", "새설명")
    delete_playlist(db_conn, pid)
    with db_conn.cursor() as cur:
        cur.execute('SELECT COUNT(*) FROM "Playlist" WHERE id=%s', (pid,))
        assert cur.fetchone()[0] == 0
        cur.execute('SELECT COUNT(*) FROM "PlaylistTrack" WHERE "playlistId"=%s', (pid,))
        assert cur.fetchone()[0] == 0
```

- [ ] **Step 2: 실패 확인** — Run: `.venv/bin/pytest tests/db/test_playlist.py -k "add_tracks or remove_track or reorder or update_meta" -v` → FAIL (ImportError: 함수 없음).

- [ ] **Step 3: db ops 구현** — `src/mrms/db/playlist.py` 끝에 추가

```python
def add_tracks_to_playlist(
    conn: psycopg.Connection, playlist_id: str, track_ids: list[str], user_id: str
) -> dict:
    """곡을 끝에 추가(중복 스킵) + curated UserTrack 편입. {added, skipped} 반환."""
    added = 0
    with conn.cursor() as cur:
        cur.execute(
            'SELECT COALESCE(MAX(position), -1) FROM "PlaylistTrack" WHERE "playlistId"=%s',
            (playlist_id,),
        )
        nxt = cur.fetchone()[0] + 1
        for tid in track_ids:
            cur.execute(
                '''INSERT INTO "PlaylistTrack" ("playlistId", "trackId", position)
                   VALUES (%s, %s, %s)
                   ON CONFLICT ("playlistId", "trackId") DO NOTHING''',
                (playlist_id, tid, nxt),
            )
            if cur.rowcount:  # 1=신규 삽입, 0=중복 스킵
                added += 1
                nxt += 1
    # 담은 곡 라이브러리 편입(ADR-002). upsert는 멱등이라 전체 대상에 호출해도 안전.
    for tid in track_ids:
        upsert_user_track(
            conn, user_id, tid, is_core=False, source="curated", platform="mrms"
        )
    conn.commit()
    return {"added": added, "skipped": len(track_ids) - added}


def remove_track_from_playlist(
    conn: psycopg.Connection, playlist_id: str, track_id: str
) -> None:
    """플레이리스트에서 곡 제거. UserTrack은 미변경(다른 플리/좋아요 안전)."""
    with conn.cursor() as cur:
        cur.execute(
            'DELETE FROM "PlaylistTrack" WHERE "playlistId"=%s AND "trackId"=%s',
            (playlist_id, track_id),
        )
    conn.commit()


def reorder_playlist_tracks(
    conn: psycopg.Connection, playlist_id: str, track_ids: list[str]
) -> bool:
    """전달 순서대로 position 재기록. 전달 집합이 기존 집합과 정확히 일치할 때만
    적용(True). 불일치(경합/누락)면 변경 없이 False."""
    with conn.cursor() as cur:
        cur.execute(
            'SELECT "trackId" FROM "PlaylistTrack" WHERE "playlistId"=%s', (playlist_id,)
        )
        existing = [r[0] for r in cur.fetchall()]
        if len(track_ids) != len(existing) or set(track_ids) != set(existing):
            return False
        for pos, tid in enumerate(track_ids):
            cur.execute(
                'UPDATE "PlaylistTrack" SET position=%s WHERE "playlistId"=%s AND "trackId"=%s',
                (pos, playlist_id, tid),
            )
    conn.commit()
    return True


def update_playlist_meta(
    conn: psycopg.Connection, playlist_id: str, name: str, description: str | None
) -> None:
    """이름·설명 수정."""
    with conn.cursor() as cur:
        cur.execute(
            'UPDATE "Playlist" SET name=%s, description=%s WHERE id=%s',
            (name, description, playlist_id),
        )
    conn.commit()


def delete_playlist(conn: psycopg.Connection, playlist_id: str) -> None:
    """플레이리스트 + 그 PlaylistTrack 삭제. UserTrack은 미변경."""
    with conn.cursor() as cur:
        cur.execute('DELETE FROM "PlaylistTrack" WHERE "playlistId"=%s', (playlist_id,))
        cur.execute('DELETE FROM "Playlist" WHERE id=%s', (playlist_id,))
    conn.commit()
```

- [ ] **Step 4: 통과 확인** — Run: `.venv/bin/pytest tests/db/test_playlist.py -k "add_tracks or remove_track or reorder or update_meta" -v` → PASS (4개).

- [ ] **Step 5: lint + Commit**
```bash
.venv/bin/ruff check src/mrms/db/playlist.py tests/db/test_playlist.py
git add src/mrms/db/playlist.py tests/db/test_playlist.py
git commit -m "feat(playlist): db ops — add/remove/reorder/update/delete"
```

---

### Task 2: 백엔드 API 엔드포인트 (`api/playlists.py`)

**Files:**
- Modify: `src/mrms/api/playlists.py` (소유권 헬퍼 + 5 엔드포인트 + 요청 모델 + import)
- Test: `tests/api/test_playlists.py` (테스트 추가)

- [ ] **Step 1: 실패 테스트 작성** — `tests/api/test_playlists.py` 끝에 추가 (`client`, `_pick_track_ids`, `login`은 같은 파일/conftest에 이미 있음)

```python
def _make_pl(db_conn, login, name="PL", n=2):
    user_id, session_id = login()
    tids = _pick_track_ids(db_conn, n)
    client.cookies.set("mrms_session", session_id)
    r = client.post("/api/user/playlists", json={"name": name, "track_ids": tids})
    pid = r.json()["playlist"]["id"]
    return user_id, session_id, pid, tids


def test_add_tracks_endpoint(db_conn, login):
    uid, sid, pid, tids = _make_pl(db_conn, login, n=2)
    more = _pick_track_ids(db_conn, 4)
    r = client.post(f"/api/playlists/{pid}/tracks", json={"track_ids": more})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["added"] == 2 and body["skipped"] == 2
    client.cookies.clear()


def test_remove_track_endpoint(db_conn, login):
    uid, sid, pid, tids = _make_pl(db_conn, login, n=2)
    r = client.delete(f"/api/playlists/{pid}/tracks/{tids[0]}")
    assert r.status_code == 200, r.text
    t = client.get(f"/api/playlists/{pid}/tracks").json()["tracks"]
    assert tids[0] not in [x["track_id"] for x in t]
    client.cookies.clear()


def test_reorder_endpoint_and_mismatch(db_conn, login):
    uid, sid, pid, tids = _make_pl(db_conn, login, n=2)
    r = client.patch(f"/api/playlists/{pid}/tracks/order", json={"track_ids": [tids[1], tids[0]]})
    assert r.status_code == 200, r.text
    order = [x["track_id"] for x in client.get(f"/api/playlists/{pid}/tracks").json()["tracks"]]
    assert order == [tids[1], tids[0]]
    bad = client.patch(f"/api/playlists/{pid}/tracks/order", json={"track_ids": [tids[0]]})
    assert bad.status_code == 400
    client.cookies.clear()


def test_update_and_delete_endpoint(db_conn, login):
    uid, sid, pid, tids = _make_pl(db_conn, login, n=1)
    r = client.patch(f"/api/playlists/{pid}", json={"name": "renamed", "description": "d"})
    assert r.status_code == 200 and r.json()["playlist"]["name"] == "renamed"
    d = client.delete(f"/api/playlists/{pid}")
    assert d.status_code == 200
    assert client.get(f"/api/playlists/{pid}/tracks").status_code == 404
    client.cookies.clear()


def test_ownership_forbidden(db_conn, login):
    uid, sid, pid, tids = _make_pl(db_conn, login, n=1)
    client.cookies.clear()
    _, other_sid = login("other-owner@test.com")
    client.cookies.set("mrms_session", other_sid)
    r = client.delete(f"/api/playlists/{pid}")
    assert r.status_code == 403
    client.cookies.clear()
```

- [ ] **Step 2: 실패 확인** — Run: `.venv/bin/pytest tests/api/test_playlists.py -k "add_tracks_endpoint or remove_track_endpoint or reorder_endpoint or update_and_delete or ownership_forbidden" -v` → FAIL (404/405, 라우트 없음).

- [ ] **Step 3: 엔드포인트 구현** — `src/mrms/api/playlists.py` 수정

(a) import 블록의 `from mrms.db.playlist import (...)`에 새 함수 추가:
```python
from mrms.db.playlist import (
    add_tracks_to_playlist,
    create_playlist,
    delete_playlist,
    get_playlist,
    get_playlist_tracks,
    list_user_playlists,
    remove_track_from_playlist,
    reorder_playlist_tracks,
    set_playlist_share,
    update_playlist_meta,
)
```

(b) 기존 pydantic 모델 아래에 추가:
```python
class AddTracksRequest(BaseModel):
    track_ids: list[str]


class ReorderRequest(BaseModel):
    track_ids: list[str]


class UpdatePlaylistRequest(BaseModel):
    name: str | None = None
    description: str | None = None


def _require_owned(conn, playlist_id: str, user_id: str) -> dict:
    """소유 플레이리스트 반환. 없으면 404, 타인 소유면 403."""
    pl = get_playlist(conn, playlist_id)
    if not pl:
        raise HTTPException(404, "playlist not found")
    if pl["user_id"] != user_id:
        raise HTTPException(403, "forbidden")
    return pl
```

(c) 파일 끝에 엔드포인트 추가:
```python
@router.post("/api/playlists/{playlist_id}/tracks")
def add_tracks_endpoint(
    playlist_id: str,
    body: AddTracksRequest,
    user_id: str = Depends(get_current_user_id),
    conn=Depends(db_conn),
):
    _require_owned(conn, playlist_id, user_id)
    if not body.track_ids:
        raise HTTPException(400, "track_ids required")
    return add_tracks_to_playlist(conn, playlist_id, body.track_ids, user_id)


@router.delete("/api/playlists/{playlist_id}/tracks/{track_id}")
def remove_track_endpoint(
    playlist_id: str,
    track_id: str,
    user_id: str = Depends(get_current_user_id),
    conn=Depends(db_conn),
):
    _require_owned(conn, playlist_id, user_id)
    remove_track_from_playlist(conn, playlist_id, track_id)
    return {"ok": True}


@router.patch("/api/playlists/{playlist_id}/tracks/order")
def reorder_tracks_endpoint(
    playlist_id: str,
    body: ReorderRequest,
    user_id: str = Depends(get_current_user_id),
    conn=Depends(db_conn),
):
    _require_owned(conn, playlist_id, user_id)
    if not reorder_playlist_tracks(conn, playlist_id, body.track_ids):
        raise HTTPException(400, "track set mismatch")
    return {"ok": True}


@router.patch("/api/playlists/{playlist_id}")
def update_playlist_endpoint(
    playlist_id: str,
    body: UpdatePlaylistRequest,
    user_id: str = Depends(get_current_user_id),
    conn=Depends(db_conn),
):
    pl = _require_owned(conn, playlist_id, user_id)
    name = (body.name if body.name is not None else pl["name"]).strip()
    if not name:
        raise HTTPException(400, "name required")
    description = body.description if body.description is not None else pl["description"]
    update_playlist_meta(conn, playlist_id, name, description)
    return {"playlist": get_playlist(conn, playlist_id)}


@router.delete("/api/playlists/{playlist_id}")
def delete_playlist_endpoint(
    playlist_id: str,
    user_id: str = Depends(get_current_user_id),
    conn=Depends(db_conn),
):
    _require_owned(conn, playlist_id, user_id)
    delete_playlist(conn, playlist_id)
    return {"ok": True}
```
> 라우트 충돌 없음: `DELETE .../tracks/{track_id}`(DELETE)와 `PATCH .../tracks/order`(PATCH)는 메서드가 달라 "order"가 `{track_id}`로 안 잡힘. `PATCH/DELETE .../{playlist_id}`는 기존 `GET .../{playlist_id}/tracks`와 경로·메서드 모두 구분됨.

- [ ] **Step 4: 통과 확인** — Run: `.venv/bin/pytest tests/api/test_playlists.py -k "add_tracks_endpoint or remove_track_endpoint or reorder_endpoint or update_and_delete or ownership_forbidden" -v` → PASS (5개).

- [ ] **Step 5: lint + Commit**
```bash
.venv/bin/ruff check src/mrms/api/playlists.py tests/api/test_playlists.py
git add src/mrms/api/playlists.py tests/api/test_playlists.py
git commit -m "feat(playlist): API — add/remove/reorder/rename/delete (소유권 체크)"
```

---

### Task 3: 프론트 데이터 레이어 — api 클라 + 스토어 + 새 플리 다이얼로그

**Files:**
- Modify: `web/src/lib/api/playlists.ts` (mutation 함수 추가)
- Create: `web/src/store/playlist.ts` (`usePlaylistStore`)
- Create: `web/src/store/new-playlist-dialog.ts` (`useNewPlaylistDialog`)
- Create: `web/src/components/playlist/NewPlaylistDialog.tsx`

- [ ] **Step 1: api 클라 확장** — `web/src/lib/api/playlists.ts` 상단에 `import { apiFetch } from "./http";` 추가 후, 파일 끝에:
```ts
export async function listPlaylists(): Promise<PlaylistMeta[]> {
  const r = await apiFetch("/api/user/playlists", {}, "list playlists");
  return ((await r.json()) as { playlists: PlaylistMeta[] }).playlists;
}

export async function addTracksToPlaylist(
  playlistId: string,
  trackIds: string[],
): Promise<{ added: number; skipped: number }> {
  const r = await apiFetch(
    `/api/playlists/${playlistId}/tracks`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ track_ids: trackIds }),
    },
    "add to playlist",
  );
  return (await r.json()) as { added: number; skipped: number };
}

export async function removeTrackFromPlaylist(
  playlistId: string,
  trackId: string,
): Promise<void> {
  await apiFetch(
    `/api/playlists/${playlistId}/tracks/${trackId}`,
    { method: "DELETE" },
    "remove track",
  );
}

export async function reorderPlaylistTracks(
  playlistId: string,
  trackIds: string[],
): Promise<void> {
  await apiFetch(
    `/api/playlists/${playlistId}/tracks/order`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ track_ids: trackIds }),
    },
    "reorder",
  );
}

export async function updatePlaylist(
  playlistId: string,
  patch: { name?: string; description?: string | null },
): Promise<PlaylistMeta> {
  const r = await apiFetch(
    `/api/playlists/${playlistId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    },
    "update playlist",
  );
  return ((await r.json()) as { playlist: PlaylistMeta }).playlist;
}

export async function deletePlaylist(playlistId: string): Promise<void> {
  await apiFetch(`/api/playlists/${playlistId}`, { method: "DELETE" }, "delete playlist");
}
```

- [ ] **Step 2: `useNewPlaylistDialog` 스토어** — `web/src/store/new-playlist-dialog.ts`
```ts
import { create } from "zustand";

interface NewPlaylistDialogState {
  open: boolean;
  initialTrackIds: string[];
  openDialog: (trackIds?: string[]) => void;
  close: () => void;
}

export const useNewPlaylistDialog = create<NewPlaylistDialogState>((set) => ({
  open: false,
  initialTrackIds: [],
  openDialog: (trackIds = []) => set({ open: true, initialTrackIds: trackIds }),
  close: () => set({ open: false, initialTrackIds: [] }),
}));
```

- [ ] **Step 3: `usePlaylistStore` 스토어** — `web/src/store/playlist.ts`
```ts
import { toast } from "sonner";
import { create } from "zustand";

import {
  addTracksToPlaylist,
  createPlaylist,
  deletePlaylist,
  listPlaylists,
  updatePlaylist,
  type PlaylistMeta,
} from "@/lib/api/playlists";

interface PlaylistState {
  playlists: PlaylistMeta[];
  loaded: boolean;
  load: () => Promise<void>;
  create: (name: string, trackIds?: string[]) => Promise<PlaylistMeta | null>;
  addTrack: (playlistId: string, trackId: string) => Promise<void>;
  rename: (id: string, name: string, description?: string | null) => Promise<void>;
  remove: (id: string) => Promise<void>;
  bumpCount: (id: string, delta: number) => void;
}

export const usePlaylistStore = create<PlaylistState>((set, get) => ({
  playlists: [],
  loaded: false,

  load: async () => {
    try {
      const playlists = await listPlaylists();
      set({ playlists, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },

  create: async (name, trackIds = []) => {
    try {
      const pl = await createPlaylist(name, null, trackIds);
      set((s) => ({
        playlists: [{ ...pl, track_count: trackIds.length }, ...s.playlists],
      }));
      toast.success(`'${name}' 만들었어요`);
      return pl;
    } catch (e) {
      toast.error((e as Error).message);
      return null;
    }
  },

  addTrack: async (playlistId, trackId) => {
    const pl = get().playlists.find((p) => p.id === playlistId);
    const label = pl?.name ?? "플레이리스트";
    try {
      const { added, skipped } = await addTracksToPlaylist(playlistId, [trackId]);
      if (added > 0) {
        get().bumpCount(playlistId, added);
        toast.success(`'${label}'에 추가`);
      } else if (skipped > 0) {
        toast(`이미 '${label}'에 있어요`);
      }
    } catch (e) {
      toast.error((e as Error).message);
    }
  },

  rename: async (id, name, description) => {
    const prev = get().playlists;
    set((s) => ({
      playlists: s.playlists.map((p) =>
        p.id === id ? { ...p, name, description: description ?? p.description } : p,
      ),
    }));
    try {
      await updatePlaylist(id, {
        name,
        ...(description !== undefined ? { description } : {}),
      });
    } catch (e) {
      set({ playlists: prev });
      toast.error((e as Error).message);
    }
  },

  remove: async (id) => {
    const prev = get().playlists;
    set((s) => ({ playlists: s.playlists.filter((p) => p.id !== id) }));
    try {
      await deletePlaylist(id);
      toast.success("삭제됨");
    } catch (e) {
      set({ playlists: prev });
      toast.error((e as Error).message);
    }
  },

  bumpCount: (id, delta) =>
    set((s) => ({
      playlists: s.playlists.map((p) =>
        p.id === id ? { ...p, track_count: (p.track_count ?? 0) + delta } : p,
      ),
    })),
}));
```

- [ ] **Step 4: `NewPlaylistDialog`** — `web/src/components/playlist/NewPlaylistDialog.tsx`
```tsx
"use client";

import { useEffect, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePlaylistStore } from "@/store/playlist";
import { useNewPlaylistDialog } from "@/store/new-playlist-dialog";

export function NewPlaylistDialog() {
  const { open, initialTrackIds, close } = useNewPlaylistDialog();
  const create = usePlaylistStore((s) => s.create);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setName("");
      setBusy(false);
    }
  }, [open]);

  const submit = async () => {
    const n = name.trim();
    if (!n || busy) return;
    setBusy(true);
    const pl = await create(n, initialTrackIds);
    if (pl) close();
    else setBusy(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="bg-(--mrms-paper) border-(--mrms-ink) sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="font-display font-bold text-(--mrms-ink) text-[20px]">
            새 플레이리스트
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 pt-2">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            placeholder="플레이리스트 이름"
            className="border border-(--mrms-rule) bg-transparent px-3 py-2 text-[14px] text-(--mrms-ink) focus:outline-none focus:border-(--mrms-rust)"
          />
          {initialTrackIds.length > 0 && (
            <div className="font-mono text-[10px] tracking-editorial uppercase text-(--mrms-ink-mute)">
              곡 {initialTrackIds.length}개와 함께 생성
            </div>
          )}
          <button
            onClick={submit}
            disabled={!name.trim() || busy}
            className="self-end px-4 py-2 bg-(--mrms-rust) text-(--mrms-paper) font-mono text-[11px] tracking-editorial uppercase border-0 cursor-pointer disabled:opacity-40"
          >
            {busy ? "만드는 중…" : "만들기"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 5: 타입체크** — Run: `cd "/Volumes/MacExtend 1/MRMS_FN/web" && npx tsc --noEmit -p tsconfig.json` → 에러 없음.

- [ ] **Step 6: Commit**
```bash
cd "/Volumes/MacExtend 1/MRMS_FN"
git add web/src/lib/api/playlists.ts web/src/store/playlist.ts web/src/store/new-playlist-dialog.ts web/src/components/playlist/NewPlaylistDialog.tsx
git commit -m "feat(playlist): api 클라 확장 + usePlaylistStore + NewPlaylistDialog"
```

---

### Task 4: ＋메뉴(모든 트랙 행) + 컨텍스트 게이트 + 마운트

**Files:**
- Create: `web/src/components/playlist/playlist-actions-context.ts` (DnD/액션 가용 컨텍스트)
- Create: `web/src/components/playlist/AddToPlaylistMenu.tsx`
- Modify: `web/src/app/(dashboard)/layout.tsx` (Provider value=true + 스토어 load + NewPlaylistDialog 마운트)
- Modify: `web/src/components/track/ModalTrackList.tsx` (행 액션에 ＋메뉴)

- [ ] **Step 1: 액션 가용 컨텍스트** — `web/src/components/playlist/playlist-actions-context.ts`
```ts
"use client";

import { createContext, useContext } from "react";

/** 대시보드(로그인·DndContext 존재) 안에서만 true. 공유 페이지·비대시보드는 false →
 *  플레이리스트 ＋메뉴/드래그 핸들을 렌더하지 않아 안전. */
export const PlaylistActionsContext = createContext(false);
export const usePlaylistActionsEnabled = () => useContext(PlaylistActionsContext);
```

- [ ] **Step 2: `AddToPlaylistMenu`** — `web/src/components/playlist/AddToPlaylistMenu.tsx`
```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";

import { usePlaylistActionsEnabled } from "./playlist-actions-context";
import { usePlaylistStore } from "@/store/playlist";
import { useNewPlaylistDialog } from "@/store/new-playlist-dialog";

export function AddToPlaylistMenu({ trackId }: { trackId: string }) {
  const enabled = usePlaylistActionsEnabled();
  const playlists = usePlaylistStore((s) => s.playlists);
  const addTrack = usePlaylistStore((s) => s.addTrack);
  const openNew = useNewPlaylistDialog((s) => s.openDialog);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  if (!enabled) return null;

  return (
    <div ref={ref} className="relative">
      <button
        aria-label="플레이리스트에 추가"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="bg-transparent border-0 cursor-pointer p-1"
      >
        <Plus className="size-3.5" stroke="var(--mrms-ink-mute)" strokeWidth={1.6} />
      </button>
      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="fixed inset-x-2 bottom-2 z-50 sm:absolute sm:inset-auto sm:right-0 sm:top-7 sm:bottom-auto sm:w-44 border border-(--mrms-ink) bg-(--mrms-paper) shadow-xl max-h-[50vh] overflow-y-auto"
        >
          <button
            onClick={() => {
              openNew([trackId]);
              setOpen(false);
            }}
            className="w-full text-left px-3 py-2 font-mono text-[11px] tracking-editorial uppercase text-(--mrms-rust) border-0 border-b border-(--mrms-rule) bg-transparent cursor-pointer hover:bg-(--mrms-bg)"
          >
            ＋ 새 플레이리스트
          </button>
          {playlists.length === 0 ? (
            <div className="px-3 py-2 font-mono text-[10px] text-(--mrms-ink-mute)">
              플레이리스트 없음
            </div>
          ) : (
            playlists.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  addTrack(p.id, trackId);
                  setOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-[12px] text-(--mrms-ink) border-0 border-b border-(--mrms-rule) last:border-b-0 bg-transparent cursor-pointer hover:bg-(--mrms-bg) truncate"
              >
                {p.name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: 대시보드 레이아웃에 Provider + load + 다이얼로그** — `web/src/app/(dashboard)/layout.tsx` 수정

import 추가:
```tsx
import { useEffect } from "react";
import { PlaylistActionsContext } from "@/components/playlist/playlist-actions-context";
import { NewPlaylistDialog } from "@/components/playlist/NewPlaylistDialog";
import { usePlaylistStore } from "@/store/playlist";
```
컴포넌트 본문 — `useState` 옆에 스토어 load(최초 1회):
```tsx
  const loadPlaylists = usePlaylistStore((s) => s.load);
  useEffect(() => {
    loadPlaylists();
  }, [loadPlaylists]);
```
최상위 `<div className="md:grid ...">`를 `<PlaylistActionsContext.Provider value={true}>`로 감싸고, `<ArtistIntroModal />` 옆에 `<NewPlaylistDialog />` 추가. 예:
```tsx
  return (
    <PlaylistActionsContext.Provider value={true}>
      <div className="md:grid md:grid-cols-[240px_minmax(0,1fr)] min-h-screen bg-[var(--mrms-bg)]">
        {/* ...기존 내용 그대로... */}
        <PlayerBar />
        <ArtistIntroModal />
        <NewPlaylistDialog />
      </div>
    </PlaylistActionsContext.Provider>
  );
```
> (Task 5에서 이 `<div>`를 다시 `DndContext`로 감싼다. 지금은 Provider만.)

- [ ] **Step 4: `ModalTrackList` 행에 ＋메뉴** — `web/src/components/track/ModalTrackList.tsx`

상단 import 추가: `import { AddToPlaylistMenu } from "@/components/playlist/AddToPlaylistMenu";`
`ModalTrackRow`의 액션 버튼 flex(좋아요 Heart + Sparkles 버튼이 있는 컨테이너) **맨 끝, Sparkles 버튼 다음**에 추가:
```tsx
        <AddToPlaylistMenu trackId={track.track_id} />
```
> 이 메뉴 버튼은 `onClick`에서 `stopPropagation`하므로 행의 다른 핸들러와 충돌하지 않는다. `enabled=false`(공유 페이지 등)면 자동으로 null 렌더.

- [ ] **Step 5: 타입체크 + 빌드** — Run:
```bash
cd "/Volumes/MacExtend 1/MRMS_FN/web" && npx tsc --noEmit -p tsconfig.json && pnpm build 2>&1 | grep -E "Compiled successfully|Failed|Error:" | head -1
```
Expected: tsc 에러 없음, `Compiled successfully`.

- [ ] **Step 6: Commit**
```bash
cd "/Volumes/MacExtend 1/MRMS_FN"
git add web/src/components/playlist/playlist-actions-context.ts web/src/components/playlist/AddToPlaylistMenu.tsx "web/src/app/(dashboard)/layout.tsx" web/src/components/track/ModalTrackList.tsx
git commit -m "feat(playlist): 모든 트랙 행에 ＋메뉴 + 액션 컨텍스트 + 레이아웃 마운트"
```

---

### Task 5: 드래그앤드롭 — 트랙 grip + 전역 DndContext + 사이드바 드롭타깃

**Files:**
- Create: `web/src/components/playlist/TrackDragHandle.tsx`
- Create: `web/src/components/playlist/PlaylistDndProvider.tsx`
- Create: `web/src/components/playlist/PlaylistNavSection.tsx`
- Modify: `web/src/app/(dashboard)/layout.tsx` (DndContext provider로 감싸기)
- Modify: `web/src/components/track/ModalTrackList.tsx` (행에 grip)
- Modify: `web/src/components/layout/app-sidebar.tsx` (PlaylistNavSection 삽입)

- [ ] **Step 1: `TrackDragHandle`** — `web/src/components/playlist/TrackDragHandle.tsx`
```tsx
"use client";

import { useDraggable } from "@dnd-kit/core";
import { GripVertical } from "lucide-react";

import { usePlaylistActionsEnabled } from "./playlist-actions-context";

function Grip({ trackId }: { trackId: string }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `track:${trackId}`,
    data: { type: "track", trackId },
  });
  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      aria-label="드래그해서 플레이리스트에 추가"
      onClick={(e) => e.stopPropagation()}
      className={`hidden sm:flex items-center cursor-grab active:cursor-grabbing bg-transparent border-0 p-0 text-(--mrms-ink-mute) touch-none ${
        isDragging ? "opacity-40" : "opacity-0 group-hover:opacity-100"
      } transition-opacity`}
    >
      <GripVertical className="size-3.5" />
    </button>
  );
}

/** DnD 가용(대시보드)에서만 grip 렌더. 비대시보드/공유 페이지엔 DndContext가 없으므로
 *  null(useDraggable 미호출). */
export function TrackDragHandle({ trackId }: { trackId: string }) {
  const enabled = usePlaylistActionsEnabled();
  if (!enabled) return null;
  return <Grip trackId={trackId} />;
}
```

- [ ] **Step 2: `PlaylistDndProvider`** — `web/src/components/playlist/PlaylistDndProvider.tsx`
```tsx
"use client";

import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";

import { usePlaylistStore } from "@/store/playlist";
import { useNewPlaylistDialog } from "@/store/new-playlist-dialog";

export function PlaylistDndProvider({ children }: { children: React.ReactNode }) {
  const addTrack = usePlaylistStore((s) => s.addTrack);
  const openNew = useNewPlaylistDialog((s) => s.openDialog);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const onDragEnd = (e: DragEndEvent) => {
    const trackId = e.active.data.current?.trackId as string | undefined;
    const overId = e.over?.id;
    if (!trackId || overId == null) return;
    if (overId === "playlist-new") {
      openNew([trackId]);
    } else if (typeof overId === "string" && overId.startsWith("playlist:")) {
      addTrack(overId.slice("playlist:".length), trackId);
    }
  };

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      {children}
    </DndContext>
  );
}
```

- [ ] **Step 3: `PlaylistNavSection`(사이드바 드롭타깃)** — `web/src/components/playlist/PlaylistNavSection.tsx`
```tsx
"use client";

import Link from "next/link";
import { useDroppable } from "@dnd-kit/core";

import { usePlaylistStore } from "@/store/playlist";
import { useNewPlaylistDialog } from "@/store/new-playlist-dialog";

function DropRow({
  id,
  children,
  onClick,
}: {
  id: string;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      onClick={onClick}
      className={`px-1 py-1 text-[12px] truncate border-b border-[var(--mrms-rule)]/50 last:border-b-0 cursor-pointer transition-colors ${
        isOver
          ? "bg-[var(--mrms-rust)]/15 outline-dashed outline-1 outline-[var(--mrms-rust)] text-[var(--mrms-rust)]"
          : "text-[var(--mrms-ink)] hover:pl-2"
      }`}
    >
      {children}
    </div>
  );
}

export function PlaylistNavSection() {
  const playlists = usePlaylistStore((s) => s.playlists);
  const openNew = useNewPlaylistDialog((s) => s.openDialog);

  return (
    <div className="mb-5">
      <div className="flex justify-between items-baseline pb-1.5 mb-1.5 border-b border-[var(--mrms-rule)]">
        <span className="font-mono text-[9px] tracking-editorial-wide uppercase text-[var(--mrms-ink-mute)]">
          My Playlists
        </span>
        <span className="font-mono text-[9px] text-[var(--mrms-rust)]">{playlists.length}</span>
      </div>
      <DropRow id="playlist-new" onClick={() => openNew([])}>
        <span className="font-mono text-[11px] tracking-editorial uppercase text-[var(--mrms-rust)]">
          ＋ 새 플레이리스트
        </span>
      </DropRow>
      {playlists.map((p) => (
        <DropRow key={p.id} id={`playlist:${p.id}`}>
          <Link href="/pgt" className="block truncate text-inherit no-underline">
            {p.name}
          </Link>
        </DropRow>
      ))}
    </div>
  );
}
```
> 라우트 `/pgt`가 라이브러리(PGT) 페이지가 아니면 실제 경로로 교체(앱의 PGT 라이브러리 라우트 — `web/src/lib/nav.ts`의 Playlists 항목 href 확인). 드롭 동작은 라우트와 무관.

- [ ] **Step 4: 레이아웃을 DndContext로 감싸기** — `web/src/app/(dashboard)/layout.tsx`

import 추가: `import { PlaylistDndProvider } from "@/components/playlist/PlaylistDndProvider";`
Task 4에서 만든 `<PlaylistActionsContext.Provider value={true}>` 바로 안쪽을 `<PlaylistDndProvider>`로 감싼다:
```tsx
    <PlaylistActionsContext.Provider value={true}>
      <PlaylistDndProvider>
        <div className="md:grid ...">
          {/* ...기존... */}
          <NewPlaylistDialog />
        </div>
      </PlaylistDndProvider>
    </PlaylistActionsContext.Provider>
```

- [ ] **Step 5: `ModalTrackRow`에 grip** — `web/src/components/track/ModalTrackList.tsx`

상단 import: `import { TrackDragHandle } from "@/components/playlist/TrackDragHandle";`
행 컨테이너(첫 컬럼 = 인덱스/play 영역) 안, 인덱스 번호 `<span>` **앞**에 grip 삽입(데스크탑 hover 시 노출):
```tsx
        <TrackDragHandle trackId={track.track_id} />
```
> grip은 `hidden sm:flex` + `group-hover:opacity-100`이라 데스크탑 행 hover에서만 보이고 인덱스/play와 겹치지 않게 같은 컬럼 좌측에 배치. 모바일엔 안 보임(모바일은 ＋메뉴로 담음).

- [ ] **Step 6: 사이드바에 섹션 삽입** — `web/src/components/layout/app-sidebar.tsx`

상단 import: `import { PlaylistNavSection } from "@/components/playlist/PlaylistNavSection";`
스크롤 `<nav>`의 `navGroups.map(...)` 렌더 **끝(닫는 곳 직후, 같은 nav 안)** 에 `{user && <PlaylistNavSection />}` 추가(로그인 시에만). 예:
```tsx
      {navGroups.map((group) => ( /* ...기존... */ ))}
      {user && <PlaylistNavSection />}
```

- [ ] **Step 7: 타입체크 + 빌드** — Run:
```bash
cd "/Volumes/MacExtend 1/MRMS_FN/web" && npx tsc --noEmit -p tsconfig.json && pnpm build 2>&1 | grep -E "Compiled successfully|Failed|Error:" | head -1
```
Expected: tsc 에러 없음, `Compiled successfully`.

> 수동 검증: 데스크탑에서 트랙 행 hover → grip 보임 → 사이드바 플레이리스트로 드래그 → 드롭 시 추가 토스트. "＋ 새 플레이리스트"로 드롭 → 새 플리 다이얼로그(그 곡 포함).

- [ ] **Step 8: Commit**
```bash
cd "/Volumes/MacExtend 1/MRMS_FN"
git add web/src/components/playlist/TrackDragHandle.tsx web/src/components/playlist/PlaylistDndProvider.tsx web/src/components/playlist/PlaylistNavSection.tsx "web/src/app/(dashboard)/layout.tsx" web/src/components/track/ModalTrackList.tsx web/src/components/layout/app-sidebar.tsx
git commit -m "feat(playlist): DnD — 트랙 grip + 전역 DndContext + 사이드바 드롭타깃"
```

---

### Task 6: PGT 상세 편집 — 이름·삭제 + 순서변경(드래그) + 곡 제거

**Files:**
- Modify: `web/src/components/mrms/PgtLibrary.tsx` (상세 헤더 편집/⋯삭제, 로컬 `TrackList`/`PgtTrackRow`를 sortable로)

- [ ] **Step 1: 상세 헤더 — 이름 수정 + ⋯삭제** — `PgtLibrary.tsx` 플레이리스트 상세 마스트헤드(`{selected && ...}` 블록, `selected.kind === "user"`일 때만)

상단 import: `import { usePlaylistStore } from "@/store/playlist";`
상세 컴포넌트 안에서:
```tsx
  const renamePl = usePlaylistStore((s) => s.rename);
  const removePl = usePlaylistStore((s) => s.remove);
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState("");
```
마스트헤드의 제목 `<span>{selected.pl.name}</span>`을, user 플리일 때 더블클릭(또는 ✎)으로 인라인 input 전환:
```tsx
            {selected.kind === "user" && editingName ? (
              <input
                autoFocus
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                onBlur={() => {
                  const n = draftName.trim();
                  if (n && n !== selected.pl.name) renamePl(selected.pl.id, n);
                  setEditingName(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                  if (e.key === "Escape") setEditingName(false);
                }}
                className="flex-1 min-w-0 font-display font-semibold text-[18px] bg-transparent border-b border-(--mrms-rust) focus:outline-none text-(--mrms-ink)"
              />
            ) : (
              <span
                className="flex-1 min-w-0 font-display font-semibold text-[18px] leading-tight truncate"
                onDoubleClick={() => {
                  if (selected.kind === "user") {
                    setDraftName(selected.pl.name);
                    setEditingName(true);
                  }
                }}
              >
                {selected.pl.name}
              </span>
            )}
```
"All Play" 버튼 옆(user 플리일 때)에 삭제 버튼:
```tsx
            {selected.kind === "user" && (
              <button
                onClick={() => {
                  if (confirm(`'${selected.pl.name}' 삭제할까요?`)) {
                    removePl(selected.pl.id);
                    setSelected(null);
                    setTracks([]);
                  }
                }}
                className="shrink-0 bg-transparent border-0 p-1 cursor-pointer text-(--mrms-ink-mute) hover:text-[#d9534f]"
                aria-label="플레이리스트 삭제"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
```
import에 `Trash2` 추가(`lucide-react`).

- [ ] **Step 2: 곡 제거(✕) + 순서변경(드래그) — sortable TrackList**

`PgtLibrary.tsx`의 로컬 `TrackList`/`PgtTrackRow`를 상세(user 플리)에서 sortable로. import 추가:
```tsx
import { DndContext, PointerSensor, useSensor, useSensors, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, X } from "lucide-react";
import { removeTrackFromPlaylist, reorderPlaylistTracks } from "@/lib/api/playlists";
```
상세 블록에서 user 플리일 때 `<TrackList .../>` 대신 편집 가능한 리스트를 렌더(아래 `EditableTrackList`). 같은 파일에 컴포넌트 추가:
```tsx
function EditableTrackList({
  playlistId,
  tracks,
  setTracks,
  onCountDelta,
}: {
  playlistId: string;
  tracks: PgtTrack[];
  setTracks: (t: PgtTrack[]) => void;
  onCountDelta: (d: number) => void;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = tracks.findIndex((t) => t.track_id === active.id);
    const newIdx = tracks.findIndex((t) => t.track_id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const next = arrayMove(tracks, oldIdx, newIdx);
    setTracks(next);
    reorderPlaylistTracks(playlistId, next.map((t) => t.track_id)).catch(() => {
      setTracks(tracks); // 롤백
    });
  };

  const onRemove = (trackId: string) => {
    const prev = tracks;
    setTracks(tracks.filter((t) => t.track_id !== trackId));
    onCountDelta(-1);
    removeTrackFromPlaylist(playlistId, trackId).catch(() => {
      setTracks(prev);
      onCountDelta(1);
    });
  };

  if (!tracks.length) return <Empty />;
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={tracks.map((t) => t.track_id)} strategy={verticalListSortingStrategy}>
        {tracks.map((t) => (
          <SortableTrackRow key={t.track_id} track={t} onRemove={() => onRemove(t.track_id)} />
        ))}
      </SortableContext>
    </DndContext>
  );
}

function SortableTrackRow({ track, onRemove }: { track: PgtTrack; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: track.track_id,
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`group flex items-center gap-2 py-2.5 border-b border-[var(--mrms-rule)] ${isDragging ? "opacity-50 bg-[var(--mrms-paper)]" : ""}`}
    >
      <button
        {...listeners}
        {...attributes}
        aria-label="순서 변경"
        className="cursor-grab active:cursor-grabbing bg-transparent border-0 p-1 text-(--mrms-ink-mute) touch-none"
      >
        <GripVertical className="size-4" />
      </button>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] text-(--mrms-ink) truncate">{track.title}</div>
        <div className="text-[11px] text-(--mrms-ink-soft) truncate">{track.artist}</div>
      </div>
      <button
        onClick={onRemove}
        aria-label="곡 제거"
        className="bg-transparent border-0 p-1 cursor-pointer text-(--mrms-ink-mute) hover:text-[#d9534f] opacity-0 group-hover:opacity-100"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
```
상세 렌더에서 user 플리일 때 교체:
```tsx
    {selected.kind === "user" ? (
      <EditableTrackList
        playlistId={selected.pl.id}
        tracks={tracks}
        setTracks={setTracks}
        onCountDelta={(d) => usePlaylistStore.getState().bumpCount(selected.pl.id, d)}
      />
    ) : (
      <TrackList tracks={tracks} loading={tracksLoading} />
    )}
```
> `tracks`/`setTracks`는 PgtLibrary가 이미 가진 상세 트랙 상태(그대로 사용). imported 플리는 편집 불가(기존 `TrackList` 유지).

- [ ] **Step 3: 타입체크 + 빌드** — Run:
```bash
cd "/Volumes/MacExtend 1/MRMS_FN/web" && npx tsc --noEmit -p tsconfig.json && pnpm build 2>&1 | grep -E "Compiled successfully|Failed|Error:" | head -1
```
Expected: tsc 에러 없음, `Compiled successfully`.

> 수동 검증: PGT 라이브러리 → 내 플레이리스트 상세 → 제목 더블클릭 rename, grip 드래그로 순서변경(새로고침해도 유지), ✕로 곡 제거, ⋯/🗑 삭제(확인) → 목록에서 사라짐.

- [ ] **Step 4: Commit**
```bash
cd "/Volumes/MacExtend 1/MRMS_FN"
git add web/src/components/mrms/PgtLibrary.tsx
git commit -m "feat(playlist): PGT 상세 편집 — rename/삭제 + 드래그 순서변경 + 곡 제거"
```

---

## 수동 검증 (전체 완료 후, dev)

1. **추가(드래그)**: MRT/검색/EMP 트랙 행 hover → grip 드래그 → 사이드바 플레이리스트 드롭 → "추가" 토스트, track_count +1.
2. **추가(＋메뉴)**: 트랙 행 ＋ → 플레이리스트 선택/새로 만들기. 모바일=하단 시트. 중복 곡 → "이미 있어요".
3. **생성**: "＋ 새 플레이리스트" 드롭/메뉴 → 다이얼로그 → 생성, 사이드바·목록 즉시 반영.
4. **편집**: PGT 상세 → 제목 더블클릭 rename, grip로 순서변경(서버 반영), ✕로 곡 제거, 🗑 삭제(확인).
5. **권한**: 로그아웃/공유 페이지(`/p`)엔 grip·＋메뉴 안 보임. 타인 플리 변경 시 403(토스트).

---

## Self-Review

**Spec coverage:** 생성(Task 3 create + NewPlaylistDialog, Task 5 "새" 드롭) / 추가(Task 1·2 add + Task 4 ＋메뉴 + Task 5 드래그) / 편집-이름·설명·순서·제거(Task 1·2 + Task 6) / 삭제(Task 1·2 + Task 6) / 모든 페이지(ModalTrackList 공용 + ＋메뉴) / 사이드바 드롭(A, Task 5) / ＋메뉴 폴백(1, Task 4) / dnd-kit(Task 5·6) / 담기=curated UserTrack(Task 1) / 소유권(Task 2) / 권한 게이트(PlaylistActionsContext, Task 4) — 전부 매핑. 커버 업로드는 스펙대로 범위 밖.

**Placeholder scan:** 모든 스텝 실제 코드/명령/기대출력. 단 (a) `AddToPlaylistMenu`/grip은 컴포넌트 가시성만 컨텍스트로 게이트(로그인 화면 가정), (b) `PlaylistNavSection`의 `/pgt` 라우트는 실제 PGT 라이브러리 경로 확인 후 교체(스텝에 명시), (c) ModalTrackRow grip/＋메뉴 삽입 위치는 "인덱스 span 앞 / 액션 flex 끝"으로 지정. 그 외 placeholder 없음.

**Type consistency:** 백엔드 `add_tracks_to_playlist(conn, playlist_id, track_ids, user_id) -> {added, skipped}` ↔ 엔드포인트 호출·테스트 일치. `reorder_playlist_tracks -> bool` ↔ 엔드포인트 400 매핑 일치. 프론트 `PlaylistMeta`(id/name/description/track_count/share_id) ↔ store/api/사이드바 사용 일치. `usePlaylistStore` 액션명(load/create/addTrack/rename/remove/bumpCount) ↔ 소비처(레이아웃·메뉴·사이드바·PgtLibrary) 일치. DnD payload `data:{type:"track", trackId}` ↔ onDragEnd `active.data.current?.trackId` 일치. droppable id `playlist:{id}`/`playlist-new` ↔ onDragEnd 분기 일치. `addTracksToPlaylist`/`removeTrackFromPlaylist`/`reorderPlaylistTracks`/`updatePlaylist`/`deletePlaylist`/`listPlaylists` 시그니처 ↔ store/PgtLibrary 호출 일치.
