import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { createSessionToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { POST } from "@/app/api/publishes/[publishId]/retry/route";

describe("Publish retry API", () => {
  let userId: string;
  let teamId: string;
  let otherTeamId: string;
  let projectId: string;
  let jobId: string;
  let finalExportNodeId: string;
  let coverNodeId: string;
  let finalVideoArtifactId: string;
  let coverArtifactId: string;
  let draftId: string;
  let channelAccountId: string;
  let failedPublishId: string;
  let publishedPublishId: string;

  beforeEach(async () => {
    const unique = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const user = await prisma.user.create({
      data: {
        email: `publish_retry_api_${unique}@example.com`,
        passwordHash: "hashed_password",
        name: "Publish Retry API User",
      },
    });
    userId = user.id;

    const team = await prisma.team.create({
      data: {
        name: "Publish Retry API Team",
        ownerId: userId,
      },
    });
    teamId = team.id;

    const otherTeam = await prisma.team.create({
      data: {
        name: "Other Publish Retry API Team",
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
        name: "Publish Retry API Project",
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

    const draft = await prisma.publishDraft.create({
      data: {
        jobId,
        platform: "douyin",
        title: "合规发布标题",
        description: "合规发布描述",
        tagsJson: ["新品", "口播"],
        topicsJson: ["618"],
        coverArtifactId,
        validationJson: {
          draftId: "draft-id-is-not-used-by-adapter",
          platform: "douyin",
          passed: true,
          checkedAt: new Date().toISOString(),
          account: {
            status: "connected",
            requiresAuth: false,
          },
          finalVideoArtifactId: "final-video-id-is-read-from-db",
          coverArtifactId: "cover-id-is-read-from-db",
          checks: [{ code: "PUBLISH_CHANNEL_ACCOUNT_CONNECTED", passed: true }],
        },
      },
    });
    draftId = draft.id;

    const channelAccount = await prisma.channelAccount.create({
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
    channelAccountId = channelAccount.id;

    const failedPublish = await prisma.publish.create({
      data: {
        jobId,
        publishDraftId: draftId,
        channelAccountId,
        platform: "douyin",
        status: "failed",
        requestId: "mock-publish-douyin-previous",
        remoteId: "mock-publish-douyin-previous",
        errorJson: {
          code: "PUBLISH_REMOTE_FAILED",
          message: "平台发布失败",
        },
      },
    });
    failedPublishId = failedPublish.id;

    const publishedPublish = await prisma.publish.create({
      data: {
        jobId,
        publishDraftId: draftId,
        channelAccountId,
        platform: "douyin",
        status: "published",
        requestId: "mock-publish-douyin-published",
        remoteId: "mock-publish-douyin-published",
      },
    });
    publishedPublishId = publishedPublish.id;
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
    const response = await POST(createRequest(), {
      params: Promise.resolve({ publishId: failedPublishId }),
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      code: "UNAUTHORIZED",
      message: "未登录",
    });
  });

  it("returns 404 when retrying a publish outside the current team", async () => {
    const response = await POST(await createAuthenticatedRequest(otherTeamId), {
      params: Promise.resolve({ publishId: failedPublishId }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      code: "NOT_FOUND",
      message: "发布记录不存在",
    });
  });

  it("rejects retrying non-failed publishes", async () => {
    const response = await POST(await createAuthenticatedRequest(teamId), {
      params: Promise.resolve({ publishId: publishedPublishId }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      code: "PUBLISH_RETRY_NOT_ALLOWED",
      message: "只有失败的发布记录可以重试",
    });
  });

  it("retries one failed publish and preserves error history", async () => {
    const response = await POST(await createAuthenticatedRequest(teamId), {
      params: Promise.resolve({ publishId: failedPublishId }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      code: "SUCCESS",
      message: "发布重试已提交",
      data: {
        publish: {
          id: failedPublishId,
          jobId,
          publishDraftId: draftId,
          channelAccountId,
          platform: "douyin",
          status: "published",
          requestId: `mock-retry-douyin-${draftId}`,
          remoteId: `mock-publish-douyin-${draftId}`,
          errorJson: {
            history: [
              {
                status: "failed",
                requestId: "mock-publish-douyin-previous",
                remoteId: "mock-publish-douyin-previous",
                error: {
                  code: "PUBLISH_REMOTE_FAILED",
                  message: "平台发布失败",
                },
              },
            ],
            lastRetry: {
              previousRequestId: "mock-publish-douyin-previous",
              requestId: `mock-retry-douyin-${draftId}`,
              remoteId: `mock-publish-douyin-${draftId}`,
            },
          },
        },
      },
    });

    const savedPublish = await prisma.publish.findUniqueOrThrow({
      where: { id: failedPublishId },
    });
    expect(savedPublish.status).toBe("published");
    expect(savedPublish.requestId).toBe(`mock-retry-douyin-${draftId}`);
    expect(savedPublish.remoteId).toBe(`mock-publish-douyin-${draftId}`);
    expect(savedPublish.errorJson).toMatchObject({
      history: [
        {
          requestId: "mock-publish-douyin-previous",
          error: {
            code: "PUBLISH_REMOTE_FAILED",
          },
        },
      ],
    });
  });

  async function createAuthenticatedRequest(team: string): Promise<NextRequest> {
    const token = await createSessionToken({
      userId,
      email: "publish-retry-api@example.com",
      name: "Publish Retry API User",
      teamId: team,
    });
    const request = createRequest();
    request.cookies.set("session", token);

    return request;
  }
});

function createRequest(): NextRequest {
  return new NextRequest("http://localhost/api/publishes/publish-1/retry", {
    method: "POST",
  });
}
