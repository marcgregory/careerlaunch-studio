import { PrismaClient } from "@prisma/client";
import { expect, test, type APIRequestContext } from "@playwright/test";

const prisma = new PrismaClient();

test.afterAll(async () => {
  await prisma.$disconnect();
});

const hasDatabase = Boolean(process.env.DATABASE_URL);
const PDF_SIZE_TOLERANCE_RATIO = 0.1;

async function registerE2EUser(request: APIRequestContext, user: { email: string; name: string }) {
  const response = await request.post("/api/auth/register", {
    data: { email: user.email, name: user.name, password: "password-123" },
    headers: { "x-forwarded-for": `e2e-${user.email}` },
    maxRedirects: 0,
  });

  if (response.status() === 429) {
    const body = await response.json().catch(() => ({}));
    throw new Error(`Expected isolated E2E registration, got rate limited: ${JSON.stringify(body)}`);
  }

  expect(response.status()).toBe(303);
  expect(response.headers()["set-cookie"]).toContain("careerlaunch_session");
}

async function upgradeE2EUser(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  expect(user).toBeTruthy();

  await prisma.subscription.upsert({
    where: { userId: user!.id },
    create: {
      userId: user!.id,
      plan: "PROFESSIONAL",
      status: "ACTIVE",
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
    update: {
      plan: "PROFESSIONAL",
      status: "ACTIVE",
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });
}

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
  await registerE2EUser(page.request, { email, name: "E2E User" });
  await page.goto("/dashboard");

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
  await registerE2EUser(page.request, { email, name: "E2E PDF User" });
  await page.goto("/dashboard");

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
  await registerE2EUser(page.request, { email, name: "E2E Builder User" });
  await upgradeE2EUser(email);
  await page.goto("/dashboard");

  await expect(page).toHaveURL(/\/dashboard/);
  await page.getByRole("link", { name: "New resume" }).click();
  await expect(page).toHaveURL(/\/builder\?resumeId=/);

  await page.getByLabel("File name").fill(resumeTitle);
  await page.getByRole("button", { name: "Move Projects up" }).click();
  await page.getByRole("button", { name: "Move Projects up" }).click();
  await page.getByRole("button", { name: "Add project" }).click();
  await page.getByLabel("Project name").last().fill("Customer Health Dashboard");
  await page.getByLabel("Description").last().fill("Reusable reporting view for account risk signals.");
  await page.getByRole("button", { name: "Add certification" }).click();
  await page.getByLabel("Certifications item 1").fill("Google Project Management Certificate");

  // Scroll the Executive template into view and click to switch
  const execButton = page.getByRole("button", { name: /Executive Ledger/ });
  await execButton.scrollIntoViewIfNeeded();
  await execButton.click();
  await expect(page.locator("article")).toHaveAttribute("data-template", "executive");

  const saveResponse = page.waitForResponse((response) => {
    const request = response.request();
    const postData = request.postData() ?? "";
    return (
      response.url().includes("/api/resumes/") &&
      request.method() === "PUT" &&
      postData.includes("Customer Health Dashboard") &&
      postData.includes('"templateId":"executive"') &&
      response.ok()
    );
  });
  await page.getByRole("button", { name: "Move Projects up" }).click();
  await saveResponse;

  await expect(page.getByText("Saved", { exact: true })).toBeVisible({ timeout: 10_000 });
  await expect(page.locator("article").getByRole("heading", { name: "Projects" })).toBeVisible();
  await expect(page.locator("article").getByText("Customer Health Dashboard")).toBeVisible();
  await expect(page.locator("article").getByText("Google Project Management Certificate")).toBeVisible();
  await expect(page.locator("article")).toHaveAttribute("data-template", "executive");

  const builderUrl = page.url();
  await page.getByRole("link", { name: "Back to dashboard" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto(builderUrl);
  await expect(page.locator("article").getByText("Customer Health Dashboard")).toBeVisible();
  await expect(page.locator("article")).toHaveAttribute("data-template", "executive");
});

test("all templates render without visual regression", async ({ page }) => {
  test.skip(!hasDatabase, "Set DATABASE_URL to run screenshot-based e2e path.");

  const runId = Date.now();
  const email = `e2e-visual-${runId}@example.com`;
  const resumeTitle = `E2E Visual ${runId}`;
  await registerE2EUser(page.request, { email, name: "E2E Visual User" });
  await upgradeE2EUser(email);
  await page.goto("/dashboard");

  await expect(page).toHaveURL(/\/dashboard/);
  await page.getByRole("link", { name: "New resume" }).click();
  await expect(page).toHaveURL(/\/builder\?resumeId=/);

  // Fill in enough data so every template has content to render
  await page.getByLabel("File name").fill(resumeTitle);
  await page.getByLabel("Target role").fill("Customer Success Manager");
  await page.getByLabel("Full name").fill("Jordan Lee");
  await page.getByLabel("Email").fill("jordan@example.com");
  await page.getByLabel("Phone").fill("(555) 123-4567");

  const templates = ["modern", "executive", "minimal", "ats"] as const;
  const templateNames = ["Signal Modern", "Executive Ledger", "Quiet Grid", "ATS Classic"];

  for (let i = 0; i < templates.length; i++) {
    const templateId = templates[i];
    // Scroll the template sidebar into view so the click lands
    const galleryButton = page.getByRole("button", { name: templateNames[i], exact: false });
    await galleryButton.scrollIntoViewIfNeeded();
    await galleryButton.click();

    // Wait for preview to reflect the selected template
    await expect(page.locator("article")).toHaveAttribute("data-template", templateId, { timeout: 5_000 });

    // Wait for fonts to fully render before capturing the screenshot
    await page.evaluate(() => (document as any).fonts.ready);

    // Compare the preview card against the baseline (locator-scoped, captures only the element)
    // Allow a small threshold for cross-run font rendering variance in parallel CI
    await expect(page.locator("article")).toHaveScreenshot(`template-${templateId}.png`, { maxDiffPixelRatio: 0.02 });
  }
});

test("each template exports a valid PDF", async ({ page }) => {
  test.skip(!hasDatabase, "Set DATABASE_URL to run the PDF QA e2e path.");

  const runId = Date.now();
  const email = `e2e-pdfqa-${runId}@example.com`;
  const resumeTitle = `E2E PDF QA ${runId}`;
  await registerE2EUser(page.request, { email, name: "E2E PDF QA User" });
  await upgradeE2EUser(email);
  await page.goto("/dashboard");

  await expect(page).toHaveURL(/\/dashboard/);
  await page.getByRole("link", { name: "New resume" }).click();
  await expect(page).toHaveURL(/\/builder\?resumeId=/);
  const resumeId = new URL(page.url()).searchParams.get("resumeId");

  // Fill resume data and save it
  await page.getByLabel("File name").fill(resumeTitle);
  await page.getByLabel("Full name").fill("Jordan Lee");
  await page.getByLabel("Email").fill("jordan@example.com");
  await page.getByLabel("Phone").fill("(555) 123-4567");
  await saveResume(page.request, resumeId, resumeTitle);

  const templates = ["modern", "executive", "minimal", "ats"] as const;

  for (const templateId of templates) {
    // Switch template by saving with the new templateId
    const saveResponse = await page.request.put(`/api/resumes/${resumeId}`, {
      data: { id: resumeId, title: resumeTitle, templateId },
    });
    expect(saveResponse.ok()).toBe(true);

    // Export PDF for this template
    const pdf = await exportPdf(page.request, resumeId);
    const pdfPageCount = getPdfPageCount(pdf);

    expect(pdf.length).toBeGreaterThan(1024);
    expect(pdfPageCount).toBeGreaterThan(0);
    expect(pdfPageCount).toBeLessThanOrEqual(2);
  }
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