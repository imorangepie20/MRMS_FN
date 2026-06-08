import { test, expect } from "@playwright/test";

test.describe("Components — Hover Card detail", () => {
  test("renders breadcrumb, header, and variant cards", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const res = await page.goto("/components/hover-card");
    expect(res?.status(), "status").toBeLessThan(400);
    await expect(
      page.getByRole("heading", { name: "Hover Card" })
    ).toBeVisible();
    // Check variant card titles
    await expect(page.getByText("Basic", { exact: true }).first()).toBeVisible();
    await expect(
      page.getByText("User profile", { exact: true }).first()
    ).toBeVisible();
    await expect(
      page.getByText("Stats and actions", { exact: true }).first()
    ).toBeVisible();
    // Check the Basic trigger is rendered
    await expect(
      page.getByRole("button", { name: "@nextjs" }).first()
    ).toBeVisible();
    expect(errors, "pageerrors").toEqual([]);
  });

  test("Basic variant — hovering trigger reveals hover-card content", async ({
    page,
  }) => {
    await page.goto("/components/hover-card");
    await page.getByRole("button", { name: "@nextjs" }).first().hover();
    await expect(
      page.getByText("Joined December 2021").first()
    ).toBeVisible({ timeout: 5000 });
    await expect(
      page.getByText("The React Framework").first()
    ).toBeVisible({ timeout: 5000 });
  });

  test("catalog Hover Card card links to the detail page", async ({ page }) => {
    await page.goto("/components");
    await page.locator('a[href="/components/hover-card"]').first().click();
    await expect(page).toHaveURL(/\/components\/hover-card$/);
    await expect(
      page.getByRole("heading", { name: "Hover Card" })
    ).toBeVisible();
  });
});
