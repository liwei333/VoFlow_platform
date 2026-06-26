import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  EDITING_ERROR_CODES,
  EDITING_ERROR_MESSAGES,
  EDITING_PREVIEW_NODE_TYPE,
} from "@/lib/editing/constants";
import { workflowQueue, type WorkflowQueueEnqueuer } from "@/lib/queue/adapter";
import { createWorkflowTraceId } from "@/lib/workflow/trace";

export type CreateEditingPreviewTaskInput = {
  jobId: string;
  teamId: string;
};

export type CreateEditingPreviewTaskDependencies = {
  queue: Pick<WorkflowQueueEnqueuer, "enqueue">;
  createTraceId: () => string;
};

export type CreateEditingPreviewTaskResult =
  | {
      success: true;
      data: {
        node: {
          id: string;
          jobId: string;
          nodeType: typeof EDITING_PREVIEW_NODE_TYPE;
          status: string;
          version: number;
          input: unknown;
        };
      };
    }
  | {
      success: false;
      error: {
        code: typeof EDITING_ERROR_CODES.jobNotFound | typeof EDITING_ERROR_CODES.previewFailed;
        message: string;
      };
    };

const defaultCreateEditingPreviewTaskDependencies: CreateEditingPreviewTaskDependencies = {
  queue: workflowQueue,
  createTraceId: createWorkflowTraceId,
};

export async function createEditingPreviewTask(
  input: CreateEditingPreviewTaskInput,
  dependencies: Partial<CreateEditingPreviewTaskDependencies> = {}
): Promise<CreateEditingPreviewTaskResult> {
  const job = await prisma.videoJob.findFirst({
    where: {
      id: input.jobId,
      teamId: input.teamId,
      status: { not: "cancelled" },
    },
    select: {
      id: true,
      editingConfig: {
        select: {
          id: true,
        },
      },
    },
  });

  if (!job) {
    return editingPreviewTaskError(EDITING_ERROR_CODES.jobNotFound);
  }

  if (!job.editingConfig) {
    return editingPreviewTaskError(EDITING_ERROR_CODES.previewFailed);
  }

  const { queue, createTraceId } = {
    ...defaultCreateEditingPreviewTaskDependencies,
    ...dependencies,
  };
  const nodeInput = {
    editingConfigId: job.editingConfig.id,
    previewType: "lightweight_config",
  };

  const node = await prisma.$transaction(async (tx) => {
    const maxVersion = await tx.workflowNode.aggregate({
      where: {
        jobId: input.jobId,
        nodeType: EDITING_PREVIEW_NODE_TYPE,
      },
      _max: {
        version: true,
      },
    });
    const version = (maxVersion._max.version ?? 0) + 1;

    const created = await tx.workflowNode.create({
      data: {
        jobId: input.jobId,
        nodeType: EDITING_PREVIEW_NODE_TYPE,
        status: "queued",
        version,
        input: nodeInput as Prisma.InputJsonObject,
        requiresApproval: true,
      },
      select: {
        id: true,
        jobId: true,
        nodeType: true,
        status: true,
        version: true,
        input: true,
      },
    });

    await tx.videoJob.update({
      where: {
        id: input.jobId,
      },
      data: {
        status: "queued",
        currentNode: EDITING_PREVIEW_NODE_TYPE,
      },
    });

    return created;
  });

  await queue.enqueue({
    jobId: input.jobId,
    nodeId: node.id,
    nodeType: EDITING_PREVIEW_NODE_TYPE,
    version: node.version,
    traceId: createTraceId(),
  });

  return {
    success: true,
    data: {
      node: {
        ...node,
        nodeType: EDITING_PREVIEW_NODE_TYPE,
      },
    },
  };
}

function editingPreviewTaskError(
  code: typeof EDITING_ERROR_CODES.jobNotFound | typeof EDITING_ERROR_CODES.previewFailed
): Extract<CreateEditingPreviewTaskResult, { success: false }> {
  return {
    success: false,
    error: {
      code,
      message: EDITING_ERROR_MESSAGES[code],
    },
  };
}
