import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma, type ChannelAccountStatus, type PublishPlatform } from "@prisma/client";
import { prisma } from "@/lib/db";
import { PUBLISH_VALIDATION_CHECK_CODES } from "@/lib/publish/validation";
import { generatePublishDrafts } from "@/services/publishDraftGenerationService";
import { createPublishesForJob, retryPublish } from "@/services/publishService";
import { validatePublishParameters } from "@/services/publishValidationService";

describe("Publish assistant acceptance coverage", () => {
  const now = new Date("2026-06-26T00:00:00.000Z");
  let userId: string;
  let teamId: string;
  let projectId: string;
  let jobId: string;
  let scriptId: string;
  let finalExportNodeId: string;
  let coverNodeId: string;
  let finalVideoArtifactId: string;
  let coverArtifactId: string;

  beforeEach(async () => {
    const unique = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const user = await prisma.user.create({
      data: {
        email: `publish_acceptance_${unique}@example.com`,
        passwordHash: "hashed_password",
        name: "Publish Acceptance User",
      },
    });
    userId = user.id;

    const team = await prisma.team.create({
      data: {
        name: "Publish Acceptance Team",
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
        name: "Publish Acceptance Project",
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
        currentNode: "publish",
      },
    });
    jobId = job.id;

    const script = await prisma.script.create({
      data: {
        projectId,
        jobId,
        sourceType: "generated",
        content: "这是一段已经通过法务审查的最终口播文案，用于生成多平台发布草稿。",
        version: 2,
        status: "approved",
      },
    });
    scriptId = script.id;

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
  });

  afterEach(async () => {
    await prisma.publish.deleteMany({ where: { jobId } });
    await prisma.publishDraft.deleteMany({ where: { jobId } });
    await prisma.channelAccount.deleteMany({ where: { teamId } });
    await prisma.artifact.deleteMany({ where: { jobId } });
    await prisma.workflowNode.deleteMany({ where: { jobId } });
    await prisma.script.deleteMany({ where: { id: scriptId } });
    await prisma.videoJob.deleteMany({ where: { id: jobId } });
    await prisma.project.deleteMany({ where: { id: projectId } });
    await prisma.teamMember.deleteMany({ where: { userId } });
    await prisma.team.deleteMany({ where: { id: teamId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  it("generates and persists platform-specific drafts from the approved script", async () => {
    const generateDraft = vi.fn(async ({ platform }: { platform: string }) => ({
      modelName: "qwen-local",
      title: `${platform} 验收标题`,
      description: `${platform} 验收描述`,
      tags: ["新品", "口播", "验收"],
      topics: ["618", platform],
    }));

    const result = await generatePublishDrafts(
      {
        jobId,
        teamId,
        platforms: ["douyin", "xiaohongshu"],
        traceId: "trace-publish-acceptance",
      },
      {
        registry: onlineRegistry(),
        providerFactory: {
          createProvider: () => ({
            generateDraft,
          }),
        },
      }
    );

    expect(result).toMatchObject({
      success: true,
      data: {
        drafts: [
          {
            jobId,
            platform: "douyin",
            title: "douyin 验收标题",
            description: "douyin 验收描述",
            tags: ["新品", "口播", "验收"],
            topics: ["618", "douyin"],
          },
          {
            jobId,
            platform: "xiaohongshu",
            title: "xiaohongshu 验收标题",
            description: "xiaohongshu 验收描述",
            tags: ["新品", "口播", "验收"],
            topics: ["618", "xiaohongshu"],
          },
        ],
      },
    });
    expect(generateDraft).toHaveBeenCalledTimes(2);
    expect(generateDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        platform: "douyin",
        platformLabel: "抖音",
        script: "这是一段已经通过法务审查的最终口播文案，用于生成多平台发布草稿。",
      }),
      {
        maxTokens: 900,
        traceId: "trace-publish-acceptance",
      }
    );

    const savedDrafts = await prisma.publishDraft.findMany({
      where: { jobId },
      orderBy: { platform: "asc" },
    });
    expect(savedDrafts).toHaveLength(2);
    expect(savedDrafts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          platform: "douyin",
          title: "douyin 验收标题",
          tagsJson: ["新品", "口播", "验收"],
          topicsJson: ["618", "douyin"],
        }),
        expect.objectContaining({
          platform: "xiaohongshu",
          title: "xiaohongshu 验收标题",
          tagsJson: ["新品", "口播", "验收"],
          topicsJson: ["618", "xiaohongshu"],
        }),
      ])
    );
  });

  it("blocks one-click publish when the platform title is over the limit", async () => {
    const draft = await createDraft({
      platform: "xiaohongshu",
      title: "这是一条明确超过小红书二十字限制的发布标题内容",
    });
    await createChannelAccount({
      platform: "xiaohongshu",
      status: "connected",
      expiresAt: new Date("2026-07-26T00:00:00.000Z"),
    });

    const validation = await validatePublishParameters({
      jobId,
      teamId,
      userId,
      platforms: ["xiaohongshu"],
      now,
    });
    expect(validation).toMatchObject({
      success: true,
      data: {
        summary: {
          canPublish: false,
          failed: 1,
        },
        results: [
          {
            platform: "xiaohongshu",
            passed: false,
          },
        ],
      },
    });
    expect(validation.success && validation.data.results[0].checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: PUBLISH_VALIDATION_CHECK_CODES.titleTooLong,
          passed: false,
        }),
      ])
    );

    const publish = await createPublishesForJob({
      jobId,
      teamId,
      userId,
      platforms: ["xiaohongshu"],
      now,
    });
    expect(publish).toMatchObject({
      success: true,
      data: {
        summary: {
          published: 0,
          failed: 0,
          skipped: 1,
        },
        publishes: [
          {
            publishDraftId: draft.id,
            platform: "xiaohongshu",
            status: "skipped",
            requestId: null,
            remoteId: null,
            errorJson: {
              code: PUBLISH_VALIDATION_CHECK_CODES.titleTooLong,
              message: "发布参数检查未通过",
            },
          },
        ],
      },
    });
  });

  it("marks an expired-token platform as skipped without creating a remote request", async () => {
    const draft = await createDraft({
      platform: "douyin",
      title: "抖音合规标题",
      validationJson: passedValidation("douyin"),
    });
    const account = await createChannelAccount({
      platform: "douyin",
      status: "expired",
      expiresAt: new Date("2026-06-25T00:00:00.000Z"),
    });

    const result = await createPublishesForJob({
      jobId,
      teamId,
      userId,
      platforms: ["douyin"],
      now,
    });

    expect(result).toMatchObject({
      success: true,
      data: {
        summary: {
          total: 1,
          published: 0,
          failed: 0,
          skipped: 1,
        },
        publishes: [
          {
            publishDraftId: draft.id,
            channelAccountId: account.id,
            platform: "douyin",
            status: "skipped",
            requestId: null,
            remoteId: null,
            errorJson: {
              code: "CHANNEL_TOKEN_EXPIRED",
              message: "渠道账号不可发布",
            },
          },
        ],
      },
    });
  });

  it("retries only the failed platform after a partial publish failure", async () => {
    const douyinDraft = await createDraft({
      platform: "douyin",
      title: "抖音合规标题",
      validationJson: passedValidation("douyin"),
    });
    const xiaohongshuDraft = await createDraft({
      platform: "xiaohongshu",
      title: "小红书合规标题",
      validationJson: passedValidation("xiaohongshu"),
    });
    const douyinAccount = await createChannelAccount({
      platform: "douyin",
      status: "connected",
      expiresAt: new Date("2026-07-26T00:00:00.000Z"),
    });
    const xiaohongshuAccount = await createChannelAccount({
      platform: "xiaohongshu",
      status: "connected",
      expiresAt: new Date("2026-07-26T00:00:00.000Z"),
    });

    const failedPublish = await prisma.publish.create({
      data: {
        jobId,
        publishDraftId: xiaohongshuDraft.id,
        channelAccountId: xiaohongshuAccount.id,
        platform: "xiaohongshu",
        status: "failed",
        requestId: "mock-publish-xiaohongshu-previous",
        remoteId: "mock-publish-xiaohongshu-previous",
        errorJson: {
          code: "PUBLISH_REMOTE_FAILED",
          message: "平台发布失败",
        },
      },
    });
    const publishedPublish = await prisma.publish.create({
      data: {
        jobId,
        publishDraftId: douyinDraft.id,
        channelAccountId: douyinAccount.id,
        platform: "douyin",
        status: "published",
        requestId: "mock-publish-douyin-stable",
        remoteId: "mock-publish-douyin-stable",
      },
    });

    const result = await retryPublish({
      publishId: failedPublish.id,
      teamId,
      userId,
      now,
    });

    expect(result).toMatchObject({
      success: true,
      data: {
        publish: {
          id: failedPublish.id,
          platform: "xiaohongshu",
          status: "published",
          requestId: `mock-retry-xiaohongshu-${xiaohongshuDraft.id}`,
          remoteId: `mock-publish-xiaohongshu-${xiaohongshuDraft.id}`,
          errorJson: {
            history: [
              {
                status: "failed",
                requestId: "mock-publish-xiaohongshu-previous",
                remoteId: "mock-publish-xiaohongshu-previous",
                error: {
                  code: "PUBLISH_REMOTE_FAILED",
                  message: "平台发布失败",
                },
              },
            ],
          },
        },
      },
    });

    const savedPublishes = await prisma.publish.findMany({
      where: { jobId },
      orderBy: { platform: "asc" },
    });
    expect(savedPublishes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: publishedPublish.id,
          platform: "douyin",
          status: "published",
          requestId: "mock-publish-douyin-stable",
          remoteId: "mock-publish-douyin-stable",
        }),
        expect.objectContaining({
          id: failedPublish.id,
          platform: "xiaohongshu",
          status: "published",
          requestId: `mock-retry-xiaohongshu-${xiaohongshuDraft.id}`,
          remoteId: `mock-publish-xiaohongshu-${xiaohongshuDraft.id}`,
        }),
      ])
    );
  });

  async function createDraft(input: {
    platform: PublishPlatform;
    title: string;
    validationJson?: unknown;
  }) {
    const data: Prisma.PublishDraftUncheckedCreateInput = {
      jobId,
      platform: input.platform,
      title: input.title,
      description: `${input.platform} 发布描述`,
      tagsJson: ["新品", "口播"],
      topicsJson: ["618"],
      coverArtifactId,
    };
    if (input.validationJson !== undefined) {
      data.validationJson = input.validationJson as Prisma.InputJsonValue;
    }

    return prisma.publishDraft.create({
      data,
    });
  }

  async function createChannelAccount(input: {
    platform: PublishPlatform;
    status: Extract<ChannelAccountStatus, "connected" | "expired" | "not_connected">;
    expiresAt: Date | null;
  }) {
    return prisma.channelAccount.create({
      data: {
        teamId,
        userId,
        platform: input.platform,
        accountName: `${input.platform} 验收号`,
        encryptedToken: `voflow_channel_token_v1.${input.platform}.token.payload`,
        status: input.status,
        expiresAt: input.expiresAt,
      },
    });
  }

  function passedValidation(platform: PublishPlatform) {
    return {
      draftId: "draft-id-is-not-used-by-adapter",
      platform,
      passed: true,
      checkedAt: now.toISOString(),
      account: {
        status: "connected",
        requiresAuth: false,
      },
      finalVideoArtifactId,
      coverArtifactId,
      checks: [
        {
          code: PUBLISH_VALIDATION_CHECK_CODES.channelAccountConnected,
          passed: true,
        },
      ],
    };
  }
});

function onlineRegistry() {
  return {
    getRegistry: async () => ({
      llm: {
        serviceType: "llm" as const,
        baseUrl: "http://localhost:8000",
        modelName: "qwen-local",
        status: "online" as const,
      },
      asr: null,
      generation: {
        provider: "local-openai-compatible",
        maxTokens: 900,
      },
    }),
  };
}
