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

PDF export uses `@sparticuz/chromium-min` + `playwright-core` from the server-only renderer. The `@sparticuz/chromium-min` package downloads the Chromium binary at runtime from a hosted pack URL (set via `CHROMIUM_PACK_URL`). This avoids bundling the ~200 MB binary into the serverless deployment.

**Vercel**: set `CHROMIUM_PACK_URL` to a publicly accessible URL of a Chromium pack tarball. No binary bundling is needed.

**Other platforms** (Docker, VPS): set `CHROMIUM_PACK_URL` the same way, or install Chromium via the system package manager and omit `@sparticuz/chromium-min`.

To generate your own Chromium pack for self-hosting:

```bash
# From an environment with @sparticuz/chromium-min installed
node -e "
  const c = require('@sparticuz/chromium-min');
  c.executablePath('https://your-bucket.example.com/chromium-pack.tar').then(console.log);
"
```

Then upload the downloaded pack to a CDN, S3 bucket, or your app's `/public` directory on Vercel.

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
