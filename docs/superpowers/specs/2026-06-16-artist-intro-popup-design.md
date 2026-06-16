# 아티스트 소개 팝업 상세 설계

작성일: `2026-06-16`
상태: 설계 승인 — 구현 예정.

## 목표

아티스트명이 노출되는 **모든 페이지**에서 이름을 클릭하면 **소개 팝업**을 띄운다. 팝업은 **하이브리드 소스** — Gemini 생성 소개 텍스트 + Spotify 이미지/장르 + **우리 풀에 있는 그 아티스트의 곡(재생 가능)** 으로 구성한다.

직접 요청: "아티스트 소개 팝업 — 아티스트명 있는 모든 페이지, 소개 + 그 아티스트 곡들 재생 가능".

## 핵심 결정

1. **소스 = 하이브리드**(Tidal 강화 후 최종): bio는 **Tidal 실제 에디토리얼 전기**를 **Gemini가 2-3문장 한국어로 요약**(생성 아닌 요약 → 환각 최소), 전체 전기는 모달 "더보기"(`bioFull`). 이미지는 **Tidal 우선 → Spotify 폴백**. 곡은 우리 DB. 어느 소스 실패해도 나머지로 성립(best-effort). Tidal bio 없으면 Gemini가 장르 맥락으로 생성(폴백). **장르는 현재 신뢰 소스 없음**(Spotify가 `genres` 필드 deprecate, `Artist.mainGenre` 미채움) → 칩 미표시(graceful), Tidal bio가 보완. 상세는 문서 하단 "Tidal 강화" 참조.
2. **트리거 = 모든 페이지**: 공용 `<ArtistLink>` 컴포넌트로 아티스트명을 감싸 일괄 적용(MRT·검색·PGT·EMP 등).
3. **키 = nameNormalized**(`name.lower().strip()`, Artist.nameNormalized와 동일). 트리거는 어디서나 아티스트 **이름 문자열**만 가지므로 이름 기준.
4. **캐시**: 소개 텍스트·이미지·장르는 잘 안 변해 `ArtistProfile` 테이블에 영구 캐시(재생성/재호출 X). 곡 리스트는 DB에서 라이브 조회.

## 현재 구조 (배경 — 그라운딩 확인)

- **Artist 테이블**(`prisma/schema.prisma:42`): `id, name, nameNormalized, mainGenre`. **bio·image 없음** → 외부 소스 필요. `nameNormalized = name.lower().strip()`(`emp/base.py:30`).
- **Gemini 인프라**: `recsys/discover.py`/`newrelease.py`/`llm/situation.py`가 `google-genai`로 호출(`settings.gemini_model`·`gemini_api_key`, `GenerateContentConfig`, `thinking_budget=0`, `DiscoveryLLMError` 래핑).
- **Spotify client-credentials 토큰**: `search/app_token.py:get_app_token(http, "spotify")` — 유저 인증 불필요, 공개 카탈로그 조회용(import_url이 재사용). `/v1/search?type=artist`·`/v1/artists/{id}`는 앱 토큰으로 동작.
- **모달 패턴**: `AlbumDetailModal`·`PlaylistDetailModal`·`ItemTracksModal`. 트랙 리스트는 `track/ModalTrackList.tsx`의 `ModalTrackList({tracks: ModalTrack[]})` + `PlayAllButton({tracks})` + `isPlayable(t)` 재사용(재생/표시 일괄).
- **아티스트 곡 커버/플랫폼**: `api/main.py:_fetch_track_metadata`가 `LEFT JOIN LATERAL (SELECT cover_url FROM "EMPSource" ... LIMIT 1)` + tidal/spotify/youtube TrackPlatform LEFT join 패턴으로 커버·재생 ID를 끌어옴 — 아티스트 곡 조회가 그대로 본뜬다.
- **아티스트명 렌더처**: `MrtDashboard.tsx`(TrackRow), `track/ModalTrackList.tsx`(검색·모달 공용), `PgtLibrary.tsx`, `RecommendedAlbumCard.tsx`, `PersonaCard.tsx`, EMP `TrackCard`/`SectionRow` 등.

## 백엔드

### 캐시 테이블 `ArtistProfile` (신규 마이그레이션)

```sql
CREATE TABLE IF NOT EXISTS "ArtistProfile" (
    "nameNormalized" TEXT PRIMARY KEY,
    name             TEXT NOT NULL,
    bio              TEXT,            -- Gemini 생성, 실패 시 NULL
    "imageUrl"       TEXT,            -- Spotify, 실패 시 NULL
    genres           TEXT[],          -- Spotify
    "fetchedAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### `GET /api/artist/intro?name={name}` (신규 라우터 `api/artist.py`)

반환:
```json
{ "name": "...", "image": "https://...|null", "genres": ["..."],
  "bio": "...|null", "tracks": [ RecommendedTrack-shape ] }
```

흐름(**인증 선택** — 프로필·곡은 공개 카탈로그라 무인증 허용; 세션 있을 때만 곡에 liked/pct 부여 → 공유 페이지 `/p/{token}`에서도 동작):
1. `norm = name.lower().strip()`. 빈 이름 → 400.
2. **프로필**: `ArtistProfile`에서 `norm` 조회. 있으면 `{name, image, genres, bio}` 사용. 없으면 — **우리 풀(`Artist.nameNormalized`)에 실제 존재하는 아티스트일 때만** 아래 외부 조회를 수행한다(`artist_in_pool` 게이트). 풀에 없으면 외부 호출·캐시쓰기 없이 빈 프로필(`bio/image=None, genres=[]`) — 어차피 곡 0개라 무의미하고, 무인증 임의 `name`으로 유료 Gemini/Spotify를 무제한 소진하거나 전역 캐시를 오염시키는 비용 DoS·enumeration을 원천 차단한다.
   - **Spotify**(best-effort): `get_app_token` → `GET /v1/search?type=artist&q={name}&limit=1` → 첫 매칭의 `images[0].url`·`genres`. 실패/무매칭 → image=None, genres=[].
   - **Gemini bio**(best-effort): 프롬프트(아티스트명 + Spotify 장르) → 2-3문장 한국어 소개. `thinking_budget=0`, 실패 → bio=None. **blocking 호출이라 `await asyncio.to_thread(...)`로 오프로드**해 async 이벤트루프 블로킹을 막는다.
   - `ArtistProfile` upsert(자체 commit) — **bio 또는 image 중 하나라도 있으면 저장**(캐시 HIT). **둘 다 None이면 저장 생략**해 다음 호출에 재시도 허용(곡은 그래도 반환). 풀 게이트 덕에 임의 `name`이 캐시에 쌓이지 않는다.
3. **곡**: `Track JOIN Artist a ON a.id=t."artistId" WHERE a."nameNormalized"=%s`로 그 아티스트 곡 조회 + tidal/spotify/youtube LEFT join + EMPSource cover LATERAL(`_fetch_track_metadata` 패턴) → `RecommendedTrack` shape(youtube 합성 `yt_` 제외). 보유/차단 제외는 하지 않음(소개 맥락 — 그냥 그 아티스트 곡 노출). liked/pct 상태 부여. `LIMIT 30`, 같은 곡 `_song_key` dedup.

### bio 생성 헬퍼 `recsys`/`llm` 또는 `api/artist.py` 내부

`gemini_artist_bio(name, genres) -> str | None` — discover의 `_client()`/config 재사용. 시스템 프롬프트: "한국어로 이 음악 아티스트를 2-3문장으로 소개. 과장·허구 금지, 모르면 장르 기반으로 간결히." 실패/빈 응답 → None(호출부 삼킴).

## 프론트

- **`web/src/components/artist/ArtistLink.tsx`**(신규): `({ name, className? })` — 아티스트명을 `<button>`(밑줄/hover)으로 감싸 클릭 시 전역 모달 오픈. 전역 상태는 가벼운 zustand store(`useArtistModal`) 또는 Context로 `{ openArtist(name) }` 제공(어느 페이지서나 단일 모달 인스턴스).
- **`web/src/components/artist/ArtistIntroModal.tsx`**(신규): 열린 아티스트명으로 `/api/artist/intro` fetch → 이미지+이름+장르 칩 + 소개 텍스트 + `ModalTrackList`(곡, `PlayAllButton`). 로딩/빈(소개·이미지 없으면 곡만, 곡도 없으면 "정보 없음") 상태. AlbumDetailModal 톤 재사용.
- **전역 모달 마운트**: `app/(dashboard)/layout.tsx`(+ 공유 페이지 `p/layout.tsx`)에 `<ArtistIntroModal />` 1개 + provider. 어느 페이지서나 `ArtistLink`가 동일 모달을 연다.
- **아티스트명 교체**: 렌더처의 `{artist}`/`track.artist`를 `<ArtistLink name={artist} />`로. 대상: ModalTrackList(검색·모달·공유 공용 → 모바일+데스크탑 둘 다, 큰 커버리지), MrtDashboard(TrackRow + 추천 앨범카드), PgtLibrary(TrackList + 앨범 그리드카드 + 선택앨범 마스트헤드), EMP TrackSectionRow·TrackListSection. **클릭 가능한 행/카드(`<button>`) 안에서는 `<ArtistLink as="span">`**(role=button+키보드)로 렌더해 중첩 `<button>` 무효 HTML을 피한다. ArtistLink onClick은 `e.stopPropagation()`으로 행 재생/오픈 트리거를 막는다.
- **알려진 한계**: EMP 비재생(unplayable) 트랙은 카드 전체가 `disabled <button>`이라, 그 안의 ArtistLink(span) 클릭이 브라우저에서 억제될 수 있음(구조적, 저빈도 — 대부분 트랙은 재생 가능). 추후 카드 구조 분리 시 해소.
- **API 클라**: `lib/api/artist.ts` `fetchArtistIntro(name) -> ArtistIntro`.

## 에러 / 엣지

- Spotify 무매칭/실패 → image=null, genres=[] (소개·곡으로 성립).
- Gemini 실패/키 없음 → bio=null (이미지·장르·곡으로 성립).
- 둘 다 없고 곡도 0(정상 200 응답) → 모달에 "이 아티스트 정보가 아직 없어요".
- **fetch 자체 실패(백엔드 5xx·네트워크 오류)** → 모달이 빈 본문으로 멈추지 않도록 error 상태를 별도 추적해 "아티스트 정보를 불러오지 못했어요" 안내(헤더만 남는 죽은 상태 방지). `name` 변경 시 error 리셋.
- 동명이인: 이름 기준이라 Spotify 첫 매칭이 다른 동명 아티스트일 수 있음(MVP 허용 — 우리 곡은 우리 카탈로그 기준이라 정확).
- 캐시: 프로필 영구(soft); 갱신 필요 시 후속(관리 액션).
- ArtistLink는 공용 모달 1개를 공유(중복 마운트 금지).

## 테스트 전략

- 백엔드: `tests/api/test_artist.py` — (1) 프로필 캐시 HIT 시 외부 호출 없이 반환(ArtistProfile 시드), (2) MISS 시 Spotify(respx mock)+Gemini(fake client 주입) 호출 후 캐시 저장, (3) 곡 조회가 그 아티스트의 트랙을 RecommendedTrack shape로 반환(시드 트랙), (4) Spotify/Gemini 실패해도 부분 결과. ⚠️ 라이브 Gemini/Spotify 차단(주입/respx). DB 격리 — 대상 파일만.
- 프론트: tsc/lint/build + 수동(아티스트명 클릭 → 모달 → 이미지/소개/곡/재생).

## 비채택 / 범위 밖 (YAGNI)

- 위키피디아 소스 — 하이브리드(Gemini+Spotify) 채택.
- 아티스트 전용 페이지(라우트) — 팝업이면 충분.
- 팔로우/구독·아티스트 알림 — 범위 밖.
- 동명이인 정밀 disambiguation(아티스트 ID 확정 매칭) — 후속.
- 프로필 캐시 TTL/자동 갱신 — 영구 캐시로 시작.

## 후속 작업

1. 마이그레이션 `ArtistProfile` + `db/artist_profile.py`(get/upsert).
2. `search/app_token` 재사용 Spotify 아티스트 조회 + `gemini_artist_bio` + 아티스트 곡 쿼리.
3. `api/artist.py` `GET /intro` + 라우터 등록.
4. 프론트 `ArtistLink`·`ArtistIntroModal`·provider + 레이아웃 마운트 + 렌더처 교체 + `lib/api/artist.ts`.
5. 테스트(백엔드 4종 + 프론트 tsc/build).

## Tidal 강화 (구현 반영 — 1차 배포 후 후속)

bio 품질을 위해 소스를 Tidal 중심으로 재구성(브랜치 feat/artist-tidal-bio):

- **Tidal 아티스트 조회** `src/mrms/search/tidal_artist.py:fetch_tidal_artist(http, name) -> (image_url, bio_full)`: app 토큰(`get_app_token(http,"tidal")`, 유저인증 불필요) → `v1/search?types=ARTISTS&limit=1&countryCode=KR` → **정규화 이름 일치 가드**(Spotify와 동일, 퍼지 top-hit으로 다른 아티스트 캐시 방지) → picture UUID(`-`→`/`)로 `resources.tidal.com/images/{path}/750x750.jpg`, `v1/artists/{id}/bio` text를 `_strip_tidal_markup`(알려진 `[wimpLink]`/`[album]`/`[track]`/`[video]` 태그만 제거, 문단 줄바꿈 보존)으로 정리해 `bio_full`. 전 단계 best-effort.
- **Gemini 요약** `recsys/artist_bio.py:gemini_artist_bio(name, genres, source_text=None)`: `source_text`(Tidal bio) 있으면 원문을 2-3문장으로 **요약**(원문 사실만, [:3000] 캡), 없으면 기존 생성. 엔드포인트에서 `await asyncio.to_thread(...)`로 호출(이벤트루프 블로킹 방지).
- **엔드포인트** `api/artist.py`: 캐시 MISS + 풀 존재 시 같은 httpx 컨텍스트에서 Tidal+Spotify 조회 → `image = tidal or spotify`, `bio = Gemini요약 or bio_full`. `ArtistProfile.bioFull` 컬럼 추가(마이그레이션 `20260616110000_artistprofile_biofull`). 응답 `{name, image, genres, bio, bioFull, tracks}`.
- **모달** `ArtistIntroModal`: 요약(`bio`) 표시 + `bioFull && bioFull!==bio`일 때 "더보기/접기" 토글로 전체 전기 펼침. `name` 변경 시 `expanded` 리셋.
- **장르 부재**(2026-06 확인): Spotify Web API가 artist `genres`를 `null`로 deprecate, `Artist.mainGenre`는 0% 채움 → 신뢰 가능한 장르 소스 없음. 모달은 빈 장르를 graceful 숨김. 장르 칩이 필요하면 후속으로 Gemini가 Tidal bio에서 태그 추출(미채택).

## 관련 문서

- 코드: `src/mrms/search/app_token.py`(Spotify/Tidal 앱 토큰), `src/mrms/search/tidal_artist.py`(Tidal 아티스트 bio/이미지), `src/mrms/recsys/artist_bio.py`(Gemini 요약), `src/mrms/api/artist.py`(엔드포인트), `web/src/components/track/ModalTrackList.tsx`(트랙 리스트/재생), `web/src/components/artist/ArtistIntroModal.tsx`(모달).
