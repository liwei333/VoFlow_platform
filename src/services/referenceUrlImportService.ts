import { Prisma } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit-log";
import { prisma } from "@/lib/db";
import {
  workflowQueue,
  type WorkflowQueueEnqueuer,
} from "@/lib/queue/adapter";
import { createWorkflowTraceId } from "@/lib/workflow/trace";
import {
  REFERENCE_LINK_PARSE_ERROR_CODES,
  REFERENCE_LINK_PARSE_ERROR_MESSAGES,
  REFERENCE_LINK_PARSE_FALLBACK,
  parseReferenceLink,
  type ParseReferenceLinkResult,
} from "@/lib/references/parser";
import {
  detectReferencePlatform,
  REFERENCE_PLATFORM_ERROR_MESSAGES,
  type ReferencePlatformErrorCode,
  ReferencePlatformError,
} from "@/lib/references/platforms";
import {
  REFERENCE_URL_IMPORT_ERROR_CODES,
  REFERENCE_URL_IMPORT_ERROR_MESSAGES,
  buildReferenceLinkImportConfig,
} from "@/lib/references/url-import/config";
import { DEFAULT_REFERENCE_URL_IMPORT_PARSERS } from "@/lib/references/url-import/parser";
import {
  serializeReferenceSource,
  type SerializedReferenceSource,
} from "@/lib/references/serializer";

export type ParseReferenceUrlMetadataErrorCode =
  | "PROJECT_NOT_FOUND"
  | "REFERENCE_SOURCE_CREATE_FAILED"
  | ReferencePlatformErrorCode
  | typeof REFERENCE_URL_IMPORT_ERROR_CODES.disabled
  | typeof REFERENCE_URL_IMPORT_ERROR_CODES.prohibitedRequest
  | typeof REFERENCE_URL_IMPORT_ERROR_CODES.platformUnsupported
  | typeof REFERENCE_LINK_PARSE_ERROR_CODES.PARSE_FAILED;

export type ConfirmReferenceUrlImportErrorCode =
  | "REFERENCE_SOURCE_NOT_FOUND"
  | typeof REFERENCE_URL_IMPORT_ERROR_CODES.consentRequired
  | typeof REFERENCE_URL_IMPORT_ERROR_CODES.audioExtractDisabled
  | typeof REFERENCE_URL_IMPORT_ERROR_CODES.importNotReady
  | typeof REFERENCE_URL_IMPORT_ERROR_CODES.enqueueFailed;

export type ReferenceUrlImportErrorCode =
  | ParseReferenceUrlMetadataErrorCode
  | ConfirmReferenceUrlImportErrorCode;

export type ParseReferenceUrlMetadataResult =
  | {
      success: true;
      data: {
        referenceSource: SerializedReferenceSource;
        parsed: Extract<ParseReferenceLinkResult, { success: true }>;
      };
    }
  | {
      success: false;
      error: {
        code: ParseReferenceUrlMetadataErrorCode;
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

export type ReferenceUrlImportMode = "metadata_only" | "subtitle_only" | "audio_extract";

export const REFERENCE_URL_IMPORT_REQUESTED_CAPABILITIES = [
  "metadata",
  "subtitle",
  "audio",
  "full_video",
  "cookie_import",
  "no_watermark",
  "batch_channel",
] as const;

export type ReferenceUrlImportRequestedCapability =
  (typeof REFERENCE_URL_IMPORT_REQUESTED_CAPABILITIES)[number];

export interface ReferenceUrlImportWorkflowInput {
  sourceType: "reference_url_import";
  referenceSourceId: string;
  projectId: string;
  teamId: string;
  userId: string;
  sourceUrl: string;
  platform: string | null;
  importMode: Exclude<ReferenceUrlImportMode, "metadata_only">;
}

export interface ConfirmReferenceUrlImportDependencies {
  queue: WorkflowQueueEnqueuer;
  createTraceId: () => string;
}

interface SerializedReferenceUrlImportJob {
  id: string;
  projectId: string;
  teamId: string;
  ownerId: string;
  status: string;
  currentNode: string | null;
  createdAt: string;
  updatedAt: string;
}

interface SerializedReferenceUrlImportNode {
  id: string;
  jobId: string;
  nodeType: string;
  status: string;
  version: number;
  input: unknown;
  createdAt: string;
  updatedAt: string;
}

const REFERENCE_URL_IMPORT_NODE_TYPE = "reference_url_import";

const defaultConfirmReferenceUrlImportDependencies: ConfirmReferenceUrlImportDependencies = {
  queue: workflowQueue,
  createTraceId: createWorkflowTraceId,
};

export type ConfirmReferenceUrlImportResult =
  | {
      success: true;
      data: {
        referenceSource: SerializedReferenceSource;
        nextStep: {
          nodeType: "reference_url_import";
          status: "queued" | "not_required";
        };
        job?: SerializedReferenceUrlImportJob;
        node?: SerializedReferenceUrlImportNode;
      };
    }
  | {
      success: false;
      error: {
        code: ConfirmReferenceUrlImportErrorCode;
        message: string;
        detail?: string;
      };
    };

export async function parseReferenceUrlMetadata(input: {
  projectId: string;
  teamId: string;
  userId?: string;
  sourceUrl: string;
  requestedCapability?: ReferenceUrlImportRequestedCapability;
}): Promise<ParseReferenceUrlMetadataResult> {
  const config = buildReferenceLinkImportConfig();
  if (!config.enabled) {
    return parseReferenceUrlMetadataError(
      REFERENCE_URL_IMPORT_ERROR_CODES.disabled,
      REFERENCE_URL_IMPORT_ERROR_MESSAGES[REFERENCE_URL_IMPORT_ERROR_CODES.disabled],
      undefined,
      { fallback: REFERENCE_LINK_PARSE_FALLBACK }
    );
  }

  const prohibitedRequest = detectProhibitedReferenceUrlImportRequest({
    sourceUrl: input.sourceUrl,
    requestedCapability: input.requestedCapability,
  });
  if (prohibitedRequest) {
    await writeReferenceUrlImportAudit({
      teamId: input.teamId,
      userId: input.userId,
      targetType: "reference_url",
      targetId: input.sourceUrl,
      metadata: {
        status: "blocked",
        importMode: null,
        requestedCapability: input.requestedCapability ?? null,
        prohibitedReason: prohibitedRequest.reason,
        sourceUrl: input.sourceUrl,
        platform: null,
        ytDlpVersion: null,
        failureReason: {
          code: REFERENCE_URL_IMPORT_ERROR_CODES.prohibitedRequest,
          message: REFERENCE_URL_IMPORT_ERROR_MESSAGES[
            REFERENCE_URL_IMPORT_ERROR_CODES.prohibitedRequest
          ],
        },
      },
    });

    return parseReferenceUrlMetadataError(
      REFERENCE_URL_IMPORT_ERROR_CODES.prohibitedRequest,
      REFERENCE_URL_IMPORT_ERROR_MESSAGES[REFERENCE_URL_IMPORT_ERROR_CODES.prohibitedRequest],
      undefined,
      { fallback: REFERENCE_LINK_PARSE_FALLBACK }
    );
  }

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
    return parseReferenceUrlMetadataError("PROJECT_NOT_FOUND", "项目不存在");
  }

  let detection: ReturnType<typeof detectReferencePlatform>;
  try {
    detection = detectReferencePlatform(input.sourceUrl);
  } catch (error) {
    if (error instanceof ReferencePlatformError) {
      return parseReferenceUrlMetadataError(
        error.code,
        REFERENCE_PLATFORM_ERROR_MESSAGES[error.code],
        error.message,
        { fallback: REFERENCE_LINK_PARSE_FALLBACK }
      );
    }

    return parseReferenceUrlMetadataError(
      REFERENCE_LINK_PARSE_ERROR_CODES.PARSE_FAILED,
      REFERENCE_LINK_PARSE_ERROR_MESSAGES[REFERENCE_LINK_PARSE_ERROR_CODES.PARSE_FAILED],
      getErrorDetail(error),
      { fallback: REFERENCE_LINK_PARSE_FALLBACK }
    );
  }

  if (!config.allowedPlatforms.includes(detection.platform)) {
    return parseReferenceUrlMetadataError(
      REFERENCE_URL_IMPORT_ERROR_CODES.platformUnsupported,
      REFERENCE_URL_IMPORT_ERROR_MESSAGES[REFERENCE_URL_IMPORT_ERROR_CODES.platformUnsupported],
      undefined,
      {
        platform: detection.platform,
        label: detection.label,
        normalizedUrl: detection.normalizedUrl,
        fallback: REFERENCE_LINK_PARSE_FALLBACK,
      }
    );
  }

  const parsed = await parseReferenceLink(input.sourceUrl, {
    adapters: DEFAULT_REFERENCE_URL_IMPORT_PARSERS,
  });

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
    const metadataJson = extractMetadataJson(parsed.parsed);
    const subtitleJson = extractSubtitleJson(metadataJson);
    const existingReferenceSource = await prisma.referenceSource.findFirst({
      where: {
        projectId: input.projectId,
        teamId: input.teamId,
        sourceType: "url",
        sourceUrl: parsed.normalizedUrl,
      },
      select: {
        id: true,
      },
    });
    const writeData = {
      projectId: input.projectId,
      teamId: input.teamId,
      sourceType: "url" as const,
      platform: parsed.platform,
      sourceUrl: parsed.normalizedUrl,
      status: "metadata_ready" as const,
      durationMs: parsed.parsed.durationMs ?? null,
      title: parsed.parsed.title ?? null,
      thumbnailUrl: parsed.parsed.thumbnailUrl ?? null,
      metadataJson: toPrismaJson(metadataJson),
      subtitleJson: toPrismaJson(subtitleJson),
      importMode: "metadata_only" as const,
      consentStatus: "pending" as const,
      structureJson: Prisma.JsonNull,
      errorJson: Prisma.JsonNull,
    };

    const referenceSource = existingReferenceSource
      ? await prisma.referenceSource.update({
          where: { id: existingReferenceSource.id },
          data: writeData,
          select: referenceSourceSelect,
        })
      : await prisma.referenceSource.create({
          data: writeData,
          select: referenceSourceSelect,
        });

    return {
      success: true,
      data: {
        referenceSource: serializeReferenceSource(referenceSource),
        parsed,
      },
    };
  } catch (error) {
    return parseReferenceUrlMetadataError(
      "REFERENCE_SOURCE_CREATE_FAILED",
      "参考链接 metadata 保存失败",
      getErrorDetail(error)
    );
  }
}

export async function confirmReferenceUrlImport(input: {
  projectId: string;
  referenceSourceId: string;
  teamId: string;
  userId: string;
  importMode: ReferenceUrlImportMode;
  consentTextVersion?: string;
  consentConfirmed?: boolean;
}, dependencies: ConfirmReferenceUrlImportDependencies = defaultConfirmReferenceUrlImportDependencies): Promise<ConfirmReferenceUrlImportResult> {
  const config = buildReferenceLinkImportConfig();
  if (input.importMode === "audio_extract" && !config.allowAudioExtract) {
    return confirmReferenceUrlImportError(
      REFERENCE_URL_IMPORT_ERROR_CODES.audioExtractDisabled,
      REFERENCE_URL_IMPORT_ERROR_MESSAGES[REFERENCE_URL_IMPORT_ERROR_CODES.audioExtractDisabled]
    );
  }

  if (requiresReferenceAnalysisConsent(input.importMode) && !input.consentConfirmed) {
    return confirmReferenceUrlImportError(
      REFERENCE_URL_IMPORT_ERROR_CODES.consentRequired,
      REFERENCE_URL_IMPORT_ERROR_MESSAGES[REFERENCE_URL_IMPORT_ERROR_CODES.consentRequired]
    );
  }

  const referenceSource = await prisma.referenceSource.findFirst({
    where: {
      id: input.referenceSourceId,
      projectId: input.projectId,
      teamId: input.teamId,
      sourceType: "url",
    },
    select: referenceSourceSelect,
  });

  if (!referenceSource) {
    return confirmReferenceUrlImportError("REFERENCE_SOURCE_NOT_FOUND", "参考来源不存在");
  }

  if (referenceSource.status !== "metadata_ready") {
    return confirmReferenceUrlImportError(
      REFERENCE_URL_IMPORT_ERROR_CODES.importNotReady,
      REFERENCE_URL_IMPORT_ERROR_MESSAGES[REFERENCE_URL_IMPORT_ERROR_CODES.importNotReady]
    );
  }

  if (!referenceSource.sourceUrl) {
    return confirmReferenceUrlImportError(
      REFERENCE_URL_IMPORT_ERROR_CODES.importNotReady,
      REFERENCE_URL_IMPORT_ERROR_MESSAGES[REFERENCE_URL_IMPORT_ERROR_CODES.importNotReady]
    );
  }
  const referenceSourceUrl = referenceSource.sourceUrl;

  const consentConfirmedAt = new Date();
  const importConsent = {
    importMode: input.importMode,
    consentTextVersion: input.consentTextVersion ?? null,
    sourceUrl: referenceSourceUrl,
    platform: referenceSource.platform,
    durationMs: referenceSource.durationMs,
    userId: input.userId,
    teamId: input.teamId,
    confirmedAt: consentConfirmedAt.toISOString(),
    usageScope: "reference_analysis_only",
  };

  if (input.importMode === "metadata_only") {
    const updatedReferenceSource = await prisma.$transaction(async (tx) => {
      const updated = await tx.referenceSource.update({
        where: {
          id: referenceSource.id,
        },
        data: {
          status: "succeeded",
          importMode: input.importMode,
          consentStatus: "confirmed",
          consentConfirmedAt,
          consentConfirmedBy: input.userId,
          metadataJson: toPrismaJson(
            mergeImportConsent(referenceSource.metadataJson, importConsent)
          ),
          errorJson: Prisma.JsonNull,
        },
        select: referenceSourceSelect,
      });

      await writeAuditLog(
        "reference_url_import",
        "reference_source",
        referenceSource.id,
        {
          status: "succeeded",
          importMode: input.importMode,
          consentTextVersion: input.consentTextVersion ?? null,
          sourceUrl: referenceSourceUrl,
          platform: referenceSource.platform,
          durationMs: referenceSource.durationMs,
          ytDlpVersion: getYtDlpVersion(referenceSource.metadataJson),
          failureReason: null,
        },
        {
          teamId: input.teamId,
          userId: input.userId,
        },
        tx
      );

      return updated;
    });

    return {
      success: true,
      data: {
        referenceSource: serializeReferenceSource(updatedReferenceSource),
        nextStep: {
          nodeType: REFERENCE_URL_IMPORT_NODE_TYPE,
          status: "not_required",
        },
      },
    };
  }
  const queuedImportMode: Exclude<ReferenceUrlImportMode, "metadata_only"> = input.importMode;

  let created:
    | {
        referenceSource: Prisma.ReferenceSourceGetPayload<{ select: typeof referenceSourceSelect }>;
        job: ReferenceUrlImportJobRecord;
        node: ReferenceUrlImportNodeRecord;
      }
    | null = null;

  try {
    created = await prisma.$transaction(async (tx) => {
      const updatedReferenceSource = await tx.referenceSource.update({
        where: {
          id: referenceSource.id,
        },
        data: {
          status: "pending",
          importMode: queuedImportMode,
          consentStatus: "confirmed",
          consentConfirmedAt,
          consentConfirmedBy: input.userId,
          metadataJson: toPrismaJson(
            mergeImportConsent(referenceSource.metadataJson, importConsent)
          ),
          errorJson: Prisma.JsonNull,
        },
        select: referenceSourceSelect,
      });

      const job = await tx.videoJob.create({
        data: {
          projectId: input.projectId,
          teamId: input.teamId,
          ownerId: input.userId,
          status: "queued",
          currentNode: REFERENCE_URL_IMPORT_NODE_TYPE,
        },
        select: referenceUrlImportJobSelect,
      });

      const workflowInput: ReferenceUrlImportWorkflowInput = {
        sourceType: "reference_url_import",
        referenceSourceId: referenceSource.id,
        projectId: input.projectId,
        teamId: input.teamId,
        userId: input.userId,
        sourceUrl: referenceSourceUrl,
        platform: referenceSource.platform,
        importMode: queuedImportMode,
      };

      const node = await tx.workflowNode.create({
        data: {
          jobId: job.id,
          nodeType: REFERENCE_URL_IMPORT_NODE_TYPE,
          status: "queued",
          version: 1,
          input: toPrismaJson(workflowInput),
        },
        select: referenceUrlImportNodeSelect,
      });

      return {
        referenceSource: updatedReferenceSource,
        job,
        node,
      };
    });

    await dependencies.queue.enqueue({
      jobId: created.job.id,
      nodeId: created.node.id,
      nodeType: REFERENCE_URL_IMPORT_NODE_TYPE,
      version: created.node.version,
      traceId: dependencies.createTraceId(),
    });
  } catch {
    return confirmReferenceUrlImportError(
      REFERENCE_URL_IMPORT_ERROR_CODES.enqueueFailed,
      REFERENCE_URL_IMPORT_ERROR_MESSAGES[REFERENCE_URL_IMPORT_ERROR_CODES.enqueueFailed]
    );
  }

  return {
    success: true,
    data: {
      referenceSource: serializeReferenceSource(created.referenceSource),
      nextStep: {
        nodeType: REFERENCE_URL_IMPORT_NODE_TYPE,
        status: "queued",
      },
      job: serializeReferenceUrlImportJob(created.job),
      node: serializeReferenceUrlImportNode(created.node),
    },
  };
}

const referenceSourceSelect = {
  id: true,
  projectId: true,
  teamId: true,
  sourceType: true,
  platform: true,
  sourceUrl: true,
  assetId: true,
  status: true,
  durationMs: true,
  title: true,
  thumbnailUrl: true,
  metadataJson: true,
  subtitleJson: true,
  importMode: true,
  consentStatus: true,
  consentConfirmedAt: true,
  consentConfirmedBy: true,
  structureJson: true,
  errorJson: true,
  createdAt: true,
  updatedAt: true,
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

const referenceUrlImportJobSelect = {
  id: true,
  projectId: true,
  teamId: true,
  ownerId: true,
  status: true,
  currentNode: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.VideoJobSelect;

const referenceUrlImportNodeSelect = {
  id: true,
  jobId: true,
  nodeType: true,
  status: true,
  version: true,
  input: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.WorkflowNodeSelect;

type ReferenceUrlImportJobRecord = Prisma.VideoJobGetPayload<{
  select: typeof referenceUrlImportJobSelect;
}>;

type ReferenceUrlImportNodeRecord = Prisma.WorkflowNodeGetPayload<{
  select: typeof referenceUrlImportNodeSelect;
}>;

function serializeReferenceUrlImportJob(
  job: ReferenceUrlImportJobRecord
): SerializedReferenceUrlImportJob {
  return {
    ...job,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
  };
}

function serializeReferenceUrlImportNode(
  node: ReferenceUrlImportNodeRecord
): SerializedReferenceUrlImportNode {
  return {
    ...node,
    createdAt: node.createdAt.toISOString(),
    updatedAt: node.updatedAt.toISOString(),
  };
}

function extractMetadataJson(parsed: Extract<ParseReferenceLinkResult, { success: true }>["parsed"]) {
  if (!parsed.raw || typeof parsed.raw !== "object" || Array.isArray(parsed.raw)) {
    return {};
  }

  const metadata = (parsed.raw as { metadata?: unknown }).metadata;
  return metadata && typeof metadata === "object" && !Array.isArray(metadata) ? metadata : {};
}

function extractSubtitleJson(metadataJson: unknown) {
  if (!metadataJson || typeof metadataJson !== "object" || Array.isArray(metadataJson)) {
    return {};
  }

  const metadata = metadataJson as {
    subtitles?: unknown;
    automaticCaptions?: unknown;
  };

  return {
    subtitles: metadata.subtitles ?? {},
    automaticCaptions: metadata.automaticCaptions ?? {},
  };
}

function requiresReferenceAnalysisConsent(importMode: ReferenceUrlImportMode): boolean {
  return importMode === "subtitle_only" || importMode === "audio_extract";
}

function detectProhibitedReferenceUrlImportRequest(input: {
  sourceUrl: string;
  requestedCapability?: ReferenceUrlImportRequestedCapability;
}): { reason: string } | null {
  if (
    input.requestedCapability === "full_video" ||
    input.requestedCapability === "cookie_import" ||
    input.requestedCapability === "no_watermark" ||
    input.requestedCapability === "batch_channel"
  ) {
    return { reason: input.requestedCapability };
  }

  const parsedUrl = parseUrlOrNull(input.sourceUrl);
  if (!parsedUrl) {
    return null;
  }

  const pathname = parsedUrl.pathname.toLowerCase();
  if (
    pathname.includes("/playlist") ||
    pathname.includes("/channel/") ||
    pathname.includes("/c/") ||
    pathname.startsWith("/@")
  ) {
    return { reason: "batch_channel" };
  }

  return null;
}

function mergeImportConsent(
  metadataJson: unknown,
  importConsent: Record<string, unknown>
): Record<string, unknown> {
  const metadata =
    metadataJson && typeof metadataJson === "object" && !Array.isArray(metadataJson)
      ? { ...(metadataJson as Record<string, unknown>) }
      : {};

  return {
    ...metadata,
    importConsent,
  };
}

function toPrismaJson(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value === null || value === undefined) {
    return Prisma.JsonNull;
  }

  return value as Prisma.InputJsonValue;
}

function getErrorDetail(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "Unknown reference URL import error";
}

function getYtDlpVersion(metadataJson: unknown): string | null {
  if (!metadataJson || typeof metadataJson !== "object" || Array.isArray(metadataJson)) {
    return null;
  }

  const metadata = metadataJson as { ytDlpVersion?: unknown; ytdlpVersion?: unknown };
  return typeof metadata.ytDlpVersion === "string"
    ? metadata.ytDlpVersion
    : typeof metadata.ytdlpVersion === "string"
      ? metadata.ytdlpVersion
      : null;
}

function parseUrlOrNull(value: string): URL | null {
  const trimmed = value.trim();
  try {
    return new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }
}

async function writeReferenceUrlImportAudit(input: {
  teamId: string;
  userId?: string;
  targetType: string;
  targetId: string;
  metadata: Prisma.InputJsonValue;
}): Promise<void> {
  if (!input.userId) {
    return;
  }

  await writeAuditLog(
    "reference_url_import",
    input.targetType,
    input.targetId,
    input.metadata,
    {
      teamId: input.teamId,
      userId: input.userId,
    }
  );
}

function parseReferenceUrlMetadataError(
  code: ParseReferenceUrlMetadataErrorCode,
  message: string,
  detail?: string,
  data?: Extract<ParseReferenceUrlMetadataResult, { success: false }>["data"]
): Extract<ParseReferenceUrlMetadataResult, { success: false }> {
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

function confirmReferenceUrlImportError(
  code: ConfirmReferenceUrlImportErrorCode,
  message: string,
  detail?: string
): Extract<ConfirmReferenceUrlImportResult, { success: false }> {
  return {
    success: false,
    error: {
      code,
      message,
      ...(detail ? { detail } : {}),
    },
  };
}
