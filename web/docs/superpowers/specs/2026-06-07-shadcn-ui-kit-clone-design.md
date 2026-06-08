# shadcn UI Kit — 전체 복제 (Master Design / Spec)

- **작성일:** 2026-06-07
- **프로젝트:** `SDTPL_ADM`
- **레퍼런스:** https://shadcnuikit.com (기준 페이지: `/dashboard/default`)
- **상태:** 승인됨 — 구현 계획 작성 단계로 진행

---

## 1. 목표 (Goal)

shadcn UI Kit(https://shadcnuikit.com)의 **전체 페이지 세트를 충실하게(faithfully) 복제**한다.
레이아웃·컴포넌트·컬러·타이포·인터랙션을 레퍼런스와 최대한 동일하게 재현하는 것이 목표다.

**핵심 원칙 (WORKING RULE):** 레퍼런스 대비 **임의로 범위를 축소하거나 기능을 생략하지 않는다.**
전체 feature set을 매칭한다. 범위를 줄여야 할 합당한 이유가 생기면 먼저 사용자에게 묻는다.

### 비목표 (Non-Goals)
- 백엔드/DB/인증 서버 구현 (앱 페이지는 **프론트엔드 UI 클론** — mock 데이터 + 로컬 상태)
- 독자적 리디자인 (shadcn 룩을 그대로 재현; frontend-design 원칙은 **재현 완성도**에만 사용)
- 결제/이메일 발송 등 실외부 연동

---

## 2. 확정된 결정 (Decisions)

| 항목 | 결정 |
|------|------|
| 복제 범위 | **전체 UI 키트 전체 복제** |
| 디자인 충실도 | shadcnuikit 룩 **그대로 충실 복제** |
| 앱 구현 깊이 | **프론트엔드 UI 클론** (mock 데이터 + 로컬 인터랙션, 백엔드 없음) |
| 기술 스택 | **Next.js 16 (App Router) · React 19 · Tailwind v4 · shadcn/ui(Base UI) · pnpm** |

### 스택 주의사항 (Gotchas)
> 최신 shadcn CLI는 컴포넌트를 **Base UI (`@base-ui/react`)** 위에 설치한다 (Radix 아님).
> - Radix의 `render`/`asChild` 대신 Base UI의 **`render` prop 패턴** 사용
> - 앵커 폭은 `w-(--anchor-width)` 사용 (Radix의 `--radix-*` 변수 아님)
> - `Checkbox`는 별도 `indeterminate` prop 사용
> - 이 버전의 `next build`는 ESLint를 실행하지 않음 → `pnpm lint` 별도 실행
> - SSR "mounted" 가드가 `react-hooks/set-state-in-effect`를 trip → `eslint.config.mjs`에서 warning으로 다운그레이드

---

## 3. 분할 전략 (Decomposition)

전체 키트(~50 페이지)는 단일 spec으로 다루기엔 너무 크다.
**공유 기반(Foundation) 위에 단계별 sub-project**로 나누고, **각 Phase는 자체 spec → plan → 구현 사이클**을 가진다.

```
Phase 0  Foundation        ← 모든 후속 Phase가 의존하는 공유 기반
Phase 1  Dashboards (14)
Phase 2  Apps (12)
Phase 3  AI Apps (4)
Phase 4  Pages
Phase 5  Others / Showcase
```

빌드 순서 원칙:
1. **Phase 0가 모든 라우트를 placeholder stub으로 먼저 생성** → 빈 링크 없이 전 구간 네비게이션이 즉시 동작.
2. 각 Phase는 해당 stub들을 실제 페이지로 채운다.
3. 각 Phase 내부도 "대표 페이지 1개 → 검증 → 나머지 확장" 순서로 진행 (예: Dashboards는 Classic/Default 먼저).

---

## 4. 전체 페이지 인벤토리 (Full Page Inventory)

> 레퍼런스 사이드바 기준. **이 목록 전체가 복제 대상이다.** (생략 금지)

### Phase 1 — Dashboards (14)
1. Classic / Default (기준 페이지)
2. E-commerce
3. Payment
4. Hotel
5. Project Management
6. Real Estate
7. Sales
8. CRM
9. Website Analytics
10. File Manager (dashboard)
11. Crypto
12. Academy / School
13. Hospital Management
14. Finance

### Phase 2 — Apps (12)
1. Kanban
2. Notes
3. Chats
4. Social Media
5. Mail
6. Todo List
7. Tasks
8. Calendar
9. File Manager (app)
10. API Keys
11. POS
12. Courses

### Phase 3 — AI Apps (4)
1. AI Chat
2. AI Chat V2
3. Image Generator
4. Text to Speech

### Phase 4 — Pages
1. Users List
2. Profile V1
3. Profile V2
4. Onboarding Flow
5. Empty States
6. Settings (탭형)
7. Pricing
8. Authentication (login / register / forgot password / 등 변형 포함)
9. Notifications Page
10. Error Pages (404 / 500 등)

### Phase 5 — Others / Showcase
1. Widgets
2. Components (쇼케이스)
3. Blocks
4. Examples
5. Website Templates

> 인벤토리는 레퍼런스 사이트맵에서 추출한 것이며, 각 Phase 착수 시 해당 섹션의 하위 페이지/변형을 레퍼런스에서 재확인해 누락이 없도록 한다.

---

## 5. 기준 페이지 상세 — `/dashboard/default`

Phase 0/1의 1차 검증 대상. 레퍼런스의 Default 대시보드 구성:

- **앱 셸:** 좌측 접이식 사이드바 + 상단 헤더(날짜 범위, Download 버튼, 유저 프로필)
- **Team Members** 위젯 (역할·이메일 목록)
- **메트릭 카드:** Subscriptions(`+4850`, +180.1%), Total Revenue(`$15,231.89`, +20.1%)
- **Chat** 위젯 (대화 스레드)
- **Exercise Minutes** 진행형 카드 (차트)
- **Latest Payments** 테이블 (고객·이메일·금액·status badge: success/processing/failed)
- **Payment Method** 폼 (이름·도시·카드번호·만료·CVC)

---

## 6. 공유 기반 아키텍처 (Phase 0가 구축)

### 6.1 앱 셸 (App Shell)
- 접이식 **사이드바** — 전체 네비 그룹(Dashboards / Apps / AI Apps / Pages / Others), 그룹 헤더, 아이콘, 접힘 상태
- 상단 **헤더** — 검색/⌘K 트리거, 테마 토글, 알림 드롭다운, 유저 메뉴, 브레드크럼
- **⌘K 커맨드 팔레트** — 전체 라우트 검색/이동
- **알림 드롭다운**

### 6.2 테마 (Theming)
- light / dark / system 모드
- shadcn 토큰과 동일한 CSS 변수 (Tailwind v4 `@theme`)
- SSR mounted 가드로 hydration 불일치 방지

### 6.3 라우팅 골격
- 모든 페이지를 **placeholder stub**으로 먼저 생성
- 레이아웃 그룹: `(dashboard)` (앱 셸 적용) · `(auth)` (셸 없는 인증 레이아웃)

### 6.4 데이터 & 설정
- `src/lib/nav.ts` — 전체 사이트맵(네비 config)
- `src/lib/data.ts` — mock 데이터 + 타입
- `src/lib/utils.ts` — `cn()` 등 유틸

### 6.5 라이브러리
- **차트:** Recharts (shadcn charts 래퍼)
- **테이블:** TanStack Table
- **아이콘:** lucide-react
- **드래그(Kanban 등):** Phase 2 착수 시 선정 (dnd-kit 우선 검토)

---

## 7. 폴더 구조 (Folder Structure)

```
src/
  app/
    (dashboard)/
      layout.tsx            # 앱 셸
      dashboard/default/page.tsx
      ...                   # 전체 대시보드/앱/페이지 라우트
    (auth)/
      layout.tsx            # 인증 레이아웃 (셸 없음)
      login/page.tsx ...
    layout.tsx              # 루트 레이아웃 (테마 provider, 폰트)
    globals.css
  components/
    ui/                     # shadcn / Base UI 프리미티브
    layout/                 # sidebar · header · command-palette · notifications · theme-toggle
    charts/                 # 차트 래퍼
    dashboards/             # 대시보드별 위젯 컴포지션
    apps/                   # 앱별 컴포넌트
  lib/
    nav.ts · data.ts · utils.ts
  hooks/
```

---

## 8. 컨벤션 (Conventions)

- **컴포넌트:** 서버 컴포넌트 기본, 인터랙션 필요 시 `"use client"`
- **스타일:** Tailwind 유틸리티 + shadcn 토큰; 인라인 매직 컬러 금지(토큰 사용)
- **Mock 데이터:** 모든 더미 데이터/타입은 `src/lib/data.ts`에 집중
- **네비:** 라우트 추가 시 `src/lib/nav.ts`에 반영 (사이드바·⌘K 동시 갱신)
- **파일 크기:** 페이지가 커지면 위젯 단위 컴포넌트로 분리

---

## 9. 검증 방식 (Verification)

프론트엔드 클론이므로 다음을 각 Phase 완료 기준으로 한다:

1. `pnpm build` — 타입 에러 없이 통과
2. `pnpm lint` — 통과 (별도 실행, build가 lint 미실행)
3. **모든 라우트가 에러 없이 렌더** (Playwright 라우트 렌더 스모크 테스트)
4. **핵심 인터랙션 동작** — ⌘K 팔레트, 테마 토글, 사이드바 접힘, 알림, (Phase 2) Kanban 드래그 등
5. **레퍼런스 대비 시각 대조** — 해당 페이지를 레퍼런스와 나란히 비교

---

## 10. Phase 0 — Foundation (다음 산출물)

Phase 0의 구현 계획을 writing-plans로 작성한다. Phase 0 범위:

1. **스캐폴딩 & git** — 빈 디렉토리 → Next.js 16 + Tailwind v4 + TS scaffold, `git init`, pnpm
2. **shadcn/ui(Base UI) 초기화** — 전체 컴포넌트 세트 설치, 토큰/테마
3. **루트 레이아웃** — 폰트, 테마 provider
4. **앱 셸** — 사이드바 + 헤더 + 브레드크럼
5. **⌘K 커맨드 팔레트 + 알림 드롭다운**
6. **`nav.ts` 전체 사이트맵 + 모든 라우트 stub** — 전 구간 네비 동작
7. **`data.ts` mock 데이터 레이어 골격**
8. **검증 셋업** — `pnpm lint`/`build`, Playwright 라우트 스모크 테스트 골격

**Phase 0 완료 기준:** 앱이 실행되고, 사이드바/⌘K로 **모든 라우트(stub 포함)에 에러 없이 이동**할 수 있으며, 테마 토글이 동작하고, `default` 대시보드 라우트가 셸 안에서 렌더된다.

---

## 11. 후속 Phase (요약)

| Phase | 산출물 | 시작점 |
|-------|--------|--------|
| 1. Dashboards | 14개 대시보드 페이지 | Classic/Default 완성 → 검증 → 확장 |
| 2. Apps | 12개 앱 (로컬 상태 인터랙션) | Kanban/Mail 등 대표 앱 먼저 |
| 3. AI Apps | 4개 (모의 응답 스트림) | AI Chat 먼저 |
| 4. Pages | 인증·프로필·설정·가격·에러 등 | 인증 레이아웃 그룹 먼저 |
| 5. Others | Widgets·Components·Blocks·Examples·Templates | Widgets 먼저 |

각 Phase는 착수 시 별도 spec/plan으로 상세화한다.
