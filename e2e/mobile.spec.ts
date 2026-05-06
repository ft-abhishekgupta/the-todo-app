import { test, expect } from "@playwright/test";

test.describe("Mobile Responsiveness", () => {
  test.use({ viewport: { width: 375, height: 667 } }); // iPhone SE

  test("login page is mobile-friendly", async ({ page }) => {
    await page.goto("/login");
    await page.waitForTimeout(1000);

    // Check that the page content fits within viewport (no horizontal scroll)
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(375 + 20); // small tolerance
  });

  test("all pages render at mobile width", async ({ page }) => {
    const pages = ["/login", "/dashboard", "/tasks", "/habits", "/pomodoro", "/calendar", "/projects", "/settings"];

    for (const path of pages) {
      await page.goto(path);
      await page.waitForTimeout(1500);

      // No horizontal overflow
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      const viewportWidth = await page.evaluate(() => window.innerWidth);
      expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 20);
    }
  });
});

test.describe("Tablet Responsiveness", () => {
  test.use({ viewport: { width: 768, height: 1024 } }); // iPad

  test("pages render at tablet width", async ({ page }) => {
    const pages = ["/login", "/dashboard", "/tasks", "/habits"];

    for (const path of pages) {
      await page.goto(path);
      await page.waitForTimeout(1500);

      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      const viewportWidth = await page.evaluate(() => window.innerWidth);
      expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 20);
    }
  });
});
