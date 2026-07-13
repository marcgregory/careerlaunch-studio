import { expect, test } from "@playwright/test";

test("login redirects signed-in users to the dashboard", async ({ page }) => {
  test.skip(!process.env.DATABASE_URL, "Set DATABASE_URL to run the database-backed e2e path.");

  const email = `e2e-login-guard-${Date.now()}@example.com`;
  const response = await page.request.post("/api/auth/register", {
    data: { email, name: "E2E Login Guard User", password: "password-123" },
    headers: { "x-forwarded-for": `e2e-${email}` },
    maxRedirects: 0,
  });

  expect(response.status()).toBe(303);
  expect(response.headers()["set-cookie"]).toContain("careerlaunch_session");

  await page.goto("/login");

  await expect(page).toHaveURL(/\/dashboard/);
});
