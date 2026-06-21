import { Prisma } from "@prisma/client";
import { Readable } from "node:stream";
import { getObjectByPath } from "@/lib/storage";
import { prisma } from "@/lib/db";
import {
  workflowQueue,
  type WorkflowQueueEnqueuer,
} from "@/lib/queue/adapter";
import { createWorkflowTraceId } from "@/lib/workflow/trace";
import { WORKFLOW_NODE_DEFINITIONS } from "@/lib/workflow/constants";
import {
  prepareReferenceAssetExtraction,
  type ReferenceAssetErrorCode,
} from "@/services/referenceAssetService";
import type {
  AsrMediaStorage,
  AsrProvider,
  AsrServiceRegistry,
} from "@/services/scriptAsrWorkerService";
import { requireAvailableAsrService } from "@/services/scriptModelRegistryService";
import type { WorkflowNodeHandler } from "@/services/workflowWorkerService";

export const REFERENCE_ASR_FAILED = "REFERENCE_ASR_FAILED";
export const REFERENCE_ASR_INVALID_NODE_INPUT = "REFERENCE_ASR_INVALID_NODE_INPUT";
export const REFERENCE_EXTRACT_NODE_TYPE = WORKFLOW_NODE_DEFINITIONS.reference_extract.type;

export interface CreateReferenceExtractTaskInput {
  projectId: string;
  teamId: string;
  userId: string;
  assetId: string;
}

export interface CreateReferenceExtractTaskDependencies {
  queue: WorkflowQueueEnqueuer;
  createTraceId: () => string;
}

export interface CreateReferenceExtractTaskOutput {
  referenceSource: {
    id: string;
    projectId: string;
    teamId: string;
    sourceType: string;
    assetId: string | null;
    status: string;
    durationMs: number | null;
  };
  job: {
    id: string;
    projectId: string;
    teamId: string;
    ownerId: string;
    status: string;
    currentNode: string | null;
  };
  node: {
    id: string;
    jobId: string;
    nodeType: string;
    status: string;
    version: number;
    input: unknown;
  };
}

export type CreateReferenceExtractTaskResult =
  | { success: true; data: CreateReferenceExtractTaskOutput }
  | {
      success: false;
      error: {
        code: ReferenceAssetErrorCode | "REFERENCE_EXTRACT_ENQUEUE_FAILED";
        message: string;
      };
    };

const defaultCreateReferenceExtractTaskDependencies: CreateReferenceExtractTaskDependencies = {
  queue: workflowQueue,
  createTraceId: createWorkflowTraceId,
};

export async function createReferenceExtractTask(
  input: CreateReferenceExtractTaskInput,
  dependencies: CreateReferenceExtractTaskDependencies = defaultCreateReferenceExtractTaskDependencies
): Promise<CreateReferenceExtractTaskResult> {
  const prepared = await prepareReferenceAssetExtraction({
    projectId: input.projectId,
    teamId: input.teamId,
    assetId: input.assetId,
  });

  if (!prepared.success) {
    return prepared;
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const referenceSource = await tx.referenceSource.create({
        data: {
          ...prepared.data.referenceSource,
          status: "transcribing",
        },
        select: {
          id: true,
          projectId: true,
          teamId: true,
          sourceType: true,
          assetId: true,
          status: true,
          durationMs: true,
        },
      });

      const job = await tx.videoJob.create({
        data: {
          projectId: input.projectId,
          teamId: input.teamId,
          ownerId: input.userId,
          status: "queued",
          currentNode: REFERENCE_EXTRACT_NODE_TYPE,
        },
        select: {
          id: true,
          projectId: true,
          teamId: true,
          ownerId: true,
          status: true,
          currentNode: true,
        },
      });

      const node = await tx.workflowNode.create({
        data: {
          jobId: job.id,
          nodeType: REFERENCE_EXTRACT_NODE_TYPE,
          status: "queued",
          version: 1,
          input: toPrismaJson({
            ...prepared.data.workflowNode.input,
            referenceSourceId: referenceSource.id,
          }),
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

      await dependencies.queue.enqueue({
        jobId: job.id,
        nodeId: node.id,
        nodeType: REFERENCE_EXTRACT_NODE_TYPE,
        version: node.version,
        traceId: dependencies.createTraceId(),
      });

      return {
        referenceSource,
        job,
        node,
      };
    });

    return {
      success: true,
      data: result,
    };
  } catch {
    return {
      success: false,
      error: {
        code: "REFERENCE_EXTRACT_ENQUEUE_FAILED",
        message: "爆款提取任务创建失败",
      },
    };
  }
}

export interface ReferenceAsrWorkflowNodeHandlerDependencies {
  storage: AsrMediaStorage;
  registry: AsrServiceRegistry;
  provider: AsrProvider;
  queue: WorkflowQueueEnqueuer;
  createTraceId: () => string;
}

interface ReferenceAsrWorkflowNodeInput {
  sourceType: "asset";
  projectId: string;
  teamId: string;
  referenceSourceId: string;
  assetId: string;
  assetType: "audio" | "video";
  storageUrl: string;
  durationMs: number;
}

const prismaReferenceAsrServiceRegistry: AsrServiceRegistry = {
  async getAsrService() {
    const service = await prisma.localModelService.findUnique({
      where: { serviceType: "asr" },
      select: {
        serviceType: true,
        name: true,
        baseUrl: true,
        status: true,
      },
    });

    if (!service) return null;

    return {
      serviceType: "asr",
      name: service.name,
      baseUrl: service.baseUrl,
      status: service.status,
    };
  },
};

const referenceObjectStorage: AsrMediaStorage = {
  async downloadObject(storageUrl) {
    return readableToBuffer(await getObjectByPath(storageUrl));
  },
};

const mockReferenceAsrProvider: AsrProvider = {
  async transcribe() {
    return {
      text: "",
      segments: [],
      provider: "mock-asr",
    };
  },
};

const defaultReferenceAsrWorkflowNodeHandlerDependencies: ReferenceAsrWorkflowNodeHandlerDependencies = {
  storage: referenceObjectStorage,
  registry: prismaReferenceAsrServiceRegistry,
  provider: mockReferenceAsrProvider,
  queue: workflowQueue,
  createTraceId: createWorkflowTraceId,
};

export function createReferenceAsrWorkflowNodeHandler(
  dependencies: Partial<ReferenceAsrWorkflowNodeHandlerDependencies> = {}
): WorkflowNodeHandler {
  const { storage, registry, provider, queue, createTraceId } = {
    ...defaultReferenceAsrWorkflowNodeHandlerDependencies,
    ...dependencies,
  };

  return async ({ payload, input }) => {
    const parsedInput = parseReferenceAsrWorkflowNodeInput(input);

    try {
      const service = await registry.getAsrService();
      const availableService = requireAvailableAsrService(service);
      const media = await storage.downloadObject(parsedInput.storageUrl);
      const result = await provider.transcribe({
        service: {
          baseUrl: availableService.baseUrl,
        },
        media,
        assetId: parsedInput.assetId,
        assetType: parsedInput.assetType,
        durationMs: parsedInput.durationMs,
        traceId: payload.traceId,
      });
      const resultAfterSave = await saveReferenceAsrTranscriptionResult({
        jobId: payload.jobId,
        referenceSourceId: parsedInput.referenceSourceId,
        projectId: parsedInput.projectId,
        assetId: parsedInput.assetId,
        assetType: parsedInput.assetType,
        durationMs: parsedInput.durationMs,
        text: result.text,
        segments: result.segments,
        provider: result.provider,
      });

      await queue.enqueue({
        jobId: payload.jobId,
        nodeId: resultAfterSave.structureNode.id,
        nodeType: REFERENCE_EXTRACT_NODE_TYPE,
        version: resultAfterSave.structureNode.version,
        traceId: createTraceId(),
      });

      return {
        output: {
          sourceType: parsedInput.sourceType,
          referenceSourceId: parsedInput.referenceSourceId,
          assetId: parsedInput.assetId,
          assetType: parsedInput.assetType,
          durationMs: parsedInput.durationMs,
          text: result.text,
          segments: result.segments,
          provider: result.provider,
          scriptId: resultAfterSave.script.id,
          structureNodeId: resultAfterSave.structureNode.id,
        },
      };
    } catch (error) {
      await markReferenceAsrFailed(parsedInput.referenceSourceId, error);
      throw referenceAsrFailedError(error);
    }
  };
}

interface SaveReferenceAsrTranscriptionResultInput {
  jobId: string;
  referenceSourceId: string;
  projectId: string;
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

async function saveReferenceAsrTranscriptionResult(
  input: SaveReferenceAsrTranscriptionResultInput
): Promise<{
  script: { id: string };
  structureNode: {
    id: string;
    version: number;
  };
}> {
  return prisma.$transaction(async (tx) => {
    const script = await tx.script.create({
      data: {
        projectId: input.projectId,
        jobId: input.jobId,
        sourceType: "asr",
        content: input.text,
        metadata: toPrismaJson({
          sourceType: "reference_extract",
          referenceSourceId: input.referenceSourceId,
          assetId: input.assetId,
          assetType: input.assetType,
          durationMs: input.durationMs,
          provider: input.provider,
        }),
        status: "ready",
        asrSegments: {
          create: input.segments.map((segment) => ({
            startMs: segment.startMs,
            endMs: segment.endMs,
            text: segment.text,
          })),
        },
      },
      select: {
        id: true,
      },
    });

    await tx.referenceSource.update({
      where: {
        id: input.referenceSourceId,
      },
      data: {
        status: "analyzing",
        transcriptScriptId: script.id,
        errorJson: Prisma.JsonNull,
      },
    });

    const structureNode = await tx.workflowNode.create({
      data: {
        jobId: input.jobId,
        nodeType: REFERENCE_EXTRACT_NODE_TYPE,
        status: "queued",
        version: 1,
        input: toPrismaJson({
          sourceType: "reference_structure",
          referenceSourceId: input.referenceSourceId,
        }),
      },
      select: {
        id: true,
        version: true,
      },
    });

    return {
      script,
      structureNode,
    };
  });
}

async function markReferenceAsrFailed(referenceSourceId: string, error: unknown): Promise<void> {
  await prisma.referenceSource.update({
    where: {
      id: referenceSourceId,
    },
    data: {
      status: "failed",
      errorJson: toPrismaJson({
        code: REFERENCE_ASR_FAILED,
        message: "ASR 转写失败",
        detail: getErrorDetail(error),
      }),
    },
  });
}

class ReferenceAsrWorkerError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "ReferenceAsrWorkerError";
    this.code = code;
  }
}

function parseReferenceAsrWorkflowNodeInput(input: unknown): ReferenceAsrWorkflowNodeInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new ReferenceAsrWorkerError(
      REFERENCE_ASR_INVALID_NODE_INPUT,
      "爆款提取 ASR 节点输入无效"
    );
  }

  const value = input as Partial<ReferenceAsrWorkflowNodeInput>;
  if (
    value.sourceType !== "asset" ||
    typeof value.projectId !== "string" ||
    typeof value.teamId !== "string" ||
    typeof value.referenceSourceId !== "string" ||
    typeof value.assetId !== "string" ||
    (value.assetType !== "audio" && value.assetType !== "video") ||
    typeof value.storageUrl !== "string" ||
    typeof value.durationMs !== "number"
  ) {
    throw new ReferenceAsrWorkerError(
      REFERENCE_ASR_INVALID_NODE_INPUT,
      "爆款提取 ASR 节点输入无效"
    );
  }

  return {
    sourceType: value.sourceType,
    projectId: value.projectId,
    teamId: value.teamId,
    referenceSourceId: value.referenceSourceId,
    assetId: value.assetId,
    assetType: value.assetType,
    storageUrl: value.storageUrl,
    durationMs: value.durationMs,
  };
}

function referenceAsrFailedError(error: unknown): ReferenceAsrWorkerError {
  const failedError = new ReferenceAsrWorkerError(REFERENCE_ASR_FAILED, "ASR 转写失败");
  failedError.cause = error;
  return failedError;
}

function getErrorDetail(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Unknown ASR error";
}

async function readableToBuffer(readable: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];

  for await (const chunk of readable) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

function toPrismaJson(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value === null || value === undefined) {
    return Prisma.JsonNull;
  }

  return value as Prisma.InputJsonValue;
}
