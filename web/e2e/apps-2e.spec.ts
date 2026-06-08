import { test, expect } from "@playwright/test";

// ── File Manager App ──────────────────────────────────────────────────────────

test.describe("File Manager app", () => {
  test("renders sidebar and seeded file items", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const res = await page.goto("/apps/file-manager");
    expect(res?.status()).toBeLessThan(400);
    // Sidebar folder tree visible
    await expect(page.getByText("Documents", { exact: true }).first()).toBeVisible();
    // Seeded file item in the main area
    await expect(
      page.getByText("Brand Styles Guide", { exact: true }).first()
    ).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("search filters items – match visible, non-match hidden", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/apps/file-manager");

    // Type substring that matches "Brand Styles Guide" but not "Arion – Admin Dashboard"
    await page.getByPlaceholder("Search files…").fill("Brand");

    await expect(
      page.getByText("Brand Styles Guide", { exact: true }).first()
    ).toBeVisible();
    await expect(
      page.getByText("Arion – Admin Dashboard & UI Kit", { exact: true }).first()
    ).not.toBeVisible();

    expect(errors).toEqual([]);
  });

  test("grid/list view toggle switches layout", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/apps/file-manager");

    // Default is grid view – the "List view" button is present (aria-label added in JSX)
    const listBtn = page.getByRole("button", { name: "List view", exact: true });
    const gridBtn = page.getByRole("button", { name: "Grid view", exact: true });

    await listBtn.click();
    // In list view the "Name" column header appears
    await expect(page.getByText("Name", { exact: true }).first()).toBeVisible();

    await gridBtn.click();
    // Back to grid – "Name" column header gone; file card still present
    await expect(
      page.getByText("Brand Styles Guide", { exact: true }).first()
    ).toBeVisible();

    expect(errors).toEqual([]);
  });
});

// ── API Keys App ──────────────────────────────────────────────────────────────

test.describe("API Keys app", () => {
  test("renders header and seeded key table", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const res = await page.goto("/apps/api-keys");
    expect(res?.status()).toBeLessThan(400);
    await expect(
      page.getByText("API Keys Management", { exact: true }).first()
    ).toBeVisible();
    await expect(
      page.getByText("Production API Key", { exact: true }).first()
    ).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("create-key dialog creates new key and shows it in table", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/apps/api-keys");

    // Open dialog
    await page.getByRole("button", { name: "Create API Key", exact: true }).first().click();

    // Dialog heading visible
    await expect(
      page.getByRole("heading", { name: "Create API Key", exact: true }).first()
    ).toBeVisible();

    // Fill name field
    await page.getByPlaceholder("e.g. Production Key").fill("My Test Key");

    // Submit
    await page.getByRole("button", { name: "Create Key", exact: true }).click();

    // New key name should appear in the table
    await expect(
      page.getByText("My Test Key", { exact: true }).first()
    ).toBeVisible();

    expect(errors).toEqual([]);
  });
});

// ── POS App ───────────────────────────────────────────────────────────────────

test.describe("POS app", () => {
  test("renders product grid and empty cart panel", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const res = await page.goto("/apps/pos");
    expect(res?.status()).toBeLessThan(400);
    // A product name visible in the grid
    await expect(
      page.getByText("Espresso", { exact: true }).first()
    ).toBeVisible();
    // Cart panel header
    await expect(
      page.getByText("Current Order", { exact: true }).first()
    ).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("add-to-cart places product in cart and updates Charge button", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/apps/pos");

    // Initially Charge button is disabled and shows no total
    const chargeBtn = page.getByRole("button", { name: "Charge", exact: true });
    await expect(chargeBtn).toBeVisible();
    await expect(chargeBtn).toBeDisabled();

    // Click "Add Espresso to cart" (the + icon button inside the product card)
    await page
      .getByRole("button", { name: "Add Espresso to cart", exact: true })
      .first()
      .click();

    // Cart now shows "Espresso" in the order items list (scoped to cart panel)
    const cartPanel = page.locator(".rounded-xl.bg-card.ring-1");
    await expect(
      cartPanel.getByText("Espresso", { exact: true }).first()
    ).toBeVisible();

    // Charge button should now be enabled and include a dollar amount
    const chargeBtn2 = page.getByRole("button", { name: /Charge \$/ });
    await expect(chargeBtn2).toBeEnabled();

    expect(errors).toEqual([]);
  });

  test("qty increment increases quantity in cart", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/apps/pos");

    // Add Latte to cart
    await page
      .getByRole("button", { name: "Add Latte to cart", exact: true })
      .first()
      .click();

    // Quantity starts at 1 – click increment
    const incrementBtn = page
      .getByRole("button", { name: "Increase quantity", exact: true })
      .first();
    await expect(incrementBtn).toBeVisible();
    await incrementBtn.click();

    // Quantity should now be 2
    const cartPanel = page.locator(".rounded-xl.bg-card.ring-1");
    await expect(cartPanel.getByText("2", { exact: true }).first()).toBeVisible();

    expect(errors).toEqual([]);
  });
});

// ── Courses App ───────────────────────────────────────────────────────────────

test.describe("Courses app", () => {
  test("renders header and seeded course cards", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const res = await page.goto("/apps/courses");
    expect(res?.status()).toBeLessThan(400);
    await expect(
      page.getByText("Mastering Illustration", { exact: true }).first()
    ).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("In Progress tab shows only in-progress courses", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/apps/courses");

    // Click "In Progress" status tab
    await page.getByRole("tab", { name: "In Progress", exact: true }).first().click();

    // "Mastering Illustration" (status: "in-progress") should be visible
    await expect(
      page.getByText("Mastering Illustration", { exact: true }).first()
    ).toBeVisible();

    // "Digital Marketing 101" (status: "not-enrolled") should not be visible
    await expect(
      page.getByText("Digital Marketing 101", { exact: true }).first()
    ).not.toBeVisible();

    expect(errors).toEqual([]);
  });

  test("search filters courses by title", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/apps/courses");

    await page.getByPlaceholder("Search courses...").fill("Python");

    // Python for Data Science should be visible
    await expect(
      page.getByText("Python for Data Science", { exact: true }).first()
    ).toBeVisible();

    // Mastering Illustration should not be visible
    await expect(
      page.getByText("Mastering Illustration", { exact: true }).first()
    ).not.toBeVisible();

    expect(errors).toEqual([]);
  });
});
