import { AssetType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { serializeScript, type SerializedScript } from "@/lib/scripts/serializer";
import { workflowQueue, type WorkflowQueueEnqueuer } from "@/lib/queue/adapter";
import { createWorkflowTraceId } from "@/lib/workflow/trace";

export const SCRIPT_CONTENT_MAX_LENGTH = 3000;
export const ASR_MEDIA_DURATION_LIMIT_MS = 3 * 60 * 1000;
export const SCRIPT_ASR_NODE_TYPE = "script_prepare";

export interface SavePastedScriptInput {
  projectId: string;
  teamId: string;
  content: string;
}

export type SavePastedScriptResult =
  | { success: true; data: SerializedScript }
  | { success: false; error: { code: "PROJECT_NOT_FOUND" } };

export interface CreateAsrTranscriptionTaskInput {
  projectId: string;
  teamId: string;
  userId: string;
  assetId: string;
}

export interface CreateAsrTranscriptionTaskOutput {
  job: {
    id: string;
    projectId: string;
    teamId: string;
    ownerId: string;
    status: string;
    currentNode: string | null;
    createdAt: string;
    updatedAt: string;
  };
  node: {
    id: string;
    jobId: string;
    nodeType: string;
    status: string;
    version: number;
    input: unknown;
    createdAt: string;
    updatedAt: string;
  };
}

export type CreateAsrTranscriptionTaskErrorCode =
  | "PROJECT_NOT_FOUND"
  | "ASSET_NOT_FOUND"
  | "ASSET_LICENSE_NOT_APPROVED"
  | "ASR_UNSUPPORTED_ASSET_TYPE"
  | "ASR_DURATION_REQUIRED"
  | "ASR_DURATION_LIMIT_EXCEEDED"
  | "ENQUEUE_FAILED";

export type CreateAsrTranscriptionTaskResult =
  | { success: true; data: CreateAsrTranscriptionTaskOutput }
  | { success: false; error: { code: CreateAsrTranscriptionTaskErrorCode } };

export interface SaveAsrTranscriptionResultInput {
  jobId: string;
  assetId: string;
  assetType: "audio" | "video";
  durationMs: number;
  text: string;
  segments: Array<{
    startMs: number;
    endMs: number;
    text: string;
  }>;
  provider: string;
}

export interface CreateAsrTranscriptionTaskDependencies {
  queue: WorkflowQueueEnqueuer;
  createTraceId: () => string;
}

const defaultCreateAsrTranscriptionTaskDependencies: CreateAsrTranscriptionTaskDependencies = {
  queue: workflowQueue,
  createTraceId: createWorkflowTraceId,
};

export async function savePastedScript(input: SavePastedScriptInput): Promise<SavePastedScriptResult> {
  const project = await prisma.project.findFirst({
    where: {
      id: input.projectId,
      teamId: input.teamId,
    },
    select: {
      id: true,
    },
  });

  if (!project) {
    return { success: false, error: { code: "PROJECT_NOT_FOUND" } };
  }

  const script = await prisma.script.create({
    data: {
      projectId: input.projectId,
      sourceType: "pasted",
      content: input.content,
      version: 1,
      status: "draft",
    },
  });

  return {
    success: true,
    data: serializeScript(script),
  };
}

export async function saveAsrTranscriptionResult(
  input: SaveAsrTranscriptionResultInput
): Promise<SerializedScript> {
  const script = await prisma.$transaction(async (tx) => {
    const job = await tx.videoJob.findUnique({
      where: { id: input.jobId },
      select: {
        projectId: true,
      },
    });

    if (!job) {
      throw new SaveAsrTranscriptionResultError("ASR_JOB_NOT_FOUND", "ASR 工作流任务不存在");
    }

    const existingVersion = await tx.script.aggregate({
      where: {
        projectId: job.projectId,
        jobId: input.jobId,
        sourceType: "asr",
      },
      _max: {
        version: true,
      },
    });

    const savedScript = await tx.script.create({
      data: {
        projectId: job.projectId,
        jobId: input.jobId,
        sourceType: "asr",
        content: input.text,
        metadata: {
          assetId: input.assetId,
          assetType: input.assetType,
          durationMs: input.durationMs,
          provider: input.provider,
        },
        version: (existingVersion._max.version ?? 0) + 1,
        status: "ready",
      },
    });

    if (input.segments.length > 0) {
      await tx.asrSegment.createMany({
        data: input.segments.map((segment) => ({
          scriptId: savedScript.id,
          startMs: segment.startMs,
          endMs: segment.endMs,
          text: segment.text,
        })),
      });
    }

    return savedScript;
  });

  return serializeScript(script);
}

export async function createAsrTranscriptionTask(
  input: CreateAsrTranscriptionTaskInput,
  dependencies: CreateAsrTranscriptionTaskDependencies = defaultCreateAsrTranscriptionTaskDependencies
): Promise<CreateAsrTranscriptionTaskResult> {
  const project = await prisma.project.findFirst({
    where: {
      id: input.projectId,
      teamId: input.teamId,
      status: "active",
    },
    select: { id: true },
  });

  if (!project) {
    return { success: false, error: { code: "PROJECT_NOT_FOUND" } };
  }

  const asset = await prisma.asset.findFirst({
    where: {
      id: input.assetId,
      teamId: input.teamId,
      deletedAt: null,
    },
    select: {
      id: true,
      type: true,
      storageUrl: true,
      metadata: true,
      licenseStatus: true,
    },
  });

  if (!asset) {
    return { success: false, error: { code: "ASSET_NOT_FOUND" } };
  }

  if (asset.type !== AssetType.audio && asset.type !== AssetType.video) {
    return { success: false, error: { code: "ASR_UNSUPPORTED_ASSET_TYPE" } };
  }

  if (asset.licenseStatus !== "approved") {
    return { success: false, error: { code: "ASSET_LICENSE_NOT_APPROVED" } };
  }

  const durationMs = getMediaDurationMs(asset.metadata);
  if (durationMs === null) {
    return { success: false, error: { code: "ASR_DURATION_REQUIRED" } };
  }

  if (durationMs > ASR_MEDIA_DURATION_LIMIT_MS) {
    return { success: false, error: { code: "ASR_DURATION_LIMIT_EXCEEDED" } };
  }

  const { queue, createTraceId } = dependencies;
  let created:
    | {
        job: {
          id: string;
          projectId: string;
          teamId: string;
          ownerId: string;
          status: string;
          currentNode: string | null;
          createdAt: Date;
          updatedAt: Date;
        };
        node: {
          id: string;
          jobId: string;
          nodeType: string;
          status: string;
          version: number;
          input: Prisma.JsonValue;
          createdAt: Date;
          updatedAt: Date;
        };
      }
    | null = null;

  try {
    created = await prisma.$transaction(async (tx) => {
      const job = await tx.videoJob.create({
        data: {
          projectId: input.projectId,
          teamId: input.teamId,
          ownerId: input.userId,
          status: "queued",
          currentNode: SCRIPT_ASR_NODE_TYPE,
        },
        select: {
          id: true,
          projectId: true,
          teamId: true,
          ownerId: true,
          status: true,
          currentNode: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      const node = await tx.workflowNode.create({
        data: {
          jobId: job.id,
          nodeType: SCRIPT_ASR_NODE_TYPE,
          status: "queued",
          version: 1,
          input: {
            sourceType: "media_asr",
            assetId: asset.id,
            assetType: asset.type,
            storageUrl: asset.storageUrl,
            durationMs,
          },
        },
        select: {
          id: true,
          jobId: true,
          nodeType: true,
          status: true,
          version: true,
          input: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return { job, node };
    });

    await queue.enqueue({
      jobId: created.job.id,
      nodeId: created.node.id,
      nodeType: SCRIPT_ASR_NODE_TYPE,
      version: created.node.version,
      traceId: createTraceId(),
    });
  } catch {
    return { success: false, error: { code: "ENQUEUE_FAILED" } };
  }

  return {
    success: true,
    data: {
      job: {
        ...created.job,
        createdAt: created.job.createdAt.toISOString(),
        updatedAt: created.job.updatedAt.toISOString(),
      },
      node: {
        ...created.node,
        createdAt: created.node.createdAt.toISOString(),
        updatedAt: created.node.updatedAt.toISOString(),
      },
    },
  };
}

function getMediaDurationMs(metadata: Prisma.JsonValue | null): number | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const durationMs = metadata.durationMs;
  if (typeof durationMs === "number" && Number.isFinite(durationMs)) {
    return Math.round(durationMs);
  }

  const durationSeconds = metadata.durationSeconds;
  if (typeof durationSeconds === "number" && Number.isFinite(durationSeconds)) {
    return Math.round(durationSeconds * 1000);
  }

  return null;
}

class SaveAsrTranscriptionResultError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "SaveAsrTranscriptionResultError";
    this.code = code;
  }
}
