import Stripe from "stripe";

let _stripe: Stripe | null = null;

/**
 * Get the Stripe server-side instance.
 * Throws at runtime (not build time) if no secret key is configured.
 */
export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error("STRIPE_SECRET_KEY is not configured");
    }
    _stripe = new Stripe(key, {
      typescript: true,
    });
  }
  return _stripe;
}

/**
 * Get the Stripe publishable key for client-side usage.
 * Falls back to a dev placeholder if not configured.
 */
export function getStripePublishableKey(): string {
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (!key && process.env.NODE_ENV === "production") {
    throw new Error("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is required in production");
  }
  return key || "pk_test_placeholder";
}

export function getProfessionalPriceId(): string {
  return process.env.STRIPE_PROFESSIONAL_PRICE_ID ?? "";
}

export function getEnterprisePriceId(): string {
  return process.env.STRIPE_ENTERPRISE_PRICE_ID ?? "";
}

/** Base URL for redirects (Stripe Checkout return URLs). */
export function getBaseUrl(request?: Request): string {
  // Prefer the explicit env var (Vercel project setting)
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL;
  }
  // Derive from the incoming request headers (works on Vercel without config)
  if (request) {
    const origin = request.headers.get("origin");
    if (origin) return origin;
    const host = request.headers.get("host");
    if (host) {
      const proto = host.includes("localhost") || host.includes("127.0.0.1") ? "http" : "https";
      return `${proto}://${host}`;
    }
  }
  // Last resort — Vercel preview deployments
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "http://localhost:3000";
}
