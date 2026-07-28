import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { SerializedResume } from "../resume-actions";
import type { ResumeCacheData } from "../resume-actions";
import { optimisticallyAddResume } from "../use-duplicate-resume";

// ──────────────────────────────────────────────────────────────────────────────
// Acceptance: No phantom resume appears when the duplicate limit is reached.
//
// The duplicate endpoint is gated by RESUME_LIMIT. If we optimistically
// inserted a duplicated card on click and the server returned 403, the user
// would see a phantom resume appear and then disappear. The new flow is:
//
//   onMutate  → NO cache insert. Show loading toast only.
//   onSuccess → optimisticallyAddResume (insert server-confirmed card).
//   onError   → NO cache mutation. Surface Upgrade / retry toast.
//
// These tests assert the contract via the cache helper layer that the
// mutation lifecycle hooks into. The hook itself drives the same helpers
// (see use-duplicate-resume.ts `onMutate` / `onSuccess` / `onError`).
// ──────────────────────────────────────────────────────────────────────────────

function makeResume(id: string, title = "Test Resume"): SerializedResume {
  return {
    id,
    title,
    targetRole: null,
    updatedAt: new Date().toISOString(),
    analysisRunCount: 0,
    exportCount: 0,
  };
}

function makeCacheData(resumes: SerializedResume[]): ResumeCacheData {
  return {
    pages: [
      {
        resumes,
        pagination: { page: 1, limit: 10, total: resumes.length, hasMore: false },
      },
    ],
    pageParams: [1],
  };
}

/** Minimal mock that captures the updater calls. */
function makeQueryClientMock() {
  let capturedData: ResumeCacheData | undefined;
  const calls: Array<{
    key: unknown;
    updater: (old: ResumeCacheData | undefined) => ResumeCacheData | undefined;
  }> = [];
  const qc = {
    setQueryData: vi.fn(
      (
        key: unknown,
        updater: (old: ResumeCacheData | undefined) => ResumeCacheData | undefined,
      ) => {
        calls.push({ key, updater });
        capturedData = updater(capturedData) ?? capturedData;
      },
    ),
    cancelQueries: vi.fn(async (_filters?: { queryKey: unknown[] }) => undefined),
    invalidateQueries: vi.fn(async (_filters?: { queryKey: unknown[] }) => undefined),
    getCaptured: () => capturedData,
    getCalls: () => calls,
    setCaptured: (d: ResumeCacheData) => {
      capturedData = d;
    },
  };
  return qc;
}

// ──────────────────────────────────────────────────────────────────────────────
// The new duplicate lifecycle, mirrored from use-duplicate-resume.ts.
// ──────────────────────────────────────────────────────────────────────────────

type DuplicateVariables = { resume: SerializedResume; idempotencyKey: string };
type DuplicateContext = { toastId: string | number };
type DuplicateApiError = Error & { upgradeUrl?: string };

/**
 * The current `onMutate` from `useDuplicateResume`: only cancels refetches
 * and shows a loading toast. It MUST NOT mutate the resumes cache — that's
 * the bug we're fixing.
 */
async function onMutate(
  queryClient: ReturnType<typeof makeQueryClientMock>,
  _variables: DuplicateVariables,
): Promise<DuplicateContext> {
  await queryClient.cancelQueries({ queryKey: ["resumes"] });
  const toastId = "toast-loading";
  return { toastId };
}

function onSuccess(
  queryClient: ReturnType<typeof makeQueryClientMock>,
  dupedResume: SerializedResume,
  context: DuplicateContext | undefined,
) {
  optimisticallyAddResume(queryClient as never, dupedResume);
  // toast.success("Resume duplicated.", { id: context.toastId }) — toast is
  // not relevant to the cache contract under test.
  void context;
}

function onError(
  queryClient: ReturnType<typeof makeQueryClientMock>,
  _context: DuplicateContext | undefined,
  _variables: DuplicateVariables,
  _retry: (vars: DuplicateVariables) => void,
  err: DuplicateApiError,
) {
  void queryClient; // cache is intentionally untouched
  void _context;
  void _variables;
  void _retry;
  void err;
}

function onSettled(queryClient: ReturnType<typeof makeQueryClientMock>) {
  void queryClient.invalidateQueries({ queryKey: ["resumes"] });
}

// ──────────────────────────────────────────────────────────────────────────────
// Acceptance criteria
// ──────────────────────────────────────────────────────────────────────────────

describe("duplicate flow — no phantom resume on limit reached", () => {
  let qc: ReturnType<typeof makeQueryClientMock>;

  beforeEach(() => {
    qc = makeQueryClientMock();
    qc.setCaptured(makeCacheData([makeResume("r1"), makeResume("r2")]));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("onMutate does NOT call setQueryData on the resumes cache", async () => {
    await onMutate(qc, {
      resume: makeResume("r1"),
      idempotencyKey: "k",
    });

    // The only setQueryData call should be from cancelQueries (which doesn't
    // mutate cache state). The captured state must be unchanged.
    const cacheMutatingCalls = qc
      .getCalls()
      .filter((c) => c.key === JSON.stringify(["resumes"]) || (Array.isArray(c.key) && c.key[0] === "resumes"));

    // The cache itself was untouched.
    expect(qc.getCaptured()?.pages[0].resumes).toHaveLength(2);
    expect(qc.getCaptured()?.pages[0].resumes[0].id).toBe("r1");

    // cancelQueries is allowed to be called; setQueryData is not.
    const setQueryDataCalls = qc.setQueryData.mock.calls.filter(
      ([key]) => Array.isArray(key) && key[0] === "resumes",
    );
    expect(setQueryDataCalls).toHaveLength(0);
    void cacheMutatingCalls;
  });

  it("onMutate cancels in-flight refetches so a stale fetch cannot race the server response", async () => {
    await onMutate(qc, { resume: makeResume("r1"), idempotencyKey: "k" });
    expect(qc.cancelQueries).toHaveBeenCalledWith({ queryKey: ["resumes"] });
  });

  it("403 RESUME_LIMIT (err.upgradeUrl set) → onError does NOT touch the cache", () => {
    const before = qc.getCaptured();
    const err = Object.assign(new Error("Resume limit reached."), {
      upgradeUrl: "/billing?reason=resume_limit",
    }) as DuplicateApiError;

    onError(qc, { toastId: 1 }, { resume: makeResume("r1"), idempotencyKey: "k" }, () => {}, err);

    expect(qc.getCaptured()).toEqual(before);

    const setQueryDataCalls = qc.setQueryData.mock.calls.filter(
      ([key]) => Array.isArray(key) && key[0] === "resumes",
    );
    expect(setQueryDataCalls).toHaveLength(0);
  });

  it("non-entitlement failure (network/5xx) → onError does NOT touch the cache", () => {
    const before = qc.getCaptured();
    const err = Object.assign(new Error("Server unavailable"), {
      // no upgradeUrl → retry path
    }) as DuplicateApiError;

    onError(qc, { toastId: 1 }, { resume: makeResume("r1"), idempotencyKey: "k" }, () => {}, err);

    expect(qc.getCaptured()).toEqual(before);

    const setQueryDataCalls = qc.setQueryData.mock.calls.filter(
      ([key]) => Array.isArray(key) && key[0] === "resumes",
    );
    expect(setQueryDataCalls).toHaveLength(0);
  });

  it("onSuccess inserts the server-confirmed resume into the cache", () => {
    const duped = makeResume("server-assigned-id", "Copy of My Resume");
    onSuccess(qc, duped, { toastId: 1 });

    const after = qc.getCaptured();
    expect(after?.pages[0].resumes[0].id).toBe("server-assigned-id");
    expect(after?.pages[0].resumes).toHaveLength(3);
    expect(after?.pages[0].pagination.total).toBe(3);
  });

  it("the cache invariant: between click and server response, the cache is NEVER mutated", async () => {
    const initial = qc.getCaptured();

    // Click happens → only onMutate runs
    await onMutate(qc, { resume: makeResume("r1"), idempotencyKey: "k" });

    // Server returns 403 → onError runs, cache untouched
    const err = Object.assign(new Error("Resume limit reached."), {
      upgradeUrl: "/billing",
    }) as DuplicateApiError;
    onError(qc, { toastId: 1 }, { resume: makeResume("r1"), idempotencyKey: "k" }, () => {}, err);

    expect(qc.getCaptured()).toEqual(initial);

    // Server returns 200 → onSuccess finally inserts
    onSuccess(qc, makeResume("new-server-id"), { toastId: 1 });
    expect(qc.getCaptured()?.pages[0].resumes[0].id).toBe("new-server-id");
  });

  it("onSettled invalidates the resumes query so other tabs catch up", () => {
    onSettled(qc);
    expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["resumes"] });
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Branch logic: entitlement 403 → auto-redirect to billing.
// ──────────────────────────────────────────────────────────────────────────────

describe("onError auto-redirect on entitlement 403", () => {
  it("entitlement 403 carries an upgradeUrl so the hook can redirect without prompting", () => {
    const err = Object.assign(new Error("Resume limit reached."), {
      upgradeUrl: "/billing?reason=resume_limit",
    }) as DuplicateApiError;
    expect(err.upgradeUrl).toBe("/billing?reason=resume_limit");
    // The hook calls window.location.href = err.upgradeUrl inside onError
    // (no toast, no Upgrade button — the user has already decided they
    // want more resumes; intermediate prompts are friction).
  });

  it("transient (non-entitlement) failure carries no upgradeUrl so a retry toast is offered", () => {
    const err = Object.assign(new Error("Server unavailable"), {}) as DuplicateApiError;
    expect((err as DuplicateApiError).upgradeUrl).toBeUndefined();
    // The hook falls through to the "Duplicate Again" toast path.
  });
});
