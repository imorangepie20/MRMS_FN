# 추천 확장 — EMP 밖 discovery (sub-project ①) 상세 설계

작성일: `2026-06-15`
상태: 설계 승인 — 구현 예정. (신곡 섹션 = sub-project ②, 본 모듈 재사용)

## 목표

MRT(`/mrt`) 추천 트랙을 우리 EMP(임베딩 보유 곡) 안에만 가두지 말고, **연관 아티스트·장르 분석으로 EMP 밖 곡을 끌어와 약 50%를 확장**한다. 분석 엔진은 **Gemini**(취향→연관 곡 제안), 실재화는 **ytmusicapi**(제안을 실제 videoId로 해석, 환각 필터). 적재된 곡은 기존 `youtube_misses` 파이프라인이 임베딩해 **EMP가 발견으로 성장하는 플라이휠**을 만든다.

사용자 의도: "추천을 우리 EMP로 한정하지 말고 연관 가수·장르 분석과 검색으로 50%정도 확장 / 이렇게 새 트랙을 모델이 학습해 EMP 늘리면 풀이 금새 큰다."

## 현재 구조 (배경)

- MRT 응답은 **요청 시** `derive_recommended_tracks`가 저장된 persona playlists 위에서 랭킹(가벼움). 후보는 전부 우리 카탈로그.
- `generate_user_mrt`(recsys/mrt.py) = **배치** 생성(클러스터→persona→`search_for_persona`→PlaylistHistory). onboarding·scripts/09·`regenerate_mrt` 스테이지 공유.
- Gemini는 situation desk에서 이미 사용(`google-genai`, `gemini-2.5-flash`, 구조화 출력).
- `youtube_misses` 스테이지(scripts/13)는 **videoId 있고 임베딩 없는** YouTube 트랙을 무조건 다운로드→MERT→EMP 편입(사이클당 500곡, 스로틀).

## 핵심 결정

1. **discovery = 배치 시 미리 계산, 캐시.** Gemini+ytmusicapi는 수 초 걸려 요청 시 불가. `regenerate_mrt`(+onboarding) 배치에서 유저별로 한 번 돌리고 결과를 적재.
2. **캐시 = EMPSource 재사용(새 테이블 X).** discovery 곡을 `upsert_track_and_emp_source(source_type='discovery', source_id=f'discovery:{user_id}')`로 적재. 요청 시 그 `source_id`로 읽어 블렌드. (search가 `source_id='search:{q}'`로 쓰는 그 메커니즘 동형.)
3. **블렌드 = 50/50 교차.** `recommended_tracks` = taste(EMP, `derive_recommended_tracks` 점수순) N/2 + discovery N/2, 번갈아 배치, `_song_key` dedup. discovery는 임베딩 점수가 없어 **read 순서**(`read_discovery`의 ORDER BY, 예: 적재 최신순)대로 채운다. discovery 비면 100% taste(무회귀).
4. **플라이휠 = 자동.** discovery 곡은 Track + TrackPlatform youtube(임베딩 없이) → 다음 사이클 `youtube_misses`가 임베딩 → EMP 편입. 추가 파이프라인 작업 없음.

## 아키텍처 / 데이터 흐름

```
[배치: regenerate_mrt / onboarding]
  generate_user_mrt(...) 후:
    generate_user_discovery(conn, user_id, *, client):
      1. taste_seed(conn, user_id) → {artists:[top], genres:[top mainGenre]}   # UserTrack→Track→Artist
      2. Gemini: seed → 구조화 출력 list[{artist, title}] (라이브러리에 없는 연관 곡 N개)
      3. 각 {artist,title} → ytmusicapi search → videoId+메타 (해석 실패=환각, 버림)
      4. 이미 보유(라이브러리/EMP, _song_key) 제외 = 진짜 EMP 밖
      5. 기존 discovery EMPSource 삭제 후 재적재
         upsert_track_and_emp_source(platform='youtube', platform_track_id=videoId,
            isrc=None, source_type='discovery', source_id=f'discovery:{user_id}', ...)
    (best-effort: Gemini/ytmusicapi 실패해도 MRT 생성 막지 않음)

[요청: GET /api/mrt/latest]
  recommended_tracks = blend_recsys(taste=derive_recommended_tracks(...),
                                     discovery=read_discovery(conn, user_id), n=top_tracks_n)
  # 50/50 교차, _song_key dedup, discovery 비면 taste만
```

## 백엔드

- **`src/mrms/recsys/discover.py`** (신규):
  - `taste_seed(conn, user_id, *, n_artists=12, n_genres=5) -> dict` — UserTrack→Track→Artist로 재생/좋아요 많은 top 아티스트명 + Track.mainGenre top. 비면 빈 시드.
  - `DiscoverySuggestion(BaseModel)`: `artist: str`, `title: str` (Gemini 구조화 출력 아이템).
  - `gemini_related_tracks(seed, n, *, client) -> list[DiscoverySuggestion]` — situation.py와 동일 패턴(`genai.Client`, `response_mime_type="application/json"`, `response_schema=list[...]`). 시스템 프롬프트: "이 취향(아티스트/장르)의 유저가 좋아할, 목록에 없는 연관 아티스트의 곡 N개를 {artist,title}로. 실재하는 곡만, 시드 아티스트 본인 곡은 피하고 연관 아티스트 위주." 실패 시 `[]`(best-effort).
  - `resolve_via_ytmusic(conn, suggestions) -> list[dict]` — 각 제안을 ytmusicapi 검색(`search/youtube.py`의 `_ytmusic`·정규화 재사용)으로 videoId+메타 해석, 해석 실패는 버림(환각 필터). 우리 포맷(normalize_ytmusic_track shape).
  - `generate_user_discovery(conn, user_id, *, client=None, n=20) -> int` — 위 4단계 + `_song_key`로 보유곡 제외 + 기존 `discovery:{user_id}` EMPSource 삭제 후 재적재. 반환=적재 수. **best-effort(예외 삼킴, 0 반환).** 커밋은 호출자.
  - `read_discovery(conn, user_id) -> list[dict]` — `EMPSource.source_id='discovery:{user_id}'` 조인으로 그 유저의 discovery 트랙(track_id/title/artist/album/youtube_track_id/tidal/spotify) 반환.
  - `blend_recsys(taste: list[dict], discovery: list[dict], n: int) -> list[dict]` — taste·discovery를 번갈아 채워 최대 n개, `_song_key` dedup, discovery 비면 taste만(순수 함수).
- **`src/mrms/recsys/mrt.py`** (수정): `generate_user_mrt` 끝(PlaylistHistory 적재 후)에서 `generate_user_discovery(conn, user_id, client=...)`를 **best-effort try/except**로 호출(모든 MRT-regen 경로가 자동 포함, DRY). Gemini 키 없으면 skip.
- **`src/mrms/api/main.py`** (수정): MRT 응답 조립에서 `recommended_tracks`를 `blend_recsys(taste_raw, read_discovery(conn, user_id), top_tracks_n)` 결과로 생성. discovery 트랙 메타(youtube_track_id 등)는 `read_discovery`가 제공. liked/pct 상태 조회·hidden 필터는 기존과 동일하게 적용.
- **`src/mrms/api/schemas.py`** (수정 시): `RecommendedTrack`에 `youtube_track_id: str | None = None`(discovery 곡 재생용) — 없으면 추가. 프론트 타입은 이미 optional 보유.

## 프론트

기존 `/mrt`의 recommended_tracks 렌더·재생(`toQueueTrack`)이 youtube_track_id를 이미 지원 → **discovery 트랙 자동 표시·재생**(연결 플랫폼으로 playback resolve 교차). (선택) 행에 "discovery/추천확장" 뱃지 — 후속/옵션.

## 타이밍 / 캐시

- discovery는 `generate_user_mrt`(배치) 때 1회 → `discovery:{user_id}` EMPSource로 캐시. MRT 재생성 주기(주2회 cron + stale 유저)마다 갱신.
- 요청 시는 캐시만 읽어 블렌드 → 페이지 지연 0.
- onboarding 직후엔 discovery가 아직 없을 수 있음(첫 regen 사이클에 채워짐) → 그동안 100% taste(무회귀). ADR-001의 "사이클마다 업그레이드" 철학과 일치.

## 에러 / 엣지

- Gemini 키 없음/호출 실패 → discovery skip, MRT는 taste 100%(무회귀).
- ytmusicapi 해석 0 → discovery 비고 taste 100%.
- 환각(존재하지 않는 곡) → ytmusicapi 미해석으로 자동 탈락.
- 취향 신호 없는 신규 유저(UserTrack<k) → seed 빈약 → discovery skip(기존 MRT도 skip).
- discovery 곡이 이후 EMP에 임베딩되면, 다음 regen 때 taste 후보로도 등장 가능(중복은 `_song_key` blend dedup).

## 제약 / 리스크

- Gemini 환각·부정확 → ytmusicapi 해석으로 1차 필터(존재 검증). 부정확한 매칭(동명 다른 곡)은 잔존 가능 — v1 허용, 후속 스코어링.
- 플라이휠 페이싱 = `youtube_misses` 500곡/사이클 상한. discovery가 더 빨리 후보를 만들면 백로그(사이클마다 소진).
- ytmusicapi 비공식(깨질 수 있음) — 해석 실패는 graceful(discovery만 비고 taste 유지).
- Gemini 비용·지연 = 배치라 무해(요청 경로 아님). 유저당 Gemini 1콜 + ytmusicapi N검색.

## 테스트 전략

- 단위: `taste_seed`(top 아티스트/장르 도출), `blend_recsys`(50/50 교차·dedup·discovery 빈 경우 taste만, 순수 함수), `read_discovery`(source_id 필터).
- 단위: `gemini_related_tracks`는 Gemini client mock(situation 테스트 패턴), `resolve_via_ytmusic`는 `_ytmusic` mock → 해석/환각필터 확인.
- 통합: `generate_user_discovery`(mock Gemini+ytmusicapi → discovery EMPSource 적재·보유곡 제외), `GET /api/mrt/latest`가 discovery 트랙 포함(blend)·discovery 없으면 taste만.
- ⚠️ DB 격리: cleanup fixture(Track/EMPSource/TrackPlatform/discovery source). 전체 `pytest tests/` 금지.

## 비채택 대안

- **요청 시 discovery(캐시 없이):** Gemini+ytmusicapi 수 초 → 페이지 지연. 기각, 배치+캐시.
- **새 캐시 테이블:** EMPSource(source_type='discovery')로 충분 → 새 테이블·마이그레이션 불필요.
- **플랫폼 native related(Spotify recommendations/related):** dev-mode 앱에서 폐기(2024) 가능성 → Gemini+ytmusicapi가 더 견고·범용.
- **discovery 곡 즉시 MERT 임베딩(동기):** 무거움(yt-dlp+GPU). 기존 `youtube_misses` 비동기 파이프라인에 맡김.

## 후속 작업 (이 sub-project)

1. `recsys/discover.py`(taste_seed·gemini_related_tracks·resolve_via_ytmusic·generate_user_discovery·read_discovery·blend_recsys).
2. `recsys/mrt.py` `generate_user_mrt` 끝에 best-effort discovery 훅.
3. `api/main.py` recommended_tracks 블렌드 + `schemas.py` RecommendedTrack youtube_track_id.
4. 단위·통합 테스트.

## 다음 sub-project (②, 본 모듈 재사용)

**신곡 섹션**: `generate_user_discovery`의 Gemini 호출에 **Google Search 그라운딩**(`types.Tool(google_search=...)`)으로 "지금 기준 최신 발매" 프롬프트 → `new_releases` source_type으로 적재 → MRT 응답 `new_releases` 필드 + `/mrt` 새 섹션. 별도 spec.

## 관련 문서

- [ADR-008 taste-first 임베딩 recsys](../../decisions/ADR-008-taste-first-embedding-recsys.md) (taste 절반의 엔진)
- [ADR-007 situation LLM](../../decisions/ADR-007-situation-llm-recommendation.md) (Gemini 재사용 모체)
- [ADR-001 YouTube 신규유저 자동화](../../decisions/ADR-001-youtube-newuser-automation.md) (`youtube_misses` 임베딩 = 플라이휠)
- [ADR-009 / search](../../decisions/ADR-009-share-url-import.md) (`upsert_track_and_emp_source`·ytmusicapi 적재 패턴)
- 코드: `src/mrms/recsys/mrt.py`(`generate_user_mrt`), `src/mrms/recsys/taste_mood.py`(`_song_key`), `src/mrms/llm/situation.py`(Gemini), `src/mrms/search/youtube.py`(`_ytmusic`·정규화), `src/mrms/emp/base.py`(`upsert_track_and_emp_source`), `src/mrms/api/main.py`(MRT 조립)
