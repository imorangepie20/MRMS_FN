import { test, expect } from "@playwright/test";

test.describe("Components — Drawer detail", () => {
  test("renders breadcrumb, header, and variant cards", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const res = await page.goto("/components/drawer");
    expect(res?.status(), "status").toBeLessThan(400);
    await expect(page.getByRole("heading", { name: "Drawer" })).toBeVisible();
    await expect(page.getByText("Basic (bottom)", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Cookie settings", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Add Task", { exact: true }).first()).toBeVisible();
    expect(errors, "pageerrors").toEqual([]);
  });

  test("Basic (bottom) variant opens and closes", async ({ page }) => {
    await page.goto("/components/drawer");
    await page.getByRole("button", { name: "Open Drawer" }).first().click();
    await expect(page.getByRole("heading", { name: "Move Goal" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Submit" })).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).first().click();
    await expect(page.getByRole("heading", { name: "Move Goal" })).not.toBeVisible();
  });

  test("catalog Drawer card links to the detail page", async ({ page }) => {
    await page.goto("/components");
    await page.locator('a[href="/components/drawer"]').first().click();
    await expect(page).toHaveURL(/\/components\/drawer/);
    await expect(page.getByRole("heading", { name: "Drawer" })).toBeVisible();
  });
});
