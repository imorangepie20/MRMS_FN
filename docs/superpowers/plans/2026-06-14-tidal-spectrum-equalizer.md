# Tidal Spectrum Equalizer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 하단 PlayerBar 상단 엣지에, Tidal 재생 중에만 실제 주파수 스펙트럼으로 율동하는 비주얼 이퀄라이저를 띄운다.

**Architecture:** MRMS Tidal 재생은 same-origin 프록시 스트림을 트는 단일 `HTMLAudioElement`다. 그 element를 `tidal-player.ts`에서 1회 `createMediaElementSource → AnalyserNode → destination`으로 라우팅하고, `SpectrumEqualizer.tsx`가 `getByteFrequencyData`를 rAF로 읽어 순수 함수 `binsToBarHeights`(`lib/spectrum.ts`)로 막대 높이를 만든다. 표시 조건은 store의 반응형 `activePlatform === "tidal" && isPlaying`.

**Tech Stack:** Next.js 16 / React 19 / TypeScript 5 / zustand 5 / Tailwind v4 / Web Audio API. 단위 테스트는 **Vitest 신규 도입**(web 첫 JS 단위 러너; 기존엔 Playwright e2e만).

**근거 문서:** [spec](2026-06-14-tidal-spectrum-equalizer-design.md) · [ADR-004](../../decisions/ADR-004-tidal-spectrum-equalizer.md)

**패키지 매니저:** `pnpm` (web/pnpm-lock.yaml). 모든 명령은 `web/`에서 실행.

---

## File Structure

| 파일 | 책임 |
|---|---|
| `web/vitest.config.ts` (신규) | Vitest 설정 — `src/**/*.test.ts`만, node env (Playwright `e2e/*.spec.ts`와 분리) |
| `web/package.json` (수정) | `vitest` devDep + `"test:unit"` 스크립트 |
| `web/src/lib/spectrum.ts` (신규) | 순수 함수 `binsToBarHeights` + `logBandRange` + `BAR_COUNT`. React/Web Audio 의존 0 |
| `web/src/lib/spectrum.test.ts` (신규) | `binsToBarHeights`/`logBandRange` 단위 테스트 |
| `web/src/lib/tidal-player.ts` (수정) | `ensureAnalyser()` + `getTidalAnalyser()`, `loadAndPlay`/`resumePlayback`에서 호출 |
| `web/src/store/player.ts` (수정) | `activePlatform: ActivePlatform \| null` 필드 + `reset()`에서 null |
| `web/src/store/player.test.ts` (신규) | store `activePlatform` 기본값 + reset 클리어 |
| `web/src/lib/player.ts` (수정) | `playOn`의 `active = platform` 옆에서 `activePlatform` 스토어 기록 |
| `web/src/components/player/SpectrumEqualizer.tsx` (신규) | 막대 렌더 + rAF 루프 + 표시/숨김 |
| `web/src/components/player/PlayerBar.tsx` (수정) | 배너 블록 **앞**에 `<SpectrumEqualizer />` 마운트 |

---

## Task 1: Vitest 셋업 (web 첫 단위 러너)

**Files:**
- Create: `web/vitest.config.ts`
- Modify: `web/package.json`
- Test (임시): `web/src/setup-check.test.ts`

- [ ] **Step 1: Vitest 설치**

Run (in `web/`):
```bash
pnpm add -D vitest
```
Expected: vitest가 devDependencies에 추가, lockfile 갱신.

- [ ] **Step 2: vitest.config.ts 작성**

Create `web/vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // src 의 *.test.ts 만 단위 테스트로 실행한다.
    // Playwright e2e (e2e/*.spec.ts) 와 분리하기 위해 *.test.ts 만 포함.
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
```

- [ ] **Step 3: test:unit 스크립트 추가**

Modify `web/package.json` scripts (기존 `"test:e2e": "playwright test"` 아래에 추가):
```json
    "test:e2e": "playwright test",
    "test:unit": "vitest run"
```

- [ ] **Step 4: 러너 동작 확인용 임시 테스트**

Create `web/src/setup-check.test.ts`:
```ts
import { describe, it, expect } from "vitest";

describe("vitest setup", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: 러너 실행 — PASS 확인**

Run (in `web/`):
```bash
pnpm test:unit
```
Expected: PASS — `1 passed (1)`. (vitest가 `src/setup-check.test.ts`를 찾아 통과.)

- [ ] **Step 6: Commit**

```bash
git add web/package.json web/pnpm-lock.yaml web/vitest.config.ts web/src/setup-check.test.ts
git commit -m "test(web): add Vitest unit runner (src/**/*.test.ts, node env)"
```

---

## Task 2: `lib/spectrum.ts` — 순수 변환 함수 (TDD)

**Files:**
- Create: `web/src/lib/spectrum.ts`
- Test: `web/src/lib/spectrum.test.ts`
- Delete: `web/src/setup-check.test.ts` (Task 1 임시 테스트 제거)

`binsToBarHeights(bins, prev)`는 주파수 바이트 배열을 `BAR_COUNT`개 막대 높이(0..1)로 변환한다. my-forever-music `BarsVisualizer`의 수학 차용: 로그 밴드 버킷팅 → 고주파 게인 → 노이즈 게이팅 → 감마 → attack/release 스무딩.

- [ ] **Step 1: 임시 테스트 제거**

```bash
git rm web/src/setup-check.test.ts
```

- [ ] **Step 2: 실패 테스트 작성**

Create `web/src/lib/spectrum.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { BAR_COUNT, binsToBarHeights, logBandRange } from "./spectrum";

const zeros = (n: number) => Array.from({ length: n }, () => 0);

describe("binsToBarHeights", () => {
  it("무음(전부 0) 입력 + prev 0 → 모든 막대 0", () => {
    const bins = new Uint8Array(128); // all 0
    const out = binsToBarHeights(bins, zeros(BAR_COUNT));
    expect(out).toHaveLength(BAR_COUNT);
    expect(out.every((v) => v === 0)).toBe(true);
  });

  it("풀 스케일(전부 255) + prev 0 → 최고주파 막대는 attack 계수(0.95)만큼 상승해 ≈0.95", () => {
    const bins = new Uint8Array(128).fill(255);
    const out = binsToBarHeights(bins, zeros(BAR_COUNT));
    // 최고주파 막대는 target=1로 클램프 → 0 + (1-0)*ATTACK = 0.95
    expect(Math.abs(out[BAR_COUNT - 1] - 0.95)).toBeLessThan(1e-9);
    // 모든 막대가 충분히 큼
    expect(out.every((v) => v > 0.5)).toBe(true);
  });

  it("무음 + prev 1 → release 계수(0.32)로 천천히 하강해 ≈0.68", () => {
    const bins = new Uint8Array(128); // all 0 → target 0
    const prev = Array.from({ length: BAR_COUNT }, () => 1);
    const out = binsToBarHeights(bins, prev);
    // 1 + (0-1)*RELEASE = 1 - 0.32 = 0.68
    expect(Math.abs(out[0] - 0.68)).toBeLessThan(1e-9);
    expect(out.every((v) => Math.abs(v - 0.68) < 1e-9)).toBe(true);
  });
});

describe("logBandRange", () => {
  it("각 막대 밴드는 1 <= start < end <= binCount", () => {
    for (let i = 0; i < BAR_COUNT; i++) {
      const [start, end] = logBandRange(i, 128);
      expect(start).toBeGreaterThanOrEqual(1);
      expect(end).toBeLessThanOrEqual(128);
      expect(start).toBeLessThan(end);
    }
  });

  it("첫 막대는 bin 1에서 시작하고, start는 비감소", () => {
    expect(logBandRange(0, 128)[0]).toBe(1);
    let prevStart = 0;
    for (let i = 0; i < BAR_COUNT; i++) {
      const [start] = logBandRange(i, 128);
      expect(start).toBeGreaterThanOrEqual(prevStart);
      prevStart = start;
    }
  });
});
```

- [ ] **Step 3: 테스트 실패 확인**

Run (in `web/`):
```bash
pnpm test:unit
```
Expected: FAIL — `Failed to resolve import "./spectrum"` (파일 없음).

- [ ] **Step 4: `spectrum.ts` 구현**

Create `web/src/lib/spectrum.ts`:
```ts
// 주파수 스펙트럼(byte frequency data)을 막대 높이로 변환하는 순수 함수.
// my-forever-music BarsVisualizer 의 수학 차용 (로그 밴드 / 고주파 게인 /
// 노이즈 게이팅 / 감마 / attack-release 스무딩). React / Web Audio 의존 없음.

export const BAR_COUNT = 48;

const PEAK_GAIN = 0.8;
const RESPONSE_GAMMA = 0.95;
const NOISE_FLOOR = 0.04;
const HIGH_FREQUENCY_GAIN = 2.6;
const ATTACK = 0.95; // 상승은 빠르게
const RELEASE = 0.32; // 하강은 느리게

/** 막대 index 가 차지하는 [start, end) 주파수 빈 범위 (로그 간격). */
export function logBandRange(index: number, binCount: number): [number, number] {
  if (binCount <= 2) {
    return [0, binCount];
  }
  const minBin = 1;
  const maxBin = binCount - 1;
  const minLog = Math.log(minBin);
  const maxLog = Math.log(maxBin);
  const startRatio = index / BAR_COUNT;
  const endRatio = (index + 1) / BAR_COUNT;
  const start = Math.max(
    minBin,
    Math.floor(Math.exp(minLog + (maxLog - minLog) * startRatio)),
  );
  const end = Math.min(
    binCount,
    Math.max(start + 1, Math.ceil(Math.exp(minLog + (maxLog - minLog) * endRatio))),
  );
  return [start, end];
}

/**
 * byte frequency data(bins, 0..255)를 BAR_COUNT 개 막대 높이(0..1)로 변환.
 * prev = 직전 프레임 높이 배열(스무딩 입력). 반환값을 다음 프레임의 prev 로 넘긴다.
 */
export function binsToBarHeights(bins: Uint8Array, prev: number[]): number[] {
  const out = new Array<number>(BAR_COUNT);
  for (let i = 0; i < BAR_COUNT; i++) {
    const [start, end] = logBandRange(i, bins.length);
    let sum = 0;
    for (let j = start; j < end; j++) sum += bins[j];

    const bandPosition = i / Math.max(1, BAR_COUNT - 1);
    const bandGain = 1 + bandPosition * HIGH_FREQUENCY_GAIN;
    const avg = (sum / Math.max(1, end - start) / 255) * bandGain;
    const gated = Math.max(0, avg - NOISE_FLOOR) / (1 - NOISE_FLOOR);
    const target = Math.min(1, Math.pow(gated, RESPONSE_GAMMA) * PEAK_GAIN);

    const previous = prev[i] ?? 0;
    const k = target > previous ? ATTACK : RELEASE;
    out[i] = previous + (target - previous) * k;
  }
  return out;
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run (in `web/`):
```bash
pnpm test:unit
```
Expected: PASS — `5 passed` (binsToBarHeights 3 + logBandRange 2).

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/spectrum.ts web/src/lib/spectrum.test.ts
git rm --cached web/src/setup-check.test.ts 2>/dev/null || true
git commit -m "feat(eq): binsToBarHeights spectrum→bars pure transform + tests"
```

---

## Task 3: 캡처 레이어 — `tidal-player.ts`

**Files:**
- Modify: `web/src/lib/tidal-player.ts`

audio element를 1회 `createMediaElementSource → AnalyserNode → destination`으로 라우팅하고 analyser를 export한다. Web Audio는 단위 테스트 환경(node)에 없으므로 **빌드(타입체크) + 수동**으로 검증(spec §6).

- [ ] **Step 1: 모듈 상태 + `ensureAnalyser` + `getTidalAnalyser` 추가**

Modify `web/src/lib/tidal-player.ts` — `loadedTidalId` 선언([tidal-player.ts:18](../../../web/src/lib/tidal-player.ts#L18)) 아래(또는 `streamUrl` 함수 위)에 추가:
```ts
// ── Web Audio 캡처 (비주얼 이퀄라이저용) ──────────────────
// audioEl 을 1회만 그래프로 라우팅한다(createMediaElementSource 는 element당 1회).
let audioCtx: AudioContext | null = null;
let analyserNode: AnalyserNode | null = null;

// loadAndPlay / resumePlayback (유저 제스처 경로) 첫머리에서 매번 호출.
// 그래프가 한번 생기면 audioEl 의 모든 출력이 영구히 그래프 경유 →
// destination 연결 필수(안 하면 무음). 실패해도 재생은 막지 않는다(EQ만 생략).
function ensureAnalyser(): void {
  try {
    const el = ensureAudio();
    if (!audioCtx) {
      type WindowWithWebkit = Window & {
        webkitAudioContext?: typeof AudioContext;
      };
      const Ctx =
        window.AudioContext ?? (window as WindowWithWebkit).webkitAudioContext;
      if (!Ctx) return; // Web Audio 미지원 → EQ만 생략
      audioCtx = new Ctx();
      const srcNode = audioCtx.createMediaElementSource(el); // element당 1회
      analyserNode = audioCtx.createAnalyser();
      analyserNode.fftSize = 256; // frequencyBinCount = 128
      analyserNode.smoothingTimeConstant = 0; // 스무딩은 컴포넌트가 직접
      srcNode.connect(analyserNode);
      analyserNode.connect(audioCtx.destination); // 필수
    }
    if (audioCtx.state === "suspended") void audioCtx.resume();
  } catch {
    audioCtx = null;
    analyserNode = null;
  }
}

export function getTidalAnalyser(): AnalyserNode | null {
  return analyserNode;
}
```

- [ ] **Step 2: `loadAndPlay`에서 호출**

Modify `loadAndPlay` ([tidal-player.ts:118-125](../../../web/src/lib/tidal-player.ts#L118-L125)) — `const el = ensureAudio();` 다음 줄에 `ensureAnalyser();` 추가:
```ts
export async function loadAndPlay(tidalTrackId: string): Promise<void> {
  const el = ensureAudio();
  ensureAnalyser();
  loadedTidalId = tidalTrackId;
  usePlayerStore.setState({ position: 0, durationSec: 0, isPreview: false });
  el.src = streamUrl(tidalTrackId);
  el.load();
  await el.play();
}
```

- [ ] **Step 3: `resumePlayback`에서 호출**

Modify `resumePlayback` ([tidal-player.ts:134-137](../../../web/src/lib/tidal-player.ts#L134-L137)):
```ts
export async function resumePlayback(): Promise<void> {
  const el = ensureAudio();
  ensureAnalyser();
  await el.play();
}
```

- [ ] **Step 4: 빌드(타입체크) 통과 확인**

Run (in `web/`):
```bash
pnpm build
```
Expected: 빌드 성공 (타입 에러 없음). `getTidalAnalyser`/`ensureAnalyser` 타입 OK, `WindowWithWebkit` 캐스트 OK.

> 자동 테스트 없음 — Web Audio가 node 테스트 환경에 없어 spec §6대로 제외. Task 6 수동 verify에서 실제 동작 확인.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/tidal-player.ts
git commit -m "feat(eq): tap Tidal audio element via Web Audio AnalyserNode"
```

---

## Task 4: 반응형 `activePlatform` — store + facade

**Files:**
- Modify: `web/src/store/player.ts`
- Test: `web/src/store/player.test.ts`
- Modify: `web/src/lib/player.ts`

EQ 표시 조건(`activePlatform === "tidal"`)을 위한 반응형 신호. facade `playOn`이 `active`를 할당하는 유일한 지점에서 store에도 기록. 타입 순환 회피 위해 store는 로컬 유니온 사용.

- [ ] **Step 1: store 실패 테스트 작성**

Create `web/src/store/player.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { usePlayerStore } from "./player";

describe("player store activePlatform", () => {
  it("기본값은 null", () => {
    expect(usePlayerStore.getState().activePlatform).toBeNull();
  });

  it("reset() 은 activePlatform 을 null 로 되돌린다", () => {
    usePlayerStore.setState({ activePlatform: "tidal" });
    expect(usePlayerStore.getState().activePlatform).toBe("tidal");
    usePlayerStore.getState().reset();
    expect(usePlayerStore.getState().activePlatform).toBeNull();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run (in `web/`):
```bash
pnpm test:unit
```
Expected: FAIL — `activePlatform` 이 PlayerState 에 없어 타입/런타임 에러(또는 `undefined` → toBeNull 실패).

- [ ] **Step 3: store에 `activePlatform` 추가**

Modify `web/src/store/player.ts`:

(a) `RepeatMode` 타입 선언([store/player.ts:16](../../../web/src/store/player.ts#L16)) 아래에 로컬 유니온 추가:
```ts
export type RepeatMode = "off" | "all" | "one";

// 현재 소리내는 플랫폼. lib/player.ts 의 Platform 과 값 동일하나, store→facade
// import 순환을 피하려고 로컬에 둔다.
export type ActivePlatform = "tidal" | "spotify" | "youtube";
```

(b) `PlayerState`의 `isPlaying: boolean;` 아래에 필드 추가:
```ts
  isPlaying: boolean;
  activePlatform: ActivePlatform | null;
```

(c) 초기 상태 `isPlaying: false,` 아래에 추가:
```ts
  isPlaying: false,
  activePlatform: null,
```

(d) `reset()` set 객체에 추가:
```ts
  reset: () =>
    set({
      queue: [],
      currentIdx: 0,
      isPlaying: false,
      activePlatform: null,
      position: 0,
      durationSec: 0,
    }),
```

- [ ] **Step 4: 테스트 통과 확인**

Run (in `web/`):
```bash
pnpm test:unit
```
Expected: PASS — store 테스트 2개 통과 (전체 7 passed).

- [ ] **Step 5: facade `playOn`에서 store 기록**

Modify `web/src/lib/player.ts` `playOn` ([player.ts:262-263](../../../web/src/lib/player.ts#L262-L263)) — `active = platform;` 다음 줄에 추가:
```ts
  active = platform;
  usePlayerStore.setState({ activePlatform: platform });
  for (const p of FALLBACK_ORDER) PLAYERS[p].setActive(p === platform);
```
(`usePlayerStore`는 이미 [player.ts:4](../../../web/src/lib/player.ts#L4)에서 import됨. `platform: Platform`과 store의 `ActivePlatform`은 값 동일이라 할당 OK.)

- [ ] **Step 6: 빌드 통과 확인**

Run (in `web/`):
```bash
pnpm build
```
Expected: 빌드 성공.

- [ ] **Step 7: Commit**

```bash
git add web/src/store/player.ts web/src/store/player.test.ts web/src/lib/player.ts
git commit -m "feat(eq): reactive activePlatform in store, written by facade playOn"
```

---

## Task 5: `SpectrumEqualizer.tsx` + PlayerBar 마운트

**Files:**
- Create: `web/src/components/player/SpectrumEqualizer.tsx`
- Modify: `web/src/components/player/PlayerBar.tsx`

`activePlatform === "tidal" && isPlaying`일 때만 rAF로 막대 율동, 그 외엔 `return null`(숨김). 48 막대, `--mrms-rust`, PlayerBar 상단 `bottom-full`. React/rAF/Web Audio 조합이라 자동 테스트 없음 — 빌드 + 수동(Task 6).

- [ ] **Step 1: `SpectrumEqualizer.tsx` 작성**

Create `web/src/components/player/SpectrumEqualizer.tsx`:
```tsx
"use client";

import { useEffect, useRef } from "react";

import { BAR_COUNT, binsToBarHeights } from "@/lib/spectrum";
import { getTidalAnalyser } from "@/lib/tidal-player";
import { usePlayerStore } from "@/store/player";

const MIN_VISIBLE_PCT = 2;

export function SpectrumEqualizer() {
  const activePlatform = usePlayerStore((s) => s.activePlatform);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const show = activePlatform === "tidal" && isPlaying;

  const barRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const heightsRef = useRef<number[]>(
    Array.from({ length: BAR_COUNT }, () => 0),
  );

  useEffect(() => {
    if (!show) return;
    const analyser = getTidalAnalyser();
    if (!analyser) return;

    const bins = new Uint8Array(analyser.frequencyBinCount);
    let frameId = 0;
    let stopped = false;

    const tick = () => {
      if (stopped) return;
      analyser.getByteFrequencyData(bins);
      const heights = binsToBarHeights(bins, heightsRef.current);
      heightsRef.current = heights;
      for (let i = 0; i < BAR_COUNT; i++) {
        const el = barRefs.current[i];
        if (el) {
          el.style.height = `${Math.max(MIN_VISIBLE_PCT, heights[i] * 100)}%`;
        }
      }
      frameId = requestAnimationFrame(tick);
    };

    // 백그라운드 탭이면 정지, 복귀하면 재가동(cancel 만이 아니라 re-arm).
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        cancelAnimationFrame(frameId);
      } else if (!stopped) {
        frameId = requestAnimationFrame(tick);
      }
    };

    frameId = requestAnimationFrame(tick);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stopped = true;
      cancelAnimationFrame(frameId);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [show]);

  if (!show) return null;

  return (
    <div
      aria-hidden
      className="absolute bottom-full left-0 right-0 h-10 flex items-end justify-center gap-[2px] px-4 md:px-14 pointer-events-none"
    >
      {Array.from({ length: BAR_COUNT }, (_, i) => (
        <span
          key={i}
          ref={(node) => {
            barRefs.current[i] = node;
          }}
          className="block flex-1 max-w-[10px] rounded-t-[1px] bg-[var(--mrms-rust)]"
          style={{ height: `${MIN_VISIBLE_PCT}%` }}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: PlayerBar에 마운트 (배너 앞)**

Modify `web/src/components/player/PlayerBar.tsx`:

(a) import 추가 (`QueueDrawer` import [PlayerBar.tsx:32](../../../web/src/components/player/PlayerBar.tsx#L32) 아래):
```tsx
import { QueueDrawer } from "./QueueDrawer";
import { SpectrumEqualizer } from "./SpectrumEqualizer";
```

(b) 고정 바 `<div>` 여는 태그([PlayerBar.tsx:385](../../../web/src/components/player/PlayerBar.tsx#L385)) **바로 다음**, error 배너 블록 **앞**에 마운트(stacking: 이른 형제 = 배너 아래로 그려짐):
```tsx
    <div className="fixed bottom-0 left-0 md:left-60 right-0 bg-[var(--mrms-ink)] text-[var(--mrms-paper)] px-4 md:px-14 py-2.5 md:py-3 border-t border-[var(--mrms-rust)] z-40">
      {/* spectrum equalizer — Tidal 재생 중에만 표시, 배너보다 아래 레이어 */}
      <SpectrumEqualizer />
      {/* error / loading row */}
      {errorMsg && (
```

- [ ] **Step 3: 빌드 통과 확인**

Run (in `web/`):
```bash
pnpm build
```
Expected: 빌드 성공 (타입/lint 에러 없음).

- [ ] **Step 4: 단위 테스트 회귀 확인**

Run (in `web/`):
```bash
pnpm test:unit
```
Expected: PASS — 기존 7개 그대로 통과(컴포넌트는 단위 테스트 없음).

- [ ] **Step 5: Commit**

```bash
git add web/src/components/player/SpectrumEqualizer.tsx web/src/components/player/PlayerBar.tsx
git commit -m "feat(eq): SpectrumEqualizer bars above PlayerBar (Tidal-only)"
```

---

## Task 6: 수동 verify (회귀 포함)

**Files:** 없음 (실행/관찰만).

자동 테스트로 못 잡는 Web Audio·rAF·레이아웃·회귀를 사람이 확인한다. dev 서버: `web/`에서 `pnpm dev` (Tidal 연동된 계정 필요).

- [ ] **Step 1: Tidal 재생 → 막대 율동**

Tidal이 primary인 계정으로 로그인 → 트랙 재생. 기대: PlayerBar 상단 엣지에 rust 막대 48개가 음악 주파수에 맞춰 율동.

- [ ] **Step 2: 실제 샘플(taint 없음) 확인**

브라우저 콘솔에서 1회:
```js
// 재생 중 — getByteFrequencyData 가 전부 0이 아니어야 함(same-origin/taint 경계 실증)
// (개발 편의: 콘솔에서 직접 분석기에 접근할 수 없으면, 막대가 실제로 움직이는지로 갈음)
```
기대: 막대가 0에 멈춰있지 않고 실제로 움직임(bins 비-제로). 만약 막대가 전혀 안 움직이면 → cross-origin taint 의심(`NEXT_PUBLIC_API_BASE`가 페이지와 다른 오리진인지 확인, spec §1).

- [ ] **Step 3: 숨김 동작**

일시정지 → 막대 영역 사라짐(PlayerBar만). 다시 재생 → 즉시 율동 재개. Spotify/YouTube 트랙으로 전환 → 막대 영역 사라짐.

- [ ] **Step 4: 기존 재생 회귀 없음**

Web Audio 그래프 라우팅 후에도 다음이 정상인지 확인:
- 재생/일시정지 토글
- 볼륨 슬라이더(소리 크기 변함 — 막대도 같이 작아지는 건 의도된 동작)
- 곡 전환(next/prev), seek(진행바 드래그)
- 자동 다음 곡(트랙 끝까지 재생 시)

- [ ] **Step 5: (선택) Safari 확인**

Safari에서 재생 → 막대 율동(webkit 폴백). 미동작이어도 재생 자체는 정상이어야 함(try/catch).

- [ ] **Step 6: 회귀 확인되면 완료 보고**

모든 항목 OK면 구현 완료. 문제 발견 시 해당 Task로 돌아가 수정.

---

## Self-Review (작성자 체크)

**Spec coverage:**
- §1 캡처(createMediaElementSource·webkit·destination·try/catch) → Task 3 ✅
- §1 same-origin 전제 → Task 6 Step 2 (bins 비-제로 확인) ✅
- §3.2 ensureAnalyser/getTidalAnalyser/두 진입점 → Task 3 ✅
- §3.3 store activePlatform(로컬 유니온)·playOn 기록·reset null → Task 4 ✅
- §3.4 컴포넌트 rAF·재가동 계약·표시숨김·binsToBarHeights → Task 2(함수) + Task 5(컴포넌트) ✅
- §3.5 48막대·rust·bottom-full·stacking → Task 5 ✅
- §3.6 배너 앞 마운트 → Task 5 Step 2 ✅
- §6 단위(순수함수)·수동 verify → Task 2 + Task 6 ✅
- §7 Vitest 셋업 → Task 1 ✅

**Placeholder scan:** 모든 step에 실제 코드/명령/기대값 명시. TBD/TODO 없음. ✅

**Type consistency:** `BAR_COUNT`/`binsToBarHeights`/`logBandRange`(Task 2) = Task 5 import 일치. `getTidalAnalyser`(Task 3) = Task 5 import 일치. `ActivePlatform`(Task 4 store) = `activePlatform` 필드/`reset` 일치. `frequencyBinCount`(Web Audio 표준, fftSize=256 → 128)와 `binsToBarHeights`의 `bins.length` 사용 일치. ✅

## 관련 문서

- [spec](2026-06-14-tidal-spectrum-equalizer-design.md) · [ADR-004](../../decisions/ADR-004-tidal-spectrum-equalizer.md)
- 코드: `web/src/lib/tidal-player.ts`, `web/src/lib/player.ts`, `web/src/store/player.ts`, `web/src/components/player/PlayerBar.tsx`
