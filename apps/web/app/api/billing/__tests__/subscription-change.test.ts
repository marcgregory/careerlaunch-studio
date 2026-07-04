import { describe, it, expect, vi, beforeEach } from "vitest";

const mockStripeInstance = {
  subscriptions: {
    retrieve: vi.fn(),
  },
  subscriptionSchedules: {
    create: vi.fn(),
    retrieve: vi.fn(),
    update: vi.fn(),
    release: vi.fn(),
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

describe("POST /api/billing/subscription-change", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    (requireApiUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { id: "user_1", email: "test@example.com", name: "Test" },
      response: null,
    });
  });

  it("schedules a downgrade through the generic subscription-change endpoint", async () => {
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

    const { POST } = await import("../subscription-change/route");
    const res = await POST(new Request("http://localhost:3000/api/billing/subscription-change", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "schedule_downgrade", plan: "professional" }),
    }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.currentPlan).toBe("Enterprise");
    expect(json.scheduledPlan).toBe("Professional");
    expect(mockStripeInstance.subscriptionSchedules.update).toHaveBeenCalledWith(
      "sched_123",
      expect.objectContaining({
        metadata: {
          userId: "user_1",
          scheduledPlan: "professional",
        },
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

  it("cancels a scheduled downgrade by releasing the Stripe schedule", async () => {
    vi.spyOn(prisma.subscription, "findUnique").mockResolvedValue({
      userId: "user_1",
      plan: "ENTERPRISE",
      stripeSubscriptionId: "sub_123",
    } as never);
    mockStripeInstance.subscriptions.retrieve.mockResolvedValue({
      id: "sub_123",
      status: "active",
      schedule: {
        id: "sched_123",
        metadata: { userId: "user_1", scheduledPlan: "professional" },
        current_phase: { start_date: 1783123200, end_date: 1785801600 },
      },
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
    mockStripeInstance.subscriptionSchedules.release.mockResolvedValue({ id: "sched_123" });

    const { POST } = await import("../subscription-change/route");
    const res = await POST(new Request("http://localhost:3000/api/billing/subscription-change", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel_scheduled_downgrade" }),
    }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.currentPlan).toBe("Enterprise");
    expect(json.renewalDate).toBe("2026-08-04T00:00:00.000Z");
    expect(mockStripeInstance.subscriptionSchedules.release).toHaveBeenCalledWith("sched_123");
    expect(mockStripeInstance.subscriptionSchedules.update).not.toHaveBeenCalled();
  });

  it("rejects canceling when no scheduled downgrade exists", async () => {
    vi.spyOn(prisma.subscription, "findUnique").mockResolvedValue({
      userId: "user_1",
      plan: "ENTERPRISE",
      stripeSubscriptionId: "sub_123",
    } as never);
    mockStripeInstance.subscriptions.retrieve.mockResolvedValue({
      id: "sub_123",
      status: "active",
      schedule: null,
      items: { data: [] },
    });

    const { POST } = await import("../subscription-change/route");
    const res = await POST(new Request("http://localhost:3000/api/billing/subscription-change", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel_scheduled_downgrade" }),
    }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain("No scheduled downgrade");
    expect(mockStripeInstance.subscriptionSchedules.release).not.toHaveBeenCalled();
  });
});
