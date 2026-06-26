import { Prisma, type ExportOutputProfile } from "@prisma/client";
import { createWriteStream } from "fs";
import { mkdtemp, readFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { pipeline } from "stream/promises";
import { prisma } from "@/lib/db";
import { buildFinalVideoFfmpegArgs } from "@/lib/export/final-video";
import {
  EXPORT_ARTIFACT_TYPES,
  EXPORT_ERROR_CODES,
  EXPORT_ERROR_MESSAGES,
  EXPORT_FINAL_VIDEO_CONTENT_TYPE,
  EXPORT_FINAL_VIDEO_FILE_NAME,
  EXPORT_WORKFLOW_NODE_TYPES,
} from "@/lib/export/constants";
import { getObjectByPath, uploadJobArtifact } from "@/lib/storage";
import type { WorkflowNodeHandler } from "@/services/workflowWorkerService";
import { executeConfiguredFfmpeg } from "@/services/exportFfmpegService";
import {
  type ValidateFinalVideoFileInput,
  validateFinalVideoFile,
} from "@/services/exportMediaValidationService";
import {
  type WorkflowArtifactRecord,
  writeWorkflowArtifact,
} from "@/services/workflowArtifactService";

export interface FinalExportRequestForWorker {
  id: string;
  jobId: string;
  outputProfile: ExportOutputProfile;
  job: {
    teamId: string;
  };
  avatarVideoArtifact: {
    id: string;
    storageUrl: string;
  };
  audioArtifact: {
    id: string;
    storageUrl: string;
  };
  subtitleArtifact: {
    id: string;
    storageUrl: string;
  } | null;
  editingConfig: {
    id: string;
    configJson: unknown;
  };
  bgmAssetId: string | null;
  coverArtifactId: string | null;
}

export interface FinalExportWorkerRepository {
  findExportRequestForWorker(input: {
    exportRequestId: string;
    jobId: string;
  }): Promise<FinalExportRequestForWorker | null>;
  markExportRequestRunning?(input: { exportRequestId: string }): Promise<void>;
  markExportRequestSucceeded(input: {
    exportRequestId: string;
    finalVideoArtifactId: string;
  }): Promise<void>;
  markExportRequestFailed(input: {
    exportRequestId: string;
    error: { code: string; message: string };
  }): Promise<void>;
}

export interface UploadFinalVideoInput {
  teamId: string;
  jobId: string;
  nodeType: string;
  fileName: string;
  content: Buffer;
  contentType: string;
  size: number;
}

export interface FinalExportWorkflowNodeHandlerDependencies {
  repository: FinalExportWorkerRepository;
  materializeObject(storageUrl: string): Promise<string>;
  executeFfmpeg(args: string[]): Promise<void>;
  readOutputFile(path: string): Promise<Buffer>;
  validateFinalVideo(input: ValidateFinalVideoFileInput): Promise<
    | { valid: true }
    | {
        valid: false;
        error: {
          code: typeof EXPORT_ERROR_CODES.exportMediaValidationFailed;
          message: string;
        };
      }
  >;
  uploadFinalVideo(input: UploadFinalVideoInput): Promise<string>;
  writeArtifact(input: {
    jobId: string;
    nodeId: string;
    type: string;
    storageUrl: string;
    metadata: unknown;
  }): Promise<WorkflowArtifactRecord>;
  buildOutputPath(input: { exportRequestId: string }): string;
}

export class FinalExportWorkerError extends Error {
  code:
    | typeof EXPORT_ERROR_CODES.exportFfmpegFailed
    | typeof EXPORT_ERROR_CODES.exportMediaValidationFailed;

  constructor(
    message: string = EXPORT_ERROR_MESSAGES[EXPORT_ERROR_CODES.exportFfmpegFailed],
    code:
      | typeof EXPORT_ERROR_CODES.exportFfmpegFailed
      | typeof EXPORT_ERROR_CODES.exportMediaValidationFailed = EXPORT_ERROR_CODES.exportFfmpegFailed
  ) {
    super(message);
    this.name = "FinalExportWorkerError";
    this.code = code;
  }
}

const prismaFinalExportWorkerRepository: FinalExportWorkerRepository = {
  async findExportRequestForWorker(input) {
    return prisma.exportRequest.findFirst({
      where: {
        id: input.exportRequestId,
        jobId: input.jobId,
      },
      select: {
        id: true,
        jobId: true,
        outputProfile: true,
        job: {
          select: {
            teamId: true,
          },
        },
        avatarVideoArtifact: {
          select: {
            id: true,
            storageUrl: true,
          },
        },
        audioArtifact: {
          select: {
            id: true,
            storageUrl: true,
          },
        },
        subtitleArtifact: {
          select: {
            id: true,
            storageUrl: true,
          },
        },
        editingConfig: {
          select: {
            id: true,
            configJson: true,
          },
        },
        bgmAssetId: true,
        coverArtifactId: true,
      },
    });
  },
  async markExportRequestRunning(input) {
    await prisma.exportRequest.update({
      where: {
        id: input.exportRequestId,
      },
      data: {
        status: "running",
      },
    });
  },
  async markExportRequestSucceeded(input) {
    await prisma.exportRequest.update({
      where: {
        id: input.exportRequestId,
      },
      data: {
        status: "succeeded",
        errorJson: Prisma.JsonNull,
      },
    });
  },
  async markExportRequestFailed(input) {
    await prisma.exportRequest.update({
      where: {
        id: input.exportRequestId,
      },
      data: {
        status: "failed",
        errorJson: input.error,
      },
    });
  },
};

const defaultFinalExportWorkflowNodeHandlerDependencies: FinalExportWorkflowNodeHandlerDependencies = {
  repository: prismaFinalExportWorkerRepository,
  materializeObject: materializeObjectToTempFile,
  executeFfmpeg: executeConfiguredFfmpeg,
  readOutputFile: readFile,
  validateFinalVideo: validateFinalVideoFile,
  uploadFinalVideo: async (input) =>
    uploadJobArtifact(
      input.teamId,
      input.jobId,
      input.nodeType,
      input.fileName,
      input.content,
      input.contentType,
      input.size
    ),
  writeArtifact: writeWorkflowArtifact,
  buildOutputPath: (input) => path.join(tmpdir(), `${input.exportRequestId}.mp4`),
};

export function createFinalExportWorkflowNodeHandler(
  dependencies: Partial<FinalExportWorkflowNodeHandlerDependencies> = {}
): WorkflowNodeHandler {
  const {
    repository,
    materializeObject,
    executeFfmpeg,
    readOutputFile,
    validateFinalVideo,
    uploadFinalVideo,
    writeArtifact,
    buildOutputPath,
  } = {
    ...defaultFinalExportWorkflowNodeHandlerDependencies,
    ...dependencies,
  };

  return async ({ payload, input }) => {
    const exportRequestId = readExportRequestId(input);
    const exportRequest = await repository.findExportRequestForWorker({
      exportRequestId,
      jobId: payload.jobId,
    });

    if (!exportRequest) {
      throw new FinalExportWorkerError("导出请求不存在");
    }

    await repository.markExportRequestRunning?.({ exportRequestId });

    try {
      const avatarVideoPath = await materializeObject(
        exportRequest.avatarVideoArtifact.storageUrl
      );
      const audioPath = await materializeObject(
        exportRequest.audioArtifact.storageUrl
      );
      const subtitlePath = exportRequest.subtitleArtifact
        ? await materializeObject(exportRequest.subtitleArtifact.storageUrl)
        : null;
      const outputPath = buildOutputPath({ exportRequestId });

      await executeFfmpeg(
        buildFinalVideoFfmpegArgs({
          avatarVideoPath,
          audioPath,
          subtitlePath,
          outputPath,
          outputProfile: exportRequest.outputProfile,
        })
      );

      const finalVideo = await readOutputFile(outputPath);
      const validation = await validateFinalVideo({
        filePath: outputPath,
        sizeBytes: finalVideo.byteLength,
        expectedDurationSeconds: null,
      });
      if (!validation.valid) {
        throw new FinalExportWorkerError(
          validation.error.message,
          validation.error.code
        );
      }
      const storageUrl = await uploadFinalVideo({
        teamId: exportRequest.job.teamId,
        jobId: exportRequest.jobId,
        nodeType: EXPORT_WORKFLOW_NODE_TYPES.finalExport,
        fileName: EXPORT_FINAL_VIDEO_FILE_NAME,
        content: finalVideo,
        contentType: EXPORT_FINAL_VIDEO_CONTENT_TYPE,
        size: finalVideo.byteLength,
      });
      const artifact = await writeArtifact({
        jobId: exportRequest.jobId,
        nodeId: payload.nodeId,
        type: EXPORT_ARTIFACT_TYPES.finalVideo,
        storageUrl,
        metadata: {
          exportRequestId,
          outputProfile: exportRequest.outputProfile,
          avatarVideoArtifactId: exportRequest.avatarVideoArtifact.id,
          audioArtifactId: exportRequest.audioArtifact.id,
          subtitleArtifactId: exportRequest.subtitleArtifact?.id ?? null,
          editingConfigId: exportRequest.editingConfig.id,
          bgmAssetId: exportRequest.bgmAssetId,
          coverArtifactId: exportRequest.coverArtifactId,
        },
      });

      await repository.markExportRequestSucceeded({
        exportRequestId,
        finalVideoArtifactId: artifact.id,
      });

      return {
        output: {
          exportRequestId,
          finalVideoArtifactId: artifact.id,
          storageUrl,
          outputProfile: exportRequest.outputProfile,
        },
      };
    } catch (error) {
      const workerError = normalizeFinalExportError(error);
      await repository.markExportRequestFailed({
        exportRequestId,
        error: {
          code: workerError.code,
          message: workerError.message,
        },
      });
      throw workerError;
    }
  };
}

function readExportRequestId(input: unknown): string {
  if (
    input &&
    typeof input === "object" &&
    !Array.isArray(input) &&
    typeof (input as { exportRequestId?: unknown }).exportRequestId === "string"
  ) {
    return (input as { exportRequestId: string }).exportRequestId;
  }
  throw new FinalExportWorkerError("导出请求参数无效");
}

function normalizeFinalExportError(error: unknown): FinalExportWorkerError {
  if (error instanceof FinalExportWorkerError) {
    return error;
  }
  return new FinalExportWorkerError(
    error instanceof Error
      ? error.message
      : EXPORT_ERROR_MESSAGES[EXPORT_ERROR_CODES.exportFfmpegFailed]
  );
}

async function materializeObjectToTempFile(storageUrl: string): Promise<string> {
  const tempDir = await mkdtemp(path.join(tmpdir(), "voflow-export-"));
  const fileName = path.basename(storageUrl) || "artifact.bin";
  const outputPath = path.join(tempDir, fileName);
  const stream = await getObjectByPath(storageUrl);
  await pipeline(stream, createWriteStream(outputPath));
  return outputPath;
}
