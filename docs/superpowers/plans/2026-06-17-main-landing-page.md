# 메인 랜딩 페이지 (앱 루트) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 앱 루트(`src/app/page.tsx`)의 `/mrt` redirect를 제거하고, 인증 상태 분기 랜딩으로 교체한다 — 비로그인=마케팅 히어로, 로그인=개인화 홈. 양쪽 공통으로 **스펙트럼 히어로**(최신곡 preview 5곡, "플레이 허용" 게이트, Web Audio 스펙트럼)를 둔다.

**Architecture:** 백엔드는 `Track.previewUrl` 컬럼(마이그레이션) + `GET /api/landing/preview-tracks`(무인증, 전역 최신곡 풀에서 랜덤 5곡 → Deezer/iTunes로 preview write-through resolve). 프론트는 `@/lib/spectrum` 수학을 재사용한 generic-audio `PreviewSpectrum` + `LandingHero`(autoplay 게이트), 루트 `page.tsx`가 신규 `getServerSideUserOptional`로 분기 → `HomeMarketing`(로그아웃) / `HomeLoggedIn`(로그인, MRT 데이터·퀵스탯·큐레이션 피드 재사용).

**Tech Stack:** FastAPI + raw psycopg + httpx + respx + pytest. Next.js 16 app router + Web Audio API(기존 `@/lib/spectrum`·`tidal-player.ts` 패턴 재사용) + AlbumArt/ModalTrackList/Card/Carousel(기존·템플릿) + sonner(이미).

**참고 — 절대 경로:** 루트 `/Volumes/MacExtend 1/MRMS_FN`. 러너 `.venv/bin/pytest`·`.venv/bin/ruff check`. 프론트 `web/`(`npx tsc --noEmit -p tsconfig.json`, `pnpm build`).

**⚠️ 규칙:** 전체 `pytest tests/` 금지(DB 격리 안 됨) — 대상 파일만. preview resolve 테스트는 **respx로 Deezer/iTunes mock**(라이브 차단). 신규 테스트는 `cleanup`로 정리. 외부 호출은 preview resolve 뿐(respx로 차단).

**기존 그라운딩(정확):**
- **스펙트럼 재사용**: `@/lib/spectrum` — `BAR_COUNT=48`, `binsToBarHeights(bins: Uint8Array, prev: number[]): number[]`(순수, 테스트됨 `spectrum.test.ts`). `web/src/components/player/SpectrumEqualizer.tsx`의 rAF 루프 + bar 렌더, `web/src/lib/tidal-player.ts:ensureAnalyser`의 AudioContext 셋업(`createMediaElementSource(el)` 1회, `fftSize=1024`, `smoothingTimeConstant=0`, `minDecibels=-90`, `maxDecibels=-10`, `src→analyser→destination`).
- **⚠️ CORS**: `<audio>`에 `crossOrigin="anonymous"` 필수 + preview CDN이 CORS 허용해야 analyser가 데이터를 읽음. 미허용 시 오디오는 재생되나 스펙트럼은 0(무반응) → 데코 폴백 처리.
- **preview resolve(async)**: `src/mrms/ingest/deezer.py:lookup_by_isrc(client, isrc) -> DeezerTrack|None`(`["preview_url"]`), `src/mrms/ingest/itunes.py:search_by_isrc(client, isrc) -> str|None`. 둘 다 `httpx.AsyncClient`.
- **Track**: `id, title, artistId, albumId, isrc(TEXT UNIQUE), durationMs, previewUrl(schema.prisma:84에 선언됐으나 DB엔 미적용)`. synthetic ISRC는 `emp_%`/길이≠12로 제외.
- **new_release 풀**: `EMPSource source_type='new_release'`(per-user지만 전역 distinct trackId 사용). 커버는 `EMPSource.cover_url` LATERAL.
- **라우터 등록**: `src/mrms/api/main.py`에 `from mrms.api.landing import router as landing_router` + `app.include_router(landing_router)`.
- **auth(프론트)**: `web/src/lib/server/auth.ts:getServerSideUser()`는 **로그아웃 시 `/login`으로 redirect**(null 반환 X). `getServerSideMrt()`도 401→redirect. `UserInfo`={user_id,email,displayName,personas_count,user_tracks_count,primary_platform}. `getServerSideMrt`={personas,recommended_tracks,recommended_albums,recommended_new_releases}.
- **재사용 컴포넌트**: `@/components/mrms/AlbumArt`(props: artist, album?, initialUrl?, className?), `@/components/track/ModalTrackList`(ModalTrack), `@/components/ui/card`(Card 패밀리), `@/components/ui/carousel`(Carousel 패밀리, Embla). `/login` 라우트. 에디토리얼 톤: `--mrms-bg #f5f0e8`·`--mrms-ink #1a1815`·`--mrms-rust #c44518`, `font-display`/`font-mono tracking-editorial uppercase`.

---

### Task 1: 백엔드 — preview 마이그레이션 + resolve 헬퍼 + 풀 쿼리 + 엔드포인트

**Files:**
- Create: `prisma/migrations/20260617120000_add_track_previewurl/migration.sql`
- Create: `src/mrms/ingest/preview.py` (resolve 헬퍼)
- Create: `src/mrms/db/landing.py` (풀 쿼리 + write-through)
- Create: `src/mrms/api/landing.py` (엔드포인트)
- Modify: `src/mrms/api/main.py` (라우터 등록)
- Test: `tests/api/test_landing.py`

- [ ] **Step 1: 마이그레이션 + dev DB 적용**

`prisma/migrations/20260617120000_add_track_previewurl/migration.sql`:
```sql
-- 랜딩 히어로 preview 캐시(write-through). schema.prisma:84 선언과 DB 일치.
ALTER TABLE "Track" ADD COLUMN IF NOT EXISTS "previewUrl" TEXT;
```
Run (psql 없으면 psycopg로):
```bash
.venv/bin/python -c "import os,psycopg;from dotenv import load_dotenv;load_dotenv();c=psycopg.connect(os.environ.get('DATABASE_URL','postgresql://mrms:mrms@localhost:5433/mrms'),autocommit=True);c.cursor().execute('ALTER TABLE \"Track\" ADD COLUMN IF NOT EXISTS \"previewUrl\" TEXT'); print('ok')"
```
Verify: 컬럼 존재.

- [ ] **Step 2: resolve 헬퍼 구현** — `src/mrms/ingest/preview.py`
```python
"""랜딩 히어로용 preview URL resolve — Deezer 우선 → iTunes 폴백. best-effort."""
from __future__ import annotations

import logging

import httpx

from mrms.ingest import deezer, itunes

log = logging.getLogger(__name__)


async def resolve_preview_url(
    http: httpx.AsyncClient, isrc: str, title: str, artist: str
) -> str | None:
    """ISRC로 30s preview URL 얻기. Deezer→iTunes. 실패 None."""
    if not isrc:
        return None
    try:
        dt = await deezer.lookup_by_isrc(http, isrc)
        if dt and dt.get("preview_url"):
            return dt["preview_url"]
    except Exception as e:  # noqa: BLE001 — best-effort
        log.debug("deezer preview [%s]: %r", isrc, e)
    try:
        url = await itunes.search_by_isrc(http, isrc)
        if url:
            return url
    except Exception as e:  # noqa: BLE001
        log.debug("itunes preview [%s]: %r", isrc, e)
    return None
```

- [ ] **Step 3: 실패 테스트 — 풀 쿼리 + write-through** — `tests/api/test_landing.py`
```python
"""랜딩 preview-tracks 엔드포인트."""
import uuid as _uuid

import httpx
import respx
from fastapi.testclient import TestClient

from mrms.api.main import app
from mrms.db.user_track import get_or_create_user
from mrms.emp.base import upsert_track_and_emp_source

client = TestClient(app)


def _seed_newrelease_track(db_conn, cleanup, *, isrc, preview=None):
    """real-ISRC new_release 트랙 시드. (track_id) 반환."""
    artist = f"Land Artist {_uuid.uuid4().hex[:6]}"
    sid = f"new_release:land:{_uuid.uuid4().hex[:8]}"
    r = upsert_track_and_emp_source(
        db_conn, isrc=isrc, title="Land Song", artist=artist,
        album_title="LA", duration_ms=180000, platform="tidal",
        platform_track_id="T" + _uuid.uuid4().hex[:8], source_type="new_release",
        source_id=sid, source_name="New Releases", cover_url="https://c/l.jpg",
    )
    tid = r["track_id"]
    if preview is not None:
        with db_conn.cursor() as cur:
            cur.execute('UPDATE "Track" SET "previewUrl"=%s WHERE id=%s', (preview, tid))
    db_conn.commit()
    cleanup('DELETE FROM "EMPSource" WHERE source_id = %s', (sid,))
    cleanup('DELETE FROM "TrackPlatform" WHERE "trackId" = %s', (tid,))
    cleanup('DELETE FROM "Album" WHERE "artistId" IN (SELECT id FROM "Artist" WHERE name = %s)', (artist,))
    cleanup('DELETE FROM "Track" WHERE id = %s', (tid,))
    cleanup('DELETE FROM "Artist" WHERE name = %s', (artist,))
    return tid, isrc


@respx.mock
def test_preview_tracks_cache_hit_no_external(db_conn, cleanup):
    """previewUrl 캐시된 트랙은 외부 호출 0(respx 라우트 없음 → 호출 시 실패)."""
    isrc = "US" + _uuid.uuid4().hex[:10].upper()
    tid, _ = _seed_newrelease_track(db_conn, cleanup, isrc=isrc, preview="https://cdn/p.mp3")
    r = client.get("/api/landing/preview-tracks?n=5")
    assert r.status_code == 200, r.text
    tracks = r.json()["tracks"]
    # 시드 트랙이 포함되면 preview_url은 캐시값(외부 미호출). 풀이 커서 안 뽑힐 수도 있으니 존재 시만 검증.
    hit = [t for t in tracks if t["track_id"] == tid]
    if hit:
        assert hit[0]["preview_url"] == "https://cdn/p.mp3"
    assert all(t["preview_url"] for t in tracks)


@respx.mock
def test_preview_tracks_miss_resolves_and_caches(db_conn, cleanup, monkeypatch):
    """previewUrl 없는 트랙 → Deezer resolve(respx) → previewUrl write-back."""
    # 풀이 이 한 곡만 나오도록 db.landing.pick_preview_candidates를 좁혀 패치
    import mrms.api.landing as _land
    isrc = "GB" + _uuid.uuid4().hex[:10].upper()
    tid, _ = _seed_newrelease_track(db_conn, cleanup, isrc=isrc, preview=None)
    monkeypatch.setattr(
        _land, "pick_preview_candidates",
        lambda conn, limit=15: [{
            "track_id": tid, "title": "Land Song", "artist": "x",
            "album_id": None, "album_title": "LA", "album_cover": "https://c/l.jpg",
            "tidal_track_id": "T1", "spotify_track_id": None, "youtube_track_id": None,
            "duration_ms": 180000, "isrc": isrc, "preview_url": None,
        }],
    )
    respx.get(url__startswith=f"https://api.deezer.com/track/isrc:{isrc}").mock(
        return_value=httpx.Response(200, json={"id": 1, "isrc": isrc, "title": "Land Song",
            "artist": {"name": "x"}, "duration": 180, "preview": "https://dz/p.mp3"}))
    r = client.get("/api/landing/preview-tracks?n=5")
    assert r.status_code == 200, r.text
    t = next(x for x in r.json()["tracks"] if x["track_id"] == tid)
    assert t["preview_url"] == "https://dz/p.mp3"
    # write-back 확인
    with db_conn.cursor() as cur:
        cur.execute('SELECT "previewUrl" FROM "Track" WHERE id=%s', (tid,))
        assert cur.fetchone()[0] == "https://dz/p.mp3"


def test_preview_tracks_unauth_ok():
    """무인증 200(쿠키 없음)."""
    client.cookies.clear()
    r = client.get("/api/landing/preview-tracks?n=3")
    assert r.status_code == 200
```

- [ ] **Step 4: 실패 확인** — Run: `.venv/bin/pytest tests/api/test_landing.py -v` → FAIL(라우트/모듈 없음).

- [ ] **Step 5: db 풀 쿼리 + write-through** — `src/mrms/db/landing.py`
```python
"""랜딩 preview 풀 — 전역 최신곡(new_release) 중 real-ISRC 랜덤 후보 + previewUrl write."""
from __future__ import annotations

import psycopg


def pick_preview_candidates(conn: psycopg.Connection, limit: int = 15) -> list[dict]:
    """전역 new_release 풀에서 real-ISRC 트랙 랜덤 후보(메타+previewUrl 현재값). 부족하면 적게."""
    with conn.cursor() as cur:
        cur.execute(
            '''WITH pool AS (
                 SELECT DISTINCT t.id
                 FROM "Track" t
                 JOIN "EMPSource" e ON e."trackId" = t.id AND e.source_type = 'new_release'
                 WHERE t.isrc IS NOT NULL
                   AND t.isrc NOT LIKE 'emp\\_%%' ESCAPE '\\'
                   AND length(t.isrc) = 12
                 ORDER BY random() LIMIT %s
               )
               SELECT t.id, t.title, ar.name, t."albumId", alb.title,
                      tp_t."platformTrackId", tp_s."platformTrackId", tp_y."platformTrackId",
                      t."durationMs", t.isrc, t."previewUrl", ec.cover_url
               FROM pool p
               JOIN "Track" t ON t.id = p.id
               JOIN "Artist" ar ON ar.id = t."artistId"
               LEFT JOIN "Album" alb ON alb.id = t."albumId"
               LEFT JOIN "TrackPlatform" tp_t ON tp_t."trackId"=t.id AND tp_t.platform='tidal'
               LEFT JOIN "TrackPlatform" tp_s ON tp_s."trackId"=t.id AND tp_s.platform='spotify'
               LEFT JOIN "TrackPlatform" tp_y ON tp_y."trackId"=t.id AND tp_y.platform='youtube'
                 AND tp_y."platformTrackId" NOT LIKE 'yt\\_%%' ESCAPE '\\'
               LEFT JOIN LATERAL (
                 SELECT cover_url FROM "EMPSource"
                 WHERE "trackId"=t.id AND cover_url IS NOT NULL LIMIT 1
               ) ec ON TRUE''',
            (limit,),
        )
        rows = cur.fetchall()
    return [{
        "track_id": r[0], "title": r[1], "artist": r[2], "album_id": r[3],
        "album_title": r[4], "tidal_track_id": r[5], "spotify_track_id": r[6],
        "youtube_track_id": r[7], "duration_ms": r[8], "isrc": r[9],
        "preview_url": r[10], "album_cover": r[11],
    } for r in rows]


def set_track_preview_url(conn: psycopg.Connection, track_id: str, url: str) -> None:
    """resolve된 preview URL을 Track에 캐시(write-through). 자체 commit."""
    with conn.cursor() as cur:
        cur.execute('UPDATE "Track" SET "previewUrl"=%s WHERE id=%s', (url, track_id))
    conn.commit()
```

- [ ] **Step 6: 엔드포인트** — `src/mrms/api/landing.py`
```python
"""랜딩 히어로 API — 무인증. 전역 최신곡 풀에서 preview 확보된 N곡."""
from __future__ import annotations

import httpx
from fastapi import APIRouter, Depends

from mrms.api.deps import db_conn
from mrms.db.landing import pick_preview_candidates, set_track_preview_url
from mrms.ingest.preview import resolve_preview_url

router = APIRouter(prefix="/api/landing", tags=["landing"])


@router.get("/preview-tracks")
async def preview_tracks(n: int = 5, conn=Depends(db_conn)):
    """랜덤 최신곡 중 preview 확보된 N곡(메타+preview_url). 무인증."""
    n = max(1, min(n, 10))
    candidates = pick_preview_candidates(conn, limit=n * 3)
    out: list[dict] = []
    async with httpx.AsyncClient(timeout=15.0) as http:
        for c in candidates:
            if len(out) >= n:
                break
            url = c.get("preview_url")
            if not url:
                url = await resolve_preview_url(http, c["isrc"], c["title"], c["artist"])
                if url:
                    set_track_preview_url(conn, c["track_id"], url)
            if url:
                out.append({
                    "track_id": c["track_id"], "title": c["title"], "artist": c["artist"],
                    "album_cover": c["album_cover"], "preview_url": url,
                })
    return {"tracks": out}
```

- [ ] **Step 7: 라우터 등록** — `src/mrms/api/main.py` import 블록에 `from mrms.api.landing import router as landing_router` + include 블록에 `app.include_router(landing_router)`.

- [ ] **Step 8: 통과 확인 + lint**
Run: `.venv/bin/pytest tests/api/test_landing.py -v` → PASS (3).
Run: `.venv/bin/ruff check src/mrms/ingest/preview.py src/mrms/db/landing.py src/mrms/api/landing.py tests/api/test_landing.py`.

- [ ] **Step 9: Commit**
```bash
git add prisma/migrations/20260617120000_add_track_previewurl/migration.sql src/mrms/ingest/preview.py src/mrms/db/landing.py src/mrms/api/landing.py src/mrms/api/main.py tests/api/test_landing.py
git commit -m "feat(landing): preview-tracks API (Track.previewUrl + Deezer/iTunes write-through resolve)"
```

---

### Task 2: 프론트 — PreviewSpectrum + LandingHero + api 클라

**Files:**
- Create: `web/src/lib/api/landing.ts`
- Create: `web/src/components/landing/PreviewSpectrum.tsx`
- Create: `web/src/components/landing/LandingHero.tsx`

- [ ] **Step 1: api 클라** — `web/src/lib/api/landing.ts`
```ts
import { apiFetch } from "./http";

export interface PreviewTrack {
  track_id: string;
  title: string;
  artist: string;
  album_cover: string | null;
  preview_url: string;
}

export async function fetchPreviewTracks(n = 5): Promise<PreviewTrack[]> {
  const r = await apiFetch(`/api/landing/preview-tracks?n=${n}`, {}, "preview tracks");
  return ((await r.json()) as { tracks: PreviewTrack[] }).tracks;
}
```

- [ ] **Step 2: `PreviewSpectrum`** — `web/src/components/landing/PreviewSpectrum.tsx`
(generic `<audio>` analyser, `@/lib/spectrum` 재사용. AudioContext는 active=true(유저 제스처 후) 시 1회 생성.)
```tsx
"use client";

import { useEffect, useRef } from "react";

import { BAR_COUNT, binsToBarHeights } from "@/lib/spectrum";

const MIN_VISIBLE_PCT = 2;
const VSCALE = 1.2;

type Ctx = { ctx: AudioContext; analyser: AnalyserNode };

export function PreviewSpectrum({
  audioRef,
  active,
}: {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  active: boolean;
}) {
  const barRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const heightsRef = useRef<number[]>(Array.from({ length: BAR_COUNT }, () => 0));
  const ctxRef = useRef<Ctx | null>(null);

  useEffect(() => {
    if (!active) return;
    const el = audioRef.current;
    if (!el) return;

    if (!ctxRef.current) {
      try {
        const W = window as typeof window & { webkitAudioContext?: typeof AudioContext };
        const AC = window.AudioContext ?? W.webkitAudioContext;
        if (!AC) return;
        const ctx = new AC();
        const src = ctx.createMediaElementSource(el); // element당 1회
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = 0;
        analyser.minDecibels = -90;
        analyser.maxDecibels = -10;
        src.connect(analyser);
        analyser.connect(ctx.destination); // 필수(안 하면 무음)
        ctxRef.current = { ctx, analyser };
      } catch {
        return; // Web Audio 미지원/CORS 등 → 스펙트럼만 생략(오디오는 element가 재생)
      }
    }

    const { ctx, analyser } = ctxRef.current;
    if (ctx.state === "suspended") void ctx.resume();
    const bins = new Uint8Array(analyser.frequencyBinCount);
    let frameId = 0;
    let stopped = false;

    const tick = () => {
      if (stopped) return;
      analyser.getByteFrequencyData(bins);
      const heights = binsToBarHeights(bins, heightsRef.current);
      heightsRef.current = heights;
      for (let i = 0; i < BAR_COUNT; i++) {
        const b = barRefs.current[i];
        if (b) b.style.height = `${Math.min(100, Math.max(MIN_VISIBLE_PCT, heights[i] * 100 * VSCALE))}%`;
      }
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => {
      stopped = true;
      cancelAnimationFrame(frameId);
    };
  }, [active, audioRef]);

  return (
    <div aria-hidden className="flex items-end justify-center gap-[2px] h-full w-full pointer-events-none">
      {Array.from({ length: BAR_COUNT }, (_, i) => (
        <span
          key={i}
          ref={(n) => {
            barRefs.current[i] = n;
          }}
          className="block flex-1 max-w-[10px] rounded-t-[1px] bg-(--mrms-rust)"
          style={{ height: `${MIN_VISIBLE_PCT}%` }}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: `LandingHero`** — `web/src/components/landing/LandingHero.tsx`
(단일 `<audio crossOrigin="anonymous">`, src 교체로 5곡 순환. "플레이 허용" 게이트 후 재생+스펙트럼. 커버 배경 + 메타 + 컨트롤.)
```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Play, SkipForward } from "lucide-react";

import { AlbumArt } from "@/components/mrms/AlbumArt";
import { fetchPreviewTracks, type PreviewTrack } from "@/lib/api/landing";
import { PreviewSpectrum } from "./PreviewSpectrum";

export function LandingHero() {
  const [tracks, setTracks] = useState<PreviewTrack[]>([]);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    fetchPreviewTracks(5).then(setTracks).catch(() => setTracks([]));
  }, []);

  const current = tracks[idx];

  const play = (t: PreviewTrack) => {
    const el = audioRef.current;
    if (!el) return;
    el.src = t.preview_url;
    el.play().then(() => setPlaying(true)).catch(() => {});
  };

  const allowPlay = () => {
    if (current) play(current);
  };
  const next = () => {
    if (tracks.length < 2) return;
    setIdx((i) => (i + 1) % tracks.length);
  };

  // 곡 전환(재생 중일 때만 자동 이어 재생)
  useEffect(() => {
    if (playing && current) play(current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  return (
    <section className="relative h-[clamp(300px,46vh,460px)] overflow-hidden border-b border-(--mrms-ink) bg-(--mrms-ink)">
      {current && (
        <div className="absolute inset-0 opacity-60">
          <AlbumArt
            artist={current.artist}
            album={null}
            initialUrl={current.album_cover}
            className="w-full h-full object-cover scale-110 blur-md"
          />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-(--mrms-ink) via-(--mrms-ink)/55 to-(--mrms-ink)/20" />

      {/* 스펙트럼(하단) */}
      <div className="absolute left-0 right-0 bottom-0 h-24 px-6 md:px-14 opacity-90">
        <PreviewSpectrum audioRef={audioRef} active={playing} />
      </div>

      {/* 메타 + 컨트롤 */}
      <div className="absolute left-6 md:left-14 bottom-8 right-6 text-(--mrms-paper)">
        <div className="font-mono text-[10px] tracking-editorial uppercase opacity-80">
          Featured today
        </div>
        <div className="font-display font-bold text-[clamp(28px,5vw,48px)] leading-[1.02] mt-1 truncate">
          {current?.title ?? "MRMS"}
        </div>
        <div className="font-mono text-[12px] opacity-85 mt-1 truncate">
          {current?.artist ?? "music recommendation, reimagined"}
        </div>
        <div className="mt-4 flex items-center gap-3">
          {!playing ? (
            <button
              onClick={allowPlay}
              disabled={!current}
              className="inline-flex items-center gap-2 bg-(--mrms-rust) text-(--mrms-paper) px-4 py-2 font-mono text-[11px] tracking-editorial uppercase border-0 cursor-pointer disabled:opacity-40"
            >
              <Play className="size-3.5 fill-current" /> 플레이 허용
            </button>
          ) : (
            <button
              onClick={next}
              className="inline-flex items-center gap-2 bg-(--mrms-paper)/15 text-(--mrms-paper) px-4 py-2 font-mono text-[11px] tracking-editorial uppercase border border-(--mrms-paper)/30 cursor-pointer hover:bg-(--mrms-paper)/25"
            >
              <SkipForward className="size-3.5" /> 다음 곡
            </button>
          )}
        </div>
      </div>

      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={audioRef} onEnded={next} preload="none" crossOrigin="anonymous" />
    </section>
  );
}
```
> 주: `crossOrigin="anonymous"`로 cross-origin preview를 analyser가 읽게 함. CDN이 CORS 미허용이면 analyser는 0을 반환(오디오는 재생) → 스펙트럼 평탄. 그래도 오디오·UI는 정상 동작.

- [ ] **Step 4: 타입체크** — Run: `cd "/Volumes/MacExtend 1/MRMS_FN/web" && npx tsc --noEmit -p tsconfig.json` → 에러 없음.

- [ ] **Step 5: Commit**
```bash
cd "/Volumes/MacExtend 1/MRMS_FN"
git add web/src/lib/api/landing.ts web/src/components/landing/PreviewSpectrum.tsx web/src/components/landing/LandingHero.tsx
git commit -m "feat(landing): PreviewSpectrum(generic audio analyser) + LandingHero(autoplay 게이트, 5곡 순환)"
```

---

### Task 3: 루트 분기 + getServerSideUserOptional + 마케팅 랜딩(로그아웃)

**Files:**
- Modify: `web/src/lib/server/auth.ts` (`getServerSideUserOptional` 추가)
- Modify: `web/src/app/page.tsx` (redirect 제거 → 분기)
- Create: `web/src/components/landing/HomeMarketing.tsx`

- [ ] **Step 1: non-redirect 유저 헬퍼** — `web/src/lib/server/auth.ts`에 추가
(기존 `getServerSideUser`를 복제하되 미인증/401 시 redirect 대신 `null` 반환. 기존 fetch+authHeaders 패턴 그대로, 단 `redirect()` 호출 제거하고 401/throw를 catch→null.)
```ts
export async function getServerSideUserOptional(): Promise<UserInfo | null> {
  try {
    const headers = await authHeaders();
    if (!headers) return null; // 세션 쿠키 없음
    const res = await fetch(`${API_BASE}/api/user/me`, { headers, cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as UserInfo;
  } catch {
    return null;
  }
}
```
> ⚠️ 구현 시 `getServerSideUser`의 실제 내부(엔드포인트 경로 `/api/user/me` 등, `authHeaders`/`API_BASE` 심볼, `UserInfo` 타입)를 그 파일에서 그대로 가져와 미러링하라. redirect만 제거하고 null 반환으로 바꾸는 게 핵심.

- [ ] **Step 2: 루트 분기** — `web/src/app/page.tsx` (전체 교체)
```tsx
import { getServerSideUserOptional } from "@/lib/server/auth";
import { HomeMarketing } from "@/components/landing/HomeMarketing";
import { HomeLoggedIn } from "@/components/landing/HomeLoggedIn";

export default async function RootPage() {
  const user = await getServerSideUserOptional();
  if (!user) return <HomeMarketing />;
  return <HomeLoggedIn user={user} />;
}
```
> `HomeLoggedIn`은 Task 4에서 생성. 이 Task에서 page.tsx가 둘 다 import하므로, Task 4 전엔 빌드가 깨질 수 있어 **Task 3에서 `HomeLoggedIn` 최소 stub**(`web/src/components/landing/HomeLoggedIn.tsx`)을 함께 만들어 빌드 통과시키고 Task 4에서 채운다:
```tsx
// web/src/components/landing/HomeLoggedIn.tsx (Task 3 stub — Task 4에서 구현)
import type { UserInfo } from "@/lib/server/auth";
import { LandingHero } from "./LandingHero";
export function HomeLoggedIn({ user }: { user: UserInfo }) {
  return (
    <div>
      <LandingHero />
      <div className="px-6 md:px-14 py-8 font-mono text-[11px] tracking-editorial uppercase text-(--mrms-ink-mute)">
        Welcome, {user.displayName ?? user.email}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: `HomeMarketing`** — `web/src/components/landing/HomeMarketing.tsx`
```tsx
import Link from "next/link";

import { LandingHero } from "./LandingHero";

const FEATURES = [
  { n: "①", t: "추천", d: "임베딩 기반 취향 최근접 추천" },
  { n: "②", t: "무드 / 상황", d: "텍스트로 적으면 그 장면에 맞는 음악" },
  { n: "③", t: "플레이리스트", d: "어디서나 드래그로 담고 공유" },
];

export function HomeMarketing() {
  return (
    <div className="min-h-screen bg-(--mrms-bg)">
      <header className="flex justify-between items-baseline px-6 md:px-14 py-3 border-b border-(--mrms-ink)">
        <span className="font-display font-bold text-[15px] text-(--mrms-ink)">MRMS</span>
        <Link
          href="/login"
          className="font-mono text-[10px] tracking-editorial uppercase bg-(--mrms-rust) text-(--mrms-paper) px-3 py-1.5 no-underline"
        >
          시작하기
        </Link>
      </header>

      <LandingHero />

      <section className="px-6 md:px-14 py-12 max-w-[1100px]">
        <div className="font-mono text-[10px] tracking-editorial uppercase text-(--mrms-ink-mute)">
          your taste, in sound
        </div>
        <h1 className="font-display font-light text-[clamp(36px,7vw,72px)] leading-[1.0] text-(--mrms-ink) mt-2">
          취향을 <em className="font-display italic text-(--mrms-rust)">재생</em>하다
        </h1>
        <p className="font-mono text-[12px] text-(--mrms-ink-soft) leading-relaxed mt-5 max-w-[520px]">
          Tidal · Spotify · YouTube를 한 곳에서. 임베딩 기반 추천과 무드로, 당신의 취향을 읽습니다.
        </p>
        <Link
          href="/login"
          className="inline-block mt-6 bg-(--mrms-rust) text-(--mrms-paper) px-5 py-2.5 font-mono text-[11px] tracking-editorial uppercase no-underline"
        >
          로그인하고 시작 →
        </Link>

        <div className="grid sm:grid-cols-3 gap-px bg-(--mrms-rule) border border-(--mrms-rule) mt-12">
          {FEATURES.map((f) => (
            <div key={f.t} className="bg-(--mrms-bg) px-5 py-6">
              <div className="font-mono text-[11px] text-(--mrms-rust)">{f.n}</div>
              <div className="font-display font-semibold text-[16px] text-(--mrms-ink) mt-1">{f.t}</div>
              <div className="font-mono text-[10px] text-(--mrms-ink-soft) mt-1 leading-relaxed">{f.d}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 4: 타입체크 + 빌드** — Run:
```bash
cd "/Volumes/MacExtend 1/MRMS_FN/web" && npx tsc --noEmit -p tsconfig.json && pnpm build 2>&1 | grep -E "Compiled successfully|Failed|Error:" | head -1
```
Expected: 에러 없음, `Compiled successfully`. (로그아웃 상태에서 `/`가 마케팅 랜딩 렌더.)

- [ ] **Step 5: Commit**
```bash
cd "/Volumes/MacExtend 1/MRMS_FN"
git add web/src/lib/server/auth.ts web/src/app/page.tsx web/src/components/landing/HomeMarketing.tsx web/src/components/landing/HomeLoggedIn.tsx
git commit -m "feat(landing): 루트 인증분기(getServerSideUserOptional) + HomeMarketing(로그아웃)"
```

---

### Task 4: 로그인 개인화 홈 (퀵스탯 + 큐레이션 피드)

**Files:**
- Modify: `web/src/components/landing/HomeLoggedIn.tsx` (stub → 구현)
- Create: `web/src/components/landing/HomeStats.tsx` (퀵스탯, 플리 수 client fetch)

- [ ] **Step 1: 퀵스탯(client)** — `web/src/components/landing/HomeStats.tsx`
(persona/liked는 서버 props, 플리 수는 client fetch. 무드 진입 링크.)
```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { getUserPlaylists } from "@/lib/api";

export function HomeStats({
  personas,
  likedTracks,
}: {
  personas: number;
  likedTracks: number;
}) {
  const [playlists, setPlaylists] = useState<number | null>(null);
  useEffect(() => {
    getUserPlaylists()
      .then((r) => setPlaylists(r.playlists.length))
      .catch(() => setPlaylists(null));
  }, []);

  const Cell = ({ label, value, href }: { label: string; value: string; href?: string }) => {
    const body = (
      <div className="bg-(--mrms-bg) px-4 py-3">
        <div className="font-mono text-[9px] tracking-editorial uppercase text-(--mrms-ink-mute)">{label}</div>
        <div className="font-display font-bold text-[20px] text-(--mrms-ink) mt-0.5">{value}</div>
      </div>
    );
    return href ? <Link href={href} className="no-underline block hover:bg-(--mrms-paper)">{body}</Link> : body;
  };

  return (
    <div className="grid grid-cols-4 gap-px bg-(--mrms-rule) border border-(--mrms-rule)">
      <Cell label="personas" value={String(personas)} />
      <Cell label="liked" value={String(likedTracks)} />
      <Cell label="playlists" value={playlists == null ? "—" : String(playlists)} href="/pgt" />
      <Cell label="mood" value="→" href="/situation" />
    </div>
  );
}
```
> `getUserPlaylists`·`/pgt`·`/situation` 라우트는 그라운딩 확인됨. 실제 라우트가 다르면 nav.ts 기준으로 교체.

- [ ] **Step 2: `HomeLoggedIn` 구현** — `web/src/components/landing/HomeLoggedIn.tsx` (stub 교체)
(서버 컴포넌트. `getServerSideMrt`로 피드 데이터 — 로그인 상태라 redirect 안 탐. 히어로 + 퀵스탯 + 추천/신곡/앨범 섹션.)
```tsx
import { getServerSideMrt, type UserInfo } from "@/lib/server/auth";
import { AlbumArt } from "@/components/mrms/AlbumArt";

import { LandingHero } from "./LandingHero";
import { HomeStats } from "./HomeStats";

function SectionHeader({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div className="flex justify-between items-baseline pb-2 border-b border-(--mrms-ink) mb-4 mt-10">
      <span className="font-mono text-[10px] tracking-editorial uppercase text-(--mrms-ink-mute)">{kicker}</span>
      <span className="font-display font-bold text-[18px] text-(--mrms-ink)">{title}</span>
    </div>
  );
}

export async function HomeLoggedIn({ user }: { user: UserInfo }) {
  const mrt = await getServerSideMrt();
  const albums = (mrt.recommended_albums ?? []).slice(0, 12);
  const newRel = (mrt.recommended_new_releases ?? []).slice(0, 12);

  return (
    <div className="min-h-screen bg-(--mrms-bg)">
      <LandingHero />
      <div className="px-6 md:px-14 py-8 max-w-[1200px]">
        <div className="font-mono text-[10px] tracking-editorial uppercase text-(--mrms-ink-mute) mb-3">
          Welcome back, {user.displayName ?? user.email}
        </div>
        <HomeStats personas={user.personas_count} likedTracks={user.user_tracks_count} />

        {albums.length > 0 && (
          <>
            <SectionHeader kicker="for you" title="추천 앨범" />
            <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
              {albums.map((a) => (
                <div key={a.album_id} className="min-w-0">
                  <AlbumArt artist={a.artist} album={a.title} initialUrl={a.cover_url} className="aspect-square mb-2" />
                  <div className="font-display text-[13px] font-semibold truncate text-(--mrms-ink)">{a.title}</div>
                  <div className="font-mono text-[10px] text-(--mrms-ink-soft) truncate">{a.artist}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {newRel.length > 0 && (
          <>
            <SectionHeader kicker="new" title="신곡" />
            <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
              {newRel.map((t) => (
                <div key={t.track_id} className="min-w-0">
                  <AlbumArt artist={t.artist} album={t.album_title} initialUrl={t.album_cover} className="aspect-square mb-2" />
                  <div className="font-display text-[13px] font-semibold truncate text-(--mrms-ink)">{t.title}</div>
                  <div className="font-mono text-[10px] text-(--mrms-ink-soft) truncate">{t.artist}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
```
> `mrt.recommended_albums`/`recommended_new_releases`의 정확한 필드명(album_id/title/artist/cover_url, track_id/title/artist/album_cover/album_title)은 `getServerSideMrt` 반환 타입(`MrtLatestResponse`)에서 확인해 맞춰라. 없는 필드면 그 섹션 생략 가능. `ModalTrackList`로 재생 리스트가 필요하면 추가(범위 내 선택).

- [ ] **Step 3: 타입체크 + 빌드** — Run:
```bash
cd "/Volumes/MacExtend 1/MRMS_FN/web" && npx tsc --noEmit -p tsconfig.json && pnpm build 2>&1 | grep -E "Compiled successfully|Failed|Error:" | head -1
```
Expected: 에러 없음, `Compiled successfully`.

> 수동 검증: 로그인 상태 `/` → 히어로(플레이 허용→사운드+스펙트럼) + 퀵스탯 + 추천/신곡 섹션. 로그아웃 `/` → 마케팅 랜딩.

- [ ] **Step 4: Commit**
```bash
cd "/Volumes/MacExtend 1/MRMS_FN"
git add web/src/components/landing/HomeLoggedIn.tsx web/src/components/landing/HomeStats.tsx
git commit -m "feat(landing): 로그인 홈 — 퀵스탯 + 추천/신곡 큐레이션 피드"
```

---

## 수동 검증 (전체 완료 후, dev)

1. **비로그인 `/`**: 마케팅 랜딩(헤더+히어로+가치/CTA+기능3행). "로그인하고 시작"→`/login`.
2. **히어로 재생**: "플레이 허용" 클릭 → preview 사운드 + 스펙트럼 애니메이션(CORS 허용 CDN). "다음 곡" 순환. (CORS 막히면 사운드만, 스펙트럼 평탄 — 정상 degradation.)
3. **로그인 `/`**: 히어로 + 퀵스탯(페르소나·좋아요·플리·무드) + 추천 앨범/신곡 섹션.
4. **preview API**: `/api/landing/preview-tracks?n=5`가 preview_url 채워진 곡 반환(첫 호출 resolve, 이후 캐시).

---

## Self-Review

**Spec coverage:** 루트 분기(Task 3 getServerSideUserOptional+page) / 스펙트럼 히어로(Task 2 PreviewSpectrum+LandingHero) / preview 5곡 resolve(Task 1) / autoplay 게이트(Task 2 allowPlay) / 로그인 홈=히어로+퀵스탯+피드(Task 4) / 비로그인=히어로+CTA+기능3행(Task 3) / 자산 재사용(@/lib/spectrum·AlbumArt·MRT 데이터·Card) / Track.previewUrl write-through(Task 1) — 전부 매핑. 커버 업로드·개인화 히어로곡은 스펙대로 범위 밖.

**Placeholder scan:** 모든 스텝 실제 코드/명령. 단 명시적 "그라운딩 확인 후 맞춰라" 지점 3곳(의도적, placeholder 아님): (a) `getServerSideUserOptional`은 기존 `getServerSideUser` 내부(엔드포인트·authHeaders·UserInfo)를 미러링, (b) `MrtLatestResponse`의 recommended_albums/new_releases 정확한 필드명, (c) `/pgt`·`/situation` 라우트 — 모두 "해당 파일에서 확인" 지시. 그 외 placeholder 없음.

**Type consistency:** 백엔드 `pick_preview_candidates -> list[dict]`(track_id/title/artist/isrc/preview_url/album_cover...) ↔ 엔드포인트 사용 일치. 엔드포인트 응답 `{tracks:[{track_id,title,artist,album_cover,preview_url}]}` ↔ 프론트 `PreviewTrack` ↔ `fetchPreviewTracks` 일치. `PreviewSpectrum({audioRef, active})` ↔ LandingHero 사용 일치. `BAR_COUNT`/`binsToBarHeights(bins, prev)` 시그니처 ↔ 기존 `@/lib/spectrum` 일치(그라운딩 확인). `getServerSideUserOptional(): UserInfo|null` ↔ page.tsx 분기 일치. `HomeLoggedIn({user: UserInfo})` ↔ page 호출 + Task3 stub/Task4 구현 시그니처 일치. `HomeStats({personas, likedTracks})` ↔ HomeLoggedIn 호출 일치.
