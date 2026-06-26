import type { Readable } from "node:stream";
import { prisma } from "@/lib/db";
import { getObjectByPath } from "@/lib/storage";

export const FINAL_VIDEO_ARTIFACT_ERROR_CODES = {
  notFound: "PUBLISH_FINAL_VIDEO_NOT_FOUND",
} as const;

export interface ResolveFinalVideoArtifactInput {
  teamId: string;
  jobId: string;
}

export interface ResolvedFinalVideoArtifact {
  id: string;
  jobId: string;
  storageUrl: string;
  contentType: string;
  sizeBytes: number | null;
  stream: Readable;
}

export interface ResolveFinalVideoArtifactDependencies {
  downloadObject?: (objectName: string) => Promise<Readable>;
}

export type ResolveFinalVideoArtifactResult =
  | {
      success: true;
      data: {
        artifact: ResolvedFinalVideoArtifact;
      };
    }
  | {
      success: false;
      error: {
        code: typeof FINAL_VIDEO_ARTIFACT_ERROR_CODES.notFound;
        message: string;
      };
    };

export async function resolveFinalVideoArtifact(
  input: ResolveFinalVideoArtifactInput,
  dependencies: ResolveFinalVideoArtifactDependencies = {}
): Promise<ResolveFinalVideoArtifactResult> {
  const artifact = await prisma.artifact.findFirst({
    where: {
      jobId: input.jobId,
      type: "final_video",
      job: {
        teamId: input.teamId,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      jobId: true,
      storageUrl: true,
      metadata: true,
    },
  });

  if (!artifact) {
    return {
      success: false,
      error: {
        code: FINAL_VIDEO_ARTIFACT_ERROR_CODES.notFound,
        message: "最终 MP4 产物不存在",
      },
    };
  }

  const downloadObject = dependencies.downloadObject ?? getObjectByPath;
  const stream = await downloadObject(artifact.storageUrl);

  return {
    success: true,
    data: {
      artifact: {
        id: artifact.id,
        jobId: artifact.jobId,
        storageUrl: artifact.storageUrl,
        contentType: readMetadataString(artifact.metadata, "contentType") ?? "video/mp4",
        sizeBytes: readMetadataNumber(artifact.metadata, "sizeBytes"),
        stream,
      },
    },
  };
}

function readMetadataString(metadata: unknown, key: string): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" ? value : null;
}

function readMetadataNumber(metadata: unknown, key: string): number | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
