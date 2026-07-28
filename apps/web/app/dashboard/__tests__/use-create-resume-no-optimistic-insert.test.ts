import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

// ──────────────────────────────────────────────────────────────────────────────
// Regression: clicking "New resume" must NOT mutate the resumes cache
// before navigation. The dashboard's optimistic cache insert raced the
// router.push and ate the builder's loading.tsx skeleton — the user saw
// the dashboard "flicker" into a state with the new card before the
// builder segment took over, and the destination's loading.tsx never had
// time to render before the actual page painted.
//
// The fix removes `optimisticallyAddResume(queryClient, created)` from
// `useCreateResume`'s `onSuccess`. The hook now fires the
// `router.push("/builder?resumeId=…")` with NO cache mutation. The
// `onSettled` → `invalidateQueries(["resumes"])` re-fetch runs while the
// user is on the builder page, so by the time they navigate back the
// cache already holds the new row.
//
// These tests pin the contract at the source level so a future refactor
// that re-adds the optimistic insert on the create path will fail and
// force the author to justify reintroducing the dashboard flicker.
// ──────────────────────────────────────────────────────────────────────────────

const HOOK_PATH = path.resolve(__dirname, "../use-create-resume.ts");

describe("useCreateResume — no optimistic insert on create", () => {
  const source = fs.readFileSync(HOOK_PATH, "utf8");

  it("does not import optimisticallyAddResume", () => {
    // Pulling in the helper is a smell — the hook should not need cache
    // mutation for a create that immediately navigates away.
    expect(source).not.toMatch(
      /import\s*\{[^}]*optimisticallyAddResume[^}]*\}\s*from\s*["']\.\/use-duplicate-resume["']/,
    );
  });

  it("does not call optimisticallyAddResume in onSuccess", () => {
    // Locate the onSuccess body and assert it does not insert into the
    // cache. A future refactor that re-adds the call will fail this test.
    const onSuccessMatch = source.match(/onSuccess:\s*\(created[\s\S]*?\n    \},/);
    expect(onSuccessMatch, "could not locate onSuccess body").toBeTruthy();
    expect(onSuccessMatch![0]).not.toMatch(/optimisticallyAddResume\(/);
  });

  it("still calls invalidateQueries on settle so a return to the dashboard sees the new resume", () => {
    // onSettled → invalidateQueries is what gives the create flow its
    // "back to dashboard shows the new resume" UX. Don't regress that.
    expect(source).toMatch(/onSettled:[\s\S]*?invalidateQueries\(\{ queryKey:\s*\["resumes"] \}\)/);
  });

  it("only navigates — does not touch the cache — on success", () => {
    const onSuccessMatch = source.match(/onSuccess:\s*\(created[\s\S]*?\n    \},/);
    expect(onSuccessMatch).toBeTruthy();
    const body = onSuccessMatch![0];
    // Must call router.push.
    expect(body).toMatch(/router\.push\(`\/builder\?resumeId=\$\{created\.id\}`\)/);
    // Must NOT call setQueryData or any other cache mutation.
    expect(body).not.toMatch(/setQueryData/);
    expect(body).not.toMatch(/queryClient\./);
  });
});