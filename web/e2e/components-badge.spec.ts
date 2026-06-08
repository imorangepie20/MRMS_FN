import { test, expect } from "@playwright/test";

test.describe("Components — Badge detail", () => {
  test("renders breadcrumb, header, and variant cards", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const res = await page.goto("/components/badge");
    expect(res?.status(), "status").toBeLessThan(400);
    await expect(page.getByRole("heading", { name: "Badge" })).toBeVisible();
    // Check a selection of variant card titles
    await expect(page.getByText("Default", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Removable", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Colored", { exact: true }).first()).toBeVisible();
    expect(errors, "pageerrors").toEqual([]);
  });

  test("Removable variant — clicking Remove removes a badge", async ({ page }) => {
    await page.goto("/components/badge");
    // The first removable badge is "React"
    await expect(page.getByText("React").first()).toBeVisible();
    // Click the first Remove button
    await page.getByRole("button", { name: "Remove" }).first().click();
    // "React" badge should no longer be visible
    await expect(page.getByText("React")).not.toBeVisible();
  });

  test("catalog Badge card links to the detail page", async ({ page }) => {
    await page.goto("/components");
    await page.getByRole("link", { name: /Badge/i }).first().click();
    await expect(page).toHaveURL(/\/components\/badge$/);
    await expect(page.getByRole("heading", { name: "Badge" })).toBeVisible();
  });
});
