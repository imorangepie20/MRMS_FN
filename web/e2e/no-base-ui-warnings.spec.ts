import { test, expect } from "@playwright/test";

/**
 * Regression guard for the Base UI "nativeButton" warning.
 *
 * When a Base UI <Button> is rendered as a link (via `render={<Link />}`)
 * without `nativeButton={false}`, Base UI logs a console warning along the
 * lines of "Base UI: A component that renders ... expected a native button
 * element ... removes native button semantics". The fix adds
 * `nativeButton={false}` on those Button-as-link usages.
 *
 * These warnings surface as console "error"/"warning" messages in dev. The
 * production build may strip them, but we still assert clean here so this spec
 * documents the regression and fails loudly if the warning ever returns.
 */

const ROUTES = [
  "/examples",
  "/error/404",
  "/error/500",
  // Hitting an unknown URL renders the root not-found page.
  "/a-nonexistent-url-xyz",
];

// Case-insensitive substrings that identify the offending Base UI warning.
const FORBIDDEN = [
  "nativebutton",
  "expected a native",
  "removes native button semantics",
];

function offending(text: string): string | null {
  const lower = text.toLowerCase();
  const hit = FORBIDDEN.find((needle) => lower.includes(needle));
  return hit ? text : null;
}

for (const route of ROUTES) {
  test(`no Base UI nativeButton warning on ${route}`, async ({ page }) => {
    const offenders: string[] = [];

    page.on("console", (msg) => {
      const hit = offending(msg.text());
      if (hit) offenders.push(`console.${msg.type()}: ${hit}`);
    });

    page.on("pageerror", (err) => {
      const hit = offending(err.message);
      if (hit) offenders.push(`pageerror: ${hit}`);
    });

    await page.goto(route);
    await page.waitForLoadState("networkidle");

    expect(
      offenders,
      `Base UI nativeButton warning(s) found on ${route}:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });
}
