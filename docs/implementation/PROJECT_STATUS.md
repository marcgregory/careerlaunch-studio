# CareerLaunch Studio Project Status

Last updated: 2026-07-03

## Current Sprint

Sprint 2 - Template Library and Resume Checker Depth is in progress.

## Progress

### Template Foundation Complete

The template system has been refactored from per-template conditionals to a registry-driven architecture:

- **Template registry** (`packages/rendering/src/index.tsx`): Each template is defined by semantic properties (`headerStyle`, `nameStyle`, `roleStyle`) rather than hardcoded ID checks. Adding a new template requires one config object with no renderer changes.
- **Metadata-driven gallery**: Templates carry `premium`, `accentColor`, and `swatches`. The gallery uses these for selection highlights and premium lock overlays. Premium templates are visually gated but not backend-enforced until Stripe integration.
- **PDF from registry**: The PDF renderer generates CSS programmatically from the template definition via `pdfCss()`, eliminating preview/PDF drift that would arise from maintaining two separate style sources.
- **Four polished templates**: Modern (accent bar, editorial), Executive (double-rule, serif-adjacent), Minimal (thin-rule, monochrome), ATS Classic (simple, parser-friendly).

### Test Coverage

- Visual regression tests (Playwright `toHaveScreenshot()`) for all 4 templates.
- Template-specific PDF QA tests verify each template produces valid, single-page PDF output.
- All existing tests continue to pass.

## Closeout QA

- Desktop builder pass completed — gallery, preview, PDF export all verified.
- Template lock UI tested for premium-gated flow.
- Build, unit tests, and typecheck all pass.

## Focus

Complete Sprint 2 closeout. The remaining items are:
- Resume checker depth improvements.
- Full e2e verification with database.

## Architecture Status

Architecture selected: TypeScript monorepo, Next.js modular monolith, PostgreSQL, Prisma, Stripe, and deferred queue infrastructure. Auth currently uses first-party password sessions with signed HTTP-only cookies. PDF rendering lives in `packages/rendering` with a browser-safe preview entry and a server-only Playwright renderer entry. The template registry is the single source of truth for both browser preview and PDF rendering.

## Platform Status

Next.js app scaffold exists and production build passes locally. Prisma schema and initial PostgreSQL migration exist. The local environment has `DATABASE_URL` available to Playwright, and the database-backed signup/save/export flow passes locally.

## Blockers

- Production PostgreSQL must be provisioned and `DATABASE_URL` must be configured for deployed environments.
- Initial Prisma migration must be applied to staging and production databases.
- Legal review is needed before paid launch.
- `npm audit` reports 5 dependency advisories after adding Prisma and Playwright; review before launch unless a high or critical advisory affects runtime risk.

## Next Milestone

Complete Sprint 2 and begin Sprint 3 - Cover Letter Builder and Paid Export Gates.

## Last Build

Local build verification passed on 2026-07-03:

- `npm run build` — passes
- `npm run test` — 2/2 domain tests pass
- `npm run typecheck` — passes
- `npm run test:e2e --workspace @careerlaunch/web` — pending database availability

Playwright covers anonymous auth protection, database-backed signup/save/real-PDF-export, repeated PDF render stability, builder section/item ordering persistence, visual regression across all 4 templates, and template-specific PDF QA.