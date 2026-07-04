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
    update: vi.fn(),
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

vi.mock("../../../../lib/request-id", () => ({
  getRequestId: vi.fn(() => "test-request-id"),
}));

import { requireApiUser } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";

describe("POST /api/billing/checkout", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    (requireApiUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { id: "user_1", email: "test@example.com", name: "Test" },
      response: null,
    });

    vi.spyOn(prisma.subscription, "findUnique").mockResolvedValue(null as never);
  });

  it("rejects invalid plan names", async () => {
    const { POST } = await import("../checkout/route");
    const req = new Request("http://localhost:3000/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: "basic" }),
    });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain("Invalid plan");
  });

  it("rejects missing plan", async () => {
    const { POST } = await import("../checkout/route");
    const req = new Request("http://localhost:3000/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain("Invalid plan");
  });

  it("creates a Stripe customer and checkout session for professional", async () => {
    mockStripeInstance.customers.create.mockResolvedValue({ id: "cus_new" });
    mockStripeInstance.checkout.sessions.create.mockResolvedValue({
      url: "https://checkout.stripe.com/pay/test_session",
    });

    vi.spyOn(prisma.subscription, "upsert").mockResolvedValue({} as never);

    const { POST } = await import("../checkout/route");
    const req = new Request("http://localhost:3000/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: "professional" }),
    });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.url).toBe("https://checkout.stripe.com/pay/test_session");
    expect(mockStripeInstance.customers.create).toHaveBeenCalledWith({
      email: "test@example.com",
      name: "Test",
      metadata: { userId: "user_1" },
    });
    expect(mockStripeInstance.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: "cus_new",
        mode: "subscription",
        line_items: [{ price: "price_professional_mock", quantity: 1 }],
        metadata: { userId: "user_1", plan: "professional" },
      }),
    );
  });

  it("creates a checkout session for enterprise", async () => {
    mockStripeInstance.customers.create.mockResolvedValue({ id: "cus_new" });
    mockStripeInstance.checkout.sessions.create.mockResolvedValue({
      url: "https://checkout.stripe.com/pay/test_enterprise",
    });
    vi.spyOn(prisma.subscription, "upsert").mockResolvedValue({} as never);

    const { POST } = await import("../checkout/route");
    const req = new Request("http://localhost:3000/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: "enterprise" }),
    });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.url).toBe("https://checkout.stripe.com/pay/test_enterprise");
    expect(mockStripeInstance.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        line_items: [{ price: "price_enterprise_mock", quantity: 1 }],
      }),
    );
  });

  it("reuses existing Stripe customer", async () => {
    vi.spyOn(prisma.subscription, "findUnique").mockResolvedValue({
      stripeCustomerId: "cus_existing",
    } as never);
    mockStripeInstance.checkout.sessions.create.mockResolvedValue({
      url: "https://checkout.stripe.com/pay/test",
    });
    vi.spyOn(prisma.subscription, "upsert").mockResolvedValue({} as never);

    const { POST } = await import("../checkout/route");
    const req = new Request("http://localhost:3000/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: "professional" }),
    });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.url).toBeTruthy();
    expect(mockStripeInstance.customers.create).not.toHaveBeenCalled();
    expect(mockStripeInstance.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({ customer: "cus_existing" }),
    );
  });

  it("handles Stripe errors gracefully", async () => {
    mockStripeInstance.customers.create.mockRejectedValue(new Error("Stripe API error"));

    const { POST } = await import("../checkout/route");
    const req = new Request("http://localhost:3000/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: "professional" }),
    });
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

    const { POST } = await import("../checkout/route");
    const req = new Request("http://localhost:3000/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: "professional" }),
    });
    const res = await POST(req);

    expect(res.status).toBe(401);
  });

  it("upgrades existing active subscription in-place instead of creating a new checkout session", async () => {
    // Simulate existing subscriber with Professional
    vi.spyOn(prisma.subscription, "findUnique").mockResolvedValue({
      stripeCustomerId: "cus_existing",
      stripeSubscriptionId: "sub_active",
      status: "ACTIVE",
      plan: "PROFESSIONAL",
      userId: "user_1",
    } as never);

    mockStripeInstance.subscriptions.retrieve.mockResolvedValue({
      id: "sub_active",
      status: "active",
      items: {
        data: [{ id: "si_item1", price: { id: "price_professional_mock" } }],
      },
    } as never);

    mockStripeInstance.subscriptions.update.mockResolvedValue({} as never);

    vi.spyOn(prisma.subscription, "update").mockResolvedValue({} as never);

    const { POST } = await import("../checkout/route");
    const req = new Request("http://localhost:3000/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: "enterprise" }),
    });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    // Should NOT create a checkout session (no mode: "subscription" call)
    expect(mockStripeInstance.checkout.sessions.create).not.toHaveBeenCalled();
    // Should update the existing subscription instead
    expect(mockStripeInstance.subscriptions.update).toHaveBeenCalledWith(
      "sub_active",
      expect.objectContaining({
        items: [{ id: "si_item1", price: "price_enterprise_mock" }],
        proration_behavior: "always_invoice",
      }),
    );
    // Should redirect back to billing page with upgrade success
    expect(json.url).toContain("/billing?upgrade=completed&plan=enterprise");
  });

  it("creates checkout session when existing subscription is canceled", async () => {
    // Canceled subscription → should still create new Checkout Session
    vi.spyOn(prisma.subscription, "findUnique").mockResolvedValue({
      stripeCustomerId: "cus_existing",
      stripeSubscriptionId: "sub_canceled",
      status: "CANCELED",
    } as never);

    // The subscription has a stripeSubscriptionId but status is CANCELED,
    // so the upgrade-in-place branch is skipped and Checkout Session is created.
    mockStripeInstance.checkout.sessions.create.mockResolvedValue({
      url: "https://checkout.stripe.com/pay/new",
    });

    const { POST } = await import("../checkout/route");
    const req = new Request("http://localhost:3000/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: "professional" }),
    });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(mockStripeInstance.checkout.sessions.create).toHaveBeenCalled();
    expect(mockStripeInstance.subscriptions.update).not.toHaveBeenCalled();
  });
});
