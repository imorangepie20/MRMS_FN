import { test, expect } from "@playwright/test";

// ── Todo App ──────────────────────────────────────────────────────────────────

test.describe("Todo app", () => {
  test("renders All Tasks view with seeded tasks", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const res = await page.goto("/apps/todo");
    expect(res?.status()).toBeLessThan(400);
    await expect(page.getByText("All Tasks", { exact: true }).first()).toBeVisible();
    // At least one seeded task title is visible
    await expect(
      page.getByText("Finish dashboard design mockups", { exact: true }).first()
    ).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("search filters task list", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/apps/todo");

    const searchInput = page.getByPlaceholder("Search tasks…");
    await expect(searchInput).toBeVisible();

    // "dentist" is a unique substring of "Schedule dentist appointment" only
    await searchInput.fill("dentist");

    await expect(
      page.getByText("Schedule dentist appointment", { exact: true }).first()
    ).toBeVisible();
    // "Finish dashboard design mockups" should no longer be visible
    await expect(
      page.getByText("Finish dashboard design mockups", { exact: true }).first()
    ).not.toBeVisible();
    expect(errors).toEqual([]);
  });

  test("checkbox toggles task completed state", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/apps/todo");

    // The first checkbox in the task list area (after the AddTaskRow input area)
    // The task rows render Checkbox components with role="checkbox"
    const checkboxes = page.getByRole("checkbox");
    // Wait for at least one checkbox to be visible
    await expect(checkboxes.first()).toBeVisible();

    // Find the first uncompleted task checkbox (t1 "Finish dashboard design mockups" is unchecked)
    // We'll click the first checkbox in the list area — the first task row's checkbox
    // The AddTaskRow has no checkbox, so we get all checkboxes (task rows only)
    const firstTaskCheckbox = checkboxes.first();
    const initialChecked = await firstTaskCheckbox.isChecked();

    await firstTaskCheckbox.click();

    // After clicking, the checked state should have toggled
    await expect(firstTaskCheckbox).toHaveAttribute(
      "aria-checked",
      initialChecked ? "false" : "true"
    );
    expect(errors).toEqual([]);
  });
});

// ── Tasks (TanStack Table) App ────────────────────────────────────────────────

test.describe("Tasks table app", () => {
  test("renders Tasks heading and TASK- id", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const res = await page.goto("/apps/tasks");
    expect(res?.status()).toBeLessThan(400);
    await expect(page.getByText("Tasks", { exact: true }).first()).toBeVisible();
    // At least one TASK-NNNN id visible in the table
    await expect(page.getByText("TASK-8782", { exact: true }).first()).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("search filters task rows", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/apps/tasks");

    const filterInput = page.getByPlaceholder("Filter tasks...");
    await expect(filterInput).toBeVisible();

    // "bypass the neural TCP" matches only TASK-7839 title (page 1 task)
    await filterInput.fill("bypass the neural TCP");

    // The matching task title should be visible
    await expect(
      page.getByText("We need to bypass the neural TCP card!", { exact: true }).first()
    ).toBeVisible();

    // A different page-1 task that doesn't match should NOT be visible
    await expect(
      page.getByText("TASK-8782", { exact: true }).first()
    ).not.toBeVisible();
    expect(errors).toEqual([]);
  });

  test("pagination shows page indicator and can advance to page 2", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/apps/tasks");

    // Initial state: Page 1 of 5
    await expect(page.getByText("Page 1 of", { exact: false }).first()).toBeVisible();

    // Click next page button
    await page.getByRole("button", { name: "Go to next page" }).click();

    // Should now show Page 2 of 5
    await expect(page.getByText("Page 2 of", { exact: false }).first()).toBeVisible();
    expect(errors).toEqual([]);
  });
});
