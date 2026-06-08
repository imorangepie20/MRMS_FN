import { test, expect } from "@playwright/test";

test.describe("Components — Carousel detail", () => {
  test("renders breadcrumb, header, and variant cards", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const res = await page.goto("/components/carousel");
    expect(res?.status(), "status").toBeLessThan(400);
    await expect(page.getByRole("heading", { name: "Carousel" })).toBeVisible();
    // Check a selection of variant card titles
    await expect(page.getByText("Basic", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Dots navigation", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Testimonials", { exact: true }).first()).toBeVisible();
    expect(errors, "pageerrors").toEqual([]);
  });

  test("Dots navigation variant — clicking 3rd dot updates active state", async ({ page }) => {
    await page.goto("/components/carousel");

    // Scope to the dots variant wrapper
    const dotsWrapper = page.locator('[data-testid="carousel-dots"]');
    await expect(dotsWrapper).toBeVisible();

    // Click the 3rd dot (index 2, slide 3)
    const thirdDot = dotsWrapper.getByRole("button", { name: "Go to slide 3" });
    await thirdDot.click();

    // Assert the 3rd dot is now active (aria-current="true")
    await expect(thirdDot).toHaveAttribute("aria-current", "true");

    // And the 1st dot is no longer active
    const firstDot = dotsWrapper.getByRole("button", { name: "Go to slide 1" });
    await expect(firstDot).not.toHaveAttribute("aria-current", "true");
  });

  test("catalog Carousel card links to the detail page", async ({ page }) => {
    await page.goto("/components");
    await page.locator('a[href="/components/carousel"]').first().click();
    await expect(page).toHaveURL(/\/components\/carousel$/);
    await expect(page.getByRole("heading", { name: "Carousel" })).toBeVisible();
  });
});
