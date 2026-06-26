import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { createSessionToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { POST } from "@/app/api/video-jobs/[jobId]/publish/validate/route";

describe("Publish validation API", () => {
  let userId: string;
  let teamId: string;
  let otherTeamId: string;
  let projectId: string;
  let jobId: string;
  let finalExportNodeId: string;
  let coverNodeId: string;
  let finalVideoArtifactId: string;
  let coverArtifactId: string;
  let douyinDraftId: string;
  let xiaohongshuDraftId: string;

  beforeEach(async () => {
    const unique = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const user = await prisma.user.create({
      data: {
        email: `publish_validate_api_${unique}@example.com`,
        passwordHash: "hashed_password",
        name: "Publish Validate API User",
      },
    });
    userId = user.id;

    const team = await prisma.team.create({
      data: {
        name: "Publish Validate API Team",
        ownerId: userId,
      },
    });
    teamId = team.id;

    const otherTeam = await prisma.team.create({
      data: {
        name: "Other Publish Validate API Team",
        ownerId: userId,
      },
    });
    otherTeamId = otherTeam.id;

    await prisma.teamMember.createMany({
      data: [
        { teamId, userId, role: "owner" },
        { teamId: otherTeamId, userId, role: "member" },
      ],
    });

    const project = await prisma.project.create({
      data: {
        teamId,
        ownerId: userId,
        name: "Publish Validate API Project",
        targetPlatform: "douyin",
        aspectRatio: "ratio_9_16",
      },
    });
    projectId = project.id;

    const job = await prisma.videoJob.create({
      data: {
        projectId,
        teamId,
        ownerId: userId,
        status: "succeeded",
      },
    });
    jobId = job.id;

    const finalExportNode = await prisma.workflowNode.create({
      data: {
        jobId,
        nodeType: "final_export",
        status: "succeeded",
        version: 1,
      },
    });
    finalExportNodeId = finalExportNode.id;

    const coverNode = await prisma.workflowNode.create({
      data: {
        jobId,
        nodeType: "cover",
        status: "succeeded",
        version: 1,
      },
    });
    coverNodeId = coverNode.id;

    const finalVideoArtifact = await prisma.artifact.create({
      data: {
        jobId,
        nodeId: finalExportNodeId,
        type: "final_video",
        storageUrl: "voflow/team/jobs/job-1/final_export/final_video.mp4",
        metadata: {
          aspectRatio: "9:16",
          durationSeconds: 30,
          width: 1080,
          height: 1920,
        },
      },
    });
    finalVideoArtifactId = finalVideoArtifact.id;

    const coverArtifact = await prisma.artifact.create({
      data: {
        jobId,
        nodeId: coverNodeId,
        type: "cover",
        storageUrl: "voflow/team/jobs/job-1/cover/cover.jpg",
        metadata: {
          aspectRatio: "9:16",
          width: 1080,
          height: 1920,
        },
      },
    });
    coverArtifactId = coverArtifact.id;

    const douyinDraft = await prisma.publishDraft.create({
      data: {
        jobId,
        platform: "douyin",
        title: "合规发布标题",
        description: "合规发布描述",
        tagsJson: ["新品", "口播"],
        topicsJson: ["618"],
        coverArtifactId,
      },
    });
    douyinDraftId = douyinDraft.id;

    const xiaohongshuDraft = await prisma.publishDraft.create({
      data: {
        jobId,
        platform: "xiaohongshu",
        title: "这是一条明确超过小红书二十字限制的发布标题内容",
        description: "小红书发布描述",
        tagsJson: ["生活"],
        topicsJson: [],
        coverArtifactId,
      },
    });
    xiaohongshuDraftId = xiaohongshuDraft.id;

    await prisma.channelAccount.createMany({
      data: [
        {
          teamId,
          userId,
          platform: "douyin",
          accountName: "抖音测试号",
          encryptedToken: "voflow_channel_token_v1.connected.token.payload",
          status: "connected",
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
        {
          teamId,
          userId,
          platform: "xiaohongshu",
          accountName: "小红书过期号",
          encryptedToken: "voflow_channel_token_v1.expired.token.payload",
          status: "expired",
          expiresAt: new Date(Date.now() - 60_000),
        },
      ],
    });
  });

  afterEach(async () => {
    await prisma.publish.deleteMany({ where: { jobId } });
    await prisma.publishDraft.deleteMany({ where: { jobId } });
    await prisma.channelAccount.deleteMany({ where: { teamId } });
    await prisma.artifact.deleteMany({ where: { jobId } });
    await prisma.workflowNode.deleteMany({ where: { jobId } });
    await prisma.videoJob.deleteMany({ where: { id: jobId } });
    await prisma.project.deleteMany({ where: { id: projectId } });
    await prisma.teamMember.deleteMany({
      where: {
        OR: [{ teamId }, { teamId: otherTeamId }, { userId }],
      },
    });
    await prisma.team.deleteMany({ where: { id: { in: [teamId, otherTeamId] } } });
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  it("requires authentication", async () => {
    const response = await POST(createRequest({ platforms: ["douyin"] }), {
      params: Promise.resolve({ jobId }),
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      code: "UNAUTHORIZED",
      message: "未登录",
    });
  });

  it("returns 404 when validating a job outside the current team", async () => {
    const response = await POST(
      await createAuthenticatedRequest(otherTeamId, { platforms: ["douyin"] }),
      {
        params: Promise.resolve({ jobId }),
      }
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      code: "NOT_FOUND",
      message: "视频任务不存在",
    });
  });

  it("validates a connected platform and saves passing validationJson", async () => {
    const response = await POST(
      await createAuthenticatedRequest(teamId, { platforms: ["douyin"] }),
      {
        params: Promise.resolve({ jobId }),
      }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      code: "SUCCESS",
      message: "发布参数检查已通过",
      data: {
        summary: {
          total: 1,
          passed: 1,
          failed: 0,
          canPublish: true,
        },
        results: [
          {
            draftId: douyinDraftId,
            platform: "douyin",
            passed: true,
            account: {
              status: "connected",
              requiresAuth: false,
            },
          },
        ],
      },
    });

    const saved = await prisma.publishDraft.findUniqueOrThrow({
      where: { id: douyinDraftId },
    });
    expect(saved.validationJson).toMatchObject({
      passed: true,
      platform: "douyin",
      checks: expect.arrayContaining([
        expect.objectContaining({ code: "PUBLISH_TITLE_VALID", passed: true }),
        expect.objectContaining({ code: "PUBLISH_CHANNEL_ACCOUNT_CONNECTED", passed: true }),
        expect.objectContaining({ code: "PUBLISH_FINAL_VIDEO_READY", passed: true }),
      ]),
    });
  });

  it("returns failed validation reasons and saves failing validationJson", async () => {
    const response = await POST(
      await createAuthenticatedRequest(teamId, { platforms: ["xiaohongshu"] }),
      {
        params: Promise.resolve({ jobId }),
      }
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toMatchObject({
      code: "PUBLISH_VALIDATION_FAILED",
      message: "发布参数检查未通过",
      data: {
        summary: {
          total: 1,
          passed: 0,
          failed: 1,
          canPublish: false,
        },
        results: [
          {
            draftId: xiaohongshuDraftId,
            platform: "xiaohongshu",
            passed: false,
            account: {
              status: "expired",
              requiresAuth: true,
            },
          },
        ],
      },
    });
    expect(body.data.results[0].checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "PUBLISH_TITLE_TOO_LONG",
          passed: false,
        }),
        expect.objectContaining({
          code: "CHANNEL_TOKEN_EXPIRED",
          passed: false,
        }),
      ])
    );

    const saved = await prisma.publishDraft.findUniqueOrThrow({
      where: { id: xiaohongshuDraftId },
    });
    expect(saved.validationJson).toMatchObject({
      passed: false,
      platform: "xiaohongshu",
      checks: expect.arrayContaining([
        expect.objectContaining({ code: "PUBLISH_TITLE_TOO_LONG", passed: false }),
        expect.objectContaining({ code: "CHANNEL_TOKEN_EXPIRED", passed: false }),
      ]),
    });
  });

  async function createAuthenticatedRequest(
    team: string,
    body: unknown
  ): Promise<NextRequest> {
    const token = await createSessionToken({
      userId,
      email: "publish-validate-api@example.com",
      name: "Publish Validate API User",
      teamId: team,
    });
    const request = createRequest(body);
    request.cookies.set("session", token);

    return request;
  }
});

function createRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/video-jobs/job-1/publish/validate", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
    },
  });
}
