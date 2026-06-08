import { test, expect } from "@playwright/test";

test.describe("Components — Empty detail", () => {
  test("renders breadcrumb, header, and variant cards", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const res = await page.goto("/components/empty");
    expect(res?.status(), "status").toBeLessThan(400);
    await expect(page.getByRole("heading", { name: "Empty" })).toBeVisible();
    // Check variant card titles
    await expect(page.getByText("No projects", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("404 — Not Found", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("No connection (offline)", { exact: true }).first()).toBeVisible();
    // Check demo content strings
    await expect(page.getByText("No projects yet").first()).toBeVisible();
    await expect(page.getByText("You're offline").first()).toBeVisible();
    expect(errors, "pageerrors").toEqual([]);
  });

  test("No results (search) variant — clear search interaction", async ({ page }) => {
    await page.goto("/components/empty");
    const searchVariant = page.getByTestId("empty-search");
    // Initial state: "No designers found" should be visible
    await expect(searchVariant.getByText("No designers found")).toBeVisible();
    // Click "Clear search"
    await searchVariant.getByRole("button", { name: "Clear search" }).click();
    // After clearing: "No designers found" should no longer be visible
    await expect(searchVariant.getByText("No designers found")).not.toBeVisible();
    // Reset state should be shown
    await expect(searchVariant.getByText("Search anyone")).toBeVisible();
  });

  test("catalog Empty card links to the detail page", async ({ page }) => {
    await page.goto("/components");
    await page.locator('a[href="/components/empty"]').first().click();
    await expect(page).toHaveURL(/\/components\/empty$/);
    await expect(page.getByRole("heading", { name: "Empty" })).toBeVisible();
  });
});
