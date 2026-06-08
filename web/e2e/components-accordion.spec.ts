import { test, expect } from "@playwright/test";

test.describe("Components — Accordion detail", () => {
  test("renders breadcrumb, header, and variant cards", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const res = await page.goto("/components/accordion");
    expect(res?.status(), "status").toBeLessThan(400);
    await expect(page.getByRole("heading", { name: "Accordion" })).toBeVisible();
    await expect(page.getByText("Basic", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Multiple", { exact: true }).first()).toBeVisible();
    expect(errors, "pageerrors").toEqual([]);
  });

  test("Basic variant accordion item expands and shows answer", async ({ page }) => {
    await page.goto("/components/accordion");
    const trigger = page
      .getByRole("button", { name: /What pricing plans are available/ })
      .first();
    await expect(trigger).toBeVisible();
    await trigger.click();
    await expect(
      page.getByText(/We offer Free, Pro.*and Business.*plans/).first()
    ).toBeVisible();
  });

  test("catalog Accordion card links to the detail page", async ({ page }) => {
    await page.goto("/components");
    await page.getByRole("link", { name: /Accordion/ }).first().click();
    await expect(page).toHaveURL(/\/components\/accordion/);
    await expect(page.getByRole("heading", { name: "Accordion" })).toBeVisible();
  });
});
