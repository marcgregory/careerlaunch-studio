# CareerLaunch Studio Roadmap

Last updated: 2026-07-03

## Completed

- Project foundation created.
- Product scope, PRD, architecture, tech stack, deployment, ADRs, founder analysis, release plan, and sprint plan documented.
- Monorepo scaffold created.
- Local resume-builder demo created with dashboard, builder, preview, scoring, autosave, and print export.
- Initial Prisma schema created.
- First-party email/password auth, protected routes, and Prisma-backed resume persistence implemented.
- Real PDF export implemented with Playwright print-to-PDF and ownership-checked download responses.
- Builder completeness delivered for all core resume sections, including add/remove/reorder flows, empty states, validation, autosave state, and reset/export recovery states.
- First original resume template polished across live preview and PDF export.
- Release-closeout QA completed for desktop/mobile builder behavior, accessibility basics, preview/PDF parity, and full local verification.
- Database-backed Playwright coverage verifies signup, save, real PDF export bytes, repeated PDF render stability, and builder section/item ordering persistence.
- Template registry refactored to semantic properties, removing per-template conditionals (`isAts`, `isExecutive`) from renderers.
- PDF renderer now generates CSS programmatically from template definitions, eliminating preview/PDF drift.
- Template gallery is data-driven — uses `premium`, `accentColor`, `swatches` metadata for selection highlights and lock overlays.
- Playwright visual regression tests added for all 4 templates (modern, executive, minimal, ats).
- Template-specific PDF QA tests verify each template produces valid, single-page PDF output.
- Sprint 3A — AI Analysis Engine (read-only). `v0.3.1-alpha` tagged. Analysis pipeline, suggestion schema, provider abstraction, MockProvider, health dashboard, accept/dismiss UI.
- Sprint 3A.5 — Apply Engine + Acceptance Persistence. Pure-function apply layer, API endpoint, database persistence for accepted suggestions, stale-target 409 handling, 5 safe operations (replace_summary, replace_bullet, replace_skill, add_skill, remove_skill), suggestion-to-operation mapping, and Playwright E2E acceptance tests.

## In Progress

- Sprint 3B — Suggestion Preview / Diff UI. Word-diff component, review modal, two-step accept (review → apply), side-by-side before/after highlighting, cancel/escape dismiss.

## Sprint Queue

- Sprint 3C — Job Matching. Resume + Job Description → match %, missing keywords, missing skills, suggested improvements.
- Sprint 3D — Cover Letter Builder. Reuses resume, job description, template engine, and PDF renderer.
- Sprint 4 — Import Existing Resume and Version Duplication.
- Sprint 5 — Paid Export Gates, Premium Template Entitlements, Subscription Tier Enforcement.

## Future

- DOCX export.
- TXT export.
- Job-description matching.
- Partner dashboards for bootcamps and career coaches.
- Localization.
- Admin analytics.

## Blocked

- Final auth provider is undecided.
- Production database connection details are not configured.
- Final brand name, legal requirements, and payment-market policy remain unconfirmed.