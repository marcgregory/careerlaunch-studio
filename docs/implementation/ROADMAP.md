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
- Database-backed Playwright happy path now verifies signup, save, and real PDF export bytes.

## In Progress

- Builder completeness: finish guided editing coverage for all resume sections, empty states, validation, and recovery states.
- First original resume template polish for desktop and mobile.
- Accessibility checks for the builder flow.

## Sprint Queue

- Sprint 2 - Template Library and Resume Checker Depth.
- Sprint 3 - Cover Letter Builder and Paid Export Gates.
- Sprint 4 - AI Rewrite Assistance and Role Tailoring.
- Sprint 5 - Import Existing Resume and Version Duplication.

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
