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
