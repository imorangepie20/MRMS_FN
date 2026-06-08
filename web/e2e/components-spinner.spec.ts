import { test, expect } from "@playwright/test";

test.describe("Components — Spinner detail", () => {
  test("renders breadcrumb, header, and variant cards", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const res = await page.goto("/components/spinner");
    expect(res?.status(), "status").toBeLessThan(400);
    await expect(page.getByRole("heading", { name: "Spinner" })).toBeVisible();
    await expect(page.getByText("Basic", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Dots", { exact: true }).first()).toBeVisible();
    await expect(
      page.getByText("Payment processing", { exact: true }).first()
    ).toBeVisible();
    expect(errors, "pageerrors").toEqual([]);
  });

  test("spinner animation elements exist", async ({ page }) => {
    await page.goto("/components/spinner");
    expect(await page.locator(".animate-spin").count()).toBeGreaterThan(3);
  });

  test("Validating variant shows spinner on Send click", async ({ page }) => {
    await page.goto("/components/spinner");
    const container = page.locator('[data-testid="spinner-validate"]');
    await container.getByRole("button", { name: "Send" }).click();
    await expect(
      container.getByText("Validating…"),
      "Validating text"
    ).toBeVisible({ timeout: 3000 });
  });

  test("catalog Spinner card links to the detail page", async ({ page }) => {
    await page.goto("/components");
    await page.locator('a[href="/components/spinner"]').first().click();
    await expect(page).toHaveURL(/\/components\/spinner/);
    await expect(page.getByRole("heading", { name: "Spinner" })).toBeVisible();
  });
});
