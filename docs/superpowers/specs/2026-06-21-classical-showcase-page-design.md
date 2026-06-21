# 클래식 공연실황 공개 쇼케이스 페이지 설계

> 비회원 누구나 `/classical`을 열어 세계 오케스트라 풀콘서트(클래식 공연 실황)를
> 시네마틱한 다크 화면에서 둘러보고, 카드 클릭 시 풀스크린 YouTube로 재생하는
> 독립 공개 페이지. 사이트 디자인시스템과 무관한 자체 무드.

**작성일:** 2026-06-21
**상태:** 설계 승인됨 → 구현 계획 대기

---

## 1. 배경

클래식 공연실황 데이터는 **이미 존재**한다:
- [`youtube_videos.py`](../../../src/mrms/emp/youtube_videos.py) `import_classical_videos`가
  공식 오케스트라/레이블 채널(Berliner Philharmoniker, London Symphony, Chicago
  Symphony, Wiener Symphoniker, hr-Sinfonieorchester, KBS교향악단, DW Classical 등)의
  풀콘서트(long·임베드 허용) 영상을 모아 EMPSection **`video:classical-live`**(item_type
  `youtube_video`)로 저장.
- [`/api/videos/sections`](../../../src/mrms/api/videos.py)는 **인증 불필요**
  (`Depends(db_conn)`만, `get_current_user_id` 없음) → **비회원이 그대로 호출 가능.**
- 앱 `/videos` 페이지가 이 섹션을 이미 노출하지만 로그인/앱 셸 안에서다.

요청: 같은 콘텐츠를 **비회원이 그냥 열어서 보는 독립 공개 페이지로 "멋지게"**.

## 2. 목표 / 비목표

**목표**
- `/classical` 공개 라우트 — 로그인·앱 셸·연결 없이 누구나 열람.
- 시네마틱 다크 무드(풀블리드 히어로 + 골드 악센트 + 큰 세리프) 쇼케이스.
- 카드 클릭 → 풀스크린 YouTube IFrame 재생.
- 링크 공유 시 멋진 OG 카드.

**비목표 (YAGNI / 사용자 명시)**
- **백엔드 변경 0** — 기존 공개 `/api/videos/sections` 재사용.
- **사이트 디자인시스템 일관성 불필요** — 독립 페이지라 자체 다크 스타일(Soulful
  Solace 토큰·워드마크·앱 셸 미사용). Fraunces 폰트는 이미 로드돼 있어 재사용 가능.
- 앱 `video-player` 스토어/플레이어 재사용 안 함 — 자족적 IFrame 모달.
- 큐레이션 편집·유저별 share 토큰 없음(고정 공개 URL `/classical`).
- 재생 분석/로그인 유도 없음.

## 3. 아키텍처

`/p/[shareId]` 공개 서버페이지 패턴을 미러한다(서버 fetch + `generateMetadata` +
`opengraph-image.tsx` 자동주입 + 클라이언트 컴포넌트로 전달).

라우트 위치: `web/src/app/classical/` — `(app)`/`(browse)` 그룹 **밖**이라 인증
가드·앱 셸이 적용되지 않는다(`/p`와 동일하게 공개).

```
GET /classical
  → app/classical/page.tsx (server)
      → fetchClassicalSection()  (server fetch → /api/videos/sections, 공개)
      → video:classical-live 섹션의 items 추출
      → <ClassicalShowcase items={...} />  (client)
클릭(card) → <ClassicalVideoModal videoId={item_id} />  (YT IFrame 풀스크린)
```

## 4. 컴포넌트 / 파일

| 파일 | 종류 | 책임 |
|---|---|---|
| `web/src/app/classical/page.tsx` | server | 섹션 fetch + `generateMetadata`(OG) + Showcase 렌더 |
| `web/src/app/classical/opengraph-image.tsx` | server | 공유용 OG 이미지(다크/세리프, 정적 생성) |
| `web/src/lib/server/classical-fetch.ts` | server util | `/api/videos/sections` 서버 fetch → classical-live items (mirror `lib/server/shared-fetch.ts`) |
| `web/src/components/classical/ClassicalShowcase.tsx` | client | 히어로 + 콘서트 카드 그리드 + 클릭 핸들링 + 모달 상태 |
| `web/src/components/classical/ClassicalVideoModal.tsx` | client | 풀스크린 YT IFrame(자족적, 앱 플레이어 비종속) |

## 5. 데이터

`/api/videos/sections` 응답 `{ sections: EmpSection[] }`에서 `sectionKey ===
'video:classical-live'`인 섹션을 고른다. 각 item:
- `item_type`: `'youtube_video'`
- `item_id`: YouTube **videoId** → IFrame `https://www.youtube-nocookie.com/embed/{item_id}`
- `title`: 영상 제목(카드 라벨)
- `cover_url`: 썸네일(카드 배경)

섹션이 없거나 비면 우아한 빈 상태("아직 준비 중") 표시.

## 6. 비주얼 (시네마틱 다크)

자체 스타일(인라인/모듈 CSS, 디자인시스템 토큰 미사용):
- **배경**: 딥 블랙/차콜. **악센트**: 골드(#C9A227 계열).
- **히어로**: 풀블리드 — **섹션 첫 영상의 `cover_url` 썸네일을 어둡게 깐 백드롭**
  (데이터 구동, 새 에셋 의존 X. 나중에 커스텀 이미지로 교체 쉬움) + 하단 그라데이션
  오버레이, 그 위 큰 Fraunces 세리프 타이틀 "클래식 공연 실황" + 부제 "세계 오케스트라
  풀콘서트". 첫 영상 클릭 시에도 그 영상이 재생되도록 히어로도 클릭 가능(선택).
- **그리드**: 콘서트 카드(16:9 썸네일 + 제목 + ▶ 호버 오버레이). 반응형
  (모바일 1열 → 데스크탑 3열). 호버 시 골드 테두리/스케일 미세.
- **타이포**: Fraunces(세리프) 타이틀, 본문은 시스템/기존 산세리프.
- 모션은 절제(페이드/호버), 과하지 않게.

## 7. 재생 (자족적 IFrame 모달)

`ClassicalVideoModal` — 앱 `VideoPlayerOverlay`/`video-player` 스토어와 **무관**한
독립 컴포넌트:
- 카드 클릭 → videoId로 모달 오픈.
- `youtube-nocookie.com/embed/{videoId}?autoplay=1&rel=0` IFrame, 16:9 풀스크린 가깝게,
  어두운 백드롭, X/Esc로 닫기, 백드롭 클릭 닫기.
- 닫으면 IFrame 언마운트(재생 정지).

## 8. 에러 / 엣지

- 섹션 fetch 실패/없음 → 빈 상태(페이지는 깨지지 않음).
- videoId 없는 item은 카드에서 제외.
- 임베드 불가 영상(드묾, 임포터가 임베드 허용만 수집) → IFrame 자체 에러 표시에 맡김.
- 모바일: 카드 1열 + 모달 풀폭.

## 9. 테스트 / 검증

- **백엔드 없음.**
- 프론트: `npx tsc --noEmit` + `pnpm build`(가능 시).
- 단위(vitest, 기존 `lib/*.test.ts` 패턴): `classical-fetch`의 섹션 필터
  (`video:classical-live` 골라내고 videoId 없는 item 제외)를 순수 함수로 분리해 테스트.
- 수동: `/classical` 비로그인 열람 → 그리드 → 카드 클릭 → IFrame 재생 → 닫기.

## 10. 성공 기준

- 비회원이 `/classical`을 열면 시네마틱 다크 쇼케이스 + 풀콘서트 카드, 클릭 시 풀스크린
  재생. 백엔드 변경 없이 기존 데이터로 동작. 링크 공유 시 OG 카드.
