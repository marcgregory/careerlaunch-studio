import { expect, test } from "@playwright/test";

for (const path of ["/privacy", "/terms"]) {
  test(`${path} shows sign in to anonymous visitors`, async ({ page }) => {
    await page.goto(path);

    await expect(page.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
  });

  test(`${path} shows dashboard to signed-in users`, async ({ page }) => {
    test.skip(!process.env.DATABASE_URL, "Set DATABASE_URL to run the database-backed e2e path.");

    const email = `e2e-legal-nav-${path.slice(1)}-${Date.now()}@example.com`;
    const response = await page.request.post("/api/auth/register", {
      data: { email, name: "E2E Legal Nav User", password: "password-123" },
      headers: { "x-forwarded-for": `e2e-${email}` },
      maxRedirects: 0,
    });

    expect(response.status()).toBe(303);
    await page.goto(path);

    await expect(page.getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/dashboard");
    await expect(page.getByRole("link", { name: "Sign in" })).toHaveCount(0);
  });
}
