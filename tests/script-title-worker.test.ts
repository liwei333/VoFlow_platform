import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkflowQueuePayload } from "@/lib/queue/adapter";
import { prisma } from "@/lib/db";
import { LOCAL_LLM_UNAVAILABLE } from "@/services/scriptModelRegistryService";
import { createTitleWorkflowNodeHandler } from "@/services/scriptTitleWorkerService";

const payload: WorkflowQueuePayload = {
  jobId: "job-1",
  nodeId: "node-1",
  nodeType: "script_title",
  version: 1,
  traceId: "trace-1",
};

describe("title workflow node handler", () => {
  let userId: string;
  let teamId: string;
  let projectId: string;
  let scriptId: string;

  beforeEach(async () => {
    const unique = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const user = await prisma.user.create({
      data: {
        email: `script_title_worker_${unique}@example.com`,
        passwordHash: "hashed_password",
        name: "Script Title Worker User",
      },
    });
    userId = user.id;

    const team = await prisma.team.create({
      data: {
        name: "Script Title Worker Team",
        ownerId: userId,
      },
    });
    teamId = team.id;

    const project = await prisma.project.create({
      data: {
        teamId,
        ownerId: userId,
        name: "Script Title Worker Project",
        targetPlatform: "douyin",
        aspectRatio: "ratio_16_9",
      },
    });
    projectId = project.id;

    const script = await prisma.script.create({
      data: {
        projectId,
        sourceType: "pasted",
        content: "这是一段适合短视频发布的口播文案",
        version: 1,
        status: "ready",
      },
    });
    scriptId = script.id;
  });

  afterEach(async () => {
    await prisma.scriptCandidate.deleteMany({ where: { scriptId } });
    await prisma.asrSegment.deleteMany({ where: { scriptId } });
    await prisma.script.deleteMany({ where: { id: scriptId } });
    await prisma.project.deleteMany({ where: { id: projectId } });
    await prisma.team.deleteMany({ where: { id: teamId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  it("calls the local llm provider and saves title candidates for the script", async () => {
    const generateTitles = vi.fn(async () => ({
      provider: "local-openai-compatible" as const,
      modelName: "qwen-local",
      titles: ["标题1", "标题2", "标题3", "标题4", "标题5"],
    }));
    const createProvider = vi.fn(() => ({
      rewriteScript: vi.fn(),
      generateTitles,
      healthCheck: vi.fn(),
    }));
    const handler = createTitleWorkflowNodeHandler({
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
            maxTokens: 600,
          },
        }),
      },
      providerFactory: {
        createProvider,
      },
    });

    await expect(
      handler({
        payload,
        input: {
          sourceType: "script_title",
          scriptId,
          platform: "douyin",
          titleCount: 5,
        },
      })
    ).resolves.toMatchObject({
      output: {
        sourceType: "script_title",
        scriptId,
        modelName: "qwen-local",
        titleCount: 5,
      },
    });

    expect(createProvider).toHaveBeenCalledWith({
      baseUrl: "http://localhost:8000",
      modelName: "qwen-local",
    });
    expect(generateTitles).toHaveBeenCalledWith(
      "这是一段适合短视频发布的口播文案",
      "douyin",
      {
        titleCount: 5,
        maxTokens: 600,
        traceId: "trace-1",
      }
    );

    const candidates = await prisma.scriptCandidate.findMany({
      where: { scriptId },
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      scriptId,
      content: "这是一段适合短视频发布的口播文案",
      titleCandidates: ["标题1", "标题2", "标题3", "标题4", "标题5"],
      modelName: "qwen-local",
      version: 1,
      status: "draft",
    });
    expect(candidates[0].prompt).toMatchObject({
      promptType: "script_title",
      version: 1,
      params: {
        platform: "douyin",
        titleCount: 5,
      },
    });
  });

  it("fails before calling the provider when the llm registry status is unavailable", async () => {
    const createProvider = vi.fn();
    const handler = createTitleWorkflowNodeHandler({
      registry: {
        getRegistry: async () => ({
          llm: {
            serviceType: "llm",
            baseUrl: "http://localhost:8000",
            modelName: "qwen-local",
            status: "offline",
          },
          asr: null,
          generation: {
            provider: "local-openai-compatible",
          },
        }),
      },
      providerFactory: {
        createProvider,
      },
    });

    await expect(
      handler({
        payload,
        input: {
          sourceType: "script_title",
          scriptId,
        },
      })
    ).rejects.toMatchObject({
      code: LOCAL_LLM_UNAVAILABLE,
      message: "本地 LLM 服务不可用",
    });
    expect(createProvider).not.toHaveBeenCalled();
  });
});
