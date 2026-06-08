import { test, expect } from "@playwright/test";

test.describe("Components — Progress detail", () => {
  test("renders breadcrumb, header, and variant cards", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const res = await page.goto("/components/progress");
    expect(res?.status(), "status").toBeLessThan(400);
    await expect(page.getByRole("heading", { name: "Progress" })).toBeVisible();
    // Check a selection of variant card titles
    await expect(page.getByText("Basic", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("System metrics", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Circular", { exact: true }).first()).toBeVisible();
    // At least one progressbar role should be visible
    await expect(page.getByRole("progressbar").first()).toBeVisible();
    expect(errors, "pageerrors").toEqual([]);
  });

  test("Interactive upload — clicking Upload completes to 100%", async ({ page }) => {
    await page.goto("/components/progress");
    const upload = page.locator('[data-testid="progress-upload"]');
    await upload.getByRole("button", { name: "Upload" }).click();
    await expect(upload.getByText("Completed")).toBeVisible({ timeout: 5000 });
  });

  test("catalog Progress card links to the detail page", async ({ page }) => {
    await page.goto("/components");
    await page.locator('a[href="/components/progress"]').first().click();
    await expect(page).toHaveURL(/\/components\/progress$/);
    await expect(page.getByRole("heading", { name: "Progress" })).toBeVisible();
  });
});
