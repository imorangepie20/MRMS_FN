import { test, expect } from "@playwright/test";

test.describe("Components — Sheet detail", () => {
  test("renders breadcrumb, header, and variant cards", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const res = await page.goto("/components/sheet");
    expect(res?.status(), "status").toBeLessThan(400);
    await expect(page.getByRole("heading", { name: "Sheet" })).toBeVisible();
    await expect(page.getByText("Right (default)", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Left (navigation)", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("User profile", { exact: true }).first()).toBeVisible();
    expect(errors, "pageerrors").toEqual([]);
  });

  test("Right (default) variant opens and closes", async ({ page }) => {
    await page.goto("/components/sheet");
    await page.getByRole("button", { name: "Open Sheet" }).first().click();
    await expect(page.getByRole("heading", { name: "Edit profile" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Save changes" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Save changes" })).not.toBeVisible();
  });

  test("catalog Sheet card links to the detail page", async ({ page }) => {
    await page.goto("/components");
    await page.locator('a[href="/components/sheet"]').first().click();
    await expect(page).toHaveURL(/\/components\/sheet/);
    await expect(page.getByRole("heading", { name: "Sheet" })).toBeVisible();
  });
});
