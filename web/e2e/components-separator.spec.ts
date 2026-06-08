import { test, expect } from "@playwright/test";

test.describe("Components — Separator detail", () => {
  test("renders breadcrumb, header, and variant cards", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const res = await page.goto("/components/separator");
    expect(res?.status(), "status").toBeLessThan(400);
    await expect(page.getByRole("heading", { name: "Separator" })).toBeVisible();
    // Check a selection of variant card titles
    await expect(page.getByText("Horizontal", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("With label (OR)", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Section divider", { exact: true }).first()).toBeVisible();
    // Check the "OR" label is rendered in the With label (OR) variant
    await expect(page.getByText("OR", { exact: true }).first()).toBeVisible();
    expect(errors, "pageerrors").toEqual([]);
  });

  test("separator elements are present in the page", async ({ page }) => {
    await page.goto("/components/separator");
    // The Separator component renders with data-slot="separator"
    await expect(
      page.locator('[data-slot="separator"]').first()
    ).toBeVisible();
  });

  test("catalog Separator card links to the detail page", async ({ page }) => {
    await page.goto("/components");
    await page.locator('a[href="/components/separator"]').first().click();
    await expect(page).toHaveURL(/\/components\/separator$/);
    await expect(
      page.getByRole("heading", { name: "Separator" })
    ).toBeVisible();
  });
});
