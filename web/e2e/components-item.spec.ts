import { test, expect } from "@playwright/test";

test.describe("Components — Item detail", () => {
  test("renders breadcrumb, header, and variant cards", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const res = await page.goto("/components/item");
    expect(res?.status(), "status").toBeLessThan(400);
    await expect(page.getByRole("heading", { name: "Item" })).toBeVisible();
    // Variant card titles
    await expect(page.getByText("Basic", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Alert", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("User list", { exact: true }).first()).toBeVisible();
    // Demo content
    await expect(page.getByText("Security alert", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Emily Rose", { exact: true }).first()).toBeVisible();
    expect(errors, "pageerrors").toEqual([]);
  });

  test("Alert variant Review button is visible and clickable", async ({
    page,
  }) => {
    await page.goto("/components/item");
    const reviewBtn = page.getByRole("button", { name: "Review" }).first();
    await expect(reviewBtn).toBeVisible();
    await reviewBtn.click();
  });

  test("catalog Item card links to the detail page", async ({ page }) => {
    await page.goto("/components");
    await page.locator('a[href="/components/item"]').first().click();
    await expect(page).toHaveURL(/\/components\/item$/);
    await expect(page.getByRole("heading", { name: "Item" })).toBeVisible();
  });
});
