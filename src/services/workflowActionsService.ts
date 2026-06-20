import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { workflowQueue, type WorkflowQueue } from "@/lib/queue/adapter";
import {
  DEFAULT_WORKFLOW_TEMPLATE,
  WORKFLOW_NODE_DEFINITIONS,
  isWorkflowNodeType,
  type WorkflowNodeType,
} from "@/lib/workflow/constants";
import {
  WORKFLOW_ERROR_CODES,
  workflowError,
  type WorkflowError,
} from "@/lib/workflow/errors";
import { WORKFLOW_NODE_STATUS } from "@/lib/workflow/status";
import { createWorkflowTraceId } from "@/lib/workflow/trace";

export interface WorkflowActionInput {
  jobId: string;
  nodeId?: string;
  teamId: string;
  userId?: string;
}

export interface WorkflowActionNode {
  id: string;
  jobId: string;
  nodeType: string;
  status: string;
  version: number;
  input: unknown;
  retryCount: number;
  approvedByUserId: string | null;
  approvedAt: Date | null;
}

export interface WorkflowActionJob {
  id: string;
  status: string;
}

export type WorkflowNodeActionInput = WorkflowActionInput & { nodeId: string };
export type WorkflowApprovalActionInput = WorkflowNodeActionInput & { userId: string };

export interface WorkflowActionsDependencies {
  queue: WorkflowQueue;
  createTraceId: () => string;
  now: () => Date;
}

export type WorkflowActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: WorkflowError };

const defaultWorkflowActionsDependencies: WorkflowActionsDependencies = {
  queue: workflowQueue,
  createTraceId: createWorkflowTraceId,
  now: () => new Date(),
};

const FINISHED_NODE_STATUSES = [
  WORKFLOW_NODE_STATUS.SUCCEEDED,
  WORKFLOW_NODE_STATUS.APPROVED,
  WORKFLOW_NODE_STATUS.CANCELLED,
] as const;

export async function retryWorkflowNode(
  input: WorkflowNodeActionInput,
  dependencies: Partial<WorkflowActionsDependencies> = {}
): Promise<WorkflowActionResult<{ node: WorkflowActionNode }>> {
  const { queue, createTraceId } = {
    ...defaultWorkflowActionsDependencies,
    ...dependencies,
  };

  const job = await prisma.videoJob.findFirst({
    where: { id: input.jobId, teamId: input.teamId },
    select: { id: true },
  });

  if (!job) {
    return { success: false, error: workflowError(WORKFLOW_ERROR_CODES.WORKFLOW_JOB_NOT_FOUND) };
  }

  const targetNode = await prisma.workflowNode.findFirst({
    where: {
      id: input.nodeId,
      jobId: input.jobId,
    },
    select: {
      id: true,
      jobId: true,
      nodeType: true,
      status: true,
      version: true,
      input: true,
      retryCount: true,
    },
  });

  if (!targetNode || !isWorkflowNodeType(targetNode.nodeType)) {
    return { success: false, error: workflowError(WORKFLOW_ERROR_CODES.WORKFLOW_NODE_NOT_FOUND) };
  }

  if (targetNode.status !== WORKFLOW_NODE_STATUS.FAILED) {
    return { success: false, error: workflowError(WORKFLOW_ERROR_CODES.WORKFLOW_NODE_NOT_FAILED) };
  }

  const targetNodeType = targetNode.nodeType;
  const definition = WORKFLOW_NODE_DEFINITIONS[targetNodeType];
  if (!definition.retryable) {
    return { success: false, error: workflowError(WORKFLOW_ERROR_CODES.WORKFLOW_NODE_NOT_RETRYABLE) };
  }

  const newNode = await prisma.$transaction(async (tx) => {
    const maxVersion = await tx.workflowNode.aggregate({
      where: {
        jobId: input.jobId,
        nodeType: targetNodeType,
      },
      _max: { version: true },
    });
    const nextVersion = (maxVersion._max.version ?? targetNode.version) + 1;

    await resetDownstreamNodes(tx, input.jobId, targetNodeType);

    await tx.videoJob.update({
      where: { id: input.jobId },
      data: {
        status: "queued",
        currentNode: targetNodeType,
        errorCode: null,
        errorMessage: null,
      },
    });

    return tx.workflowNode.create({
      data: {
        jobId: input.jobId,
        nodeType: targetNodeType,
        status: WORKFLOW_NODE_STATUS.QUEUED,
        version: nextVersion,
        input: targetNode.input ?? Prisma.JsonNull,
        retryCount: targetNode.retryCount + 1,
        requiresApproval: definition.requiresApproval,
      },
      select: workflowActionNodeSelect,
    });
  });

  await queue.retry({
    jobId: input.jobId,
    nodeId: newNode.id,
    nodeType: targetNodeType,
    version: newNode.version,
    traceId: createTraceId(),
  });

  return { success: true, data: { node: newNode } };
}

export async function approveWorkflowNode(
  input: WorkflowApprovalActionInput,
  dependencies: Partial<WorkflowActionsDependencies> = {}
): Promise<WorkflowActionResult<{ node: WorkflowActionNode }>> {
  const { queue, createTraceId, now } = {
    ...defaultWorkflowActionsDependencies,
    ...dependencies,
  };

  const job = await prisma.videoJob.findFirst({
    where: { id: input.jobId, teamId: input.teamId },
    select: { id: true },
  });

  if (!job) {
    return { success: false, error: workflowError(WORKFLOW_ERROR_CODES.WORKFLOW_JOB_NOT_FOUND) };
  }

  const targetNode = await prisma.workflowNode.findFirst({
    where: { id: input.nodeId, jobId: input.jobId },
    select: {
      id: true,
      jobId: true,
      nodeType: true,
      status: true,
      version: true,
      input: true,
      retryCount: true,
    },
  });

  if (!targetNode || !isWorkflowNodeType(targetNode.nodeType)) {
    return { success: false, error: workflowError(WORKFLOW_ERROR_CODES.WORKFLOW_NODE_NOT_FOUND) };
  }

  if (targetNode.status !== WORKFLOW_NODE_STATUS.WAITING_APPROVAL) {
    return {
      success: false,
      error: workflowError(WORKFLOW_ERROR_CODES.WORKFLOW_NODE_NOT_WAITING_APPROVAL),
    };
  }

  const { approvedNode, nextNode } = await prisma.$transaction(async (tx) => {
    const approved = await tx.workflowNode.update({
      where: { id: input.nodeId },
      data: {
        status: WORKFLOW_NODE_STATUS.APPROVED,
        approvedByUserId: input.userId,
        approvedAt: now(),
      },
      select: workflowActionNodeSelect,
    });

    const next = await queueNextWorkflowNode(tx, input.jobId, targetNode.nodeType);

    return { approvedNode: approved, nextNode: next };
  });

  if (nextNode && isWorkflowNodeType(nextNode.nodeType)) {
    await queue.enqueue({
      jobId: input.jobId,
      nodeId: nextNode.id,
      nodeType: nextNode.nodeType,
      version: nextNode.version,
      traceId: createTraceId(),
    });
  }

  return { success: true, data: { node: approvedNode } };
}

export async function cancelWorkflowJob(
  input: Omit<WorkflowActionInput, "nodeId">,
  dependencies: Partial<Pick<WorkflowActionsDependencies, "queue">> = {}
): Promise<WorkflowActionResult<{ job: WorkflowActionJob }>> {
  const { queue } = {
    queue: defaultWorkflowActionsDependencies.queue,
    ...dependencies,
  };

  const job = await prisma.videoJob.findFirst({
    where: { id: input.jobId, teamId: input.teamId },
    select: { id: true, status: true },
  });

  if (!job) {
    return { success: false, error: workflowError(WORKFLOW_ERROR_CODES.WORKFLOW_JOB_NOT_FOUND) };
  }

  if (job.status === "cancelled") {
    return {
      success: false,
      error: workflowError(WORKFLOW_ERROR_CODES.WORKFLOW_JOB_NOT_CANCELLABLE),
    };
  }

  const cancelledJob = await prisma.$transaction(async (tx) => {
    await tx.workflowNode.updateMany({
      where: {
        jobId: input.jobId,
        status: { notIn: [...FINISHED_NODE_STATUSES] },
      },
      data: { status: WORKFLOW_NODE_STATUS.CANCELLED },
    });

    return tx.videoJob.update({
      where: { id: input.jobId },
      data: { status: "cancelled" },
      select: { id: true, status: true },
    });
  });

  await queue.cancel(input.jobId);

  return { success: true, data: { job: cancelledJob } };
}

const workflowActionNodeSelect = {
  id: true,
  jobId: true,
  nodeType: true,
  status: true,
  version: true,
  input: true,
  retryCount: true,
  approvedByUserId: true,
  approvedAt: true,
} satisfies Prisma.WorkflowNodeSelect;

async function resetDownstreamNodes(
  tx: Prisma.TransactionClient,
  jobId: string,
  nodeType: WorkflowNodeType
) {
  const order = WORKFLOW_NODE_DEFINITIONS[nodeType].order;
  const downstreamNodeTypes = DEFAULT_WORKFLOW_TEMPLATE.filter(
    (candidate) => WORKFLOW_NODE_DEFINITIONS[candidate].order > order
  );

  if (downstreamNodeTypes.length === 0) {
    return;
  }

  await tx.workflowNode.updateMany({
    where: {
      jobId,
      nodeType: { in: downstreamNodeTypes },
      status: { notIn: [...FINISHED_NODE_STATUSES] },
    },
    data: {
      status: WORKFLOW_NODE_STATUS.PENDING,
      error: Prisma.JsonNull,
    },
  });
}

async function queueNextWorkflowNode(
  tx: Prisma.TransactionClient,
  jobId: string,
  nodeType: string
) {
  if (!isWorkflowNodeType(nodeType)) {
    return null;
  }

  const order = WORKFLOW_NODE_DEFINITIONS[nodeType].order;
  const nextNodeType = DEFAULT_WORKFLOW_TEMPLATE.find(
    (candidate) => WORKFLOW_NODE_DEFINITIONS[candidate].order > order
  );

  if (!nextNodeType) {
    await tx.videoJob.update({
      where: { id: jobId },
      data: { status: "succeeded", currentNode: null, progress: 100 },
    });
    return null;
  }

  const nextNode = await tx.workflowNode.findFirst({
    where: {
      jobId,
      nodeType: nextNodeType,
    },
    orderBy: [{ version: "desc" }, { createdAt: "desc" }],
    select: workflowActionNodeSelect,
  });

  if (!nextNode) {
    return null;
  }

  await tx.workflowNode.update({
    where: { id: nextNode.id },
    data: { status: WORKFLOW_NODE_STATUS.QUEUED },
  });
  await tx.videoJob.update({
    where: { id: jobId },
    data: { status: "queued", currentNode: nextNode.nodeType },
  });

  return { ...nextNode, status: WORKFLOW_NODE_STATUS.QUEUED };
}
