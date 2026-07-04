# Sprint 4.5 — Production Readiness

**Goal:** Add error monitoring, structured logging, basic analytics, health endpoint, rate limiting, and backup verification before building the monetization layer.

**Duration:** 1–2 days.

**Tag:** `v0.5.0-alpha` (existing tag — this sprint does not change it)

---

## 1. Request ID Middleware

**Problem:** 14 API routes log errors into a void. The PDF renderer already accepts and logs `X-Request-ID`, but the Vercel app never generates one.

**Change:**

Create `apps/web/lib/request-id.ts`:

```ts
const REQUEST_ID_HEADER = "X-Request-ID";

export function getRequestId(request: Request): string {
  const fromHeader = request.headers.get(REQUEST_ID_HEADER);
  if (fromHeader) return fromHeader;
  return crypto.randomUUID();
}
```

Then update every API route that calls the PDF renderer (`/api/export/pdf`, `/api/export/cover-letter-pdf`) to pass the request ID header from the incoming request rather than generating a new one on the spot. The pattern is:

```ts
// Before
const requestId = crypto.randomUUID();
// After
const requestId = getRequestId(request);
```

This lets you correlate a failing Vercel request with the renderer log via one UUID.

**Files touched:**
- `apps/web/lib/request-id.ts` (new)
- `apps/web/app/api/export/pdf/route.ts` (use `getRequestId`)
- `apps/web/app/api/export/cover-letter-pdf/route.ts` (use `getRequestId`)

---

## 2. Sentry Error Monitoring

**Tool:** [@sentry/nextjs](https://docs.sentry.io/platforms/javascript/guides/nextjs/)

**Scope:** Server-side error capture in API routes + client-side error capture in the builder.

**Why:** Catches crashes in production before users report them. Tags errors with the release version and the request ID for correlation.

### Steps

**2a. Install and configure**

```bash
npm install @sentry/nextjs --workspace @careerlaunch/web --save
```

Run the Sentry Next.js wizard or manually:

1. Create `apps/web/sentry.client.config.ts` — client-side DSN, environment, release tag from `process.env.VERCEL_GIT_COMMIT_SHA`.
2. Create `apps/web/sentry.server.config.ts` — server-side DSN, environment, release tag.
3. Update `next.config.mjs` to wrap with `withSentryConfig`.

**Env vars added:**
- `SENTRY_DSN` — the project DSN (set in Vercel dashboard, not committed)
- `NEXT_PUBLIC_SENTRY_DSN` — public DSN for client-side (or use tunnel)

**2b. Capture API route errors**

Add a `reportError` helper in `apps/web/lib/error-reporting.ts`:

```ts
import * as Sentry from "@sentry/nextjs";

export function reportError(
  error: unknown,
  requestId?: string,
  extra?: Record<string, unknown>,
) {
  if (process.env.NODE_ENV === "development") return; // noisy locally
  Sentry.captureException(error, {
    tags: { requestId: requestId ?? "none" },
    extra,
  });
}
```

**2c. Instrument critical API routes**

Add `reportError` calls in the catch blocks of:
- `/api/resumes/:id/analyze` — analysis failures
- `/api/resumes/:id/job-match` — job match failures
- `/api/resumes/:id/cover-letter/generate` — cover letter generation failures
- `/api/export/pdf` — PDF export failures
- `/api/export/cover-letter-pdf` — cover letter PDF failures
- `/api/import/text` — import parsing failures

Each call receives the request ID and relevant context (resume ID, HTTP method).

**2d. Client-side error boundary**

Wrap the builder (`apps/web/app/builder/`) in a `Sentry.ErrorBoundary` so React render errors are captured with the resume ID context.

**Files touched:**
- `apps/web/sentry.client.config.ts` (new)
- `apps/web/sentry.server.config.ts` (new)
- `apps/web/next.config.mjs` (wrap with `withSentryConfig`)
- `apps/web/lib/error-reporting.ts` (new)
- `apps/web/app/api/resumes/[resumeId]/analyze/route.ts`
- `apps/web/app/api/resumes/[resumeId]/job-match/route.ts`
- `apps/web/app/api/resumes/[resumeId]/cover-letter/generate/route.ts`
- `apps/web/app/api/export/pdf/route.ts`
- `apps/web/app/api/export/cover-letter-pdf/route.ts`
- `apps/web/app/api/import/text/route.ts`
- `apps/web/app/builder/layout.tsx` (add error boundary)

---

## 3. PostHog Product Analytics

**Tool:** [posthog-js](https://posthog.com/docs/libraries/js) + [@posthog/node](https://posthog.com/docs/libraries/node)

**Scope:** Track key user actions. No dashboards yet — just ship events.

**Why:** Before subscriptions exist you need to know: how many users create resumes, how many analyze, how many export. This answers "is anyone using this?"

### Steps

**3a. Install**

```bash
npm install posthog-js --workspace @careerlaunch/web --save
npm install posthog-node --workspace @careerlaunch/web --save
```

**3b. Client-side provider**

Create `apps/web/lib/analytics.tsx` — a React context that provides a `posthog.capture` wrapper. Key constraints:

- **Only fires in production.** No noise from dev/staging.
- **No cookie consent gate yet** — PostHog's EU cookie law features can be added before public launch.
- **Client-side events:** `resume_imported`, `cover_letter_exported`.

```ts
// apps/web/lib/analytics.tsx
"use client";

import posthog from "posthog-js";
import { useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";

export function AnalyticsProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (process.env.NODE_ENV !== "production") return;
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;

    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://app.posthog.com",
      capture_pageview: true,
      loaded: (ph) => {
        if (process.env.NODE_ENV === "development") ph.opt_out_capturing();
      },
    });
  }, []);

  return <>{children}</>;
}

export function useAnalytics() {
  return {
    capture: (event: string, properties?: Record<string, unknown>) => {
      if (process.env.NODE_ENV !== "production") return;
      posthog.capture(event, properties);
    },
  };
}
```

**3c. Events to capture**

| Event | When | Source |
|-------|------|--------|
| `resume_created` | Resume created (dashboard "New resume" action) | client |
| `resume_imported` | Import completed (create draft from paste) | client |
| `resume_exported` | PDF download triggered | client |
| `analysis_run` | Analysis completed | client |
| `job_match_run` | Job match completed | client |
| `cover_letter_generated` | Cover letter draft generated | client |
| `cover_letter_exported` | Cover letter PDF downloaded | client |

**3d. Server-side events**

For sensitive events (e.g. analysis completed with score data), use the Node SDK in the API route after the operation succeeds:

```ts
import { PostHog } from "posthog-node";

const client = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY ?? "");

export async function captureServerEvent(
  event: string,
  distinctId: string,
  properties?: Record<string, unknown>,
) {
  if (process.env.NODE_ENV !== "production") return;
  client.capture({ distinctId, event, properties });
  await client.shutdownAsync();
}
```

Add `analysis_run` and `job_match_run` events in their respective route handlers (after `Response.json()`, not awaiting it — fire-and-forget).

**3e. Client-side injection points**

- `apps/web/app/builder/_analysis/health-dashboard.tsx` — `resume_created`, `analysis_run`
- `apps/web/app/builder/_analysis/cover-letter-panel.tsx` — `cover_letter_generated`, `cover_letter_exported`
- `apps/web/app/builder/_analysis/job-match-panel.tsx` — `job_match_run`
- `apps/web/app/import/page.tsx` — `resume_imported`

**Env vars added:**
- `NEXT_PUBLIC_POSTHOG_KEY` — project API key
- `NEXT_PUBLIC_POSTHOG_HOST` — self-host URL (optional, defaults to `app.posthog.com`)

**Files touched:**
- `apps/web/lib/analytics.tsx` (new)
- `apps/web/lib/server-analytics.ts` (new)
- `apps/web/app/layout.tsx` (add `AnalyticsProvider`)
- `apps/web/app/builder/_analysis/health-dashboard.tsx` (add events)
- `apps/web/app/builder/_analysis/cover-letter-panel.tsx` (add events)
- `apps/web/app/builder/_analysis/job-match-panel.tsx` (add events)
- `apps/web/app/import/page.tsx` (add events)
- `apps/web/app/api/resumes/[resumeId]/analyze/route.ts` (server-side `analysis_run`)
- `apps/web/app/api/resumes/[resumeId]/job-match/route.ts` (server-side `job_match_run`)

---

## 4. Rate Limiting

**Tool:** In-memory sliding window (no external dependency). For a single Vercel instance this is sufficient. If the app scales to multiple instances, swap to Upstash Redis later.

**Why:** AI analysis and PDF export are expensive. A naive script can burn through the free tier in minutes.

**Files:**
- `apps/web/lib/rate-limit.ts` (new)

```ts
// Sliding window rate limiter (in-memory, per-process)
interface WindowEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, WindowEntry>();

// Sweep stale entries every 60 seconds
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt < now) store.delete(key);
  }
}, 60_000);

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number,
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  let entry = store.get(key);

  if (!entry || entry.resetAt < now) {
    entry = { count: 1, resetAt: now + windowMs };
    store.set(key, entry);
    return { allowed: true, remaining: maxRequests - 1, resetAt: entry.resetAt };
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return { allowed: true, remaining: maxRequests - entry.count, resetAt: entry.resetAt };
}
```

**Limits:**

| Route | Limit | Window |
|-------|-------|--------|
| `/api/export/pdf` | 20 | 1 hour |
| `/api/export/cover-letter-pdf` | 20 | 1 hour |
| `/api/resumes/:id/analyze` | 10 | 1 hour |
| `/api/resumes/:id/job-match` | 20 | 1 hour |
| `/api/import/text` | 5 | 1 hour |

**Usage pattern (add to each route after auth check):**

```ts
const rateKey = `export:${user.id}`;
const { allowed, remaining, resetAt } = checkRateLimit(rateKey, 20, 60 * 60 * 1000);

if (!allowed) {
  return Response.json(
    { error: "Rate limit exceeded. Try again later." },
    {
      status: 429,
      headers: {
        "Retry-After": String(Math.ceil((resetAt - Date.now()) / 1000)),
        "X-RateLimit-Remaining": "0",
      },
    },
  );
}
```

**Files touched:**
- `apps/web/lib/rate-limit.ts` (new)
- `apps/web/app/api/export/pdf/route.ts`
- `apps/web/app/api/export/cover-letter-pdf/route.ts`
- `apps/web/app/api/resumes/[resumeId]/analyze/route.ts`
- `apps/web/app/api/resumes/[resumeId]/job-match/route.ts`
- `apps/web/app/api/import/text/route.ts`

---

## 5. Health Endpoint

**Problem:** The client-side health dashboard exists but has no API to call. There is no way to verify the app is alive without checking the builder UI.

**Change:**

Create `apps/web/app/api/health/route.ts`:

```ts
import { prisma } from "../../lib/prisma";

export const dynamic = "force-dynamic"; // never cache

export async function GET() {
  const checks: Record<string, "ok" | "error"> = {};

  // App version
  checks.app = "ok";

  // Database connectivity
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = "ok";
  } catch {
    checks.database = "error";
  }

  // PDF renderer
  const rendererUrl = process.env.PDF_RENDERER_URL;
  if (rendererUrl) {
    try {
      const baseUrl = rendererUrl.replace(/\/render$/, "");
      const res = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(5000) });
      checks["pdf-renderer"] = res.ok ? "ok" : "error";
    } catch {
      checks["pdf-renderer"] = "error";
    }
  } else {
    checks["pdf-renderer"] = "unconfigured";
  }

  const allOk = Object.values(checks).every((v) => v === "ok" || v === "unconfigured");

  return Response.json(
    {
      status: allOk ? "ok" : "degraded",
      version: process.env.VERCEL_GIT_COMMIT_SHA ?? "0.1.0",
      checks,
    },
    { status: allOk ? 200 : 503 },
  );
}
```

**Files touched:**
- `apps/web/app/api/health/route.ts` (new)

---

## 6. Backup Verification Doc

**Problem:** Database backups are mentioned in DEPLOYMENT.md but there's no documented restore procedure. If the database is lost, so are all user resumes.

**Change:**

Create `docs/operations/BACKUP_RECOVERY.md`:

```markdown
# Backup & Recovery

## Provider

Neon (managed PostgreSQL). Backups are handled by Neon's point-in-time recovery.

## Current Schedule

- Automatic backups: enabled by default on Neon
- Retention: 7 days (Neon Pro)
- WAL archive: continuous

## Restore Procedure

1. Go to the Neon console → Backups.
2. Select the restore point (timestamp or backup ID).
3. Create a new branch from that point.
4. Update `DATABASE_URL` in Vercel to point to the restored branch.
5. Run `npx prisma migrate deploy` if the schema has changed.
6. Verify: hit `GET /api/health` and confirm `database: "ok"`.

## Migration Rollback

Each migration is designed to be backwards-compatible within the same minor version:

- `npx prisma migrate down` — not supported by Prisma
- Instead, apply the previous migration's `down.sql` manually, or restore from backup

## Manual SQL Dump (emergency)

```bash
pg_dump --no-owner "$DATABASE_URL" > careerlaunch_$(date +%Y%m%d).sql
```

Keep daily dumps for the first month after launch.
```

**Files touched:**
- `docs/operations/BACKUP_RECOVERY.md` (new)

---

## Definition of Done

- [ ] `GET /api/health` returns app version, database status, renderer status
- [ ] Sentry captures unhandled errors on the server and client
- [ ] PostHog receives events for resume creation, import, analysis, job match, cover letter generation, and export
- [ ] Rate limits applied to high-risk routes return 429 with `Retry-After` header
- [ ] All PDF export requests forward the original `X-Request-ID` to the renderer
- [ ] `docs/operations/BACKUP_RECOVERY.md` documents Neon restore procedure
- [ ] Build passes (`npm run build`)
- [ ] TypeScript passes (`npm run typecheck`)
- [ ] Tests pass (`npm run test`)
