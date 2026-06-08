import { test, expect } from "@playwright/test";

// ─── AI Chat ──────────────────────────────────────────────────────────────────

test.describe("AI Chat app", () => {
  test("renders sidebar and welcome heading", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const res = await page.goto("/ai/chat");
    expect(res?.status()).toBeLessThan(400);
    // Sidebar "New Chat" button
    await expect(page.getByRole("button", { name: "New Chat" }).first()).toBeVisible();
    // Welcome heading visible in empty state
    await expect(
      page.getByText("How can I help you today?", { exact: true }).first()
    ).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("suggested prompt is visible", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/ai/chat");
    // First suggested prompt from SUGGESTED_PROMPTS
    await expect(
      page.getByText("What's the latest tech trend?", { exact: true }).first()
    ).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("send a message and receive mock reply", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/ai/chat");

    // Type a known message that maps to a deterministic mock reply
    const input = page.getByPlaceholder("Message AI…");
    await input.fill("What's the latest tech trend?");
    await input.press("Enter");

    // User message should appear in thread
    // Scope to the flex-1 thread area (not the sidebar) — look inside the main chat area
    await expect(
      page.getByText("What's the latest tech trend?", { exact: true }).first()
    ).toBeVisible();

    // Mock reply substring — MOCK_REPLIES["what's the latest tech trend?"] starts with "The hottest trend"
    await expect(
      page.getByText(/The hottest trend right now is ambient AI/, { }).first()
    ).toBeVisible({ timeout: 5000 });

    expect(errors).toEqual([]);
  });
});

// ─── AI Chat V2 ───────────────────────────────────────────────────────────────

test.describe("AI Chat V2 app", () => {
  test("renders welcome hero and suggested prompts", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const res = await page.goto("/ai/chat-v2");
    expect(res?.status()).toBeLessThan(400);
    // Hero heading
    await expect(
      page.getByText("What can I help with?", { exact: true }).first()
    ).toBeVisible();
    // Suggested prompt chips
    await expect(
      page.getByText("Explain quantum computing", { exact: true }).first()
    ).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("send a message from welcome hero and receive reply", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/ai/chat-v2");

    // The welcome hero input has placeholder "Ask me anything…"
    const input = page.getByPlaceholder("Ask me anything…");
    await input.fill("Explain quantum computing");

    // Click the Send button in the hero (has text "Send")
    await page.getByRole("button", { name: "Send" }).click();

    // User message appears in thread
    await expect(
      page.getByText("Explain quantum computing", { exact: true }).first()
    ).toBeVisible();

    // Mock reply — MOCK_REPLIES["explain quantum computing"] starts with "Quantum computing harnesses"
    await expect(
      page.getByText(/Quantum computing harnesses quantum mechanical phenomena/).first()
    ).toBeVisible({ timeout: 5000 });

    expect(errors).toEqual([]);
  });
});

// ─── AI Image Generator ───────────────────────────────────────────────────────

test.describe("AI Image Generator app", () => {
  test("renders controls panel and seeded gallery", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const res = await page.goto("/ai/image-generator");
    expect(res?.status()).toBeLessThan(400);
    // Controls panel heading
    await expect(
      page.getByText("Image Settings", { exact: true }).first()
    ).toBeVisible();
    // Gallery heading
    await expect(
      page.getByText("Results", { exact: true }).first()
    ).toBeVisible();
    // Seeded image prompt visible in gallery
    await expect(
      page.getByText("Cyberpunk cityscape at night with neon lights and flying cars").first()
    ).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("fill prompt and generate new images", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/ai/image-generator");

    // Fill the prompt textarea (id="prompt", placeholder="Be specific…")
    const promptInput = page.locator("#prompt");
    await promptInput.fill("a unique test prompt xyz");

    // Click Generate button
    await page.getByRole("button", { name: "Generate" }).click();

    // After ~800ms the new image card should appear with the prompt text
    await expect(
      page.getByText("a unique test prompt xyz").first()
    ).toBeVisible({ timeout: 5000 });

    expect(errors).toEqual([]);
  });
});

// ─── AI Text to Speech ────────────────────────────────────────────────────────

test.describe("AI Text to Speech app", () => {
  test("renders editor panel and seeded clip history", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const res = await page.goto("/ai/text-to-speech");
    expect(res?.status()).toBeLessThan(400);
    // Controls card heading
    await expect(
      page.getByText("Text to Speech", { exact: true }).first()
    ).toBeVisible();
    // Seeded clip text visible in history
    await expect(
      page.getByText(/Welcome to the future of voice synthesis/).first()
    ).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("type text, verify char count updates, then generate a clip", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/ai/text-to-speech");

    const sampleText = "Hello from Playwright";

    // Type into the TTS textarea (id="tts-text")
    const textArea = page.locator("#tts-text");
    await textArea.fill(sampleText);

    // Char count should show "21 / 5000"
    await expect(
      page.getByText(`${sampleText.length} / 5000`).first()
    ).toBeVisible();

    // Click Generate Speech
    await page.getByRole("button", { name: "Generate Speech" }).click();

    // After ~700ms a new history clip with "Hello from Playwright" should appear
    await expect(
      page.getByText("Hello from Playwright").first()
    ).toBeVisible({ timeout: 5000 });

    expect(errors).toEqual([]);
  });
});
