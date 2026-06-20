# 가입 시 구독 플랫폼 플레이리스트 → 일반 Playlist 흡수 — 설계 스펙

> 작성 2026-06-20. MRMS_FN. 회원가입/온보딩 때 가져오는 구독 플랫폼 플레이리스트를 **합치지 말고 원본 목록 그대로 각각 별도 Playlist로** 흡수.

## 목표

- 온보딩 import 시 구독 플랫폼(**YouTube·Tidal**)의 본인 플레이리스트를 **각각 별도의 일반 Playlist(MY PLAYLISTS)**로 생성. 이름·트랙·순서 보존, 전부.
- 가져온 뒤엔 사용자가 만든 플레이리스트와 **역할 동일**(재생·공유·Tidal담기·편집). "imported"라는 특별 개념 없음.

## 비목표 / 구분

- **메뉴의 Import(D4 "Eat The Shared")는 별개** — 공유 링크 붙여넣기(`import_url`). 이 작업과 무관, 안 건드림.
- 좋아요(liked)는 플레이리스트가 아님 → 취향 신호(UserTrack `source='liked'`)만, Playlist 생성 안 함.

## 현재 동작 (조사) — ⚠️ 정정

- **웹 가입 import 경로는 두 갈래**(1차 조사 누락):
  - **YouTube**: `auth_youtube /import` → `sync/youtube_importer.import_all`. (트랙을 `source='playlist:<이름>'` 적재.)
  - **Tidal·Spotify**: `onboarding/pipeline.py`(`run_onboarding`)가 처리. **여기가 진짜 머지 지점** — `fetch_*_user_playlists`로 플레이리스트 **ID만**(이름 X) 받고, 각 플레이리스트 트랙을 **하나의 set으로 합쳐**(`playlist_track_ids_set`) `UserTrack(source='playlist')` 통짜 적재. 진짜 Playlist 미생성, 플레이리스트 정체성·이름·순서 소실.
  - (`sync/tidal_importer`는 CLI 전용 `scripts/08` — 웹 미사용.)
- PGT "imported playlists" 섹션: `source LIKE 'playlist%'` 그룹 뷰(제거 대상).

## 설계 (안전·additive 우선)

1. **진짜 Playlist 생성** — **두 경로 모두**:
   - **YouTube**(`sync/youtube_importer`): 플레이리스트별 track_id 수집 → `create_imported_playlist`. (1차 구현 완료.)
   - **Tidal·Spotify**(`onboarding/pipeline.py`): ⚠️ **핵심 수정**. `fetch_*_user_playlists`가 (id, **name**) 반환하도록, pipeline이 플레이리스트별 ordered 트랙을 따로 보관 → 기존 batch 매칭 후 platform→internal 역매핑으로 플레이리스트별 internal track_id(순서) → `create_imported_playlist(conn, user_id, "tidal|spotify:{id}", name, ids)`. 머지 set은 매칭 효율용으로 유지, 취향 UserTrack 적재는 기존대로.
   - `source_ref = "youtube|tidal|spotify:{id}"`. **멱등**(같은 sourceRef skip). Playlist+PlaylistTrack(순서)만 INSERT.

2. **PGT "imported playlists" 특별 섹션 제거 (확정)**: 가져온 뒤엔 일반 플레이리스트와 역할이 같으니 "imported"라는 개념 자체를 없앤다.
   - 백엔드: `/api/pgt/sections`에서 `imported_playlists` 제거, `/imported-playlists`·`/imported-playlists/tracks` 엔드포인트 제거, `section_imported_playlists`·`imported_playlist_tracks`(db/pgt.py) 제거.
   - 프론트: PgtLibrary의 imported 섹션 렌더 + `getPgtImportedTracks` + `PgtImportedPlaylist` 사용 제거. `PgtSections.imported_playlists` 타입 제거.
   - **개발 단계 특수 상황**: 기존에 `source='playlist:%'`로 적재된 레거시 데이터는 보존 대상 아님(프로덕션 데이터 없음) → 즉시 제거 안전.
   - importer의 UserTrack `source='playlist:<이름>'` 태그는 그대로 둠(취향 신호용, UI 소비자 없음). 중복 없음 — imported 섹션이 사라졌으므로.

4. **마이그레이션**: `Playlist.sourceRef TEXT` + `(userId, sourceRef)` 인덱스 (멱등용). 일반 사용자 생성 플레이리스트는 NULL.

## 아키텍처 / 파일

- `prisma/migrations/.../migration.sql`: `ALTER TABLE "Playlist" ADD COLUMN "sourceRef" TEXT` + index.
- `src/mrms/db/playlist.py`: `create_imported_playlist(...)` — sourceRef 멱등, Playlist+PlaylistTrack만.
- `src/mrms/sync/youtube_importer.py`: `_ingest`가 track_id 반환 → 플레이리스트별 수집 → `create_imported_playlist`. (source 태그는 기존 `'playlist:<이름>'` 유지.)
- `src/mrms/sync/tidal_importer.py`: 동일.
- `src/mrms/api/pgt.py` · `src/mrms/db/pgt.py`: imported 섹션/엔드포인트/함수 제거.
- `web/src/components/mrms/PgtLibrary.tsx` · `web/src/lib/types.ts` · api lib: imported 섹션 UI·타입·fetch 제거.

## 데이터 흐름

온보딩 import → importer가 플레이리스트별 트랙 resolve(catalog match/create) → `UserTrack(curated)` 적재 + `create_imported_playlist`(real Playlist) → 사이드바 MY PLAYLISTS / PGT user_playlists에 **일반 플레이리스트**로 노출.

## 에러 처리

- 플레이리스트별 try/except + `safe_rollback`(기존 패턴). Playlist 생성은 트랙 커밋 **후** best-effort — 실패해도 import·취향 적재는 진행.

## 검증

- 단위: `create_imported_playlist`(멱등·순서), importer가 플레이리스트별 Playlist 생성(respx+db).
- 회귀: 기존 importer 테스트(무영향 — _ingest는 track_id 반환만 추가), PGT 테스트(imported 관련 테스트 제거/수정).
- tsc/eslint(프론트 imported 제거 반영).

## 후속 — 전곡 import (미매칭 트랙 카탈로그 생성)

> 문제: Tidal/Spotify 온보딩은 **MRMS 카탈로그에 이미 있는 트랙만 매칭(match-only)** → 655곡 플레이리스트가 21곡만 import(카탈로그 커버리지). YouTube 임포터는 미스곡을 카탈로그에 만들어 전곡 import — 이 비대칭을 해소.

**결정(사용자 승인): 전곡 import.** 미매칭 플레이리스트 트랙도 카탈로그(Track+TrackPlatform)에 생성 → 플레이리스트엔 전곡, 재생 가능. 임베딩 없어 **취향/MRT엔 기여 안 함**(추천 쿼리가 TrackEmbedding JOIN이라 자동 제외). 취향 적재(UserTrack)는 기존 match-only 유지.

**구현:**
- `upsert_platform_track(conn, platform, platform_track_id, title, artist, isrc?, cover_url?, duration_ms?) -> track_id` (신규, `emp/base.py` — `upsert_youtube_track` 패턴: TrackPlatform 매핑 reuse → isrc로 catalog 매칭 → 없으면 Artist+Track 생성, **EMPSource 미생성**, commit 안 함). Spotify Dev Mode 403로 /tracks 별도 호출 불가 → **메타데이터는 플레이리스트 item에서 inline 캡처**.
- `fetch_{tidal,spotify}_playlist_tracks` → `list[dict]`(id·title·artist·isrc·cover·duration_ms). pipeline taste flow는 `t["id"]`로 기존대로 매칭.
- `_create_imported_playlists`: per_playlist의 각 트랙을 `upsert_platform_track`(매칭 reuse/미매칭 생성) → ordered internal id → `create_imported_playlist`(전곡).
- 미매칭 트랙은 Playlist(PlaylistTrack)에만, UserTrack(취향)엔 미추가.

## 영향 범위 / 안전성

- 변경: migration(추가), db helper(추가), importer 2개(track_id 반환 + Playlist 생성, source 태그 유지), PGT 백엔드/프론트 imported 제거.
- 개발 단계 — 레거시 imported 데이터 보존 불요. importer 핵심은 additive(기존 stat·source 로직 무변경)라 회귀 위험 낮음.
