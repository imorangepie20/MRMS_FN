import { test, expect } from "@playwright/test";

test.describe("Components — Native Select detail", () => {
  test("renders breadcrumb, header, and variant cards", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const res = await page.goto("/components/native-select");
    expect(res?.status(), "status").toBeLessThan(400);
    await expect(
      page.getByRole("heading", { name: "Native Select" })
    ).toBeVisible();
    // Variant card titles
    await expect(page.getByText("Default", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Error state", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Option groups", { exact: true }).first()).toBeVisible();
    expect(errors, "pageerrors").toEqual([]);
  });

  test("Default select — selecting 'Done' updates the value", async ({
    page,
  }) => {
    await page.goto("/components/native-select");

    const select = page.getByLabel("Status");
    await select.selectOption("Done");
    await expect(select).toHaveValue("Done");
  });

  test("catalog Native Select card links to the detail page", async ({
    page,
  }) => {
    await page.goto("/components");
    await page.locator('a[href="/components/native-select"]').first().click();
    await expect(page).toHaveURL(/\/components\/native-select$/);
    await expect(
      page.getByRole("heading", { name: "Native Select" })
    ).toBeVisible();
  });
});
