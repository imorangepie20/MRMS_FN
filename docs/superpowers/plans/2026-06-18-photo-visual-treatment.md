# MRMS 카페·책 사진 트리트먼트 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 큐레이션 Unsplash 카페·책 사진 4장을 정적 호스팅하고, 재사용 `PhotoBackdrop`(hero/band/texture)로 메인 히어로·페이지 헤더·전체 배경에 은은한 따뜻함을 입힌다.

**Architecture:** sharp 없이 Unsplash CDN(imgix) 파라미터로 용도별 사이즈를 직접 받아 `web/public/visuals/`에 저장. `<img>` + CSS(saturate/amber soft-light/그라데/블러)로 트리트먼트(프로젝트가 next/image 미사용). 히어로는 기존 스펙트럼·컨트롤 유지하고 배경만 카페 사진으로 전환.

**Tech Stack:** Next.js 16(App Router), 순수 `<img>`/CSS, Unsplash API(.env `UNSPLASH_ACCESS_KEY`, 큐레이션·다운로드에만). 검증 `cd web && npx tsc --noEmit` + `pnpm build`, 컴포넌트 단위 `pnpm test:unit`(vitest).

**규약:** 프론트 전용. push/merge 금지, feat/photo-visual-treatment에 머무름. 기존 파일은 명시 부분만 수술적으로.

**런너:** `cd "/Volumes/MacExtend 1/MRMS_FN/web"` 에서 `npx tsc --noEmit`, `pnpm build`, `pnpm test:unit`. 에셋 스크립트는 리포 루트에서 `.venv/bin/python`.

**그라운딩(확인됨):**
- sharp·next/image 미사용 → `<img>`+CSS. `web/public/`에 svg들 존재(여기에 `visuals/` 추가).
- 토스트=sonner. vitest 있음(`vitest.config.ts`, `src/store/player.test.ts`).
- Footer·About **없음** → 크레딧은 `HomeMarketing` 하단에 소형 표기 신설.
- `SectionHeader`는 3곳 로컬 정의(HomeLoggedIn:7, MrtDashboard:396, PgtLibrary:355), SearchResults는 `SectionHeading`(27). 공유본 없음 → 각자 백드롭 드롭인.
- `LandingHero`는 다크 스펙트럼 히어로(ink bg + 블러 앨범 + paper 텍스트). `DashboardShell` 루트 `bg-[var(--mrms-bg)]`.
- 선택 사진: GX4YM64o49U(Timothy Barlin), tVugl_rtvHA(Fernando Hernandez), PuZgWp_a0Cs(Priscilla Du Preez), 35AdKAwMpg0(Timothy Barlin).

---

## File Structure

생성:
- `scripts/fetch_visuals.py` — Unsplash 다운로드+사이즈+download_location 트리거(재현용).
- `web/public/visuals/hero-1.jpg`(GX4YM64o49U), `hero-2.jpg`(tVugl_rtvHA), `band.jpg`(PuZgWp_a0Cs), `texture.jpg`(35AdKAwMpg0), `CREDITS.md`.
- `web/src/components/visual/PhotoBackdrop.tsx`.
- `web/src/components/visual/PhotoBackdrop.test.ts` — variant→설정 단위.

수정:
- `web/src/components/landing/LandingHero.tsx` — 카페 히어로 배경.
- `web/src/components/mrms/PgtLibrary.tsx`(SectionHeader), `web/src/components/mrms/MrtDashboard.tsx`(SectionHeader), `web/src/components/search/SearchResults.tsx`(SectionHeading), `web/src/components/landing/HomeLoggedIn.tsx`(SectionHeader) — 헤더 밴드.
- `web/src/components/layout/DashboardShell.tsx` — 전체 배경 텍스처.
- `web/src/components/landing/HomeMarketing.tsx` — 크레딧 소형 표기.

---

## Task 1: Unsplash 에셋 다운로드 + 최적화

**Files:**
- Create: `scripts/fetch_visuals.py`, `web/public/visuals/*.jpg`, `web/public/visuals/CREDITS.md`

- [ ] **Step 1: 스크립트 작성**

`scripts/fetch_visuals.py`:

```python
"""Unsplash 큐레이션 4장을 용도별 사이즈로 web/public/visuals/에 저장 + 크레딧 + download 트리거.
키는 .env UNSPLASH_ACCESS_KEY(큐레이션 전용, 런타임 미사용)."""
import os, pathlib, httpx

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "web" / "public" / "visuals"
OUT.mkdir(parents=True, exist_ok=True)

KEY = ""
for line in (ROOT / ".env").read_text().splitlines():
    if line.startswith("UNSPLASH_ACCESS_KEY="):
        KEY = line.split("=", 1)[1].strip().strip('"').strip("'")
assert KEY, "UNSPLASH_ACCESS_KEY 없음"
H = {"Authorization": f"Client-ID {KEY}", "Accept-Version": "v1"}

# (id, 출력파일, 가로px, 품질)
JOBS = [
    ("GX4YM64o49U", "hero-1.jpg", 1600, 80),
    ("tVugl_rtvHA", "hero-2.jpg", 1600, 80),
    ("PuZgWp_a0Cs", "band.jpg", 1100, 78),
    ("35AdKAwMpg0", "texture.jpg", 480, 68),
]
credits = ["# Photo credits (Unsplash)", "", "사진은 Unsplash 라이선스. 큐레이션 정적 호스팅.", ""]
with httpx.Client(timeout=40, headers=H) as c:
    for pid, fname, w, q in JOBS:
        meta = c.get(f"https://api.unsplash.com/photos/{pid}")
        meta.raise_for_status()
        j = meta.json()
        raw = j["urls"]["raw"]
        url = f"{raw}&w={w}&q={q}&fm=jpg&fit=max"
        img = c.get(url); img.raise_for_status()
        (OUT / fname).write_bytes(img.content)
        # download 트리거(가이드라인)
        try:
            c.get(j["links"]["download_location"])
        except Exception:
            pass
        who, link = j["user"]["name"], j["links"]["html"]
        credits.append(f"- `{fname}` — [{who}]({j['user']['links']['html']}) · {link}")
        print(f"saved {fname} ({len(img.content)//1024}KB) by {who}")
(OUT / "CREDITS.md").write_text("\n".join(credits) + "\n")
print("CREDITS.md written")
```

- [ ] **Step 2: 실행**

Run: `cd "/Volumes/MacExtend 1/MRMS_FN" && .venv/bin/python scripts/fetch_visuals.py`
Expected: `saved hero-1.jpg (...KB) by Timothy Barlin` … 4줄 + `CREDITS.md written`. (실패 시 `.env`에 `UNSPLASH_ACCESS_KEY` 값 확인.)

- [ ] **Step 3: 산출물 확인**

Run: `ls -la web/public/visuals/ && wc -c web/public/visuals/*.jpg`
Expected: hero-1/hero-2/band/texture.jpg + CREDITS.md. 용량 대략 hero ≤350KB, band ≤180KB, texture ≤60KB.

- [ ] **Step 4: Commit**

```bash
cd "/Volumes/MacExtend 1/MRMS_FN"
git add scripts/fetch_visuals.py web/public/visuals/
git commit -m "feat(visual): Unsplash 카페·책 에셋 4장 + 크레딧"
```

---

## Task 2: PhotoBackdrop 컴포넌트

**Files:**
- Create: `web/src/components/visual/PhotoBackdrop.tsx`, `web/src/components/visual/PhotoBackdrop.test.ts`

- [ ] **Step 1: 실패 테스트(variant 설정 매핑)**

`web/src/components/visual/PhotoBackdrop.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { BACKDROP } from "./PhotoBackdrop";

describe("PhotoBackdrop variant config", () => {
  it("hero/band/texture 세 variant가 정의됨", () => {
    expect(Object.keys(BACKDROP).sort()).toEqual(["band", "hero", "texture"]);
  });
  it("불투명도: hero=1 > band(0.2) > texture(0.07)", () => {
    expect(BACKDROP.hero.opacity).toBe(1);
    expect(BACKDROP.band.opacity).toBeLessThan(0.3);
    expect(BACKDROP.texture.opacity).toBeLessThanOrEqual(0.08);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd "/Volumes/MacExtend 1/MRMS_FN/web" && pnpm test:unit src/components/visual/PhotoBackdrop.test.ts`
Expected: FAIL — `Cannot find module './PhotoBackdrop'`.

- [ ] **Step 3: 구현**

`web/src/components/visual/PhotoBackdrop.tsx`:

```tsx
"use client";

import { useState } from "react";

export type BackdropVariant = "hero" | "band" | "texture";

/** variant별 트리트먼트 상수(목업서 확정: saturate 1.8 + amber soft-light). */
export const BACKDROP: Record<
  BackdropVariant,
  { opacity: number; blur: number; saturate: number }
> = {
  hero: { opacity: 1, blur: 0, saturate: 1.8 },
  band: { opacity: 0.2, blur: 3, saturate: 1.5 },
  texture: { opacity: 0.07, blur: 7, saturate: 1.4 },
};

/** 카페·책 사진을 은은하게 까는 배경 레이어. 절대배치·장식용(aria-hidden).
 *  hero: 크림 하단 그라데로 텍스트 가독성 / band: 좌→우 페이드 / texture: 전체 옅게. */
export function PhotoBackdrop({
  variant,
  src,
  className = "",
}: {
  variant: BackdropVariant;
  src: string;
  className?: string;
}) {
  const cfg = BACKDROP[variant];
  const [failed, setFailed] = useState(false);
  return (
    <div aria-hidden className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
      {!failed && (
        <img
          src={src}
          alt=""
          onError={() => setFailed(true)}
          className="w-full h-full object-cover"
          style={{
            objectPosition: "center 40%",
            opacity: cfg.opacity,
            filter: `saturate(${cfg.saturate}) contrast(1.12) brightness(1.03)${cfg.blur ? ` blur(${cfg.blur}px)` : ""}`,
          }}
        />
      )}
      {/* amber 따뜻 그레이드 */}
      <div className="absolute inset-0" style={{ background: "rgba(214,138,66,0.16)", mixBlendMode: "soft-light" }} />
      {/* 가독성 그라데 */}
      {variant === "hero" && (
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(to top, var(--mrms-bg) 2%, rgba(245,240,232,.85) 26%, rgba(245,240,232,.12) 52%, transparent 75%)" }}
        />
      )}
      {variant === "band" && (
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(to right, var(--mrms-bg) 30%, rgba(245,240,232,.4) 100%)" }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 4: 통과 확인**

Run: `cd "/Volumes/MacExtend 1/MRMS_FN/web" && pnpm test:unit src/components/visual/PhotoBackdrop.test.ts && npx tsc --noEmit`
Expected: 2 passed, tsc 0.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/visual/PhotoBackdrop.tsx web/src/components/visual/PhotoBackdrop.test.ts
git commit -m "feat(visual): PhotoBackdrop 컴포넌트(hero/band/texture)"
```

---

## Task 3: 메인 히어로 카페 전환 (스펙트럼 유지)

`LandingHero`를 다크 앨범-블러 배경 → 라이트 카페 사진 배경으로. 스펙트럼·메타·컨트롤은 유지하되 라이트 톤으로 recolor. 메인을 키운다(높이↑).

**Files:**
- Modify: `web/src/components/landing/LandingHero.tsx`

- [ ] **Step 1: import + section/배경 교체**

상단 import에서 `AlbumArt` 제거하고 추가:
```tsx
import { PhotoBackdrop } from "@/components/visual/PhotoBackdrop";
```
(`AlbumArt` import 줄 삭제 — 더 이상 사용 안 함.)

`return (`의 `<section ...>`부터 다크 배경 두 블록(앨범 div + ink 그라데 div)을 아래로 교체:
```tsx
    <section className="relative h-[clamp(380px,56vh,560px)] overflow-hidden border-b border-(--mrms-ink) bg-(--mrms-bg)">
      <PhotoBackdrop variant="hero" src="/visuals/hero-1.jpg" />
```
(즉 `{current && (<div ...AlbumArt... />)}` 블록과 그 아래 `<div className="absolute inset-0 bg-gradient-to-t from-(--mrms-ink) ..." />` 블록 둘 다 삭제하고 `<PhotoBackdrop .../>` 한 줄로 대체. 스펙트럼/메타/컨트롤/audio 블록은 유지.)

- [ ] **Step 2: 메타·컨트롤 라이트 톤 recolor**

메타 컨테이너와 버튼들을 라이트(ink) 톤으로:
- `<div className="absolute left-6 md:left-14 bottom-8 right-6 text-(--mrms-paper)">` → `text-(--mrms-ink)`
- "Featured today" 줄: `opacity-80` → `text-(--mrms-rust) opacity-100`
- 제목 div: 그대로(상속 ink). artist div `opacity-85` → `text-(--mrms-ink-soft)`
- 정지/다음 버튼: `bg-(--mrms-paper)/15 text-(--mrms-paper) border-(--mrms-paper)/30 hover:bg-(--mrms-paper)/25` → `bg-(--mrms-ink)/8 text-(--mrms-ink) border-(--mrms-ink)/20 hover:bg-(--mrms-ink)/15`
- "플레이 허용" 버튼(rust bg + paper text): 그대로 둠(라이트에서도 대비 OK).

(스펙트럼 div는 그대로 — 막대가 `--mrms-rust`라 라이트 배경에서도 보임.)

- [ ] **Step 3: 타입체크 + 빌드**

Run: `cd "/Volumes/MacExtend 1/MRMS_FN/web" && npx tsc --noEmit && pnpm build`
Expected: tsc 0, `Compiled successfully`.

- [ ] **Step 4: Commit**

```bash
git add web/src/components/landing/LandingHero.tsx
git commit -m "feat(visual): 메인 히어로 카페 사진 배경 전환(스펙트럼 유지)"
```

---

## Task 4: 페이지 헤더 밴드

3개 로컬 `SectionHeader` + `SectionHeading`에 `band` 백드롭을 드롭인. 각 헤더를 `relative overflow-hidden`로 만들고 백드롭을 첫 자식으로, 콘텐츠는 `relative`로 위에.

**Files:**
- Modify: `web/src/components/mrms/PgtLibrary.tsx`, `web/src/components/mrms/MrtDashboard.tsx`, `web/src/components/search/SearchResults.tsx`, `web/src/components/landing/HomeLoggedIn.tsx`

- [ ] **Step 1: PgtLibrary SectionHeader**

`PgtLibrary.tsx` 상단 import에 추가: `import { PhotoBackdrop } from "@/components/visual/PhotoBackdrop";`

`SectionHeader`(라인 355~)의 바깥 `<div className="flex justify-between items-baseline pb-2.5 border-b border-[var(--mrms-ink)] mb-6">`를 백드롭 래핑으로:
```tsx
    <div className="relative overflow-hidden flex justify-between items-baseline pb-2.5 px-3 -mx-3 border-b border-[var(--mrms-ink)] mb-6">
      <PhotoBackdrop variant="band" src="/visuals/band.jpg" />
      <div className="relative">
        <span className="font-mono text-[10px] tracking-editorial uppercase text-[var(--mrms-ink-mute)]">
          {num}
        </span>
        &nbsp;&nbsp;
        <span className="font-display font-bold text-[20px]">{title}</span>
      </div>
      <div className="relative flex items-center gap-2">
        {meta && (
          <span className="font-mono text-[11px] text-[var(--mrms-ink-soft)]">{meta}</span>
        )}
        {action}
      </div>
    </div>
```
(기존 내부 구조 유지 + `relative` 추가 + 백드롭. `px-3 -mx-3`로 밴드가 좌우로 살짝 번지게.)

- [ ] **Step 2: MrtDashboard SectionHeader**

`MrtDashboard.tsx` 상단 import에 추가: `import { PhotoBackdrop } from "@/components/visual/PhotoBackdrop";`

`SectionHeader`(라인 396~) return의 바깥 `<div className="flex justify-between items-baseline pb-2.5 border-b border-[var(--mrms-ink)] mb-6">` ~ 닫는 `</div>` 블록을:
```tsx
    <div className="relative overflow-hidden flex justify-between items-baseline pb-2.5 px-3 -mx-3 border-b border-[var(--mrms-ink)] mb-6">
      <PhotoBackdrop variant="band" src="/visuals/band.jpg" />
      <div className="relative">
        <span className="font-mono text-[10px] tracking-editorial uppercase text-[var(--mrms-ink-mute)]">
          {num}
        </span>
        &nbsp;&nbsp;
        <span className="font-display font-bold text-[20px]">
          {title}
        </span>
      </div>
      {meta && (
        <span className="relative font-mono text-[11px] text-[var(--mrms-ink-soft)]">{meta}</span>
      )}
    </div>
```

- [ ] **Step 3: SearchResults SectionHeading**

`SearchResults.tsx` import 추가 + `SectionHeading`(라인 27)을:
```tsx
function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden font-mono text-[10px] tracking-editorial uppercase text-(--mrms-ink-mute) border-b border-(--mrms-ink) pb-1 px-3 -mx-3 mb-4">
      <PhotoBackdrop variant="band" src="/visuals/band.jpg" />
      <span className="relative">{children}</span>
    </div>
  );
}
```

- [ ] **Step 4: HomeLoggedIn SectionHeader**

`HomeLoggedIn.tsx` 상단 import에 추가: `import { PhotoBackdrop } from "@/components/visual/PhotoBackdrop";`

`SectionHeader`(라인 7~) return의 `<div className="flex justify-between items-baseline pb-2 border-b border-(--mrms-ink) mb-4 mt-10">` 블록을:
```tsx
    <div className="relative overflow-hidden flex justify-between items-baseline pb-2 px-3 -mx-3 border-b border-(--mrms-ink) mb-4 mt-10">
      <PhotoBackdrop variant="band" src="/visuals/band.jpg" />
      <span className="relative font-mono text-[10px] tracking-editorial uppercase text-(--mrms-ink-mute)">{kicker}</span>
      <span className="relative font-display font-bold text-[18px] text-(--mrms-ink)">{title}</span>
    </div>
```

- [ ] **Step 5: 타입체크 + 빌드**

Run: `cd "/Volumes/MacExtend 1/MRMS_FN/web" && npx tsc --noEmit && pnpm build`
Expected: tsc 0, 빌드 성공.

- [ ] **Step 6: Commit**

```bash
git add web/src/components/mrms/PgtLibrary.tsx web/src/components/mrms/MrtDashboard.tsx web/src/components/search/SearchResults.tsx web/src/components/landing/HomeLoggedIn.tsx
git commit -m "feat(visual): 페이지 헤더에 은은한 사진 밴드"
```

---

## Task 5: 전체 배경 텍스처

`DashboardShell` 루트에 `fixed` 텍스처 레이어(크림 베이스 + 옅은 블러 사진). 루트의 불투명 크림 bg를 제거해 텍스처가 비치게(콘텐츠 카드는 페이퍼라 가독성 유지).

**Files:**
- Modify: `web/src/components/layout/DashboardShell.tsx`

- [ ] **Step 1: 텍스처 레이어 추가 + 루트 bg 제거**

상단 import 추가: `import { PhotoBackdrop } from "@/components/visual/PhotoBackdrop";`

`return (`의 `<PlaylistActionsContext.Provider value={true}>` 바로 안, 그리드 div 앞에 fixed 텍스처를 추가하고, 그리드 루트의 `bg-[var(--mrms-bg)]`를 제거:
```tsx
    <PlaylistActionsContext.Provider value={true}>
      {/* 전체 배경 텍스처 — 크림 베이스 + 옅은 카페 사진(콘텐츠 뒤로 비침) */}
      <div aria-hidden className="fixed inset-0 -z-10" style={{ background: "var(--mrms-bg)" }}>
        <PhotoBackdrop variant="texture" src="/visuals/texture.jpg" />
      </div>
      <div className="md:grid md:grid-cols-[240px_minmax(0,1fr)] min-h-screen">
```
(즉 그리드 div className에서 `bg-[var(--mrms-bg)]` 삭제 — 이제 fixed 레이어가 크림 베이스 제공. 사이드바·헤더는 자체 bg가 있어 그대로, `main` 영역 여백으로 텍스처가 은은히 비침.)

- [ ] **Step 2: 타입체크 + 빌드**

Run: `cd "/Volumes/MacExtend 1/MRMS_FN/web" && npx tsc --noEmit && pnpm build`
Expected: tsc 0, 빌드 성공.

- [ ] **Step 3: Commit**

```bash
git add web/src/components/layout/DashboardShell.tsx
git commit -m "feat(visual): 전체 페이지 배경 텍스처(옅은 카페 사진)"
```

---

## Task 6: Unsplash 크레딧 표기

가이드라인 준수 — 사진가 크레딧을 마케팅 랜딩 하단에 소형 표기(Footer/About 없음).

**Files:**
- Modify: `web/src/components/landing/HomeMarketing.tsx`

- [ ] **Step 1: 크레딧 라인 추가**

`HomeMarketing.tsx`의 최상위 컨테이너 마지막(닫는 태그 직전)에 소형 크레딧 추가:
```tsx
      <footer className="px-6 md:px-14 py-6 border-t border-(--mrms-rule) font-mono text-[10px] tracking-editorial uppercase text-(--mrms-ink-mute)">
        Photos · Unsplash — Timothy Barlin, Fernando Hernandez, Priscilla Du Preez
      </footer>
```
(HomeMarketing의 루트 div 구조 확인 후 그 안 맨 아래에 삽입.)

- [ ] **Step 2: 타입체크 + 빌드 + Commit**

Run: `cd "/Volumes/MacExtend 1/MRMS_FN/web" && npx tsc --noEmit && pnpm build`
Expected: tsc 0, 빌드 성공.

```bash
git add web/src/components/landing/HomeMarketing.tsx
git commit -m "feat(visual): Unsplash 사진 크레딧 표기"
```

---

## 최종 검증 (모든 태스크 후)

- [ ] **단위 + 타입 + 빌드**:
```bash
cd "/Volumes/MacExtend 1/MRMS_FN/web" && pnpm test:unit src/components/visual/PhotoBackdrop.test.ts && npx tsc --noEmit && pnpm build
```
Expected: vitest 2 passed, tsc 0, `Compiled successfully`, `web/public/visuals/` 에셋 번들에 포함.

- [ ] **시각 확인(권장)**: dev 또는 빌드 미리보기로 메인 히어로(카페+스펙트럼)·페이지 헤더 밴드·전체 배경이 은은한지 확인. 과하면 PhotoBackdrop `BACKDROP` 상수에서 opacity/saturate 조정(한 곳).

## 배포/주의

- 에셋은 정적이라 런타임 Unsplash 키 불필요. `.env` 키는 큐레이션 전용(커밋 안 됨).
- 시각 디테일(히어로 합성·밴드 강도)은 prod 확인 후 `BACKDROP` 상수로 미세조정.
