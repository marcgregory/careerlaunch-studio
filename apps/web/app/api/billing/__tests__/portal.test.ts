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

vi.mock("../../../../lib/auth", () => ({
  requireApiUser: vi.fn(),
}));

vi.mock("../../../../lib/error-reporting", () => ({
  reportError: vi.fn(),
}));

import { requireApiUser } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";

describe("POST /api/billing/portal", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    (requireApiUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { id: "user_1", email: "test@example.com", name: "Test" },
      response: null,
    });
  });

  it("returns 400 if user has no stripeCustomerId", async () => {
    vi.spyOn(prisma.subscription, "findUnique").mockResolvedValue({
      id: "sub_1",
      userId: "user_1",
      plan: "FREE",
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      status: "FREE",
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    const { POST } = await import("../portal/route");
    const req = new Request("http://localhost:3000/api/billing/portal", { method: "POST" });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain("No subscription found");
  });

  it("returns 400 if no subscription row exists", async () => {
    vi.spyOn(prisma.subscription, "findUnique").mockResolvedValue(null as never);

    const { POST } = await import("../portal/route");
    const req = new Request("http://localhost:3000/api/billing/portal", { method: "POST" });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain("No subscription found");
  });

  it("creates a Customer Portal session and returns URL", async () => {
    vi.spyOn(prisma.subscription, "findUnique").mockResolvedValue({
      id: "sub_1",
      userId: "user_1",
      plan: "PROFESSIONAL",
      stripeCustomerId: "cus_existing",
      stripeSubscriptionId: "sub_stripe_1",
      status: "ACTIVE",
      currentPeriodEnd: new Date(),
      cancelAtPeriodEnd: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    mockStripeInstance.billingPortal.sessions.create.mockResolvedValue({
      url: "https://billing.stripe.com/p/session_test",
    });

    const { POST } = await import("../portal/route");
    const req = new Request("http://localhost:3000/api/billing/portal", { method: "POST" });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.url).toBe("https://billing.stripe.com/p/session_test");
    expect(mockStripeInstance.billingPortal.sessions.create).toHaveBeenCalledWith({
      customer: "cus_existing",
      return_url: "http://localhost:3000/account/billing",
    });
  });

  it("handles Stripe errors gracefully", async () => {
    vi.spyOn(prisma.subscription, "findUnique").mockResolvedValue({
      stripeCustomerId: "cus_existing",
    } as never);

    mockStripeInstance.billingPortal.sessions.create.mockRejectedValue(
      new Error("Stripe API error"),
    );

    const { POST } = await import("../portal/route");
    const req = new Request("http://localhost:3000/api/billing/portal", { method: "POST" });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBeTruthy();
  });

  it("requires authentication", async () => {
    (requireApiUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: null,
      response: Response.json({ error: "Authentication required" }, { status: 401 }),
    });

    const { POST } = await import("../portal/route");
    const req = new Request("http://localhost:3000/api/billing/portal", { method: "POST" });
    const res = await POST(req);

    expect(res.status).toBe(401);
  });
});
