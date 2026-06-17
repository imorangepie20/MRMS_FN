# 플레이리스트 관리 (DnD) 상세 설계

작성일: `2026-06-17`
상태: 설계 승인 — 구현 예정.

## 목표

트랙을 감상할 수 있는 **모든 페이지**(MRT·검색·EMP·라이브러리·아티스트 모달·공유)에서:

1. **새 플레이리스트 생성**
2. **기존 플레이리스트에 트랙 추가**
3. **플레이리스트 편집**(이름·설명 / 곡 순서변경 / 곡 제거) **및 삭제**

주 인터랙션은 **드래그 앤 드롭**, 사이드바가 없는 화면은 **"＋ 메뉴" 폴백**으로 동일 기능 제공.

## 핵심 결정 (brainstorming 확정)

1. **드롭 타깃 배치 = A 좌측 사이드바**: 좌측 nav에 "내 플레이리스트" 섹션을 두고 트랙을 그 위로 드롭. 데스크탑 hero 인터랙션.
2. **폴백 = 1 ＋메뉴(모든 트랙 행)**: 모든 트랙 행에 "＋" 메뉴(플레이리스트 선택 + 새로 만들기). 데스크탑에선 드래그의 대체, 모바일/모달/공유에선 주 수단(바텀시트). → 진짜 "어디서나" + 접근성.
3. **DnD 엔진 = `dnd-kit`**: React 표준, 터치·키보드 접근성 지원(모바일 필수). native HTML5 DnD 대비 모바일/a11y 우수. **새 의존성**(`@dnd-kit/core`, `@dnd-kit/sortable`).
4. **편집 범위 = 4동작**: 이름·설명 수정 / 곡 순서변경(드래그) / 곡 제거 / 플레이리스트 삭제. **커버 이미지 업로드는 범위 밖**(곡 커버 자동 모자이크 유지, 후속).
5. **모델 변경 없음**: 기존 `Playlist` + `PlaylistTrack(position)` 그대로.

## 현재 구조 (배경 — 그라운딩 확인)

- **`Playlist` 테이블**: `id, userId, name, description, createdAt, shareId`.
- **`PlaylistTrack` 조인**: `playlistId, trackId, position` + `UNIQUE(playlistId, trackId)`(생성 시 `ON CONFLICT DO NOTHING`). position 순 정렬.
- **기존 API**(`src/mrms/api/playlists.py`): `POST /api/user/playlists`(생성), `GET /api/user/playlists`(목록+track_count), `GET /api/playlists/{id}/tracks`(트랙, position순), `POST /api/user/playlists/{id}/share`(공유).
- **기존 db ops**(`src/mrms/db/playlist.py`): `create_playlist`, `list_user_playlists`, `get_playlist_tracks`, `get_playlist`, `set_playlist_share`, `get_playlist_by_share_id`.
- **담기 = 라이브러리 편입**: `create_playlist`가 곡마다 `upsert_user_track(source="curated", is_core=False)` 호출(ADR-002 "이동=UserTrack" → MRT 제외 + 취향신호). 신규 add-tracks도 같은 규칙 따름.
- **트랙 shape**: `get_playlist_tracks` 반환 dict가 `ModalTrack` shape(track_id/title/artist/album_title/album_cover/tidal·spotify_track_id/duration_ms)와 호환 → `ModalTrackList` 재사용.
- **트랙 행 렌더처(공용+로컬)**: `web/src/components/track/ModalTrackList.tsx`(검색·모달·공유 8곳 공용), `MrtDashboard.tsx`(로컬 TrackRow), `PgtLibrary.tsx`(로컬 TrackList + 플레이리스트 상세), EMP `TrackSectionRow.tsx`/`TrackListSection.tsx`. (아티스트 `ArtistLink` 교체와 동일 사이트.)
- **좌측 사이드바**: `web/src/app/(dashboard)/layout.tsx`의 `AppSidebar`(데스크탑 240px grid, 모바일 drawer). `PlayerBar` 항상 마운트.
- **인증**: `get_current_user_id`(쿠키 세션, 미인증 401). 공유 페이지(`/p`)는 무인증 공개.

## 백엔드

### 신규 엔드포인트 (`api/playlists.py`, 전부 소유권 체크)

소유권: 대상 playlist의 `userId == get_current_user_id` 아니면 403/404.

| 엔드포인트 | 동작 | 비고 |
|---|---|---|
| `POST /api/playlists/{id}/tracks` | body `{track_ids: [...]}` → 곡 추가 | `ON CONFLICT DO NOTHING`, position = 현재 max+1부터 append. 추가된 곡마다 `upsert_user_track(curated)`. 응답: 추가된 수 + 스킵(중복) 수 |
| `DELETE /api/playlists/{id}/tracks/{trackId}` | 곡 제거 | UserTrack은 미변경(다른 플리/좋아요 안전). 남은 position 갭은 허용(정렬만 보장) |
| `PATCH /api/playlists/{id}/tracks/order` | body `{track_ids: [...]}`(전체 순서) → position 재기록 | 전달 배열이 그 플리의 트랙 집합과 일치해야 함(불일치 400) |
| `PATCH /api/playlists/{id}` | body `{name?, description?}` → 메타 수정 | name 빈 문자열 400 |
| `DELETE /api/playlists/{id}` | 플레이리스트 삭제 | `PlaylistTrack` cascade 삭제(또는 명시 삭제). UserTrack 미변경 |

### 신규 db ops (`db/playlist.py`)

- `add_tracks_to_playlist(conn, playlist_id, track_ids) -> {added, skipped}`: max(position) 조회 → append insert(ON CONFLICT DO NOTHING) → 신규 곡마다 `upsert_user_track(curated)` → commit.
- `remove_track_from_playlist(conn, playlist_id, track_id)`.
- `reorder_playlist_tracks(conn, playlist_id, track_ids)`: 트랜잭션 내 position 일괄 갱신(전달 집합 == 기존 집합 검증).
- `update_playlist_meta(conn, playlist_id, name, description)`.
- `delete_playlist(conn, playlist_id)`.
- 소유권 헬퍼 `_owned_playlist(conn, playlist_id, user_id) -> bool`(없으면 404, 타인 소유 403).

## 프론트

### 인터랙션 모델

- **DnD(dnd-kit)**: 전역 `DndContext`(대시보드 레이아웃). 트랙 행 = `useDraggable`(grip `⠿` 핸들에서만 시작 — 행 클릭=재생과 충돌 회피), drag payload = `{track_id, title, artist, ...ModalTrack}`. 드롭 타깃 = 사이드바 플레이리스트 행 + "＋ 새 플레이리스트" = `useDroppable`. 드롭 시 `POST .../tracks` 낙관적 업데이트 + 토스트.
- **＋메뉴**: 모든 트랙 행에 `AddToPlaylistMenu`(작은 버튼 → 드롭다운: 플레이리스트 목록 + "＋ 새로 만들기"). 모바일=바텀시트. 미인증이면 숨김.
- **새 플레이리스트**: 드롭 on "＋새" 또는 메뉴 "새로 만들기" → `NewPlaylistDialog`(이름 입력, 선택적으로 그 곡을 초기 트랙으로) → `POST /api/user/playlists`.
- **편집(PGT 상세 인라인, `PgtLibrary` 플레이리스트 상세)**: 헤더 `✎`(이름·설명 인라인) + `⋯`메뉴(공유 / 삭제-확인). 트랙 리스트 = `dnd-kit` `SortableContext`(grip 드래그로 reorder → `PATCH .../order` 낙관적), 행 `✕`(제거 → `DELETE .../tracks/{id}`).
- **피드백**: 추가/제거/삭제/생성 토스트. 중복 곡 → "이미 있어요". 낙관적 UI + 실패 시 롤백.

### 컴포넌트 / 상태

- `web/src/store/playlist.ts` — `usePlaylistStore`(zustand): 목록 캐시 + `addTrack/removeTrack/reorder/rename/remove/create` mutations(낙관적, 실패 롤백).
- `web/src/lib/api/playlists.ts` — 확장: `addTracksToPlaylist`, `removeTrackFromPlaylist`, `reorderPlaylistTracks`, `updatePlaylist`, `deletePlaylist`(기존 create/list/getTracks 옆).
- 공용 `ModalTrackList` row에 **grip 핸들 + ＋메뉴** 얹기(가장 넓은 커버리지). MrtDashboard·PgtLibrary·EMP 로컬 행도 동일하게 — 공용 `DraggableTrackRow`/`AddToPlaylistMenu` 래퍼로 통일.
- `PlaylistNavSection`(AppSidebar 내 "내 플레이리스트" 드롭 타깃 목록), `AddToPlaylistMenu`, `NewPlaylistDialog`, PGT 상세 편집(SortableContext + remove + rename).
- 전역 `DndContext` + 토스트 provider는 `(dashboard)/layout.tsx`에 마운트(PlayerBar 옆, 아티스트 모달과 동일 위치).

## 권한 / 엣지

- 모든 변경은 **로그인 필요**(엔드포인트 `get_current_user_id`). 프론트 ＋메뉴·드래그 핸들·사이드바 플리섹션은 **세션 있을 때만** 노출 → 비로그인·공유페이지(`/p`) 뷰어에겐 안 보임.
- 중복 곡: `DO NOTHING` + "이미 있어요" 토스트(에러 아님).
- 빈 플레이리스트 허용. 삭제는 확인 다이얼로그. 드래그 취소(드롭 밖) = no-op.
- reorder 배열 불일치(경합) → 400 → 프론트 목록 재조회.
- 같은 곡이 여러 track_id로 존재(ISRC 유무) — 플레이리스트는 track_id 단위(중복 키 `UNIQUE(playlistId, trackId)`)라 그대로 둠(범위 밖: _song_key 병합).

## 테스트

- 백엔드(`tests/api/test_playlists_*.py` 또는 기존 파일 확장): add(중복 스킵·position append·curated UserTrack 생성), remove, reorder(집합검증·position), rename(빈이름 400), delete(cascade), 소유권(타인 플리 403). 외부 호출 없어 respx 불필요. ⚠️ DB 격리 안 됨 — 대상 파일만, cleanup으로 시드 정리(User/Playlist/PlaylistTrack/UserTrack 역순).
- 프론트: `npx tsc --noEmit` + `pnpm build` + 수동(데스크탑 드롭·모바일 ＋시트·reorder·삭제·중복).

## 비채택 / 범위 밖 (YAGNI)

- 커버 이미지 직접 업로드 — 곡 커버 자동 모자이크 유지(후속).
- 협업/공동편집 플레이리스트, 폴더, 스마트(규칙) 플레이리스트 — 범위 밖.
- 같은 곡 _song_key 병합(플레이리스트 내) — 범위 밖.
- 드래그로 플레이리스트 간 곡 이동(복사 아닌 이동) — 범위 밖(추가/제거로 충분).

## 후속 작업 (구현 순서 가이드)

1. db ops(add/remove/reorder/update/delete + 소유권) + 단위 테스트.
2. API 5 엔드포인트 + 소유권/검증 + 테스트.
3. 프론트 api 클라 + `usePlaylistStore`(낙관적 mutations).
4. 공용 `DraggableTrackRow` + `AddToPlaylistMenu` + 렌더처 적용(ModalTrackList 우선).
5. 사이드바 `PlaylistNavSection`(드롭 타깃) + 전역 `DndContext` + `NewPlaylistDialog` + 토스트.
6. PGT 상세 편집(reorder/remove/rename/delete).
7. tsc/build + 수동 검증.

## 관련 문서

- 코드: `src/mrms/api/playlists.py`(엔드포인트), `src/mrms/db/playlist.py`(db ops), `web/src/components/track/ModalTrackList.tsx`(트랙 행 공용), `web/src/components/mrms/PgtLibrary.tsx`(플레이리스트 상세/편집), `web/src/app/(dashboard)/layout.tsx`(AppSidebar/DndContext 마운트).
- ADR-002(이동=UserTrack, 담기 시 curated 편입).
