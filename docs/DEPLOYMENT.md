# CareerLaunch Studio Deployment

Last updated: 2026-07-03

## Environments

- Local: developer machine with local Postgres or hosted development database.
- Preview: per-branch deploys for UI review.
- Staging: production-like environment for Stripe test mode, migrations, and release checks.
- Production: public app with live billing and monitored exports.

## Deployment Target

Recommended MVP target: Vercel for the Next.js app and Neon or Supabase for managed Postgres. This keeps operations light while supporting previews, rollbacks, managed TLS, and environment separation.

## CI/CD

Every pull request should run:

- TypeScript check.
- Lint.
- Unit tests.
- Integration tests where environment services are available.
- Playwright smoke tests for critical paths.
- Prisma migration validation.

## Runtime Dependencies

PDF export uses Playwright Chromium from the server-only renderer. Hosting images or build containers must install the Chromium browser binaries before serving export traffic:

```bash
npx playwright install --with-deps chromium
```

On platforms that do not support `--with-deps`, install the equivalent OS packages plus the Chromium browser binary during the build image setup.

## Release Process

1. Merge passing changes into main.
2. Deploy to staging.
3. Run release checklist from `docs/implementation/RELEASE_PLAN.md`.
4. Promote to production.
5. Monitor logs, error rates, export failures, and payment webhooks.
6. Update changelog and project status.

## Rollback

Use platform rollback for app deployments. Database migrations must be backwards-compatible where possible. High-risk migrations require a written rollback note in the release checklist.

## Operations

- Daily database backups through the managed provider.
- Error alerts for payment webhooks and export failures.
- Basic uptime monitoring.
- Secret rotation policy before public launch.
- Stripe webhook replay procedure documented before paid launch.
