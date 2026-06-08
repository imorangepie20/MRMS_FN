import { test, expect } from "@playwright/test";

test.describe("Components — Button detail", () => {
  test("renders breadcrumb, header, and variant cards", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const res = await page.goto("/components/button");
    expect(res?.status(), "status").toBeLessThan(400);
    await expect(page.getByRole("heading", { name: "Button" })).toBeVisible();
    // Check a selection of variant card titles
    await expect(page.getByText("Default", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Loading", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Split button", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Button group", { exact: true }).first()).toBeVisible();
    expect(errors, "pageerrors").toEqual([]);
  });

  test("Split button — clicking chevron opens dropdown with Export item", async ({ page }) => {
    await page.goto("/components/button");
    // Click the "More options" chevron trigger
    await page.getByRole("button", { name: "More options" }).click();
    // "Export" menu item should now be visible
    await expect(page.getByRole("menuitem", { name: "Export" })).toBeVisible();
  });

  test("catalog Button card links to the detail page", async ({ page }) => {
    await page.goto("/components");
    // Match the Button card that has 27 variants — avoid "Button Group"
    await page.getByRole("link", { name: /Button\b.*27|27.*Button/ }).first().click();
    await expect(page).toHaveURL(/\/components\/button$/);
    await expect(page.getByRole("heading", { name: "Button" })).toBeVisible();
  });
});
