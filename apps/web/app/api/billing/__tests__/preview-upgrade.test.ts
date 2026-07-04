import { describe, it, expect, vi, beforeEach } from "vitest";

const mockStripeInstance = {
  prices: {
    retrieve: vi.fn(),
  },
  invoices: {
    createPreview: vi.fn(),
  },
  customers: {
    retrieve: vi.fn(),
  },
  paymentMethods: {
    retrieve: vi.fn(),
  },
  subscriptions: {
    retrieve: vi.fn(),
  },
};

vi.mock("../../../../lib/stripe", () => ({
  getStripe: () => mockStripeInstance,
  getProfessionalPriceId: () => "price_professional_mock",
  getEnterprisePriceId: () => "price_enterprise_mock",
}));

vi.mock("../../../../lib/auth", () => ({
  requireApiUser: vi.fn(),
}));

vi.mock("../../../../lib/error-reporting", () => ({
  reportError: vi.fn(),
}));

vi.mock("../../../../lib/request-id", () => ({
  getRequestId: vi.fn(() => "test-request-id"),
}));

import { requireApiUser } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";

describe("POST /api/billing/preview-upgrade", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    (requireApiUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { id: "user_1", email: "test@example.com", name: "Test" },
      response: null,
    });
  });

  it("returns a first-time subscription preview for free users", async () => {
    vi.spyOn(prisma.subscription, "findUnique").mockResolvedValue(null as never);
    mockStripeInstance.prices.retrieve.mockResolvedValue({
      id: "price_professional_mock",
      unit_amount: 1900,
      currency: "usd",
    });

    const { POST } = await import("../preview-upgrade/route");
    const res = await POST(new Request("http://localhost:3000/api/billing/preview-upgrade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: "professional" }),
    }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.todayCharge).toBe(19);
    expect(json.nextRenewal).toBe(19);
    expect(json.currentPlan).toBe("Free");
    expect(json.newPlan).toBe("Professional");
    expect(mockStripeInstance.invoices.createPreview).not.toHaveBeenCalled();
  });

  it("uses Stripe invoice preview for active subscription upgrades", async () => {
    vi.spyOn(prisma.subscription, "findUnique").mockResolvedValue({
      userId: "user_1",
      plan: "PROFESSIONAL",
      stripeCustomerId: "cus_123",
      stripeSubscriptionId: "sub_123",
    } as never);
    mockStripeInstance.prices.retrieve.mockResolvedValue({
      id: "price_enterprise_mock",
      unit_amount: 4900,
      currency: "usd",
    });
    mockStripeInstance.subscriptions.retrieve.mockResolvedValue({
      id: "sub_123",
      status: "active",
      current_period_end: 1785801600,
      default_payment_method: {
        id: "pm_123",
        type: "card",
        card: { brand: "visa", last4: "4242" },
      },
      items: { data: [{ id: "si_123", price: { id: "price_professional_mock" } }] },
    });
    mockStripeInstance.invoices.createPreview.mockResolvedValue({
      amount_due: 3000,
      currency: "usd",
      lines: {
        data: [
          { description: "Unused time on Professional", amount: -1900 },
          { description: "Remaining time on Enterprise", amount: 4900 },
        ],
      },
    });

    const { POST } = await import("../preview-upgrade/route");
    const res = await POST(new Request("http://localhost:3000/api/billing/preview-upgrade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: "enterprise" }),
    }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.todayCharge).toBe(30);
    expect(json.nextRenewal).toBe(49);
    expect(json.paymentMethod).toEqual({ brand: "visa", last4: "4242" });
    expect(json.lines).toHaveLength(2);
    expect(mockStripeInstance.invoices.createPreview).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: "cus_123",
        subscription: "sub_123",
        subscription_details: expect.objectContaining({
          items: [{ id: "si_123", price: "price_enterprise_mock" }],
          proration_behavior: "always_invoice",
        }),
      }),
    );
  });

  it("rejects non-upgrade previews", async () => {
    vi.spyOn(prisma.subscription, "findUnique").mockResolvedValue({
      userId: "user_1",
      plan: "ENTERPRISE",
    } as never);
    mockStripeInstance.prices.retrieve.mockResolvedValue({
      id: "price_professional_mock",
      unit_amount: 1900,
      currency: "usd",
    });

    const { POST } = await import("../preview-upgrade/route");
    const res = await POST(new Request("http://localhost:3000/api/billing/preview-upgrade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: "professional" }),
    }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain("upgrades");
  });
});