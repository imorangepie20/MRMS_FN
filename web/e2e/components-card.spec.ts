import { test, expect } from "@playwright/test";

test.describe("Components — Card detail", () => {
  test("renders breadcrumb, header, and variant cards", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const res = await page.goto("/components/card");
    expect(res?.status(), "status").toBeLessThan(400);
    await expect(page.getByRole("heading", { name: "Card" })).toBeVisible();
    // Check a selection of variant card titles
    await expect(page.getByText("Standard", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Tabbed", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Cookie consent", { exact: true }).first()).toBeVisible();
    // Check demo content
    await expect(page.getByText("Card Title").first()).toBeVisible();
    await expect(page.getByText("$15,231.89").first()).toBeVisible();
    expect(errors, "pageerrors").toEqual([]);
  });

  test("Tabbed variant — clicking Analytics tab shows analytics content", async ({ page }) => {
    await page.goto("/components/card");
    // Click the Analytics tab
    await page.getByRole("tab", { name: "Analytics" }).click();
    // Assert analytics-only content is visible
    await expect(
      page.getByText("Total page views this month").first()
    ).toBeVisible();
  });

  test("catalog Card card links to the detail page", async ({ page }) => {
    await page.goto("/components");
    await page.locator('a[href="/components/card"]').first().click();
    await expect(page).toHaveURL(/\/components\/card$/);
    await expect(page.getByRole("heading", { name: "Card" })).toBeVisible();
  });
});
