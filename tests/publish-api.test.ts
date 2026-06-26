import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { createSessionToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { POST } from "@/app/api/video-jobs/[jobId]/publish/route";

describe("One-click publish API", () => {
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
  let kuaishouDraftId: string;
  let douyinAccountId: string;
  let xiaohongshuAccountId: string;

  beforeEach(async () => {
    const unique = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const user = await prisma.user.create({
      data: {
        email: `publish_api_${unique}@example.com`,
        passwordHash: "hashed_password",
        name: "Publish API User",
      },
    });
    userId = user.id;

    const team = await prisma.team.create({
      data: {
        name: "Publish API Team",
        ownerId: userId,
      },
    });
    teamId = team.id;

    const otherTeam = await prisma.team.create({
      data: {
        name: "Other Publish API Team",
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
        name: "Publish API Project",
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

    const checkedAt = new Date().toISOString();
    const douyinDraft = await prisma.publishDraft.create({
      data: {
        jobId,
        platform: "douyin",
        title: "合规发布标题",
        description: "合规发布描述",
        tagsJson: ["新品", "口播"],
        topicsJson: ["618"],
        coverArtifactId,
        validationJson: passedValidation("douyin", checkedAt),
      },
    });
    douyinDraftId = douyinDraft.id;

    const xiaohongshuDraft = await prisma.publishDraft.create({
      data: {
        jobId,
        platform: "xiaohongshu",
        title: "小红书标题",
        description: "小红书发布描述",
        tagsJson: ["生活"],
        topicsJson: [],
        coverArtifactId,
        validationJson: failedValidation("xiaohongshu", checkedAt, "CHANNEL_TOKEN_EXPIRED"),
      },
    });
    xiaohongshuDraftId = xiaohongshuDraft.id;

    const kuaishouDraft = await prisma.publishDraft.create({
      data: {
        jobId,
        platform: "kuaishou",
        title: "快手标题",
        description: "快手发布描述",
        tagsJson: ["生活"],
        topicsJson: [],
        coverArtifactId,
        validationJson: failedValidation("kuaishou", checkedAt, "CHANNEL_ACCOUNT_NOT_CONNECTED"),
      },
    });
    kuaishouDraftId = kuaishouDraft.id;

    const douyinAccount = await prisma.channelAccount.create({
      data: {
        teamId,
        userId,
        platform: "douyin",
        accountName: "抖音测试号",
        encryptedToken: "voflow_channel_token_v1.connected.token.payload",
        status: "connected",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    douyinAccountId = douyinAccount.id;

    const xiaohongshuAccount = await prisma.channelAccount.create({
      data: {
        teamId,
        userId,
        platform: "xiaohongshu",
        accountName: "小红书过期号",
        encryptedToken: "voflow_channel_token_v1.expired.token.payload",
        status: "expired",
        expiresAt: new Date(Date.now() - 60_000),
      },
    });
    xiaohongshuAccountId = xiaohongshuAccount.id;
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

  it("returns 404 when publishing a job outside the current team", async () => {
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

  it("rejects invalid platform requests", async () => {
    const response = await POST(
      await createAuthenticatedRequest(teamId, { platforms: ["unknown"] }),
      {
        params: Promise.resolve({ jobId }),
      }
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: "VALIDATION_ERROR",
      message: "参数错误",
      errors: [
        expect.objectContaining({
          path: ["platforms", 0],
        }),
      ],
    });
  });

  it("publishes connected passing platforms and marks unavailable platforms as skipped", async () => {
    const response = await POST(
      await createAuthenticatedRequest(teamId, {
        platforms: ["douyin", "xiaohongshu", "kuaishou"],
      }),
      {
        params: Promise.resolve({ jobId }),
      }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      code: "SUCCESS",
      message: "一键发布任务已创建",
      data: {
        summary: {
          total: 3,
          published: 1,
          failed: 0,
          skipped: 2,
        },
        publishes: [
          {
            publishDraftId: douyinDraftId,
            channelAccountId: douyinAccountId,
            platform: "douyin",
            status: "published",
            requestId: `mock-publish-douyin-${douyinDraftId}`,
            remoteId: `mock-publish-douyin-${douyinDraftId}`,
            errorJson: null,
          },
          {
            publishDraftId: xiaohongshuDraftId,
            channelAccountId: xiaohongshuAccountId,
            platform: "xiaohongshu",
            status: "skipped",
            requestId: null,
            remoteId: null,
            errorJson: {
              code: "CHANNEL_TOKEN_EXPIRED",
              message: "渠道账号不可发布",
            },
          },
          {
            publishDraftId: kuaishouDraftId,
            platform: "kuaishou",
            status: "skipped",
            requestId: null,
            remoteId: null,
            errorJson: {
              code: "CHANNEL_ACCOUNT_NOT_CONNECTED",
              message: "渠道账号不可发布",
            },
          },
        ],
      },
    });

    const savedPublishes = await prisma.publish.findMany({
      where: { jobId },
      orderBy: { createdAt: "asc" },
    });
    expect(savedPublishes).toHaveLength(3);
    expect(savedPublishes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          publishDraftId: douyinDraftId,
          channelAccountId: douyinAccountId,
          platform: "douyin",
          status: "published",
          requestId: `mock-publish-douyin-${douyinDraftId}`,
          remoteId: `mock-publish-douyin-${douyinDraftId}`,
          errorJson: null,
        }),
        expect.objectContaining({
          publishDraftId: xiaohongshuDraftId,
          channelAccountId: xiaohongshuAccountId,
          platform: "xiaohongshu",
          status: "skipped",
          errorJson: {
            code: "CHANNEL_TOKEN_EXPIRED",
            message: "渠道账号不可发布",
          },
        }),
        expect.objectContaining({
          publishDraftId: kuaishouDraftId,
          platform: "kuaishou",
          status: "skipped",
          errorJson: {
            code: "CHANNEL_ACCOUNT_NOT_CONNECTED",
            message: "渠道账号不可发布",
          },
        }),
      ])
    );

    const generatedKuaishouAccount = await prisma.channelAccount.findUniqueOrThrow({
      where: {
        teamId_userId_platform: {
          teamId,
          userId,
          platform: "kuaishou",
        },
      },
    });
    expect(generatedKuaishouAccount.status).toBe("not_connected");
    expect(savedPublishes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          channelAccountId: generatedKuaishouAccount.id,
          platform: "kuaishou",
        }),
      ])
    );
  });

  async function createAuthenticatedRequest(
    team: string,
    body: unknown
  ): Promise<NextRequest> {
    const token = await createSessionToken({
      userId,
      email: "publish-api@example.com",
      name: "Publish API User",
      teamId: team,
    });
    const request = createRequest(body);
    request.cookies.set("session", token);

    return request;
  }
});

function createRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/video-jobs/job-1/publish", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function passedValidation(platform: "douyin", checkedAt: string) {
  return {
    draftId: "draft-id-is-not-used-by-adapter",
    platform,
    passed: true,
    checkedAt,
    account: {
      status: "connected",
      requiresAuth: false,
    },
    finalVideoArtifactId: "final-video-id-is-read-from-db",
    coverArtifactId: "cover-id-is-read-from-db",
    checks: [{ code: "PUBLISH_CHANNEL_ACCOUNT_CONNECTED", passed: true }],
  };
}

function failedValidation(
  platform: "xiaohongshu" | "kuaishou",
  checkedAt: string,
  code: "CHANNEL_TOKEN_EXPIRED" | "CHANNEL_ACCOUNT_NOT_CONNECTED"
) {
  return {
    draftId: "draft-id-is-not-used-by-adapter",
    platform,
    passed: false,
    checkedAt,
    account: {
      status: code === "CHANNEL_TOKEN_EXPIRED" ? "expired" : "not_connected",
      requiresAuth: true,
    },
    finalVideoArtifactId: "final-video-id-is-read-from-db",
    coverArtifactId: "cover-id-is-read-from-db",
    checks: [{ code, passed: false }],
  };
}
