import { test, expect } from "@playwright/test";

test.describe("Components — Radio Group detail", () => {
  test("renders breadcrumb, header, and variant cards", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const res = await page.goto("/components/radio-group");
    expect(res?.status(), "status").toBeLessThan(400);
    await expect(page.getByRole("heading", { name: "Radio Group" })).toBeVisible();
    // Check variant card titles
    await expect(page.getByText("Basic", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Card", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Account type", { exact: true }).first()).toBeVisible();
    expect(errors, "pageerrors").toEqual([]);
  });

  test("Basic variant — clicking Compact radio selects it", async ({ page }) => {
    await page.goto("/components/radio-group");

    // Scope to the Basic variant via data-testid
    const card = page.locator('[data-testid="radio-basic"]');
    await expect(card).toBeVisible();

    // Click the "Compact" radio
    const compact = card.getByRole("radio", { name: "Compact" });
    await compact.click();

    // Assert it becomes checked
    await expect(compact).toBeChecked();
  });

  test("catalog Radio Group card links to the detail page", async ({ page }) => {
    await page.goto("/components");
    await page.locator('a[href="/components/radio-group"]').first().click();
    await expect(page).toHaveURL(/\/components\/radio-group$/);
    await expect(page.getByRole("heading", { name: "Radio Group" })).toBeVisible();
  });
});
