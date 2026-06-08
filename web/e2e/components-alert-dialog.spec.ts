import { test, expect } from "@playwright/test";

test.describe("Components — Alert Dialog detail", () => {
  test("renders breadcrumb, header, and variant cards", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const res = await page.goto("/components/alert-dialog");
    expect(res?.status(), "status").toBeLessThan(400);
    await expect(page.getByRole("heading", { name: "Alert Dialog" })).toBeVisible();
    await expect(page.getByText("Confirm", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Delete Item", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Onboarding", { exact: true }).first()).toBeVisible();
    expect(errors, "pageerrors").toEqual([]);
  });

  test("a variant dialog opens and closes", async ({ page }) => {
    await page.goto("/components/alert-dialog");
    await page.getByRole("button", { name: "Show Dialog" }).first().click();
    await expect(page.getByText("Are you absolutely sure?")).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).first().click();
    await expect(page.getByText("Are you absolutely sure?")).not.toBeVisible();
  });

  test("catalog Alert Dialog card links to the detail page", async ({ page }) => {
    await page.goto("/components");
    await page.getByRole("link", { name: /Alert Dialog/ }).first().click();
    await expect(page).toHaveURL(/\/components\/alert-dialog/);
    await expect(page.getByRole("heading", { name: "Alert Dialog" })).toBeVisible();
  });
});
