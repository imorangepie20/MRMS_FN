import { test, expect } from "@playwright/test";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function noErrors(page: import("@playwright/test").Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

// ─── Render smokes ────────────────────────────────────────────────────────────

test("/components renders the catalog header and cards", async ({ page }) => {
  const errors = noErrors(page);
  const res = await page.goto("/components");
  expect(res?.status(), "status /components").toBeLessThan(400);
  await expect(page.getByText("500+ Free Components for Shadcn UI")).toBeVisible();
  await expect(page.getByText("Avatar", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Accordion", { exact: true }).first()).toBeVisible();
  expect(errors, "pageerrors /components").toEqual([]);
});

test("/components search + category filter", async ({ page }) => {
  await page.goto("/components");
  const search = page.getByPlaceholder("Search components…");
  await search.fill("accordion");
  await expect(page.getByText("Accordion", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Avatar", { exact: true })).toHaveCount(0);
  await search.fill("");
  // Form category shows Slider (Form), hides Avatar (Data Display)
  await page.getByRole("button", { name: /^Form\b/ }).click();
  await expect(page.getByText("Slider", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Avatar", { exact: true })).toHaveCount(0);
});

test("/widgets renders Quick Actions widget", async ({ page }) => {
  const errors = noErrors(page);
  const res = await page.goto("/widgets");
  expect(res?.status(), "status /widgets").toBeLessThan(400);
  // CardTitle rendered inside the Quick Actions card
  await expect(page.getByText("Quick Actions", { exact: true }).first()).toBeVisible();
  expect(errors, "pageerrors /widgets").toEqual([]);
});

test("/blocks renders Hero Section block", async ({ page }) => {
  const errors = noErrors(page);
  const res = await page.goto("/blocks");
  expect(res?.status(), "status /blocks").toBeLessThan(400);
  await expect(page.getByText("Hero Section", { exact: true }).first()).toBeVisible();
  expect(errors, "pageerrors /blocks").toEqual([]);
});

test("/examples renders E-commerce card", async ({ page }) => {
  const errors = noErrors(page);
  const res = await page.goto("/examples");
  expect(res?.status(), "status /examples").toBeLessThan(400);
  await expect(page.getByText("E-commerce", { exact: true }).first()).toBeVisible();
  expect(errors, "pageerrors /examples").toEqual([]);
});

test("/templates renders SaaS Landing template", async ({ page }) => {
  const errors = noErrors(page);
  const res = await page.goto("/templates");
  expect(res?.status(), "status /templates").toBeLessThan(400);
  await expect(page.getByText("SaaS Landing", { exact: true }).first()).toBeVisible();
  expect(errors, "pageerrors /templates").toEqual([]);
});

// ─── Blocks tab filter ────────────────────────────────────────────────────────
// Auth category: only "Login Form"
// Marketing category: Hero Section, Pricing Table, Feature Grid, Testimonials, CTA Banner
// Clicking "Auth" tab should show "Login Form" and hide "Hero Section"

test("/blocks Auth tab shows Login Form and hides Hero Section", async ({ page }) => {
  const errors = noErrors(page);
  await page.goto("/blocks");

  // The "All" tab is active by default — Hero Section is visible
  await expect(page.getByText("Hero Section", { exact: true }).first()).toBeVisible();

  // Click the Auth tab
  await page.getByRole("tab", { name: "Auth" }).click();

  // Login Form belongs to Auth — should be visible
  await expect(page.getByText("Login Form", { exact: true }).first()).toBeVisible();

  // Hero Section belongs to Marketing — should not be visible
  await expect(page.getByText("Hero Section", { exact: true })).not.toBeVisible();

  expect(errors, "pageerrors /blocks").toEqual([]);
});

// ─── Templates search ─────────────────────────────────────────────────────────

test("/templates search filters to Portfolio and hides SaaS Landing", async ({ page }) => {
  const errors = noErrors(page);
  await page.goto("/templates");

  // Both cards visible initially
  await expect(page.getByText("SaaS Landing", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Portfolio", { exact: true }).first()).toBeVisible();

  // Type "Portfolio" into the search input
  await page.getByPlaceholder("Search templates…").fill("Portfolio");

  // "Portfolio" card is visible
  await expect(page.getByText("Portfolio", { exact: true }).first()).toBeVisible();

  // "SaaS Landing" is no longer rendered
  await expect(page.getByText("SaaS Landing", { exact: true })).not.toBeVisible();

  expect(errors, "pageerrors /templates").toEqual([]);
});

// ─── Examples link navigation ─────────────────────────────────────────────────
// The "Pricing" card links to /pricing via a "View Example" button rendered as <Link>

test("/examples Pricing card navigates to /pricing", async ({ page }) => {
  const errors = noErrors(page);
  await page.goto("/examples");

  // The Pricing card exists
  await expect(page.getByText("Pricing", { exact: true }).first()).toBeVisible();

  // Each card has a "View Example" link-button; scope to the Pricing card
  const pricingCard = page.locator('[data-slot="card"]').filter({
    has: page.getByText("Pricing", { exact: true }),
  });
  await pricingCard.getByRole("link", { name: "View Example" }).click();

  // Should navigate to /pricing
  await expect(page).toHaveURL(/\/pricing/);
  // The pricing page itself renders
  await expect(page.getByText("29").first()).toBeVisible();

  expect(errors, "pageerrors /examples → /pricing").toEqual([]);
});
