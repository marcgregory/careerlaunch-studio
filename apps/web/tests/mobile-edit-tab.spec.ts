import { expect, test } from "@playwright/test";

const MOBILE = { width: 375, height: 812 };

test.use({ viewport: MOBILE });

test.describe("Mobile Builder - Edit Tab QA", () => {
  test("edit tab has no overflow and cards fit viewport", async ({ page }) => {
    const runId = Date.now();
    const email = `mobile-qa-${runId}@example.com`;

    await page.goto("/register");
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Name").fill("Mobile QA Test");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("password-123");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await page.waitForLoadState("networkidle");

    await page.locator('a[href*="/builder"]').first().click();
    await expect(page).toHaveURL(/\/builder\?resumeId=/);

    await page.getByRole("tab", { name: "Edit" }).click();
    await page.waitForTimeout(1500);

    // No horizontal scroll
    const overflow = await page.evaluate(() => {
      const body = document.body;
      return { scrollWidth: body.scrollWidth, clientWidth: body.clientWidth };
    });
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 2);
  });

  test("all section cards fit within viewport width", async ({ page }) => {
    const runId = Date.now();
    const email = `mobile-card-${runId}@example.com`;

    await page.goto("/register");
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Name").fill("Mobile Card Test");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("password-123");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await page.waitForLoadState("networkidle");

    await page.locator('a[href*="/builder"]').first().click();
    await expect(page).toHaveURL(/\/builder\?resumeId=/);

    await page.getByRole("tab", { name: "Edit" }).click();
    await page.waitForTimeout(1500);

    const cards = await page.evaluate(() => {
      const sections = document.querySelectorAll("section");
      return Array.from(sections).map((s, i) => {
        const r = s.getBoundingClientRect();
        const h2 = s.querySelector("h2");
        return {
          index: i,
          text: h2?.textContent?.trim() || s.textContent?.trim().slice(0, 30),
          w: Math.round(r.width),
        };
      }).filter(s => s.w > 0);
    });

    for (const card of cards) {
      expect(card.w).toBeLessThanOrEqual(345);
    }
  });
});
