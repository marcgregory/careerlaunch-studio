# Closed Beta Release Checklist

Last updated: 2026-07-14

## Verified Release Evidence

- [x] Production deployment completed and aliased to `https://careerlaunch-studio.vercel.app`.
- [x] Production health endpoint returns healthy app, database, PDF renderer, and billing checks.
- [x] Authentication, dashboard access, and logout smoke paths pass.
- [x] Resume creation, opening, autosave, reload, and CRUD paths pass.
- [x] Real AI provider validation passes with Gemini/Groq coverage.
- [x] AI analysis, tailoring, and cover-letter production smoke paths pass.
- [x] PDF export production smoke path passes.
- [x] Stripe Checkout URL creation and paid entitlement smoke paths pass.
- [x] Mobile QA passes.
- [x] Resume-flow Playwright coverage passes.
- [x] Import parser regression coverage passes: 147 tests.
- [x] Full automated test suite passes: 428 tests.
- [x] Typecheck passes.
- [x] Lint passes.
- [x] Production build passes.

## Remaining Operational Gate

- [ ] Complete Sentry modernization.
- [ ] Capture and verify a production-safe Sentry test event with environment, release, route, and request context.
- [ ] Add a CI release gate covering health, authentication, builder, resume CRUD, AI analysis, PDF export, billing, and Sentry.
- [ ] Add structured production logging with request-ID correlation.
- [ ] Record and expose AI and PDF export latency.
- [ ] Replace in-memory rate limiting with a shared production backend.
- [ ] Add closed-beta dashboards, alert thresholds, incident checklist, and feedback intake.
- [ ] Reconcile Vercel Build Command settings with the documented deployment path.
- [ ] Complete the broader manual accessibility audit before public launch.
- [ ] Complete legal review before public paid launch.

## Parser Freeze Gate

- [x] R1, R3, and R7 have reproducing fixtures and passing regression tests.
- [x] Existing parser regression suite is green.
- [x] Parser is feature-frozen for closed beta.

Any future parser change must start with a real reproducing document and a regression test that fails before the fix. Speculative parser improvements are not release work.

## Closed-Beta Go/No-Go

Current decision: **Conditional go**. Core product and production smoke gates pass. Invite rollout begins after Sentry production verification, automated release gating, and distributed rate limiting are complete.
