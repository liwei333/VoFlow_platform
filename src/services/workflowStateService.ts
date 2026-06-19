import { prisma } from "@/lib/db";
import {
  WORKFLOW_NODE_STATUS,
  isWorkflowNodeStatusTransitionAllowed,
  type WorkflowNodeStatus,
} from "@/lib/workflow/status";
import {
  WORKFLOW_ERROR_CODES,
  workflowError,
  type WorkflowError,
} from "@/lib/workflow/errors";

export interface WorkflowNodeStateRecord {
  id: string;
  status: WorkflowNodeStatus;
  requiresApproval: boolean;
}

export interface WorkflowNodeStateUpdate {
  status: WorkflowNodeStatus;
  startedAt?: Date;
  finishedAt?: Date;
}

export interface WorkflowNodeStateRepository {
  findNodeById(nodeId: string): Promise<WorkflowNodeStateRecord | null>;
  updateNodeState(
    nodeId: string,
    data: WorkflowNodeStateUpdate
  ): Promise<WorkflowNodeStateRecord>;
}

export interface TransitionWorkflowNodeStatusInput {
  nodeId: string;
  toStatus: WorkflowNodeStatus;
}

export interface TransitionWorkflowNodeStatusDependencies {
  repository: WorkflowNodeStateRepository;
  now: () => Date;
}

export type TransitionWorkflowNodeStatusResult =
  | { success: true; data: WorkflowNodeStateRecord }
  | { success: false; error: WorkflowError };

const prismaWorkflowNodeStateRepository: WorkflowNodeStateRepository = {
  async findNodeById(nodeId) {
    const node = await prisma.workflowNode.findUnique({
      where: { id: nodeId },
      select: {
        id: true,
        status: true,
        requiresApproval: true,
      },
    });

    if (!node) {
      return null;
    }

    return {
      id: node.id,
      status: node.status,
      requiresApproval: node.requiresApproval,
    };
  },

  async updateNodeState(nodeId, data) {
    const node = await prisma.workflowNode.update({
      where: { id: nodeId },
      data,
      select: {
        id: true,
        status: true,
        requiresApproval: true,
      },
    });

    return {
      id: node.id,
      status: node.status,
      requiresApproval: node.requiresApproval,
    };
  },
};

const defaultTransitionWorkflowNodeStatusDependencies: TransitionWorkflowNodeStatusDependencies = {
  repository: prismaWorkflowNodeStateRepository,
  now: () => new Date(),
};

export async function transitionWorkflowNodeStatus(
  input: TransitionWorkflowNodeStatusInput,
  dependencies: Partial<TransitionWorkflowNodeStatusDependencies> = {}
): Promise<TransitionWorkflowNodeStatusResult> {
  const { repository, now } = {
    ...defaultTransitionWorkflowNodeStatusDependencies,
    ...dependencies,
  };

  const node = await repository.findNodeById(input.nodeId);

  if (!node) {
    return {
      success: false,
      error: workflowError(WORKFLOW_ERROR_CODES.WORKFLOW_NODE_NOT_FOUND),
    };
  }

  if (
    !isWorkflowNodeStatusTransitionAllowed({
      from: node.status,
      to: input.toStatus,
      requiresApproval: node.requiresApproval,
    })
  ) {
    return {
      success: false,
      error: workflowError(WORKFLOW_ERROR_CODES.WORKFLOW_NODE_INVALID_TRANSITION),
    };
  }

  const updatedNode = await repository.updateNodeState(
    input.nodeId,
    createWorkflowNodeStateUpdate(input.toStatus, now())
  );

  return {
    success: true,
    data: updatedNode,
  };
}

function createWorkflowNodeStateUpdate(
  status: WorkflowNodeStatus,
  now: Date
): WorkflowNodeStateUpdate {
  if (status === WORKFLOW_NODE_STATUS.RUNNING) {
    return { status, startedAt: now };
  }

  if (
    status === WORKFLOW_NODE_STATUS.SUCCEEDED ||
    status === WORKFLOW_NODE_STATUS.FAILED
  ) {
    return { status, finishedAt: now };
  }

  return { status };
}
