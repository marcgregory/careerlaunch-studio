import { expect, test, type APIRequestContext } from "@playwright/test";

const hasDatabase = Boolean(process.env.DATABASE_URL);
const PDF_SIZE_TOLERANCE_RATIO = 0.1;

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
  const resumeId = new URL(builderUrl).searchParams.get("resumeId");

  await saveResume(page.request, resumeId, resumeTitle);
  await page.getByRole("link", { name: "Back to dashboard" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByText(resumeTitle)).toBeVisible();

  await page.goto(builderUrl);
  await expect(page.getByText(resumeTitle)).toBeVisible();
  const exportResponse = await page.request.post("/api/export/pdf", { data: { resumeId } });
  expect(exportResponse.ok()).toBe(true);
  expect(exportResponse.headers()["content-type"]).toContain("application/pdf");
  expect((await exportResponse.body()).subarray(0, 4).toString()).toBe("%PDF");
});

test("PDF export is stable across repeated renders of the same resume", async ({ page }) => {
  test.skip(!hasDatabase, "Set DATABASE_URL to run the database-backed e2e path.");

  const runId = Date.now();
  const email = `e2e-pdf-${runId}@example.com`;
  const resumeTitle = `E2E PDF Regression ${runId}`;
  await page.goto("/register");
  await page.getByLabel("Name").fill("E2E PDF User");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("password-123");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL(/\/dashboard/);
  await page.getByRole("link", { name: "New resume" }).click();
  await expect(page).toHaveURL(/\/builder\?resumeId=/);
  const resumeId = new URL(page.url()).searchParams.get("resumeId");
  await saveResume(page.request, resumeId, resumeTitle);

  const firstPdf = await exportPdf(page.request, resumeId);
  const secondPdf = await exportPdf(page.request, resumeId);
  const firstPageCount = getPdfPageCount(firstPdf);
  const secondPageCount = getPdfPageCount(secondPdf);
  const sizeDelta = Math.abs(firstPdf.length - secondPdf.length);
  const allowedDelta = Math.max(1024, firstPdf.length * PDF_SIZE_TOLERANCE_RATIO);

  expect(firstPdf.subarray(0, 4).toString()).toBe("%PDF");
  expect(secondPdf.subarray(0, 4).toString()).toBe("%PDF");
  expect(sizeDelta).toBeLessThanOrEqual(allowedDelta);
  expect(secondPageCount).toBe(firstPageCount);
  expect(firstPageCount).toBeGreaterThan(0);
});

test("signed-in user can manage builder sections and item ordering", async ({ page }) => {
  test.skip(!hasDatabase, "Set DATABASE_URL to run the database-backed e2e path.");

  const runId = Date.now();
  const email = `e2e-builder-${runId}@example.com`;
  const resumeTitle = `E2E Complete Builder ${runId}`;
  await page.goto("/register");
  await page.getByLabel("Name").fill("E2E Builder User");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("password-123");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL(/\/dashboard/);
  await page.getByRole("link", { name: "New resume" }).click();
  await expect(page).toHaveURL(/\/builder\?resumeId=/);

  await page.getByLabel("Resume title").fill(resumeTitle);
  await page.getByRole("button", { name: "Move Projects up" }).click();
  await page.getByRole("button", { name: "Move Projects up" }).click();
  await page.getByRole("button", { name: "Add project" }).click();
  await page.getByLabel("Project name").last().fill("Customer Health Dashboard");
  await page.getByLabel("Description").last().fill("Reusable reporting view for account risk signals.");
  await page.getByRole("button", { name: "Add certification" }).click();
  await page.getByLabel("Certifications item 2").fill("Google Project Management Certificate");

  const saveResponse = page.waitForResponse((response) => {
    const request = response.request();
    const postData = request.postData() ?? "";
    return (
      response.url().includes("/api/resumes/") &&
      request.method() === "PUT" &&
      postData.includes("Customer Health Dashboard") &&
      postData.includes('"projects","education"') &&
      response.ok()
    );
  });
  await page.getByRole("button", { name: "Move Projects up" }).click();
  await saveResponse;

  await expect(page.getByText("Saved", { exact: true })).toBeVisible({ timeout: 10_000 });
  await expect(page.locator("article").getByRole("heading", { name: "Projects" })).toBeVisible();
  await expect(page.locator("article").getByText("Customer Health Dashboard")).toBeVisible();
  await expect(page.locator("article").getByText("Google Project Management Certificate")).toBeVisible();

  const builderUrl = page.url();
  await page.getByRole("link", { name: "Back to dashboard" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto(builderUrl);
  await expect(page.locator("article").getByText("Customer Health Dashboard")).toBeVisible();
});

async function saveResume(request: APIRequestContext, resumeId: string | null, title: string) {
  expect(resumeId).toBeTruthy();
  const response = await request.put(`/api/resumes/${resumeId}`, {
    data: {
      id: resumeId,
      title,
      targetRole: "Customer Success Lead"
    }
  });
  expect(response.ok()).toBe(true);
}

async function exportPdf(request: APIRequestContext, resumeId: string | null) {
  expect(resumeId).toBeTruthy();
  const response = await request.post("/api/export/pdf", { data: { resumeId } });
  expect(response.ok()).toBe(true);
  expect(response.headers()["content-type"]).toContain("application/pdf");
  return response.body();
}

function getPdfPageCount(pdf: Buffer) {
  const content = pdf.toString("latin1");
  const matches = content.match(/\/Type\s*\/Page\b/g);
  return matches?.length ?? 0;
}