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
