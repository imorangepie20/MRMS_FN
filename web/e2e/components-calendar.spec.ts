import { test, expect } from "@playwright/test";

test.describe("Components — Calendar detail", () => {
  test("renders breadcrumb, header, variant titles, and calendar grid", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const res = await page.goto("/components/calendar");
    expect(res?.status(), "status").toBeLessThan(400);

    await expect(
      page.getByRole("heading", { name: "Calendar" })
    ).toBeVisible();

    // Spot-check variant card titles
    await expect(page.getByText("Single", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Range", { exact: true }).first()).toBeVisible();
    await expect(
      page.getByText("Preset ranges", { exact: true }).first()
    ).toBeVisible();
    await expect(
      page.getByText("With footer", { exact: true }).first()
    ).toBeVisible();
    await expect(
      page.getByText("Week numbers", { exact: true }).first()
    ).toBeVisible();

    // At least one calendar grid should be visible
    await expect(page.getByRole("grid").first()).toBeVisible();

    expect(errors, "pageerrors").toEqual([]);
  });

  test("With footer — clicking a day updates the footer text", async ({
    page,
  }) => {
    await page.goto("/components/calendar");

    // Scope to the footer variant container via data-testid
    const footerCard = page.locator('[data-testid="cal-footer"]');
    await expect(footerCard).toBeVisible();

    // Footer should start as "Pick a day" (nothing selected)
    await expect(
      footerCard.getByText("Pick a day", { exact: true })
    ).toBeVisible();

    // Click on day 20 within the footer variant (match by visible text, since
    // react-day-picker's accessible name is the full date string)
    const dayBtn = footerCard.getByRole("button").filter({ hasText: /^20$/ }).first();
    await dayBtn.click();

    // Footer should no longer say "Pick a day"
    await expect(
      footerCard.getByText("Pick a day", { exact: true })
    ).not.toBeVisible();

    // Footer should now show a "Selected:" line
    await expect(
      footerCard.getByText(/Selected:/)
    ).toBeVisible();
  });

  test("catalog Calendar card links to the detail page", async ({ page }) => {
    await page.goto("/components");
    // Scope to the catalog card's href — "Calendar" also appears as a sidebar
    // app nav link (→ /apps/calendar), which must not be matched here.
    await page.locator('a[href="/components/calendar"]').first().click();
    await expect(page).toHaveURL(/\/components\/calendar$/);
  });
});
