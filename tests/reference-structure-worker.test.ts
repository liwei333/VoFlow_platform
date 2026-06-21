import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import type { WorkflowQueuePayload } from "@/lib/queue/adapter";
import {
  REFERENCE_STRUCTURE_FAILED,
  REFERENCE_TRANSCRIPT_NOT_FOUND,
  createReferenceStructureWorkflowNodeHandler,
} from "@/services/referenceStructureWorkerService";

const payload: WorkflowQueuePayload = {
  jobId: "job-placeholder",
  nodeId: "node-placeholder",
  nodeType: "reference_extract",
  version: 1,
  traceId: "trace-reference-structure",
};

describe("reference structure worker", () => {
  let userId: string;
  let teamId: string;
  let projectId: string;
  let jobId: string;
  let referenceSourceId: string;
  let scriptId: string | null = null;

  beforeEach(async () => {
    const unique = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const user = await prisma.user.create({
      data: {
        email: `reference_structure_${unique}@example.com`,
        passwordHash: "hashed_password",
        name: "Reference Structure User",
      },
    });
    userId = user.id;

    const team = await prisma.team.create({
      data: {
        name: "Reference Structure Team",
        ownerId: userId,
      },
    });
    teamId = team.id;

    projectId = (
      await prisma.project.create({
        data: {
          teamId,
          ownerId: userId,
          name: "Reference Structure Project",
          targetPlatform: "douyin",
          aspectRatio: "ratio_9_16",
        },
      })
    ).id;

    jobId = (
      await prisma.videoJob.create({
        data: {
          projectId,
          teamId,
          ownerId: userId,
          status: "running",
          currentNode: "reference_extract",
        },
      })
    ).id;

    payload.jobId = jobId;
  });

  afterEach(async () => {
    await prisma.asrSegment.deleteMany({
      where: {
        scriptId: scriptId ?? undefined,
      },
    });
    await prisma.referenceSource.deleteMany({ where: { id: referenceSourceId } });
    if (scriptId) {
      await prisma.script.deleteMany({ where: { id: scriptId } });
    }
    await prisma.videoJob.deleteMany({ where: { id: jobId } });
    await prisma.project.deleteMany({ where: { id: projectId } });
    await prisma.team.deleteMany({ where: { id: teamId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    scriptId = null;
  });

  it("rejects reference sources without an ASR transcript", async () => {
    referenceSourceId = (
      await prisma.referenceSource.create({
        data: {
          projectId,
          teamId,
          sourceType: "asset",
          status: "analyzing",
        },
      })
    ).id;

    const handler = createReferenceStructureWorkflowNodeHandler();

    await expect(
      handler({
        payload,
        input: {
          sourceType: "reference_structure",
          referenceSourceId,
        },
      })
    ).rejects.toMatchObject({
      code: REFERENCE_TRANSCRIPT_NOT_FOUND,
      message: "爆款参考原文不存在",
    });
  });

  it("writes hook, rhythm, selling points, and target audience to structureJson", async () => {
    await createTranscriptFixture();
    const handler = createReferenceStructureWorkflowNodeHandler({
      registry: {
        getRegistry: async () => ({
          llm: {
            serviceType: "llm",
            baseUrl: "http://localhost:11434",
            modelName: "qwen2.5",
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
        createProvider: (service) => ({
          analyzeStructure: async (input, options) => {
            expect(service).toEqual({
              baseUrl: "http://localhost:11434",
              modelName: "qwen2.5",
            });
            expect(options).toEqual({
              maxTokens: 900,
              traceId: "trace-reference-structure",
            });
            expect(input).toMatchObject({
              transcript: "前三秒先问问题，然后讲痛点，最后给行动建议。",
              segments: [
                { startMs: 0, endMs: 1000, text: "前三秒先问问题" },
                { startMs: 1000, endMs: 2400, text: "然后讲痛点" },
              ],
            });
            return {
              provider: "local-openai-compatible",
              modelName: "qwen2.5",
              structure: {
                hook: "前三秒用问题制造好奇",
                rhythm: ["提问", "痛点", "建议"],
                sellingPoints: ["节省时间", "降低试错"],
                targetAudience: "想提升短视频转化的内容运营",
              },
            };
          },
        }),
      },
    });

    await expect(
      handler({
        payload,
        input: {
          sourceType: "reference_structure",
          referenceSourceId,
        },
      })
    ).resolves.toEqual({
      output: {
        sourceType: "reference_structure",
        referenceSourceId,
        modelName: "qwen2.5",
        structure: {
          hook: "前三秒用问题制造好奇",
          rhythm: ["提问", "痛点", "建议"],
          sellingPoints: ["节省时间", "降低试错"],
          targetAudience: "想提升短视频转化的内容运营",
        },
      },
    });

    const saved = await prisma.referenceSource.findUnique({
      where: { id: referenceSourceId },
    });

    expect(saved).toMatchObject({
      status: "succeeded",
      structureJson: {
        hook: "前三秒用问题制造好奇",
        rhythm: ["提问", "痛点", "建议"],
        sellingPoints: ["节省时间", "降低试错"],
        targetAudience: "想提升短视频转化的内容运营",
        modelName: "qwen2.5",
        provider: "local-openai-compatible",
      },
      errorJson: null,
    });
  });

  it("writes REFERENCE_STRUCTURE_FAILED when the LLM provider fails", async () => {
    await createTranscriptFixture();
    const handler = createReferenceStructureWorkflowNodeHandler({
      registry: {
        getRegistry: async () => ({
          llm: {
            serviceType: "llm",
            baseUrl: "http://localhost:11434",
            modelName: "qwen2.5",
            status: "online",
          },
          asr: null,
          generation: {
            provider: "local-openai-compatible",
          },
        }),
      },
      providerFactory: {
        createProvider: () => ({
          analyzeStructure: async () => {
            throw new Error("llm timeout");
          },
        }),
      },
    });

    await expect(
      handler({
        payload,
        input: {
          sourceType: "reference_structure",
          referenceSourceId,
        },
      })
    ).rejects.toMatchObject({
      code: REFERENCE_STRUCTURE_FAILED,
      message: "爆款结构分析失败",
    });

    const saved = await prisma.referenceSource.findUnique({
      where: { id: referenceSourceId },
    });

    expect(saved).toMatchObject({
      status: "failed",
      errorJson: {
        code: REFERENCE_STRUCTURE_FAILED,
        message: "爆款结构分析失败",
        detail: "llm timeout",
      },
    });
  });

  async function createTranscriptFixture() {
    scriptId = (
      await prisma.script.create({
        data: {
          projectId,
          jobId,
          sourceType: "asr",
          content: "前三秒先问问题，然后讲痛点，最后给行动建议。",
          status: "ready",
          asrSegments: {
            create: [
              { startMs: 0, endMs: 1000, text: "前三秒先问问题" },
              { startMs: 1000, endMs: 2400, text: "然后讲痛点" },
            ],
          },
        },
      })
    ).id;

    referenceSourceId = (
      await prisma.referenceSource.create({
        data: {
          projectId,
          teamId,
          sourceType: "asset",
          status: "analyzing",
          transcriptScriptId: scriptId,
        },
      })
    ).id;
  }
});
