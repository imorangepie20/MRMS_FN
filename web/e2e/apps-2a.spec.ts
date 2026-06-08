import { test, expect } from "@playwright/test";

test.describe("Kanban app", () => {
  test("renders board columns and cards", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const res = await page.goto("/apps/kanban");
    expect(res?.status()).toBeLessThan(400);
    await expect(page.getByText("Backlog", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("In Progress", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Done", { exact: true }).first()).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("renders seeded card titles in the board", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/apps/kanban");
    await expect(
      page.getByText("Integrate Stripe payment gateway").first()
    ).toBeVisible();
    await expect(
      page.getByText("Build dashboard analytics view").first()
    ).toBeVisible();
    await expect(
      page.getByText("Set up CI/CD pipeline").first()
    ).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("add a card to a column", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/apps/kanban");

    // Click "Add a card" in the Backlog column (first occurrence of the footer button)
    const addCardButtons = page.getByRole("button", { name: "Add a card" });
    await addCardButtons.first().click();

    // The inline input should appear
    const cardInput = page.getByPlaceholder("Card title…");
    await expect(cardInput).toBeVisible();

    // Type a new card title and submit
    // Use exact match to avoid matching "Add card to <Column>" aria-label buttons
    await cardInput.fill("Test Playwright Card");
    await page.getByRole("button", { name: "Add card", exact: true }).click();

    // The new card should now be visible in the board
    await expect(page.getByText("Test Playwright Card").first()).toBeVisible();
    expect(errors).toEqual([]);
  });
});

test.describe("Notes app", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/apps/notes");
  });

  test("renders 3-panel layout", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/apps/notes");
    await expect(page.getByText("All Notes", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Starred", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Archived", { exact: true }).first()).toBeVisible();
    // Sidebar categories
    await expect(page.getByText("Family", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Travel", { exact: true }).first()).toBeVisible();
    // Search input present
    await expect(page.getByPlaceholder("Search notes...")).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("selecting a note updates the editor panel", async ({ page }) => {
    // "Weekly Grocery List" is note id=2, "Project Milestones" is note id=3
    // Click "Weekly Grocery List" in the note list
    await page.getByText("Weekly Grocery List").first().click();

    // The editor title input (Input in the editor header) should reflect this note's title.
    // The editor Input has value={note.title}, key={note.id}, placeholder="Note title…"
    const titleInput = page.getByPlaceholder("Note title…");
    await expect(titleInput).toHaveValue("Weekly Grocery List");

    // Now click "Project Milestones" and assert the editor updates
    await page.getByText("Project Milestones").first().click();
    await expect(titleInput).toHaveValue("Project Milestones");
  });

  test("search filters the note list", async ({ page }) => {
    const searchInput = page.getByPlaceholder("Search notes...");
    // "Kyoto" is a unique substring of "Trip to Kyoto" and does not appear in other note titles/previews
    await searchInput.fill("Kyoto");

    // "Trip to Kyoto" should be visible
    await expect(page.getByText("Trip to Kyoto").first()).toBeVisible();

    // "Weekly Grocery List" should NOT be visible
    await expect(page.getByText("Weekly Grocery List").first()).not.toBeVisible();
  });

  test("renders seeded note titles in list", async ({ page }) => {
    // First note is pre-selected (id=1 = "Mountain Sunset Photography")
    await expect(page.getByText("Mountain Sunset Photography").first()).toBeVisible();
    await expect(page.getByText("Team Sync Notes").first()).toBeVisible();
    await expect(page.getByText("Personal Goals 2026").first()).toBeVisible();
  });
});
