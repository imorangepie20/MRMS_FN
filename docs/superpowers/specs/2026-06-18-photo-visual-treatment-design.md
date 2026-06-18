# MRMS 비주얼 강화: 카페·책 사진 트리트먼트 (v1)

> 작성일 2026-06-18. MRMS_FN. 메인을 확장하고 페이지 헤더·전체 배경에 "따뜻한 카페·책" 무드 사진을 **에디토리얼 톤을 유지한 채 은은하게** 입혀 비주얼을 끌어올린다.

## 목표

큐레이션된 따뜻한 카페·책 사진 4장을 정적 에셋으로 호스팅하고, 재사용 `PhotoBackdrop` 컴포넌트로 3단계 강도(히어로 볼드 / 페이지 헤더 밴드 은은 / 전체 배경 텍스처 아주 옅게)를 사이트에 적용한다. 사진은 "분위기"로만 깔리고 텍스트 가독성은 그라데이션·블러·저투명으로 지킨다. 톤은 기존 에디토리얼(크림 `#f5f0e8` / 잉크 `#1a1815` / 러스트 `#c44518`) 유지.

## 확정된 결정 (브레인스토밍 + 목업)

1. **트리트먼트**: 라이트-볼드. 사진 `filter: saturate(1.8) contrast(1.14) brightness(1.03)` + amber 따뜻 그레이드(`rgba(214,138,66,.16)` soft-light) + 그라데이션. (목업 `/tmp/mrms_hero1.html` "색감↑↑" 결로 확정.)
2. **범위**: 메인 히어로(볼드) + 각 페이지 헤더 밴드(은은) + 전체 페이지 배경 텍스처(아주 옅게). 셋 다 적용.
3. **소싱**: 큐레이션 Unsplash 정적 세트(런타임 키 불필요 — `web/public`에 최적화 호스팅).
4. **사진 세트 (4장, 따뜻 우드 톤)**:
   - `GX4YM64o49U` — Timothy Barlin (카푸치노 2잔 + 책) — **히어로 1순위**
   - `tVugl_rtvHA` — Fernando Hernandez (커피 + 안경 + 책)
   - `PuZgWp_a0Cs` — Priscilla Du Preez (손으로 머그 + 책, reading 무드)
   - `35AdKAwMpg0` — Timothy Barlin (블루컵 라떼하트 + 책)
5. **가독성 우선**: 사진보다 텍스트 우선 — 헤더/전체배경은 충분히 낮춰 콘텐츠 또렷.

## 비목표 (v1)

- 시네마틱-다크 히어로(검토했으나 라이트-볼드 채택).
- 페이지별 다른 사진 무작위 대량 사용(코히전 깨짐) — 4장 고정 세트만.
- AI 생성·동적 스톡 — 정적 큐레이션만.
- 사진 업로드/관리 어드민 — v1 정적.

---

## 아키텍처

### 에셋 — `web/public/visuals/`

4장을 Unsplash에서 다운로드(아래 컴플라이언스) 후 용도별 최적화 사본 생성:
- `hero-{1..4}.jpg` — 가로 ~1600px, q≈80 (히어로용 선명).
- `band-{1..4}.jpg` — ~1000px, q≈75 (헤더 밴드용).
- `texture.jpg` — ~400px 소형 + 사전 블러(전체배경용, CSS 블러 부담↓·성능).
- 매핑: 히어로 = `GX4YM64o49U`(1순위)/`tVugl_rtvHA` 순환 또는 고정, 밴드·텍스처 = 차분한 `PuZgWp_a0Cs`/`35AdKAwMpg0`.

**Unsplash 컴플라이언스**(가이드라인): 다운로드 시 `GET /photos/{id}` → `links.download_location` 트리거, 그리고 **사진가 크레딧 표기**(이름 + Unsplash 링크). 크레딧은 `/about`(또는 푸터)에 "Photos · Unsplash — Timothy Barlin, Fernando Hernandez, Priscilla Du Preez" 소형 표기. 에셋 출처/크레딧은 `web/public/visuals/CREDITS.md`에 기록.

### 컴포넌트 — `web/src/components/visual/PhotoBackdrop.tsx`

```
<PhotoBackdrop variant="hero" | "band" | "texture" src={...} />
```
- 공통: 절대배치 사진 레이어 + amber soft-light 오버레이 + 변형별 그라데/블러. `aria-hidden`, `pointer-events:none`.
- **hero**: `object-position:center 40%`, saturate1.8+amber, 하단 크림 그라데(`linear-gradient(to top, bg 2%, rgba(245,240,232,.85) 26%, .12 52%, transparent 75%)`). 콘텐츠는 children/형제로 위에.
- **band**: opacity ~.20, `blur(3px)`, 좌→우 크림 그라데. 헤더 높이(≈110–130px) 밴드.
- **texture**: opacity ~.07, `blur(7px)`, 전체 영역. 소형 `texture.jpg` 확대(저비용).
- 트리트먼트 수치는 컴포넌트 내 상수(또는 CSS 변수)로 캡슐화 — 한 곳에서 조정.

### 적용 surface

- **메인 히어로**: `web/src/components/landing/LandingHero.tsx`(+ `HomeMarketing`/`HomeLoggedIn`) — 사진 히어로 배경 추가로 "메인 키우기". **시그니처 스펙트럼(오디오 비주얼)은 유지** — 사진은 따뜻한 배경 레이어로, 스펙트럼/플레이 컨트롤은 그 위에(또는 인접 섹션). 정확한 합성은 구현 단계에서 스펙트럼 보존 원칙으로 조정.
- **페이지 헤더 밴드**: `SectionHeader`(PgtLibrary), `SectionHeading`(SearchResults), `TrackModalMasthead`, `MrtDashboard` 헤더 등 — 제목 뒤 `variant="band"` 백드롭.
- **전체 배경 텍스처**: `(dashboard)` 레이아웃(`DashboardShell`) 최하층에 `variant="texture"` — 전 페이지 옅은 따뜻함. 콘텐츠 카드는 불투명 페이퍼라 가독성 유지.

### 성능

- 용도별 사이즈 분리(위). 히어로만 큰 이미지, 밴드 중형, 텍스처는 소형+사전블러.
- `next/image`(우선) 또는 최적화된 `background-image`. 히어로 `priority`, 밴드/텍스처 lazy.
- 전체배경 텍스처는 **소형 이미지 CSS 확대**라 GPU 블러 부담 적음. 레이아웃 시프트 방지(고정 비율/absolute).
- 전 페이지 적용이므로 총 에셋 용량 점검(목표 히어로 ≤300KB/장, 밴드 ≤150KB, 텍스처 ≤40KB).

### 가독성

- 모든 변형은 그라데/오버레이/저투명으로 텍스트 대비 확보(에디토리얼 잉크/크림). 히어로 제목 영역은 크림 그라데로 항상 또렷.

## 데이터 흐름 / 상태

정적 — 런타임 데이터 없음. 사진은 빌드 타임 정적 에셋. (히어로 순환을 쓰면 클라이언트에서 인덱스만 선택.)

## 에러 처리

- 이미지 로드 실패 시 백드롭은 단순 배경색(크림)으로 폴백 — 깨진 이미지 노출 금지(`onError`/CSS fallback). 콘텐츠/가독성에 영향 없음.

## 테스트

프론트 검증 = `npx tsc --noEmit` + `pnpm build`. 컴포넌트 단위 테스트 인프라(vitest)로 `PhotoBackdrop` variant→클래스/스타일 매핑 단위 테스트(선택). 기존 랜딩/헤더 스냅샷·빌드 무회귀. 시각 확인은 로컬 dev + 스크린샷.

## 파일 구조

생성:
- `web/src/components/visual/PhotoBackdrop.tsx` — 백드롭 컴포넌트.
- `web/public/visuals/hero-*.jpg`, `band-*.jpg`, `texture.jpg` — 최적화 에셋.
- `web/public/visuals/CREDITS.md` — Unsplash 크레딧/ID.
- (선택) `scripts/fetch-visuals.*` — 다운로드+최적화+download_location 트리거 스크립트(재현용).

수정:
- `web/src/components/landing/LandingHero.tsx`(+HomeMarketing/HomeLoggedIn) — 히어로 백드롭.
- `web/src/components/mrms/PgtLibrary.tsx`(SectionHeader), `web/src/components/search/SearchResults.tsx`(SectionHeading), `web/src/components/track/TrackModalMasthead.tsx`, `web/src/components/mrms/MrtDashboard.tsx` — 헤더 밴드.
- `web/src/components/layout/DashboardShell.tsx` — 전체 배경 텍스처.
- 크레딧 표기: `web/src/app/(dashboard)/about/...` 또는 푸터.

## 리스크 / 주의

- **전체배경 산만/성능**: 가장 위험 — opacity ≤8% + 소형 블러로 "거의 안 보이는 따뜻함" 유지. 과하면 낮추거나 토글.
- **톤 점프**: 라이트-볼드 채택으로 크림 톤과 이어짐(다크 미채택). 헤더/배경은 은은하게.
- **Unsplash ToS**: 라이선스상 다운로드·호스팅 허용. 가이드라인 준수 — download_location 트리거 + 크레딧 표기 필수.
- **에셋 무게**: 전 페이지 적용이라 용량 예산 준수(위). 빌드 산출물 크기 점검.
