# 공유 URL 가져오기 (paste & play) 상세 설계

작성일: `2026-06-14`
상태: 설계 승인 — 구현 예정. ADR-[ADR-009](../../decisions/ADR-009-share-url-import.md).

## 목표

카페 등에서 **공유받은 Tidal/Spotify 링크**(track·playlist·album)를 붙여넣으면 그 트랙들을 가져와 **바로 듣고**, EMP에 적재하는 단독 페이지. 그 뒤 좋아요/플레이리스트 담기는 **기존 트랙 액션에 맡긴다**. 직접 사용자 표현: "카페 같은데서 공유하는거 가져와서 듣는거 … 듣고 나서 좋아요 하거나 자기의 플레이리스트에 넣거나."

핵심: 기존 **Search→EMP 확장(ADR-005)** 인프라 재사용 — 신규 코드는 **URL 파서 + 단일 트랙 fetch 2개 + 얇은 라우트**뿐. fetch(컨테이너)/normalize/persist 전부 재사용.

## 사용자 경험

1. 단독 페이지 `/import` (masthead `paste & play`, nav=Discover) — URL 입력 + 버튼.
2. 붙여넣고 가져오면: **제목(플레이리스트/앨범명 또는 곡명) 헤더 + `ModalTrackList`(+ `PlayAllButton`)**. track URL이면 1곡, container면 전체.
3. 거기서 **재생 · 좋아요(♥→UserTrack) · 취향(✦)** 등 기존 행 액션. "공유받은 거 붙여넣고 듣다가 담기."
4. 로딩/에러/idle 상태.

## 지원 URL

Tidal·Spotify의 **track · playlist · album** 공유 링크. `?si=...` 등 **쿼리 파라미터 무시**.

| 타입 | Spotify | Tidal |
|---|---|---|
| track | `open.spotify.com/track/<id>` | `tidal.com/track/<id>` |
| playlist | `open.spotify.com/playlist/<id>` | `tidal.com/playlist/<uuid>`, `tidal.com/browse/playlist/<uuid>` |
| album | `open.spotify.com/album/<id>` | `tidal.com/album/<id>`, `tidal.com/browse/album/<id>` |

미지원/깨진 URL → 파싱 실패 → 400.

## 아키텍처 / 데이터 흐름

```
[/import 페이지] 공유 URL
   → POST /api/import/url { url }
       → parse_share_url(url) → (platform, item_type, item_id)   # 쿼리 무시
       → 유저 토큰: get_token(user_id)  (Spotify) / _get_access_token (Tidal)  # search와 동일
       → item_type == 'track':  _spotify_track / _tidal_track (GET /tracks/{id}) → normalize_*_track
         item_type ∈ {playlist, album}: fetch_container_tracks(...)             # 기존
       → persist (EMP 적재): persist_container_tracks / persist_search_tracks   # 기존
   ← { platform, item_type, title, tracks }
[/import 페이지] 제목 헤더 + ModalTrackList + Play All
```

## 백엔드 (신규 = 파서 + 단일트랙 fetch 2개 + 라우트)

- `src/mrms/search/share_url.py` 신규: `parse_share_url(url: str) -> tuple[str, str, str] | None` → `(platform, item_type, item_id)`. 호스트(open.spotify.com / tidal.com)·경로(`/track|playlist|album/`, `tidal.com/browse/…`)로 판별, 쿼리·프래그먼트 제거. 미지원이면 None.
- `src/mrms/search/expand.py`에 단일 트랙 fetch 추가: `_spotify_track(http, token, track_id)` (GET `https://api.spotify.com/v1/tracks/{id}`), `_tidal_track(http, token, track_id, country)` (Tidal 트랙 엔드포인트). 결과를 기존 `normalize_spotify_track`/`normalize_tidal_track`로 정규화.
- `src/mrms/api/import_url.py` 신규: `POST /api/import/url {url}` → main.py 등록. 파싱 → 유저 토큰(없으면 안내 에러) → track/container 분기 fetch → EMP persist → `{platform, item_type, title, tracks}` 반환. 인증=`get_current_user_id`.
- 토큰은 **유저 연동 토큰**(search expand와 동일 경로 `_spotify_tok`/`_tidal_tok`). dev-mode client-credentials 403 문제는 유저 토큰이라 무관.

## 프론트

- 신규 페이지 `web/src/app/(dashboard)/import/page.tsx` — masthead + URL 입력 + 버튼. 제출 → `/api/import/url` → 제목 헤더 + `ModalTrackList`(+`PlayAllButton`). 로딩/에러/idle.
- `web/src/lib/api/import.ts` — `importUrl(url)`; 타입 `ImportResult`(platform, item_type, title, tracks: 기존 트랙 형태 재사용).
- `web/src/lib/nav.ts` — Discover 그룹에 항목 추가(Search·situation desk 옆).

## 에러 / 엣지

- 파싱 실패(미지원 호스트/타입) → 400 "지원하지 않는 URL".
- 플랫폼 미연동(토큰 없음) → 친절 안내 "Spotify/Tidal을 연결하세요"(search의 미연동 패턴 재사용).
- 비공개/삭제/없는 항목 → 플랫폼 API 404/403 → "가져올 수 없는 링크" 메시지.
- **Spotify 알고리즘/에디토리얼 플레이리스트(`37i9…`)** — Web API 접근이 막혀 유저 토큰으로도 404일 수 있음 → 위 "가져올 수 없는 링크"로 처리. **구현 시 연동 계정으로 실제 동작 확인**(플래그).

## 제약 / 리스크

- 동작에 **사용자 플랫폼 연동 필요**. 토큰은 `UserOAuth`(userId, platform, accessToken, refreshToken)에 저장. jacinto68은 **prod에 Spotify 연동**돼 있으나 **dev DB(localhost:5433)엔 UserOAuth 행 0개**(dev/prod 분리) → 로컬 라이브 fetch 검증은 prod 토큰 또는 dev 연동이 필요. 단위/통합은 토큰·fetch mock으로 커버.
- `37i9…` 알고리즘 플레이리스트 접근 불가 가능(위) — 구현 시 prod 연동 계정으로 실동작 확인.

## 테스트 전략

- 단위: `parse_share_url` — track/playlist/album × (spotify/tidal) + 쿼리 파라미터 + `browse/` 변형 + 깨진/미지원 URL(None).
- 단위: 단일 트랙 fetch는 httpx mock(respx)으로 normalize 경로 확인.
- 통합: `POST /api/import/url` — 인증, 400(미지원 URL), 미연동 안내, 정상(토큰·fetch mock → 트랙 반환·EMP persist) 경로.
- ⚠️ DB 격리: dev DB cleanup fixture. 전체 `pytest tests/` 금지.

## 비채택 대안

- **검색 페이지 입력 / 작은 모달:** 처음엔 단독 페이지가 과하다 봤으나, "카페에서 받아 쭉 듣기" 시나리오상 제대로 된 표면이 맞아 **단독 페이지** 채택.
- **표시만(저장 X) / 내 라이브러리 직행:** EMP 적재 후 좋아요·플레이리스트 담기를 **사용자 액션에 맡김**(기존 행 액션) 채택.
- **track 제외(컨테이너만):** 실제 공유는 단일 트랙도 흔함(예시 URL) → track 포함.

## 후속 작업

1. `search/share_url.py`(`parse_share_url`).
2. `search/expand.py`에 `_spotify_track`/`_tidal_track`.
3. `api/import_url.py`(`POST /api/import/url`) + main.py 등록.
4. 프론트 `/import` 페이지 + `lib/api/import.ts` + nav.
5. 단위·통합 테스트.
6. 구현 시 연동 계정으로 Spotify/Tidal track·playlist·album + `37i9…` 실동작 확인.

## 관련 문서

- [ADR-009](../../decisions/ADR-009-share-url-import.md)
- [ADR-005 검색→EMP 확장](../../decisions/ADR-005-search-emp-expansion.md) (fetch/normalize/persist 재사용 모체)
- 코드: `src/mrms/search/expand.py`(`fetch_container_tracks`·`persist_container_tracks`), `src/mrms/search/normalize.py`(`normalize_*_track`), `src/mrms/api/search.py`(`_spotify_tok`/`_tidal_tok`), `web/src/components/track/ModalTrackList.tsx`
