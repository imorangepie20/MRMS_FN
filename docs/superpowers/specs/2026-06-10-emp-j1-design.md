# Sub-project J1: EMP — External Music Pool 기반 catalog 확장 (Design)

**날짜**: 2026-06-10
**상태**: 디자인 (사용자 승인)
**범위**: Tidal/Spotify editorial playlist 자동 임포터 + EMP 풀 + MRT 검색 EMP 한정 + MERT 파이프라인 재사용 + scheduler + 관리 페이지.

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

- [ ] DB 마이그레이션 적용 (EMPSource + Track.inEmp + trigger + IngestionRun)
- [ ] `python scripts/import_emp.py --platform tidal` 동작, EMP 풀 늘어남
- [ ] Spotify 동일
- [ ] 신규 EMP 트랙이 `02_download_audio.py` → `03_extract_embeddings.py` → `07_load_to_db.py`로 자동 픽업
- [ ] `search_for_persona`가 EMP 한정 검색 (WHERE t.inEmp = TRUE 추가)
- [ ] systemd timer로 야간 자동 실행, 결과 IngestionRun에 기록
- [ ] `/admin/emp` 관리 페이지 — stats + recent runs + manual trigger
- [ ] mrt_latest top_tracks_n 20 → 50
- [ ] 신규 + 기존 테스트 모두 통과

## 3. Architecture

```
[Importers — 신규]                        [MERT 파이프라인 — 재사용]
import_emp_tidal.py    ──┐
import_emp_spotify.py  ──┼─→ Track + EMPSource → 02_download_audio.py
                         │   (Track.inEmp=TRUE)   03_extract_embeddings.py
                         │   trigger              07_load_to_db.py
                         │
[scheduler]              └─→ IngestionRun ──→ TrackEmbedding 생성 (modelVersion='our-v1.0')
systemd timer
nightly 03:00


[MRT 검색 변경]
search_for_persona: WHERE t.inEmp = TRUE 추가
                    (165k 전체 → EMP 풀로 한정)


[관리 페이지]
/admin/emp
  ├ EMP Status (총 트랙, EMP 포함, 임베딩 완료, 플랫폼별)
  ├ Recent runs (IngestionRun 최근 50건)
  └ [Trigger import now] 버튼 → POST /api/admin/emp/trigger
```

## 4. DB Schema

```sql
-- EMP 소스 추적 (한 트랙이 여러 소스에서 올 수 있음)
CREATE TABLE IF NOT EXISTS "EMPSource" (
  id           TEXT PRIMARY KEY,
  "trackId"    TEXT NOT NULL REFERENCES "Track"(id) ON DELETE CASCADE,
  platform     TEXT NOT NULL,                  -- 'tidal' | 'spotify'
  source_type  TEXT NOT NULL,                   -- 'editorial_playlist' | 'new_release' | 'chart'
  source_id    TEXT,                            -- platform의 playlist/chart ID
  source_name  TEXT,                            -- 'New Music Friday', 'Rising'
  "importedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("trackId", platform, source_id)
);
CREATE INDEX IF NOT EXISTS idx_empsource_track ON "EMPSource"("trackId");

-- 빠른 필터링용 denormalized 컬럼
ALTER TABLE "Track" ADD COLUMN IF NOT EXISTS "inEmp" BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_track_emp ON "Track"("inEmp") WHERE "inEmp" = TRUE;

-- EMPSource INSERT 시 Track.inEmp = TRUE
CREATE OR REPLACE FUNCTION sync_track_in_emp() RETURNS TRIGGER AS $$
BEGIN
  UPDATE "Track" SET "inEmp" = TRUE WHERE id = NEW."trackId";
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_emp_source_inserted ON "EMPSource";
CREATE TRIGGER trg_emp_source_inserted AFTER INSERT ON "EMPSource"
  FOR EACH ROW EXECUTE FUNCTION sync_track_in_emp();

-- 파이프라인 실행 이력
CREATE TABLE IF NOT EXISTS "IngestionRun" (
  id            TEXT PRIMARY KEY,
  "startedAt"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "finishedAt"  TIMESTAMPTZ,
  status        TEXT NOT NULL,             -- 'running' | 'success' | 'failed'
  platform      TEXT,                       -- 'all' | 'tidal' | 'spotify'
  stages        JSONB NOT NULL DEFAULT '[]'::jsonb,
  "triggeredBy" TEXT NOT NULL DEFAULT 'scheduler'
);
CREATE INDEX IF NOT EXISTS idx_ingestion_started ON "IngestionRun"("startedAt" DESC);
```

`stages` JSON 형식:
```json
[
  {"stage": "import_tidal", "status": "success", "tracks_new": 42, "tracks_existing": 18, "duration_ms": 5230, "error": null},
  {"stage": "import_spotify", "status": "success", "tracks_new": 28, "tracks_existing": 12, "duration_ms": 4100, "error": null},
  {"stage": "download_audio", "status": "success", "downloaded": 60, "failed": 3, "duration_ms": 180000, "error": null},
  {"stage": "extract_embeddings", "status": "success", "embedded": 60, "duration_ms": 240000, "error": null},
  {"stage": "load_to_db", "status": "success", "loaded": 60, "duration_ms": 8000, "error": null}
]
```

## 5. Importers (Adapter 패턴)

### 5.1 Base 클래스

```python
# src/mrms/emp/base.py
class EMPImporter:
    platform: str  # 'tidal' | 'spotify'

    def fetch_editorial_playlists(self) -> list[dict]:
        """플랫폼의 editorial playlist 목록."""
        ...

    def fetch_playlist_tracks(self, playlist_id: str) -> list[dict]:
        """한 playlist의 트랙들 (제목/아티스트/ISRC/플랫폼ID 등)."""
        ...

    def upsert(
        self,
        conn,
        playlist: dict,
        tracks: list[dict],
    ) -> tuple[int, int]:
        """
        각 트랙:
          1. ISRC 있으면 → Track 조회 (있으면 재사용, 없으면 신규 INSERT)
          2. TrackPlatform upsert (platform, platformTrackId)
          3. EMPSource INSERT (UNIQUE 충돌 시 skip)
          4. Track.inEmp는 trigger로 자동
        Returns: (tracks_new, tracks_existing).
        """
        ...
```

### 5.2 Tidal

```python
# src/mrms/emp/tidal.py
class TidalEMPImporter(EMPImporter):
    platform = "tidal"
    # editorial endpoint들 (Tidal Web API)
    PLAYLISTS = [
        ("rising", "tidal-rising"),
        ("new-arrivals", "tidal-new-arrivals"),
        ("popular", "tidal-popular"),
    ]

    def fetch_editorial_playlists(self):
        # /v1/editorials/* 또는 /v1/playlists/{wellknown_id}
        # 인증: client_credentials grant (app token)
        ...
```

### 5.3 Spotify

```python
# src/mrms/emp/spotify.py
class SpotifyEMPImporter(EMPImporter):
    platform = "spotify"

    def fetch_editorial_playlists(self):
        # /v1/browse/featured-playlists
        # 인증: client_credentials
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

┌─ Recent runs ──────────────────────────────────────────┐
│ #abc123  06.10 03:00  ✓ success  Tidal +42, Spotify +28│
│ #def456  06.09 03:00  ✓ success  Tidal +35, Spotify +21│
│ #ghi789  06.08 03:00  ✗ failed   download_audio timeout│
│ ...                                                    │
└────────────────────────────────────────────────────────┘
```

각 row 클릭 → stages 상세 (펼치기) — 단계별 카운트/에러/duration.

Sidebar `nav.ts` Settings 그룹에 "EMP admin" 추가.

## 10. Testing

- `tests/emp/test_base.py` — upsert 로직 (ISRC dedup, EMPSource UNIQUE, Track.inEmp trigger)
- `tests/emp/test_tidal.py` — HTTP 응답 mock → fetch + upsert 동작
- `tests/emp/test_spotify.py` — 동일
- `tests/emp/test_runner.py` — pipeline runner (모킹된 importer 사용)
- `tests/api/test_admin_emp.py` — stats/runs/trigger 엔드포인트
- `tests/recsys/test_mrt.py` (기존 확장) — `inEmp` 필터 적용 후 검색 동작
- 수동 e2e: prod에서 한 사이클 manually trigger → /admin/emp에서 결과 확인 → 본인 /mrt 추천 quality 변화

## 11. File Changes

| File | 변경 |
|---|---|
| `prisma/migrations/20260610xxxxxx_add_emp/migration.sql` | EMPSource + Track.inEmp + trigger + IngestionRun |
| `src/mrms/emp/__init__.py` (NEW) | |
| `src/mrms/emp/base.py` (NEW) | EMPImporter base |
| `src/mrms/emp/tidal.py` (NEW) | TidalEMPImporter |
| `src/mrms/emp/spotify.py` (NEW) | SpotifyEMPImporter |
| `src/mrms/emp/runner.py` (NEW) | run_pipeline + IngestionRun 기록 |
| `scripts/import_emp.py` (NEW) | CLI entry |
| `scripts/run_emp_pipeline.py` (NEW) | systemd timer 호출용 |
| `scripts/02_download_audio.py` | DB 쿼리 분기 추가 (`--emp-only --limit N`) |
| `src/mrms/recsys/mrt.py` | search_for_persona에 `AND t.inEmp = TRUE` |
| `src/mrms/api/main.py` | mrt_latest `top_tracks_n` 20 → 50 |
| `src/mrms/api/admin_emp.py` (NEW) | stats / runs / trigger 엔드포인트 |
| `src/mrms/db/emp.py` (NEW) | EMP DB 헬퍼 (stats 집계, runs 조회) |
| `web/src/app/(dashboard)/admin/emp/page.tsx` (NEW) | 관리 페이지 |
| `web/src/lib/nav.ts` | Settings 그룹에 "EMP admin" 추가 |
| `web/src/lib/api/admin-emp.ts` (NEW) | fetch helpers |
| `scripts/systemd/mrms-emp-import.service` (NEW) | |
| `scripts/systemd/mrms-emp-import.timer` (NEW) | |
| `tests/emp/*` (NEW) | 4개 테스트 파일 |
| `tests/api/test_admin_emp.py` (NEW) | |

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
- **UI 장르/시기 섹션** — catalog 다양해진 후. J1은 top 50 single list만 확장
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

- **Tidal/Spotify editorial endpoint 인증/scope 부족** — client_credentials grant scope 확인. 실패 시 IngestionRun.stages에 에러 기록 + journalctl로 추적
- **MERT 임베딩 GPU 시간 미지수** — 첫 deploy 시 `--limit 200` 등 작게 시작. 모니터링 후 조정
- **HNSW index hit rate** — 신규 트랙 늘면서 정확도 변동 가능. ef_search 파라미터 튜닝 follow-up
- **Disk usage** — m4a 파일 누적. 별도 cleanup follow-up
- **Editorial playlist 중복** — 같은 트랙 여러 playlist에 등장 → ISRC dedup으로 Track 행은 1개, EMPSource 행만 여러 개
- **EMP 풀 너무 작을 때** — fallback 없으니 추천 0건 가능. J1 deploy 직후엔 수동 trigger로 초기 풀 채우기
