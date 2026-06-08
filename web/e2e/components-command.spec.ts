import { test, expect } from "@playwright/test";

test.describe("Components — Command detail", () => {
  test("renders breadcrumb, header, and variant cards", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const res = await page.goto("/components/command");
    expect(res?.status(), "status").toBeLessThan(400);
    await expect(page.getByRole("heading", { name: "Command" })).toBeVisible();
    // Check variant card titles
    await expect(page.getByText("Basic grouped", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Keyboard shortcuts", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("User list", { exact: true }).first()).toBeVisible();
    expect(errors, "pageerrors").toEqual([]);
  });

  test("Basic grouped variant — type to filter", async ({ page }) => {
    await page.goto("/components/command");

    // Scope to the basic command card
    const card = page.locator('[data-testid="command-basic"]');
    await expect(card).toBeVisible();

    // Type into the CommandInput
    const input = card.getByPlaceholder("Type a command or search…");
    await input.fill("dash");

    // Dashboard item should be visible
    await expect(card.getByText("Dashboard")).toBeVisible();

    // Non-matching item (Images) should NOT be visible
    await expect(card.getByText("Images")).not.toBeVisible();
  });

  test("catalog Command card links to the detail page", async ({ page }) => {
    await page.goto("/components");
    await page.locator('a[href="/components/command"]').first().click();
    await expect(page).toHaveURL(/\/components\/command$/);
    await expect(page.getByRole("heading", { name: "Command" })).toBeVisible();
  });
});
