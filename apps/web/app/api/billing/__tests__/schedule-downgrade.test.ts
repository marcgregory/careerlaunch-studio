import { describe, it, expect, vi, beforeEach } from "vitest";

const mockStripeInstance = {
  subscriptions: {
    retrieve: vi.fn(),
  },
  subscriptionSchedules: {
    create: vi.fn(),
    retrieve: vi.fn(),
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
      schedule: null,
      items: {
        data: [{
          id: "si_123",
          quantity: 1,
          current_period_start: 1783123200,
          current_period_end: 1785801600,
          price: { id: "price_enterprise_mock" },
        }],
      },
    });
    mockStripeInstance.subscriptionSchedules.create.mockResolvedValue({
      id: "sched_123",
      current_phase: { start_date: 1783123200, end_date: 1785801600 },
    });
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
    expect(mockStripeInstance.subscriptions.retrieve).toHaveBeenCalledWith("sub_123", {
      expand: ["schedule"],
    });
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
            start_date: 1783123200,
            end_date: 1785801600,
            proration_behavior: "none",
          },
          {
            items: [{ price: "price_professional_mock", quantity: 1 }],
            start_date: 1785801600,
            proration_behavior: "none",
          },
        ],
      }),
    );
  });

  it("reuses an existing Stripe subscription schedule", async () => {
    vi.spyOn(prisma.subscription, "findUnique").mockResolvedValue({
      userId: "user_1",
      plan: "ENTERPRISE",
      stripeSubscriptionId: "sub_123",
    } as never);
    mockStripeInstance.subscriptions.retrieve.mockResolvedValue({
      id: "sub_123",
      status: "active",
      schedule: "sched_existing",
      items: {
        data: [{
          id: "si_123",
          quantity: 1,
          current_period_start: 1783123200,
          current_period_end: 1785801600,
          price: { id: "price_enterprise_mock" },
        }],
      },
    });
    mockStripeInstance.subscriptionSchedules.retrieve.mockResolvedValue({
      id: "sched_existing",
      current_phase: { start_date: 1783123200, end_date: 1785801600 },
    });
    mockStripeInstance.subscriptionSchedules.update.mockResolvedValue({ id: "sched_existing" });

    const { POST } = await import("../schedule-downgrade/route");
    const res = await POST(new Request("http://localhost:3000/api/billing/schedule-downgrade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: "professional" }),
    }));

    expect(res.status).toBe(200);
    expect(mockStripeInstance.subscriptionSchedules.create).not.toHaveBeenCalled();
    expect(mockStripeInstance.subscriptionSchedules.retrieve).toHaveBeenCalledWith("sched_existing");
    expect(mockStripeInstance.subscriptionSchedules.update).toHaveBeenCalledWith(
      "sched_existing",
      expect.any(Object),
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