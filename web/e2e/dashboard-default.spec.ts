import { test, expect } from "@playwright/test";

test.describe("Default dashboard", () => {
  test.beforeEach(async ({ page }) => { await page.goto("/dashboard/default"); });

  test("renders all seven widgets", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
    await expect(page.getByText("Subscriptions")).toBeVisible();
    await expect(page.getByText("Total Revenue")).toBeVisible();
    await expect(page.getByText("+4850")).toBeVisible();
    await expect(page.getByText("$15,231.89")).toBeVisible();
    await expect(page.getByText("Team Members", { exact: true })).toBeVisible();
    await expect(page.getByText("New Message", { exact: true })).toBeVisible();
    await expect(page.getByText("Exercise Minutes", { exact: true })).toBeVisible();
    await expect(page.getByText("Latest Payments", { exact: true })).toBeVisible();
    await expect(page.getByText("Payment Method", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Download" })).toBeVisible();
  });

  test("payments table filters by email", async ({ page }) => {
    const filter = page.getByPlaceholder("Filter emails...");
    await expect(page.getByText("ken99@example.com")).toBeVisible();
    await filter.fill("monserrat");
    await expect(page.getByText("monserrat44@example.com")).toBeVisible();
    await expect(page.getByText("ken99@example.com")).not.toBeVisible();
  });

  test("chat appends a sent message", async ({ page }) => {
    const input = page.getByPlaceholder("Type your message...");
    await input.fill("Testing 123");
    await input.press("Enter");
    await expect(page.getByText("Testing 123")).toBeVisible();
  });
});
