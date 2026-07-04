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
  paymentMethod: null,
  invoices: [],
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

  test("opens upgrade confirmation with Stripe preview before checkout", async ({ page }) => {
    const pageErrors: Error[] = [];
    page.on("pageerror", (error) => pageErrors.push(error));
    await mockSubscription(page, {
      currentPlan: "professional",
      currentPeriodEnd: "2026-08-04T00:00:00.000Z",
    });

    await page.route("**/api/billing/preview-upgrade", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          todayCharge: 30,
          currency: "USD",
          currentPlan: "Professional",
          newPlan: "Enterprise",
          nextRenewal: 49,
          renewalDate: "2026-08-04T00:00:00.000Z",
          paymentMethod: { brand: "visa", last4: "4242" },
          lines: [
            { label: "Professional credit", amount: -19 },
            { label: "Enterprise upgrade", amount: 49 },
          ],
        }),
      });
    });
    await page.route("**/api/billing/checkout", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          url: "http://localhost:3000/billing?upgrade=completed&plan=enterprise",
        }),
      });
    });

    await page.goto("/billing");
    await page.getByRole("button", { name: /Upgrade to enterprise/i }).click();

    await expect(page.getByRole("heading", { name: "Upgrade to Enterprise" })).toBeVisible();
    await expect(page.getByText("Professional credit")).toBeVisible();
    await expect(page.getByText("Enterprise upgrade")).toBeVisible();
    await expect(page.getByText("visa ending 4242")).toBeVisible();
    await page.getByRole("button", { name: /^Upgrade$/ }).click();
    await expect(page).toHaveURL(/upgrade=completed&plan=enterprise/);
    expect(pageErrors).toEqual([]);
  });
});