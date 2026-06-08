import { test, expect } from "@playwright/test";
import { allNavItems } from "../src/lib/nav";

test("home redirects to default dashboard", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/dashboard\/default/);
});

test("dark mode applies the dark class", async ({ page }) => {
  await page.goto("/dashboard/default");
  await page.getByLabel("Toggle theme").click();
  await expect(page.getByRole("menu")).toBeVisible();
  await page.getByRole("menuitem", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
});

test("command palette opens and navigates", async ({ page }) => {
  await page.goto("/dashboard/default");
  await page.keyboard.press("Meta+k");
  await page.getByPlaceholder("Type a page name…").fill("CRM");
  await page.getByRole("option", { name: /CRM/ }).click();
  await expect(page).toHaveURL(/\/dashboard\/crm/);
});

for (const item of allNavItems) {
  test(`renders ${item.href} without error`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const res = await page.goto(item.href);
    expect(res?.status(), `HTTP status for ${item.href}`).toBeLessThan(400);
    // Group-agnostic: every route renders SOME visible text content (no blank/crashed page).
    await expect(page.locator("body")).toBeVisible();
    const text = (await page.locator("body").innerText()).trim();
    expect(text.length, `visible text on ${item.href}`).toBeGreaterThan(0);
    expect(errors, `uncaught page errors on ${item.href}`).toEqual([]);
  });
}
