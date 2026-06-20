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
