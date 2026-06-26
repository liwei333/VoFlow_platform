import { readFile } from "fs/promises";
import { buildBgmMixFfmpegArgs } from "@/lib/export/audio-mix";
import {
  EXPORT_ARTIFACT_TYPES,
  EXPORT_ERROR_CODES,
  EXPORT_ERROR_MESSAGES,
  EXPORT_MIXED_AUDIO_CONTENT_TYPE,
  EXPORT_MIXED_AUDIO_FILE_NAME,
  EXPORT_WORKFLOW_NODE_TYPES,
} from "@/lib/export/constants";
import { uploadJobArtifact } from "@/lib/storage";
import {
  type WorkflowArtifactRecord,
  writeWorkflowArtifact,
} from "@/services/workflowArtifactService";
import { executeConfiguredFfmpeg } from "@/services/exportFfmpegService";

export interface CreateMixedAudioArtifactInput {
  teamId: string;
  jobId: string;
  nodeId: string;
  voiceAudioArtifactId: string;
  bgmAssetId: string;
  voiceAudioPath: string;
  bgmAudioPath: string;
  outputPath: string;
  durationSeconds: number;
  voiceVolume?: number;
  bgmVolume?: number;
}

export interface UploadMixedAudioInput {
  teamId: string;
  jobId: string;
  nodeType: string;
  fileName: string;
  content: Buffer;
  contentType: string;
  size: number;
}

export interface CreateMixedAudioArtifactDependencies {
  executeFfmpeg(args: string[]): Promise<void>;
  readOutputFile(path: string): Promise<Buffer>;
  uploadMixedAudio(input: UploadMixedAudioInput): Promise<string>;
  writeArtifact(input: {
    jobId: string;
    nodeId: string;
    type: string;
    storageUrl: string;
    metadata: unknown;
  }): Promise<WorkflowArtifactRecord>;
}

export type CreateMixedAudioArtifactResult =
  | {
      success: true;
      data: {
        artifact: WorkflowArtifactRecord;
      };
    }
  | {
      success: false;
      error: {
        code: typeof EXPORT_ERROR_CODES.bgmMixFailed;
        message: string;
      };
    };

const defaultCreateMixedAudioArtifactDependencies: CreateMixedAudioArtifactDependencies = {
  executeFfmpeg: executeConfiguredFfmpeg,
  readOutputFile: readFile,
  uploadMixedAudio: async (input) =>
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

export async function createMixedAudioArtifact(
  input: CreateMixedAudioArtifactInput,
  dependencies: Partial<CreateMixedAudioArtifactDependencies> = {}
): Promise<CreateMixedAudioArtifactResult> {
  const { executeFfmpeg, readOutputFile, uploadMixedAudio, writeArtifact } = {
    ...defaultCreateMixedAudioArtifactDependencies,
    ...dependencies,
  };

  try {
    const ffmpegArgs = buildBgmMixFfmpegArgs({
      voiceAudioPath: input.voiceAudioPath,
      bgmAudioPath: input.bgmAudioPath,
      outputPath: input.outputPath,
      durationSeconds: input.durationSeconds,
      voiceVolume: input.voiceVolume,
      bgmVolume: input.bgmVolume,
    });

    await executeFfmpeg(ffmpegArgs);
    const mixedAudio = await readOutputFile(input.outputPath);
    const storageUrl = await uploadMixedAudio({
      teamId: input.teamId,
      jobId: input.jobId,
      nodeType: EXPORT_WORKFLOW_NODE_TYPES.bgmMix,
      fileName: EXPORT_MIXED_AUDIO_FILE_NAME,
      content: mixedAudio,
      contentType: EXPORT_MIXED_AUDIO_CONTENT_TYPE,
      size: mixedAudio.byteLength,
    });
    const artifact = await writeArtifact({
      jobId: input.jobId,
      nodeId: input.nodeId,
      type: EXPORT_ARTIFACT_TYPES.mixedAudio,
      storageUrl,
      metadata: {
        voiceAudioArtifactId: input.voiceAudioArtifactId,
        bgmAssetId: input.bgmAssetId,
        durationSeconds: input.durationSeconds,
        voiceVolume: input.voiceVolume,
        bgmVolume: input.bgmVolume,
      },
    });

    return {
      success: true,
      data: {
        artifact,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: EXPORT_ERROR_CODES.bgmMixFailed,
        message:
          error instanceof Error
            ? error.message
            : EXPORT_ERROR_MESSAGES[EXPORT_ERROR_CODES.bgmMixFailed],
      },
    };
  }
}
