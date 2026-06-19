import { prisma } from "@/lib/db";
import {
  workflowQueue,
  type WorkflowQueueEnqueuer,
  type WorkflowQueuePayload,
} from "@/lib/queue/adapter";
import { WORKFLOW_ERROR_CODES, workflowError, type WorkflowError } from "@/lib/workflow/errors";
import { createWorkflowTraceId } from "@/lib/workflow/trace";
import {
  DEFAULT_WORKFLOW_TEMPLATE,
  WORKFLOW_NODE_DEFINITIONS,
} from "@/lib/workflow/constants";

export interface CreateVideoJobInput {
  projectId: string;
  ownerId: string;
  teamId: string;
}

export interface CreateVideoJobOutput {
  jobId: string;
  nodeIds: string[];
}

export type CreateVideoJobError = WorkflowError;

export interface CreateVideoJobDependencies {
  queue: WorkflowQueueEnqueuer;
  createTraceId: () => string;
}

export const defaultCreateVideoJobDependencies: CreateVideoJobDependencies = {
  queue: workflowQueue,
  createTraceId: createWorkflowTraceId,
};

/**
 * Create a video job with workflow nodes.
 *
 * @param input - job creation parameters
 * @returns jobId and nodeIds on success, error on failure
 */
export async function createVideoJob(
  input: CreateVideoJobInput,
  dependencies: CreateVideoJobDependencies = defaultCreateVideoJobDependencies
): Promise<{ success: true; data: CreateVideoJobOutput } | { success: false; error: CreateVideoJobError }> {
  const { projectId, ownerId, teamId } = input;
  const { queue, createTraceId } = dependencies;

  // Validate project exists and belongs to team
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { teamId: true, status: true },
  });

  if (!project) {
    return {
      success: false,
      error: workflowError(WORKFLOW_ERROR_CODES.PROJECT_NOT_FOUND),
    };
  }

  if (project.teamId !== teamId) {
    return {
      success: false,
      error: workflowError(WORKFLOW_ERROR_CODES.PROJECT_ACCESS_DENIED),
    };
  }

  if (project.status === "archived") {
    return {
      success: false,
      error: workflowError(WORKFLOW_ERROR_CODES.PROJECT_ARCHIVED),
    };
  }

  // Verify user has access to the team (member check)
  const hasTeamAccess = await prisma.teamMember.findUnique({
    where: {
      teamId_userId: {
        teamId,
        userId: ownerId,
      },
    },
  });

  if (!hasTeamAccess) {
    return {
      success: false,
      error: workflowError(WORKFLOW_ERROR_CODES.TEAM_ACCESS_DENIED),
    };
  }

  let enqueueAttempted = false;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const videoJob = await tx.videoJob.create({
        data: {
          projectId,
          teamId,
          ownerId,
          currentNode: DEFAULT_WORKFLOW_TEMPLATE[0],
        },
      });

      const nodeIds: string[] = [];

      for (const nodeType of DEFAULT_WORKFLOW_TEMPLATE) {
        const definition = WORKFLOW_NODE_DEFINITIONS[nodeType];
        const node = await tx.workflowNode.create({
          data: {
            jobId: videoJob.id,
            nodeType,
            requiresApproval: definition.requiresApproval,
          },
        });
        nodeIds.push(node.id);
      }

      const firstNodePayload: WorkflowQueuePayload = {
        jobId: videoJob.id,
        nodeId: nodeIds[0],
        nodeType: DEFAULT_WORKFLOW_TEMPLATE[0],
        version: 1,
        traceId: createTraceId(),
      };

      enqueueAttempted = true;
      await queue.enqueue(firstNodePayload);

      return { jobId: videoJob.id, nodeIds };
    });

    return {
      success: true,
      data: result,
    };
  } catch {
    return {
      success: false,
      error: workflowError(
        enqueueAttempted
          ? WORKFLOW_ERROR_CODES.ENQUEUE_FAILED
          : WORKFLOW_ERROR_CODES.INTERNAL_ERROR
      ),
    };
  }
}
