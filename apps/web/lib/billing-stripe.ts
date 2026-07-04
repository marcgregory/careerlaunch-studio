import Stripe from "stripe";
import { getEnterprisePriceId, getProfessionalPriceId } from "./stripe";

export type PaidPlanId = "professional" | "enterprise";
export type BillingPlanId = "free" | PaidPlanId;

export type PaymentMethodSummary = {
  brand: string;
  last4: string;
} | null;

export type InvoiceSummary = {
  id: string;
  date: string;
  description: string;
  amount: number;
  currency: string;
  status: string | null;
  hostedInvoiceUrl: string | null;
  invoicePdf: string | null;
};

export const PLAN_RANK: Record<BillingPlanId, number> = {
  free: 0,
  professional: 1,
  enterprise: 2,
};

export function normalizePlan(plan: unknown): BillingPlanId {
  const value = String(plan ?? "free").toLowerCase();
  if (value === "professional" || value === "enterprise") return value;
  return "free";
}

export function isPaidPlan(plan: unknown): plan is PaidPlanId {
  return plan === "professional" || plan === "enterprise";
}

export function getPriceIdForPlan(plan: PaidPlanId): string {
  return plan === "professional" ? getProfessionalPriceId() : getEnterprisePriceId();
}

export function centsToMajor(amount: number | null | undefined): number {
  return Math.round((amount ?? 0)) / 100;
}

export function stripeTimestampToDate(timestamp: number | null | undefined): string | null {
  if (!timestamp) return null;
  return new Date(timestamp * 1000).toISOString();
}

export function getSubscriptionPeriodEnd(subscription: Stripe.Subscription): string | null {
  const value = (subscription as unknown as { current_period_end?: number }).current_period_end;
  return stripeTimestampToDate(value);
}

export function getSubscriptionPeriodEndTimestamp(subscription: Stripe.Subscription): number | null {
  return (subscription as unknown as { current_period_end?: number }).current_period_end ?? null;
}

function summarizePaymentMethod(value: unknown): PaymentMethodSummary {
  if (!value || typeof value === "string") return null;

  const paymentMethod = value as Stripe.PaymentMethod;
  if (paymentMethod.type !== "card" || !paymentMethod.card) return null;

  return {
    brand: paymentMethod.card.brand,
    last4: paymentMethod.card.last4,
  };
}

export async function getDefaultPaymentMethodSummary(
  stripe: Stripe,
  subscription: Stripe.Subscription | null,
  customerId: string,
): Promise<PaymentMethodSummary> {
  const subscriptionPaymentMethod = subscription?.default_payment_method;
  const fromSubscription = summarizePaymentMethod(subscriptionPaymentMethod);
  if (fromSubscription) return fromSubscription;

  if (typeof subscriptionPaymentMethod === "string") {
    return summarizePaymentMethod(await stripe.paymentMethods.retrieve(subscriptionPaymentMethod));
  }

  const customer = await stripe.customers.retrieve(customerId, {
    expand: ["invoice_settings.default_payment_method"],
  });

  if (customer.deleted) return null;

  const customerPaymentMethod = customer.invoice_settings.default_payment_method;
  const fromCustomer = summarizePaymentMethod(customerPaymentMethod);
  if (fromCustomer) return fromCustomer;

  if (typeof customerPaymentMethod === "string") {
    return summarizePaymentMethod(await stripe.paymentMethods.retrieve(customerPaymentMethod));
  }

  return null;
}

export function summarizeInvoice(invoice: Stripe.Invoice): InvoiceSummary {
  return {
    id: invoice.id ?? "",
    date: new Date(invoice.created * 1000).toISOString(),
    description: invoice.lines.data[0]?.description ?? "Subscription invoice",
    amount: centsToMajor(invoice.amount_paid || invoice.amount_due),
    currency: invoice.currency.toUpperCase(),
    status: invoice.status,
    hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
    invoicePdf: invoice.invoice_pdf ?? null,
  };
}
