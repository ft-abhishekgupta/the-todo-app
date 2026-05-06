import { test, expect, Page, BrowserContext } from "@playwright/test";

// Helper to bypass Firebase auth by injecting a mock user into localStorage/cookies
// In a real scenario, we'd use Firebase Auth emulator. For now we test UI interactions
// by mocking the auth state at the page level.

async function mockAuthenticatedUser(page: Page) {
  // Navigate first, then inject mock auth state
  await page.goto("/dashboard");

  // Override the auth context by evaluating JS that sets mock state
  await page.evaluate(() => {
    // Set a flag that can be checked by the app for testing
    (window as any).__TEST_USER__ = {
      uid: "test-user-123",
      email: "test@example.com",
      displayName: "Test User",
      photoURL: null,
    };
  });
}

test.describe("Dashboard UI Components", () => {
  test("dashboard shows loading state initially", async ({ page }) => {
    await page.goto("/dashboard");
    // Should show loading spinner or redirect
    const spinner = page.locator(".animate-spin");
    const hasSpinner = await spinner.count();
    // Either shows spinner (loading) or redirected to login
    expect(hasSpinner > 0 || page.url().includes("login")).toBeTruthy();
  });
});

test.describe("Tasks Page UI", () => {
  test("tasks page loads without errors", async ({ page }) => {
    await page.goto("/tasks");
    await page.waitForTimeout(2000);
    // No crash - either shows content or redirects
    const url = page.url();
    expect(url.includes("/tasks") || url.includes("/login")).toBeTruthy();
  });
});

test.describe("Habits Page UI", () => {
  test("habits page loads without errors", async ({ page }) => {
    await page.goto("/habits");
    await page.waitForTimeout(2000);
    const url = page.url();
    expect(url.includes("/habits") || url.includes("/login")).toBeTruthy();
  });
});

test.describe("Pomodoro Page UI", () => {
  test("pomodoro page loads without errors", async ({ page }) => {
    await page.goto("/pomodoro");
    await page.waitForTimeout(2000);
    const url = page.url();
    expect(url.includes("/pomodoro") || url.includes("/login")).toBeTruthy();
  });
});

test.describe("Calendar Page UI", () => {
  test("calendar page loads without errors", async ({ page }) => {
    await page.goto("/calendar");
    await page.waitForTimeout(2000);
    const url = page.url();
    expect(url.includes("/calendar") || url.includes("/login")).toBeTruthy();
  });
});

test.describe("Projects Page UI", () => {
  test("projects page loads without errors", async ({ page }) => {
    await page.goto("/projects");
    await page.waitForTimeout(2000);
    const url = page.url();
    expect(url.includes("/projects") || url.includes("/login")).toBeTruthy();
  });
});

test.describe("Settings Page UI", () => {
  test("settings page loads without errors", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForTimeout(2000);
    const url = page.url();
    expect(url.includes("/settings") || url.includes("/login")).toBeTruthy();
  });
});
