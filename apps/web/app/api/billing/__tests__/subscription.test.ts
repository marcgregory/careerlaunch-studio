import { describe, it, expect, vi, beforeEach } from "vitest";

const mockStripeInstance = {
  webhooks: {
    constructEvent: vi.fn(),
  },
  customers: {
    create: vi.fn(),
  },
  checkout: {
    sessions: {
      create: vi.fn(),
    },
  },
  billingPortal: {
    sessions: {
      create: vi.fn(),
    },
  },
  subscriptions: {
    retrieve: vi.fn(),
  },
};

vi.mock("../../../../lib/stripe", () => ({
  getStripe: () => mockStripeInstance,
  getProfessionalPriceId: () => "price_professional_mock",
  getEnterprisePriceId: () => "price_enterprise_mock",
  getBaseUrl: (req?: Request) => {
    if (req) {
      const host = req.headers.get("host") || "localhost:3000";
      return `http://${host}`;
    }
    return "http://localhost:3000";
  },
  getStripePublishableKey: () => "pk_test_mock",
}));

import { requireApiUser } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";

vi.mock("../../../../lib/auth", () => ({
  requireApiUser: vi.fn(),
}));

vi.mock("../../../../lib/error-reporting", () => ({
  reportError: vi.fn(),
}));

vi.mock("../../../../lib/request-id", () => ({
  getRequestId: vi.fn(() => "test-request-id"),
}));

function createMockSubscription(overrides: Record<string, unknown> = {}) {
  return {
    id: "sub_1",
    userId: "user_1",
    plan: overrides.plan ?? "FREE",
    stripeCustomerId: overrides.stripeCustomerId ?? null,
    stripeSubscriptionId: overrides.stripeSubscriptionId ?? null,
    status: overrides.status ?? "FREE",
    currentPeriodEnd: overrides.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: overrides.cancelAtPeriodEnd ?? false,
    createdAt: new Date("2026-07-01"),
    updatedAt: new Date("2026-07-01"),
  };
}

describe("GET /api/billing/subscription", () => {
  beforeEach(async () => {
    vi.clearAllMocks();

    (requireApiUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { id: "user_1", email: "test@example.com", name: "Test" },
      response: null,
    });
  });

  it("returns free plan data for a free user", async () => {
    vi.spyOn(prisma.subscription, "findUnique").mockResolvedValue(
      createMockSubscription({ plan: "FREE", status: "FREE" }) as never,
    );
    vi.spyOn(prisma.subscription, "create").mockResolvedValue(null as never);
    vi.spyOn(prisma.exportJob, "count").mockResolvedValue(0 as never);

    const { GET } = await import("../subscription/route");
    const res = await GET();
    const json = await res.json();

    expect(json.currentPlan).toBe("free");
    expect(json.cancelAtPeriodEnd).toBe(false);
    expect(json.currentPeriodEnd).toBeNull();
    expect(json.pdfExportKind).toBe("watermarked");
    expect(json.monthlyExportsUsed).toBe(0);
    expect(json.plans).toHaveLength(3);
    expect(json.plans[0].isCurrent).toBe(true);
  });

  it("returns professional plan data for a paid user", async () => {
    vi.spyOn(prisma.subscription, "findUnique").mockResolvedValue(
      createMockSubscription({
        plan: "PROFESSIONAL",
        status: "ACTIVE",
        stripeCustomerId: "cus_123",
        stripeSubscriptionId: "sub_stripe_1",
        currentPeriodEnd: new Date("2026-08-01"),
      }) as never,
    );
    vi.spyOn(prisma.exportJob, "count").mockResolvedValue(3 as never);

    const { GET } = await import("../subscription/route");
    const res = await GET();
    const json = await res.json();

    expect(json.currentPlan).toBe("professional");
    expect(json.pdfExportKind).toBe("clean");
    expect(json.monthlyExportsUsed).toBe(3);
    expect(json.currentPeriodEnd).toBe("2026-08-01T00:00:00.000Z");
  });

  it("returns cancellation state for a canceling user", async () => {
    vi.spyOn(prisma.subscription, "findUnique").mockResolvedValue(
      createMockSubscription({
        plan: "PROFESSIONAL",
        status: "ACTIVE",
        cancelAtPeriodEnd: true,
        currentPeriodEnd: new Date("2026-08-04"),
      }) as never,
    );
    vi.spyOn(prisma.exportJob, "count").mockResolvedValue(0 as never);

    const { GET } = await import("../subscription/route");
    const res = await GET();
    const json = await res.json();

    expect(json.currentPlan).toBe("professional");
    expect(json.cancelAtPeriodEnd).toBe(true);
    expect(json.currentPeriodEnd).toBe("2026-08-04T00:00:00.000Z");
  });

  it("requires authentication", async () => {
    (requireApiUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: null,
      response: Response.json({ error: "Authentication required" }, { status: 401 }),
    });

    const { GET } = await import("../subscription/route");
    const res = await GET();

    expect(res.status).toBe(401);
  });
});
