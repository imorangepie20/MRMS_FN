# Wellness 무드 추천 (chicken soup clinic) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 무드(calm/energize/focus/sleep) 선택 → 오디오 피처 무드 적합도 + 취향 임베딩 유사도 결합으로 카탈로그(166k)를 정렬해 20곡 추천하는 메뉴를 추가한다.

**Architecture:** 백엔드-퍼스트. `recsys/wellness.py`(무드 프리셋 + mood_fit 순수함수 + recommend_wellness: 소프트 무드스코어×취향 결합 단일 SQL, UserEmbedding 유무 분기, 제외 재사용) → `api/wellness.py`(GET 라우터) → 프론트 `/wellness` 페이지(무드 칩 + ModalTrackList 재사용). 새 학습 없음 — 기존 TrackAudioFeatures/TrackEmbedding/UserEmbedding 조합.

**Tech Stack:** Python(psycopg + pgvector + numpy), FastAPI, Next.js 16/React 19, pytest.

**근거:** [spec(보강판)](2026-06-14-wellness-mood-recommendation-design.md) · [ADR-006](../../decisions/ADR-006-wellness-recommendation.md)

**⚠️ 테스트 DB:** dev DB에 cleanup으로. **전체 `pytest tests/` 금지** — 파일 지정: `.venv/bin/pytest tests/recsys/test_wellness.py -v` 등.

**검증된 사실:** 후보=임베딩∩피처 전 카탈로그(`inEmp` 아님). `EMBEDDING_MODEL_VERSION='our-v1.0'`(features·catalog mv), user mv=`recsys.mrt.MODEL_VERSION`(`...+persona-K3`). TrackEmbedding HNSW cosine 인덱스 존재. 벡터 파라미터는 `db.user_embedding._ensure_vector_registered(conn)` 후 np.float32 배열로 전달(= `e.embedding <=> %s`). 제외절 = `recsys/mrt.py:search_for_persona`의 UserTrack/UserBlocked WHERE(단 `inEmp=TRUE`는 **제외** — wellness는 전 카탈로그).

---

## File Structure

| 파일 | 책임 |
|---|---|
| `src/mrms/recsys/wellness.py` (신규) | `MOOD_PRESETS` + `mood_fit()` 순수함수 + `_mood_fit_sql()` + `recommend_wellness()` |
| `src/mrms/api/wellness.py` (신규) | `GET /api/wellness/recommendations?mood=` |
| `src/mrms/api/main.py` (수정) | 라우터 등록 1줄 |
| `tests/recsys/test_wellness.py` (신규) | mood_fit 단조 + recommend 통합(시드·정렬·폴백·제외·n) |
| `tests/api/test_wellness.py` (신규) | GET 200/형태/400 |
| `web/src/lib/types.ts` (수정) | `WellnessTrack`/`WellnessResponse` 타입 |
| `web/src/lib/api/wellness.ts` (신규) | `fetchWellness(mood)` |
| `web/src/app/(dashboard)/wellness/page.tsx` (신규) | 무드 칩 + ModalTrackList |
| `web/src/lib/nav.ts` (수정) | Discover에 "chicken soup clinic" 항목 |

**프리셋 구조(축별 `(center, sigma, weight)`, weight=0 → 무시):**
```python
MOOD_PRESETS = {
  "calm":     {"valence": (0.40, 0.18, 1.0), "energy": (0.25, 0.18, 1.0), "tempo": (85.0, 28.0, 1.0), "acousticness": (0.70, 0.25, 0.6), "instrumentalness": (0.0, 0.30, 0.0)},
  "energize": {"valence": (0.78, 0.18, 1.0), "energy": (0.80, 0.18, 1.0), "tempo": (135.0, 30.0, 1.0), "acousticness": (0.0, 0.25, 0.0), "instrumentalness": (0.0, 0.30, 0.0)},
  "focus":    {"valence": (0.50, 0.20, 1.0), "energy": (0.45, 0.18, 1.0), "tempo": (110.0, 28.0, 1.0), "acousticness": (0.0, 0.25, 0.0), "instrumentalness": (0.70, 0.30, 0.6)},
  "sleep":    {"valence": (0.28, 0.20, 1.0), "energy": (0.12, 0.12, 1.0), "tempo": (68.0, 22.0, 1.0), "acousticness": (0.80, 0.25, 0.6), "instrumentalness": (0.50, 0.30, 0.4)},
}
W_MOOD, W_TASTE = 0.6, 0.4
```
`mood_fit = exp(-0.5 · Σ_axis w·((x-center)/sigma)²)` (Python·SQL 동일 공식).

---

## Task 1: `recsys/wellness.py` — 프리셋 + `mood_fit` 순수함수 (TDD)

**Files:** Create `src/mrms/recsys/wellness.py`; Test `tests/recsys/test_wellness.py`.

- [ ] **Step 1: 실패 테스트** — `tests/recsys/test_wellness.py`:
```python
from __future__ import annotations

import math

from mrms.recsys.wellness import MOOD_PRESETS, mood_fit


def test_presets_have_four_moods():
    assert set(MOOD_PRESETS) == {"calm", "energize", "focus", "sleep"}


def test_mood_fit_peaks_at_center():
    # calm 중심점 정확히 = 1.0 (활성축만, 무관축 weight 0)
    feats = {"valence": 0.40, "energy": 0.25, "tempo": 85.0,
             "acousticness": 0.70, "instrumentalness": 0.0}
    assert abs(mood_fit(feats, MOOD_PRESETS["calm"]) - 1.0) < 1e-9


def test_mood_fit_monotonic_decrease():
    # 중심에서 멀어질수록 감소
    center = {"valence": 0.40, "energy": 0.25, "tempo": 85.0,
              "acousticness": 0.70, "instrumentalness": 0.0}
    near = {**center, "energy": 0.35}
    far = {**center, "energy": 0.65}
    p = MOOD_PRESETS["calm"]
    assert mood_fit(center, p) > mood_fit(near, p) > mood_fit(far, p)
    assert 0.0 < mood_fit(far, p) <= 1.0


def test_mood_fit_ignores_zero_weight_axis():
    # energize는 instrumentalness weight 0 → 값 달라도 mood_fit 동일
    p = MOOD_PRESETS["energize"]
    base = {"valence": 0.78, "energy": 0.80, "tempo": 135.0,
            "acousticness": 0.5, "instrumentalness": 0.0}
    other = {**base, "instrumentalness": 1.0}
    assert mood_fit(base, p) == mood_fit(other, p)
```

- [ ] **Step 2: 실패 확인** — `.venv/bin/pytest tests/recsys/test_wellness.py -v` → FAIL (`ModuleNotFoundError: mrms.recsys.wellness`).

- [ ] **Step 3: 구현** — `src/mrms/recsys/wellness.py`:
```python
"""Wellness 무드 추천 — 오디오 피처 무드 적합(소프트) × 취향 임베딩 결합.

새 학습 없음: 기존 TrackAudioFeatures + TrackEmbedding + UserEmbedding 조합.
후보 = 임베딩∩피처 전 카탈로그(inEmp 아님). 제외 = MRT와 동일(UserTrack/UserBlocked).
"""
from __future__ import annotations

import math
from typing import Any

import numpy as np
import psycopg

from mrms.config import EMBEDDING_MODEL_VERSION
from mrms.db.user_embedding import _ensure_vector_registered, fetch_user_embedding
from mrms.recsys.mrt import MODEL_VERSION as USER_MV

CATALOG_MV = EMBEDDING_MODEL_VERSION  # features·catalog 공용 ('our-v1.0')

# 축: (center, sigma, weight). weight 0 → 무시.
MOOD_PRESETS: dict[str, dict[str, tuple[float, float, float]]] = {
    "calm":     {"valence": (0.40, 0.18, 1.0), "energy": (0.25, 0.18, 1.0), "tempo": (85.0, 28.0, 1.0), "acousticness": (0.70, 0.25, 0.6), "instrumentalness": (0.0, 0.30, 0.0)},
    "energize": {"valence": (0.78, 0.18, 1.0), "energy": (0.80, 0.18, 1.0), "tempo": (135.0, 30.0, 1.0), "acousticness": (0.0, 0.25, 0.0), "instrumentalness": (0.0, 0.30, 0.0)},
    "focus":    {"valence": (0.50, 0.20, 1.0), "energy": (0.45, 0.18, 1.0), "tempo": (110.0, 28.0, 1.0), "acousticness": (0.0, 0.25, 0.0), "instrumentalness": (0.70, 0.30, 0.6)},
    "sleep":    {"valence": (0.28, 0.20, 1.0), "energy": (0.12, 0.12, 1.0), "tempo": (68.0, 22.0, 1.0), "acousticness": (0.80, 0.25, 0.6), "instrumentalness": (0.50, 0.30, 0.4)},
}
_FEATURE_COL = {
    "valence": 'taf.valence', "energy": 'taf.energy', "tempo": 'taf.tempo',
    "acousticness": 'taf.acousticness', "instrumentalness": 'taf.instrumentalness',
}
W_MOOD, W_TASTE = 0.6, 0.4


def mood_fit(feats: dict[str, float], preset: dict[str, tuple[float, float, float]]) -> float:
    """정규화 가우시안 무드 적합 (0~1). weight 0 축은 무시."""
    s = 0.0
    for axis, (center, sigma, weight) in preset.items():
        if weight == 0:
            continue
        x = feats[axis]
        s += weight * ((x - center) / sigma) ** 2
    return math.exp(-0.5 * s)


def _mood_fit_sql(preset: dict[str, tuple[float, float, float]]) -> str:
    """mood_fit과 동일 공식의 SQL 식(상수 인라인 — 우리 상수라 안전)."""
    terms = []
    for axis, (center, sigma, weight) in preset.items():
        if weight == 0:
            continue
        col = _FEATURE_COL[axis]
        terms.append(f"{weight} * power(({col} - {center})/{sigma}, 2)")
    return "exp(-0.5 * (" + " + ".join(terms) + "))"
```

- [ ] **Step 4: 통과 확인** — `.venv/bin/pytest tests/recsys/test_wellness.py -v` → PASS (4).

- [ ] **Step 5: Commit**
```bash
git add src/mrms/recsys/wellness.py tests/recsys/test_wellness.py
git commit -m "feat(wellness): MOOD_PRESETS + mood_fit soft score (pure)"
```

---

## Task 2: `recommend_wellness` (DB, TDD)

**Files:** Modify `src/mrms/recsys/wellness.py`; Test `tests/recsys/test_wellness.py`.

- [ ] **Step 1: 시드 헬퍼 + 실패 테스트 추가** — `tests/recsys/test_wellness.py` 끝에:
```python
import uuid

import pytest

from mrms.recsys.wellness import recommend_wellness
from mrms.db.ids import stable_id
from mrms.db.user_track import get_or_create_user

CALM_CENTER = {"valence": 0.40, "energy": 0.25, "tempo": 85.0,
               "acousticness": 0.70, "instrumentalness": 0.0}


def _seed_track(conn, cleanup, *, valence, energy, tempo, acousticness=0.5,
                instrumentalness=0.1, title="W Song", artist="W Artist"):
    """Artist+Track+TrackAudioFeatures+TrackEmbedding(zeros) 시드. track_id 반환."""
    isrc = f"WELL{uuid.uuid4().hex[:8].upper()}"
    artist_id = stable_id(f"artist|{artist.lower()}|{isrc}")
    track_id = stable_id(f"track|{isrc}")
    emb = "[" + ",".join(["0.0125"] * 256) + "]"  # 임의 단위벡터 근사
    cleanup('DELETE FROM "TrackEmbedding" WHERE "trackId" = %s', (track_id,))
    cleanup('DELETE FROM "TrackAudioFeatures" WHERE "trackId" = %s', (track_id,))
    cleanup('DELETE FROM "Track" WHERE id = %s', (track_id,))
    cleanup('DELETE FROM "Artist" WHERE id = %s', (artist_id,))
    with conn.cursor() as cur:
        cur.execute('INSERT INTO "Artist"(id,name,"nameNormalized") VALUES(%s,%s,%s) ON CONFLICT(id) DO NOTHING',
                    (artist_id, artist, artist.lower()))
        cur.execute('''INSERT INTO "Track"(id,isrc,title,"titleNormalized","durationMs","artistId")
                       VALUES(%s,%s,%s,%s,%s,%s) ON CONFLICT(id) DO NOTHING''',
                    (track_id, isrc, title, title.lower(), 180000, artist_id))
        cur.execute('''INSERT INTO "TrackAudioFeatures"
              (id,"trackId",source,"modelVersion",danceability,energy,valence,acousticness,
               instrumentalness,liveness,speechiness,tempo,loudness,key,mode,"timeSignature",
               "energyCurve",subgenres,confidence)
              VALUES(%s,%s,'our_model',%s,0.5,%s,%s,%s,%s,0.1,0.05,%s,-8.0,5,1,4,
                     ARRAY[]::double precision[],ARRAY[]::text[],0.9)''',
                    (stable_id(f"taf|{track_id}"), track_id, CATALOG_MV, energy, valence,
                     acousticness, instrumentalness, tempo))
        cur.execute('''INSERT INTO "TrackEmbedding"(id,"trackId","modelVersion",embedding,pooling,"audioSource")
                       VALUES(%s,%s,%s,%s::vector,'mean','mp3_30s')''',
                    (stable_id(f"emb|{track_id}"), track_id, CATALOG_MV, emb))
    conn.commit()
    return track_id


def test_recommend_orders_by_mood_fit_no_embedding(db_conn, cleanup):
    user_id = get_or_create_user(db_conn, f"well_{uuid.uuid4().hex[:8]}@t.local")
    cleanup('DELETE FROM "User" WHERE id = %s', (user_id,))  # cascade로 UserTrack/UserBlocked 정리
    near = _seed_track(db_conn, cleanup, **CALM_CENTER, title="Near")
    far = _seed_track(db_conn, cleanup, valence=0.9, energy=0.9, tempo=150.0, title="Far")
    recs = recommend_wellness(db_conn, user_id, "calm", n=20)
    ids = [r["track_id"] for r in recs]
    assert near in ids and far in ids
    assert ids.index(near) < ids.index(far)  # 무드 가까운 게 먼저
    assert all("score" in r and "mood_fit" in r for r in recs)


def test_recommend_excludes_owned_and_disliked(db_conn, cleanup):
    user_id = get_or_create_user(db_conn, f"well_{uuid.uuid4().hex[:8]}@t.local")
    cleanup('DELETE FROM "User" WHERE id = %s', (user_id,))
    owned = _seed_track(db_conn, cleanup, **CALM_CENTER, title="Owned")
    blocked = _seed_track(db_conn, cleanup, **CALM_CENTER, title="Blocked")
    with db_conn.cursor() as cur:
        cur.execute('INSERT INTO "UserTrack"(id,"userId","trackId",source) VALUES(%s,%s,%s,%s) ON CONFLICT DO NOTHING',
                    (stable_id(f"ut|{user_id}|{owned}"), user_id, owned, "liked"))
        cur.execute('''INSERT INTO "UserBlocked"(id,"userId","targetId","targetType",reason)
                       VALUES(%s,%s,%s,'track','disliked') ON CONFLICT DO NOTHING''',
                    (stable_id(f"ub|{user_id}|{blocked}"), user_id, blocked))
    db_conn.commit()
    cleanup('DELETE FROM "UserTrack" WHERE "userId" = %s', (user_id,))
    cleanup('DELETE FROM "UserBlocked" WHERE "userId" = %s', (user_id,))
    recs = recommend_wellness(db_conn, user_id, "calm", n=20)
    ids = [r["track_id"] for r in recs]
    assert owned not in ids and blocked not in ids


def test_recommend_bad_mood_raises(db_conn):
    # mood 검증이 user 사용 전에 먼저 raise → 더미 user_id로 충분
    with pytest.raises(ValueError):
        recommend_wellness(db_conn, "dummy-user", "nope", n=5)
```

- [ ] **Step 2: 실패 확인** — `.venv/bin/pytest tests/recsys/test_wellness.py -v` → FAIL (`recommend_wellness` 없음). (dev Postgres 필요 — 안 되면 BLOCKED 보고.)

- [ ] **Step 3: 구현** — `src/mrms/recsys/wellness.py` 끝에 추가:
```python
def recommend_wellness(
    conn: psycopg.Connection, user_id: str, mood: str, n: int = 20
) -> list[dict[str, Any]]:
    """무드 적합(소프트) × 취향(UserEmbedding cosine) 결합 top-n. 학습 없음.

    UserEmbedding 있으면 score=W_MOOD·mood_fit+W_TASTE·taste_sim, 없으면 mood_fit만.
    제외: UserTrack 보유 + UserBlocked disliked(track+album). 후보=임베딩∩피처 전 카탈로그.
    """
    if mood not in MOOD_PRESETS:
        raise ValueError(f"unknown mood: {mood}")
    _ensure_vector_registered(conn)
    fit_sql = _mood_fit_sql(MOOD_PRESETS[mood])
    ue = fetch_user_embedding(conn, user_id, USER_MV)

    exclude = '''
      t.id NOT IN (SELECT "trackId" FROM "UserTrack" WHERE "userId" = %(uid)s)
      AND t.id NOT IN (
        SELECT "targetId" FROM "UserBlocked"
          WHERE "userId" = %(uid)s AND "targetType" = 'track' AND reason = 'disliked'
        UNION
        SELECT tt.id FROM "Track" tt JOIN "UserBlocked" ub
          ON ub."targetId" = tt."albumId" AND ub."targetType" = 'album'
          WHERE ub."userId" = %(uid)s AND ub.reason = 'disliked'
      )'''
    select_cols = f'''
        t.id, t.title, ar.name AS artist, t."albumId",
        taf.valence, taf.energy, taf.tempo,
        {fit_sql} AS mood_fit,
        tp_t."platformTrackId" AS tidal_id,
        tp_s."platformTrackId" AS spotify_id'''
    joins = '''
      FROM "TrackAudioFeatures" taf
      JOIN "Track"  t  ON t.id = taf."trackId"
      JOIN "Artist" ar ON ar.id = t."artistId"
      JOIN "TrackEmbedding" e ON e."trackId" = t.id AND e."modelVersion" = %(catmv)s
      LEFT JOIN "TrackPlatform" tp_t ON tp_t."trackId" = t.id AND tp_t.platform = 'tidal'
      LEFT JOIN "TrackPlatform" tp_s ON tp_s."trackId" = t.id AND tp_s.platform = 'spotify' '''
    params: dict[str, Any] = {"uid": user_id, "catmv": CATALOG_MV, "featmv": CATALOG_MV, "n": n}

    if ue is not None:
        params["uvec"] = np.asarray(ue["embedding"], dtype=np.float32)
        sql = f'''SELECT {select_cols}, 1 - (e.embedding <=> %(uvec)s) AS taste_sim {joins}
                  WHERE taf."modelVersion" = %(featmv)s AND {exclude}
                  ORDER BY ({W_MOOD} * ({fit_sql}) + {W_TASTE} * (1 - (e.embedding <=> %(uvec)s))) DESC
                  LIMIT %(n)s'''
    else:
        sql = f'''SELECT {select_cols}, NULL::double precision AS taste_sim {joins}
                  WHERE taf."modelVersion" = %(featmv)s AND {exclude}
                  ORDER BY ({fit_sql}) DESC
                  LIMIT %(n)s'''

    with conn.cursor() as cur:
        cur.execute(sql, params)
        rows = cur.fetchall()
    out = []
    for r in rows:
        mf = float(r[7])
        ts = float(r[11]) if r[11] is not None else None
        score = (W_MOOD * mf + W_TASTE * ts) if ts is not None else mf
        out.append({
            "track_id": r[0], "title": r[1], "artist": r[2], "album_id": r[3],
            "valence": float(r[4]), "energy": float(r[5]), "tempo": float(r[6]),
            "mood_fit": mf, "taste_sim": ts, "score": score,
            "tidal_track_id": r[9], "spotify_track_id": r[10],
        })
    return out
```

- [ ] **Step 4: 통과 확인** — `.venv/bin/pytest tests/recsys/test_wellness.py -v` → PASS (7). 정렬/제외/폴백/bad-mood 검증.

- [ ] **Step 5: Commit**
```bash
git add src/mrms/recsys/wellness.py tests/recsys/test_wellness.py
git commit -m "feat(wellness): recommend_wellness — mood×taste blend, exclusions, full catalog"
```

---

## Task 3: `GET /api/wellness/recommendations` (TDD)

**Files:** Create `src/mrms/api/wellness.py`; Modify `src/mrms/api/main.py`; Test `tests/api/test_wellness.py`.

- [ ] **Step 1: 실패 테스트** — `tests/api/test_wellness.py`:
```python
from __future__ import annotations

from fastapi.testclient import TestClient

from mrms.api.main import app

client = TestClient(app)


def test_wellness_requires_auth():
    client.cookies.clear()
    r = client.get("/api/wellness/recommendations", params={"mood": "calm"})
    assert r.status_code in (401, 403)


def test_wellness_bad_mood_400(login):
    user_id, session_id = login()
    client.cookies.set("mrms_session", session_id)
    r = client.get("/api/wellness/recommendations", params={"mood": "nope"})
    assert r.status_code == 400
    client.cookies.clear()


def test_wellness_returns_list(login):
    user_id, session_id = login()
    client.cookies.set("mrms_session", session_id)
    r = client.get("/api/wellness/recommendations", params={"mood": "energize"})
    assert r.status_code == 200
    data = r.json()
    assert data["mood"] == "energize"
    assert isinstance(data["tracks"], list)
    client.cookies.clear()
```

- [ ] **Step 2: 실패 확인** — `.venv/bin/pytest tests/api/test_wellness.py -v` → FAIL (404).

- [ ] **Step 3: 구현 라우트** — `src/mrms/api/wellness.py`:
```python
"""Wellness 무드 추천 API. 웰니스 프레이밍(치료 표방 금지)."""
from __future__ import annotations

import psycopg
from fastapi import APIRouter, Depends, HTTPException

from mrms.api.deps import db_conn, get_current_user_id
from mrms.recsys.wellness import MOOD_PRESETS, recommend_wellness

router = APIRouter(prefix="/api/wellness", tags=["wellness"])


@router.get("/recommendations")
def recommendations(
    mood: str,
    user_id: str = Depends(get_current_user_id),
    conn: psycopg.Connection = Depends(db_conn),
):
    if mood not in MOOD_PRESETS:
        raise HTTPException(400, f"mood must be one of {sorted(MOOD_PRESETS)}")
    tracks = recommend_wellness(conn, user_id, mood, n=20)
    return {"mood": mood, "tracks": tracks}
```

- [ ] **Step 4: 라우터 등록** — `src/mrms/api/main.py`: 기존 `from mrms.api.search import router as search_router` 패턴 옆에 `from mrms.api.wellness import router as wellness_router` 추가하고, `app.include_router(search_router)` 다음 줄에 `app.include_router(wellness_router)`.

- [ ] **Step 5: 통과 확인** — `.venv/bin/pytest tests/api/test_wellness.py -v` → PASS (3).

- [ ] **Step 6: Commit**
```bash
git add src/mrms/api/wellness.py src/mrms/api/main.py tests/api/test_wellness.py
git commit -m "feat(wellness): GET /api/wellness/recommendations"
```

---

## Task 4: 웹 API 헬퍼 + 타입

**Files:** Modify `web/src/lib/types.ts`; Create `web/src/lib/api/wellness.ts`.

- [ ] **Step 1: 타입 추가** — `web/src/lib/types.ts` 끝에:
```typescript
export interface WellnessTrack {
  track_id: string;
  title: string;
  artist: string;
  album_id: string | null;
  valence: number;
  energy: number;
  tempo: number;
  mood_fit: number;
  taste_sim: number | null;
  score: number;
  tidal_track_id: string | null;
  spotify_track_id: string | null;
}
export interface WellnessResponse {
  mood: string;
  tracks: WellnessTrack[];
}
```

- [ ] **Step 2: 헬퍼** — `web/src/lib/api/wellness.ts`:
```typescript
import type { WellnessResponse } from "@/lib/types";

import { apiFetch } from "./http";

export async function fetchWellness(mood: string): Promise<WellnessResponse> {
  const r = await apiFetch(
    `/api/wellness/recommendations?mood=${encodeURIComponent(mood)}`,
    {},
    "wellness",
  );
  return (await r.json()) as WellnessResponse;
}
```

- [ ] **Step 3: 빌드** — `cd web && pnpm build` → 통과.

- [ ] **Step 4: Commit**
```bash
git add web/src/lib/types.ts web/src/lib/api/wellness.ts
git commit -m "feat(wellness): web api client + types"
```

---

## Task 5: `/wellness` 페이지 + nav

**Files:** Create `web/src/app/(dashboard)/wellness/page.tsx`; Modify `web/src/lib/nav.ts`.

- [ ] **Step 1: 페이지** — `web/src/app/(dashboard)/wellness/page.tsx`:
```tsx
"use client";

import { useState } from "react";

import { fetchWellness } from "@/lib/api/wellness";
import type { WellnessTrack } from "@/lib/types";
import { ModalTrackList } from "@/components/track/ModalTrackList";

const MOODS: { key: string; label: string; sub: string }[] = [
  { key: "calm", label: "이완", sub: "Calm" },
  { key: "energize", label: "활력", sub: "Energize" },
  { key: "focus", label: "집중", sub: "Focus" },
  { key: "sleep", label: "수면 보조", sub: "Sleep" },
];

export default function WellnessPage() {
  const [active, setActive] = useState<string | null>(null);
  const [tracks, setTracks] = useState<WellnessTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async (mood: string) => {
    setActive(mood);
    setLoading(true);
    setError(null);
    try {
      setTracks((await fetchWellness(mood)).tracks);
    } catch (e) {
      setError((e as Error).message);
      setTracks([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="px-6 py-8 md:px-14">
      <header className="mb-6 border-b border-(--mrms-rule) pb-4">
        <div className="font-display text-[28px] font-bold leading-none text-(--mrms-ink)">
          chicken soup clinic
        </div>
        <div className="mt-1.5 font-mono text-[10px] uppercase tracking-editorial-wide text-(--mrms-ink-mute)">
          무드를 고르면 그 정서에 맞는 곡을 취향 순으로 — 기분 전환 · 이완 · 집중
        </div>
      </header>

      <div className="mb-8 flex flex-wrap gap-2">
        {MOODS.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => pick(m.key)}
            className={`cursor-pointer border px-4 py-2 font-display text-[15px] transition-colors ${
              active === m.key
                ? "border-(--mrms-rust) text-(--mrms-rust)"
                : "border-(--mrms-rule) text-(--mrms-ink-soft) hover:border-(--mrms-rust) hover:text-(--mrms-rust)"
            }`}
          >
            {m.label}
            <span className="ml-2 font-mono text-[9px] uppercase tracking-editorial text-(--mrms-ink-mute)">
              {m.sub}
            </span>
          </button>
        ))}
      </div>

      {loading && (
        <div className="font-mono text-[11px] text-(--mrms-ink-mute)">추천 곡 불러오는 중…</div>
      )}
      {error && <div className="font-mono text-[11px] text-(--mrms-rust)">{error}</div>}
      {!loading && !error && active && tracks.length === 0 && (
        <div className="font-mono text-[11px] text-(--mrms-ink-mute)">추천 결과 없음</div>
      )}
      {!loading && !error && tracks.length > 0 && <ModalTrackList tracks={tracks} />}
    </div>
  );
}
```

- [ ] **Step 2: nav 항목** — `web/src/lib/nav.ts`의 Discover 그룹(`Search` 항목 있는 곳) items 배열에서 `{ title: "Search", ... }` 다음에 추가:
```typescript
      { title: "Wellness", href: "/wellness", num: "D4", full: "chicken soup clinic", badge: "·" },
```
(Discover 그룹 items에 한 줄. `num`은 기존 D1/D2/D3 패턴 이어 D4. `full` 필드는 NavItem에 이미 있음.)

- [ ] **Step 3: 빌드** — `cd web && pnpm build` → 통과. `/wellness` 라우트 생성 확인.

- [ ] **Step 4: Commit**
```bash
git add "web/src/app/(dashboard)/wellness/page.tsx" web/src/lib/nav.ts
git commit -m "feat(wellness): /wellness page (mood chips + ModalTrackList) + nav"
```

---

## Task 6: 수동 verify

**Files:** 없음.

- [ ] **Step 1:** `make api` + `make web`, 로그인.
- [ ] **Step 2:** `/wellness`에서 무드 칩 4개 각각 클릭 → 매번 추천 리스트(≤20곡) 뜨고, sleep도 0건 아님(소프트 스코어).
- [ ] **Step 3:** 트랙 재생(있으면 직행, 없으면 resolve 폴백) 동작.
- [ ] **Step 4:** UserTrack/UserBlocked 있는 유저면 그 곡 제외 확인.
- [ ] **Step 5:** (UserEmbedding 있는 4명 중 하나로) 취향 반영 체감 — 같은 무드라도 유저마다 순서 다름.

---

## Self-Review

**Spec coverage:** §0 inEmp제거·소프트스코어 → Task 2(전 카탈로그·mood_fit SQL). §5 프리셋 → Task1 MOOD_PRESETS. §6 결합/폴백/제외 → Task 2. §3/§7 GET → Task 3. §4/§7 프론트 → Task 4/5. §9 테스트(단조·폴백·제외·n) → Task 1/2/3. ✅

**Placeholder scan:** 모든 step 실코드/명령/기대값. 시드 헬퍼·SQL·라우트·페이지 전체 코드 포함. ✅

**Type consistency:** `mood_fit(feats,preset)`·`_mood_fit_sql(preset)`·`recommend_wellness(conn,uid,mood,n)` Task1→2 일관. `CATALOG_MV`/`USER_MV`/`W_MOOD`/`W_TASTE`/`MOOD_PRESETS` Task1 정의→Task2/3 사용. 반환 dict 키(track_id/title/artist/tidal_track_id/spotify_track_id/score/mood_fit/...) = `WellnessTrack` 타입(Task4) = `ModalTrack` 호환(Task5) 일관. 라우트 응답 `{mood,tracks}` = `WellnessResponse`. ✅

## 관련 문서
- [spec(보강판)](2026-06-14-wellness-mood-recommendation-design.md) · [ADR-006](../../decisions/ADR-006-wellness-recommendation.md)
