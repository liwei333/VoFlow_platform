import { readFile } from "fs/promises";
import {
  buildCoverFrameFfmpegArgs,
  buildCoverTitleFfmpegArgs,
  resolveCoverFrameTimeSeconds,
} from "@/lib/export/cover";
import {
  EXPORT_ARTIFACT_TYPES,
  EXPORT_COVER_BASE_FILE_NAME,
  EXPORT_COVER_CONTENT_TYPE,
  EXPORT_COVER_TITLE_FILE_NAME,
  EXPORT_ERROR_CODES,
  EXPORT_ERROR_MESSAGES,
  EXPORT_WORKFLOW_NODE_TYPES,
} from "@/lib/export/constants";
import { uploadJobArtifact } from "@/lib/storage";
import { executeConfiguredFfmpeg } from "@/services/exportFfmpegService";
import {
  type WorkflowArtifactRecord,
  writeWorkflowArtifact,
} from "@/services/workflowArtifactService";

export interface CreateCoverBaseArtifactInput {
  teamId: string;
  jobId: string;
  nodeId: string;
  avatarVideoArtifactId: string;
  videoPath: string;
  outputPath: string;
  durationSeconds?: number | null;
}

export interface CreateCoverTitleArtifactInput {
  teamId: string;
  jobId: string;
  nodeId: string;
  baseCoverArtifactId: string;
  baseImagePath: string;
  outputPath: string;
  titleText: string;
}

export interface UploadCoverInput {
  teamId: string;
  jobId: string;
  nodeType: string;
  fileName: string;
  content: Buffer;
  contentType: string;
  size: number;
}

export interface CreateCoverBaseArtifactDependencies {
  executeFfmpeg(args: string[]): Promise<void>;
  readOutputFile(path: string): Promise<Buffer>;
  uploadCover(input: UploadCoverInput): Promise<string>;
  writeArtifact(input: {
    jobId: string;
    nodeId: string;
    type: string;
    storageUrl: string;
    metadata: unknown;
  }): Promise<WorkflowArtifactRecord>;
}

export type CreateCoverBaseArtifactResult =
  | {
      success: true;
      data: {
        artifact: WorkflowArtifactRecord;
        frameTimeSeconds: number;
      };
    }
  | {
      success: false;
      error: {
        code: typeof EXPORT_ERROR_CODES.coverFrameExtractionFailed;
        message: string;
      };
    };

export type CreateCoverTitleArtifactResult = CreateCoverBaseArtifactResult;

const defaultCreateCoverBaseArtifactDependencies: CreateCoverBaseArtifactDependencies = {
  executeFfmpeg: executeConfiguredFfmpeg,
  readOutputFile: readFile,
  uploadCover: async (input) =>
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
};

export async function createCoverBaseArtifact(
  input: CreateCoverBaseArtifactInput,
  dependencies: Partial<CreateCoverBaseArtifactDependencies> = {}
): Promise<CreateCoverBaseArtifactResult> {
  const { executeFfmpeg, readOutputFile, uploadCover, writeArtifact } = {
    ...defaultCreateCoverBaseArtifactDependencies,
    ...dependencies,
  };

  try {
    const frameTimeSeconds = resolveCoverFrameTimeSeconds(input.durationSeconds);
    await executeFfmpeg(
      buildCoverFrameFfmpegArgs({
        videoPath: input.videoPath,
        outputPath: input.outputPath,
        durationSeconds: input.durationSeconds,
      })
    );
    const coverImage = await readOutputFile(input.outputPath);
    const storageUrl = await uploadCover({
      teamId: input.teamId,
      jobId: input.jobId,
      nodeType: EXPORT_WORKFLOW_NODE_TYPES.cover,
      fileName: EXPORT_COVER_BASE_FILE_NAME,
      content: coverImage,
      contentType: EXPORT_COVER_CONTENT_TYPE,
      size: coverImage.byteLength,
    });
    const artifact = await writeArtifact({
      jobId: input.jobId,
      nodeId: input.nodeId,
      type: EXPORT_ARTIFACT_TYPES.cover,
      storageUrl,
      metadata: {
        avatarVideoArtifactId: input.avatarVideoArtifactId,
        frameTimeSeconds,
        stage: "base_frame",
      },
    });

    return {
      success: true,
      data: {
        artifact,
        frameTimeSeconds,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: EXPORT_ERROR_CODES.coverFrameExtractionFailed,
        message:
          error instanceof Error
            ? error.message
            : EXPORT_ERROR_MESSAGES[EXPORT_ERROR_CODES.coverFrameExtractionFailed],
      },
    };
  }
}

export async function createCoverTitleArtifact(
  input: CreateCoverTitleArtifactInput,
  dependencies: Partial<CreateCoverBaseArtifactDependencies> = {}
): Promise<CreateCoverTitleArtifactResult> {
  const { executeFfmpeg, readOutputFile, uploadCover, writeArtifact } = {
    ...defaultCreateCoverBaseArtifactDependencies,
    ...dependencies,
  };

  try {
    await executeFfmpeg(
      buildCoverTitleFfmpegArgs({
        baseImagePath: input.baseImagePath,
        outputPath: input.outputPath,
        titleText: input.titleText,
      })
    );
    const coverImage = await readOutputFile(input.outputPath);
    const storageUrl = await uploadCover({
      teamId: input.teamId,
      jobId: input.jobId,
      nodeType: EXPORT_WORKFLOW_NODE_TYPES.cover,
      fileName: EXPORT_COVER_TITLE_FILE_NAME,
      content: coverImage,
      contentType: EXPORT_COVER_CONTENT_TYPE,
      size: coverImage.byteLength,
    });
    const artifact = await writeArtifact({
      jobId: input.jobId,
      nodeId: input.nodeId,
      type: EXPORT_ARTIFACT_TYPES.cover,
      storageUrl,
      metadata: {
        baseCoverArtifactId: input.baseCoverArtifactId,
        titleText: input.titleText,
        stage: "title_frame",
      },
    });

    return {
      success: true,
      data: {
        artifact,
        frameTimeSeconds: 0,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: EXPORT_ERROR_CODES.coverFrameExtractionFailed,
        message:
          error instanceof Error
            ? error.message
            : EXPORT_ERROR_MESSAGES[EXPORT_ERROR_CODES.coverFrameExtractionFailed],
      },
    };
  }
}
