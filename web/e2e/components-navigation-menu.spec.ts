import { test, expect } from "@playwright/test"

test.describe("Components — Navigation Menu detail", () => {
  test("renders breadcrumb, header, and variant sections", async ({ page }) => {
    const errors: string[] = []
    page.on("pageerror", (e) => errors.push(e.message))
    const res = await page.goto("/components/navigation-menu")
    expect(res?.status(), "status").toBeLessThan(400)
    await expect(
      page.getByRole("heading", { name: "Navigation Menu" })
    ).toBeVisible()
    // Variant section titles
    await expect(page.getByText("Default", { exact: true }).first()).toBeVisible()
    await expect(page.getByText("E-commerce", { exact: true }).first()).toBeVisible()
    await expect(page.getByText("Simple links", { exact: true }).first()).toBeVisible()
    // Getting started trigger visible
    await expect(
      page.getByRole("button", { name: "Getting started" }).first()
    ).toBeVisible()
    expect(errors, "pageerrors").toEqual([])
  })

  test("Getting started trigger opens dropdown with Introduction link", async ({
    page,
  }) => {
    await page.goto("/components/navigation-menu")
    const trigger = page.getByRole("button", { name: "Getting started" }).first()
    await expect(trigger).toBeVisible()
    await trigger.click()
    // Introduction link should appear in the dropdown
    await expect(page.getByText("Introduction").first()).toBeVisible()
  })

  test("catalog Navigation Menu card links to the detail page", async ({ page }) => {
    await page.goto("/components")
    await page.locator('a[href="/components/navigation-menu"]').first().click()
    await expect(page).toHaveURL(/\/components\/navigation-menu$/)
    await expect(
      page.getByRole("heading", { name: "Navigation Menu" })
    ).toBeVisible()
  })
})
