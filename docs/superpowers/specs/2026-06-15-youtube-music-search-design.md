# YouTube Music 검색 (쿼터 밸런스) 상세 설계

작성일: `2026-06-15`
상태: 설계 승인 — 구현 예정.

## 목표

검색에 **YouTube Music을 Tidal/Spotify와 동급의 제3 소스**로 추가한다. YT Music을 메인으로 쓰는(연결한) 유저가 검색에서 YT Music 카탈로그 결과를 받고 **본인 구독으로 재생**한다. 동시에 **Data API v3 쿼터 한도(기본 10k/일)에 걸리지 않도록 밸런스**를 맞춘다 — 사용자 핵심 요구: "limit에 안 걸리도록 밸런스".

기존 검색(ADR-005): 유저 토큰으로 Tidal/Spotify 라이브 검색 → `merge_tracks` → EMP 적재 → 표시·재생. 여기에 YT Music 소스를 더한다.

## 핵심 결정 — 검색 엔진은 ytmusicapi (쿼터 0)

YT Music은 **공식 검색 API가 없다.** 두 경로의 트레이드오프:

- **ytmusicapi(비공식)**: YT Music 카탈로그를 그대로 검색(트랙/앨범/플레이리스트, 아티스트·앨범·길이·썸네일·videoId 깔끔). **Data API 쿼터 0유닛.** 단, 코드에 기록된 약점 — `playback_resolve.py`: "ytmusicapi 'songs' 검색이 수시로 전역 0이 돼 신뢰 불가".
- **Data API v3 search.list**: 공식·안정적이나 **호출당 100유닛**(재생 resolve와 공유 → 하루 ~100검색 벽) + 결과가 영상이라 메타데이터 지저분.

**채택**: ytmusicapi를 **주력**(쿼터 0), 그 약점(간헐적 0건)만 **Data API 폴백**으로 헤지하되 **일일 예산 가드로 상한**을 둔다. 이미 `emp/youtube.py`가 ytmusicapi + 인증 Setting(`youtube_auth_json`)을 쓰고 있어 재사용한다.

## 쿼터 밸런스 (설계 중심)

1. **ytmusicapi 검색 = 0유닛** — 주력. 대부분의 검색이 여기서 끝난다.
2. **검색이 재생 resolve 쿼터를 절약** — ytmusicapi 결과는 `videoId`를 바로 준다 → EMP `TrackPlatform youtube` 적재 → 그 곡 재생 시 `_resolve_youtube`(100유닛) **불필요**(이미 매핑 보유). 즉 YT 검색은 총 Data API 사용을 **늘리지 않고 오히려 줄인다**.
3. **Data API 폴백은 제한적** — ytmusicapi가 **0건일 때만** 1회, 그리고 **일일 search 폴백 예산** 안에서만:
   - Setting `yt_search_fallback_cap`(기본 `30` = 하루 최대 30회 ≈ 3,000유닛, 10k의 작은 슬라이스 — 나머지는 재생 resolve 몫).
   - 일일 카운터 Setting `yt_search_fallback_count_{YYYYMMDD}`(UTC). 폴백 직전 `count >= cap`이면 **폴백 skip**(ytmusicapi 결과만 노출). 성공 호출 시 `count += 1`.
   - 날짜 키라 자정(UTC)에 자동 리셋(이전 키는 stale, 정리 불필요).
4. 결과적으로 Data API 사용 상한 = (재생 resolve) + (≤30 search 폴백) → **10k/일 한도 내 보장**.

## 트리거 — 연결/primary 기반

YT 검색은 **유저가 YouTube를 연결한 경우에만** 호출(Tidal/Spotify가 토큰 있을 때만 도는 것과 동형). 판정: `get_oauth(conn, user_id, "youtube") is not None`. 미연결·타플랫폼 전용 유저는 YT 검색을 **건너뜀**(노이즈·불필요 호출 방지). 연결 안 했으면 결과·쿼터 모두 0.

## 아키텍처 / 데이터 흐름

```
GET /api/search?q=...&types=track,...
  → (기존) Spotify/Tidal: 유저 토큰으로 search_spotify/search_tidal
  → (신규) YouTube: get_oauth(user,'youtube') 있으면 search_youtube(conn, q):
        ├ ytmusicapi yt.search(q) [to_thread, 인증 인스턴스 재사용]  # 0유닛
        │    → resultType 'song'/'video' → normalize_ytmusic_track (videoId)
        ├ 결과 비었고 예산 남으면 → Data API search.list 폴백(1회) + count++   # 100유닛
        └ 실패/예외 → 소스 skip (부분 결과)
  → merge_tracks(spotify+tidal+youtube)   # YT는 ISRC 없어 별 행, youtube_track_id 채움
  → persist_search_tracks  # youtube → TrackPlatform youtube 적재 (재생 resolve 절약)
  ← { tracks, albums, playlists, skipped_platforms }
```

## 백엔드

- **`src/mrms/search/youtube.py`** (신규): `search_youtube(conn, q, *, http) -> dict` (`{tracks, albums, playlists}`; v1은 tracks만 채우고 albums/playlists=[]).
  - ytmusicapi 인스턴스: `emp/youtube.py`의 인증 패턴 재사용(Setting `youtube_auth_json` → `YTMusic(auth)` else `YTMusic()`), 모듈 캐시. 동기 → `asyncio.to_thread`.
  - `yt.search(q)` 결과에서 `resultType in ('song','video')` 항목만 → `normalize_ytmusic_track`.
  - 0건 + 예산(`_fallback_budget_ok(conn)`) 통과 시: Data API v3 `search.list`(part=snippet, type=video, videoEmbeddable=true, maxResults=12, key=`YOUTUBE_DATA_API_KEY`) → videoId·title·channel을 트랙으로 normalize, `yt_search_fallback_count_{date}` 증가. 키 없으면 폴백 생략.
  - 예외/타임아웃 → `RuntimeError` raise(라우트가 'youtube' skip 처리, Tidal/Spotify와 동형).
- **`src/mrms/search/normalize.py`** (수정): `normalize_ytmusic_track(item) -> dict|None` 추가 — `{platform:"youtube", platform_track_id:videoId, title, artist(=artists[0].name), album_title(=album.name), album_cover(=best thumbnail), duration_ms, isrc:None}`. videoId 없으면 None(합성 ID 금지 — IFrame 재생 불가). `_to_flat`에 `youtube_track_id` 추가(`platform=="youtube"`면 platform_track_id). `merge_tracks`: YT는 ISRC 없어 항상 별 행(교차 dedup 없음).
- **`src/mrms/search/persist.py`** (수정): persist 루프에 `("youtube", "youtube_track_id")` 추가 → `upsert_track_and_emp_source(platform="youtube", platform_track_id=videoId, isrc=None, ...)`.
- **`src/mrms/api/search.py`** (수정): 검색 fan-out에 YT 소스 추가 — `get_oauth(conn, user_id, "youtube")` 있으면 `search_youtube(conn, q, http=http)` 실행, 결과를 `agg["tracks"]`에 합류. 실패 시 `skipped.append("youtube")`. `/expand`는 v1에서 YT 미지원 유지(tidal/spotify만).
- **예산 가드**: `search/youtube.py` 내부 `_fallback_budget_ok(conn)`/`_bump_fallback(conn)` — `get_setting`/`set_setting`으로 `yt_search_fallback_cap`(기본 30) vs `yt_search_fallback_count_{UTC date}` 비교·증가.

## 프론트

기존 검색 페이지가 `tracks`(flat, tidal/spotify/youtube_track_id 포함)를 렌더하고 `ModalTrackList`/`PlayButton`이 `youtube_track_id`를 이미 지원 → **YT 트랙은 추가 작업 없이 표시·재생**. (선택) 트랙 행에 플랫폼 뱃지로 출처 표시 — 후속/옵션.

## 정규화/머지 세부

- YT 트랙: ISRC 없음 → `merge_tracks`에서 Tidal/Spotify와 합쳐지지 않고 개별 행. 각 행은 `youtube_track_id`만 채워져 재생 가능.
- `_to_flat`/`merge_tracks`에 youtube 컬럼 추가는 Tidal/Spotify 동작 불변(추가 필드일 뿐).

## 에러 / 엣지

- 미연결(YouTube UserOAuth 없음) → YT 검색 자체 skip.
- ytmusicapi 0건 + 예산 소진 → 폴백 없이 YT 빈 결과(Tidal/Spotify 결과는 그대로).
- ytmusicapi 예외/타임아웃 → 'youtube' skip(부분 결과 안내, 기존 패턴).
- Data API 폴백도 0/에러 → YT 빈 결과.
- videoId 없는 ytmusicapi 항목 → 해당 트랙 skip(재생 불가).

## 제약 / 리스크

- ytmusicapi는 비공식 — YT 내부 변경 시 깨질 수 있음(emp 차트 임포터와 동일 리스크). 검색 실패는 소스 skip으로 graceful.
- v1은 **YT 트랙만**. 앨범/플레이리스트는 `/api/search/expand`가 YT 미지원이라 제외(후속).
- 인증 인스턴스(`youtube_auth_json`)가 비면 무인증 `YTMusic()` — 동작하나 결과 완전성/안정성이 다소 낮을 수 있음.

## 테스트 전략

- 단위: `normalize_ytmusic_track`(ytmusicapi search dict → 우리 shape, videoId 없으면 None), `merge_tracks`에 youtube_track_id 채워짐(ISRC 없어 별 행), `_fallback_budget_ok`/`_bump_fallback`(cap 초과 시 False, 카운터 증가).
- 단위: `search_youtube`의 ytmusicapi 호출은 mock(YTMusic.search 결과) → tracks 정규화; 0건 + 예산 통과 시 Data API 폴백 mock 호출 확인; 예산 소진 시 폴백 skip.
- 통합: `GET /api/search` — YouTube 연결 유저면 YT 트랙 포함(ytmusicapi mock), 미연결이면 미포함, ytmusicapi 예외 시 'youtube' skip.
- ⚠️ DB 격리: dev DB cleanup fixture. 전체 `pytest tests/` 금지(대상 파일만).

## 비채택 대안

- **Data API v3 검색만(B)**: 호출당 100유닛 → limit 벽 + 영상 메타 지저분. 기각(밸런스 위반).
- **ytmusicapi만, 폴백 없음(C)**: 가장 단순하나 간헐적 0건 무방비. 폴백+예산가드로 보완해 A 채택.
- **항상 3소스 동시**: 트리거를 연결 기반으로 둬 불필요 호출/노이즈 차단.
- **YT 앨범/플레이리스트 v1 포함**: expand 미지원이라 반쪽 UX → 후속.

## 후속 작업

1. `search/youtube.py`(`search_youtube` + 예산 가드 + Data API 폴백).
2. `search/normalize.py`(`normalize_ytmusic_track`, `_to_flat`/`merge_tracks` youtube 컬럼).
3. `search/persist.py`(youtube 적재).
4. `api/search.py`(YT 소스 fan-out, 연결 게이트).
5. 단위·통합 테스트.
6. (후속) YT 앨범/플레이리스트 검색 + `/expand` YT 지원, 트랙 행 플랫폼 뱃지, 교차 플랫폼 fuzzy dedup 검토.

## 관련 문서

- [ADR-005 검색→EMP 확장](../../decisions/ADR-005-search-emp-expansion.md) (검색 인프라 모체)
- [ADR-001 YouTube 신규유저 자동화](../../decisions/ADR-001-youtube-newuser-automation.md) (YT 임베딩/ytmusicapi 맥락)
- 코드: `src/mrms/api/search.py`, `src/mrms/search/normalize.py`·`persist.py`·`spotify.py`(소스 패턴), `src/mrms/emp/youtube.py`(ytmusicapi+인증 Setting 재사용), `src/mrms/api/playback_resolve.py`(`_resolve_youtube`·Data API 폴백 참고), `src/mrms/db/settings.py`(예산 카운터)
