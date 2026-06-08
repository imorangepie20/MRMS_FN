import { test, expect } from "@playwright/test";

const dashboards = [
  {
    href: "/dashboard/hotel",
    marks: ["Booking List", "Campaign Overview", "Recent Activities"],
  },
  {
    href: "/dashboard/hospital",
    marks: ["Top Treatment", "Upcoming Appointments", "Patients by Department"],
  },
  {
    href: "/dashboard/real-estate",
    marks: ["The Somerset", "Sales Analytics", "Property Overview"],
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
