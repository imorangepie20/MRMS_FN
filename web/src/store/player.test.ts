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
