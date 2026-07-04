import { expect, test, type Page } from "@playwright/test";

type MockSubscription = {
  currentPlan?: string;
  cancelAtPeriodEnd?: boolean;
  currentPeriodEnd?: string | null;
};

const defaultSubscription = {
  currentPlan: "free",
  cancelAtPeriodEnd: false,
  currentPeriodEnd: null,
  plans: [
    { id: "free", label: "Free", isCurrent: true },
    { id: "professional", label: "Professional", isCurrent: false },
    { id: "enterprise", label: "Enterprise", isCurrent: false },
  ],
};

async function mockSubscription(page: Page, overrides: MockSubscription = {}) {
  await page.route("**/api/billing/subscription", async (route) => {
    const currentPlan = overrides.currentPlan ?? defaultSubscription.currentPlan;

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ...defaultSubscription,
        ...overrides,
        currentPlan,
        plans: defaultSubscription.plans.map((plan) => ({
          ...plan,
          isCurrent: plan.id === currentPlan,
        })),
      }),
    });
  });
}

async function expectPlanCards(page: Page) {
  await expect(page.getByRole("heading", { name: "Pricing" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "free" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "professional" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "enterprise" })).toBeVisible();
}

test.describe("Billing page", () => {
  test("renders plan cards after checkout cancel params", async ({ page }) => {
    const pageErrors: Error[] = [];
    page.on("pageerror", (error) => pageErrors.push(error));
    await mockSubscription(page);

    await page.goto("/billing?checkout=canceled");

    await expectPlanCards(page);
    await expect(page.getByText("Checkout was canceled. No changes were made.")).toBeVisible();
    expect(pageErrors).toEqual([]);
  });

  test("renders plan cards after checkout success params while Stripe sync completes", async ({ page }) => {
    const pageErrors: Error[] = [];
    page.on("pageerror", (error) => pageErrors.push(error));
    await mockSubscription(page, { currentPlan: "professional" });

    await page.goto("/billing?checkout=success");

    await expectPlanCards(page);
    await expect(page.getByText("You're on the professional plan.")).toBeVisible();
    await expect(page).toHaveURL(/\/billing$/);
    expect(pageErrors).toEqual([]);
  });
});