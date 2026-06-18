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
