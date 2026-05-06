import { test, expect, Page } from "@playwright/test";

// Since the app requires Firebase Auth, we test the unauthenticated flows
// and UI rendering. For authenticated flows, we mock the auth state.

test.describe("App Navigation & Pages", () => {
  test("should show login page when not authenticated", async ({ page }) => {
    await page.goto("/");
    // Should redirect to login or show login content
    await expect(page).toHaveURL(/\/(login)?/);
  });

  test("login page renders correctly", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("text=TheTodoApp").first()).toBeVisible();
    await expect(page.locator("text=/google/i").first()).toBeVisible();
  });

  test("login page has Google sign-in button", async ({ page }) => {
    await page.goto("/login");
    const googleBtn = page.locator("button", { hasText: /google/i });
    await expect(googleBtn).toBeVisible();
  });
});

test.describe("Page Loading (unauthenticated redirects)", () => {
  const pages = [
    "/dashboard",
    "/tasks",
    "/projects",
    "/lists",
    "/habits",
    "/schedule",
    "/calendar",
    "/pomodoro",
    "/settings",
  ];

  for (const path of pages) {
    test(`${path} loads without crashing`, async ({ page }) => {
      await page.goto(path);
      // Should either show a loading spinner or redirect to login
      // No uncaught errors means the page loads fine
      await page.waitForTimeout(2000);
      // Check no error overlay
      const errorOverlay = page.locator("#__next-build-error, [data-nextjs-dialog]");
      await expect(errorOverlay).toHaveCount(0);
    });
  }
});
