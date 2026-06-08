import { test, expect } from "@playwright/test";

// E.0+1+2 smoke — / 가 /mrt로 redirect되는지만 확인 (API 없이도 동작).
// /mrt 페이지 자체 렌더링은 API 필요해서 별도 e2e 미작성 (Task 10 수동 검증).
// 기존 SDTPL 더미 라우트 e2e는 우리 라우트와 무관해서 deprecated.

test("home redirects to /mrt", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/mrt$/);
});
