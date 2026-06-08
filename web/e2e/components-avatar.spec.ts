import { test, expect } from "@playwright/test";

test.describe("Components — Avatar detail", () => {
  test("renders breadcrumb, header, and variant cards", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const res = await page.goto("/components/avatar");
    expect(res?.status(), "status").toBeLessThan(400);
    await expect(page.getByRole("heading", { name: "Avatar" })).toBeVisible();
    // Check a selection of variant card titles
    await expect(page.getByText("Avatar group", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("With tooltip", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Dropdown menu", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("With popover", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Loading state", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Advanced composition", { exact: true }).first()).toBeVisible();
    expect(errors, "pageerrors").toEqual([]);
  });

  test("Dropdown menu variant — clicking avatar trigger shows menu items", async ({ page }) => {
    await page.goto("/components/avatar");
    await page.getByRole("button", { name: "Open user menu" }).click();
    // The menu should reveal "Log out"
    await expect(page.getByRole("menuitem", { name: /log out/i }).first()).toBeVisible();
  });

  test("catalog Avatar card links to the detail page", async ({ page }) => {
    await page.goto("/components");
    await page.getByRole("link", { name: /Avatar/i }).first().click();
    await expect(page).toHaveURL(/\/components\/avatar$/);
    await expect(page.getByRole("heading", { name: "Avatar" })).toBeVisible();
  });
});
