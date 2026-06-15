# 취향 맞춤 신보(신곡) 섹션 상세 설계

작성일: `2026-06-15`
상태: 설계 승인 — 구현 예정.

## 목표

사용자 취향(아티스트/장르)에 연관된 **최근 발매곡(신보)** 을 Gemini + Google Search grounding으로 찾아 `/mrt` 추천 화면에 **별도 섹션**("취향 맞춤 신보")으로 노출한다. 이는 추천 확장 sub-project ②다(①=discovery, EMP-밖 연관곡). discovery 파이프라인을 본떠 새 모듈로 분리하고, 적재한 신곡은 기존 임베딩 플라이휠을 그대로 타 EMP 풀을 키운다.

직접 요청: "신곡 추천 섹션 만들고". 핵심 동작 선택: **취향 맞춤 신보(per-user, Gemini grounding)**.

## 핵심 결정

1. **신곡 = 취향 연관 + 최근 발매(best-effort)**. 발매 신선도는 Gemini Google Search grounding에 의존하는 best-effort다(현 스키마에 발매일을 채우는 importer가 전혀 없어 DB 기준 신선도 판별은 불가능 — `Album.releaseDate`는 존재하나 항상 빈값). ytmusic 해석은 "재생 가능 videoId"만 보증하지 발매일을 검증하진 않는다. 이 한계는 A안 선택 시 수용됨.
2. **per-user 생성**. discovery와 동일하게 `generate_user_mrt` 안에서 best-effort 훅으로 생성 → cron MRT 재생성 및 admin "추천 실행"(`/admin/emp` run-mrt) 시 함께 갱신.
3. **별도 섹션 노출**(메인 블렌드 `blend_recsys` 무수정). `MrtLatestResponse`에 `recommended_new_releases` 필드 추가.
4. **source_type=`'new_release'` 신설 + 플라이휠 태움**. discovery처럼 적재→트리거가 `inEmp=TRUE`→임베딩→EMP 풀 성장. 단 `scripts/13` MISS_SQL OR-clause에 `'new_release'` 한 줄 추가 필수(미적용 시 오디오 미다운로드→영영 임베딩 안 됨).

## 현재 구조 (배경 — 그라운딩 확인)

- **discovery 파이프라인**(`src/mrms/recsys/discover.py`): `taste_seed` → `gemini_related_tracks`(response_schema=`TrackSuggestions`, `thinking_budget=0`, `DiscoveryLLMError` 래핑) → `resolve_via_ytmusic`(ytmusicapi 검색→첫 유효 videoId→환각 드롭) → `_owned_song_keys`/`_song_key` 보유곡 제외 → `upsert_track_and_emp_source`(source_type='discovery', source_id='discovery:{uid}') 적재. best-effort: 어떤 실패도 `return 0`, 내부 commit, per-track rollback. `read_discovery(conn, uid, *, limit)`로 읽음.
- **공통 적재**: `upsert_track_and_emp_source`(`src/mrms/emp/base.py`) — Track/TrackPlatform/EMPSource 멱등 적재 + 내부 commit. `delete_emp_sources_by_source_id`(`src/mrms/db/emp.py`) — replace. `normalize_ytmusic_track`(`src/mrms/search/normalize.py`) — videoId 없으면 None=환각필터. `_ytmusic`+`AUTH_SETTING_KEY`(`src/mrms/search/youtube.py`).
- **플라이휠**: EMPSource INSERT → 트리거 `sync_track_in_emp`가 `Track.inEmp=TRUE` → `scripts/10` `embedding_loader.fetch_pending`(source_type 안 봄, `inEmp=TRUE`만) 임베딩 → `mrt.py` 후보 쿼리(`inEmp=TRUE`+`TrackEmbedding`)가 자동 후보. **함정**: `scripts/13` MISS_SQL(오디오 다운로드 게이트)은 OR-clause에 `source_type='discovery'`를 명시 → 다른 값은 오디오 미다운. 필수 조건: `platform='youtube'`+실제 videoId(합성 `yt_` ID는 `NOT LIKE 'yt\_%'`로 영구 배제).
- **MRT 통합/서빙**: `generate_user_mrt(conn, uid) -> int|None`(persona 클러스터링 후 discovery 훅, 커밋은 호출자, 트랙<k면 None). `mrt_latest`(`api/main.py`)가 taste/discovery를 50/50 블렌드(`blend_recsys`)해 `MrtLatestResponse`로 서빙. `hidden`/dismiss 필터 적용.
- **프론트**: `web/src/app/(dashboard)/mrt/page.tsx`(SSR, `getServerSideMrt`) → `web/src/components/mrms/MrtDashboard.tsx`(섹션 인라인, 로컬 `SectionHeader`+`TrackRow`). 계약: `src/mrms/api/schemas.py:MrtLatestResponse` ↔ `web/src/lib/types.ts:MrtLatestResponse`(1:1).
- **Gemini grounding 제약**(미검증, 일반지식): `response_schema`(structured output)와 `tools=[Tool(google_search=...)]`를 한 호출에 동시 사용 못 할 가능성 높음 → 2단계 우회. grounded 단계는 thinking 필요(컷오프 우회), structured 단계는 `thinking_budget=0`.

## 백엔드

### 신규 모듈 `src/mrms/recsys/newrelease.py` (discover.py 본뜸)

**`gemini_new_releases(seed, n, *, client=None) -> list[TrackSuggestion]`** — Gemini 2단계:
1. **Call 1 (grounded)**: `tools=[types.Tool(google_search=types.GoogleSearch())]`, response_schema 없음(자유텍스트), thinking 활성(`thinking_budget` 미지정 또는 양수). 프롬프트: 취향 아티스트/장르를 주고 *"최근 약 6개월 내 발매된, 이 취향의 사용자가 좋아할 곡(연관 아티스트 포함)을 검색해 찾아라. 실재하는 곡만, artist·title 정확히, 발매 시기 포함"*.
2. **Call 2 (structured)**: Call 1의 텍스트를 입력으로 `response_schema=TrackSuggestions`(discover.py 재사용/공유), `thinking_budget=0`로 `{artist,title}[]` 정규화.
3. 실패 시 `DiscoveryLLMError`(discover.py 것 재사용) 또는 모듈 자체 예외 — 호출부가 삼킴.

> SDK가 grounding+schema 동시 호출을 허용한다면 1단계로 단순화 가능(구현 시 실측). 2단계는 안전 기본값.

**`read_newrelease(conn, user_id, *, limit=50) -> list[dict]`** — `read_discovery`와 동형(SQL의 `source_id`만 `new_release:{uid}`). dict shape 동일(youtube_track_id 포함).

**`generate_user_newrelease(conn, user_id, *, client=None, n=20) -> int`** — best-effort, 내부 commit, 실패 시 0:
1. 키 없고 client 미주입이면 `return 0`(무회귀).
2. `seed = taste_seed(conn, uid)`(재사용); `seed["artists"]` 비면 `return 0`.
3. `suggestions = gemini_new_releases(seed, n, client=client)`.
4. `resolved = resolve_via_ytmusic(conn, suggestions)`(재사용); 비면 0.
5. 보유곡 + **discovery 곡** 제외: `owned = _owned_song_keys(conn, uid)`에 더해, discovery와의 교차중복 방지를 위해 `read_discovery`의 `_song_key` 집합도 제외(같은 곡이 두 섹션에 동시 노출 방지).
6. `src = f"new_release:{uid}"`; `delete_emp_sources_by_source_id(conn, src)`(replace); 각 트랙 `upsert_track_and_emp_source(..., platform='youtube', platform_track_id=videoId, source_type='new_release', source_id=src, source_name='New Releases')`; per-track rollback+continue. `return count`.

### `generate_user_mrt` 훅 (`src/mrms/recsys/mrt.py`)

discovery 훅 바로 옆에 두 번째 best-effort 블록 추가(함수-로컬 import, 예외 전파/rollback 금지):
```python
try:
    from mrms.recsys.newrelease import generate_user_newrelease
    generate_user_newrelease(conn, user_id)
except Exception as e:  # best-effort, MRT 생성 막지 않음
    log.warning("new_release hook failed for %s: %r", user_id, e)
```

### `mrt_latest` 서빙 (`src/mrms/api/main.py` + `schemas.py`)

- `schemas.py:MrtLatestResponse`에 `recommended_new_releases: list[RecommendedTrack] = []` 추가.
- `mrt_latest`에서 `read_newrelease(conn, uid)`로 트랙을 읽어 기존 메타 보강(`RecommendedTrack` shape)·`hidden`/dismiss 필터 동일 적용 후 필드 채움. 비면 빈 리스트.

### 플라이휠 게이트 (`scripts/13...`)

MISS_SQL OR-clause에 `OR es.source_type = 'new_release'` 한 줄 추가(discovery와 나란히). → 신곡 youtube 트랙(UserTrack 없음)도 오디오 다운로드 대상 → MERT 임베딩 → EMP 진입.

## 프론트

- `web/src/lib/types.ts:MrtLatestResponse`에 `recommended_new_releases: RecommendedTrack[]` 추가(백엔드와 1:1).
- `web/src/components/mrms/MrtDashboard.tsx`: discovery 섹션 패턴 그대로, `SectionHeader(num='PT 04', title='취향 맞춤 신보', ...)` + 기존 로컬 `TrackRow` 재사용 렌더 블록. 빈 배열이면 섹션 숨김(다른 섹션과 동일 관례).

## 에러 / 엣지

- Gemini 키 없음 → skip(0, 무회귀). grounding/파싱 실패 → 0. 해석 0건 → 0. per-track 실패 → rollback+continue.
- 신곡 훅 실패가 MRT 생성을 막지 않음(best-effort, discovery와 동일 규약).
- 빈 신곡 → 프론트 섹션 미표시.
- discovery↔신곡 교차중복 → `_song_key` 제외로 방지.
- grounding+schema 동시 제약 실측: 동시 가능하면 1단계, 아니면 2단계(설계 기본).

## 테스트 전략

- `tests/recsys/test_newrelease.py` 신규 — `tests/recsys/test_discover.py`의 `_FakeClient`/`_FakeResp`/`_FakeModels` 주입 패턴 복제(라이브 Gemini 차단). 검증: 2단계 호출 흐름(grounded→structured), 환각 드롭(videoId 없는 항목 제외), 보유곡+discovery 제외, EMPSource(source_type='new_release', source_id='new_release:{uid}') 적재, 키 없음 skip, best-effort 0 반환.
- `mrt_latest` 응답에 `recommended_new_releases` 포함 검증(read_newrelease 패치).
- ⚠️ DB 격리 안 됨 — 대상 파일만, 전체 `pytest tests/` 금지. 프론트 tsc/lint/build.

## 비채택 / 범위 밖 (YAGNI)

- 발매일 컬럼 적재 경로 신설(Album.releaseDate 채우기) — grounding으로 신선도 확보, DB 정렬 근거는 후속(현재 importedAt 근사).
- 글로벌 신보 차트(Apple RSS) / 하이브리드 임베딩 랭킹 — A안(취향 맞춤) 채택으로 비채택. 추후 별도 가능.
- `blend_recsys` 3-way 일반화 / 메인 리스트 혼합 — 별도 섹션이라 불필요.
- discovery 재라벨링 — 실제 신곡 아니라 비채택.
- 신곡 전용 staleness 게이트(매 MRT 재생성마다 grounding 비용) — discovery와 동일 정책, 후속 최적화 여지(YAGNI).

## 후속 작업

1. `recsys/newrelease.py`: `gemini_new_releases`(2단계 grounded) + `read_newrelease` + `generate_user_newrelease`.
2. `mrt.py`: `generate_user_mrt`에 new_release best-effort 훅.
3. `schemas.py`/`api/main.py`: `MrtLatestResponse.recommended_new_releases` + `mrt_latest` 채움.
4. `scripts/13...` MISS_SQL OR-clause에 `'new_release'` 추가.
5. 프론트: `types.ts` 필드 + `MrtDashboard.tsx` 섹션.
6. 테스트: `test_newrelease.py` + mrt_latest 응답 검증.

## 관련 문서

- [추천 EMP-밖 discovery (sub-project ①)](2026-06-15-recommendation-expansion-discovery-design.md) — 본 설계가 본뜨는 파이프라인.
- [추천 실행 관리 페이지](2026-06-15-admin-run-recommendations-design.md) — 이 액션이 신곡도 갱신.
- 코드: `src/mrms/recsys/discover.py`(파이프라인 템플릿), `src/mrms/recsys/mrt.py`(`generate_user_mrt`·훅), `src/mrms/emp/base.py`(`upsert_track_and_emp_source`), `src/mrms/search/normalize.py`(`normalize_ytmusic_track`), `src/mrms/api/main.py`+`schemas.py`(`mrt_latest`·`MrtLatestResponse`), `web/src/components/mrms/MrtDashboard.tsx`, `web/src/lib/types.ts`, `scripts/13*`(MISS_SQL).
