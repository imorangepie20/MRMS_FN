import { test, expect } from "@playwright/test";

test.describe("Components — Dropdown Menu detail", () => {
  test("renders breadcrumb, header, and variant cards", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const res = await page.goto("/components/dropdown-menu");
    expect(res?.status(), "status").toBeLessThan(400);
    await expect(page.getByRole("heading", { name: "Dropdown Menu" })).toBeVisible();
    // Check a selection of variant card titles
    await expect(page.getByText("Basic", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Account menu", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("With submenu", { exact: true }).first()).toBeVisible();
    expect(errors, "pageerrors").toEqual([]);
  });

  test("Basic variant — clicking trigger shows menu items", async ({ page }) => {
    await page.goto("/components/dropdown-menu");
    // Find the Basic card and click its trigger button
    const basicCard = page.getByText("Basic", { exact: true }).first().locator("../..");
    await basicCard.getByRole("button", { name: "Open Menu" }).first().click();
    // The menu should reveal "New Tab"
    await expect(page.getByRole("menuitem", { name: "New Tab" }).first()).toBeVisible();
  });

  test("Account menu variant — avatar trigger opens menu", async ({ page }) => {
    await page.goto("/components/dropdown-menu");
    await page.getByRole("button", { name: "Open account menu" }).click();
    // The menu should reveal "Log out"
    await expect(page.getByRole("menuitem", { name: /log out/i }).first()).toBeVisible();
  });

  test("catalog Dropdown Menu card links to the detail page", async ({ page }) => {
    await page.goto("/components");
    await page.locator('a[href="/components/dropdown-menu"]').first().click();
    await expect(page).toHaveURL(/\/components\/dropdown-menu$/);
    await expect(page.getByRole("heading", { name: "Dropdown Menu" })).toBeVisible();
  });
});
