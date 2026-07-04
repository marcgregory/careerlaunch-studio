import { describe, it, expect, vi, beforeEach } from "vitest";

const mockStripeInstance = {
  subscriptions: {
    retrieve: vi.fn(),
  },
  subscriptionSchedules: {
    create: vi.fn(),
    update: vi.fn(),
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

describe("POST /api/billing/schedule-downgrade", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    (requireApiUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { id: "user_1", email: "test@example.com", name: "Test" },
      response: null,
    });
  });

  it("schedules a lower paid plan for the next billing period", async () => {
    vi.spyOn(prisma.subscription, "findUnique").mockResolvedValue({
      userId: "user_1",
      plan: "ENTERPRISE",
      stripeSubscriptionId: "sub_123",
    } as never);
    mockStripeInstance.subscriptions.retrieve.mockResolvedValue({
      id: "sub_123",
      status: "active",
      current_period_end: 1785801600,
      items: {
        data: [{
          id: "si_123",
          quantity: 1,
          price: { id: "price_enterprise_mock" },
        }],
      },
    });
    mockStripeInstance.subscriptionSchedules.create.mockResolvedValue({ id: "sched_123" });
    mockStripeInstance.subscriptionSchedules.update.mockResolvedValue({ id: "sched_123" });

    const { POST } = await import("../schedule-downgrade/route");
    const res = await POST(new Request("http://localhost:3000/api/billing/schedule-downgrade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: "professional" }),
    }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.currentPlan).toBe("Enterprise");
    expect(json.scheduledPlan).toBe("Professional");
    expect(mockStripeInstance.subscriptionSchedules.create).toHaveBeenCalledWith({
      from_subscription: "sub_123",
    });
    expect(mockStripeInstance.subscriptionSchedules.update).toHaveBeenCalledWith(
      "sched_123",
      expect.objectContaining({
        end_behavior: "release",
        proration_behavior: "none",
        phases: [
          {
            items: [{ price: "price_enterprise_mock", quantity: 1 }],
            start_date: "now",
            end_date: 1785801600,
          },
          {
            items: [{ price: "price_professional_mock", quantity: 1 }],
            start_date: 1785801600,
          },
        ],
      }),
    );
  });

  it("rejects upgrades and same-plan changes", async () => {
    vi.spyOn(prisma.subscription, "findUnique").mockResolvedValue({
      userId: "user_1",
      plan: "PROFESSIONAL",
      stripeSubscriptionId: "sub_123",
    } as never);

    const { POST } = await import("../schedule-downgrade/route");
    const res = await POST(new Request("http://localhost:3000/api/billing/schedule-downgrade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: "enterprise" }),
    }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain("lower paid plans");
    expect(mockStripeInstance.subscriptionSchedules.create).not.toHaveBeenCalled();
  });
});