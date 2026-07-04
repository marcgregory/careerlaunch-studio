import { vi } from "vitest";

// Set test environment variables
process.env.STRIPE_SECRET_KEY = "sk_test_mock";
process.env.STRIPE_PROFESSIONAL_PRICE_ID = "price_professional_mock";
process.env.STRIPE_ENTERPRISE_PRICE_ID = "price_enterprise_mock";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_mock";
process.env.NEXT_PUBLIC_BASE_URL = "http://localhost:3000";
