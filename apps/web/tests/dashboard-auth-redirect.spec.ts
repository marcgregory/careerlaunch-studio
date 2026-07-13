import { expect, test } from "@playwright/test";

test("dashboard sends visitors without a session to plain login", async ({ page }) => {
  await page.goto("/dashboard");

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText("Your session has expired")).toHaveCount(0);
});

test("dashboard identifies an invalid session as expired", async ({ page, context }) => {
  await page.goto("/login");
  await context.addCookies([
    {
      name: "careerlaunch_session",
      value: "invalid-session",
      url: new URL(page.url()).origin,
    },
  ]);

  await page.goto("/dashboard");

  await expect(page).toHaveURL(/\/login\?session=expired$/);
  await expect(page.getByText("Your session has expired. Please sign in again.")).toBeVisible();
});
