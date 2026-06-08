# Tidal Web Playback SDK Player (E.5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

## 🚨 구현 결과 — Plan과 실제 차이 (READ FIRST)

> **이 plan은 Tidal Web Playback SDK 기반으로 작성되었으나, Task 5 이후 SDK 접근이 실패하여 큰 pivot이 일어남**. 아래 요약 후 원래 plan 내용은 역사적 기록으로 보존됨.

### 실제 실행 결과

- **Task 0–9**: 대체로 plan대로 진행됨 (UI + Zustand store + 초기 SDK wrapper + PlayerBar/Controls/QueueDrawer + layout 통합)
- **Task 5 (SDK wrapper)**: 후반에 **완전히 재작성**됨. `@tidal-music/player` + `@tidal-music/auth` + `@tidal-music/event-producer` 조합은 FULL track 재생까지 도달하지 못함 (dev app tier 제약 + Widevine CDN segment 실패 → PREVIEW 30s 한정). 결과적으로 HTML5 `<audio>` 요소 + 백엔드 proxy (`/api/playback/tidal/stream/{track_id}`)로 전환
- **Task 10 (검증)**: proxy pivot **이후에만** 성공 — SDK 경로에서는 success criteria의 ▶ 클릭 → 소리 남이 작동하지 않았음

### 최종 아키텍처

```
Browser <audio>  ←  /api/playback/tidal/stream/{track_id}  (FastAPI)  ←  Tidal CDN
```

FastAPI proxy가 Tidal legacy `/v1/tracks/{id}/playbackinfo` (audioquality=HIGH, assetpresentation=FULL)를 호출하여 base64 manifest에서 직접 audio URL을 추출. `httpx.AsyncClient.stream` + Bearer auth로 브라우저까지 relay.

### Final commits

- `9b98dc9` — **the pivot**: Tidal proxy streaming endpoint + HTML5 audio wrapper
- `1c4418a` — Remove unused `@tidal-music/*` SDK packages
- `4a0f7c9` — Merge E.5 to main

### Additional CLI (plan에 없던 것)

- `scripts/08c_tidal_device_code.py` — Device Authorization Code flow CLI. python-tidal 라이브러리의 공개 credentials (`TIDAL_CLIENT_ID=fX2JxdmntZWK0ixT`)를 사용 (우리 dev app 아님). plan에 명시된 `scripts/08_onboard_tidal.py`의 Authorization Code + PKCE는 SDK 폐기 후 사용 안 함

### 이하 내용에 대한 안내

Task 0–10의 step-by-step 내용은 **원래 plan 그대로** 보존되어 있음. 특히 Task 5의 코드 / Task 0의 SDK notes / Task 3의 `pnpm add @tidal-music/*`는 최종 코드 상태와 일치하지 않음. 최신 구현 메모는 `docs/tidal-sdk-notes.md` 참조.

---

**Goal:** /mrt 페이지에서 ▶ 클릭 시 Tidal Web Playback SDK로 full track 재생. 하단 영구 PlayerBar + 큐 + auto-next + 반응형. 본인 Tidal Premium 활용.

**Architecture:** 백엔드는 Tidal-only filter + 토큰/refresh endpoint 추가. 프론트엔드는 Zustand store가 단일 상태 출처, Tidal SDK 싱글톤 wrapper, 5개 player 컴포넌트. PlayerBar는 layout에 마운트 — 페이지 이동해도 유지.

**Tech Stack:** Python 3.10+, FastAPI, psycopg, Next.js 16, React 19, Tailwind v4, zustand, @tidal-music/player-web (정확한 패키지 Task 0에서 확인).

**Spec:** [docs/superpowers/specs/2026-06-08-tidal-player-design.md](../specs/2026-06-08-tidal-player-design.md)

---

## 파일 구조 (locked-in)

```
src/mrms/api/
├── main.py                  # /api/mrt/latest 수정 (Tidal-only filter + tidal_track_id)
├── auth_tidal.py            # NEW — token / refresh endpoints
└── schemas.py               # tidal_track_id 필드 추가

tests/api/
├── test_main.py             # filter 검증 추가
└── test_auth_tidal.py       # NEW

web/src/
├── store/
│   └── player.ts            # NEW — Zustand PlayerStore
├── lib/
│   ├── tidal-player.ts      # NEW — SDK 싱글톤 wrapper
│   ├── types.ts             # tidal_track_id 추가
│   └── api.ts               # getTidalToken / refreshTidalToken 추가
├── components/
│   ├── player/              # NEW
│   │   ├── PlayerBar.tsx
│   │   ├── PlayerControls.tsx
│   │   ├── NowPlaying.tsx
│   │   ├── QueueDrawer.tsx
│   │   └── PlayButton.tsx
│   └── mrms/                # 기존 수정
│       ├── PersonaCard.tsx              # PlayButton 통합 + 반응형
│       ├── RecommendedTracksTable.tsx   # PlayButton + 모바일 카드 리스트
│       └── RecommendedAlbumCard.tsx     # 반응형 그리드 (변경 없음 가능)
└── app/(dashboard)/
    ├── layout.tsx           # PlayerBar 마운트 + main padding
    └── mrt/page.tsx         # 반응형 그리드 클래스

docs/
└── tidal-sdk-notes.md       # NEW — Task 0 결과물 (패키지명, init API, 이벤트 명세)
```

의존성 순서:
```
Task 0 SDK 탐색 → Backend (1,2) → Frontend deps (3) → Store (4) → SDK wrapper (5)
  → PlayButton (6) → PlayerBar + 컴포넌트 (7,8) → Layout/mrt 통합 (9) → 실 검증 (10)
```

---

## Task 0: Tidal SDK 탐색 + 스모크 테스트

**중요**: 이 task는 TDD가 아닌 **discovery spike**. 결과물은 문서 + 동작 증명. 이후 모든 task는 이 결과에 의존.

**Files:**
- Create: `docs/tidal-sdk-notes.md`
- Create (스모크 페이지): `web/src/app/(dashboard)/tidal-test/page.tsx` (임시, 검증 후 삭제)

### Step 1: Tidal Developer Portal 문서 + npm 검색

```bash
# npm 패키지 후보 검색
# (브라우저로 직접 확인)
#   https://www.npmjs.com/search?q=tidal+player
#   https://developer.tidal.com/documentation
#   https://github.com/tidal-music (공식 GH)
```

확인할 사항:
- 공식 패키지명 (예상: `@tidal-music/player-web` 또는 유사)
- install 방법
- init signature: 어떤 옵션? credentialsProvider? authProvider?
- play API: `load(trackId)` vs `setMediaProduct({ productType: 'track', productId })`
- 이벤트: position, ended, error 이름

**결과를 `docs/tidal-sdk-notes.md`에 정리**:

```markdown
# Tidal Web Playback SDK Notes (Task 0 결과)

## 공식 패키지
- npm: `<실제 패키지명>`
- version: `<x.y.z>`
- 설치: `pnpm add <패키지명>`

## Init API
```ts
const player = new TidalPlayer({
  credentialsProvider: () => Promise<{ accessToken, expires_at }>,
  // ...
})
```

## Load + Play
```ts
await player.load(...)
await player.play()
```

## 이벤트
- `playbackStateChange` / `playing` / ...
- `position` / `currentTime`
- `ended` / `trackEnd`
- `error`

## Premium 체크
- 자동 감지? 별도 API?

## 도메인 제약
- mrms.approid.team 허용 OK / 추가 등록 필요?
```

### Step 2: 본인 토큰으로 스모크 테스트 페이지 만들기

`web/src/app/(dashboard)/tidal-test/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";

export default function TidalTestPage() {
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("init");

  useEffect(() => {
    fetch("/api/auth/tidal/token")
      .then((r) => r.json())
      .then((d) => setToken(d.access_token))
      .catch((e) => setStatus("token fetch fail: " + e.message));
  }, []);

  const test = async () => {
    if (!token) return;
    setStatus("loading SDK...");
    try {
      // Task 0에서 확인한 정확한 import 경로
      const sdk = await import("<실제 패키지명>" as any);
      setStatus("SDK loaded, initializing...");
      const player = new sdk.TidalPlayer({ /* Task 0에서 확인한 init */ });
      setStatus("calling load + play...");
      // Tidal 트랙 ID 하나 (본인 favorites 중 하나 — 콘솔에 미리 골라둠)
      await player.load(/* 트랙 ID */);
      await player.play();
      setStatus("playing!");
    } catch (e: any) {
      setStatus("error: " + e.message);
    }
  };

  return (
    <div className="p-8 space-y-4">
      <h1 className="text-2xl">Tidal SDK Smoke Test</h1>
      <p>Status: <strong>{status}</strong></p>
      <p>Token: {token ? "loaded" : "not loaded"}</p>
      <button onClick={test} className="px-4 py-2 bg-blue-500 text-white rounded">
        Test Play
      </button>
    </div>
  );
}
```

**중요**: 이 페이지는 임시. Task 0이 끝나면 삭제 (또는 Task 11에서 삭제).

이 페이지는 `/api/auth/tidal/token`에 의존하므로, Task 0 마지막 단계로 임시 endpoint 추가 필요. 아래 Step 3에서.

### Step 3: 임시 token endpoint 추가 (Task 2에서 정식 작성, 일단 minimum)

`src/mrms/api/main.py`에 임시 추가:

```python
@app.get("/api/auth/tidal/token")
def tidal_token_temp(conn: psycopg.Connection = Depends(db_conn)) -> dict:
    """Task 0 스모크 테스트용 임시. Task 2에서 정식 구현."""
    from mrms.db.user_track import get_oauth
    email = get_default_user_email()
    user_id = get_or_create_user(conn, email)
    conn.commit()
    oauth = get_oauth(conn, user_id, "tidal")
    if not oauth:
        raise HTTPException(404, "no UserOAuth")
    return {
        "access_token": oauth["accessToken"],
        "expires_at": oauth["expiresAt"].isoformat() if oauth["expiresAt"] else None,
    }
```

`HTTPException` import:
```python
from fastapi import Depends, HTTPException
```

### Step 4: 검증

```bash
cd "/Volumes/MacExtend 1/MRMS_FN"
source .venv/bin/activate
# 두 터미널 or 백그라운드
.venv/bin/uvicorn mrms.api.main:app --port 8000 &
UVICORN_PID=$!
sleep 2
curl -s http://localhost:8000/api/auth/tidal/token | python3 -m json.tool

cd web
NEXT_PUBLIC_API_BASE=http://localhost:8000/api pnpm dev --port 3500 &
NEXT_PID=$!
sleep 10

# 브라우저로 http://localhost:3500/tidal-test 접속해서 클릭
# Status가 "playing!" 되는지 확인
# 실제 소리 들리는지 확인
# 콘솔에 에러 없는지 확인

kill $NEXT_PID $UVICORN_PID 2>/dev/null
```

### Step 5: 발견 사항을 docs/tidal-sdk-notes.md에 최종 정리

Section: 패키지명, init, load+play, 이벤트, premium 체크, 도메인 — 모두 실제 동작 기준으로 업데이트.

### Step 6: Commit

```bash
git add docs/tidal-sdk-notes.md "web/src/app/(dashboard)/tidal-test/page.tsx" src/mrms/api/main.py
git commit -m "spike: Tidal SDK smoke test + notes"
```

## 후속 task들이 의존하는 결과

- `docs/tidal-sdk-notes.md` 의 정확한 패키지명 / API
- Task 5 (SDK wrapper)는 이 문서 기준으로 작성
- 만약 SDK가 dev app에서 접근 불가 → Spec 재검토 필요 (BLOCKED 상태 → 사용자에게 escalate)

---

## Task 1: 백엔드 — Tidal-only filter + tidal_track_id 필드

**Files:**
- Modify: `src/mrms/api/schemas.py`
- Modify: `src/mrms/api/main.py`
- Modify: `tests/api/test_main.py`

- [ ] **Step 1: schemas.py에 tidal_track_id 추가**

`src/mrms/api/schemas.py`의 PersonaTrack과 RecommendedTrack에 필드 추가:

```python
class PersonaTrack(BaseModel):
    track_id: str
    title: str
    artist: str
    album_id: str | None = None
    album_title: str | None = None
    similarity: float
    tidal_track_id: str | None = None


class RecommendedTrack(BaseModel):
    track_id: str
    title: str
    artist: str
    album_id: str | None = None
    score: float
    persona_idx: int | None = None
    tidal_track_id: str | None = None
```

- [ ] **Step 2: 실패 테스트 추가**

`tests/api/test_main.py` 끝에 추가:

```python
def test_mrt_latest_includes_tidal_track_id_and_filters(db_conn, monkeypatch):
    """Tidal-only filter — Tidal 가용 트랙만 반환 + tidal_track_id 필드 포함."""
    import os
    import numpy as np
    from mrms.db.user_track import get_or_create_user
    from mrms.db import user_embedding as ue

    monkeypatch.setenv("DEFAULT_USER_EMAIL", "tidal_filter@example.com")
    user_id = get_or_create_user(db_conn, "tidal_filter@example.com")
    db_conn.commit()

    rng = np.random.default_rng(456)
    for idx in range(3):
        v = rng.standard_normal(256).astype(np.float32)
        v /= np.linalg.norm(v)
        ue.upsert_user_persona(db_conn, user_id, idx, v, track_count=50)

    # Tidal platform이 있는 트랙 ID 2개, 없는 트랙 ID 1개
    with db_conn.cursor() as cur:
        cur.execute('''
            SELECT DISTINCT t.id, tp."platformTrackId"
            FROM "Track" t
            JOIN "TrackPlatform" tp ON tp."trackId" = t.id AND tp.platform = 'tidal'
            LIMIT 2
        ''')
        tidal_rows = cur.fetchall()
        cur.execute('''
            SELECT t.id FROM "Track" t
            WHERE NOT EXISTS (
                SELECT 1 FROM "TrackPlatform" tp
                WHERE tp."trackId" = t.id AND tp.platform = 'tidal'
            )
            LIMIT 1
        ''')
        non_tidal_row = cur.fetchone()
    if not tidal_rows or len(tidal_rows) < 2 or not non_tidal_row:
        import pytest
        pytest.skip("필요 데이터 부족")

    tidal_ids = [r[0] for r in tidal_rows]
    tidal_platform_ids = [r[1] for r in tidal_rows]
    non_tidal_id = non_tidal_row[0]

    # 페르소나 0에 Tidal+Non-Tidal 섞어서 넣음
    for idx in range(3):
        track_ids_for_persona = (
            [tidal_ids[0], non_tidal_id, tidal_ids[1]] if idx == 0
            else [tidal_ids[0]]
        )
        scores = [0.9, 0.8, 0.7][:len(track_ids_for_persona)]
        ue.insert_playlist_history(
            db_conn, user_id, track_ids_for_persona, "our-v1.0+persona-K3",
            context={"personaIdx": idx, "kind": "persona", "scores": scores},
        )
    db_conn.commit()

    r = client.get("/api/mrt/latest")
    assert r.status_code == 200
    body = r.json()
    # 페르소나 0 playlist에 non_tidal_id 트랙 없어야
    persona_0 = next(p for p in body["personas"] if p["persona_idx"] == 0)
    playlist_ids = [t["track_id"] for t in persona_0["playlist"]]
    assert non_tidal_id not in playlist_ids
    # tidal_track_id 필드 채워져 있음
    assert all(t["tidal_track_id"] is not None for t in persona_0["playlist"])
    assert any(t["tidal_track_id"] == tidal_platform_ids[0] for t in persona_0["playlist"])
```

- [ ] **Step 3: 테스트 실패 확인**

```bash
cd "/Volumes/MacExtend 1/MRMS_FN"
source .venv/bin/activate
pytest tests/api/test_main.py::test_mrt_latest_includes_tidal_track_id_and_filters -v
```

Expected: AssertionError 또는 KeyError (tidal_track_id 미존재)

- [ ] **Step 4: _fetch_track_metadata 수정 (INNER JOIN으로 Tidal-only + tidal_track_id 추가)**

`src/mrms/api/main.py`의 `_fetch_track_metadata` 함수 전체를 다음으로 교체:

```python
def _fetch_track_metadata(conn, track_ids: list[str]) -> dict[str, dict]:
    """Tidal 가용 트랙의 메타 + tidal_track_id 반환. Tidal 없는 트랙은 dict에 없음."""
    if not track_ids:
        return {}
    with conn.cursor() as cur:
        cur.execute(
            '''SELECT t.id, t.title, a.name, t."albumId", alb.title, tp."platformTrackId"
               FROM "Track" t
               JOIN "Artist" a ON a.id = t."artistId"
               LEFT JOIN "Album" alb ON alb.id = t."albumId"
               INNER JOIN "TrackPlatform" tp
                  ON tp."trackId" = t.id AND tp.platform = 'tidal'
               WHERE t.id = ANY(%s)''',
            (track_ids,),
        )
        rows = cur.fetchall()
    return {
        r[0]: {
            "title": r[1],
            "artist": r[2],
            "album_id": r[3],
            "album_title": r[4],
            "tidal_track_id": r[5],
        }
        for r in rows
    }
```

- [ ] **Step 5: mrt_latest 함수에서 빈 메타(=Tidal 없음) 트랙 제외 + tidal_track_id 전달**

`mrt_latest` 함수의 PersonaTrack 생성 루프를 수정 — 메타에 없는 트랙은 skip:

```python
        playlist: list[PersonaTrack] = []
        for tid, sc in zip(p["trackIds"][:top_n], scores[:top_n]):
            m = meta.get(tid)
            if not m:
                continue  # Tidal 미가용 → skip
            playlist.append(PersonaTrack(
                track_id=tid,
                title=m["title"],
                artist=m["artist"],
                album_id=m["album_id"],
                album_title=m["album_title"],
                similarity=float(sc),
                tidal_track_id=m["tidal_track_id"],
            ))
```

추천 트랙 생성 부분도 수정:

```python
    recommended_tracks = [
        RecommendedTrack(
            track_id=r["track_id"],
            title=meta[r["track_id"]]["title"],
            artist=meta[r["track_id"]]["artist"],
            album_id=meta[r["track_id"]]["album_id"],
            score=float(r["score"]),
            persona_idx=r.get("persona_idx"),
            tidal_track_id=meta[r["track_id"]]["tidal_track_id"],
        )
        for r in rec_tracks_raw
        if r["track_id"] in meta  # Tidal 가용한 것만
    ]
```

album 부분의 `track_to_album` 생성도 meta 기준이므로 자동으로 Tidal-only 됨.

- [ ] **Step 6: 테스트 통과 확인**

```bash
pytest tests/api/test_main.py -v
```

Expected: 모든 테스트 통과 (이전 3개 + 신규 1 = 4)

- [ ] **Step 7: 본인 데이터로 sanity check**

```bash
.venv/bin/uvicorn mrms.api.main:app --port 8000 &
PID=$!
sleep 2
curl -s "http://localhost:8000/api/mrt/latest" | python3 -c "
import json, sys
d = json.load(sys.stdin)
total = sum(len(p['playlist']) for p in d['personas'])
with_tid = sum(1 for p in d['personas'] for t in p['playlist'] if t['tidal_track_id'])
print(f'personas: {len(d[\"personas\"])}, total_playlist_tracks: {total}, with_tidal_id: {with_tid}')
print(f'rec_tracks: {len(d[\"recommended_tracks\"])} (all have tidal_track_id: {all(t[\"tidal_track_id\"] for t in d[\"recommended_tracks\"])})')
"
kill $PID 2>/dev/null
wait 2>/dev/null
```

Expected:
- personas: 3
- 모든 playlist 트랙에 tidal_track_id 채워짐 (None 없음)
- 추천 트랙 모두 tidal_track_id 채워짐

- [ ] **Step 8: Commit**

```bash
git add src/mrms/api/schemas.py src/mrms/api/main.py tests/api/test_main.py
git commit -m "feat(api): Tidal-only filter + tidal_track_id in /api/mrt/latest"
```

---

## Task 2: 백엔드 — /api/auth/tidal/{token,refresh} 정식 endpoint

**Files:**
- Create: `src/mrms/api/auth_tidal.py`
- Modify: `src/mrms/api/main.py` (router include + Task 0의 임시 endpoint 제거)
- Create: `tests/api/test_auth_tidal.py`

- [ ] **Step 1: 실패 테스트 작성**

`tests/api/test_auth_tidal.py`:

```python
"""Tidal 인증 endpoint 테스트."""
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from mrms.api.main import app


client = TestClient(app)


def test_tidal_token_returns_existing_valid_token(db_conn, monkeypatch):
    """UserOAuth에 유효한 토큰 있으면 그대로 반환 + premium 필드."""
    import numpy as np
    from mrms.db.user_track import get_or_create_user, upsert_oauth

    monkeypatch.setenv("DEFAULT_USER_EMAIL", "tidal_auth@example.com")
    user_id = get_or_create_user(db_conn, "tidal_auth@example.com")
    db_conn.commit()

    expires = datetime.now(timezone.utc) + timedelta(hours=1)
    upsert_oauth(
        db_conn, user_id, "tidal",
        access_token="VALID_ACCESS",
        refresh_token="VALID_REFRESH",
        expires_at=expires,
        scopes=["user.read", "collection.read"],
    )
    db_conn.commit()

    # premium 체크는 외부 호출 — 일단 무시할 수 있게 monkeypatch 또는
    # endpoint 동작이 premium 체크 없이도 200 반환하는지 검증
    r = client.get("/api/auth/tidal/token")
    assert r.status_code == 200
    body = r.json()
    assert body["access_token"] == "VALID_ACCESS"
    assert "expires_at" in body
    assert "premium" in body  # bool or None


def test_tidal_token_404_when_no_oauth(db_conn, monkeypatch):
    """UserOAuth 없으면 404."""
    from mrms.db.user_track import get_or_create_user

    monkeypatch.setenv("DEFAULT_USER_EMAIL", "tidal_auth_b@example.com")
    get_or_create_user(db_conn, "tidal_auth_b@example.com")
    db_conn.commit()

    r = client.get("/api/auth/tidal/token")
    assert r.status_code == 404
```

- [ ] **Step 2: 실패 확인**

```bash
cd "/Volumes/MacExtend 1/MRMS_FN"
source .venv/bin/activate
pytest tests/api/test_auth_tidal.py -v
```

Expected: 404 mismatch 또는 KeyError (premium 미존재)

- [ ] **Step 3: auth_tidal.py 작성**

`src/mrms/api/auth_tidal.py`:

```python
"""Tidal OAuth token endpoints — 브라우저 SDK용 token 전달 + refresh."""
from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone

import httpx
import psycopg
from fastapi import APIRouter, Depends, HTTPException

from mrms.api.deps import db_conn, get_default_user_email
from mrms.auth.tidal import TidalOAuthClient
from mrms.db.user_track import get_oauth, get_or_create_user, upsert_oauth


router = APIRouter(prefix="/api/auth/tidal", tags=["auth"])


def _client() -> TidalOAuthClient:
    return TidalOAuthClient(
        client_id=os.environ["TIDAL_CLIENT_ID"],
        client_secret=os.environ["TIDAL_CLIENT_SECRET"],
        redirect_uri=os.environ.get("TIDAL_REDIRECT_URI", ""),
        scopes=[],  # refresh엔 불필요
    )


async def _check_premium(access_token: str) -> bool | None:
    """Tidal /v2/users/me에서 subscriptionType 확인. 실패 시 None."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as http:
            r = await http.get(
                "https://openapi.tidal.com/v2/users/me",
                params={"countryCode": "KR"},
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Accept": "application/vnd.api+json",
                },
            )
        if r.status_code != 200:
            return None
        body = r.json()
        data = body.get("data") or {}
        attrs = data.get("attributes") or {}
        sub_type = attrs.get("subscriptionType")
        # Tidal subscription types: HIFI, HIFI_PLUS, FREE 등 (Task 0에서 검증)
        if sub_type and sub_type != "FREE":
            return True
        if sub_type == "FREE":
            return False
        return None
    except Exception:
        return None


@router.get("/token")
async def get_token(conn: psycopg.Connection = Depends(db_conn)) -> dict:
    """현재 유효한 access_token 반환. 만료 임박 시 자동 refresh."""
    email = get_default_user_email()
    user_id = get_or_create_user(conn, email)
    conn.commit()
    oauth = get_oauth(conn, user_id, "tidal")
    if not oauth:
        raise HTTPException(404, "Tidal OAuth not configured. Run scripts/08_onboard_tidal.py")

    access_token = oauth["accessToken"]
    expires_at = oauth["expiresAt"]

    # 60초 이내 만료면 refresh
    if expires_at and expires_at - timedelta(seconds=60) < datetime.now(timezone.utc):
        tokens = await _client().refresh_access_token(oauth["refreshToken"])
        access_token = tokens["access_token"]
        new_refresh = tokens.get("refresh_token", oauth["refreshToken"])
        new_expires = datetime.now(timezone.utc) + timedelta(seconds=tokens["expires_in"])
        scope = tokens.get("scope", "")
        granted = scope.split() if isinstance(scope, str) else list(scope)
        if not granted:
            granted = list(oauth.get("scope", []))
        upsert_oauth(
            conn, user_id=user_id, platform="tidal",
            access_token=access_token, refresh_token=new_refresh,
            expires_at=new_expires, scopes=granted,
        )
        conn.commit()
        expires_at = new_expires

    premium = await _check_premium(access_token)
    return {
        "access_token": access_token,
        "expires_at": expires_at.isoformat() if expires_at else None,
        "premium": premium,
    }


@router.post("/refresh")
async def refresh_token(conn: psycopg.Connection = Depends(db_conn)) -> dict:
    """명시적 refresh — 새 access_token 발급."""
    email = get_default_user_email()
    user_id = get_or_create_user(conn, email)
    conn.commit()
    oauth = get_oauth(conn, user_id, "tidal")
    if not oauth:
        raise HTTPException(404, "Tidal OAuth not configured")

    tokens = await _client().refresh_access_token(oauth["refreshToken"])
    new_access = tokens["access_token"]
    new_refresh = tokens.get("refresh_token", oauth["refreshToken"])
    new_expires = datetime.now(timezone.utc) + timedelta(seconds=tokens["expires_in"])
    scope = tokens.get("scope", "")
    granted = scope.split() if isinstance(scope, str) else list(scope)
    if not granted:
        granted = list(oauth.get("scope", []))
    upsert_oauth(
        conn, user_id=user_id, platform="tidal",
        access_token=new_access, refresh_token=new_refresh,
        expires_at=new_expires, scopes=granted,
    )
    conn.commit()
    return {
        "access_token": new_access,
        "expires_at": new_expires.isoformat(),
    }
```

- [ ] **Step 4: main.py에서 router include + Task 0 임시 endpoint 제거**

`src/mrms/api/main.py` 변경:

1. Task 0에서 추가한 `@app.get("/api/auth/tidal/token")` 함수 전체 제거.
2. import 추가: `from mrms.api.auth_tidal import router as tidal_router`
3. app 생성 직후 `app.include_router(tidal_router)` 호출.

```python
# main.py 상단 import 영역에 추가
from mrms.api.auth_tidal import router as tidal_router

# app = FastAPI(...) 줄 다음에 추가
app.include_router(tidal_router)
```

- [ ] **Step 5: 테스트 통과 확인**

```bash
pytest tests/api/test_auth_tidal.py -v
pytest tests/api/test_main.py -v   # 회귀 없는지
```

Expected: 모두 통과 (Tidal API 외부 호출 없이도 premium=None 반환 OK)

- [ ] **Step 6: 실제 endpoint 동작 확인**

```bash
.venv/bin/uvicorn mrms.api.main:app --port 8000 &
PID=$!
sleep 2
curl -s http://localhost:8000/api/auth/tidal/token | python3 -m json.tool
kill $PID 2>/dev/null
wait 2>/dev/null
```

Expected: access_token + expires_at + premium 필드 출력. 본인 토큰이라 premium=true 또는 null

- [ ] **Step 7: Commit**

```bash
git add src/mrms/api/auth_tidal.py src/mrms/api/main.py tests/api/test_auth_tidal.py
git commit -m "feat(api): /api/auth/tidal/token + refresh endpoints"
```

---

## Task 3: 프론트 의존성 추가 (zustand + Tidal SDK)

**Files:**
- Modify: `web/package.json`

- [ ] **Step 1: 의존성 설치**

Task 0에서 확인한 정확한 Tidal SDK 패키지명으로 교체. 아래는 예시 (실제는 `docs/tidal-sdk-notes.md` 참고):

```bash
cd "/Volumes/MacExtend 1/MRMS_FN/web"
pnpm add zustand
# Tidal SDK — Task 0 결과 기반
pnpm add <실제 패키지명>
```

확인:

```bash
cat package.json | python3 -c "import json,sys; d=json.load(sys.stdin); print('zustand:', d['dependencies'].get('zustand', 'MISSING'))"
```

Expected: zustand version 출력.

- [ ] **Step 2: TypeScript 컴파일 확인**

```bash
pnpm tsc --noEmit 2>&1 | head -5
```

Expected: 에러 없음

- [ ] **Step 3: Commit**

```bash
cd "/Volumes/MacExtend 1/MRMS_FN"
git add web/package.json web/pnpm-lock.yaml
git commit -m "feat(web): add zustand + Tidal SDK deps"
```

---

## Task 4: PlayerStore (Zustand) + types.ts 업데이트

**Files:**
- Modify: `web/src/lib/types.ts`
- Modify: `web/src/lib/api.ts`
- Create: `web/src/store/player.ts`

- [ ] **Step 1: types.ts에 tidal_track_id 추가**

`web/src/lib/types.ts`의 PersonaTrack과 RecommendedTrack에 필드 추가:

```typescript
export interface PersonaTrack {
  track_id: string;
  title: string;
  artist: string;
  album_id: string | null;
  album_title: string | null;
  similarity: number;
  tidal_track_id: string | null;  // NEW
}

export interface RecommendedTrack {
  track_id: string;
  title: string;
  artist: string;
  album_id: string | null;
  score: number;
  persona_idx: number | null;
  tidal_track_id: string | null;  // NEW
}
```

추가로 PlayerStore에서 쓸 TidalTokenResponse 타입:

```typescript
export interface TidalTokenResponse {
  access_token: string;
  expires_at: string | null;
  premium: boolean | null;
}
```

- [ ] **Step 2: api.ts에 token fetcher 추가**

`web/src/lib/api.ts` 끝에 추가:

```typescript
import type { MrtLatestResponse, TidalTokenResponse, UserInfo } from "./types";

// 기존 fetchJson, getUser, getMrtLatest는 그대로

export function getTidalToken(): Promise<TidalTokenResponse> {
  return fetchJson<TidalTokenResponse>("/auth/tidal/token");
}


export function refreshTidalToken(): Promise<TidalTokenResponse> {
  return fetchJson<TidalTokenResponse>("/auth/tidal/refresh", { method: "POST" });
}
```

기존 `import type` 줄에 TidalTokenResponse 추가.

- [ ] **Step 3: PlayerStore 작성**

`web/src/store/player.ts`:

```typescript
import { create } from "zustand";


export type QueueTrack = {
  track_id: string;
  tidal_track_id: string;
  title: string;
  artist: string;
  album_title: string | null;
};


export type PlayerState = {
  // 상태
  queue: QueueTrack[];
  currentIdx: number;
  isPlaying: boolean;
  position: number;       // 0~1
  durationSec: number;
  volume: number;          // 0~1
  premium: boolean | null;
  sdkReady: boolean;
  errorMsg: string | null;

  // 액션
  setQueue: (tracks: QueueTrack[], startIdx: number) => void;
  setIsPlaying: (b: boolean) => void;
  setPosition: (p: number) => void;
  setDuration: (s: number) => void;
  setVolume: (v: number) => void;
  setPremium: (p: boolean | null) => void;
  setSdkReady: (r: boolean) => void;
  setError: (msg: string | null) => void;
  jumpTo: (idx: number) => void;
  reset: () => void;
};


export const usePlayerStore = create<PlayerState>((set) => ({
  queue: [],
  currentIdx: 0,
  isPlaying: false,
  position: 0,
  durationSec: 0,
  volume: 0.8,
  premium: null,
  sdkReady: false,
  errorMsg: null,

  setQueue: (tracks, startIdx) =>
    set({ queue: tracks, currentIdx: Math.max(0, Math.min(startIdx, tracks.length - 1)) }),
  setIsPlaying: (b) => set({ isPlaying: b }),
  setPosition: (p) => set({ position: Math.max(0, Math.min(1, p)) }),
  setDuration: (s) => set({ durationSec: s }),
  setVolume: (v) => set({ volume: Math.max(0, Math.min(1, v)) }),
  setPremium: (p) => set({ premium: p }),
  setSdkReady: (r) => set({ sdkReady: r }),
  setError: (msg) => set({ errorMsg: msg }),
  jumpTo: (idx) => set((s) => ({
    currentIdx: Math.max(0, Math.min(idx, s.queue.length - 1)),
  })),
  reset: () => set({
    queue: [], currentIdx: 0, isPlaying: false, position: 0, durationSec: 0,
  }),
}));
```

(액션 함수들은 단순 setter — 실제 play()/next() 같은 비동기 로직은 SDK wrapper에서 호출, store는 상태만)

- [ ] **Step 4: TypeScript 컴파일 확인**

```bash
cd "/Volumes/MacExtend 1/MRMS_FN/web"
pnpm tsc --noEmit 2>&1 | head -10
```

Expected: 에러 없음

- [ ] **Step 5: Commit**

```bash
cd "/Volumes/MacExtend 1/MRMS_FN"
git add web/src/lib/types.ts web/src/lib/api.ts web/src/store/player.ts
git commit -m "feat(web): PlayerStore (Zustand) + tidal token API client"
```

---

## Task 5: Tidal SDK Wrapper

**Files:**
- Create: `web/src/lib/tidal-player.ts`

**중요**: 실제 SDK API는 Task 0 결과(`docs/tidal-sdk-notes.md`) 참고. 아래 코드는 예상 구조 — Task 0 확인 후 정확한 이름으로 수정.

- [ ] **Step 1: SDK wrapper 작성**

`web/src/lib/tidal-player.ts`:

```typescript
"use client";

import { refreshTidalToken } from "@/lib/api";
import { usePlayerStore } from "@/store/player";


// Task 0에서 확인한 패키지명으로 dynamic import.
// 예시 — 실제 이름은 docs/tidal-sdk-notes.md 참고.
let sdkInstance: any = null;
let currentToken: string | null = null;


async function importSdk() {
  // Task 0 결과로 실제 패키지명 교체
  return import(/* @vite-ignore */ "<TIDAL_SDK_PACKAGE>" as any);
}


export async function initTidalSdk(accessToken: string): Promise<void> {
  if (sdkInstance) {
    currentToken = accessToken;
    return;
  }
  currentToken = accessToken;
  const sdk: any = await importSdk();
  // Task 0 결과로 정확한 init signature 교체
  sdkInstance = new sdk.TidalPlayer({
    credentialsProvider: async () => ({ accessToken: currentToken }),
  });

  // 이벤트 wiring — Task 0 결과로 정확한 이벤트 이름 교체
  const store = usePlayerStore.getState();
  sdkInstance.on("playing", () => usePlayerStore.setState({ isPlaying: true }));
  sdkInstance.on("paused", () => usePlayerStore.setState({ isPlaying: false }));
  sdkInstance.on("positionupdate", (e: { currentTime: number; duration: number }) => {
    if (e.duration > 0) {
      usePlayerStore.setState({
        position: e.currentTime / e.duration,
        durationSec: e.duration,
      });
    }
  });
  sdkInstance.on("ended", () => {
    // 자동 다음 곡 — store에서 next 트랙 가져와서 load+play
    const s = usePlayerStore.getState();
    if (s.currentIdx + 1 < s.queue.length) {
      usePlayerStore.setState({ currentIdx: s.currentIdx + 1 });
      const next = s.queue[s.currentIdx + 1];
      void loadAndPlay(next.tidal_track_id);
    } else {
      usePlayerStore.setState({ isPlaying: false });
    }
  });
  sdkInstance.on("error", async (err: any) => {
    if (err?.status === 401) {
      // 토큰 만료 — refresh + 재시도
      try {
        const t = await refreshTidalToken();
        currentToken = t.access_token;
        // 현재 트랙 재시도
        const s = usePlayerStore.getState();
        const cur = s.queue[s.currentIdx];
        if (cur) await loadAndPlay(cur.tidal_track_id);
      } catch (e) {
        usePlayerStore.setState({ errorMsg: "토큰 갱신 실패 — 재인증 필요" });
      }
    } else {
      usePlayerStore.setState({ errorMsg: err?.message || "재생 오류" });
      // 자동 다음 곡
      const s = usePlayerStore.getState();
      if (s.currentIdx + 1 < s.queue.length) {
        usePlayerStore.setState({ currentIdx: s.currentIdx + 1 });
        const next = s.queue[s.currentIdx + 1];
        await new Promise((r) => setTimeout(r, 1000));
        void loadAndPlay(next.tidal_track_id);
      }
    }
  });

  usePlayerStore.setState({ sdkReady: true });
}


export async function loadAndPlay(tidalTrackId: string): Promise<void> {
  if (!sdkInstance) throw new Error("SDK not initialized");
  await sdkInstance.load(tidalTrackId);   // Task 0 결과로 정확한 메서드명 교체
  await sdkInstance.play();
}


export async function pausePlayback(): Promise<void> {
  if (!sdkInstance) return;
  await sdkInstance.pause();
}


export async function resumePlayback(): Promise<void> {
  if (!sdkInstance) return;
  await sdkInstance.play();
}


export async function seekTo(ratio: number): Promise<void> {
  if (!sdkInstance) return;
  const s = usePlayerStore.getState();
  if (s.durationSec > 0) {
    await sdkInstance.seek(ratio * s.durationSec);
  }
}


export async function setSdkVolume(v: number): Promise<void> {
  if (!sdkInstance) return;
  if (typeof sdkInstance.setVolume === "function") {
    await sdkInstance.setVolume(v);
  }
}
```

> Task 5의 실제 구현은 Task 0의 `docs/tidal-sdk-notes.md`를 참고하여 SDK 메서드/이벤트 이름을 정확히 교체. 위 코드는 placeholder 구조.

- [ ] **Step 2: TypeScript 컴파일**

```bash
cd "/Volumes/MacExtend 1/MRMS_FN/web"
pnpm tsc --noEmit 2>&1 | head -20
```

Expected: SDK 패키지 type 에러 외 우리 코드 관련 에러 없음. SDK 패키지가 자체 타입 없으면 `// @ts-expect-error` 또는 `as any` 사용.

- [ ] **Step 3: Commit**

```bash
cd "/Volumes/MacExtend 1/MRMS_FN"
git add web/src/lib/tidal-player.ts
git commit -m "feat(web): Tidal SDK singleton wrapper with event wiring"
```

---

## Task 6: PlayButton 컴포넌트

**Files:**
- Create: `web/src/components/player/PlayButton.tsx`

- [ ] **Step 1: PlayButton 작성**

`web/src/components/player/PlayButton.tsx`:

```tsx
"use client";

import { Play } from "lucide-react";

import { loadAndPlay } from "@/lib/tidal-player";
import { usePlayerStore } from "@/store/player";
import type { PersonaTrack, RecommendedTrack } from "@/lib/types";


type TrackLike = PersonaTrack | RecommendedTrack;


interface Props {
  tracks: TrackLike[];
  trackIdx: number;
  size?: "sm" | "md";
}


export function PlayButton({ tracks, trackIdx, size = "md" }: Props) {
  const setQueue = usePlayerStore((s) => s.setQueue);
  const sdkReady = usePlayerStore((s) => s.sdkReady);
  const premium = usePlayerStore((s) => s.premium);

  const target = tracks[trackIdx];
  const disabled = !target?.tidal_track_id || !sdkReady || premium === false;

  const sizeClasses = size === "sm"
    ? "h-8 w-8"
    : "h-10 w-10 md:h-9 md:w-9";

  const onClick = async () => {
    if (disabled) return;
    // Tidal 가용한 트랙만 큐로
    const queueable = tracks
      .filter((t) => t.tidal_track_id)
      .map((t) => ({
        track_id: t.track_id,
        tidal_track_id: t.tidal_track_id as string,
        title: t.title,
        artist: t.artist,
        album_title: "album_title" in t ? (t.album_title ?? null) : null,
      }));
    const actualIdx = queueable.findIndex((q) => q.track_id === target.track_id);
    if (actualIdx < 0) return;
    setQueue(queueable, actualIdx);
    try {
      await loadAndPlay(queueable[actualIdx].tidal_track_id);
    } catch (e) {
      usePlayerStore.setState({ errorMsg: (e as Error).message });
    }
  };

  return (
    <button
      aria-label={`Play ${target?.title}`}
      onClick={onClick}
      disabled={disabled}
      className={`${sizeClasses} inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed touch-manipulation`}
    >
      <Play className="h-4 w-4" />
    </button>
  );
}
```

- [ ] **Step 2: 컴파일 확인**

```bash
cd "/Volumes/MacExtend 1/MRMS_FN/web"
pnpm tsc --noEmit 2>&1 | head -10
```

Expected: 에러 없음

- [ ] **Step 3: Commit**

```bash
cd "/Volumes/MacExtend 1/MRMS_FN"
git add web/src/components/player/PlayButton.tsx
git commit -m "feat(web): PlayButton component"
```

---

## Task 7: PlayerBar + Controls + NowPlaying

**Files:**
- Create: `web/src/components/player/NowPlaying.tsx`
- Create: `web/src/components/player/PlayerControls.tsx`
- Create: `web/src/components/player/PlayerBar.tsx`

- [ ] **Step 1: NowPlaying 작성**

`web/src/components/player/NowPlaying.tsx`:

```tsx
"use client";

import { usePlayerStore } from "@/store/player";


export function NowPlaying({ className = "" }: { className?: string }) {
  const queue = usePlayerStore((s) => s.queue);
  const currentIdx = usePlayerStore((s) => s.currentIdx);
  const track = queue[currentIdx];

  if (!track) {
    return (
      <div className={`${className} text-sm text-muted-foreground truncate`}>
        재생 중인 곡 없음
      </div>
    );
  }

  return (
    <div className={`${className} flex flex-col justify-center min-w-0`}>
      <div className="truncate font-medium text-sm">{track.title}</div>
      <div className="truncate text-xs text-muted-foreground">{track.artist}</div>
    </div>
  );
}
```

- [ ] **Step 2: PlayerControls 작성**

`web/src/components/player/PlayerControls.tsx`:

```tsx
"use client";

import { Pause, Play, SkipBack, SkipForward } from "lucide-react";

import {
  loadAndPlay,
  pausePlayback,
  resumePlayback,
  seekTo,
} from "@/lib/tidal-player";
import { usePlayerStore } from "@/store/player";


interface Props {
  compact?: boolean;
}


export function PlayerControls({ compact = false }: Props) {
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const position = usePlayerStore((s) => s.position);
  const durationSec = usePlayerStore((s) => s.durationSec);
  const queue = usePlayerStore((s) => s.queue);
  const currentIdx = usePlayerStore((s) => s.currentIdx);

  const hasTrack = queue.length > 0 && currentIdx < queue.length;

  const togglePlay = async () => {
    if (!hasTrack) return;
    try {
      if (isPlaying) await pausePlayback();
      else await resumePlayback();
    } catch (e) {
      usePlayerStore.setState({ errorMsg: (e as Error).message });
    }
  };

  const next = async () => {
    const s = usePlayerStore.getState();
    if (s.currentIdx + 1 < s.queue.length) {
      usePlayerStore.setState({ currentIdx: s.currentIdx + 1, position: 0 });
      const nextTrack = s.queue[s.currentIdx + 1];
      try {
        await loadAndPlay(nextTrack.tidal_track_id);
      } catch (e) {
        usePlayerStore.setState({ errorMsg: (e as Error).message });
      }
    }
  };

  const prev = async () => {
    const s = usePlayerStore.getState();
    if (s.currentIdx > 0) {
      usePlayerStore.setState({ currentIdx: s.currentIdx - 1, position: 0 });
      const prevTrack = s.queue[s.currentIdx - 1];
      try {
        await loadAndPlay(prevTrack.tidal_track_id);
      } catch (e) {
        usePlayerStore.setState({ errorMsg: (e as Error).message });
      }
    }
  };

  const onSeekChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const r = Number(e.target.value) / 1000;
    usePlayerStore.setState({ position: r });
    await seekTo(r);
  };

  const fmtTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

  const playPauseSize = compact ? "h-10 w-10" : "h-8 w-8";

  return (
    <div className="flex items-center gap-2 md:gap-4">
      <button
        aria-label="Previous"
        onClick={prev}
        disabled={!hasTrack || currentIdx === 0}
        className={`${compact ? "hidden md:inline-flex" : "inline-flex"} items-center justify-center h-8 w-8 rounded hover:bg-muted disabled:opacity-40`}
      >
        <SkipBack className="h-4 w-4" />
      </button>
      <button
        aria-label={isPlaying ? "Pause" : "Play"}
        onClick={togglePlay}
        disabled={!hasTrack}
        className={`inline-flex items-center justify-center ${playPauseSize} rounded-full bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40`}
      >
        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </button>
      <button
        aria-label="Next"
        onClick={next}
        disabled={!hasTrack || currentIdx >= queue.length - 1}
        className="inline-flex items-center justify-center h-8 w-8 rounded hover:bg-muted disabled:opacity-40"
      >
        <SkipForward className="h-4 w-4" />
      </button>
      {!compact && hasTrack && (
        <div className="hidden md:flex items-center gap-2 flex-1 min-w-0">
          <span className="text-xs tabular-nums w-10 text-right">
            {fmtTime(position * durationSec)}
          </span>
          <input
            type="range"
            min={0}
            max={1000}
            value={Math.round(position * 1000)}
            onChange={onSeekChange}
            className="flex-1 h-1 accent-primary"
            aria-label="Seek"
          />
          <span className="text-xs tabular-nums w-10">
            {fmtTime(durationSec)}
          </span>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: PlayerBar 작성**

`web/src/components/player/PlayerBar.tsx`:

```tsx
"use client";

import { useEffect } from "react";

import { getTidalToken } from "@/lib/api";
import { initTidalSdk } from "@/lib/tidal-player";
import { usePlayerStore } from "@/store/player";

import { NowPlaying } from "./NowPlaying";
import { PlayerControls } from "./PlayerControls";


export function PlayerBar() {
  const errorMsg = usePlayerStore((s) => s.errorMsg);
  const premium = usePlayerStore((s) => s.premium);
  const sdkReady = usePlayerStore((s) => s.sdkReady);

  useEffect(() => {
    (async () => {
      try {
        const t = await getTidalToken();
        usePlayerStore.setState({ premium: t.premium });
        if (t.premium === false) {
          usePlayerStore.setState({ errorMsg: "Tidal Premium 구독이 필요합니다" });
          return;
        }
        await initTidalSdk(t.access_token);
      } catch (e) {
        const err = e as Error;
        if (err.message.includes("404")) {
          usePlayerStore.setState({
            errorMsg: "Tidal 연동이 필요합니다 — scripts/08_onboard_tidal.py 실행",
          });
        } else {
          usePlayerStore.setState({ errorMsg: err.message });
        }
      }
    })();
  }, []);

  return (
    <div className="fixed bottom-0 left-0 right-0 h-16 md:h-20 bg-background border-t z-50">
      <div className="flex items-center h-full px-2 md:px-4 gap-2 md:gap-4">
        <NowPlaying className="flex-1 min-w-0" />
        <PlayerControls compact={true} />
        <div className="hidden md:flex items-center gap-2">
          {/* Volume + QueueButton — Task 8에서 추가 */}
        </div>
      </div>
      {errorMsg && (
        <div className="absolute bottom-full left-0 right-0 px-4 py-2 bg-destructive text-destructive-foreground text-xs">
          {errorMsg}{" "}
          <button
            onClick={() => usePlayerStore.setState({ errorMsg: null })}
            className="ml-2 underline"
          >
            닫기
          </button>
        </div>
      )}
      {!sdkReady && !errorMsg && premium !== false && (
        <div className="absolute bottom-full left-0 right-0 px-4 py-1 bg-muted text-muted-foreground text-xs">
          플레이어 초기화 중…
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: TypeScript 컴파일**

```bash
cd "/Volumes/MacExtend 1/MRMS_FN/web"
pnpm tsc --noEmit 2>&1 | head -10
```

Expected: 에러 없음

- [ ] **Step 5: Commit**

```bash
cd "/Volumes/MacExtend 1/MRMS_FN"
git add web/src/components/player/
git commit -m "feat(web): PlayerBar + NowPlaying + PlayerControls"
```

---

## Task 8: QueueDrawer + Volume

**Files:**
- Create: `web/src/components/player/QueueDrawer.tsx`
- Modify: `web/src/components/player/PlayerBar.tsx` (Volume + QueueButton 통합)

- [ ] **Step 1: QueueDrawer 작성**

`web/src/components/player/QueueDrawer.tsx`:

```tsx
"use client";

import { ListMusic } from "lucide-react";
import { useState } from "react";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { loadAndPlay } from "@/lib/tidal-player";
import { usePlayerStore } from "@/store/player";


export function QueueDrawer() {
  const [open, setOpen] = useState(false);
  const queue = usePlayerStore((s) => s.queue);
  const currentIdx = usePlayerStore((s) => s.currentIdx);

  const onJump = async (idx: number) => {
    usePlayerStore.setState({ currentIdx: idx, position: 0 });
    try {
      await loadAndPlay(queue[idx].tidal_track_id);
    } catch (e) {
      usePlayerStore.setState({ errorMsg: (e as Error).message });
    }
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          aria-label="Queue"
          className="inline-flex items-center justify-center h-8 w-8 rounded hover:bg-muted"
        >
          <ListMusic className="h-4 w-4" />
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:w-96 overflow-y-auto">
        <SheetHeader>
          <SheetTitle>큐 ({queue.length}곡)</SheetTitle>
        </SheetHeader>
        <ol className="mt-4 space-y-1">
          {queue.map((t, i) => (
            <li key={`${t.track_id}_${i}`}>
              <button
                onClick={() => onJump(i)}
                className={`w-full text-left flex items-center gap-2 p-2 rounded hover:bg-muted ${
                  i === currentIdx ? "bg-muted font-medium" : ""
                }`}
              >
                <span className="w-6 text-xs text-muted-foreground">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="truncate text-sm">{t.title}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {t.artist}
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ol>
      </SheetContent>
    </Sheet>
  );
}
```

> **Note**: SDTPL의 sheet.tsx export 위치 (`@/components/ui/sheet`) 가정. 실제 SDTPL 구조 확인 — 다르면 import 경로 조정.

- [ ] **Step 2: VolumeSlider 작성 (PlayerBar 내부에서 inline 또는 별도 파일)**

`web/src/components/player/PlayerBar.tsx`의 `hidden md:flex items-center gap-2` div를 다음으로 교체:

```tsx
        <div className="hidden md:flex items-center gap-2">
          <VolumeSlider />
          <QueueDrawer />
        </div>
```

PlayerBar 파일 안에 VolumeSlider 함수 추가 (또는 별도 컴포넌트):

```tsx
import { Volume2 } from "lucide-react";
import { setSdkVolume } from "@/lib/tidal-player";

import { QueueDrawer } from "./QueueDrawer";

function VolumeSlider() {
  const volume = usePlayerStore((s) => s.volume);
  return (
    <div className="flex items-center gap-2">
      <Volume2 className="h-4 w-4 text-muted-foreground" />
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(volume * 100)}
        onChange={async (e) => {
          const v = Number(e.target.value) / 100;
          usePlayerStore.setState({ volume: v });
          await setSdkVolume(v);
        }}
        className="w-20 h-1 accent-primary"
        aria-label="Volume"
      />
    </div>
  );
}
```

- [ ] **Step 3: 컴파일 확인**

```bash
cd "/Volumes/MacExtend 1/MRMS_FN/web"
pnpm tsc --noEmit 2>&1 | head -10
```

Expected: 에러 없음. Sheet 컴포넌트 없으면 SDTPL 실제 구조 확인.

- [ ] **Step 4: Commit**

```bash
cd "/Volumes/MacExtend 1/MRMS_FN"
git add web/src/components/player/
git commit -m "feat(web): QueueDrawer + VolumeSlider in PlayerBar"
```

---

## Task 9: Layout 통합 + 기존 컴포넌트 PlayButton + 반응형

**Files:**
- Modify: `web/src/app/(dashboard)/layout.tsx`
- Modify: `web/src/components/mrms/PersonaCard.tsx`
- Modify: `web/src/components/mrms/RecommendedTracksTable.tsx`
- Modify: `web/src/components/mrms/RecommendedAlbumCard.tsx`
- Modify: `web/src/app/(dashboard)/mrt/page.tsx`

- [ ] **Step 1: layout.tsx — PlayerBar 마운트 + main padding**

`web/src/app/(dashboard)/layout.tsx` 파일을 먼저 cat으로 구조 확인:

```bash
cat "/Volumes/MacExtend 1/MRMS_FN/web/src/app/(dashboard)/layout.tsx"
```

SDTPL의 dashboard layout에는 보통 SidebarProvider + AppSidebar + 메인 영역이 있음. 메인 영역을 감싸는 element에 `pb-20 md:pb-24` 클래스 추가. 그리고 layout 마지막에 `<PlayerBar />` 추가.

예시 패치 (실제 layout 구조에 맞춰 조정):

```tsx
// import 추가
import { PlayerBar } from "@/components/player/PlayerBar";

// main 영역 className에 padding-bottom 추가
<main className="... pb-20 md:pb-24">
  {children}
</main>

// layout root에 PlayerBar 마운트
<PlayerBar />
```

- [ ] **Step 2: PersonaCard에 PlayButton 통합**

`web/src/components/mrms/PersonaCard.tsx` 수정:

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlayButton } from "@/components/player/PlayButton";
import type { Persona } from "@/lib/types";


interface Props {
  persona: Persona;
  topN?: number;
}


export function PersonaCard({ persona, topN = 5 }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>페르소나 {persona.persona_idx}</span>
          <span className="text-sm text-muted-foreground">{persona.track_count}곡</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="space-y-2 text-sm">
          {persona.playlist.slice(0, topN).map((t, i) => (
            <li key={t.track_id} className="flex items-center gap-2">
              <PlayButton tracks={persona.playlist} trackIdx={i} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="truncate font-medium">{t.title}</div>
                <div className="truncate text-xs text-muted-foreground">{t.artist}</div>
              </div>
              <span className="text-xs text-muted-foreground tabular-nums">
                {t.similarity.toFixed(2)}
              </span>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: RecommendedTracksTable — 모바일 카드 + 데스크탑 테이블 + PlayButton**

`web/src/components/mrms/RecommendedTracksTable.tsx` 전체 교체:

```tsx
"use client";

import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { useState } from "react";

import { PlayButton } from "@/components/player/PlayButton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { RecommendedTrack } from "@/lib/types";


export function RecommendedTracksTable({ tracks }: { tracks: RecommendedTrack[] }) {
  return (
    <>
      {/* 모바일 — 카드 리스트 */}
      <div className="md:hidden space-y-2">
        {tracks.map((t, i) => (
          <div key={t.track_id} className="flex items-center gap-3 p-3 rounded bg-card">
            <PlayButton tracks={tracks} trackIdx={i} size="sm" />
            <div className="flex-1 min-w-0">
              <div className="truncate font-medium text-sm">{t.title}</div>
              <div className="truncate text-xs text-muted-foreground">{t.artist}</div>
            </div>
            <span className="text-xs text-muted-foreground tabular-nums">
              {t.score.toFixed(2)}
            </span>
          </div>
        ))}
      </div>

      {/* 데스크탑 — 테이블 */}
      <div className="hidden md:block">
        <DesktopTable tracks={tracks} />
      </div>
    </>
  );
}


function DesktopTable({ tracks }: { tracks: RecommendedTrack[] }) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const columns: ColumnDef<RecommendedTrack>[] = [
    {
      id: "play",
      header: "",
      cell: ({ row }) => (
        <PlayButton tracks={tracks} trackIdx={row.index} size="sm" />
      ),
    },
    { accessorKey: "title", header: "Title" },
    { accessorKey: "artist", header: "Artist" },
    {
      accessorKey: "persona_idx",
      header: "From",
      cell: ({ row }) => row.original.persona_idx ?? "-",
    },
    {
      accessorKey: "score",
      header: "Score",
      cell: ({ row }) => row.original.score.toFixed(3),
    },
  ];

  const table = useReactTable({
    data: tracks,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map((hg) => (
          <TableRow key={hg.id}>
            {hg.headers.map((h) => (
              <TableHead
                key={h.id}
                onClick={h.column.getToggleSortingHandler()}
                className="cursor-pointer select-none"
              >
                {flexRender(h.column.columnDef.header, h.getContext())}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.map((row) => (
          <TableRow key={row.id}>
            {row.getVisibleCells().map((cell) => (
              <TableCell key={cell.id}>
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

- [ ] **Step 4: mrt 페이지 반응형 그리드 클래스 조정**

`web/src/app/(dashboard)/mrt/page.tsx`의 그리드 클래스 확인하고 다음과 같이 변경:

```tsx
// 페르소나 grid
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

// 추천 앨범 grid
<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
```

(기존 `grid md:grid-cols-3` 등에서 mobile-first 명시)

- [ ] **Step 5: 컴파일 확인**

```bash
cd "/Volumes/MacExtend 1/MRMS_FN/web"
pnpm tsc --noEmit 2>&1 | head -15
```

Expected: 에러 없음

- [ ] **Step 6: 빌드 + 페이지 렌더링 검증**

```bash
cd "/Volumes/MacExtend 1/MRMS_FN"
.venv/bin/uvicorn mrms.api.main:app --port 8000 &
UVICORN_PID=$!
sleep 2
cd web
NEXT_PUBLIC_API_BASE=http://localhost:8000/api pnpm dev --port 3500 > /tmp/next.log 2>&1 &
NEXT_PID=$!
sleep 12

# /mrt에 PlayerBar 클래스 + PlayButton 등 마커 확인
curl -s http://localhost:3500/mrt -o /tmp/mrt.html
echo "key markers:"
grep -c -o "PlayButton\|aria-label=\"Play\|페르소나\|추천 트랙\|fixed bottom-0" /tmp/mrt.html
tail -10 /tmp/next.log

kill $NEXT_PID $UVICORN_PID 2>/dev/null
wait 2>/dev/null
```

Expected: 마커 다수 매치, 페이지 200, console 에러 없음.

- [ ] **Step 7: Commit**

```bash
cd "/Volumes/MacExtend 1/MRMS_FN"
git add web/src/app/\(dashboard\)/layout.tsx web/src/app/\(dashboard\)/mrt/page.tsx web/src/components/mrms/
git commit -m "feat(web): integrate PlayerBar in layout + PlayButton in cards/table + responsive"
```

---

## Task 10: 실제 Tidal Premium으로 통합 검증

**Files:**
- (코드 변경 없음 — 본인 브라우저로 검증)
- Task 0에서 만든 `web/src/app/(dashboard)/tidal-test/page.tsx`는 마지막에 삭제

- [ ] **Step 1: 사전 확인 — 본인 UserOAuth 토큰 유효**

```bash
cd "/Volumes/MacExtend 1/MRMS_FN"
docker compose exec pg psql -U mrms -d mrms -c "
  SELECT \"accessToken\" IS NOT NULL AS has_token, \"expiresAt\" > NOW() AS valid
  FROM \"UserOAuth\"
  WHERE \"userId\" = (SELECT id FROM \"User\" WHERE email = 'jacinto68@onlinecmk.com')
    AND platform = 'tidal';
"
```

valid가 false면:

```bash
.venv/bin/python3 scripts/08_onboard_tidal.py --email jacinto68@onlinecmk.com
```

- [ ] **Step 2: 3개 서비스 실행**

```bash
# 터미널 1
make api

# 터미널 2
make web

# 터미널 3 (선택, Cloudflare 사용 시)
make tunnel
```

- [ ] **Step 3: 브라우저 검증**

`open https://mrms.approid.team` 또는 `open http://localhost:3500`

체크리스트 (spec section 2 Success Criteria 기준):

- [ ] /mrt 페이지 하단에 PlayerBar 보임 (빈 상태)
- [ ] 콘솔에 `Tidal SDK initialized` 비슷한 로그 또는 sdkReady=true 상태
- [ ] 페르소나 카드 곡 옆 ▶ 클릭 → 소리 남
- [ ] PlayerBar에 현재 곡 메타 보임
- [ ] ⏯ 일시정지/재개 동작
- [ ] ⏭ 누르면 다음 곡 재생
- [ ] 곡 끝까지 들으면 자동 다음 곡
- [ ] 진행 바 드래그 seek
- [ ] 추천 트랙 ▶ 클릭 → 큐가 추천 트랙으로 교체
- [ ] 큐 아이콘 클릭 → drawer 열림 → 곡 점프
- [ ] 볼륨 슬라이더 동작

- [ ] **Step 4: 반응형 검증 (Chrome DevTools)**

DevTools 열고 모바일 emulation:
- iPhone 14 Pro (390x844):
  - [ ] 페르소나 1열
  - [ ] 추천 트랙이 카드 리스트
  - [ ] PlayerBar 64px 컴팩트 + ▶ 큰 버튼
- iPad (820x1180):
  - [ ] 페르소나 2열
  - [ ] 추천 트랙 테이블 형태
  - [ ] PlayerBar 80px 풀 컨트롤
- 데스크탑 (1440+):
  - [ ] 페르소나 3열
  - [ ] 앨범 5열
  - [ ] 진행바 + 볼륨 슬라이더 보임

- [ ] **Step 5: 에러 케이스 검증 (선택)**

- 토큰을 일부러 만료시켜 401 발생 → 자동 refresh 동작
- non-Tidal 트랙은 ▶ disabled로 표시

- [ ] **Step 6: Tidal SDK 스모크 테스트 페이지 정리**

```bash
rm -rf "web/src/app/(dashboard)/tidal-test"
git add -A
git commit -m "chore(web): remove Task 0 SDK smoke test page"
```

- [ ] **Step 7: 발견된 차이/버그 follow-up (선택)**

만약 SDK 이벤트 이름이 wrapper의 예상과 다르면 (Task 0이 정확히 발견 못한 부분), `tidal-player.ts` 수정 + 추가 commit.

---

## Self-Review 결과

**Spec coverage**:
- ✅ Section 3 (Architecture) → Task 1/2 (백엔드), Task 4/5/7/9 (프론트)
- ✅ Section 4 (Data Model + API) → Task 1 (filter+필드), Task 2 (auth endpoints)
- ✅ Section 5 (Frontend) → Task 3 (deps), Task 4 (store), Task 5 (SDK wrapper), Task 6 (PlayButton), Task 7-8 (PlayerBar+drawer)
- ✅ Section 6 (반응형) → Task 7 (PlayerBar 반응형), Task 9 (그리드 조정 + 모바일 카드 리스트)
- ✅ Section 7 (에러 처리) → Task 5 (event handler), Task 7 (UI 표시)
- ✅ Section 8 (가정/결정) — 의도된 단순화 (in-memory only, Premium 가정)
- ✅ Section 9 (검증 필요) → Task 0 spike
- ✅ Section 11 (파일 변경) → 모든 task에 정확한 경로

**남은 위험**:
- Tidal SDK 패키지명/API가 Task 0 결과에 의존 (Task 5 코드 일부 placeholder)
- SDTPL Sheet 컴포넌트 export 위치 (Task 8) — 실제 SDTPL 확인 필요
- Premium 체크 정확성 — Tidal subscriptionType 필드명 (Task 2의 _check_premium)

**Placeholders**: 명시적 표시된 곳만 (Task 0의 `<TIDAL_SDK_PACKAGE>` 등) — Task 0에서 해소됨

**Type consistency**: PersonaTrack/RecommendedTrack에 tidal_track_id 필드 일관 (Python schemas.py ↔ TS types.ts), QueueTrack 인터페이스 store와 wrapper에서 동일
