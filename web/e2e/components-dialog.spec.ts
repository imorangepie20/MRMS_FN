import { test, expect } from "@playwright/test";

test.describe("Components — Dialog detail", () => {
  test("renders breadcrumb, header, and variant cards", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const res = await page.goto("/components/dialog");
    expect(res?.status(), "status").toBeLessThan(400);
    await expect(page.getByRole("heading", { name: "Dialog" })).toBeVisible();
    await expect(page.getByText("Edit profile", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Share", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Confirmation", { exact: true }).first()).toBeVisible();
    expect(errors, "pageerrors").toEqual([]);
  });

  test("Edit profile variant opens and closes", async ({ page }) => {
    await page.goto("/components/dialog");
    await page.getByRole("button", { name: "Edit Profile" }).first().click();
    await expect(page.getByRole("heading", { name: "Edit profile" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Save changes" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Save changes" })).not.toBeVisible();
  });

  test("catalog Dialog card links to the detail page", async ({ page }) => {
    await page.goto("/components");
    await page.locator('a[href="/components/dialog"]').first().click();
    await expect(page).toHaveURL(/\/components\/dialog/);
    await expect(page.getByRole("heading", { name: "Dialog" })).toBeVisible();
  });
});
