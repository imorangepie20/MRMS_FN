import { test, expect } from "@playwright/test";

test.describe("Components — Autocomplete detail", () => {
  test("renders breadcrumb, header, and variant cards", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const res = await page.goto("/components/autocomplete");
    expect(res?.status(), "status").toBeLessThan(400);
    await expect(page.getByRole("heading", { name: "Autocomplete" })).toBeVisible();
    await expect(page.getByText("Basic", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("With clear button", { exact: true }).first()).toBeVisible();
    expect(errors, "pageerrors").toEqual([]);
  });

  test("Basic variant filters and selects an item", async ({ page }) => {
    await page.goto("/components/autocomplete");

    // Find the Basic variant input by its placeholder
    const input = page.getByPlaceholder("Search framework…").first();
    await expect(input).toBeVisible();

    // Type a substring that matches "Svelte"
    await input.click();
    await input.fill("sv");

    // "Svelte" should appear in the dropdown
    await expect(page.getByRole("option", { name: "Svelte" }).first()).toBeVisible();

    // Click "Svelte"
    await page.getByRole("option", { name: "Svelte" }).first().click();

    // The input should now show "Svelte"
    await expect(input).toHaveValue("Svelte");
  });

  test("catalog Autocomplete card links to the detail page", async ({ page }) => {
    await page.goto("/components");
    await page.getByRole("link", { name: /Autocomplete/ }).first().click();
    await expect(page).toHaveURL(/\/components\/autocomplete/);
    await expect(page.getByRole("heading", { name: "Autocomplete" })).toBeVisible();
  });
});
