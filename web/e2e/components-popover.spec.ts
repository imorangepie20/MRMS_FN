import { test, expect } from "@playwright/test";

test.describe("Components — Popover detail", () => {
  test("renders breadcrumb, header, and variant cards", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const res = await page.goto("/components/popover");
    expect(res?.status(), "status").toBeLessThan(400);
    await expect(
      page.getByRole("heading", { name: "Popover" })
    ).toBeVisible();
    // Check variant card titles
    await expect(
      page.getByText("Dimensions", { exact: true }).first()
    ).toBeVisible();
    await expect(
      page.getByText("Positioning", { exact: true }).first()
    ).toBeVisible();
    await expect(
      page.getByText("Onboarding steps", { exact: true }).first()
    ).toBeVisible();
    expect(errors, "pageerrors").toEqual([]);
  });

  test("Dimensions variant — open popover, verify content, close on Escape", async ({
    page,
  }) => {
    await page.goto("/components/popover");
    await page
      .getByRole("button", { name: "Open popover" })
      .first()
      .click();
    await expect(
      page.getByText("Set the dimensions for the layer.").first()
    ).toBeVisible({ timeout: 5000 });
    await expect(
      page.getByText("Dimensions").first()
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(
      page.getByText("Set the dimensions for the layer.").first()
    ).not.toBeVisible({ timeout: 5000 });
  });

  test("catalog Popover card links to the detail page", async ({ page }) => {
    await page.goto("/components");
    await page.locator('a[href="/components/popover"]').first().click();
    await expect(page).toHaveURL(/\/components\/popover$/);
    await expect(
      page.getByRole("heading", { name: "Popover" })
    ).toBeVisible();
  });
});
