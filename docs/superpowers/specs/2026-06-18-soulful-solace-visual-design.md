# MRMS "Soulful Solace" 비주얼 아이덴티티 (v1)

> 작성일 2026-06-18. MRMS_FN. TEMPO Frame 5 레퍼런스 기반 — Fraunces 세리프 워드마크/타이틀 + 피치 크림 팔레트 + 분리된 사진 마스트헤드 + 2열 사진 모자이크로 따뜻·고급 매거진 톤을 완성한다. 이미 출시된 카페 PhotoBackdrop(히어로) 위에 얹고, 전체 배경 wash는 분리 마스트헤드로 대체한다.

## 목표

"카페에서 책 보는" 따뜻하고 고급스러운 무드를 시각 아이덴티티로 굳힌다: ① Fraunces 세리프(워드마크 "MRMS." + 라틴 디스플레이 타이틀) ② 피치 크림 팔레트 ③ 큰 섹션 제목마다 **분리된 사진 마스트헤드**(전체 wash 금지) ④ 페르소나/추천을 **2열 사진 모자이크 카드**로. 이미지는 나노바나나(Gemini) 커스텀 세트로 톤 통일.

## 확정된 결정 (브레인스토밍 + 목업)

1. **세리프**: **Fraunces**(따뜻·소프트 올드스타일). 워드마크 + 라틴 디스플레이 타이틀에만. 한글 타이틀·본문·mono는 IBM Plex Sans/Mono 유지(혼용 자연스러움).
2. **팔레트**: 크림→**피치 크림**. `--mrms-bg` `#f3e6d8`, `--mrms-paper` `#faf2e9`, `--mrms-rule` `#e0cdba`, `--mrms-ink` `#1f1a16`(약간 따뜻). 러스트 `#c44518` 포인트 유지.
3. **분리 마스트헤드**: 전체 배경 wash(기존 texture) **제거**. 큰 섹션 제목마다 독립 사진 블록(Fraunces 제목 + kicker + meta + 사진 + 피치 그라데로 가독성).
4. **2열 모자이크**: 페르소나·추천 플레이리스트를 사진 카드 그리드로(Fraunces 라벨 + 하단 다크 그라데).
5. **이미지**: 고정 세트 6~8장(나노바나나 커스텀, 톤 통일) → `web/public/visuals/`, 인덱스로 마스트헤드/모자이크에 배치. 미준비 시 기존 카페 Unsplash 에셋 폴백.
6. **기존 카페 히어로 유지**: `LandingHero`(카페 사진 + 스펙트럼)는 두고 타이틀만 Fraunces.

## 비목표 (v1)

- 모든 `font-display`를 세리프로(트랙명 등 작은 타이틀은 sans 유지) — 세리프는 워드마크 + 마스트헤드 타이틀만.
- 무드별 다중 테마(TEMPO 5프레임 전체) — Soulful Solace 단일 테마만.
- 다크/네온 등 타 무드 — 후속.
- 동적 per-페르소나 고유 이미지(음악 연동) — 고정 세트 인덱스 배치.

---

## 아키텍처

### 폰트 — Fraunces

`web/src/app/layout.tsx`에 `next/font/google`의 `Fraunces` 추가(variable `--font-serif`, weights 600/700, optical sizing). `globals.css`에 `--font-serif` 매핑. **전역 `--font-display`는 그대로(sans)** — 세리프는 아래 두 군데만.

### 팔레트 — `web/src/app/globals.css`

`:root`의 mrms 변수 값 교체:
- `--mrms-bg: #f3e6d8;` `--mrms-paper: #faf2e9;` `--mrms-rule: #e0cdba;` `--mrms-ink: #1f1a16;`
- `--mrms-ink-soft`/`--mrms-ink-mute`/`--mrms-rust`는 따뜻 톤 유지(미세조정 가능). 전 페이지에 피치 온기 자동 반영(토큰 기반).

### 신규 컴포넌트

- **`web/src/components/visual/Wordmark.tsx`**: "MRMS**.**" Fraunces 렌더(마침표 러스트). props `{ size?, className? }`. 워드마크 사용처를 이걸로 교체(AppSidebar 브랜드, LandingHero, HomeMarketing, app-header, ConnectToPlay 등 — DRY).
- **`web/src/components/visual/SectionMasthead.tsx`**: 분리 사진 제목 블록. props `{ kicker, title, meta?, imageIndex? }`. `relative h-[~170px] border` + 사진(saturate/amber/피치 그라데 좌→우) + Fraunces 제목 + kicker(러스트) + meta. 가독성 그라데로 텍스트 또렷. 기존 헤더 밴드(PhotoBackdrop band)를 이걸로 승격.
- **`web/src/components/visual/PhotoMosaic.tsx`**: 2열(모바일 1열) 사진 카드 그리드. props `{ items: {title, meta, href?}[] }`. 각 셀: 사진(인덱스) + 하단 다크 그라데 + Fraunces 라벨. 클릭 시 href 이동.
- 이미지 매핑 헬퍼 `web/src/lib/visuals.ts`: 고정 세트 경로 배열 + `pickVisual(index)`(모듈로 순환).

### 적용 surface

- **워드마크**: 전 사용처 `<Wordmark/>`로.
- **마스트헤드**(전체 wash 제거 + 밴드 승격): MRT(`For your ears` 등), PGT 탭(좋아요/취향저격/앨범/아티스트), 검색 결과, HomeLoggedIn 섹션. 기존 `PhotoBackdrop variant="band"` 적용분을 `SectionMasthead`로 교체.
- **모자이크**: MRT 추천 플레이리스트/페르소나 그리드, (선택) PGT 플레이리스트 목록 → `PhotoMosaic`.
- **전체 배경 텍스처 제거**: `DashboardShell`의 fixed texture 레이어 삭제, 루트 `bg`를 피치 크림으로 복귀(토큰).
- **히어로**: `LandingHero` 타이틀 Fraunces(나머지 유지).

### 이미지 에셋

`web/public/visuals/soulful-1.jpg … soulful-8.jpg`(나노바나나 커스텀, 가로 ~1400, q80). `visuals.ts`는 **빌드타임 고정 배열**(`SOULFUL = ["/visuals/soulful-1.jpg", …]`)을 export. 나노바나나 세트 미준비 시 그 배열을 기존 `["/visuals/hero-1.jpg","/visuals/band.jpg","/visuals/hero-2.jpg"]`로 임시 채워 빌드/배포 가능(블로킹 아님), 세트 들어오면 배열만 교체.

## 데이터 흐름

정적 비주얼 — 런타임 데이터 없음. 모자이크 아이템(페르소나/플레이리스트)은 기존 MRT/PGT 데이터, 이미지는 인덱스 매핑.

## 에러 처리

- 이미지 로드 실패 → 피치 크림 단색 폴백(`onError`), 텍스트 가독성 무영향.
- 세리프 폰트 미로드 → Georgia/serif 폴백(next/font가 처리).

## 성능·접근성

- Fraunces는 가변폰트 1개 추가(weight subset). 마스트헤드/모자이크 이미지는 사이즈 최적화(가로 ~1400/카드 ~700) + lazy(첫 화면 외). 마스트헤드 사진은 장식 → `aria-hidden`. 제목은 실제 텍스트(스크린리더 OK).
- 가독성: 피치 그라데/다크 그라데로 텍스트 대비 확보.

## 테스트

프론트 = `npx tsc --noEmit` + `pnpm build`. vitest로 `pickVisual` 순환·`Wordmark`/`SectionMasthead` variant 단위(선택). 기존 스냅샷·빌드 무회귀.

## 파일 구조

생성:
- `web/src/components/visual/Wordmark.tsx`, `SectionMasthead.tsx`, `PhotoMosaic.tsx`.
- `web/src/lib/visuals.ts` — 이미지 세트 + pickVisual.
- `web/public/visuals/soulful-*.jpg`(나노바나나 세트).
- 단위테스트(`visuals.test.ts`).

수정:
- `web/src/app/layout.tsx`(Fraunces), `web/src/app/globals.css`(피치 팔레트 + `--font-serif`).
- 워드마크 사용처(AppSidebar, app-header, LandingHero, HomeMarketing, ConnectToPlay) → `<Wordmark/>`.
- `MrtDashboard`/`PgtLibrary`/`SearchResults`/`HomeLoggedIn` 헤더 → `SectionMasthead`, 추천/페르소나 그리드 → `PhotoMosaic`.
- `DashboardShell` — 전체 texture 제거.
- `LandingHero` — 타이틀 Fraunces.

## 리스크 / 주의

- **전역 팔레트 변경**: 토큰(globals.css) 한 곳이라 안전하나 전 페이지 영향 — 빌드 후 시각 점검.
- **세리프 혼용**: Fraunces(라틴) + Pretendard(한글) 혼용 — 목업서 자연스러움 확인. 트랙명 등 작은 타이틀은 sans 유지(세리프 과용 방지).
- **기존 트리트먼트 대체**: 전체 texture 제거 + 밴드→마스트헤드 승격(방금 출시분 일부 대체). 회귀 점검.
- **이미지 의존**: 나노바나나 세트 미준비 시 카페 Unsplash 폴백으로 빌드/배포 가능(블로킹 아님).
