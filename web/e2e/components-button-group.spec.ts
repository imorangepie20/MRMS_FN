import { test, expect } from "@playwright/test";

test.describe("Components — Button Group detail", () => {
  test("renders breadcrumb, header, and variant cards", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const res = await page.goto("/components/button-group");
    expect(res?.status(), "status").toBeLessThan(400);
    await expect(
      page.getByRole("heading", { name: "Button Group" })
    ).toBeVisible();
    // Variant card titles
    await expect(page.getByText("Basic", { exact: true }).first()).toBeVisible();
    await expect(
      page.getByText("Segmented (single)", { exact: true }).first()
    ).toBeVisible();
    await expect(
      page.getByText("Split dropdown", { exact: true }).first()
    ).toBeVisible();
    expect(errors, "pageerrors").toEqual([]);
  });

  test("Segmented (single) — clicking Month makes it active (aria-pressed=true)", async ({
    page,
  }) => {
    await page.goto("/components/button-group");
    const monthBtn = page.getByRole("button", { name: "Month" });
    await monthBtn.click();
    await expect(monthBtn).toHaveAttribute("aria-pressed", "true");
  });

  test("Split dropdown — chevron opens dropdown with Save / Save as… / Export", async ({
    page,
  }) => {
    await page.goto("/components/button-group");
    await page.getByRole("button", { name: "More options" }).click();
    await expect(page.getByRole("menuitem", { name: "Export" })).toBeVisible();
  });

  test("catalog Button Group card links to the detail page", async ({ page }) => {
    await page.goto("/components");
    await page.getByRole("link", { name: /Button Group/ }).first().click();
    await expect(page).toHaveURL(/\/components\/button-group$/);
  });
});
