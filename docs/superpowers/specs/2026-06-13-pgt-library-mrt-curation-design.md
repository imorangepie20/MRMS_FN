# PGT 라이브러리 + MRT 큐레이션 흐름 — 설계

> **목표:** 사용자가 MRT(추천)를 검토해 마음에 드는 트랙/앨범을 PGT(내 라이브러리)로 **이동**하고, PGT를 Liked·Playlists·Albums·Artists·PCT 5섹션으로 탐색한다. MRT는 이동·prune으로 무한 누적을 막는다.

작성 2026-06-13. **결정 기록:** [ADR-002](../../decisions/ADR-002-pgt-library-mrt-curation.md). 인덱스: [docs/README.md](../../README.md). 도메인 원전: [contents_constructure.md](../../contents_constructure.md).

---

## 1. 도메인 모델 (확정)

```
EMP ──복사──▶ MRT(추천 inbox) ──이동──▶ PGT(내 라이브러리)
 외부 풀      추천모델이 EMP/카탈로그     PCT = PGT 안의 "코어 취향" 부분집합
             트랙을 복사(EMP 불변)        (isCore=true)
```

- **EMP→MRT = 복사:** `search_for_persona`가 카탈로그/EMP 트랙을 추천으로 복사. EMP 불변.
- **MRT→PGT = 이동:** 사용자가 추천을 담으면 그 항목은 **MRT에서 사라진다**(이력은 보존, display에서 필터).
- **PGT = UserTrack 전체.** 5섹션은 UserTrack 위의 파생 뷰 — 새 user-owned 테이블 없음:

| 섹션 | 정의 |
|---|---|
| **Liked** | `UserTrack.source = 'liked'` |
| **Playlists** | `source LIKE 'playlist:%'` → source별 그룹(이름 = `playlist:` 뒤) |
| **Albums** | `UserTrack JOIN Track` → `Track."albumId"`별 그룹 |
| **Artists** | `UserTrack JOIN Track` → `Track."artistId"`별 그룹 |
| **PCT** | `UserTrack."isCore" = true` |

한 트랙이 여러 섹션에 보일 수 있음(liked이면서 그 앨범/아티스트에도). 섹션은 필터일 뿐.

## 2. 현재 상태 (재사용 대상)

- **`src/mrms/api/user_tracks.py`**: `POST /{track_id}/like`(source='liked' 토글), `POST /{track_id}/pct`(isCore 토글), `GET /{track_id}/state`. → **이동 메커니즘으로 그대로 재사용.**
- **`src/mrms/api/main.py:169` `/api/mrt/latest`**: `fetch_latest_playlists(limit=3)`(최신 generation 3 페르소나) → personas + recommended_tracks + recommended_albums(derive). `_fetch_track_metadata`로 메타 해석.
- **`UserTrack`** ([prisma/init/03_user_track.sql](../../../prisma/init/03_user_track.sql)): id, userId, trackId, isCore, source, platform, addedAt. `UNIQUE(userId, trackId)`.
- **`PlaylistHistory`**: MRT 출력(generation별 personaIdx·trackIds·scores). `regenerate_mrt` 스테이지가 갱신([ADR-001](../../decisions/ADR-001-youtube-newuser-automation.md)).
- **프론트:** `web/src/components/mrms/MrtDashboard.tsx`(MRT 화면). **PGT/라이브러리 화면은 없음(신규).**
- **이미 있음 — 재사용(spec 작성 후 발견):**
  - **1급 Playlist 테이블** + `mrms.db.playlist`(`create_playlist`/`list_user_playlists`/`get_playlist`/`get_playlist_tracks`) + `playlists.py`(`POST/GET /api/user/playlists`, `GET /api/playlists/{id}/tracks`). → **Playlists 섹션이 이걸 재사용**(중복 구현 금지).
  - `albums.py`(`GET /api/albums/{id}/tracks` — 카탈로그 앨범 트랙) — 앨범 상세 뷰에 재사용.
  - `mrms.db.user_track.get_user_track_states(conn, user_id, [track_ids]) -> {tid: (liked, pct)}` — liked/pct 벌크 헬퍼. → 모든 트랙 행에서 재사용(인라인 쿼리 금지).
- **없는 것:** UserAlbum/UserArtist 테이블 — Albums/Artists는 파생 그룹핑이라 불필요.

## 3. 설계

### 3.1 PGT 라이브러리 화면 + 섹션 API (토대)

신규 `src/mrms/api/pgt.py` — UserTrack 파생 그룹핑 조회:

- `GET /api/pgt/sections` — 5섹션 요약(각 섹션 트랙/그룹 수).
- `GET /api/pgt/liked` — source='liked' 트랙 목록.
- `GET /api/pgt/pct` — isCore=true 트랙 목록.
- **Playlists 섹션 = 사용자 생성 + 임포트(A):** 사용자 생성은 기존 `GET /api/user/playlists`(`list_user_playlists`) + `GET /api/playlists/{id}/tracks` **재사용**. 임포트는 `GET /api/pgt/imported-playlists`(UserTrack `source LIKE 'playlist:%'` 그룹 — 이름·트랙수) + `GET /api/pgt/imported-playlists/{name}`(그 트랙). 화면은 둘을 합쳐 표시. (lossy 한계는 §8 B 보류 참고.)
- `GET /api/pgt/albums` — distinct albumId(보유 트랙 기준) + 앨범 메타 + 보유 트랙 수. `GET /api/pgt/albums/{albumId}` — 그 앨범의 보유 트랙.
- `GET /api/pgt/artists` — distinct artistId + 메타 + 트랙 수. `GET /api/pgt/artists/{artistId}` — 트랙.

프론트: 신규 라우트 `web/src/app/(dashboard)/library/page.tsx` + `PgtLibrary.tsx`(5섹션 탭/네비). 트랙 행은 기존 like/pct 토글(`user_tracks`) 재사용. 메타 해석은 `_fetch_track_metadata` 패턴 공유.

### 3.2 MRT → PGT "이동" (display 필터 + 앨범 담기)

- **이동 = UserTrack 생성 → MRT에서 숨김.** `mrt_latest`가 personas/recommended_tracks/recommended_albums를 빌드할 때 **이 유저의 UserTrack 보유 trackId를 제외**한다 (`search_for_persona`의 기존 제외 로직과 일관). PlaylistHistory는 mutate 안 함 — 이력 보존, display-time 필터.
  - 구현: `mrt_latest`에서 `all_track_ids` 중 UserTrack 보유분을 한 번 조회해 set으로 제외. recommended_albums는 "보유 트랙으로만 남은(추천 트랙 0개) 앨범"을 제외.
- **트랙 담기:** 기존 `POST /{track_id}/like`(→Liked) 또는 `/pct`(→PCT) 그대로. 누르면 UserTrack 생김 → 다음 `mrt/latest`에서 빠짐.
- **앨범 담기(신규):** `POST /api/user/tracks/album/{album_id}/collect` — 그 앨범의 (MRT에 노출된/카탈로그) 트랙 전부 UserTrack 생성, **source=`'liked'`(확정)** → Liked + Albums 섹션 동시 노출. 앨범 단위로 MRT에서 사라짐.
- 대안(비채택): PlaylistHistory 배열 mutate / "moved" 플래그 — 이력 훼손·상태 추가.

### 3.3 MRT 누적 prune

- **화면:** `mrt/latest`는 이미 최신 generation만 읽음(`fetch_latest_playlists(limit=3)`) + 이동분 제외 → inbox처럼 자연 감소.
- **DB prune:** 신규 `prune_playlist_history(conn, user_id, keep_generations=N)` — generatedAt 기준 최신 N generation(= N×페르소나수 행)만 남기고 삭제. `regenerate_mrt`가 한 유저 MRT를 새로 만든 직후 호출(또는 파이프라인 말미 일괄). 기본 keep=2.

## 4. 데이터 흐름

1. 파이프라인이 MRT 생성/갱신(PlaylistHistory) → prune로 최신만 유지.
2. 사용자가 `/library`에서 PGT 5섹션 탐색, MRT 화면에서 추천 검토.
3. 트랙 like/pct 또는 앨범 collect → UserTrack 생성 → MRT에서 그 항목 사라짐, PGT 해당 섹션에 등장.
4. 다음 MRT 생성은 UserTrack 보유분을 자동 제외(기존 `search_for_persona`).

## 5. 컴포넌트 / 파일

- **신규:** `src/mrms/api/pgt.py`(섹션 조회), `prune_playlist_history`(db/user_embedding.py 또는 recsys), `web/src/app/(dashboard)/library/page.tsx` + `PgtLibrary.tsx`.
- **수정:** `src/mrms/api/main.py`(`mrt_latest`에 UserTrack 제외 필터), `src/mrms/api/user_tracks.py`(앨범 collect 추가), `src/mrms/emp/runner.py`의 `regenerate_mrt`(prune 호출).
- **재사용:** `user_tracks` like/pct, `_fetch_track_metadata`, `fetch_latest_playlists`.

## 6. 열린 결정 / out of scope

- **앨범 담기 source = `'liked'` (확정 2026-06-13).** 섹션이 파생이라 Liked·Albums에 동시 노출돼도 자연 구분됨.
- **Playlists 섹션 = import한 플레이리스트(읽기)**만. 사용자 플레이리스트 **생성/CRUD는 out of scope**(1급 엔티티 필요 — 나중에).
- **prune keep_generations 기본값**(2) 튜닝.
- MRT 화면의 "앨범 담기" UI 배치는 플랜에서.

## 7. 테스트 전략

- **단위:** pgt 섹션 쿼리(파생 그룹핑) — seed UserTrack로 각 섹션 카운트/그룹 검증. `prune_playlist_history` — generation 경계.
- **이동:** `mrt_latest`가 UserTrack 보유 trackId를 제외하는지(seed 후 like → 다음 latest에서 빠짐). 앨범 collect → 앨범 트랙 전부 UserTrack + recommended_albums에서 제외.
- **회귀:** PGT 비었을 때 5섹션 빈 응답, 이동 0건일 때 mrt_latest 기존 동작 동일.

## 8. 구현 순서 (A 범위 — 한 plan, 3 파트 순차)

1. **PGT 라이브러리 화면 + 섹션 API** — Playlists 섹션 = **사용자 생성**(기존 Playlist 테이블, `list_user_playlists`/`get_playlist_tracks` 재사용) + **임포트**(UserTrack `source LIKE 'playlist%'` 그룹 **as-is, import 변경 0**: youtube는 `playlist:<이름>`별 그룹, tidal/spotify는 `playlist` 한 덩어리). Liked/Albums/Artists/PCT는 UserTrack 파생. `/library` 화면 + `PgtLibrary.tsx`. (tidal/spotify 임포트 플리 **이름 분리 = B**.)
2. **MRT→PGT 이동** — `mrt_latest`에 UserTrack 보유 trackId 제외 필터 + 앨범 `collect`(source='liked').
3. **MRT 누적 prune** — `prune_playlist_history` + `regenerate_mrt` 연동.

> **보류(별도 후속 = B):** 임포트 플리 **1급 모델링**(Playlist에 `kind`/`platform`/`externalId` 추가 + import가 Playlist+PlaylistTrack 행 생성, 다대다 비-lossy). A의 source 그룹핑은 한 트랙이 여러 임포트 플리에 있으면 한 곳에만 보이는 lossy 한계가 있음 — 정식 모델링은 B에서.

## 관련 문서

- [ADR-002](../../decisions/ADR-002-pgt-library-mrt-curation.md) — 이 설계의 결정 기록
- [contents_constructure.md](../../contents_constructure.md) — EMP/MRT/PGT/PCT 원전 정의
- [ADR-001](../../decisions/ADR-001-youtube-newuser-automation.md) — MRT 생성·regenerate 스테이지(prune 연동 지점)
- 코드: `src/mrms/api/user_tracks.py`, `src/mrms/api/main.py`(mrt_latest), `src/mrms/db/user_embedding.py`(fetch_latest_playlists)
