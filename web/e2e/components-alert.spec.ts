import { test, expect } from "@playwright/test";

test.describe("Components — Alert detail", () => {
  test("renders breadcrumb, header, and variant cards", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const res = await page.goto("/components/alert");
    expect(res?.status(), "status").toBeLessThan(400);
    await expect(page.getByRole("heading", { name: "Alert" })).toBeVisible();
    await expect(page.getByText("Default", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Destructive", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Payment successful").first()).toBeVisible();
    expect(errors, "pageerrors").toEqual([]);
  });

  test("Dismissible variant closes when X button is clicked", async ({ page }) => {
    await page.goto("/components/alert");
    // The dismissible alert contains "New features available"
    await expect(page.getByText("New features available").first()).toBeVisible();
    // Click the Dismiss button
    await page.getByRole("button", { name: "Dismiss" }).first().click();
    // The alert text should no longer be visible
    await expect(page.getByText("New features available")).not.toBeVisible();
  });

  test("catalog Alert card links to the detail page (not Alert Dialog)", async ({ page }) => {
    await page.goto("/components");
    // Target the Alert card specifically by matching "Alert" with "15" variants
    // to distinguish it from "Alert Dialog" (16 variants)
    await page.getByRole("link", { name: /Alert\b.*15|15.*Alert\b/ }).first().click();
    await expect(page).toHaveURL(/\/components\/alert$/);
    await expect(page.getByRole("heading", { name: "Alert" })).toBeVisible();
  });
});
