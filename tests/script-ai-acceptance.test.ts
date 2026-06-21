import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import type { WorkflowQueuePayload } from "@/lib/queue/adapter";
import { WORKFLOW_NODE_DEFINITIONS } from "@/lib/workflow/constants";
import { LOCAL_ASR_UNAVAILABLE, createAsrWorkflowNodeHandler } from "@/services/scriptAsrWorkerService";
import { LOCAL_LLM_UNAVAILABLE } from "@/services/scriptModelRegistryService";
import { createRewriteWorkflowNodeHandler } from "@/services/scriptRewriteWorkerService";
import { executeWorkflowNode } from "@/services/workflowWorkerService";

describe("voflow-script-ai task acceptance coverage", () => {
  let userId: string;
  let teamId: string;
  let projectId: string;
  let jobId: string;
  let scriptId: string;

  beforeEach(async () => {
    const unique = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const user = await prisma.user.create({
      data: {
        email: `script_ai_acceptance_${unique}@example.com`,
        passwordHash: "hashed_password",
        name: "Script AI Acceptance User",
      },
    });
    userId = user.id;

    const team = await prisma.team.create({
      data: {
        name: "Script AI Acceptance Team",
        ownerId: userId,
      },
    });
    teamId = team.id;

    const project = await prisma.project.create({
      data: {
        teamId,
        ownerId: userId,
        name: "Script AI Acceptance Project",
        targetPlatform: "douyin",
        aspectRatio: "ratio_16_9",
      },
    });
    projectId = project.id;

    const job = await prisma.videoJob.create({
      data: {
        projectId,
        teamId,
        ownerId: userId,
        status: "queued",
      },
    });
    jobId = job.id;

    const script = await prisma.script.create({
      data: {
        projectId,
        jobId,
        sourceType: "pasted",
        content: "这是一段口播文案",
        version: 1,
        status: "ready",
      },
    });
    scriptId = script.id;
  });

  afterEach(async () => {
    await prisma.workflowNode.deleteMany({ where: { jobId } });
    await prisma.scriptCandidate.deleteMany({ where: { scriptId } });
    await prisma.asrSegment.deleteMany({ where: { scriptId } });
    await prisma.script.deleteMany({ where: { id: scriptId } });
    await prisma.videoJob.deleteMany({ where: { id: jobId } });
    await prisma.project.deleteMany({ where: { id: projectId } });
    await prisma.team.deleteMany({ where: { id: teamId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  });

  it("marks a rewrite workflow node failed with a retryable local LLM error when LLM is unavailable", async () => {
    const node = await prisma.workflowNode.create({
      data: {
        jobId,
        nodeType: "script_rewrite",
        status: "queued",
        version: 1,
        input: {
          sourceType: "script_rewrite",
          scriptId,
        },
      },
    });
    const createProvider = vi.fn();

    const result = await executeWorkflowNode(createPayload(node.id, "script_rewrite"), {
      handlers: {
        script_rewrite: createRewriteWorkflowNodeHandler({
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
        }),
      },
    });

    expect(result).toEqual({
      success: false,
      error: {
        code: LOCAL_LLM_UNAVAILABLE,
        message: "本地 LLM 服务不可用",
      },
    });
    expect(createProvider).not.toHaveBeenCalled();

    const savedNode = await prisma.workflowNode.findUnique({ where: { id: node.id } });
    expect(savedNode).toMatchObject({
      status: "failed",
      error: {
        code: LOCAL_LLM_UNAVAILABLE,
        message: "本地 LLM 服务不可用",
      },
    });
    expect(WORKFLOW_NODE_DEFINITIONS.script_rewrite.retryable).toBe(true);
  });

  it("marks an ASR workflow node failed with a retryable local ASR error when ASR is unavailable", async () => {
    const node = await prisma.workflowNode.create({
      data: {
        jobId,
        nodeType: "script_prepare",
        status: "queued",
        version: 1,
        input: {
          sourceType: "media_asr",
          assetId: "asset-1",
          assetType: "audio",
          storageUrl: "voflow/team/assets/sample.wav",
          durationMs: 60_000,
        },
      },
    });
    const downloadObject = vi.fn();
    const transcribe = vi.fn();

    const result = await executeWorkflowNode(createPayload(node.id, "script_prepare"), {
      handlers: {
        script_prepare: createAsrWorkflowNodeHandler({
          storage: {
            downloadObject,
          },
          registry: {
            getAsrService: async () => ({
              serviceType: "asr",
              name: "ASR 转写",
              baseUrl: "http://localhost:6000",
              status: "offline",
            }),
          },
          provider: {
            transcribe,
          },
        }),
      },
    });

    expect(result).toEqual({
      success: false,
      error: {
        code: LOCAL_ASR_UNAVAILABLE,
        message: "ASR 服务不可用",
      },
    });
    expect(downloadObject).not.toHaveBeenCalled();
    expect(transcribe).not.toHaveBeenCalled();

    const savedNode = await prisma.workflowNode.findUnique({ where: { id: node.id } });
    expect(savedNode).toMatchObject({
      status: "failed",
      error: {
        code: LOCAL_ASR_UNAVAILABLE,
        message: "ASR 服务不可用",
      },
    });
    expect(WORKFLOW_NODE_DEFINITIONS.script_prepare.retryable).toBe(true);
  });

  function createPayload(
    nodeId: string,
    nodeType: "script_prepare" | "script_rewrite"
  ): WorkflowQueuePayload {
    return {
      jobId,
      nodeId,
      nodeType,
      version: 1,
      traceId: `trace-${nodeType}`,
    };
  }
});
