import { test, expect } from "@playwright/test";

test.describe("Components — Scroll Area detail", () => {
  test("renders breadcrumb, header, and all 6 variant cards", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const res = await page.goto("/components/scroll-area");
    expect(res?.status(), "status").toBeLessThan(400);
    await expect(page.getByRole("heading", { name: "Scroll Area" })).toBeVisible();
    // Variant titles
    await expect(page.getByText("Tags (vertical)", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Sticky header feed", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Horizontal cards", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("User list", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Horizontal avatars", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Chat messages", { exact: true }).first()).toBeVisible();
    expect(errors, "pageerrors").toEqual([]);
  });

  test("content check: tags list — first tag visible, last tag attached", async ({ page }) => {
    await page.goto("/components/scroll-area");
    // First tag should be visible in the viewport
    await expect(page.getByText("v1.2.0-beta.50").first()).toBeVisible();
    // Last tag exists in the DOM (may be scrolled out of view)
    await expect(page.getByText("v1.2.0-beta.1").first()).toBeAttached();
  });

  test("catalog Scroll Area card links to the detail page", async ({ page }) => {
    await page.goto("/components");
    await page.locator('a[href="/components/scroll-area"]').first().click();
    await expect(page).toHaveURL(/\/components\/scroll-area$/);
    await expect(page.getByRole("heading", { name: "Scroll Area" })).toBeVisible();
  });
});
