# CareerLaunch Studio Architecture

Last updated: 2026-07-03

## Complexity Classification

MVP with production hygiene. The app needs auth, billing, private user data, export reliability, and a path to AI suggestions, but it does not yet need microservices, Kubernetes, realtime collaboration, or enterprise tenancy.

## Architecture Summary

Use a TypeScript monorepo with a Next.js web app, PostgreSQL, Prisma, shared packages, Stripe billing, and a simple worker path introduced when exports or AI tasks become too slow for request/response.

## Recommended Architecture

Modular monolith inside a monorepo:

- `apps/web` owns UI, routes, server actions, and API endpoints.
- `packages/domain` owns resume schemas, scoring rules, and business types.
- `packages/ui` owns reusable UI primitives.
- `packages/rendering` owns resume template rendering and export preparation.
- `packages/config` owns shared TypeScript, lint, and test config.

## Rationale

This keeps the first build fast while preserving boundaries for future growth. Resume editing, scoring, billing, and export share user and document data, so splitting them into services now would add latency and operational overhead without solving a current problem.

## Rejected Alternatives

- Microservices: rejected because the team is small and deployment independence is not needed.
- Kubernetes: rejected because managed app hosting plus managed Postgres is enough for MVP.
- Event sourcing: rejected because document version history can be solved with simple snapshots initially.
- Dedicated search engine: rejected until content library search becomes large enough to justify it.
- Realtime collaborative editing: rejected for MVP because it complicates state and conflict resolution.

## Folder Structure

```text
apps/
  web/
    app/
    components/
    features/
      auth/
      billing/
      builder/
      dashboard/
      export/
      resume-checker/
    lib/
    tests/
packages/
  config/
  domain/
  rendering/
  ui/
docs/
  adr/
  implementation/
prisma/
  schema.prisma
```

## Package Boundaries

`packages/domain` contains pure business logic and validation. `packages/rendering` consumes domain resume data and returns renderable document structures. `apps/web` orchestrates user flows and persistence. Feature modules should expose intentional public APIs rather than importing internal files from each other.

## Feature Boundaries

- Auth: identity, sessions, account security.
- Builder: resume document editing and autosave.
- Resume Checker: quality scoring and improvement recommendations.
- Templates: template metadata, style controls, preview rendering.
- Export: PDF/DOCX/TXT generation and download authorization.
- Billing: plans, entitlements, Stripe webhooks.
- Content Assistance: role-specific suggestions and AI rewrites.

## Application Boundaries

One web application for MVP. Add an admin surface inside the same app behind admin authorization after product metrics are needed.

## Shared Packages

- `domain`: Zod schemas, TypeScript types, resume scoring, entitlement rules.
- `rendering`: template components, pagination helpers, PDF render adapters.
- `ui`: accessible buttons, inputs, dialogs, tabs, sidebars, toasts.
- `config`: lint, TypeScript, Vitest, Playwright shared settings.

## Data Model

Core entities:

- User
- Account/session records from auth provider
- ResumeDocument
- ResumeVersion
- Template
- ExportJob
- Subscription
- BillingEvent
- SuggestionUsage
- ResumeScore

## Database Recommendation

PostgreSQL with Prisma. Use JSONB for resume document bodies during MVP, backed by strict Zod schemas in application code. Promote frequently queried fields into relational columns when product analytics or search requirements demand it.

## API Architecture

Use Next.js server actions for authenticated mutations close to UI flows and route handlers for webhooks, exports, and public endpoints. Keep API contracts typed through shared schemas.

## Authentication and Authorization

Use Auth.js or Clerk. Authorization rules:

- Users can access only their own documents.
- Paid export formats and AI usage require entitlement checks.
- Stripe webhooks update subscription state through verified signatures.
- Admin routes require explicit admin role.

## State Management

### Server State

Resume documents, versions, templates, scores, subscriptions, exports, and usage counters live in PostgreSQL and are accessed through typed server functions.

### Client State

Builder panel state, active section, unsaved field buffers, preview zoom, selected style controls, modal state, and temporary validation messages stay in React state or a small client store.

### Realtime State

Realtime collaboration is out of scope. Autosave status can use local optimistic state and server confirmation. No WebSocket infrastructure is required for MVP.

### Synchronization Rules

Autosave writes section-level updates with updated timestamps. Server responses become the source of truth. Conflicting writes should prefer last-write-wins in Sprint 1 and introduce version conflict handling when document history becomes user-facing.

## Realtime Strategy

None for MVP. Add presence or collaborative editing only after user research proves it matters.

## Background Jobs

Start synchronous for simple PDF export if reliable under 10 seconds. Add a managed queue only when exports, AI rewrites, or imports exceed request time limits.

## Security Architecture

- Validate all input with shared schemas.
- Use row-level ownership checks in application queries.
- Store secrets only in environment variables.
- Verify Stripe webhook signatures.
- Rate-limit auth, AI, export, and public endpoints.
- Keep audit records for billing, export, and account changes.
- Provide data deletion/export paths before public launch.

## Observability

Use structured logs, error tracking, uptime checks, and product analytics. Track export failures, autosave errors, payment webhook failures, and slow rendering.

## Deployment Architecture

Deploy web app to Vercel or Render, database to Neon/Supabase, assets to object storage only when exports or template assets require it. Use preview, staging, and production environments.

## Performance Targets

- Lighthouse performance above 85 on builder dashboard.
- P95 non-AI server action under 500 ms.
- PDF export under 10 seconds for normal documents.
- Builder input latency below perceptible lag.

## Accessibility Requirements

Keyboard navigable builder, semantic form labels, focus management for dialogs, accessible color contrast, readable resume preview controls, and automated axe checks for core flows.

## AI Architecture

See [AI.md](AI.md) for the full AI architecture, including provider abstraction, analysis pipeline, suggestion schema, prompt architecture, response validation, cost controls, and privacy design.

## Architecture Risks

- PDF fidelity may require deeper rendering investment than expected.
- JSONB document storage can become limiting for analytics if not revisited.
- AI usage can create cost spikes without quotas — see [AI.md](AI.md#cost-controls) for controls.
- Subscription state must be carefully synchronized with Stripe webhooks.

