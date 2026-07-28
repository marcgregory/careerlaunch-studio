# Eliminate the create-then-redirect chain on /builder

## Context

The diagnostic captured at `apps/web/test-results/builder-loading-report.txt` (cleaned up after the investigation; production files are untouched) proved three things and disproved one:

- **Proved:** `app/builder/loading.tsx` executes correctly when Next.js streams the segment boundary.
- **Proved:** The browser never paints it during a `/dashboard → /builder` navigation. The DOM stays on the dashboard until the final page lands.
- **Proved:** The page runs two sequential server passes because of the `createStarterResume() → redirect("/builder?resumeId=...")` branch on `apps/web/app/builder/page.tsx:17-41`.
- **Disproved:** Adding a `<Suspense>` boundary inside the page would fix it. The diagnostic doesn't prove that — and given the redirect chain interrupts the first render, a Suspense boundary inside that interrupted render still wouldn't paint a skeleton to the user.

The fix is to **stop the create-then-redirect chain**: create the starter resume from the dashboard click, then `router.push` the user into `/builder?resumeId=...`. From the builder's perspective there is then only one server pass (load the existing resume). The user's trigger UX is a blocking progress overlay that opens within ~50ms of click, so they never stare at a blank page. After 3–5s the subtitle reassures them the request is still in flight.

This eliminates the only architectural inefficiency the diagnostic exposed. We re-run the diagnostic afterward to confirm. If anything remains (e.g., a different blank-flash on hard navigation), we revisit with the new evidence — *not* based on hypothesis.

## Files to modify

### 1. New shared starter-creation helper

**File:** `apps/web/lib/resume-store.ts`

Extract the create-from-starter logic from `apps/web/app/builder/page.tsx:23-39` into a new helper:

```ts
export async function createStarterResumeForUser(
  userId: string,
  options?: { idempotencyKey?: string }
): Promise<{ id: string }> {
  const starter = createStarterResume();
  const stored = toStoredResume(starter);
  // same shape as builder/page.tsx today, including the initial version
  // record and the optional idempotencyKey column (graceful-degradation
  // pattern from apps/web/app/api/resumes/[resumeId]/duplicate/route.ts:75-102).
  ...
}
```

This is the **single source of truth** — both the new endpoint and (initially) the page.tsx branch use it. After the page.tsx branch is removed, only the endpoint calls it.

### 2. New endpoint: `POST /api/resumes` (extend the existing handler)

**File:** `apps/web/app/api/resumes/route.ts`

The existing POST at `apps/web/app/api/resumes/route.ts:68-114` already accepts a parsed resume payload. Rather than introduce a sibling route, extend POST to handle a "kind" discriminator:

```ts
// Request body: { kind: "starter" } OR { kind: "custom", resume: ResumeDocument }
// No body at all is also acceptable and defaults to { kind: "starter" } for back-compat.
```

The starter branch:

1. Calls `requireApiUser()` — already at line 69.
2. Calls `requireEntitlement(user.id, FeatureKeys.RESUME_LIMIT)` — same gate as the duplicate route (`apps/web/app/api/resumes/[resumeId]/duplicate/route.ts:27-28`). Returns the same `{ error, feature, upgradeUrl }` 403 shape so the client can branch on `upgradeUrl`.
3. Reads `Idempotency-Key` header for replay protection — mirror the duplicate route's pattern at `apps/web/app/api/resumes/[resumeId]/duplicate/route.ts:49-68`.
4. Calls the new `createStarterResumeForUser(user.id, { idempotencyKey })` helper.
5. Fires `captureServerEvent("draft_created", user.id, { source: "dashboard_new_resume", resumeId: stored.id, ... })` — the existing POST at line 103-111 already does this with `source: "builder"`; we add a new `source` value.
6. Returns `Response.json({ resume: fromStoredResume(stored) }, { status: 201 })`.

### 3. New client hook: `useCreateResume`

**File:** `apps/web/app/dashboard/use-create-resume.ts`

Mirror `apps/web/app/dashboard/use-duplicate-resume.ts:124-282`:

- `useMutation` with `mutationKey: ["createResume"]`.
- `mutationFn` POSTs to `/api/resumes` with `{ kind: "starter" }` and `Idempotency-Key` header (UUID per click).
- `parseCreateError` helper (mirror of `parseDuplicateError` at `use-duplicate-resume.ts:110-120`) that lifts `upgradeUrl` onto a thrown `Error`.
- `onMutate`: insert an optimistic entry via the existing `optimisticallyAddResume(queryClient, optimisticResume)` at `use-duplicate-resume.ts:10-37`, return `{ optimisticId, toastId }`.
- `onSuccess`: replace the optimistic entry with the real one (using the existing `replaceOrRemoveOptimisticResume` at `use-duplicate-resume.ts:39-77`). `router.push("/builder?resumeId=" + data.resume.id)`.
- `onError`: rollback the optimistic entry; for `upgradeUrl` errors show a toast with an "Upgrade" action; otherwise show a toast with a "Try Again" action.
- `onSettled`: `queryClient.invalidateQueries({ queryKey: ["resumes"] })`.
- `isCreating` per-call guard via `useIsMutating({ mutationKey: ["createResume"] })`.

### 4. New client component: `NewResumeButton`

**File:** `apps/web/app/dashboard/new-resume-button.tsx`

- `"use client"`.
- Wraps the existing `<Link>` styling — same primary button classes that the dashboard uses today.
- Calls `useCreateResume()`.
- Renders a `<ProgressOverlay>` while the mutation is pending (driven by `isPending`).
- After success, `router.push(...)` happens inside the hook's `onSuccess`, so the component itself just renders the button + overlay.
- `disabled` while pending (prevents double-click).

### 5. New shared component: `ProgressOverlay`

**File:** `apps/web/components/progress-overlay.tsx`

- `"use client"`.
- Props: `{ open: boolean; title: string; subtitle: string; spinSlowThresholdMs?: number }`.
- Renders a fixed full-screen overlay (z-index above all app content, semi-transparent backdrop, spinner, title, subtitle).
- After `spinSlowThresholdMs` (default 4000ms), swaps subtitle text from the default `"Creating your starter resume. This usually takes a few seconds."` to `"Still creating your resume… Thanks for your patience."`.
- Dismisses when `open` becomes false (success/error).
- No close button — the user can't cancel a create.

### 6. Update dashboard `New resume` entry

**File:** `apps/web/app/dashboard/page.tsx`

Replace the `<Link href="/builder">New resume</Link>` at line 81-84 with `<NewResumeButton />`. The button keeps the same primary styling and renders the overlay during the API call.

### 7. Update dashboard empty-state entry

**File:** `apps/web/app/dashboard/empty-state.tsx`

Replace the `<Link href="/builder">Create first draft</Link>` at line 37-39 with the same `<NewResumeButton />` (or a "Create first draft" variant of it). Same overlay UX.

### 8. Remove create-then-redirect from `/builder/page.tsx`

**File:** `apps/web/app/builder/page.tsx`

Delete lines 17-41 (the entire `if (!params.resumeId) { ... }` branch). Keep only the load path. The page now does exactly one thing: load a resume by id.

Behavior when `searchParams.resumeId` is missing:

- If user has no resumes → render a server-side empty-state placeholder (or redirect to `/dashboard` with a query flag). Redirect-to-dashboard is the simpler choice — `/builder` is meaningless without a resume id.
- If user has resumes but didn't specify one → same: redirect to `/dashboard`.

Decision: **redirect to `/dashboard`**. This matches the existing `if (!resume) redirect("/dashboard");` fallback on line 47 and keeps the route simple.

### 9. Public marketing landing page CTAs

**File:** `apps/web/app/page.tsx`

The three `<Link href="/builder">` at lines 62, 101, and 238 currently trigger the create-and-redirect path for anonymous users (the `requireUser()` redirect at the start of `page.tsx` sends them to `/login`). After the refactor, those still work for anonymous users (`/builder` redirects to `/login` because of `requireUser`). For authenticated users landing on this page, those links still go to `/builder` which now redirects to `/dashboard` if no resumeId is present — same UX as before, just no longer triggering an automatic resume creation.

**Recommendation:** Leave them as-is for this scope. The user's clarification specifically called out the dashboard entry and "anywhere that creates a resume". The marketing CTAs can be addressed in a follow-up if we want the same overlay there.

## Tests

### Vitest unit tests for the new endpoint

**File:** `apps/web/app/api/resumes/__tests__/starter.test.ts`

Mirror the structure of `apps/web/app/api/resumes/[resumeId]/duplicate/__tests__/route.test.ts`:

- Unauthenticated → 401.
- Authenticated, free plan at limit → 403 with `{ error, feature, upgradeUrl }`.
- Authenticated, free plan under limit → 201 with `{ resume: { id, title, ... } }`.
- Same `Idempotency-Key` header sent twice → second call returns the existing resume (200 + `idempotent: true`).
- Successful call inserts a `ResumeDocument` row **and** a `ResumeVersion` row with note `"Initial draft"`.

### Vitest unit tests for the hook

**File:** `apps/web/app/dashboard/__tests__/use-create-resume.test.ts`

Mirror `apps/web/app/dashboard/__tests__/use-duplicate-resume.test.ts` (existing test file in the workspace). Cover:

- Optimistic insert appears immediately in the cache on click.
- On success the optimistic entry is replaced with the server payload.
- On 403 with `upgradeUrl` the toast renders an "Upgrade" action and no retry.
- On 5xx the toast renders a "Try Again" action and the optimistic entry is removed.

### Playwright E2E

**File:** `apps/web/tests/new-resume-overlay.spec.ts`

Re-run the same navigation/console capture pattern that the diagnostic used:

- Register via UI (so the session cookie flows).
- Slow every `/api/resumes` POST by 1.5s.
- Click "New resume".
- Assert that the progress overlay appears in the DOM within 100ms of click.
- Assert that the optimistic resume appears in the dashboard list immediately.
- Assert that navigation to `/builder?resumeId=...` completes and the "Back to dashboard" link is visible.
- Assert that the redirect-to-`/dashboard` fallback works when the user visits `/builder` directly without a resumeId.

## Verification

After implementation:

1. `npm run lint` — must pass.
2. `npm run typecheck` — must pass.
3. `npm run test` (vitest) — all unit tests pass, including the new ones.
4. `npm run test:e2e -- tests/new-resume-overlay.spec.ts` — the Playwright spec passes.
5. Manual: navigate to `/dashboard`, click "New resume", confirm overlay opens within ~50ms, spinner is visible, subtitle swaps after 3-5s, and navigation to `/builder?resumeId=...` completes. Then click "Back to dashboard" and confirm the new resume is at the top of the list (optimistic update verified).

## Why not add `<Suspense>` at the same time

The earlier investigation's "Option Y — wrap in Suspense" hypothesis is **not justified by the evidence**. The diagnostic showed `loading.tsx` executes, and the redirect interrupts the first render. Refactoring to add a Suspense boundary without first eliminating the redirect would still leave the same two-server-pass problem and might not produce visible improvement. Per the user's "Refactor lamang kung mapatunayan ng diagnostic na kailangan talaga" rule, we address the proven issue first. After this refactor, re-run the diagnostic; if anything still flashes blank, *then* the Suspense hypothesis becomes worth testing with a new round of evidence.

## Critical files reference

- `apps/web/lib/resume-store.ts` — `createStarterResume`, `toStoredResume`, `fromStoredResume`, `parseResumePayload`.
- `apps/web/app/api/resumes/route.ts` — existing POST handler to extend.
- `apps/web/app/api/resumes/[resumeId]/duplicate/route.ts` — pattern for `requireEntitlement`, idempotency, replay response.
- `apps/web/app/dashboard/use-duplicate-resume.ts` — pattern for `useCreateResume` (mutation, optimistic cache, error handling, in-flight guard).
- `apps/web/app/builder/page.tsx` — current create-then-redirect branch to remove.
- `apps/web/app/dashboard/page.tsx` — `<Link href="/builder">` to replace.
- `apps/web/app/dashboard/empty-state.tsx` — `<Link href="/builder">` to replace.
- `apps/web/lib/entitlements.ts` — `requireEntitlement` and `FeatureKeys.RESUME_LIMIT`.
- `apps/web/app/api/resumes/[resumeId]/duplicate/__tests__/route.test.ts` — test pattern to mirror.