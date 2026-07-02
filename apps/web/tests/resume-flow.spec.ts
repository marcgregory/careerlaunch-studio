import { expect, test } from "@playwright/test";

const hasDatabase = Boolean(process.env.DATABASE_URL);

test("protected builder redirects anonymous visitors to sign in", async ({ page }) => {
  await page.goto("/builder");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("signed-in user can create, save, and request a PDF export", async ({ page }) => {
  test.skip(!hasDatabase, "Set DATABASE_URL to run the database-backed e2e path.");

  const runId = Date.now();
  const email = `e2e-${runId}@example.com`;
  const resumeTitle = `E2E Persisted Resume ${runId}`;
  await page.goto("/register");
  await page.getByLabel("Name").fill("E2E User");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("password-123");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL(/\/dashboard/);
  await page.getByRole("link", { name: "New resume" }).click();
  await expect(page).toHaveURL(/\/builder\?resumeId=/);
  const builderUrl = page.url();

  const saveResponse = page.waitForResponse((response) =>
    response.url().includes("/api/resumes/") && response.request().method() === "PUT" && response.ok()
  );
  await page.getByLabel("Resume title").fill(resumeTitle);
  await saveResponse;
  await expect(page.getByText("Saved", { exact: true })).toBeVisible({ timeout: 10_000 });
  await page.getByRole("link", { name: "Back to dashboard" }).click();
  await expect(page.getByText(resumeTitle)).toBeVisible();

  await page.goto(builderUrl);
  await expect(page.getByText(resumeTitle)).toBeVisible();
  const resumeId = new URL(builderUrl).searchParams.get("resumeId");
  const exportResponse = await page.request.post("/api/export/pdf", { data: { resumeId } });
  expect(exportResponse.ok()).toBe(true);
});
