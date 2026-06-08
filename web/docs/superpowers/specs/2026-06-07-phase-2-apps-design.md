# Phase 2 — Apps (Design / Spec)

- **작성일:** 2026-06-07
- **상위 스펙:** [shadcn UI Kit 전체 복제](2026-06-07-shadcn-ui-kit-clone-design.md)
- **선행:** Phase 1 완료 (14개 대시보드)
- **레퍼런스:** https://shadcnuikit.com/dashboard/apps/*

---

## 1. 목표
12개 앱 페이지를 레퍼런스와 충실하게 복제한다. placeholder인 `(dashboard)/apps/*` 라우트를 실제 앱 UI로 교체한다.

**원칙:** 프론트엔드 UI 클론 — **mock 데이터 + 로컬 상태 인터랙션, 백엔드/영속성 없음**(마스터 스펙 §2). 임의 범위 축소 금지.

### 앱 인벤토리 (12) + 핵심 인터랙션
| 앱 | 핵심 인터랙션 |
|----|---------------|
| Kanban | 컬럼 간/내 카드 **드래그**(dnd-kit), 카드 추가, 뷰 토글 |
| Notes | 3-패널(사이드바·목록·에디터), 노트 선택/검색/추가 |
| Todo List | 사이드바 목록 + 태스크 체크/추가/필터 |
| Tasks | 태스크 보드/리스트, 상태 변경 |
| Chats | 대화 목록 + 메시지 스레드 + 전송 |
| Social Media | 피드 + 포스트 카드 + 좋아요/댓글 |
| Mail | 3-패널(폴더·메일 목록·읽기), 메일 선택/검색 |
| Calendar | 월/주 뷰, 이벤트 표시 |
| File Manager (app) | 폴더/파일 그리드·리스트, 탐색 |
| API Keys | 키 테이블, 생성/복사/폐기(로컬) |
| POS | 상품 그리드 + 장바구니 + 합계 |
| Courses | 코스 카드 그리드 + 진행률 |

---

## 2. 기술 결정
| 항목 | 결정 |
|------|------|
| 드래그앤드롭 | **`@dnd-kit/core` + `@dnd-kit/sortable`** (Kanban, 보드형 Tasks). 가볍고 접근성 좋음. |
| 상태 | React `useState`/`useReducer` 로컬 상태 (영속성 없음) |
| 레이아웃 | 다중 패널 앱(Notes/Mail/Chats)은 좌측 리스트 + 우측 디테일; 모바일에서 단일 패널 |
| 컴포넌트 위치 | 앱별 `src/components/apps/<name>/` (위젯/패널 + colocated `data.ts`) |
| 공유 | 필요 시 `src/components/apps/shared/` (예: 패널 셸) |
| 차트/테이블 | 기존 shadcn `chart`/`table`/TanStack 재사용 |

---

## 3. 배치 (Batches)
앱은 대시보드보다 무거우므로 작은 배치(2~3개)로 진행, 배치마다 리뷰/검수.
- **2a (이번):** Kanban (dnd-kit) · Notes
- **2b:** Todo · Tasks (보드/리스트 + 체크) — Todo 레퍼런스 슬러그 확인 필요
- **2c:** Mail · Chats (3-패널/스레드)
- **2d:** Social Media · Calendar
- **2e:** File Manager(app) · API Keys · POS · Courses

---

## 4. 검증
- `pnpm build` 통과, `pnpm lint` 0 errors
- 각 앱 라우트가 placeholder가 아닌 실제 UI를 에러 없이 렌더 (Playwright)
- **핵심 인터랙션 동작**을 Playwright로 검증: Kanban 드래그(또는 카드 추가), Notes 노트 선택, 검색 필터 등
- 레퍼런스 대비 시각 대조

---

## 5. Batch 2a 상세

### 5.1 Kanban (`/apps/kanban`)
- **헤더:** "Kanban Board" + 우측 컨트롤(Add Assignee 아바타군, 뷰 토글 Board/List/Table, Filter 버튼, "Add Board" 버튼)
- **3 컬럼:** Backlog(4) · In Progress(3) · Done(2). 각 컬럼 헤더에 이름 + 카드 수 + "+" 추가 버튼.
- **카드:** 제목(예: "Integrate Stripe payment gateway"), 설명 스니펫, 4글자 ID(EJDS 등), 진행률 % 바, priority `Badge`(High/Medium/Low), 하단 메트릭 2개(담당자 수·댓글/첨부 수 아이콘+숫자), 담당자 아바타.
- **인터랙션:** **dnd-kit으로 컬럼 간/내 카드 드래그 정렬**(로컬 상태). 각 컬럼 하단 "Add a card"로 카드 추가(간단 입력).

### 5.2 Notes (`/apps/notes`)
- **3-패널:** 좌측 사이드바(All Notes, Starred, Archived + 카테고리 Family/Tasks/Personal/Meetings/Shopping/Planning/Travel, "Add Note") · 중앙 노트 목록(제목·미리보기·라벨·날짜·핀) · 우측 에디터/미리보기(선택 노트 내용).
- **헤더/검색:** 노트 검색 입력으로 목록 필터.
- **인터랙션:** 노트 클릭 시 우측에 표시; 카테고리 클릭 시 목록 필터; 검색 필터; "Add Note"로 새 노트(로컬). 모바일: 목록↔디테일 단일 패널.

### 5.3 검증(2a)
Playwright: `/apps/kanban`·`/apps/notes` 렌더 + 핵심 인터랙션(Notes 노트 선택으로 우측 내용 변경; Kanban 카드 추가 또는 카드 존재 확인). 전체 e2e 통과(현재 64 → +N).

---

## 6. 이번 산출물
1. 이 스펙 승인(또는 진행)
2. Batch 2a 구현: `@dnd-kit` 추가 → Kanban → Notes → 검증 → 리뷰 → merge/push
3. 이후 2b~2e 배치 순차 진행
