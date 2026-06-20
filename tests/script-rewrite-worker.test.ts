import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkflowQueuePayload } from "@/lib/queue/adapter";
import { prisma } from "@/lib/db";
import { LOCAL_LLM_UNAVAILABLE } from "@/services/scriptModelRegistryService";
import { createRewriteWorkflowNodeHandler } from "@/services/scriptRewriteWorkerService";

const payload: WorkflowQueuePayload = {
  jobId: "job-1",
  nodeId: "node-1",
  nodeType: "script_rewrite",
  version: 1,
  traceId: "trace-1",
};

describe("rewrite workflow node handler", () => {
  let userId: string;
  let teamId: string;
  let projectId: string;
  let scriptId: string;

  beforeEach(async () => {
    const unique = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const user = await prisma.user.create({
      data: {
        email: `script_rewrite_worker_${unique}@example.com`,
        passwordHash: "hashed_password",
        name: "Script Rewrite Worker User",
      },
    });
    userId = user.id;

    const team = await prisma.team.create({
      data: {
        name: "Script Rewrite Worker Team",
        ownerId: userId,
      },
    });
    teamId = team.id;

    const project = await prisma.project.create({
      data: {
        teamId,
        ownerId: userId,
        name: "Script Rewrite Worker Project",
        targetPlatform: "douyin",
        aspectRatio: "ratio_16_9",
      },
    });
    projectId = project.id;

    const script = await prisma.script.create({
      data: {
        projectId,
        sourceType: "pasted",
        content: "这是一段偏书面的产品介绍",
        version: 1,
        status: "draft",
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

  it("calls the local llm provider and saves rewrite candidates with prompt metadata", async () => {
    const rewriteScript = vi.fn(async () => ({
      provider: "local-openai-compatible" as const,
      modelName: "qwen-local",
      candidates: ["第一版口播", "第二版口播", "第三版口播"],
    }));
    const createProvider = vi.fn(() => ({
      rewriteScript,
      generateTitles: vi.fn(),
      healthCheck: vi.fn(),
    }));
    const handler = createRewriteWorkflowNodeHandler({
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
    });

    await expect(
      handler({
        payload,
        input: {
          sourceType: "script_rewrite",
          scriptId,
          platform: "douyin",
          durationSeconds: 45,
          tone: "friendly",
          forbiddenWords: ["绝对"],
          candidateCount: 4,
        },
      })
    ).resolves.toMatchObject({
      output: {
        sourceType: "script_rewrite",
        scriptId,
        modelName: "qwen-local",
        candidateCount: 3,
      },
    });

    expect(createProvider).toHaveBeenCalledWith({
      baseUrl: "http://localhost:8000",
      modelName: "qwen-local",
    });
    expect(rewriteScript).toHaveBeenCalledWith(
      {
        script: "这是一段偏书面的产品介绍",
        platform: "douyin",
        durationSeconds: 45,
        tone: "friendly",
        forbiddenWords: ["绝对"],
      },
      {
        candidateCount: 4,
        maxTokens: 900,
        traceId: "trace-1",
      }
    );

    const candidates = await prisma.scriptCandidate.findMany({
      where: { scriptId },
      orderBy: { createdAt: "asc" },
    });

    expect(candidates).toHaveLength(3);
    expect(candidates.map((candidate) => candidate.content)).toEqual([
      "第一版口播",
      "第二版口播",
      "第三版口播",
    ]);
    expect(candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          modelName: "qwen-local",
          version: 1,
          status: "draft",
        }),
      ])
    );
    expect(candidates[0].prompt).toMatchObject({
      promptType: "script_rewrite",
      version: 1,
      params: {
        platform: "douyin",
        durationSeconds: 45,
        tone: "friendly",
        forbiddenWords: ["绝对"],
        candidateCount: 4,
      },
    });
  });

  it("fails before calling the provider when the llm registry status is unavailable", async () => {
    const createProvider = vi.fn();
    const handler = createRewriteWorkflowNodeHandler({
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
          sourceType: "script_rewrite",
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
