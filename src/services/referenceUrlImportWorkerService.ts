import { Prisma } from "@prisma/client";
import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import { writeAuditLog } from "@/lib/audit-log";
import { uploadAsset as uploadAssetObject } from "@/lib/storage";
import { prisma } from "@/lib/db";
import {
  REFERENCE_ANALYSIS_ONLY_USAGE_SCOPE,
  REFERENCE_URL_IMPORT_ERROR_CODES,
  REFERENCE_URL_IMPORT_ERROR_MESSAGES,
  type ReferenceLinkImportConfig,
  buildReferenceLinkImportConfig,
} from "@/lib/references/url-import/config";
import {
  parseSubtitleText,
  selectPreferredSubtitleTrack,
  type ParsedSubtitleSegment,
  type ReferenceSubtitleTrack,
} from "@/lib/references/url-import/subtitle";
import { YtDlpClient } from "@/lib/references/url-import/ytdlp-client";
import { createReferenceExtractTask } from "@/services/referenceAsrService";
import {
  createLocalReferenceStructureProvider,
  type ReferenceStructure,
  type ReferenceStructureProvider,
} from "@/services/referenceStructureWorkerService";
import {
  getScriptAiModelRegistry,
  requireAvailableLlmService,
} from "@/services/scriptModelRegistryService";
import type { WorkflowNodeHandler } from "@/services/workflowWorkerService";

export const REFERENCE_URL_IMPORT_WORKFLOW_ERROR = "REFERENCE_URL_IMPORT_WORKFLOW_ERROR";

export interface ReferenceSubtitleDownloader {
  downloadSubtitle(
    track: ReferenceSubtitleTrack,
    options: { sourceUrl: string; traceId: string }
  ): Promise<string>;
}

export interface ReferenceExtractedAudio {
  content: Buffer;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export interface ReferenceAudioExtractor {
  extractAudio(
    sourceUrl: string,
    options: { maxAudioBytes: number; traceId: string }
  ): Promise<ReferenceExtractedAudio>;
}

export interface ReferenceAudioAssetStorage {
  uploadAsset(
    teamId: string,
    assetId: string,
    fileName: string,
    content: Buffer,
    contentType: string,
    size: number
  ): Promise<string>;
}

export type ReferenceExtractTaskCreator = typeof createReferenceExtractTask;

export interface CreateReferenceUrlImportWorkflowNodeHandlerDependencies {
  subtitleDownloader: ReferenceSubtitleDownloader;
  structureProvider?: ReferenceStructureProvider;
  audioExtractor: ReferenceAudioExtractor;
  assetStorage: ReferenceAudioAssetStorage;
  referenceExtractTask: ReferenceExtractTaskCreator;
  config: ReferenceLinkImportConfig;
}

const defaultSubtitleDownloader: ReferenceSubtitleDownloader = {
  async downloadSubtitle(track) {
    const config = buildReferenceLinkImportConfig();
    const response = await fetch(track.url);
    if (!response.ok) {
      throw referenceUrlImportWorkflowError(
        REFERENCE_URL_IMPORT_ERROR_CODES.subtitleUnavailable,
        REFERENCE_URL_IMPORT_ERROR_MESSAGES[REFERENCE_URL_IMPORT_ERROR_CODES.subtitleUnavailable]
      );
    }

    const content = await response.text();
    if (Buffer.byteLength(content, "utf8") > config.maxSubtitleBytes) {
      throw referenceUrlImportWorkflowError(
        REFERENCE_URL_IMPORT_ERROR_CODES.subtitleParseFailed,
        REFERENCE_URL_IMPORT_ERROR_MESSAGES[REFERENCE_URL_IMPORT_ERROR_CODES.subtitleParseFailed]
      );
    }

    return content;
  },
};

const defaultAudioAssetStorage: ReferenceAudioAssetStorage = {
  uploadAsset: uploadAssetObject,
};

export function createReferenceUrlImportWorkflowNodeHandler(
  dependencies: Partial<CreateReferenceUrlImportWorkflowNodeHandlerDependencies> = {}
): WorkflowNodeHandler {
  const config = dependencies.config ?? buildReferenceLinkImportConfig();
  const { subtitleDownloader, structureProvider, audioExtractor, assetStorage, referenceExtractTask } = {
    subtitleDownloader: defaultSubtitleDownloader,
    audioExtractor: createDefaultAudioExtractor(config),
    assetStorage: defaultAudioAssetStorage,
    referenceExtractTask: createReferenceExtractTask,
    ...dependencies,
  };

  return async ({ payload, input }) => {
    const workflowInput = parseReferenceUrlImportWorkflowInput(input);
    if (workflowInput.importMode === "audio_extract") {
      const audioWorkflowInput = {
        ...workflowInput,
        importMode: "audio_extract" as const,
      };
      try {
        return await runAudioExtractImport({
          workflowInput: audioWorkflowInput,
          traceId: payload.traceId,
          config,
          audioExtractor,
          assetStorage,
          referenceExtractTask,
        });
      } catch (error) {
        await markReferenceUrlImportFailed(audioWorkflowInput.referenceSourceId, error);
        await writeReferenceUrlImportAudit({
          workflowInput: audioWorkflowInput,
          status: "failed",
          failureReason: buildReferenceUrlImportFailureReason(error),
        });
        throw normalizeReferenceUrlImportError(error);
      }
    }

    try {
      const referenceSource = await findReferenceSourceForSubtitleImport(workflowInput);
      const subtitleTrack = selectPreferredSubtitleTrack(referenceSource.subtitleJson);
      if (!subtitleTrack) {
        throw referenceUrlImportWorkflowError(
          REFERENCE_URL_IMPORT_ERROR_CODES.subtitleUnavailable,
          REFERENCE_URL_IMPORT_ERROR_MESSAGES[REFERENCE_URL_IMPORT_ERROR_CODES.subtitleUnavailable]
        );
      }

      const subtitleContent = await subtitleDownloader.downloadSubtitle(subtitleTrack, {
        sourceUrl: workflowInput.sourceUrl,
        traceId: payload.traceId,
      });
      const parsedSubtitle = parseSubtitleText(subtitleContent, subtitleTrack.ext);
      const analyzer =
        structureProvider ?? (await createDefaultReferenceStructureProvider());
      const structureResult = await analyzer.analyzeStructure(
        {
          transcript: parsedSubtitle.text,
          segments: parsedSubtitle.segments,
        },
        {
          traceId: payload.traceId,
        }
      );
      const script = await saveSubtitleImportResult({
        jobId: payload.jobId,
        projectId: workflowInput.projectId,
        referenceSourceId: workflowInput.referenceSourceId,
        importMode: workflowInput.importMode,
        subtitleTrack,
        transcript: parsedSubtitle.text,
        segments: parsedSubtitle.segments,
        structure: structureResult.structure,
        structureProvider: structureResult.provider,
        structureModelName: structureResult.modelName,
      });
      await writeReferenceUrlImportAudit({
        workflowInput,
        status: "succeeded",
        failureReason: null,
      });

      return {
        output: {
          sourceType: "reference_url_import",
          referenceSourceId: workflowInput.referenceSourceId,
          importMode: workflowInput.importMode,
          stage: "structuring",
          status: "succeeded",
          scriptId: script.id,
          segmentCount: parsedSubtitle.segments.length,
          structure: structureResult.structure,
        },
      };
    } catch (error) {
      await markReferenceUrlImportFailed(workflowInput.referenceSourceId, error);
      await writeReferenceUrlImportAudit({
        workflowInput,
        status: "failed",
        failureReason: buildReferenceUrlImportFailureReason(error),
      });
      throw normalizeReferenceUrlImportError(error);
    }
  };
}

function createDefaultAudioExtractor(config: ReferenceLinkImportConfig): ReferenceAudioExtractor {
  const client = new YtDlpClient({
    ytdlpBin: config.ytdlpBin,
    timeoutMs: config.timeoutMs,
    maxMetadataBytes: config.maxMetadataBytes,
  });

  return {
    async extractAudio(sourceUrl, options) {
      return client.extractAudio(sourceUrl, {
        maxAudioBytes: options.maxAudioBytes,
      });
    },
  };
}

function parseReferenceUrlImportWorkflowInput(input: unknown): {
  sourceType: "reference_url_import";
  referenceSourceId: string;
  projectId: string;
  teamId: string;
  userId: string;
  sourceUrl: string;
  platform: string | null;
  importMode: "subtitle_only" | "audio_extract";
} {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw referenceUrlImportWorkflowError("参考链接导入节点输入无效");
  }

  const candidate = input as {
    sourceType?: unknown;
    referenceSourceId?: unknown;
    projectId?: unknown;
    teamId?: unknown;
    userId?: unknown;
    sourceUrl?: unknown;
    platform?: unknown;
    importMode?: unknown;
  };

  if (
    candidate.sourceType !== "reference_url_import" ||
    typeof candidate.referenceSourceId !== "string" ||
    typeof candidate.projectId !== "string" ||
    typeof candidate.teamId !== "string" ||
    typeof candidate.userId !== "string" ||
    typeof candidate.sourceUrl !== "string" ||
    (candidate.platform !== null && typeof candidate.platform !== "string") ||
    (candidate.importMode !== "subtitle_only" && candidate.importMode !== "audio_extract")
  ) {
    throw referenceUrlImportWorkflowError("参考链接导入节点输入无效");
  }

  return {
    sourceType: candidate.sourceType,
    referenceSourceId: candidate.referenceSourceId,
    projectId: candidate.projectId,
    teamId: candidate.teamId,
    userId: candidate.userId,
    sourceUrl: candidate.sourceUrl,
    platform: candidate.platform,
    importMode: candidate.importMode,
  };
}

async function findReferenceSourceForSubtitleImport(input: {
  referenceSourceId: string;
  projectId: string;
  teamId: string;
}) {
  const referenceSource = await prisma.referenceSource.findFirst({
    where: {
      id: input.referenceSourceId,
      projectId: input.projectId,
      teamId: input.teamId,
      sourceType: "url",
      importMode: "subtitle_only",
      consentStatus: "confirmed",
    },
    select: {
      id: true,
      subtitleJson: true,
    },
  });

  if (!referenceSource) {
    throw referenceUrlImportWorkflowError("REFERENCE_SOURCE_NOT_FOUND", "参考来源不存在");
  }

  return referenceSource;
}

async function runAudioExtractImport(input: {
  workflowInput: ReturnType<typeof parseReferenceUrlImportWorkflowInput> & {
    importMode: "audio_extract";
  };
  traceId: string;
  config: ReferenceLinkImportConfig;
  audioExtractor: ReferenceAudioExtractor;
  assetStorage: ReferenceAudioAssetStorage;
  referenceExtractTask: ReferenceExtractTaskCreator;
}): Promise<Awaited<ReturnType<WorkflowNodeHandler>>> {
  const referenceSource = await findReferenceSourceForAudioImport(input.workflowInput);
  assertAudioImportAllowed(referenceSource, input.config);

  const extractedAudio = await input.audioExtractor.extractAudio(input.workflowInput.sourceUrl, {
    maxAudioBytes: input.config.maxAudioBytes,
    traceId: input.traceId,
  });
  if (extractedAudio.sizeBytes > input.config.maxAudioBytes) {
    throw referenceUrlImportWorkflowError(
      REFERENCE_URL_IMPORT_ERROR_CODES.audioSizeLimitExceeded,
      REFERENCE_URL_IMPORT_ERROR_MESSAGES[REFERENCE_URL_IMPORT_ERROR_CODES.audioSizeLimitExceeded]
    );
  }

  const assetId = randomUUID();
  const storageUrl = await input.assetStorage.uploadAsset(
    input.workflowInput.teamId,
    assetId,
    extractedAudio.fileName,
    extractedAudio.content,
    extractedAudio.mimeType,
    extractedAudio.sizeBytes
  );
  await createReferenceAudioAsset({
    assetId,
    storageUrl,
    audio: extractedAudio,
    referenceSource,
    workflowInput: input.workflowInput,
  });

  const referenceExtractResult = await input.referenceExtractTask({
    projectId: input.workflowInput.projectId,
    teamId: input.workflowInput.teamId,
    userId: input.workflowInput.userId,
    assetId,
    usageScope: REFERENCE_ANALYSIS_ONLY_USAGE_SCOPE,
  });

  if (!referenceExtractResult.success) {
    throw referenceUrlImportWorkflowError(
      referenceExtractResult.error.code,
      referenceExtractResult.error.message
    );
  }

  await markAudioReferenceExtractQueued({
    referenceSourceId: input.workflowInput.referenceSourceId,
    existingMetadata: referenceSource.metadataJson,
    assetId,
    storageUrl,
    audio: extractedAudio,
    referenceExtractJobId: referenceExtractResult.data.job.id,
    referenceExtractNodeId: referenceExtractResult.data.node.id,
    referenceExtractSourceId: referenceExtractResult.data.referenceSource.id,
  });
  await writeReferenceUrlImportAudit({
    workflowInput: input.workflowInput,
    status: "succeeded",
    failureReason: null,
  });

  return {
    output: {
      sourceType: "reference_url_import",
      referenceSourceId: input.workflowInput.referenceSourceId,
      importMode: input.workflowInput.importMode,
      stage: "transcribing",
      status: "queued_reference_extract",
      assetId,
      referenceExtractSourceId: referenceExtractResult.data.referenceSource.id,
      referenceExtractJobId: referenceExtractResult.data.job.id,
      referenceExtractNodeId: referenceExtractResult.data.node.id,
    },
  };
}

async function findReferenceSourceForAudioImport(input: {
  referenceSourceId: string;
  projectId: string;
  teamId: string;
}) {
  const referenceSource = await prisma.referenceSource.findFirst({
    where: {
      id: input.referenceSourceId,
      projectId: input.projectId,
      teamId: input.teamId,
      sourceType: "url",
      importMode: "audio_extract",
      consentStatus: "confirmed",
    },
    select: {
      id: true,
      projectId: true,
      teamId: true,
      sourceUrl: true,
      platform: true,
      title: true,
      durationMs: true,
      metadataJson: true,
    },
  });

  if (!referenceSource) {
    throw referenceUrlImportWorkflowError("REFERENCE_SOURCE_NOT_FOUND", "参考来源不存在");
  }

  return referenceSource;
}

function assertAudioImportAllowed(
  referenceSource: Awaited<ReturnType<typeof findReferenceSourceForAudioImport>>,
  config: ReferenceLinkImportConfig
): void {
  if (!config.enabled) {
    throw referenceUrlImportWorkflowError(
      REFERENCE_URL_IMPORT_ERROR_CODES.disabled,
      REFERENCE_URL_IMPORT_ERROR_MESSAGES[REFERENCE_URL_IMPORT_ERROR_CODES.disabled]
    );
  }

  if (!config.allowAudioExtract) {
    throw referenceUrlImportWorkflowError(
      REFERENCE_URL_IMPORT_ERROR_CODES.audioExtractDisabled,
      REFERENCE_URL_IMPORT_ERROR_MESSAGES[REFERENCE_URL_IMPORT_ERROR_CODES.audioExtractDisabled]
    );
  }

  if (
    !referenceSource.platform ||
    !config.allowedPlatforms.some((platform) => platform === referenceSource.platform)
  ) {
    throw referenceUrlImportWorkflowError(
      REFERENCE_URL_IMPORT_ERROR_CODES.platformUnsupported,
      REFERENCE_URL_IMPORT_ERROR_MESSAGES[REFERENCE_URL_IMPORT_ERROR_CODES.platformUnsupported]
    );
  }

  if (!referenceSource.sourceUrl || referenceSource.durationMs === null) {
    throw referenceUrlImportWorkflowError(
      REFERENCE_URL_IMPORT_ERROR_CODES.importNotReady,
      REFERENCE_URL_IMPORT_ERROR_MESSAGES[REFERENCE_URL_IMPORT_ERROR_CODES.importNotReady]
    );
  }

  if (referenceSource.durationMs > config.maxDurationMs) {
    throw referenceUrlImportWorkflowError(
      REFERENCE_URL_IMPORT_ERROR_CODES.durationLimitExceeded,
      REFERENCE_URL_IMPORT_ERROR_MESSAGES[REFERENCE_URL_IMPORT_ERROR_CODES.durationLimitExceeded]
    );
  }
}

async function createReferenceAudioAsset(input: {
  assetId: string;
  storageUrl: string;
  audio: ReferenceExtractedAudio;
  referenceSource: Awaited<ReturnType<typeof findReferenceSourceForAudioImport>>;
  workflowInput: ReturnType<typeof parseReferenceUrlImportWorkflowInput> & {
    importMode: "audio_extract";
  };
}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.asset.create({
      data: {
        id: input.assetId,
        teamId: input.workflowInput.teamId,
        ownerId: input.workflowInput.userId,
        type: "audio",
        name: buildReferenceAudioAssetName(input.referenceSource.title),
        storageUrl: input.storageUrl,
        mimeType: input.audio.mimeType,
        sizeBytes: BigInt(input.audio.sizeBytes),
        metadata: toPrismaJson({
          sourceType: "reference_url_import",
          referenceSourceId: input.workflowInput.referenceSourceId,
          sourceUrl: input.workflowInput.sourceUrl,
          platform: input.workflowInput.platform,
          durationMs: input.referenceSource.durationMs,
          importMode: input.workflowInput.importMode,
        }),
        licenseStatus: "approved",
      },
    });

    await tx.assetConsent.create({
      data: {
        assetId: input.assetId,
        teamId: input.workflowInput.teamId,
        userId: input.workflowInput.userId,
        consentType: REFERENCE_ANALYSIS_ONLY_USAGE_SCOPE,
        consentText: REFERENCE_ANALYSIS_ONLY_USAGE_SCOPE,
        usageScope: [REFERENCE_ANALYSIS_ONLY_USAGE_SCOPE],
      },
    });

    await tx.referenceSource.update({
      where: {
        id: input.workflowInput.referenceSourceId,
      },
      data: {
        status: "transcribing",
        assetId: input.assetId,
        errorJson: Prisma.JsonNull,
      },
    });
  });
}

async function markAudioReferenceExtractQueued(input: {
  referenceSourceId: string;
  existingMetadata: Prisma.JsonValue | null;
  assetId: string;
  storageUrl: string;
  audio: ReferenceExtractedAudio;
  referenceExtractSourceId: string;
  referenceExtractJobId: string;
  referenceExtractNodeId: string;
}): Promise<void> {
  await prisma.referenceSource.update({
    where: {
      id: input.referenceSourceId,
    },
    data: {
      status: "transcribing",
      metadataJson: toPrismaJson({
        ...asJsonObject(input.existingMetadata),
        audioExtract: {
          assetId: input.assetId,
          storageUrl: input.storageUrl,
          fileName: input.audio.fileName,
          mimeType: input.audio.mimeType,
          sizeBytes: input.audio.sizeBytes,
          usageScope: REFERENCE_ANALYSIS_ONLY_USAGE_SCOPE,
          referenceExtractSourceId: input.referenceExtractSourceId,
          referenceExtractJobId: input.referenceExtractJobId,
          referenceExtractNodeId: input.referenceExtractNodeId,
        },
      }),
      errorJson: Prisma.JsonNull,
    },
  });
}

function buildReferenceAudioAssetName(title: string | null): string {
  const normalized = title?.trim();
  return `${normalized || "参考链接"} - reference audio`;
}

async function writeReferenceUrlImportAudit(input: {
  workflowInput: ReturnType<typeof parseReferenceUrlImportWorkflowInput>;
  status: "succeeded" | "failed";
  failureReason: Prisma.InputJsonObject | null;
}): Promise<void> {
  const referenceSource = await prisma.referenceSource.findUnique({
    where: {
      id: input.workflowInput.referenceSourceId,
    },
    select: {
      sourceUrl: true,
      platform: true,
      durationMs: true,
      metadataJson: true,
    },
  });

  try {
    await writeAuditLog(
      "reference_url_import",
      "reference_source",
      input.workflowInput.referenceSourceId,
      {
        status: input.status,
        importMode: input.workflowInput.importMode,
        consentTextVersion: getReferenceUrlImportConsentTextVersion(
          referenceSource?.metadataJson
        ),
        sourceUrl: referenceSource?.sourceUrl ?? input.workflowInput.sourceUrl,
        platform: referenceSource?.platform ?? input.workflowInput.platform,
        durationMs: referenceSource?.durationMs ?? null,
        ytDlpVersion: getYtDlpVersion(referenceSource?.metadataJson),
        failureReason: input.failureReason,
      },
      {
        teamId: input.workflowInput.teamId,
        userId: input.workflowInput.userId,
      }
    );
  } catch (error) {
    if (isForeignKeyAuditContextError(error)) {
      return;
    }

    throw error;
  }
}

function buildReferenceUrlImportFailureReason(error: unknown): Prisma.InputJsonObject {
  return {
    code:
      error instanceof Error && "code" in error && typeof error.code === "string"
        ? error.code
        : REFERENCE_URL_IMPORT_WORKFLOW_ERROR,
    message: error instanceof Error ? error.message : "参考链接导入失败",
  };
}

function getReferenceUrlImportConsentTextVersion(metadataJson: Prisma.JsonValue | undefined | null): string | null {
  const metadata = asJsonObject(metadataJson ?? null);
  const importConsent = metadata.importConsent;
  if (!importConsent || typeof importConsent !== "object" || Array.isArray(importConsent)) {
    return null;
  }

  const consentTextVersion = (importConsent as { consentTextVersion?: unknown }).consentTextVersion;
  return typeof consentTextVersion === "string" ? consentTextVersion : null;
}

function getYtDlpVersion(metadataJson: Prisma.JsonValue | undefined | null): string | null {
  const metadata = asJsonObject(metadataJson ?? null);
  const value = metadata.ytDlpVersion ?? metadata.ytdlpVersion;
  return typeof value === "string" ? value : null;
}

function isForeignKeyAuditContextError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003";
}

async function createDefaultReferenceStructureProvider(): Promise<ReferenceStructureProvider> {
  const modelRegistry = await getScriptAiModelRegistry();
  const llmService = requireAvailableLlmService(modelRegistry.llm);
  return createLocalReferenceStructureProvider({ service: llmService });
}

async function saveSubtitleImportResult(input: {
  jobId: string;
  projectId: string;
  referenceSourceId: string;
  importMode: "subtitle_only";
  subtitleTrack: ReferenceSubtitleTrack;
  transcript: string;
  segments: ParsedSubtitleSegment[];
  structure: ReferenceStructure;
  structureProvider: string;
  structureModelName: string;
}): Promise<{ id: string }> {
  return prisma.$transaction(async (tx) => {
    const script = await tx.script.create({
      data: {
        projectId: input.projectId,
        jobId: input.jobId,
        sourceType: "asr",
        content: input.transcript,
        metadata: toPrismaJson({
          sourceType: "reference_url_import",
          referenceSourceId: input.referenceSourceId,
          importMode: input.importMode,
          subtitleTrack: input.subtitleTrack,
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
        status: "succeeded",
        transcriptScriptId: script.id,
        structureJson: toPrismaJson({
          ...input.structure,
          provider: input.structureProvider,
          modelName: input.structureModelName,
        }),
        errorJson: Prisma.JsonNull,
      },
    });

    return script;
  });
}

async function markReferenceUrlImportFailed(referenceSourceId: string, error: unknown): Promise<void> {
  await prisma.referenceSource.updateMany({
    where: {
      id: referenceSourceId,
    },
    data: {
      status: "failed",
      errorJson: toPrismaJson({
        code:
          error instanceof Error && "code" in error && typeof error.code === "string"
            ? error.code
            : REFERENCE_URL_IMPORT_WORKFLOW_ERROR,
        message: error instanceof Error ? error.message : "参考链接字幕导入失败",
      }),
    },
  });
}

function normalizeReferenceUrlImportError(error: unknown): Error & { code: string } {
  if (error instanceof Error && "code" in error && typeof error.code === "string") {
    return error as Error & { code: string };
  }

  return referenceUrlImportWorkflowError(
    REFERENCE_URL_IMPORT_WORKFLOW_ERROR,
    error instanceof Error ? error.message : "参考链接字幕导入失败"
  );
}

function referenceUrlImportWorkflowError(code: string, message: string): Error & { code: string };
function referenceUrlImportWorkflowError(message: string): Error & { code: string };
function referenceUrlImportWorkflowError(
  codeOrMessage: string,
  maybeMessage?: string
): Error & { code: string } {
  const message = maybeMessage ?? codeOrMessage;
  const error = new Error(message) as Error & { code: string };
  error.code = maybeMessage ? codeOrMessage : REFERENCE_URL_IMPORT_WORKFLOW_ERROR;
  return error;
}

function toPrismaJson(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value === null || value === undefined) {
    return Prisma.JsonNull;
  }

  return value as Prisma.InputJsonValue;
}

function asJsonObject(value: Prisma.JsonValue | null): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}
