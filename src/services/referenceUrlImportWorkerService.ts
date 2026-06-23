import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  REFERENCE_URL_IMPORT_ERROR_CODES,
  REFERENCE_URL_IMPORT_ERROR_MESSAGES,
  buildReferenceLinkImportConfig,
} from "@/lib/references/url-import/config";
import {
  parseSubtitleText,
  selectPreferredSubtitleTrack,
  type ParsedSubtitleSegment,
  type ReferenceSubtitleTrack,
} from "@/lib/references/url-import/subtitle";
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

export interface CreateReferenceUrlImportWorkflowNodeHandlerDependencies {
  subtitleDownloader: ReferenceSubtitleDownloader;
  structureProvider?: ReferenceStructureProvider;
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

export function createReferenceUrlImportWorkflowNodeHandler(
  dependencies: Partial<CreateReferenceUrlImportWorkflowNodeHandlerDependencies> = {}
): WorkflowNodeHandler {
  const { subtitleDownloader, structureProvider } = {
    subtitleDownloader: defaultSubtitleDownloader,
    ...dependencies,
  };

  return async ({ payload, input }) => {
    const workflowInput = parseReferenceUrlImportWorkflowInput(input);
    if (workflowInput.importMode === "audio_extract") {
      return {
        output: {
          sourceType: "reference_url_import",
          referenceSourceId: workflowInput.referenceSourceId,
          importMode: workflowInput.importMode,
          stage: "importing",
          status: "deferred_to_audio_extract_task",
        },
      };
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
      throw normalizeReferenceUrlImportError(error);
    }
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
