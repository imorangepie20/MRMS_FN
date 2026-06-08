import { test, expect } from "@playwright/test";

const authPages = [
  { href: "/login", mark: "Sign in" },
  { href: "/register", mark: "Create account" },
  { href: "/forgot-password", mark: "Send reset link" },
  { href: "/reset-password", mark: "Reset password" },
  { href: "/verify", mark: "Verify" },
];

for (const p of authPages) {
  test(`${p.href} renders the auth form`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const res = await page.goto(p.href);
    expect(res?.status(), `status ${p.href}`).toBeLessThan(400);
    await expect(page.getByRole("button", { name: p.mark }).first()).toBeVisible();
    expect(errors, `pageerrors on ${p.href}`).toEqual([]);
  });
}

test("login links to register and forgot-password", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("link", { name: "Sign up" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Forgot password?" })).toBeVisible();
});
