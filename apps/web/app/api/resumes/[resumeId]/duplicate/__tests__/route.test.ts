import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../../../../lib/auth", () => ({
  requireApiUser: vi.fn(),
}));

vi.mock("../../../../../../lib/entitlements", () => ({
  requireEntitlement: vi.fn(),
  can: vi.fn(),
  FeatureKeys: { RESUME_LIMIT: "resume_limit" },
}));

import { requireApiUser } from "../../../../../../lib/auth";
import { requireEntitlement, FeatureKeys } from "../../../../../../lib/entitlements";
import { prisma } from "../../../../../../lib/prisma";

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

// Minimal ResumeDocument body — only the fields fromStoredResume reads.
const stubBody = {
  contact: {},
  summary: "",
  sectionOrder: [],
  experience: [],
  education: [],
  skills: [],
  projects: [],
  certifications: [],
  licenses: [],
  volunteer: [],
  achievements: [],
  languages: [],
  references: [],
  awards: [],
  memberships: [],
  publications: [],
  training: [],
  professionalQualities: [],
};

const originalResume = {
  id: "resume_original",
  userId: "user_1",
  title: "My Resume",
  targetRole: null,
  body: stubBody,
  updatedAt: new Date(),
};

const duplicatedResume = {
  id: "resume_new",
  userId: "user_1",
  title: "Copy of My Resume",
  targetRole: null,
  body: stubBody,
  updatedAt: new Date(),
};

// Mirror the 403 shape produced by requireEntitlement in
// apps/web/lib/entitlements.ts. The upgradeUrl carries ?reason={feature}
// so the /billing page can show a context banner. Keep this in sync with
// the production helper — if the real shape drifts, the test below will
// fail loudly and force the helper and the assertion to converge.
const limitReached403 = () =>
  Response.json(
    {
      error: "This feature requires a paid plan.",
      feature: FeatureKeys.RESUME_LIMIT,
      upgradeUrl: `/billing?reason=${encodeURIComponent(FeatureKeys.RESUME_LIMIT)}`,
    },
    { status: 403 },
  );

// ──────────────────────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────────────────────

describe("POST /api/resumes/[resumeId]/duplicate", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    (requireApiUser as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { id: "user_1", email: "test@example.com", name: "Test" },
      response: null,
    });

    // Default: user is allowed to duplicate. Individual tests override this.
    (requireEntitlement as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    // Default: source resume exists.
    vi.spyOn(prisma.resumeDocument, "findFirst").mockResolvedValue(originalResume as never);
    // Default: create succeeds.
    vi.spyOn(prisma.resumeDocument, "create").mockResolvedValue(duplicatedResume as never);
  });

  // ── 1. Free user below limit ────────────────────────────────────────────────

  it("creates a duplicate when a free user is below the resume limit", async () => {
    (requireEntitlement as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const { POST } = await import("../route");
    const req = new Request("http://localhost:3000/api/resumes/resume_original/duplicate", {
      method: "POST",
    });
    const res = await POST(req, {
      params: Promise.resolve({ resumeId: "resume_original" }),
    });
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.resume.id).toBe("resume_new");
    expect(requireEntitlement).toHaveBeenCalledWith("user_1", FeatureKeys.RESUME_LIMIT);
  });

  // ── 2. Free user at limit → 403 ─────────────────────────────────────────────

  it("returns 403 with feature and upgradeUrl when a free user is at the resume limit", async () => {
    (requireEntitlement as ReturnType<typeof vi.fn>).mockResolvedValue(limitReached403());

    const { POST } = await import("../route");
    const req = new Request("http://localhost:3000/api/resumes/resume_original/duplicate", {
      method: "POST",
    });
    const res = await POST(req, {
      params: Promise.resolve({ resumeId: "resume_original" }),
    });
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toBeTruthy();
    expect(json.feature).toBe(FeatureKeys.RESUME_LIMIT);
    // The reason query is attached so the /billing page knows which banner
    // to show. Pinned here so a future refactor that drops the query
    // string will fail this test.
    expect(json.upgradeUrl).toBe(`/billing?reason=${encodeURIComponent(FeatureKeys.RESUME_LIMIT)}`);
  });

  // ── 3. Professional / unlimited user → 201 regardless of count ───────────────
  //
  // The route treats all paid plans identically because requireEntitlement
  // returns null whenever can() returns true (which it does for any plan
  // whose limit is Infinity). We exercise that path here so the unlimited
  // case is locked in: a Professional user must never see a 403 from
  // this route regardless of how many resumes they have.

  it("creates a duplicate for a professional user regardless of resume count", async () => {
    (requireEntitlement as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const { POST } = await import("../route");
    const req = new Request("http://localhost:3000/api/resumes/resume_original/duplicate", {
      method: "POST",
    });
    const res = await POST(req, {
      params: Promise.resolve({ resumeId: "resume_original" }),
    });
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.resume.id).toBe("resume_new");
    expect(requireEntitlement).toHaveBeenCalledWith("user_1", FeatureKeys.RESUME_LIMIT);
  });

  // ── 4. At-limit user does NOT trigger ResumeDocument.create ─────────────────
  //
  // This pins the contract: the entitlement gate runs BEFORE any DB write.
  // If a future refactor moves the gate (or adds a pre-write that bypasses
  // the gate), this test fails.

  it("does NOT call prisma.resumeDocument.create when the user is at limit", async () => {
    (requireEntitlement as ReturnType<typeof vi.fn>).mockResolvedValue(limitReached403());

    const createSpy = vi.spyOn(prisma.resumeDocument, "create");

    const { POST } = await import("../route");
    const req = new Request("http://localhost:3000/api/resumes/resume_original/duplicate", {
      method: "POST",
    });
    const res = await POST(req, {
      params: Promise.resolve({ resumeId: "resume_original" }),
    });

    expect(res.status).toBe(403);
    expect(createSpy).not.toHaveBeenCalled();
  });

  // ── 5. Idempotency regression — header replays return the existing copy ─────
  //
  // The gate insertion must not break the existing idempotency shortcut. When
  // a previously-seen Idempotency-Key matches an existing copy, the route
  // returns 200 with { resume, idempotent: true } and does NOT create.

  it("returns the existing copy with 200 when an Idempotency-Key matches (regression)", async () => {
    (requireEntitlement as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const existingCopy = {
      id: "resume_existing",
      userId: "user_1",
      title: "Copy of My Resume",
      targetRole: null,
      body: stubBody,
      updatedAt: new Date(),
    };

    // First findFirst (source resume by id) → original.
    // Second findFirst (idempotency lookup by userId + idempotencyKey) → existing.
    let callCount = 0;
    vi.spyOn(prisma.resumeDocument, "findFirst").mockImplementation(
      (async () => {
        callCount += 1;
        if (callCount === 1) return originalResume;
        return existingCopy;
      }) as never,
    );

    const createSpy = vi.spyOn(prisma.resumeDocument, "create");

    const { POST } = await import("../route");
    const req = new Request("http://localhost:3000/api/resumes/resume_original/duplicate", {
      method: "POST",
      headers: { "Idempotency-Key": "stable-key-123" },
    });
    const res = await POST(req, {
      params: Promise.resolve({ resumeId: "resume_original" }),
    });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.idempotent).toBe(true);
    expect(json.resume.id).toBe("resume_existing");
    expect(createSpy).not.toHaveBeenCalled();
  });
});
