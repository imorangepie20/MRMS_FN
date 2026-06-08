import { test, expect } from "@playwright/test";

const dashboards = [
  {
    href: "/dashboard/ecommerce",
    marks: ["Recent Orders", "Customer Reviews", "Sales by Location"],
  },
  {
    href: "/dashboard/sales",
    marks: ["Track Order Status", "Best Selling Product", "On Progress"],
  },
  {
    href: "/dashboard/crm",
    marks: ["Sales Pipeline", "Leads by Source", "Your target is incomplete"],
  },
];

for (const d of dashboards) {
  test(`${d.href} renders without error`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const res = await page.goto(d.href);
    expect(res?.status(), `status ${d.href}`).toBeLessThan(400);
    for (const m of d.marks) {
      await expect(
        page.getByText(m, { exact: true }).first(),
        `"${m}" on ${d.href}`
      ).toBeVisible();
    }
    expect(errors, `pageerrors on ${d.href}`).toEqual([]);
  });
}
