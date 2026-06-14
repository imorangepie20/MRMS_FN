# ADR-009 공유 URL 가져오기 (paste & play)

작성일: `2026-06-14`

## 상태

승인 — 구현 예정. 상세 설계 [2026-06-14-share-url-import-design.md](../superpowers/specs/2026-06-14-share-url-import-design.md). 단독 페이지 `/import`(nav=Discover), 엔드포인트 `POST /api/import/url`.

## 결정

카페 등에서 **공유받은 Tidal/Spotify 링크**(track·playlist·album)를 붙여넣으면 트랙을 가져와 듣고 **EMP에 적재**하는 단독 페이지. 좋아요·플레이리스트 담기는 **기존 트랙 행 액션에 맡김**.

- **기존 Search→EMP 확장(ADR-005) 재사용** — 신규 = URL 파서 + 단일트랙 fetch 2개 + 얇은 라우트. `fetch_container_tracks`/`normalize_*`/`persist_*`/유저 토큰(`_spotify_tok`/`_tidal_tok`)은 그대로.
- **지원**: track/playlist/album × Tidal/Spotify, `?si=` 등 쿼리 무시, `tidal.com/browse/…` 변형.
- **목적지 = EMP 적재 + 표시**, 그 뒤는 사용자 액션(♥/✦/재생).
- **단독 페이지** 채택(처음엔 검색 입력/모달 고려했으나 "카페에서 받아 쭉 듣기" 시나리오상 제대로 된 표면).

## 배경

사용자가 외부에서 공유받은 플레이리스트/트랙 링크를 우리 앱에서 바로 듣고 싶다("카페 같은데서 공유하는거 가져와서 듣는거"). 검색→EMP 확장에 이미 컨테이너 트랙 fetch·정규화·EMP 적재가 있어, URL 파싱만 더하면 재사용으로 조립 가능.

## 근거

- fetch/normalize/persist/토큰 전부 존재 → 신규 코드 최소.
- 유저 토큰 경로라 dev-mode client-credentials 403 무관.
- track도 흔히 공유됨(예시 URL) → 컨테이너+단일트랙 모두 지원.

## 결과

좋은 점: 외부 공유 콘텐츠를 즉시 청취+적재, 신규 표면 최소, EMP·추천에 흡수.

트레이드오프:
- 사용자 플랫폼 연동 필요(미연동→안내). dev/prod DB 분리로 로컬 라이브 검증 제약.
- Spotify `37i9…` 알고리즘 플레이리스트는 Web API 미접근(404) 가능 → 친절 에러 + 구현 시 확인.

## 후속 작업

1. `search/share_url.py`(`parse_share_url`).
2. `search/expand.py` 단일트랙 fetch(`_spotify_track`/`_tidal_track`).
3. `api/import_url.py`(`POST /api/import/url`) + main.py 등록.
4. 프론트 `/import` + `lib/api/import.ts` + nav.
5. 단위·통합 테스트.
6. 구현 시 prod 연동 계정으로 실동작 확인(특히 `37i9…`).

## 관련 문서

- [상세 설계](../superpowers/specs/2026-06-14-share-url-import-design.md)
- [ADR-005 검색→EMP 확장](ADR-005-search-emp-expansion.md) (재사용 모체)
- 코드: `src/mrms/search/expand.py`, `src/mrms/search/normalize.py`, `src/mrms/api/search.py`
