import { test, expect } from "@playwright/test";

test.describe("Components — Combobox detail", () => {
  test("renders breadcrumb, header, and variant cards", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const res = await page.goto("/components/combobox");
    expect(res?.status(), "status").toBeLessThan(400);
    await expect(page.getByRole("heading", { name: "Combobox" })).toBeVisible();
    // Check variant card titles
    await expect(page.getByText("Basic", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Multi-select", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Grouped", { exact: true }).first()).toBeVisible();
    expect(errors, "pageerrors").toEqual([]);
  });

  test("Basic variant — open, filter, and select a framework", async ({ page }) => {
    await page.goto("/components/combobox");

    // Scope to the basic combobox card
    const card = page.locator('[data-testid="combobox-basic"]');
    await expect(card).toBeVisible();

    // Click the trigger button
    const trigger = card.getByRole("combobox");
    await expect(trigger).toContainText("Select framework…");
    await trigger.click();

    // Type to filter
    await page.getByPlaceholder("Search…").first().fill("rem");

    // Click "Remix"
    await page.getByRole("option", { name: "Remix" }).click();

    // Trigger should now show "Remix"
    await expect(trigger).toContainText("Remix");
  });

  test("catalog Combobox card links to the detail page", async ({ page }) => {
    await page.goto("/components");
    await page.locator('a[href="/components/combobox"]').first().click();
    await expect(page).toHaveURL(/\/components\/combobox$/);
    await expect(page.getByRole("heading", { name: "Combobox" })).toBeVisible();
  });
});
