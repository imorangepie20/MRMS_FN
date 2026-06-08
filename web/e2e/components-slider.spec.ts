import { test, expect } from "@playwright/test";

test.describe("Components — Slider detail", () => {
  test("renders breadcrumb, header, and variant cards", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const res = await page.goto("/components/slider");
    expect(res?.status(), "status").toBeLessThan(400);
    await expect(page.getByRole("heading", { name: "Slider" })).toBeVisible();
    // Variant card titles
    await expect(page.getByText("Basic", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Range", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Volume", { exact: true }).first()).toBeVisible();
    // At least one slider thumb visible
    await expect(page.getByRole("slider").first()).toBeVisible();
    expect(errors, "pageerrors").toEqual([]);
  });

  test("With value label — keyboard interaction increases value", async ({ page }) => {
    await page.goto("/components/slider");

    // Scope to the with-value-label card
    const card = page.locator('[data-testid="slider-value"]');
    await expect(card).toBeVisible();

    // Read initial output value
    const output = card.locator('[data-testid="slider-value-output"]');
    const initialText = await output.textContent();
    const initialNum = Number(initialText?.replace(/[^0-9]/g, ""));

    // Focus the slider thumb and press ArrowRight 3 times
    const thumb = card.getByRole("slider").first();
    await thumb.focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");

    // Assert value increased
    const updatedText = await output.textContent();
    const updatedNum = Number(updatedText?.replace(/[^0-9]/g, ""));
    expect(updatedNum).toBeGreaterThan(initialNum);
  });

  test("catalog Slider card links to the detail page", async ({ page }) => {
    await page.goto("/components");
    await page.locator('a[href="/components/slider"]').first().click();
    await expect(page).toHaveURL(/\/components\/slider$/);
    await expect(page.getByRole("heading", { name: "Slider" })).toBeVisible();
  });
});
