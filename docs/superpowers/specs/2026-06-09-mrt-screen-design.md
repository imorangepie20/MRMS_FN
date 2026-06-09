# Sub-project I: MRT 화면 + 공통 트랙 인터랙션 + Player 확장 (Design)

**날짜**: 2026-06-09
**상태**: 디자인 (사용자 승인)
**범위**: MRT 페이지 dashboard 리디자인 + 모든 트랙 리스트에서 재사용할 공통 액션 컴포넌트 (♥/✨/▶/multi-select) + Player 확장 (셔플/반복/좋아요/취향저격/앨범사진/음질).

## 1. Goal + 사용자 의도

현재 /mrt는 prototype 수준 (페르소나 grid + 테이블 + 앨범 grid). 진짜 사용자가 쓸 수 있도록:
- Dashboard 한 화면에 추천 트랙/앨범/플레이리스트 통합
- 트랙 리스트 인터랙션 (좋아요/취향저격/재생/playlist 생성) 공통 컴포넌트화 → EMP/PGT 페이지에서도 재사용
- Player를 일반적인 음악 플레이어 수준으로 (셔플/반복/좋아요/취향저격/앨범사진/음질)

contents_constructure.md 명세:
- EMP/MRT/PGT 세 영역
- PGT 안에 좋아요 분류 + PCT(Personal Core Tracks) 분류
- "어느 페이지든 '내 취향이예요' 누르면 PGT + PCT 추가"

## 2. Success Criteria

- [ ] /mrt 페이지가 dashboard 레이아웃으로 동작 (헤더 + 페르소나 + 추천 트랙 + 추천 앨범 + 추천 플레이리스트)
- [ ] 페르소나 클릭 시 페이지 내 필터링
- [ ] 앨범/플레이리스트 클릭 시 Modal로 안 트랙 표시
- [ ] 트랙 리스트의 ♥/✨ 토글이 DB 즉시 반영 (낙관적 UI)
- [ ] 트랙 multi-select → Modal로 새 playlist 생성
- [ ] PlayerBar에 앨범사진/셔플/반복/좋아요/취향저격 추가
- [ ] 음질 배지 표시 (Spotify Premium: HIGH, Tidal: LOSSLESS, 그 외: STD)
- [ ] 공통 컴포넌트 (TrackListRow / CreatePlaylistModal / Album/Playlist Detail Modal)가 EMP/PGT에서 재사용 가능한 인터페이스
- [ ] 새 API 엔드포인트 동작 (toggle like, toggle pct, create playlist, get album/playlist tracks)
- [ ] 새 Playlist 테이블 마이그레이션 적용
- [ ] 모든 기존 테스트 + 신규 컴포넌트 unit 테스트 통과

## 3. Architecture

```
[/mrt 페이지 — Dashboard]
├── Header (user 정보 + 새로고침)
├── Personas section (gradient 카드 3개)
│   └── 클릭 → personaFilter state 변경 → 아래 섹션 필터링
├── 추천 트랙 (TrackListTable, 전체 스크롤)
│   ├── 각 행: TrackListRow (♥, ✨, ▶, checkbox)
│   └── 상단 툴바: 전체/선택 카운트 + "+ Playlist 만들기"
├── 추천 앨범 grid (클릭 → AlbumDetailModal)
└── 추천 플레이리스트 grid (클릭 → PlaylistDetailModal)

[공통 컴포넌트 — 재사용 EMP/PGT]
├── TrackListRow.tsx — 단일 트랙 (props: track, showActions, showCheckbox)
├── TrackListActions.tsx — multi-select 툴바
├── CreatePlaylistModal.tsx
├── AlbumDetailModal.tsx
└── PlaylistDetailModal.tsx

[PlayerBar 확장]
└── [앨범사진] [곡명/아티스트/음질배지] | [🔀 ⏮ ⏯ ⏭ 🔁 진행바] | [♥ ✨ 🔊 큐]
```

## 4. Layout & Visual Design

### 4.1 톤
- **밝은 테마** (light only — dark는 follow-up)
- shadcn 기본 + indigo(#6366f1) 포인트
- 페르소나 카드는 gradient (P1 indigo/purple, P2 amber/red, P3 emerald/cyan)

### 4.2 lucide-react 아이콘 매핑

| UI | lucide | 색/상태 |
|---|---|---|
| 좋아요 ON/OFF | `Heart` | fill 빨강 (#ef4444) / outline 회색 |
| 취향저격 ON/OFF | `Sparkles` | fill 주황 (#f59e0b) / outline 회색 |
| 재생 | `Play` (원 안) | white on indigo |
| Playlist 만들기 | `Plus` | white on indigo |
| 새로고침 | `RefreshCw` | 회색 |
| 셔플 | `Shuffle` | active 시 indigo |
| 반복 | `Repeat` / `Repeat1` | active 시 indigo |
| 볼륨 | `Volume2` | 회색 |
| 큐 | 기존 `QueueDrawer` 아이콘 유지 |

### 4.3 행 레이아웃 (TrackListRow)
```
[☑️ 24px] [art 32x32] [title + artist (flex)] [persona badge 80px] [duration 60px] [♥ ✨ ▶ 90px]
```

## 5. Interactions

### 5.1 ♥ Heart toggle
- 클릭 시 즉시 fill/outline 토글 (낙관적 UI)
- `POST /api/user/tracks/{trackId}/like` 호출 (idempotent)
- 백엔드: UserTrack에 source="liked" 추가 또는 제거 (is_core 보존)
- 실패 시 원상복구 + 토스트

### 5.2 ✨ Sparkles toggle (PCT)
- 클릭 시 즉시 fill/outline 토글
- `POST /api/user/tracks/{trackId}/pct` 호출 (idempotent)
- 백엔드: UserTrack의 `is_core` 토글. 없으면 INSERT source="liked", is_core=true
- "내 취향" → contents_constructure.md대로 PCT에 추가 (= UserTrack.is_core=true)

> 노트: PGT는 별도 테이블이 아니라 "UserTrack 전체"로 표현. 좋아요 = source="liked", PCT = is_core=true. PGT 페이지는 두 분류로 필터링하여 보여줌.

### 5.3 ▶ Play (즉시 재생)
- 현재 행 트랙을 player.loadAndPlay(track) (기존 facade 그대로)
- queue를 [그 트랙]으로 reset

### 5.4 ☑️ Multi-select → CreatePlaylistModal
- 트랙 checkbox 선택 시 상단 툴바에 선택 카운트 + "+ Playlist 만들기" 활성화
- 클릭 시 Modal 띄움
- Modal: 이름 입력 (required) + 설명 (optional) + 만들기 버튼
- `POST /api/user/playlists` (name, description, trackIds[])
- 성공 시 Modal 닫고 토스트 "Playlist '이름' 생성됨"
- 추천 플레이리스트 섹션 자동 새로고침

### 5.5 Persona card 클릭 → 필터
- 클릭 시 페이지 state `selectedPersonaIdx = idx` 설정
- 추천 트랙/앨범/플레이리스트 모두 그 persona_idx로 필터링
- 다시 클릭 시 필터 해제
- 시각: 선택된 카드 ring 효과

### 5.6 앨범/플레이리스트 클릭 → Detail Modal
- `AlbumDetailModal` / `PlaylistDetailModal` 띄움
- Modal 안: 큰 아트워크 + 제목/설명 + 안 TrackListRow 전체 (스크롤)
- 안 트랙들도 모든 인터랙션 (♥ ✨ ▶ checkbox) 지원
- "이 앨범 전체 재생" / "이 playlist 전체 재생" 버튼

## 6. Player 확장

### 6.1 새 PlayerBar layout

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ [art 56x56] 곡명         | 🔀 ⏮ ⏯ ⏭ 🔁  ─진행바─        | ♥ ✨ 🔊 큐  │
│            아티스트 [HiFi]                                                   │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 새 player store state
- `shuffleMode: boolean` — on이면 다음 트랙은 queue에서 랜덤
- `repeatMode: "off" | "all" | "one"` — `one`이면 끝나면 같은 트랙, `all`이면 queue 끝 → 처음
- `currentTrackLiked: boolean` — 트랙 변경 시 서버에서 fetch
- `currentTrackPCT: boolean` — 동일
- `audioQuality: string | null` — Tidal: "LOSSLESS"/"HiFi"/"HIGH", Spotify: Premium 시 "HIGH" 외 "STD"

### 6.3 컴포넌트 분리
- `NowPlaying.tsx` 확장: 앨범사진 + 음질배지 추가
- `PlayerControls.tsx` 확장: shuffle + repeat 버튼
- `PlayerActions.tsx` 신규: ♥ + ✨ (현재 트랙 대상)

### 6.4 음질 결정
- Tidal: backend가 stream proxy 시 quality 정보 같이 반환 → store에 저장
- Spotify Premium: SDK player 상태에 quality 정보 있으면 사용. 없으면 "HIGH" 고정
- Free/Preview: "STD"

## 7. Backend Changes

### 7.1 신규 엔드포인트

**POST /api/user/tracks/{trackId}/like**
- 토글: UserTrack에 source="liked" 있으면 source 제거(또는 행 삭제), 없으면 INSERT/UPDATE
- 응답: `{ liked: bool }`
- idempotent

**POST /api/user/tracks/{trackId}/pct**
- 토글: UserTrack의 is_core 토글
- 없으면 INSERT source="liked", is_core=true (PCT는 기본 liked 포함)
- 응답: `{ pct: bool }`

**GET /api/user/tracks/{trackId}/state**
- 응답: `{ liked: bool, pct: bool }`
- player가 트랙 변경 시 호출

**POST /api/user/playlists**
- body: `{ name, description?, trackIds: string[] }`
- DB INSERT Playlist + PlaylistTrack
- 응답: `{ playlist: { id, name, ... } }`

**GET /api/playlists/{id}/tracks**
- 응답: `{ playlist: {...}, tracks: TrackInfo[] }`
- AlbumDetailModal과 같은 형태

**GET /api/albums/{id}/tracks**
- 응답: `{ album: {...}, tracks: TrackInfo[] }`

**GET /api/mrt/latest 확장**
- 응답에 `recommended_playlists: PlaylistInfo[]` 추가
- PlaylistInfo: id, name, cover_url, track_count, persona_idx, persona_score

### 7.2 라우트 등록
`src/mrms/api/main.py`에 새 라우터들 추가.

## 8. DB Changes

### 8.1 신규 테이블

**Playlist**
```sql
CREATE TABLE IF NOT EXISTS "Playlist" (
  id          TEXT PRIMARY KEY,
  "userId"    TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_playlist_user ON "Playlist"("userId");
```

**PlaylistTrack**
```sql
CREATE TABLE IF NOT EXISTS "PlaylistTrack" (
  "playlistId" TEXT NOT NULL REFERENCES "Playlist"(id) ON DELETE CASCADE,
  "trackId"    TEXT NOT NULL REFERENCES "Track"(id) ON DELETE CASCADE,
  position     INTEGER NOT NULL,
  "addedAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("playlistId", "trackId")
);
CREATE INDEX IF NOT EXISTS idx_playlisttrack_position ON "PlaylistTrack"("playlistId", position);
```

migration: `prisma/migrations/20260609xxxxxx_add_playlist/migration.sql`

### 8.2 기존 schema 활용
- UserTrack의 `source` ("liked" / "playlist") + `is_core` (PCT 플래그) 그대로 사용
- "PGT 전체" = UserTrack 전체
- "PGT.좋아요" = WHERE source="liked"
- "PGT.PCT" = WHERE is_core=true

## 9. File Changes

| File | 변경 |
|---|---|
| `web/src/app/(dashboard)/mrt/page.tsx` | 전체 리팩토링 (dashboard 레이아웃) |
| `web/src/components/mrms/PersonaCard.tsx` | 클릭 props 추가 + active 상태 |
| `web/src/components/mrms/RecommendedTracksTable.tsx` | TrackListTable로 개명, 공통 컴포넌트화 |
| `web/src/components/track-list/TrackListRow.tsx` (신규) | 재사용 단일 행 |
| `web/src/components/track-list/TrackListActions.tsx` (신규) | multi-select 툴바 |
| `web/src/components/playlist/CreatePlaylistModal.tsx` (신규) | |
| `web/src/components/album/AlbumDetailModal.tsx` (신규) | |
| `web/src/components/playlist/PlaylistDetailModal.tsx` (신규) | |
| `web/src/components/player/PlayerBar.tsx` | layout 재배치 + 앨범사진 영역 |
| `web/src/components/player/NowPlaying.tsx` | 앨범사진 + 음질배지 |
| `web/src/components/player/PlayerControls.tsx` | 셔플 + 반복 추가 |
| `web/src/components/player/PlayerActions.tsx` (신규) | ♥ + ✨ for 현재 트랙 |
| `web/src/store/player.ts` | shuffle/repeat/like/pct/quality state 추가 |
| `web/src/lib/types.ts` | PlaylistInfo, TrackState 등 신규 type |
| `web/src/lib/api/user-tracks.ts` (신규) | like/pct toggle fetch helper |
| `web/src/lib/api/playlists.ts` (신규) | create / get tracks helper |
| `src/mrms/api/user_tracks.py` (신규) | like/pct toggle 엔드포인트 |
| `src/mrms/api/playlists.py` (신규) | playlist CRUD 엔드포인트 |
| `src/mrms/api/main.py` | 새 라우터 등록 + mrt_latest에 playlists 필드 |
| `src/mrms/recsys/mrt.py` | recommended_playlists 생성 로직 추가 |
| `src/mrms/db/playlist.py` (신규) | Playlist/PlaylistTrack DB 헬퍼 |
| `prisma/migrations/.../migration.sql` (신규) | Playlist + PlaylistTrack |
| `tests/api/test_user_tracks.py` (신규) | like/pct 토글 테스트 |
| `tests/api/test_playlists.py` (신규) | playlist CRUD 테스트 |

## 10. Migration Path

1. DB 마이그레이션 (Playlist / PlaylistTrack) — `_applied_migrations` tracking으로 멱등성
2. 백엔드 엔드포인트 + 테스트 → unit 테스트 통과 후 prod 적용
3. 프론트엔드 공통 컴포넌트 신규 작성 → /mrt 페이지 리팩토링 → 빌드 확인
4. Player 확장은 별도 단계 (independent — 기존 player 동작 유지하며 점진적)
5. prod deploy → e2e 검증 (좋아요 → DB 확인, 재생, playlist 생성)

## 11. Testing

- 백엔드 unit: like/pct toggle (idempotent), playlist CRUD, mrt_latest 새 필드
- 프론트엔드 unit (선택): TrackListRow 액션 dispatch, CreatePlaylistModal 폼 검증
- e2e 수동: 본인 prod 계정으로 (1) 트랙 ♥ 토글 → DB 확인 (2) PCT 토글 → UserTrack.is_core 확인 (3) multi-select → Modal → 새 playlist → 추천 playlist에 등장 (4) Player에서 좋아요/취향저격 → 트랙 리스트에 반영

## 12. Out of Scope

- **EMP 페이지 구현** → sub-project J (이 컴포넌트 재사용)
- **PGT 페이지 구현** → sub-project K (이 컴포넌트 재사용)
- **Dark theme** → 별도 polish
- **Mobile 최적화** → 기본 responsive만, mobile-specific UX는 follow-up
- **Drag-and-drop playlist 순서 변경** → 별도
- **Playlist 공유** → 별도
- **앨범/playlist에 트랙 직접 추가** (Modal에서) → 별도
- **시각화 (이퀄라이저, 비주얼라이저)** → 별도
- **Spotify/Tidal 외부 sync** (좋아요를 플랫폼에도 반영) → 별도, 사용자 결정 필요

## 13. Follow-up

- **J**: EMP 페이지 (외부 풀 크롤링 + 표시)
- **K**: PGT 페이지 (좋아요/PCT/playlist 분류 표시)
- **L**: Dark theme + mobile polish
- **M**: 시각화 (이퀄라이저)
- **N**: 플랫폼 sync 옵션 (좋아요 Spotify/Tidal에 반영)

## 14. Risks

- **공통 컴포넌트 인터페이스 over-design**: EMP/PGT 미구현 상태라 추측이 들어감 → MRT에 필요한 props만 노출, EMP/PGT 작업 시 확장
- **PlayerBar 리팩토링 회귀**: 현재 Tidal/Spotify 재생 잘 됨 → 새 state 추가만, 기존 동작 보존
- **GET /state 호출 비용**: 트랙 변경마다 호출 → 트랙 데이터에 포함시켜 줄이거나 batch fetch 검토
- **Playlist 권한**: 본인 playlist만 보여야 함 → 모든 엔드포인트에서 userId 체크
- **persona_idx 필터링 backend vs frontend**: 트랙은 backend가 이미 분리 → frontend 단순 filter (앨범/플레이리스트 동일)
