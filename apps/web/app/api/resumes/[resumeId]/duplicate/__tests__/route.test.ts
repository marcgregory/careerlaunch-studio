import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../route";

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  create: vi.fn(),
  requireApiUser: vi.fn(),
  can: vi.fn(),
}));

vi.mock("../../../../../../lib/prisma", () => ({
  prisma: {
    resumeDocument: {
      findFirst: mocks.findFirst,
      create: mocks.create,
    },
  },
}));

vi.mock("../../../../../../lib/auth", () => ({
  requireApiUser: mocks.requireApiUser,
}));

vi.mock("../../../../../../lib/entitlements", () => ({
  can: mocks.can,
  FeatureKeys: {
    RESUME_LIMIT: "resume.limit",
  },
}));

const context = { params: Promise.resolve({ resumeId: "resume-source" }) };

describe("POST /api/resumes/:resumeId/duplicate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireApiUser.mockResolvedValue({ user: { id: "user-1" }, response: null });
    mocks.can.mockResolvedValue(true);
  });

  it("rejects duplicates when the user has reached the resume limit", async () => {
    mocks.can.mockResolvedValue(false);

    const response = await POST(new Request("http://test.local"), context);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({
      error: "Resume limit reached.",
      feature: "resume.limit",
      upgradeUrl: "/billing",
    });
    expect(mocks.findFirst).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("does not duplicate resumes owned by another user", async () => {
    mocks.findFirst.mockResolvedValue(null);

    const response = await POST(new Request("http://test.local"), context);
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({ error: "Resume not found" });
    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: { id: "resume-source", userId: "user-1" },
    });
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("duplicates the resume and stores duplicate body data", async () => {
    mocks.findFirst.mockResolvedValue({
      id: "resume-source",
      userId: "user-1",
      title: "Original Resume",
      targetRole: "Product Manager",
      body: {
        id: "resume-source",
        title: "Original Resume",
        targetRole: "Product Manager",
        contact: { fullName: "A User", email: "a@example.com" },
      },
    });
    mocks.create.mockImplementation(async ({ data }) => ({
      id: "resume-copy",
      title: data.title,
      targetRole: data.targetRole,
      body: data.body,
    }));

    const response = await POST(new Request("http://test.local"), context);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(mocks.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        title: "Copy of Original Resume",
        targetRole: "Product Manager",
        body: expect.objectContaining({
          id: "pending-duplicate",
          title: "Copy of Original Resume",
          targetRole: "Product Manager",
        }),
        versions: {
          create: {
            body: expect.objectContaining({
              id: "pending-duplicate",
              title: "Copy of Original Resume",
            }),
            note: "Duplicated from resume-source",
          },
        },
      }),
    });
    expect(body.resume.id).toBe("resume-copy");
    expect(body.resume.title).toBe("Copy of Original Resume");
  });
});

