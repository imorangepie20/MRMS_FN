import { test, expect } from "@playwright/test";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function noErrors(page: import("@playwright/test").Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

// ─── Render smokes ────────────────────────────────────────────────────────────

test("/profile renders Sofia Davis", async ({ page }) => {
  const errors = noErrors(page);
  const res = await page.goto("/profile");
  expect(res?.status(), "status /profile").toBeLessThan(400);
  await expect(page.getByText("Sofia Davis").first()).toBeVisible();
  expect(errors, "pageerrors /profile").toEqual([]);
});

test("/profile/v2 renders Sofia Davis", async ({ page }) => {
  const errors = noErrors(page);
  const res = await page.goto("/profile/v2");
  expect(res?.status(), "status /profile/v2").toBeLessThan(400);
  await expect(page.getByText("Sofia Davis").first()).toBeVisible();
  expect(errors, "pageerrors /profile/v2").toEqual([]);
});

test("/empty-states renders No messages card", async ({ page }) => {
  const errors = noErrors(page);
  const res = await page.goto("/empty-states");
  expect(res?.status(), "status /empty-states").toBeLessThan(400);
  await expect(page.getByText("No messages", { exact: true }).first()).toBeVisible();
  expect(errors, "pageerrors /empty-states").toEqual([]);
});

test("/error/404 renders Page not found", async ({ page }) => {
  const errors = noErrors(page);
  const res = await page.goto("/error/404");
  expect(res?.status(), "status /error/404").toBeLessThan(400);
  await expect(page.getByText("Page not found", { exact: true }).first()).toBeVisible();
  expect(errors, "pageerrors /error/404").toEqual([]);
});

test("/error/500 renders Something went wrong", async ({ page }) => {
  const errors = noErrors(page);
  const res = await page.goto("/error/500");
  expect(res?.status(), "status /error/500").toBeLessThan(400);
  await expect(page.getByText("Something went wrong", { exact: true }).first()).toBeVisible();
  expect(errors, "pageerrors /error/500").toEqual([]);
});

// ─── Pricing toggle ───────────────────────────────────────────────────────────

test("/pricing toggle switches between monthly and annual price", async ({ page }) => {
  const errors = noErrors(page);
  await page.goto("/pricing");

  // Monthly price for Pro tier is $29
  await expect(page.getByText("29").first()).toBeVisible();

  // Click the "Annual" label text to toggle to annual
  await page.getByRole("switch").click();

  // Annual price for Pro tier is $23
  await expect(page.getByText("23").first()).toBeVisible();
  expect(errors, "pageerrors /pricing").toEqual([]);
});

// ─── Settings tabs ────────────────────────────────────────────────────────────

test("/settings Billing tab shows Pro plan and Notifications tab shows toggle", async ({
  page,
}) => {
  const errors = noErrors(page);
  await page.goto("/settings");

  // Switch to Billing tab
  await page.getByRole("tab", { name: "Billing" }).click();
  // BillingTab renders "Pro Plan" inside a card
  await expect(page.getByText("Pro Plan", { exact: true }).first()).toBeVisible();

  // Switch to Notifications tab
  await page.getByRole("tab", { name: "Notifications" }).click();
  // NotificationsTab has "Email notifications" toggle label
  await expect(page.getByText("Email notifications", { exact: true }).first()).toBeVisible();

  expect(errors, "pageerrors /settings").toEqual([]);
});

// ─── Onboarding wizard ────────────────────────────────────────────────────────

test("/onboarding wizard navigates forward and back", async ({ page }) => {
  const errors = noErrors(page);
  await page.goto("/onboarding");

  // Step 1: Welcome
  await expect(page.getByText("Welcome to the platform", { exact: true })).toBeVisible();

  // Continue to step 2
  await page.getByRole("button", { name: "Continue" }).click();

  // Step 2: Your Profile — has the "Full name" input
  await expect(page.getByLabel("Full name")).toBeVisible();

  // Back to step 1
  await page.getByRole("button", { name: "Back" }).click();

  // Step 1 content is visible again
  await expect(page.getByText("Welcome to the platform", { exact: true })).toBeVisible();

  expect(errors, "pageerrors /onboarding").toEqual([]);
});

// ─── Users search + pagination ────────────────────────────────────────────────

test("/users search filters rows and pagination shows page info", async ({
  page,
}) => {
  const errors = noErrors(page);
  await page.goto("/users");

  // Sofia Davis is in the seeded data (id u1)
  await expect(page.getByText("Sofia Davis").first()).toBeVisible();

  // Search for "jackson" — matches Jackson Lee, should hide Sofia Davis
  await page.getByPlaceholder("Search by name or email…").fill("jackson");
  await expect(page.getByText("Jackson Lee").first()).toBeVisible();
  await expect(page.getByText("Sofia Davis")).not.toBeVisible();

  // Clear search
  await page.getByPlaceholder("Search by name or email…").fill("");
  await expect(page.getByText("Sofia Davis").first()).toBeVisible();

  // Page indicator shows "Page 1 of 2" (12 users, pageSize 8)
  await expect(page.getByText("Page 1 of 2")).toBeVisible();

  // Click Next and assert page indicator changes
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByText("Page 2 of 2")).toBeVisible();

  expect(errors, "pageerrors /users").toEqual([]);
});

// ─── Notifications mark-read / unread tab ────────────────────────────────────

test("/notifications Unread tab shows items then empty after mark all as read", async ({
  page,
}) => {
  const errors = noErrors(page);
  await page.goto("/notifications");

  // Click the Unread tab
  await page.getByRole("tab", { name: /Unread/ }).click();

  // At least one unread notification is visible (Sofia Davis liked your post — read: false)
  await expect(page.getByText("liked your post").first()).toBeVisible();

  // Click Mark all as read
  await page.getByRole("button", { name: "Mark all as read" }).click();

  // Unread tab now shows empty state
  await expect(
    page.getByText("You've read all your notifications.").first()
  ).toBeVisible();

  expect(errors, "pageerrors /notifications").toEqual([]);
});
