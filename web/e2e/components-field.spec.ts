import { test, expect } from "@playwright/test";

test.describe("Components — Field detail", () => {
  test("renders breadcrumb, header, and variant cards", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const res = await page.goto("/components/field");
    expect(res?.status(), "status").toBeLessThan(400);
    await expect(page.getByRole("heading", { name: "Field" })).toBeVisible();
    // Variant card titles
    await expect(page.getByText("Payment Method", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Username", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Subscription (radio)", { exact: true }).first()).toBeVisible();
    // A visible field label inside a variant
    await expect(page.getByText("Card Number", { exact: true }).first()).toBeVisible();
    expect(errors, "pageerrors").toEqual([]);
  });

  test("Billing Address — clicking 'Same as shipping address' checkbox checks it", async ({
    page,
  }) => {
    await page.goto("/components/field");

    // Scope to the billing address variant card
    const card = page.locator('[data-testid="field-billing"]');
    await expect(card).toBeVisible();

    // Click the checkbox
    const checkbox = card.getByRole("checkbox", {
      name: "Same as shipping address",
    });
    await checkbox.click();

    // Assert it is now checked
    await expect(checkbox).toBeChecked();
  });

  test("catalog Field card links to the detail page", async ({ page }) => {
    await page.goto("/components");
    await page.locator('a[href="/components/field"]').first().click();
    await expect(page).toHaveURL(/\/components\/field$/);
    await expect(page.getByRole("heading", { name: "Field" })).toBeVisible();
  });
});
