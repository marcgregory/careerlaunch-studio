# Backup & Recovery

## Provider

Neon (managed PostgreSQL for serverless). Backups are handled by Neon's
point-in-time recovery (PITR) system.

## Current Schedule

| Feature          | Detail                         |
| ---------------- | ------------------------------ |
| Automatic backups | Enabled by default on Neon     |
| Retention         | 7 days (Neon Pro plan)         |
| WAL archive       | Continuous (unlimited)         |
| Point-in-time     | Any point within retention     |

## Restore Procedure

1. **Go to the Neon console** → **Backups** tab for the project.
2. Select the restore point:
   - **Timestamp**: pick a specific time (e.g. "2026-07-04 14:30:00 UTC").
   - **Backup ID**: pick from the list of automated backups.
3. **Create a branch** from that point. Neon creates an isolated database
   branch with the restored data.
4. **Update `DATABASE_URL`** in Vercel (or locally) to point to the
   restored branch's connection string.
5. **Run schema migration**:
   ```bash
   npx prisma migrate deploy
   ```
   This applies any migrations created *after* the restore point.
6. **Verify**:
   ```bash
   curl https://your-app.vercel.app/api/health
   # → { "checks": { "database": "ok", ... } }
   ```
7. **Promote the branch** to primary in the Neon console once verified.

## Migration Rollback

Prisma does not support `npx prisma migrate down`. To roll back a
migration:

### Option A — Restore from backup (preferred)

Follow the restore procedure above using a point in time before the
problematic migration was applied.

### Option B — Manual revert (emergency only)

1. Identify the migration to revert:
   ```bash
   npx prisma migrate status
   ```
2. Apply the SQL from the previous migration manually, or write a
   compensating migration that reverses the schema changes.
3. Mark the migration as rolled back:
   ```bash
   npx prisma migrate resolve --rolled-back <migration-name>
   ```

## Manual SQL Dump (emergency)

Run this on any machine with `pg_dump` and access to the database:

```bash
pg_dump --no-owner "$DATABASE_URL" > careerlaunch_$(date +%Y%m%d).sql
```

**When to use:** Before running a high-risk migration, or as an extra
safety net during the first month after launch.

**Restore from dump:**

```bash
createdb careerlaunch_restored
psql "$DATABASE_URL" < careerlaunch_20260704.sql
```

## Testing the Backup

1. Create a test branch from a recent backup in Neon.
2. Point a staging deployment at it.
3. Run `npm run test` and `npm run test:e2e` against the staging URL.
4. Confirm user data, resumes, and cover letters are intact.
5. Delete the test branch when done.

## Incident Response

If database issues are detected (via `GET /api/health` returning
`database: "error"` or Sentry alerts):

1. Check [Neon Status](https://neon.statuspage.io).
2. If it's a Neon incident, wait for resolution — backups are safe.
3. If it's a data issue (corruption, accidental delete), restore to a
   branch (see Restore Procedure) and update `DATABASE_URL`.
4. Notify users if data loss occurred.
