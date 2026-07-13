import { expect, test, type Page } from "@playwright/test";

async function registerSession(page: Page) {
  const email = `e2e-route-guard-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const response = await page.request.post("/api/auth/register", {
    data: { email, name: "E2E Route Guard User", password: "password-123" },
    headers: { "x-forwarded-for": `e2e-${email}` },
    maxRedirects: 0,
  });

  expect(response.status()).toBe(303);
}

test("all guest-only auth pages redirect signed-in users", async ({ page }) => {
  test.skip(!process.env.DATABASE_URL, "Set DATABASE_URL to run the database-backed e2e path.");
  await registerSession(page);

  for (const path of ["/login", "/register", "/forgot-password", "/reset-password?token=test&email=test@example.com"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/dashboard$/);
  }
});

test("all authenticated client pages redirect anonymous visitors", async ({ page }) => {
  for (const path of ["/billing", "/account/billing", "/import"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
  }
});

test("verify-email remains public and uses a session-aware header", async ({ page }) => {
  await page.goto("/verify-email");
  await expect(page.getByRole("link", { name: "Sign in", exact: true }).first()).toHaveAttribute("href", "/login");

  test.skip(!process.env.DATABASE_URL, "Set DATABASE_URL to run the database-backed e2e path.");
  await registerSession(page);
  await page.goto("/verify-email");

  await expect(page.getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/dashboard");
});
