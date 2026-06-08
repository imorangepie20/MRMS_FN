import { test, expect } from "@playwright/test";

test.describe("Components — Collapsible detail", () => {
  test("renders breadcrumb, header, and variant cards", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const res = await page.goto("/components/collapsible");
    expect(res?.status(), "status").toBeLessThan(400);
    await expect(page.getByRole("heading", { name: "Collapsible" })).toBeVisible();
    // Check variant card titles
    await expect(page.getByText("Basic toggle", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Show more / less", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Nested", { exact: true }).first()).toBeVisible();
    expect(errors, "pageerrors").toEqual([]);
  });

  test("Basic toggle — expanding reveals hidden repo rows", async ({ page }) => {
    await page.goto("/components/collapsible");

    // Scope to the basic toggle variant
    const card = page.locator('[data-testid="collapsible-basic"]');
    await expect(card).toBeVisible();

    // "@stitches/react" should not be visible initially (panel is closed)
    await expect(card.getByText("@stitches/react")).not.toBeVisible();

    // Click the toggle trigger
    const trigger = card.getByRole("button", { name: "Toggle repositories" });
    await trigger.click();

    // "@stitches/react" should now be visible
    await expect(card.getByText("@stitches/react")).toBeVisible();
  });

  test("catalog Collapsible card links to the detail page", async ({ page }) => {
    await page.goto("/components");
    await page.locator('a[href="/components/collapsible"]').first().click();
    await expect(page).toHaveURL(/\/components\/collapsible$/);
    await expect(page.getByRole("heading", { name: "Collapsible" })).toBeVisible();
  });
});
