import { describe, expect, it } from "vitest";
import type { WorkflowQueuePayload } from "@/lib/queue/adapter";
import {
  createDefaultWorkflowNodeHandlers,
  executeWorkflowNode,
  type WorkflowNodeExecutionRepository,
  type WorkflowNodeHandlers,
} from "@/services/workflowWorkerService";
import {
  writeWorkflowArtifact,
  type WorkflowArtifactRepository,
} from "@/services/workflowArtifactService";

const payload: WorkflowQueuePayload = {
  jobId: "job-1",
  nodeId: "node-1",
  nodeType: "tts",
  version: 2,
  traceId: "trace-1",
};

describe("executeWorkflowNode", () => {
  it("registers the ASR handler for script_prepare nodes by default", () => {
    const handlers = createDefaultWorkflowNodeHandlers();

    expect(handlers.reference_extract).toBeTypeOf("function");
    expect(handlers.reference_url_import).toBeTypeOf("function");
    expect(handlers.script_prepare).toBeTypeOf("function");
    expect(handlers.script_rewrite).toBeTypeOf("function");
    expect(handlers.script_title).toBeTypeOf("function");
    expect(handlers.legal_review).toBeTypeOf("function");
    expect(handlers.voice_clone).toBeTypeOf("function");
  });

  it("routes audio extraction to the reference URL import worker", async () => {
    const calls: unknown[] = [];
    const repository = createExecutionRepository(calls, {
      sourceType: "reference_url_import",
      referenceSourceId: "ref-1",
      projectId: "project-1",
      teamId: "team-1",
      userId: "user-1",
      sourceUrl: "https://www.youtube.com/watch?v=demo",
      platform: "youtube",
      importMode: "audio_extract",
    });
    const payload: WorkflowQueuePayload = {
      jobId: "job-1",
      nodeId: "node-1",
      nodeType: "reference_url_import",
      version: 1,
      traceId: "trace-reference-url",
    };

    const result = await executeWorkflowNode(payload, {
      repository,
      handlers: createDefaultWorkflowNodeHandlers(),
      now: () => new Date("2026-06-23T00:00:00.000Z"),
    });

    expect(result).toEqual({
      success: false,
      error: {
        code: "REFERENCE_SOURCE_NOT_FOUND",
        message: "参考来源不存在",
      },
    });
    expect(calls.at(-1)).toEqual({
      markFailed: {
        nodeId: "node-1",
        error: {
          code: "REFERENCE_SOURCE_NOT_FOUND",
          message: "参考来源不存在",
        },
        finishedAt: new Date("2026-06-23T00:00:00.000Z"),
      },
    });
  });

  it("runs the matching handler and marks the node succeeded with output", async () => {
    const calls: unknown[] = [];
    const repository = createExecutionRepository(calls);
    const handlers: WorkflowNodeHandlers = {
      tts: async (input) => {
        calls.push({ handlerInput: input });
        return { output: { audioUrl: "tts.wav" } };
      },
    };

    const result = await executeWorkflowNode(payload, {
      repository,
      handlers,
      now: () => new Date("2026-06-20T00:00:00.000Z"),
    });

    expect(result).toEqual({
      success: true,
      data: { output: { audioUrl: "tts.wav" } },
    });
    expect(calls).toEqual([
      {
        markRunning: {
          nodeId: "node-1",
          startedAt: new Date("2026-06-20T00:00:00.000Z"),
        },
      },
      {
        handlerInput: {
          payload,
          input: { script: "hello" },
        },
      },
      {
        markSucceeded: {
          nodeId: "node-1",
          output: { audioUrl: "tts.wav" },
          finishedAt: new Date("2026-06-20T00:00:00.000Z"),
        },
      },
    ]);
  });

  it("marks the node failed when the handler throws", async () => {
    const calls: unknown[] = [];
    const repository = createExecutionRepository(calls);
    const handlers: WorkflowNodeHandlers = {
      tts: async () => {
        throw new Error("tts provider timeout");
      },
    };

    const result = await executeWorkflowNode(payload, {
      repository,
      handlers,
      now: () => new Date("2026-06-20T00:30:00.000Z"),
    });

    expect(result.success).toBe(false);
    expect(calls.at(-1)).toEqual({
      markFailed: {
        nodeId: "node-1",
        error: {
          code: "WORKFLOW_NODE_EXECUTION_FAILED",
          message: "tts provider timeout",
        },
        finishedAt: new Date("2026-06-20T00:30:00.000Z"),
      },
    });
  });

  it("preserves retryable local model error codes from handlers", async () => {
    const calls: unknown[] = [];
    const repository = createExecutionRepository(calls);
    const handlers: WorkflowNodeHandlers = {
      tts: async () => {
        const error = new Error("本地 LLM 服务不可用");
        Object.assign(error, { code: "LOCAL_LLM_UNAVAILABLE" });
        throw error;
      },
    };

    const result = await executeWorkflowNode(payload, {
      repository,
      handlers,
      now: () => new Date("2026-06-20T00:45:00.000Z"),
    });

    expect(result).toEqual({
      success: false,
      error: {
        code: "LOCAL_LLM_UNAVAILABLE",
        message: "本地 LLM 服务不可用",
      },
    });
    expect(calls.at(-1)).toEqual({
      markFailed: {
        nodeId: "node-1",
        error: {
          code: "LOCAL_LLM_UNAVAILABLE",
          message: "本地 LLM 服务不可用",
        },
        finishedAt: new Date("2026-06-20T00:45:00.000Z"),
      },
    });
  });

  it("marks the node waiting approval when the handler reports approval is required", async () => {
    const calls: unknown[] = [];
    const repository = createExecutionRepository(calls);
    const handlers: WorkflowNodeHandlers = {
      tts: async () => ({
        status: "waiting_approval",
        requiresApproval: true,
        output: {
          riskReport: {
            status: "needs_review",
          },
        },
      }),
    };

    const result = await executeWorkflowNode(payload, {
      repository,
      handlers,
      now: () => new Date("2026-06-20T00:50:00.000Z"),
    });

    expect(result).toEqual({
      success: true,
      data: {
        output: {
          riskReport: {
            status: "needs_review",
          },
        },
      },
    });
    expect(calls.at(-1)).toEqual({
      markWaitingApproval: {
        nodeId: "node-1",
        output: {
          riskReport: {
            status: "needs_review",
          },
        },
        requiresApproval: true,
        finishedAt: new Date("2026-06-20T00:50:00.000Z"),
      },
    });
  });
});

describe("writeWorkflowArtifact", () => {
  it("writes artifact metadata through the repository", async () => {
    const writes: unknown[] = [];
    const repository: WorkflowArtifactRepository = {
      createArtifact: async (data) => {
        writes.push(data);
        return {
          id: "artifact-1",
          ...data,
          createdAt: new Date("2026-06-20T01:00:00.000Z"),
        };
      },
    };

    const result = await writeWorkflowArtifact(
      {
        jobId: "job-1",
        nodeId: "node-1",
        type: "audio",
        storageUrl: "voflow/team/assets/tts.wav",
        metadata: { duration: 12 },
      },
      { repository }
    );

    expect(result).toEqual({
      id: "artifact-1",
      jobId: "job-1",
      nodeId: "node-1",
      type: "audio",
      storageUrl: "voflow/team/assets/tts.wav",
      metadata: { duration: 12 },
      createdAt: new Date("2026-06-20T01:00:00.000Z"),
    });
    expect(writes).toEqual([
      {
        jobId: "job-1",
        nodeId: "node-1",
        type: "audio",
        storageUrl: "voflow/team/assets/tts.wav",
        metadata: { duration: 12 },
      },
    ]);
  });
});

function createExecutionRepository(
  calls: unknown[],
  input: unknown = { script: "hello" }
): WorkflowNodeExecutionRepository {
  return {
    findNodeForExecution: async () => ({
      id: "node-1",
      input,
    }),
    markRunning: async (nodeId, startedAt) => {
      calls.push({ markRunning: { nodeId, startedAt } });
    },
    markSucceeded: async (nodeId, output, finishedAt) => {
      calls.push({ markSucceeded: { nodeId, output, finishedAt } });
    },
    markWaitingApproval: async (nodeId, output, requiresApproval, finishedAt) => {
      calls.push({ markWaitingApproval: { nodeId, output, requiresApproval, finishedAt } });
    },
    markFailed: async (nodeId, error, finishedAt) => {
      calls.push({ markFailed: { nodeId, error, finishedAt } });
    },
  };
}
