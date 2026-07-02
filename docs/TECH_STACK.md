# CareerLaunch Studio Tech Stack

Last updated: 2026-07-03

## Recommended Stack

- Language: TypeScript.
- Runtime: Node.js LTS.
- Web framework: Next.js App Router.
- UI: React, Tailwind CSS, Radix UI, lucide-react.
- Forms: React Hook Form and Zod.
- Database: PostgreSQL.
- ORM: Prisma.
- Auth: Auth.js for self-hosted flexibility or Clerk for faster managed auth.
- Billing: Stripe Checkout, Customer Portal, and webhooks.
- Testing: Vitest, Testing Library, Playwright, axe checks.
- PDF export: start with Playwright/Chromium print-to-PDF or a React PDF renderer spike; choose based on fidelity.
- AI assistance: provider abstraction around OpenAI-compatible APIs, introduced behind usage limits.
- Analytics: PostHog or a privacy-conscious equivalent.
- Error tracking: Sentry.
- Deployment: Vercel plus Neon/Supabase Postgres for the simplest path.

## Package Suggestions

- `zod` for shared validation.
- `@prisma/client` and `prisma` for data access.
- `next-safe-action` or plain server actions with schemas for mutations.
- `@stripe/stripe-js` and `stripe` for billing.
- `react-hook-form` for builder forms.
- `@radix-ui/react-*` for accessible primitives.
- `lucide-react` for icons.
- `@playwright/test` for e2e and PDF smoke checks.
- `vitest` for domain unit tests.

## Testing Strategy

- Unit: resume scoring, schemas, entitlement checks, formatting helpers.
- Integration: auth-protected document access, autosave persistence, export authorization, Stripe webhook handling.
- End-to-end: sign up, create resume, edit sections, score resume, export PDF, upgrade path.
- Accessibility: axe checks on dashboard, builder, pricing, checkout entry, and export flow.
- Security: ownership checks, webhook signature tests, input validation, rate-limit coverage.
- Performance: builder interaction smoke tests and export duration budget.

## Tooling

- ESLint and Prettier for code quality.
- TypeScript strict mode.
- Husky or simple CI hooks after implementation starts.
- GitHub Actions for build, lint, tests, and Playwright smoke checks.

## Rejected Options

- Rails or Laravel: productive, but TypeScript/Next.js better matches the likely frontend-heavy builder.
- Microservice stack: too much overhead for MVP.
- MongoDB as primary database: resume JSON fits documents, but subscriptions, ownership, exports, and audit events benefit from relational constraints.
- Custom auth from scratch: unnecessary risk.

