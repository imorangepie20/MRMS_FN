import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // src 의 *.test.ts 만 단위 테스트로 실행한다.
    // Playwright e2e (e2e/*.spec.ts) 와 분리하기 위해 *.test.ts 만 포함.
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
