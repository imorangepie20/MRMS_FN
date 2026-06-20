# 가입 시 구독 플랫폼 플레이리스트 → 일반 Playlist 흡수 — 구현 계획

> **For agentic workers:** spec = `docs/superpowers/specs/2026-06-20-signup-playlist-import-design.md`. 단계별로 기록 남기며 처리. 개발 단계라 레거시 데이터 보존 불요.

**Goal:** 온보딩 import 시 구독 플랫폼(YouTube·Tidal) 본인 플레이리스트를 각각 별도 일반 Playlist로 흡수. PGT "imported" 특별 섹션 제거.

**Architecture:** importer가 플레이리스트별 resolve된 track_id를 모아 `create_imported_playlist`(sourceRef 멱등)로 일반 Playlist 생성. UserTrack 적재(취향)는 기존대로. PGT imported 섹션은 백엔드·프론트 전부 제거.

---

### Task 1: 마이그레이션 — Playlist.sourceRef  ✅ 완료

- Create: `prisma/migrations/20260620120000_playlist_source_ref/migration.sql`
- `ALTER TABLE "Playlist" ADD COLUMN IF NOT EXISTS "sourceRef" TEXT;` + `(userId, sourceRef)` 인덱스.

### Task 2: db helper — create_imported_playlist  ✅ 완료

- Modify: `src/mrms/db/playlist.py`
- `create_imported_playlist(conn, user_id, source_ref, name, track_ids) -> str | None` — sourceRef 있으면 None(멱등), 없으면 Playlist+PlaylistTrack(순서) INSERT. UserTrack 재적재 안 함.

### Task 3: youtube_importer — 플레이리스트별 Playlist 생성  ✅ 완료

- Modify: `src/mrms/sync/youtube_importer.py`
- `_ingest` 반환을 `str | None`(track_id)로. 플레이리스트 루프에서 `pl_track_ids` 수집 → 커밋 후 `create_imported_playlist(conn, user_id, f"youtube:{pl['id']}", name, pl_track_ids)` (best-effort).

### Task 4: tidal_importer — 동일  ✅ 완료

- Modify: `src/mrms/sync/tidal_importer.py`
- 플레이리스트 루프에서 `pl_track_ids` 수집 → 커밋 후 `create_imported_playlist(conn, user_id, f"tidal:{pl['id']}", title, pl_track_ids)` (best-effort, safe_rollback).

### Task 5: PGT imported 섹션 제거 — 백엔드

- Modify: `src/mrms/api/pgt.py` — `/sections`에서 `imported_playlists` 제거(✅), `/imported-playlists`(✅)·`/imported-playlists/tracks` 엔드포인트 제거.
- Modify: `src/mrms/db/pgt.py` — `section_imported_playlists`·`imported_playlist_tracks` 함수 제거.
- [x] `/imported-playlists/tracks` 엔드포인트 삭제 ✅
- [x] db 두 함수 삭제 ✅

### Task 6: PGT imported 섹션 제거 — 프론트

- Modify: `web/src/lib/types.ts` — `PgtSections.imported_playlists` 제거, `PgtImportedPlaylist` 제거(미사용 시).
- Modify: `web/src/components/mrms/PgtLibrary.tsx` — `PlaylistsTab`의 `importedPlaylists` prop·렌더 블록·`selectImportedPlaylist`·`getPgtImportedTracks` 호출 제거. count는 `userPlaylists`만.
- Modify: `web/src/lib/api.ts` — `getPgtImportedTracks` 제거.
- [x] 제거 후 tsc/eslint 통과 ✅

### Task 7: 테스트

- Modify: `tests/api/test_pgt.py` — `section_imported_playlists` 테스트 제거.
- Add: `tests/db/test_playlist.py::test_create_imported_playlist_idempotent`(멱등·순서·sourceRef), `tests/sync/test_youtube_importer.py`에 Playlist 생성 단언.
- [x] 대상 파일 pytest(35 pass) + ruff(신규 클린), 프론트 tsc/eslint ✅

### Task 8: ⚠️ 정정 — Tidal·Spotify 웹 경로(`onboarding/pipeline.py`)  ✅ 완료

> 1차 구현은 sync 임포터(YouTube 웹 + Tidal CLI)만 → 실제 웹 가입(Tidal/Spotify)은 `pipeline.py`라 미적용(플레이리스트 0개 버그). 진짜 머지 지점을 수정.

- `onboarding/tidal_favorites.py`·`spotify_collection.py`: `fetch_*_user_playlists` → **(id, name)** 반환(이름 필요).
- `onboarding/pipeline.py`: `_create_imported_playlists` 공용 헬퍼(역매핑·순서·dedup·미매칭 skip·멱등) + Tidal/Spotify collection에서 플레이리스트별 ordered 트랙 보관 → 매칭 후 호출.
- 영향: fetch 반환타입 변경 호출처 = pipeline.py뿐(확인). 테스트: tidal_favorites·spotify_collection shape 갱신 + `test_create_imported_playlists_helper` 추가.
- [x] 온보딩 13/13 pass, 앱 import 무결, 관련 35 pass, ruff 신규 클린 ✅

### Task 9: 전곡 import — 미매칭 트랙 카탈로그 생성  ✅ 완료

> 21/655 버그(match-only). 미매칭 트랙도 카탈로그에 만들어 전곡 import.

- `emp/base.py`: `upsert_platform_track`(Track+TrackPlatform만, EMPSource·UserTrack 없음 — `upsert_youtube_track` 패턴). 미매칭 트랙용.
- `fetch_{tidal,spotify}_playlist_tracks` → `list[dict]`(id·title·artist·isrc·cover·duration_ms) — Spotify Dev Mode 403라 메타 inline 캡처.
- `pipeline._create_imported_playlists`: 각 트랙 `upsert_platform_track`(매칭 reuse/미매칭 생성) → 전곡 Playlist. taste flow(UserTrack)는 매칭만 유지 — 미매칭은 임베딩 없어 추천 자동 제외.
- 영향: emp/base 순수 additive(EMP 임포터 무영향), fetch 호출처=pipeline뿐.
- [x] 온보딩 13/13 + emp base 4 pass, fetch shape 테스트 갱신 + 전곡 helper 테스트, 앱 import 무결, ruff 신규 클린 ✅
