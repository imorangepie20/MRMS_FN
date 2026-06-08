import { test, expect } from "@playwright/test";

test.describe("Components — Context Menu detail", () => {
  test("renders breadcrumb, header, and trigger area", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const res = await page.goto("/components/context-menu");
    expect(res?.status(), "status").toBeLessThan(400);
    await expect(page.getByRole("heading", { name: "Context Menu" })).toBeVisible();
    await expect(page.getByText("Right click here")).toBeVisible();
    expect(errors, "pageerrors").toEqual([]);
  });

  test("right-click opens menu with expected items (no crash)", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/components/context-menu");

    // Right-click the trigger
    await page.getByText("Right click here").click({ button: "right" });

    // Menu items should appear
    await expect(page.getByText("Reload")).toBeVisible();
    await expect(page.getByText("Back")).toBeVisible();

    // Radio items (People section) should also be visible
    await expect(page.getByText("Pedro Duarte")).toBeVisible();

    expect(errors, "pageerrors").toEqual([]);
  });

  test("catalog Context Menu card links to the detail page", async ({ page }) => {
    await page.goto("/components");
    await page.locator('a[href="/components/context-menu"]').first().click();
    await expect(page).toHaveURL(/\/components\/context-menu$/);
    await expect(page.getByRole("heading", { name: "Context Menu" })).toBeVisible();
  });
});
