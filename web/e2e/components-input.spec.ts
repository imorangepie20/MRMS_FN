import { test, expect } from "@playwright/test";

test.describe("Components — Input detail", () => {
  test("renders breadcrumb, header, and variant cards", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const res = await page.goto("/components/input");
    expect(res?.status(), "status").toBeLessThan(400);
    await expect(page.getByRole("heading", { name: "Input" })).toBeVisible();
    // Variant card titles
    await expect(
      page.getByText("Password (show/hide)", { exact: true }).first()
    ).toBeVisible();
    await expect(
      page.getByText("Tags", { exact: true }).first()
    ).toBeVisible();
    await expect(
      page.getByText("OTP", { exact: true }).first()
    ).toBeVisible();
    expect(errors, "pageerrors").toEqual([]);
  });

  test("Password (show/hide) variant — typing and toggling visibility", async ({
    page,
  }) => {
    await page.goto("/components/input");

    // Scope to the password toggle variant
    const card = page.locator('[data-testid="input-password"]');
    await expect(card).toBeVisible();

    // The password input should initially be type=password
    const input = card.locator('input[type="password"]');
    await expect(input).toBeVisible();

    // Type a secret value
    await input.fill("secret");

    // Click the show toggle
    const toggle = card.getByRole("button", { name: "Show password" });
    await toggle.click();

    // The input should now be type=text
    const textInput = card.locator("#input-password-toggle");
    await expect(textInput).toHaveAttribute("type", "text");
  });

  test("catalog Input card links to the detail page", async ({ page }) => {
    await page.goto("/components");
    await page.locator('a[href="/components/input"]').first().click();
    await expect(page).toHaveURL(/\/components\/input$/);
    await expect(
      page.getByRole("heading", { name: "Input" })
    ).toBeVisible();
  });
});
