import { test, expect } from "@playwright/test";

test.describe("Components — Select detail", () => {
  test("renders breadcrumb, header, and variant cards", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const res = await page.goto("/components/select");
    expect(res?.status(), "status").toBeLessThan(400);
    await expect(page.getByRole("heading", { name: "Select" })).toBeVisible();
    // Check variant card titles
    await expect(page.getByText("Default", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Status", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("With search", { exact: true }).first()).toBeVisible();
    expect(errors, "pageerrors").toEqual([]);
  });

  test("Default variant — open and select Banana", async ({ page }) => {
    await page.goto("/components/select");

    // Scope to the default select card
    const card = page.locator('[data-testid="select-default"]');
    await expect(card).toBeVisible();

    // The trigger should show the placeholder
    const trigger = card.getByRole("combobox");
    await expect(trigger).toBeVisible();
    await trigger.click();

    // Click the "Banana" option
    await page.getByRole("option", { name: "Banana" }).click();

    // Trigger should now show "Banana"
    await expect(trigger).toContainText("Banana");
  });

  test("catalog Select card links to the detail page", async ({ page }) => {
    await page.goto("/components");
    await page.locator('a[href="/components/select"]').first().click();
    await expect(page).toHaveURL(/\/components\/select$/);
    await expect(page.getByRole("heading", { name: "Select" })).toBeVisible();
  });
});
