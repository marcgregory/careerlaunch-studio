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

vi.mock("../../../../lib/error-reporting", () => ({
  reportError: vi.fn(),
}));

import { prisma } from "../../../../lib/prisma";

describe("POST /api/billing/webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function makeStripeEvent(type: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      id: overrides.id ?? "evt_test_1",
      type,
      data: {
        object: {
          id: overrides.stripeId ?? "sub_test_1",
          ...(overrides.object as Record<string, unknown>),
        },
      },
    };
  }

  describe("signature verification", () => {
    it("rejects missing signature header", async () => {
      const { POST } = await import("../webhook/route");
      const req = new Request("http://localhost:3000/api/billing/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "test" }),
      });
      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toBe("Missing stripe-signature header");
    });

    it("rejects invalid signature", async () => {
      mockStripeInstance.webhooks.constructEvent.mockImplementation(() => {
        throw new Error("Invalid signature");
      });

      const { POST } = await import("../webhook/route");
      const req = new Request("http://localhost:3000/api/billing/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json", "stripe-signature": "bad" },
        body: JSON.stringify({ type: "test" }),
      });
      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(401);
      expect(json.error).toBe("Invalid webhook signature");
    });
  });

  describe("checkout.session.completed", () => {
    it("upserts subscription with correct plan and fetches period end", async () => {
      mockStripeInstance.webhooks.constructEvent.mockReturnValue(
        makeStripeEvent("checkout.session.completed", {
          stripeId: "cs_test_1",
          object: {
            customer: "cus_123",
            subscription: "sub_stripe_1",
            metadata: { userId: "user_1", plan: "professional" },
          },
        }),
      );

      mockStripeInstance.subscriptions.retrieve.mockResolvedValue({
        current_period_end: 1722384000,
      });

      vi.spyOn(prisma.processedStripeEvent, "findUnique").mockResolvedValue(null as never);
      vi.spyOn(prisma.processedStripeEvent, "create").mockResolvedValue({} as never);

      let upsertData: Record<string, unknown> = {};
      vi.spyOn(prisma.subscription, "upsert").mockImplementation(
        ((opts: { create: Record<string, unknown> }) => {
          upsertData = opts.create;
          return Promise.resolve({} as never);
        }) as never,
      );

      const { POST } = await import("../webhook/route");
      const req = new Request("http://localhost:3000/api/billing/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json", "stripe-signature": "valid" },
        body: JSON.stringify({}),
      });
      const res = await POST(req);

      expect(res.status).toBe(200);
      expect(upsertData.plan).toBe("PROFESSIONAL");
      expect(upsertData.status).toBe("ACTIVE");
      expect(upsertData.stripeCustomerId).toBe("cus_123");
      expect(upsertData.stripeSubscriptionId).toBe("sub_stripe_1");
    });

    it("handles enterprise plan", async () => {
      mockStripeInstance.webhooks.constructEvent.mockReturnValue(
        makeStripeEvent("checkout.session.completed", {
          stripeId: "cs_test_2",
          object: {
            customer: "cus_456",
            subscription: "sub_stripe_2",
            metadata: { userId: "user_2", plan: "enterprise" },
          },
        }),
      );
      mockStripeInstance.subscriptions.retrieve.mockResolvedValue({
        current_period_end: 1722384000,
      });

      vi.spyOn(prisma.processedStripeEvent, "findUnique").mockResolvedValue(null as never);
      vi.spyOn(prisma.processedStripeEvent, "create").mockResolvedValue({} as never);

      let upsertPlan = "";
      vi.spyOn(prisma.subscription, "upsert").mockImplementation(
        ((opts: { create: Record<string, unknown> }) => {
          upsertPlan = opts.create.plan as string;
          return Promise.resolve({} as never);
        }) as never,
      );

      const { POST } = await import("../webhook/route");
      const req = new Request("http://localhost:3000/api/billing/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json", "stripe-signature": "valid" },
        body: JSON.stringify({}),
      });
      await POST(req);

      expect(upsertPlan).toBe("ENTERPRISE");
    });

    it("rejects missing metadata", async () => {
      mockStripeInstance.webhooks.constructEvent.mockReturnValue(
        makeStripeEvent("checkout.session.completed", {
          stripeId: "cs_test_3",
          object: {
            customer: "cus_789",
            subscription: null,
            metadata: {},
          },
        }),
      );

      vi.spyOn(prisma.processedStripeEvent, "findUnique").mockResolvedValue(null as never);

      const { POST } = await import("../webhook/route");
      const req = new Request("http://localhost:3000/api/billing/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json", "stripe-signature": "valid" },
        body: JSON.stringify({}),
      });
      const res = await POST(req);

      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe("Missing metadata");
    });
  });

  describe("customer.subscription.updated", () => {
    it("updates subscription plan, status, and period end", async () => {
      mockStripeInstance.webhooks.constructEvent.mockReturnValue(
        makeStripeEvent("customer.subscription.updated", {
          stripeId: "sub_stripe_1",
          object: {
            status: "active",
            current_period_end: 1722384000,
            cancel_at_period_end: false,
            items: {
              data: [
                {
                  price: {
                    id: "price_professional_mock",
                  },
                },
              ],
            },
          },
        }),
      );

      vi.spyOn(prisma.processedStripeEvent, "findUnique").mockResolvedValue(null as never);
      vi.spyOn(prisma.processedStripeEvent, "create").mockResolvedValue({} as never);

      let calledData: Record<string, unknown> = {};
      vi.spyOn(prisma.subscription, "updateMany").mockImplementation(
        ((opts: { data: Record<string, unknown> }) => {
          calledData = opts.data;
          return Promise.resolve({ count: 1 } as never);
        }) as never,
      );

      const { POST } = await import("../webhook/route");
      const req = new Request("http://localhost:3000/api/billing/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json", "stripe-signature": "valid" },
        body: JSON.stringify({}),
      });
      const res = await POST(req);

      expect(res.status).toBe(200);
      expect(calledData.plan).toBe("PROFESSIONAL");
      expect(calledData.status).toBe("ACTIVE");
      expect(calledData.cancelAtPeriodEnd).toBe(false);
    });

    it("detects enterprise plan from price ID", async () => {
      mockStripeInstance.webhooks.constructEvent.mockReturnValue(
        makeStripeEvent("customer.subscription.updated", {
          stripeId: "sub_stripe_2",
          object: {
            status: "active",
            current_period_end: 1722384000,
            cancel_at_period_end: false,
            items: {
              data: [
                {
                  price: {
                    id: "price_enterprise_mock",
                  },
                },
              ],
            },
          },
        }),
      );

      vi.spyOn(prisma.processedStripeEvent, "findUnique").mockResolvedValue(null as never);
      vi.spyOn(prisma.processedStripeEvent, "create").mockResolvedValue({} as never);

      let calledPlan = "";
      vi.spyOn(prisma.subscription, "updateMany").mockImplementation(
        ((opts: { data: Record<string, unknown> }) => {
          calledPlan = opts.data.plan as string;
          return Promise.resolve({ count: 1 } as never);
        }) as never,
      );

      const { POST } = await import("../webhook/route");
      const req = new Request("http://localhost:3000/api/billing/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json", "stripe-signature": "valid" },
        body: JSON.stringify({}),
      });
      await POST(req);

      expect(calledPlan).toBe("ENTERPRISE");
    });

    it("handles cancellation flag", async () => {
      mockStripeInstance.webhooks.constructEvent.mockReturnValue(
        makeStripeEvent("customer.subscription.updated", {
          stripeId: "sub_stripe_3",
          object: {
            status: "active",
            current_period_end: 1725062400,
            cancel_at_period_end: true,
            items: {
              data: [
                {
                  price: {
                    id: "price_professional_mock",
                  },
                },
              ],
            },
          },
        }),
      );

      vi.spyOn(prisma.processedStripeEvent, "findUnique").mockResolvedValue(null as never);
      vi.spyOn(prisma.processedStripeEvent, "create").mockResolvedValue({} as never);

      let calledCancelFlag = false;
      vi.spyOn(prisma.subscription, "updateMany").mockImplementation(
        ((opts: { data: Record<string, unknown> }) => {
          calledCancelFlag = opts.data.cancelAtPeriodEnd as boolean;
          return Promise.resolve({ count: 1 } as never);
        }) as never,
      );

      const { POST } = await import("../webhook/route");
      const req = new Request("http://localhost:3000/api/billing/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json", "stripe-signature": "valid" },
        body: JSON.stringify({}),
      });
      await POST(req);

      expect(calledCancelFlag).toBe(true);
    });
  });

  describe("customer.subscription.deleted", () => {
    it("marks subscription as CANCELED with FREE plan", async () => {
      mockStripeInstance.webhooks.constructEvent.mockReturnValue(
        makeStripeEvent("customer.subscription.deleted", {
          stripeId: "sub_stripe_1",
          object: {
            current_period_end: 1722384000,
          },
        }),
      );

      vi.spyOn(prisma.processedStripeEvent, "findUnique").mockResolvedValue(null as never);
      vi.spyOn(prisma.processedStripeEvent, "create").mockResolvedValue({} as never);

      let calledData: Record<string, unknown> = {};
      vi.spyOn(prisma.subscription, "updateMany").mockImplementation(
        ((opts: { data: Record<string, unknown> }) => {
          calledData = opts.data;
          return Promise.resolve({ count: 1 } as never);
        }) as never,
      );

      const { POST } = await import("../webhook/route");
      const req = new Request("http://localhost:3000/api/billing/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json", "stripe-signature": "valid" },
        body: JSON.stringify({}),
      });
      await POST(req);

      expect(calledData.status).toBe("CANCELED");
      expect(calledData.plan).toBe("FREE");
      expect(calledData.currentPeriodEnd).toBeInstanceOf(Date);
    });
  });

  describe("invoice.payment_failed", () => {
    it("marks subscription as PAST_DUE", async () => {
      mockStripeInstance.webhooks.constructEvent.mockReturnValue(
        makeStripeEvent("invoice.payment_failed", {
          stripeId: "in_test_1",
          object: {
            subscription: "sub_stripe_1",
          },
        }),
      );

      vi.spyOn(prisma.processedStripeEvent, "findUnique").mockResolvedValue(null as never);
      vi.spyOn(prisma.processedStripeEvent, "create").mockResolvedValue({} as never);

      let calledStatus = "";
      vi.spyOn(prisma.subscription, "updateMany").mockImplementation(
        ((opts: { data: Record<string, unknown> }) => {
          calledStatus = opts.data.status as string;
          return Promise.resolve({ count: 1 } as never);
        }) as never,
      );

      const { POST } = await import("../webhook/route");
      const req = new Request("http://localhost:3000/api/billing/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json", "stripe-signature": "valid" },
        body: JSON.stringify({}),
      });
      await POST(req);

      expect(calledStatus).toBe("PAST_DUE");
    });
  });

  describe("idempotency", () => {
    it("skips already processed events", async () => {
      mockStripeInstance.webhooks.constructEvent.mockReturnValue(
        makeStripeEvent("customer.subscription.updated", {
          id: "evt_already_processed",
          stripeId: "sub_stripe_1",
          object: {
            status: "active",
            current_period_end: 1722384000,
            cancel_at_period_end: false,
            items: {
              data: [{ price: { id: "price_professional_mock" } }],
            },
          },
        }),
      );

      vi.spyOn(prisma.processedStripeEvent, "findUnique").mockResolvedValue({
        id: "evt_already_processed",
        createdAt: new Date(),
      } as never);

      const updateManySpy = vi.spyOn(prisma.subscription, "updateMany");

      const { POST } = await import("../webhook/route");
      const req = new Request("http://localhost:3000/api/billing/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json", "stripe-signature": "valid" },
        body: JSON.stringify({}),
      });
      const res = await POST(req);

      expect(res.status).toBe(200);
      expect(updateManySpy).not.toHaveBeenCalled();
    });
  });

  describe("unhandled events", () => {
    it("returns 200 for unhandled event types", async () => {
      mockStripeInstance.webhooks.constructEvent.mockReturnValue(
        makeStripeEvent("charge.succeeded", {
          stripeId: "ch_test_1",
          object: {},
        }),
      );

      vi.spyOn(prisma.processedStripeEvent, "findUnique").mockResolvedValue(null as never);
      vi.spyOn(prisma.processedStripeEvent, "create").mockResolvedValue({} as never);

      const { POST } = await import("../webhook/route");
      const req = new Request("http://localhost:3000/api/billing/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json", "stripe-signature": "valid" },
        body: JSON.stringify({}),
      });
      const res = await POST(req);

      expect(res.status).toBe(200);
      expect((await res.json()).received).toBe(true);
    });
  });
});
