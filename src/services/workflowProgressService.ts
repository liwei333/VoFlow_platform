import { prisma } from "@/lib/db";
import {
  DEFAULT_WORKFLOW_TEMPLATE,
  WORKFLOW_NODE_DEFINITIONS,
  isWorkflowNodeType,
  type WorkflowNodeType,
} from "@/lib/workflow/constants";
import {
  WORKFLOW_NODE_STATUS,
  type WorkflowNodeStatus,
} from "@/lib/workflow/status";
import {
  WORKFLOW_ERROR_CODES,
  workflowError,
  type WorkflowError,
} from "@/lib/workflow/errors";

export interface WorkflowProgressNodeError {
  code: string;
  message: string;
}

export interface WorkflowProgressNode {
  id: string;
  nodeType: WorkflowNodeType;
  status: WorkflowNodeStatus;
  error: WorkflowProgressNodeError | null;
}

export interface WorkflowProgressSnapshot {
  progress: number;
  currentNode: WorkflowNodeType | null;
  errorCode: string | null;
  errorMessage: string | null;
}

export interface WorkflowJobProgressRecord extends WorkflowProgressSnapshot {
  id: string;
}

export interface WorkflowProgressJobSnapshot {
  id: string;
  nodes: WorkflowProgressNode[];
}

export interface WorkflowProgressRepository {
  findJobProgressSnapshot(
    jobId: string
  ): Promise<WorkflowProgressJobSnapshot | null>;
  updateJobProgress(
    jobId: string,
    data: WorkflowProgressSnapshot
  ): Promise<WorkflowJobProgressRecord>;
}

export interface SyncWorkflowJobProgressInput {
  jobId: string;
}

export interface SyncWorkflowJobProgressDependencies {
  repository: WorkflowProgressRepository;
}

export type SyncWorkflowJobProgressResult =
  | { success: true; data: WorkflowJobProgressRecord }
  | { success: false; error: WorkflowError };

const COMPLETED_WORKFLOW_NODE_STATUSES: readonly WorkflowNodeStatus[] = [
  WORKFLOW_NODE_STATUS.SUCCEEDED,
  WORKFLOW_NODE_STATUS.APPROVED,
];

const prismaWorkflowProgressRepository: WorkflowProgressRepository = {
  async findJobProgressSnapshot(jobId) {
    const job = await prisma.videoJob.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        nodes: {
          select: {
            id: true,
            nodeType: true,
            status: true,
            error: true,
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!job) {
      return null;
    }

    return {
      id: job.id,
      nodes: job.nodes
        .filter((node) => isWorkflowNodeType(node.nodeType))
        .map((node) => ({
          id: node.id,
          nodeType: node.nodeType as WorkflowNodeType,
          status: node.status,
          error: normalizeWorkflowNodeError(node.error),
        })),
    };
  },

  async updateJobProgress(jobId, data) {
    const job = await prisma.videoJob.update({
      where: { id: jobId },
      data,
      select: {
        id: true,
        progress: true,
        currentNode: true,
        errorCode: true,
        errorMessage: true,
      },
    });

    return {
      id: job.id,
      progress: job.progress,
      currentNode: isWorkflowNodeType(job.currentNode) ? job.currentNode : null,
      errorCode: job.errorCode,
      errorMessage: job.errorMessage,
    };
  },
};

const defaultSyncWorkflowJobProgressDependencies: SyncWorkflowJobProgressDependencies = {
  repository: prismaWorkflowProgressRepository,
};

export function calculateWorkflowProgress(
  nodes: WorkflowProgressNode[]
): WorkflowProgressSnapshot {
  const sortedNodes = sortWorkflowProgressNodes(nodes);
  const totalWeight = DEFAULT_WORKFLOW_TEMPLATE.reduce(
    (sum, nodeType) => sum + WORKFLOW_NODE_DEFINITIONS[nodeType].progressWeight,
    0
  );
  const completedWeight = sortedNodes.reduce((sum, node) => {
    if (!COMPLETED_WORKFLOW_NODE_STATUSES.includes(node.status)) {
      return sum;
    }

    return sum + WORKFLOW_NODE_DEFINITIONS[node.nodeType].progressWeight;
  }, 0);
  const failedNode = sortedNodes.find(
    (node) => node.status === WORKFLOW_NODE_STATUS.FAILED
  );

  return {
    progress: totalWeight === 0 ? 0 : Math.floor((completedWeight / totalWeight) * 100),
    currentNode: sortedNodes.find(
      (node) => !COMPLETED_WORKFLOW_NODE_STATUSES.includes(node.status)
    )?.nodeType ?? null,
    errorCode: failedNode?.error?.code ?? null,
    errorMessage: failedNode?.error?.message ?? null,
  };
}

export async function syncWorkflowJobProgress(
  input: SyncWorkflowJobProgressInput,
  dependencies: Partial<SyncWorkflowJobProgressDependencies> = {}
): Promise<SyncWorkflowJobProgressResult> {
  const { repository } = {
    ...defaultSyncWorkflowJobProgressDependencies,
    ...dependencies,
  };

  const job = await repository.findJobProgressSnapshot(input.jobId);

  if (!job) {
    return {
      success: false,
      error: workflowError(WORKFLOW_ERROR_CODES.WORKFLOW_JOB_NOT_FOUND),
    };
  }

  const progress = calculateWorkflowProgress(job.nodes);
  const updatedJob = await repository.updateJobProgress(input.jobId, progress);

  return {
    success: true,
    data: updatedJob,
  };
}

function sortWorkflowProgressNodes(
  nodes: WorkflowProgressNode[]
): WorkflowProgressNode[] {
  return [...nodes].sort(
    (left, right) =>
      WORKFLOW_NODE_DEFINITIONS[left.nodeType].order -
      WORKFLOW_NODE_DEFINITIONS[right.nodeType].order
  );
}

function normalizeWorkflowNodeError(value: unknown): WorkflowProgressNodeError | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const error = value as Record<string, unknown>;

  if (typeof error.code !== "string" || typeof error.message !== "string") {
    return null;
  }

  return {
    code: error.code,
    message: error.message,
  };
}
