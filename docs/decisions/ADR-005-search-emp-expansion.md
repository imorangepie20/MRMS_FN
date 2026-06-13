# ADR-005 검색 → EMP 확장

작성일: `2026-06-14`

## 상태

승인 — 구현 예정. 브랜치 `feat/search-emp-expansion`(예정). 상세 설계 [2026-06-14-search-emp-expansion-design.md](../superpowers/specs/2026-06-14-search-emp-expansion-design.md).

## 결정

`/search` 페이지를 신설한다. 사용자에겐 **새 트랙·앨범·플레이리스트 검색**이지만, 내부적으로는 **Tidal + Spotify 라이브 검색 → 우리 포맷 정규화 → 표시 + EMP 적재**. 즉 검색 = **사용자 주도 EMP 확장**.

- **플랫폼:** Tidal + Spotify(유저 OAuth 토큰, 미연동 skip). K-pop 커버 충분 — YouTube/한국 서비스 범위 밖.
- **적재 정책:** 결과를 즉시 EMP 적재(`source_type='search'`) — "풀 클수록 좋음". 단 **컨테이너(앨범/플레이리스트) 구성 트랙은 lazy**(열 때 fetch+적재). 트랙 결과는 즉시.
- **병합:** 트랙은 ISRC로 Tidal+Spotify 동일곡 1 Track + TrackPlatform 2개. 앨범/플레이리스트는 플랫폼별(병합 안 함).
- **재사용:** `playback_resolve`의 플랫폼 검색 클라이언트/토큰/매칭 + EMP 크롤 적재 경로(`upsert_track_and_emp_source`/`upsert_section_item`). 임베딩은 기존 EMP 배치에 위임.
- **표면:** 페이지(`/search`). ⌘K 팔레트·as-you-type 범위 밖(제출 시 검색).

대안(비채택): (a) thin proxy — 검색만 보여주고 적재 안 함(EMP 확장 가치 상실, 사용자 핵심 의도와 불일치). (b) eager 컨테이너 트랙 적재(검색당 API 폭증·레이트리밋 — lazy가 UX·비용 우위). (c) 로컬 Track 카탈로그만 검색(신규 곡 발견 불가, EMP 확장 안 됨).

## 배경

MRMS는 추천 중심이지만 사용자가 **특정/새 음악을 직접 찾는** 경로가 없었다. 동시에 추천 후보 풀(EMP)은 크롤로만 확장돼 한정적이었다. 검색을 **사용자 주도 EMP import**로 설계하면 두 니즈를 한 기능으로 충족 — 사용자는 원하는 음악을 찾고, 시스템은 실사용 기반으로 카탈로그를 키운다. 플랫폼 검색 클라이언트는 이미 `playback_resolve`에, 적재 경로는 EMP 크롤에 있어 재사용도가 높다.

## 근거

- 검색 클라이언트·토큰·매칭이 `playback_resolve`에 이미 존재 → "1개 매칭"을 "리스트 + 컨테이너 타입"으로 확장만.
- 적재를 EMP 크롤과 동일 경로(`upsert_track_and_emp_source`/`upsert_section_item`, `source_type='search'`)로 합류 → 브라우즈/통계/임베딩 파이프라인 자동 호환.
- lazy 컨테이너 확장은 기존 `emp_browse` 아이템 뷰를 그대로 재사용.
- 임베딩 안 된 트랙은 추천 후보로 안 쓰여 풀을 키워도 추천 오염 없음(배치가 뒤따라 임베딩).

## 결과

좋은 점:
- 사용자 음악 발견 + EMP 카탈로그 실사용 기반 확장(추천 풀 성장)을 한 기능으로.
- 재사용 최대화(검색 클라이언트 + 적재 경로) → 신규 코드 최소.
- provenance로 검색/크롤 데이터 구분.

트레이드오프:
- 연동 플랫폼만 검색(미연동은 부분 결과) — OAuth 의존.
- 플랫폼 검색 API 레이트리밋(제출 트리거·lazy로 완화).
- **Tidal 앨범/플레이리스트 검색 가용성 미확인**(구현 전 실API 검증 — 안 되면 Tidal=트랙만 degrade).
- EMP가 빠르게 커짐 → 임베딩 배치 부하↑(기존 백로그 이슈와 연결).

## 후속 작업 (plan은 백엔드-퍼스트 2단계 — ADR/스펙은 하나)

**Phase 1 (백엔드):**
1. **Task 1 = Tidal 앨범/플레이리스트 검색 spike** (`/v1/search/albums`·`/v1/search/playlists` 유저 Bearer 실API 확인 — 안 되면 컨테이너는 Spotify only degrade).
2. `src/mrms/search/`(tidal/spotify/**normalize 신규** — `playback_resolve._spotify_candidate` 패턴, `emp/spotify.py`는 embed 스크래퍼라 미사용/persist). ISRC 병합 + EMP 적재(`upsert_track_and_emp_source` @ `emp/base.py:57`, 전체 시그니처).
3. `api/search.py`: `GET /api/search`(토큰 미연동은 404 raise→try/except로 skip) + `POST /api/search/expand`(Tidal 플레이리스트=`tidal_favorites` 재사용). **응답 스키마·source_id 계약 동결.**
4. 단위(normalize/병합/persist) + 통합(search 응답·적재·skip·expand), 플랫폼 API 모킹.

**Phase 2 (프론트):** 동결 스키마 기반 `/search` 페이지 + 그룹 결과 + `ModalTrackList`/`EmpItemCard`/`ItemTracksModal` 재사용.

## 관련 문서

- [상세 설계](../superpowers/specs/2026-06-14-search-emp-expansion-design.md)
- [contents_constructure.md](contents_constructure.md) — EMP 정의
- 코드: `src/mrms/api/playback_resolve.py`, `src/mrms/emp/spotify.py`, `src/mrms/db/emp.py`, `src/mrms/db/emp_section.py`, `src/mrms/api/emp_browse.py`
