import type { ExportOutputProfile, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  EXPORT_ARTIFACT_TYPES,
  EXPORT_ERROR_CODES,
  EXPORT_ERROR_MESSAGES,
  EXPORT_WORKFLOW_NODE_TYPES,
} from "@/lib/export/constants";
import { workflowQueue, type WorkflowQueueEnqueuer } from "@/lib/queue/adapter";
import { createWorkflowTraceId } from "@/lib/workflow/trace";
import { resolveExportBgmAsset } from "@/services/exportBgmService";

export interface CreateFinalExportTaskInput {
  jobId: string;
  teamId: string;
  outputProfile: ExportOutputProfile;
  bgmAssetId?: string | null;
  coverArtifactId?: string | null;
}

export interface CreateFinalExportTaskDependencies {
  queue: Pick<WorkflowQueueEnqueuer, "enqueue">;
  createTraceId: () => string;
}

export type CreateFinalExportTaskResult =
  | {
      success: true;
      data: {
        exportRequest: {
          id: string;
          jobId: string;
          nodeId: string;
          avatarVideoArtifactId: string;
          audioArtifactId: string;
          editingConfigId: string;
          subtitleArtifactId: string | null;
          bgmAssetId: string | null;
          coverArtifactId: string | null;
          outputProfile: ExportOutputProfile;
          status: string;
        };
        node: {
          id: string;
          jobId: string;
          nodeType: typeof EXPORT_WORKFLOW_NODE_TYPES.finalExport;
          status: string;
          version: number;
          input: unknown;
        };
      };
    }
  | {
      success: false;
      error: {
        code:
          | typeof EXPORT_ERROR_CODES.exportJobNotFound
          | typeof EXPORT_ERROR_CODES.exportInputNotReady
          | typeof EXPORT_ERROR_CODES.bgmAssetNotFound
          | typeof EXPORT_ERROR_CODES.bgmAssetTypeUnsupported
          | typeof EXPORT_ERROR_CODES.bgmLicenseNotApproved;
        message: string;
      };
    };

const defaultCreateFinalExportTaskDependencies: CreateFinalExportTaskDependencies = {
  queue: workflowQueue,
  createTraceId: createWorkflowTraceId,
};

export async function createFinalExportTask(
  input: CreateFinalExportTaskInput,
  dependencies: Partial<CreateFinalExportTaskDependencies> = {}
): Promise<CreateFinalExportTaskResult> {
  const job = await prisma.videoJob.findFirst({
    where: {
      id: input.jobId,
      teamId: input.teamId,
      status: {
        not: "cancelled",
      },
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
    return exportTaskError(EXPORT_ERROR_CODES.exportJobNotFound);
  }

  if (!job.editingConfig) {
    return exportTaskError(EXPORT_ERROR_CODES.exportInputNotReady);
  }
  const editingConfigId = job.editingConfig.id;

  const bgmResult = await resolveExportBgmAsset({
    teamId: input.teamId,
    bgmAssetId: input.bgmAssetId,
  });
  if (!bgmResult.success) {
    return bgmResult;
  }

  const { queue, createTraceId } = {
    ...defaultCreateFinalExportTaskDependencies,
    ...dependencies,
  };

  const created = await prisma.$transaction(async (tx) => {
    const avatarVideoArtifact = await findLatestArtifact(tx, input.jobId, "avatar_video");
    const audioArtifact =
      (await findLatestArtifact(tx, input.jobId, EXPORT_ARTIFACT_TYPES.mixedAudio)) ??
      (await findLatestTtsAudioArtifact(tx, input.jobId));
    const subtitleArtifact = await findLatestArtifact(
      tx,
      input.jobId,
      EXPORT_ARTIFACT_TYPES.subtitle
    );
    const coverArtifactId =
      input.coverArtifactId ??
      (await findLatestArtifact(tx, input.jobId, EXPORT_ARTIFACT_TYPES.cover))?.id ??
      null;

    if (!avatarVideoArtifact || !audioArtifact || !subtitleArtifact) {
      return null;
    }

    const maxVersion = await tx.workflowNode.aggregate({
      where: {
        jobId: input.jobId,
        nodeType: EXPORT_WORKFLOW_NODE_TYPES.finalExport,
      },
      _max: {
        version: true,
      },
    });
    const version = (maxVersion._max.version ?? 0) + 1;
    const node = await tx.workflowNode.create({
      data: {
        jobId: input.jobId,
        nodeType: EXPORT_WORKFLOW_NODE_TYPES.finalExport,
        status: "queued",
        version,
        input: {},
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
    const exportRequest = await tx.exportRequest.create({
      data: {
        jobId: input.jobId,
        nodeId: node.id,
        avatarVideoArtifactId: avatarVideoArtifact.id,
        audioArtifactId: audioArtifact.id,
        editingConfigId,
        subtitleArtifactId: subtitleArtifact.id,
        bgmAssetId: bgmResult.data.bgmAsset?.id ?? null,
        coverArtifactId,
        outputProfile: input.outputProfile,
        status: "queued",
      },
      select: {
        id: true,
        jobId: true,
        nodeId: true,
        avatarVideoArtifactId: true,
        audioArtifactId: true,
        editingConfigId: true,
        subtitleArtifactId: true,
        bgmAssetId: true,
        coverArtifactId: true,
        outputProfile: true,
        status: true,
      },
    });
    const nodeInput = {
      exportRequestId: exportRequest.id,
      outputProfile: input.outputProfile,
    };
    const updatedNode = await tx.workflowNode.update({
      where: {
        id: node.id,
      },
      data: {
        input: nodeInput as Prisma.InputJsonObject,
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
        currentNode: EXPORT_WORKFLOW_NODE_TYPES.finalExport,
      },
    });

    return {
      exportRequest,
      node: updatedNode,
    };
  });

  if (!created) {
    return exportTaskError(EXPORT_ERROR_CODES.exportInputNotReady);
  }

  await queue.enqueue({
    jobId: input.jobId,
    nodeId: created.node.id,
    nodeType: EXPORT_WORKFLOW_NODE_TYPES.finalExport,
    version: created.node.version,
    traceId: createTraceId(),
  });

  return {
    success: true,
    data: {
      exportRequest: created.exportRequest,
      node: {
        ...created.node,
        nodeType: EXPORT_WORKFLOW_NODE_TYPES.finalExport,
      },
    },
  };
}

function exportTaskError(
  code:
    | typeof EXPORT_ERROR_CODES.exportJobNotFound
    | typeof EXPORT_ERROR_CODES.exportInputNotReady
): Extract<CreateFinalExportTaskResult, { success: false }> {
  return {
    success: false,
    error: {
      code,
      message: EXPORT_ERROR_MESSAGES[code],
    },
  };
}

async function findLatestArtifact(
  tx: Prisma.TransactionClient,
  jobId: string,
  type: string
) {
  return tx.artifact.findFirst({
    where: {
      jobId,
      type,
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
    },
  });
}

async function findLatestTtsAudioArtifact(
  tx: Prisma.TransactionClient,
  jobId: string
) {
  const request = await tx.ttsRequest.findFirst({
    where: {
      jobId,
      status: "succeeded",
      audioArtifactId: {
        not: null,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      audioArtifact: {
        select: {
          id: true,
        },
      },
    },
  });

  return request?.audioArtifact ?? null;
}
