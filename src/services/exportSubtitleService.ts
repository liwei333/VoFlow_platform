import { prisma } from "@/lib/db";
import {
  EXPORT_ASS_SUBTITLE_CONTENT_TYPE,
  EXPORT_ASS_SUBTITLE_FILE_NAME,
  EXPORT_ASS_SUBTITLE_FORMAT,
  EXPORT_ARTIFACT_TYPES,
  EXPORT_ERROR_CODES,
  EXPORT_ERROR_MESSAGES,
  EXPORT_SUBTITLE_CONTENT_TYPE,
  EXPORT_SUBTITLE_FILE_NAME,
  EXPORT_SUBTITLE_FORMAT,
  EXPORT_WORKFLOW_NODE_TYPES,
} from "@/lib/export/constants";
import {
  buildAssSubtitle,
  buildSrtSubtitle,
  buildSubtitleCues,
} from "@/lib/export/subtitle";
import { uploadJobArtifact } from "@/lib/storage";
import {
  type WorkflowArtifactRecord,
  writeWorkflowArtifact,
} from "@/services/workflowArtifactService";

export interface CreateSubtitleArtifactForJobInput {
  jobId: string;
  teamId: string;
  nodeId: string;
}

export interface SubtitleSourceRecord {
  jobId: string;
  teamId: string;
  scriptCandidateId: string;
  scriptContent: string;
  audioArtifactId: string;
}

export interface UploadSubtitleInput {
  teamId: string;
  jobId: string;
  nodeType: string;
  fileName: string;
  content: Buffer;
  contentType: string;
  size: number;
}

export interface ExportSubtitleRepository {
  findSubtitleSource(input: {
    jobId: string;
    teamId: string;
  }): Promise<SubtitleSourceRecord | null>;
}

export type UploadSubtitle = (input: UploadSubtitleInput) => Promise<string>;

export type WriteSubtitleArtifact = (input: {
  jobId: string;
  nodeId: string;
  type: string;
  storageUrl: string;
  metadata: unknown;
}) => Promise<WorkflowArtifactRecord>;

export interface CreateSubtitleArtifactForJobDependencies {
  repository: ExportSubtitleRepository;
  uploadSubtitle: UploadSubtitle;
  writeArtifact: WriteSubtitleArtifact;
}

export type CreateSubtitleArtifactForJobResult =
  | {
      success: true;
      data: {
        artifact: WorkflowArtifactRecord;
        subtitleContent: string;
        segmentCount: number;
      };
    }
  | {
      success: false;
      error: {
        code:
          | typeof EXPORT_ERROR_CODES.subtitleSourceNotFound
          | typeof EXPORT_ERROR_CODES.subtitleGenerationFailed;
        message: string;
      };
    };

type SubtitleOutputFormat = "srt" | "ass";

const prismaExportSubtitleRepository: ExportSubtitleRepository = {
  async findSubtitleSource(input) {
    const request = await prisma.ttsRequest.findFirst({
      where: {
        jobId: input.jobId,
        status: "succeeded",
        audioArtifactId: {
          not: null,
        },
        job: {
          teamId: input.teamId,
        },
        scriptCandidate: {
          status: "approved",
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        jobId: true,
        audioArtifactId: true,
        job: {
          select: {
            teamId: true,
          },
        },
        scriptCandidate: {
          select: {
            id: true,
            content: true,
          },
        },
      },
    });

    if (!request?.audioArtifactId) {
      return null;
    }

    return {
      jobId: request.jobId,
      teamId: request.job.teamId,
      scriptCandidateId: request.scriptCandidate.id,
      scriptContent: request.scriptCandidate.content,
      audioArtifactId: request.audioArtifactId,
    };
  },
};

const defaultCreateSubtitleArtifactForJobDependencies: CreateSubtitleArtifactForJobDependencies = {
  repository: prismaExportSubtitleRepository,
  uploadSubtitle: async (input) =>
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

export async function createSubtitleArtifactForJob(
  input: CreateSubtitleArtifactForJobInput,
  dependencies: Partial<CreateSubtitleArtifactForJobDependencies> = {}
): Promise<CreateSubtitleArtifactForJobResult> {
  return createSubtitleArtifact(input, "srt", dependencies);
}

export async function createAssSubtitleArtifactForJob(
  input: CreateSubtitleArtifactForJobInput,
  dependencies: Partial<CreateSubtitleArtifactForJobDependencies> = {}
): Promise<CreateSubtitleArtifactForJobResult> {
  return createSubtitleArtifact(input, "ass", dependencies);
}

async function createSubtitleArtifact(
  input: CreateSubtitleArtifactForJobInput,
  outputFormat: SubtitleOutputFormat,
  dependencies: Partial<CreateSubtitleArtifactForJobDependencies> = {}
): Promise<CreateSubtitleArtifactForJobResult> {
  const { repository, uploadSubtitle, writeArtifact } = {
    ...defaultCreateSubtitleArtifactForJobDependencies,
    ...dependencies,
  };

  try {
    const source = await repository.findSubtitleSource({
      jobId: input.jobId,
      teamId: input.teamId,
    });

    if (!source) {
      return {
        success: false,
        error: {
          code: EXPORT_ERROR_CODES.subtitleSourceNotFound,
          message: EXPORT_ERROR_MESSAGES[EXPORT_ERROR_CODES.subtitleSourceNotFound],
        },
      };
    }

    const subtitleContent =
      outputFormat === "ass"
        ? buildAssSubtitle(source.scriptContent)
        : buildSrtSubtitle(source.scriptContent);
    const segmentCount = buildSubtitleCues(source.scriptContent).length;
    const content = Buffer.from(subtitleContent, "utf8");
    const storageUrl = await uploadSubtitle({
      teamId: source.teamId,
      jobId: source.jobId,
      nodeType: EXPORT_WORKFLOW_NODE_TYPES.subtitle,
      fileName:
        outputFormat === "ass"
          ? EXPORT_ASS_SUBTITLE_FILE_NAME
          : EXPORT_SUBTITLE_FILE_NAME,
      content,
      contentType:
        outputFormat === "ass"
          ? EXPORT_ASS_SUBTITLE_CONTENT_TYPE
          : EXPORT_SUBTITLE_CONTENT_TYPE,
      size: content.byteLength,
    });
    const artifact = await writeArtifact({
      jobId: source.jobId,
      nodeId: input.nodeId,
      type: EXPORT_ARTIFACT_TYPES.subtitle,
      storageUrl,
      metadata: {
        format:
          outputFormat === "ass"
            ? EXPORT_ASS_SUBTITLE_FORMAT
            : EXPORT_SUBTITLE_FORMAT,
        sourceScriptCandidateId: source.scriptCandidateId,
        audioArtifactId: source.audioArtifactId,
        segmentCount,
      },
    });

    return {
      success: true,
      data: {
        artifact,
        subtitleContent,
        segmentCount,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: EXPORT_ERROR_CODES.subtitleGenerationFailed,
        message:
          error instanceof Error
            ? error.message
            : EXPORT_ERROR_MESSAGES[EXPORT_ERROR_CODES.subtitleGenerationFailed],
      },
    };
  }
}
