import type { ApiAspectRatio } from "@/lib/aspect-ratio";
import { toApiAspectRatio } from "@/lib/aspect-ratio";
import {
  AVATAR_RENDER_VIDEO_ARTIFACT_TYPE,
  type AvatarRenderCrop,
} from "@/lib/avatar-render/constants";
import { prisma } from "@/lib/db";
import { generatePresignedObjectUrl } from "@/lib/storage";

const AVATAR_RENDER_VIDEO_ACCESS_URL_EXPIRES_SECONDS = 60 * 60;

export type SerializedAvatarRenderResult = {
  id: string;
  jobId: string;
  nodeId: string;
  avatarId: string;
  audioArtifactId: string;
  mode: "preview" | "hd";
  aspectRatio: ApiAspectRatio;
  crop: AvatarRenderCrop;
  provider: string;
  providerRequestId: string | null;
  createdAt: string;
  updatedAt: string;
  node: {
    id: string;
    status: string;
    version: number;
    requiresApproval: boolean;
    output: unknown;
    error: unknown;
  };
  avatar: {
    id: string;
    name: string;
    previewUrl: string | null;
  };
  videoArtifact: {
    id: string;
    type: string;
    storageUrl: string;
    accessUrl: string;
    metadata: unknown;
    createdAt: string;
  } | null;
};

export type ListAvatarRenderResultsForJobInput = {
  jobId: string;
  teamId: string;
};

export type ListAvatarRenderResultsForJobResult =
  | {
      success: true;
      data: {
        results: SerializedAvatarRenderResult[];
      };
    }
  | {
      success: false;
      error: {
        code: "AVATAR_RENDER_JOB_NOT_FOUND" | "AVATAR_RENDER_RESULT_LIST_FAILED";
        message: string;
      };
    };

type GenerateArtifactAccessUrl = (
  storageUrl: string,
  expiresInSeconds: number
) => Promise<string>;

export type ListAvatarRenderResultsForJobDependencies = {
  generateArtifactAccessUrl: GenerateArtifactAccessUrl;
  onAccessUrlError: (error: unknown, storageUrl: string) => void;
};

const defaultListAvatarRenderResultsForJobDependencies: ListAvatarRenderResultsForJobDependencies = {
  generateArtifactAccessUrl: generatePresignedObjectUrl,
  onAccessUrlError: () => undefined,
};

export async function listAvatarRenderResultsForJob(
  input: ListAvatarRenderResultsForJobInput,
  dependencies: Partial<ListAvatarRenderResultsForJobDependencies> = {}
): Promise<ListAvatarRenderResultsForJobResult> {
  const { generateArtifactAccessUrl, onAccessUrlError } = {
    ...defaultListAvatarRenderResultsForJobDependencies,
    ...dependencies,
  };

  try {
    const job = await prisma.videoJob.findFirst({
      where: {
        id: input.jobId,
        teamId: input.teamId,
      },
      select: {
        id: true,
      },
    });

    if (!job) {
      return {
        success: false,
        error: {
          code: "AVATAR_RENDER_JOB_NOT_FOUND",
          message: "视频任务不存在",
        },
      };
    }

    const requests = await prisma.avatarRenderRequest.findMany({
      where: {
        jobId: input.jobId,
      },
      orderBy: {
        createdAt: "desc",
      },
      include: {
        node: {
          select: {
            id: true,
            status: true,
            version: true,
            requiresApproval: true,
            output: true,
            error: true,
            artifacts: {
              where: {
                type: AVATAR_RENDER_VIDEO_ARTIFACT_TYPE,
              },
              orderBy: {
                createdAt: "desc",
              },
              take: 1,
              select: {
                id: true,
                type: true,
                storageUrl: true,
                metadata: true,
                createdAt: true,
              },
            },
          },
        },
        avatar: {
          select: {
            id: true,
            name: true,
            previewUrl: true,
          },
        },
      },
    });

    return {
      success: true,
      data: {
        results: await Promise.all(
          requests.map((request) =>
            serializeAvatarRenderResult(request, {
              generateArtifactAccessUrl,
              onAccessUrlError,
            })
          )
        ),
      },
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: "AVATAR_RENDER_RESULT_LIST_FAILED",
        message:
          error instanceof Error ? error.message : "数字人渲染结果加载失败",
      },
    };
  }
}

type AvatarRenderResultRecord = Awaited<
  ReturnType<typeof prisma.avatarRenderRequest.findMany>
>[number] & {
  node: {
    id: string;
    status: string;
    version: number;
    requiresApproval: boolean;
    output: unknown;
    error: unknown;
    artifacts: Array<{
      id: string;
      type: string;
      storageUrl: string;
      metadata: unknown;
      createdAt: Date;
    }>;
  };
  avatar: {
    id: string;
    name: string;
    previewUrl: string | null;
  };
};

async function serializeAvatarRenderResult(
  request: AvatarRenderResultRecord,
  dependencies: ListAvatarRenderResultsForJobDependencies
): Promise<SerializedAvatarRenderResult> {
  return {
    id: request.id,
    jobId: request.jobId,
    nodeId: request.nodeId,
    avatarId: request.avatarId,
    audioArtifactId: request.audioArtifactId,
    mode: request.mode,
    aspectRatio: toApiAspectRatio(request.aspectRatio),
    crop: request.crop,
    provider: request.provider,
    providerRequestId: request.providerRequestId,
    createdAt: request.createdAt.toISOString(),
    updatedAt: request.updatedAt.toISOString(),
    node: request.node,
    avatar: request.avatar,
    videoArtifact: request.node.artifacts[0]
      ? await serializeAvatarRenderVideoArtifact(request.node.artifacts[0], dependencies)
      : null,
  };
}

async function serializeAvatarRenderVideoArtifact(
  artifact: NonNullable<AvatarRenderResultRecord["node"]["artifacts"][number]>,
  dependencies: ListAvatarRenderResultsForJobDependencies
): Promise<NonNullable<SerializedAvatarRenderResult["videoArtifact"]>> {
  let accessUrl = "";
  try {
    accessUrl = await dependencies.generateArtifactAccessUrl(
      artifact.storageUrl,
      AVATAR_RENDER_VIDEO_ACCESS_URL_EXPIRES_SECONDS
    );
  } catch (error) {
    dependencies.onAccessUrlError(error, artifact.storageUrl);
  }

  return {
    id: artifact.id,
    type: artifact.type,
    storageUrl: artifact.storageUrl,
    accessUrl,
    metadata: artifact.metadata,
    createdAt: artifact.createdAt.toISOString(),
  };
}
