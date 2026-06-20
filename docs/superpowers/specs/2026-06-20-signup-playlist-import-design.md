# 가입 시 구독 플랫폼 플레이리스트 → 일반 Playlist 흡수 — 설계 스펙

> 작성 2026-06-20. MRMS_FN. 회원가입/온보딩 때 가져오는 구독 플랫폼 플레이리스트를 **합치지 말고 원본 목록 그대로 각각 별도 Playlist로** 흡수.

## 목표

- 온보딩 import 시 구독 플랫폼(**YouTube·Tidal**)의 본인 플레이리스트를 **각각 별도의 일반 Playlist(MY PLAYLISTS)**로 생성. 이름·트랙·순서 보존, 전부.
- 가져온 뒤엔 사용자가 만든 플레이리스트와 **역할 동일**(재생·공유·Tidal담기·편집). "imported"라는 특별 개념 없음.

## 비목표 / 구분

- **메뉴의 Import(D4 "Eat The Shared")는 별개** — 공유 링크 붙여넣기(`import_url`). 이 작업과 무관, 안 건드림.
- 좋아요(liked)는 플레이리스트가 아님 → 취향 신호(UserTrack `source='liked'`)만, Playlist 생성 안 함.

## 현재 동작 (조사)

- `youtube_importer`/`tidal_importer`.`import_all`: 본인 플레이리스트 fetch → 트랙을 `UserTrack(source='playlist:<이름>', is_core=False)`로 **평면 적재**. 별도 Playlist 미생성.
- PGT "imported playlists" 섹션: `source LIKE 'playlist%'` 그룹으로 표시(읽기 전용 뷰). → 진짜 플레이리스트가 아니라 "합쳐진" 느낌.

## 설계 (안전·additive 우선)

1. **진짜 Playlist 생성**: importer가 각 원본 플레이리스트의 resolve된 catalog `track_id`를 **순서대로** 모아 `create_imported_playlist(conn, user_id, source_ref, name, track_ids)`로 일반 Playlist 생성.
   - `source_ref = "youtube:{id}" / "tidal:{id}"`. **멱등** — 같은 sourceRef가 이미 있으면 skip(재import 중복 방지).
   - Playlist + PlaylistTrack(순서 보존)만 INSERT. 트랙 UserTrack은 importer가 이미 적재.

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

## 영향 범위 / 안전성

- 변경: migration(추가), db helper(추가), importer 2개(track_id 반환 + Playlist 생성, source 태그 유지), PGT 백엔드/프론트 imported 제거.
- 개발 단계 — 레거시 imported 데이터 보존 불요. importer 핵심은 additive(기존 stat·source 로직 무변경)라 회귀 위험 낮음.
