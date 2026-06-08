import { test, expect } from "@playwright/test";

test.describe("Components — Pagination detail", () => {
  test("renders breadcrumb, header, and variant cards", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const res = await page.goto("/components/pagination");
    expect(res?.status(), "status").toBeLessThan(400);
    await expect(
      page.getByRole("heading", { name: "Pagination" })
    ).toBeVisible();
    // Variant card titles
    await expect(page.getByText("Basic", { exact: true }).first()).toBeVisible();
    await expect(
      page.getByText("Interactive", { exact: true }).first()
    ).toBeVisible();
    await expect(
      page.getByText("Page jump", { exact: true }).first()
    ).toBeVisible();
    expect(errors, "pageerrors").toEqual([]);
  });

  test("Interactive variant: clicking page 3 makes it active", async ({
    page,
  }) => {
    await page.goto("/components/pagination");
    const scope = page.locator('[data-testid="pagination-interactive"]');
    await expect(scope).toBeVisible();
    // Click page "3"
    const page3 = scope.getByRole("link", { name: "3" });
    await page3.click();
    // Page 3 should now be active
    await expect(page3).toHaveAttribute("aria-current", "page");
  });

  test("catalog Pagination card links to the detail page", async ({ page }) => {
    await page.goto("/components");
    await page.locator('a[href="/components/pagination"]').first().click();
    await expect(page).toHaveURL(/\/components\/pagination$/);
    await expect(
      page.getByRole("heading", { name: "Pagination" })
    ).toBeVisible();
  });
});
