import { expect, test, type APIRequestContext } from "@playwright/test";

const hasDatabase = Boolean(process.env.DATABASE_URL);
const apiBase = "/api/resumes";

test.describe("Suggestion apply API", () => {
  let resumeId: string | null = null;
  let cookies: { name: string; value: string }[] = [];

  test.beforeEach(async ({ page, context }) => {
    test.skip(!hasDatabase, "Set DATABASE_URL to run the database-backed e2e path.");

    const runId = Date.now();
    const email = `e2e-apply-${runId}@example.com`;

    await page.goto("/register");
    await page.getByLabel("Name").fill("E2E Apply User");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("password-123");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    // Create a resume
    await page.getByRole("link", { name: "New resume" }).click();
    await expect(page).toHaveURL(/\/builder\?resumeId=/);
    resumeId = new URL(page.url()).searchParams.get("resumeId");

    // Extract cookies for direct API calls
    cookies = await context.cookies();
  });

  test("accepts a suggestion and updates the preview", async ({ page }) => {
    expect(resumeId).toBeTruthy();

    // Wait for builder to load and fill in contact info so the resume is valid
    await expect(page.locator("article")).toBeVisible({ timeout: 5_000 });

    // Save the resume first so we have content to analyze
    const saveResponse = await page.request.put(`${apiBase}/${resumeId}`, {
      data: {
        id: resumeId,
        title: "Accept Suggestion Test Resume",
        targetRole: "Customer Success Manager",
        contact: {
          fullName: "Jordan Lee",
          email: "jordan@example.com",
          phone: "(555) 123-4567",
          location: "Austin, TX",
          website: "",
        },
        summary:
          "Experienced operations professional with a track record of improving workflows and training teams.",
        sectionOrder: ["summary", "experience", "education", "skills", "certifications", "projects"],
        experience: [
          {
            id: "exp-1",
            role: "Operations Lead",
            company: "Northstar Market",
            location: "Austin, TX",
            start: "2021",
            end: "Present",
            bullets: [
              "Lead daily operations.",
            ],
          },
        ],
        education: [],
        skills: ["Operations", "Team leadership"],
        certifications: [],
        projects: [],
      },
    });
    expect(saveResponse.ok()).toBe(true);

    // Run analysis
    await page.getByRole("button", { name: "Analyze Resume" }).click();
    await expect(page.getByText("Issues found")).toBeVisible({ timeout: 10_000 });

    // Click the first Accept button
    const acceptButton = page.locator('button[aria-label="Accept suggestion"]').first();
    await expect(acceptButton).toBeVisible({ timeout: 5_000 });
    await acceptButton.click();

    // Verify the suggestion shows "Accepted" status
    await expect(page.getByText("Accepted").first()).toBeVisible({ timeout: 8_000 });

    // Verify Saved badge appears (autosave fires after resume state change)
    await expect(page.getByText("Saved")).toBeVisible({ timeout: 10_000 });
  });

  test("returns 409 when applying operations against stale targets", async ({ page }) => {
    expect(resumeId).toBeTruthy();

    // Wait for builder to load
    await expect(page.locator("article")).toBeVisible({ timeout: 5_000 });

    // Save a resume with a specific experience entry
    const saveResponse = await page.request.put(`${apiBase}/${resumeId}`, {
      data: {
        id: resumeId,
        title: "Stale Target Test",
        targetRole: "Engineer",
        contact: {
          fullName: "Sam Smith",
          email: "sam@test.com",
          phone: "(555) 000-0000",
          location: "NYC",
          website: "",
        },
        summary: "A test summary for stale target testing purposes.",
        sectionOrder: ["summary", "experience", "education", "skills", "certifications", "projects"],
        experience: [
          {
            id: "exp-stale-1",
            role: "Software Engineer",
            company: "Tech Co",
            location: "NYC",
            start: "2020",
            end: "Present",
            bullets: ["Wrote code."],
          },
        ],
        education: [],
        skills: ["JavaScript"],
        certifications: [],
        projects: [],
      },
    });
    expect(saveResponse.ok()).toBe(true);

    // Call the apply API with a stale entryId that doesn't exist in the current resume
    const applyResponse = await page.request.post(
      `${apiBase}/${resumeId}/suggestions/apply`,
      {
        data: {
          operations: [
            {
              type: "replace_bullet",
              entryId: "exp-nonexistent",
              bulletIndex: 0,
              text: "Should not apply.",
            },
          ],
        },
      },
    );

    expect(applyResponse.status()).toBe(409);

    const body = await applyResponse.json();
    expect(body.error).toBeTruthy();
    expect(body.reason).toBeTruthy();
    expect(body.operation).toBeTruthy();
  });

  test("resume is not changed when apply returns 409", async ({ page }) => {
    expect(resumeId).toBeTruthy();

    await expect(page.locator("article")).toBeVisible({ timeout: 5_000 });

    // Save resume with known content
    const originalSummary = "This resume must not change after a failed apply attempt.";
    await page.request.put(`${apiBase}/${resumeId}`, {
      data: {
        id: resumeId,
        title: "Rollback Test",
        targetRole: "Test Role",
        contact: {
          fullName: "Alex Test",
          email: "alex@test.com",
          phone: "(555) 111-2222",
          location: "Chicago",
          website: "",
        },
        summary: originalSummary,
        sectionOrder: ["summary", "experience", "education", "skills", "certifications", "projects"],
        experience: [
          {
            id: "exp-rollback-1",
            role: "Tester",
            company: "Test Inc",
            location: "Chicago",
            start: "2022",
            end: "Present",
            bullets: ["Test bullet."],
          },
        ],
        education: [],
        skills: ["Testing"],
        certifications: [],
        projects: [],
      },
    });

    // Apply a stale operation that should fail
    const applyResponse = await page.request.post(
      `${apiBase}/${resumeId}/suggestions/apply`,
      {
        data: {
          operations: [
            {
              type: "replace_bullet",
              entryId: "exp-never-existed",
              bulletIndex: 0,
              text: "This should never appear.",
            },
          ],
        },
      },
    );
    expect(applyResponse.status()).toBe(409);

    // Fetch the resume again — summary must be unchanged
    const getAfter = await page.request.get(`${apiBase}/${resumeId}`);
    expect(getAfter.ok()).toBe(true);
    const afterData = await getAfter.json();

    // The resume should contain the original summary
    expect(afterData.resume.summary).toBe(originalSummary);
  });

  test("accepting one suggestion applies it and updates the persisted resume", async ({ page }) => {
    expect(resumeId).toBeTruthy();

    await expect(page.locator("article")).toBeVisible({ timeout: 5_000 });

    // Save a resume with a known summary
    await page.request.put(`${apiBase}/${resumeId}`, {
      data: {
        id: resumeId,
        title: "Apply Verification Test",
        targetRole: "Data Analyst",
        contact: {
          fullName: "Casey Test",
          email: "casey@test.com",
          phone: "(555) 333-4444",
          location: "Seattle",
          website: "",
        },
        summary: "A short summary that needs improvement.", // short summary → will trigger suggestion
        sectionOrder: ["summary", "experience", "education", "skills", "certifications", "projects"],
        experience: [
          {
            id: "exp-apply-1",
            role: "Data Analyst",
            company: "Data Co",
            location: "Seattle",
            start: "2021",
            end: "Present",
            bullets: ["Analyzed data."],
          },
        ],
        education: [],
        skills: ["SQL", "Python", "Excel"],
        certifications: [],
        projects: [],
      },
    });

    // Call the apply API directly with a replace_summary operation
    const newSummary = "Data analyst with 4+ years of experience transforming raw data into actionable business insights.";
    const applyResponse = await page.request.post(
      `${apiBase}/${resumeId}/suggestions/apply`,
      {
        data: {
          operations: [
            { type: "replace_summary", summary: newSummary },
          ],
        },
      },
    );

    expect(applyResponse.ok()).toBe(true);
    const applyBody = await applyResponse.json();

    // Verify the response includes updatedResume with the new summary
    expect(applyBody.updatedResume).toBeTruthy();
    expect(applyBody.updatedResume.summary).toBe(newSummary);

    // Verify the change was persisted — fetch the resume again
    const getResponse = await page.request.get(`${apiBase}/${resumeId}`);
    expect(getResponse.ok()).toBe(true);
    const resumeData = await getResponse.json();

    // The stored resume should reflect the new summary
    expect(resumeData.resume.summary).toBe(newSummary);
  });
});
