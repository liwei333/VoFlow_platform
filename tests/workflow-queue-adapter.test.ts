import { describe, expect, it } from "vitest";
import {
  MemoryWorkflowQueue,
  WORKFLOW_QUEUE_ERROR_CODES,
  WORKFLOW_QUEUE_ERROR_MESSAGES,
  WorkflowQueueDeliveryError,
  type WorkflowQueuePayload,
} from "@/lib/queue/adapter";

const basePayload: WorkflowQueuePayload = {
  jobId: "job-1",
  nodeId: "node-1",
  nodeType: "reference_extract",
  version: 1,
  traceId: "trace-1",
};

describe("MemoryWorkflowQueue", () => {
  it("enqueues the unified workflow payload", async () => {
    const queue = new MemoryWorkflowQueue();

    await queue.enqueue(basePayload);

    expect(queue.getQueue()).toEqual([basePayload]);
    expect(Object.keys(queue.getQueue()[0]).sort()).toEqual([
      "jobId",
      "nodeId",
      "nodeType",
      "traceId",
      "version",
    ]);
  });

  it("returns a queue snapshot instead of exposing mutable internal state", async () => {
    const queue = new MemoryWorkflowQueue();
    await queue.enqueue(basePayload);

    const snapshot = queue.getQueue();
    snapshot.push({ ...basePayload, jobId: "mutated-job" });

    expect(queue.getQueue()).toEqual([basePayload]);
  });

  it("retries by delivering the caller-provided workflow payload", async () => {
    const queue = new MemoryWorkflowQueue();
    const retryPayload: WorkflowQueuePayload = {
      ...basePayload,
      version: 2,
      traceId: "trace-retry-1",
    };

    await queue.retry(retryPayload);

    expect(queue.getQueue()).toEqual([retryPayload]);
  });

  it("cancels queued payloads for one job without removing other jobs", async () => {
    const queue = new MemoryWorkflowQueue();
    const sameJobPayload: WorkflowQueuePayload = {
      ...basePayload,
      nodeId: "node-2",
      nodeType: "script_prepare",
      traceId: "trace-2",
    };
    const otherJobPayload: WorkflowQueuePayload = {
      ...basePayload,
      jobId: "job-2",
      nodeId: "node-3",
      nodeType: "script_rewrite",
      traceId: "trace-3",
    };

    await queue.enqueue(basePayload);
    await queue.retry(sameJobPayload);
    await queue.enqueue(otherJobPayload);
    await queue.cancel("job-1");

    expect(queue.getQueue()).toEqual([otherJobPayload]);
  });

  it("wraps transport delivery failures in a workflow queue error", async () => {
    const queue = new MemoryWorkflowQueue({
      deliver: async () => {
        throw new Error("broker unavailable");
      },
    });

    await expect(queue.enqueue(basePayload)).rejects.toMatchObject({
      code: WORKFLOW_QUEUE_ERROR_CODES.DELIVERY_FAILED,
      message: WORKFLOW_QUEUE_ERROR_MESSAGES.DELIVERY_FAILED,
    });
    await expect(queue.enqueue(basePayload)).rejects.toBeInstanceOf(
      WorkflowQueueDeliveryError
    );
    expect(queue.getQueue()).toEqual([]);
  });
});
