import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  workflowQueue,
  type WorkflowQueueEnqueuer,
} from "@/lib/queue/adapter";
import {
  REFERENCE_LINK_PARSE_ERROR_CODES,
  REFERENCE_LINK_PARSE_ERROR_MESSAGES,
  REFERENCE_LINK_PARSE_FALLBACK,
  parseReferenceLink,
  type ParseReferenceLinkResult,
} from "@/lib/references/parser";
import {
  REFERENCE_PLATFORM_ERROR_MESSAGES,
  type ReferencePlatformErrorCode,
  ReferencePlatformError,
} from "@/lib/references/platforms";
import {
  serializeReferenceSource,
  serializeReferenceSources,
  type SerializedReferenceSource,
} from "@/lib/references/serializer";
import {
  prepareReferenceAssetExtraction,
  REFERENCE_ASSET_ERROR_MESSAGES,
  type ReferenceAssetErrorCode,
} from "@/services/referenceAssetService";
import { WORKFLOW_NODE_DEFINITIONS } from "@/lib/workflow/constants";
import { createWorkflowTraceId } from "@/lib/workflow/trace";

const REFERENCE_EXTRACT_NODE_TYPE = WORKFLOW_NODE_DEFINITIONS.reference_extract.type;

export type CreateReferenceFromUrlErrorCode =
  | "PROJECT_NOT_FOUND"
  | ReferencePlatformErrorCode
  | "REFERENCE_PARSE_FAILED"
  | "REFERENCE_SOURCE_CREATE_FAILED";

export type CreateReferenceFromUrlResult =
  | {
      success: true;
      data: {
        referenceSource: ReferenceSourceSummary;
        parsed: Extract<ParseReferenceLinkResult, { success: true }>;
      };
    }
  | {
      success: false;
      error: {
        code: CreateReferenceFromUrlErrorCode;
        message: string;
        detail?: string;
      };
      data?: {
        platform?: string;
        label?: string;
        normalizedUrl?: string;
        fallback?: typeof REFERENCE_LINK_PARSE_FALLBACK;
      };
    };

export type GetReferenceSourceResult =
  | {
      success: true;
      data: {
        referenceSource: ReferenceSourceDetail;
      };
    }
  | {
      success: false;
      error: {
        code: "REFERENCE_SOURCE_NOT_FOUND";
        message: string;
      };
    };

export type ListReferenceSourcesResult =
  | {
      success: true;
      data: {
        references: SerializedReferenceSource[];
      };
    }
  | {
      success: false;
      error: {
        code: "PROJECT_NOT_FOUND";
        message: string;
      };
    };

export type RetryReferenceSourceErrorCode =
  | "REFERENCE_SOURCE_NOT_FOUND"
  | "REFERENCE_RETRY_NOT_ALLOWED"
  | "REFERENCE_EXTRACT_ENQUEUE_FAILED"
  | "REFERENCE_SOURCE_RETRY_FAILED"
  | ReferenceAssetErrorCode
  | ReferencePlatformErrorCode
  | "REFERENCE_PARSE_FAILED";

export type RetryReferenceSourceResult =
  | {
      success: true;
      data: {
        message: string;
        referenceSource: SerializedReferenceSource;
        job?: {
          id: string;
          projectId: string;
          teamId: string;
          ownerId: string;
          status: string;
          currentNode: string | null;
        };
        node?: {
          id: string;
          jobId: string;
          nodeType: string;
          status: string;
          version: number;
          input: unknown;
        };
      };
    }
  | {
      success: false;
      error: {
        code: RetryReferenceSourceErrorCode;
        message: string;
        detail?: string;
      };
      data?: {
        platform?: string;
        label?: string;
        normalizedUrl?: string;
        fallback?: typeof REFERENCE_LINK_PARSE_FALLBACK;
      };
    };

export interface RetryReferenceSourceDependencies {
  queue: WorkflowQueueEnqueuer;
  createTraceId: () => string;
}

const defaultRetryReferenceSourceDependencies: RetryReferenceSourceDependencies = {
  queue: workflowQueue,
  createTraceId: createWorkflowTraceId,
};

export interface ReferenceSourceSummary {
  id: string;
  projectId: string;
  teamId: string;
  sourceType: string;
  platform: string | null;
  sourceUrl: string | null;
  assetId: string | null;
  status: string;
  durationMs: number | null;
  structureJson: unknown;
  errorJson: unknown;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReferenceSourceDetail extends ReferenceSourceSummary {
  transcript: string | null;
  asset: {
    id: string;
    name: string;
    type: string;
  } | null;
}

export async function createReferenceSourceFromUrl(input: {
  projectId: string;
  teamId: string;
  sourceUrl: string;
}): Promise<CreateReferenceFromUrlResult> {
  const project = await prisma.project.findFirst({
    where: {
      id: input.projectId,
      teamId: input.teamId,
      status: "active",
    },
    select: {
      id: true,
    },
  });

  if (!project) {
    return {
      success: false,
      error: {
        code: "PROJECT_NOT_FOUND",
        message: "项目不存在",
      },
    };
  }

  let parsed: ParseReferenceLinkResult;
  try {
    parsed = await parseReferenceLink(input.sourceUrl);
  } catch (error) {
    if (error instanceof ReferencePlatformError) {
      return {
        success: false,
        error: {
          code: error.code,
          message: REFERENCE_PLATFORM_ERROR_MESSAGES[error.code],
          detail: error.message,
        },
        data: {
          fallback: REFERENCE_LINK_PARSE_FALLBACK,
        },
      };
    }

    return {
      success: false,
      error: {
        code: REFERENCE_LINK_PARSE_ERROR_CODES.PARSE_FAILED,
        message: REFERENCE_LINK_PARSE_ERROR_MESSAGES[
          REFERENCE_LINK_PARSE_ERROR_CODES.PARSE_FAILED
        ],
        detail: getErrorDetail(error),
      },
      data: {
        fallback: REFERENCE_LINK_PARSE_FALLBACK,
      },
    };
  }

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error,
      data: {
        platform: parsed.platform,
        label: parsed.label,
        normalizedUrl: parsed.normalizedUrl,
        fallback: parsed.fallback,
      },
    };
  }

  try {
    const referenceSource = await prisma.referenceSource.create({
      data: {
        projectId: input.projectId,
        teamId: input.teamId,
        sourceType: "url",
        platform: parsed.platform,
        sourceUrl: parsed.normalizedUrl,
        status: "succeeded",
        durationMs: parsed.parsed.durationMs ?? null,
        structureJson: toPrismaJson(buildUrlReferenceStructureJson(parsed)),
      },
      select: referenceSourceSummarySelect,
    });

    return {
      success: true,
      data: {
        referenceSource,
        parsed,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: "REFERENCE_SOURCE_CREATE_FAILED",
        message: "参考链接保存失败",
        detail: getErrorDetail(error),
      },
    };
  }
}

export async function getReferenceSourceForTeam(input: {
  referenceSourceId: string;
  teamId: string;
}): Promise<GetReferenceSourceResult> {
  const referenceSource = await prisma.referenceSource.findFirst({
    where: {
      id: input.referenceSourceId,
      teamId: input.teamId,
    },
    select: referenceSourceDetailSelect,
  });

  if (!referenceSource) {
    return {
      success: false,
      error: {
        code: "REFERENCE_SOURCE_NOT_FOUND",
        message: "参考来源不存在",
      },
    };
  }

  return {
    success: true,
    data: {
      referenceSource: serializeReferenceSource(referenceSource),
    },
  };
}

export async function listReferenceSourcesForProject(input: {
  projectId: string;
  teamId: string;
}): Promise<ListReferenceSourcesResult> {
  const project = await prisma.project.findFirst({
    where: {
      id: input.projectId,
      teamId: input.teamId,
      status: "active",
    },
    select: {
      id: true,
    },
  });

  if (!project) {
    return {
      success: false,
      error: {
        code: "PROJECT_NOT_FOUND",
        message: "项目不存在",
      },
    };
  }

  const references = await prisma.referenceSource.findMany({
    where: {
      projectId: input.projectId,
      teamId: input.teamId,
    },
    orderBy: {
      createdAt: "desc",
    },
    select: referenceSourceDetailSelect,
  });

  return {
    success: true,
    data: {
      references: serializeReferenceSources(references),
    },
  };
}

export async function retryReferenceSourceForTeam(
  input: {
    referenceSourceId: string;
    teamId: string;
    userId: string;
  },
  dependencies: RetryReferenceSourceDependencies = defaultRetryReferenceSourceDependencies
): Promise<RetryReferenceSourceResult> {
  const referenceSource = await prisma.referenceSource.findFirst({
    where: {
      id: input.referenceSourceId,
      teamId: input.teamId,
    },
    select: {
      id: true,
      projectId: true,
      teamId: true,
      sourceType: true,
      sourceUrl: true,
      assetId: true,
      status: true,
    },
  });

  if (!referenceSource) {
    return retryReferenceSourceError(
      "REFERENCE_SOURCE_NOT_FOUND",
      "参考来源不存在"
    );
  }

  if (referenceSource.status !== "failed") {
    return retryReferenceSourceError(
      "REFERENCE_RETRY_NOT_ALLOWED",
      "仅失败的参考来源可以重试"
    );
  }

  if (referenceSource.sourceType === "asset") {
    return retryAssetReferenceSource(referenceSource, input.userId, dependencies);
  }

  if (referenceSource.sourceType === "url") {
    return retryUrlReferenceSource(referenceSource);
  }

  return retryReferenceSourceError(
    "REFERENCE_RETRY_NOT_ALLOWED",
    "该参考来源不支持重试"
  );
}

async function retryAssetReferenceSource(
  referenceSource: {
    id: string;
    projectId: string;
    teamId: string;
    assetId: string | null;
  },
  userId: string,
  dependencies: RetryReferenceSourceDependencies
): Promise<RetryReferenceSourceResult> {
  if (!referenceSource.assetId) {
    return retryReferenceSourceError(
      "REFERENCE_RETRY_NOT_ALLOWED",
      "该参考来源缺少素材，无法重试"
    );
  }

  const prepared = await prepareReferenceAssetExtraction({
    projectId: referenceSource.projectId,
    teamId: referenceSource.teamId,
    assetId: referenceSource.assetId,
  });

  if (!prepared.success) {
    return retryReferenceSourceError(
      prepared.error.code,
      REFERENCE_ASSET_ERROR_MESSAGES[prepared.error.code]
    );
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const updatedReferenceSource = await tx.referenceSource.update({
        where: {
          id: referenceSource.id,
        },
        data: {
          status: "transcribing",
          errorJson: Prisma.JsonNull,
          structureJson: Prisma.JsonNull,
          transcriptScriptId: null,
        },
        select: referenceSourceDetailSelect,
      });

      const job = await tx.videoJob.create({
        data: {
          projectId: referenceSource.projectId,
          teamId: referenceSource.teamId,
          ownerId: userId,
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
        referenceSource: serializeReferenceSource(updatedReferenceSource),
        job,
        node,
      };
    });

    return {
      success: true,
      data: {
        message: "参考来源重试任务已创建",
        ...result,
      },
    };
  } catch (error) {
    return retryReferenceSourceError(
      "REFERENCE_EXTRACT_ENQUEUE_FAILED",
      "队列投递失败",
      getErrorDetail(error)
    );
  }
}

async function retryUrlReferenceSource(referenceSource: {
  id: string;
  projectId: string;
  teamId: string;
  sourceUrl: string | null;
}): Promise<RetryReferenceSourceResult> {
  if (!referenceSource.sourceUrl) {
    return retryReferenceSourceError(
      "REFERENCE_RETRY_NOT_ALLOWED",
      "该参考来源缺少链接，无法重试"
    );
  }

  let parsed: ParseReferenceLinkResult;
  try {
    parsed = await parseReferenceLink(referenceSource.sourceUrl);
  } catch (error) {
    if (error instanceof ReferencePlatformError) {
      return retryReferenceSourceError(
        error.code,
        REFERENCE_PLATFORM_ERROR_MESSAGES[error.code],
        error.message,
        { fallback: REFERENCE_LINK_PARSE_FALLBACK }
      );
    }

    return retryReferenceSourceError(
      REFERENCE_LINK_PARSE_ERROR_CODES.PARSE_FAILED,
      REFERENCE_LINK_PARSE_ERROR_MESSAGES[REFERENCE_LINK_PARSE_ERROR_CODES.PARSE_FAILED],
      getErrorDetail(error),
      { fallback: REFERENCE_LINK_PARSE_FALLBACK }
    );
  }

  if (!parsed.success) {
    await prisma.referenceSource.update({
      where: {
        id: referenceSource.id,
      },
      data: {
        status: "failed",
        errorJson: toPrismaJson(parsed.error),
      },
    });

    return {
      success: false,
      error: parsed.error,
      data: {
        platform: parsed.platform,
        label: parsed.label,
        normalizedUrl: parsed.normalizedUrl,
        fallback: parsed.fallback,
      },
    };
  }

  try {
    const updatedReferenceSource = await prisma.referenceSource.update({
      where: {
        id: referenceSource.id,
      },
      data: {
        platform: parsed.platform,
        sourceUrl: parsed.normalizedUrl,
        status: "succeeded",
        durationMs: parsed.parsed.durationMs ?? null,
        structureJson: toPrismaJson(buildUrlReferenceStructureJson(parsed)),
        errorJson: Prisma.JsonNull,
      },
      select: referenceSourceDetailSelect,
    });

    return {
      success: true,
      data: {
        message: "参考链接已重新解析",
        referenceSource: serializeReferenceSource(updatedReferenceSource),
      },
    };
  } catch (error) {
    return retryReferenceSourceError(
      "REFERENCE_SOURCE_RETRY_FAILED",
      "参考来源重试失败",
      getErrorDetail(error)
    );
  }
}

const referenceSourceSummarySelect = {
  id: true,
  projectId: true,
  teamId: true,
  sourceType: true,
  platform: true,
  sourceUrl: true,
  assetId: true,
  status: true,
  durationMs: true,
  structureJson: true,
  errorJson: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ReferenceSourceSelect;

const referenceSourceDetailSelect = {
  ...referenceSourceSummarySelect,
  asset: {
    select: {
      id: true,
      name: true,
      type: true,
    },
  },
  transcriptScript: {
    select: {
      content: true,
    },
  },
} satisfies Prisma.ReferenceSourceSelect;

function buildUrlReferenceStructureJson(
  parsed: Extract<ParseReferenceLinkResult, { success: true }>
): Prisma.InputJsonValue {
  return {
    platform: parsed.platform,
    label: parsed.label,
    normalizedUrl: parsed.normalizedUrl,
    normalizedHost: parsed.normalizedHost,
    title: parsed.parsed.title ?? null,
    mediaUrl: parsed.parsed.mediaUrl ?? null,
    thumbnailUrl: parsed.parsed.thumbnailUrl ?? null,
    raw: parsed.parsed.raw ?? null,
  };
}

function toPrismaJson(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value === null || value === undefined) {
    return Prisma.JsonNull;
  }

  return value as Prisma.InputJsonValue;
}

function getErrorDetail(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Unknown reference source error";
}

function retryReferenceSourceError(
  code: RetryReferenceSourceErrorCode,
  message: string,
  detail?: string,
  data?: Extract<RetryReferenceSourceResult, { success: false }>["data"]
): Extract<RetryReferenceSourceResult, { success: false }> {
  return {
    success: false,
    error: {
      code,
      message,
      ...(detail ? { detail } : {}),
    },
    ...(data ? { data } : {}),
  };
}
