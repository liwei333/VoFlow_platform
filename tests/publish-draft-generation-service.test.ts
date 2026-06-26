import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { generatePublishDrafts } from "@/services/publishDraftGenerationService";

describe("generatePublishDrafts", () => {
  let userId: string;
  let teamId: string;
  let otherTeamId: string;
  let projectId: string;
  let jobId: string;
  let scriptId: string;

  beforeEach(async () => {
    const unique = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const user = await prisma.user.create({
      data: {
        email: `publish_draft_${unique}@example.com`,
        passwordHash: "hashed_password",
        name: "Publish Draft User",
      },
    });
    userId = user.id;

    const team = await prisma.team.create({
      data: {
        name: "Publish Draft Team",
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

    const otherTeam = await prisma.team.create({
      data: {
        name: "Other Publish Draft Team",
        ownerId: userId,
      },
    });
    otherTeamId = otherTeam.id;

    const project = await prisma.project.create({
      data: {
        teamId,
        ownerId: userId,
        name: "Publish Draft Project",
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
        status: "running",
        currentNode: "publish",
      },
    });
    jobId = job.id;

    const script = await prisma.script.create({
      data: {
        projectId,
        jobId,
        sourceType: "generated",
        content: "这是一段已经通过法务审查的最终口播文案，适合生成多平台发布信息。",
        version: 2,
        status: "approved",
      },
    });
    scriptId = script.id;
  });

  afterEach(async () => {
    await prisma.publish.deleteMany({ where: { jobId } });
    await prisma.publishDraft.deleteMany({ where: { jobId } });
    await prisma.scriptCandidate.deleteMany({ where: { scriptId } });
    await prisma.asrSegment.deleteMany({ where: { scriptId } });
    await prisma.script.deleteMany({ where: { id: scriptId } });
    await prisma.videoJob.deleteMany({ where: { id: jobId } });
    await prisma.project.deleteMany({ where: { id: projectId } });
    await prisma.teamMember.deleteMany({ where: { userId } });
    await prisma.team.deleteMany({ where: { id: { in: [teamId, otherTeamId] } } });
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  it("calls the local llm provider per platform and saves platform-specific drafts", async () => {
    const generateDraft = vi.fn(async ({ platform }: { platform: string }) => ({
      modelName: "qwen-local",
      title:
        platform === "douyin"
          ? "抖音爆款标题".repeat(8)
          : "YouTube Shorts publish title",
      description: `${platform} 平台描述`,
      tags: ["tag1", "tag2", "tag3", "tag4", "tag5", "tag6"],
      topics: ["topic1", "topic2"],
    }));
    const createProvider = vi.fn(() => ({
      generateDraft,
    }));

    const result = await generatePublishDrafts(
      {
        jobId,
        teamId,
        platforms: ["douyin", "youtube_shorts"],
        traceId: "trace-publish-drafts",
      },
      {
        registry: {
          getRegistry: async () => ({
            llm: {
              serviceType: "llm",
              baseUrl: "http://localhost:8000",
              modelName: "qwen-local",
              status: "online",
            },
            asr: null,
            generation: {
              provider: "local-openai-compatible",
              maxTokens: 900,
            },
          }),
        },
        providerFactory: {
          createProvider,
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
            title: expect.any(String),
            description: "douyin 平台描述",
            tags: ["tag1", "tag2", "tag3", "tag4", "tag5"],
            topics: ["topic1", "topic2"],
          },
          {
            jobId,
            platform: "youtube_shorts",
            title: "YouTube Shorts publish title",
            description: "youtube_shorts 平台描述",
            tags: ["tag1", "tag2", "tag3", "tag4", "tag5", "tag6"],
            topics: ["topic1", "topic2"],
          },
        ],
      },
    });
    expect(result.success && result.data.drafts[0].title.length).toBeLessThanOrEqual(55);
    expect(createProvider).toHaveBeenCalledWith({
      baseUrl: "http://localhost:8000",
      modelName: "qwen-local",
    });
    expect(generateDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        script: "这是一段已经通过法务审查的最终口播文案，适合生成多平台发布信息。",
        platform: "douyin",
        platformLabel: "抖音",
        rule: expect.objectContaining({
          title: { maxChars: 55 },
          tags: { maxCount: 5 },
        }),
      }),
      {
        maxTokens: 900,
        traceId: "trace-publish-drafts",
      }
    );

    const savedDrafts = await prisma.publishDraft.findMany({
      where: { jobId },
      orderBy: { platform: "asc" },
    });

    expect(savedDrafts).toHaveLength(2);
    expect(savedDrafts.find((draft) => draft.platform === "douyin")).toMatchObject({
      title: result.success ? result.data.drafts[0].title : "",
      description: "douyin 平台描述",
      tagsJson: ["tag1", "tag2", "tag3", "tag4", "tag5"],
      topicsJson: ["topic1", "topic2"],
      validationJson: null,
    });
  });

  it("updates the existing draft for the same job and platform", async () => {
    await prisma.publishDraft.create({
      data: {
        jobId,
        platform: "douyin",
        title: "旧标题",
        description: "旧描述",
        tagsJson: ["old"],
        topicsJson: ["old-topic"],
      },
    });

    const result = await generatePublishDrafts(
      {
        jobId,
        teamId,
        platforms: ["douyin"],
      },
      {
        registry: onlineRegistry(),
        providerFactory: {
          createProvider: () => ({
            generateDraft: async () => ({
              modelName: "qwen-local",
              title: "新标题",
              description: "新描述",
              tags: ["new"],
              topics: ["new-topic"],
            }),
          }),
        },
      }
    );

    expect(result).toMatchObject({
      success: true,
      data: {
        drafts: [
          {
            title: "新标题",
            description: "新描述",
            tags: ["new"],
            topics: ["new-topic"],
          },
        ],
      },
    });

    const savedDrafts = await prisma.publishDraft.findMany({ where: { jobId, platform: "douyin" } });
    expect(savedDrafts).toHaveLength(1);
    expect(savedDrafts[0]).toMatchObject({
      title: "新标题",
      description: "新描述",
      tagsJson: ["new"],
      topicsJson: ["new-topic"],
    });
  });

  it("rejects jobs outside the current team before calling the provider", async () => {
    const createProvider = vi.fn();

    await expect(
      generatePublishDrafts(
        {
          jobId,
          teamId: otherTeamId,
          platforms: ["douyin"],
        },
        {
          registry: onlineRegistry(),
          providerFactory: {
            createProvider,
          },
        }
      )
    ).resolves.toEqual({
      success: false,
      error: {
        code: "PUBLISH_JOB_NOT_FOUND",
        message: "视频任务不存在",
      },
    });
    expect(createProvider).not.toHaveBeenCalled();
  });

  it("rejects jobs without an approved final script", async () => {
    await prisma.script.update({
      where: { id: scriptId },
      data: {
        status: "draft",
      },
    });

    await expect(
      generatePublishDrafts(
        {
          jobId,
          teamId,
          platforms: ["douyin"],
        },
        {
          registry: onlineRegistry(),
          providerFactory: {
            createProvider: vi.fn(),
          },
        }
      )
    ).resolves.toEqual({
      success: false,
      error: {
        code: "PUBLISH_SCRIPT_NOT_READY",
        message: "最终文案不存在",
      },
    });
  });
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
