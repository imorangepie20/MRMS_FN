import { test, expect } from "@playwright/test";

const dashboards = [
  {
    href: "/dashboard/project-management",
    marks: ["Recent Projects", "Achievement by Year", "Reminders"],
  },
  {
    href: "/dashboard/analytics",
    marks: ["Sales by Countries", "Traffic Sources", "Monthly Campaign State"],
  },
  {
    href: "/dashboard/file-manager",
    marks: ["Recently Uploaded Files", "Storage Space Used", "Monthly File Transfer"],
  },
  {
    href: "/dashboard/academy",
    marks: ["Leaderboard", "Learning Path", "Popular Courses"],
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
