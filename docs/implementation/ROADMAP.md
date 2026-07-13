# CareerLaunch Studio Roadmap

Last updated: 2026-07-14

## Completed

- Product foundation, authenticated resume builder, persistence, four resume templates, autosave, scoring, and PDF export.
- AI analysis, job matching, resume tailoring, suggestion diff/apply, cover-letter generation, explainability, safety checks, and feedback analytics.
- Stripe billing, entitlements, webhook idempotency, grace periods, and production checkout smoke coverage.
- Sprint 6D auth hardening, parser hardening, error recovery, real-provider AI validation, mobile QA, and production deployment.
- Parser regressions R1, R3, and R7 fixed with regression fixtures; 147 parser tests and 428 total tests pass.
- Production verification of health, authentication, builder, resume persistence, AI analysis, cover letters, PDF export, billing, and logout.

## In Progress

### Operational Readiness and Closed-Beta Operations

- Modernize Sentry and verify production error capture.
- Keep production verification evidence current while operational controls are automated.

## Sprint Queue

1. Automated CI release gate for health, authentication, builder, resume CRUD, AI analysis, PDF export, billing, and Sentry.
2. Production observability: structured logs, request IDs, error context, AI latency, and PDF export latency.
3. Distributed rate limiting backed by a shared production store.
4. Closed-beta operations: dashboards, alerts, incident checklist, feedback intake, and invite rollout.
5. Invite the first closed-beta cohort after the operational gate passes.

## Future

- DOCX and TXT export.
- URL-based job-description ingestion.
- Admin analytics.
- Localization.
- Annual billing, coupons, and promotions.
- Team and enterprise accounts.
- Partner dashboards for bootcamps and career coaches.

## Blocked

- Public launch remains blocked on legal review and the broader manual accessibility audit.
- Closed-beta invitations wait for Sentry verification, automated release gating, and shared rate limiting.
