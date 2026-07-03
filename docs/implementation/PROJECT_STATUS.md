# CareerLaunch Studio Project Status

Last updated: 2026-07-03

## Current Sprint

Sprint 1 - Resume Builder Vertical Slice.

## Progress

Sprint 1 is in progress. The first local vertical slice has been upgraded with first-party email/password auth, protected dashboard and builder routes, Prisma-backed resume create/edit/save code paths, ownership-checked resume APIs, and real ownership-checked PDF export downloads.

PDF export is now real using Playwright print-to-PDF.

## Focus

Finish builder completeness, polish the first original resume template for desktop and mobile, and add accessibility checks before marking Sprint 1 complete. Template Library / deeper resume checker work is the next major product area after Sprint 1.

## Architecture Status

Architecture selected: TypeScript monorepo, Next.js modular monolith, PostgreSQL, Prisma, Stripe, and deferred queue infrastructure. Sprint 1 auth currently uses first-party password sessions with signed HTTP-only cookies. PDF rendering lives in `packages/rendering` with a browser-safe preview entry and a server-only Playwright renderer entry.

## Platform Status

Next.js app scaffold exists and production build passes locally. Prisma schema and initial PostgreSQL migration exist. The local environment now has `DATABASE_URL` available to Playwright, and the database-backed signup/save/export flow passes locally.

## Blockers

- Production PostgreSQL must be provisioned and `DATABASE_URL` must be configured for deployed environments.
- Initial Prisma migration must be applied to staging and production databases.
- First original template direction must be designed and polished.
- Legal review is needed before paid launch.
- `npm audit` reports 5 dependency advisories after adding Prisma and Playwright; review before launch unless a high or critical advisory affects runtime risk.

## Next Milestone

MVP Preview Release after Sprint 1.

## Last Build

Local build passed on 2026-07-03 with `npm run build` using Next webpack build mode. Local tests, typecheck, and Playwright passed with `npm run test`, `npm run typecheck`, and `npm run test:e2e --workspace @careerlaunch/web`. Playwright covered anonymous auth protection and the database-backed signup/save/real-PDF-export happy path.
