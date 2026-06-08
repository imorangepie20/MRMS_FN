import { test, expect } from "@playwright/test";

// ── Social App ────────────────────────────────────────────────────────────────

test.describe("Social app", () => {
  test("renders center feed and sidebar suggestions", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const res = await page.goto("/apps/social");
    expect(res?.status()).toBeLessThan(400);
    // Sidebar heading
    await expect(
      page.getByText("Suggestions for You", { exact: true }).first()
    ).toBeVisible();
    // Seeded post author handle in feed
    await expect(
      page.getByText("@crunchtech", { exact: true }).first()
    ).toBeVisible();
    // Seeded post content snippet
    await expect(
      page
        .getByText("Just shipped a new photography portfolio", { exact: false })
        .first()
    ).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("like button toggles count on first post", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/apps/social");

    // The first post (crunchtech) has 1,243 likes → formatCount(1243) = "1.2k"
    // The like button contains the heart icon + count text inside a <button>
    // We target the first post card's footer like button by its current count text.
    const likeBtn = page
      .locator("button")
      .filter({ hasText: "1.2k" })
      .first();
    await expect(likeBtn).toBeVisible();

    // Click to like — count should increment to 1,244 → formatCount(1244) = "1.2k" still
    // Instead, verify the button gains the red color class (liked state)
    await likeBtn.click();

    // After liking, the heart text color becomes red-500; the button loses muted-foreground
    // The simplest assertable change: text-red-500 class appears on the button
    await expect(likeBtn).toHaveClass(/text-red-500/);

    // Click again to unlike — should revert
    await likeBtn.click();
    await expect(likeBtn).not.toHaveClass(/text-red-500/);

    expect(errors).toEqual([]);
  });

  test("create post prepends new post to feed", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/apps/social");

    const uniqueText = "Test post 123";

    // Type in the create-post textarea
    await page
      .getByPlaceholder("What's on your mind?")
      .first()
      .fill(uniqueText);

    // Click the Post button
    await page.getByRole("button", { name: "Post", exact: true }).first().click();

    // The new post should appear in the feed
    await expect(
      page.getByText(uniqueText, { exact: true }).first()
    ).toBeVisible();

    expect(errors).toEqual([]);
  });
});

// ── Calendar App ──────────────────────────────────────────────────────────────

test.describe("Calendar app", () => {
  test("renders June 2026 grid and a seeded event", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const res = await page.goto("/apps/calendar");
    expect(res?.status()).toBeLessThan(400);
    // Header shows current month
    await expect(
      page.getByText("June 2026", { exact: true }).first()
    ).toBeVisible();
    // A seeded event title visible on the grid — Juneteenth is "All day" so no time
    // prefix, making it the sole text node in its chip element.
    await expect(
      page.getByText("Juneteenth", { exact: true }).first()
    ).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("next-month chevron navigates to July 2026, Today returns to June 2026", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/apps/calendar");

    // Use aria-label added to the next-month button
    await page
      .getByRole("button", { name: "Next month", exact: true })
      .first()
      .click();

    // Header should now show July 2026
    await expect(
      page.getByText("July 2026", { exact: true }).first()
    ).toBeVisible();

    // Click Today to return
    await page
      .getByRole("button", { name: "Today", exact: true })
      .first()
      .click();

    // Header should revert to June 2026
    await expect(
      page.getByText("June 2026", { exact: true }).first()
    ).toBeVisible();

    expect(errors).toEqual([]);
  });

  test("unchecking Family calendar hides Family events", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/apps/calendar");

    // "Dad's Birthday" belongs to the Family calendar (calendarId: "family")
    // It should be visible on the grid initially
    await expect(
      page.getByText("Dad's Birthday", { exact: true }).first()
    ).toBeVisible();

    // Find the Family calendar label and uncheck its checkbox
    // The label wraps a Checkbox + span text "Family"
    const familyLabel = page
      .locator("label")
      .filter({ hasText: "Family" })
      .first();
    await familyLabel.click();

    // After unchecking Family, Dad's Birthday should no longer be visible
    await expect(
      page.getByText("Dad's Birthday", { exact: true }).first()
    ).not.toBeVisible();

    expect(errors).toEqual([]);
  });

  test("Add Event modal creates a new event in the feed", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/apps/calendar");

    // Open the modal
    await page
      .getByRole("button", { name: "Add Event", exact: true })
      .first()
      .click();

    // Modal heading should appear
    await expect(
      page.getByText("Add Event", { exact: true }).first()
    ).toBeVisible();

    // Fill in the title
    await page.getByPlaceholder("Event title").first().fill("My New Test Event");

    // Submit
    await page
      .getByRole("button", { name: "Add Event", exact: true })
      .last()
      .click();

    // New event should appear on the calendar grid (day 15 is the default)
    await expect(
      page.getByText("My New Test Event", { exact: true }).first()
    ).toBeVisible();

    expect(errors).toEqual([]);
  });
});
