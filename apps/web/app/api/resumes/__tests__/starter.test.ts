import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../../lib/auth", () => ({
  requireApiUser: vi.fn(),
}));

vi.mock("../../../../lib/entitlements", () => ({
  can: vi.fn(),
  requireEntitlement: vi.fn(),
  FeatureKeys: { RESUME_LIMIT: "resume_limit" },
}));

vi.mock("../../../../lib/server-analytics", () => ({
  captureServerEvent: vi.fn(),
}));

vi.mock("../../../../lib/prisma", () => ({
  prisma: {
    resumeDocument: {
      create: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

import { POST } from "../route";
import { requireApiUser } from "../../../../lib/auth";
import { requireEntitlement, can } from "../../../../lib/entitlements";
import { captureServerEvent } from "../../../../lib/server-analytics";
import { prisma } from "../../../../lib/prisma";

const mockUser = {
  id: "user_1",
  email: "test@example.com",
  name: null,
  emailVerifiedAt: null,
};

function makeRequest(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost:3000/api/resumes", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const mockCreatedResume = {
  id: "resume_new_1",
  userId: "user_1",
  title: "New Resume",
  targetRole: "Customer Success Manager",
  body: { title: "New Resume", contact: {}, summary: "" },
  createdAt: new Date("2026-07-29T00:00:00Z"),
  updatedAt: new Date("2026-07-29T00:00:00Z"),
  idempotencyKey: null as string | null,
};

describe("POST /api/resumes — starter resume flow", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(requireApiUser).mockResolvedValue({ user: mockUser, response: null });
    vi.mocked(requireEntitlement).mockResolvedValue(null);
    vi.mocked(can).mockResolvedValue(true);
    vi.mocked(prisma.resumeDocument.create).mockResolvedValue(mockCreatedResume);
  });

  it("returns 401 when no authenticated user", async () => {
    vi.mocked(requireApiUser).mockResolvedValueOnce({
      user: null,
      response: Response.json({ error: "Authentication required" }, { status: 401 }),
    });

    const res = await POST(makeRequest({ kind: "starter" }));
    expect(res.status).toBe(401);
  });

  it("returns 403 with upgradeUrl when RESUME_LIMIT is reached", async () => {
    vi.mocked(requireEntitlement).mockResolvedValueOnce(
      Response.json(
        {
          error: "Resume limit reached.",
          feature: "resume_limit",
          upgradeUrl: "/billing?reason=resume_limit",
        },
        { status: 403 }
      )
    );

    const res = await POST(makeRequest({ kind: "starter" }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.feature).toBe("resume_limit");
    expect(body.upgradeUrl).toBe("/billing?reason=resume_limit");
  });

  it("creates a starter resume and returns 201 with the resume payload", async () => {
    const res = await POST(makeRequest({ kind: "starter" }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.resume.id).toBe("resume_new_1");
    expect(body.resume.title).toBe("New Resume");
    expect(prisma.resumeDocument.create).toHaveBeenCalledTimes(1);
    const createArgs = vi.mocked(prisma.resumeDocument.create).mock.calls[0][0] as any;
    expect(createArgs.data.userId).toBe("user_1");
    const versions = Array.isArray(createArgs.data.versions.create)
      ? createArgs.data.versions.create[0]
      : createArgs.data.versions.create;
    expect(versions.note).toBe("Initial draft");
  });

  it("returns the existing resume on Idempotency-Key replay", async () => {
    const key = "idem-123";
    vi.mocked(prisma.resumeDocument.findFirst).mockResolvedValueOnce(mockCreatedResume);

    const res = await POST(makeRequest({ kind: "starter" }, { "Idempotency-Key": key }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.resume.id).toBe("resume_new_1");
    expect(body.idempotent).toBe(true);
    expect(prisma.resumeDocument.create).not.toHaveBeenCalled();
  });

  it("fires captureServerEvent('draft_created') with source=dashboard_new_resume on success", async () => {
    await POST(makeRequest({ kind: "starter" }));
    expect(captureServerEvent).toHaveBeenCalledWith(
      "draft_created",
      "user_1",
      expect.objectContaining({ source: "dashboard_new_resume", resumeId: "resume_new_1" })
    );
  });

  it("defaults to starter kind when body is empty", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(201);
    expect(prisma.resumeDocument.create).toHaveBeenCalledTimes(1);
  });

  it("still works for the legacy { kind: 'custom', resume } shape", async () => {
    const customResume = {
      title: "Custom",
      contact: { fullName: "Jordan" },
      summary: "",
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
      sectionOrder: [],
    };
    const res = await POST(makeRequest({ kind: "custom", resume: customResume }));
    expect(res.status).toBe(201);
  });
});