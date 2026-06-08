import { test, expect } from "@playwright/test";

test.describe("Components — Menubar detail", () => {
  test("renders breadcrumb, header, and menubar triggers", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const res = await page.goto("/components/menubar");
    expect(res?.status(), "status").toBeLessThan(400);
    await expect(page.getByRole("heading", { name: "Menubar" })).toBeVisible();
    await expect(page.getByText("File", { exact: true })).toBeVisible();
    await expect(page.getByText("Edit", { exact: true })).toBeVisible();
    await expect(page.getByText("View", { exact: true })).toBeVisible();
    await expect(page.getByText("Profiles", { exact: true })).toBeVisible();
    expect(errors, "pageerrors").toEqual([]);
  });

  test("clicking File trigger opens menu with New Tab item (no crash)", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/components/menubar");

    // Click the File trigger — Base UI Menubar triggers have role="menuitem"
    await page.getByText("File", { exact: true }).click();

    // Menu items should appear
    await expect(page.getByText("New Tab")).toBeVisible();

    expect(errors, "pageerrors").toEqual([]);
  });

  test("catalog Menubar card links to the detail page", async ({ page }) => {
    await page.goto("/components");
    await page.locator('a[href="/components/menubar"]').first().click();
    await expect(page).toHaveURL(/\/components\/menubar$/);
    await expect(page.getByRole("heading", { name: "Menubar" })).toBeVisible();
  });
});
