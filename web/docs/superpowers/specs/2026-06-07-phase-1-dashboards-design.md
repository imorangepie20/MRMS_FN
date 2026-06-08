# Phase 1 — Dashboards (Design / Spec)

- **작성일:** 2026-06-07
- **상위 스펙:** [2026-06-07-shadcn-ui-kit-clone-design.md](2026-06-07-shadcn-ui-kit-clone-design.md)
- **레퍼런스:** https://shadcnuikit.com/dashboard/default (+ 13개 대시보드 변형)
- **선행:** Phase 0 완료 (앱 셸·테마·라우팅 골격·`nav.ts`·`data.ts`·Playwright)

---

## 1. 목표

14개 대시보드 페이지를 레퍼런스와 **충실하게 복제**한다. 현재 placeholder인 `(dashboard)/dashboard/*` 라우트를 실제 위젯 구성으로 교체한다.

**원칙(WORKING RULE):** 레퍼런스 feature set을 임의 축소·생략하지 않는다.

### 빌드 순서 (분할이지 축소가 아님)
1. **Default 대시보드 먼저** 완성 → 사용자 시각 검수(fidelity 벤치마크)
2. 검수 후 나머지 13개(E-commerce, Payment, Hotel, Project Management, Real Estate, Sales, CRM, Website Analytics, File Manager, Crypto, Academy, Hospital, Finance)를 후속 plan으로 확장

> 이 스펙은 **Default 대시보드**를 상세히 정의하고, 나머지 13개는 개요만 둔다(각자 후속 spec/plan에서 상세화).

---

## 2. 공통 기술 결정

| 항목 | 결정 |
|------|------|
| 차트 | **shadcn `chart` 컴포넌트(Recharts 래퍼)** — `pnpm dlx shadcn@latest add chart`로 추가 |
| 데이터 테이블 | **TanStack Table** (`@tanstack/react-table`) — Latest Payments에 사용 |
| 추가 shadcn 컴포넌트 | `chart`, `calendar`, `select`, `form`, `checkbox`, `progress`, `chart` 등 필요 시 추가 (Base UI 변종) |
| 날짜범위 피커 | `calendar` + `popover`(기존)로 구성. 레퍼런스와 동일하게 **UI만 충실 재현**(표시 텍스트 "10 May 2026 - 06 Jun 2026"). 데이터 리스케일 같은 인터랙션은 비목표(레퍼런스에 없음). |
| Mock 데이터 | `src/lib/data.ts` 확장 (차트 시리즈, 결제 8~10행, 채팅 메시지, 팀 멤버 등) |
| 코드 위치 | 위젯 컴포넌트는 `src/components/dashboards/default/*` 에 분리; 페이지는 위젯을 조합 |

---

## 3. Default 대시보드 상세 (`/dashboard/default`)

### 3.1 페이지 헤더
- 좌측: 페이지 타이틀 **"Dashboard"**
- 우측: **날짜범위 피커** 버튼(outline, 달력 아이콘 + "10 May 2026 - 06 Jun 2026", 클릭 시 `Calendar` range 팝오버) + **"Download"** 버튼(primary, 다운로드 아이콘 — 캐노니컬 shadcn dashboard-01과 동일)

### 3.2 본문 그리드
반응형 그리드: 데스크톱에서 메트릭 카드는 좁은 폭, 나머지는 2~3열 배치. 모바일에서 단일 열로 스택. (`grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4` 기준, 카드별 `col-span` 조정.)

### 3.3 위젯 (7개)

1. **Subscriptions** (메트릭 카드)
   - 라벨 "Subscriptions", 값 **"+4850"**, 델타 **"+180.1% from last month"**
   - 하단에 작은 **bar/area 차트**(월별 시리즈, 축/그리드 최소)

2. **Total Revenue** (메트릭 카드)
   - 라벨 "Total Revenue", 값 **"$15,231.89"**, 델타 **"+20.1% from last month"**
   - 하단에 작은 **area/line 차트**

3. **Team Members** (리스트 카드)
   - 제목 "Team Members" + 설명 "Invite your team members to collaborate."
   - 4명: 아바타 + 이름 + 이메일 + **역할 드롭다운**(예: Owner/Member/Viewer/Developer)

4. **New Message** (채팅 카드)
   - 상단: 아바타 + "Sofia Davis" + 이메일 + 우측 "+" 버튼
   - 말풍선 대화 스레드(좌/우 정렬, muted/primary 배경)
   - 하단: 메시지 입력 `Input` + 전송 버튼

5. **Exercise Minutes** (차트 카드)
   - 제목 "Exercise Minutes" + 설명("Your exercise minutes are ahead of where you normally are.")
   - **라인 차트**(이번 달 vs 평소 2개 시리즈) + 우측 상단 **"Export"** 버튼

6. **Latest Payments** (데이터 테이블 카드)
   - 상단: 필터 `Input`(이메일 필터) + 컬럼 표시 드롭다운
   - **TanStack 테이블**: 체크박스 선택 / **Customer** / **Email** / **Amount**(우측정렬, 통화) / **Status**(badge: success·processing·failed) / 행 액션(⋯)
   - 하단: "N of M row(s) selected." + 페이지네이션(Previous/Next)

7. **Payment Method** (폼 카드)
   - 제목 "Payment Method" + 설명 "Add a new payment method to your account."
   - 결제수단 토글 3종: **Card / Paypal / Apple** (아이콘 + 라벨, 선택형)
   - 필드: Name on card, City, Card number, **Expires**(Month `Select` + Year `Select`), CVC
   - 하단 **"Continue"** 버튼(full-width)

### 3.4 필요한 Mock 데이터 (`src/lib/data.ts` 확장)
- `subscriptionsSeries`, `revenueSeries` (차트용 월별 숫자 배열)
- `exerciseSeries` (2 시리즈)
- `latestPayments` 8~10행으로 확장 (기존 5행 확장)
- `chatMessages` (Sofia Davis 대화)
- `teamMembers` 4명으로 확장 + 역할 enum

---

## 4. 검증 (Default 대시보드)

1. `pnpm build` 통과, `pnpm lint` 0 errors
2. `/dashboard/default` 가 **placeholder가 아니라 7개 위젯**을 렌더 (스모크 테스트 보강: "Subscriptions"·"Total Revenue"·"Team Members"·"Latest Payments"·"Payment Method" 텍스트 visible, 결제 테이블에 행 존재)
3. 기존 48개 e2e 유지(단, `/dashboard/default` 라우트-렌더 단언은 여전히 통과)
4. 차트가 SSR/hydration 에러 없이 렌더 (chart는 client component)
5. 레퍼런스 대비 시각 대조

---

## 5. 나머지 13개 대시보드 (개요)

각 대시보드는 도메인별 위젯 조합이다. 공통 빌딩블록(메트릭 카드, 차트 카드, 테이블 카드, 리스트 카드)을 재사용해 구성한다. 착수 시 각 대시보드를 레퍼런스에서 재확인해 위젯을 정의하는 **후속 spec/plan**으로 진행한다.

| 대시보드 | 대표 위젯(예상) |
|----------|----------------|
| E-commerce | 매출/주문 메트릭, 매출 차트, 베스트셀러, 최근 주문 테이블 |
| Payment | 잔액/지출 카드, 거래 내역, 카드 위젯 |
| Hotel | 예약 현황, 객실 점유율, 체크인/아웃 |
| Project Management | 프로젝트 진행, 태스크, 팀 활동 |
| Real Estate | 매물 통계, 지도/리스트, 수익 |
| Sales | 매출 퍼널, 리드, 목표 달성 |
| CRM | 고객/딜 파이프라인, 활동 |
| Website Analytics | 방문자/세션 차트, 트래픽 소스, 페이지뷰 |
| File Manager | 저장공간, 파일 목록, 최근 파일 |
| Crypto | 포트폴리오, 코인 시세 차트, 거래 |
| Academy | 코스 진행, 수강생, 일정 |
| Hospital | 환자/예약 통계, 부서별, 일정 |
| Finance | 수입/지출, 예산, 거래 내역 |

---

## 6. 이번 산출물

1. 이 스펙 승인
2. **Default 대시보드 구현 plan**을 writing-plans로 작성 → subagent 구현
3. Default 완성·검수 후 나머지 13개를 후속 사이클로 진행
