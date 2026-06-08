import { test, expect } from "@playwright/test";

test.describe("Components — Checkbox detail", () => {
  test("renders breadcrumb, header, and variant cards", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const res = await page.goto("/components/checkbox");
    expect(res?.status(), "status").toBeLessThan(400);
    await expect(page.getByRole("heading", { name: "Checkbox" })).toBeVisible();
    // Check variant card titles
    await expect(page.getByText("Basic", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Select all", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Settings list", { exact: true }).first()).toBeVisible();
    expect(errors, "pageerrors").toEqual([]);
  });

  test("Select all (permissions) — clicking parent checks all children", async ({ page }) => {
    await page.goto("/components/checkbox");

    // Scope to the select-all-perms card
    const card = page.locator('[data-testid="select-all-perms"]');
    await expect(card).toBeVisible();

    // Click the "Select all" parent checkbox
    const selectAll = card.getByRole("checkbox", { name: "Select all" });
    await selectAll.click();

    // Assert the "Write" child checkbox is now checked
    await expect(card.getByRole("checkbox", { name: "Write" })).toBeChecked();
    // Also assert the other children are checked
    await expect(card.getByRole("checkbox", { name: "Read" })).toBeChecked();
    await expect(card.getByRole("checkbox", { name: "Delete" })).toBeChecked();
  });

  test("catalog Checkbox card links to the detail page", async ({ page }) => {
    await page.goto("/components");
    await page.locator('a[href="/components/checkbox"]').first().click();
    await expect(page).toHaveURL(/\/components\/checkbox$/);
    await expect(page.getByRole("heading", { name: "Checkbox" })).toBeVisible();
  });
});
