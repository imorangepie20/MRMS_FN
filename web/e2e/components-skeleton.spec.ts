import { test, expect } from "@playwright/test";

test.describe("Components — Skeleton detail", () => {
  test("renders breadcrumb, header, and all 7 variant cards", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const res = await page.goto("/components/skeleton");
    expect(res?.status(), "status").toBeLessThan(400);
    await expect(page.getByRole("heading", { name: "Skeleton" })).toBeVisible();
    // Variant titles
    await expect(page.getByText("Basic", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Card", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Image grid", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Text lines", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("List", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Table", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Profile", { exact: true }).first()).toBeVisible();
    expect(errors, "pageerrors").toEqual([]);
  });

  test("skeleton elements are present in the page", async ({ page }) => {
    await page.goto("/components/skeleton");
    await expect(page.locator('[data-slot="skeleton"]').first()).toBeVisible();
    expect(await page.locator('[data-slot="skeleton"]').count()).toBeGreaterThan(10);
  });

  test("catalog Skeleton card links to the detail page", async ({ page }) => {
    await page.goto("/components");
    await page.locator('a[href="/components/skeleton"]').first().click();
    await expect(page).toHaveURL(/\/components\/skeleton$/);
    await expect(page.getByRole("heading", { name: "Skeleton" })).toBeVisible();
  });
});
