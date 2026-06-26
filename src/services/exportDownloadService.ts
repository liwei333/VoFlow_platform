import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit-log";
import {
  EXPORT_ARTIFACT_TYPES,
  EXPORT_DOWNLOAD_URL_EXPIRES_SECONDS,
  EXPORT_ERROR_CODES,
  EXPORT_ERROR_MESSAGES,
} from "@/lib/export/constants";
import { generatePresignedObjectUrl } from "@/lib/storage";

export interface CreateFinalVideoDownloadUrlInput {
  artifactId: string;
  teamId: string;
  userId: string;
}

export interface DownloadableArtifactRecord {
  id: string;
  jobId: string;
  type: string;
  storageUrl: string;
}

export interface ExportDownloadRepository {
  findDownloadableArtifact(input: {
    artifactId: string;
    teamId: string;
  }): Promise<DownloadableArtifactRecord | null>;
}

export interface WriteDownloadAuditLogInput {
  teamId: string;
  userId: string;
  artifactId: string;
  jobId: string;
  storageUrl: string;
}

export interface CreateFinalVideoDownloadUrlDependencies {
  repository: ExportDownloadRepository;
  generateDownloadUrl(storageUrl: string, expiresInSeconds: number): Promise<string>;
  writeDownloadAuditLog(input: WriteDownloadAuditLogInput): Promise<unknown>;
}

export type CreateFinalVideoDownloadUrlResult =
  | {
      success: true;
      data: {
        artifactId: string;
        downloadUrl: string;
        expiresInSeconds: number;
      };
    }
  | {
      success: false;
      error: {
        code: typeof EXPORT_ERROR_CODES.finalVideoNotFound;
        message: string;
      };
    };

const prismaExportDownloadRepository: ExportDownloadRepository = {
  async findDownloadableArtifact(input) {
    return prisma.artifact.findFirst({
      where: {
        id: input.artifactId,
        job: {
          teamId: input.teamId,
        },
      },
      select: {
        id: true,
        jobId: true,
        type: true,
        storageUrl: true,
      },
    });
  },
};

const defaultCreateFinalVideoDownloadUrlDependencies: CreateFinalVideoDownloadUrlDependencies = {
  repository: prismaExportDownloadRepository,
  generateDownloadUrl: generatePresignedObjectUrl,
  async writeDownloadAuditLog(input) {
    return writeAuditLog(
      "job_update",
      "artifact",
      input.artifactId,
      {
        event: "artifact_download",
        artifactType: EXPORT_ARTIFACT_TYPES.finalVideo,
        jobId: input.jobId,
        storageUrl: input.storageUrl,
      },
      {
        teamId: input.teamId,
        userId: input.userId,
      }
    );
  },
};

export async function createFinalVideoDownloadUrl(
  input: CreateFinalVideoDownloadUrlInput,
  dependencies: Partial<CreateFinalVideoDownloadUrlDependencies> = {}
): Promise<CreateFinalVideoDownloadUrlResult> {
  const { repository, generateDownloadUrl, writeDownloadAuditLog } = {
    ...defaultCreateFinalVideoDownloadUrlDependencies,
    ...dependencies,
  };

  const artifact = await repository.findDownloadableArtifact({
    artifactId: input.artifactId,
    teamId: input.teamId,
  });

  if (!artifact || artifact.type !== EXPORT_ARTIFACT_TYPES.finalVideo) {
    return {
      success: false,
      error: {
        code: EXPORT_ERROR_CODES.finalVideoNotFound,
        message: EXPORT_ERROR_MESSAGES[EXPORT_ERROR_CODES.finalVideoNotFound],
      },
    };
  }

  const downloadUrl = await generateDownloadUrl(
    artifact.storageUrl,
    EXPORT_DOWNLOAD_URL_EXPIRES_SECONDS
  );
  await writeDownloadAuditLog({
    teamId: input.teamId,
    userId: input.userId,
    artifactId: artifact.id,
    jobId: artifact.jobId,
    storageUrl: artifact.storageUrl,
  });

  return {
    success: true,
    data: {
      artifactId: artifact.id,
      downloadUrl,
      expiresInSeconds: EXPORT_DOWNLOAD_URL_EXPIRES_SECONDS,
    },
  };
}
