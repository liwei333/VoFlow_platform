import { AvatarStatus, LicenseStatus, Prisma } from "@prisma/client";
import type { ApiAspectRatio } from "@/lib/aspect-ratio";
import { toApiAspectRatio, toPrismaAspectRatio } from "@/lib/aspect-ratio";
import {
  AVATAR_RENDER_DEFAULT_RESOLUTIONS,
  AVATAR_RENDER_ERROR_CODES,
  AVATAR_RENDER_ERROR_MESSAGES,
  AVATAR_RENDER_MOCK_PROVIDER,
  AVATAR_RENDER_NODE_TYPE,
  type AvatarRenderCrop,
  type AvatarRenderErrorCode,
} from "@/lib/avatar-render/constants";
import { prisma } from "@/lib/db";
import { workflowQueue, type WorkflowQueueEnqueuer } from "@/lib/queue/adapter";
import { WORKFLOW_NODE_DEFINITIONS } from "@/lib/workflow/constants";
import { WORKFLOW_NODE_STATUS } from "@/lib/workflow/status";
import { createWorkflowTraceId } from "@/lib/workflow/trace";

export type ValidateAvatarRenderInput = {
  jobId: string;
  teamId: string;
  avatarId: string;
  audioArtifactId: string;
  aspectRatio: ApiAspectRatio;
};

export type ValidatedAvatarRenderInput = {
  job: {
    id: string;
    projectId: string;
    teamId: string;
    aspectRatio: ApiAspectRatio;
  };
  avatar: {
    id: string;
    sourceAssetId: string;
    sourceImageUrl: string;
  };
  audioArtifact: {
    id: string;
    type: string;
    storageUrl: string;
    metadata: unknown;
  };
};

export type ValidateAvatarRenderInputResult =
  | {
      success: true;
      data: ValidatedAvatarRenderInput;
    }
  | AvatarRenderFailure;

export type CreatePreviewAvatarRenderTaskInput = ValidateAvatarRenderInput & {
  crop: AvatarRenderCrop;
};

export type CreatePreviewAvatarRenderTaskDependencies = {
  queue: Pick<WorkflowQueueEnqueuer, "enqueue">;
  createTraceId: () => string;
};

export type CreatePreviewAvatarRenderTaskResult =
  | {
      success: true;
      data: {
        node: {
          id: string;
          jobId: string;
          nodeType: string;
          status: string;
          version: number;
          input: unknown;
          requiresApproval: boolean;
        };
        avatarRenderRequest: {
          id: string;
          jobId: string;
          nodeId: string;
          avatarId: string;
          audioArtifactId: string;
          mode: "preview";
          aspectRatio: ApiAspectRatio;
          crop: AvatarRenderCrop;
          provider: string;
          providerRequestId: string | null;
        };
      };
    }
  | AvatarRenderFailure;

export type AvatarRenderFailure = {
  success: false;
  error: {
    code: AvatarRenderErrorCode;
    message: string;
  };
};

type AvatarRenderWorkflowNodeResult = {
  id: string;
  jobId: string;
  nodeType: string;
  status: string;
  version: number;
  input: unknown;
  requiresApproval: boolean;
  approvedByUserId?: string | null;
  approvedAt?: Date | null;
};

type AvatarRenderRequestResult = {
  id: string;
  jobId: string;
  nodeId: string;
  avatarId: string;
  audioArtifactId: string;
  mode: "preview" | "hd";
  aspectRatio: ApiAspectRatio;
  crop: AvatarRenderCrop;
  provider: string;
  providerRequestId: string | null;
};

export type ApproveAvatarRenderPreviewInput = {
  jobId: string;
  teamId: string;
  userId: string;
  avatarRenderRequestId: string;
};

export type RetryAvatarRenderPreviewInput = {
  jobId: string;
  teamId: string;
  avatarRenderRequestId: string;
};

export type CreateHdAvatarRenderTaskInput = {
  jobId: string;
  teamId: string;
  previewAvatarRenderRequestId: string;
};

export type AvatarRenderPreviewActionDependencies = {
  queue: Pick<WorkflowQueueEnqueuer, "enqueue">;
  createTraceId: () => string;
  now: () => Date;
};

export type ApproveAvatarRenderPreviewResult =
  | {
      success: true;
      data: {
        previewNode: AvatarRenderWorkflowNodeResult;
        node: AvatarRenderWorkflowNodeResult;
        avatarRenderRequest: AvatarRenderRequestResult;
      };
    }
  | AvatarRenderFailure;

export type RetryAvatarRenderPreviewResult =
  | {
      success: true;
      data: {
        cancelledPreviewNode: AvatarRenderWorkflowNodeResult;
        node: AvatarRenderWorkflowNodeResult;
        avatarRenderRequest: AvatarRenderRequestResult;
      };
    }
  | AvatarRenderFailure;

export type CreateHdAvatarRenderTaskResult =
  | {
      success: true;
      data: {
        previewNode: AvatarRenderWorkflowNodeResult;
        node: AvatarRenderWorkflowNodeResult;
        avatarRenderRequest: AvatarRenderRequestResult;
      };
    }
  | AvatarRenderFailure;

const defaultCreatePreviewAvatarRenderTaskDependencies: CreatePreviewAvatarRenderTaskDependencies = {
  queue: workflowQueue,
  createTraceId: createWorkflowTraceId,
};

const defaultAvatarRenderPreviewActionDependencies: AvatarRenderPreviewActionDependencies = {
  queue: workflowQueue,
  createTraceId: createWorkflowTraceId,
  now: () => new Date(),
};

export async function validateAvatarRenderInput(
  input: ValidateAvatarRenderInput
): Promise<ValidateAvatarRenderInputResult> {
  const job = await prisma.videoJob.findFirst({
    where: {
      id: input.jobId,
      teamId: input.teamId,
      status: { not: "cancelled" },
    },
    select: {
      id: true,
      projectId: true,
      teamId: true,
      project: {
        select: {
          aspectRatio: true,
        },
      },
    },
  });

  if (!job) {
    return avatarRenderError(AVATAR_RENDER_ERROR_CODES.jobNotFound);
  }

  if (job.project.aspectRatio !== toPrismaAspectRatio(input.aspectRatio)) {
    return avatarRenderError(AVATAR_RENDER_ERROR_CODES.aspectRatioMismatch);
  }

  const avatar = await prisma.avatar.findFirst({
    where: {
      id: input.avatarId,
      teamId: input.teamId,
      deletedAt: null,
    },
    select: {
      id: true,
      status: true,
      licenseStatus: true,
      sourceAssetId: true,
      sourceAsset: {
        select: {
          storageUrl: true,
        },
      },
    },
  });

  if (!avatar || avatar.status !== AvatarStatus.ready) {
    return avatarRenderError(AVATAR_RENDER_ERROR_CODES.avatarNotReady);
  }

  if (avatar.licenseStatus !== LicenseStatus.approved) {
    return avatarRenderError(AVATAR_RENDER_ERROR_CODES.avatarLicenseNotApproved);
  }

  const ttsRequest = await prisma.ttsRequest.findFirst({
    where: {
      jobId: job.id,
      status: "succeeded",
      audioArtifactId: input.audioArtifactId,
      audioArtifact: {
        is: {
          jobId: job.id,
          type: "audio",
        },
      },
    },
    select: {
      audioArtifact: {
        select: {
          id: true,
          type: true,
          storageUrl: true,
          metadata: true,
        },
      },
    },
  });

  if (!ttsRequest?.audioArtifact) {
    return avatarRenderError(AVATAR_RENDER_ERROR_CODES.ttsAudioNotFound);
  }

  return {
    success: true,
    data: {
      job: {
        id: job.id,
        projectId: job.projectId,
        teamId: job.teamId,
        aspectRatio: toApiAspectRatio(job.project.aspectRatio),
      },
      avatar: {
        id: avatar.id,
        sourceAssetId: avatar.sourceAssetId,
        sourceImageUrl: avatar.sourceAsset.storageUrl,
      },
      audioArtifact: {
        id: ttsRequest.audioArtifact.id,
        type: ttsRequest.audioArtifact.type,
        storageUrl: ttsRequest.audioArtifact.storageUrl,
        metadata: ttsRequest.audioArtifact.metadata,
      },
    },
  };
}

export async function createPreviewAvatarRenderTask(
  input: CreatePreviewAvatarRenderTaskInput,
  dependencies: Partial<CreatePreviewAvatarRenderTaskDependencies> = {}
): Promise<CreatePreviewAvatarRenderTaskResult> {
  const validation = await validateAvatarRenderInput(input);
  if (!validation.success) {
    return validation;
  }

  const { queue, createTraceId } = {
    ...defaultCreatePreviewAvatarRenderTaskDependencies,
    ...dependencies,
  };
  const validated = validation.data;
  const renderOptions = {
    crop: input.crop,
    resolution: AVATAR_RENDER_DEFAULT_RESOLUTIONS.preview,
  };

  try {
    const result = await prisma.$transaction(async (tx) => {
      const maxVersion = await tx.workflowNode.aggregate({
        where: {
          jobId: input.jobId,
          nodeType: AVATAR_RENDER_NODE_TYPE,
        },
        _max: {
          version: true,
        },
      });
      const version = (maxVersion._max.version ?? 0) + 1;

      const node = await tx.workflowNode.create({
        data: {
          jobId: input.jobId,
          nodeType: AVATAR_RENDER_NODE_TYPE,
          status: "queued",
          version,
          input: Prisma.JsonNull,
          requiresApproval: WORKFLOW_NODE_DEFINITIONS[AVATAR_RENDER_NODE_TYPE].requiresApproval,
        },
        select: {
          id: true,
          jobId: true,
          nodeType: true,
          status: true,
          version: true,
          input: true,
          requiresApproval: true,
        },
      });

      const avatarRenderRequest = await tx.avatarRenderRequest.create({
        data: {
          jobId: input.jobId,
          nodeId: node.id,
          avatarId: input.avatarId,
          audioArtifactId: input.audioArtifactId,
          mode: "preview",
          aspectRatio: toPrismaAspectRatio(input.aspectRatio),
          crop: input.crop,
          provider: AVATAR_RENDER_MOCK_PROVIDER,
        },
        select: {
          id: true,
          jobId: true,
          nodeId: true,
          avatarId: true,
          audioArtifactId: true,
          mode: true,
          aspectRatio: true,
          crop: true,
          provider: true,
          providerRequestId: true,
        },
      });

      const nodeInput = {
        avatarRenderRequestId: avatarRenderRequest.id,
        avatarId: validated.avatar.id,
        audioArtifactId: validated.audioArtifact.id,
        mode: "preview",
        aspectRatio: validated.job.aspectRatio,
        sourceImageUrl: validated.avatar.sourceImageUrl,
        audioUrl: validated.audioArtifact.storageUrl,
        renderOptions,
      };
      const updatedNode = await tx.workflowNode.update({
        where: {
          id: node.id,
        },
        data: {
          input: toPrismaJson(nodeInput),
        },
        select: {
          id: true,
          jobId: true,
          nodeType: true,
          status: true,
          version: true,
          input: true,
          requiresApproval: true,
        },
      });

      await tx.videoJob.update({
        where: {
          id: input.jobId,
        },
        data: {
          status: "queued",
          currentNode: AVATAR_RENDER_NODE_TYPE,
        },
      });

      return {
        node: updatedNode,
        avatarRenderRequest: {
          id: avatarRenderRequest.id,
          jobId: avatarRenderRequest.jobId,
          nodeId: avatarRenderRequest.nodeId,
          avatarId: avatarRenderRequest.avatarId,
          audioArtifactId: avatarRenderRequest.audioArtifactId,
          mode: "preview" as const,
          aspectRatio: toApiAspectRatio(avatarRenderRequest.aspectRatio),
          crop: avatarRenderRequest.crop,
          provider: avatarRenderRequest.provider,
          providerRequestId: avatarRenderRequest.providerRequestId,
        },
      };
    });

    await queue.enqueue({
      jobId: input.jobId,
      nodeId: result.node.id,
      nodeType: AVATAR_RENDER_NODE_TYPE,
      version: result.node.version,
      traceId: createTraceId(),
    });

    return {
      success: true,
      data: result,
    };
  } catch {
    return avatarRenderError(AVATAR_RENDER_ERROR_CODES.taskCreateFailed);
  }
}

export async function approveAvatarRenderPreview(
  input: ApproveAvatarRenderPreviewInput,
  dependencies: Partial<AvatarRenderPreviewActionDependencies> = {}
): Promise<ApproveAvatarRenderPreviewResult> {
  const { queue, createTraceId, now } = {
    ...defaultAvatarRenderPreviewActionDependencies,
    ...dependencies,
  };

  const preview = await readPreviewRenderRequest(input.jobId, input.teamId, input.avatarRenderRequestId);
  if (!preview) {
    return avatarRenderError(AVATAR_RENDER_ERROR_CODES.renderRequestNotFound);
  }

  if (preview.node.status !== WORKFLOW_NODE_STATUS.WAITING_APPROVAL) {
    return avatarRenderError(AVATAR_RENDER_ERROR_CODES.previewNotWaitingApproval);
  }

  const renderOptions = {
    crop: preview.crop,
    resolution: AVATAR_RENDER_DEFAULT_RESOLUTIONS.hd,
  };
  const aspectRatio = toApiAspectRatio(preview.aspectRatio);

  const result = await prisma.$transaction(async (tx) => {
    const previewNode = await tx.workflowNode.update({
      where: { id: preview.nodeId },
      data: {
        status: WORKFLOW_NODE_STATUS.APPROVED,
        approvedByUserId: input.userId,
        approvedAt: now(),
      },
      select: avatarRenderWorkflowNodeSelect,
    });

    const { node, avatarRenderRequest } = await createAvatarRenderRequestWithNode(tx, {
      jobId: preview.jobId,
      avatarId: preview.avatarId,
      audioArtifactId: preview.audioArtifactId,
      mode: "hd",
      aspectRatio,
      crop: preview.crop,
      provider: preview.provider,
      sourceImageUrl: preview.avatar.sourceAsset.storageUrl,
      audioUrl: preview.audioArtifact.storageUrl,
      renderOptions,
    });

    await tx.videoJob.update({
      where: { id: preview.jobId },
      data: {
        status: "queued",
        currentNode: AVATAR_RENDER_NODE_TYPE,
      },
    });

    return {
      previewNode,
      node,
      avatarRenderRequest,
    };
  });

  await queue.enqueue({
    jobId: input.jobId,
    nodeId: result.node.id,
    nodeType: AVATAR_RENDER_NODE_TYPE,
    version: result.node.version,
    traceId: createTraceId(),
  });

  return {
    success: true,
    data: result,
  };
}

export async function retryAvatarRenderPreview(
  input: RetryAvatarRenderPreviewInput,
  dependencies: Partial<AvatarRenderPreviewActionDependencies> = {}
): Promise<RetryAvatarRenderPreviewResult> {
  const { queue, createTraceId } = {
    ...defaultAvatarRenderPreviewActionDependencies,
    ...dependencies,
  };

  const preview = await readPreviewRenderRequest(input.jobId, input.teamId, input.avatarRenderRequestId);
  if (!preview) {
    return avatarRenderError(AVATAR_RENDER_ERROR_CODES.renderRequestNotFound);
  }

  if (preview.node.status !== WORKFLOW_NODE_STATUS.WAITING_APPROVAL) {
    return avatarRenderError(AVATAR_RENDER_ERROR_CODES.previewNotWaitingApproval);
  }

  const renderOptions = {
    crop: preview.crop,
    resolution: AVATAR_RENDER_DEFAULT_RESOLUTIONS.preview,
  };
  const aspectRatio = toApiAspectRatio(preview.aspectRatio);

  const result = await prisma.$transaction(async (tx) => {
    const cancelledPreviewNode = await tx.workflowNode.update({
      where: { id: preview.nodeId },
      data: {
        status: WORKFLOW_NODE_STATUS.CANCELLED,
      },
      select: avatarRenderWorkflowNodeSelect,
    });

    const { node, avatarRenderRequest } = await createAvatarRenderRequestWithNode(tx, {
      jobId: preview.jobId,
      avatarId: preview.avatarId,
      audioArtifactId: preview.audioArtifactId,
      mode: "preview",
      aspectRatio,
      crop: preview.crop,
      provider: preview.provider,
      sourceImageUrl: preview.avatar.sourceAsset.storageUrl,
      audioUrl: preview.audioArtifact.storageUrl,
      renderOptions,
    });

    await tx.videoJob.update({
      where: { id: preview.jobId },
      data: {
        status: "queued",
        currentNode: AVATAR_RENDER_NODE_TYPE,
      },
    });

    return {
      cancelledPreviewNode,
      node,
      avatarRenderRequest,
    };
  });

  await queue.enqueue({
    jobId: input.jobId,
    nodeId: result.node.id,
    nodeType: AVATAR_RENDER_NODE_TYPE,
    version: result.node.version,
    traceId: createTraceId(),
  });

  return {
    success: true,
    data: result,
  };
}

export async function createHdAvatarRenderTask(
  input: CreateHdAvatarRenderTaskInput,
  dependencies: Partial<CreatePreviewAvatarRenderTaskDependencies> = {}
): Promise<CreateHdAvatarRenderTaskResult> {
  const { queue, createTraceId } = {
    ...defaultCreatePreviewAvatarRenderTaskDependencies,
    ...dependencies,
  };

  const preview = await readPreviewRenderRequest(
    input.jobId,
    input.teamId,
    input.previewAvatarRenderRequestId
  );
  if (!preview) {
    return avatarRenderError(AVATAR_RENDER_ERROR_CODES.renderRequestNotFound);
  }

  if (preview.node.status !== WORKFLOW_NODE_STATUS.APPROVED) {
    return avatarRenderError(AVATAR_RENDER_ERROR_CODES.previewNotApproved);
  }

  const renderOptions = {
    crop: preview.crop,
    resolution: AVATAR_RENDER_DEFAULT_RESOLUTIONS.hd,
  };
  const aspectRatio = toApiAspectRatio(preview.aspectRatio);

  const result = await prisma.$transaction(async (tx) => {
    const { node, avatarRenderRequest } = await createAvatarRenderRequestWithNode(tx, {
      jobId: preview.jobId,
      avatarId: preview.avatarId,
      audioArtifactId: preview.audioArtifactId,
      mode: "hd",
      aspectRatio,
      crop: preview.crop,
      provider: preview.provider,
      sourceImageUrl: preview.avatar.sourceAsset.storageUrl,
      audioUrl: preview.audioArtifact.storageUrl,
      renderOptions,
    });

    await tx.videoJob.update({
      where: { id: preview.jobId },
      data: {
        status: "queued",
        currentNode: AVATAR_RENDER_NODE_TYPE,
      },
    });

    return {
      previewNode: preview.node,
      node,
      avatarRenderRequest,
    };
  });

  await queue.enqueue({
    jobId: input.jobId,
    nodeId: result.node.id,
    nodeType: AVATAR_RENDER_NODE_TYPE,
    version: result.node.version,
    traceId: createTraceId(),
  });

  return {
    success: true,
    data: result,
  };
}

function avatarRenderError(code: AvatarRenderErrorCode): AvatarRenderFailure {
  return {
    success: false,
    error: {
      code,
      message: AVATAR_RENDER_ERROR_MESSAGES[code],
    },
  };
}

function toPrismaJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

type CreateAvatarRenderRequestWithNodeInput = {
  jobId: string;
  avatarId: string;
  audioArtifactId: string;
  mode: "preview" | "hd";
  aspectRatio: ApiAspectRatio;
  crop: AvatarRenderCrop;
  provider: string;
  sourceImageUrl: string;
  audioUrl: string;
  renderOptions: {
    crop: AvatarRenderCrop;
    resolution: string;
  };
};

const avatarRenderWorkflowNodeSelect = {
  id: true,
  jobId: true,
  nodeType: true,
  status: true,
  version: true,
  input: true,
  requiresApproval: true,
  approvedByUserId: true,
  approvedAt: true,
} satisfies Prisma.WorkflowNodeSelect;

async function readPreviewRenderRequest(
  jobId: string,
  teamId: string,
  avatarRenderRequestId: string
) {
  return prisma.avatarRenderRequest.findFirst({
    where: {
      id: avatarRenderRequestId,
      jobId,
      mode: "preview",
      job: {
        teamId,
      },
    },
    include: {
      node: {
        select: avatarRenderWorkflowNodeSelect,
      },
      avatar: {
        select: {
          sourceAsset: {
            select: {
              storageUrl: true,
            },
          },
        },
      },
      audioArtifact: {
        select: {
          storageUrl: true,
        },
      },
    },
  });
}

async function createAvatarRenderRequestWithNode(
  tx: Prisma.TransactionClient,
  input: CreateAvatarRenderRequestWithNodeInput
): Promise<{
  node: AvatarRenderWorkflowNodeResult;
  avatarRenderRequest: AvatarRenderRequestResult;
}> {
  const maxVersion = await tx.workflowNode.aggregate({
    where: {
      jobId: input.jobId,
      nodeType: AVATAR_RENDER_NODE_TYPE,
    },
    _max: {
      version: true,
    },
  });
  const version = (maxVersion._max.version ?? 0) + 1;
  const nodeInput = {
    avatarId: input.avatarId,
    audioArtifactId: input.audioArtifactId,
    mode: input.mode,
    aspectRatio: input.aspectRatio,
    sourceImageUrl: input.sourceImageUrl,
    audioUrl: input.audioUrl,
    renderOptions: input.renderOptions,
  };

  const node = await tx.workflowNode.create({
    data: {
      jobId: input.jobId,
      nodeType: AVATAR_RENDER_NODE_TYPE,
      status: WORKFLOW_NODE_STATUS.QUEUED,
      version,
      input: Prisma.JsonNull,
      requiresApproval: WORKFLOW_NODE_DEFINITIONS[AVATAR_RENDER_NODE_TYPE].requiresApproval,
    },
    select: avatarRenderWorkflowNodeSelect,
  });

  const avatarRenderRequest = await tx.avatarRenderRequest.create({
    data: {
      jobId: input.jobId,
      nodeId: node.id,
      avatarId: input.avatarId,
      audioArtifactId: input.audioArtifactId,
      mode: input.mode,
      aspectRatio: toPrismaAspectRatio(input.aspectRatio),
      crop: input.crop,
      provider: input.provider,
    },
    select: {
      id: true,
      jobId: true,
      nodeId: true,
      avatarId: true,
      audioArtifactId: true,
      mode: true,
      aspectRatio: true,
      crop: true,
      provider: true,
      providerRequestId: true,
    },
  });

  const updatedNode = await tx.workflowNode.update({
    where: { id: node.id },
    data: {
      input: toPrismaJson({
        avatarRenderRequestId: avatarRenderRequest.id,
        ...nodeInput,
      }),
    },
    select: avatarRenderWorkflowNodeSelect,
  });

  return {
    node: updatedNode,
    avatarRenderRequest: {
      id: avatarRenderRequest.id,
      jobId: avatarRenderRequest.jobId,
      nodeId: avatarRenderRequest.nodeId,
      avatarId: avatarRenderRequest.avatarId,
      audioArtifactId: avatarRenderRequest.audioArtifactId,
      mode: avatarRenderRequest.mode,
      aspectRatio: toApiAspectRatio(avatarRenderRequest.aspectRatio),
      crop: avatarRenderRequest.crop,
      provider: avatarRenderRequest.provider,
      providerRequestId: avatarRenderRequest.providerRequestId,
    },
  };
}
