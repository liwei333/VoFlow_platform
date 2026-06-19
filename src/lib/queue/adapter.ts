import type { WorkflowNodeType } from "@/lib/workflow/constants";

export interface WorkflowQueuePayload {
  jobId: string;
  nodeId: string;
  nodeType: WorkflowNodeType;
  version: number;
  traceId: string;
}

export interface WorkflowQueue {
  enqueue(payload: WorkflowQueuePayload): Promise<void>;
}

export class MemoryWorkflowQueue implements WorkflowQueue {
  private queue: WorkflowQueuePayload[] = [];

  async enqueue(payload: WorkflowQueuePayload): Promise<void> {
    this.queue.push(payload);
  }

  getQueue(): WorkflowQueuePayload[] {
    return [...this.queue];
  }

  clear(): void {
    this.queue = [];
  }
}

export const workflowQueue: WorkflowQueue = new MemoryWorkflowQueue();
