import { test, expect } from "@playwright/test";

test.describe("Components — Data Table detail", () => {
  test("renders breadcrumb, header, variant names, and seeded email", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const res = await page.goto("/components/data-table");
    expect(res?.status(), "status").toBeLessThan(400);
    await expect(page.getByRole("heading", { name: "Data Table" })).toBeVisible();
    await expect(page.getByText("Basic with selection", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Expandable rows", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("With action buttons", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("ken99@example.com").first()).toBeVisible();
    expect(errors, "pageerrors").toEqual([]);
  });

  test("Basic with selection — select-all updates footer count", async ({ page }) => {
    await page.goto("/components/data-table");

    const container = page.locator('[data-testid="dt-basic"]');
    await expect(container).toBeVisible();

    // Click the header select-all checkbox
    const selectAll = container.getByRole("checkbox", { name: "Select all" });
    await selectAll.click();

    // Footer should now report 5 of 5 rows selected
    await expect(container.getByText(/5 of 5 row\(s\) selected/)).toBeVisible();
  });

  test("catalog Data Table card links to the detail page", async ({ page }) => {
    await page.goto("/components");
    await page.locator('a[href="/components/data-table"]').first().click();
    await expect(page).toHaveURL(/\/components\/data-table$/);
  });
});
