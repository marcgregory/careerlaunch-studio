# CareerLaunch Studio Project Status

Last updated: 2026-07-03

## Current Sprint

Sprint 1 - Resume Builder Vertical Slice is release-complete.

## Progress

Sprint 1 is complete for the MVP preview release bar. The local vertical slice includes first-party email/password auth, protected dashboard and builder routes, Prisma-backed resume create/edit/save code paths, ownership-checked resume APIs, a complete multi-section builder, validation and recovery states, live preview, section ordering, and real ownership-checked PDF export downloads.

PDF export is implemented using Playwright print-to-PDF through the server-only rendering entry.

## Closeout QA

- Builder desktop/mobile pass completed against the responsive builder layout, sticky action header, editor panels, and live preview surface.
- Accessibility pass completed for the release scope: labels are present on form controls, icon-only controls expose accessible names, status text uses `aria-live`, protected routes redirect anonymous users, and reduced-motion handling exists globally.
- Preview and PDF polish pass completed for the first original resume template, including section ordering parity between browser preview and generated PDF.
- `next-env.d.ts` was restored to the production routes import after dev/e2e runs.

## Focus

Sprint 1 is closed. Do not add more Sprint 1 product scope unless a release blocker appears. Next focus is Sprint 2: Template Library and deeper resume checker depth.

## Architecture Status

Architecture selected: TypeScript monorepo, Next.js modular monolith, PostgreSQL, Prisma, Stripe, and deferred queue infrastructure. Sprint 1 auth currently uses first-party password sessions with signed HTTP-only cookies. PDF rendering lives in `packages/rendering` with a browser-safe preview entry and a server-only Playwright renderer entry.

## Platform Status

Next.js app scaffold exists and production build passes locally. Prisma schema and initial PostgreSQL migration exist. The local environment has `DATABASE_URL` available to Playwright, and the database-backed signup/save/export flow passes locally.

## Blockers

- Production PostgreSQL must be provisioned and `DATABASE_URL` must be configured for deployed environments.
- Initial Prisma migration must be applied to staging and production databases.
- Legal review is needed before paid launch.
- `npm audit` reports 5 dependency advisories after adding Prisma and Playwright; review before launch unless a high or critical advisory affects runtime risk.

## Next Milestone

Sprint 2 - Template Library and Resume Checker Depth.

## Last Build

Local release verification passed on 2026-07-03:

- `npm run build`
- `npm run test`
- `npm run typecheck`
- `npm run test:e2e --workspace @careerlaunch/web`

Playwright covered anonymous auth protection, database-backed signup/save/real-PDF-export, repeated PDF render stability, and builder section/item ordering persistence.