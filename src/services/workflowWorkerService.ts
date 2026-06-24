import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { WorkflowQueuePayload } from "@/lib/queue/adapter";
import { WORKFLOW_NODE_STATUS } from "@/lib/workflow/status";
import { createAsrWorkflowNodeHandler } from "@/services/scriptAsrWorkerService";
import { createRiskWorkflowNodeHandler } from "@/services/scriptRiskWorkerService";
import { createRewriteWorkflowNodeHandler } from "@/services/scriptRewriteWorkerService";
import { createTitleWorkflowNodeHandler } from "@/services/scriptTitleWorkerService";
import { createReferenceAsrWorkflowNodeHandler } from "@/services/referenceAsrService";
import { createReferenceStructureWorkflowNodeHandler } from "@/services/referenceStructureWorkerService";
import { createReferenceUrlImportWorkflowNodeHandler } from "@/services/referenceUrlImportWorkerService";
import { createTtsWorkflowNodeHandler } from "@/services/ttsWorkerService";
import { createVoiceCloneWorkflowNodeHandler } from "@/services/voiceCloneWorkerService";
import { createAvatarRenderWorkflowNodeHandler } from "@/services/avatarRenderWorkerService";

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
  markWaitingApproval(
    nodeId: string,
    output: unknown,
    requiresApproval: boolean,
    finishedAt: Date
  ): Promise<void>;
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
  status?: typeof WORKFLOW_NODE_STATUS.WAITING_APPROVAL;
  requiresApproval?: boolean;
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

  async markWaitingApproval(nodeId, output, requiresApproval, finishedAt) {
    await prisma.workflowNode.update({
      where: { id: nodeId },
      data: {
        status: WORKFLOW_NODE_STATUS.WAITING_APPROVAL,
        requiresApproval,
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

export function createDefaultWorkflowNodeHandlers(): WorkflowNodeHandlers {
  const referenceAsrHandler = createReferenceAsrWorkflowNodeHandler();
  const referenceStructureHandler = createReferenceStructureWorkflowNodeHandler();

  return {
    reference_url_import: createReferenceUrlImportWorkflowNodeHandler(),
    reference_extract: async (input) => {
      if (isReferenceStructureNodeInput(input.input)) {
        return referenceStructureHandler(input);
      }

      return referenceAsrHandler(input);
    },
    script_prepare: createAsrWorkflowNodeHandler(),
    script_rewrite: createRewriteWorkflowNodeHandler(),
    script_title: createTitleWorkflowNodeHandler(),
    legal_review: createRiskWorkflowNodeHandler(),
    voice_clone: createVoiceCloneWorkflowNodeHandler(),
    tts: createTtsWorkflowNodeHandler(),
    avatar_render: createAvatarRenderWorkflowNodeHandler(),
  };
}

function isReferenceStructureNodeInput(input: unknown): boolean {
  return (
    Boolean(input) &&
    typeof input === "object" &&
    !Array.isArray(input) &&
    (input as { sourceType?: unknown }).sourceType === "reference_structure"
  );
}

const defaultExecuteWorkflowNodeDependencies: ExecuteWorkflowNodeDependencies = {
  repository: prismaWorkflowNodeExecutionRepository,
  handlers: createDefaultWorkflowNodeHandlers(),
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
    if (result.status === WORKFLOW_NODE_STATUS.WAITING_APPROVAL) {
      await repository.markWaitingApproval(
        payload.nodeId,
        output,
        result.requiresApproval ?? true,
        now()
      );
      return { success: true, data: { output } };
    }

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
  if (error instanceof Error && hasErrorCode(error)) {
    const prefix = `${error.code}: `;
    return {
      code: error.code,
      message: error.message.startsWith(prefix)
        ? error.message.slice(prefix.length)
        : error.message,
    };
  }

  return {
    code: WORKFLOW_NODE_EXECUTION_FAILED,
    message: error instanceof Error ? error.message : "节点执行失败",
  };
}

function hasErrorCode(error: Error): error is Error & { code: string } {
  return "code" in error && typeof (error as { code?: unknown }).code === "string";
}

function toPrismaJson(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value === undefined || value === null) {
    return Prisma.JsonNull;
  }

  return value as Prisma.InputJsonValue;
}
