import { test, expect } from "@playwright/test";

// ── Mail App ──────────────────────────────────────────────────────────────────

test.describe("Mail app", () => {
  test("renders with Inbox sidebar and a seeded sender", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const res = await page.goto("/apps/mail");
    expect(res?.status()).toBeLessThan(400);
    // Sidebar folder
    await expect(page.getByText("Inbox", { exact: true }).first()).toBeVisible();
    // Seeded sender name in the mail list
    await expect(
      page.getByText("William Smith", { exact: true }).first()
    ).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("clicking an email shows its body in the reading pane", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/apps/mail");

    // Click the "Meeting Tomorrow" email row by its subject text in the list
    await page.getByText("Meeting Tomorrow", { exact: true }).first().click();

    // Reading pane should show body text unique to that email (exact: false because
    // the body is a single whitespace-pre-wrap text node)
    await expect(
      page
        .getByText("Looking forward to our discussion.", { exact: false })
        .first()
    ).toBeVisible();

    // The reply textarea confirms the pane is active
    await expect(
      page.getByPlaceholder("Write a reply...").first()
    ).toBeVisible();

    // Now click a different email — "Budget Allocation" (Emily Davis)
    await page.getByText("Budget Allocation", { exact: true }).first().click();

    // Reading pane content should change — unique body text from mail-3
    await expect(
      page
        .getByText("I've had a chance to review the latest budget proposal in detail", {
          exact: false,
        })
        .first()
    ).toBeVisible();

    // Previous email body should no longer be visible
    await expect(
      page
        .getByText("Looking forward to our discussion.", { exact: false })
        .first()
    ).not.toBeVisible();

    expect(errors).toEqual([]);
  });

  test("search filters the mail list", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/apps/mail");

    const searchInput = page.getByPlaceholder("Search").first();
    await expect(searchInput).toBeVisible();

    // "Invoice" only appears in mail-10 (James Martinez, "Invoice #1042 Due")
    await searchInput.fill("Invoice");

    await expect(
      page.getByText("Invoice #1042 Due", { exact: true }).first()
    ).toBeVisible();

    // "Meeting Tomorrow" should not be visible after filter
    await expect(
      page.getByText("Meeting Tomorrow", { exact: true }).first()
    ).not.toBeVisible();

    expect(errors).toEqual([]);
  });
});

// ── Chats App ─────────────────────────────────────────────────────────────────

test.describe("Chats app", () => {
  test("renders conversation list with a seeded contact", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const res = await page.goto("/apps/chats");
    expect(res?.status()).toBeLessThan(400);
    // Seeded contact name in conversation list
    await expect(
      page.getByText("Jacquenetta Slowgrave", { exact: true }).first()
    ).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("selecting a conversation shows its thread and sending appends a message", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/apps/chats");

    // Click Farand Hume's conversation row
    await page.getByText("Farand Hume", { exact: true }).first().click();

    // Thread should show a message from that conversation
    await expect(
      page.getByText("Hey Farand, are you around?", { exact: true }).first()
    ).toBeVisible();

    // Fill the message input and press Enter
    const msgInput = page.getByPlaceholder("Type a message...");
    await expect(msgInput).toBeVisible();
    await msgInput.fill("Hello from test");
    await msgInput.press("Enter");

    // The sent message should appear in the thread
    await expect(
      page.getByText("Hello from test", { exact: true }).first()
    ).toBeVisible();

    expect(errors).toEqual([]);
  });

  test("search filters the conversation list", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/apps/chats");

    const searchInput = page.getByPlaceholder("Search").first();
    await expect(searchInput).toBeVisible();

    // "Priya" is a unique prefix — matches "Priya Nair" only
    await searchInput.fill("Priya");

    await expect(
      page.getByText("Priya Nair", { exact: true }).first()
    ).toBeVisible();

    // "Jacquenetta Slowgrave" should not be visible after filter
    await expect(
      page.getByText("Jacquenetta Slowgrave", { exact: true }).first()
    ).not.toBeVisible();

    expect(errors).toEqual([]);
  });
});
