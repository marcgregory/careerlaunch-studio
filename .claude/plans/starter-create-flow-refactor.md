# Starter Resume Creation Flow — `/builder` Blank Page Fix

## Status: Implementation in progress (verification pending)

## Problem

Clicking "New Resume" on the dashboard sometimes produces a **blank white page** before the builder UI loads. The page eventually shows the resume editor, but the multi-second blank window is jarring and breaks the closed-beta polish bar.

## Root cause (confirmed via diagnostic)

The original flow was a **two-pass server round-trip** owned by `app/builder/page.tsx`:

1. User clicks "New Resume" on `/dashboard`.
2. `BuilderPage` runs `createStarterResume(user.id)` server-side (writes to Postgres).
3. `BuilderPage` returns `redirect("/builder?resumeId=" + newId)`.
4. Next.js receives the redirect mid-render and issues a second RSC request for `/builder?resumeId=…`.
5. Browser paints neither `app/builder/loading.tsx` (already abandoned during step 3) nor the builder UI (still loading in step 4). Result: white page.

The diagnostic proved `loading.tsx` was **invoked** but **never painted**, because the redirect interrupts the streaming response before any fallback HTML reaches the client.

## Architectural decision

Move resume creation **out of the server route** and into a **client-driven fetch** from the dashboard. `/builder` becomes a load-only page. The dashboard owns creation, displays a blocking progress overlay during the API call, and pushes the resulting `resumeId` onto `/builder`.

This:

- Lets `app/builder/loading.tsx` paint normally (single navigation, no in-render redirect).
- Adds optimistic cache insertion so the new resume appears in the list immediately.
- Centralizes starter creation behind a single API endpoint (single source of truth).
- Mirrors the existing duplicate-resume pattern (`use-duplicate-resume.ts`), keeping mental models aligned.

## Files Changed

### Created

| File | Purpose |
|---|---|
| `apps/web/app/dashboard/use-create-resume.ts` | TanStack mutation that POSTs `/api/resumes` (kind: "starter"), optimistically inserts the new resume, swaps it on success, rolls back on error, and `router.push`es `/builder?resumeId=…` on success. |
| `apps/web/app/dashboard/new-resume-button.tsx` | Client component wrapping `<a href={fallbackHref}>` (styled like `primaryButtonClass`) so anonymous users still navigate to `/login`. Intercepts left-click for logged-in users, opens the overlay, and calls `useCreateResume`. Two variants: `"new-resume"` (Plus icon) and `"first-draft"` (ArrowRight icon). |
| `apps/web/components/progress-overlay.tsx` | Blocking full-screen overlay (z-[100], `bg-[#123c3a]/55 backdrop-blur-md`) with spinner, title, and subtitle. Subtitle swaps from default to slow-reassurance copy after `slowThresholdMs` (default 4000ms). No close button (cannot abort a create safely). |
| `apps/web/app/api/resumes/__tests__/starter.test.ts` | 7 unit tests covering 401 unauth, 403 limit + upgradeUrl, 201 create, idempotency replay, `captureServerEvent("draft_created")` fired, default `kind: "starter"`, legacy `kind: "custom"` still accepted. |
| `apps/web/app/dashboard/__tests__/use-create-resume.test.ts` | 4 unit tests for `parseCreateError` (lifts `upgradeUrl`, fallback message, malformed JSON, server error without `upgradeUrl`). |

### Modified

| File | Change |
|---|---|
| `apps/web/app/api/resumes/route.ts` | POST now accepts `{ kind: "starter" \| "custom" }`. `kind: "starter"` (default) calls the existing `createStarterResume` helper. `kind: "custom"` retains the previous behavior. Added `requireEntitlement(RESUME_LIMIT)` gate (returns 403 + `upgradeUrl` on free-plan limit) and `Idempotency-Key` header support mirroring the duplicate route. Fires `captureServerEvent("draft_created", { source })`. |
| `apps/web/app/builder/page.tsx` | Removed the `createStarterResume()` + `redirect()` branch. Now single responsibility: load existing resume by `resumeId`. No `resumeId` → `redirect("/dashboard")`. |
| `apps/web/app/dashboard/use-duplicate-resume.ts` | Exported `replaceOrRemoveOptimisticResume` so `use-create-resume` can reuse the same rollback helper (single source of truth for cache swap logic). |
| `apps/web/app/dashboard/page.tsx` | Replaced inline `<Link href="/builder">New resume</Link>` with `<NewResumeButton variant="new-resume" fallbackHref="/login" />`. Removed unused `Plus` / `primaryButtonClass` imports. |
| `apps/web/app/dashboard/empty-state.tsx` | Replaced inline `<Link href="/builder">` with `<NewResumeButton variant="first-draft" fallbackHref="/login" />`. Removed unused `Link` / `ArrowRight` / `primaryButtonClass` imports. |

## UX Spec

### Overlay timing

- Overlay opens **synchronously** in the click handler (before `fetch` even fires) so the user never sees the button appear unresponsive.
- `slowThresholdMs = 4000`. After 4s, subtitle swaps from `"Creating your starter resume. This usually takes a few seconds."` to `"Still creating your resume… Thanks for your patience."`.
- No close button. User can navigate away (which aborts the fetch); the toast surfaces the failure.

### Success path

1. POST `/api/resumes` with `{ kind: "starter" }` + `Idempotency-Key`.
2. Server creates resume, increments user's draft count, fires `draft_created` analytics event, returns `{ resume: { id, title, targetRole, ... } }`.
3. `onSuccess`: cache helper replaces optimistic placeholder with real resume, toast success fires, `router.push("/builder?resumeId=" + newId)`.

### Failure paths

- **403 with `upgradeUrl`** (free-plan limit) → toast shows `"Resume limit reached. Upgrade to add more."` + **Upgrade** action button (navigates to `upgradeUrl`). Overlay dismisses.
- **Network / 5xx** → toast shows error message + **Try Again** action (re-runs mutation with same idempotency key — server returns the existing resume if creation actually succeeded).
- **Idempotency replay** → server returns the originally-created resume (same `id`), client treats it as success.

## Verification

### Tests

- **Unit (Vitest)**: 176/181 passing. The 5 failing tests in `apps/web/app/dashboard/__tests__/delete-modal-export-quota-bug.test.ts` are **pre-existing** (verified via `git stash` — they fail on `main` without my changes) and unrelated to this refactor.
- **New tests added**: 7 (starter endpoint) + 4 (use-create-resume error parsing) + the 23 existing duplicate tests — all passing.

### Pending verification

- [ ] **Playwright E2E**: Register → login → click "New Resume" → assert overlay appears → assert URL becomes `/builder?resumeId=…` → assert builder UI renders.
- [ ] **Lint**: Confirm zero errors after the `progress-overlay.tsx` lint fix (setState-in-effect).
- [ ] **Typecheck**: `npm run build` succeeds end-to-end.
- [ ] **Re-run the original diagnostic** (Task #1) to confirm `loading.tsx` now paints during navigation, not after.

## Operational Notes

- **Single source of truth preserved**: Both API route and (any) future server-side fallback use `createStarterResume` from `apps/web/lib/resume-store.ts`. No second implementation.
- **Idempotency**: `Idempotency-Key` header is sent per click (`crypto.randomUUID()`). Server uses it to short-circuit replay. Column is nullable so existing rows / older clients don't break.
- **Analytics**: `captureServerEvent("draft_created", { source: "dashboard_new_resume" })` fires from the new POST path. Same event name as before for dashboard analytics continuity.

## Items intentionally NOT in this PR

1. **Builder-side `loading.tsx` skeleton redesign** — separate work; the existing skeleton is fine now that it actually paints.
2. **Optimistic insertion on retry** — current optimistic insert is removed on error; if we want to retain it as a "queued" placeholder, that's a follow-up.
3. **Cancellation token on overlay** — aborting mid-create risks orphaned DB rows. Defer until we have a transactional "create + cleanup" flow.