# MRMS Soulful Solace 비주얼 아이덴티티 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fraunces 세리프(워드마크+라틴 타이틀) + 피치 크림 팔레트 + 분리 사진 마스트헤드 + 2열 사진 모자이크로 MRMS를 따뜻·고급 "Soulful Solace" 톤으로 통일한다.

**Architecture:** 폰트/팔레트는 토큰(layout.tsx·globals.css) 한 곳에서 바꿔 전역 반영. 신규 `Wordmark`/`SectionMasthead`/`PhotoMosaic` + `visuals.ts`(고정 이미지 세트). 기존 café PhotoBackdrop band를 마스트헤드로 승격하고 전체 texture wash는 제거.

**Tech Stack:** Next.js 16, next/font/google(Fraunces), 순수 `<img>`/CSS. 검증 `cd web && npx tsc --noEmit` + `pnpm build`, 단위 `pnpm test:unit`(vitest).

**규약:** 프론트 전용. push/merge/브랜치전환 금지, feat/soulful-solace에 머무름. 기존 파일 명시 부분만 수술적으로.

**그라운딩(확인됨):**
- 폰트: `layout.tsx`에 `IBM_Plex_Sans`(--font-sans-base)·`IBM_Plex_Mono`(--font-mono). body className에 변수 적용. → Fraunces 추가.
- `globals.css` `@theme inline`에 `--font-display`/`--font-mono`/`--font-heading`(L10-13), `:root`에 `--mrms-bg #f5f0e8` 등(L54-60).
- 에셋 준비됨: `web/public/visuals/soulful-1.jpg … soulful-6.jpg`.
- 워드마크: `app-sidebar`(브랜드 head, "MRMS" 단독 라인), `HomeMarketing`(L15 span), `app-header`(L51 fallback `"MRMS"`).
- 4개 헤더는 café 워크플로로 `<PhotoBackdrop variant="band" src="/visuals/band.jpg"/>` band가 들어가 있음(PgtLibrary `SectionHeader`, MrtDashboard `SectionHeader`, SearchResults `SectionHeading`, HomeLoggedIn `SectionHeader`) → 마스트헤드로 승격.
- MRT 페르소나 그리드: `MrtDashboard.tsx` L116~ `mrt.personas.map` 카드(P-NN·tracks + label) → 모자이크 대상.
- `DashboardShell`에 café 워크플로의 fixed texture 레이어 존재 → 제거.
- vitest 있음(`src/store/player.test.ts`, `src/components/visual/PhotoBackdrop.test.ts`).

**런너:** `cd "/Volumes/MacExtend 1/MRMS_FN/web"`.

---

## File Structure

생성:
- `web/src/lib/visuals.ts` — 이미지 세트 + pickVisual + hashIndex.
- `web/src/lib/visuals.test.ts` — 단위.
- `web/src/components/visual/Wordmark.tsx` — "MRMS." Fraunces.
- `web/src/components/visual/SectionMasthead.tsx` — 분리 사진 제목 블록.
- `web/src/components/visual/PhotoMosaic.tsx` — 2열 사진 카드.

수정:
- `web/src/app/layout.tsx` — Fraunces 폰트.
- `web/src/app/globals.css` — `--font-serif` + 피치 팔레트.
- `web/src/components/layout/app-sidebar.tsx`, `app-header.tsx`, `web/src/components/landing/HomeMarketing.tsx` — `<Wordmark/>`.
- `web/src/components/mrms/PgtLibrary.tsx`, `web/src/components/mrms/MrtDashboard.tsx`, `web/src/components/search/SearchResults.tsx`, `web/src/components/landing/HomeLoggedIn.tsx` — `SectionMasthead`.
- `web/src/components/mrms/MrtDashboard.tsx` — 페르소나 그리드 → `PhotoMosaic`.
- `web/src/components/layout/DashboardShell.tsx` — texture 제거.
- `web/src/components/landing/LandingHero.tsx` — 타이틀 Fraunces.

---

## Task 1: Fraunces 폰트 + 피치 팔레트

**Files:** Modify `web/src/app/layout.tsx`, `web/src/app/globals.css`

- [ ] **Step 1: layout.tsx에 Fraunces 추가**

import 줄 교체 + 폰트 인스턴스 추가(변수명은 기존 `--font-sans-base` 패턴 따라 `--font-serif-base`):
```tsx
import { IBM_Plex_Sans, IBM_Plex_Mono, Fraunces } from "next/font/google";
```
`plexMono` 정의 아래에 추가:
```tsx
const fraunces = Fraunces({
  variable: "--font-serif-base",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
});
```
body className에 변수 추가:
```tsx
      <body className={`${plexSans.variable} ${plexMono.variable} ${fraunces.variable} antialiased`}>
```

- [ ] **Step 2: globals.css — `--font-serif` 매핑 + 피치 팔레트**

`@theme inline`의 `--font-heading` 줄 아래에 추가(기존 `--font-sans: var(--font-sans-base)...` 패턴과 동일하게 base 변수를 가리킴 → `font-serif` 유틸이 Fraunces 사용):
```css
  --font-serif: var(--font-serif-base), Georgia, "Times New Roman", serif;
```
`:root`의 mrms 변수 값 교체(피치 크림):
```css
  --mrms-bg: #f3e6d8;        /* peach cream */
  --mrms-paper: #faf2e9;     /* warm paper */
  --mrms-ink: #1f1a16;       /* warm deep ink */
  --mrms-ink-soft: #5b554c;
  --mrms-ink-mute: #8a8378;
  --mrms-rule: #e0cdba;      /* peach hairline */
  --mrms-rust: #c44518;
```

- [ ] **Step 3: 빌드 확인**

Run: `cd "/Volumes/MacExtend 1/MRMS_FN/web" && npx tsc --noEmit && pnpm build`
Expected: tsc 0, `Compiled successfully`. (전 페이지 피치 톤·Fraunces 로드.)

- [ ] **Step 4: Commit**

```bash
git add web/src/app/layout.tsx web/src/app/globals.css
git commit -m "feat(visual): Fraunces 세리프 + 피치 크림 팔레트 토큰"
```

---

## Task 2: visuals.ts (이미지 세트 + pick)

**Files:** Create `web/src/lib/visuals.ts`, `web/src/lib/visuals.test.ts`

- [ ] **Step 1: 실패 테스트**

`web/src/lib/visuals.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { SOULFUL, pickVisual, hashIndex } from "./visuals";

describe("visuals", () => {
  it("SOULFUL 6장", () => {
    expect(SOULFUL).toHaveLength(6);
    expect(SOULFUL.every((p) => p.startsWith("/visuals/soulful-"))).toBe(true);
  });
  it("pickVisual은 세트 안에서 순환(음수/큰 인덱스 안전)", () => {
    expect(pickVisual(0)).toBe(SOULFUL[0]);
    expect(pickVisual(6)).toBe(SOULFUL[0]);
    expect(pickVisual(7)).toBe(SOULFUL[1]);
    expect(SOULFUL).toContain(pickVisual(-1));
  });
  it("hashIndex 결정적", () => {
    expect(hashIndex("Liked tracks")).toBe(hashIndex("Liked tracks"));
    expect(hashIndex("a")).not.toBe(hashIndex("b"));
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd "/Volumes/MacExtend 1/MRMS_FN/web" && pnpm test:unit src/lib/visuals.test.ts`
Expected: FAIL — 모듈 없음.

- [ ] **Step 3: 구현**

`web/src/lib/visuals.ts`:
```ts
/** Soulful Solace 고정 사진 세트(나노바나나 커스텀). 마스트헤드/모자이크가 인덱스로 선택. */
export const SOULFUL: readonly string[] = [
  "/visuals/soulful-1.jpg",
  "/visuals/soulful-2.jpg",
  "/visuals/soulful-3.jpg",
  "/visuals/soulful-4.jpg",
  "/visuals/soulful-5.jpg",
  "/visuals/soulful-6.jpg",
];

/** 인덱스를 세트 길이로 순환(음수 안전)해서 이미지 경로 반환. */
export function pickVisual(i: number): string {
  const n = SOULFUL.length;
  return SOULFUL[((i % n) + n) % n];
}

/** 문자열 → 결정적 비음수 해시(섹션 제목으로 일관 이미지 배정). */
export function hashIndex(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
```

- [ ] **Step 4: 통과 확인**

Run: `cd "/Volumes/MacExtend 1/MRMS_FN/web" && pnpm test:unit src/lib/visuals.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/visuals.ts web/src/lib/visuals.test.ts
git commit -m "feat(visual): visuals.ts 이미지 세트 + pickVisual/hashIndex"
```

---

## Task 3: Wordmark 컴포넌트 + 교체

**Files:** Create `web/src/components/visual/Wordmark.tsx`; Modify `app-sidebar.tsx`, `app-header.tsx`, `HomeMarketing.tsx`

- [ ] **Step 1: Wordmark 구현**

`web/src/components/visual/Wordmark.tsx`:
```tsx
/** "MRMS." 워드마크 — Fraunces 세리프, 마침표는 러스트. */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-serif font-bold tracking-[-0.01em] text-(--mrms-ink) ${className}`}>
      MRMS<span className="text-(--mrms-rust)">.</span>
    </span>
  );
}
```

- [ ] **Step 2: app-sidebar 브랜드 교체**

`app-sidebar.tsx` 상단 import 추가: `import { Wordmark } from "@/components/visual/Wordmark";`
브랜드 head의 `MRMS` div(`<div className="font-display font-bold text-[20px] leading-none text-[var(--mrms-ink)] mb-1.5">MRMS</div>`)를:
```tsx
          <Wordmark className="text-[22px] leading-none block mb-1.5" />
```

- [ ] **Step 3: HomeMarketing 교체**

`HomeMarketing.tsx` import 추가 후 L15 `<span className="font-display font-bold text-[15px] text-(--mrms-ink)">MRMS</span>`를:
```tsx
        <Wordmark className="text-[17px]" />
```

- [ ] **Step 4: app-header fallback 교체**

`app-header.tsx` import 추가 후 L51 `"MRMS"`(no-current fallback)를 `<Wordmark className="text-[13px]" />`로.

- [ ] **Step 5: 타입체크 + Commit**

Run: `cd "/Volumes/MacExtend 1/MRMS_FN/web" && npx tsc --noEmit`
Expected: 에러 없음.
```bash
git add web/src/components/visual/Wordmark.tsx web/src/components/layout/app-sidebar.tsx web/src/components/layout/app-header.tsx web/src/components/landing/HomeMarketing.tsx
git commit -m "feat(visual): Wordmark(Fraunces MRMS.) + 사용처 교체"
```

---

## Task 4: SectionMasthead + 헤더 4곳 승격

기존 café band 헤더를 분리 사진 마스트헤드로. `SectionMasthead`가 사진(제목 해시로 선택)+Fraunces 제목+kicker+meta+그라데를 캡슐화.

**Files:** Create `web/src/components/visual/SectionMasthead.tsx`; Modify `PgtLibrary.tsx`, `MrtDashboard.tsx`, `SearchResults.tsx`, `HomeLoggedIn.tsx`

- [ ] **Step 1: SectionMasthead 구현**

`web/src/components/visual/SectionMasthead.tsx`:
```tsx
"use client";

import { useState, type ReactNode } from "react";

import { pickVisual, hashIndex } from "@/lib/visuals";

/** 분리된 사진 제목 블록. 사진은 title 해시로 일관 배정, 좌→우 피치 그라데로 제목 가독성. */
export function SectionMasthead({
  kicker,
  title,
  meta,
  action,
}: {
  kicker?: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  action?: ReactNode;
}) {
  const src = pickVisual(hashIndex(String(title)));
  const [failed, setFailed] = useState(false);
  return (
    <div className="relative overflow-hidden border border-(--mrms-ink) mb-5 min-h-[132px] flex items-end px-5 py-4">
      {!failed && (
        <img
          src={src}
          alt=""
          aria-hidden
          onError={() => setFailed(true)}
          decoding="async"
          className="absolute inset-0 w-full h-full object-cover"
          style={{ objectPosition: "center 42%", filter: "saturate(1.5) contrast(1.07) brightness(1.02)" }}
        />
      )}
      <div aria-hidden className="absolute inset-0" style={{ background: "rgba(214,138,66,0.18)", mixBlendMode: "soft-light" }} />
      <div aria-hidden className="absolute inset-0" style={{ background: "linear-gradient(105deg, rgba(243,230,216,.93) 24%, rgba(243,230,216,.5) 50%, rgba(243,230,216,.05) 82%)" }} />
      <div className="relative flex-1 min-w-0">
        {kicker && (
          <div className="font-mono text-[10px] tracking-editorial uppercase text-(--mrms-rust)">{kicker}</div>
        )}
        <div className="font-serif font-bold text-[clamp(24px,3.4vw,38px)] leading-[1.04] text-(--mrms-ink) truncate">
          {title}
        </div>
        {meta && <div className="font-mono text-[11px] text-(--mrms-ink-soft) mt-1">{meta}</div>}
      </div>
      {action && <div className="relative shrink-0 self-center ml-3">{action}</div>}
    </div>
  );
}
```

- [ ] **Step 2: PgtLibrary SectionHeader → SectionMasthead**

`PgtLibrary.tsx`에서 `PhotoBackdrop` import 제거(이 파일에서 더 안 쓰면)하고 `import { SectionMasthead } from "@/components/visual/SectionMasthead";` 추가. 로컬 `SectionHeader`(num/title/meta/action) 함수의 return 전체를:
```tsx
function SectionHeader({
  num,
  title,
  meta,
  action,
}: {
  num: string;
  title: string;
  meta?: string;
  action?: React.ReactNode;
}) {
  return <SectionMasthead kicker={num} title={title} meta={meta} action={action} />;
}
```

- [ ] **Step 3: MrtDashboard SectionHeader → SectionMasthead**

`MrtDashboard.tsx`에서 `PhotoBackdrop` import 제거(미사용 시) + `SectionMasthead` import. 로컬 `SectionHeader`(num/title/meta)를:
```tsx
function SectionHeader({ num, title, meta }: { num: string; title: string; meta?: string }) {
  return <SectionMasthead kicker={num} title={title} meta={meta} />;
}
```

- [ ] **Step 4: SearchResults SectionHeading → SectionMasthead**

`SearchResults.tsx`에서 `PhotoBackdrop` import 제거(미사용 시) + `SectionMasthead` import. `SectionHeading`(children)을:
```tsx
function SectionHeading({ children }: { children: React.ReactNode }) {
  return <SectionMasthead title={children} />;
}
```
(Tracks 섹션의 케밥은 기존 `flex justify-between` 래퍼 안에서 SectionHeading과 나란히 — 그대로 두되, 필요시 케밥을 `action`으로 넘겨도 됨. 최소변경: 케밥 래퍼 유지.)

- [ ] **Step 5: HomeLoggedIn SectionHeader → SectionMasthead**

`HomeLoggedIn.tsx`에서 `PhotoBackdrop` import 제거(미사용 시) + `SectionMasthead` import. 로컬 `SectionHeader`(kicker/title)를:
```tsx
function SectionHeader({ kicker, title }: { kicker: string; title: string }) {
  return <SectionMasthead kicker={kicker} title={title} />;
}
```

- [ ] **Step 6: 타입체크 + 빌드**

Run: `cd "/Volumes/MacExtend 1/MRMS_FN/web" && npx tsc --noEmit && pnpm build`
Expected: tsc 0, 빌드 성공. (미사용 PhotoBackdrop import 없을 것 — 있으면 제거.)

- [ ] **Step 7: Commit**

```bash
git add web/src/components/visual/SectionMasthead.tsx web/src/components/mrms/PgtLibrary.tsx web/src/components/mrms/MrtDashboard.tsx web/src/components/search/SearchResults.tsx web/src/components/landing/HomeLoggedIn.tsx
git commit -m "feat(visual): SectionMasthead로 헤더 4곳 승격(분리 사진 제목)"
```

---

## Task 5: PhotoMosaic + 페르소나 그리드

**Files:** Create `web/src/components/visual/PhotoMosaic.tsx`; Modify `MrtDashboard.tsx`

- [ ] **Step 1: PhotoMosaic 구현**

`web/src/components/visual/PhotoMosaic.tsx`:
```tsx
"use client";

import { useState } from "react";

import { pickVisual } from "@/lib/visuals";

export interface MosaicItem {
  title: string;
  meta?: string;
}

/** 2열(모바일 1열) 사진 카드 — 각 셀 사진(인덱스) + 하단 다크 그라데 + Fraunces 라벨. */
export function PhotoMosaic({ items }: { items: MosaicItem[] }) {
  if (!items.length) return null;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-10">
      {items.map((it, i) => (
        <Cell key={i} item={it} index={i} />
      ))}
    </div>
  );
}

function Cell({ item, index }: { item: MosaicItem; index: number }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="relative h-[150px] overflow-hidden border border-(--mrms-rule)">
      {!failed && (
        <img
          src={pickVisual(index)}
          alt=""
          aria-hidden
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ filter: "saturate(1.45) contrast(1.05)" }}
        />
      )}
      <div aria-hidden className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(31,26,22,.62), transparent 58%)" }} />
      <div className="absolute left-4 bottom-3 right-4 text-(--mrms-paper)">
        <div className="font-serif font-semibold text-[17px] leading-tight truncate">{item.title}</div>
        {item.meta && <div className="font-mono text-[9px] tracking-editorial uppercase opacity-85 mt-0.5 truncate">{item.meta}</div>}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: MrtDashboard 페르소나 그리드 → PhotoMosaic**

`MrtDashboard.tsx` import 추가: `import { PhotoMosaic } from "@/components/visual/PhotoMosaic";`
페르소나 그리드 블록(`<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px ...">{mrt.personas.map(...)}</div>`, L116~129)을:
```tsx
      <PhotoMosaic
        items={mrt.personas.map((p) => ({
          title: p.label ?? `Persona ${p.persona_idx + 1}`,
          meta: `P–${String(p.persona_idx + 1).padStart(2, "0")} · ${p.track_count} tracks`,
        }))}
      />
```

- [ ] **Step 3: 타입체크 + 빌드**

Run: `cd "/Volumes/MacExtend 1/MRMS_FN/web" && npx tsc --noEmit && pnpm build`
Expected: tsc 0, 빌드 성공.

- [ ] **Step 4: Commit**

```bash
git add web/src/components/visual/PhotoMosaic.tsx web/src/components/mrms/MrtDashboard.tsx
git commit -m "feat(visual): PhotoMosaic 2열 화보 카드 + MRT 페르소나 적용"
```

---

## Task 6: 전체 texture 제거 + 히어로 타이틀 Fraunces

**Files:** Modify `web/src/components/layout/DashboardShell.tsx`, `web/src/components/landing/LandingHero.tsx`

- [ ] **Step 1: DashboardShell texture 제거**

`DashboardShell.tsx`에서 café 워크플로가 추가한 fixed texture 레이어 블록(`<div aria-hidden className="fixed inset-0 -z-10" ...><PhotoBackdrop variant="texture" .../></div>`)을 삭제하고, 그리드 루트 div에 `bg-[var(--mrms-bg)]`를 복원(피치 토큰):
```tsx
      <div className="md:grid md:grid-cols-[240px_minmax(0,1fr)] min-h-screen bg-[var(--mrms-bg)]">
```
미사용 `PhotoBackdrop` import 제거.

- [ ] **Step 2: LandingHero 타이틀 Fraunces**

`LandingHero.tsx` 히어로 제목 div(`<div className="font-display font-bold text-[clamp(28px,5vw,48px)] ...">{current?.title ?? "MRMS"}</div>`)의 `font-display`를 `font-serif`로:
```tsx
        <div className="font-serif font-bold text-[clamp(30px,5vw,52px)] leading-[1.02] mt-1 truncate">
          {current?.title ?? "MRMS."}
        </div>
```
(fallback도 "MRMS." 마침표.)

- [ ] **Step 3: 타입체크 + 빌드**

Run: `cd "/Volumes/MacExtend 1/MRMS_FN/web" && npx tsc --noEmit && pnpm build`
Expected: tsc 0, 빌드 성공.

- [ ] **Step 4: Commit**

```bash
git add web/src/components/layout/DashboardShell.tsx web/src/components/landing/LandingHero.tsx
git commit -m "feat(visual): 전체 texture wash 제거(분리 마스트헤드로) + 히어로 타이틀 Fraunces"
```

---

## 최종 검증 (모든 태스크 후)

- [ ] **단위 + 타입 + 빌드**:
```bash
cd "/Volumes/MacExtend 1/MRMS_FN/web" && pnpm test:unit src/lib/visuals.test.ts src/components/visual/PhotoBackdrop.test.ts && npx tsc --noEmit && pnpm build
```
Expected: vitest 통과, tsc 0, `Compiled successfully`, `/visuals/soulful-*` 에셋 번들 포함.

- [ ] **시각 확인(권장)**: 로컬 프로덕션 미리보기로 메인(Fraunces 워드마크/타이틀, 피치 톤)·섹션 마스트헤드·페르소나 모자이크·헤더 확인. 강도는 SectionMasthead/PhotoMosaic 상수에서 조정.

## 주의

- 전역 팔레트/폰트는 토큰 한 곳이라 안전하나 전 페이지 영향 — 빌드 후 시각 점검.
- Fraunces는 라틴 전용 → 한글 타이틀은 sans 폴백(혼용 의도됨).
- 기존 café band/texture를 마스트헤드/제거로 대체 — café PhotoBackdrop 컴포넌트 자체는 LandingHero 히어로 배경에서 계속 사용(유지).
