import { test, expect } from "@playwright/test";

test.describe("Components — Sonner Toast detail", () => {
  test("renders breadcrumb, header, and variant cards", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const res = await page.goto("/components/sonner-toast");
    expect(res?.status(), "status").toBeLessThan(400);
    await expect(
      page.getByRole("heading", { name: "Sonner Toast" })
    ).toBeVisible();
    // Variant card titles
    await expect(page.getByText("Default", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Success", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Promise", { exact: true }).first()).toBeVisible();
    expect(errors, "pageerrors").toEqual([]);
  });

  test("Default variant — clicking Show Toast fires the toast", async ({ page }) => {
    await page.goto("/components/sonner-toast");
    await page.getByRole("button", { name: "Show Toast" }).click();
    await expect(page.getByText("Event has been created")).toBeVisible();
  });

  test("catalog Sonner Toast card links to the detail page", async ({ page }) => {
    await page.goto("/components");
    await page.locator('a[href="/components/sonner-toast"]').first().click();
    await expect(page).toHaveURL(/\/components\/sonner-toast$/);
    await expect(
      page.getByRole("heading", { name: "Sonner Toast" })
    ).toBeVisible();
  });
});
