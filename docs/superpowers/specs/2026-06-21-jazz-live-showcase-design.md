# 재즈 공연 실황 — 비디오 섹션 + 공개 쇼케이스 설계

> 클래식 공연 실황(`/classical`, `video:classical-live`)의 구조를 그대로 복제해 재즈를
> 추가한다. 공식 재즈 페스티벌·라디오 빅밴드 채널의 풀콘서트를 `video:jazz-live`
> 섹션으로 모으고, `/jazz` 공개 쇼케이스(같은 Lumière 시네마틱 컴포넌트 재사용)로 노출.

**작성일:** 2026-06-21
**상태:** 설계 승인됨(직전 대화) → 구현

---

## 1. 게이트 결과 — 재즈 채널 실측 (YouTube Data API, 2026-06-21)

`videoDuration=long` + `videoEmbeddable=true`로 채널별 수율 검증. 채택 **8개(전부 권리자 공식 채널, 풀콘서트 수율 양호)**:

| 채널 | channelId |
|---|---|
| North Sea Jazz Archive | `UCHH_fkg_q8fu-AdEzIczzYQ` |
| Jazz In Marciac | `UCC87jVPU5DV_ccBcWs5smcQ` |
| WDR Big Band | `UCulDi5lPqT4Wa49gZhNgKdg` |
| hr-Bigband (Frankfurt Radio Big Band) | `UC4LDP8Ee097zy6WOMuxI6Ag` |
| SWR Big Band | `UCiqZVYisk1zpBC4bxQBofeQ` |
| Montreux Jazz Festival | `UClUghHElK6LMJrK1_xCWOPA` |
| Jazz à Vienne | `UC0CnISy9tA2T3DDH3mjQaug` |
| Jazzaldia (Donostia / San Sebastián) | `UC8-Hs7utuv_5qyTZW3JJnoA` |

제외: Jazz at Lincoln Center(검색이 Topic 채널 오매칭), Berklee(비-재즈 혼재), Blue Note(프로모 위주).

## 2. 목표 / 비목표

**목표**: `video:jazz-live` 섹션 임포터 + `/jazz` 공개 쇼케이스. 클래식과 동일 UX/무드.

**비목표**: 새 디자인(클래식 Lumière 컴포넌트 재사용) · DB 스키마 변경(EMPSection 재사용) · 재즈 전용 재생 인프라(기존 YT IFrame).

## 3. 백엔드 (`src/mrms/emp/youtube_videos.py`)

클래식 전용 함수를 채널-제네릭으로 리팩터(클래식 export·동작 불변 → 기존 테스트 통과):
- `JAZZ_CHANNELS`(위 8개), `JAZZ_LIVE_SECTION = "video:jazz-live"`, `JAZZ_LIVE_TITLE = "재즈 공연 실황"`.
- 내부 제네릭 `_fetch_channel_videos(http, api_key, channels, per_channel)` + `_import_video_section(conn, http, channels, section_key, title, display_order)`.
- `fetch_classical_videos`/`import_classical_videos`는 제네릭 호출 래퍼로 유지(시그니처 불변).
- 신규 `fetch_jazz_videos` / `import_jazz_videos(conn, http, display_order=1)`.
- **러너**(`emp/runner.py` `_run_importer_youtube`): 클래식 다음에 `import_jazz_videos` 호출(각자 try/except로 격리).

→ 다음 `run_emp_pipeline` 실행 때 prod `video:jazz-live` 채워짐. 즉시 채우려면 서버에서 파이프라인 트리거.

## 4. 프론트 (클래식 컴포넌트 재사용 — 회귀 0)

기존 라이브 `/classical`을 깨지 않도록 **추가 위주**:
- `lib/server/classical-fetch.ts`: 제네릭 `pickSectionVideos(sections, key)` + `fetchVideoSection(key)` 추가. 기존 `pickClassicalVideos`/`fetchClassicalVideos`는 제네릭 호출 래퍼로 유지.
- `components/classical/ClassicalShowcase.tsx`: `copy?: ShowcaseCopy` prop 추가(미지정 시 클래식 기본값 → 클래식 페이지 무변경). 하드코딩 한글 카피를 `copy.*`로.
- 신규 `app/jazz/page.tsx`(`fetchVideoSection("video:jazz-live")` + 재즈 카피) + `app/jazz/opengraph-image.tsx`(다크 OG, 영문 카피).

재즈 카피: kicker "Reel 01 · The Jazz Sessions" / 타이틀 "재즈 공연 실황" / slate "세계 재즈 페스티벌 · Live Sets" / sectionLabel "§ The Sessions" / footer "MRMS · Jazz Archive — 클럽과 페스티벌의 밤, 첫 곡부터 앙코르까지". 팔레트(앰버)는 그대로(재즈 클럽 무드에 적합).

## 5. 데이터 / 재생

클래식과 동일: `EmpSectionItem{item_type:'youtube_video', item_id:videoId, title, cover_url}` → 카드/IFrame. `/api/videos/sections`(공개)로 `video:jazz-live` 선택.

## 6. 테스트 / 검증

- 백엔드: 기존 `tests/emp/test_youtube_videos.py` 통과(클래식 불변) + 로컬에서 `import_jazz_videos` 실행해 `video:jazz-live` 채워지는지 실측.
- 프론트: `pickSectionVideos` vitest(섹션키별 필터) + `npx tsc --noEmit` + `next build`.

## 7. 성공 기준

비회원이 `/jazz`를 열면 클래식과 같은 Lumière 시네마틱으로 재즈 풀콘서트 쇼케이스 + 풀스크린 재생. 클래식 페이지 무회귀. 백엔드는 임포터 추가만(스키마 0).
