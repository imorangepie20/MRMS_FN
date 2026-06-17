# 메인 랜딩 페이지 (앱 루트) 상세 설계

작성일: `2026-06-17`
상태: 설계 승인 — 구현 예정.

## 목표

지금 `src/app/page.tsx`가 `/mrt`로 redirect만 하는 앱 루트를, **실제 랜딩(메인) 페이지**로 교체한다. 일반 사용자 대상, **인증 상태 분기**:

- **비로그인** → 마케팅 랜딩(서비스 가치 + 로그인 유도)
- **로그인** → 개인화 홈(추천 진입·하이라이트)

두 상태가 **같은 시그니처 비주얼 — 스펙트럼 히어로**를 공유한다. 비주얼 임팩트가 핵심.

## 핵심 결정 (brainstorming 확정)

1. **루트 = 상태 분기**(`getServerSideUser`로 세션 확인): 비로그인=마케팅, 로그인=개인화 홈. redirect 제거.
2. **시그니처 히어로 = 스펙트럼 애니메이션 + preview 오디오**(양 상태 공통). 현재 preview 곡 커버아트(블러/그라데이션) 배경 + 스펙트럼 바 + 곡 메타. **"▶ 플레이 허용" 클릭 시** 사운드 재생(브라우저 autoplay 정책 우회) → 그 오디오로 스펙트럼이 살아 움직임.
3. **히어로 오디오 = 최신곡 preview 5곡 랜덤**, on-demand resolve(iTunes/Deezer 공개 API) + 캐시.
4. **로그인 홈 = 히어로 + 퀵스탯 카드 + 큐레이션 피드**(레이아웃 C+B 하이브리드).
5. **비로그인 랜딩 = 히어로 + 가치/CTA + 기능 3행**(레이아웃 B 풀블리드).
6. **기존 자산 재사용**: `@/lib/spectrum`(스펙트럼 수학), AlbumArt, ModalTrackList, 템플릿 카드/carousel, 추천·신곡 데이터. 밑바닥부터 만들지 않음.
7. **디자인 언어**: MRMS 에디토리얼(크림 #f5f0e8 · 잉크 #1a1815 · 러스트 #c44518 · IBM Plex Sans/Mono · 헤어라인 · 모노 대문자 라벨 · 큰 라이트 디스플레이 헤딩, 이탤릭 러스트 강조).

## 현재 구조 (배경 — 그라운딩 확인)

- **루트**: `web/src/app/page.tsx` = `redirect("/mrt")` (랜딩 없음). `/mrt`는 `getServerSideUser` + `getServerSideMrt` 서버 페치 → `MrtDashboard`.
- **스펙트럼**: `web/src/components/player/SpectrumEqualizer.tsx`가 ADR-004 구현이나 **Tidal 전용**(`getTidalAnalyser()` + `activePlatform==="tidal"` 게이트). 스펙트럼 **수학은 `@/lib/spectrum`**(`BAR_COUNT`, `binsToBarHeights(bins, prev)`)에 분리돼 재사용 가능. requestAnimationFrame + bar height % 렌더 패턴.
- **preview 오디오**: `prisma/schema.prisma:84`에 `previewUrl String? // 30s mp3 URL` **선언돼 있으나 실제 DB엔 컬럼 없음**(마이그레이션 미적용). preview 인제스트 로직은 `src/mrms/ingest/itunes.py`(ISRC→90s m4a previewUrl)·`src/mrms/ingest/deezer.py`(ISRC→30s preview, 무인증 공개 API) 존재.
- **신곡 데이터**: `src/mrms/recsys/newrelease.py`(`source_type='new_release'` EMPSource, per-user 생성). 로그인 홈 피드용.
- **인증**: `getServerSideUser`(서버), `useUser`(클라). 로그인 세션 쿠키 `mrms_session`.
- **재사용 컴포넌트**: `track/ModalTrackList.tsx`(트랙 리스트/재생), `album/AlbumArt`(커버, 폴백 모자이크), 템플릿 `components/pages/*`(카드·carousel·badge 등), `dashboards/*` 구성.

## 백엔드

### 마이그레이션 — `Track.previewUrl` 컬럼 추가

`schema.prisma` 선언과 DB를 일치시킴(write-through 캐시 컬럼):
```sql
ALTER TABLE "Track" ADD COLUMN IF NOT EXISTS "previewUrl" TEXT;
```

### `GET /api/landing/preview-tracks` (신규, 무인증 공개)

랜딩 히어로용 — 최근 트랙 풀에서 랜덤 N(기본 5)곡을 preview URL과 함께 반환. **무인증**(비로그인 랜딩서도 동작).

흐름:
1. **풀 선택**: 전역 최근 트랙 풀 — `new_release` EMPSource 트랙(또는 최근 추가 Track) 중 **ISRC 있는 것**(preview resolve 가능) 후보를 모아 랜덤 N×버퍼(예: 15) 추림.
2. **preview resolve(write-through)**: 각 후보의 `Track.previewUrl`이 있으면 사용. 없으면 ISRC로 **Deezer(우선)→iTunes** 공개 API 조회해 30s preview URL 획득 → `Track.previewUrl`에 저장(다음부터 캐시 HIT). best-effort.
3. preview URL 확보된 곡만 모아 N곡 반환. shape: `{tracks: [{track_id, title, artist, album_cover, preview_url}]}`. (커버는 `get_playlist_tracks` 패턴의 EMPSource.cover_url LATERAL 또는 AlbumArt 폴백.)
4. resolve 실패가 많아 N 미달이면 가능한 만큼 반환(0이면 빈 배열 → 프론트 데코 폴백).

> resolve는 외부(공개·무인증) 호출이므로 테스트는 respx로 Deezer/iTunes mock. 라이브 차단.

### preview resolve 헬퍼 (`recsys` 또는 `ingest` 재사용)

`resolve_preview_url(http, isrc, title, artist) -> str | None` — `ingest/deezer.py`/`itunes.py`의 기존 ISRC 조회 재사용(Deezer 우선, 실패 시 iTunes, 둘 다 실패 None).

## 프론트

### 루트 분기 — `web/src/app/page.tsx`

redirect 제거. 서버에서 `getServerSideUser`로 세션 확인 → 로그인이면 `<HomeLoggedIn user=.../>`, 아니면 `<HomeMarketing/>`. 두 컴포넌트 모두 상단에 `<LandingHero/>`.

### `LandingHero` + `PreviewSpectrum` (시그니처)

- **`LandingHero`**(client): 마운트 시 `GET /api/landing/preview-tracks`로 5곡 로드. 현재 곡의 커버(AlbumArt, 블러/그라데이션 배경) + 메타 + 스펙트럼 바 오버레이. 초기 상태 = **"▶ 플레이 허용"** 버튼(정적/데코 바). 클릭 → preview `<audio>` 재생 시작 + `PreviewSpectrum` 활성. 곡 끝나면 다음 곡 자동(5곡 순환), 수동 next/이전. preview 없으면 데코(무음) 애니메이션만.
- **`PreviewSpectrum`**(client): preview `<audio ref>`에 새 `AudioContext`+`createMediaElementSource`+`AnalyserNode` 연결, `analyser.getByteFrequencyData` → `@/lib/spectrum`의 `binsToBarHeights`로 bar 높이 → `BAR_COUNT`개 막대 렌더(SpectrumEqualizer의 rAF/height% 패턴 그대로, Tidal 의존만 제거). AudioContext는 사용자 제스처(allow-play 클릭) 후 생성/resume(autoplay 정책).
- **엣지**: autoplay 막힘 → 클릭 전 무음 데코, 클릭 후 사운드+실스펙트럼. resolve 실패 곡 스킵. 모바일도 동일 게이트(자동재생 불가).

### 로그인 개인화 홈 — `HomeLoggedIn`

`<LandingHero/>` + **퀵스탯 카드 행**(페르소나 수·좋아요 수·플리 수·"무드/상황" 진입 — 기존 데이터/엔드포인트, 템플릿 stat 카드) + **큐레이션 피드**(추천/신곡/아티스트/플리 혼합 섹션 — 기존 추천·신곡 API + AlbumArt/ModalTrackList/carousel 재사용, `/mrt`·검색 등으로 진입).

### 비로그인 마케팅 랜딩 — `HomeMarketing`

`<LandingHero/>`(같은 스펙트럼/preview) + 가치 헤드라인(이탤릭 러스트) + **"로그인하고 시작" CTA**(→ `/login`) + **기능 3행**(① 추천 ② 무드/상황 ③ 플레이리스트, 템플릿 feature 카드). 에디토리얼 톤.

## 에러 / 엣지

- preview-tracks 0곡(resolve 전부 실패/풀 빈약) → 히어로는 정적 커버 콜라주 + 데코(무음) 스펙트럼으로 폴백, "플레이 허용" 숨김.
- autoplay 정책: 사운드는 반드시 사용자 클릭 이후. 클릭 전엔 무음 데코.
- 모바일: 동일(클릭 게이트). 스펙트럼 rAF는 화면 밖/언마운트 시 정지.
- 로그인 홈 데이터 없음(신규 유저, MRT 미생성) → 피드 섹션은 빈 상태 카드 + "추천 생성" 안내(기존 `/mrt` no-data 패턴 참조).
- AudioContext는 탭당 1개 재사용/정리(메모리 누수 방지).

## 테스트 전략

- 백엔드: `tests/api/test_landing.py` — preview-tracks (1) 캐시 HIT(previewUrl 있는 시드 → 외부호출 0), (2) MISS resolve(respx로 Deezer/iTunes mock → previewUrl write-back), (3) resolve 실패 곡 제외, (4) 무인증 200. ⚠️ DB 격리 — 대상 파일만, cleanup 정리, 라이브 Deezer/iTunes 차단(respx).
- 프론트: `npx tsc --noEmit` + `pnpm build` + 수동(allow-play 클릭→사운드+스펙트럼, 곡 순환, 비로그인/로그인 분기, 모바일 게이트). `@/lib/spectrum`은 기존 `spectrum.test.ts` 커버.

## 비채택 / 범위 밖 (YAGNI)

- 풀 SDK 전체 재생(로그인+프리미엄) — 히어로는 30s preview만. 본 재생은 기존 플레이어/페이지에서.
- preview 배치 사전 풀 생성 — on-demand write-through 캐시로 시작(충분).
- 개인화된 히어로 곡(취향 기반) — v1은 전역 최신곡 랜덤. 후속.
- 스펙트럼 비주얼 프리셋/커스터마이즈 — 기본 1종.
- 마케팅 랜딩의 가격/상세 섹션 — 히어로+기능 3행+CTA로 최소.

## 후속 작업 (구현 순서 가이드)

1. 마이그레이션 `Track.previewUrl` + `resolve_preview_url` 헬퍼(Deezer/iTunes 재사용) + 테스트.
2. `GET /api/landing/preview-tracks`(풀 선택 + write-through resolve) + 테스트.
3. `PreviewSpectrum`(generic `<audio>` analyser, `@/lib/spectrum` 재사용) + `LandingHero`(allow-play 게이트, 5곡 순환).
4. 루트 `page.tsx` 분기 + `HomeLoggedIn`(퀵스탯 + 큐레이션 피드) + `HomeMarketing`(CTA + 기능 3행).
5. tsc/build + 수동 검증.

## 관련 문서

- 코드: `web/src/components/player/SpectrumEqualizer.tsx`·`web/src/lib/spectrum.ts`(스펙트럼 재사용), `src/mrms/ingest/deezer.py`·`itunes.py`(preview resolve), `src/mrms/recsys/newrelease.py`(신곡 풀), `web/src/components/album/AlbumArt`·`track/ModalTrackList.tsx`(재사용), `web/src/app/page.tsx`(현재 redirect).
- [ADR-004](decisions/ADR-004-tidal-spectrum-equalizer.md)(스펙트럼 이퀄라이저).
