import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createSessionToken } from "@/lib/auth";
import { prisma } from "@/lib/db";

const generatePublishDraftsMock = vi.hoisted(() => vi.fn());

vi.mock("@/services/publishDraftGenerationService", () => ({
  generatePublishDrafts: generatePublishDraftsMock,
}));

import { POST } from "@/app/api/video-jobs/[jobId]/publish-drafts/generate/route";

describe("POST /api/video-jobs/[jobId]/publish-drafts/generate", () => {
  let userId: string;
  let teamId: string;
  let jobId: string;

  beforeEach(async () => {
    generatePublishDraftsMock.mockReset();
    const unique = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const user = await prisma.user.create({
      data: {
        email: `publish_drafts_generate_api_${unique}@example.com`,
        passwordHash: "hashed_password",
        name: "Publish Drafts Generate API User",
      },
    });
    userId = user.id;

    const team = await prisma.team.create({
      data: {
        name: "Publish Drafts Generate API Team",
        ownerId: userId,
        members: {
          create: {
            userId,
            role: "owner",
          },
        },
      },
    });
    teamId = team.id;

    const project = await prisma.project.create({
      data: {
        teamId,
        ownerId: userId,
        name: "Publish Drafts Generate API Project",
        targetPlatform: "douyin",
        aspectRatio: "ratio_9_16",
      },
    });

    const job = await prisma.videoJob.create({
      data: {
        projectId: project.id,
        teamId,
        ownerId: userId,
        status: "running",
      },
    });
    jobId = job.id;
  });

  afterEach(async () => {
    await prisma.videoJob.deleteMany({ where: { id: jobId } });
    await prisma.project.deleteMany({ where: { teamId } });
    await prisma.teamMember.deleteMany({ where: { userId } });
    await prisma.team.deleteMany({ where: { id: teamId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  it("requires authentication", async () => {
    const response = await POST(createJsonRequest({ platforms: ["douyin"] }), {
      params: Promise.resolve({ jobId }),
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      code: "UNAUTHORIZED",
      message: "未登录",
    });
    expect(generatePublishDraftsMock).not.toHaveBeenCalled();
  });

  it("generates drafts for requested platforms", async () => {
    generatePublishDraftsMock.mockResolvedValue({
      success: true,
      data: {
        drafts: [
          {
            id: "draft-1",
            jobId,
            platform: "douyin",
            title: "标题",
            description: "描述",
            tags: ["tag"],
            topics: ["topic"],
            coverArtifactId: null,
            validationJson: null,
            createdAt: "2026-06-25T00:00:00.000Z",
            updatedAt: "2026-06-25T00:00:00.000Z",
          },
        ],
      },
    });

    const response = await POST(await createAuthenticatedJsonRequest({ platforms: ["douyin"] }), {
      params: Promise.resolve({ jobId }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      code: "SUCCESS",
      message: "发布草稿已生成",
      data: {
        drafts: [
          {
            id: "draft-1",
            platform: "douyin",
            title: "标题",
          },
        ],
      },
    });
    expect(generatePublishDraftsMock).toHaveBeenCalledWith({
      jobId,
      teamId,
      platforms: ["douyin"],
    });
  });

  it("maps missing jobs to 404", async () => {
    generatePublishDraftsMock.mockResolvedValue({
      success: false,
      error: {
        code: "PUBLISH_JOB_NOT_FOUND",
        message: "视频任务不存在",
      },
    });

    const response = await POST(await createAuthenticatedJsonRequest({ platforms: ["douyin"] }), {
      params: Promise.resolve({ jobId }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      code: "NOT_FOUND",
      message: "视频任务不存在",
    });
  });

  it("rejects invalid platform request bodies", async () => {
    const response = await POST(await createAuthenticatedJsonRequest({ platforms: ["unknown"] }), {
      params: Promise.resolve({ jobId }),
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.code).toBe("VALIDATION_ERROR");
    expect(body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ["platforms", 0],
        }),
      ])
    );
    expect(generatePublishDraftsMock).not.toHaveBeenCalled();
  });

  async function createAuthenticatedJsonRequest(body: unknown): Promise<NextRequest> {
    const token = await createSessionToken({
      userId,
      email: "publish-drafts-generate-api@example.com",
      name: "Publish Drafts Generate API User",
      teamId,
    });
    const request = createJsonRequest(body);
    request.cookies.set("session", token);

    return request;
  }
});

function createJsonRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/video-jobs/job-1/publish-drafts/generate", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
    },
  });
}
