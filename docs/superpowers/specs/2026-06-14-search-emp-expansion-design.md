# 검색 → EMP 확장 — 설계

> **목표:** `/search` 페이지에서 사용자는 새 트랙·앨범·플레이리스트를 찾는다. 내부적으로는 **Tidal + Spotify를 라이브 검색 → 우리 포맷으로 정규화 → 사용자에게 보여주면서 동시에 EMP(External Music Pool)에 적재**한다. 즉 검색은 **사용자 주도 EMP 확장 파이프라인** — "크롤 대신 텍스트 쿼리로 들어오는 EMP import".

작성 2026-06-14. **결정 기록:** [ADR-005](../../decisions/ADR-005-search-emp-expansion.md). 인덱스: [docs/README.md](../../README.md). (적대적 검증 8에이전트 반영 완료.)

---

## 1. 결정 (확정)

- **플랫폼:** Tidal + Spotify 라이브 검색. (K-pop 포함 충분. YouTube/한국 서비스는 범위 밖.)
- **인증:** 유저 OAuth 토큰(`auth_tidal`/`auth_spotify` 재사용) → **연동한 플랫폼만 검색**, 미연동/토큰실패는 skip(부분 결과). ⚠️ 토큰 함수는 미연동 시 **`HTTPException(404)`를 raise**하므로 라우트에서 try/except로 잡아 skip(§4.2).
- **결과 타입:** 트랙 / 앨범 / 플레이리스트.
- **적재 정책(A — 풀 클수록 좋음):** 결과를 **즉시 EMP 적재**(`source_type='search'`). 단 **컨테이너(앨범/플레이리스트)의 구성 트랙은 lazy** — 컨테이너 카드는 라이브 결과로 표시하고, 사용자가 열면 그때 트랙 fetch+적재.
- **표면:** `/search` 페이지(그린필드 — 라우트/페이지/백엔드 라우트 모두 없음). ⌘K 팔레트는 범위 밖.
- **트리거:** 제출 시 검색(as-you-type 아님 — 레이트리밋/비용).

## 2. 현재 상태 (재사용/확장 대상) — 실제 시그니처 확인됨

- **`src/mrms/api/playback_resolve.py`** (재생 시점 "특정 곡 1개" 검색): 재사용 자산
  - Spotify: `SPOTIFY_SEARCH_URL='https://api.spotify.com/v1/search'`, 단 현재 `type=track` **단일 타입만** 호출(멀티타입 미사용). 토큰 `auth_spotify.get_token(user_id, conn)` → **dict** `{"access_token", "expires_at"}` 반환(`["access_token"]`로 추출). 트랙 파싱 레퍼런스 = **`_spotify_candidate`(:132-143)** — `name`/`artists[].name`/`external_ids.isrc`/`duration_ms`.
  - Tidal: `TIDAL_V1_SEARCH_URL='https://api.tidal.com/v1/search/tracks'`(텍스트, 유저 Bearer, `body["items"]`) + `openapi.tidal.com/v2/tracks`(ISRC 필터). 토큰 `auth_tidal._get_access_token(user_id, conn)` → **str** 반환.
  - 매칭/정규화: `_norm`/`_pick_match`/`_usable_isrc`(합성키 배제).
  - 토큰+skip 패턴: `playback_resolve.py:393-403` — Spotify·Tidal 토큰 획득을 `try/except (HTTPException, Exception)`로 감쌈(Tidal refresh 실패는 raw 비-HTTPException로 옴). 검색 라우트는 같은 패턴으로 **skip**(re-raise 대신).
- **EMP 적재 경로**(크롤이 쓰는 것 그대로):
  - **`src/mrms/emp/base.py:57` `upsert_track_and_emp_source`** — Track/Artist/Album/TrackPlatform + EMPSource 한 번에. **실제 시그니처**: `(conn, isrc, title, artist, album_title, duration_ms, platform, platform_track_id, source_type, source_id, source_name, cover_url=None)`. `cover_url`만 default — 나머지 **필수**. dedup: ISRC(`Track.isrc @unique`) → (platform, platformTrackId) → 신규. 반환 `{new, track_id}`. 레퍼런스 호출 = `emp/spotify.py:249-261`.
  - `src/mrms/db/emp.py::upsert_emp_source(conn, track_id, platform, source_type, source_id, source_name, cover_url)` — EMPSource만. 트리거가 `Track.inEmp=TRUE`(자동).
  - `src/mrms/db/emp_section.py`: `upsert_section(conn, platform, section_key, display_title, display_order)` + `upsert_section_item(conn, section_id, item_type, item_id, title, cover_url, display_order)` — EMP 브라우즈 페이지의 섹션/카드. (EMPSectionItem에 **track_count 컬럼 없음**.)
- **`src/mrms/api/emp_browse.py::get_item_tracks`**: `GET /api/emp/items/{item_type}/{item_id}/tracks` — **DB에 이미 있는** 트랙을 `source_id=f"{item_type}:{item_id}"`로만 조회(emp_browse.py:42,66). `VALID_ITEM_TYPES`에 `album`/`playlist` 포함. auth(`get_current_user_id`) + `get_user_track_states` 필요. ⚠️ **플랫폼 컬럼 미사용** — source_id만으로 트랙을 찾으므로, Tidal/Spotify가 같은 item_id면 한 source_id로 합쳐짐(§6).
- **⚠️ NOT 레퍼런스**: `emp/spotify.py`는 **embed HTML 스크래퍼**(`/v1/search` 폐기, 토큰 없음, `isrc=None`, EMBED shape). Web-API `/v1/search` 정규화 참고로 **쓰면 안 됨**.
- **프론트 재사용**(확인됨): 트랙 행 = **`web/src/components/track/ModalTrackList.tsx`**(재생 + Heart(like) + Sparkles(pct), `ModalTrack` 인터페이스에 `track_id`/`title`/`artist`/`tidal_track_id`/`spotify_track_id` 필요 → **persist 후 track_id 확보돼야 렌더**). 컨테이너 카드 = **`emp/EmpItemCard.tsx`**, 열기 뷰 = **`emp/ItemTracksModal.tsx`**(`GET /api/emp/items/.../tracks` 호출). 와이어링 패턴 = `emp/EmpBrowse.tsx`. `Search` nav(`/search`, ⌘K) 플레이스홀더, `cmdk` 설치됨(미사용).

## 3. 아키텍처

```
[/search] ──q──▶ GET /api/search?q=&types=track,album,playlist
                       │
          ┌────────────┴────────────┐
   search/tidal.py          search/spotify.py   (유저 OAuth; 미연동/실패 skip→skipped_platforms)
          └──── search/normalize.py ────┘  우리 포맷 + 트랙 ISRC 병합(platforms 배열)
                       │
          ┌────────────┴────────────┐
   응답: 그룹 결과            search/persist.py → 트랙 즉시 EMP 적재(source_type='search')
   Tracks/Albums/Playlists    (컨테이너 카드는 라이브 결과로 표시 → 열면 expand가 트랙 적재)
                       │ (사용자가 앨범/플레이리스트 카드 클릭)
            POST /api/search/expand → 구성 트랙 fetch+적재(source_id='{type}:{id}')
                       │
            GET /api/emp/items/{type}/{id}/tracks (기존 emp_browse 재사용)
```

## 4. 백엔드 설계

### 4.1 `src/mrms/search/` (신규 모듈)

- **`tidal.py`** — `search_tidal(token: str, q, types) -> RawResults`.
  - 트랙: `api.tidal.com/v1/search/tracks`(인라인 artists/album/isrc, 유저 Bearer) — playback_resolve 패턴.
  - 앨범/플레이리스트: **per-type 경로** `api.tidal.com/v1/search/albums` · `/v1/search/playlists`(유저 Bearer, params `query/limit/countryCode`) 우선 시도, 404면 `/v1/search?types=ALBUMS,PLAYLISTS` 폴백. ⚠️ **구현 전 실API spike로 확정**(§7, plan Task 1). 안 되면 degrade: Tidal=트랙만, 컨테이너는 Spotify only.
- **`spotify.py`** — `search_spotify(token: str, q, types) -> RawResults`. `api.spotify.com/v1/search?type=track,album,playlist`(멀티타입 — 현재 repo 미사용이라 신규). 응답은 `body.tracks.items`/`body.albums.items`/`body.playlists.items`(각자 paging). ⚠️ `playlists.items`에 **null 항목** 올 수 있음 → 항목별 null-guard.
- **`normalize.py`** — 플랫폼 raw → 우리 포맷 (repo에 동등 코드 없음 — 신규, `_spotify_candidate` 패턴 차용):
  - **트랙**: `{title, artist, album_title, album_cover, duration_ms, isrc, platforms: [{platform, platform_track_id}]}`.
    - Spotify shape: `name`, `artists[].name`, `album.name`, `album.images[].url`, `duration_ms`, `external_ids.isrc`.
    - Tidal shape: `/v1/search/tracks` 인라인 `title`/`artists[]`/`album`/`isrc`/`duration`.
  - **앨범**: `{type:'album', title(name), subtitle(artists[].name), cover_url(images[].url), platform, platform_id, track_count(total_tracks)}`.
  - **플레이리스트**: `{type:'playlist', title(name), subtitle(owner.display_name), cover_url(images[].url), platform, platform_id, track_count(tracks.total)}`.
  - **ISRC 병합**: Tidal+Spotify 트랙 중 동일 ISRC → 1 결과(`platforms` 배열에 둘 다). ISRC 없거나 합성키면 병합 없이 개별. (앨범/플레이리스트는 플랫폼별, 병합 안 함.)
- **`persist.py`** — best-effort(예외는 로깅만, 응답 안 막음):
  - **트랙 즉시 적재**(merged 트랙은 각 platform별로 1회씩, 같은 ISRC면 base.py가 한 Track에 TrackPlatform 추가):
    ```
    upsert_track_and_emp_source(
      conn, isrc, title, artist, album_title, duration_ms,
      platform, platform_track_id,
      source_type='search', source_id=f'search:{q_norm}',
      source_name=q_norm, cover_url=album_cover)
    ```
  - **컨테이너는 persist.py에서 적재 안 함** — 카드를 라이브 결과로 표시하고, 트랙 적재는 expand(§4.2)가 담당. (EMP 브라우즈 카드로도 누적하고 싶으면 `upsert_section`(`section_key='search'`, platform별) + `upsert_section_item`을 옵션으로 — **이번 범위 밖/후속**.)

### 4.2 `src/mrms/api/search.py` (신규 라우트, prefix `/api/search`)

- **`GET /api/search?q=&types=track,album,playlist`**:
  1. q 정규화(trim, 길이 상한 — 예 ≤120자). 연동 플랫폼 토큰 확보 — **각 플랫폼 토큰 획득을 `try/except (HTTPException, Exception)`로 감싸 실패 시 `skipped_platforms`에 추가하고 계속**(playback_resolve:393-403 패턴; Spotify dict `["access_token"]`, Tidal str).
  2. 연동 플랫폼 검색 → normalize → ISRC 병합.
  3. `persist`(트랙 즉시).
  4. 응답:
     ```json
     {
       "tracks": [{ "title","artist","album_title","album_cover","duration_ms","isrc",
                    "track_id"(persist 후),
                    "platforms":[{"platform","platform_track_id"}] }],
       "albums":    [{ "title","subtitle","cover_url","platform","platform_id","track_count" }],
       "playlists": [{ "title","subtitle","cover_url","platform","platform_id","track_count" }],
       "skipped_platforms": ["spotify" | "tidal", ...]
     }
     ```
     (트랙은 persist 후 `track_id`를 포함 → 프론트 `ModalTrackList`가 바로 렌더 가능.)
- **`POST /api/search/expand`** `{platform, item_type('album'|'playlist'), item_id}`:
  - 플랫폼에서 구성 트랙 fetch → `upsert_track_and_emp_source(..., source_type='search', source_id=f'{item_type}:{item_id}')`.
    - **Tidal 플레이리스트**: `api.tidal.com/v1/playlists/{uuid}/items` 유저 Bearer — **검증됨**, `onboarding/tidal_favorites.py:fetch_tidal_playlist_tracks` 재사용.
    - **Tidal 앨범**: `api.tidal.com/v1/albums/{id}/tracks` 유저 Bearer(표준, repo 미실행 — spike 확인). 실패 시 crawler 경로(`emp/tidal.py` `tidal.com`+`X-Tidal-Token`) 폴백.
    - **Spotify 앨범/플레이리스트**: `/v1/albums/{id}/tracks` · `/v1/playlists/{id}/tracks` 유저 토큰.
  - 반환 `{source_id}`. 이후 프론트는 기존 `GET /api/emp/items/{item_type}/{item_id}/tracks`로 표시(DB 직행).

## 5. 프론트 설계 (`/search` 페이지 — 신규)

- `web/src/app/(dashboard)/search/page.tsx`(기존 `(dashboard)/layout.tsx` 아래 — emp/pgt 형제) + `web/src/components/search/*`.
- 검색창: 입력 + 제출(Enter/버튼) 시 `GET /api/search`. 로딩/빈결과/부분결과(`skipped_platforms` 안내) 상태.
- 그룹 결과 3 섹션 **Tracks / Albums / Playlists**:
  - 트랙 → **`track/ModalTrackList.tsx` 재사용**(재생 + 담기 + 반응). 응답의 `track_id` 사용.
  - 앨범/플레이리스트 카드 → **`emp/EmpItemCard.tsx` 재사용**, 클릭 시 `POST /api/search/expand` → 성공하면 **`emp/ItemTracksModal.tsx`**(=`get_item_tracks`)로 트랙 표시. (`EmpBrowse.tsx` 와이어링 패턴 차용.)
- 에디토리얼 템플릿 톤 유지(템플릿 자산 보존·제자리 적응).

## 6. 데이터 흐름 / provenance

1. 검색 → 연동 플랫폼 라이브 조회 → 정규화 → ISRC 병합 → 표시 + 트랙 EMP 적재(`inEmp=TRUE` 자동).
2. 임베딩은 기존 EMP 배치가 다음 런에 처리(검색 트랙은 후보 풀 편입, 미임베딩이면 추천 미사용 → 오염 없음).
3. 컨테이너 열기 → `expand` → 구성 트랙 적재(`source_id='{type}:{id}'`, `source_type='search'`) → emp_browse로 표시(이후 DB 직행).
4. **provenance 주의**:
   - 트랙 결과의 `source_id='search:{q_norm}'`는 **Tracks 그룹 응답 전용** — emp_browse 컨테이너 조회(`'{type}:{id}'`)와 무관. 동일 트랙이 쿼리마다 별도 EMPSource row를 가질 수 있음(같은 track_id, 다른 source_id) — 감사/통계용, 부작용 없음(중복은 inEmp 한 번만).
   - emp_browse는 플랫폼 컬럼을 안 보므로, expand 컨테이너의 `item_id`는 **플랫폼 네이티브 id**여야 하고, 두 플랫폼이 같은 id면 한 source_id로 합쳐짐(현실적으로 희박).
   - q 정규화: trim + lowercase + 길이 상한.

## 7. 위험 / 구현 전 검증 (spike — plan Task 1로 격상)

- **Tidal 앨범·플레이리스트 검색(최우선):** `api.tidal.com/v1/search/albums`·`/v1/search/playlists`(per-type, 유저 Bearer)가 실제 되는지 실API 확인. 됨→스펙대로. 안 됨→`/v1/search?types=...` 시도, 그래도 안 되면 **degrade: 앨범/플레이리스트는 Spotify only**(§3·§4.2 응답에서 Tidal 컨테이너 제외, partial 표기). access-tier 401(subStatus 6004)은 **client-credentials** 얘기 — 이 repo의 **유저 OAuth Bearer**엔 해당 안 됨(리스크 낮음). **단 실제 호출로 확정.**
- **Tidal 앨범 트랙 fetch(expand):** `/v1/albums/{id}/tracks` 유저 Bearer 확인(플레이리스트는 `tidal_favorites`로 검증됨).
- **Spotify 멀티타입 응답 shape:** `body.{tracks,albums,playlists}.items` + null 항목 — 모킹 픽스처로 고정.

## 8. 테스트 전략

- **단위:** `normalize`(Spotify/Tidal raw→포맷, null-guard), **ISRC 병합**(동일곡→1 트랙 platforms 2개 / ISRC 없으면 분리), `persist`(전체 시그니처 호출 검증).
- **통합:** `/api/search` 응답 형태 + 적재(검색 후 `inEmp` 트랙 증가, EMPSource `source_type='search'`) + skip(미연동 플랫폼→skipped_platforms), `expand` 후 컨테이너 트랙 적재 → emp_browse 노출.
- **모킹:** 플랫폼 검색/토큰 API 모두 모킹(실 호출 X). Tidal 앨범/플레이리스트 검색은 spike 결과 픽스처로.

## 9. 구현 순서 (plan은 백엔드-퍼스트 2단계 — 스펙/ADR은 하나)

- **Phase 1 (백엔드):** Tidal 검색 spike(Task 1) → `search/`(tidal/spotify/normalize/persist) + `GET /api/search` + `POST /api/search/expand`. **응답 스키마·source_id 계약 동결**(§4.2). 단위/통합 테스트.
- **Phase 2 (프론트):** 동결된 스키마 기반 `/search` 페이지(ModalTrackList/EmpItemCard/ItemTracksModal 재사용).

## 10. 범위 밖 (후속)

- ⌘K 커맨드 팔레트 / YouTube·한국 서비스 검색 / 검색 결과 임베딩 즉시화 / 검색 히스토리.
- 검색 컨테이너를 EMP 브라우즈 카드(EMPSection)로 누적(이번은 expand-트랙 적재만; 섹션 카드는 후속).
- 앨범/플레이리스트 cross-platform 병합(트랙만 ISRC 병합).

## 관련 문서

- [ADR-005](../../decisions/ADR-005-search-emp-expansion.md) — 결정 기록
- [contents_constructure.md](../../contents_constructure.md) — EMP 정의
- 코드: `src/mrms/api/playback_resolve.py`(검색/토큰/매칭 재사용 — `_spotify_candidate`/`_pick_match`), `src/mrms/emp/base.py`(`upsert_track_and_emp_source`), `src/mrms/db/emp.py`·`emp_section.py`(적재), `src/mrms/api/emp_browse.py`(컨테이너 표시), `src/mrms/onboarding/tidal_favorites.py`(Tidal 플레이리스트 트랙 fetch), 프론트 `web/src/components/track/ModalTrackList.tsx`·`emp/{EmpItemCard,ItemTracksModal,EmpBrowse}.tsx`
