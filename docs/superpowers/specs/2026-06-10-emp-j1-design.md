# Sub-project J1: EMP — External Music Pool 기반 catalog 확장 (Design)

**날짜**: 2026-06-10
**상태**: 구현 완료 — as-built 반영 (핫픽스 포함, 2026-06-10)
**범위**: Tidal/Spotify editorial playlist 자동 임포터 + EMP 풀 + MRT 검색 EMP 한정 + MERT 파이프라인 재사용 + scheduler + 관리 페이지 + /emp 브라우즈 페이지(hotfix 추가).

J는 catalog 확장 전체 umbrella sub-project. **J1**은 그 첫 단계: EMP 인프라 + 2 API 기반 플랫폼.
J2: 웹스크래핑 (Apple Music + iTunes), J3: Melon + FLO, J4: Deezer + Amazon Music. 모두 J1 인프라 위에서.

## 1. Goal + 사용자 의도

현재 catalog 165k는 사용자 청취 import + Tidal sync 위주 → 본인 취향(vocal jazz, 한국 가요)에 진짜 가까운 곡 부족 → 추천 quality 낮음.

핵심 의도:
- catalog을 **공격적으로 확장**해서 "되도록 많이 보여주고 많이 넣는다"
- editorial playlist (이미 curated된 풀)에서 가져옴 → 가난한 catalog 보강
- 7 플랫폼 단계 적용. J1 = Tidal + Spotify (API). 나머지는 후속

contents_constructure.md 명세:
- EMP = "각 스트리밍 플랫폼에서 추천하는 플레이리스트, 매거진 트랙들"
- "MRT는 EMP + PGT 기반" — MRT가 EMP만 검색하도록 변경

## 2. Success Criteria

- [x] DB 마이그레이션 적용 (EMPSource + Track.inEmp + trigger + IngestionRun)
- [x] `python scripts/import_emp.py --platform tidal` 동작, EMP 풀 늘어남
- [x] Spotify 동일
- [x] 신규 EMP 트랙이 `02_download_audio.py` → `03_extract_embeddings.py` → `07_load_to_db.py`로 자동 픽업
- [x] `search_for_persona`가 EMP 한정 검색 (WHERE t.inEmp = TRUE 추가)
- [x] systemd timer로 야간 자동 실행, 결과 IngestionRun에 기록
- [x] `/admin/emp` 관리 페이지 — stats + recent runs + manual trigger
- [x] mrt_latest top_tracks_n 20 → 50
- [x] 신규 + 기존 테스트 모두 통과

핫픽스로 추가된 deliverable (계획 외, as-built):

- [x] Setting / EMPSection / EMPSectionItem 마이그레이션 (4.1 참고)
- [x] `GET/PUT /api/admin/emp/settings` — Tidal 토큰/소스 관리 (whitelist + 토큰 마스킹, 9.1 참고)
- [x] `/emp` 브라우즈 페이지 — EMPSection 기반 섹션 슬라이더 + 아이템별 트랙 모달 (9.3 참고)

## 3. Architecture

```
[Importers — 신규]                          [MERT 파이프라인 — 재사용]
scripts/import_emp.py      ──┐
  src/mrms/emp/tidal.py      ┼─→ Track + EMPSource → 02_download_audio.py
  src/mrms/emp/spotify.py  ──┤   (Track.inEmp=TRUE)   03_extract_embeddings.py
                             │   trigger              07_load_to_db.py
                             │
[scheduler]                  └─→ IngestionRun ──→ TrackEmbedding 생성 (modelVersion='our-v1.0')
systemd timer
nightly 03:00
(scripts/run_emp_pipeline.py → src/mrms/emp/runner.py)


[MRT 검색 변경]
search_for_persona: WHERE t.inEmp = TRUE 추가
                    (165k 전체 → EMP 풀로 한정)


[관리 페이지]
/admin/emp
  ├ EMP Status (총 트랙, EMP 포함, 임베딩 완료, 플랫폼별)
  ├ Recent runs (IngestionRun 최근 50건)
  ├ Settings (tidal_x_token / tidal_emp_sources — Setting 테이블, 9.1 참고)
  └ [Trigger import now] 버튼 → POST /api/admin/emp/trigger


[브라우즈 페이지 — hotfix 추가, 9.3 참고]
/emp ("Tidal is Good")
  └ EMPSection별 슬라이더 → 아이템 클릭 → 트랙 모달
     GET /api/emp/sections · GET /api/emp/items/{type}/{id}/tracks
```

## 4. DB Schema

실제 적용 마이그레이션 `prisma/migrations/20260610100000_add_emp/migration.sql` 기준:

```sql
-- EMP 소스 추적 (한 트랙이 여러 소스에서 올 수 있음)
CREATE TABLE IF NOT EXISTS "EMPSource" (
  id           TEXT PRIMARY KEY,
  "trackId"    TEXT NOT NULL REFERENCES "Track"(id) ON DELETE CASCADE,
  platform     TEXT NOT NULL,                  -- 'tidal' | 'spotify'
  source_type  TEXT NOT NULL,                   -- 'editorial_playlist' | 'editorial_album' | 'editorial_mix'
  source_id    TEXT NOT NULL,                   -- Tidal: '{kind}:{ident}', Spotify: playlist ID
  source_name  TEXT,                            -- 'New Music Friday', 'Rising'
  "importedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("trackId", platform, source_id)
);
-- 주의: 디자인 초안의 idx_empsource_track 인덱스는 출하본에서 제외됨 (필요해지면 후속 마이그레이션으로)

-- 빠른 필터링용 denormalized 컬럼
ALTER TABLE "Track" ADD COLUMN IF NOT EXISTS "inEmp" BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_track_emp ON "Track"("inEmp") WHERE "inEmp" = TRUE;

-- EMPSource INSERT 시 Track.inEmp = TRUE,
-- DELETE 시 마지막 EMPSource row가 사라지면 Track.inEmp = FALSE 리셋
CREATE OR REPLACE FUNCTION sync_track_in_emp() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE "Track" SET "inEmp" = FALSE
    WHERE id = OLD."trackId"
      AND NOT EXISTS (
        SELECT 1 FROM "EMPSource" WHERE "trackId" = OLD."trackId"
      );
    RETURN OLD;
  END IF;
  UPDATE "Track" SET "inEmp" = TRUE WHERE id = NEW."trackId";
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_emp_source_inserted ON "EMPSource";
CREATE TRIGGER trg_emp_source_inserted
  AFTER INSERT OR DELETE ON "EMPSource"
  FOR EACH ROW EXECUTE FUNCTION sync_track_in_emp();

-- 파이프라인 실행 이력
CREATE TABLE IF NOT EXISTS "IngestionRun" (
  id            TEXT PRIMARY KEY,
  "startedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "finishedAt"  TIMESTAMPTZ,
  status        TEXT NOT NULL,             -- 'running' | 'success' | 'partial' (runner 종료 상태는 success/partial)
  platform      TEXT,                       -- 'all' | 'tidal' | 'spotify'
  stages        JSONB NOT NULL DEFAULT '[]'::jsonb,
  "triggeredBy" TEXT NOT NULL DEFAULT 'scheduler'
);
CREATE INDEX IF NOT EXISTS idx_ingestion_started ON "IngestionRun"("startedAt" DESC);
```

`stages` JSON 형식 (서브프로세스 stage는 stdout/stderr 마지막 2000자도 기록):
```json
[
  {"stage": "import_tidal", "status": "success", "tracks_new": 42, "tracks_existing": 18, "duration_ms": 5230, "error": null},
  {"stage": "import_spotify", "status": "success", "tracks_new": 28, "tracks_existing": 12, "duration_ms": 4100, "error": null},
  {"stage": "download_audio", "status": "success", "duration_ms": 180000, "stdout": "(마지막 2000자)", "stderr": "", "error": null},
  {"stage": "extract_embeddings", "status": "success", "duration_ms": 240000, "stdout": "…", "stderr": "", "error": null},
  {"stage": "load_to_db", "status": "success", "duration_ms": 8000, "stdout": "…", "stderr": "", "error": null}
]
```

### 4.1 Setting + EMPSection/EMPSectionItem (hotfix로 추가된 마이그레이션)

Tidal importer가 client_credentials에서 웹 API + X-Tidal-Token으로 전환되면서 (5.2 참고)
토큰/소스를 DB에서 관리할 `Setting` 테이블과, /emp 브라우즈(9.3)를 위한 `EMPSection` 계층이 추가됨.

```sql
-- prisma/migrations/20260610200000_add_setting/migration.sql
CREATE TABLE IF NOT EXISTS "Setting" (
  key         TEXT PRIMARY KEY,
  value       TEXT,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- prisma/migrations/20260610300000_add_emp_section/migration.sql
CREATE TABLE IF NOT EXISTS "EMPSection" (
  id              TEXT PRIMARY KEY,
  platform        TEXT NOT NULL,
  "sectionKey"    TEXT NOT NULL,            -- 예: 'THE_HITS'
  "displayTitle"  TEXT,
  "displayOrder"  INTEGER NOT NULL DEFAULT 0,
  "lastSyncedAt"  TIMESTAMPTZ,
  UNIQUE (platform, "sectionKey")
);

CREATE TABLE IF NOT EXISTS "EMPSectionItem" (
  id              TEXT PRIMARY KEY,
  "sectionId"     TEXT NOT NULL REFERENCES "EMPSection"(id) ON DELETE CASCADE,
  "itemType"      TEXT NOT NULL,             -- 'playlist' | 'album' | 'mix'
  "itemId"        TEXT NOT NULL,
  title           TEXT,
  "coverUrl"      TEXT,
  "displayOrder"  INTEGER NOT NULL DEFAULT 0,
  "lastSeenAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("sectionId", "itemType", "itemId")
);

CREATE INDEX IF NOT EXISTS idx_emp_section_item_section ON "EMPSectionItem"("sectionId", "displayOrder");
```

헬퍼:
- `src/mrms/db/settings.py` — `get_setting` / `set_setting` (value None → DELETE) / `list_settings`
- `src/mrms/db/emp_section.py` — `upsert_section` / `upsert_section_item` / `list_sections_with_items` / `prune_stale_items`

## 5. Importers (Adapter 패턴)

### 5.1 Base 클래스

실제 구현은 sync `upsert()` 메서드 대신 async 추상 메서드 + 모듈 레벨 `upsert_track_and_emp_source()` + `import_all()` 템플릿 메서드 형태:

```python
# src/mrms/emp/base.py
def upsert_track_and_emp_source(
    conn, isrc, title, artist, album_title, duration_ms,
    platform, platform_track_id, source_type, source_id, source_name,
) -> dict:
    """
    1. ISRC 있으면 → Track 조회 (있으면 재사용, 없으면 신규 INSERT)
    2. TrackPlatform upsert (platform, platformTrackId)
    3. EMPSource upsert (UNIQUE 충돌 시 skip; Track.inEmp는 trigger로 자동)
    Returns: {'track_id': ..., 'new': bool}
    """

class EMPImporter(ABC):
    platform: str  # 'tidal' | 'spotify'

    @abstractmethod
    async def fetch_editorial_playlists(self) -> list[dict]:
        """플랫폼의 editorial playlist 목록. Each: {id, name, source_type}."""

    @abstractmethod
    async def fetch_playlist_tracks(self, playlist_id: str) -> list[dict]:
        """한 playlist의 트랙들 (제목/아티스트/ISRC/플랫폼ID 등)."""

    async def import_all(self, conn) -> dict:
        """템플릿 메서드 — playlist 순회 + upsert (continue-on-error).
        Returns: {tracks_new, tracks_existing, playlists_processed, errors}."""
```

### 5.2 Tidal — tidal.com 웹 API + X-Tidal-Token (계획 변경됨)

> **변경 사유**: 당초 계획한 client_credentials grant (auth.tidal.com) + openapi.tidal.com/v2는
> editorial 컨텐츠 접근이 안 돼 **폐기**. 브라우저 DevTools로 관찰한 tidal.com 웹 API로 전환
> (raw 캡처: [plans/tidal_web_emp_api.md](../plans/tidal_web_emp_api.md)).

- **인증**: `X-Tidal-Token` 헤더. 토큰은 Setting `'tidal_x_token'`에서 로딩 — 없으면 graceful skip
  (`errors: ['no tidal_x_token']`, 트랙 0건).
- **소스 설정**: Setting `'tidal_emp_sources'`, 한 줄에 하나 (`#` 주석 허용):
  - `home/<SECTION>` — `/v2/home/pages/{SECTION}/view-all`에서 playlist/album/mix discovery
  - `playlist/<uuid>` — `/v1/playlists/{uuid}/items` (pagination)
  - `album/<id>` — `/v1/pages/album?albumId=`
  - `mix/<id>` — `/v1/pages/mix?mixId=`
  - 비어있으면 `DEFAULT_SOURCES` = `home/THE_HITS`, `home/POPULAR_PLAYLISTS`, `home/POPULAR_MIXES`, `home/LATEST_SPOTLIGHTED_TRACKS`
- **import_all override** (base 템플릿 미사용, 2-phase):
  - Phase 1: home 섹션 응답을 `_classify_item`/`_walk_classify`로 분류 → **EMPSection/EMPSectionItem upsert + stale prune** (→ /emp 브라우즈가 사용, 9.3)
  - Phase 2: 아이템별 트랙 fetch (`_walk_tracks` 휴리스틱) → `upsert_track_and_emp_source`
- **source_type**: `editorial_playlist` | `editorial_album` | `editorial_mix` (신규 2종), **source_id**: `'{kind}:{ident}'` 형식
- 커버 추출은 MEDIUM(640px) 우선 (`_pick_image_size` — LARGE 1500px는 카드용으로 과대)

```python
# src/mrms/emp/tidal.py
class TidalEMPImporter(EMPImporter):
    platform = "tidal"

    def __init__(self, conn: psycopg.Connection, token: str | None = None):
        self.token = token or get_setting(conn, "tidal_x_token")
        self._conn = conn
```

### 5.3 Spotify — 하드코딩 playlist 목록 (계획 변경됨)

> **변경 사유**: Spotify가 2024-11부터 신규 앱에 `/v1/browse/featured-playlists` 등 큐레이션
> endpoint를 차단 → editorial discovery 불가. 잘 알려진 public playlist ID를 직접 사용.

- `DEFAULT_PLAYLISTS` 하드코딩 10개 (Global Top 50, Today's Top Hits, RapCaviar, K-Pop Daebak 등)
- env `SPOTIFY_EMP_PLAYLISTS=id1,id2,...` (또는 `id:이름`)로 override 가능
- client_credentials는 playlist 트랙 fetch(`/v1/playlists/{id}/tracks`)에만 사용
- spotify-owned algorithmic playlist는 신규 앱에서 403 가능 → 해당 playlist만 skip (errors 기록)

```python
# src/mrms/emp/spotify.py
class SpotifyEMPImporter(EMPImporter):
    platform = "spotify"

    def __init__(self, client_id: str, client_secret: str): ...

    async def fetch_editorial_playlists(self):
        # _load_playlists_from_env() or DEFAULT_PLAYLISTS
        ...
```

### 5.4 CLI

```bash
# 한 플랫폼만
python scripts/import_emp.py --platform tidal

# 전체
python scripts/import_emp.py --platform all

# 특정 playlist만
python scripts/import_emp.py --platform spotify --playlist 37i9dQZF1DXcBWIGoYBM5M
```

각 import 실행 시 `IngestionRun` row 생성 + stages에 결과 append.

## 6. MERT 파이프라인 재사용

기존 02/03/07 스크립트는 CSV 입력 기반. EMP 신규 트랙 자동 픽업하도록 SQL 쿼리 변경:

```sql
-- 02_download_audio.py가 처리할 대상
SELECT t.id, t.title, ar.name AS artist, t.isrc, t."albumId",
       tp_tidal."platformTrackId" AS tidal_id,
       tp_spotify."platformTrackId" AS spotify_id
FROM "Track" t
JOIN "Artist" ar ON ar.id = t."artistId"
LEFT JOIN "TrackPlatform" tp_tidal
  ON tp_tidal."trackId" = t.id AND tp_tidal.platform = 'tidal'
LEFT JOIN "TrackPlatform" tp_spotify
  ON tp_spotify."trackId" = t.id AND tp_spotify.platform = 'spotify'
WHERE t."inEmp" = TRUE
  AND NOT EXISTS (
    SELECT 1 FROM "TrackEmbedding" te
    WHERE te."trackId" = t.id AND te."modelVersion" = 'our-v1.0'
  )
ORDER BY t."createdAt" DESC
LIMIT 1000;
```

스크립트 인터페이스:
- `02_download_audio.py --emp-only --limit N` — EMP에 있고 임베딩 없는 트랙 최대 N개 다운로드
- `03_extract_embeddings.py` — 다운로드된 .m4a 전부 처리 (이미 resumable)
- `07_load_to_db.py` — extract 된 .npy 전부 DB 적재

## 7. Scheduler

```ini
# scripts/systemd/mrms-emp-import.service
[Unit]
Description=MRMS EMP import + embedding pipeline
After=network.target docker.service

[Service]
Type=oneshot
User=mrms
Group=mrms
WorkingDirectory=/opt/mrms
EnvironmentFile=/opt/mrms/.env.production
ExecStart=/opt/mrms/.venv/bin/python scripts/run_emp_pipeline.py
TimeoutStartSec=4h
StandardOutput=journal
StandardError=journal
```

```ini
# scripts/systemd/mrms-emp-import.timer
[Unit]
Description=Run EMP import nightly at 03:00

[Timer]
OnCalendar=*-*-* 03:00:00
Persistent=true

[Install]
WantedBy=timers.target
```

`scripts/run_emp_pipeline.py` 한 사이클:
```python
1. importer 한 사이클 (tidal + spotify) → IngestionRun에 stages append
2. 02_download_audio.py --emp-only --limit 500
3. 03_extract_embeddings.py
4. 07_load_to_db.py
5. IngestionRun.status = success | failed (단계별 실패 누적)
```

각 stage 실패해도 다음 stage 시도 (continue-on-error). status는 전체 success/partial/failed로 마지막에 결정.

## 8. MRT 검색 변경

`src/mrms/recsys/mrt.py` `search_for_persona`:

```python
'''SELECT t.id, t.title, ar.name AS artist, t."albumId",
          1 - (e.embedding <=> %s) AS similarity
   FROM "TrackEmbedding" e
   JOIN "Track" t ON t.id = e."trackId"
   JOIN "Artist" ar ON ar.id = t."artistId"
   WHERE e."modelVersion" = %s
     AND t."inEmp" = TRUE                                      -- ★ 추가
     AND t.id NOT IN (
       SELECT "trackId" FROM "UserTrack" WHERE "userId" = %s
     )
   ORDER BY e.embedding <=> %s
   LIMIT %s'''
```

Cold start: EMP 풀이 작으면 결과 0개 가능. fallback 없이 그대로 반환 (UI는 "추천 없음" 표시).

`mrt_latest`의 `top_tracks_n` 기본값 **20 → 50** 동시 변경.

## 9. 관리 페이지

### 9.1 Backend

`src/mrms/api/admin_emp.py`:

```python
GET  /api/admin/emp/stats
  → {
      total_tracks: 165000,
      in_emp: 12450,
      with_embedding: 11800,
      by_platform: {tidal: 7200, spotify: 5800},
      last_run: {id, started_at, status, ...},
    }

GET  /api/admin/emp/runs?limit=50
  → [{id, started_at, finished_at, status, platform, stages, triggered_by}, ...]

POST /api/admin/emp/trigger
  body: {platform?: 'tidal' | 'spotify' | 'all'}
  → systemd 'mrms-emp-import.service' 단발 트리거 (sudo systemctl start)
  → IngestionRun row가 곧 만들어짐
  → returns: {message: 'triggered'}

# hotfix 추가 — Tidal 토큰/소스 설정 관리 (Setting 테이블, 4.1 참고)
GET  /api/admin/emp/settings
  → {settings: {
       tidal_x_token:     {present: true, preview: "…ab12"},     # MASKED_KEYS — '…' + 마지막 4자만 노출
       tidal_emp_sources: {present: true, value: "home/THE_HITS\n…"},  # 일반 키는 값 그대로
     }}

PUT  /api/admin/emp/settings
  body: {key, value}
  → key는 ALLOWED_SETTING_KEYS = ['tidal_x_token', 'tidal_emp_sources']만 허용 (그 외 400)
  → value가 null/빈 문자열이면 해당 키 삭제
  → returns: {message: 'saved', key}
```

권한: 본인만. MVP는 환경변수 `ADMIN_EMAIL`과 user.email 비교. (사용자별 role 필드는 별도 sub-project)

### 9.2 Frontend

`web/src/app/(dashboard)/admin/emp/page.tsx` — Editorial 스타일:

```
┌─ EMP Status ────────────────────────────────────────────┐
│ Total tracks       165,000                              │
│ In EMP             12,450  (with embedding 11,800 95%)  │
│ Tidal              7,200                                │
│ Spotify            5,800                                │
│                                                          │
│ [▶ Trigger import]   [↻ Refresh]                       │
└──────────────────────────────────────────────────────────┘

┌─ Settings (hotfix 추가 — EmpDashboard의 SettingsCard) ────┐
│ Tidal token    present (…ab12)        [저장] [삭제]       │
│ EMP sources    (textarea, home/THE_HITS …)   [저장]       │
└───────────────────────────────────────────────────────────┘

┌─ Recent runs ──────────────────────────────────────────┐
│ #abc123  06.10 03:00  ✓ success  Tidal +42, Spotify +28│
│ #def456  06.09 03:00  ✓ success  Tidal +35, Spotify +21│
│ #ghi789  06.08 03:00  ✗ partial  download_audio timeout│
│ ...                                                    │
└────────────────────────────────────────────────────────┘
```

각 row 클릭 → stages 상세 (펼치기) — 단계별 카운트/에러/duration.

Sidebar `nav.ts` Settings 그룹에 "EMP admin" 추가.

### 9.3 /emp 브라우즈 페이지 (사용자용 — hotfix 추가)

> 당초 "UI 장르/시기 섹션"은 Out of Scope였으나, Tidal importer가 home 섹션 구조를
> EMPSection/EMPSectionItem으로 그대로 들고 오게 되면서 섹션 기반 브라우즈 UI를 J1에서
> 함께 출시함. 장르/시기 **큐레이션**은 여전히 out of scope (13 참고).

Backend `src/mrms/api/emp_browse.py` (인증 필요, admin 아님):

```
GET /api/emp/sections?platform=tidal
  → {sections: [{platform, section_key, display_title, ...,
                 items: [{item_type, item_id, title, cover_url, ...}]}]}

GET /api/emp/items/{item_type}/{item_id}/tracks?limit=100
  → item_type: 'playlist' | 'album' | 'mix' (그 외 400)
  → EMPSource.source_id = '{item_type}:{item_id}' 매칭으로 트랙 조회
  → {tracks: [{track_id, title, artist, album_*, duration_ms, tidal_track_id, spotify_track_id}]}
```

Frontend — "Tidal is Good" 페이지 (섹션 슬라이더):

- `web/src/app/(dashboard)/emp/page.tsx`
- `web/src/components/emp/` — `EmpBrowse.tsx` / `SectionRow.tsx` (섹션 슬라이더) / `ItemTracksModal.tsx` (아이템 트랙 모달) 등
- `web/src/lib/api/emp.ts` — `fetchEmpSections` / `fetchEmpItemTracks`
- `web/src/lib/types.ts` — `EmpSection` / `EmpSectionItem` / `EmpItemTrack` / `EmpSettings`
- `web/src/lib/nav.ts` Sections 그룹에 `{ title: "EMP", href: "/emp", num: "§ 02", badge: "2.4k" }` 추가

## 10. Testing

- `tests/emp/test_base.py` — upsert 로직 (ISRC dedup, EMPSource UNIQUE, Track.inEmp trigger)
- `tests/emp/test_tidal.py` — 아이템 분류(`_classify_*` 단위), 커버 추출(imageUrl/cover ID/images dict), `_walk_classify` 재귀 중단, `_load_sources` 파싱/기본값, 토큰 없을 때 graceful skip
- `tests/emp/test_spotify.py` — DEFAULT_PLAYLISTS 반환, `SPOTIFY_EMP_PLAYLISTS` env override, 트랙 ISRC 추출
- `tests/emp/test_runner.py` — pipeline runner (모킹된 importer 사용)
- `tests/db/test_emp.py` — upsert_emp_source(inEmp trigger/dedup), stats 집계, run 생성/종료
- `tests/db/test_settings.py` — Setting get/set + bulk list
- `tests/db/test_emp_section.py` — 섹션/아이템 upsert idempotent, 정렬 조회, stale prune
- `tests/api/test_admin_emp.py` — stats/runs/trigger + settings GET/PUT (마스킹, 비허용 키 400)
- `tests/api/test_emp_browse.py` — sections 목록/auth, item tracks (invalid type 400, unknown id 빈 응답)
- `tests/recsys/test_mrt.py` (기존 확장) — `inEmp` 필터 적용 후 검색 동작
- 수동 e2e: prod에서 한 사이클 manually trigger → /admin/emp에서 결과 확인 → 본인 /mrt 추천 quality 변화

## 11. File Changes

| File | 변경 |
|---|---|
| `prisma/migrations/20260610100000_add_emp/migration.sql` (NEW) | EMPSource + Track.inEmp + trigger + IngestionRun |
| `prisma/migrations/20260610200000_add_setting/migration.sql` (NEW) | Setting 테이블 (hotfix) |
| `prisma/migrations/20260610300000_add_emp_section/migration.sql` (NEW) | EMPSection + EMPSectionItem (hotfix) |
| `src/mrms/emp/__init__.py` (NEW) | |
| `src/mrms/emp/base.py` (NEW) | EMPImporter base + upsert_track_and_emp_source |
| `src/mrms/emp/tidal.py` (NEW) | TidalEMPImporter (웹 API + X-Tidal-Token) |
| `src/mrms/emp/spotify.py` (NEW) | SpotifyEMPImporter (하드코딩 playlist 목록) |
| `src/mrms/emp/runner.py` (NEW) | run_pipeline + IngestionRun 기록 |
| `scripts/import_emp.py` (NEW) | CLI entry |
| `scripts/run_emp_pipeline.py` (NEW) | systemd timer 호출용 |
| `scripts/02_download_audio.py` | DB 쿼리 분기 추가 (`--emp-only --limit N`) |
| `src/mrms/recsys/mrt.py` | search_for_persona에 `AND t.inEmp = TRUE` |
| `src/mrms/api/main.py` | mrt_latest `top_tracks_n` 20 → 50, admin_emp + emp_browse 라우터 등록 |
| `src/mrms/api/admin_emp.py` (NEW) | stats / runs / trigger / settings 엔드포인트 |
| `src/mrms/api/emp_browse.py` (NEW) | /emp 브라우즈 API (sections, item tracks — hotfix) |
| `src/mrms/db/emp.py` (NEW) | EMP DB 헬퍼 (stats 집계, runs 조회) |
| `src/mrms/db/settings.py` (NEW) | Setting get/set/list 헬퍼 (hotfix) |
| `src/mrms/db/emp_section.py` (NEW) | EMPSection/EMPSectionItem 헬퍼 (hotfix) |
| `web/src/app/(dashboard)/admin/emp/page.tsx` (NEW) | 관리 페이지 |
| `web/src/components/admin/EmpDashboard.tsx` (NEW) | 관리 화면 (서브컴포넌트는 `web/src/components/admin/emp/` — SettingsCard/SectionsTree 등) |
| `web/src/app/(dashboard)/emp/page.tsx` (NEW) | /emp 브라우즈 페이지 (hotfix) |
| `web/src/components/emp/` (NEW) | 브라우즈 컴포넌트 — EmpBrowse/SectionRow/ItemTracksModal 등 (hotfix) |
| `web/src/lib/nav.ts` | Settings 그룹 "EMP admin" + Sections 그룹 "EMP" (/emp) 추가 |
| `web/src/lib/api/admin-emp.ts` (NEW) | fetch helpers |
| `web/src/lib/api/emp.ts` (NEW) | 브라우즈 fetch helpers (hotfix) |
| `web/src/lib/types.ts` | EmpStats/IngestionRun + EmpSettings/EmpSection/EmpSectionItem 타입 |
| `scripts/systemd/mrms-emp-import.service` (NEW) | |
| `scripts/systemd/mrms-emp-import.timer` (NEW) | |
| `tests/emp/{test_base,test_tidal,test_spotify,test_runner}.py` (NEW) | |
| `tests/db/{test_emp,test_settings,test_emp_section}.py` (NEW) | |
| `tests/api/{test_admin_emp,test_emp_browse}.py` (NEW) | |

## 12. Migration Path

1. DB 마이그레이션 (`apply_pending_migrations`)
2. Importer 작성 + 로컬 dev DB로 작은 sample (제한된 playlist 1개) 임포트 테스트
3. 02/03/07 통합 — `--emp-only` 동작 확인
4. MRT 검색 변경 + 기존 테스트 통과
5. Admin 엔드포인트 + Frontend 페이지 (Editorial 스타일)
6. systemd unit 추가 (laptop scripts/, 서버 등록은 manual)
7. CI/CD push → prod 자동 배포
8. Prod 서버:
   - systemd unit 복사 (`sudo cp /opt/mrms/scripts/systemd/mrms-emp-import.* /etc/systemd/system/`)
   - 일회성 trigger: `sudo systemctl start mrms-emp-import.service` → /admin/emp에서 결과 확인
   - 만족스러우면 timer enable: `sudo systemctl enable --now mrms-emp-import.timer`
9. 본인 계정 /mrt에서 추천 quality 변화 확인

## 13. Out of Scope (J1)

- **웹스크래핑** (Apple Music + iTunes → J2, Melon + FLO → J3, Deezer + Amazon → J4)
- **UI 장르/시기 큐레이션** — catalog 다양해진 후. (주의: 당초 "섹션 UI 전체"가 out of scope였으나, Tidal home 섹션 기반 **/emp 브라우즈는 hotfix로 J1에 포함됨** — 9.3 참고. 장르/시기 큐레이션만 계속 out of scope)
- **Cold-start fallback** — EMP 0건이면 그냥 빈 응답. 초기 trigger로 채우는 게 우선
- **Multi-user role system** — 단일 사용자 가정. `ADMIN_EMAIL` env로 hardcode
- **실시간 알림** (Slack/email on failure) — journalctl로 충분
- **m4a 파일 retention** — 별도 cleanup cron 추후
- **HNSW 인덱스 REINDEX 자동화** — 모니터링 후 수동
- **catalog 분할/sharding** — 천만 단위 이후 검토

## 14. Follow-up

- **J2**: Apple Music + iTunes (웹스크래핑)
- **J3**: Melon + FLO (K-Pop 웹스크래핑)
- **J4**: Deezer + Amazon Music (웹스크래핑)
- **K**: PGT 페이지 (좋아요/PCT/playlist 분류)
- **장르/시기 섹션** UI (J1+ 끝나고 catalog 다양해진 후)
- **Backfill 기존 catalog**: 165k 중 editorial playlist에 포함된 것 EMP로 표시 (importer 재실행)

## 15. Risks

- **X-Tidal-Token 만료/회전** — 비공식 웹 토큰이라 언제든 만료/변경 가능. 만료 시 Tidal importer는 graceful skip → /admin/emp Settings에서 수동 재입력. 실패는 IngestionRun.stages 에러 기록 + journalctl로 추적
- **Spotify 하드코딩 playlist 403** — spotify-owned algorithmic playlist는 신규 앱에서 403 가능 → 해당 playlist만 skip (errors 기록). 필요 시 `SPOTIFY_EMP_PLAYLISTS`로 교체
  - (해소됨) 당초 "client_credentials grant scope 부족" 리스크는 양쪽 모두 실제로 발생 — Tidal은 웹 API + X-Tidal-Token으로, Spotify는 하드코딩 playlist 목록으로 각각 우회 완료
- **MERT 임베딩 GPU 시간 미지수** — 첫 deploy 시 `--limit 200` 등 작게 시작. 모니터링 후 조정
- **HNSW index hit rate** — 신규 트랙 늘면서 정확도 변동 가능. ef_search 파라미터 튜닝 follow-up
- **Disk usage** — m4a 파일 누적. 별도 cleanup follow-up
- **Editorial playlist 중복** — 같은 트랙 여러 playlist에 등장 → ISRC dedup으로 Track 행은 1개, EMPSource 행만 여러 개
- **EMP 풀 너무 작을 때** — fallback 없으니 추천 0건 가능. J1 deploy 직후엔 수동 trigger로 초기 풀 채우기

## 16. As-built 추가 — 운영 안정화 (2026-06-11)

prod 첫 가동 과정에서 드러난 문제들과 해결 (5/5 stage success 달성):

| 문제 | 해결 |
|---|---|
| run 좀비화 (finish 못 하고 죽으면 영원히 'running') | crash-safe finish (BaseException → failed 마감) + 시작 시 잔존 'running' 전부 좀비로 간주·정리 (systemd oneshot이 단일 인스턴스 보장) |
| SQL 에러 후 같은 connection 재사용 → InFailedSqlTransaction 연쇄실패 | safe_rollback을 모든 SQL-catch 사이트에 적용 — 트랙 단위 실패가 run을 죽이지 않음 |
| systemd EnvironmentFile이 ${VAR} 참조를 확장 안 함 | config.py Settings에 재귀 expandvars validator |
| 같은 곡이 ISRC 있는 응답(playlist)과 없는 응답(mix)으로 이중 유입 → 중복 트랙 + TrackPlatform PK 충돌 | ISRC 미스 시 (platform, platformTrackId) lookup-first |
| 07_load_to_db는 일회성 카탈로그 적재용 (parquet 입력 필요) | 증분 로더 신설: scripts/10_load_emp_embeddings.py + src/mrms/emp/embedding_loader.py — 05_inference와 동일 projection (실측 cosine 1.0) 으로 TrackEmbedding upsert |
| Mac 전용 device(mps) 하드코딩 | encoder resolve_device fallback (mps→cuda→cpu) + 03의 cache 호출을 실제 device 기준으로 |

운영 메모:
- 서버 요구사항: /opt/mrms/.env.production의 PROJECT_ROOT=/opt/mrms,
  /opt/mrms/{data,logs,checkpoints,.cache} mrms 소유,
  checkpoints/heads_v1.0/best.ckpt 필수 (없으면 load 단계가 명확히 실패)
- extract는 CPU ~35분/500곡 — NVIDIA 드라이버 + ENCODER_DEVICE=cuda 시 수 분
- Spotify importer는 현재 +0 (Spotify가 editorial playlist API를 신규 앱에 차단) — 후속 과제
