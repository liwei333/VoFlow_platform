import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { WorkflowQueuePayload } from "@/lib/queue/adapter";
import { WORKFLOW_NODE_STATUS } from "@/lib/workflow/status";

export const WORKFLOW_NODE_EXECUTION_FAILED = "WORKFLOW_NODE_EXECUTION_FAILED";

export interface WorkflowNodeExecutionRecord {
  id: string;
  input: unknown;
}

export interface WorkflowNodeExecutionError {
  code: string;
  message: string;
}

export interface WorkflowNodeExecutionRepository {
  findNodeForExecution(nodeId: string): Promise<WorkflowNodeExecutionRecord | null>;
  markRunning(nodeId: string, startedAt: Date): Promise<void>;
  markSucceeded(nodeId: string, output: unknown, finishedAt: Date): Promise<void>;
  markFailed(
    nodeId: string,
    error: WorkflowNodeExecutionError,
    finishedAt: Date
  ): Promise<void>;
}

export interface WorkflowNodeHandlerInput {
  payload: WorkflowQueuePayload;
  input: unknown;
}

export interface WorkflowNodeHandlerOutput {
  output?: unknown;
}

export type WorkflowNodeHandler = (
  input: WorkflowNodeHandlerInput
) => Promise<WorkflowNodeHandlerOutput>;

export type WorkflowNodeHandlers = Partial<Record<WorkflowQueuePayload["nodeType"], WorkflowNodeHandler>>;

export interface ExecuteWorkflowNodeDependencies {
  repository: WorkflowNodeExecutionRepository;
  handlers: WorkflowNodeHandlers;
  now: () => Date;
}

export type ExecuteWorkflowNodeResult =
  | { success: true; data: { output: unknown } }
  | { success: false; error: WorkflowNodeExecutionError };

const prismaWorkflowNodeExecutionRepository: WorkflowNodeExecutionRepository = {
  async findNodeForExecution(nodeId) {
    const node = await prisma.workflowNode.findUnique({
      where: { id: nodeId },
      select: {
        id: true,
        input: true,
      },
    });

    return node;
  },

  async markRunning(nodeId, startedAt) {
    await prisma.workflowNode.update({
      where: { id: nodeId },
      data: {
        status: WORKFLOW_NODE_STATUS.RUNNING,
        startedAt,
      },
    });
  },

  async markSucceeded(nodeId, output, finishedAt) {
    await prisma.workflowNode.update({
      where: { id: nodeId },
      data: {
        status: WORKFLOW_NODE_STATUS.SUCCEEDED,
        output: toPrismaJson(output),
        error: Prisma.JsonNull,
        finishedAt,
      },
    });
  },

  async markFailed(nodeId, error, finishedAt) {
    await prisma.workflowNode.update({
      where: { id: nodeId },
      data: {
        status: WORKFLOW_NODE_STATUS.FAILED,
        error: toPrismaJson(error),
        finishedAt,
      },
    });
  },
};

const defaultExecuteWorkflowNodeDependencies: ExecuteWorkflowNodeDependencies = {
  repository: prismaWorkflowNodeExecutionRepository,
  handlers: {},
  now: () => new Date(),
};

export async function executeWorkflowNode(
  payload: WorkflowQueuePayload,
  dependencies: Partial<ExecuteWorkflowNodeDependencies> = {}
): Promise<ExecuteWorkflowNodeResult> {
  const { repository, handlers, now } = {
    ...defaultExecuteWorkflowNodeDependencies,
    ...dependencies,
  };

  const node = await repository.findNodeForExecution(payload.nodeId);
  if (!node) {
    const error = {
      code: WORKFLOW_NODE_EXECUTION_FAILED,
      message: "工作流节点不存在",
    };
    return { success: false, error };
  }

  const handler = handlers[payload.nodeType] ?? createMockWorkflowNodeHandler(payload.nodeType);

  await repository.markRunning(payload.nodeId, now());

  try {
    const result = await handler({ payload, input: node.input });
    const output = result.output ?? {};
    await repository.markSucceeded(payload.nodeId, output, now());
    return { success: true, data: { output } };
  } catch (error) {
    const executionError = normalizeExecutionError(error);
    await repository.markFailed(payload.nodeId, executionError, now());
    return { success: false, error: executionError };
  }
}

export function createMockWorkflowNodeHandler(nodeType: WorkflowQueuePayload["nodeType"]): WorkflowNodeHandler {
  return async ({ payload }) => ({
    output: {
      nodeType,
      traceId: payload.traceId,
      mocked: true,
    },
  });
}

function normalizeExecutionError(error: unknown): WorkflowNodeExecutionError {
  return {
    code: WORKFLOW_NODE_EXECUTION_FAILED,
    message: error instanceof Error ? error.message : "节点执行失败",
  };
}

function toPrismaJson(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value === undefined || value === null) {
    return Prisma.JsonNull;
  }

  return value as Prisma.InputJsonValue;
}
