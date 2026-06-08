import { test, expect } from "@playwright/test";

test.describe("Components — Breadcrumb detail", () => {
  test("renders breadcrumb, header, and variant cards", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const res = await page.goto("/components/breadcrumb");
    expect(res?.status(), "status").toBeLessThan(400);
    await expect(page.getByRole("heading", { name: "Breadcrumb" })).toBeVisible();
    // Check variant card titles
    await expect(page.getByText("Default", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Slash separator", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("With dropdown", { exact: true }).first()).toBeVisible();
    expect(errors, "pageerrors").toEqual([]);
  });

  test("With dropdown variant — clicking ellipsis trigger reveals menu items", async ({ page }) => {
    await page.goto("/components/breadcrumb");
    // Click the toggle menu trigger inside the With dropdown variant card
    await page.getByRole("button", { name: "Toggle menu" }).first().click();
    // Menu item "Documentation" should become visible
    await expect(page.getByRole("menuitem", { name: "Documentation" }).first()).toBeVisible();
  });

  test("catalog Breadcrumb card links to the detail page", async ({ page }) => {
    await page.goto("/components");
    await page.getByRole("link", { name: /Breadcrumb/i }).first().click();
    await expect(page).toHaveURL(/\/components\/breadcrumb$/);
    await expect(page.getByRole("heading", { name: "Breadcrumb" })).toBeVisible();
  });
});
