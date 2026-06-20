import { describe, expect, it } from "vitest";
import type { WorkflowQueuePayload } from "@/lib/queue/adapter";
import {
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

function createExecutionRepository(calls: unknown[]): WorkflowNodeExecutionRepository {
  return {
    findNodeForExecution: async () => ({
      id: "node-1",
      input: { script: "hello" },
    }),
    markRunning: async (nodeId, startedAt) => {
      calls.push({ markRunning: { nodeId, startedAt } });
    },
    markSucceeded: async (nodeId, output, finishedAt) => {
      calls.push({ markSucceeded: { nodeId, output, finishedAt } });
    },
    markFailed: async (nodeId, error, finishedAt) => {
      calls.push({ markFailed: { nodeId, error, finishedAt } });
    },
  };
}
