import type { WorkflowNodeType } from "@/lib/workflow/constants";

export const WORKFLOW_QUEUE_ERROR_CODES = {
  DELIVERY_FAILED: "WORKFLOW_QUEUE_DELIVERY_FAILED",
} as const;

export const WORKFLOW_QUEUE_ERROR_MESSAGES = {
  DELIVERY_FAILED: "队列投递失败",
} as const;

export type WorkflowQueueErrorCode =
  (typeof WORKFLOW_QUEUE_ERROR_CODES)[keyof typeof WORKFLOW_QUEUE_ERROR_CODES];

export interface WorkflowQueuePayload {
  jobId: string;
  nodeId: string;
  nodeType: WorkflowNodeType;
  version: number;
  traceId: string;
}

export class WorkflowQueueDeliveryError extends Error {
  readonly code: WorkflowQueueErrorCode;
  readonly cause: unknown;

  constructor(message: string, cause: unknown) {
    super(message);
    this.name = "WorkflowQueueDeliveryError";
    this.code = WORKFLOW_QUEUE_ERROR_CODES.DELIVERY_FAILED;
    this.cause = cause;
  }
}

export interface WorkflowQueueTransport {
  deliver(payload: WorkflowQueuePayload): Promise<void> | void;
  cancel?(jobId: string): Promise<void> | void;
}

export interface WorkflowQueueEnqueuer {
  enqueue(payload: WorkflowQueuePayload): Promise<void>;
}

export interface WorkflowQueue extends WorkflowQueueEnqueuer {
  retry(payload: WorkflowQueuePayload): Promise<void>;
  cancel(jobId: string): Promise<void>;
}

export class MemoryWorkflowQueue implements WorkflowQueue {
  private queue: WorkflowQueuePayload[] = [];

  constructor(private readonly transport?: WorkflowQueueTransport) {}

  async enqueue(payload: WorkflowQueuePayload): Promise<void> {
    await this.deliverPayload(payload);
  }

  async retry(payload: WorkflowQueuePayload): Promise<void> {
    await this.deliverPayload(payload);
  }

  async cancel(jobId: string): Promise<void> {
    await this.transport?.cancel?.(jobId);
    this.queue = this.queue.filter((payload) => payload.jobId !== jobId);
  }

  getQueue(): WorkflowQueuePayload[] {
    return [...this.queue];
  }

  clear(): void {
    this.queue = [];
  }

  private async deliverPayload(payload: WorkflowQueuePayload): Promise<void> {
    try {
      await this.transport?.deliver(payload);
      this.queue.push(payload);
    } catch (error) {
      throw new WorkflowQueueDeliveryError(
        WORKFLOW_QUEUE_ERROR_MESSAGES.DELIVERY_FAILED,
        error
      );
    }
  }
}

export const workflowQueue: WorkflowQueue = new MemoryWorkflowQueue();
