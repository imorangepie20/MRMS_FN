# MRT Web Viewer (E.0+1+2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** FastAPI 백엔드 + Next.js (SDTPL_ADM 포크) 프론트엔드로 브라우저에서 본인 MRT를 시각화. read-only.

**Architecture:** 책임 분리 — FastAPI는 mrms.* 모듈 import해서 HTTP wrap만, Next.js Server Component는 fetch → 렌더. Cloudflare Tunnel path-based ingress로 single origin. CORS 불필요.

**Tech Stack:** Python 3.10+, FastAPI 0.110, uvicorn, psycopg, Next.js 16, React 19, Tailwind v4, shadcn/ui (Base UI), TanStack Table, pnpm.

**Spec:** [docs/superpowers/specs/2026-06-08-mrt-web-viewer-design.md](../specs/2026-06-08-mrt-web-viewer-design.md)

---

## 파일 구조 (locked-in)

```
src/mrms/api/
├── __init__.py
├── main.py                       # FastAPI app + 3 endpoints + lifespan
├── deps.py                       # DB connection (lifespan)
└── schemas.py                    # Pydantic 응답 모델

tests/api/
├── __init__.py
└── test_main.py                  # TestClient 기반 endpoint 테스트

web/                              # SDTPL_ADM 복사 + 커스터마이징
├── src/
│   ├── app/
│   │   ├── page.tsx              # / → redirect /mrt
│   │   └── (dashboard)/mrt/page.tsx   # 메인 페이지
│   ├── components/mrms/
│   │   ├── PersonaCard.tsx
│   │   ├── RecommendedTracksTable.tsx
│   │   └── RecommendedAlbumCard.tsx
│   └── lib/
│       ├── api.ts
│       ├── types.ts
│       └── nav.ts                # SDTPL nav.ts 단순화
├── e2e/mrt-page.spec.ts          # Playwright
├── .env.local.example
└── (나머지 SDTPL_ADM 그대로)

Makefile                          # NEW
docs/cloudflare-tunnel-setup.md   # UPDATE (path-based ingress)
.env.example                      # UPDATE (DEFAULT_USER_EMAIL)
.gitignore                        # UPDATE (web/node_modules, .next, .env.local)
pyproject.toml                    # UPDATE (fastapi, uvicorn)
```

의존성 순서:
```
backend deps → FastAPI skeleton → endpoints → frontend copy → nav/page → components → Makefile/docs → manual verify
```

---

## Task 0: 백엔드 의존성 + tests/api 디렉토리

**Files:**
- Modify: `pyproject.toml`
- Create: `tests/api/__init__.py`
- Modify: `.gitignore`

- [ ] **Step 1: pyproject.toml에 fastapi + uvicorn 추가**

`pyproject.toml`의 `dependencies` 리스트에 추가:

```toml
"fastapi>=0.110",
"uvicorn[standard]>=0.27",
```

`numpy>=1.26` 근처에 두면 정렬 좋음.

- [ ] **Step 2: 의존성 설치**

```bash
cd "/Volumes/MacExtend 1/MRMS_FN"
source .venv/bin/activate
pip install -e ".[dev]"
pip list | grep -E "(fastapi|uvicorn)"
```

Expected:
```
fastapi 0.x.y
uvicorn 0.x.y
```

- [ ] **Step 3: tests/api 디렉토리 + __init__.py**

```bash
mkdir -p tests/api
touch tests/api/__init__.py
```

- [ ] **Step 4: .gitignore 추가 (web/ 관련)**

`.gitignore`에 다음 라인 추가 (파일 끝에):

```
# Frontend (E.0+1+2 web/)
web/node_modules/
web/.next/
web/out/
web/.env.local
web/playwright-report/
web/test-results/
```

- [ ] **Step 5: pytest collect 확인**

```bash
pytest tests/api/ -v
```

Expected: `no tests ran` (디렉토리 OK, 테스트 없음)

- [ ] **Step 6: Commit**

```bash
git add pyproject.toml tests/api/__init__.py .gitignore
git commit -m "test: scaffold api tests + fastapi/uvicorn deps"
```

---

## Task 1: FastAPI skeleton + /api/health

**Files:**
- Create: `src/mrms/api/__init__.py` (empty)
- Create: `src/mrms/api/main.py`
- Create: `tests/api/test_main.py`

- [ ] **Step 1: 실패 테스트 작성**

`src/mrms/api/__init__.py`:

```python
```

(empty)

`tests/api/test_main.py`:

```python
"""FastAPI endpoint 테스트 (TestClient)."""
from fastapi.testclient import TestClient

from mrms.api.main import app


client = TestClient(app)


def test_health():
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd "/Volumes/MacExtend 1/MRMS_FN"
source .venv/bin/activate
pytest tests/api/test_main.py -v
```

Expected: `ImportError: cannot import name 'app'`

- [ ] **Step 3: FastAPI app 작성 (최소)**

`src/mrms/api/main.py`:

```python
"""FastAPI app — MRMS 데이터를 HTTP로 노출."""
from __future__ import annotations

from fastapi import FastAPI


app = FastAPI(title="MRMS API", version="0.1.0")


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
pytest tests/api/test_main.py -v
```

Expected: 1 passed

- [ ] **Step 5: 서버 수동 실행 검증**

```bash
.venv/bin/uvicorn mrms.api.main:app --port 8000 &
UVICORN_PID=$!
sleep 2
curl -s http://localhost:8000/api/health
echo
kill $UVICORN_PID
```

Expected: `{"status":"ok"}`

- [ ] **Step 6: Commit**

```bash
git add src/mrms/api/__init__.py src/mrms/api/main.py tests/api/test_main.py
git commit -m "feat: FastAPI app skeleton + /api/health"
```

---

## Task 2: DB connection deps + /api/user

**Files:**
- Create: `src/mrms/api/deps.py`
- Create: `src/mrms/api/schemas.py`
- Modify: `src/mrms/api/main.py`
- Modify: `tests/api/test_main.py`

- [ ] **Step 1: 실패 테스트 추가**

`tests/api/test_main.py` 끝에 추가:

```python
def test_user_endpoint_returns_default_user(db_conn, monkeypatch):
    """DEFAULT_USER_EMAIL 환경변수의 사용자 정보 반환."""
    import os
    from mrms.db.user_track import get_or_create_user
    from mrms.db import user_embedding as ue

    monkeypatch.setenv("DEFAULT_USER_EMAIL", "test_api@example.com")
    user_id = get_or_create_user(db_conn, "test_api@example.com")
    db_conn.commit()
    # 3 personas
    import numpy as np
    rng = np.random.default_rng(99)
    for idx in range(3):
        v = rng.standard_normal(256).astype(np.float32)
        v /= np.linalg.norm(v)
        ue.upsert_user_persona(db_conn, user_id, idx, v, track_count=100)
    db_conn.commit()

    r = client.get("/api/user")
    assert r.status_code == 200
    body = r.json()
    assert body["email"] == "test_api@example.com"
    assert body["personas_count"] == 3
    assert "user_id" in body
    assert "user_tracks_count" in body  # 0 이상
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
pytest tests/api/test_main.py::test_user_endpoint_returns_default_user -v
```

Expected: 404 (endpoint 미구현)

- [ ] **Step 3: schemas.py 작성**

`src/mrms/api/schemas.py`:

```python
"""FastAPI 응답 Pydantic 모델."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class UserInfo(BaseModel):
    user_id: str
    email: str
    displayName: str | None = None
    country: str | None = None
    personas_count: int
    user_tracks_count: int


class PersonaTrack(BaseModel):
    track_id: str
    title: str
    artist: str
    album_id: str | None = None
    album_title: str | None = None
    similarity: float


class Persona(BaseModel):
    persona_idx: int
    track_count: int
    playlist: list[PersonaTrack]


class RecommendedTrack(BaseModel):
    track_id: str
    title: str
    artist: str
    album_id: str | None = None
    score: float
    persona_idx: int | None = None


class RecommendedAlbum(BaseModel):
    album_id: str
    title: str
    artist: str
    track_count: int


class MrtLatestResponse(BaseModel):
    generated_at: datetime | None = None
    model_version: str | None = None
    personas: list[Persona]
    recommended_tracks: list[RecommendedTrack]
    recommended_albums: list[RecommendedAlbum]
```

- [ ] **Step 4: deps.py 작성**

`src/mrms/api/deps.py`:

```python
"""FastAPI dependency providers — DB connection, settings."""
from __future__ import annotations

import os
from typing import Iterator

import psycopg
from dotenv import load_dotenv
from pgvector.psycopg import register_vector


load_dotenv(override=True)


def get_dsn() -> str:
    return os.environ.get("DATABASE_URL", "postgresql://mrms:mrms@localhost:5433/mrms")


def get_default_user_email() -> str:
    email = os.environ.get("DEFAULT_USER_EMAIL")
    if not email:
        raise RuntimeError("DEFAULT_USER_EMAIL 환경변수 필수")
    return email


def db_conn() -> Iterator[psycopg.Connection]:
    """FastAPI Depends — 요청당 connection."""
    with psycopg.connect(get_dsn(), autocommit=False) as conn:
        register_vector(conn)
        yield conn
```

- [ ] **Step 5: /api/user endpoint 구현**

`src/mrms/api/main.py`에 추가:

```python
from fastapi import Depends, HTTPException

import psycopg

from mrms.api.deps import db_conn, get_default_user_email
from mrms.api.schemas import UserInfo
from mrms.db.user_track import get_or_create_user


@app.get("/api/user", response_model=UserInfo)
def user(conn: psycopg.Connection = Depends(db_conn)) -> UserInfo:
    email = get_default_user_email()
    user_id = get_or_create_user(conn, email)
    conn.commit()
    with conn.cursor() as cur:
        cur.execute(
            'SELECT "displayName", country FROM "User" WHERE id = %s',
            (user_id,),
        )
        row = cur.fetchone()
        display_name, country = (row[0], row[1]) if row else (None, None)

        cur.execute(
            'SELECT COUNT(*) FROM "UserPersona" WHERE "userId" = %s',
            (user_id,),
        )
        personas_count = cur.fetchone()[0]

        cur.execute(
            'SELECT COUNT(*) FROM "UserTrack" WHERE "userId" = %s',
            (user_id,),
        )
        tracks_count = cur.fetchone()[0]

    return UserInfo(
        user_id=user_id,
        email=email,
        displayName=display_name,
        country=country,
        personas_count=personas_count,
        user_tracks_count=tracks_count,
    )
```

- [ ] **Step 6: 테스트 통과 확인**

```bash
pytest tests/api/test_main.py -v
```

Expected: 2 passed

- [ ] **Step 7: Commit**

```bash
git add src/mrms/api/deps.py src/mrms/api/schemas.py src/mrms/api/main.py tests/api/test_main.py
git commit -m "feat: /api/user endpoint with DB deps + pydantic schemas"
```

---

## Task 3: /api/mrt/latest endpoint

**Files:**
- Modify: `src/mrms/api/main.py`
- Modify: `tests/api/test_main.py`

- [ ] **Step 1: 실패 테스트 추가**

`tests/api/test_main.py` 끝에 추가:

```python
def test_mrt_latest_returns_personas_and_derives(db_conn, monkeypatch):
    """MRT latest endpoint — 페르소나 + 추천 트랙/앨범 derive."""
    import os
    import numpy as np
    from mrms.db.user_track import get_or_create_user
    from mrms.db import user_embedding as ue

    monkeypatch.setenv("DEFAULT_USER_EMAIL", "test_mrt@example.com")
    user_id = get_or_create_user(db_conn, "test_mrt@example.com")
    db_conn.commit()

    # 3 personas + 3 playlist history (각 persona 당 1)
    rng = np.random.default_rng(123)
    for idx in range(3):
        v = rng.standard_normal(256).astype(np.float32)
        v /= np.linalg.norm(v)
        ue.upsert_user_persona(db_conn, user_id, idx, v, track_count=50 + idx * 10)

    # 실제 Track id 3개 fetch
    with db_conn.cursor() as cur:
        cur.execute('SELECT id FROM "Track" LIMIT 3')
        track_rows = cur.fetchall()
    if not track_rows or len(track_rows) < 3:
        import pytest
        pytest.skip("Track 데이터 부족")

    track_ids = [r[0] for r in track_rows]
    for idx in range(3):
        ue.insert_playlist_history(
            db_conn, user_id,
            [track_ids[idx]], "our-v1.0+persona-K3",
            context={"personaIdx": idx, "kind": "persona", "scores": [0.9 - idx * 0.1]},
        )
    db_conn.commit()

    r = client.get("/api/mrt/latest")
    assert r.status_code == 200
    body = r.json()
    assert body["model_version"] == "our-v1.0+persona-K3"
    assert len(body["personas"]) == 3
    assert len(body["recommended_tracks"]) >= 1
    # personas 정렬 by persona_idx
    idxs = [p["persona_idx"] for p in body["personas"]]
    assert idxs == sorted(idxs)
    # 페르소나 playlist 트랙 메타 채워짐
    assert "title" in body["personas"][0]["playlist"][0]
    assert "artist" in body["personas"][0]["playlist"][0]
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
pytest tests/api/test_main.py::test_mrt_latest_returns_personas_and_derives -v
```

Expected: 404

- [ ] **Step 3: /api/mrt/latest 구현**

`src/mrms/api/main.py`에 추가:

```python
from mrms.api.schemas import (
    MrtLatestResponse,
    Persona,
    PersonaTrack,
    RecommendedAlbum,
    RecommendedTrack,
)
from mrms.db.user_embedding import fetch_latest_playlists
from mrms.recsys.mrt import derive_recommended_albums, derive_recommended_tracks


def _fetch_track_metadata(conn, track_ids: list[str]) -> dict[str, dict]:
    if not track_ids:
        return {}
    with conn.cursor() as cur:
        cur.execute(
            '''SELECT t.id, t.title, a.name, t."albumId", alb.title
               FROM "Track" t
               JOIN "Artist" a ON a.id = t."artistId"
               LEFT JOIN "Album" alb ON alb.id = t."albumId"
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
        }
        for r in rows
    }


@app.get("/api/mrt/latest", response_model=MrtLatestResponse)
def mrt_latest(
    top_n: int = 20,
    top_tracks_n: int = 30,
    top_albums_n: int = 15,
    conn: psycopg.Connection = Depends(db_conn),
) -> MrtLatestResponse:
    email = get_default_user_email()
    user_id = get_or_create_user(conn, email)
    conn.commit()

    playlists = fetch_latest_playlists(conn, user_id, limit=3)
    if not playlists:
        return MrtLatestResponse(
            personas=[],
            recommended_tracks=[],
            recommended_albums=[],
        )

    # persona_idx 기준 정렬
    playlists_sorted = sorted(
        playlists,
        key=lambda p: (p.get("context") or {}).get("personaIdx", 999),
    )

    all_track_ids = list({tid for p in playlists_sorted for tid in p["trackIds"]})
    meta = _fetch_track_metadata(conn, all_track_ids)

    # UserPersona의 trackCount 매핑
    with conn.cursor() as cur:
        cur.execute(
            'SELECT "personaIdx", "trackCount" FROM "UserPersona" WHERE "userId" = %s',
            (user_id,),
        )
        track_count_by_idx = {r[0]: r[1] for r in cur.fetchall()}

    personas: list[Persona] = []
    for p in playlists_sorted:
        ctx = p.get("context") or {}
        persona_idx = int(ctx.get("personaIdx", 0))
        scores = ctx.get("scores", [])
        playlist: list[PersonaTrack] = []
        for tid, sc in zip(p["trackIds"][:top_n], scores[:top_n]):
            m = meta.get(tid, {})
            playlist.append(PersonaTrack(
                track_id=tid,
                title=m.get("title", "?"),
                artist=m.get("artist", "?"),
                album_id=m.get("album_id"),
                album_title=m.get("album_title"),
                similarity=float(sc),
            ))
        personas.append(Persona(
            persona_idx=persona_idx,
            track_count=track_count_by_idx.get(persona_idx, 0),
            playlist=playlist,
        ))

    # derive
    playlists_with_scores = [
        {
            "context": p.get("context") or {},
            "trackIds": p["trackIds"],
            "scores": (p.get("context") or {}).get("scores", []),
        }
        for p in playlists_sorted
    ]
    rec_tracks_raw = derive_recommended_tracks(playlists_with_scores, top_n=top_tracks_n)
    recommended_tracks = [
        RecommendedTrack(
            track_id=r["track_id"],
            title=meta.get(r["track_id"], {}).get("title", "?"),
            artist=meta.get(r["track_id"], {}).get("artist", "?"),
            album_id=meta.get(r["track_id"], {}).get("album_id"),
            score=float(r["score"]),
            persona_idx=r.get("persona_idx"),
        )
        for r in rec_tracks_raw
    ]

    track_to_album = {tid: m["album_id"] for tid, m in meta.items()}
    rec_albums_raw = derive_recommended_albums(playlists_with_scores, track_to_album, top_n=top_albums_n)
    # album_id → (title, artist) 조회
    album_titles: dict[str, tuple[str, str]] = {}
    album_ids = [r["album_id"] for r in rec_albums_raw]
    if album_ids:
        with conn.cursor() as cur:
            cur.execute(
                '''SELECT alb.id, alb.title, a.name
                   FROM "Album" alb JOIN "Artist" a ON a.id = alb."artistId"
                   WHERE alb.id = ANY(%s)''',
                (album_ids,),
            )
            for row in cur.fetchall():
                album_titles[row[0]] = (row[1], row[2])
    recommended_albums = [
        RecommendedAlbum(
            album_id=r["album_id"],
            title=album_titles.get(r["album_id"], ("?", "?"))[0],
            artist=album_titles.get(r["album_id"], ("?", "?"))[1],
            track_count=r["track_count"],
        )
        for r in rec_albums_raw
    ]

    return MrtLatestResponse(
        generated_at=playlists_sorted[0].get("generatedAt"),
        model_version=playlists_sorted[0].get("modelVersion"),
        personas=personas,
        recommended_tracks=recommended_tracks,
        recommended_albums=recommended_albums,
    )
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
pytest tests/api/test_main.py -v
```

Expected: 3 passed (또는 Track 비었으면 1 skip)

- [ ] **Step 5: 실제 본인 데이터로 수동 확인**

```bash
.venv/bin/uvicorn mrms.api.main:app --port 8000 &
UVICORN_PID=$!
sleep 2
# DEFAULT_USER_EMAIL은 .env에서 로드됨
curl -s http://localhost:8000/api/health
curl -s http://localhost:8000/api/user | python3 -m json.tool
curl -s http://localhost:8000/api/mrt/latest | python3 -c "import json,sys;d=json.load(sys.stdin);print('personas:',len(d['personas']),'rec_tracks:',len(d['recommended_tracks']),'rec_albums:',len(d['recommended_albums']))"
kill $UVICORN_PID
```

Expected:
- /api/user: 본인 이메일 + personas_count=3
- /api/mrt/latest: personas: 3, rec_tracks: 30개 정도, rec_albums: 5+

- [ ] **Step 6: Commit**

```bash
git add src/mrms/api/main.py tests/api/test_main.py
git commit -m "feat: /api/mrt/latest endpoint with derive logic"
```

---

## Task 4: SDTPL_ADM → web/ 복사 + .env.local

**Files:**
- Create: `web/` (전체 SDTPL_ADM 복사)
- Create: `web/.env.local.example`

- [ ] **Step 1: 복사 (node_modules / .git / .next 제외)**

```bash
cd "/Volumes/MacExtend 1/MRMS_FN"
rsync -av \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='.next' \
  --exclude='dist' \
  --exclude='out' \
  --exclude='test-results' \
  --exclude='playwright-report' \
  --exclude='.env.local' \
  "/Volumes/MacExtend 1/SDTPL_ADM/" web/
```

확인:

```bash
ls web/ | head -10
cat web/package.json | head -10
```

Expected: SDTPL_ADM의 src/, public/, package.json 등 보여야 함

- [ ] **Step 2: web/.env.local.example 작성**

`web/.env.local.example`:

```bash
# 같은 origin이므로 상대 경로 사용 (Cloudflare Tunnel path routing)
NEXT_PUBLIC_API_BASE=/api
```

- [ ] **Step 3: pnpm install + dev 서버 동작 확인**

```bash
cd web
pnpm install 2>&1 | tail -5
pnpm dev -- --port 3500 &
NEXT_PID=$!
sleep 8
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3500/
kill $NEXT_PID
```

Expected: 200 (or 307 redirect — both OK)

만약 pnpm 없으면:
```bash
brew install pnpm   # or: npm install -g pnpm
```

- [ ] **Step 4: Commit**

```bash
cd "/Volumes/MacExtend 1/MRMS_FN"
git add web/
git commit -m "feat(web): copy SDTPL_ADM template to MRMS_FN/web/"
```

(node_modules는 .gitignore되어 제외됨)

---

## Task 5: nav.ts 단순화 + 홈페이지 redirect

**Files:**
- Modify: `web/src/lib/nav.ts` (구조 SDTPL 그대로지만 항목만 변경)
- Modify: `web/src/app/page.tsx`

- [ ] **Step 1: nav.ts 현재 구조 확인**

```bash
cd "/Volumes/MacExtend 1/MRMS_FN"
cat web/src/lib/nav.ts | head -60
```

타입과 export 이름 확인 (SDTPL_ADM 버전 의존).

- [ ] **Step 2: nav.ts 단순화**

`web/src/lib/nav.ts` 전체 내용을 다음으로 교체 (타입은 SDTPL 기존 구조 유지 — Step 1에서 확인한 타입 이름 사용. 아래는 일반적 예시):

```typescript
import type { NavSection } from "./nav-types"  // SDTPL에서 사용하는 타입

export const NAV: NavSection[] = [
  {
    title: "Recommendations",
    items: [
      {
        label: "MRT",
        href: "/mrt",
        icon: "sparkles",  // lucide-react
      },
    ],
  },
]
```

**중요**: SDTPL_ADM이 사용하는 실제 타입 구조에 맞추세요. `cat web/src/lib/nav.ts` 출력 보고 동일 타입 export.

만약 SDTPL `nav.ts`가 다른 구조 (예: 객체 키 다름) 사용하면 그대로 매칭. 항목만 1개로 줄임.

- [ ] **Step 3: 홈페이지 / → /mrt redirect**

`web/src/app/page.tsx`:

```typescript
import { redirect } from "next/navigation"

export default function Home() {
  redirect("/mrt")
}
```

- [ ] **Step 4: dev 서버 + redirect 확인**

```bash
cd web
pnpm dev -- --port 3500 &
NEXT_PID=$!
sleep 8
# / 가 /mrt로 redirect되는지
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" http://localhost:3500/
kill $NEXT_PID
```

Expected: `307 http://localhost:3500/mrt`

(mrt 페이지는 아직 없어서 404 나도 OK — redirect는 동작함)

- [ ] **Step 5: Commit**

```bash
cd "/Volumes/MacExtend 1/MRMS_FN"
git add web/src/lib/nav.ts web/src/app/page.tsx
git commit -m "feat(web): simplify nav to MRT only + home redirect"
```

---

## Task 6: API client + types

**Files:**
- Create: `web/src/lib/api.ts`
- Create: `web/src/lib/types.ts`

- [ ] **Step 1: TypeScript 타입 정의**

`web/src/lib/types.ts`:

```typescript
export interface UserInfo {
  user_id: string
  email: string
  displayName: string | null
  country: string | null
  personas_count: number
  user_tracks_count: number
}

export interface PersonaTrack {
  track_id: string
  title: string
  artist: string
  album_id: string | null
  album_title: string | null
  similarity: number
}

export interface Persona {
  persona_idx: number
  track_count: number
  playlist: PersonaTrack[]
}

export interface RecommendedTrack {
  track_id: string
  title: string
  artist: string
  album_id: string | null
  score: number
  persona_idx: number | null
}

export interface RecommendedAlbum {
  album_id: string
  title: string
  artist: string
  track_count: number
}

export interface MrtLatestResponse {
  generated_at: string | null
  model_version: string | null
  personas: Persona[]
  recommended_tracks: RecommendedTrack[]
  recommended_albums: RecommendedAlbum[]
}
```

- [ ] **Step 2: API client wrapper**

`web/src/lib/api.ts`:

```typescript
import type { MrtLatestResponse, UserInfo } from "./types"


const BASE = process.env.NEXT_PUBLIC_API_BASE ?? "/api"


async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  // Server Component 환경에서 절대 URL 필요할 수 있음
  // 같은 origin에서 routing되므로 base는 / 시작 path
  const url = path.startsWith("http") ? path : `${BASE}${path}`
  const r = await fetch(url, { cache: "no-store", ...init })
  if (!r.ok) {
    throw new Error(`API ${url}: ${r.status}`)
  }
  return r.json() as Promise<T>
}


export function getUser(): Promise<UserInfo> {
  return fetchJson<UserInfo>("/user")
}


export function getMrtLatest(): Promise<MrtLatestResponse> {
  return fetchJson<MrtLatestResponse>("/mrt/latest")
}
```

**Note**: Next.js 16 Server Component에서 `/api/...` 상대 경로는 fetch가 절대화 시도. 만약 SSR에서 에러 나면 env에서 `NEXT_PUBLIC_API_BASE=https://mrms.approid.team/api` 같이 설정.

- [ ] **Step 3: 컴파일 확인**

```bash
cd web
pnpm tsc --noEmit 2>&1 | head -20
```

Expected: 에러 없음 (또는 SDTPL 기존 에러만, 우리 신규 파일 관련 에러 X)

- [ ] **Step 4: Commit**

```bash
cd "/Volumes/MacExtend 1/MRMS_FN"
git add web/src/lib/api.ts web/src/lib/types.ts
git commit -m "feat(web): API client + TypeScript types"
```

---

## Task 7: MRT 페이지 + 컴포넌트

**Files:**
- Create: `web/src/app/(dashboard)/mrt/page.tsx`
- Create: `web/src/components/mrms/PersonaCard.tsx`
- Create: `web/src/components/mrms/RecommendedTracksTable.tsx`
- Create: `web/src/components/mrms/RecommendedAlbumCard.tsx`

- [ ] **Step 1: PersonaCard 컴포넌트**

`web/src/components/mrms/PersonaCard.tsx`:

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Persona } from "@/lib/types"


interface Props {
  persona: Persona
  topN?: number
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
            <li key={t.track_id} className="flex items-start gap-2">
              <span className="text-muted-foreground w-6">{i + 1}.</span>
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
  )
}
```

**Note**: `@/components/ui/card`는 SDTPL_ADM에서 shadcn/ui로 이미 제공. import 이름은 SDTPL 실제 export 확인 후 매칭.

- [ ] **Step 2: RecommendedTracksTable 컴포넌트**

`web/src/components/mrms/RecommendedTracksTable.tsx`:

```tsx
"use client"

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table"
import { useState } from "react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { RecommendedTrack } from "@/lib/types"


const columns: ColumnDef<RecommendedTrack>[] = [
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
]


export function RecommendedTracksTable({ tracks }: { tracks: RecommendedTrack[] }) {
  const [sorting, setSorting] = useState<SortingState>([])
  const table = useReactTable({
    data: tracks,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  return (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map(hg => (
          <TableRow key={hg.id}>
            {hg.headers.map(h => (
              <TableHead key={h.id} onClick={h.column.getToggleSortingHandler()} className="cursor-pointer">
                {flexRender(h.column.columnDef.header, h.getContext())}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.map(row => (
          <TableRow key={row.id}>
            {row.getVisibleCells().map(cell => (
              <TableCell key={cell.id}>
                {flexRender(cell.column.columnDef.cell ?? cell.column.columnDef.header, cell.getContext())}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
```

**Note**: SDTPL_ADM이 `@/components/ui/table` 제공한다고 가정. 실제 경로/이름 다르면 매칭.

- [ ] **Step 3: RecommendedAlbumCard 컴포넌트**

`web/src/components/mrms/RecommendedAlbumCard.tsx`:

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { RecommendedAlbum } from "@/lib/types"


export function RecommendedAlbumCard({ album }: { album: RecommendedAlbum }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base truncate">{album.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground truncate">{album.artist}</p>
        <p className="text-xs text-muted-foreground mt-2">{album.track_count}곡 추천</p>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 4: MRT 페이지 (Server Component)**

`web/src/app/(dashboard)/mrt/page.tsx`:

```tsx
import { PersonaCard } from "@/components/mrms/PersonaCard"
import { RecommendedAlbumCard } from "@/components/mrms/RecommendedAlbumCard"
import { RecommendedTracksTable } from "@/components/mrms/RecommendedTracksTable"
import { getMrtLatest, getUser } from "@/lib/api"


export default async function MrtPage() {
  const [user, mrt] = await Promise.all([
    getUser(),
    getMrtLatest(),
  ])

  if (mrt.personas.length === 0) {
    return (
      <div className="p-8 space-y-4">
        <h1 className="text-2xl font-bold">MRT</h1>
        <p className="text-muted-foreground">
          MRT 데이터 없음. 다음 명령 실행 필요:
        </p>
        <pre className="rounded bg-muted p-4 text-sm">
{`python3 scripts/09_generate_mrt.py --email ${user.email}`}
        </pre>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-8">
      <header>
        <h1 className="text-2xl font-bold">MRT</h1>
        <p className="text-sm text-muted-foreground">
          {user.email} · 페르소나 {user.personas_count} · UserTrack {user.user_tracks_count}곡
        </p>
      </header>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">페르소나</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {mrt.personas.map(p => (
            <PersonaCard key={p.persona_idx} persona={p} />
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">추천 트랙</h2>
        <RecommendedTracksTable tracks={mrt.recommended_tracks} />
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">추천 앨범</h2>
        <div className="grid md:grid-cols-5 gap-4">
          {mrt.recommended_albums.map(a => (
            <RecommendedAlbumCard key={a.album_id} album={a} />
          ))}
        </div>
      </section>
    </div>
  )
}
```

- [ ] **Step 5: 타입 체크**

```bash
cd web
pnpm tsc --noEmit 2>&1 | grep -v "node_modules" | head -30
```

Expected: SDTPL 기존 에러 외 우리 신규 파일 관련 에러 없음

- [ ] **Step 6: dev 서버 + 페이지 렌더링 확인** (API 동작 가정)

다른 터미널에서:

```bash
cd "/Volumes/MacExtend 1/MRMS_FN"
.venv/bin/uvicorn mrms.api.main:app --port 8000 &
UVICORN_PID=$!
```

```bash
cd web
NEXT_PUBLIC_API_BASE=http://localhost:8000/api pnpm dev -- --port 3500 &
NEXT_PID=$!
sleep 8
curl -s http://localhost:3500/mrt | grep -o "MRT\|페르소나\|추천" | head -5
kill $NEXT_PID $UVICORN_PID
```

Expected: HTML에 "MRT", "페르소나", "추천" 단어 보임 (실제 본인 데이터 렌더링)

- [ ] **Step 7: Commit**

```bash
cd "/Volumes/MacExtend 1/MRMS_FN"
git add web/src/app/\(dashboard\)/mrt/page.tsx web/src/components/mrms/
git commit -m "feat(web): MRT page + Persona/Tracks/Album components"
```

---

## Task 8: Makefile + .env.example 업데이트

**Files:**
- Create: `Makefile`
- Modify: `.env.example`

- [ ] **Step 1: Makefile 작성**

`Makefile`:

```makefile
.PHONY: api web tunnel install-web help

help:  ## 사용 가능 명령
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-15s\033[0m %s\n", $$1, $$2}'

install-web:  ## web/ pnpm install
	cd web && pnpm install

api:  ## FastAPI on :8000
	.venv/bin/uvicorn mrms.api.main:app --host 127.0.0.1 --port 8000 --reload

web:  ## Next.js on :3500
	cd web && pnpm dev -- --port 3500

tunnel:  ## Cloudflare Tunnel (path-based ingress)
	cloudflared tunnel run mrms
```

- [ ] **Step 2: .env.example 업데이트**

`.env.example`의 적당한 위치 (DB 섹션 근처)에 추가:

```bash
# E.0+1+2 Web Viewer
DEFAULT_USER_EMAIL=
```

- [ ] **Step 3: 동작 확인**

```bash
cd "/Volumes/MacExtend 1/MRMS_FN"
make help
```

Expected: 4 target (api/web/tunnel/install-web) 출력

- [ ] **Step 4: Commit**

```bash
git add Makefile .env.example
git commit -m "feat: Makefile + DEFAULT_USER_EMAIL env"
```

---

## Task 9: Cloudflare Tunnel ingress docs 업데이트

**Files:**
- Modify: `docs/cloudflare-tunnel-setup.md`

- [ ] **Step 1: 기존 파일 끝에 path-based ingress 섹션 추가**

`docs/cloudflare-tunnel-setup.md` 끝에 추가:

```markdown

## Web Viewer 추가 (E.0+1+2부터)

기존 단일 서비스 라우팅을 path-based로 확장. `~/.cloudflared/config.yml`:

```yaml
tunnel: <기존 UUID>
credentials-file: <기존 path>
ingress:
  - hostname: mrms.approid.team
    path: /api/*
    service: http://localhost:8000   # FastAPI
  - hostname: mrms.approid.team
    path: /callback/*
    service: http://localhost:8080   # OAuth callback (CLI 실행 시)
  - hostname: mrms.approid.team
    service: http://localhost:3500   # Next.js (catch-all)
  - service: http_status:404
```

적용:

```bash
# tunnel 재시작 (config 변경 반영)
cloudflared tunnel run mrms

# 또는 systemd로 돌리고 있다면:
sudo systemctl restart cloudflared
```

### 검증

```bash
curl -I https://mrms.approid.team/                       # Next.js 응답
curl -I https://mrms.approid.team/api/health             # FastAPI 응답 (uvicorn 실행 중)
curl -I https://mrms.approid.team/callback/tidal         # CallbackServer (실행 안 했으면 503)
```

### 트러블슈팅

- `/api/*` 매칭 안 됨: ingress 순서 중요 — path 가장 구체적인 것부터.
- `503 No targets`: 해당 localhost 포트 서비스 미실행. uvicorn / pnpm dev 확인.
- 변경 후 reload 안 됨: cloudflared 프로세스 SIGHUP 또는 재시작.
```

- [ ] **Step 2: Commit**

```bash
cd "/Volumes/MacExtend 1/MRMS_FN"
git add docs/cloudflare-tunnel-setup.md
git commit -m "docs: path-based ingress for E.0+1+2 web viewer"
```

---

## Task 10: 실제 통합 검증

**Files:**
- (코드 변경 없음 — 사용자 실행)

- [ ] **Step 1: 사전 확인**

```bash
cd "/Volumes/MacExtend 1/MRMS_FN"

# .env에 DEFAULT_USER_EMAIL 있는지
grep DEFAULT_USER_EMAIL .env || echo "DEFAULT_USER_EMAIL=jacinto68@onlinecmk.com" >> .env

# MRT 데이터 존재 확인 (이전 B-full 적재)
docker compose exec pg psql -U mrms -d mrms -c '
  SELECT COUNT(*) FROM "PlaylistHistory" WHERE "userId" = (SELECT id FROM "User" WHERE email = $$jacinto68@onlinecmk.com$$);
'
```

Expected: 6 (또는 이상, 이전 B-full에서 2번 generate한 결과)

- [ ] **Step 2: Cloudflare config 적용 + tunnel 재시작**

`~/.cloudflared/config.yml` Task 9의 내용으로 업데이트 후:

```bash
make tunnel
```

별도 터미널에서:

```bash
curl -I https://mrms.approid.team/api/health
```

Expected: 503 (FastAPI 아직 안 띄움) 또는 200 (이미 띄움)

- [ ] **Step 3: 3개 서비스 동시 실행**

3개 터미널 또는 tmux:

```bash
# Terminal 1
make api

# Terminal 2
make web

# Terminal 3 (tunnel 이미 돌고 있으면 skip)
make tunnel
```

- [ ] **Step 4: 브라우저 검증**

```bash
open https://mrms.approid.team
```

또는 모바일에서 같은 URL 접속.

확인:
- [ ] `/` → `/mrt` redirect 됨
- [ ] 헤더에 본인 이메일 + persona 3 표시
- [ ] 페르소나 카드 3개 (각 5곡)
- [ ] 추천 트랙 테이블 (정렬 가능)
- [ ] 추천 앨범 카드 5개
- [ ] 다크 모드 토글 동작
- [ ] 페이지 새로고침 시 동일 결과

- [ ] **Step 5: CLI 출력과 일치 확인**

```bash
.venv/bin/python3 scripts/09_view_mrt.py --email jacinto68@onlinecmk.com --top-n 5
```

→ 페르소나별 top 5가 브라우저 카드와 같은 곡 목록인지 시각 비교.

- [ ] **Step 6: (선택) 발견된 차이/버그 follow-up**

만약 컴포넌트가 SDTPL_ADM의 정확한 export 이름과 안 맞아 import 에러 나면:
- `cat web/src/components/ui/card.tsx` 등으로 실제 export 확인
- 컴포넌트 파일 import 경로 조정
- 추가 commit

---

## Self-Review

**Spec coverage**:
- ✅ Section 3 (Architecture) → Task 4 (web copy) + Task 9 (tunnel)
- ✅ Section 4 (API spec) → Task 1, 2, 3 (3 endpoints)
- ✅ Section 5 (Frontend structure) → Task 5, 6, 7
- ✅ Section 6 (Data flow) → Task 7 (page) + Task 10 (E2E verify)
- ✅ Section 7 (Dev setup) → Task 8 (Makefile)
- ✅ Section 8 (Error handling) — empty personas case in Task 7 page; missing env in Task 2 deps
- ✅ Section 9 (Testing) → Task 1, 2, 3 (pytest); Task 10 (manual E2E)
- ✅ Section 10 (Out of Scope) — 의도적 제외
- ✅ Section 11 (파일 변경) → 모든 task에 정확한 경로
- ✅ Section 13 (구현 시 검증 필요) → Task 10

**남은 위험**:
- SDTPL_ADM의 실제 컴포넌트 export 이름 (Card, Table 등) — Task 7 Step 6에서 조정 필요할 수 있음
- Next.js 16 + React 19 호환성 — `pnpm install` 단계에서 명확히 드러남
- Server Component `fetch` 상대 URL 동작 — Task 10에서 검증

**Placeholders**: 없음 (모든 코드 + 명령어 완전)

**Type consistency**:
- Python schemas.py 필드 ↔ TypeScript types.ts 필드 1:1 매칭 (Task 3 + Task 6에서 동일 정의)
- modelVersion `our-v1.0+persona-K3` 일관
- 포트 번호 3500/8000/8080/5433 일관
