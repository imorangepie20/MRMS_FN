# 트랙 목록 단위 플레이리스트 동작 설계 (v1)

> 작성일 2026-06-18. MRMS_FN. 트랙 목록 화면에서 전체(또는 선택) 트랙을 새 플레이리스트로 만들거나 기존 플레이리스트에 일괄 추가하는 동작을 모든 목록 화면에 추가한다.

## 목표

트랙 목록을 보는 모든 화면에서, 목록 헤더의 **"⋯" 케밥 메뉴**로 ① 이 목록으로 새 플레이리스트 만들기 ② 이 목록을 기존 플레이리스트에 추가 — 두 동작을 제공한다. 단일트랙 메뉴(우클릭/＋)와 같은 2단계 UX를 그대로 쓰되 대상이 목록 전체다.

## 확정된 결정 (브레인스토밍)

1. **적용 범위**: 트랙 목록 있는 **모든 화면** (PGT 탭, 검색 결과, 모달(앨범/플레이리스트/EMP), MRT).
2. **DRY**: 기존 단일트랙 `PlaylistMenuContent(trackId)`를 **`trackIds: string[]`로 일반화**. 단일트랙 호출부는 `[trackId]` 전달. 별도 벌크 컴포넌트 분리 안 함.
3. **벌크 store**: `usePlaylistStore`에 `addTracks(playlistId, trackIds[])` 추가(백엔드·클라이언트 이미 벌크). 단일 `addTrack`은 제거하고 호출부를 `addTracks([id])`로 통일.
4. **진입점 UI**: 작은 **"⋯" 케밥 아이콘 버튼**(라벨 없음) → 기존과 동일한 2단계 드롭다운(만들기 / 추가→목록).
5. **MRT 통일**: 멀티셀렉트 유지하되 **선택-인지** — 선택된 트랙 있으면 그 트랙들, 없으면 전체 추천 트랙 대상으로 같은 메뉴 사용. 생성도 공용 `NewPlaylistDialog`로 통일 → 기존 `CreatePlaylistModal` 미사용화(제거).
6. **결과 피드백**: 추가 시 토스트 "N곡 추가" (+ 중복 있으면 "M곡 중복 스킵"). 백엔드 `{added, skipped}` 사용.

## 비목표 (v1)

- 목록 일부만 고르는 새 멀티셀렉트 UI(좋아요/검색 등) — MRT 외엔 "전체" 대상. (MRT는 기존 멀티셀렉트만 재사용.)
- 플레이리스트 간 복사/병합, 새 백엔드 엔드포인트(기존 add/create 벌크로 충분).
- 정렬/필터된 부분집합 구분 — "전체" = 현재 컴포넌트의 `tracks` 배열 전부.

---

## 아키텍처

### 컴포넌트 일반화 — `PlaylistMenuContent`

`web/src/components/playlist/PlaylistMenuContent.tsx` props를 `{ trackId: string }` → `{ trackIds: string[]; onClose() }`로 변경:
- 루트: "플레이리스트 만들기" → `useNewPlaylistDialog().openDialog(trackIds)`.
- 추가: 플레이리스트 목록 → 선택 시 `usePlaylistStore().addTracks(playlistId, trackIds)` → 토스트.
- 라벨은 개수 인지: trackIds.length>1이면 "… (N곡)" 보조 표기.

호출부 수정(단일=배열1):
- `AddToPlaylistMenu.tsx`(＋ 버튼, 행별): `trackId` → `trackIds={[trackId]}`.
- `TrackContextMenu.tsx`(우클릭): 스토어의 `trackId`를 `[trackId]`로 전달.

### 신규 컴포넌트 — `TrackListPlaylistMenu`

`web/src/components/playlist/TrackListPlaylistMenu.tsx`:
- props `{ trackIds: string[] }`.
- 렌더: 작은 "⋯"(`MoreHorizontal` lucide) 아이콘 버튼 → 드롭다운 안에 `PlaylistMenuContent trackIds={trackIds}`.
- `trackIds.length === 0`이면 비활성.
- `AddToPlaylistMenu`와 같은 dropdown 패턴 재사용(드롭다운 컨테이너만 다름).

### 스토어 — `web/src/store/playlist.ts`

- `addTracks(playlistId: string, trackIds: string[]): Promise<{added: number; skipped: number}>` 추가: `addTracksToPlaylist(playlistId, trackIds)`(기존 벌크 클라이언트) 호출 → 응답 `{added, skipped}` 반환 + `bumpCount(playlistId, added)`(낙관적).
- `addTrack` **제거** — 유일 호출부가 `PlaylistMenuContent`인데 일반화로 `addTracks`를 쓰게 되므로 미사용. (제거 전 grep으로 다른 사용처 없음 확인.)
- `create(name, trackIds?)`는 그대로(이미 시드 트랙 지원).

### 토스트

기존 토스트 메커니즘 사용(대시보드 레이아웃에 토스트 provider 있으면 그것). 없으면 가장 가벼운 기존 패턴 따름. 메시지: 추가 `${added}곡 추가${skipped? \` · ${skipped}곡 중복\`:''}`. 만들기 성공 시 "플레이리스트 생성".

### 적용 surface

- **`TrackModalMasthead`** (`web/src/components/track/TrackModalMasthead.tsx`) — `PlayAllButton` 옆(또는 trailing 근처)에 `<TrackListPlaylistMenu trackIds={tracks.map(t=>t.track_id)} />`. 앨범/플레이리스트/EMP/검색앨범 모달 일괄 적용.
- **PGT 탭 헤더** (`web/src/components/mrms/PgtLibrary.tsx`) — `SectionHeader` 우측 액션 슬롯 추가하여 좋아요/취향저격/앨범/아티스트 탭 목록에 케밥. 각 탭의 `tracks` state 사용.
- **검색 트랙** (`web/src/components/search/SearchResults.tsx`) — "Tracks — N" 헤더에 케밥(`data.tracks`).
- **MRT** (`web/src/components/mrms/MrtDashboard.tsx`) — 기존 "+ playlist" 버튼을 `TrackListPlaylistMenu`로 교체. `trackIds = selectedTracks.size>0 ? [...selectedTracks] : recommended_tracks.map(id)`. `CreatePlaylistModal` 제거(미사용 시).

## 데이터 흐름

```
케밥 클릭 → PlaylistMenuContent(trackIds)
  만들기 → openDialog(trackIds) → NewPlaylistDialog → create(name, trackIds)
  추가 → addTracks(playlistId, trackIds) → POST /api/playlists/{id}/tracks {track_ids}
        → {added, skipped} → bumpCount(+added) + 토스트
```

## 에러 처리

- 빈 목록(trackIds 0): 케밥 비활성.
- 추가/생성 실패: 토스트 에러("추가 실패"), 낙관적 카운트 롤백.
- 중복: 백엔드가 스킵(에러 아님) → 토스트에 스킵 수 표기.

## 테스트 (DB 격리 준수 — 대상 파일만)

백엔드: `add_tracks_to_playlist` 벌크/중복 스킵은 기존 동작(플레이리스트 관리 작업에서 커버). 회귀만 확인 — 기존 `tests/api/test_playlists*`가 있으면 그대로 통과. 신규 백엔드 로직 없음(벌크 add/create 재사용).

프론트(검증=tsc/build, 컴포넌트 단위 테스트 인프라 없음):
- 일반화된 `PlaylistMenuContent`가 단일트랙 호출부에서 무회귀(타입/렌더).
- `addTracks` 스토어 동작(낙관적 카운트). 가능하면 store 단위 테스트(있는 패턴 따름), 없으면 tsc+수동.
- 전 surface tsc/build green + 케밥 노출 확인.

## 파일 구조

생성:
- `web/src/components/playlist/TrackListPlaylistMenu.tsx`.

수정:
- `web/src/components/playlist/PlaylistMenuContent.tsx` — props `trackIds[]`.
- `web/src/components/playlist/AddToPlaylistMenu.tsx`, `web/src/components/playlist/TrackContextMenu.tsx` — `[trackId]` 전달.
- `web/src/store/playlist.ts` — `addTracks` 추가, `addTrack` 통일.
- `web/src/components/track/TrackModalMasthead.tsx` — 케밥 추가.
- `web/src/components/mrms/PgtLibrary.tsx` — 탭 헤더 케밥.
- `web/src/components/search/SearchResults.tsx` — 검색 트랙 케밥.
- `web/src/components/mrms/MrtDashboard.tsx` — 케밥 교체(선택-인지), CreatePlaylistModal 제거.
- (제거) `web/src/components/playlist/CreatePlaylistModal.tsx` — MRT만 쓰면.

## 리스크 / 주의

- **호출부 일반화 회귀**: 단일트랙 ＋/우클릭 메뉴가 기존대로 동작해야(트랙 1개로 만들기/추가). tsc + 수동 확인.
- **MRT 리팩터**: 생성 경로를 CreatePlaylistModal→NewPlaylistDialog로 바꿀 때 기존 멀티셀렉트 상태/플로우 무회귀.
- **SectionHeader 변경**: PGT의 SectionHeader는 여러 탭 공용일 수 있어 액션 슬롯 추가가 다른 탭에 영향 없게(옵셔널 prop).
- **토스트 인프라**: 프로젝트에 토스트가 없으면 최소 패턴(인라인 메시지/console 대체)으로 — 구현 시 기존 유무 확인.
